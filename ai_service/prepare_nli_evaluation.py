"""Freeze permitted noncommercial ANLI R1 research splits before model scoring.

Official ANLI v1.0 source; no arbitrary URLs, archive extraction or public text copies.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import time
from urllib.request import Request, urlopen
import zipfile

URL = 'https://dl.fbaipublicfiles.com/anli/anli_v1.0.zip'
MAX_BYTES = 24 * 1024 * 1024
LABELS = {'e': 'entailment', 'c': 'contradiction', 'n': 'neutral'}


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def normalized(text):
    return re.sub(r'\s+', ' ', text).strip().casefold()


def prepare(output):
    output = Path(output)
    if output.exists():
        raise ValueError('Refusing to overwrite frozen evaluation inputs')
    request = Request(URL, headers={'User-Agent': 'VERITAS-AI-noncommercial-NLI-evaluation'})
    with urlopen(request, timeout=30) as response:
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError('Dataset byte cap exceeded')
    archive = zipfile.ZipFile(io.BytesIO(data))
    all_splits = {}
    for role in ['development', 'held_out']:
        suffix = 'R1/' + ('dev.jsonl' if role == 'development' else 'test.jsonl')
        names = [name for name in archive.namelist() if name.endswith('/' + suffix)]
        if len(names) != 1 or archive.getinfo(names[0]).file_size > 4*1024*1024:
            raise ValueError('Unexpected official split archive layout/size')
        rows = [json.loads(line) for line in archive.read(names[0]).decode().splitlines()]
        if len(rows) != 1000:
            raise ValueError('Unexpected ANLI R1 split count')
        all_splits[role] = rows
    # Exclude every test premise seen anywhere in development, before label sampling.
    development_groups = {digest(normalized(row['context'] if 'context' in row else row['premise'])) for row in all_splits['development']}
    selected = []
    seen_groups = set()
    seen_pairs = set()
    seen_ids = set()
    excluded = {'premise_overlap': 0, 'duplicate': 0}
    for role, count in [('development', 40), ('held_out', 100)]:
        rows = sorted(all_splits[role], key=lambda row: digest('veritas-nli-v1:' + row['uid']))
        counts = dict.fromkeys(LABELS.values(), 0)
        for row in rows:
            premise = row.get('context', row.get('premise'))
            hypothesis = row.get('hypothesis')
            label = LABELS[row['label']]
            if not isinstance(premise, str) or not isinstance(hypothesis, str):
                raise ValueError('Invalid official pair schema')
            group = digest(normalized(premise))
            pair = digest(json.dumps([normalized(premise), normalized(hypothesis)]))
            if role == 'held_out' and group in development_groups:
                excluded['premise_overlap'] += 1
                continue
            if pair in seen_pairs or row['uid'] in seen_ids or group in seen_groups:
                excluded['duplicate'] += 1
                continue
            if counts[label] >= count:
                continue
            counts[label] += 1
            seen_pairs.add(pair)
            seen_ids.add(row['uid'])
            seen_groups.add(group)
            selected.append(dict(id=row['uid'], role=role, group=group, pairSha256=pair, premise=premise,
                                 hypothesis=hypothesis, label=label, language='en'))
            if all(value == count for value in counts.values()):
                break
        if not all(value == count for value in counts.values()):
            raise ValueError('Insufficient source-distinct examples for frozen class quota')
    result = dict(schemaVersion=1, source=URL, version='ANLI v1.0 R1', license='CC BY-NC 4.0',
                  purpose='Noncommercial local research only; no public source-text redistribution',
                  archiveSha256=hashlib.sha256(data).hexdigest(), archiveBytes=len(data), selectedAt=time.time(),
                  excluded=excluded, protocolSha256=hashlib.sha256(Path('test/fixtures/claims/nli_protocol.json').read_bytes()).hexdigest(),
                  rows=selected)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf8') as file:
        json.dump(result, file, ensure_ascii=False, indent=2)
    print(json.dumps({key: result[key] for key in ['version', 'archiveSha256', 'archiveBytes', 'excluded', 'protocolSha256']}))
    print('Frozen 120 development and 300 held-out labelled pairs; no model inference or source text printed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    prepare(parser.parse_args().output)
