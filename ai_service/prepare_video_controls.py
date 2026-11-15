"""Generate bounded procedural controls and provenance manifests; not a deepfake dataset."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

import cv2
import imageio_ffmpeg
import numpy as np


def digest(path):
    with Path(path).open('rb') as file:
        return hashlib.file_digest(file,'sha256').hexdigest()


def frame(condition,index,fps,width,height):
    rng=np.random.default_rng(101)
    base=cv2.GaussianBlur(rng.integers(40,216,(192,320,3),dtype=np.uint8),(5,5),0)
    other=cv2.GaussianBlur(np.random.default_rng(202).integers(40,216,(192,320,3),dtype=np.uint8),(5,5),0)
    t=index/fps
    if condition in ('camera_translation','fast_camera_translation'):
        speed=12 if condition=='camera_translation' else 120
        base=cv2.warpAffine(base,np.float32([[1,0,round(speed*t)],[0,1,0]]),(320,192),borderMode=cv2.BORDER_REFLECT)
    elif condition=='subject_motion':
        x=40+round(25*np.sin(t*2))
        base[64:112,x:x+48]=other[64:112,40:88]
    elif condition=='scene_cut' and t>=1.5:
        base=np.clip(other.astype(float)+80,0,255).astype('uint8')
    elif condition=='illumination':
        base=np.clip(base.astype(float)*(1+t*.15),0,255).astype('uint8')
    elif condition=='occlusion':
        x=round(30+t*55)
        base[40:144,x:x+40]=0
    elif condition=='local_patch_change' and 1<=t<2:
        base[72:120,136:184]=255
    if (width,height)!=(320,192):
        base=cv2.resize(base,(width,height),interpolation=cv2.INTER_LINEAR)
    return base


def encode(path,condition,fps,width,height,crf):
    executable=imageio_ffmpeg.get_ffmpeg_exe()
    command=[executable,'-nostdin','-hide_banner','-loglevel','error','-n','-f','rawvideo',
             '-pixel_format','bgr24','-video_size',f'{width}x{height}','-framerate',str(fps),'-i','pipe:0',
             '-an','-c:v','libx264','-threads','1','-preset','medium','-crf',str(crf),'-pix_fmt','yuv420p',str(path)]
    process=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    raw_hash=hashlib.sha256()
    try:
        for i in range(fps*3):
            raw=frame(condition,i,fps,width,height).tobytes()
            raw_hash.update(raw)
            process.stdin.write(raw)
        process.stdin.close()
        process.wait(timeout=20)
        if process.returncode:
            raise RuntimeError(process.stderr.read(1000).decode(errors='replace'))
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
        process.stderr.close()
    return raw_hash.hexdigest()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir',default='.model-cache/video-controls-v1')
    args=parser.parse_args()
    root=Path.cwd().resolve()
    out=(root/args.output_dir).resolve()
    if not out.is_relative_to(root/'.model-cache'):
        raise ValueError('Generated controls must remain inside the ignored model cache')
    out.mkdir(parents=True,exist_ok=True)
    if list(out.iterdir()):
        raise ValueError('Use a fresh output directory; existing artifacts are never overwritten')
    protocol='docs/TEMPORAL_EVALUATION_PROTOCOL.md'
    protocol_hash=digest(root/protocol)
    registry=dict(schema_version=1,datasets={'veritas-controls-v1':dict(status='approved',
        approved_cohorts=['software_control'],version='v1',license='Project-generated local software controls',
        approval_reference='User-authorized software-control validation slice, 2026-11-15',license_uri=protocol,
        evidence_path=protocol,evidence_sha256=protocol_hash,
        independent_ground_truth=False,source_identity_reviewed=True)})
    conditions=['static','camera_translation','subject_motion','scene_cut','illumination','occlusion',
                'local_patch_change','fast_camera_translation']
    rows=[]
    for fps in (8,24):
        configs=[(c,320,192,18,None) for c in conditions]
        configs += [('camera_translation',320,192,38,f'camera_translation_{fps}_320_crf18'),
                    ('camera_translation',640,384,18,f'camera_translation_{fps}_320_crf18')]
        for condition,width,height,crf,parent in configs:
            identity=f'{condition}_{fps}_{width}_crf{crf}'
            path=out/(identity+'.mp4')
            raw_hash=encode(path,condition,fps,width,height,crf)
            cap=cv2.VideoCapture(str(path))
            try:
                metadata=dict(fps=cap.get(cv2.CAP_PROP_FPS),width=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                    height=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),frames=int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
                    fourcc=int(cap.get(cv2.CAP_PROP_FOURCC)),frame_rate_mode='constant_verified')
            finally:
                cap.release()
            rows.append(dict(id=identity,task='video_temporal',path=path.relative_to(root).as_posix(),sha256=digest(path),
                dataset='veritas-controls-v1',dataset_version='v1',cohort='software_control',ground_truth='not_applicable',
                label_basis='Known procedural transformation, not camera capture or deepfake ground truth',
                label_reference=protocol,source='project://procedural-texture/seeds-101-202',license=registry['datasets']['veritas-controls-v1']['license'],
                license_uri=protocol,group='procedural-texture-101-202',source_ids=['texture:101','texture:202'],
                subject_ids=[],identity_status='not_applicable',split='development',parent_id=parent,
                contamination_status='reviewed_no_known_overlap',
                manipulation_type='none_deepfake_label_not_applicable',conditions=[condition],metadata=metadata,
                encoding=dict(container='mp4',codec='h264',pixel_format='yuv420p',encoder='libx264',crf=crf),
                generation=dict(seed=101,secondary_seed=202,duration_seconds=3,raw_frame_sha256=raw_hash),
                annotations=dict(status='software_generated',intervals=[[1,2]] if condition=='local_patch_change' else [])))
            print(identity,flush=True)
    manifest=dict(schema_version=1,task='video_temporal_diagnostics',evaluation_role='development',
                  protocol_sha256=protocol_hash,samples=rows)
    (out/'registry.json').write_text(json.dumps(registry,indent=2),encoding='utf-8')
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print(json.dumps(dict(videos=len(rows),manifest=str(out/'manifest.json'),ffmpeg=imageio_ffmpeg.get_ffmpeg_version())))


if __name__=='__main__':main()
