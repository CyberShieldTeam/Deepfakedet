"""Authored software controls, not independent accuracy data. Generates no real announcements."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageFilter
import json
def main():
    root=Path('.model-cache/extraction-fixtures');root.mkdir(parents=True,exist_ok=True)
    font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',44)
    text='Software fixture: the fictional Amber Museum offers free entry.'
    im=Image.new('RGB',(1500,240),'white');ImageDraw.Draw(im).text((25,80),text,font=font,fill='black');im.save(root/'clear.png')
    Image.new('RGB',(1500,240),'white').save(root/'no-text.png')
    im.filter(ImageFilter.GaussianBlur(4)).save(root/'blurred.png')
    im.resize((375,60)).save(root/'low-resolution.png')
    im.rotate(90,expand=True).save(root/'rotated.png')
    indic=ImageFont.truetype('C:/Windows/Fonts/Nirmala.ttc',44)
    for name,value in [('hindi','काल्पनिक संग्रहालय खुला है।'),('telugu','కల్పిత మ్యూజియం తెరిచి ఉంది.'),('mixed','Software fixture: काल्पनिक संग्रहालय తెరిచి ఉంది.')]:
        sample=Image.new('RGB',(1500,240),'white');ImageDraw.Draw(sample).text((25,80),value,font=indic,fill='black');sample.save(root/(name+'.png'))
    (root/'manifest.json').write_text(json.dumps(dict(scope='authored software controls; not independent accuracy',text=text,rights='project-authored text and bitmap; locally rendered Arial font',files=['clear.png','no-text.png','blurred.png','low-resolution.png','rotated.png']),indent=2))
if __name__=='__main__':main()
