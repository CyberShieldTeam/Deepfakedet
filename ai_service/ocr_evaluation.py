"""Local rights-gated OCR experiments. No URLs, model downloads, training or test-set tuning."""
import argparse,base64,hashlib,io,json,subprocess,time,unicodedata
from pathlib import Path
import psutil
from PIL import Image,ImageOps
from ai_service.evaluate_extraction import text_metrics
from ai_service.extraction_prepare import prepare,PROFILES
from ai_service.profile_campaign_resources import terminate_tree
from ai_service.ocr_scoring import score_observations
def sha(raw):return hashlib.sha256(raw).hexdigest()
def required(row,key):
    if not isinstance(row.get(key),str) or not row[key].strip():raise ValueError('Missing provenance: '+key)
def load_manifest(file):
    file=Path(file).resolve()
    if file.stat().st_size>2*1024*1024:raise ValueError('Manifest exceeds 2 MiB')
    raw=file.read_bytes();m=json.loads(raw);root=file.parent.resolve()
    if m.get('schemaVersion')!=2 or m.get('scope') not in ['independent_development','authored_controls']:raise ValueError('Explicit evaluation scope required')
    for key in ['datasetId','datasetVersion','publisher','officialSource','rights','permissionEvidence','annotationProtocol','annotationProvenance','approvedBy','approvedAt']:required(m,key)
    rows=m.get('rows');profiles=m.get('profiles')
    if not isinstance(rows,list) or not 1<=len(rows)<=50 or not isinstance(profiles,list) or not 1<=len(profiles)<=8 or len(set(profiles))!=len(profiles) or 'baseline' not in profiles or any(p not in PROFILES for p in profiles) or len(rows)*len(profiles)>100:raise ValueError('Evaluation budget/config invalid (max 100 passes)')
    # Reject holdout and lineage leaks before opening source pixels.
    groups={};ids=set();hashes=set()
    for r in rows:
        for key in ['id','path','sha256','sourceGroup','split','language','quality','rotation','resolution','density','sourceCategory']:required(r,key)
        if r['split']=='test':raise ValueError('Final holdout locked; freeze a separate release before any test access')
        if r['split'] not in ['train','development'] or r['id'] in ids or r['sha256'] in hashes:raise ValueError('Invalid split or duplicate identifier/bytes')
        if r['sourceGroup'] in groups and groups[r['sourceGroup']]!=r['split']:raise ValueError('Source group split leakage')
        groups[r['sourceGroup']]=r['split'];ids.add(r['id']);hashes.add(r['sha256'])
        if not isinstance(r.get('reference'),str) or len(r['reference'])>500 or any(unicodedata.category(c)=='Cs' for c in r['reference']):raise ValueError('Invalid ground-truth text')
    prepared=[];near=[]
    for r in rows:
        if Path(r['path']).is_absolute():raise ValueError('Relative source path required')
        image=(root/r['path']).resolve()
        if not image.is_relative_to(root) or image.stat().st_size>10*1024*1024:raise ValueError('Source path/byte budget')
        source=image.read_bytes()
        if sha(source)!=r['sha256']:raise ValueError('Image hash mismatch')
        p=prepare(base64.b64encode(source).decode())
        with Image.open(io.BytesIO(base64.b64decode(p['image_base64']))) as im:
            gray=list(ImageOps.grayscale(im).resize((8,8)).tobytes());average=sum(gray)/64;signature=sum((v>average)<<i for i,v in enumerate(gray))
        for old in near:
            if old['split']!=r['split'] and (signature^old['signature']).bit_count()<=4:raise ValueError('Near-duplicate cross-split image; manual lineage adjudication required')
        with Image.open(io.BytesIO(source)) as decoded:mime=Image.MIME[decoded.format]
        near.append(dict(split=r['split'],signature=signature));prepared.append({**r,'absolutePath':str(image),'mime':mime})
    return m,prepared,sha(raw)
