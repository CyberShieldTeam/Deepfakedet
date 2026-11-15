"""Reproducible image-model score collection with an explicit benchmark eligibility gate."""
import argparse
import asyncio
import base64
import hashlib
import json
import os
import platform
import subprocess
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

TASK_LABELS = {"general_image": {"real", "synthetic"},
               "face_manipulation": {"unaltered", "manipulated"}}
MIN_HOLDOUT_PER_CLASS = 20
MIN_HOLDOUT_GROUPS_PER_CLASS = 5


def load_manifest(path: Path, root: Path):
    rows = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(rows, list) or not rows:
        raise ValueError("Manifest must contain a nonempty list")
    resolved_root = root.resolve()
    seen_files = set()
    groups = defaultdict(set)
    hashes = defaultdict(set)
    checked = []
    for row in rows:
        if not isinstance(row, dict) or row.get("task") not in TASK_LABELS or \
           row.get("label") not in TASK_LABELS[row["task"]] or \
           row.get("split") not in {"train", "validation", "holdout", "smoke"} or \
           not all(isinstance(row.get(key), str) and row[key].strip() for key in
                   ("path", "group", "source", "license", "license_uri", "label_basis", "sha256")):
            raise ValueError("Manifest row has missing or invalid fields")
        item = (resolved_root / row["path"]).resolve()
        if not item.is_relative_to(resolved_root) or item.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            raise ValueError("Manifest path escapes the dataset root or has an unsupported format")
        if item in seen_files or not item.is_file():
            raise ValueError("Manifest file is missing or duplicated")
        digest = hashlib.sha256(item.read_bytes()).hexdigest()
        if digest != row["sha256"]:
            raise ValueError(f"SHA-256 mismatch for {row['path']}")
        seen_files.add(item)
        key = (row["task"], row["group"])
        groups[key].add(row["split"])
        hashes[(row["task"], digest)].add(row["split"])
        checked.append((row, item))
    if any(len(splits) > 1 for splits in groups.values()) or any(len(splits) > 1 for splits in hashes.values()):
        raise ValueError("Source group or duplicate content crosses dataset splits")
    return checked


def benchmark_gate(rows, task):
    holdout = [row for row, _ in rows if row["task"] == task and row["split"] == "holdout"]
    counts = Counter(row["label"] for row in holdout)
    groups = {label: len({row["group"] for row in holdout if row["label"] == label})
              for label in TASK_LABELS[task]}
    eligible = all(counts[label] >= MIN_HOLDOUT_PER_CLASS and
                   groups[label] >= MIN_HOLDOUT_GROUPS_PER_CLASS for label in TASK_LABELS[task])
    return {"eligible": eligible, "holdoutCounts": dict(counts), "holdoutGroups": groups,
            "requirement": f"At least {MIN_HOLDOUT_PER_CLASS} holdout items and {MIN_HOLDOUT_GROUPS_PER_CLASS} independent groups per class"}


def roc_auc(positive, negative):
    """Threshold-free rank statistic; caller must enforce the held-out eligibility gate."""
    if not positive or not negative:
        raise ValueError("Both classes require scores")
    if any(not isinstance(value, (int, float)) or not 0 <= value <= 1 for value in positive + negative):
        raise ValueError("Scores must be finite values in [0, 1]")
    wins = sum(1 if p > n else 0.5 if p == n else 0 for p in positive for n in negative)
    return round(wins / (len(positive) * len(negative)), 6)


async def collect(manifest: Path, root: Path, task: str):
    rows = load_manifest(manifest, root)
    gate = benchmark_gate(rows, task)
    output = []
    started = time.monotonic()
    if task == "general_image" and os.getenv("VERITAS_IMAGE_MODEL_PATH"):
        output, model_name, revision = collect_general_direct(rows)
    else:
        from ai_service import app as service
        async with service.lifespan(service.app):
            health = service.health()
            ready = health["status"] == "ready" if task == "general_image" else health["face_classifier"]["status"] == "ready"
            if not ready:
                raise RuntimeError(f"Requested {task} checkpoint is unavailable")
            for row, path in rows:
                if row["task"] != task:
                    continue
                item_started = time.monotonic()
                response = service.analyze_image(service.ImageRequest(
                    image_base64=base64.b64encode(path.read_bytes()).decode("ascii")))
                if response["classification"] != "INCONCLUSIVE":
                    raise RuntimeError("Experimental checkpoint produced a forbidden verdict")
                output.append({"path": row["path"], "label": row["label"], "split": row["split"],
                               "group": row["group"], "rawFakeSoftmax": response["fake_probability"] if task == "general_image" else None,
                               "faceScores": response["face_model"]["faces"] if task == "face_manipulation" else [],
                               "faceStatus": response["face_model"]["status"] if task == "face_manipulation" else None,
                               "elapsedSeconds": round(time.monotonic() - item_started, 6)})
                log_item(task, row["path"], output[-1]["elapsedSeconds"])
            model_name = health["model"] if task == "general_image" else health["face_classifier"]["model"]
            revision = health["revision"] if task == "general_image" else health["face_classifier"]["revision"]
    metrics = None
    if gate["eligible"] and task == "general_image":
        holdout = [item for item in output if item["split"] == "holdout"]
        if all(item["rawFakeSoftmax"] is not None for item in holdout):
            metrics = {"holdoutRocAuc": roc_auc(
                [item["rawFakeSoftmax"] for item in holdout if item["label"] == "synthetic"],
                [item["rawFakeSoftmax"] for item in holdout if item["label"] == "real"])}
    return {"schemaVersion": 2, "task": task,
            "manifestSha256": hashlib.sha256(manifest.read_bytes()).hexdigest(),
            "model": model_name, "revision": revision,
            "benchmark": gate, "verdict": "INCONCLUSIVE", "items": output,
            "metrics": metrics,
            "runtime": {"python": platform.python_version(), "platform": platform.platform(),
                        "elapsedSeconds": round(time.monotonic() - started, 6),
                        "offline": os.getenv("HF_HUB_OFFLINE") == "1"},
            "note": "Scores are uncalibrated. Holdout ROC AUC is emitted only after the sample/group gate; no verdict threshold is set."}


