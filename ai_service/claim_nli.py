"""Pinned English NLI research worker. Offline runtime, exact pairs, no factual verdicts."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import time

MODEL_ID = 'cross-encoder/nli-MiniLM2-L6-H768'
REVISION = 'b95119ce93d3e065de6214e38cd4a97b0f2f2c6d'
LABELS = ['contradiction', 'entailment', 'neutral']
MAX_TOKENS = 512
MAX_PAIRS = 8
FILES = {
    'model.safetensors': (328499560, 'sha256', 'ec9c5b6a08b60d7a01b465c7ed44b496244dfd1bed3274c95875a74cea89ab35'),
    'config.json': (875, 'git', 'f3d2c8b047a34c20737866987ba16ea6114c7b53'),
    'tokenizer.json': (1356048, 'git', '8df0092a08e1d459f60ec541e08cd35a16362bfe'),
    'tokenizer_config.json': (330, 'git', '6c26b0317aae78dbce2c8f06dbf846c6e9dd4145'),
    'special_tokens_map.json': (239, 'git', '2ea7ad0e45a9d1d1591782ba7e29a703d0758831'),
    'vocab.json': (798293, 'git', '4ebe4bb3f3114daf2e4cc349f24873a1175a35d7'),
    'merges.txt': (456356, 'git', '6636bda4a1fd7a63653dffb22683b8162c8de956'),
}


def verify_file(path, name):
    size, kind, expected = FILES[name]
    if path.stat().st_size != size:
        raise ValueError('PINNED_SIZE_MISMATCH')
    with path.open('rb') as stream:
        if kind == 'sha256':
            actual = hashlib.file_digest(stream, 'sha256').hexdigest()
        else:
            digest = hashlib.sha1(b'blob ' + str(size).encode() + b'\0')
            digest.update(stream.read())
            actual = digest.hexdigest()
    if actual != expected:
        raise ValueError('PINNED_HASH_MISMATCH')


def verify_snapshot(path):
    for name in FILES:
        verify_file(Path(path) / name, name)


def memory():
    import psutil
    info = psutil.Process().memory_info()
    return {'rssBytes': info.rss, 'peakWorkingSetBytes': getattr(info, 'peak_wset', None)}


class NliModel:
    def __init__(self, path):
        started = time.perf_counter()
        import psutil
        # Engineering admission estimate: ~0.31 GiB parameters, loading/runtime,
        # bounded one-pair activations and OS margin. Not a measured universal minimum.
        if psutil.virtual_memory().available < 1.5 * 2**30:
            raise RuntimeError('INSUFFICIENT_MEMORY_HEADROOM')
        verify_snapshot(path)
        os.environ['HF_HUB_OFFLINE'] = '1'
        os.environ['TRANSFORMERS_OFFLINE'] = '1'
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
        torch.set_num_threads(2)
        self.torch = torch
        self.tokenizer = AutoTokenizer.from_pretrained(path, local_files_only=True, trust_remote_code=False)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            path, local_files_only=True, use_safetensors=True, trust_remote_code=False).eval()
        if [self.model.config.id2label.get(i) for i in range(3)] != LABELS:
            raise ValueError('UNEXPECTED_LABEL_MAPPING')
        self.startup_ms = (time.perf_counter() - started) * 1000

    def predict(self, pairs):
        if not isinstance(pairs, list) or not 1 <= len(pairs) <= MAX_PAIRS:
            raise ValueError('PAIR_LIMIT')
        result = []
        for pair in pairs:
            if not isinstance(pair, dict) or set(pair) != {'premise', 'hypothesis', 'language'}:
                raise ValueError('INVALID_PAIR')
            if not all(isinstance(pair[k], str) for k in pair):
                raise ValueError('INVALID_PAIR')
            if not 1 <= len(pair['premise']) <= 10000 or not 1 <= len(pair['hypothesis']) <= 1000:
                raise ValueError('CHARACTER_LIMIT')
            if pair['language'] != 'en':
                result.append({'status': 'unsupported_language'})
                continue
            start = time.perf_counter()
            tokens = self.tokenizer(pair['premise'], pair['hypothesis'], truncation=False)
            if len(tokens['input_ids']) > MAX_TOKENS:
                result.append({'status': 'input_over_limit', 'tokens': len(tokens['input_ids'])})
                continue
            # One pair at a time: maximum activation batch one, bounded to 512 tokens.
            batch = {key: self.torch.tensor([value]) for key, value in tokens.items()}
            with self.torch.inference_mode():
                scores = self.torch.softmax(self.model(**batch).logits[0], dim=-1).tolist()
            if not all(__import__('math').isfinite(x) for x in scores):
                raise ValueError('NONFINITE_OUTPUT')
            result.append({'status': 'executed', 'scores': dict(zip(LABELS, scores)),
                           'tokens': len(tokens['input_ids']), 'elapsedMs': (time.perf_counter()-start)*1000})
        return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--worker', action='store_true', required=True)
    parser.add_argument('--snapshot', type=Path, required=True)
    args = parser.parse_args()
    try:
        model = NliModel(args.snapshot)
    except Exception as error:
        category = str(error) if str(error) in ['INSUFFICIENT_MEMORY_HEADROOM', 'PINNED_SIZE_MISMATCH', 'PINNED_HASH_MISMATCH', 'UNEXPECTED_LABEL_MAPPING'] else 'SNAPSHOT_MISSING' if isinstance(error, FileNotFoundError) else 'MODEL_LOAD_FAILED'
        print(json.dumps({'event': 'unavailable', 'category': category}), flush=True)
        return 1
    print(json.dumps({'event': 'ready', 'modelId': MODEL_ID, 'version': REVISION,
                      'startupMs': model.startup_ms, 'memory': memory()}), flush=True)
    while True:
        line = sys.stdin.buffer.readline(65537)
        if not line:
            break
        if len(line) > 65536 or not line.endswith(b'\n'):
            return 1
        request_id = None
        start = time.perf_counter()
        try:
            request = json.loads(line)
            if set(request) != {'requestId', 'pairs'} or not isinstance(request['requestId'], str) or len(request['requestId']) > 80:
                raise ValueError('INVALID_REQUEST')
            request_id = request['requestId']
            results = model.predict(request['pairs'])
            reply = {'requestId': request_id, 'results': results, 'elapsedMs': (time.perf_counter()-start)*1000, 'memory': memory()}
        except Exception:
            reply = {'requestId': request_id, 'error': 'INFERENCE_FAILED'}
        print(json.dumps(reply), flush=True)
        # No cross-user text cache. Release the last serialized request after output.
        if 'request' in locals():
            del request
        del reply, line
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
