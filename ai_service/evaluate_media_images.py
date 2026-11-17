"""Frozen external image comparison, exact tensors, no model promotion or fitting."""
import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
import os
import platform
from pathlib import Path
import statistics
import sys
import time
from PIL import Image,ImageOps
from ai_service.media_model_registry import MODELS,cached_snapshot,tensor_fingerprint
from ai_service.evaluate_nli import supervised_command
from ai_service.image_benchmark import summarize
from ai_service.media_image_manifest import ADMISSION_POLICY,admission_policy_sha256,validate_media_image_manifest
from ai_service.prepare_media_image_evaluation import DATASET,REVISION,LICENSE

PROTOCOL=Path('test/fixtures/engine1_image_protocol.json')
BASE_PREPROCESSING={
    'decode': {'library':'Pillow', 'orientation':'EXIF transpose', 'mode':'RGB',
               'alpha':'discarded; no background composite'},
    'variants': {
        'original': {'operation':'no additional file transform'},
        'matched_square256_jpeg95': {'operation':'center crop to square, Lanczos resize, JPEG encode/decode',
                                     'size':[256,256], 'quality':95, 'subsampling':2},
    },
}


def validate(manifest,root):
    protocol_bytes=PROTOCOL.read_bytes();protocol=json.loads(protocol_bytes)
    return validate_media_image_manifest(manifest,root,protocol,protocol_bytes,DATASET,REVISION,LICENSE)


def derived(image):
    square=ImageOps.fit(image,(256,256),method=Image.Resampling.LANCZOS,centering=(.5,.5));stream=io.BytesIO();square.save(stream,format='JPEG',quality=95,subsampling=2)
    raw=stream.getvalue()
    return Image.open(io.BytesIO(raw)).convert('RGB'),hashlib.sha256(raw).hexdigest()


