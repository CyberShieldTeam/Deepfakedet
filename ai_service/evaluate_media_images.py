"""Frozen external image comparison, exact tensors, no model promotion or fitting."""
import argparse
import hashlib
import io
import json
import math
from pathlib import Path
import re
import statistics
import sys
import time
from PIL import Image,ImageOps
from ai_service.media_model_registry import MODELS,cached_snapshot,tensor_fingerprint
from ai_service.prepare_media_image_evaluation import DATASET,REVISION,LICENSE
from ai_service.evaluate_nli import supervised_command
from ai_service.image_benchmark import summarize

PROTOCOL=Path('test/fixtures/engine1_image_protocol.json')
SHA256=re.compile(r'^[a-f0-9]{64}$')
IMAGE_PATH=re.compile(r'^images/[a-f0-9]{24}\.(?:jpg|png|webp)$')
SHARD_PATH=re.compile(r'^data/CompEval-\d{5}-of-00413\.parquet$')
ROW_FIELDS={'id','path','sha256','decodedSha256','label','role','group','promptGroup','generator',
            'sourceDataset','source','publisherImageName','shard','index','license','geometry'}
MANIFEST_FIELDS={'dataset','revision','license','protocolSha256','inventorySha256','exclusions','rows','scope'}


def _nonempty(value):
    return isinstance(value,str) and bool(value.strip())


def _verify_source_image(root,row):
    base=root.resolve()
    path=(base/row['path']).resolve()
    if not path.is_relative_to(base) or not path.is_file():raise ValueError('INPUT_PATH_OR_LIMIT')
    size=path.stat().st_size
    if size<1 or size>10*1024*1024:raise ValueError('INPUT_PATH_OR_LIMIT')
    raw=path.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=row['sha256']:raise ValueError('SOURCE_HASH_MISMATCH')
    try:
        with Image.open(io.BytesIO(raw)) as source:
            if source.format not in ('JPEG','PNG','WEBP') or source.width<64 or source.height<64 or source.width*source.height>24_000_000:
                raise ValueError('SOURCE_GEOMETRY')
            source.load()
            image=ImageOps.exif_transpose(source).convert('RGB')
            geometry=row['geometry']
            if (source.format!=geometry['format'] or source.width!=geometry['width'] or
                source.height!=geometry['height'] or source.mode!=geometry['mode'] or
                list(image.size)!=geometry['orientedSize']):raise ValueError('SOURCE_GEOMETRY_MISMATCH')
    except ValueError:
        raise
    except Exception as error:
        raise ValueError('IMAGE_DECODE_FAILED') from error
    if hashlib.sha256(image.tobytes()).hexdigest()!=row['decodedSha256']:
        raise ValueError('DECODED_HASH_MISMATCH')
    return raw,image


