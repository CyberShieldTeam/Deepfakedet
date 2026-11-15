import tempfile
import unittest
import threading
from pathlib import Path
from unittest.mock import patch
from fastapi import HTTPException
from pydantic import ValidationError
from ai_service import claim_embedding as service

class ClaimEmbeddingTests(unittest.TestCase):
    def test_busy_encoder_rejects_without_inference(self):
        encoder=object.__new__(service.Encoder)
        encoder.lock=threading.Lock();encoder.lock.acquire()
        with self.assertRaisesRegex(RuntimeError,'busy'):encoder.encode(['query: software control'])
        encoder.lock.release()

    def test_low_memory_rejects_before_snapshot_or_torch_import(self):
        from types import SimpleNamespace
        with patch('psutil.virtual_memory',return_value=SimpleNamespace(available=1024**3)),patch.object(service,'verify_snapshot') as verify:
            with self.assertRaisesRegex(RuntimeError,'2 GiB'):service.Encoder('unused')
            verify.assert_not_called()
    def test_snapshot_mismatch_refused_before_model_load(self):
        with tempfile.TemporaryDirectory() as temp:
            (Path(temp)/'model.safetensors').write_bytes(b'not a checkpoint')
            with self.assertRaisesRegex(ValueError,'mismatch'):service.verify_snapshot(temp)

    def test_unavailable_identity_and_request_bounds(self):
        with patch.object(service,'encoder',None):
            request=dict(modelId=service.MODEL_ID,version=service.REVISION,texts=['query: software test'])
            self.assertEqual(service.health()['status'],'unavailable')
            with self.assertRaises(HTTPException) as error:service.embedding(service.EmbeddingRequest(**request))
            self.assertEqual(error.exception.status_code,503)
            with self.assertRaises(HTTPException) as error:service.embedding(service.EmbeddingRequest(**{**request,'version':'wrong'}))
            self.assertEqual(error.exception.status_code,400)
            for changed in ({'texts':['x']*129},{'extra':'x'}):
                with self.assertRaises(ValidationError):service.EmbeddingRequest(**{**request,**changed})
            encoder=object.__new__(service.Encoder)
            for texts in ([],['missing required prefix'],['query: '+'x'*12000],['query: '+'x'*11000]*12):
                with self.assertRaises(ValueError):encoder.encode(texts)

if __name__=='__main__':unittest.main()
