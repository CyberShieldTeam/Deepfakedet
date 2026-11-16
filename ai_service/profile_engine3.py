"""Bounded workload matrix. Samples owned process-tree RSS and CPU; no datasets/models."""
import argparse
import json
import platform
from pathlib import Path
import subprocess
import time
import psutil
from ai_service.profile_campaign_resources import terminate_tree

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    target=Path(args.output)
    if target.exists():raise ValueError('Refusing existing report')
    results=[]
    cases=[(name,size,'episodes') for name in ('sparse','dense','popular_url','scheduled','multiple_episodes','multilingual','duplicates','missing_timestamps','large_component','incomplete_coverage') for size in (1000,3000)]
    cases += [(name,3000,'baseline') for name in ('sparse','dense')]
    cases += [('dense',size,'episodes') for size in (5000,10000)]
    for name,size,algorithm in cases:
        child=target.with_name(f'{target.stem}_{name}_{size}_{algorithm}.json')
        if child.exists():raise ValueError('Refusing existing child report')
        with Path(str(child)+'.log').open('x',encoding='utf-8') as log:
            start=time.perf_counter()
            process=subprocess.Popen(['node','--max-old-space-size=768','--import','tsx','test/engine3/resourceCase.ts',str(child),name,str(size),algorithm],stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            peak=0;cpu_by_pid={};status='completed'
            try:
                while process.poll() is None:
                    try:
                        parent=psutil.Process(process.pid);rss=0
                        for p in [parent,*parent.children(recursive=True)]:
                            try:
                                rss+=p.memory_info().rss
                                t=p.cpu_times();cpu_by_pid[(p.pid,p.create_time())]=t.user+t.system
                            except psutil.Error:pass
                        peak=max(peak,rss)
                    except psutil.Error:pass
                    if peak>900*2**20:status='rss_limit';break
                    if time.perf_counter()-start>30:status='timeout';break
                    time.sleep(.02)
            finally:
                if process.poll() is None:terminate_tree(process)
            wall=time.perf_counter()-start
            record={'name':name,'size':size,'algorithm':algorithm,'supervisorStatus':status,'exitCode':process.returncode,'wallSecondsIncludingStartupAndStabilityRepeat':wall,'sampledPeakTreeRssBytes':peak,'sampledTreeCpuSeconds':sum(cpu_by_pid.values()),'averageCpuCores':sum(cpu_by_pid.values())/wall,'samplingIntervalSeconds':.02}
            if child.exists():record['result']=json.loads(child.read_text())
            results.append(record)
            print(json.dumps({k:record[k] for k in ('name','size','algorithm','supervisorStatus','sampledPeakTreeRssBytes')}),flush=True)
            if status!='completed' or process.returncode:break
    report={'scope':'authored_resource_controls_not_accuracy','runtime':{'platform':platform.platform(),'python':platform.python_version(),'cpuCount':psutil.cpu_count(),'node':subprocess.check_output(['node','--version'],text=True).strip()},'caps':{'inputPosts':3000,'heapMiB':768,'sampledTreeRssMiB':900,'wallSecondsPerCase':30,'candidatePairs':200000,'retainedPairs':5000,'retainedWitnesses':20000},'results':results,'limitations':['20ms samples can miss short peaks and CPU at child exit.','CPU/RSS include startup and a second stability run; wallMs within result measures first analysis only.','5k/10k inputs are rejected before analysis; no scalability result above 3k.','Legacy baseline comparison runs current unchanged admission logic; not historical hardware replication.']}
    with target.open('x',encoding='utf-8') as file:json.dump(report,file,indent=2)
    if len(results)!=len(cases) or any(r['supervisorStatus']!='completed' or r['exitCode'] for r in results):raise RuntimeError('Incomplete resource matrix; inspect report')
if __name__=='__main__':main()
