"""Evaluate raw whole-image scores on a provenance manifest; never authorizes verdicts.

python -m ai_service.evaluate_image manifest.json --endpoint http://127.0.0.1:8001
"""
import argparse
import base64
import hashlib
import json
import math
from pathlib import Path
from urllib.request import Request, urlopen


def read_manifest(path):
    path = Path(path).resolve()
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest.get("task") != "general_ai_generated_image":
        raise ValueError("Manifest must target general_ai_generated_image, not facial manipulation")
    samples = manifest.get("samples", [])
    if not samples:
        raise ValueError("Manifest has no samples")
    seen_ids, seen_hashes, groups = set(), set(), {}
    prepared = []
    for sample in samples:
        for field in ("id", "path", "sha256", "source", "license", "group", "split", "label", "domain"):
            if not isinstance(sample.get(field), str) or not sample[field].strip():
                raise ValueError(f"Sample is missing {field}")
        if sample["label"] not in ("genuine", "synthetic") or sample["split"] not in ("calibration", "test"):
            raise ValueError("Invalid label or split")
        if sample["id"] in seen_ids or sample["sha256"] in seen_hashes:
            raise ValueError("Duplicate sample ID or content hash")
        if sample["group"] in groups and groups[sample["group"]] != sample["split"]:
            raise ValueError("Related source/identity group crosses calibration and test splits")
        groups[sample["group"]] = sample["split"]
        seen_ids.add(sample["id"])
        seen_hashes.add(sample["sha256"])
        image_path = (path.parent / sample["path"]).resolve()
        if not image_path.is_relative_to(path.parent):
            raise ValueError("Image path must remain within the manifest directory")
        if image_path.stat().st_size > 10 * 1024 * 1024:
            raise ValueError("Image exceeds service byte limit")
        raw = image_path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != sample["sha256"]:
            raise ValueError(f"Content checksum mismatch: {sample['id']}")
        prepared.append((sample, raw))
    return prepared


def metrics(rows, threshold):
    scored = [r for r in rows if r.get("score") is not None]
    positive = [r["score"] for r in scored if r["label"] == "synthetic"]
    negative = [r["score"] for r in scored if r["label"] == "genuine"]
    tp = sum(s >= threshold for s in positive)
    fp = sum(s >= threshold for s in negative)
    auc = None
    if positive and negative:
        # Rank-sum AUROC with half credit for tied scores, O(n log n).
        ordered = sorted((r["score"], r["label"] == "synthetic") for r in scored)
        rank_sum, i = 0.0, 0
        while i < len(ordered):
            j = i + 1
            while j < len(ordered) and ordered[j][0] == ordered[i][0]:
                j += 1
            rank_sum += sum(label for _, label in ordered[i:j]) * (i + 1 + j) / 2
            i = j
        auc = (rank_sum - len(positive) * (len(positive) + 1) / 2) / (len(positive) * len(negative))
    tn = len(negative) - fp
    specificity = tn / len(negative) if negative else None
    recall = tp / len(positive) if positive else None
    balanced_accuracy = (specificity + recall) / 2 if specificity is not None and recall is not None else None
    return {"total": len(rows), "scored": len(scored), "failed_or_skipped": len(rows) - len(scored),
            "genuine": len(negative), "synthetic": len(positive), "tp": tp, "fp": fp,
            "tn": tn, "fn": len(positive) - tp,
            "false_positive_rate": fp / len(negative) if negative else None,
            "specificity": specificity, "recall": recall,
            "balanced_accuracy": balanced_accuracy, "auroc": auc}


def evaluate(prepared, endpoint, threshold, fetch):
    rows, identity = [], None
    for sample, raw in prepared:
        row = {key: sample[key] for key in ("id", "sha256", "label", "split", "group", "domain")}
        try:
            result = fetch(endpoint, raw)
            current = (result.get("model"), result.get("revision"))
            if not all(isinstance(v, str) and v for v in current):
                raise ValueError("Missing model identity")
            if identity is not None and current != identity:
                raise RuntimeError("Model identity changed during evaluation")
            identity = current
            score = result.get("fake_probability")
            if result.get("scope") != "general_ai_generated_image" or result.get("classification") != "INCONCLUSIVE":
                raise ValueError("Unexpected task or non-quarantined result")
            if result.get("model_status") != "ready" or type(score) not in (int, float) or not math.isfinite(score) or not 0 <= score <= 1:
                raise ValueError("Model unavailable or invalid raw score")
            row["score"] = score
        except RuntimeError:
            raise
        except Exception as error:
            row["score"] = None
            row["error"] = type(error).__name__
        rows.append(row)
    return {"task": "general_ai_generated_image", "model": identity, "threshold": threshold,
            "threshold_policy": "Predeclared diagnostic threshold; no automatic calibration or deployment approval",
            "manifest_sample_count": len(rows), "rows": rows,
            "splits": {split: metrics([r for r in rows if r["split"] == split], threshold)
                       for split in ("calibration", "test")},
            "test_domains": {domain: metrics([r for r in rows if r["domain"] == domain and r["split"] == "test"], threshold)
                             for domain in sorted({r["domain"] for r in rows})},
            "deployment_authorized": False}


def fetch_score(endpoint, raw):
    request = Request(endpoint.rstrip("/") + "/v1/image/analyze",
                      data=json.dumps({"image_base64": base64.b64encode(raw).decode("ascii")}).encode(),
                      headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=120) as response:
        body = response.read(2 * 1024 * 1024 + 1)
        if len(body) > 2 * 1024 * 1024:
            raise ValueError("Oversized inference response")
        return json.loads(body)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest")
    parser.add_argument("--endpoint", default="http://127.0.0.1:8001")
    parser.add_argument("--threshold", type=float, default=0.5)
    args = parser.parse_args()
    if not math.isfinite(args.threshold) or not 0 <= args.threshold <= 1:
        parser.error("threshold must be finite and between zero and one")
    prepared = read_manifest(args.manifest)
    report = evaluate(prepared, args.endpoint, args.threshold, fetch_score)
    report["manifest_sha256"] = hashlib.sha256(Path(args.manifest).read_bytes()).hexdigest()
    print(json.dumps(report, indent=2, allow_nan=False))
    if any(row["score"] is None for row in report["rows"]):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
