"""Offline, development-only temporal evaluation using the existing bounded worker.

Admission is a reviewed operator registry plus verifiable file/metadata evidence, not
an automated legal or identity certification. Reserved/final roles are always refused.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import platform
import statistics
import subprocess
import time

from ai_service.evaluation_data import require_disjoint, verified_file
from ai_service.temporal_video import analyze_bytes, HARD_SECONDS, MAX_PAIRS

COHORTS={'software_control':{'not_applicable'},'camera_recording':{'authentic'},
         'independent_manipulation':{'manipulated','ai_generated'}}


def sha(path):
    with Path(path).open('rb') as file:
        return hashlib.file_digest(file,'sha256').hexdigest()


def load_manifest(manifest_path, root, registry_path):
    manifest=json.loads(Path(manifest_path).read_text(encoding='utf-8'))
    if manifest.get('task')!='video_temporal_diagnostics' or manifest.get('schema_version')!=1 or \
       manifest.get('evaluation_role')!='development':
        raise ValueError('Only development video manifests are allowed; reserved/final data remain sealed')
    registry=json.loads(Path(registry_path).read_text(encoding='utf-8'))
    if registry.get('schema_version')!=1:raise ValueError('Unknown operator registry schema')
    protocol_hash=manifest.get('protocol_sha256')
    if not isinstance(protocol_hash,str) or len(protocol_hash)!=64:
        raise ValueError('Reproducible protocol hash required')
    if manifest.get('protocol_path'):
        verified_file(root,manifest['protocol_path'],protocol_hash)
    rows=manifest.get('samples')
    if not isinstance(rows,list) or not rows:
        raise ValueError('Manifest must have samples')
    seen_ids=set()
    seen_hashes=set()
    prepared=[]
    for row in rows:
        fields=('id','path','sha256','dataset','dataset_version','cohort','ground_truth','label_basis',
                'label_reference','source','license','license_uri','group','identity_status','split','manipulation_type')
        if not isinstance(row,dict) or any(not isinstance(row.get(k),str) or not row[k].strip() for k in fields):
            raise ValueError('Incomplete provenance/label/lineage entry')
        if row.get('task')!='video_temporal' or row['split'] not in ('development','validation') or \
           row['ground_truth'] not in COHORTS.get(row['cohort'],set()):
            raise ValueError('Invalid cohort, ground truth, task or split')
        if row.get('contamination_status')!='reviewed_no_known_overlap':
            raise ValueError('Contaminated or unreviewed row')
        approval=registry.get('datasets',{}).get(row['dataset'],{})
        if approval.get('status')!='approved' or row['cohort'] not in approval.get('approved_cohorts',[]) or \
           approval.get('version')!=row['dataset_version'] or approval.get('license')!=row['license'] or \
           approval.get('license_uri')!=row['license_uri'] or \
           not approval.get('source_identity_reviewed') or not approval.get('approval_reference'):
            raise ValueError('Dataset not authorized or grouping/terms review incomplete')
        verified_file(root,approval.get('evidence_path',''),approval.get('evidence_sha256',''))
        if row['cohort']=='software_control' and approval.get('evidence_sha256')!=protocol_hash:
            raise ValueError('Control protocol does not match its authorization record')
        if row['cohort']!='software_control':
            if not manifest.get('protocol_path'):
                raise ValueError('Independent evaluation requires a verifiable protocol file')
            if approval.get('independent_ground_truth') is not True:
                raise ValueError('Independent ground truth not verified')
            for kind in ('label','grouping'):
                verified_file(root,approval.get(kind+'_evidence_path',''),approval.get(kind+'_evidence_sha256',''))
        if row['identity_status'] not in ('verified','not_applicable') or \
           not isinstance(row.get('subject_ids'),list) or not isinstance(row.get('source_ids'),list) or not row['source_ids']:
            raise ValueError('Source/identity grouping unverifiable')
        if row['identity_status']=='verified' and not row['subject_ids']:
            raise ValueError('Verified identity needs canonical subject IDs')
        if row['identity_status']=='not_applicable' and row['subject_ids']:
            raise ValueError('Identity status contradicts subject IDs')
        if any(not isinstance(v,str) or not v for v in row['source_ids']+row['subject_ids']):
            raise ValueError('Invalid lineage identifiers')
        if row['id'] in seen_ids or row['sha256'] in seen_hashes:
            raise ValueError('Duplicate ID or encoded video content')
        seen_ids.add(row['id']);seen_hashes.add(row['sha256'])
        meta=row.get('metadata',{})
        numbers=[meta.get(k) for k in ('fps','width','height','frames','fourcc')]
        if any(type(n) not in (int,float) or not math.isfinite(n) or n<=0 for n in numbers) or \
           any(type(meta[k]) is not int for k in ('width','height','frames','fourcc')) or \
           meta['frames']>3600 or meta['width']*meta['height']>1920*1080 or meta['frames']/meta['fps']>120 or \
           meta.get('frame_rate_mode')!='constant_verified':
            raise ValueError('Missing/unverifiable or unsupported video metadata')
        encoding=row.get('encoding',{})
        if any(not isinstance(encoding.get(k),str) or not encoding[k] for k in ('codec','container','pixel_format')):
            raise ValueError('Encoding provenance is incomplete')
        if not isinstance(row.get('conditions'),list) or not row['conditions'] or any(not isinstance(c,str) or not c for c in row['conditions']):
            raise ValueError('Conditions must be recorded, including unknown where appropriate')
        annotations=row.get('annotations',{})
        if annotations.get('status')=='independently_verified':
            if row['cohort']=='software_control' or annotations.get('complete_coverage') is not True or \
               not isinstance(annotations.get('reviewers'),list) or not annotations['reviewers'] or \
               any(not isinstance(v,str) or not v for v in annotations['reviewers']) or annotations.get('video_sha256')!=row['sha256']:
                raise ValueError('Independent annotations lack complete verified review')
            verified_file(root,annotations.get('evidence_path',''),annotations.get('evidence_sha256',''))
        elif annotations.get('status') not in ('none','software_generated'):
            raise ValueError('Unverifiable annotation status')
        for span in annotations.get('intervals',[]):
            if not isinstance(span,list) or len(span)!=2 or any(type(v) not in (int,float) or not math.isfinite(v) for v in span) or \
               not 0<=span[0]<span[1]<=meta['frames']/meta['fps']:
                raise ValueError('Invalid annotation interval')
        if row['split']=='development':
            path=verified_file(root,row['path'],row['sha256'],{'.mp4','.mov','.webm'},8*1024*1024)
            prepared.append((row,path))
    require_disjoint(rows)
    by_id={r['id']:r for r in rows}
    for row in rows:
        ancestors=set()
        cursor=row
        while cursor.get('parent_id'):
            if cursor['id'] in ancestors:
                raise ValueError('Cyclic derivative lineage')
            ancestors.add(cursor['id'])
            cursor=by_id.get(cursor['parent_id'],{})
        if row.get('parent_id'):
            parent=by_id.get(row['parent_id'])
            if not parent or parent['split']!=row['split'] or parent['group']!=row['group'] or \
               not set(parent['source_ids']).issubset(row['source_ids']):
                raise ValueError('Derivative parent missing or source lineage/split differs')
    return manifest,registry,prepared


def interval_metrics(predicted, annotated, eligible):
    if not eligible:
        return dict(precision=None,recall=None,reason='No independently verified complete temporal annotations')
    pairs=[]
    for i,a in enumerate(predicted):
        for j,b in enumerate(annotated):
            overlap=max(0,min(a[1],b[1])-max(a[0],b[0]))
            union=max(a[1],b[1])-min(a[0],b[0])
            if overlap/union>=.5:pairs.append((overlap/union,i,j))
    used_p=set();used_a=set()
    for _,i,j in sorted(pairs,reverse=True):
        if i not in used_p and j not in used_a:used_p.add(i);used_a.add(j)
    return dict(precision=len(used_p)/len(predicted) if predicted else None,
                recall=len(used_a)/len(annotated) if annotated else None,tp=len(used_p),
                fp=len(predicted)-len(used_p),fn=len(annotated)-len(used_a),iou_threshold=.5)


def summarize(items):
    valid=[i for i in items if i['complete']]
    minutes=sum(i['duration_seconds']/60 for i in valid)
    candidates=sum(i['candidate_count'] for i in valid)
    return dict(videos=len(items),complete_videos=len(valid),incomplete_videos=len(items)-len(valid),
                candidate_intervals=candidates if valid else None,source_minutes=minutes,
                candidates_per_source_minute=candidates/minutes if minutes else None)


def evaluate(manifest_path,root,registry_path,interval=.5):
    manifest,registry,prepared=load_manifest(manifest_path,root,registry_path)
    results=[]
    for row,path in prepared:
        if row['split']!='development':continue
        start=time.perf_counter()
        output=analyze_bytes(path.read_bytes(),interval)
        wall=time.perf_counter()-start
        if output['classification']!='INCONCLUSIVE' or output['decisionProbability'] is not None:
            raise ValueError('Forbidden authenticity result')
        if output['status'] not in ('timed_out','failed'):
            actual={'fps':output['sourceFrameRate'],'frames':output['sourceFrameCount'],
                    'width':output['sourceWidth'],'height':output['sourceHeight'],'fourcc':output['sourceFourcc']}
            if any(not math.isclose(row['metadata'][key],value,rel_tol=1e-5,abs_tol=1e-4) for key,value in actual.items()):
                raise ValueError('Decoder metadata disagrees with manifest: '+row['id'])
            fourcc=''.join(chr((int(actual['fourcc'])>>(8*i))&255) for i in range(4)).lower()
            codec={'avc1':'h264','h264':'h264','vp80':'vp8','vp90':'vp9','vp09':'vp9',
                   'hev1':'hevc','hvc1':'hevc','av01':'av1','mp4v':'mpeg4'}.get(fourcc)
            if codec!=row['encoding']['codec'].lower():
                raise ValueError('Codec claim unverified or disagrees with decoded FOURCC')
        spans=[[r['startSeconds'],r['endSeconds']] for r in output['intervals'] if r['observation']=='localized_change_candidate']
        item=dict(id=row['id'],sha256=row['sha256'],dataset=row['dataset'],cohort=row['cohort'],
            ground_truth=row['ground_truth'],group=row['group'],source_ids=row['source_ids'],conditions=row['conditions'],
            metadata=row['metadata'],encoding=row['encoding'],duration_seconds=row['metadata']['frames']/row['metadata']['fps'],
            complete=output['status']=='measured',status=output['status'],candidate_count=len(spans),
            candidate_regions=sum(len(r['regions']) for r in output['intervals']),wall_seconds=wall,
            localization=interval_metrics(spans,row['annotations'].get('intervals',[]),
                row['annotations']['status']=='independently_verified'),diagnostics=output)
        item['candidates_per_source_minute']=len(spans)/(item['duration_seconds']/60) if item['complete'] else None
        # Predeclared diagnostic-only ablations; neither affects application output.
        candidates=[r for r in output['intervals'] if r['observation']=='localized_change_candidate']
        item['offline_ablations']=dict(baseline=len(candidates),global_coherence_gate=sum(not(
            r['motionCoherence']>.90 and r['medianFlowPixels']>1) for r in candidates),
            relative_residual_gate=sum(r['maxTileResidual']/max(r['meanMotionCompensatedResidual'],1)>4 for r in candidates))
        results.append(item)
        print(row['id']+': '+output['status'],flush=True)
    import cv2,numpy
    return dict(schema_version=1,scope='development_temporal_diagnostic_behavior',classification='INCONCLUSIVE',decisionProbability=None,
        manifest_sha256=sha(manifest_path),registry_sha256=sha(registry_path),protocol_sha256=manifest.get('protocol_sha256'),
        code={p:sha(Path(__file__).parent/p) for p in ('temporal.py','temporal_video.py','evaluate_video.py')},
        environment=dict(python=platform.python_version(),opencv=cv2.__version__,numpy=numpy.__version__),
        parameters=dict(interval_seconds=interval,max_pairs=MAX_PAIRS,hard_deadline_seconds=HARD_SECONDS,
                        thresholds_fitted=False,application_policy_changed=False,final_holdout_used=False),
        cohorts={cohort:summarize([i for i in results if i['cohort']==cohort]) for cohort in COHORTS},
        counts=dict(software_controls=sum(i['cohort']=='software_control' for i in results),
            authentic=sum(i['ground_truth']=='authentic' for i in results),manipulated=sum(i['ground_truth']=='manipulated' for i in results),
            ai_generated=sum(i['ground_truth']=='ai_generated' for i in results)),
        by_condition={c:summarize([i for i in results if c in i['conditions']]) for c in sorted({c for i in results for c in i['conditions']})},
        limitations=['Operator registry is a reviewed governance input, not automated legal/identity verification.',
                    'Candidate counts are sampling-dependent observations, not independent deepfake events.',
                    'Software-generated annotations never authorize localization precision/recall.',
                    'Spatial precision/recall not implemented; partial/failed/insufficient videos excluded from burden denominators.',
                    'Native frame metadata are decoded; pixel format/encoder settings remain provenance declarations.',
                    'Validation rows participate in split checks but their media bytes are not opened/scored.'],items=results)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest',required=True);parser.add_argument('--registry',required=True)
    parser.add_argument('--root',default='.');parser.add_argument('--interval',type=float,default=.5)
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    if Path(args.output).exists():raise ValueError('Refusing to overwrite evaluation history')
    if not math.isfinite(args.interval) or not .25<=args.interval<=60:raise ValueError('Invalid interval')
    report=evaluate(args.manifest,args.root,args.registry,args.interval)
    Path(args.output).write_text(json.dumps(report,indent=2,allow_nan=False),encoding='utf-8')
    print(json.dumps(report['cohorts']))


if __name__=='__main__':main()
