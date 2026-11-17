"""Bounded official evaluation download; never reads the reserved Mirage partition."""
import argparse
import hashlib
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

DATASET='OwensLab/CommunityForensics-Eval'
REVISION='7d4a74a88d2cac93b513c0853bf92c260eaceea0'
MAX_TOTAL=160*1024*1024
MAX_SHARD=16*1024*1024
MAX_FILES=16
LICENSE='CC BY-NC-SA 4.0; publisher permits noncommercial research/education; underlying RAISE/COCO/FFHQ/LAION terms and attribution remain relevant. No media redistribution.'


def fetch(url, cap):
    with urlopen(Request(url,headers={'User-Agent':'VERITAS-AI-bounded-noncommercial-evaluation'}),timeout=30) as response:
        data=response.read(cap+1)
    if len(data)>cap:raise ValueError('DOWNLOAD_BYTE_LIMIT')
    return data


def plan(output):
    if output.exists():raise ValueError('OUTPUT_EXISTS')
    raw=fetch(f'https://huggingface.co/api/datasets/{DATASET}/revision/{REVISION}?blobs=true',2*1024*1024)
    metadata=json.loads(raw)
    if metadata['sha']!=REVISION:raise ValueError('REVISION_MISMATCH')
    pool=[r for r in metadata['siblings'] if re.fullmatch(r'data/CompEval-\d{5}-of-00413\.parquet',r['rfilename']) and 0<r.get('size',0)<=MAX_SHARD and r.get('lfs',{}).get('sha256')]
    pool.sort(key=lambda r:hashlib.sha256(('veritas-engine1-image-v1:'+r['rfilename']).encode()).hexdigest())
    selected=[];total=0
    for row in pool:
        if total+row['size']>MAX_TOTAL or len(selected)>=MAX_FILES:continue
        total+=row['size'];selected.append(dict(path=row['rfilename'],bytes=row['size'],sha256=row['lfs']['sha256']))
    result=dict(dataset=DATASET,revision=REVISION,license=LICENSE,scope='Small hash-selected size-eligible shard pool; size selection biases source/encoding coverage. No independent accuracy or complete dataset claim.',metadataSha256=hashlib.sha256(raw).hexdigest(),maximumBytes=MAX_TOTAL,maximumShardBytes=MAX_SHARD,files=selected,totalBytes=total)
    output.parent.mkdir(parents=True,exist_ok=True)
    with output.open('x',encoding='utf8') as file:json.dump(result,file,indent=2)
    print(json.dumps({'shards':len(selected),'bytes':total,'license':LICENSE,'revision':REVISION}))


def download(plan_path,root):
    data=json.loads(plan_path.read_bytes());rows=data['files']
    if data['dataset']!=DATASET or data['revision']!=REVISION or len(rows)>MAX_FILES or sum(r['bytes'] for r in rows)>MAX_TOTAL:raise ValueError('PLAN_LIMIT_OR_IDENTITY')
    root.mkdir(parents=True,exist_ok=True)
    for row in rows:
        if not re.fullmatch(r'data/CompEval-\d{5}-of-00413\.parquet',row['path']) or not 0<row['bytes']<=MAX_SHARD or not re.fullmatch('[a-f0-9]{64}',row['sha256']):raise ValueError('INVALID_PLAN_FILE')
        target=root/Path(row['path']).name
        if target.exists():
            if target.stat().st_size!=row['bytes'] or hashlib.sha256(target.read_bytes()).hexdigest()!=row['sha256']:raise ValueError('EXISTING_FILE_MISMATCH')
            continue
        raw=fetch(f"https://huggingface.co/datasets/{DATASET}/resolve/{REVISION}/{row['path']}",row['bytes'])
        if len(raw)!=row['bytes'] or hashlib.sha256(raw).hexdigest()!=row['sha256']:raise ValueError('PINNED_FILE_MISMATCH')
        with target.open('xb') as file:file.write(raw)
        print(json.dumps({'verified':target.name,'bytes':len(raw)}),flush=True)


def inventory(plan_path,root,output):
    if output.exists():raise ValueError('OUTPUT_EXISTS')
    import pyarrow.parquet as pq
    from collections import Counter
    data=json.loads(plan_path.read_bytes());rows=[];counts=Counter()
    for source in data['files']:
        path=root/Path(source['path']).name
        if hashlib.sha256(path.read_bytes()).hexdigest()!=source['sha256']:raise ValueError('SHARD_HASH_MISMATCH')
        parquet=pq.ParquetFile(path)
        if parquet.metadata.num_rows>2048:raise ValueError('SHARD_ROW_LIMIT')
        columns=[n for n in parquet.schema_arrow.names if n!='image_data']
        metadata=parquet.read(columns=columns).to_pylist()
        for index,row in enumerate(metadata):
            # Inventory only. Raw images and any future reserved partition are not opened.
            rows.append(dict(shard=source['path'],index=index,**row))
            counts[(row.get('label'),row.get('model_name'),row.get('real_source'))]+=1
    result=dict(dataset=DATASET,revision=REVISION,planSha256=hashlib.sha256(plan_path.read_bytes()).hexdigest(),license=LICENSE,rows=rows)
    with output.open('x',encoding='utf8') as file:json.dump(result,file,ensure_ascii=False,indent=2)
    print(json.dumps({'rows':len(rows),'strata':[{'label':key[0],'model':key[1],'realSource':key[2],'count':count} for key,count in counts.items()]},ensure_ascii=False))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['plan','download','inventory']);parser.add_argument('--plan',type=Path,required=True);parser.add_argument('--root',type=Path);parser.add_argument('--output',type=Path);args=parser.parse_args()
    if args.action=='plan':plan(args.plan)
    elif args.action=='download':download(args.plan,args.root)
    else:inventory(args.plan,args.root,args.output)
