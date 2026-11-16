"""Frozen local research releases. One bounded job/command; no production cap changes."""
import argparse,base64,hashlib,io,json,platform,time
from pathlib import Path
from PIL import Image,ImageOps,__version__ as pillow_version
from ai_service.extraction_prepare import prepare,PROFILES
from ai_service.ocr_evaluation import measure,required
from ai_service.ocr_scoring import score_observations
from ai_service.download_ocr import SHA256,REVISION

LIMITS=dict(observations=500,manifestBytes=8*1024*1024,sourceBytes=512*1024*1024,jobObservations=50,jobPasses=100,totalPasses=1000,referenceCharacters=4000)
RUNTIME_FILES=['package-lock.json','server/extraction.ts','server/extractionRunner.ts','server/extractionWorker.ts','server/ocrGeometry.ts','ai_service/extraction_prepare.py','ai_service/ocr_geometry.py','ai_service/ocr_evaluation.py','ai_service/ocr_scoring.py','ai_service/ocr_release.py','ai_service/screenshot_annotation.py','test/ocrPass.ts']
def digest(raw):return hashlib.sha256(raw).hexdigest()
def encode(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode()
def read_json(file,limit=LIMITS['manifestBytes']):
    file=Path(file)
    if file.stat().st_size>limit:raise ValueError('JSON byte budget exceeded')
    return json.loads(file.read_text(encoding='utf-8'))
def write_new(file,value):
    file=Path(file)
    with file.open('xb') as out:out.write(encode(value))
def configuration():
    return dict(modelSha256=SHA256,modelRevision=REVISION,python=platform.python_version(),pillow=pillow_version,runtimeFiles={f:digest(Path(f).read_bytes()) for f in RUNTIME_FILES})
def load_release(file):
    file=Path(file).resolve();m=read_json(file);root=file.parent
    if m.get('schemaVersion')!=3 or m.get('scope') not in ['authored_controls','provisional_publisher','human_adjudicated']:raise ValueError('Release version/scope required')
    for key in ['datasetId','datasetVersion','publisher','officialSource','rights','permissionEvidence','annotationProtocol','annotationProvenance','approvedBy','approvedAt']:required(m,key)
    rows=m.get('rows');profiles=m.get('profiles');approval=m.get('resourceApproval',{})
    if not isinstance(rows,list) or not 1<=len(rows)<=LIMITS['observations']:raise ValueError('Release observation budget')
    if not isinstance(profiles,list) or not 1<=len(profiles)<=8 or len(set(profiles))!=len(profiles) or profiles[0]!='baseline' or any(p not in PROFILES for p in profiles):raise ValueError('Baseline-first fixed profiles required')
    for key in ['approvedBy','reference']:required(approval,key)
    max_passes=approval.get('maxPasses')
    if type(max_passes)!=int or not 1<=max_passes<=LIMITS['totalPasses'] or sum(r.get('split')=='development' for r in rows)*len(profiles)>max_passes:raise ValueError('Explicit total-pass budget exceeded')
    roles={};ids=set();hashes=set()
    # Validate global family/lineage/hash roles before any source pixels or predictions.
    for r in rows:
        for key in ['id','path','sha256','sourceGroup','family','lineage','split','sourceLanguage','languageBasis','recognitionLanguage','quality','rotation','resolution','density','sourceCategory','annotationStatus']:required(r,key)
        if r['split'] not in ['development','holdout'] or r['id'] in ids or r['sha256'] in hashes:raise ValueError('Duplicate observation/bytes or invalid split')
        if r['recognitionLanguage'] not in ['eng','hin','tel']:raise ValueError('Unsupported recognition configuration')
        if r['sourceLanguage']!='unknown' and r['languageBasis'] not in ['publisher','human','authored']:raise ValueError('Source language must have annotation provenance')
        if r['sourceLanguage']=='unknown' and r['languageBasis']!='unavailable':raise ValueError('Unknown language must remain unverified')
        if r['annotationStatus'] not in ['pending','publisher_only','human_adjudicated','authored']:raise ValueError('Annotation state required')
        if m['scope']=='authored_controls' and r['annotationStatus']!='authored':raise ValueError('Authored scope cannot imply independent annotations')
        if m['scope']=='human_adjudicated' and r['annotationStatus']!='human_adjudicated':raise ValueError('Adjudication incomplete')
        if r['annotationStatus']=='human_adjudicated':
            from ai_service.screenshot_annotation import verify_adjudication
            verified=verify_adjudication(r.get('annotation',{}),r['sha256'],r.get('dimensions'))
            if verified['reference']!=r.get('reference'):raise ValueError('Final transcription differs from adjudication')
            if verified['sourceLanguage']!=r['sourceLanguage'] or verified['uncertainRegions'] or r['annotation']['adjudication'].get('completeScreenTranscription') is not True:raise ValueError('Provisional language/illegibility/coverage; full-screen scoring is not admitted')
        if r['annotationStatus']=='pending':
            if r.get('reference') is not None:raise ValueError('Pending annotation cannot supply scored ground truth')
        elif not isinstance(r.get('reference'),str) or len(r['reference'])>LIMITS['referenceCharacters']:raise ValueError('Full reference budget/type')
        if r['id'] in ids:raise ValueError('Duplicate identity')
        ids.add(r['id']);hashes.add(r['sha256'])
        for key in ['sourceGroup','family','lineage']:
            identity=(key,r[key]);old=roles.setdefault(identity,r['split'])
            if old!=r['split']:raise ValueError('Cross-split source/family/lineage leakage')
    total=0;prepared=[];near=[]
    for r in rows:
        path=Path(r['path'])
        if path.is_absolute():raise ValueError('Relative local images only')
        path=(root/path).resolve()
        if not path.is_relative_to(root) or path.stat().st_size>10*1024*1024:raise ValueError('Image path/byte budget')
        raw=path.read_bytes();total+=len(raw)
        if total>LIMITS['sourceBytes'] or digest(raw)!=r['sha256']:raise ValueError('Release source budget/hash mismatch')
        p=prepare(base64.b64encode(raw).decode())
        if r.get('dimensions')!=[p['originalWidth'],p['originalHeight']]:raise ValueError('Original dimensions mismatch')
        with Image.open(io.BytesIO(base64.b64decode(p['image_base64']))) as image:
            gray=list(ImageOps.grayscale(image).resize((8,8)).tobytes());mean=sum(gray)/64;signature=sum((v>mean)<<i for i,v in enumerate(gray))
        for old in near:
            if old['split']!=r['split'] and (signature^old['signature']).bit_count()<=4:raise ValueError('Near-duplicate cross-split screen; manual lineage review required')
        near.append(dict(split=r['split'],signature=signature))
        with Image.open(io.BytesIO(raw)) as image:mime=Image.MIME[image.format]
        prepared.append({**r,'absolutePath':str(path),'mime':mime,'language':r['recognitionLanguage']})
    return m,prepared,digest(file.read_bytes())
def plan_payload(file,m,rows,manifest_hash):
    # Connected family/source/lineage components stay in one batch, even within development.
    pending=[{r['id']} for r in rows if r['split']=='development'];lookup={r['id']:r for r in rows}
    components=[]
    while pending:
        component=pending.pop(0);changed=True
        while changed:
            changed=False;keys={(k,lookup[i][k]) for i in component for k in ['sourceGroup','family','lineage']}
            for other in list(pending):
                if any((k,lookup[i][k]) in keys for i in other for k in ['sourceGroup','family','lineage']):component|=other;pending.remove(other);changed=True
        components.append(sorted(component))
    components.sort(key=lambda v:v[0]);batches=[];current=[]
    for component in components:
        if len(component)>LIMITS['jobObservations']:raise ValueError('Family exceeds bounded job; do not split lineage to bypass caps')
        if len(current)+len(component)>LIMITS['jobObservations']:batches.append(current);current=[]
        current+=component
    if current:batches.append(current)
    jobs=[]
    for profile in m['profiles']:
        for index,ids in enumerate(batches):
            job=dict(profile=profile,batch=index,ids=ids);jobs.append({**job,'id':'job_'+digest(encode(job))[:24]})
    payload=dict(schemaVersion=1,datasetId=m['datasetId'],scope=m['scope'],sourceManifest=str(Path(file).resolve()),manifestSha256=manifest_hash,configuration=configuration(),limits=LIMITS,jobs=jobs,
                 splitSeal=[{k:r[k] for k in ['id','sha256','sourceGroup','family','lineage','split','annotationStatus']} for r in sorted(rows,key=lambda r:r['id'])],
                 holdout=dict(observations=sum(r['split']=='holdout' for r in rows),access='LOCKED; no holdout jobs or outputs are produced'),createdAt=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()))
    payload['planSha256']=digest(encode(payload));return payload
