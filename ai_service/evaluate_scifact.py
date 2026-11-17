"""Document relevance only; no clinical/factual conclusion from benchmark labels."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import statistics
import sys
from ai_service.research_models import ResearchModel, MODELS
from ai_service.evaluate_nli import supervised_command
from ai_service.claim_nli import memory


def measure(order, judgments, k):
    relevant = sum(v>0 for v in judgments.values())
    dcg = lambda values: sum((2**v-1)/math.log2(i+2) for i,v in enumerate(values[:k]))
    ideal = dcg(sorted(judgments.values(), reverse=True))
    first = next((i for i,d in enumerate(order) if judgments.get(d,0)>0), None)
    return dict(recall=sum(judgments.get(d,0)>0 for d in order[:k])/relevant if relevant else None, mrr=1/(first+1) if first is not None else 0, ndcg=dcg([judgments.get(d,0) for d in order])/ideal if ideal else None)


def evaluate(manifest, snapshot, output):
    if output.exists():
        raise ValueError('OUTPUT_EXISTS')
    raw=manifest.read_bytes();data=json.loads(raw)
    protocol=Path('test/fixtures/claims/scifact_protocol.json').read_bytes()
    if data['protocolSha256']!=hashlib.sha256(protocol).hexdigest() or len(data['rows'])!=60:
        raise ValueError('FROZEN_PROTOCOL_MISMATCH')
    model=ResearchModel(snapshot,'reranker');rows=[];times=[]
    for row in data['rows']:
        predictions=[]
        for item in row['items']:
            if hashlib.sha256(item['text'].encode()).hexdigest()!=item['passageSha256']:
                raise ValueError('PASSAGE_HASH_MISMATCH')
            prediction=model.pair(row['claim'],item['text'])
            if prediction['status']=='executed':times.append(prediction['elapsedMs'])
            predictions.append(dict(id=item['id'],passageSha256=item['passageSha256'],**prediction))
        complete=all(p['status']=='executed' for p in predictions)
        baseline=[p['id'] for p in predictions]
        reranked=[p['id'] for p in sorted(predictions,key=lambda p:p['values'][0],reverse=True)] if complete else baseline
        rows.append(dict(id=row['id'],role=row['role'],claimSha256=hashlib.sha256(row['claim'].encode()).hexdigest(),judgments=row['judgments'],baselineMs=row['baselineMs'],complete=complete,predictions=predictions,baseline={k:measure(baseline,row['judgments'],k) for k in [1,3,6]},reranked={k:measure(reranked,row['judgments'],k) for k in [1,3,6]}))
    splits={}
    for role in ['development','validation','held_out']:
        part=[r for r in rows if r['role']==role]
        splits[role]=dict(queries=len(part),complete=len([r for r in part if r['complete']]),**{method:{k:{metric:statistics.mean(r[method][k][metric] for r in part) for metric in ['recall','mrr','ndcg']} for k in [1,3,6]} for method in ['baseline','reranked']})
    val=splits['validation'];gate=val['reranked'][1]['mrr']>val['baseline'][1]['mrr'] and val['reranked'][3]['ndcg']>val['baseline'][3]['ndcg'] and val['reranked'][6]['recall']==val['baseline'][6]['recall']
    result=dict(scope='External SciFact scientific abstract/document relevance using standard BEIR qrels; not general passage relevance, factual/clinical truth or NLI accuracy',source=data['source'],license=data['license'],archiveSha256=data['archiveSha256'],manifestSha256=hashlib.sha256(raw).hexdigest(),protocolSha256=data['protocolSha256'],model={k:v for k,v in MODELS['reranker'].items() if k!='files'},startupMs=model.startup_ms,memory=memory(),latencyMs=dict(median=statistics.median(times),p95=sorted(times)[math.ceil(.95*len(times))-1]),validationGatePassed=gate,authoritativeStancePromotion=False,splits=splits,rows=rows,limitations=['Queries selected from BEIR test qrels (original SciFact public labelled development), not original blind test.', 'Unjudged documents count as zero only for standard benchmark metrics; this is not proof of irrelevance.', 'Full retrieval corpus shared intentionally; gold source groups and near-claim variants separated. Topic/undisclosed training overlap unknown.', 'Any over-limit candidate retains whole-query baseline order; no silent truncation. Small English scientific sample cannot validate Wikipedia/news/Hindi/Telugu.'])
    with output.open('x',encoding='utf8') as file:json.dump(result,file,indent=2)
    print(json.dumps({k:v for k,v in result.items() if k not in ['rows','limitations']}))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--manifest',type=Path,required=True);parser.add_argument('--snapshot',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--worker',action='store_true',help=argparse.SUPPRESS);args=parser.parse_args()
    if args.worker:evaluate(args.manifest,args.snapshot,args.output)
    else:
        if args.output.exists():raise ValueError('OUTPUT_EXISTS')
        code,output=supervised_command([sys.executable,'-m','ai_service.evaluate_scifact','--worker','--manifest',str(args.manifest),'--snapshot',str(args.snapshot),'--output',str(args.output)]);print(output);raise SystemExit(code)
