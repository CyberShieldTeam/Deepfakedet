"""Execute pinned publisher definitions and compare them with the VERITAS adapter.

Uses reviewed AST definitions to avoid unrelated training/distributed dependencies.
No publisher definition is rewritten. The initial pretrained backbone download is
suppressed because all parameters are immediately replaced by the pinned checkpoint.
"""
import argparse
import ast
import hashlib
import io
import json
import platform
import subprocess
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import torch
import timm
import torchvision
from PIL import Image, ImageOps
from huggingface_hub import PyTorchModelHubMixin, hf_hub_download
from safetensors.torch import load_file
from torchvision import transforms
from torchvision.transforms import functional as F

from ai_service import community_model
from ai_service.evaluate_image import read_manifest

PUBLISHER_COMMIT = "ee5b71d43db0f3779e1edd64ee927b13f2dd6ad4"


def publisher_definitions(repo):
    sources = {}
    for filename in ("models.py", "custom_transforms.py", "dataloader.py"):
        sources[filename] = subprocess.check_output(
            ["git", "-C", str(repo), "show", f"{PUBLISHER_COMMIT}:{filename}"], encoding="utf-8")

    def execute(filename, names, namespace):
        tree = ast.parse(sources[filename], filename=filename)
        nodes = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and node.name in names]
        if {node.name for node in nodes} != set(names):
            raise ValueError("Missing publisher definition")
        module = ast.Module(body=nodes, type_ignores=[])
        exec(compile(module, filename, "exec"), namespace)
        return namespace

    custom = execute("custom_transforms.py", ["ToTensor_range"],
                     dict(torch=torch, Tensor=torch.Tensor, F=F))
    loader = execute("dataloader.py", ["determine_resize_crop_sizes", "get_transform"],
                     dict(torch=torch, transforms=transforms,
                          ctrans=SimpleNamespace(ToTensor_range=custom["ToTensor_range"])))
    architecture = execute("models.py", ["ViTClassifier"],
                           dict(torch=torch, nn=torch.nn, timm=timm, PyTorchModelHubMixin=PyTorchModelHubMixin))
    return loader, architecture, {name: hashlib.sha256(body.encode()).hexdigest() for name, body in sources.items()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--publisher", default=".model-cache/publisher-community")
    parser.add_argument("--manifest", default=".model-cache/mirage-screening/manifest.json")
    parser.add_argument("--output", default="reports/community_parity_2026-11-15.json")
    args = parser.parse_args()
    prepared = read_manifest(args.manifest)
    loader, architecture, source_hashes = publisher_definitions(Path(args.publisher))
    local, local_transform = community_model.load()
    publisher_transform = loader["get_transform"](SimpleNamespace(input_size=384), mode="test")
    create = timm.create_model

    def no_backbone_download(*pos, **kwargs):
        kwargs["pretrained"] = False
        return create(*pos, **kwargs)

    with patch.object(timm, "create_model", side_effect=no_backbone_download):
        reference = architecture["ViTClassifier"](model_size="small", input_size=384, patch_size=16, device="cpu")
    weight_path = hf_hub_download(community_model.MODEL_ID, "model.safetensors", revision=community_model.REVISION)
    reference.load_state_dict(load_file(weight_path), strict=True)
    reference.eval()
    parameter_equal = all(torch.equal(tensor, local.state_dict()[key.removeprefix("vit.")])
                          for key, tensor in reference.state_dict().items())
    rows = []
    for index, (sample, raw) in enumerate(prepared):
        row = dict(id=sample["id"], image_sha256=sample["sha256"])
        with Image.open(io.BytesIO(raw)) as original:
            if original.width * original.height > 24_000_000:
                row.update(status="skipped", reason="24-million-pixel service limit")
                rows.append(row)
                continue
            # Publisher folder loader directly converts RGB. Record the deliberate
            # VERITAS EXIF policy separately from equal-input model/transform parity.
            publisher_rgb = original.convert("RGB")
            oriented = ImageOps.exif_transpose(original).convert("RGB")
        a, b = local_transform(oriented), publisher_transform(oriented)
        with torch.inference_mode():
            local_logit = local(a.unsqueeze(0)).item()
            reference_logit = reference(b.unsqueeze(0)).item()
            local_score = community_model.score(local, local_transform, oriented)
        reference_score = torch.sigmoid(torch.tensor(reference_logit)).item()
        raw_input_difference = (publisher_transform(publisher_rgb) - b).abs().max().item()
        row.update(status="compared", tensor_max_abs_difference=(a - b).abs().max().item(),
                   local_logit=local_logit, publisher_logit=reference_logit,
                   logit_abs_difference=abs(local_logit - reference_logit),
                   score_abs_difference=abs(local_score - reference_score),
                   publisher_raw_vs_oriented_tensor_difference=raw_input_difference)
        rows.append(row)
        if (index + 1) % 10 == 0:
            print(f"Processed {index + 1}/{len(prepared)}", flush=True)
    compared = [row for row in rows if row["status"] == "compared"]
    passed = bool(compared) and parameter_equal and all(
        row["tensor_max_abs_difference"] == 0 and row["logit_abs_difference"] <= 1e-6
        and row["score_abs_difference"] <= 1e-7 for row in compared)
    report = dict(publisher_repo="https://github.com/JeongsooP/Community-Forensics",
                  publisher_commit=PUBLISHER_COMMIT, source_sha256=source_hashes,
                  checkpoint=dict(model=community_model.MODEL_ID, revision=community_model.REVISION,
                                  sha256=hashlib.sha256(Path(weight_path).read_bytes()).hexdigest()),
                  manifest_sha256=hashlib.sha256(Path(args.manifest).read_bytes()).hexdigest(),
                  runtime=dict(python=platform.python_version(), torch=torch.__version__, timm=timm.__version__,
                               torchvision=torchvision.__version__, device="cpu", dtype="float32"),
                  deviations=["AST extracts exact publisher model and test-transform definitions; distributed evaluation loop is not run",
                              "Initial pretrained backbone download disabled; all reference weights then strict-loaded from pinned safetensors",
                              "Same oriented RGB input for transform/model parity; raw publisher versus EXIF-oriented input difference also recorded"],
                  parameters_identical=parameter_equal, compared=len(compared), skipped=len(rows)-len(compared),
                  tolerance=dict(tensor=0, logit=1e-6, score=1e-7), passed=passed, rows=rows)
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("parameters_identical", "compared", "skipped", "passed")}), flush=True)
    if not passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
