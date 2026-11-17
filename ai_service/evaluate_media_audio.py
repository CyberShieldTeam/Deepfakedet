"""Actual AASIST research evaluation, scoped to a frozen single-voice sample."""
import argparse
import base64
from collections import defaultdict
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
import time
from ai_service.image_benchmark import summarize
from ai_service.evaluate_nli import supervised_command

PROTOCOL=Path('test/fixtures/engine1_audio_protocol.json')
sha=lambda data:hashlib.sha256(data).hexdigest()


def freeze(source,output):
    if output.exists():raise ValueError('OUTPUT_EXISTS')
    data=json.loads(source.read_bytes());protocol=json.loads(PROTOCOL.read_bytes())
    genuine=sorted([r for r in data['rows'] if r['label']=='genuine'],key=lambda r:sha((protocol['seed']+r['id']).encode()))
    selected=[];offset=0
    for role,quotas in protocol['roles'].items():
        for genuine_row in genuine[offset:offset+quotas['genuine']]:
            fake=[r for r in data['rows'] if r['id']==genuine_row['id'] and r['generator']==protocol['generatorByRole'][role]]
            if len(fake)!=1:raise ValueError('GENERATOR_PAIR_MISSING')
            for row in [genuine_row,fake[0]]:
                path=source.parent/row['path']
                if path.stat().st_size>2*1024*1024 or sha(path.read_bytes())!=row['sha256']:raise ValueError('SOURCE_INTEGRITY')
                selected.append(dict(row,role=role,group=sha(row['id'].encode())))
        offset+=quotas['genuine']
    result=dict(protocolSha256=sha(PROTOCOL.read_bytes()),sourceManifestSha256=sha(source.read_bytes()),sources=data['sourceVersions'],wholeArchiveHashesVerified=False,rows=selected)
    with output.open('x',encoding='utf8') as file:json.dump(result,file,ensure_ascii=False,indent=2)
    print(json.dumps({'frozenRecordings':len(selected),'protocolSha256':result['protocolSha256']}))


def eer(rows):
    rows=[r for r in rows if r.get('score') is not None];positive=[r['score'] for r in rows if r['label']=='synthetic'];negative=[r['score'] for r in rows if r['label']=='genuine']
    if not positive or not negative:return None
    previous=(0.,1.)
    for threshold in sorted({r['score'] for r in rows},reverse=True):
        fpr=sum(x>=threshold for x in negative)/len(negative);fnr=sum(x<threshold for x in positive)/len(positive)
        if fpr>=fnr:
            before=previous[0]-previous[1];after=fpr-fnr;weight=-before/(after-before) if after!=before else 0
            return previous[0]+weight*(fpr-previous[0])
        previous=(fpr,fnr)
    return 1.


def compressed(raw):
    import imageio_ffmpeg
    command=[imageio_ffmpeg.get_ffmpeg_exe(),'-nostdin','-hide_banner','-loglevel','error','-i','pipe:0','-t','12','-ac','1','-ar','16000','-b:a','64k','-fs','1048576','-f','mp3','pipe:1']
    result=subprocess.run(command,input=raw,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=20,check=False)
    if result.returncode or not 0<len(result.stdout)<=1048576:raise RuntimeError('COMPRESSION_FAILED')
    return result.stdout


