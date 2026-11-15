# Advanced image evaluation and decision gate — 2026-11-15

## Decision

**PATH B: pause further Phase 2a model searches and prioritize Engine 2, subject to
explicit approval to implement it.** No new image candidate completed checkpoint
inference in this session. Smaug and UniversalFakeDetect were stopped at resource
preflight; their accuracy, latency and peak inference memory remain unknown. This is
a bounded feasibility assessment, not a successful advanced-model benchmark.

The three previously measured models fail the proposed development gate below. More
fundamentally, development-data source independence is unresolved and the audit found
strong resolution/compression confounds. Neither more threshold fitting on this set
nor published model scores resolve that problem. Phase 2a is **not validated or
production complete**. Its current research decision is complete; further searches
are paused rather than treated as an unlimited prerequisite for other engines.

Repository entry state: clean `codex/integrate-figma-upgrade`, commit `fe62e96`.
Earlier parity and inference benchmarks were retained without rerunning them.
This session changes research tooling and documentation only. Application inference,
YuNet, face-crop model, AASIST, video/audio extraction, contracts and frontend are
unchanged. Unsupported local authenticity verdicts remain `INCONCLUSIVE`; raw outputs
remain uncalibrated. No Engine 2 implementation, fine-tuning, push or merge occurred.

## Development-data independence audit

Reproducible evidence: `reports/advanced_image_audit.json`, produced by:

```powershell
.\.venv-win\Scripts\python.exe -m ai_service.advanced_image_audit --output reports/advanced_image_audit.json
```

Only `.model-cache/benchmark_v2_development.json` and its 96 listed images were read.
The 96 reserved images and their manifest were not opened, scored or used. The earlier
cross-partition overlap audit was not rerun. The new audit rejects any manifest not
explicitly marked `development` before accessing sample paths.

- Dataset: `Yunncheng/Mirage-Test`, revision
  `820a191bb0844ae74a1bd9eb57b28268257a4053`.
- Development manifest SHA-256:
  `2ca3ee43d1f3b311c78c87914f37e9eb270815f2e8b439b102fd0fc0eb8e2947`.
- All 96 checksums verified. No exact decoded-pixel duplicate or pHash63 pair at
  distance <=6 was found within development; minimum observed distance was 14.
  These checks do not establish original-image, identity, crop or mirror independence.
- Labels are balanced: 48 genuine, 48 synthetic; Animal, Human, Object and Scene each
  contain 12 per class. Six synthetic folders contribute eight images each.
  The publisher dataset includes a fifth domain; these four are not full coverage.
- Every `group` equals its file ID. There are no verified photographer, person,
  source-original, prompt, seed or generation-run groups. Thus group bootstrap and
  previous overlap checks cannot correct for unknown source clusters.
- The publisher calls Mirage **test-only**, but this selected subset has already
  been used for development and model comparisons. Its upstream split name does not
  make it an independent final test. Selection by hash within the first 1,000 paths
  of each folder also limits representativeness.
- Folder names identify declared generator families/checkpoints, not verified runs.
  Original capture records, generation logs and independently confirmed labels are
  unavailable. Training overlap is unresolved for every candidate. UniversalFakeDetect
  documents ProGAN detector training, but that does not exclude genuine-source overlap
  or CLIP pretraining overlap. Smaug's published training description is not a
  per-image training registry against which this manifest can be checked.
- The pinned dataset card declares MIT. Individual source-image rights and attribution
  chains are not established; do not infer redistribution permission for every image.
  No images are added to Git by this session.

| Observed characteristic | Genuine (48) | Synthetic (48) |
| --- | --- | --- |
| Encoded format | 48 JPEG | 48 JPEG |
| Square images | 0 | 48 |
| Distinct resolutions | 36 | 1: 1024×1024 |
| Pixel count min / median / max | 5,997,000 / 15,388,704 / 24,000,000 | 1,048,576 for all |
| Nonempty EXIF | 0 | 0 |
| Mean JPEG quantization coefficient, range across images | 38.6328125–38.6328125 | 36.234375–36.234375 |

