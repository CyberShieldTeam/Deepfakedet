import unittest
from unittest.mock import patch
from PIL import Image
from ai_service import face_service


class FaceTests(unittest.TestCase):
    def test_crop_clamps_bounds_and_rejects_small_or_invalid_boxes(self):
        image = Image.new("RGB", (100, 100))
        crop, bounds = face_service.crop_face(image, dict(x=-5, y=0, width=60, height=60))
        self.assertEqual(bounds, [0, 0, 67, 72])
        self.assertEqual(crop.size, (67, 72))
        self.assertIsNone(face_service.crop_face(image, dict(x=0, y=0, width=10, height=20)))
        self.assertIsNone(face_service.crop_face(image, dict(x=float("nan"), y=0, width=50, height=50)))
        self.assertIsNone(face_service.crop_face(image, dict(x=200, y=0, width=50, height=50)))

    def test_unavailable_never_invents_score(self):
        with patch.object(face_service, "model", None):
            result = face_service.analyze(Image.new("RGB", (100, 100)), [])
        self.assertEqual(result["status"], "unavailable")
        self.assertEqual(result["classification"], "INCONCLUSIVE")
        self.assertEqual(result["faces"], [])

    def test_failed_inference_abstains(self):
        with patch.object(face_service, "model", object()), patch.object(face_service, "processor", None):
            result = face_service.analyze(Image.new("RGB", (100, 100)), [dict(x=0, y=0, width=50, height=50)])
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["faces"], [])


if __name__ == "__main__":
    unittest.main()
