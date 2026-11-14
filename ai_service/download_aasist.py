"""Download the official pinned AASIST checkpoint into the ignored model cache."""
import hashlib
from pathlib import Path
from urllib.request import urlopen

from ai_service.audio_service import MODEL_REVISION, WEIGHTS, WEIGHTS_SHA256

URL = f"https://raw.githubusercontent.com/clovaai/aasist/{MODEL_REVISION}/models/weights/AASIST.pth"


def main():
    if WEIGHTS.is_file() and hashlib.sha256(WEIGHTS.read_bytes()).hexdigest() == WEIGHTS_SHA256:
        print(f"AASIST already verified at {WEIGHTS}")
        return
    with urlopen(URL, timeout=30) as response:
        payload = response.read(2_000_000)
    if not 1_000_000 <= len(payload) <= 1_500_000:
        raise RuntimeError(f"Unexpected AASIST checkpoint size: {len(payload)}")
    digest = hashlib.sha256(payload).hexdigest()
    if digest != WEIGHTS_SHA256:
        raise RuntimeError(f"AASIST checksum mismatch: {digest}")
    WEIGHTS.parent.mkdir(parents=True, exist_ok=True)
    WEIGHTS.write_bytes(payload)
    print(f"AASIST bytes={len(payload)} sha256={digest}")


if __name__ == "__main__":
    main()