def validate(manifest,root=None):
    if not isinstance(manifest,dict) or set(manifest)!=MANIFEST_FIELDS:raise ValueError('MANIFEST_SCHEMA')
    protocol=json.loads(PROTOCOL.read_bytes())
    if manifest['dataset']!=DATASET or manifest['revision']!=REVISION or manifest['license']!=LICENSE:raise ValueError('DATASET_PROVENANCE')
    if manifest['protocolSha256']!=hashlib.sha256(PROTOCOL.read_bytes()).hexdigest():raise ValueError('FROZEN_PROTOCOL_CHANGED')
    if not SHA256.fullmatch(str(manifest['inventorySha256'])):raise ValueError('INVENTORY_PROVENANCE')
    if not _nonempty(manifest['scope']) or not isinstance(manifest['exclusions'],dict) or any(not _nonempty(k) or type(v) is not int or v<0 for k,v in manifest['exclusions'].items()):raise ValueError('MANIFEST_SCHEMA')
    rows=manifest['rows'];quotas=protocol.get('roles')
    if not isinstance(rows,list) or not isinstance(quotas,dict):raise ValueError('MANIFEST_SCHEMA')
    expected=sum(sum(values.values()) for values in quotas.values())
    if len(rows)!=expected:raise ValueError('FROZEN_COUNT')
    ids,groups,pixels,encoded,prompts=set(),set(),set(),set(),set()
    counts={role:{label:0 for label in labels} for role,labels in quotas.items()}
    root=Path(root) if root is not None else None
    for row in manifest['rows']:
        if not isinstance(row,dict) or set(row)!=ROW_FIELDS:raise ValueError('ROW_SCHEMA')
        for key in ('id','path','label','role','group','generator','sourceDataset','source','publisherImageName','shard','license'):
            if not _nonempty(row[key]):raise ValueError('ROW_PROVENANCE')
        if not re.fullmatch(r'[a-f0-9]{24}',row['id']) or not IMAGE_PATH.fullmatch(row['path']):raise ValueError('ROW_IDENTITY')
        for key in ('sha256','decodedSha256','group'):
            if not isinstance(row[key],str) or not SHA256.fullmatch(row[key]):raise ValueError('ROW_HASH')
        if row['promptGroup'] is not None and (not isinstance(row['promptGroup'],str) or not SHA256.fullmatch(row['promptGroup'])):raise ValueError('ROW_HASH')
        if row['label'] not in ('genuine','synthetic') or row['role'] not in quotas or row['label'] not in quotas[row['role']]:raise ValueError('ROW_LABEL_OR_ROLE')
        if row['generator']=='camera_publisher_label' and row['label']!='genuine':raise ValueError('LABEL_PROVENANCE')
        if row['label']=='genuine' and row['generator']!='camera_publisher_label':raise ValueError('LABEL_PROVENANCE')
        if not _nonempty(row['sourceDataset']) or row['source']!=f'https://huggingface.co/datasets/{DATASET}/tree/{REVISION}' or row['license']!=LICENSE:raise ValueError('ROW_PROVENANCE')
        if not SHARD_PATH.fullmatch(row['shard']) or type(row['index']) is not int or row['index']<0:raise ValueError('ROW_PROVENANCE')
        geometry=row['geometry']
        if (not isinstance(geometry,dict) or set(geometry)!={'format','width','height','orientedSize','mode'} or
            geometry.get('format') not in ('JPEG','PNG','WEBP') or type(geometry.get('width')) is not int or
            type(geometry.get('height')) is not int or geometry['width']<64 or geometry['height']<64 or
            geometry['width']*geometry['height']>24_000_000 or not isinstance(geometry.get('orientedSize'),list) or
            len(geometry['orientedSize'])!=2 or any(type(v) is not int or v<1 for v in geometry['orientedSize']) or
            not _nonempty(geometry.get('mode'))):raise ValueError('SOURCE_GEOMETRY')
        expected_format={'.jpg':'JPEG','.png':'PNG','.webp':'WEBP'}[Path(row['path']).suffix]
        if geometry['format']!=expected_format:raise ValueError('SOURCE_GEOMETRY')
        if row['id'] in ids or row['group'] in groups or row['decodedSha256'] in pixels or row['sha256'] in encoded or (row['promptGroup'] and row['promptGroup'] in prompts):raise ValueError('SOURCE_OR_CONTENT_OVERLAP')
        ids.add(row['id']);groups.add(row['group']);pixels.add(row['decodedSha256']);encoded.add(row['sha256'])
        if row['promptGroup']:prompts.add(row['promptGroup'])
        counts[row['role']][row['label']]+=1
        if root is not None:_verify_source_image(root,row)
    if counts!=quotas:raise ValueError('FROZEN_QUOTA')


def derived(image):
    square=ImageOps.fit(image,(256,256),method=Image.Resampling.LANCZOS,centering=(.5,.5));stream=io.BytesIO();square.save(stream,format='JPEG',quality=95,subsampling=2)
    raw=stream.getvalue()
    return Image.open(io.BytesIO(raw)).convert('RGB'),hashlib.sha256(raw).hexdigest()


