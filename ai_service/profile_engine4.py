"""Owned-process Engine4 resource controls, 30s/900MiB reactive caps, no models or network."""
import argparse
import json
from pathlib import Path
import subprocess
import time
import psutil
from ai_service.profile_campaign_resources import terminate_tree

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',required=True);args=parser.parse_args();target=Path(args.output)
    if target.exists():raise ValueError('Refusing existing report')
    results=[]
    for scenario in ('small','medium','dense','partial'):
        output=target.with_name(target.stem+'_'+scenario+'.json')
        if output.exists():raise ValueError('Refusing existing child report')
        with Path(str(output)+'.log').open('x',encoding='utf-8') as log:
            start=time.perf_counter();process=subprocess.Popen(['node','--max-old-space-size=768','--import','tsx','test/profileEngine4.ts',str(output),scenario],stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0));peak=0;status='completed'
            try:
                while process.poll() is None:
                    try:
                        parent=psutil.Process(process.pid);rss=0
                        for p in [parent,*parent.children(recursive=True)]:
                            try:rss+=p.memory_info().rss
                            except psutil.Error:pass
                        peak=max(peak,rss)
                    except psutil.Error:pass
                    if peak>900*2**20:status='rss_limit';break
                    if time.perf_counter()-start>30:status='timeout';break
                    time.sleep(.02)
            finally:
                if process.poll() is None:terminate_tree(process)
            record={'scenario':scenario,'status':status,'exitCode':process.returncode,'sampledPeakTreeRssBytes':peak,'wallSeconds':time.perf_counter()-start,'result':json.loads(output.read_text()) if output.exists() else None};results.append(record)
            print(json.dumps({k:record[k] for k in ('scenario','status','sampledPeakTreeRssBytes')}),flush=True)
            if status!='completed' or process.returncode:break
    with target.open('x',encoding='utf-8') as file:json.dump({'scope':'authored_engine4_resources_not_accuracy','samplingMs':20,'workerOldSpaceMiB':512,'supervisorRssMiB':900,'supervisorSeconds':30,'results':results,'limitations':['Process RSS includes worker threads, loader, startup, preview build and two worker runs.','Reactive sampled cutoff is not an OS total-memory reservation and may miss short peaks.','Synthetic controls establish no production scalability or detection accuracy.']},file,indent=2)
    if len(results)!=4 or any(r['status']!='completed' or r['exitCode'] for r in results):raise RuntimeError('Incomplete Engine4 profiling; inspect report/logs')
if __name__=='__main__':main()