def make_plan(file):
    m,rows,manifest_hash=load_release(file);return plan_payload(file,m,rows,manifest_hash)
def validate_plan(plan_file):
    plan=read_json(plan_file);body={k:v for k,v in plan.items() if k!='planSha256'}
    if digest(encode(body))!=plan.get('planSha256'):raise ValueError('Plan seal mismatch')
    if configuration()!=plan['configuration']:raise ValueError('Runtime/model configuration changed; freeze a separately versioned release')
    m,rows,manifest_hash=load_release(plan['sourceManifest'])
    if manifest_hash!=plan['manifestSha256']:raise ValueError('Frozen manifest changed')
    expected=plan_payload(plan['sourceManifest'],m,rows,manifest_hash)
    if expected['jobs']!=plan['jobs'] or expected['splitSeal']!=plan['splitSeal']:raise ValueError('Frozen jobs/splits changed')
    return plan,m,rows
def result_path(root,row_id,profile):return root/('observation_'+digest(encode([row_id,profile]))+'.json')
def validate_result(entry,plan,row,profile):
    if entry.get('planSha256')!=plan['planSha256'] or entry.get('id')!=row['id'] or entry.get('profile')!=profile or entry.get('sourceSha256')!=row['sha256'] or entry.get('annotationSha256')!=digest(encode(row.get('reference'))):raise ValueError('Result identity/source/annotation/configuration mismatch')
    body={k:v for k,v in entry.items() if k!='resultSha256'}
    if digest(encode(body))!=entry.get('resultSha256'):raise ValueError('Result checksum mismatch')
    if entry.get('reference')!=row.get('reference'):raise ValueError('Result ground truth mismatch')
    return entry
