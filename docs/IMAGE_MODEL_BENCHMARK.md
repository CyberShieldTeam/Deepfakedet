# Image model benchmark — 2026-11-15

## Subsequent advanced-model decision gate

See [advanced evaluation](ADVANCED_IMAGE_MODEL_EVALUATION.md) for the completed bounded
feasibility assessment and proposed acceptance criteria. **PATH B recommended**;
pause additional image-model searches pending audited independent data and evaluation
resources. No new candidate completed inference. Smaug and the pinned UniversalFakeDetect
CLIP candidate were deferred before checkpoint loading by conservative resource gates;
the latter's unmodified publisher script additionally requires unavailable CUDA.
No new accuracy, latency or peak inference-memory measurements exist for them.

The new development-only audit (`reports/advanced_image_audit.json`) verified 96 hashes,
found no decoded/pHash duplicates and a minimum within-development pHash distance of 14.
It also established strong label confounds: genuine images are all larger/nonsquare,
synthetics all 1024-square, and class JPEG tables differ. Source groups remain file IDs,
training/source overlap and underlying image rights unresolved. Existing results below
remain exploratory, retained without repeating inference. The 96 reserved images and
their manifest were not accessed in this session. Current image verdicts stay
`INCONCLUSIVE`; Engine 2 has not been started and needs explicit implementation approval.

The advanced report supersedes the earlier recommendation below to immediately search
more models, but retains that section as historical context. Regression checks this
session: Python 31 passed / one optional AASIST skip (32 total); Node/API, TypeScript,
production build and live Express-to-Python YuNet face-only HTTP smoke passed. The
existing non-failing build chunk warning remains. No production inference code changed.

## Scope and selection status

Whole-image generation detection is evaluated separately from facial manipulation and
local editing. No production model is promoted, no model is fine-tuned, and no score is
declared calibrated. Completed publisher parity is not rerun.

## Candidate investigation

| Candidate | Architecture / training scope | License / checkpoint | Practical assessment |
| --- | --- | --- | --- |
| Dima ai_vs_real | ViT-base; card points to CIFAKE work; training provenance sparse | Apache-2.0; pinned safetensors | 85.8M parameters, 343 MB weights; existing baseline, measured here |
| Community Forensics 384 | Small ViT; diverse generated-image corpus | MIT; pinned safetensors | 21.8M parameters; existing parity-verified baseline, measured here |
| Organika SDXL detector | Swin-base; Wikimedia/SDXL caption-matched pairs; inherited AI-art detector | CC-BY-NC-3.0; pinned safetensors | 86.7M parameters, 347 MB weights; feasible educational comparison, not a commercial deployment recommendation |
| Smaug | 439M vision-only EmbeddingGemma-2 + linear head; publisher describes native crops, hard negatives and robustness training | Apache-2.0 declaration; public pinned safetensors, 878 MB main weights | Not downloaded: publisher runtime uses sentence-transformers 6.1 / transformers 5.20, versus project transformers <5; CPU float32 roughly 1.76 GB parameter storage before runtime/activations |
| UniversalFakeDetect | Frozen CLIP ViT-L/14 + learned linear head; ProGAN training, cross-generator study | MIT code; public head and OpenAI CLIP backbone | Investigated, not measured: separate backbone/runtime and memory headroom needed; no GPU and only 3.48 GiB RAM available at preflight |
| TruFor | RGB/noise-fingerprint fusion for manipulation localization | Informational/nonprofit terms | Different task; not ranked as a whole-image generation classifier |

Publisher-reported performance is context, not VERITAS measurement. SDXL publisher warns
of reduced performance outside SDXL; Smaug describes modern-generator results and small
AI-edit limitations. Neither claim substitutes for local measurement. Training overlap
with Mirage and original-source identities cannot be verified from the available cards.

