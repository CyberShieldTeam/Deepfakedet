"""Pinned relevance-only worker using the same bounded transport as NLI."""
import argparse
import json
from pathlib import Path
import sys
import time
from ai_service.research_models import ResearchModel, MODELS
from ai_service.claim_nli import memory


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--snapshot',type=Path,required=True);parser.add_argument('--worker',action='store_true',required=True);args=parser.parse_args()
    try:model=ResearchModel(args.snapshot,'reranker')
    except Exception as error:
        category=str(error) if str(error) in ['INSUFFICIENT_MEMORY_HEADROOM','PINNED_SIZE_MISMATCH','PINNED_HASH_MISMATCH'] else 'SNAPSHOT_MISSING' if isinstance(error,FileNotFoundError) else 'MODEL_LOAD_FAILED'
        print(json.dumps({'event':'unavailable','category':category}),flush=True);return 1
    print(json.dumps({'event':'ready','modelId':MODELS['reranker']['id'],'version':MODELS['reranker']['revision'],'startupMs':model.startup_ms,'memory':memory()}),flush=True)
    while True:
        line=sys.stdin.buffer.readline(65537)
        if not line:break
        if len(line)>65536 or not line.endswith(b'\n'):return 1
        request_id=None;start=time.perf_counter()
        try:
            request=json.loads(line)
            if set(request)!={'requestId','pairs'} or not isinstance(request['requestId'],str) or len(request['requestId'])>80 or not isinstance(request['pairs'],list) or not 1<=len(request['pairs'])<=8:raise ValueError('INVALID_REQUEST')
            request_id=request['requestId'];results=[]
            for pair in request['pairs']:
                if not isinstance(pair,dict) or set(pair)!={'premise','hypothesis','language'} or not all(isinstance(v,str) for v in pair.values()) or not 1<=len(pair['premise'])<=10000 or not 1<=len(pair['hypothesis'])<=1000:raise ValueError('INPUT_LIMIT')
                if pair['language']!='en':results.append({'status':'unsupported_language'});continue
                # Wire premise=source, hypothesis=claim. Relevance model expects claim FIRST.
                result=model.pair(pair['hypothesis'],pair['premise'])
                if result['status']=='executed':result['score']=result.pop('values')[0]
                results.append(result)
            reply={'requestId':request_id,'results':results,'elapsedMs':(time.perf_counter()-start)*1000,'memory':memory()}
        except Exception:reply={'requestId':request_id,'error':'INFERENCE_FAILED'}
        print(json.dumps(reply),flush=True)
        if 'request' in locals():del request
        if 'pair' in locals():del pair
        if 'result' in locals():del result
        if 'results' in locals():del results
        del line,reply
    return 0


if __name__=='__main__':raise SystemExit(main())