def run_job(plan_file,job_id,directory):
    plan,m,rows=validate_plan(plan_file);job=next((j for j in plan['jobs'] if j['id']==job_id),None)
    if not job:raise ValueError('Unknown or locked holdout job')
    root=Path(directory).resolve();root.mkdir(parents=True,exist_ok=True);lookup={r['id']:r for r in rows}
    lock=root/'run.lock'
    with lock.open('x') as handle:handle.write(str(__import__('os').getpid()))
    completed=reused=0;started=time.perf_counter()
    try:
        if job['profile']!='baseline':
            for row in rows:
                if row['split']=='development':validate_result(read_json(result_path(root,row['id'],'baseline')),plan,row,'baseline')
        for ident in job['ids']:
            row=lookup[ident]
            if row['split']!='development':raise ValueError('Holdout access locked')
            target=result_path(root,ident,job['profile'])
            if target.exists():validate_result(read_json(target),plan,row,job['profile']);reused+=1;continue
            try:result=measure(row,job['profile'])
            except (OSError,ValueError,TimeoutError):result=dict(state='FAILED',text=None,errorCategory='EVALUATION_EXECUTION_FAILED',wallSeconds=0,sampledPeakOcrTreeRssBytes=0)
            entry=dict(planSha256=plan['planSha256'],id=ident,profile=job['profile'],sourceSha256=row['sha256'],annotationSha256=digest(encode(row.get('reference'))),reference=row.get('reference'),state=result.get('state'),text=result.get('text'),errorCategory=result.get('errorCategory'),timing=result.get('timing'),wallSeconds=result.get('wallSeconds'),sampledPeakOcrTreeRssBytes=result.get('sampledPeakOcrTreeRssBytes'),candidateCount=result.get('candidates'))
            if row.get('reference') is not None:score_observations([entry])
            entry['resultSha256']=digest(encode(entry));write_new(target,entry);completed+=1
    finally:lock.unlink()
    return dict(jobId=job_id,completed=completed,reused=reused,elapsedSeconds=time.perf_counter()-started)
