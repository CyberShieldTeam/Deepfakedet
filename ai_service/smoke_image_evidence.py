"""Real C2PA SDK/HTTP software smoke on pinned public test assets; no accuracy claim."""
import argparse
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import platform
from unittest.mock import patch
from urllib.request import Request, urlopen

from PIL import Image
from ai_service.image_evidence import analyze_evidence, EvidenceRequest, c2pa_evidence
from ai_service.test_image_evidence import altered_signed_bytes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', help='Optional loopback Express service URL')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    fixtures = Path('.model-cache/provenance-fixtures')
    signed = (fixtures/'C.jpg').read_bytes()
    unsigned = (fixtures/'A.jpg').read_bytes()
    cases = {'unsigned': unsigned, 'signed': signed, 'altered': altered_signed_bytes(signed),
             'remote': (fixtures/'cloud.jpg').read_bytes()}
    records = {}
    with patch.dict(os.environ, {'VERITAS_C2PA_TRUST_ANCHORS': ''}):
        for name, raw in cases.items():
            response = analyze_evidence(EvidenceRequest(image_base64=base64.b64encode(raw).decode()))
            assert response['classification'] == 'INCONCLUSIVE' and response['decision_probability'] is None
            expected = {'unsigned':'absent','signed':'valid_untrusted','altered':'invalid','remote':'unavailable'}[name]
            assert response['c2pa']['status'] == expected, response
            records[name] = dict(sha256=hashlib.sha256(raw).hexdigest(), **response)
    with patch.dict(os.environ, {'VERITAS_C2PA_TRUST_ANCHORS': str(fixtures/'test-anchors.pem')}):
        trusted = c2pa_evidence(signed, 'image/jpeg')
        assert trusted['status'] == 'valid_trusted'
        records['explicit_test_trust'] = trusted
    if args.base_url:
        if not args.base_url.startswith(('http://127.0.0.1:', 'http://localhost:')):
            raise ValueError('Smoke must target a loopback development service')
        # Deliberately send a lossless resize to the classifier while preserving the
        # signed original separately. Checking the resize would report absent instead.
        with Image.open(io.BytesIO(signed)) as image:
            image.thumbnail((96,96))
            buffer = io.BytesIO()
            image.save(buffer,format='PNG')
        resize = base64.b64encode(buffer.getvalue()).decode()
        records['http'] = {}
        for name in ('unsigned','signed','altered'):
            payload = dict(modality='image',fileName=name+'.jpg',mimeType='image/jpeg',
                           measurements={'analysisInput':'lossless PNG resize to 96×96'},
                           mediaData='data:image/png;base64,'+resize,
                           originalImageData='data:image/jpeg;base64,'+base64.b64encode(cases[name]).decode())
            request = Request(args.base_url.rstrip('/')+'/api/forensics/analyze-media',
                              data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
            with urlopen(request, timeout=60) as response:
                result = json.load(response)['result']
            assert result['authenticity'] == 'inconclusive' and result['aiGeneratedProbability'] is None
            assert result['imageDiagnostics']['c2pa']['status'] == records[name]['c2pa']['status']
            records['http'][name] = result['imageDiagnostics']
    import c2pa
    output = dict(scope='software_smoke_not_accuracy',python=platform.python_version(),sdk=c2pa.__version__,
                  fixtures_revision='48d07023d4f37e978c5b30745b49b26668774b08',
                  fixtures_source='https://github.com/contentauth/c2pa-python/tree/48d07023d4f37e978c5b30745b49b26668774b08/tests/fixtures',
                  test_anchor_sha256=hashlib.sha256((fixtures/'test-anchors.pem').read_bytes()).hexdigest(),
                  note='Published test certificate trusted only within this smoke; never configure it in production. Reserved data not accessed.',
                  results=records)
    Path(args.output).write_text(json.dumps(output, indent=2),encoding='utf-8')
    print(json.dumps({name:record.get('c2pa',record).get('status','completed') for name,record in records.items()}))


if __name__ == '__main__':
    main()