Quantization averages describe encoded tables, not recovered encoder quality settings.
The classes differ perfectly in square shape and strongly in resolution, and also in
quantization. A detector can exploit dataset preparation artifacts. Paired JPEG75 and
max512 variants test sensitivity but do not remove all original aspect-ratio, prior
resampling or compression-history differences. The audit therefore **fails the
independence/provenance gate**. All reported accuracy remains exploratory.

For any future image evaluation, acquire documented camera originals and independently
generated files with source/run groups, underlying licenses and labels; match or
stratify acquisition/encoding/resolution across labels; obtain an independent dataset
publisher and unfamiliar generators. Audit training overlap to the extent the model's
registry permits, recording remaining unknowns rather than asserting zero overlap.

## Smaug investigation and blocker

- Checkpoint: `abacusai/Smaug-AI-Image-Detector`, pinned revision
  `c7c95951e04a87b884a4ad479401b1128c3903bd`; Apache-2.0 publisher declaration.
- Publisher describes a roughly 439M-parameter, vision-only EmbeddingGemma-2 encoder
  plus linear head. Main `model.safetensors`: 877,599,816 bytes; dense-head file:
  1,690 bytes. CPU float32 parameter storage alone is approximately 1.64 GiB;
  checkpoint conversion, tokenizer/processor, imports, crops and activations add memory.
  This is a storage estimate, **not locally measured peak inference memory**.
- Existing optional adapter implements the publisher's three-view geometry: EXIF/RGB;
  short side capped at 576 with Lanczos, raised to 528 with bicubic when smaller;
  three 528-square crops along the long side; 140 image tokens; average logits then
  sigmoid. The publisher uses float32 on CPU and bfloat16 on supported GPUs. Existing
  crop-geometry regression passed; that does not prove checkpoint inference/parity.
- Pinned `config_sentence_transformers.json` records sentence-transformers 6.1.0,
  transformers 5.20.0 and PyTorch 2.9.1+cu130. Exact PyPI release metadata for ST 6.1.0,
  transformers 5.20.0 and torch 2.9.1 declares Python >=3.10; these declarations are
  not a guarantee of this particular Windows/Python/CPU combination. The publisher
  snapshot is a reproducibility target, not evidence that each exact version is a
  hard minimum. A CPU torch build can be investigated in isolation when resuming.
- Working runtime: Python 3.13.12, torch 2.15.0+cpu, transformers 4.57.6,
  torchvision 0.29.2, Pillow 12.3.0. `sentence_transformers` is not installed.
  The service's transformers `<5` requirement conflicts with reproducing the
  publisher's transformers 5.20 runtime in place. No packages were changed.
- Initial free RAM was approximately 2.39 GiB with 2.42 GiB available commit. The saved
  audit snapshot later measured **3.060 GiB available physical RAM, 3.457 GiB available
  commit**, 15.718 GiB total physical RAM, CUDA unavailable. Availability fluctuates.
  Available commit means additional OS-backed allocation capacity, not free pagefile
  disk space. Disk space was ample (approximately 758 GiB at initial preflight).
- The isolated audit worker rejected Smaug against a conservative admission budget of
  **5 GiB free physical RAM AND 5 GiB available commit**. This budget allows roughly
  two float32 parameter copies plus runtime/activations and margin. It is an engineering
  safety budget, not a demonstrated minimum or proof that an optimized loader cannot
  fit. No checkpoint download, model-load attempt, candidate inference smoke or
  benchmark followed. No accuracy or latency is claimed; local latency is unknown.

Resume only with sufficient free headroom or a separately provisioned machine, and a
new `.venv-smaug-eval` (never upgrade the working service in place). Reproduce the
publisher runtime, pin dependencies and CPU/GPU dtype, verify weights, then run one
development-image load/inference smoke with finite outputs and recorded peak memory.
Only after that succeeds run the same 96-image paired protocol. A GPU changes the
resource budget; required VRAM has not been measured here.

