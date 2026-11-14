"""Generator-stratified development/reserved splits; no model scoring or training."""
import hashlib
import io
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image,ImageOps
from ai_service.prepare_mirage import REPO,REVISION,download
from ai_service.image_benchmark import fingerprints
from ai_service.reserve_image_holdout import overlaps


def main():
    root=Path('.model-cache')
    old=json.loads(Path('reports/benchmark_partitions.json').read_text(encoding='utf-8'))
    known=[]
    for partition in ('development','reserved_final'):
        for sample in old[partition]['samples']:
            with Image.open(root/sample['path']) as source:
                image=ImageOps.exif_transpose(source).convert('RGB')
                known.append(dict(sha256=sample['sha256'],decoded=hashlib.sha256(image.tobytes()+str(image.size).encode()).hexdigest(),
                                  phash=int(sample['phash63'],16),source_group=sample['group']))
    partitions={role:[] for role in ('development','reserved_final')}
    rejected=[]
    listings={}
    generators={}
    pool=ThreadPoolExecutor(max_workers=4)
    for domain in ('Animal','Human','Object','Scene'):
        entries=json.loads(download(f'https://huggingface.co/api/datasets/{REPO}/tree/{REVISION}/{domain}/1_fake?limit=1000'))
        folders=sorted(entry['path'] for entry in entries if entry['type']=='directory')
        if not folders:
            raise ValueError('No generator folders')
        generators[domain]=[Path(folder).name for folder in folders]
        strata=[(f'{domain}/0_real','genuine',2*len(folders))]+[(folder,'synthetic',2) for folder in folders]
        for folder,label,quota in strata:
            if folder not in listings:
                entries=json.loads(download(f'https://huggingface.co/api/datasets/{REPO}/tree/{REVISION}/{folder}?limit=1000'))
                files=[entry for entry in entries if entry['type']=='file' and entry['path'].lower().endswith(('.jpg','.jpeg','.png','.webp'))]
                files.sort(key=lambda entry:hashlib.sha256(entry['path'].encode()).hexdigest())
                listings[folder]=files
            for role in partitions:
                count=0
                candidates=[entry for entry in listings[folder] if entry['size']<=10*1024*1024 and not
                            any(record['sha256']==entry.get('lfs',{}).get('oid') for record in known)]
                pending={}
                for index,entry in enumerate(candidates):
                    # Bounded lookahead; consume in deterministic manifest order.
                    for upcoming in candidates[index:index+4]:
                        future_path=(root/'benchmark-v2'/upcoming['path']).resolve()
                        if not future_path.is_relative_to(root.resolve()):
                            raise ValueError('Dataset entry escapes cache')
                        if upcoming['path'] not in pending and not future_path.exists():
                            pending[upcoming['path']]=pool.submit(download,
                                f'https://huggingface.co/datasets/{REPO}/resolve/{REVISION}/{upcoming["path"]}')
                    url=f'https://huggingface.co/datasets/{REPO}/resolve/{REVISION}/{entry["path"]}'
                    target=(root/'benchmark-v2'/entry['path']).resolve()
                    if not target.is_relative_to(root.resolve()):
                        raise ValueError('Dataset entry escapes cache')
                    raw=target.read_bytes() if target.exists() else pending.pop(entry['path']).result()
                    digest=hashlib.sha256(raw).hexdigest()
                    if entry.get('lfs',{}).get('oid') and digest!=entry['lfs']['oid']:
                        raise ValueError('Hash mismatch')
                    with Image.open(io.BytesIO(raw)) as source:
                        if source.width*source.height>24_000_000:
                            rejected.append(dict(id=entry['path'],reason='pixel_limit'))
                            continue
                        image=ImageOps.exif_transpose(source).convert('RGB')
                        perceptual=fingerprints(image)
                        decoded=hashlib.sha256(image.tobytes()+str(image.size).encode()).hexdigest()
                    if any(overlaps(record,digest,decoded,perceptual) for record in known):
                        rejected.append(dict(id=entry['path'],reason='overlap_with_prior_or_current_partitions'))
                        continue
                    target.parent.mkdir(parents=True,exist_ok=True)
                    if not target.exists():
                        target.write_bytes(raw)
                    sample=dict(id=entry['path'],path='benchmark-v2/'+entry['path'],label=label,domain=domain,
                                sha256=digest,group=entry['path'],split='test',source=url,
                                license='MIT publisher declaration; underlying source rights unverified',phash63=f'{perceptual:016x}')
                    partitions[role].append(sample)
                    known.append(dict(sha256=digest,decoded=decoded,phash=perceptual,source_group=sample['group']))
                    count+=1
                    if count==quota:
                        break
                if count!=quota:
                    raise ValueError(f'Not enough eligible samples for {role}/{folder}')
        print(f'Prepared {domain}: {len(folders)} generator strata',flush=True)
    report=dict(dataset=REPO,revision=REVISION,generators=generators,rejected=rejected,heldout_scored=False,
                note='Provisional source/identity independence; near-duplicate guard is not an identity audit')
    pool.shutdown(wait=True)
    for role,samples in partitions.items():
        manifest=dict(task='general_ai_generated_image',benchmark_role=role,dataset=REPO,revision=REVISION,
                      selection='Two synthetic files per generator per category per role; equal genuine count; hash order within first 1000 files of each folder',
                      duplicate_policy='SHA256, decoded pixels+dimensions, pHash63 distance<=6 against both prior and current partitions',samples=samples)
        (root/f'benchmark_v2_{role}.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
        report[role]=manifest
    Path('reports/benchmark_v2_partitions.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print({role:len(samples) for role,samples in partitions.items()},flush=True)


if __name__=='__main__':
    main()