def measure(row,profile):
    source=Path(row['absolutePath']).read_bytes();payload=json.dumps(dict(id=row['id'],sha256=row['sha256'],image=base64.b64encode(source).decode(),mime=row['mime'],profile=profile,language=row['language']))
    # Pass through a temporary local file-backed stdin to avoid full-pipe deadlock on large images.
    import tempfile
    with tempfile.TemporaryFile(mode='w+',encoding='utf-8') as stdin,tempfile.TemporaryFile(mode='w+',encoding='utf-8') as stdout,tempfile.TemporaryFile(mode='w+',encoding='utf-8') as stderr:
        stdin.write(payload);stdin.seek(0);start=time.perf_counter();peak=0
        p=subprocess.Popen(['node','--max-old-space-size=512','--import','tsx','test/ocrPass.ts'],stdin=stdin,stdout=stdout,stderr=stderr,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        try:
            while p.poll() is None:
                try:
                    parent=psutil.Process(p.pid);rss=0
                    for child in [parent,*parent.children(recursive=True)]:
                        try:rss+=child.memory_info().rss
                        except psutil.Error:pass
                    peak=max(peak,rss)
                except psutil.Error:pass
                if time.perf_counter()-start>45 or peak>1024*1024*1024:raise TimeoutError('Evaluation supervisor budget exceeded')
                time.sleep(.02)
            stdout.seek(0);out=stdout.read(2*1024*1024+1)
            if p.returncode or len(out)>2*1024*1024:raise ValueError('Evaluation worker protocol/size')
            result=json.loads(out)
        except (ValueError,TimeoutError):result=dict(state='FAILED',text=None,errorCategory='EVALUATION_EXECUTION_FAILED')
        finally:
            if p.poll() is None:terminate_tree(p)
    return {**{k:v for k,v in row.items() if k not in ['absolutePath','path']},'profile':profile,**result,'wallSeconds':time.perf_counter()-start,'sampledPeakOcrTreeRssBytes':peak}
def summarize(rows):
    valid=[r for r in rows if r['text'] is not None];texts=[r for r in valid if r['reference']];empty=[r for r in valid if not r['reference']]
    return dict(samples=len(rows),failureAccounting=score_observations(rows),legacyTranscriptionPolicy='transcription/exactMatchRate are conditional on non-null outputs; report failureAccounting coverage and failureAsEmpty alongside them',transcription=text_metrics([dict(reference=r['reference'],prediction=r['text'].rstrip('\n')) for r in texts]),exactMatchRate=sum(unicodedata.normalize('NFC',r['reference'])==unicodedata.normalize('NFC',r['text'].rstrip('\n')) for r in texts)/len(texts) if texts else None,noTextSamples=len(empty),noTextCorrect=sum(not r['text'].strip() for r in empty),noTextDetectedOnText=sum(not r['text'].strip() for r in texts),technicalFailures=sum(r['state']=='FAILED' for r in rows),unavailable=sum(r['state']=='UNAVAILABLE' for r in rows),partial=sum(r['state']=='PARTIAL' for r in rows),meanWallSeconds=sum(r['wallSeconds'] for r in rows)/len(rows) if rows else None,maxSampledOcrTreeRssBytes=max((r['sampledPeakOcrTreeRssBytes'] for r in rows),default=0))
def run(manifest,output):
    target=Path(output)
    if target.exists():raise ValueError('Refusing existing report')
    m,rows,digest=load_manifest(manifest);results=[]
    # All baselines before alternatives; training pixels are admission/leakage controls only.
    for profile in m['profiles']:
        for row in rows:
            if row['split']=='development':results.append(measure(row,profile))
    if not results:raise ValueError('No development observations')
    groups={}
    for key in ['language','quality','rotation','resolution','density','sourceCategory']:
        for profile in m['profiles']:
            for value in sorted({r[key] for r in results}):
                group=[r for r in results if r['profile']==profile and r[key]==value]
                groups[f'{profile}/{key}/{value}']=summarize(group)
    report=dict(schemaVersion=2,scope=m['scope'],datasetId=m['datasetId'],manifestSha256=digest,configuration=dict(profiles=m['profiles'],ocr='tesseract.js@7.0.0',normalization='NFC CER/WER; only terminal OCR newline removed; case/punctuation preserved',nearDuplicateRule='8x8 average hash Hamming <=4 across splits; screening only, not proof of uniqueness'),grouped=groups,rows=results,limitations=['Development only; no automatic selector was trained.','No independent metrics when scope=authored_controls.','Legacy transcription fields exclude null outputs; failureAccounting includes expected operational failures as empty and reports coverage. Neither conditional scores nor failure-as-empty alone describe deployment quality.','RSS 20ms sampled runner+OCR tree; persistent preparation/web services excluded.'])
    with target.open('x',encoding='utf-8') as f:json.dump(report,f,ensure_ascii=False,indent=2)
    print(json.dumps(dict(scope=m['scope'],passes=len(results),output=str(target))))
def main():
    p=argparse.ArgumentParser();p.add_argument('manifest');p.add_argument('--output',required=True);args=p.parse_args();run(args.manifest,args.output)
if __name__=='__main__':main()
