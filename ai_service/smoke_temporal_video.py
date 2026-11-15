"""Record software timing/memory on fixed transport clips, not detection accuracy."""
import argparse
import hashlib
import json
from pathlib import Path
import platform
import time
from collections import Counter
from ai_service.temporal_video import analyze_bytes


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    root=Path('test/fixtures/video')
    records=[]
    for name in ('test_pattern_3s.mp4','headshot_cc0_3s.mp4','test_pattern_with_tone_3s.mp4'):
        raw=(root/name).read_bytes()
        started=time.perf_counter()
        result=analyze_bytes(raw,.5)
        assert result['classification']=='INCONCLUSIVE' and result['decisionProbability'] is None
        assert result['status'] in ('measured','partial','insufficient_evidence'),result
        records.append(dict(file=name,sha256=hashlib.sha256(raw).hexdigest(),
          wallSeconds=time.perf_counter()-started,observations=dict(Counter(i['observation'] for i in result['intervals'])),
          result=result))
    import cv2
    import psutil
    report=dict(scope='software_transport_and_resource_measurements_not_accuracy',python=platform.python_version(),
                opencv=cv2.__version__,cpuLogical=psutil.cpu_count(),ramTotalBytes=psutil.virtual_memory().total,
                policy='No ground-truth deepfake labels or accuracy inferred. Reserved images untouched.',results=records)
    Path(args.output).write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps([dict(file=r['file'],wallSeconds=r['wallSeconds'],workerSeconds=r['result'].get('elapsedSeconds'),
                          peakMiB=r['result'].get('peakWorkingSetBytes',0)/2**20,observations=r['observations']) for r in records]))


if __name__=='__main__':main()