Primary sources:
[Dima](https://huggingface.co/dima806/ai_vs_real_image_detection),
[Community Forensics](https://github.com/JeongsooP/Community-Forensics),
[SDXL](https://huggingface.co/Organika/sdxl-detector),
[Smaug](https://huggingface.co/abacusai/Smaug-AI-Image-Detector),
[UniversalFakeDetect](https://github.com/WisconsinAIVision/UniversalFakeDetect),
[TruFor](https://github.com/grip-unina/TruFor).

## Reproducible protocol

`ai_service/image_benchmark.py` loads one model per process on CPU with four PyTorch
threads, eval/inference mode, documented checkpoint processor, and a fixed diagnostic
threshold of 0.5. It records exact model/revision, processor configuration, environment,
parameter count, model load time, excluded warmup time, source hashes and per-image results.
No training or threshold optimization occurs. Source decoding and disk reads are excluded
from the reported preprocessing+inference latency; deployment throughput is not measured.

## Exposed original-subset comparison

These exploratory development estimates use exactly the same 71 scored inputs (31 genuine,
40 synthetic), with nine additional genuine inputs recorded as unsupported. Every fake is
from Digicam. They are not final-test accuracy claims or proof of a universal model ranking.

| Model | Accuracy | Precision | Recall | F1 | AUROC (95% exploratory bootstrap) | FPR | FNR | TP / FP / TN / FN |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Community | 47.89% | 100.00% | 7.50% | 0.140 | 0.576 (0.440–0.705) | 0/31 | 92.50% | 3 / 0 / 31 / 37 |
| Dima | 57.75% | 57.35% | 97.50% | 0.722 | 0.527 (0.391–0.672) | 93.55% | 2.50% | 39 / 29 / 2 / 1 |
| SDXL | 57.75% | 61.90% | 65.00% | 0.634 | 0.661 (0.511–0.773) | 51.61% | 35.00% | 26 / 16 / 15 / 14 |

Raw reports: `benchmark_community_development.json`, `benchmark_dima_development.json`,
`benchmark_sdxl_development.json`. Wilson intervals for all rates, per-category counts,
latency distributions, process memory, and all three paired variants are included.
Cold load times include initial model/cache activity and are not compared as deployment
startup measurements. In-memory original-image mean latencies were 0.139 s (Community),
0.151 s (Dima), and 0.201 s (SDXL); host background load was not controlled.

The apparent F1 advantage of Dima does not justify deployment: it flags nearly every
genuine input. SDXL's numerically higher AUROC is not a defensible winner given overlapping
intervals, its false-positive burden, licensing limits and the single-generator sample.

Each input is evaluated as original oriented RGB, JPEG quality 75 (4:2:0), and longest
side at most 512 pixels (Lanczos). Original source pixel eligibility is applied consistently
across all variants so unsupported source images cannot silently become successful samples.
Variants stay in the same source group and are not independent samples.

Metrics: accuracy, precision, recall, F1, ROC-AUC, false-positive/negative rates, confusion
counts, sample coverage, mean/p50/p95 latency, and Windows process peak/current working set.
Memory includes imports/loading; it is not tensor-only/GPU memory. Binomial quantities use
95% Wilson intervals; AUROC uses 300 seeded source-group bootstrap resamples. These are
exploratory intervals: unverified identities, shared sources and selection bias can violate
independence assumptions. Do not treat a zero observed false-positive count as proof of safety.
Here the group identifiers are file/source-record IDs after duplicate rejection, not
independently verified person or original-photography-session identities.

```powershell
python -m ai_service.reserve_image_holdout
python -m ai_service.prepare_benchmark_v2
python -m ai_service.image_benchmark --model community --manifest .model-cache/benchmark_v2_development.json --output reports/benchmark_v2_community.json
python -m ai_service.image_benchmark --model dima --manifest .model-cache/benchmark_v2_development.json --output reports/benchmark_v2_dima.json
python -m ai_service.image_benchmark --model sdxl --manifest .model-cache/benchmark_v2_development.json --output reports/benchmark_v2_sdxl.json
```

## Split integrity and limits

Previously exposed 80-image results are development diagnostics, not a final test.
`reports/benchmark_partitions.json` records an initial fresh reserved set, but its fake
selection inherited the original first-page Digicam bias. V2 explicitly enumerates generator
directories and allocates equal synthetic quota per generator/category, with a matched
genuine count. `reports/benchmark_v2_partitions.json` records its development and reserved
manifests and rejected candidates. Both preparations are pinned to Mirage dataset revision
`820a191bb0844ae74a1bd9eb57b28268257a4053`.

Cross-partition guards check file SHA-256, decoded RGB pixels+dimensions, known source groups,
and a 63-bit grayscale DCT perceptual hash at Hamming distance <=6. V2 excludes both earlier
partitions as well as its own chosen samples. Thresholds and limitations are explicit; this
does not detect every crop, mirror, shared person, prompt or scene. Original identity and
training overlap remain unknown. New roles are rejected by the development scorer when
marked `reserved_final`; an automated regression test verifies rejection before model loading.
Reserved inputs receive no model scores and cannot become model-selection feedback.

All data here still comes from one publisher dataset. Publisher MIT labeling does not
independently establish every underlying image's rights or authenticity. Generator folder
names are provenance categories, not proof of exact generator versions. Final independence
is provisional until source/identity audit; no defensible final-test or deployment-accuracy
claim is made from these small samples.

## Generator-stratified development results (V2)

All three models scored the same 96 eligible inputs: 48 genuine, 48 synthetic; 12 of each
class per category, and eight synthetic inputs per generator folder. No failed inference
or unsupported image occurred in this prepared set. The 51 recorded pixel-limit rejection
attempts correspond to 35 distinct candidate IDs; some were revisited during split allocation.
Those exclusions are selection bias, not silently successful model outputs.

| Model | Accuracy | Precision | Recall | F1 | AUROC (95% exploratory bootstrap) | FPR | FNR | TP / FP / TN / FN |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Community | 60.42% | 100.00% | 20.83% | 0.345 | 0.634 (0.519–0.739) | 0/48 | 79.17% | 10 / 0 / 48 / 38 |
| Dima | 55.21% | 52.87% | 95.83% | 0.681 | 0.608 (0.505–0.702) | 85.42% | 4.17% | 46 / 41 / 7 / 2 |
| SDXL | 65.63% | 63.16% | 75.00% | 0.686 | 0.734 (0.624–0.822) | 43.75% | 25.00% | 36 / 21 / 27 / 12 |

Community's observed 0/48 FPR has a Wilson upper bound of 7.41%; its recall interval is
11.73–34.26%. SDXL's FPR interval is 30.70–57.72%, despite the numerically best AUROC.
These are development estimates, not validated deployment accuracy or a statistically
established model ranking. Raw reports include all rate intervals and per-category metrics.

| Model | Mean / median / p95 seconds | Peak process working set | Cached process model-load / excluded warmup |
| --- | --- | --- | --- |
| Community | 0.517 / 0.538 / 0.742 | 967.47 MiB | 11.944 / 0.644 s |
| Dima | 0.574 / 0.496 / 0.927 | 1392.25 MiB | 17.468 / 1.329 s |
| SDXL | 0.794 / 0.675 / 1.242 | 1425.96 MiB | 19.132 / 0.993 s |

Latencies describe this CPU/runtime/session with no background-load or affinity control.
They vary substantially from the earlier run; do not infer a speedup/regression from
different input sets or advertise a production SLA. Memory is whole-process peak, not
model-weight storage alone. No GPU measurements were possible.

Generator-level true positives out of **eight** synthetic inputs each (descriptive only):

| Generator folder | Community | Dima | SDXL |
| --- | --- | --- | --- |
| Digicam | 0 | 8 | 6 |
| Flux_xhs_v2 | 0 | 7 | 7 |
| amateurphoto-v6-forcu | 1 | 8 | 4 |
| realistic_photography_v1 | 2 | 8 | 8 |
| sd3.5 | 4 | 7 | 7 |
| ultrarealisticFinetune_v4 | 3 | 8 | 4 |

There are no genuine images attributed to a synthetic generator, so per-generator FPR
and AUROC are not estimated. Small per-stratum counts do not support generalization claims.

`reports/benchmark_v2_split_audit.json` verified every cached checksum and found no known
exact/group/pHash overlap across new partitions or against earlier samples; minimum
cross-comparison pHash distance was 12 (guard threshold 6). This remains an observable
overlap audit, not proof of identity/source/training independence. The reserved 96 images
remain unscored because no candidate qualifies for final validation or promotion.

## Recommendation and remaining blockers

**No production winner. Keep local image authenticity inconclusive.** SDXL is the highest
numerical development performer of these three but has a large false-positive burden and
noncommercial licensing constraints. Community is lightweight but misses most synthetic
images; Dima's high recall comes with unacceptable genuine-image flags. None warrants
calibration/promotion based on these data. All experimental adapters, YuNet and the separate
face classifier are preserved. No production integration or threshold change is made.

Next practical candidate: investigate Smaug in an isolated transformers-5-compatible runtime
when sufficient memory is available, using development data first. Do not upgrade the
working inference environment in place or assume publisher benchmarks transfer. CLIP-based
UniversalFakeDetect remains an alternative experiment once backbone/runtime resources are
available; it is not a measured recommendation here.

Before final evaluation: independently audit source/identity groups, verify licenses and
labels, obtain an additional independent source corpus, and define a cost-sensitive
false-positive/recall target. Fit any calibration only on a separate calibration split.
The reserved split is provisional; do not keep tuning against its eventual results.

## Checks executed

- `npm run lint` (TypeScript `tsc --noEmit`) and `npm test`: passed, including existing
  forensic, inference-contract, integration and API security/persistence tests.
- `python -m unittest discover -s ai_service -p 'test_*.py' -v`: 30 tests discovered;
  29 passed, one optional real-weight AASIST test skipped because weights are absent.
- Four benchmark regression tests cover metrics/uncertainty, failed-input accounting,
  exact/pixel/perceptual/source overlap guards, and reserved-data rejection before loading.
- Benchmark/scoring runs and the actual split checksum/overlap audit completed. Syntax and
  diff checks passed. Existing production inference behavior was not modified.
- `npm run smoke:image:http` against real Express and Python services in YuNet face-only
  mode passed for landscape and headshot uploads, with inconclusive output and null decision
  probability. This is integration evidence, not a new accuracy measurement.
- `npm run build` passed. The existing non-failing Vite main-chunk warning remains.
