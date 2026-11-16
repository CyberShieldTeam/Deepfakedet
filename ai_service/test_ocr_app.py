import base64,io,unittest
from PIL import Image
from ai_service.ocr_app import app,health
from ai_service.extraction_prepare import PreparationInput,prepare_image
class PreparationOnlyTests(unittest.TestCase):
    def test_health_does_not_claim_a_classifier(self):
        self.assertEqual(health()['ocrPreparation'],'ready');self.assertEqual(health()['status'],'unavailable')
        self.assertNotIn('/v1/image/analyze',app.openapi()['paths'])
    def test_original_router_and_hash_contract(self):
        stream=io.BytesIO();Image.new('RGB',(90,50),'white').save(stream,format='PNG')
        result=prepare_image(PreparationInput(image_base64=base64.b64encode(stream.getvalue()).decode()))
        self.assertEqual(result['originalWidth'],90);self.assertEqual(result['profile'],'baseline')
if __name__=='__main__':unittest.main()
