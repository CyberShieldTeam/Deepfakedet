"""Authored engineering controls, never independent screenshots or human labels."""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
CASES=[
 dict(id='number',source='Software control: 75 people visited the fictional Amber Museum.',injected='Software control: 15 people visited the fictional Amber Museum.'),
 dict(id='location',source='Software control: The fictional Amber event is in Hyderabad.',injected='Software control: The fictional Amber event is in Hyderbad.'),
 dict(id='negation',source='Software control: The fictional Amber Museum will not open.',injected='Software control: The fictional Amber Museum will open.'),
 dict(id='date',source='Software control: The fictional Amber event is on June 17, 2031.',injected='Software control: The fictional Amber event is on June.'),
 dict(id='mixed',source='Software control: स्कूल మూసివేయబడింది',injected='Software control: The Amber school is closed.'),
]
def main():
    root=Path('.model-cache/engine43-controls');root.mkdir(exist_ok=True);font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',38);indic=ImageFont.truetype('C:/Windows/Fonts/Nirmala.ttc',38)
    rows=[];cases=[]
    for case in CASES:
        image=Image.new('RGB',(1500,220),'white');draw=ImageDraw.Draw(image);f=indic if case['id']=='mixed' else font;draw.text((25,80),case['source'],font=f,fill='black');bounds=draw.textbbox((25,80),case['source'],font=f);target=root/(case['id']+'.png');image.save(target);sha=hashlib.sha256(target.read_bytes()).hexdigest()
        rows.append(dict(id=case['id'],path=target.name,sha256=sha,dimensions=[1500,220],sourceGroup='authored-amber-family',family='authored-amber-family',lineage='authored-amber-family',split='development',sourceLanguage='mixed' if case['id']=='mixed' else 'English',languageBasis='authored',recognitionLanguage='eng',quality='clear',rotation='0',resolution='1500x220',density='single_line',sourceCategory='authored_screen_like_graphic',annotationStatus='authored',reference=case['source']))
        cases.append({**case,'path':target.name,'sha256':sha,'dimensions':[1500,220],'bbox':dict(x=bounds[0],y=bounds[1],width=bounds[2]-bounds[0],height=bounds[3]-bounds[1])})
    m=dict(schemaVersion=3,scope='authored_controls',datasetId='engine43-engineering-controls',datasetVersion='1',publisher='VERITAS software controls',officialSource='local source renderer',rights='Project-authored text/bitmap; local Windows font rendering, no font redistribution',permissionEvidence='Authored software controls',annotationProtocol='Source strings are rendering inputs; no independent/human transcription claimed',annotationProvenance='ai_service/create_engine43_controls.py',approvedBy='software-control-generator',approvedAt='2026-11-17',resourceApproval=dict(approvedBy='software-control-generator',reference='bounded local software-control workload',maxPasses=10),profiles=['baseline','upscale2'],rows=rows)
    (root/'release.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8');(root/'cases.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2),encoding='utf-8');print('Five authored controls created. Injected transcripts are separate from real OCR measurements.')
if __name__=='__main__':main()