Primary sources: [pinned model files/card](https://huggingface.co/abacusai/Smaug-AI-Image-Detector/tree/c7c95951e04a87b884a4ad479401b1128c3903bd),
[publisher wrapper](https://huggingface.co/abacusai/Smaug-AI-Image-Detector/blob/c7c95951e04a87b884a4ad479401b1128c3903bd/smaug_image_detect.py),
[runtime snapshot](https://huggingface.co/abacusai/Smaug-AI-Image-Detector/blob/c7c95951e04a87b884a4ad479401b1128c3903bd/config_sentence_transformers.json).
Release Python requirements were checked through the exact-version PyPI JSON endpoints.

## UniversalFakeDetect / CLIP investigation and blocker

- Official repository revision: `030495aea3300a8b54c0ec37ec7fe1dd7e63c619`.
  Repository code license: MIT; preserve the separately bundled CLIP license too.
  Source-image rights and detector-training data rights require their own review.
- Frozen OpenAI CLIP **ViT-L/14**, learned linear 768-to-1 head, sigmoid output;
  detector head trained on the Wang2020 ProGAN corpus. Publisher cross-generator
  experiments motivate investigation, but their metrics are not local measurements.
- Public `pretrained_weights/fc_weights.pth` is 4,083 bytes. Its Git blob ID is
  `2a8efc8e238bf5a491e4fd5999655ed5eb3bbb72` (not a file SHA-256).
  The separate CLIP backbone is essential; a tiny head is not a tiny detector.
  Official CLIP archive URL pins SHA-256
  `b8cca3fd41ae0c99ba7e8951adf17d267cdb84cd88be6f7c2e0eca1737a03836`.
- Crucial preprocessing distinction: pinned **validate.py** uses RGB,
  `CenterCrop(224)`, tensor conversion, CLIP mean
  `[0.48145466,0.4578275,0.40821073]` and standard deviation
  `[0.26862954,0.26130258,0.27577711]`. It does **not resize** in that transform.
  `CLIPModel.preprocess` is not the evaluation data loader's transform. Do not silently
  replace publisher validation with the usual resize/center-crop CLIP transform.
  Do not normalize the encoded features or substitute a different backbone/head.
- The checked publisher validation code calls `.cuda()` on both model and inputs;
  this CPU-only machine cannot run it unchanged. CPU adaptation is possible in a
  separate evaluator, but requires parity checks before claiming reproduction.
  The bundled default loader loads a JIT checkpoint, rebuilds from its state dict,
  and converts the result to float32 on CPU. The full approximately 428M-parameter
  CLIP model needs roughly 1.6 GiB for float32 parameters alone; archive/state/conversion
  transients and the Python runtime add substantial headroom requirements.
- The saved resource probe also rejected this candidate against **4 GiB free physical
  RAM AND available commit**. This is a conservative loader admission estimate,
  not a measured peak or a universal minimum. There was no backbone download/load,
  candidate inference smoke, measured latency, accuracy or benchmark. This is a
  resource/CUDA feasibility blocker, not a model-quality result or network failure.

On a provisioned machine, isolate dependencies, pin and hash both weights, load the
head safely with strict shape/key checks, verify CPU adaptation against publisher
outputs on development fixtures, then run batch1/four CPU threads or separately label
GPU timings. Use the fixed 0.5 diagnostic threshold; never use the publisher script's
test-derived best threshold or this project's reserved data for model selection.
No third candidate was pursued after these two bounded feasibility investigations.

Primary sources: [pinned repository and training recipe](https://github.com/WisconsinAIVision/UniversalFakeDetect/tree/030495aea3300a8b54c0ec37ec7fe1dd7e63c619),
[model wrapper](https://github.com/WisconsinAIVision/UniversalFakeDetect/blob/030495aea3300a8b54c0ec37ec7fe1dd7e63c619/models/clip_models.py),
[validation loader](https://github.com/WisconsinAIVision/UniversalFakeDetect/blob/030495aea3300a8b54c0ec37ec7fe1dd7e63c619/validate.py),
[CLIP loader](https://github.com/WisconsinAIVision/UniversalFakeDetect/blob/030495aea3300a8b54c0ec37ec7fe1dd7e63c619/models/clip/clip.py).

## Comparison of successfully evaluated models

These are **existing measurements**, transcribed from `reports/benchmark_v2_{community,
dima,sdxl}.json`, not new inference runs. All use the same 96 development images,
fixed threshold 0.5, CPU/four threads/batch1. Synthetic is the positive class.

| Model | Accuracy % | Precision % | Recall % | F1 | AUROC (95% bootstrap interval) | FPR % | FNR % | TP / FP / TN / FN |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- |
| Community | 60.42 | 100.00 | 20.83 | .345 | .634 (.519–.739) | 0.00 | 79.17 | 10 / 0 / 48 / 38 |
| Dima | 55.21 | 52.87 | 95.83 | .681 | .608 (.505–.702) | 85.42 | 4.17 | 46 / 41 / 7 / 2 |
| SDXL | 65.63 | 63.16 | 75.00 | .686 | .734 (.624–.822) | 43.75 | 25.00 | 36 / 21 / 27 / 12 |

95% Wilson intervals in percent (F1 intervals were not estimated):

| Model | Accuracy | Precision | Recall | FPR | FNR |
| --- | --- | --- | --- | --- | --- |
| Community | 50.42–69.62 | 72.25–100 | 11.73–34.26 | 0–7.41 | 65.74–88.27 |
| Dima | 45.25–64.76 | 42.49–63.02 | 86.02–98.85 | 72.83–92.75 | 1.15–13.98 |
| SDXL | 55.69–74.36 | 50.18–74.48 | 61.22–85.08 | 30.70–57.72 | 14.92–38.78 |

Bootstrap uses recorded groups, 300 resamples, seed 20261115. Since groups are file IDs,
these intervals are conditional on assumed image independence and do not quantify
unknown source-cluster bias or training contamination. The paired transformations
are not 288 independent observations. Zero flags on 48 genuine images cannot establish
a suitably low production FPR. Precision also depends on deployment prevalence.

| Model | Parameters | Weight size | Mean / p50 / p95 seconds | Whole-process peak MiB | Deployment constraints |
| --- | ---: | --- | --- | ---: | --- |
| Community | 21,811,969 | ~87 MB float32 parameter estimate | .517 / .538 / .742 | 967.47 | MIT; timm adapter, CPU feasible |
| Dima | 85,800,194 | 343,223,968 bytes safetensors | .574 / .496 / .927 | 1392.25 | Apache-2.0; HF ViT CPU feasible |
| SDXL | 86,745,274 | 347,498,816 bytes safetensors | .794 / .675 / 1.242 | 1425.96 | CC-BY-NC-3.0; noncommercial limitation |
| Smaug | ~439M publisher description | 877,599,816 bytes main + 1,690 head | Not measured | Not measured | Separate ST/transformers5 runtime; preflight blocked |
| UniversalFakeDetect | ~428M full CLIP plus 769 head parameters | 4,083-byte head plus large CLIP archive | Not measured | Not measured | Publisher CUDA script; CPU loader headroom/parity unresolved |

Recorded latency includes in-memory preprocessing and inference, excluding decode/disk,
warmup and model loading. Whole-process memory includes imports/loading; it is not a
steady-state tensor-only comparison. Community loading/warmup: 11.94/.64 seconds;
other loading and warmup details remain in the raw reports. No end-to-end SLA is proven.
Checkpoint IDs/revisions: Community `OwensLab/commfor-model-384` at
`6076002bf0d9dd37537f965ee2f06f826c333b61`; Dima
`dima806/ai_vs_real_image_detection` at `9d17b51b9367d6b5720ac81dc339455c45d50ae3`;
SDXL `Organika/sdxl-detector` at `b37fede8562cb72b89ec201c0987f96ba21b518a`.

Paired transformation results; each entry is **recall % / FPR % / AUROC**:

| Model | Original | JPEG quality75, subsampling2 | Max512 Lanczos thumbnail |
| --- | --- | --- | --- |
| Community | 20.83 / 0 / .634 | 20.83 / 2.08 / .639 | 20.83 / 0 / .603 |
| Dima | 95.83 / 85.42 / .608 | 95.83 / 85.42 / .608 | 95.83 / 85.42 / .600 |
| SDXL | 75 / 43.75 / .734 | 75 / 43.75 / .732 | 72.92 / 39.58 / .747 |

JPEG/resizing do not rescue any detector's basic false-positive/recall tradeoff.

Content categories, 12 genuine and 12 synthetic per category; **recall % / FPR % / AUROC**:

| Category | Community | Dima | SDXL |
| --- | --- | --- | --- |
| Animal | 25 / 0 / .750 | 83.33 / 75 / .688 | 66.67 / 41.67 / .715 |
| Human | 41.67 / 0 / .792 | 100 / 83.33 / .646 | 83.33 / 58.33 / .743 |
| Object | 8.33 / 0 / .500 | 100 / 91.67 / .465 | 75 / 50 / .653 |
| Scene | 8.33 / 0 / .472 | 100 / 91.67 / .556 | 75 / 25 / .840 |

Generator recall, detected synthetic images out of eight:

| Folder | Community | Dima | SDXL |
| --- | ---: | ---: | ---: |
| Digicam | 0/8 | 8/8 | 6/8 |
| Flux_xhs_v2 | 0/8 | 7/8 | 7/8 |
| amateurphoto-v6-forcu | 1/8 | 8/8 | 4/8 |
| realistic_photography_v1 | 2/8 | 8/8 | 8/8 |
| sd3.5 | 4/8 | 7/8 | 7/8 |
| ultrarealisticFinetune_v4 | 3/8 | 8/8 | 4/8 |

Generator groups contain no genuine examples, so generator-specific FPR/AUROC are
undefined. These small strata are diagnostic, not reliable rankings. Category results
also do not constitute a face-manipulation benchmark.

## Proposed acceptance gates

These are **VERITAS project proposals for human-assisted fact checking**, not universal
industry thresholds, validated operating points or authorization to enable verdicts.
They prioritize avoiding false accusations over maximizing recall. No threshold was
fitted and no new candidate scores were observed before this proposal.

1. **Exploration / shortlist:** fixed predeclared operating threshold; AUROC >=.85,
   recall >=80%, observed genuine FPR <=5%, scored coverage >=95%. Under paired JPEG75
   and max512, recall may fall at most 10 percentage points and FPR may increase at
   most 2 points; each transformation must still satisfy the absolute FPR <=5% limit.
   Each sufficiently sampled generator/category should have recall >=70%; otherwise
   restrict the claimed scope or reject it. CPU batch1 p95 preprocessing+inference
   <=2 seconds and whole-process peak <=2 GiB on the intended deployment machine;
   record decode/transport separately. These small development strata cannot certify
   subgroup performance. All three measured models fail the aggregate statistical
   gate; SDXL also fails the proposed commercial license gate.
2. **Independent validation:** verified source/identity/run-separated data from an
   additional source corpus, known licenses/labels, unfamiliar generators and matched
   encoding distributions. Document remaining backbone/detector training-overlap
   unknowns. Require recall's 95% lower bound >=80% and FPR's 95% upper bound <=2%,
   with predeclared subgroup and transformation analyses and enough samples to support
   those bounds. Stop if provenance remains too weak. Select model/scope here, not on
   final held-out data. Treat subgroup multiplicity explicitly in the evaluation plan.
3. **Calibration:** a separate source-disjoint calibration split; choose cost-sensitive
   threshold and abstention region and, if useful, fit score calibration. Inspect
   reliability/Brier/ECE with uncertainty and deployment prevalence sensitivity. Never
   relabel raw sigmoid/softmax output as calibrated confidence merely because it is
   between zero and one. Freeze preprocessing, weights, threshold and scope afterward.
4. **Final held-out evaluation:** one locked evaluation of the frozen system; proposed
   stricter genuine FPR 95% upper bound <=1%, recall 95% lower bound >=80%, coverage
   >=95%, same robustness/resource gates and predeclared subgroup requirements. A
   zero-event Wilson upper bound needs at least 381 independent genuine examples to
   fall below 1% (189 for 2%); positive recalls need their own power/sample-size plan.
   Neither 48 genuine images nor the current provisional reserved split can certify
   these requirements. Independently establish reserved-data provenance before any
   authorized future use; never silently repurpose it as calibration/development.
   Failure requires new development followed by a new independent final test.
5. **Production readiness:** license/deployment feasibility, pinned reproducible
   inference, representative end-to-end latency/load validation, calibrated scope and
   abstention behavior, and explicitly approved integration after the above gates.
   Passing a software smoke alone never authorizes a real/fake verdict. Scope remains
   whole-image generation; facial manipulation/local edits need separate evidence.

Resource/provenance failures alone are sufficient to pause a search. Do not keep
cycling through pretrained checkpoints while these prerequisites remain unresolved.
Reopen image work only after an explicit scope decision, audited data and provisioned
evaluation resources, starting with the two documented candidates rather than a new
unbounded search.

## Checks actually executed this session

- Development-only audit: passed, 96 checksums, no within-development duplicate pairs;
  provenance/independence **unresolved**, confounds **present**. This is not a statistical
  acceptance pass.
- Python unittest discovery: **32 tests, 31 passed, one skipped**, zero failures.
  Skip: optional real-weight AASIST inference because its weights are absent in this
  native environment. New tests cover both memory constraints and rejection of a
  reserved-role manifest before sample loading. Existing YuNet real-weight and
  Smaug geometry tests passed; neither implies Smaug checkpoint loading succeeded.
- `npm test`: passed, including Node, inference contracts and API integration.
- `npm run lint`: passed (`tsc --noEmit`, not a separate ESLint run).
- `npm run build`: passed; existing non-failing Vite >500 kB chunk warning remains.
- `npm run smoke:image:http`: passed against temporary real Express/Python services
  on ports 3017/8017, YuNet face-only mode, actual landscape/headshot fixtures,
  inconclusive verdict and null decision probability. Services were stopped afterward.
  External model provider was disabled and an isolated temporary store used.
- Advanced candidate checkpoint smokes/benchmarks: **not run**, preflight deferred;
  no candidate is recorded as a smoke success or checkpoint-load failure.
- No real AASIST, face-crop classifier, video benchmark, browser E2E or final-holdout
  accuracy run was performed. Existing audio/video unit and Node contracts passed.
- `git diff --check`: passed before committing. No production application code changed.

## Next work, pending approval

Engine 2 already contains partial BM25/evidence/API/UI scaffolding; inspect it before
extending it. The next approved slice should audit `server/evidence.ts`,
`server/inference.ts`, claim routes, multilingual UI/types and existing tests; then add
incremental multilingual Sentence Transformer retrieval alongside BM25, Google Fact
Check Tools API evidence ingestion, source ranking and English/Hindi/Telugu evaluation.
Retrieval similarity must stay separate from factual support; evidence-grounded outputs
must cite attributable evidence and abstain when it is insufficient. No such work was
started here, and external API credentials/quotas remain a future configuration issue.

Suggested next Codex prompt:

> I approve beginning Engine 2 multilingual claim verification. Read
> docs/ADVANCED_IMAGE_MODEL_EVALUATION.md and current project memory, verify the branch
> and existing BM25/evidence/API/UI scaffolding, and implement the first bounded slice
> incrementally: multilingual Sentence Transformer plus BM25 evidence retrieval,
> Google Fact Check Tools API integration with explicit unavailable states, source
> ranking and English/Hindi/Telugu tests. Ground factual outputs in cited evidence and
> abstain when support is insufficient. Preserve all media inference, keep image
> authenticity INCONCLUSIVE, do not access reserved images, do not fine-tune or push,
> run relevant checks and update actual progress with local commits.

Dataset primary source: [pinned Mirage card](https://huggingface.co/datasets/Yunncheng/Mirage-Test/blob/820a191bb0844ae74a1bd9eb57b28268257a4053/README.md).
