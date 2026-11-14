"""Download the pinned OpenCV Zoo YuNet model into the ignored local model directory."""
import hashlib
from pathlib import Path
from urllib.request import urlopen

URL = ("https://media.githubusercontent.com/media/opencv/opencv_zoo/"
       "47534e27c9851bb1128ccc0102f1145e27f23f98/"
       "models/face_detection_yunet/face_detection_yunet_2023mar.onnx")
DEST = Path(__file__).resolve().parent / "models" / "face_detection_yunet_2023mar.onnx"
SHA256 = "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"


def main():
    if DEST.is_file() and hashlib.sha256(DEST.read_bytes()).hexdigest() == SHA256:
        print(f"YuNet already verified at {DEST}")
        return
    with urlopen(URL, timeout=30) as response:
        payload = response.read(1_000_000)
    if not 100_000 <= len(payload) <= 500_000:
        raise RuntimeError(f"Unexpected YuNet download size: {len(payload)} bytes")
    digest = hashlib.sha256(payload).hexdigest()
    if digest != SHA256:
        raise RuntimeError(f"YuNet checksum mismatch: {digest}")
    print(f"YuNet bytes={len(payload)} sha256={digest}")
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_bytes(payload)


if __name__ == "__main__":
    main()
