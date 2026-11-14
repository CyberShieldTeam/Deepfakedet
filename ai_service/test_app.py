"""Software-contract tests; these do not evaluate model accuracy or load weights."""
import base64
import io
import unittest
from unittest.mock import patch
from pathlib import Path

from fastapi import HTTPException
from PIL import Image

from ai_service import app as image_app


class ImageServiceTests(unittest.TestCase):
    def test_unavailable_service_is_explicit(self):
        with patch.object(image_app, "model", None), patch.object(image_app, "face_detector", None):
            self.assertEqual(image_app.health()["status"], "unavailable")
            with self.assertRaises(HTTPException) as caught:
                image_app.analyze_image(image_app.ImageRequest(image_base64="aGVsbG8="))
            self.assertEqual(caught.exception.status_code, 503)

    def test_face_candidates_survive_unavailable_classifier(self):
        output = io.BytesIO()
        Image.new("RGB", (128, 128), "white").save(output, format="PNG")
        data = base64.b64encode(output.getvalue()).decode("ascii")
        with patch.object(image_app, "model", None), \
             patch.object(image_app, "processor", None), \
             patch.object(image_app, "torch_module", None), \
             patch.object(image_app, "face_detector", object()), \
             patch.object(image_app, "detect_faces", return_value=("candidate_regions", [{"x": 1, "y": 2, "width": 3, "height": 4, "confidence": 0.95}])):
            response = image_app.analyze_image(image_app.ImageRequest(image_base64=data))
        self.assertEqual(response["model_status"], "unavailable")
        self.assertEqual(response["classification"], "INCONCLUSIVE")
        self.assertIsNone(response["fake_probability"])
        self.assertEqual(response["face_analysis"], "candidate_regions")
        self.assertEqual(len(response["face_boxes"]), 1)

    def test_small_image_is_inconclusive_with_mocked_model(self):
        output = io.BytesIO()
        Image.new("RGB", (32, 32), "white").save(output, format="PNG")
        data = base64.b64encode(output.getvalue()).decode("ascii")
        with patch.object(image_app, "model", object()), \
             patch.object(image_app, "processor", object()), \
             patch.object(image_app, "torch_module", object()):
            response = image_app.analyze_image(image_app.ImageRequest(image_base64=data))
        self.assertEqual(response["classification"], "INCONCLUSIVE")
        self.assertIsNone(response["fake_probability"])
        self.assertEqual(response["model_status"], "skipped")

    def test_face_boxes_are_reported_separately(self):
        class Detector:
            def setInputSize(self, *_args):
                pass

            def detect(self, *_args):
                return 1, [[5, 6, 40, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.97]]

        with patch.object(image_app, "face_detector", Detector()):
            status, boxes = image_app.detect_faces(Image.new("RGB", (100, 100), "white"))
        self.assertEqual(status, "candidate_regions")
        self.assertEqual(boxes, [{"x": 5, "y": 6, "width": 40, "height": 50, "confidence": 0.97}])

    def test_exif_orientation_applied_before_face_detection(self):
        output = io.BytesIO()
        exif = Image.Exif()
        exif[274] = 6  # Rotate 90 degrees clockwise for display.
        Image.new("RGB", (80, 120), "white").save(output, format="JPEG", exif=exif)
        data = base64.b64encode(output.getvalue()).decode("ascii")
        seen = []

        def capture_faces(image):
            seen.append(image.size)
            return "none_found", []

        with patch.object(image_app, "model", object()), \
             patch.object(image_app, "processor", object()), \
             patch.object(image_app, "torch_module", object()), \
             patch.object(image_app, "MODEL_KIND", "smaug"), \
             patch.object(image_app, "detect_faces", side_effect=capture_faces), \
             patch.object(image_app, "smaug_probability", return_value=0.42):
            response = image_app.analyze_image(image_app.ImageRequest(image_base64=data))
        self.assertEqual(seen, [(120, 80)])
        self.assertEqual(response["classification"], "INCONCLUSIVE")
        self.assertEqual(response["model_status"], "ready")

    def test_smaug_views_follow_published_geometry(self):
        views = image_app.smaug_views(Image.new("RGB", (1000, 600), "white"))
        self.assertEqual(len(views), 3)
        self.assertTrue(all(view.size == (528, 528) for view in views))

    def test_pinned_yunet_smoke_if_weights_installed(self):
        if not image_app.FACE_MODEL.is_file():
            self.skipTest("YuNet weights not installed; run python -m ai_service.download_yunet")
        image_app.load_face_detector()
        self.assertIsNotNone(image_app.face_detector)
        root = Path(__file__).resolve().parents[1] / "test" / "fixtures"
        with Image.open(root / "face" / "headshot_cc0.jpg") as source:
            status, boxes = image_app.detect_faces(source.convert("RGB"))
        self.assertEqual(status, "candidate_regions")
        self.assertGreaterEqual(len(boxes), 1)
        for name in ("charminar_nikon_d60_2013.jpg", "charminar_oneplus_phone_2017.jpg"):
            with Image.open(root / "eval" / "genuine" / name) as source:
                status, boxes = image_app.detect_faces(source.convert("RGB"))
            self.assertEqual(status, "none_found")
            self.assertEqual(boxes, [])


if __name__ == "__main__":
    unittest.main()