def evaluate(kind,manifest,output):
    if output.exists():raise ValueError('OUTPUT_EXISTS')
    data=json.loads(manifest.read_bytes());validate(data,manifest.parent)
    if kind not in MODELS:raise ValueError('UNKNOWN_MODEL')
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
    model_spec=MODELS[kind]
    preprocessing=(dict(processor='CommunityForensics 384px',pipeline='RGB; resize short side 440; center crop 384; ImageNet normalization; sigmoid score')
                   if kind=='community' else dict(processor=type(processor).__name__,config={key:getattr(processor,key,None) for key in ('size','crop_size','resample','image_mean','image_std')},pipeline='Pillow EXIF transpose and RGB; pinned Hugging Face image processor; softmax class mapping from pinned checkpoint'))
    checkpoint=dict(modelId=model_spec['id'],revision=model_spec['revision'],file='model.safetensors',
                    bytes=model_spec['files']['model.safetensors'][0],sha256=model_spec['files']['model.safetensors'][2])
    for row in data['rows']:
        raw,image=_verify_source_image(manifest.parent,row)
        matched,matched_hash=derived(image)
        for variant,pixels,variant_hash in [('original',image,row['sha256']),('matched_square256_jpeg95',matched,matched_hash)]:
            before=time.perf_counter();inputs=tensor(pixels);trace=tensor_fingerprint(inputs)
            with torch.inference_mode():
                if kind=='community':score=torch.sigmoid(network(inputs)).item()
                else:score=torch.softmax(network(pixel_values=inputs).logits[0],dim=-1)[1 if kind=='dima' else 0].item()
            if not math.isfinite(score) or not 0<=score<=1:raise ValueError('NONFINITE_MODEL_OUTPUT')
            rows.append({k:row[k] for k in ['id','label','group','role','generator','sourceDataset','sha256','geometry']}|dict(variant=variant,derivedEncodedSha256=variant_hash,model=model_spec['id'],modelRevision=model_spec['revision'],checkpointSha256=checkpoint['sha256'],preprocessing=preprocessing,modelInput=trace,score=score,seconds=time.perf_counter()-before))
    splits={}
    for role in ['development','held_out']:
        splits[role]={variant:summarize([r for r in rows if r['role']==role and r['variant']==variant]) for variant in ['original','matched_square256_jpeg95']}
    stratified={generator:summarize([r for r in rows if r['generator']==generator and r['variant']=='original']) for generator in sorted({r['generator'] for r in rows})}
    memory=psutil.Process().memory_info();spec=MODELS[kind]
    report=dict(scope='Frozen external research comparison; incomplete source/identity/training independence, inherited format/resolution confounds. Not validated authenticity accuracy.',dataset=data['dataset'],datasetRevision=data['revision'],license=data['license'],model={k:v for k,v in spec.items() if k!='files'},checkpoint=checkpoint,preprocessing=preprocessing,weightsSha256=spec['files']['model.safetensors'][2],manifestSha256=hashlib.sha256(manifest.read_bytes()).hexdigest(),protocolSha256=data['protocolSha256'],startupMs=startup,elapsedMs=(time.perf_counter()-start)*1000,memory=dict(rssBytes=memory.rss,peakWorkingSetBytes=getattr(memory,'peak_wset',None)),splits=splits,perGenerator=stratified,authoritativePromotion=False,rows=rows,limitations=['No semantic category, face-manipulation or original-capture truth annotations; not invented.', 'Zero errors on small samples cannot certify low false-positive risk. Synthetic generator strata lack genuine negatives, so FPR/AUROC are undefined there.', 'The two derivations of an original are paired, not independent images. No threshold fitting or change to service quarantine.'])
    with output.open('x',encoding='utf8') as file:json.dump(report,file,indent=2)
    print(json.dumps({k:v for k,v in report.items() if k not in ['rows','limitations','perGenerator']}))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--model',choices=['community','dima','sdxl'],required=True);parser.add_argument('--manifest',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--worker',action='store_true',help=argparse.SUPPRESS);a=parser.parse_args()
    if a.worker:evaluate(a.model,a.manifest,a.output)
    else:
        if a.output.exists():raise ValueError('OUTPUT_EXISTS')
        code,out=supervised_command([sys.executable,'-m','ai_service.evaluate_media_images','--worker','--model',a.model,'--manifest',str(a.manifest),'--output',str(a.output)],timeout_seconds=600);print(out);raise SystemExit(code)
