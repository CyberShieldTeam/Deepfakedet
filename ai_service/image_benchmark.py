"""Offline, development-only image benchmark. Never promotes models or fits thresholds."""
import argparse
import hashlib
import io
import json
import math
import os
import platform
import statistics
import time
from pathlib import Path

from PIL import Image, ImageOps
from ai_service.evaluate_image import metrics, read_manifest

HF_MODELS = {
    "dima": ("dima806/ai_vs_real_image_detection", "9d17b51b9367d6b5720ac81dc339455c45d50ae3", {0: "REAL", 1: "FAKE"}, 1),
    "sdxl": ("Organika/sdxl-detector", "b37fede8562cb72b89ec201c0987f96ba21b518a", {0: "artificial", 1: "human"}, 0),
}


def wilson(successes, count):
    if count == 0:
        return None
    z = 1.959963984540054
    p = successes / count
    denominator = 1 + z*z/count
    center = (p + z*z/(2*count)) / denominator
    radius = z * math.sqrt(p*(1-p)/count + z*z/(4*count*count)) / denominator
    return [max(0.0, center-radius), min(1.0, center+radius)]


def summarize(rows):
    result = metrics(rows, .5)
    tp, fp, tn, fn = (result[k] for k in ("tp", "fp", "tn", "fn"))
    n = tp+fp+tn+fn
    recall=tp/(tp+fn) if tp+fn else None
    specificity=tn/(tn+fp) if tn+fp else None
    result.update(accuracy=(tp+tn)/n if n else None,
                  precision=tp/(tp+fp) if tp+fp else None,
                  recall=recall, specificity=specificity,
                  balanced_accuracy=(recall+specificity)/2 if recall is not None and specificity is not None else None,
                  f1=2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else None,
                  false_negative_rate=fn/(tp+fn) if tp+fn else None,
                  confusion_matrix={"actual_genuine": [tn, fp], "actual_synthetic": [fn, tp]},
                  ci95_wilson={"accuracy": wilson(tp+tn, n), "recall": wilson(tp,tp+fn),
                               "precision": wilson(tp,tp+fp), "false_positive_rate": wilson(fp,fp+tn),
                               "specificity": wilson(tn,tn+fp),
                               "false_negative_rate": wilson(fn,fn+tp)})
    # Resample source groups, not derived image variants, for exploratory intervals.
    import numpy as np
    groups = {}
    for row in rows:
        groups.setdefault(row.get("group", row["id"]), []).append(row)
    keys = sorted(groups)
    rng = np.random.default_rng(20261115)
    bootstrap_metrics = ("accuracy", "precision", "recall", "specificity", "balanced_accuracy",
                         "false_positive_rate", "false_negative_rate", "auroc")
    draws = {name: [] for name in bootstrap_metrics}
    replicates = 1000 if len(keys) > 1 else 0
    for _ in range(replicates):
        sample = [row for index in rng.integers(0,len(keys),len(keys)) for row in groups[keys[index]]]
        values = metrics(sample,.5)
        tp_b, fp_b, tn_b, fn_b = (values[k] for k in ("tp", "fp", "tn", "fn"))
        scored_b = tp_b + fp_b + tn_b + fn_b
        recall_b = tp_b / (tp_b + fn_b) if tp_b + fn_b else None
        specificity_b = tn_b / (tn_b + fp_b) if tn_b + fp_b else None
        derived = {
            "accuracy": (tp_b + tn_b) / scored_b if scored_b else None,
            "precision": tp_b / (tp_b + fp_b) if tp_b + fp_b else None,
            "recall": recall_b,
            "specificity": specificity_b,
            "balanced_accuracy": (recall_b + specificity_b) / 2 if recall_b is not None and specificity_b is not None else None,
            "false_positive_rate": fp_b / (tn_b + fp_b) if tn_b + fp_b else None,
            "false_negative_rate": fn_b / (tp_b + fn_b) if tp_b + fn_b else None,
            "auroc": values["auroc"],
        }
        for name, value in derived.items():
            if value is not None:
                draws[name].append(value)
    result["ci95_source_group_bootstrap"] = {
        "unit": "source_group", "replicates": replicates, "seed": 20261115,
        "intervals": {name: np.quantile(values,[.025,.975]).tolist() if values else None
                      for name,values in draws.items()},
        "valid_replicates": {name: len(values) for name,values in draws.items()},
    }
    # Retain the historical AUROC-only field for existing consumers.
    result["auroc_ci95_group_bootstrap"] = result["ci95_source_group_bootstrap"]["intervals"]["auroc"]
    latency = sorted(r["seconds"] for r in rows if r.get("score") is not None and "seconds" in r)
    result["latency_seconds"] = {"count":len(latency), "mean":statistics.mean(latency) if latency else None,
                                  "p50":statistics.median(latency) if latency else None,
                                  "p95":latency[math.ceil(.95*len(latency))-1] if latency else None}
    return result


