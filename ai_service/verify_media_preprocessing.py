"""Actual cached-model preprocessing controls, no authenticity labels or accuracy claims."""
import argparse
import asyncio
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import time
from ai_service.evaluate_nli import supervised_command


def verify(output):
    if output.exists():raise ValueError('OUTPUT_EXISTS')
    os.environ.update(VERITAS_IMAGE_MODEL_ENABLED='1',VERITAS_IMAGE_MODEL='community',VERITAS_AUDIO_MODEL_ENABLED='0',VERITAS_FACE_MODEL_ENABLED='0',HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1')
    import numpy as np,psutil
    from PIL import Image
    from fastapi import HTTPException
    from ai_service import app
    pixels=np.zeros((240,320,3),dtype='uint8');pixels[:,:,0]=np.arange(320,dtype='uint16')[None,:]%256;pixels[:,:,1]=np.arange(240,dtype='uint8')[:,None];pixels[:,:,2]=80
    image=Image.fromarray(pixels);rows=[];start=time.perf_counter()
    def encode(image,format,**kwargs):
        file=io.BytesIO();image.save(file,format=format,**kwargs);return file.getvalue()
    oriented=image.transpose(Image.Transpose.ROTATE_90);exif=Image.Exif();exif[274]=6
    rgba=image.convert('RGBA');transparent=rgba.copy();transparent.putalpha(0)
    fixtures=[('png_rgb',encode(image,'PNG')),('webp_lossless',encode(image,'WEBP',lossless=True)),('jpeg95',encode(image,'JPEG',quality=95)),('exif_png',encode(oriented,'PNG',exif=exif)),('rgba_opaque',encode(rgba,'PNG')),('rgba_transparent',encode(transparent,'PNG')),('resized',encode(image.resize((640,480)),'PNG'))]
    class ServiceClient:
        def __enter__(self):
            self.loop=asyncio.new_event_loop();self.context=app.lifespan(app.app)
            self.loop.run_until_complete(self.context.__aenter__());return self
        def __exit__(self,*args):
            self.loop.run_until_complete(self.context.__aexit__(*args));self.loop.close()
        def post(self,path,json):
            class Response:
                def raise_for_status(self):
                    if self.status_code>=400:raise RuntimeError(str(self.status_code))
                def json(self):return self.value
            result=Response()
            try:result.value=app.analyze_image(app.ImageRequest(**json));result.status_code=200
            except HTTPException as exc:result.value={'detail':exc.detail};result.status_code=exc.status_code
            return result
    with ServiceClient() as client:
        if app.health()['status']!='ready':raise RuntimeError('CACHED_MODEL_UNAVAILABLE')
        startup=(time.perf_counter()-start)*1000
        for name,raw in fixtures:
            response=client.post('/v1/image/analyze',json={'image_base64':base64.b64encode(raw).decode()});response.raise_for_status();result=response.json()
            if result['classification']!='INCONCLUSIVE' or result['model_confidence'] is not None or result['model_status']!='ready':raise ValueError('FORBIDDEN_PROMOTION_OR_MISSING_INFERENCE')
            if result['inputTrace']['sourceSha256']!=hashlib.sha256(raw).hexdigest() or not result['inputTrace']['tensor']:raise ValueError('INPUT_TRACE_MISMATCH')
            rows.append(dict(id=name,sourceSha256=hashlib.sha256(raw).hexdigest(),inputTrace=result['inputTrace'],rawUncalibratedScore=result['fake_probability'],classification=result['classification'],processingMs=result['processing_ms']))
        baseline=rows[0]['inputTrace']['tensor']['sha256']
        for row in rows:
            if row['id'] in ['webp_lossless','exif_png','rgba_opaque','rgba_transparent'] and row['inputTrace']['tensor']['sha256']!=baseline:raise ValueError('LOSSLESS_ORIENTATION_RGB_TENSOR_MISMATCH')
        corrupt=client.post('/v1/image/analyze',json={'image_base64':base64.b64encode(b'corrupt').decode()}).status_code
        unsupported=client.post('/v1/image/analyze',json={'image_base64':base64.b64encode(encode(image,'GIF')).decode()}).status_code
        tiny=client.post('/v1/image/analyze',json={'image_base64':base64.b64encode(encode(image.resize((32,32)),'PNG')).decode()}).json()
        if corrupt!=400 or unsupported!=415 or tiny['model_status']!='skipped':raise ValueError('INPUT_REJECTION_CONTRACT')
    info=psutil.Process().memory_info()
    report=dict(scope='Authored procedural software controls with actual cached Community inference; no genuine/synthetic labels or accuracy measurement',model=app.MODEL_ID,revision=app.MODEL_REVISION,startupMs=startup,memory=dict(rssBytes=info.rss,peakWorkingSetBytes=getattr(info,'peak_wset',None)),checks=dict(losslessRgbTensorEquality=True,exifOrientationEquality=True,opaqueAlphaEquality=True,transparentHiddenRgbPreserved=True,corruptStatus=corrupt,unsupportedStatus=unsupported,tinyStatus=tiny['model_status']),limitation='Publisher RGB conversion discards alpha; hidden RGB can influence a classifier even when transparent. No display-composite or authenticity claim follows.',rows=rows,result='passed')
    with output.open('x',encoding='utf8') as file:json.dump(report,file,indent=2)
    print(json.dumps({k:v for k,v in report.items() if k!='rows'}))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);parser.add_argument('--worker',action='store_true',help=argparse.SUPPRESS);a=parser.parse_args()
    if a.worker:verify(a.output)
    else:
        if a.output.exists():raise ValueError('OUTPUT_EXISTS')
        code,out=supervised_command([sys.executable,'-m','ai_service.verify_media_preprocessing','--worker','--output',str(a.output)],timeout_seconds=120);print(out);raise SystemExit(code)
