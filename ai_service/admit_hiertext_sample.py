"""Explicit <=40 MiB download budget for a small attributed HierText development sample.
No bulk images/test set/model downloads. Keeps media/annotations outside Git.
"""
import csv,gzip,hashlib,io,json,re,urllib.request
from pathlib import Path
from PIL import Image
ROOT=Path('.model-cache/engine42-hiertext');BLOB='45df5394a71b03dc448771f51d7a9830f15b2658';SIZE=12274736
def fetch(url,limit):
    with urllib.request.urlopen(url,timeout=30) as response:data=response.read(limit+1)
    if len(data)>limit:raise ValueError('Download budget exceeded')
    return data
def annotation_records(compressed):
    # Stream the top-level annotation array; never inflate the complete >128 MiB JSON.
    decoder=json.JSONDecoder();buffer='';total=0;started=False
    with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as source:
        import codecs
        utf8=codecs.getincrementaldecoder('utf-8')()
        while True:
            chunk=source.read(65536);total+=len(chunk)
            if total>128*1024*1024:raise ValueError('Streaming decompression budget exceeded')
            buffer+=utf8.decode(chunk,final=not chunk)
            if not started:
                pos=buffer.find('"annotations"')
                if pos>=0:
                    start=buffer.find('[',pos)
                    if start>=0:buffer=buffer[start+1:];started=True
            if started:
                while True:
                    buffer=buffer.lstrip(' \r\n\t,')
                    if buffer.startswith(']'):return
                    try:record,end=decoder.raw_decode(buffer)
                    except json.JSONDecodeError:break
                    buffer=buffer[end:];yield record
            if len(buffer)>4*1024*1024:raise ValueError('Annotation record buffer exceeds 4 MiB')
            if not chunk:raise ValueError('Incomplete annotation stream')
def main():
    if (ROOT/'manifest.json').exists():raise ValueError('Refusing existing independent manifest')
    ROOT.mkdir(exist_ok=True);annotation_url='https://raw.githubusercontent.com/google-research-datasets/hiertext/main/gt/validation.jsonl.gz'
    compressed=(ROOT/'validation.jsonl.gz').read_bytes() if (ROOT/'validation.jsonl.gz').exists() else fetch(annotation_url,SIZE)
    if len(compressed)!=SIZE or hashlib.sha1(b'blob '+str(SIZE).encode()+b'\0'+compressed).hexdigest()!=BLOB:raise ValueError('Publisher annotation identity changed; review a new release')
    if not (ROOT/'validation.jsonl.gz').exists():(ROOT/'validation.jsonl.gz').write_bytes(compressed)
    annotations=annotation_records(compressed)
    metadata_url='https://storage.googleapis.com/openimages/2018_04/validation/validation-images-with-rotation.csv'
    metadata=fetch(metadata_url,16*1024*1024);(ROOT/'attribution.csv').write_bytes(metadata)
    authors={r['ImageID']:r for r in csv.DictReader(io.StringIO(metadata.decode('utf-8')))}
    rows=[];parents=[];excluded=[];image_budget=0
    for record in annotations:
        if len(parents)>=6:break
        ident=record['image_id'];author=authors.get(ident)
        if not re.fullmatch(r'[a-f0-9]{16}',ident):raise ValueError('Invalid publisher image ID')
        if not author or not re.fullmatch(r'https?://creativecommons.org/licenses/by/2\.0/?',author.get('License','')) or not author.get('Author') or not author.get('OriginalLandingURL'):
            excluded.append(dict(id=ident,reason='per-image attribution/license unavailable'));continue
        lines=[]
        for paragraph in record['paragraphs']:
            for line in paragraph['lines']:
                t=line.get('text','');vertices=line['vertices']
                if not line.get('legible') or line.get('handwritten') or line.get('vertical') or not 12<=len(t)<=200 or not re.fullmatch(r'[\x20-\x7E]+',t) or len(vertices)!=4:continue
                xs=[p[0] for p in vertices];ys=[p[1] for p in vertices]
                # Horizontal printed line gate fixed before predictions; no outcome selection.
                if abs(vertices[1][1]-vertices[0][1])>5 or max(ys)-min(ys)<12:continue
                lines.append((min(ys),min(xs),line))
        if not lines:continue
        url=f'https://open-images-dataset.s3.amazonaws.com/validation/{ident}.jpg'
        source=fetch(url,min(2*1024*1024,10*1024*1024-image_budget));image_budget+=len(source)
        with Image.open(io.BytesIO(source)) as image:
            w,h=record['image_width'],record['image_height']
            if image.width*image.height>24_000_000 or abs(image.width/image.height-w/h)>.01:
                excluded.append(dict(id=ident,reason='source/annotation aspect mismatch'));continue
            # Open Images served resolution may differ; retain source, exact resize/crop provenance.
            original_dimensions=list(image.size);image=image.convert('RGB').resize((w,h),Image.Resampling.LANCZOS)
            (ROOT/(ident+'.jpg')).write_bytes(source)
            for index,(_,__,line) in enumerate(sorted(lines,key=lambda v:(v[0],v[1]))[:2]):
                xs=[p[0] for p in line['vertices']];ys=[p[1] for p in line['vertices']];box=(max(0,int(min(xs))-2),max(0,int(min(ys))-2),min(w,int(max(xs))+3),min(h,int(max(ys))+3))
                crop=image.crop(box);name=f'{ident}-{index}.png';crop.save(ROOT/name);crop_bytes=(ROOT/name).read_bytes()
                rows.append(dict(id=name,path=name,sha256=hashlib.sha256(crop_bytes).hexdigest(),sourceGroup=ident,split='development',language='eng',quality='publisher_legible',rotation='horizontal_gate',resolution=f'{crop.width}x{crop.height}',density='single_line',sourceCategory='independent_scene_text_line_crop',reference=line['text'],attribution=author,sourceUrl=url,sourceSha256=hashlib.sha256(source).hexdigest(),originalDimensions=original_dimensions,annotationDimensions=[w,h],cropBox=box,annotationVertices=line['vertices']))
        parents.append(ident)
    if not rows:raise ValueError('No rights/geometry-qualified independent samples; no accuracy report')
    manifest=dict(schemaVersion=2,scope='independent_development',datasetId='hiertext-validation-six-source-development-v1',datasetVersion='annotation Git blob '+BLOB,publisher='Google Research HierText; Open Images/CVDF image hosting',officialSource='https://github.com/google-research-datasets/hiertext',rights='HierText annotations CC BY-SA 4.0; admitted image metadata CC BY 2.0; local research only, no media redistribution',permissionEvidence='Publisher README license and per-image attribution.csv License/Author/OriginalLandingURL',annotationProtocol='Publisher line transcription; first two legible non-handwritten horizontal ASCII lines from first six attributed source IDs in publisher file order; source resize to annotation dimensions, axis-aligned crop plus 2px. No OCR-based selection.',annotationProvenance='HierText validation JSON annotation with verified publisher Git blob; original labels, no synthetic labels',approvedBy='publisher-license-and-attribution-admission-code',approvedAt='2026-11-16',profiles=['baseline','upscale2','contrast'],rows=rows,annotationSha256=hashlib.sha256(compressed).hexdigest(),attributionSha256=hashlib.sha256(metadata).hexdigest(),exclusions=excluded,downloadedBytes=len(compressed)+len(metadata)+image_budget)
    (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(dict(admittedLines=len(rows),sourceImages=len(parents),downloadedBytes=manifest['downloadedBytes'],scope='independent development line crops; NOT screenshots or heldout evaluation')))
if __name__=='__main__':main()
