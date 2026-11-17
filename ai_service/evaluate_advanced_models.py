"""Bounded offline comparison; failed outputs are retained, never production verdicts."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import statistics
import sys
import time
from ai_service.research_models import ResearchModel, MODELS
from ai_service.evaluate_nli import metrics, supervised_command
from ai_service.prepare_nli_evaluation import normalized, digest

PROTOCOL = Path('test/fixtures/claims/advanced_protocol.json')


def validate(data, kind):
    protocol = json.loads(PROTOCOL.read_bytes())
    if data.get('protocolSha256') != hashlib.sha256(PROTOCOL.read_bytes()).hexdigest():
        raise ValueError('PROTOCOL_MISMATCH')
    if kind == 'reranker':
        if len(data['rows']) != sum(protocol['retrieval']['roles'].values()):
            raise ValueError('QUOTA_MISMATCH')
        return
    ids, groups, pairs = set(), set(), set()
    if len(data['rows'])!=sum(protocol['nli']['roles'].values()):
        raise ValueError('QUOTA_MISMATCH')
    for row in data['rows']:
        if row['role'] not in protocol['nli']['roles'] or row['label'] not in ['contradiction','entailment','neutral'] or row.get('language')!='en':
            raise ValueError('ROLE_LABEL_OR_LANGUAGE')
        if row['id'] in ids or row['group'] in groups or row['pairSha256'] in pairs:
            raise ValueError('DUPLICATE_GROUP')
        if row['group'] != digest(normalized(row['premise'])) or row['pairSha256'] != digest(json.dumps([normalized(row['premise']), normalized(row['hypothesis'])])):
            raise ValueError('INPUT_HASH_MISMATCH')
        ids.add(row['id']); groups.add(row['group']); pairs.add(row['pairSha256'])
    for role, count in protocol['nli']['roles'].items():
        if any(sum(r['role'] == role and r['label'] == label for r in data['rows']) != count//3 for label in ['entailment', 'contradiction', 'neutral']):
            raise ValueError('QUOTA_MISMATCH')


def evaluate(kind, manifest, snapshot, output):
    if output.exists():
        raise ValueError('OUTPUT_EXISTS')
    raw = manifest.read_bytes()
    data = json.loads(raw)
    validate(data, kind)
    started = time.perf_counter()
    if kind == 'minilm':
        from ai_service.claim_nli import NliModel, MODEL_ID, REVISION
        model = NliModel(snapshot)
        identity = dict(id=MODEL_ID, revision=REVISION)
    else:
        model = ResearchModel(snapshot, kind)
        identity = {k: v for k, v in MODELS[kind].items() if k != 'files'}
        identity['parameters'] = model.parameters
    rows, times = [], []
    for row in data['rows']:
        if kind == 'reranker':
            candidates = []
            for item in row['items']:
                prediction = model.pair(row['claim'], item['title'] + ' ' + item['excerpt'])
                if prediction['status'] == 'executed':
                    times.append(prediction['elapsedMs'])
                candidates.append(dict(url=item['url'], passageSha256=hashlib.sha256(item['excerpt'].encode()).hexdigest(), **prediction))
            rows.append(dict(id=row['id'], role=row['role'], candidates=candidates))
        else:
            if kind == 'minilm':
                prediction = model.predict([dict(premise=row['premise'], hypothesis=row['hypothesis'], language='en')])[0]
            else:
                prediction = model.pair(row['premise'], row['hypothesis'])
                if prediction['status'] == 'executed':
                    prediction['scores'] = dict(zip(['contradiction', 'entailment', 'neutral'], prediction.pop('values')))
            saved = {k: row[k] for k in ['id', 'role', 'group', 'pairSha256', 'label']}
            saved.update(prediction)
            if prediction['status'] == 'executed':
                scores = sorted(prediction['scores'].items(), key=lambda item: item[1], reverse=True)
                saved.update(argmax=scores[0][0], accepted=scores[0][1] >= .9 and scores[0][1]-scores[1][1] >= .5)
                times.append(prediction['elapsedMs'])
            rows.append(saved)
    from ai_service.claim_nli import memory
    result = dict(schemaVersion=1, kind=kind, model=identity, manifestSha256=hashlib.sha256(raw).hexdigest(), protocolSha256=data['protocolSha256'], startupMs=model.startup_ms, elapsedMs=(time.perf_counter()-started)*1000, memory=memory(), latencyMs=dict(median=statistics.median(times) if times else None, p95=sorted(times)[math.ceil(.95*len(times))-1] if times else None), authoritativePromotion=False, rows=rows)
    if kind != 'reranker':
        result['splits'] = {role: metrics([r for r in rows if r['role'] == role]) for role in ['development', 'validation', 'held_out']}
        held = result['splits']['held_out']
        result['numericalCriteriaPassed'] = bool(held['macroF1'] >= .85 and held['acceptedCoverage'] >= .5 and held['acceptedAccuracyWilson95'] and held['acceptedAccuracyWilson95'][0] >= .95 and held['falseSupport']['acceptedRateWilson95'][1] <= .05 and held['falseContradiction']['acceptedRateWilson95'][1] <= .05)
    result['limitations'] = ['Research-only; no factual truth probabilities or production model replacement.', 'ANLI R2 is adversarial NLI, not target-domain fact verification; backbone/undisclosed training overlap unknown.', 'FEVER labels identify historical evidence pages, not relevance or stance of present lead extracts. Unlisted pages are unjudged.', 'Exact premise and near-claim checks cannot establish original article/topic independence.', 'Latency measured on this CPU with OS cache/load, not an SLA. Raw scores are uncalibrated.']
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf8') as file:
        json.dump(result, file, indent=2)
    print(json.dumps({k: v for k, v in result.items() if k not in ['rows', 'limitations']}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--kind', choices=['minilm', 'deberta', 'reranker'], required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--worker', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.worker:
        evaluate(args.kind, args.manifest, args.snapshot, args.output)
    else:
        if args.output.exists():
            raise ValueError('OUTPUT_EXISTS')
        code, output = supervised_command([sys.executable, '-m', 'ai_service.evaluate_advanced_models', '--worker', '--kind', args.kind, '--manifest', str(args.manifest), '--snapshot', str(args.snapshot), '--output', str(args.output)], timeout_seconds=600)
        print(output)
        raise SystemExit(code)
