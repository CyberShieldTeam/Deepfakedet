"""Fresh-process startup versus persistent CPU inference. Fixed fictional controls only."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import time
import urllib.request

def get_health():
    with urllib.request.urlopen('http://127.0.0.1:8021/health',timeout=2) as response:
        return json.load(response)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--evaluation-output',required=True)
    args=parser.parse_args()
    if Path(args.output).exists() or Path(args.evaluation_output).exists():raise ValueError('Never overwrite history')
    runs=[]
    for index in range(2):
        env=dict(os.environ,VERITAS_CLAIM_EMBEDDING_PATH=str(Path(args.snapshot).resolve()))
        log=Path(args.output+f'.worker{index}.log')
        with log.open('x',encoding='utf-8') as stream:
            started=time.perf_counter()
            process=subprocess.Popen([sys.executable,'-m','uvicorn','ai_service.claim_embedding:app','--host','127.0.0.1','--port','8021'],
                env=env,stdout=stream,stderr=stream)
            try:
                while True:
                    if process.poll() is not None:raise RuntimeError('Worker exited; inspect '+str(log))
                    if time.perf_counter()-started>180:raise TimeoutError('Startup exceeded 180s profiling budget')
                    try:
                        health=get_health()
                        if health['status']!='ready':raise RuntimeError('Worker not ready: '+health['error'])
                        break
                    except (OSError,TimeoutError):time.sleep(.1)
                ready_wall=time.perf_counter()-started
                body=dict(modelId=health['modelId'],version=health['version'],texts=['query: fictional museum entry','passage: Software fixture. The fictional museum has free entry.'])
                measurements=[]
                reference=None
                for repeat in range(4):
                    tick=time.perf_counter()
                    request=urllib.request.Request('http://127.0.0.1:8021/v1/embedding',data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
                    with urllib.request.urlopen(request,timeout=20) as response:result=json.load(response)
                    wall=time.perf_counter()-tick
                    if reference is None:reference=result['embeddings']
                    if result['embeddings']!=reference:raise ValueError('Repeated inference changed fixed-control vectors')
                    measurements.append(dict(repeat=repeat,wallSeconds=wall,serviceSeconds=result['elapsedSeconds']))
                if index==0:
                    env.update(VERITAS_EMBEDDING_ENDPOINT='http://127.0.0.1:8021/v1/embedding',VERITAS_EMBEDDING_MODEL_ID=health['modelId'],
                        VERITAS_EMBEDDING_VERSION=health['version'],VERITAS_CLAIM_EMBEDDING_FORMAT='e5')
                    subprocess.run(['node','node_modules/tsx/dist/cli.mjs','test/evaluateClaimReadiness.ts',args.evaluation_output],env=env,check=True,timeout=90)
                runs.append(dict(processIndex=index,processToReadySeconds=ready_wall,startup=get_health(),directInference=measurements,
                    repeatedVectorsIdentical=True))
            finally:
                process.terminate()
                try:process.wait(timeout=5)
                except subprocess.TimeoutExpired:process.kill();process.wait(timeout=5)
    code={name:hashlib.sha256(Path(name).read_bytes()).hexdigest() for name in
        ('ai_service/claim_embedding.py','ai_service/profile_claim_runtime.py','server/inference.ts')}
    report=dict(scope='software_controls_runtime_not_factual_benchmark',python=platform.python_version(),code=code,runs=runs,
        limitations=['Two fresh processes with existing local files; OS/file caches were not flushed. Not a true disk-cold benchmark.',
        'Historical 70.789s excluded pre-lifespan process startup and embedding computation; its internal stage breakdown was not recorded.',
        'checkpoint_and_model_initialization includes architecture construction, file loading and eval setup; these are not separately measured.',
        'processToReady includes interpreter/uvicorn/module/import/load/polling; startup phase timings are nested components, not extra durations.',
        'No inference configuration or weights changed. Repeat equality only verifies these fixed controls.'])
    with Path(args.output).open('x',encoding='utf-8') as file:json.dump(report,file,indent=2,allow_nan=False)
    print(json.dumps(dict(output=args.output,startups=[r['processToReadySeconds'] for r in runs])))

if __name__=='__main__':main()
