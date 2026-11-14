"""Real-weight screening report with pinned data and explicit evaluation limits."""
import argparse
import hashlib
import io
import json
import os
import platform
import time
from pathlib import Path
from PIL import Image
from ai_service import community_model, face_service, app
from ai_service.evaluate_image import read_manifest, evaluate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    prepared = read_manifest(args.manifest)
    print("Loading pinned whole-image model", flush=True)
    network, transform = community_model.load()
    timings = []

    def fetch(_endpoint, raw):
        start = time.perf_counter()
        with Image.open(io.BytesIO(raw)) as image:
            from PIL import ImageOps
            image = ImageOps.exif_transpose(image).convert("RGB")
            if image.width * image.height > 24_000_000:
                raise ValueError("Image exceeds pixel bound")
            score = community_model.score(network, transform, image)
        timings.append(time.perf_counter() - start)
        return dict(model=community_model.MODEL_ID, revision=community_model.REVISION,
                    scope="general_ai_generated_image", classification="INCONCLUSIVE",
                    model_status="ready", fake_probability=score)

    report = evaluate(prepared, "direct-local", 0.5, fetch)
    print(f"Whole-image scoring complete: {len(prepared)} inputs", flush=True)
    report["manifest"] = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    report["manifest_sha256"] = hashlib.sha256(Path(args.manifest).read_bytes()).hexdigest()
    report["python"] = platform.python_version()
    import torch, timm, torchvision
    report["runtime"] = dict(torch=torch.__version__, timm=timm.__version__, torchvision=torchvision.__version__)
    report["mean_seconds"] = sum(timings) / len(timings) if timings else None
    report["face_screening"] = []
    os.environ["VERITAS_FACE_MODEL_ENABLED"] = "1"
    print("Loading pinned face model", flush=True)
    face_service.load_model()
    app.load_face_detector()
    if face_service.model is None or app.face_detector is None:
        raise RuntimeError("Face model and YuNet must load for this report")
    for sample, raw in prepared:
        if sample["domain"] != "Human":
            continue
        with Image.open(io.BytesIO(raw)) as image:
            from PIL import ImageOps
            image = ImageOps.exif_transpose(image).convert("RGB")
            status, boxes = app.detect_faces(image)
            evidence = face_service.analyze(image, boxes)
        report["face_screening"].append(dict(id=sample["id"], image_label=sample["label"],
                                              detection_status=status, evidence=evidence))
    report["face_evaluation_note"] = "Human real/generated labels do not label face manipulation; no manipulation accuracy metric is justified."
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("model", "splits", "test_domains", "mean_seconds")}), flush=True)
    print(f"Saved {target}", flush=True)
    if report["splits"]["test"]["failed_or_skipped"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
