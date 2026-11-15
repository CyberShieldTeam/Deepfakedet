"""Bounded, isolated diagnostics for image-checkpoint loading and inference.

The parent process never imports torch.  It observes a disposable worker, records
RSS, and terminates the worker tree when the deadline expires.
"""
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path


def _emit(event: str, **fields):
    print(json.dumps({"event": event, "monotonicSeconds": round(time.monotonic(), 6), **fields}), flush=True)


def _rss_mb() -> float:
    try:
        import psutil
        return round(psutil.Process().memory_info().rss / 1_048_576, 3)
    except Exception:
        return -1.0


def worker(image_path: Path, model_id: str, revision: str, cache_dir: Path | None,
           snapshot_dir: Path | None, preload_opencv: bool):
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    if preload_opencv:
        _emit("stage_start", stage="import_opencv", rssMb=_rss_mb())
        import cv2
        _emit("stage_end", stage="import_opencv", rssMb=_rss_mb(), version=cv2.__version__)
    _emit("stage_start", stage="import_torch", rssMb=_rss_mb())
    import torch
    _emit("stage_end", stage="import_torch", rssMb=_rss_mb(), version=torch.__version__,
          threads=torch.get_num_threads(), interopThreads=torch.get_num_interop_threads(),
          cudaAvailable=torch.cuda.is_available())

    _emit("stage_start", stage="import_transformers", rssMb=_rss_mb())
    from transformers import AutoImageProcessor, AutoModelForImageClassification
    _emit("stage_end", stage="import_transformers", rssMb=_rss_mb())

    _emit("stage_start", stage="load_processor", rssMb=_rss_mb())
    source = str(snapshot_dir.resolve()) if snapshot_dir else model_id
    processor = AutoImageProcessor.from_pretrained(
        source, revision=None if snapshot_dir else revision,
        local_files_only=True, cache_dir=cache_dir)
    _emit("stage_end", stage="load_processor", rssMb=_rss_mb())

    _emit("stage_start", stage="load_model", rssMb=_rss_mb())
    model = AutoModelForImageClassification.from_pretrained(
        source, revision=None if snapshot_dir else revision, use_safetensors=True, local_files_only=True,
        cache_dir=cache_dir).eval()
    _emit("stage_end", stage="load_model", rssMb=_rss_mb())

    _emit("stage_start", stage="decode_preprocess", rssMb=_rss_mb())
    from PIL import Image, ImageOps
    with Image.open(image_path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")
    _emit("stage_end", stage="decode_preprocess", rssMb=_rss_mb(),
          inputShapes={key: list(value.shape) for key, value in inputs.items()})

    _emit("stage_start", stage="model_forward", rssMb=_rss_mb())
    with torch.inference_mode():
        logits = model(**inputs).logits[0]
        raw = torch.softmax(logits, dim=-1)[1].item()
    _emit("stage_end", stage="model_forward", rssMb=_rss_mb(), rawFakeSoftmax=round(raw, 6))
    return 0


def _terminate_tree(process):
    try:
        import psutil
        parent = psutil.Process(process.pid)
        children = parent.children(recursive=True)
        for child in children:
            child.terminate()
        parent.terminate()
        _, alive = psutil.wait_procs([*children, parent], timeout=3)
        for item in alive:
            item.kill()
    except Exception:
        process.kill()


def supervise(image_path: Path, output: Path, timeout_seconds: float, sample_seconds: float,
              model_id: str, revision: str, cache_dir: Path | None = None,
              snapshot_dir: Path | None = None, preload_opencv: bool = False) -> int:
    started = time.monotonic()
    command = [sys.executable, "-m", "ai_service.diagnose_image_runtime", "--worker",
               "--image", str(image_path), "--model-id", model_id, "--revision", revision]
    if cache_dir is not None:
        command.extend(["--cache-dir", str(cache_dir.resolve())])
    if snapshot_dir is not None:
        command.extend(["--snapshot-dir", str(snapshot_dir.resolve())])
    if preload_opencv:
        command.append("--preload-opencv")
    env = dict(os.environ, HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1")
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                               text=True, bufsize=1, env=env)
    samples = []
    peak_rss = 0.0
    timed_out = False
    import psutil
    observed = psutil.Process(process.pid)
    while process.poll() is None:
        elapsed = time.monotonic() - started
        if elapsed >= timeout_seconds:
            timed_out = True
            _terminate_tree(process)
            break
        try:
            rss = observed.memory_info().rss / 1_048_576
            peak_rss = max(peak_rss, rss)
            samples.append({"elapsedSeconds": round(elapsed, 3), "rssMb": round(rss, 3)})
        except psutil.Error:
            pass
        time.sleep(min(sample_seconds, max(0.01, timeout_seconds - elapsed)))
    try:
        stdout, _ = process.communicate(timeout=5)
    except subprocess.TimeoutExpired:
        _terminate_tree(process)
        stdout, _ = process.communicate()
    events = []
    non_json = []
    for line in stdout.splitlines():
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            non_json.append(line)
    report = {
        "schemaVersion": 1,
        "command": command,
        "offline": True,
        "timeoutSeconds": timeout_seconds,
        "timedOut": timed_out,
        "exitCode": process.returncode,
        "elapsedSeconds": round(time.monotonic() - started, 3),
        "peakObservedRssMb": round(peak_rss, 3),
        "memorySamples": samples,
        "events": events,
        "nonJsonOutput": non_json,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    temporary.replace(output)
    print(json.dumps({key: report[key] for key in
                      ("timedOut", "exitCode", "elapsedSeconds", "peakObservedRssMb")}), flush=True)
    return 124 if timed_out else (process.returncode or 0)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--model-id", default="dima806/ai_vs_real_image_detection")
    parser.add_argument("--revision", default="9d17b51b9367d6b5720ac81dc339455c45d50ae3")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--cache-dir", type=Path)
    parser.add_argument("--snapshot-dir", type=Path)
    parser.add_argument("--preload-opencv", action="store_true")
    parser.add_argument("--timeout-seconds", type=float, default=180)
    parser.add_argument("--sample-seconds", type=float, default=1)
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if not args.image.is_file():
        parser.error("--image must be an existing file")
    if args.worker:
        raise SystemExit(worker(args.image, args.model_id, args.revision, args.cache_dir,
                                args.snapshot_dir, args.preload_opencv))
    if args.output is None:
        parser.error("--output is required")
    if not 1 <= args.timeout_seconds <= 900 or not 0.1 <= args.sample_seconds <= 30:
        parser.error("timeout must be 1..900 seconds and sample interval 0.1..30 seconds")
    raise SystemExit(supervise(args.image, args.output, args.timeout_seconds, args.sample_seconds,
                               args.model_id, args.revision, args.cache_dir, args.snapshot_dir,
                               args.preload_opencv))


if __name__ == "__main__":
    main()
