"""Offline cached E5 diagnostic comparisons, with an owned subprocess resource supervisor."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import time
import psutil
from ai_service.profile_campaign_resources import terminate_tree

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--input',required=True);p.add_argument('--output',required=True);p.add_argument('--child',action='store_true');args=p.parse_args()
    target=Path(args.output)
    if target.exists():raise ValueError('Refusing existing report')
    if args.child:
        start=time.perf_counter()
        from ai_service.claim_embedding import Encoder,MODEL_ID,REVISION
        encoder=Encoder('.model-cache/multilingual-e5-small');startup=time.perf_counter()-start
        data=json.loads(Path(args.input).read_text(encoding='utf-8'))
        texts=[text for pair in data['pairs'] for text in (pair['left'],pair['right'])]
        tick=time.perf_counter();vectors=encoder.encode(['query: '+t for t in texts]);latency=time.perf_counter()-tick
        for i,pair in enumerate(data['pairs']):
            cosine=sum(a*b for a,b in zip(vectors[i*2],vectors[i*2+1]));pair['semanticCosine']=cosine;pair['hybridDiagnostic']=.5*pair['lexicalJaccard']+.5*cosine
        report={**data,'modelId':MODEL_ID,'revision':REVISION,'format':'query/query','startupSeconds':startup,'startupStages':encoder.startup_timings,'batchInferenceSeconds':latency,'dimensions':len(vectors[0]),'precision':None,'recall':None,'f1':None,'falsePositiveRate':None,'independentCampaigns':0,'usedForAdmissions':False}
        with target.open('x',encoding='utf-8') as file:json.dump(report,file,ensure_ascii=False,indent=2)
        return
    raw=target.with_name(target.stem+'_scores.json')
    if raw.exists():raise ValueError('Refusing existing score report')
    start=time.perf_counter();peak=0;cpu_by_pid={};status='completed'
    with Path(str(raw)+'.log').open('x',encoding='utf-8') as log:
        child=subprocess.Popen([sys.executable,'-m','ai_service.evaluate_campaign_semantics','--child','--input',args.input,'--output',str(raw)],stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        try:
            while child.poll() is None:
                try:
                    parent=psutil.Process(child.pid);rss=0
                    for process in [parent,*parent.children(recursive=True)]:
                        try:
                            rss+=process.memory_info().rss;t=process.cpu_times();cpu_by_pid[(process.pid,process.create_time())]=t.user+t.system
                        except psutil.Error:pass
                    peak=max(peak,rss)
                except psutil.Error:pass
                if peak>2*2**30:status='rss_limit';break
                if time.perf_counter()-start>180:status='timeout';break
                time.sleep(.02)
        finally:
            if child.poll() is None:terminate_tree(child)
    report={'scope':'authored_semantic_diagnostics_not_accuracy','status':status,'exitCode':child.returncode,'scoreReport':str(raw),'wallSeconds':time.perf_counter()-start,'sampledPeakTreeRssBytes':peak,'sampledTreeCpuSeconds':sum(cpu_by_pid.values()),'caps':{'wallSeconds':180,'treeRssMiB':2048,'samplingMs':20},'networkDownloads':False,'limitations':['Authored language examples, not independent association/coordination labels.','Diagnostic hybrid coefficients are not calibrated for campaign decisions.','Sampled process-tree memory can miss short peaks.']}
    with target.open('x',encoding='utf-8') as file:json.dump(report,file,indent=2)
    if status!='completed' or child.returncode:raise RuntimeError('Semantic diagnostic failed; inspect retained report/log')
if __name__=='__main__':main()