def fingerprints(image):
    import numpy as np
    from scipy.fft import dctn
    small = np.asarray(image.convert("L").resize((32,32),Image.Resampling.LANCZOS), dtype=float)
    coefficients = dctn(small, norm="ortho")[:8,:8].flatten()[1:]
    bits = coefficients > np.median(coefficients)
    return int("".join("1" if b else "0" for b in bits),2)


def variants(image):
    yield "original", image
    compressed = io.BytesIO()
    image.save(compressed,format="JPEG",quality=75,subsampling=2)
    with Image.open(io.BytesIO(compressed.getvalue())) as decoded:
        yield "jpeg75", decoded.convert("RGB")
    resized = image.copy()
    resized.thumbnail((512,512), Image.Resampling.LANCZOS)
    yield "max512", resized


def load_scorer(kind):
    import torch
    torch.set_num_threads(min(4,torch.get_num_threads()))
    if kind == "community":
        from ai_service import community_model
        network, processor = community_model.load()
        return lambda image: community_model.score(network,processor,image), dict(
            id=community_model.MODEL_ID, revision=community_model.REVISION,
            preprocessing="Resize short side 440, center crop 384, ImageNet norm; sigmoid"), network
    from transformers import AutoImageProcessor, AutoModelForImageClassification
    identity, revision, labels, fake_index = HF_MODELS[kind]
    processor = AutoImageProcessor.from_pretrained(identity,revision=revision,trust_remote_code=False,use_fast=False)
    network = AutoModelForImageClassification.from_pretrained(identity,revision=revision,
                 use_safetensors=True,trust_remote_code=False).eval()
    if network.config.id2label != labels:
        raise ValueError("Unexpected checkpoint class mapping")
    def score(image):
        inputs = processor(images=image,return_tensors="pt")
        with torch.inference_mode():
            return torch.softmax(network(**inputs).logits[0],dim=-1)[fake_index].item()
    return score, dict(id=identity,revision=revision,labels=labels,fake_index=fake_index,
                      preprocessing=processor.to_dict()), network


