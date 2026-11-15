"""Original-byte provenance response tests; mocked manifests are not signed fixtures."""
import base64
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from ai_service import provenance_service

IMAGE = (Path(__file__).resolve().parents[1] / "test/fixtures/face/headshot_cc0.jpg").read_bytes()


class ProvenanceTests(unittest.TestCase):
    def test_no_manifest_on_original(self):
        fake = dict(status="absent", note="No manifest", ai_disclosure="not_assessed")
        with patch("ai_service.image_evidence.c2pa_evidence", return_value=fake):
            result = provenance_service.inspect_original(IMAGE)
        self.assertEqual(result["status"], "absent")
        self.assertFalse(result["aiDeclaration"])

    def test_structured_declaration_requires_valid_active_manifest(self):
        active = {"claim_generator": "test", "assertions": [{"label": "stds.schema-org.CreativeWork",
                  "data": {"digitalSourceType": "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"}}]}

        class FakeReader:
            def __init__(self, state):
                self.state = state

            def __enter__(self):
                return self

            def __exit__(self, *_):
                pass

            def json(self):
                return json.dumps({"validation_state": self.state, "active_manifest": "active",
                                   "manifests": {"active": active}})

        for state, expected in (("Valid", True), ("Trusted", True), ("Invalid", False)):
            evidence = dict(status={"Valid":"valid_untrusted","Trusted":"valid_trusted","Invalid":"invalid"}[state],
                            note="SDK fixture boundary", ai_disclosure="declared" if expected else "not_assessed")
            with self.subTest(state=state), patch("ai_service.image_evidence.c2pa_evidence", return_value=evidence):
                self.assertEqual(provenance_service.inspect_original(IMAGE)["aiDeclaration"], expected)
        self.assertTrue(provenance_service.declared_ai(active))
        self.assertFalse(provenance_service.declared_ai({"assertions": [{"label": "unrelated",
                         "data": {"description": "trainedAlgorithmicMedia"}}]}))

    def test_invalid_input_is_rejected(self):
        for encoded, status in (("not-base64", 400), (base64.b64encode(b"not an image").decode(), 400),
                                ("A" * (4 * (provenance_service.MAX_BYTES // 3 + 2)), 413)):
            with self.subTest(status=status), self.assertRaises(HTTPException) as caught:
                provenance_service.inspect_image(provenance_service.ProvenanceRequest(image_base64=encoded))
            self.assertEqual(caught.exception.status_code, status)
