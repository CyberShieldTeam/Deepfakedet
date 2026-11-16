"""Offline, bounded future annotated-data interface. No fetching, label inference or model tuning."""
import argparse,hashlib,json
from pathlib import Path
import unicodedata
def distance(a,b):
    previous=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        current=[i]
        for j,y in enumerate(b,1):current.append(min(current[-1]+1,previous[j]+1,previous[j-1]+(x!=y)))
        previous=current
    return previous[-1]
def text_metrics(rows):
    if not rows:return None
    ce=we=chars=words=0
    for row in rows:
        a=unicodedata.normalize('NFC',row['reference']);b=unicodedata.normalize('NFC',row['prediction'])
        if not a:raise ValueError('Nonempty ground truth required; silence needs a separate annotated protocol')
        ce+=distance(a,b);we+=distance(a.split(),b.split());chars+=len(a);words+=len(a.split())
    return dict(samples=len(rows),characterErrorRate=ce/chars,wordErrorRate=we/words if words else None)
def set_metrics(rows):
    if not rows:return None
    tp=fp=fn=0
    for row in rows:
        a=set(row['reference']);b=set(row['prediction']);tp+=len(a&b);fp+=len(b-a);fn+=len(a-b)
    return dict(samples=len(rows),tp=tp,fp=fp,fn=fn,precision=tp/(tp+fp) if tp+fp else None,recall=tp/(tp+fn) if tp+fn else None,f1=2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else None)
def evaluate(data):
    if data.get('schemaVersion')!=1 or data.get('independent') is not True:raise ValueError('Independent annotated release required')
    if data.get('split')!='development':raise ValueError('Final holdout locked; requires separately frozen evaluation release')
    for field in ['datasetId','rights','permissionEvidence','annotationProtocol','annotationProvenance','approvedBy','approvedAt']:
        if not isinstance(data.get(field),str) or not data[field].strip():raise ValueError('Missing rights or annotation provenance: '+field)
    sections=['ocr','speech','candidates','relationships','reviewAgreement'];count=0;ids=set()
    for section in sections:
        rows=data.get(section,[])
        if not isinstance(rows,list):raise ValueError('Expected annotation rows')
        count+=len(rows)
        if count>100:raise ValueError('Maximum 100 annotated observations per release')
        for row in rows:
            if not isinstance(row,dict) or not isinstance(row.get('id'),str) or not row['id'] or (section,row['id']) in ids:raise ValueError('Invalid/duplicate observation ID')
            ids.add((section,row['id']))
            if not isinstance(row.get('sourceSha256'),str) or len(row['sourceSha256'])!=64 or any(c not in '0123456789abcdef' for c in row['sourceSha256']):raise ValueError('Source hash required')
            if section in ['ocr','speech']:
                if any(not isinstance(row.get(k),str) or len(row[k])>500 for k in ['reference','prediction']):raise ValueError('Text budget/type error')
            elif section in ['candidates','relationships']:
                for k in ['reference','prediction']:
                    if not isinstance(row.get(k),list) or len(row[k])>100 or any(not isinstance(v,str) or not v or len(v)>200 for v in row[k]) or len(set(row[k]))!=len(row[k]):raise ValueError('Exact anchored annotation IDs required')
            else:
                if not isinstance(row.get('reviewers'),list) or len(row['reviewers'])!=2 or len(set(row['reviewers']))!=2 or any(not isinstance(v,str) or not v for v in row['reviewers']):raise ValueError('Two independent reviewer identities required')
                if any(row.get(k) not in ['accepted','corrected','rejected','uncertain'] for k in ['first','second']):raise ValueError('Review states required')
    agreements=data.get('reviewAgreement',[])
    return dict(scope='operator-declared independent development annotations; rights are not independently verified by code',datasetId=data['datasetId'],normalization='NFC, case/punctuation preserved; whitespace word splitting',ocr=text_metrics(data.get('ocr',[])),speech=text_metrics(data.get('speech',[])),candidates=set_metrics(data.get('candidates',[])),relationships=set_metrics(data.get('relationships',[])),reviewAgreement=dict(samples=len(agreements),observedAgreement=sum(r['first']==r['second'] for r in agreements)/len(agreements)) if agreements else None)
def main():
    p=argparse.ArgumentParser();p.add_argument('manifest');p.add_argument('--output',required=True);args=p.parse_args();source=Path(args.manifest);target=Path(args.output)
    if target.exists():raise ValueError('Refusing existing evaluation output')
    if source.stat().st_size>2*1024*1024:raise ValueError('Manifest exceeds 2 MiB')
    raw=source.read_bytes();result=evaluate(json.loads(raw));result['manifestSha256']=hashlib.sha256(raw).hexdigest()
    with target.open('x',encoding='utf-8') as file:json.dump(result,file,indent=2,ensure_ascii=False)
if __name__=='__main__':main()
