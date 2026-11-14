"""Video transport and decoder tests; test pattern has no authenticity label."""
import base64
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np
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
        self.assertTrue(all(0 <= frame["quality"]["meanLuma"] <= 255 and
                            frame["quality"]["laplacianVariance"] >= 0 and
                            0 <= frame["quality"]["clippedFraction"] <= 1 and
                            frame["quality"]["selectionScore"] >= 0 for frame in result["frames"]))
        self.assertTrue(all(frame["image"]["classification"] == "INCONCLUSIVE" and
                            frame["image"]["fake_probability"] is None for frame in result["frames"]))

    def test_quality_prefers_detail_over_flat_frame(self):
        flat = np.full((180, 320, 3), 128, dtype=np.uint8)
        checker = np.indices((180, 320)).sum(axis=0) % 2
        detailed = np.repeat((checker * 128 + 64).astype(np.uint8)[:, :, None], 3, axis=2)
        self.assertGreater(video_service.frame_quality(detailed)["selectionScore"],
                           video_service.frame_quality(flat)["selectionScore"])
        self.assertEqual(video_service.frame_quality(flat)["laplacianVariance"], 0)

    def test_selector_chooses_clear_neighbor_within_each_time_window(self):
        flat = np.full((180, 320, 3), 128, dtype=np.uint8)
        checker = np.indices((180, 320)).sum(axis=0) % 2
        detailed = np.repeat((checker * 128 + 64).astype(np.uint8)[:, :, None], 3, axis=2)
        clear_indices = {0, 4, 9, 13, 18, 22}

        class FakeCapture:
            index = 0

            def isOpened(self):
                return True

            def get(self, property_id):
                return {cv2.CAP_PROP_FPS: 24, cv2.CAP_PROP_FRAME_COUNT: 24,
                        cv2.CAP_PROP_FRAME_WIDTH: 320, cv2.CAP_PROP_FRAME_HEIGHT: 180}[property_id]

            def set(self, _property_id, value):
                self.index = value
                return True

            def read(self):
                return True, detailed if self.index in clear_indices else flat

            def release(self):
                pass

        with patch("cv2.VideoCapture", return_value=FakeCapture()):
            _, _, _, samples = video_service.decode_sampled_frames(b"xxxxftypfake")
        self.assertEqual([round(timestamp * 24) for timestamp, _, _ in samples], sorted(clear_indices))

    def test_rejects_invalid_and_oversized_inputs_before_decode(self):
        for data, expected in (("not-base64", 400), (base64.b64encode(b"hello").decode(), 415),
                               ("A" * (4 * (video_service.MAX_VIDEO_BYTES // 3 + 2)), 413)):
            with self.subTest(expected=expected), self.assertRaises(HTTPException) as caught:
                video_service.analyze_video(video_service.VideoRequest(video_base64=data))
            self.assertEqual(caught.exception.status_code, expected)


if __name__ == "__main__":
    unittest.main()
