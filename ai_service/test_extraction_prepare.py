import base64,io,unittest
from PIL import Image
from ai_service.extraction_prepare import prepare

class ExtractionPreparationTests(unittest.TestCase):
    def encoded(self,fmt='PNG',size=(1800,900),exif=None):
        output=io.BytesIO();im=Image.new('RGB',size,'white')
        im.save(output,format=fmt,**({'exif':exif} if exif else {}));return base64.b64encode(output.getvalue()).decode()
    def test_dimensions_and_hash(self):
        value=prepare(self.encoded());self.assertEqual((value['width'],value['height']),(1600,800));self.assertEqual(value['originalWidth'],1800);self.assertEqual(len(value['sourceSha256']),64)
    def test_formats(self):
        for fmt in ['PNG','JPEG','WEBP']:self.assertEqual(prepare(self.encoded(fmt,size=(40,20)))['width'],40)
    def test_orientation(self):
        exif=Image.Exif();exif[274]=6;v=prepare(self.encoded('JPEG',(40,20),exif));self.assertEqual((v['width'],v['height']),(20,40))
    def test_invalid(self):
        for value in ['abc!',base64.b64encode(b'not an image').decode(),self.encoded('GIF')]:
            with self.assertRaises((ValueError,OSError)):prepare(value)
    def test_byte_budget(self):
        with self.assertRaises(ValueError):prepare(base64.b64encode(b'x'*(10*1024*1024+1)).decode())
    def test_pixel_budget(self):
        with self.assertRaises(ValueError):prepare(self.encoded(size=(5001,5000)))
if __name__=='__main__':unittest.main()
