import hashlib
import tempfile
import unittest
from pathlib import Path

from ai_service.media_model_registry import MODELS,cached_snapshot,verify_file


class MediaModelRegistryTests(unittest.TestCase):
    def test_checkpoint_pin_accepts_only_matching_size_and_digest(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'model.safetensors';raw=b'authored checkpoint control';path.write_bytes(raw)
            valid=(len(raw),'sha256',hashlib.sha256(raw).hexdigest())
            verify_file(path,valid)
            with self.assertRaisesRegex(ValueError,'PINNED_SIZE_MISMATCH'):
                verify_file(path,(len(raw)+1,'sha256',valid[2]))
            with self.assertRaisesRegex(ValueError,'PINNED_HASH_MISMATCH'):
                verify_file(path,(len(raw),'sha256','0'*64))

    def test_empty_local_cache_fails_closed_without_loading_or_downloading(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(FileNotFoundError):cached_snapshot('community',directory)
            self.assertEqual(MODELS['community']['revision'],'6076002bf0d9dd37537f965ee2f06f826c333b61')


if __name__=='__main__':unittest.main()