def aggregate(plan_file,directory):
    plan,m,rows=validate_plan(plan_file);root=Path(directory).resolve();lookup={r['id']:r for r in rows};expected={};observations=[]
    for job in plan['jobs']:
        for ident in job['ids']:
            row=lookup[ident];target=result_path(root,ident,job['profile']);expected[target.name]=(row,job['profile'])
    for file in root.glob('observation_*.json'):
        if file.name not in expected:raise ValueError('Unexpected/duplicate result file; no silent inflation')
    for name,(row,profile) in expected.items():
        file=root/name
        result=validate_result(read_json(file),plan,row,profile) if file.exists() else dict(id=row['id'],profile=profile,reference=row.get('reference'),sourceSha256=row['sha256'],state='MISSING',text=None,wallSeconds=0,sampledPeakOcrTreeRssBytes=0)
        observations.append({**result,'sourceLanguage':row['sourceLanguage'],'annotationStatus':row['annotationStatus'],'quality':row['quality'],'sourceCategory':row['sourceCategory'],'family':row['family']})
    groups={}
    for profile in m['profiles']:
        for key in ['sourceLanguage','quality','sourceCategory','annotationStatus']:
            for value in sorted({r[key] for r in observations}):
                selected=[r for r in observations if r['profile']==profile and r[key]==value];scored=[r for r in selected if r['reference'] is not None]
                metrics=score_observations(scored) if scored else dict(observations=len(selected),metrics=None,reason='No adjudicated/publisher reference supplied; provisional unscored')
                groups[f'{profile}/{key}/{value}']={**metrics,'statusCounts':{state:sum(r['state']==state for r in selected) for state in ['COMPLETE','NO_TEXT_DETECTED','PARTIAL','FAILED','UNAVAILABLE','MISSING']},'unscoredObservations':len(selected)-len(scored)}
    performance={}
    for profile in m['profiles']:
        recorded=[r for r in observations if r['profile']==profile and r['state']!='MISSING'];walls=[r['wallSeconds'] for r in recorded if isinstance(r.get('wallSeconds'),(int,float))]
        performance[profile]=dict(recordedPasses=len(recorded),totalWorkerWallSeconds=sum(walls),meanWorkerWallSeconds=sum(walls)/len(walls) if walls else None,maxSampledOcrTreeRssBytes=max((r.get('sampledPeakOcrTreeRssBytes') or 0 for r in recorded),default=0),scope='20ms sampled OCR subprocess tree; excludes persistent Python/web services and release admission/scoring overhead')
    return dict(schemaVersion=1,planSha256=plan['planSha256'],manifestSha256=plan['manifestSha256'],scope=m['scope'],holdout=plan['holdout'],sourceImages=len({r['sha256'] for r in rows}),families=len({r['family'] for r in rows}),expectedPasses=len(expected),recordedPasses=sum(r['state']!='MISSING' for r in observations),performance=performance,groups=groups,observations=observations,limitations=['No automatic selector or production default change.','Software fixtures are not independent accuracy/human usability.','Publisher-only annotations are provisional; self-checksums are not proof of independent human adjudication.','Holdout outputs remain locked. Missing and operational failure observations remain in failure-as-empty scores.'])
def main():
    p=argparse.ArgumentParser();sub=p.add_subparsers(dest='action',required=True)
    f=sub.add_parser('freeze');f.add_argument('manifest');f.add_argument('--output',required=True)
    r=sub.add_parser('run');r.add_argument('plan');r.add_argument('--job',required=True);r.add_argument('--directory',required=True)
    a=sub.add_parser('aggregate');a.add_argument('plan');a.add_argument('--directory',required=True);a.add_argument('--output',required=True)
    args=p.parse_args()
    if args.action=='freeze':write_new(args.output,make_plan(args.manifest));print('Frozen release created; holdout access locked.')
    elif args.action=='run':print(json.dumps(run_job(args.plan,args.job,args.directory)))
    else:write_new(args.output,aggregate(args.plan,args.directory));print('Aggregate reconstructed from expected observations.')
if __name__=='__main__':main()
