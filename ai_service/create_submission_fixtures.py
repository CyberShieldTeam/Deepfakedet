"""Portable authored demo graphic. No external fonts, sources or human annotations."""
import argparse,hashlib,json
from datetime import datetime,timedelta,timezone
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,__version__

TEXT='Software fixture: the fictional Amber Museum offers free entry.'
def create(directory):
    root=Path(directory);root.mkdir(parents=True,exist_ok=True)
    target=root/'notice.png'
    if target.exists():raise ValueError('Refusing to overwrite an existing demo image')
    image=Image.new('RGB',(1500,240),'white')
    ImageDraw.Draw(image).text((25,80),TEXT,font=ImageFont.load_default(size=42),fill='black')
    image.save(target)
    manifest=dict(scope='project-authored engineering demonstration; not independent research',text=TEXT,
                  sha256=hashlib.sha256(target.read_bytes()).hexdigest(),dimensions=list(image.size),
                  renderer='Pillow bundled default font',pillow=__version__,rights='Project-authored text and raster graphic; no font binary redistributed')
    (root/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    epoch=datetime(2026,1,1,tzinfo=timezone.utc)
    at=lambda seconds:(epoch+timedelta(seconds=seconds)).isoformat().replace('+00:00','Z')
    posts=[dict(account_id=account,post_id=f'{account}-{j}',content=TEXT+' https://example.org/engine4-source',url='https://example.org/engine4-source',timestamp=at(seconds+i)) for i,account in enumerate(['a','b','c','d']) for j,seconds in enumerate([0,3600,7200])]
    (root/'posts.json').write_text(json.dumps(dict(posts=posts,coverage=dict(start=at(-60),end=at(20000),complete=True,source='Authored software-control observation window; not platform coverage')),indent=2),encoding='utf-8')
    print('Authored demo image created; not an actual public notice.')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--directory',default='fixtures/submission');a=p.parse_args();create(a.directory)
