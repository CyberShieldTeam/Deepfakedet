"""Bounded image preparation. No OCR/model/download/network/client-selected file paths."""
import base64
import binascii
import hashlib
import io
import warnings
from fastapi import APIRouter,HTTPException
from pydantic import BaseModel,ConfigDict,Field
from PIL import Image,ImageOps,ImageFilter,UnidentifiedImageError
from typing import Literal
from ai_service.ocr_geometry import IDENTITY,compose,inverse,exif_to_display
PROFILES=('baseline','rotate90','rotate180','rotate270','contrast','grayscale','sharpen','upscale2','singleLine')
router=APIRouter()
class PreparationInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    image_base64:str=Field(max_length=14_000_000)
    profile:Literal['baseline','rotate90','rotate180','rotate270','contrast','grayscale','sharpen','upscale2','singleLine']='baseline'

def prepare(encoded,profile='baseline'):
    if profile not in PROFILES:raise ValueError('Unsupported preprocessing profile')
    try:raw=base64.b64decode(encoded,validate=True)
    except (ValueError,binascii.Error) as error:raise ValueError('Invalid base64 image') from error
    if not raw or len(raw)>10*1024*1024:raise ValueError('Image byte budget exceeded')
    with warnings.catch_warnings():
        warnings.simplefilter('error',Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(raw)) as image:
            if image.format not in ('PNG','JPEG','WEBP'):raise ValueError('Unsupported OCR image format')
            original_width,original_height=image.size
            if original_width*original_height>24_000_000:raise ValueError('Image pixel budget exceeded')
            orientation=image.getexif().get(274,1)
            if orientation not in range(1,9):raise ValueError('Invalid EXIF orientation')
            source_to_display=exif_to_display(orientation,original_width,original_height)
            image=ImageOps.exif_transpose(image).convert('RGB')
            display_width,display_height=image.size
            to_display=IDENTITY
            if profile.startswith('rotate'):
                angle=int(profile[6:]);to_display={90:[0,-1,display_width,1,0,0],180:[-1,0,display_width,0,-1,display_height],270:[0,1,0,-1,0,display_height]}[angle]
                image=image.transpose({90:Image.Transpose.ROTATE_90,180:Image.Transpose.ROTATE_180,270:Image.Transpose.ROTATE_270}[angle])
            elif profile=='contrast':image=ImageOps.autocontrast(image,cutoff=0)
            elif profile=='grayscale':image=ImageOps.grayscale(image).convert('RGB')
            elif profile=='sharpen':image=image.filter(ImageFilter.UnsharpMask(radius=1,percent=100,threshold=3))
            rotated_width,rotated_height=image.size
            if profile=='upscale2':
                scale=min(2,1600/max(image.size))
                if scale>1:image=image.resize((round(image.width*scale),round(image.height*scale)),Image.Resampling.LANCZOS)
            image.thumbnail((1600,1600),Image.Resampling.LANCZOS)
            to_display=compose(to_display,[rotated_width/image.width,0,0,0,rotated_height/image.height,0])
            to_source=compose(inverse(source_to_display),to_display)
            stream=io.BytesIO();image.save(stream,format='PNG');bitmap=stream.getvalue()
            if len(bitmap)>8*1024*1024:raise ValueError('Prepared bitmap byte budget exceeded')
            return dict(image_base64=base64.b64encode(bitmap).decode('ascii'),sourceSha256=hashlib.sha256(raw).hexdigest(),bitmapSha256=hashlib.sha256(bitmap).hexdigest(),originalWidth=original_width,originalHeight=original_height,width=image.width,height=image.height,transformation=f'EXIF {orientation} applied; RGB; analyst-selected {profile}; <=1600px; no automatic text selection or translation',profile=profile,displayWidth=display_width,displayHeight=display_height,processingToDisplay=to_display,processingToSource=to_source,coordinateConvention='continuous pixel edges; source=encoded original; display=EXIF-oriented original')

@router.post('/v1/extraction/image/prepare')
def prepare_image(body:PreparationInput):
    try:return prepare(body.image_base64,body.profile)
    except (ValueError,UnidentifiedImageError,Image.DecompressionBombWarning,Image.DecompressionBombError,OSError) as error:raise HTTPException(400,'Invalid, unsupported or over-budget OCR image') from error