def evaluate(manifest,output):
    if output.exists():raise ValueError('OUTPUT_EXISTS')
    protocol=json.loads(PROTOCOL.read_bytes());data=json.loads(manifest.read_bytes())
    if data['protocolSha256']!=sha(PROTOCOL.read_bytes()) or len(data['rows'])!=48:raise ValueError('FROZEN_PROTOCOL_OR_COUNT')
    groups={};digests=set()
    for row in data['rows']:
        if row['role'] not in protocol['roles'] or (row['group'] in groups and groups[row['group']]!=row['role']) or row['sha256'] in digests:raise ValueError('SOURCE_OR_DUPLICATE_OVERLAP')
        groups[row['group']]=row['role'];digests.add(row['sha256'])
    import os,psutil
    os.environ['VERITAS_AUDIO_MODEL_ENABLED']='1'
    from ai_service import audio_service
    start=time.perf_counter();audio_service.load_model();startup=(time.perf_counter()-start)*1000
    if audio_service.model is None:raise RuntimeError('AASIST_UNAVAILABLE')
    rows=[];segments=[]
    for row in data['rows']:
        path=(manifest.parent/row['path']).resolve()
        if not path.is_relative_to(manifest.parent.resolve()) or path.stat().st_size>2*1024*1024:raise ValueError('SOURCE_LIMIT')
        raw=path.read_bytes()
        if sha(raw)!=row['sha256']:raise ValueError('SOURCE_HASH')
        for variant,encoded in [('original',raw),('mp3_64k_16khz',compressed(raw))]:
            before=time.perf_counter();result=audio_service.analyze_audio(audio_service.AudioRequest(audio_base64=base64.b64encode(encoded).decode()))
            if result['classification']!='INCONCLUSIVE':raise ValueError('FORBIDDEN_VERDICT')
            if result['inputTrace']['sourceSha256']!=sha(encoded):raise ValueError('API_HASH_MISMATCH')
            actual=result['segments'];duration=sum(s['end_seconds']-s['start_seconds'] for s in actual)
            score=sum(s['raw_spoof_softmax']*(s['end_seconds']-s['start_seconds']) for s in actual)/duration if duration else None
            saved=dict(id=sha((row['id']+row['generator']).encode())[:24],group=row['group'],role=row['role'],label=row['label'],generator=row['generator'],sourceSha256=row['sha256'],variant=variant,derivedSha256=sha(encoded),score=score,seconds=time.perf_counter()-before,scoredDurationSeconds=duration,totalDurationSeconds=result['duration_seconds'],inputTrace=result['inputTrace'],segments=actual)
            rows.append(saved)
            for i,s in enumerate(actual):segments.append(dict(id=saved['id']+':'+str(i),group=row['group'],role=row['role'],label=row['label'],generator=row['generator'],variant=variant,score=s['raw_spoof_softmax']))
    splits={}
    for role in protocol['roles']:
        splits[role]={}
        for variant in protocol['variants']:
            recordings=[r for r in rows if r['role']==role and r['variant']==variant];parts=[r for r in segments if r['role']==role and r['variant']==variant]
            splits[role][variant]=dict(recordingResearchPolicy=summarize(recordings)|{'eerDescriptive':eer(recordings)},segments=summarize(parts)|{'eerDescriptive':eer(parts)})
    info=psutil.Process().memory_info()
    report=dict(scope='Frozen single-voice English research evaluation; not independent speaker/source population validation, calibrated confidence or production recording verdict',model=audio_service.MODEL_ID,revision=audio_service.MODEL_REVISION,weightsSha256=audio_service.WEIGHTS_SHA256,license='AASIST MIT; LJSpeech public domain; WaveFake CC BY-SA 4.0 with publisher attribution',protocol=protocol,manifestSha256=sha(manifest.read_bytes()),protocolSha256=data['protocolSha256'],startupMs=startup,elapsedMs=(time.perf_counter()-start)*1000,memory=dict(rssBytes=info.rss,peakWorkingSetBytes=getattr(info,'peak_wset',None)),splits=splits,authoritativePromotion=False,recordingPolicyDeployed=False,rows=rows)
    with output.open('x',encoding='utf8') as file:json.dump(report,file,indent=2)
    print(json.dumps({k:v for k,v in report.items() if k not in ['rows','protocol']}))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['freeze','evaluate']);parser.add_argument('--manifest',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--worker',action='store_true',help=argparse.SUPPRESS);a=parser.parse_args()
    if a.action=='freeze':freeze(a.manifest,a.output)
    elif a.worker:evaluate(a.manifest,a.output)
    else:
        if a.output.exists():raise ValueError('OUTPUT_EXISTS')
        code,out=supervised_command([sys.executable,'-m','ai_service.evaluate_media_audio','evaluate','--worker','--manifest',str(a.manifest),'--output',str(a.output)],timeout_seconds=600);print(out);raise SystemExit(code)