def evaluate(kind,manifest,output):
    if output.exists():raise ValueError('OUTPUT_EXISTS')
    spec=MODELS[kind]
    data=json.loads(manifest.read_bytes());validated_rows=validate(data,manifest.parent)
    protocol=json.loads(PROTOCOL.read_bytes())
    import psutil
    if psutil.virtual_memory().available<2*2**30:raise RuntimeError('INSUFFICIENT_MEMORY_HEADROOM')
    started_at=datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
    preprocessing_sha=hashlib.sha256(json.dumps(BASE_PREPROCESSING,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    start=time.perf_counter();snapshot=cached_snapshot(kind)
    import torch
    torch.set_num_threads(4)
    if kind=='community':
        from ai_service.community_model import load
        network,processor=load()
        model_preprocessing={'implementation':'torchvision.Compose','steps':['Resize(440)','CenterCrop(384)','ToTensor()','Normalize(mean=[0.485,0.456,0.406],std=[0.229,0.224,0.225])']}
        tensor=lambda image:processor(image).unsqueeze(0)
    else:
        from transformers import AutoModelForImageClassification,AutoImageProcessor
        processor=AutoImageProcessor.from_pretrained(snapshot,local_files_only=True,trust_remote_code=False,use_fast=False)
        model_preprocessing=processor.to_dict()
        network=AutoModelForImageClassification.from_pretrained(snapshot,local_files_only=True,trust_remote_code=False,use_safetensors=True).eval()
        labels={0:'REAL',1:'FAKE'} if kind=='dima' else {0:'artificial',1:'human'}
        if network.config.id2label!=labels:raise ValueError('LABEL_ORDER')
        tensor=lambda image:processor(images=image,return_tensors='pt')['pixel_values']
    model_preprocessing_sha=hashlib.sha256(json.dumps(model_preprocessing,sort_keys=True,separators=(',',':'),default=str).encode()).hexdigest()
    startup=(time.perf_counter()-start)*1000;rows=[]
    for row in validated_rows:
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
            inference_at=datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
            before=time.perf_counter();inputs=tensor(pixels);trace=tensor_fingerprint(inputs)
            with torch.inference_mode():
                if kind=='community':score=torch.sigmoid(network(inputs)).item()
                else:score=torch.softmax(network(pixel_values=inputs).logits[0],dim=-1)[1 if kind=='dima' else 0].item()
            if not __import__('math').isfinite(score) or not 0<=score<=1:raise ValueError('NONFINITE_MODEL_OUTPUT')
            model_pixels_sha=hashlib.sha256(pixels.tobytes()).hexdigest()
            rows.append({
                'id':row['id'],'sampleId':row['id'],'dataset':data['dataset'],'datasetRevision':data['revision'],
                'source':row['source'],'sourceDataset':row['sourceDataset'],'publisherImageName':row['publisherImageName'],
                'label':row['label'],'labelBasis':row['labelBasis'],'partition':row['role'],'role':row['role'],
                'group':row['group'],'sourceGroup':row['group'],'generator':row['generator'],'geometry':row['geometry'],
                'originalSha256':row['sha256'],'sha256':row['sha256'],'decodedOriginalSha256':row['decodedSha256'],
                'variant':variant,'preprocessingVariant':variant,'derivedEncodedSha256':variant_hash,
                'modelPixelsSha256':model_pixels_sha,'preprocessingConfigSha256':preprocessing_sha,
                'modelIdentifier':spec['id'],'modelRevision':spec['revision'],
                'checkpointSha256':spec['files']['model.safetensors'][2],
                'modelPreprocessingSha256':model_preprocessing_sha,
                'inferenceTimestamp':inference_at,
                'prediction':'synthetic_screen_positive' if score>=.5 else 'synthetic_screen_negative',
                'rawScore':score,'score':score,'modelInput':trace,'seconds':time.perf_counter()-before,
            })
    splits={}
    for role in ['development','held_out']:
        splits[role]={variant:summarize([r for r in rows if r['role']==role and r['variant']==variant]) for variant in ['original','matched_square256_jpeg95']}
    stratified={generator:summarize([r for r in rows if r['generator']==generator and r['variant']=='original']) for generator in sorted({r['generator'] for r in rows})}
    memory=psutil.Process().memory_info();spec=MODELS[kind]
    report=dict(schemaVersion=2,scope='Frozen external research comparison; incomplete source/identity/training independence, inherited format/resolution confounds. Not validated authenticity accuracy.',dataset=data['dataset'],datasetRevision=data['revision'],license=data['license'],model={k:v for k,v in spec.items() if k!='files'},modelArtifactPins=spec['files'],weightsSha256=spec['files']['model.safetensors'][2],manifestSha256=hashlib.sha256(manifest.read_bytes()).hexdigest(),protocolVersion=protocol['version'],protocolSha256=data['protocolSha256'],admissionPolicy=ADMISSION_POLICY,admissionPolicySha256=admission_policy_sha256(),preprocessing=BASE_PREPROCESSING,preprocessingSha256=preprocessing_sha,modelPreprocessing=model_preprocessing,modelPreprocessingSha256=model_preprocessing_sha,startedAt=started_at,finishedAt=datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z'),runtime=dict(python=platform.python_version(),platform=platform.platform(),cpuCount=os.cpu_count(),torch=str(torch.__version__),cudaAvailable=torch.cuda.is_available(),cudaDevice=torch.cuda.get_device_name(0) if torch.cuda.is_available() else None),startupMs=startup,elapsedMs=(time.perf_counter()-start)*1000,memory=dict(rssBytes=memory.rss,peakWorkingSetBytes=getattr(memory,'peak_wset',None)),splits=splits,perGenerator=stratified,authoritativePromotion=False,rows=rows,limitations=['No semantic category, face-manipulation or original-capture truth annotations; not invented.', 'Zero errors on small samples cannot certify low false-positive risk. Synthetic generator strata lack genuine negatives, so FPR/AUROC are undefined there.', 'The two derivations of an original are paired, not independent images. No threshold fitting or change to service quarantine.'])
    with output.open('x',encoding='utf8') as file:json.dump(report,file,indent=2)
    print(json.dumps({k:v for k,v in report.items() if k not in ['rows','limitations','perGenerator']}))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--model',choices=['community','dima','sdxl'],required=True);parser.add_argument('--manifest',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--worker',action='store_true',help=argparse.SUPPRESS);a=parser.parse_args()
    if a.worker:evaluate(a.model,a.manifest,a.output)
    else:
        if a.output.exists():raise ValueError('OUTPUT_EXISTS')
        code,out=supervised_command([sys.executable,'-m','ai_service.evaluate_media_images','--worker','--model',a.model,'--manifest',str(a.manifest),'--output',str(a.output)],timeout_seconds=600);print(out);raise SystemExit(code)
