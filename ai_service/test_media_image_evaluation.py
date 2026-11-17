"""Strict admission controls for the frozen external image evaluation."""
import hashlib
import json
from contextlib import nullcontext
from types import SimpleNamespace
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from ai_service import evaluate_media_images as evaluation
from ai_service.prepare_media_image_evaluation import DATASET, REVISION, LICENSE


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
        index = 0
        for role, labels in protocol["roles"].items():
            for label, quota in labels.items():
                for _ in range(quota):
                    image = Image.new("RGB", (64, 64), (index, (index * 3) % 256, (index * 7) % 256))
                    path = image_dir / f"{index:024x}.png"
                    image.save(path, format="PNG")
                    raw = path.read_bytes()
                    rows.append({
                        "id": f"{index:024x}",
                        "path": f"images/{index:024x}.png",
                        "sha256": digest(raw),
                        "decodedSha256": digest(image.tobytes()),
                        "label": label,
                        "role": role,
                        "group": digest(f"source-{index}".encode()),
                        "promptGroup": digest(f"prompt-{index}".encode()) if label == "synthetic" else None,
                        "generator": "camera_publisher_label" if label == "genuine" else "generator-a",
                        "sourceDataset": "coco",
                        "source": f"https://huggingface.co/datasets/{DATASET}/tree/{REVISION}",
                        "publisherImageName": f"image-{index}",
                        "shard": "data/CompEval-00001-of-00413.parquet",
                        "index": index,
                        "license": LICENSE,
                        "geometry": {"format": "PNG", "width": 64, "height": 64,
                                     "orientedSize": [64, 64], "mode": "RGB"},
                    })
                    index += 1
        self.manifest = {
            "dataset": DATASET,
            "revision": REVISION,
            "license": LICENSE,
            "protocolSha256": digest(evaluation.PROTOCOL.read_bytes()),
            "inventorySha256": digest(b"inventory"),
            "exclusions": {"duplicate": 0},
            "rows": rows,
            "scope": "Authored structural test data; no model labels or authenticity claims.",
        }

    def test_admits_complete_pinned_manifest_and_images(self):
        evaluation.validate(self.manifest, self.root)

    def test_rejects_bad_provenance_duplicate_and_cross_split_group(self):
        manifest = json.loads(json.dumps(self.manifest))
        manifest["license"] = "unknown"
        with self.assertRaisesRegex(ValueError, "DATASET_PROVENANCE"):
            evaluation.validate(manifest, self.root)

        manifest = json.loads(json.dumps(self.manifest))
        held_out = next(row for row in manifest["rows"] if row["role"] == "held_out")
        held_out["group"] = manifest["rows"][0]["group"]
        with self.assertRaisesRegex(ValueError, "SOURCE_OR_CONTENT_OVERLAP"):
            evaluation.validate(manifest, self.root)

        manifest = json.loads(json.dumps(self.manifest))
        genuine = next(row for row in manifest["rows"] if row["label"] == "genuine")
        genuine["generator"] = "synthetic-generator"
        with self.assertRaisesRegex(ValueError, "LABEL_PROVENANCE"):
            evaluation.validate(manifest, self.root)

    def test_rejects_changed_source_hash_and_geometry(self):
        manifest_path = self.root / self.manifest["rows"][0]["path"]
        original = manifest_path.read_bytes()
        manifest_path.write_bytes(original + b"tampered")
        with self.assertRaisesRegex(ValueError, "SOURCE_HASH_MISMATCH"):
            evaluation.validate(self.manifest, self.root)

        manifest_path.write_bytes(original)
        manifest = json.loads(json.dumps(self.manifest))
        manifest["rows"][0]["geometry"]["width"] = 65
        with self.assertRaisesRegex(ValueError, "SOURCE_GEOMETRY_MISMATCH"):
            evaluation.validate(manifest, self.root)

        manifest["rows"][0]["geometry"] = []
        with self.assertRaisesRegex(ValueError, "SOURCE_GEOMETRY"):
            evaluation.validate(manifest)

    def test_rejects_invalid_manifest_before_checkpoint_loading(self):
        manifest = json.loads(json.dumps(self.manifest))
        source = self.root / manifest["rows"][0]["path"]
        source.write_bytes(source.read_bytes() + b"tampered")
        path = self.root / "manifest.json"
        path.write_text(json.dumps(manifest), encoding="utf-8")
        with patch.object(evaluation, "cached_snapshot") as load_checkpoint:
            with self.assertRaisesRegex(ValueError, "SOURCE_HASH_MISMATCH"):
                evaluation.evaluate("community", path, self.root / "out.json")
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
        manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        output = self.root / "report.json"
        fake_memory = SimpleNamespace(rss=1, peak_wset=2)
        with patch.dict(sys.modules, {"torch": fake_torch}), \
             patch.object(evaluation, "cached_snapshot"), \
             patch("ai_service.community_model.load", return_value=(lambda _input: object(), lambda _image: Tensor())), \
             patch.object(evaluation, "tensor_fingerprint", return_value={"sha256": "a" * 64, "shape": [1, 3, 384, 384], "dtype": "torch.float32"}), \
             patch("psutil.virtual_memory", return_value=SimpleNamespace(available=8 * 2**30)), \
             patch("psutil.Process", return_value=SimpleNamespace(memory_info=lambda: fake_memory)):
            evaluation.evaluate("community", manifest_path, output)
        report = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(report["checkpoint"]["sha256"], evaluation.MODELS["community"]["files"]["model.safetensors"][2])
        self.assertTrue(report["rows"])
        self.assertEqual(report["rows"][0]["checkpointSha256"], report["checkpoint"]["sha256"])
        self.assertIn("preprocessing", report["rows"][0])
        self.assertTrue(report["authoritativePromotion"] is False)


if __name__ == "__main__":
    unittest.main()
