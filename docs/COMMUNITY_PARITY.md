# Community Forensics publisher-code parity

## Observed result — 2026-11-15

**Passed.** On the cached 80-image Mirage subset, 71 inputs were compared and nine
were skipped under the existing pixel limit. Every loaded parameter was identical.
Maximum absolute differences in preprocessing tensors, logits and sigmoid scores were
all **0.0**. No tested eligible input changed under EXIF orientation. Raw results:
`reports/community_parity_2026-11-15.json`.

Checkpoint SHA-256: `b89f36275f3bf5e2b040eee36597a8f19db051bff9a473a9cf7b2466284fb387`.

There is no detected adapter mismatch on these inputs in this runtime. The earlier weak
Mirage screening performance is therefore not explained by differing publisher-versus-
VERITAS transforms, weight loading, network architecture or sigmoid handling. This does
not prove that the small dataset is representative, its labels are perfect, or the model
works in the intended deployment. It also does not test the original publisher dependency
versions, every image format, EXIF differences on other inputs, or the separate DeiTFake
adapter. No production inference code was changed by this parity task.

Next: audit failure examples and dataset labels, then compare stronger candidate checkpoints
on a development set, reserving a fresh independent test set for final validation.

## Reproduce

Requires the existing native Python environment with `ai_service/requirements.txt`, cached
Community Forensics weights, and the pinned Mirage subset from `ai_service.prepare_mirage`.
Clone the publisher source once into the ignored cache:

```powershell
git clone https://github.com/JeongsooP/Community-Forensics.git .model-cache/publisher-community
python -m ai_service.parity_community
```

The harness reads Git objects at publisher commit
`ee5b71d43db0f3779e1edd64ee927b13f2dd6ad4`, regardless of the checkout branch. It records
source hashes, checkpoint hash/revision, manifest hash and runtime versions in the JSON report.
`HF_HUB_OFFLINE=1` can be set when the weights are cached.

## What is compared

- The publisher's `ViTClassifier` from `models.py` and our `community_model.load()` network.
- The publisher's exact `determine_resize_crop_sizes`, `get_transform` test branch, and
  `ToTensor_range` class against our torchvision preprocessing.
- All state-dictionary tensors after strict-loading the same pinned safetensors.
- Preprocessing tensors, raw logits and final sigmoid scores for each eligible input.
- Publisher raw RGB versus our EXIF-oriented RGB preprocessing, recorded separately.

Exact publisher definitions are extracted with AST and executed with explicit dependencies;
unrelated training, dataset and distributed modules are not imported. The publisher model's
initial backbone download is suppressed, then every parameter is replaced via strict loading
of the published checkpoint. This tests the inference definitions, not the full distributed
evaluation launcher or the publisher's original software environment.

## Acceptance

Parameters must be identical. Tensor tolerance is zero; absolute logit tolerance is `1e-6`
and score tolerance is `1e-7`. No eligible samples or any numerical mismatch fails the run.
Images over the existing 24-million-pixel limit are recorded as skipped. A successful parity
check establishes adapter agreement on the tested inputs; it does not establish accuracy,
calibration, compatibility across future dependency versions, or generalization.
