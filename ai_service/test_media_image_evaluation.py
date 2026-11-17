"""Strict admission controls for the frozen external image evaluation."""
import hashlib
import json
import os
from contextlib import nullcontext
from types import SimpleNamespace
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from ai_service import evaluate_media_images as evaluation
from ai_service.prepare_media_image_evaluation import (DATASET, REVISION, LICENSE,
    _image_evidence,canonical_inventory_sha256,inventory_sha256_file,strict_json_loads)


def digest(value):
    return hashlib.sha256(value).hexdigest()


class FrozenImageManifestTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        image_dir = self.root / "images"
        image_dir.mkdir()
        protocol = json.loads(evaluation.PROTOCOL.read_text(encoding="utf-8"))
        rows = []
        inventory_rows = []
        index = 0
        for role, labels in protocol["roles"].items():
            for label, quota in labels.items():
                for _ in range(quota):
                    source_label = 0 if label == "genuine" else 1
                    model_name = "camera-source" if label == "genuine" else "generator-a"
                    source_dataset = "coco"
                    image_name = f"image-{index}"
                    prompt = f"synthetic prompt {index}" if label == "synthetic" else ""
                    identity = f"{source_dataset}:{model_name}:{image_name}"
                    sample_id = digest(identity.encode())[:24]
                    source_identity = f"{source_dataset}:{image_name}"
                    image = Image.new("RGB", (64, 64), (index, (index * 3) % 256, (index * 7) % 256))
                    path = image_dir / f"{sample_id}.png"
                    image.save(path, format="PNG")
                    raw = path.read_bytes()
                    inventory_rows.append({
                        "shard": "data/CompEval-00001-of-00413.parquet",
                        "index": index,
                        "label": source_label,
                        "model_name": model_name,
                        "real_source": source_dataset,
                        "image_name": image_name,
                        "split": "test",
                        "nsfw_flag": False,
                        "prompt": prompt,
                        "imagePath": f"data/CompEval-00001-of-00413.parquet#row={index}",
                        "imageSha256": digest(raw),
                        "decodedSha256": digest(image.tobytes()),
                        "imageGeometry": {"format":"PNG","width":64,"height":64,
                                          "orientedSize":[64,64],"mode":"RGB"},
                    })
                    rows.append({
                        "id": sample_id,
                        "path": f"images/{sample_id}.png",
                        "sha256": digest(raw),
                        "decodedSha256": digest(image.tobytes()),
                        "label": label,
                        "role": role,
                        "group": digest(source_identity.encode()),
                        "promptGroup": digest(prompt.casefold().encode()) if prompt else None,
                        "generator": "camera_publisher_label" if label == "genuine" else model_name,
                        "sourceDataset": source_dataset,
                        "source": f"https://huggingface.co/datasets/{DATASET}/tree/{REVISION}",
                        "publisherImageName": image_name,
                        "shard": "data/CompEval-00001-of-00413.parquet",
                        "index": index,
                        "license": LICENSE,
                        "geometry": {"format": "PNG", "width": 64, "height": 64,
                                     "orientedSize": [64, 64], "mode": "RGB"},
                    })
                    index += 1
        self.inventory = {
            "dataset": DATASET,
            "revision": REVISION,
            "planSha256": digest(b"authored test plan"),
            "license": LICENSE,
            "rows": inventory_rows,
        }
        self.expected_inventory_sha256 = canonical_inventory_sha256(self.inventory)
        self.manifest = {
            "dataset": DATASET,
            "revision": REVISION,
            "license": LICENSE,
            "protocolSha256": digest(evaluation.PROTOCOL.read_bytes()),
            "inventorySha256": self.expected_inventory_sha256,
            "exclusions": {"duplicate": 0},
            "rows": rows,
            "scope": "Authored structural test data; no model labels or authenticity claims.",
        }

    def test_admits_complete_pinned_manifest_and_images(self):
        evaluation.validate(self.manifest, self.root, self.inventory, self.expected_inventory_sha256)

    def test_rejects_bad_provenance_duplicate_and_cross_split_group(self):
        manifest = json.loads(json.dumps(self.manifest))
        manifest["license"] = "unknown"
        with self.assertRaisesRegex(ValueError, "DATASET_PROVENANCE"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

        manifest = json.loads(json.dumps(self.manifest))
        held_out = next(row for row in manifest["rows"] if row["role"] == "held_out")
        held_out["group"] = manifest["rows"][0]["group"]
        with self.assertRaisesRegex(ValueError, "ROW_INVENTORY_MISMATCH"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

        manifest = json.loads(json.dumps(self.manifest))
        genuine = next(row for row in manifest["rows"] if row["label"] == "genuine")
        genuine["generator"] = "synthetic-generator"
        with self.assertRaisesRegex(ValueError, "LABEL_PROVENANCE"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

        manifest = json.loads(json.dumps(self.manifest))
        manifest["revision"] = "0" * 40
        with self.assertRaisesRegex(ValueError, "DATASET_PROVENANCE"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

        manifest = json.loads(json.dumps(self.manifest));manifest.pop("scope")
        with self.assertRaisesRegex(ValueError, "MANIFEST_SCHEMA"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

        manifest = json.loads(json.dumps(self.manifest));manifest["rows"][0].pop("generator")
        with self.assertRaisesRegex(ValueError, "ROW_SCHEMA"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

        inventory = json.loads(json.dumps(self.inventory))
        manifest = json.loads(json.dumps(self.manifest))
        synthetic_sources = [row for row in inventory["rows"] if row["label"] == 1]
        synthetic_sources[1]["prompt"] = synthetic_sources[0]["prompt"]
        for changed_source in synthetic_sources[:2]:
            target = next(row for row in manifest["rows"]
                          if row["shard"] == changed_source["shard"] and row["index"] == changed_source["index"])
            prompt = " ".join(changed_source["prompt"].split()).casefold()
            target["promptGroup"] = digest(prompt.encode())
        pin = canonical_inventory_sha256(inventory);manifest["inventorySha256"] = pin
        with self.assertRaisesRegex(ValueError, "SOURCE_OR_CONTENT_OVERLAP"):
            evaluation.validate(manifest, self.root, inventory, pin)

        manifest = json.loads(json.dumps(self.manifest))
        manifest["rows"][1]["sha256"] = manifest["rows"][0]["sha256"]
        with self.assertRaisesRegex(ValueError, "ROW_INVENTORY_MISMATCH"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

    def test_rejects_path_escape_missing_image_pixel_limit_and_quota(self):
        manifest = json.loads(json.dumps(self.manifest))
        manifest["rows"][0]["path"] = "../outside.png"
        with self.assertRaisesRegex(ValueError, "ROW_IDENTITY"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

        manifest = json.loads(json.dumps(self.manifest))
        missing_path = self.root / manifest["rows"][0]["path"]
        missing_path.unlink()
        with self.assertRaisesRegex(ValueError, "INPUT_PATH_OR_LIMIT"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

        manifest = json.loads(json.dumps(self.manifest))
        manifest["rows"][0]["geometry"]["width"] = 24_000_001
        with self.assertRaisesRegex(ValueError, "SOURCE_GEOMETRY"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

        manifest = json.loads(json.dumps(self.manifest));manifest["rows"].pop()
        with self.assertRaisesRegex(ValueError, "FROZEN_COUNT"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

    def test_rejects_missing_or_mismatched_independent_inventory_pin(self):
        with self.assertRaisesRegex(ValueError,"DATASET_ROOT_REQUIRED"):
            evaluation.validate(self.manifest,None,self.inventory,self.expected_inventory_sha256)
        with self.assertRaisesRegex(ValueError, "TRUSTED_INVENTORY_PIN_REQUIRED"):
            evaluation.validate(self.manifest, self.root, self.inventory, None)
        with self.assertRaisesRegex(ValueError, "TRUSTED_INVENTORY_PIN_REQUIRED"):
            evaluation.validate(self.manifest, self.root, self.inventory, "bad")
        with self.assertRaisesRegex(ValueError, "INVENTORY_PIN_MISMATCH"):
            evaluation.validate(self.manifest, self.root, self.inventory, "0" * 64)
        manifest = json.loads(json.dumps(self.manifest))
        manifest["inventorySha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "MANIFEST_INVENTORY_MISMATCH"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

    def test_pinned_inventory_authenticates_image_content_against_manifest_rehash(self):
        manifest = json.loads(json.dumps(self.manifest))
        row = manifest["rows"][0]
        replacement = Image.new("RGB", (64, 64), (241, 17, 93))
        image_path = self.root / row["path"]
        replacement.save(image_path, format="PNG")
        raw = image_path.read_bytes()
        row["sha256"] = digest(raw)
        row["decodedSha256"] = digest(replacement.tobytes())
        with self.assertRaisesRegex(ValueError, "ROW_INVENTORY_MISMATCH"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

    def test_inventory_image_evidence_is_required_and_pinned(self):
        inventory = json.loads(json.dumps(self.inventory))
        inventory["rows"][0]["imageSha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "INVENTORY_PIN_MISMATCH"):
            evaluation.validate(self.manifest, self.root, inventory, self.expected_inventory_sha256)

        inventory = json.loads(json.dumps(self.inventory))
        inventory["rows"][0].pop("decodedSha256")
        pin = canonical_inventory_sha256(inventory)
        manifest = json.loads(json.dumps(self.manifest));manifest["inventorySha256"] = pin
        with self.assertRaisesRegex(ValueError, "INVENTORY_IMAGE_EVIDENCE"):
            evaluation.validate(manifest, self.root, inventory, pin)

        inventory = json.loads(json.dumps(self.inventory))
        inventory["rows"][0]["imagePath"] = "../outside.png"
        pin = canonical_inventory_sha256(inventory)
        manifest = json.loads(json.dumps(self.manifest));manifest["inventorySha256"] = pin
        with self.assertRaisesRegex(ValueError, "INVENTORY_IMAGE_EVIDENCE"):
            evaluation.validate(manifest, self.root, inventory, pin)

        inventory = json.loads(json.dumps(self.inventory))
        inventory["rows"][1]["imagePath"] = inventory["rows"][0]["imagePath"]
        pin = canonical_inventory_sha256(inventory)
        manifest = json.loads(json.dumps(self.manifest));manifest["inventorySha256"] = pin
        with self.assertRaisesRegex(ValueError, "INVENTORY_IMAGE_EVIDENCE"):
            evaluation.validate(manifest, self.root, inventory, pin)

    def test_canonical_inventory_digest_ignores_json_formatting_only(self):
        reordered = dict(reversed(list(self.inventory.items())))
        self.assertEqual(canonical_inventory_sha256(self.inventory), canonical_inventory_sha256(reordered))
        self.assertEqual(self.manifest["inventorySha256"], self.expected_inventory_sha256)
        inventory_path=self.root/"inventory.json"
        inventory_path.write_text(json.dumps(self.inventory,indent=4,ensure_ascii=False),encoding="utf-8")
        self.assertEqual(inventory_sha256_file(inventory_path),self.expected_inventory_sha256)
        with self.assertRaisesRegex(ValueError,"DUPLICATE_JSON_KEY"):
            strict_json_loads('{"dataset":"first","dataset":"second"}')
        with self.assertRaisesRegex(ValueError,"NONFINITE_JSON_NUMBER"):
            strict_json_loads('{"rows":[NaN]}')

    def test_inventory_image_evidence_matches_raw_and_oriented_pixels(self):
        row=self.manifest["rows"][0]
        source=next(item for item in self.inventory["rows"] if item["shard"]==row["shard"] and item["index"]==row["index"])
        raw=(self.root/row["path"]).read_bytes()
        evidence=_image_evidence(raw,source["imagePath"])
        self.assertEqual(evidence["imageSha256"],source["imageSha256"])
        self.assertEqual(evidence["decodedSha256"],source["decodedSha256"])
        self.assertEqual(evidence["imageGeometry"],source["imageGeometry"])

    def test_rejects_malformed_or_ambiguous_inventory(self):
        inventory = json.loads(json.dumps(self.inventory))
        inventory.pop("planSha256")
        inventory_digest = canonical_inventory_sha256(inventory)
        manifest = json.loads(json.dumps(self.manifest));manifest["inventorySha256"] = inventory_digest
        with self.assertRaisesRegex(ValueError,"INVENTORY_SCHEMA"):
            evaluation.validate(manifest,self.root,inventory,inventory_digest)
        inventory = json.loads(json.dumps(self.inventory))
        inventory["rows"].append(dict(inventory["rows"][0]))
        pin = canonical_inventory_sha256(inventory)
        manifest = json.loads(json.dumps(self.manifest));manifest["inventorySha256"] = pin
        with self.assertRaisesRegex(ValueError,"DUPLICATE_INVENTORY_ROW"):
            evaluation.validate(manifest,self.root,inventory,pin)

    def test_rejects_invented_source_identity_and_quota_preserving_label_swap(self):
        manifest = json.loads(json.dumps(self.manifest))
        genuine = next(row for row in manifest["rows"] if row["label"] == "genuine")
        genuine["sourceDataset"] = "invented-source-dataset"
        with self.assertRaisesRegex(ValueError, "ROW_INVENTORY_MISMATCH"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

        manifest = json.loads(json.dumps(self.manifest))
        genuine = next(row for row in manifest["rows"] if row["role"] == "development" and row["label"] == "genuine")
        synthetic = next(row for row in manifest["rows"] if row["role"] == "development" and row["label"] == "synthetic")
        genuine["label"], genuine["generator"] = "synthetic", "forged-generator"
        synthetic["label"], synthetic["generator"] = "genuine", "camera_publisher_label"
        with self.assertRaisesRegex(ValueError, "ROW_INVENTORY_MISMATCH"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

    def test_rejects_reused_publisher_source_identity_with_forged_group(self):
        manifest = json.loads(json.dumps(self.manifest))
        first, second = manifest["rows"][:2]
        second["sourceDataset"] = first["sourceDataset"]
        second["publisherImageName"] = first["publisherImageName"]
        second["group"] = digest(b"forged second group")
        with self.assertRaisesRegex(ValueError, "ROW_INVENTORY_MISMATCH"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

    def test_rejects_duplicate_identity_inside_pinned_inventory(self):
        inventory = json.loads(json.dumps(self.inventory))
        manifest = json.loads(json.dumps(self.manifest))
        first_source, second_source = inventory["rows"][:2]
        second_source["real_source"] = first_source["real_source"]
        second_source["image_name"] = first_source["image_name"]
        second_source["model_name"] = "distinct-model-same-publisher-image"
        first_row, second_row = manifest["rows"][:2]
        second_row["sourceDataset"] = first_source["real_source"]
        second_row["publisherImageName"] = first_source["image_name"]
        second_row["group"] = digest(f"{first_source['real_source']}:{first_source['image_name']}".encode())
        second_row["id"] = digest(f"{second_source['real_source']}:{second_source['model_name']}:{second_source['image_name']}".encode())[:24]
        old_path = self.root / second_row["path"]
        second_row["path"] = f"images/{second_row['id']}.png"
        old_path.rename(self.root / second_row["path"])
        pin = canonical_inventory_sha256(inventory)
        manifest["inventorySha256"] = pin
        with self.assertRaisesRegex(ValueError,"DUPLICATE_SOURCE_IDENTITY"):
            evaluation.validate(manifest,self.root,inventory,pin)

    def test_rejects_changed_source_hash_and_geometry(self):
        manifest_path = self.root / self.manifest["rows"][0]["path"]
        original = manifest_path.read_bytes()
        manifest_path.write_bytes(original + b"tampered")
        with self.assertRaisesRegex(ValueError, "SOURCE_HASH_MISMATCH"):
            evaluation.validate(self.manifest, self.root, self.inventory, self.expected_inventory_sha256)

        manifest_path.write_bytes(original)
        manifest = json.loads(json.dumps(self.manifest))
        manifest["rows"][0]["geometry"]["width"] = 65
        with self.assertRaisesRegex(ValueError, "ROW_INVENTORY_MISMATCH"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

        manifest["rows"][0]["geometry"] = []
        with self.assertRaisesRegex(ValueError, "SOURCE_GEOMETRY"):
            evaluation.validate(manifest, self.root, self.inventory, self.expected_inventory_sha256)

    def test_rejects_symlink_escape_when_platform_allows_symlinks(self):
        import tempfile
        row = self.manifest["rows"][0]
        link = self.root / row["path"]
        link.unlink()
        external_dir = tempfile.TemporaryDirectory()
        self.addCleanup(external_dir.cleanup)
        outside = Path(external_dir.name) / "outside.png"
        outside.write_bytes(b"authored external fixture")
        try:
            link.symlink_to(outside)
        except OSError as error:
            if os.name == "nt" and getattr(error, "winerror", None) == 1314:
                self.skipTest("Windows symlink creation requires a privilege not available in this environment")
            raise
        with self.assertRaisesRegex(ValueError, "INPUT_PATH_OR_LIMIT"):
            evaluation.validate(self.manifest, self.root, self.inventory, self.expected_inventory_sha256)

    def test_rejects_invalid_manifest_before_checkpoint_loading(self):
        manifest = json.loads(json.dumps(self.manifest))
        source = self.root / manifest["rows"][0]["path"]
        source.write_bytes(source.read_bytes() + b"tampered")
        path = self.root / "manifest.json"
        inventory_path = self.root / "inventory.json"
        path.write_text(json.dumps(manifest), encoding="utf-8")
        inventory_path.write_text(json.dumps(self.inventory), encoding="utf-8")
        with patch.object(evaluation, "cached_snapshot") as load_checkpoint:
            with self.assertRaisesRegex(ValueError, "SOURCE_HASH_MISMATCH"):
                evaluation.evaluate("community", path, self.root / "out.json", inventory_path, self.expected_inventory_sha256)
        load_checkpoint.assert_not_called()

    def test_report_records_checkpoint_and_preprocessing_for_each_sample(self):
        class Tensor:
            def unsqueeze(self, _dimension):
                return self

        class Score:
            def item(self):
                return 0.75

        fake_torch = SimpleNamespace(
            set_num_threads=lambda _count: None,
            inference_mode=nullcontext,
            sigmoid=lambda _output: Score(),
        )
        manifest_path = self.root / "manifest.json"
        inventory_path = self.root / "inventory.json"
        manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        inventory_path.write_text(json.dumps(self.inventory), encoding="utf-8")
        output = self.root / "report.json"
        fake_memory = SimpleNamespace(rss=1, peak_wset=2)
        with patch.dict(sys.modules, {"torch": fake_torch}), \
             patch.object(evaluation, "cached_snapshot"), \
             patch("ai_service.community_model.load", return_value=(lambda _input: object(), lambda _image: Tensor())), \
             patch.object(evaluation, "tensor_fingerprint", return_value={"sha256": "a" * 64, "shape": [1, 3, 384, 384], "dtype": "torch.float32"}), \
             patch("psutil.virtual_memory", return_value=SimpleNamespace(available=8 * 2**30)), \
             patch("psutil.Process", return_value=SimpleNamespace(memory_info=lambda: fake_memory)):
            evaluation.evaluate("community", manifest_path, output, inventory_path, self.expected_inventory_sha256)
        report = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(report["checkpoint"]["sha256"], evaluation.MODELS["community"]["files"]["model.safetensors"][2])
        self.assertTrue(report["rows"])
        self.assertEqual(report["rows"][0]["checkpointSha256"], report["checkpoint"]["sha256"])
        self.assertIn("preprocessing", report["rows"][0])
        self.assertEqual(report["rows"][0]["modelInput"]["sha256"], "a" * 64)
        self.assertTrue(report["authoritativePromotion"] is False)


if __name__ == "__main__":
    unittest.main()