def log_item(task: str, path: str, elapsed: float):
    print(json.dumps({"event": "item_complete", "task": task, "path": path,
                      "elapsedSeconds": elapsed}), file=sys.stderr, flush=True)


def collect_general_direct(rows):
    """Evaluate a pinned local snapshot without loading the unrelated web application."""
    snapshot = Path(os.environ["VERITAS_IMAGE_MODEL_PATH"])
    print(json.dumps({"event": "stage_start", "stage": "load_direct_checkpoint"}),
          file=sys.stderr, flush=True)
    import torch
    from PIL import Image, ImageOps
    from transformers import AutoImageProcessor, AutoModelForImageClassification
    processor = AutoImageProcessor.from_pretrained(snapshot, local_files_only=True)
    model = AutoModelForImageClassification.from_pretrained(
        snapshot, use_safetensors=True, local_files_only=True).eval()
    if model.config.id2label.get(0) != "REAL" or model.config.id2label.get(1) != "FAKE":
        raise ValueError("Unexpected checkpoint labels")
    print(json.dumps({"event": "stage_end", "stage": "load_direct_checkpoint"}),
          file=sys.stderr, flush=True)
    output = []
    for row, path in rows:
        if row["task"] != "general_image":
            continue
        item_started = time.monotonic()
        with Image.open(path) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
        inputs = processor(images=image, return_tensors="pt")
        with torch.inference_mode():
            logits = model(**inputs).logits[0]
            raw = torch.softmax(logits, dim=-1)[1].item()
        elapsed = round(time.monotonic() - item_started, 6)
        output.append({"path": row["path"], "label": row["label"], "split": row["split"],
                       "group": row["group"], "rawFakeSoftmax": round(raw, 6),
                       "faceScores": [], "faceStatus": None, "elapsedSeconds": elapsed})
        log_item("general_image", row["path"], elapsed)
    return output, "dima806/ai_vs_real_image_detection", "9d17b51b9367d6b5720ac81dc339455c45d50ae3"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--task", choices=TASK_LABELS, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model-snapshot", type=Path,
                        help="Pinned local general-image snapshot; disables ambiguous Hub cache lookup")
    parser.add_argument("--face-model-snapshot", type=Path,
                        help="Pinned local face-model snapshot; disables ambiguous Hub cache lookup")
    parser.add_argument("--offline", action="store_true", help="Forbid Hugging Face network access")
    parser.add_argument("--timeout-seconds", type=float,
                        help="Run evaluation in a disposable child with this hard deadline (1..3600 seconds)")
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.timeout_seconds is not None and not 1 <= args.timeout_seconds <= 3600:
        parser.error("--timeout-seconds must be between 1 and 3600")
    if args.timeout_seconds is not None and not args.worker:
        command = [sys.executable, "-m", "ai_service.evaluate_image", *sys.argv[1:], "--worker"]
        try:
            completed = subprocess.run(command, timeout=args.timeout_seconds, check=False)
        except subprocess.TimeoutExpired:
            print(json.dumps({"event": "evaluation_timeout",
                              "timeoutSeconds": args.timeout_seconds}), file=sys.stderr, flush=True)
            raise SystemExit(124)
        raise SystemExit(completed.returncode)
    for snapshot, variable in ((args.model_snapshot, "VERITAS_IMAGE_MODEL_PATH"),
                               (args.face_model_snapshot, "VERITAS_FACE_MODEL_PATH")):
        if snapshot is not None:
            resolved = snapshot.resolve()
            if not resolved.is_dir():
                parser.error(f"{snapshot} is not a snapshot directory")
            os.environ[variable] = str(resolved)
    if args.offline:
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
    print(json.dumps({"event": "evaluation_start", "task": args.task,
                      "manifest": str(args.manifest), "offline": args.offline}),
          file=sys.stderr, flush=True)
    result = asyncio.run(collect(args.manifest, args.root, args.task))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(args.output.suffix + ".tmp")
    temporary.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    temporary.replace(args.output)
    print(f"Wrote {len(result['items'])} diagnostic item(s); benchmark eligible: {result['benchmark']['eligible']}")


if __name__ == "__main__":
    main()
