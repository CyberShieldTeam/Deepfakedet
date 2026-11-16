"""Bounded image preparation. No OCR/model/download/network/client-selected file paths."""
import base64
import binascii
import hashlib
import io
import warnings
from fastapi import APIRouter,HTTPException
from pydantic import BaseModel,ConfigDict,Field
from PIL import Image,ImageOps,UnidentifiedImageError
router=APIRouter()
class PreparationInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    image_base64:str=Field(max_length=14_000_000)

def prepare(encoded):
    try:raw=base64.b64decode(encoded,validate=True)
    except (ValueError,binascii.Error) as error:raise ValueError('Invalid base64 image') from error
    if not raw or len(raw)>10*1024*1024:raise ValueError('Image byte budget exceeded')
    with warnings.catch_warnings():
        warnings.simplefilter('error',Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(raw)) as image:
            if image.format not in ('PNG','JPEG','WEBP'):raise ValueError('Unsupported OCR image format')
            original_width,original_height=image.size
            if original_width*original_height>24_000_000:raise ValueError('Image pixel budget exceeded')
            image=ImageOps.exif_transpose(image).convert('RGB')
            image.thumbnail((1600,1600),Image.Resampling.LANCZOS)
            stream=io.BytesIO();image.save(stream,format='PNG');bitmap=stream.getvalue()
            if len(bitmap)>8*1024*1024:raise ValueError('Prepared bitmap byte budget exceeded')
            return dict(image_base64=base64.b64encode(bitmap).decode('ascii'),sourceSha256=hashlib.sha256(raw).hexdigest(),bitmapSha256=hashlib.sha256(bitmap).hexdigest(),originalWidth=original_width,originalHeight=original_height,width=image.width,height=image.height,transformation='EXIF orientation applied; RGB; aspect-preserving thumbnail <=1600px; no automatic rotation or translation')

@router.post('/v1/extraction/image/prepare')
def prepare_image(body:PreparationInput):
    try:return prepare(body.image_base64)
    except (ValueError,UnidentifiedImageError,Image.DecompressionBombWarning,Image.DecompressionBombError,OSError) as error:raise HTTPException(400,'Invalid, unsupported or over-budget OCR image') from error
