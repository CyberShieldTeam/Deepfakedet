"""Explicit, pinned research snapshots. Never downloads from application inference."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
from urllib.request import Request, urlopen

MODELS = {
    'reranker': {
        'id': 'cross-encoder/ms-marco-MiniLM-L6-v2',
        'revision': '233902d25c440f23af6f7d6e94d2946bac0bee0a',
        'license': 'Apache-2.0', 'minimumFreeGiB': 1.5,
        'files': {
            'model.safetensors': (90870598, 'sha256', '821d1aa69520101d6e0737f78a042ae25b19e5cb9160701909d10434f4aeb0ae'),
            'config.json': (794, 'git', '88bc4f74b33a2073abc9a66cb532b889448ac3ed'),
            'tokenizer.json': (711396, 'git', '688882a79f44442ddc1f60d70334a7ff5df0fb47'),
            'tokenizer_config.json': (1330, 'git', 'a2435fedfac32b9ad70f052d4f84007730cd3109'),
            'special_tokens_map.json': (132, 'git', '7520992f25914d962f0e2fd0e0566fc33d19ec59'),
            'vocab.txt': (231508, 'git', 'fb140275c155a9c7c5a3b3e0e77a9e839594a938'),
        },
    },
    'deberta': {
        'id': 'cross-encoder/nli-deberta-v3-small',
        'revision': 'fa2804872c3b4bd748f38c0185cc85775361e735',
        'license': 'Apache-2.0', 'minimumFreeGiB': 2.5,
        'files': {
            'model.safetensors': (567605820, 'sha256', 'ebc79588dd73ccfb6a3f6078519cfbf512c5305384c5ea1845bc71cd32216e86'),
            'config.json': (1052, 'git', '69a0f734d3ab525dc1eb951b46f1d0f7dd52230c'),
            'tokenizer.json': (8656624, 'git', '12cc2e86bad0e731393847b017b32a7405ebd4f8'),
            'tokenizer_config.json': (1346, 'git', '734481711f0d172bd376a6d06c545286d58d8159'),
            'special_tokens_map.json': (301, 'git', '21ee423233314af53c84b2a229398f8b425672f5'),
            'spm.model': (2464616, 'sha256', 'c679fbf93643d19aab7ee10c0b99e460bdbc02fedf34b92b05af343b4af586fd'),
        },
    },
}


def verify(path, name, spec):
    size, kind, expected = spec
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


def snapshot(path, kind):
    for name, spec in MODELS[kind]['files'].items():
        verify(Path(path) / name, name, spec)


def download(path, kind):
    path = Path(path)
    spec = MODELS[kind]
    if path.exists():
        snapshot(path, kind)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    total = sum(row[0] for row in spec['files'].values())
    if shutil.disk_usage(path.parent).free < 2 * total:
        raise RuntimeError('DISK_HEADROOM')
    with tempfile.TemporaryDirectory(prefix='research-download-', dir=path.parent) as scratch:
        for name, file_spec in spec['files'].items():
            request = Request(f"https://huggingface.co/{spec['id']}/resolve/{spec['revision']}/{name}", headers={'User-Agent': 'VERITAS-AI-bounded-research'})
            target = Path(scratch) / name
            with urlopen(request, timeout=30) as response, target.open('xb') as output:
                remaining = file_spec[0]
                while remaining:
                    block = response.read(min(1048576, remaining))
                    if not block:
                        raise ValueError('TRUNCATED_DOWNLOAD')
                    output.write(block)
                    remaining -= len(block)
                if response.read(1):
                    raise ValueError('DOWNLOAD_SIZE_LIMIT')
            verify(target, name, file_spec)
            print(json.dumps({'model': kind, 'verified': name, 'bytes': file_spec[0]}), flush=True)
        Path(scratch).rename(path)


class ResearchModel:
    """Offline CPU evaluation only. No implicit truncation, calibration or promotion."""
    def __init__(self, path, kind):
        import os
        import time
        import psutil
        start = time.perf_counter()
        if psutil.virtual_memory().available < MODELS[kind]['minimumFreeGiB'] * 2**30:
            raise RuntimeError('INSUFFICIENT_MEMORY_HEADROOM')
        snapshot(path, kind)
        os.environ['HF_HUB_OFFLINE'] = '1'
        os.environ['TRANSFORMERS_OFFLINE'] = '1'
        import torch
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        torch.set_num_threads(2)
        self.torch, self.kind = torch, kind
        self.tokenizer = AutoTokenizer.from_pretrained(path, local_files_only=True, trust_remote_code=False)
        self.model = AutoModelForSequenceClassification.from_pretrained(path, local_files_only=True, trust_remote_code=False, use_safetensors=True).eval()
        expected = ['LABEL_0'] if kind == 'reranker' else ['contradiction', 'entailment', 'neutral']
        if [self.model.config.id2label[i] for i in range(len(expected))] != expected or self.model.config.num_labels != len(expected):
            raise ValueError('LABEL_MAPPING')
        self.startup_ms = (time.perf_counter() - start) * 1000
        self.parameters = sum(p.numel() for p in self.model.parameters())

    def pair(self, first, second):
        import time
        start = time.perf_counter()
        if not isinstance(first, str) or not isinstance(second, str) or not 1 <= len(first) <= 10000 or not 1 <= len(second) <= 10000:
            return {'status': 'input_over_limit'}
        features = self.tokenizer(first, second, truncation=False)
        count = len(features['input_ids'])
        if count > 512:
            return {'status': 'input_over_limit', 'tokens': count}
        batch = {key: self.torch.tensor([value]) for key, value in features.items()}
        with self.torch.inference_mode():
            logits = self.model(**batch).logits[0]
            values = logits.tolist() if self.kind == 'reranker' else self.torch.softmax(logits, dim=-1).tolist()
        if not all(__import__('math').isfinite(v) for v in values):
            raise ValueError('NONFINITE_OUTPUT')
        return {'status': 'executed', 'values': values, 'tokens': count, 'elapsedMs': (time.perf_counter()-start)*1000}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--download', choices=MODELS, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    download(args.output, args.download)
