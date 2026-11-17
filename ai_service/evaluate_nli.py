"""Frozen ANLI research evaluation. No fitting; public report excludes dataset passages."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import statistics
import subprocess
import sys
import time
from ai_service.claim_nli import NliModel, MODEL_ID, REVISION, memory


def supervised_command(command, timeout_seconds=600):
    """Deadline also terminates Windows venv interpreter descendants."""
    from ai_service.diagnose_image_runtime import _terminate_tree
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    try:
        output, _ = process.communicate(timeout=timeout_seconds)
        return process.returncode, output[-65536:]
    except subprocess.TimeoutExpired:
        _terminate_tree(process)
        try:
            process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        return 124, 'NLI evaluation deadline exceeded; owned process tree terminated; no completed benchmark claimed.'

LABELS = ['contradiction', 'entailment', 'neutral']


def wilson(success, total):
    if not total:
        return None
    z = 1.959963984540054
    p = success / total
    denominator = 1 + z*z/total
    center = (p + z*z/(2*total))/denominator
    half = z*math.sqrt(p*(1-p)/total+z*z/(4*total*total))/denominator
    return [max(0, center-half), min(1, center+half)]


def metrics(rows):
    executed = [row for row in rows if row['status'] == 'executed']
    matrix = [[0]*3 for _ in range(3)]
    for row in executed:
        matrix[LABELS.index(row['label'])][LABELS.index(row['argmax'])] += 1
    classes = {}
    f1s = []
    for i, label in enumerate(LABELS):
        tp, actual, predicted = matrix[i][i], sum(matrix[i]), sum(row[i] for row in matrix)
        precision = tp/predicted if predicted else None
        recall = tp/actual if actual else None
        f1 = 2*tp/(actual+predicted) if actual+predicted else 0
        classes[label] = dict(precision=precision, recall=recall, f1=f1, actualExecuted=actual, predicted=predicted)
        f1s.append(f1)
    accepted = [row for row in executed if row['accepted']]
    correct = sum(row['argmax'] == row['label'] for row in executed)
    accepted_correct = sum(row['argmax'] == row['label'] for row in accepted)
    false = {}
    for label, name in [('entailment', 'falseSupport'), ('contradiction', 'falseContradiction')]:
        negatives = sum(row['label'] != label for row in rows)
        all_fp = sum(row['label'] != label and row.get('argmax') == label for row in executed)
        accepted_fp = sum(row['label'] != label and row['argmax'] == label for row in accepted)
        suggested = sum(row['argmax'] == label for row in accepted)
        false[name] = dict(argmaxCount=all_fp, negatives=negatives, argmaxRate=all_fp/negatives if negatives else None,
                           acceptedCount=accepted_fp, acceptedRate=accepted_fp/negatives if negatives else None,
                           acceptedRateWilson95=wilson(accepted_fp, negatives), acceptedSuggestions=suggested,
                           acceptedErrorFraction=accepted_fp/suggested if suggested else None)
    return dict(total=len(rows), executed=len(executed), skipped=len(rows)-len(executed),
                classDistribution={label: sum(row['label'] == label for row in rows) for label in LABELS},
                confusionMatrix=matrix, confusionOrder=LABELS, accuracy=correct/len(executed) if executed else None,
                accuracyWilson95=wilson(correct, len(executed)), accuracyAllSelected=correct/len(rows) if rows else None,
                macroF1=statistics.mean(f1s), perClass=classes, **false,
                accepted=len(accepted), acceptedCoverage=len(accepted)/len(rows) if rows else 0,
                acceptedAccuracy=accepted_correct/len(accepted) if accepted else None,
                acceptedAccuracyWilson95=wilson(accepted_correct, len(accepted)))


def validate_manifest(data, protocol_bytes):
    if data['protocolSha256'] != hashlib.sha256(protocol_bytes).hexdigest():
        raise ValueError('Evaluation protocol changed after sample freeze')
    seen_ids, seen_pairs, groups = set(), set(), {}
    for row in data['rows']:
        if row['role'] not in ['development', 'held_out'] or row['id'] in seen_ids or row['pairSha256'] in seen_pairs:
            raise ValueError('Invalid role or duplicate sample')
        if row['label'] not in LABELS or row['language'] != 'en':
            raise ValueError('Unsupported benchmark label/language')
        group = hashlib.sha256(__import__('re').sub(r'\s+', ' ', row['premise']).strip().casefold().encode()).hexdigest()
        if group != row['group']:
            raise ValueError('Premise group fingerprint mismatch')
        if row['group'] in groups:
            raise ValueError('Repeated premise/source group')
        if hashlib.sha256(json.dumps([__import__('re').sub(r'\s+', ' ', row['premise']).strip().casefold(), __import__('re').sub(r'\s+', ' ', row['hypothesis']).strip().casefold()]).encode()).hexdigest() != row['pairSha256']:
            raise ValueError('Pair integrity mismatch')
        seen_ids.add(row['id']);seen_pairs.add(row['pairSha256']);groups[row['group']] = row['role']
    for role, count in [('development', 40), ('held_out', 100)]:
        if any(sum(row['role'] == role and row['label'] == label for row in data['rows']) != count for label in LABELS):
            raise ValueError('Frozen class quota changed')


def evaluate(manifest, snapshot, output):
    if output.exists():
        raise ValueError('Refusing to overwrite evaluation report')
    protocol_bytes = Path('test/fixtures/claims/nli_protocol.json').read_bytes()
    protocol = json.loads(protocol_bytes)
    raw = manifest.read_bytes(); data = json.loads(raw)
    validate_manifest(data, protocol_bytes)
    model = NliModel(snapshot)
    rows, timings = [], []
    started = time.perf_counter()
    for row in data['rows']:
        t = time.perf_counter()
        try:
            result = model.predict([dict(premise=row['premise'], hypothesis=row['hypothesis'], language='en')])[0]
        except Exception as error:
            result = {'status': 'input_over_limit' if str(error) == 'CHARACTER_LIMIT' else 'failed',
                      'errorCategory': 'CHARACTER_LIMIT' if str(error) == 'CHARACTER_LIMIT' else 'INFERENCE_FAILED'}
        saved = {key: row[key] for key in ['id', 'role', 'group', 'pairSha256', 'label']}
        saved.update(result)
        if result['status'] == 'executed':
            scores = sorted(result['scores'].items(), key=lambda item: item[1], reverse=True)
            saved.update(argmax=scores[0][0], accepted=scores[0][1] >= protocol['minimumRawScoreForSuggestion'] and
                         scores[0][1]-scores[1][1] >= protocol['minimumRawScoreMargin'])
        timings.append((time.perf_counter()-t)*1000)
        rows.append(saved)
    splits = {role: metrics([row for row in rows if row['role'] == role]) for role in ['development', 'held_out']}
    held = splits['held_out']; criteria = protocol['promotionCriteria']
    numeric = (held['macroF1'] >= criteria['threeClassMacroF1AtLeast'] and
               held['falseSupport']['acceptedRateWilson95'][1] <= criteria['falseSupportWilson95UpperAtMost'] and
               held['falseContradiction']['acceptedRateWilson95'][1] <= criteria['falseContradictionWilson95UpperAtMost'] and
               held['acceptedCoverage'] >= criteria['acceptedCoverageAtLeast'] and
               held['acceptedAccuracyWilson95'] is not None and held['acceptedAccuracyWilson95'][0] >= criteria['acceptedAccuracyWilson95LowerAtLeast'])
    result = dict(schemaVersion=1, modelId=MODEL_ID, version=REVISION, protocol=protocol,
                  manifestSha256=hashlib.sha256(raw).hexdigest(), archiveSha256=data['archiveSha256'],
                  source=data['source'], datasetVersion=data['version'], license=data['license'], excluded=data['excluded'],
                  startupMs=model.startup_ms, elapsedMs=(time.perf_counter()-started)*1000, memory=memory(),
                  latencyMs={'median': statistics.median(timings), 'mean': statistics.mean(timings), 'p95': sorted(timings)[math.ceil(.95*len(timings))-1]},
                  splits=splits, numericalCriteriaPassed=numeric, authoritativePromotion=False,
                  decision='Experimental only. Human review remains decisive. No independent target-domain or multilingual validation.',
                  limitations=['ANLI is external, human-labelled adversarial English NLI, not real-world factual verification accuracy.',
                               'Declared model fine-tuning used SNLI/MultiNLI; undisclosed training and backbone overlap remain unknown.',
                               'Unique exact premise groups do not establish disjoint entities, original articles or topics.',
                               'Confusion/three-class metrics use executed pairs; all-selected accuracy and abstention denominators include skipped pairs.',
                               'Wilson intervals assume independent pairs and do not capture dataset-selection or unknown source dependence.'],
                  rows=rows)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf8') as file:
        json.dump(result, file, indent=2)
    print(json.dumps({key: result[key] for key in ['splits', 'numericalCriteriaPassed', 'authoritativePromotion', 'startupMs', 'latencyMs', 'memory']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--worker', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.worker:
        evaluate(args.manifest, args.snapshot, args.output)
    else:
        if args.output.exists():
            raise ValueError('Refusing to overwrite evaluation report')
        code, output = supervised_command([sys.executable, '-m', 'ai_service.evaluate_nli', '--worker',
                                           '--manifest', str(args.manifest), '--snapshot', str(args.snapshot), '--output', str(args.output)])
        print(output, end='\n' if not output.endswith('\n') else '')
        raise SystemExit(code)
