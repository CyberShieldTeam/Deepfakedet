"""Frozen external image comparison, exact tensors, no model promotion or fitting."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import statistics
import sys
import time
from PIL import Image,ImageOps
from ai_service.media_model_registry import MODELS,cached_snapshot,tensor_fingerprint
from ai_service.evaluate_nli import supervised_command
from ai_service.image_benchmark import summarize

PROTOCOL=Path('test/fixtures/engine1_image_protocol.json')


def validate(manifest):
    protocol=json.loads(PROTOCOL.read_bytes())
    if manifest['protocolSha256']!=hashlib.sha256(PROTOCOL.read_bytes()).hexdigest():raise ValueError('FROZEN_PROTOCOL_CHANGED')
    ids,groups,pixels,encoded,prompts=set(),set(),set(),set(),set()
    for row in manifest['rows']:
        if row['id'] in ids or row['group'] in groups or row['decodedSha256'] in pixels or row['sha256'] in encoded or (row['promptGroup'] and row['promptGroup'] in prompts):raise ValueError('SOURCE_OR_CONTENT_OVERLAP')
        ids.add(row['id']);groups.add(row['group']);pixels.add(row['decodedSha256']);encoded.add(row['sha256'])
        if row['promptGroup']:prompts.add(row['promptGroup'])
    if len(ids)!=sum(sum(v.values()) for v in protocol['roles'].values()):raise ValueError('FROZEN_COUNT')
    for role,quotas in protocol['roles'].items():
        for label,count in quotas.items():
            if sum(r['role']==role and r['label']==label for r in manifest['rows'])!=count:raise ValueError('FROZEN_QUOTA')


def derived(image):
    square=ImageOps.fit(image,(256,256),method=Image.Resampling.LANCZOS,centering=(.5,.5));stream=io.BytesIO();square.save(stream,format='JPEG',quality=95,subsampling=2)
    raw=stream.getvalue()
    return Image.open(io.BytesIO(raw)).convert('RGB'),hashlib.sha256(raw).hexdigest()


def evaluate(kind,manifest,output):
    if output.exists():raise ValueError('OUTPUT_EXISTS')
    data=json.loads(manifest.read_bytes());validate(data)
    import psutil
    if psutil.virtual_memory().available<2*2**30:raise RuntimeError('INSUFFICIENT_MEMORY_HEADROOM')
    start=time.perf_counter();snapshot=cached_snapshot(kind)
    import torch
    torch.set_num_threads(4)
    if kind=='community':
        from ai_service.community_model import load
        network,processor=load()
        tensor=lambda image:processor(image).unsqueeze(0)
    else:
        from transformers import AutoModelForImageClassification,AutoImageProcessor
        processor=AutoImageProcessor.from_pretrained(snapshot,local_files_only=True,trust_remote_code=False,use_fast=False)
        network=AutoModelForImageClassification.from_pretrained(snapshot,local_files_only=True,trust_remote_code=False,use_safetensors=True).eval()
        labels={0:'REAL',1:'FAKE'} if kind=='dima' else {0:'artificial',1:'human'}
        if network.config.id2label!=labels:raise ValueError('LABEL_ORDER')
        tensor=lambda image:processor(images=image,return_tensors='pt')['pixel_values']
    startup=(time.perf_counter()-start)*1000;rows=[]
    for row in data['rows']:
        path=(manifest.parent/row['path']).resolve()
        if not path.is_relative_to(manifest.parent.resolve()) or path.stat().st_size>10*1024*1024:raise ValueError('INPUT_PATH_OR_LIMIT')
        raw=path.read_bytes()
        if hashlib.sha256(raw).hexdigest()!=row['sha256']:raise ValueError('SOURCE_HASH_MISMATCH')
        with Image.open(io.BytesIO(raw)) as source:
            if source.width*source.height>24_000_000:raise ValueError('SOURCE_PIXEL_LIMIT')
            image=ImageOps.exif_transpose(source).convert('RGB')
        if hashlib.sha256(image.tobytes()).hexdigest()!=row['decodedSha256']:raise ValueError('DECODED_HASH_MISMATCH')
        matched,matched_hash=derived(image)
        for variant,pixels,variant_hash in [('original',image,row['sha256']),('matched_square256_jpeg95',matched,matched_hash)]:
            before=time.perf_counter();inputs=tensor(pixels);trace=tensor_fingerprint(inputs)
            with torch.inference_mode():
                if kind=='community':score=torch.sigmoid(network(inputs)).item()
                else:score=torch.softmax(network(pixel_values=inputs).logits[0],dim=-1)[1 if kind=='dima' else 0].item()
            if not __import__('math').isfinite(score) or not 0<=score<=1:raise ValueError('NONFINITE_MODEL_OUTPUT')
            rows.append({k:row[k] for k in ['id','label','group','role','generator','sourceDataset','sha256','geometry']}|dict(variant=variant,derivedEncodedSha256=variant_hash,modelInput=trace,score=score,seconds=time.perf_counter()-before))
    splits={}
    for role in ['development','held_out']:
        splits[role]={variant:summarize([r for r in rows if r['role']==role and r['variant']==variant]) for variant in ['original','matched_square256_jpeg95']}
    stratified={generator:summarize([r for r in rows if r['generator']==generator and r['variant']=='original']) for generator in sorted({r['generator'] for r in rows})}
    memory=psutil.Process().memory_info();spec=MODELS[kind]
    report=dict(scope='Frozen external research comparison; incomplete source/identity/training independence, inherited format/resolution confounds. Not validated authenticity accuracy.',dataset=data['dataset'],datasetRevision=data['revision'],license=data['license'],model={k:v for k,v in spec.items() if k!='files'},weightsSha256=spec['files']['model.safetensors'][2],manifestSha256=hashlib.sha256(manifest.read_bytes()).hexdigest(),protocolSha256=data['protocolSha256'],startupMs=startup,elapsedMs=(time.perf_counter()-start)*1000,memory=dict(rssBytes=memory.rss,peakWorkingSetBytes=getattr(memory,'peak_wset',None)),splits=splits,perGenerator=stratified,authoritativePromotion=False,rows=rows,limitations=['No semantic category, face-manipulation or original-capture truth annotations; not invented.', 'Zero errors on small samples cannot certify low false-positive risk. Synthetic generator strata lack genuine negatives, so FPR/AUROC are undefined there.', 'The two derivations of an original are paired, not independent images. No threshold fitting or change to service quarantine.'])
    with output.open('x',encoding='utf8') as file:json.dump(report,file,indent=2)
    print(json.dumps({k:v for k,v in report.items() if k not in ['rows','limitations','perGenerator']}))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--model',choices=['community','dima','sdxl'],required=True);parser.add_argument('--manifest',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--worker',action='store_true',help=argparse.SUPPRESS);a=parser.parse_args()
    if a.worker:evaluate(a.model,a.manifest,a.output)
    else:
        if a.output.exists():raise ValueError('OUTPUT_EXISTS')
        code,out=supervised_command([sys.executable,'-m','ai_service.evaluate_media_images','--worker','--model',a.model,'--manifest',str(a.manifest),'--output',str(a.output)],timeout_seconds=600);print(out);raise SystemExit(code)
