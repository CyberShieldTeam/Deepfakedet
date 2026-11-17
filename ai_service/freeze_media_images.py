"""Freeze a small external image comparison without opening existing reserved images."""
import argparse
from collections import defaultdict
import hashlib
import io
import json
from pathlib import Path
import re
from PIL import Image, ImageOps
from ai_service.prepare_media_image_evaluation import DATASET,REVISION,LICENSE
from ai_service.image_benchmark import fingerprints
from ai_service.media_image_manifest import ADMISSION_POLICY,admission_policy_sha256,expected_label_basis,PHASH_MAX_DISTANCE

PROTOCOL=Path('test/fixtures/engine1_image_protocol.json')
digest=lambda b:hashlib.sha256(b).hexdigest()


def freeze(inventory,shards,output):
    if output.exists():raise ValueError('FROZEN_OUTPUT_EXISTS')
    import pyarrow.parquet as pq
    data=json.loads(inventory.read_bytes());protocol=json.loads(PROTOCOL.read_bytes())
    if data['dataset']!=DATASET or data['revision']!=REVISION:raise ValueError('SOURCE_IDENTITY')
    candidates=defaultdict(list)
    for row in data['rows']:
        if row.get('split')!='test' or str(row.get('nsfw_flag')).lower()!='false' or row.get('label') not in [0,1]:continue
        if row['label']==0 and row.get('real_source')!='coco':continue
        candidates['genuine' if row['label']==0 else 'synthetic'].append(row)
    for label in candidates:candidates[label].sort(key=lambda r:digest((protocol['seed']+r['shard']+str(r['index'])).encode()))
    # Distribute synthetic candidates over available generators without looking at predictions.
    by_generator=defaultdict(list)
    for row in candidates['synthetic']:by_generator[row['model_name']].append(row)
    mixed=[]
    while any(by_generator.values()):
        for generator in sorted(by_generator):
            if by_generator[generator]:mixed.append(by_generator[generator].pop(0))
    candidates['synthetic']=mixed
    encoded,pixels,groups,prompts=set(),set(),set(),set();perceptual=[];selected=[];cache={}
    root=output.parent/'images';root.mkdir(parents=True,exist_ok=True)
    excluded=defaultdict(int)
    for role,quotas in protocol['roles'].items():
        for label,quota in quotas.items():
            count=0
            for row in candidates[label]:
                identity=f"{row['real_source']}:{row['model_name']}:{row['image_name']}"
                source_group=f"{row['real_source']}:{row['image_name']}"
                prompt=re.sub(r'\s+',' ',str(row.get('prompt',''))).strip().casefold()
                if source_group in groups or (prompt and prompt in prompts):continue
                name=Path(row['shard']).name
                if name not in cache:
                    path=shards/name;parquet=pq.ParquetFile(path)
                    uncompressed=sum(parquet.metadata.row_group(i).column(parquet.schema_arrow.names.index('image_data')).total_uncompressed_size for i in range(parquet.metadata.num_row_groups))
                    if uncompressed>64*1024*1024:excluded['uncompressed_budget']+=1;continue
                    cache[name]=parquet.read(columns=['image_data']).column(0).to_pylist()
                raw=cache[name][row['index']]
                if len(raw)>10*1024*1024:excluded['byte_limit']+=1;continue
                with Image.open(io.BytesIO(raw)) as source:
                    if source.width*source.height>24_000_000 or min(source.size)<64:excluded['geometry']+=1;continue
                    oriented=ImageOps.exif_transpose(source).convert('RGB');pixel_hash=digest(oriented.tobytes())
                    geometry=dict(format=source.format,width=source.width,height=source.height,orientedSize=list(oriented.size),mode=source.mode)
                sha=digest(raw)
                if sha in encoded or pixel_hash in pixels:excluded['duplicate']+=1;continue
                phash=f"{fingerprints(oriented):016x}"
                if any((int(phash,16)^int(previous,16)).bit_count()<=PHASH_MAX_DISTANCE for previous,_ in perceptual):
                    excluded['perceptual_duplicate']+=1;continue
                key=digest(identity.encode())[:24];target=root/(key+'.'+geometry['format'].lower().replace('jpeg','jpg'))
                with target.open('xb') as file:file.write(raw)
                generator=row['model_name'] if label=='synthetic' else 'publisher_labelled_real'
                selected.append(dict(id=key,path=target.relative_to(output.parent).as_posix(),sha256=sha,decodedSha256=pixel_hash,perceptualHash=phash,label=label,role=role,group=digest(source_group.encode()),promptGroup=digest(prompt.encode()) if prompt else None,generator=generator,sourceDataset=row['real_source'],source=f'https://huggingface.co/datasets/{DATASET}/tree/{REVISION}',publisherImageName=row['image_name'],shard=row['shard'],index=row['index'],license=LICENSE,labelBasis=expected_label_basis(label,generator,row['real_source']),geometry=geometry))
                encoded.add(sha);pixels.add(pixel_hash);groups.add(source_group)
                perceptual.append((phash,key))
                if prompt:prompts.add(prompt)
                count+=1
                if count==quota:break
            if count!=quota:raise ValueError('INSUFFICIENT_ELIGIBLE_ROWS_NO_FABRICATED_REPLACEMENT')
        # Release binary shard buffers between roles; source files remain immutable.
        cache.clear()
    result=dict(schemaVersion=2,dataset=DATASET,revision=REVISION,license=LICENSE,protocolSha256=digest(PROTOCOL.read_bytes()),admissionPolicy=ADMISSION_POLICY,admissionPolicySha256=admission_policy_sha256(),inventorySha256=digest(inventory.read_bytes()),exclusions=dict(excluded),rows=selected,scope='Frozen external research comparison; incomplete original/identity/training lineage, no authoritative validation')
    with output.open('x',encoding='utf8') as file:json.dump(result,file,ensure_ascii=False,indent=2)
    print(json.dumps({'samples':len(selected),'protocolSha256':result['protocolSha256'],'exclusions':dict(excluded),'syntheticGenerators':sorted({r['generator'] for r in selected if r['label']=='synthetic'})}))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--inventory',type=Path,required=True);parser.add_argument('--shards',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);a=parser.parse_args();freeze(a.inventory,a.shards,a.output)
