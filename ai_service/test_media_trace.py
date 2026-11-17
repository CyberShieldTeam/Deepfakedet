"""Identity and failure contracts only; authored inputs carry no authenticity labels."""
import base64
import hashlib
import io
import unittest
from unittest.mock import patch
import numpy as np
from PIL import Image
from fastapi import HTTPException
from ai_service import app,audio_service

class MediaTraceTests(unittest.TestCase):
    def test_image_identity_survives_forward_failure(self):
        output=io.BytesIO();Image.new('RGB',(80,100),'white').save(output,format='PNG');raw=output.getvalue()
        with patch.object(app,'model',object()),patch.object(app,'processor',side_effect=RuntimeError('forward failed')),patch.object(app,'torch_module',object()),patch.object(app,'MODEL_KIND','community'),patch.object(app,'detect_faces',return_value=('none_found',[])):
            result=app.analyze_image(app.ImageRequest(image_base64=base64.b64encode(raw).decode()))
        self.assertEqual(result['inputTrace']['sourceSha256'],hashlib.sha256(raw).hexdigest())
        self.assertEqual(result['inputTrace']['sourceBytes'],len(raw))
        self.assertEqual(result['model_status'],'unavailable');self.assertIsNone(result['fake_probability'])
        self.assertIn('face_manipulation',result);self.assertEqual(result['classification'],'INCONCLUSIVE')

    def test_window_skip_reasons_and_padding_preserve_policy(self):
        windows,skipped=audio_service.window_plan(np.zeros(64600,dtype='float32'))
        self.assertEqual(windows,[]);self.assertEqual(skipped[0]['reason'],'below_rms_silence_gate')
        windows,skipped=audio_service.window_plan(np.ones(8000,dtype='float32')*.1)
        self.assertEqual(windows,[]);self.assertEqual(skipped[0]['reason'],'short_tail')
        windows,skipped=audio_service.window_plan(np.ones(16000,dtype='float32')*.1)
        self.assertEqual(len(windows[0][2]),64600);self.assertEqual(windows[0][1],1);self.assertEqual(skipped,[])

    def test_audio_busy_is_explicit_and_lock_recovers_after_failure(self):
        request=audio_service.AudioRequest(audio_base64='aGVsbG8=')
        with patch.object(audio_service,'model',object()),patch.object(audio_service,'torch_module',object()):
            audio_service.inference_lock.acquire()
            try:
                with self.assertRaises(HTTPException) as caught:audio_service.analyze_audio(request)
                self.assertEqual(caught.exception.status_code,429)
            finally:audio_service.inference_lock.release()
            with patch.object(audio_service,'_analyze_audio',side_effect=RuntimeError('failure')):
                with self.assertRaises(RuntimeError):audio_service.analyze_audio(request)
            self.assertTrue(audio_service.inference_lock.acquire(blocking=False));audio_service.inference_lock.release()

    def test_headroom_denies_model_load(self):
        from ai_service.media_input_trace import require_headroom
        with patch('psutil.virtual_memory') as memory:
            memory.return_value.available=1024
            with self.assertRaises(RuntimeError):require_headroom(2)

    def test_image_busy_recovers(self):
        request=app.ImageRequest(image_base64='aGVsbG8=')
        app.image_lock.acquire()
        try:
            with self.assertRaises(HTTPException) as caught:app.analyze_image(request)
            self.assertEqual(caught.exception.status_code,429)
        finally:app.image_lock.release()
        with patch.object(app,'_analyze_image',side_effect=RuntimeError('failure')):
            with self.assertRaises(RuntimeError):app.analyze_image(request)
        self.assertTrue(app.image_lock.acquire(blocking=False));app.image_lock.release()

if __name__=='__main__':unittest.main()
