"""Check YuNet face detections on the existing image fixtures; not a face benchmark."""
import json
from pathlib import Path

from PIL import Image
from ai_service import app as service


def main():
    print("Loading face detector", flush=True)
    service.load_face_detector()
    print("Face detector loaded", service.face_detector is not None, flush=True)
    if service.face_detector is None:
        raise RuntimeError("YuNet weights missing or incompatible")
    root = Path(__file__).resolve().parents[1] / "test" / "fixtures"
    paths = sorted((root / "eval").rglob("*")) + sorted((root / "face").rglob("*"))
    for path in paths:
        if path.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        print("Checking", path.name, flush=True)
        with Image.open(path) as source:
            status, boxes = service.detect_faces(source.convert("RGB"))
        print(json.dumps({"file": path.name, "face_status": status, "boxes": boxes}), flush=True)


if __name__ == "__main__":
    main()
