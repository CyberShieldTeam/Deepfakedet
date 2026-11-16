"""Versioned authored controls, not independently transcribed evaluation images."""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageFilter
def main():
    root=Path('.model-cache/engine42-controls');root.mkdir(exist_ok=True)
    font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',44);text='Software fixture: the fictional Amber Museum offers free entry.'
    im=Image.new('RGB',(1500,240),'white');ImageDraw.Draw(im).text((25,80),text,font=font,fill='black')
    dense=Image.new('RGB',(1500,500),'white');draw=ImageDraw.Draw(dense)
    for i in range(7):draw.text((25,10+i*65),text,font=font,fill='black')
    low=Image.new('RGB',im.size,(155,155,155));ImageDraw.Draw(low).text((25,80),text,font=font,fill=(140,140,140))
    values=[('clear',im,text,'clear','0'),('blurred',im.filter(ImageFilter.GaussianBlur(4)),text,'blurred','0'),('rotated',im.transpose(Image.Transpose.ROTATE_90),text,'clear','90ccw'),('low-resolution',im.resize((375,60)),text,'low_resolution','0'),('no-text',Image.new('RGB',im.size,'white'),'','no_text','0'),('dense',dense,'\n'.join([text]*7),'clear','0'),('low-contrast',low,text,'low_contrast','0')]
    rows=[]
    for name,image,reference,quality,rotation in values:
        target=root/(name+'.png');image.save(target);rows.append(dict(id=name,path=target.name,sha256=hashlib.sha256(target.read_bytes()).hexdigest(),sourceGroup='authored-museum-family',split='development',language='eng',quality=quality,rotation=rotation,resolution=f'{image.width}x{image.height}',density='dense' if name=='dense' else 'sparse',sourceCategory='authored_printed_graphic',reference=reference))
    manifest=dict(schemaVersion=2,scope='authored_controls',datasetId='engine42-authored-v1',datasetVersion='1',publisher='VERITAS software controls',officialSource='local authored fixture generator',rights='project-authored text/bitmap; locally rendered Windows Arial, no font redistribution',permissionEvidence='Project-authored software controls',annotationProtocol='Reference is the authored rendering input, not independent human transcription',annotationProvenance='ai_service/create_engine42_controls.py',approvedBy='software-control-generator',approvedAt='2026-11-16',profiles=['baseline','rotate90','rotate180','rotate270','contrast','grayscale','sharpen','upscale2'],rows=rows)
    (root/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print('Authored controls created; no independent accuracy claim.')
if __name__=='__main__':main()
