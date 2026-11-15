"""Reproducible image-model score collection with an explicit benchmark eligibility gate."""
import argparse
import asyncio
import base64
import hashlib
import json
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
                   ("path", "group", "source", "license", "sha256")):
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
    from ai_service import app as service
    rows = load_manifest(manifest, root)
    gate = benchmark_gate(rows, task)
    output = []
    async with service.lifespan(service.app):
        health = service.health()
        ready = health["status"] == "ready" if task == "general_image" else health["face_classifier"]["status"] == "ready"
        if not ready:
            raise RuntimeError(f"Requested {task} checkpoint is unavailable")
        for row, path in rows:
            if row["task"] != task:
                continue
            response = service.analyze_image(service.ImageRequest(
                image_base64=base64.b64encode(path.read_bytes()).decode("ascii")))
            if response["classification"] != "INCONCLUSIVE":
                raise RuntimeError("Experimental checkpoint produced a forbidden verdict")
            output.append({"path": row["path"], "label": row["label"], "split": row["split"],
                           "group": row["group"], "rawFakeSoftmax": response["fake_probability"] if task == "general_image" else None,
                           "faceScores": response["face_model"]["faces"] if task == "face_manipulation" else [],
                           "faceStatus": response["face_model"]["status"] if task == "face_manipulation" else None})
    metrics = None
    if gate["eligible"] and task == "general_image":
        holdout = [item for item in output if item["split"] == "holdout"]
        if all(item["rawFakeSoftmax"] is not None for item in holdout):
            metrics = {"holdoutRocAuc": roc_auc(
                [item["rawFakeSoftmax"] for item in holdout if item["label"] == "synthetic"],
                [item["rawFakeSoftmax"] for item in holdout if item["label"] == "real"])}
    return {"task": task, "model": health["model"] if task == "general_image" else health["face_classifier"]["model"],
            "benchmark": gate, "verdict": "INCONCLUSIVE", "items": output,
            "metrics": metrics,
            "note": "Scores are uncalibrated. Holdout ROC AUC is emitted only after the sample/group gate; no verdict threshold is set."}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--task", choices=TASK_LABELS, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = asyncio.run(collect(args.manifest, args.root, args.task))
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(result['items'])} diagnostic item(s); benchmark eligible: {result['benchmark']['eligible']}")


if __name__ == "__main__":
    main()
