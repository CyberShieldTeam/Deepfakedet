import base64
import io
import os
from pathlib import Path
import unittest
from unittest.mock import patch

from fastapi import HTTPException
import numpy as np
from PIL import Image

from ai_service.image_evidence import analyze_evidence, EvidenceRequest, c2pa_evidence, metadata, signal_measurements

FIXTURES = Path(__file__).resolve().parents[1] / '.model-cache' / 'provenance-fixtures'


def altered_signed_bytes(raw):
    # Preserve the manifest but change an image entropy byte after the last scan header.
    position = raw.rfind(b'\xff\xda') + 30
    if position < 30 or position >= len(raw) - 2:
        raise ValueError('Expected JPEG scan')
    output = bytearray(raw)
    output[position] ^= 1
    return bytes(output)


class ImageEvidenceTests(unittest.TestCase):
    def test_unsigned_image_has_no_replacement_verdict_without_models(self):
        image = io.BytesIO()
        Image.new('RGB', (64, 64), 'gray').save(image, format='PNG')
        response = analyze_evidence(EvidenceRequest(image_base64=base64.b64encode(image.getvalue()).decode()))
        self.assertEqual(response['classification'], 'INCONCLUSIVE')
        self.assertIsNone(response['decision_probability'])
        self.assertFalse(response['metadata']['exif_present'])
        self.assertEqual(response['signals']['status'], 'measured')
        self.assertIn(response['c2pa']['status'], ('absent', 'unavailable'))

    def test_missing_sdk_is_unavailable_not_absent_or_valid(self):
        with patch.dict('sys.modules', {'c2pa': None}):
            self.assertEqual(c2pa_evidence(b'bytes', 'image/jpeg')['status'], 'unavailable')

    def test_invalid_requests_and_pixel_budget_reject_before_c2pa(self):
        for payload, expected in [('not base64!',400), ('',413), (base64.b64encode(b'not an image').decode(),400)]:
            with self.assertRaises(HTTPException) as caught:
                analyze_evidence(EvidenceRequest(image_base64=payload))
            self.assertEqual(caught.exception.status_code, expected)
        with patch('ai_service.image_evidence.c2pa_evidence') as verify, \
             patch('ai_service.image_evidence.Image.open') as open_image:
            source = open_image.return_value.__enter__.return_value
            source.format, source.width, source.height = 'PNG', 10000, 10000
            with self.assertRaises(HTTPException) as caught:
                analyze_evidence(EvidenceRequest(image_base64='aGVsbG8='))
            self.assertEqual(caught.exception.status_code, 413)
            verify.assert_not_called()

    def test_metadata_whitelist_excludes_identifiers_and_does_not_verify_software(self):
        image = Image.new('RGB', (64, 64))
        exif = image.getexif()
        exif[271], exif[305], exif[42033] = 'Example Camera', 'DALL-E', 'secret-serial'
        result = metadata(image)
        self.assertEqual(result['fields']['software'], 'DALL-E')
        self.assertNotIn('secret-serial', str(result))
        self.assertFalse(result['fields_verified'])

    def test_fft_flat_and_periodic_measurements_are_bounded_and_not_probabilities(self):
        flat = signal_measurements(Image.new('L', (1000, 1000), 128))
        checker = Image.fromarray(((np.indices((64,64)).sum(axis=0) % 2) * 255).astype('uint8'))
        periodic = signal_measurements(checker)
        self.assertEqual(flat['analysis_width'], 512)
        self.assertEqual(flat['high_frequency_energy_fraction'], 0)
        self.assertGreater(periodic['high_frequency_energy_fraction'], .9)
        self.assertNotIn('probability', periodic)
        self.assertEqual(signal_measurements(Image.new('L',(16,16)))['status'], 'skipped')

    @unittest.skipUnless((FIXTURES/'C.jpg').exists() and (FIXTURES/'test-anchors.pem').exists(), 'Optional pinned C2PA fixtures not cached')
    def test_real_sdk_signed_untrusted_trusted_and_tampered(self):
        try:
            import c2pa  # noqa: F401
        except ImportError:
            self.skipTest('Optional c2pa-python SDK not installed')
        raw = (FIXTURES/'C.jpg').read_bytes()
        with patch.dict(os.environ, {'VERITAS_C2PA_TRUST_ANCHORS': ''}):
            result = c2pa_evidence(raw, 'image/jpeg')
            self.assertEqual(result['status'], 'valid_untrusted')
            # algorithmicMedia does not specifically disclose generative AI.
            self.assertEqual(result['ai_disclosure'], 'not_declared')
            altered = c2pa_evidence(altered_signed_bytes(raw), 'image/jpeg')
            self.assertEqual(altered['status'], 'invalid')
            self.assertEqual(altered['ai_disclosure'], 'not_assessed')
            self.assertIn('assertion.dataHash.mismatch', altered['validation_codes'])
        with patch.dict(os.environ, {'VERITAS_C2PA_TRUST_ANCHORS': str(FIXTURES/'test-anchors.pem')}):
            self.assertEqual(c2pa_evidence(raw, 'image/jpeg')['status'], 'valid_trusted')

    def test_bad_trust_configuration_fails_closed(self):
        with patch.dict(os.environ, {'VERITAS_C2PA_TRUST_ANCHORS': 'missing-trust-file.pem'}):
            result = c2pa_evidence(b'bytes', 'image/jpeg')
            self.assertIn(result['status'], ('failed','unavailable'))


if __name__ == '__main__':
    unittest.main()
