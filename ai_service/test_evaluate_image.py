import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from ai_service.evaluate_image import benchmark_gate, load_manifest, roc_auc


class EvaluationManifestTests(unittest.TestCase):
    def test_repository_smoke_is_not_a_benchmark(self):
        root = Path(__file__).resolve().parents[1] / "test/fixtures/eval"
        rows = load_manifest(root / "smoke_manifest.json", root)
        self.assertEqual(len(rows), 5)
        self.assertFalse(benchmark_gate(rows, "general_image")["eligible"])
        self.assertFalse(benchmark_gate(rows, "face_manipulation")["eligible"])

    def test_rejects_group_leakage_and_path_escape(self):
        cache = Path(__file__).resolve().parents[1] / ".model-cache"
        cache.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=cache) as folder:
            root = Path(folder)
            sample = root / "sample.jpg"
            sample.write_bytes(b"test")
            digest = hashlib.sha256(b"test").hexdigest()
            base = {"path": "sample.jpg", "task": "general_image", "label": "real", "group": "same-person",
                    "split": "train", "source": "test", "license": "test", "license_uri": "test://license",
                    "label_basis": "controlled test fixture", "sha256": digest}
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps([{**base, "path": "../outside.jpg"}]))
            with self.assertRaises(ValueError):
                load_manifest(manifest, root)
            other = root / "other.jpg"
            other.write_bytes(b"other")
            manifest.write_text(json.dumps([base, {**base, "path": "other.jpg", "split": "holdout",
                                                   "sha256": hashlib.sha256(b"other").hexdigest()}]))
            with self.assertRaisesRegex(ValueError, "crosses dataset splits"):
                load_manifest(manifest, root)
            manifest.write_text(json.dumps([{**base, "sha256": "0" * 64}]))
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                load_manifest(manifest, root)

    def test_auc_ranks_ties_without_a_threshold(self):
        self.assertEqual(roc_auc([0.9, 0.5], [0.2, 0.5]), 0.875)
        with self.assertRaises(ValueError):
            roc_auc([float("nan")], [0.2])


if __name__ == "__main__":
    unittest.main()
