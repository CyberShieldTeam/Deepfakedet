"""Reserve fresh pinned images without scoring or inspecting their model outputs."""
import hashlib
import io
import json
from pathlib import Path
from PIL import Image,ImageOps
from ai_service.image_benchmark import fingerprints
from ai_service.prepare_mirage import download, REPO, REVISION
from ai_service.evaluate_image import read_manifest


def overlaps(record,digest,decoded,perceptual,source_group=None):
    return (record['sha256']==digest or record['decoded']==decoded or
            (record['phash']^perceptual).bit_count()<=6 or
            (source_group is not None and record['source_group']==source_group))


def main():
    root=Path('.model-cache')
    development=[]
    known=[]
    rejected=[]
    prepared=read_manifest(root/'mirage-screening/manifest.json')
    for sample,raw in prepared:
        with Image.open(io.BytesIO(raw)) as source:
            image=ImageOps.exif_transpose(source).convert('RGB')
            perceptual=fingerprints(image)
            decoded=hashlib.sha256(image.tobytes()+str(image.size).encode()).hexdigest()
        matches=[record for record in known if overlaps(record,sample['sha256'],decoded,perceptual,sample['group'])]
        group=matches[0]['group'] if matches else sample['group']
        if len({record['group'] for record in matches})>1:
            raise ValueError('Transitive development duplicate groups require review')
        record=dict(sha256=sample['sha256'],decoded=decoded,phash=perceptual,group=group,source_group=sample['group'])
        known.append(record)
        development.append(dict(sample,path='mirage-screening/'+sample['path'],group=group,phash63=f'{perceptual:016x}'))
    reserved=[]
    for domain in ('Animal','Human','Object','Scene'):
        for folder,label in (('0_real','genuine'),('1_fake','synthetic')):
            listing=json.loads(download(f'https://huggingface.co/api/datasets/{REPO}/tree/{REVISION}/{domain}/{folder}?recursive=true&limit=1000'))
            files=[entry for entry in listing if entry['type']=='file' and entry['path'].lower().endswith(('.jpg','.png','.jpeg','.webp'))]
            files.sort(key=lambda entry:hashlib.sha256(entry['path'].encode()).hexdigest())
            taken=0
            for entry in files:
                if any(sample['id']==entry['path'] for sample in development):
                    continue
                if entry['size']>10*1024*1024:
                    continue
                url=f'https://huggingface.co/datasets/{REPO}/resolve/{REVISION}/{entry["path"]}'
                target=(root/'benchmark-reserved'/entry['path']).resolve()
                if not target.is_relative_to(root.resolve()):
                    raise ValueError('Dataset path escapes cache')
                raw=target.read_bytes() if target.exists() else download(url)
                digest=hashlib.sha256(raw).hexdigest()
                if entry.get('lfs',{}).get('oid') and digest!=entry['lfs']['oid']:
                    raise ValueError('Publisher hash mismatch')
                with Image.open(io.BytesIO(raw)) as source:
                    if source.width*source.height>24_000_000:
                        rejected.append(dict(id=entry['path'],reason='pixel_limit'))
                        continue
                    image=ImageOps.exif_transpose(source).convert('RGB')
                    perceptual=fingerprints(image)
                    decoded=hashlib.sha256(image.tobytes()+str(image.size).encode()).hexdigest()
                if any(overlaps(record,digest,decoded,perceptual) for record in known):
                    rejected.append(dict(id=entry['path'],reason='exact_or_perceptual_overlap'))
                    continue
                target.parent.mkdir(parents=True,exist_ok=True)
                if not target.exists():
                    target.write_bytes(raw)
                sample=dict(id=entry['path'],path='benchmark-reserved/'+entry['path'],label=label,domain=domain,
                            sha256=digest,group=entry['path'],split='test',source=url,
                            license='MIT (publisher declaration; underlying rights not independently audited)',
                            phash63=f'{perceptual:016x}')
                reserved.append(sample)
                known.append(dict(sha256=digest,decoded=decoded,phash=perceptual,group=sample['group'],source_group=sample['group']))
                taken+=1
                if taken==10:
                    break
            if taken!=10:
                raise ValueError('Insufficient eligible reserved images')
            print(f'Reserved {domain}/{label}: {taken}',flush=True)
    metadata=dict(task='general_ai_generated_image',dataset=REPO,revision=REVISION,
                  duplicate_policy='SHA256, decoded pixels+dimensions, grayscale DCT pHash63 Hamming<=6; no automatic identity recognition',
                  limitations=['Single dataset and first API-page selection bias','Unknown subject identities and unknown training overlap',
                               'Source/identity separation remains provisional until human provenance audit'])
    dev=dict(metadata,benchmark_role='development',samples=development)
    holdout=dict(metadata,benchmark_role='reserved_final',samples=reserved)
    for name,manifest in (('benchmark_development.json',dev),('benchmark_holdout.json',holdout)):
        (root/name).write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    report=dict(development=dev,reserved_final=holdout,rejected=rejected,heldout_scored=False,
                note='No held-out model outputs generated; source/identity-disjoint validity still unverified')
    Path('reports/benchmark_partitions.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('Saved development and reserved manifests',flush=True)


if __name__=='__main__':
    main()
