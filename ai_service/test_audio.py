"""Audio software-contract tests; no accuracy claim is inferred from the fixture."""
import base64
import io
import os
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

import numpy as np
from fastapi import HTTPException

from ai_service import audio_service


class AudioServiceTests(unittest.TestCase):
    def test_unavailable_model_is_explicit(self):
        with patch.object(audio_service, "model", None):
            with self.assertRaises(HTTPException) as caught:
                audio_service.analyze_audio(audio_service.AudioRequest(audio_base64="aGVsbG8="))
        self.assertEqual(caught.exception.status_code, 503)

    def test_invalid_audio_rejected(self):
        with self.assertRaises(HTTPException) as caught:
            audio_service.prepare_audio(b"not audio")
        self.assertEqual(caught.exception.status_code, 415)

    def test_long_audio_rejected_before_sample_decode(self):
        output = io.BytesIO()
        with wave.open(output, "wb") as writer:
            writer.setnchannels(1)
            writer.setsampwidth(2)
            writer.setframerate(8000)
            writer.writeframes(b"\0\0" * (61 * 8000))
        with patch("soundfile.read", side_effect=AssertionError("decoded before duration check")):
            with self.assertRaises(HTTPException) as caught:
                audio_service.prepare_audio(output.getvalue())
        self.assertEqual(caught.exception.status_code, 413)

    def test_resample_and_window_timestamps(self):
        samples = (np.sin(np.arange(441000) * 2 * np.pi * 220 / 44100) * 0.1 * 32767).astype("<i2")
        output = io.BytesIO()
        with wave.open(output, "wb") as writer:
            writer.setnchannels(1)
            writer.setsampwidth(2)
            writer.setframerate(44100)
            writer.writeframes(samples.tobytes())
        decoded, source_rate, duration = audio_service.prepare_audio(output.getvalue())
        windows = audio_service.make_windows(decoded)
        self.assertEqual(source_rate, 44100)
        self.assertAlmostEqual(duration, 10.0)
        self.assertEqual(len(windows), 3)
        self.assertEqual([w[0] for w in windows], [0.0, 64600 / 16000, 129200 / 16000])
        self.assertTrue(all(len(w[2]) == 64600 for w in windows))

    def test_silent_windows_skipped(self):
        self.assertEqual(audio_service.make_windows(np.zeros(64600, dtype="float32")), [])

    def test_real_weight_inference_if_installed(self):
        if not audio_service.WEIGHTS.is_file():
            self.skipTest("AASIST weights not installed; run python -m ai_service.download_aasist")
        with patch.dict(os.environ, {"VERITAS_AUDIO_MODEL_ENABLED": "1"}):
            audio_service.load_model()
        self.assertEqual(audio_service.health()["status"], "ready")
        fixture = Path(__file__).resolve().parents[1] / "test" / "fixtures" / "sample_voice.wav"
        payload = base64.b64encode(fixture.read_bytes()).decode("ascii")
        result = audio_service.analyze_audio(audio_service.AudioRequest(audio_base64=payload))
        self.assertEqual(result["classification"], "INCONCLUSIVE")
        self.assertEqual(result["sample_rate_input"], 44100)
        self.assertGreater(len(result["segments"]), 0)
        self.assertTrue(all(0 <= s["raw_spoof_softmax"] <= 1 for s in result["segments"]))


if __name__ == "__main__":
    unittest.main()
