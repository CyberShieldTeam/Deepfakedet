import base64,io,subprocess,unittest
from PIL import Image
from ai_service.extraction_prepare import prepare,PROFILES
from ai_service.ocr_geometry import compose,inverse,exif_to_display
class GeometryControls(unittest.TestCase):
    def image(self,w=90,h=50,orientation=1):
        image=Image.new('RGB',(w,h),'white');exif=Image.Exif();exif[274]=orientation;out=io.BytesIO();image.save(out,format='PNG',exif=exif);return base64.b64encode(out.getvalue()).decode()
    def test_all_exif_rotations_and_mirrors(self):
        for orientation in range(1,9):
            for profile in ['baseline','rotate90','rotate180','rotate270','upscale2']:
                v=prepare(self.image(90,50,orientation),profile);m=v['processingToSource'];w,h=v['width'],v['height']
                points=[(m[0]*x+m[1]*y+m[2],m[3]*x+m[4]*y+m[5]) for x,y in [(0,0),(w,0),(0,h),(w,h)]]
                self.assertAlmostEqual(min(p[0] for p in points),0);self.assertAlmostEqual(max(p[0] for p in points),90);self.assertAlmostEqual(min(p[1] for p in points),0);self.assertAlmostEqual(max(p[1] for p in points),50)
                # Marker coordinates independent of affine algebra: expected Pillow EXIF pixel placement.
                im=Image.new('RGB',(9,5),'black');im.putpixel((2,1),(255,0,0));exif=Image.Exif();exif[274]=orientation;out=io.BytesIO();im.save(out,format='PNG',exif=exif)
                pv=prepare(base64.b64encode(out.getvalue()).decode(),profile);bitmap=Image.open(io.BytesIO(base64.b64decode(pv['image_base64'])));f=inverse(pv['processingToSource']);px=f[0]*2.5+f[1]*1.5+f[2];py=f[3]*2.5+f[4]*1.5+f[5];color=bitmap.getpixel((int(px),int(py)));self.assertGreater(color[0],color[1]);self.assertGreater(color[0],color[2])
    def test_scale_and_profiles(self):
        for profile in PROFILES:
            v=prepare(self.image(1800,900),profile);self.assertLessEqual(max(v['width'],v['height']),1600);self.assertEqual(v['profile'],profile)
        with self.assertRaises(ValueError):prepare(self.image(),'arbitrary-filter')
        with self.assertRaises(ValueError):prepare(self.image(90,50,99))
    def test_frozen_baseline_pixel_identity(self):
        old={};exec(subprocess.check_output(['git','show','00b6d06:ai_service/extraction_prepare.py']).decode(),old)
        for orientation in range(1,9):
            encoded=self.image(1800,900,orientation);self.assertEqual(old['prepare'](encoded)['bitmapSha256'],prepare(encoded)['bitmapSha256'])
if __name__=='__main__':unittest.main()
