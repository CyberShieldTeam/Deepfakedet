"""Video transport and decoder tests; test pattern has no authenticity label."""
import base64
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from ai_service import app as image_app, video_service

CLIP = Path(__file__).resolve().parents[1] / "test" / "fixtures" / "video" / "test_pattern_3s.mp4"


class VideoServiceTests(unittest.TestCase):
    def test_decodes_original_clip_and_keeps_video_inconclusive(self):
        with patch.object(image_app, "model", None), patch.object(image_app, "face_detector", object()), \
             patch.object(image_app, "detect_faces", return_value=("none_found", [])):
            result = video_service.analyze_video(video_service.VideoRequest(
                video_base64=base64.b64encode(CLIP.read_bytes()).decode("ascii")))
        self.assertEqual(result["scope"], "server_decoded_frames")
        self.assertEqual(result["videoMetadata"]["width"], 320)
        self.assertEqual(result["videoMetadata"]["height"], 180)
        self.assertEqual(len(result["frames"]), 6)
        timestamps = [frame["timestampSeconds"] for frame in result["frames"]]
        self.assertEqual(timestamps, sorted(set(timestamps)))
        self.assertTrue(all(frame["image"]["classification"] == "INCONCLUSIVE" and
                            frame["image"]["fake_probability"] is None for frame in result["frames"]))

    def test_rejects_invalid_and_oversized_inputs_before_decode(self):
        for data, expected in (("not-base64", 400), (base64.b64encode(b"hello").decode(), 415),
                               ("A" * (4 * (video_service.MAX_VIDEO_BYTES // 3 + 2)), 413)):
            with self.subTest(expected=expected), self.assertRaises(HTTPException) as caught:
                video_service.analyze_video(video_service.VideoRequest(video_base64=data))
            self.assertEqual(caught.exception.status_code, expected)


if __name__ == "__main__":
    unittest.main()
