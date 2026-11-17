"""Freeze a small documented SciFact relevance evaluation; dataset text stays private."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile
from ai_service.prepare_advanced_evaluation import get, near, tokens
from ai_service.prepare_nli_evaluation import digest

PROTOCOL = Path('test/fixtures/claims/scifact_protocol.json')


def prepare(output, archive_path=None):
    if output.exists():
        raise ValueError('OUTPUT_EXISTS')
    protocol = json.loads(PROTOCOL.read_bytes())
    if archive_path and archive_path.stat().st_size > 8*1024*1024:
        raise ValueError('ARCHIVE_BYTE_LIMIT')
    raw = archive_path.read_bytes() if archive_path else get(protocol['source'], 8*1024*1024)
    if hashlib.md5(raw).hexdigest() != protocol['publisherMd5']:
        raise ValueError('PUBLISHER_ARCHIVE_IDENTITY_MISMATCH')
    archive = zipfile.ZipFile(io.BytesIO(raw))
    def read(suffix, cap):
        names = [n for n in archive.namelist() if n.endswith('/'+suffix)]
        if len(names) != 1 or archive.getinfo(names[0]).file_size > cap:
            raise ValueError('ARCHIVE_LAYOUT_OR_SIZE')
        return archive.read(names[0]).decode()
    corpus = [json.loads(line) for line in read('corpus.jsonl', 16*1024*1024).splitlines()]
    queries = {r['_id']: r['text'] for r in map(json.loads, read('queries.jsonl', 1024*1024).splitlines())}
    if len(corpus) != 5183:
        raise ValueError('UNEXPECTED_CORPUS_SIZE')
    qrels = {}
    for line in read('qrels/test.tsv', 1024*1024).splitlines()[1:]:
        query, document, score = line.split('\t')
        qrels.setdefault(query, {})[document] = int(score)
    rows, groups, history, ids = [], set(), [], set()
    pool = sorted(qrels, key=lambda q: digest(protocol['seed']+q))
    for role, quota in protocol['roles'].items():
        count = 0
        for query in pool:
            positive = {d for d, score in qrels[query].items() if score > 0}
            if query in ids or groups & positive or near(queries[query], history):
                continue
            rows.append(dict(id=query, role=role, claim=queries[query], judgments=qrels[query]))
            groups.update(positive); history.append(tokens(queries[query])); ids.add(query)
            count += 1
            if count == quota:
                break
        if count != quota:
            raise ValueError('QUOTA')
    result = dict(source=protocol['source'], archiveSha256=hashlib.sha256(raw).hexdigest(), archiveBytes=len(raw), publisherMd5=protocol['publisherMd5'], license='SciFact claims/annotations CC BY 4.0; S2ORC abstracts ODC-By 1.0; https://github.com/allenai/scifact/blob/master/LICENSE.md', protocolSha256=hashlib.sha256(PROTOCOL.read_bytes()).hexdigest(), corpus=corpus, rows=rows)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf8') as file:
        json.dump(result, file, ensure_ascii=False)
    print(json.dumps({k:v for k,v in result.items() if k not in ['rows','corpus']}))
    print(json.dumps({'corpus':len(corpus),'queries':len(rows)}))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--output', type=Path, required=True); parser.add_argument('--archive',type=Path)
    args=parser.parse_args();prepare(args.output,args.archive)
