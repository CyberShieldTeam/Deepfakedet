"""Video transport and decoder tests; test pattern has no authenticity label."""
import base64
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np
from fastapi import HTTPException

from ai_service import app as image_app, audio_service, video_service

CLIP = Path(__file__).resolve().parents[1] / "test" / "fixtures" / "video" / "test_pattern_3s.mp4"
CLIP_WITH_TONE = CLIP.with_name("test_pattern_with_tone_3s.mp4")


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
        self.assertEqual(result["audioTrack"]["status"], "no_audio")
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

    def test_extracts_track_and_reports_unavailable_model_separately(self):
        raw = CLIP_WITH_TONE.read_bytes()
        wav, status, _ = video_service.extract_audio_track(raw, 3)
        self.assertEqual(status, "decoded")
        samples, rate, duration = audio_service.prepare_audio(wav)
        self.assertEqual(rate, 16000)
        self.assertAlmostEqual(duration, 3, places=1)
        self.assertGreater(len(samples), 0)
        with patch.object(audio_service, "model", None):
            result = video_service.screen_video_audio(raw, 3)
        self.assertEqual(result["status"], "model_unavailable")
        self.assertNotIn("evidence", result)

    def test_audio_evidence_is_attached_without_a_video_verdict(self):
        mocked = {"classification": "INCONCLUSIVE", "scope": "speech_anti_spoofing",
                  "segments": [{"start_seconds": 0, "end_seconds": 3, "raw_spoof_softmax": 0.8}]}
        with patch.object(audio_service, "model", object()), patch.object(audio_service, "torch_module", object()), \
             patch.object(audio_service, "analyze_audio", return_value=mocked):
            result = video_service.screen_video_audio(CLIP_WITH_TONE.read_bytes(), 3)
        self.assertEqual(result["status"], "analyzed")
        self.assertEqual(result["evidence"], mocked)
        self.assertFalse(result["truncated"])

    def test_audio_inference_failure_keeps_frame_response(self):
        with patch.object(image_app, "model", None), patch.object(image_app, "face_detector", object()), \
             patch.object(image_app, "detect_faces", return_value=("none_found", [])), \
             patch.object(audio_service, "model", object()), patch.object(audio_service, "torch_module", object()), \
             patch.object(audio_service, "analyze_audio", side_effect=RuntimeError("test failure")):
            result = video_service.analyze_video(video_service.VideoRequest(
                video_base64=base64.b64encode(CLIP_WITH_TONE.read_bytes()).decode("ascii")))
        self.assertEqual(len(result["frames"]), 6)
        self.assertEqual(result["audioTrack"]["status"], "extraction_failed")
        self.assertNotIn("evidence", result["audioTrack"])


if __name__ == "__main__":
    unittest.main()
