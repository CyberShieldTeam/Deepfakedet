"""Development-only data audit and resource gate; performs NO candidate inference.

python -m ai_service.advanced_image_audit --output reports/advanced_image_audit.json
Never enumerates another manifest or the reserved image directory.
"""
import argparse
from collections import Counter
import ctypes
import hashlib
import importlib.metadata
import io
import json
import platform
import statistics
from pathlib import Path

from PIL import Image, ImageOps
from ai_service.evaluate_image import read_manifest
from ai_service.image_benchmark import fingerprints


def require_development(manifest):
    if manifest.get("benchmark_role") != "development":
        raise ValueError("Only explicitly designated development data may be audited")


def resource_gate(physical_gib, commit_gib, required_gib):
    # A conservative admission budget, not a measured model peak or minimum spec.
    return physical_gib >= required_gib and commit_gib >= required_gib


def resources():
    if platform.system() != "Windows":
        raise RuntimeError("Windows resource probe required; do not assume available memory")
    from ctypes import wintypes
    class Memory(ctypes.Structure):
        _fields_ = [("length", wintypes.DWORD), ("load", wintypes.DWORD)] + [
            (name, ctypes.c_ulonglong) for name in
            ("total", "available", "total_commit", "available_commit", "virtual", "available_virtual", "extended")]
    memory = Memory()
    memory.length = ctypes.sizeof(memory)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(memory)):
        raise OSError("GlobalMemoryStatusEx failed")
    import torch
    return dict(total_ram_gib=memory.total / 2**30,
                available_ram_gib=memory.available / 2**30,
                available_commit_gib=memory.available_commit / 2**30,
                cuda_available=torch.cuda.is_available(), torch=torch.__version__)


def audit(manifest_path):
    path = Path(manifest_path)
    manifest = json.loads(path.read_text(encoding="utf-8"))
    require_development(manifest)  # before resolving or opening any sample paths
    records = []
    for sample, raw in read_manifest(path):
        with Image.open(io.BytesIO(raw)) as image:
            record = dict(id=sample["id"], label=sample["label"], domain=sample["domain"],
                          group=sample["group"], sha256=sample["sha256"],
                          generator=Path(sample["id"]).parts[-2] if sample["label"] == "synthetic" else None,
                          width=image.width, height=image.height, format=image.format,
                          exif_present=bool(image.getexif()), bytes=len(raw),
                          jpeg_quantization_mean=statistics.mean(v for table in image.quantization.values() for v in table)
                          if image.format == "JPEG" and getattr(image, "quantization", None) else None)
            if image.width * image.height > 24_000_000:
                raise ValueError("Development source exceeds pixel budget")
            pixels = ImageOps.exif_transpose(image).convert("RGB")
            record["decoded_sha256"] = hashlib.sha256(str(pixels.size).encode() + pixels.tobytes()).hexdigest()
            record["phash63"] = fingerprints(pixels)
            records.append(record)
    pairs = []
    minimum = 63
    for i, a in enumerate(records):
        for b in records[i+1:]:
            distance = (a["phash63"] ^ b["phash63"]).bit_count()
            minimum = min(minimum, distance)
            if a["decoded_sha256"] == b["decoded_sha256"] or distance <= 6:
                pairs.append(dict(a=a["id"], b=b["id"], phash_distance=distance))
    characteristics = {}
    for label in ("genuine", "synthetic"):
        subset = [r for r in records if r["label"] == label]
        quantizers = [r["jpeg_quantization_mean"] for r in subset if r["jpeg_quantization_mean"] is not None]
        characteristics[label] = dict(count=len(subset), formats=dict(Counter(r["format"] for r in subset)),
            domains=dict(Counter(r["domain"] for r in subset)),
            generators=dict(Counter(r["generator"] for r in subset if r["generator"])),
            square_count=sum(r["width"] == r["height"] for r in subset),
            unique_resolutions=len({(r["width"], r["height"]) for r in subset}),
            pixels_min=min(r["width"]*r["height"] for r in subset),
            pixels_median=statistics.median(r["width"]*r["height"] for r in subset),
            pixels_max=max(r["width"]*r["height"] for r in subset),
            exif_count=sum(r["exif_present"] for r in subset),
            quantization_mean_median=statistics.median(quantizers) if quantizers else None,
            quantization_mean_range=[min(quantizers),max(quantizers)] if quantizers else None)
    return dict(manifest_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                dataset=manifest["dataset"], revision=manifest["revision"],
                scope="development_only; reserved data not accessed", checksum_verified_count=len(records),
                groups_are_file_ids=all(r["group"] == r["id"] for r in records),
                minimum_within_development_phash_distance=minimum, suspected_duplicate_pairs=pairs,
                characteristics=characteristics, rows=records)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", default=".model-cache/benchmark_v2_development.json")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    report = audit(args.manifest)
    measured = resources()
    report["resources"] = measured
    report["runtime"] = {name: importlib.metadata.version(name) for name in
                         ("transformers", "torchvision", "pillow")}
    report["candidate_preflight"] = {}
    for model, budget in (("Smaug", 5), ("UniversalFakeDetect", 4)):
        admitted = resource_gate(measured["available_ram_gib"], measured["available_commit_gib"], budget)
        report["candidate_preflight"][model] = dict(
            conservative_free_ram_and_commit_budget_gib=budget, memory_admitted=admitted,
            inference_attempted=False, smoke_passed=False,
            status="RESOURCE_BLOCKED_BEFORE_CHECKPOINT_LOAD" if not admitted else "NOT_EVALUATED",
            note="Admission budget is an engineering estimate, not measured model peak memory. No scores produced.")
    Path(args.output).write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items() if k != "rows"}, indent=2))


if __name__ == "__main__":
    main()
