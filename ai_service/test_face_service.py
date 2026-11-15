"""Face-crop adapter software tests; model accuracy is evaluated separately."""
import unittest
from unittest.mock import patch

from PIL import Image
from ai_service import face_service


class FaceServiceTests(unittest.TestCase):
    def test_crop_is_bounded_and_requires_usable_size(self):
        image = Image.new("RGB", (100, 80), "white")
        crop = face_service.crop_face(image, {"x": 0, "y": 5, "width": 50, "height": 50})
        self.assertLessEqual(crop.width, 100)
        self.assertLessEqual(crop.height, 80)
        self.assertGreaterEqual(crop.width, 50)
        with self.assertRaises(ValueError):
            face_service.crop_face(image, {"x": 5, "y": 5, "width": 5, "height": 5})

    def test_unavailable_and_no_face_are_separate(self):
        image = Image.new("RGB", (100, 100), "white")
        with patch.object(face_service, "model", None):
            result = face_service.screen_faces(image, [{"x": 0, "y": 0, "width": 50, "height": 50}])
        self.assertEqual(result["status"], "unavailable")
        self.assertEqual(result["faces"], [])


if __name__ == "__main__":
    unittest.main()
