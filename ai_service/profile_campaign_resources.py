"""Bounded separate-process campaign CPU/RSS profiling; no model or external dataset."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import time
import psutil

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',required=True);args=parser.parse_args()
    target=Path(args.output)
    if target.exists():raise ValueError('Refusing existing report')
    runs=[]
    for scenario in ('sparse3000','dense3000'):
        for algorithm in ('baseline','episodes'):
            child=target.with_name(target.stem+'_'+scenario+'_'+algorithm+'.json')
            if child.exists():raise ValueError('Refusing existing child report')
            with Path(str(child)+'.log').open('x',encoding='utf-8') as log:
                start=time.perf_counter()
                process=subprocess.Popen(['node','--max-old-space-size=1024','node_modules/tsx/dist/cli.mjs','test/evaluateCampaignEpisodes.ts',str(child),scenario,algorithm],stdout=log,stderr=log)
                peak=0
                try:
                    while process.poll() is None:
                        try:
                            parent=psutil.Process(process.pid)
                            memory=0
                            for child_process in [parent,*parent.children(recursive=True)]:
                                try:memory+=child_process.memory_info().rss
                                except psutil.Error:pass
                            peak=max(peak,memory)
                        except psutil.Error:pass
                        if time.perf_counter()-start>60:raise TimeoutError('Campaign resource run exceeded 60s supervisor budget')
                        time.sleep(.02)
                    if process.returncode:raise RuntimeError('Campaign run failed: '+str(child))
                    runs.append(dict(scenario=scenario,algorithm=algorithm,childReport=str(child),wallSeconds=time.perf_counter()-start,sampledPeakTreeRssBytes=peak,samplingIntervalSeconds=.02))
                finally:
                    if process.poll() is None:
                        process.terminate()
                        try:process.wait(timeout=5)
                        except subprocess.TimeoutExpired:process.kill();process.wait(timeout=5)
    with target.open('x',encoding='utf-8') as file:json.dump(dict(scope='authored_resource_controls_not_accuracy',profilerSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),runs=runs,limitations=['20ms sampled process-tree RSS includes launcher and all descendant workers; can miss instantaneous peaks.','Separate fresh processes; OS caches were not flushed. No concurrency/SLA claim.']),file,indent=2)
    print(json.dumps(runs))
if __name__=='__main__':main()
