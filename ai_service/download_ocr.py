"""Explicit bounded download of one official Apache-2.0 English OCR data file. Never run at startup."""
import hashlib
from pathlib import Path
import urllib.request

REVISION='87416418657359cb625c412a48b6e1d6d41c29bd'
BLOB='bbef4675053b5b468cdb477053e28b1c698ba08e'
SIZE=4113088
SHA256='7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2'

def main():
    target=Path('.model-cache/ocr/eng.traineddata')
    if target.exists():raise ValueError('Refusing to overwrite existing model')
    url=f'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/{REVISION}/eng.traineddata'
    with urllib.request.urlopen(url,timeout=30) as response:data=response.read(SIZE+1)
    if len(data)!=SIZE or hashlib.sha1(b'blob '+str(SIZE).encode()+b'\0'+data).hexdigest()!=BLOB or hashlib.sha256(data).hexdigest()!=SHA256:raise ValueError('Publisher size/blob/SHA256 mismatch')
    target.parent.mkdir(parents=True,exist_ok=True)
    with target.open('xb') as file:file.write(data)
    print(dict(path=str(target),bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),revision=REVISION,license='Apache-2.0'))
if __name__=='__main__':main()
