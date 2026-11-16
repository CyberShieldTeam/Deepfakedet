# Image evaluation continuity — 2026-11-17 local date

No model was promoted, threshold adjusted, reserved data opened or large weight downloaded.
Prior negative results remain the basis for abstention. See the existing
[model record](../MODEL_CARD.md), [benchmark](IMAGE_MODEL_BENCHMARK.md) and
[advanced decision gate](ADVANCED_IMAGE_MODEL_EVALUATION.md) for pinned sources,
architectures, licenses, preprocessing, full metrics and intervals.

## Prior exploratory results, not new independent evaluation

Same Mirage V2 development subset: 96 images, 48 genuine / 48 generated, six generator
folders, four subjects, fixed diagnostic threshold 0.5. Accuracy / recall / FPR / AUROC:

| Checkpoint | Accuracy | Recall | Genuine FPR | AUROC |
| --- | --- | --- | --- | --- |
| Community Forensics 384 | 60.42% | 20.83% | 0/48 | .634 |
| Dima ViT | 55.21% | 95.83% | 85.42% | .608 |
| Organika SDXL | 65.63% | 75.00% | 43.75% | .734 |

Community's zero observed flags have a 95% Wilson FPR upper bound of 7.41%; this is not
proof of safety. SDXL has noncommercial terms. All synthetic images are 1024-square,
genuine files larger/nonsquare, with different encoding tables. Source groups are file
IDs; original identity, per-image rights and model training overlap remain unresolved.
Independent accuracy cannot be inferred from these data or new transport smokes.
The reserved 96 images remain sealed/unscored in this work.

## New bounded functional observation

Existing cached Dima revision `9d17b51b9367d6b5720ac81dc339455c45d50ae3`
(343,223,968-byte safetensors, Apache-2.0 declaration) executed offline on
`fixtures/submission/notice.png`. This is an authored text notice with no genuine/synthetic
classification ground truth. Raw fake-class softmax was 0.230166; this is neither an
authenticity verdict nor a calibrated probability. No model was enabled in the normal
service. No cached checkpoint was replaced.

Initial worker took 64.170 seconds (including imports); processor/forward events were
recorded. Windows venv-launcher sampling falsely reported only 4.121 MiB while the worker
reported much larger RSS. The diagnostic supervisor now samples the whole worker process
tree. Corrected run: 21.493 seconds, sampled process-tree peak 652.633 MiB. OS caches and
host load were not controlled; this is **not a speed improvement claim**. Tree RSS can
double-count shared pages and sampling can miss transient peaks. Reports:
`.model-cache/core-capability/image-runtime{,-tree}.json`.

Actual browser image upload retained 3 server signal measurements alongside 6 client
measurements; whole-image/face classification remained unavailable, YuNet region detection
ready. Face boxes are not manipulation scores. Existing separate DeiTFake cached adapter,
crop-policy differences and its poor genuine-headshot scores remain documented; no new
subject-disjoint face evaluation exists.

Smaug (~878 MB weights) and UniversalFakeDetect (large CLIP backbone plus tiny head)
remain resource/runtime deferred, not successful experiments or quality failures. Current
free RAM before the Dima smoke was 2.72 GiB, below earlier conservative 5/4 GiB candidate
admission budgets. No new model search bypassed that decision. Next prerequisite is an
audited independent camera/generator corpus with matched encoding and source/run groups,
then provisioned isolated candidate evaluation. Repeating the confounded benchmark or
fitting a friendlier threshold would not resolve these blockers.
