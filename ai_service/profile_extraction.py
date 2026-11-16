"""Observed bounded OCR tree RSS including launcher/worker; preparation server measured separately."""
import json,subprocess,time,psutil
from pathlib import Path
from ai_service.profile_campaign_resources import terminate_tree
def main():
    target=Path('reports/engine41_extraction_resources.json')
    if target.exists():raise ValueError('Refusing existing resource report')
    start=time.perf_counter();peak=0
    process=subprocess.Popen(['node','--max-old-space-size=512','--import','tsx','test/extractionProfile.ts'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    try:
        while process.poll() is None:
            try:
                parent=psutil.Process(process.pid);total=0
                for child in [parent,*parent.children(recursive=True)]:
                    try:total+=child.memory_info().rss
                    except psutil.Error:pass
                peak=max(peak,total)
            except psutil.Error:pass
            if time.perf_counter()-start>45 or peak>1024*1024*1024:raise RuntimeError('Profiler wall/RSS supervisor budget exceeded')
            time.sleep(.02)
        out,err=process.communicate(timeout=5)
        if process.returncode:raise RuntimeError('OCR profile failed: '+err[:200])
        result=json.loads(out);result.update(sampledPeakOcrTreeRssBytes=peak,wallSeconds=time.perf_counter()-start,samplingIntervalSeconds=.02,limitations=['RSS sampled every 20ms; instantaneous peaks may be missed.','OCR process tree only; persistent Python preparation service and web server excluded.','512 MiB V8 old-space per OCR process is not a native/WASM hard memory guarantee.'])
        with target.open('x') as file:json.dump(result,file,indent=2)
        print(json.dumps(result))
    finally:
        if process.poll() is None:terminate_tree(process)
if __name__=='__main__':main()