def memory_usage():
    """Windows process working set, whole-process peak (includes imports and model load)."""
    if os.name != "nt":
        return None
    import ctypes
    from ctypes import wintypes
    class Counters(ctypes.Structure):
        _fields_ = [("cb",wintypes.DWORD),("PageFaultCount",wintypes.DWORD)] + [
            (name,ctypes.c_size_t) for name in ("PeakWorkingSetSize","WorkingSetSize","QuotaPeakPagedPoolUsage",
                "QuotaPagedPoolUsage","QuotaPeakNonPagedPoolUsage","QuotaNonPagedPoolUsage","PagefileUsage","PeakPagefileUsage")]
    process = ctypes.windll.kernel32.GetCurrentProcess
    process.restype = wintypes.HANDLE
    get = ctypes.windll.psapi.GetProcessMemoryInfo
    get.argtypes = [wintypes.HANDLE,ctypes.POINTER(Counters),wintypes.DWORD]
    counters = Counters()
    counters.cb = ctypes.sizeof(counters)
    if not get(process(),ctypes.byref(counters),counters.cb):
        raise OSError("GetProcessMemoryInfo failed")
    return dict(working_set_bytes=counters.WorkingSetSize,peak_working_set_bytes=counters.PeakWorkingSetSize)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model",choices=["community",*HF_MODELS],required=True)
    parser.add_argument("--manifest",default=".model-cache/mirage-screening/manifest.json")
    parser.add_argument("--output",required=True)
    args = parser.parse_args()
    # Prevent accidental evaluation of a reserved final split through the development CLI.
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    if manifest.get("benchmark_role") not in (None,"development"):
        raise ValueError("This command only accepts development data; final test remains sealed")
    prepared = read_manifest(args.manifest)
    print(f"Loading {args.model}",flush=True)
    started = time.perf_counter()
    score, identity, network = load_scorer(args.model)
    loading_seconds = time.perf_counter()-started
    # Warmup separately measured, excluded from per-sample inference latency.
    started=time.perf_counter()
    score(Image.new("RGB",(640,480),(127,127,127)))
    warmup_seconds=time.perf_counter()-started
    rows=[]
    for index,(sample,raw) in enumerate(prepared):
        row={key:sample[key] for key in ("id","group","label","domain","sha256")}
        row["generator"] = Path(sample["id"]).parts[-2] if len(Path(sample["id"]).parts)>3 else "not_recorded"
        with Image.open(io.BytesIO(raw)) as source:
            row.update(width=source.width,height=source.height,format=source.format,
                       jpeg_quantization_mean=statistics.mean(v for table in source.quantization.values() for v in table)
                       if source.format=="JPEG" and getattr(source,"quantization",None) else None)
            if source.width*source.height>24_000_000:
                rows.extend(dict(row,variant=variant,score=None,error="source_pixel_limit")
                            for variant in ("original","jpeg75","max512"))
                continue
            image=ImageOps.exif_transpose(source).convert("RGB")
        for name, pixels in variants(image):
            output=dict(row,variant=name)
            started=time.perf_counter()
            try:
                value=score(pixels)
                if not math.isfinite(value) or not 0<=value<=1:
                    raise ValueError("Invalid score")
                output.update(score=value,seconds=time.perf_counter()-started)
            except Exception as error:
                output.update(score=None,error=type(error).__name__)
            rows.append(output)
        if (index+1)%10==0:
            print(f"{args.model}: {index+1}/{len(prepared)}",flush=True)
    import torch,transformers,timm,torchvision
    report=dict(model=identity,parameters=sum(p.numel() for p in network.parameters()),
                role="development_only",threshold=.5,threshold_fitted=False,deployment_authorized=False,
                manifest_sha256=hashlib.sha256(Path(args.manifest).read_bytes()).hexdigest(),
                environment=dict(python=platform.python_version(),torch=torch.__version__,transformers=transformers.__version__,
                                 timm=timm.__version__,torchvision=torchvision.__version__,device="cpu",threads=torch.get_num_threads()),
                memory=memory_usage(),loading_seconds=loading_seconds,warmup_seconds=warmup_seconds,
                latency_scope="in-memory image preprocessing + inference, decode and disk excluded",
                rows=rows,variants={name:summarize([r for r in rows if r["variant"]==name])
                                  for name in ("original","jpeg75","max512")},
                domains={domain:summarize([r for r in rows if r["variant"]=="original" and r["domain"]==domain])
                         for domain in sorted({r["domain"] for r in rows})})
    target=Path(args.output)
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(report,indent=2,allow_nan=False),encoding="utf-8")
    print(json.dumps(report["variants"]),flush=True)


if __name__=="__main__":
    main()
