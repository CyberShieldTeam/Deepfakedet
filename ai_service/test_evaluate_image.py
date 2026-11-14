import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from ai_service.evaluate_image import evaluate, metrics, read_manifest


class EvaluationTests(unittest.TestCase):
    def test_metrics_ties_and_failed_rows(self):
        rows = [{"label": "genuine", "score": 0.5}, {"label": "synthetic", "score": 0.5},
                {"label": "genuine", "score": None}]
        result = metrics(rows, 0.5)
        self.assertEqual(result["auroc"], 0.5)
        self.assertEqual(result["fp"], 1)
        self.assertEqual(result["failed_or_skipped"], 1)
        self.assertIsNone(metrics([], 0.5)["false_positive_rate"])

    def test_manifest_detects_leakage_and_checksum_mismatch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            raw = b"image"
            (root / "image.jpg").write_bytes(raw)
            sample = dict(id="one", path="image.jpg", sha256=hashlib.sha256(raw).hexdigest(),
                          source="fixture", license="test-only", group="identity-1", split="test",
                          label="genuine", domain="camera")
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps(dict(task="general_ai_generated_image", samples=[sample])), encoding="utf-8")
            self.assertEqual(len(read_manifest(manifest)), 1)
            other = dict(sample, id="two", sha256="other", split="calibration")
            manifest.write_text(json.dumps(dict(task="general_ai_generated_image", samples=[sample, other])), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "crosses"):
                read_manifest(manifest)
            sample["sha256"] = "wrong"
            manifest.write_text(json.dumps(dict(task="general_ai_generated_image", samples=[sample])), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "checksum"):
                read_manifest(manifest)

    def test_identity_drift_aborts_and_unavailable_is_reported(self):
        sample = dict(id="one", sha256="hash", label="genuine", split="test", group="one", domain="camera")
        report = evaluate([(sample, b"image")], "unused", 0.5, lambda *_: {})
        self.assertEqual(report["splits"]["test"]["failed_or_skipped"], 1)
        self.assertFalse(report["deployment_authorized"])
        replies = iter([dict(model="a", revision="1"), dict(model="b", revision="1")])
        with self.assertRaisesRegex(RuntimeError, "identity changed"):
            evaluate([(sample, b"a"), (sample, b"b")], "unused", 0.5, lambda *_: next(replies))


if __name__ == "__main__":
    unittest.main()
