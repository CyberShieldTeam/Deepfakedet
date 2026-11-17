"""Freeze bounded, licensed research inputs, never print or commit dataset passages."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen
import zipfile
from ai_service.prepare_nli_evaluation import normalized, digest, LABELS

PROTOCOL = Path('test/fixtures/claims/advanced_protocol.json')


def tokens(text):
    return set(re.findall(r'\w+', normalized(text)))


def near(text, earlier):
    value = tokens(text)
    return any(len(value & other) / max(1, len(value | other)) >= .8 for other in earlier)


def get(url, cap):
    with urlopen(Request(url, headers={'User-Agent': 'VERITAS-AI-research'}), timeout=30) as response:
        data = response.read(cap + 1)
    if len(data) > cap:
        raise ValueError('DATASET_BYTE_LIMIT')
    return data


def prepare(kind, output, previous=None, protocol_path=PROTOCOL):
    if output.exists():
        raise ValueError('FROZEN_OUTPUT_EXISTS')
    protocol = json.loads(protocol_path.read_text())
    section = protocol['retrieval' if kind == 'fever' else 'nli']
    rows, groups, pairs, previous_hypotheses, history = [], set(), set(), set(), []
    if kind == 'fever':
        if previous:
            old = json.loads(previous.read_text(encoding='utf8'))
            for row in old['rows']:
                groups.update(row['pages'])
                pairs.add(digest(normalized(row['claim'])))
                history.append(tokens(row['claim']))
        url = 'https://fever.ai/download/fever/shared_task_dev.jsonl'
        raw = get(url, 16 * 1024 * 1024)
        pool = [json.loads(line) for line in raw.decode().splitlines()]
        if len(pool) != 19998:
            raise ValueError('UNEXPECTED_FEVER_COUNT')
        pool.sort(key=lambda row: digest(section['seed'] + str(row['id'])))
        for role, quota in section['roles'].items():
            count = 0
            for row in pool:
                pages = sorted({e[2] for group in row['evidence'] for e in group if e[2] is not None})
                claim = row['claim']
                if row['label'] not in ['SUPPORTS', 'REFUTES'] or not pages or any(p in groups for p in pages) or digest(normalized(claim)) in pairs or near(claim, history):
                    continue
                rows.append(dict(id=str(row['id']), role=role, claim=claim, pages=pages, label=row['label']))
                groups.update(pages)
                pairs.add(digest(normalized(claim)))
                history.append(tokens(claim))
                count += 1
                if count == quota:
                    break
            if count != quota:
                raise ValueError('QUOTA_NOT_MET')
        license_text = 'Wikipedia applicable terms / CC BY-SA 3.0 fallback; https://fever.ai/download/fever/license.html'
    else:
        if not previous:
            raise ValueError('PREVIOUS_EVALUATION_REQUIRED')
        old = json.loads(previous.read_text(encoding='utf8'))
        for row in old['rows']:
            groups.add(digest(normalized(row['premise'])))
            previous_hypotheses.add(digest(normalized(row['hypothesis'])))
            history.append(tokens(row['hypothesis']))
        url = 'https://dl.fbaipublicfiles.com/anli/anli_v1.0.zip'
        raw = get(url, 24 * 1024 * 1024)
        archive = zipfile.ZipFile(io.BytesIO(raw))
        pools = {}
        for role, filename in [('dev', 'dev.jsonl'), ('test', 'test.jsonl')]:
            names = [n for n in archive.namelist() if n.endswith('/R2/' + filename)]
            if len(names) != 1 or archive.getinfo(names[0]).file_size > 4*1024*1024:
                raise ValueError('ARCHIVE_LAYOUT')
            pools[role] = [json.loads(line) for line in archive.read(names[0]).decode().splitlines()]
            pools[role].sort(key=lambda row: digest(section['seed'] + row['uid']))
        dev_groups = {digest(normalized(r['context'])) for r in pools['dev']}
        seen_ids = {row['id'] for row in old['rows']}
        for role, quota in section['roles'].items():
            counts = dict.fromkeys(LABELS.values(), 0)
            for row in pools['test' if role == 'held_out' else 'dev']:
                premise, hypothesis = row['context'], row['hypothesis']
                group, pair = digest(normalized(premise)), digest(json.dumps([normalized(premise), normalized(hypothesis)]))
                label = LABELS[row['label']]
                if counts[label] >= quota//3 or group in groups or pair in pairs or row['uid'] in seen_ids or digest(normalized(hypothesis)) in previous_hypotheses or near(hypothesis, history) or (role == 'held_out' and group in dev_groups):
                    continue
                counts[label] += 1
                rows.append(dict(id=row['uid'], role=role, group=group, pairSha256=pair, premise=premise, hypothesis=hypothesis, label=label, language='en'))
                groups.add(group)
                pairs.add(pair)
                seen_ids.add(row['uid'])
                history.append(tokens(hypothesis))
                if sum(counts.values()) == quota:
                    break
            if sum(counts.values()) != quota:
                raise ValueError('QUOTA_NOT_MET')
        license_text = 'CC BY-NC 4.0; local noncommercial research only'
    result = dict(schemaVersion=1, kind=kind, source=url, license=license_text, datasetSha256=hashlib.sha256(raw).hexdigest(), datasetBytes=len(raw), protocolSha256=hashlib.sha256(protocol_path.read_bytes()).hexdigest(), excludedManifestSha256=hashlib.sha256(previous.read_bytes()).hexdigest() if previous else None, rows=rows)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf8') as file:
        json.dump(result, file, ensure_ascii=False, indent=2)
    print(json.dumps({k: v for k, v in result.items() if k != 'rows'}))
    print(json.dumps({'frozenRows': len(rows), 'roles': section['roles']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--kind', choices=['fever', 'anli'], required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--previous', type=Path)
    parser.add_argument('--protocol', type=Path, default=PROTOCOL)
    args = parser.parse_args()
    prepare(args.kind, args.output, args.previous, args.protocol)
