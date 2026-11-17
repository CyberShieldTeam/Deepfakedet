"""Authored regression observations, explicitly separate from independent benchmarks."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
from ai_service.research_models import ResearchModel, MODELS
from ai_service.evaluate_nli import supervised_command
from ai_service.claim_nli import NliModel, MODEL_ID, REVISION, memory


def evaluate(kind, snapshot, output):
    if output.exists():raise ValueError('OUTPUT_EXISTS')
    fixture=Path('test/fixtures/claims/hard_cases.json').read_bytes();data=json.loads(fixture)
    model=NliModel(snapshot) if kind=='minilm' else ResearchModel(snapshot,'deberta')
    rows=[]
    for row in data['rows']:
        if kind=='minilm':prediction=model.predict([dict(premise=row['premise'],hypothesis=row['claim'],language='en')])[0]
        else:
            prediction=model.pair(row['premise'],row['claim'])
            if prediction['status']=='executed':prediction['scores']=dict(zip(['contradiction','entailment','neutral'],prediction.pop('values')))
        if prediction['status']=='executed':
            ordered=sorted(prediction['scores'].items(),key=lambda p:p[1],reverse=True)
            prediction.update(argmax=ordered[0][0],accepted=ordered[0][1]>=.9 and ordered[0][1]-ordered[1][1]>=.5)
        rows.append(dict(id=row['id'],expected=row['expected'],**prediction))
    identity=dict(id=MODEL_ID,revision=REVISION) if kind=='minilm' else {k:v for k,v in MODELS['deberta'].items() if k!='files'}
    report=dict(scope=data['scope'],fixtureSha256=hashlib.sha256(fixture).hexdigest(),model=identity,startupMs=model.startup_ms,memory=memory(),rows=rows,authoritativePromotion=False)
    with output.open('x',encoding='utf8') as file:json.dump(report,file,indent=2)
    print(json.dumps({'model':kind,'executed':sum(r['status']=='executed' for r in rows),'authoredArgmaxMatches':sum(r.get('argmax')==r['expected'] for r in rows),'total':len(rows),'scope':data['scope']}))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--kind',choices=['minilm','deberta'],required=True);parser.add_argument('--snapshot',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--worker',action='store_true',help=argparse.SUPPRESS);args=parser.parse_args()
    if args.worker:evaluate(args.kind,args.snapshot,args.output)
    else:
        if args.output.exists():raise ValueError('OUTPUT_EXISTS')
        code,text=supervised_command([sys.executable,'-m','ai_service.evaluate_claim_hard_cases','--worker','--kind',args.kind,'--snapshot',str(args.snapshot),'--output',str(args.output)],timeout_seconds=120);print(text);raise SystemExit(code)
