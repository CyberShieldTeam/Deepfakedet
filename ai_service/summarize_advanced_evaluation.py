"""Public bounded verification summary; no credentials, case files or dataset passages."""
import hashlib
import json
from pathlib import Path
import random
import statistics


def paired_interval(values, seed=7017):
    rng=random.Random(seed);samples=[]
    for _ in range(5000):samples.append(statistics.mean(rng.choice(values) for _ in values))
    samples.sort()
    return dict(mean=statistics.mean(values),pairedQueryBootstrap95=[samples[124],samples[4874]],resamples=5000,seed=seed)


def summarize(output):
    if output.exists():raise ValueError('OUTPUT_EXISTS')
    read=lambda p:json.loads(Path(p).read_text(encoding='utf8'))
    sci=read('reports/engine2_scifact_reranker_v1.json');fever=read('reports/engine2_advanced_retrieval_reranked_v1.json')
    intervals={}
    for name,report,methods in [('scifact',sci,('baseline','reranked')),('fever_page_proxy',fever,('baseline','reranker'))]:
        rows=[r for r in report['rows'] if r['role']=='held_out']
        intervals[name]={metric:paired_interval([r[methods[1]][str(k)][metric]-r[methods[0]][str(k)][metric] for r in rows]) for metric,k in [('mrr',1),('ndcg',6)]}
    pointer=read('.model-cache/engine2-advanced/browser/latest.json');browser=read(pointer['path'])
    checks=[]
    for row in browser['checks']:
        result=row.get('result')
        saved={k:row[k] for k in ['id','scope','pass','openedUrl','domContentLoaded','publicationDateInvented','exactApiDiskReportParity','expectedDiagnostic','observedSuggestion','diagnosticMatch'] if k in row}
        if isinstance(result,dict):
            saved.update(claimStatus=result.get('verificationStatus'),sourceCount=len(result.get('sources',[])),reranking=result.get('retrievalDetails',{}).get('reranking'),nliStatuses=[n['status'] for n in result.get('nli',{}).get('relationships',[])])
            saved['sources']=[{k:s[k] for k in ['id','title','url','passageSha256','revisionId'] if k in s} for s in result.get('sources',[])]
        checks.append(saved)
    result=dict(scope='Software availability and small frozen research samples, not production factual accuracy',browserResult=browser['result'],browserAt=browser['at'],warmup=browser['warmup'],rerankerWarmup=browser.get('rerankerWarmup'),checks=checks,pairedUncertainty=intervals,uncertaintyLimitations=['Query bootstrap assumes independent sampled claim groups; ignores unknown topic/pretraining and candidate-corpus dependencies.', 'Small sample intervals are exploratory; all-sample results and negative development/held-out findings retained. No significance-based tuning or authoritative promotion.'],reportIdentities={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(Path('reports').glob('engine2_*v*.json'))})
    with output.open('x',encoding='utf8') as file:json.dump(result,file,indent=2)
    print(json.dumps({'browserResult':browser['result'],'checks':len(checks),'pairedUncertainty':intervals}))


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);summarize(parser.parse_args().output)
