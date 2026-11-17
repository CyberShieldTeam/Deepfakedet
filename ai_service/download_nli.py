"""Explicit bounded official checkpoint download. No runtime download or weight overwrite."""
import argparse
from pathlib import Path
import shutil
import tempfile
from urllib.request import urlopen, Request
from ai_service.claim_nli import FILES, MODEL_ID, REVISION, verify_file, verify_snapshot


def download(destination):
    destination = Path(destination)
    if destination.exists():
        verify_snapshot(destination)
        print('Pinned NLI snapshot already verified')
        return
    total = sum(row[0] for row in FILES.values())
    if shutil.disk_usage(destination.resolve().parent).free < total * 2:
        raise RuntimeError('Insufficient disk headroom')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='nli-download-', dir=destination.parent) as scratch:
        for name, (size, _, _) in FILES.items():
            file = Path(scratch) / name
            request = Request(f'https://huggingface.co/{MODEL_ID}/resolve/{REVISION}/{name}', headers={'User-Agent': 'VERITAS-AI-pinned-NLI-research'})
            with urlopen(request, timeout=30) as response, file.open('xb') as out:
                remaining = size
                while remaining:
                    chunk = response.read(min(1024*1024, remaining))
                    if not chunk:
                        raise RuntimeError('Truncated checkpoint file')
                    out.write(chunk)
                    remaining -= len(chunk)
                if response.read(1):
                    raise RuntimeError('Checkpoint file exceeds pinned size')
            verify_file(file, name)
            print(f'Verified {name}: {size} bytes', flush=True)
        Path(scratch).rename(destination)
    print(f'Pinned snapshot ready: {total} bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    download(parser.parse_args().output)
