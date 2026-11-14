# Image model benchmark — 2026-11-15

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
