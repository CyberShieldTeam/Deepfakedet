"""Bounded CPU temporal observations. A worker deadline isolates native decoder stalls."""
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile
import time

MAX_PAIRS=24
WORKER_SECONDS=6
HARD_SECONDS=8
NOTE='Sparse endpoint comparisons only. Cuts, occlusion, lighting, compression and legitimate motion can explain changes. Not a deepfake classifier.'


def analyze_file(path, interval=1.0):
    import cv2
    from ai_service.temporal import analyze_pair
    from ai_service.image_benchmark import memory_usage
    cv2.setNumThreads(1)
    started=time.monotonic()
    if not math.isfinite(interval) or not .25<=interval<=60:
        raise ValueError('Temporal interval must be .25..60 seconds')
    if Path(path).stat().st_size>8*1024*1024:
        raise ValueError('Video exceeds temporal byte budget')
    cap=cv2.VideoCapture(str(path))
    intervals=[]
    sampled=0
    previous=None
    previous_index=0
    partial=False
    try:
        if not cap.isOpened():
            raise ValueError('Decoder unavailable')
        fps=cap.get(cv2.CAP_PROP_FPS)
        count=cap.get(cv2.CAP_PROP_FRAME_COUNT)
        width=cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        height=cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        if not all(math.isfinite(n) and n>0 for n in (fps,count,width,height)) or \
           count>3600 or width*height>1920*1080 or count/fps>120:
            raise ValueError('Video exceeds temporal metadata budget')
        count=int(count)
        duration=count/fps
        step=max(1,math.ceil(max(interval,duration/MAX_PAIRS)*fps))
        targets=set(range(0,count,step))
        targets.add(count-1)
        # A maximum of 25 sampled frames -> 24 comparisons, covering the source span.
        targets=sorted(targets)
        if len(targets)>MAX_PAIRS+1:
            targets=targets[:MAX_PAIRS]+[count-1]
        target_set=set(targets)
        for index in range(count):
            if time.monotonic()-started>WORKER_SECONDS:
                partial=True
                break
            if index not in target_set:
                if not cap.grab():
                    partial=True
                    break
                continue
            ok,bgr=cap.read()
            if not ok or bgr is None:
                partial=True
                break
            if bgr.shape[0]*bgr.shape[1]>1920*1080:
                raise ValueError('Decoded frame exceeds pixel budget')
            scale=min(1,480/max(bgr.shape[:2]))
            small=cv2.resize(bgr,(max(1,round(bgr.shape[1]*scale)),max(1,round(bgr.shape[0]*scale))),interpolation=cv2.INTER_AREA)
            sampled+=1
            if previous is not None:
                if previous.shape!=small.shape:
                    partial=True
                    break
                intervals.append(dict(startSeconds=round(previous_index/fps,4),endSeconds=round(index/fps,4),
                                      **analyze_pair(previous,small)))
            previous,previous_index=small,index
        memory=memory_usage()
        return dict(status='partial' if partial else 'measured' if len(intervals)>=2 else 'insufficient_evidence',
                    classification='INCONCLUSIVE',decisionProbability=None,method='bounded_farneback_v1',
                    requestedIntervalSeconds=interval,effectiveIntervalSeconds=round(step/fps,4),
                    sampledFrames=sampled,processedPairs=len(intervals),sourceFrameCount=count,
                    sourceFrameRate=fps,sourceWidth=int(width),sourceHeight=int(height),
                    sourceFourcc=int(cap.get(cv2.CAP_PROP_FOURCC)),
                    durationSeconds=round(duration,4),intervals=intervals,note=NOTE,
                    elapsedSeconds=round(time.monotonic()-started,4),
                    peakWorkingSetBytes=memory['peak_working_set_bytes'] if memory else None)
    finally:
        cap.release()


def analyze_bytes(raw,interval=1.0):
    if len(raw)>8*1024*1024 or not raw:
        raise ValueError('Video exceeds temporal byte budget')
    # The parent has validated the original container before invoking this worker.
    with tempfile.TemporaryDirectory(prefix='veritas-temporal-') as directory:
        path=Path(directory)/'source.video'
        path.write_bytes(raw)
        try:
            result=subprocess.run([sys.executable,'-m','ai_service.temporal_video',str(path),str(interval)],
                stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=HARD_SECONDS,check=False)
            if result.returncode or len(result.stdout)>200_000:
                raise ValueError('Temporal worker failed')
            return json.loads(result.stdout)
        except (subprocess.TimeoutExpired,ValueError,OSError,json.JSONDecodeError) as error:
            return dict(status='timed_out' if isinstance(error,subprocess.TimeoutExpired) else 'failed',
                        classification='INCONCLUSIVE',decisionProbability=None,method='bounded_farneback_v1',
                        intervals=[],sampledFrames=0,processedPairs=0,note=NOTE)


if __name__=='__main__':
    print(json.dumps(analyze_file(sys.argv[1],float(sys.argv[2])),allow_nan=False))
