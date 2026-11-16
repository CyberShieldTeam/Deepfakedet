"""Blinded local annotation packets and explicit adjudication validation. No OCR/LLM calls."""
import argparse,hashlib,json,shutil
import base64
from pathlib import Path
from ai_service.ocr_release import read_json,encode,digest,write_new
PROTOCOL={'version':1,'transcription':'NFC; preserve case/punctuation; one newline between ordered legible regions; no spelling repair or translation','illegible':'Mark region illegible, empty text; do not guess. Record uncertainty.','language':'Region/source language declared by annotator; unknown is allowed; configured OCR language is not evidence.','review':'Two distinct independent blinded transcribers; separate adjudicator; no OCR predictions shown.','bounds':'Original encoded-image pixel boxes; original dimensions/source SHA required.','noText':'Explicit noText=true with no regions; do not infer from unavailable OCR.'}
PROTOCOL_HASH=digest(encode(PROTOCOL))
def validate_transcription(entry,source_hash,dimensions):
    for key in ['annotatorId','recordedAt','sourceLanguage','uncertainty']:
        if not isinstance(entry.get(key),str) or (key!='uncertainty' and not entry[key].strip()):raise ValueError('Annotation identity/language/uncertainty required')
    if entry.get('blinded') is not True or entry.get('protocolSha256')!=PROTOCOL_HASH or entry.get('sourceSha256')!=source_hash or entry.get('dimensions')!=dimensions:raise ValueError('Annotation blindness/protocol/source mismatch')
    if not isinstance(dimensions,list) or len(dimensions)!=2 or any(type(v)!=int or v<1 for v in dimensions):raise ValueError('Original dimensions required')
    regions=entry.get('regions');orders=set();ids=set();texts=[]
    if not isinstance(regions,list) or len(regions)>100 or type(entry.get('noText'))!=bool:raise ValueError('Explicit region/no-text annotation required')
    if entry['noText'] and regions:raise ValueError('No-text declaration conflicts with regions')
    if not entry['noText'] and not regions:raise ValueError('Missing text/illegibility annotation')
    for r in regions:
        if not isinstance(r.get('id'),str) or not r['id'] or r['id'] in ids or type(r.get('order'))!=int or r['order']<0 or r['order'] in orders:raise ValueError('Unique region IDs/reading order required')
        if r.get('legibility') not in ['legible','illegible','uncertain'] or not isinstance(r.get('text'),str) or len(r['text'])>4000 or not isinstance(r.get('language'),str) or not r['language']:raise ValueError('Region text/language/legibility required')
        box=r.get('bbox')
        if not isinstance(box,list) or len(box)!=4 or any(type(v) not in [int,float] or not __import__('math').isfinite(v) for v in box) or min(box)<0 or box[2]<=0 or box[3]<=0 or box[0]+box[2]>dimensions[0] or box[1]+box[3]>dimensions[1]:raise ValueError('Annotation region outside original image')
        if r['legibility']=='illegible' and r['text']:raise ValueError('Do not invent illegible text')
        orders.add(r['order']);ids.add(r['id']);texts.append(r)
    reference='\n'.join(r['text'] for r in sorted(texts,key=lambda r:r['order']) if r['legibility']=='legible')
    if len(reference)>4000:raise ValueError('Final transcription budget')
    return reference
def verify_adjudication(value,source_hash,dimensions):
    entries=value.get('transcriptions')
    if not isinstance(entries,list) or len(entries)!=2 or entries[0].get('annotatorId')==entries[1].get('annotatorId'):raise ValueError('Two distinct blinded transcribers required')
    refs=[validate_transcription(e,source_hash,dimensions) for e in entries]
    final=value.get('adjudication',{});reference=validate_transcription(final,source_hash,dimensions)
    if final['annotatorId'] in [e['annotatorId'] for e in entries] or final.get('differencesReviewed') is not True:raise ValueError('Separate adjudicator and explicit disagreement review required')
    return dict(reference=reference,first=refs[0],second=refs[1],disagrees=refs[0]!=refs[1],uncertainRegions=sum(r['legibility']!='legible' for r in final['regions']),sourceLanguage=final['sourceLanguage'])
def create_packet(manifest,directory,annotator_id):
    # This deliberately never copies reference, predictions, claim labels or adjudications.
    m=read_json(manifest);root=Path(manifest).resolve().parent;out=Path(directory)
    if not annotator_id.strip() or len(m.get('rows',[]))>50:raise ValueError('Named participant and <=50-image packet required')
    out.mkdir(exist_ok=False);items=[]
    for index,row in enumerate(m['rows']):
        source=(root/row['path']).resolve()
        if Path(row['path']).is_absolute() or not source.is_relative_to(root) or source.stat().st_size>10*1024*1024:raise ValueError('Packet source containment/budget')
        raw=source.read_bytes()
        if digest(raw)!=row['sha256']:raise ValueError('Packet source changed')
        from ai_service.extraction_prepare import prepare
        geometry=prepare(base64.b64encode(raw).decode())
        if row['dimensions']!=[geometry['originalWidth'],geometry['originalHeight']]:raise ValueError('Packet original dimensions mismatch')
        name=f'image-{index:03d}{source.suffix.lower()}'
        if source.suffix.lower() not in ['.png','.jpg','.jpeg','.webp']:raise ValueError('Unsupported screenshot suffix')
        (out/name).write_bytes(raw);items.append(dict(id=row['id'],image=name,sourceSha256=row['sha256'],dimensions=row['dimensions'],annotatorId=annotator_id,protocolSha256=PROTOCOL_HASH,blinded=True,sourceLanguage='',recordedAt='',uncertainty='',noText=False,regions=[]))
    write_new(out/'annotation-template.json',dict(protocol=PROTOCOL,protocolSha256=PROTOCOL_HASH,items=items))
    (out/'README.txt').write_text('BLINDED TRANSCRIPTION PACKET\nOpen original local images. Fill the JSON template using the supplied protocol. No OCR/publisher transcriptions are included. Do not consult predictions. Use a separate packet per actual participant. Human identities/independence are attestations, not something software can prove.\n',encoding='utf-8')
    return dict(images=len(items),packet=str(out),containsPredictions=False)
def main():
    p=argparse.ArgumentParser();p.add_argument('manifest');p.add_argument('--directory',required=True);p.add_argument('--annotator',required=True);a=p.parse_args();print(json.dumps(create_packet(a.manifest,a.directory,a.annotator)))
if __name__=='__main__':main()
