# Image engine model record

## Reconciliation and diagnostic validation — 2026-11-15

Merged both feature histories in `855b414`, preserving all earlier model/parity reports
and both evaluation protocols. Both provenance routes now share the same original-byte
offline verifier and explicit signer-trust policy. They preserve signature/binding,
trust and disclosure distinctions without creating an authenticity score. The remote
square-crop policy remains a separately named legacy experiment; one integrated face
inference produces both current and compatibility fields.

Vite development navigation is now fixed locally by excluding inference environments,
caches and generated outputs from its watcher, with HMR retained. A broad-watching
crossover reproduced the stall after caches were warm. Actual production browser
workflows also passed. See `docs/DEV_NAVIGATION_DIAGNOSIS.md` for raw evidence.

CPU temporal observations and resource measurements are implemented separately from
image detection (`docs/TEMPORAL_DIAGNOSTICS.md`). The normal moving test pattern triggers
localized-change candidates, underscoring that these are observations rather than fake
labels. No new authenticity accuracy or calibration was measured. Image/face/audio
outputs remain experimental, reserved images remain sealed, and trained temporal Phase
2d remains incomplete. Future-method feasibility and actual vendor-access uncertainty
are recorded in `docs/FORENSIC_CAPABILITY_FEASIBILITY.md`.

## Supplemental provenance and image signals — 2026-11-15

An independent evidence endpoint now validates embedded C2PA with optional SDK 0.39.0,
separating signature/content binding from explicit operator signer trust. It extracts
selected editable EXIF fields and bounded FFT/high-pass measurements on received original
bytes. Missing metadata, generic computer-generated source declarations and residual
measurements never become AI probabilities or classifier verdicts. This is not PRNU,
new detector training, or evidence that existing model accuracy improved.

Real SDK/HTTP smokes exercised absent, valid-untrusted, explicit test-trusted, altered
binding invalid, and remote-only unavailable states; the reserved corpus was untouched.
Two built-client browser checks passed. Development-mode browser navigation timed out
before feature assertions and remains unresolved. See
[provenance and signals](docs/IMAGE_PROVENANCE_AND_SIGNALS.md) and
`reports/image_evidence_smoke.json` for exact evidence, setup and limits. The classifier
search pause and production quarantine below remain in force.

## Advanced evaluation decision gate — 2026-11-15

**PATH B recommended: pause further Phase 2a model searches; Engine 2 implementation
requires explicit approval.** No image model is promoted and Phase 2a is not validated
or production complete. Unsupported local authenticity remains `INCONCLUSIVE`.

The new development-only audit verified all 96 checksums and found no decoded/pHash
duplicate pairs (minimum within-development distance 14, rejection threshold <=6).
However, every source group is a file ID, original identities and training overlap are
unknown, and label confounds are severe: all synthetic images are 1024-square, all
genuine images larger/nonsquare, with different JPEG quantization tables. Existing
accuracy estimates remain exploratory. The 96 reserved images were not accessed.

Smaug's pinned publisher runtime differs from the working service; it also failed the
conservative free-memory admission budget. UniversalFakeDetect was pinned to official
revision `030495aea3300a8b54c0ec37ec7fe1dd7e63c619`; its validation script requires CUDA,
and the CPU loader exceeds the chosen safe headroom budget. Saved host snapshot:
3.060 GiB free physical RAM, 3.457 GiB available commit, no CUDA. Admission budgets are
5 GiB for Smaug and 4 GiB for UniversalFakeDetect, estimates rather than measured model
minimums. Neither checkpoint was loaded or scored; their local quality, latency and
peak inference memory remain unknown. No working dependencies were changed.

[Advanced evaluation](docs/ADVANCED_IMAGE_MODEL_EVALUATION.md) records pinned sources,
preprocessing, exact blockers, all existing comparisons, uncertainty and proposed
exploration/independent-validation/calibration/final/production gates. Raw audit:
`reports/advanced_image_audit.json`. The previous investigations below remain history.

## Failure analysis and comparative development benchmark — 2026-11-15

Completed feasible comparisons without repeating publisher parity. Auditing revealed all
40 old synthetic examples were from the Digicam folder. The new V2 development set has
96 fresh eligible images (48 genuine / 48 synthetic), six generator folders and four
categories. Another 96 images remain unscored and provisionally reserved; identity/source
and training overlap still require independent audit.

At a fixed diagnostic threshold 0.5: Community achieved AUROC 0.634, recall 20.83%, FPR
0/48; Dima AUROC 0.608, recall 95.83%, FPR 85.42%; SDXL AUROC 0.734, recall 75.00%, FPR
43.75%. These are exploratory development estimates, not final validation or calibrated
probabilities. Raw per-image data and uncertainty intervals are recorded in the benchmark
reports. Paired JPEG75/resizing tests do not identify a universal preprocessing correction.

The additional benchmark-only candidate is `Organika/sdxl-detector` at
`b37fede8562cb72b89ec201c0987f96ba21b518a`: Swin, documented processor, checked
`artificial=0` / `human=1` classes, safetensors loading and CC-BY-NC-3.0 terms. It is not
integrated into production or recommended as a deployment winner. Smaug and CLIP-based
UniversalFakeDetect were investigated but not downloaded for this run because of measured
RAM/runtime constraints. Their publisher claims are not VERITAS results.

**Decision: no production winner; keep all experimental outputs inconclusive.** No default
model, inference threshold, service contract or face pipeline changed. No fine-tuning ran.
See `docs/IMAGE_FAILURE_ANALYSIS.md` and `docs/IMAGE_MODEL_BENCHMARK.md` for measured
trade-offs, exact versions, licensing, resource constraints and next experiments.

## Measured screening checkpoint — 2026-11-15

Publisher-code parity subsequently passed on all 71 eligible screening inputs: strict-loaded
parameters, tensors, logits and sigmoid outputs matched exactly. See `docs/COMMUNITY_PARITY.md`.
This verifies the adapter in the tested runtime; it does not improve or validate detector accuracy.

Community Forensics now has an optional `VERITAS_IMAGE_MODEL=community` adapter with
strict pinned safetensors loading and publisher test preprocessing. On an 80-image
Mirage subset, 71 images were scored and nine were skipped for exceeding pixel limits.
At threshold 0.5 it detected 3/40 generated images and flagged 0/31 genuine images;
AUROC was 0.575806. These results do not support promotion. Human-subset DeiTFake outputs
also showed high raw scores on several publisher-labeled genuine inputs. Calibration
is deliberately not fitted to this test subset. See `docs/IMAGE_SCREENING_RESULTS.md`
and the checked-in raw report. Phase 2a remains incomplete; default verdicts abstain.

## Phase 2a face classifier implementation

Optional `VERITAS_FACE_MODEL_ENABLED=1` loads Apache-2.0 `sakshamkr1/deitfake-v2`
at verified revision `f70338d328ba268d2b9d5c6af11044cf0b0e1400`, using safetensors,
no remote code, and checked `Fake=0`, `Real=1` labels. The pinned processor resizes to
224x224 and normalizes RGB with mean/std 0.5. YuNet regions are clamped, expanded by
20% on each side, and rejected below 32 pixels. This VERITAS crop policy is unvalidated.
The publisher describes face data derived from OpenForensics; this does not establish
performance on face swaps, every manipulation type, or VERITAS inputs.

Real inference ran locally: `headshot_cc0.jpg` produced one crop with raw fake-class
score `0.997509`; `portrait_cc0.jpg` had no detected face and no classifier output.
These are software smoke fixtures without independently established manipulation labels.
The high headshot score warrants caution, not a fabricated accuracy claim. All outputs
remain `INCONCLUSIVE`. No threshold or representative accuracy benchmark is validated.
Run `python -m ai_service.smoke_face_classifier` to reproduce. Face evidence is passed
through Express and shown independently in the image evidence panel.

The older statement below that no crop classifier exists describes the earlier checkpoint;
the implementation above supersedes it. Phase 2a remains open pending representative
whole-image and face evaluations and calibration decisions. The new face-classifier path
passed live HTTP uploads and has a real-weight browser upload regression test.

Candidate checkpoint: [dima806/ai_vs_real_image_detection](https://huggingface.co/dima806/ai_vs_real_image_detection), pinned at `9d17b51b9367d6b5720ac81dc339455c45d50ae3`. The model card lists Apache-2.0 and a ViT image classifier derived from `google/vit-base-patch16-224-in21k`; its config maps class 0 to `REAL` and class 1 to `FAKE`.

Scope: whole-image real versus AI-generated classification. It is **not** a facial manipulation detector, edit localizer, provenance verifier, or universal deepfake model. Processor normalization is loaded from the same pinned checkpoint. The service converts decoded JPEG/PNG/WEBP to RGB and uses the checkpoint's `AutoImageProcessor`. Optional face boxes come from the [OpenCV Zoo YuNet](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) detector (MIT license, pinned 2023mar ONNX and SHA-256), replacing the unreliable Haar cascade. The boxes are face candidates, never manipulation scores. A separate experimental face-crop classifier is described below; no Grad-CAM is present.

Status: real checkpoint inference ran on five repository fixtures on 2026-11-14. This tiny, out-of-domain smoke set exposed poor transfer: two of four genuine photos scored above 0.95 for the fake class, while the known synthetic image scored 0.632. The other genuine photos scored 0.594 and 0.457. This is a software smoke check, not an accuracy estimate. The checkpoint is quarantined as **experimental**: the API always returns `INCONCLUSIVE`, retains the raw softmax score for inspection, and reports null calibrated confidence. It cannot drive the application verdict. Published model-card metrics are not VERITAS metrics. The card warns of drift from newer generators. No model weights are committed.

Local setup on a Python-enabled machine: install `ai_service/requirements.txt`, choose `VERITAS_IMAGE_MODEL=dima` or `smaug`, set `VERITAS_IMAGE_MODEL_ENABLED=1`, and run `uvicorn ai_service.app:app --host 127.0.0.1 --port 8001`. Set `VERITAS_AI_SERVICE_URL=http://127.0.0.1:8001` for Express. The selected checkpoint downloads from Hugging Face at first startup; review terms and network policy first. `/health` reports unavailable if model loading fails. The existing Gemini/heuristic route remains the fallback.

For repeatable offline Dima evaluation, set `VERITAS_IMAGE_MODEL_PATH` to the immutable local snapshot directory for revision `9d17b51b9367d6b5720ac81dc339455c45d50ae3`; for DeiTFake v2, set `VERITAS_FACE_MODEL_PATH` to the snapshot for revision `f70338d328ba268d2b9d5c6af11044cf0b0e1400`. This bypasses mutable Hub refs and ambient cache-root lookup. `python -m ai_service.diagnose_image_runtime` runs imports, processor/model loading, preprocessing, and one forward pass in a disposable subprocess with a required output report and a bounded 1–900 second deadline. The supervisor records structured stage events and observed RSS and terminates the worker tree on timeout.

To enable face-region candidates, run `python -m ai_service.download_yunet`. This verifies SHA-256 `8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4` before storing the ONNX file in ignored `ai_service/models/`. `/health` reports the face detector separately. Set `VERITAS_FACE_MODEL_ENABLED=1` to load the optional pinned face-crop checkpoint on the server; `/health` reports its readiness independently. On the repository smoke fixtures YuNet found the CC0 headshot face (0.944 detector score), rejected four landmark photos and the synthetic dam image, and missed a distant face in another CC0 portrait. This small check is not a sensitivity or false-positive estimate.

If the whole-image classifier is disabled or cannot load, the image endpoint can still return YuNet face candidates and optional face-crop raw outputs with `model_status: unavailable`, a null whole-image fake probability, and an inconclusive classification. If neither whole-image model nor YuNet is available, the endpoint returns HTTP 503. The client marks this output as image screening and lists only models that actually ran.

Before completion: evaluate a suitable current model on a representative held-out real/synthetic image set beyond the tiny existing fixtures, validate calibration and thresholds, and evaluate the separate face-manipulation checkpoint on labeled, subject-disjoint real/manipulated faces. The browser upload and face-box display were exercised with the CC0 headshot; this verifies integration only. Keep general-image and face results separate.

## Experimental face-crop classifier

The optional [DeiTFake v2 checkpoint](https://huggingface.co/sakshamkr1/deitfake-v2) is pinned at `f70338d328ba268d2b9d5c6af11044cf0b0e1400` (Apache-2.0, safetensors). Its config maps class 0 to `Fake` and class 1 to `Real`. The server loads the publisher's image processor and ViT weights with `trust_remote_code=False`; YuNet supplies candidate face boxes, and up to three square crops with 10% context are screened independently. The raw class-0 softmax is returned per box. It is uncalibrated and never changes `INCONCLUSIVE`, confidence, or the authenticity verdict.

The pinned weights loaded successfully from the ignored model cache. On one CC0 genuine headshot, YuNet found one candidate and the face model returned raw fake-class output 0.516; on a landmark photo, no face crop was applicable. These two unlabeled-for-manipulation transport cases cannot estimate face-swap detection accuracy, false-positive rate, or calibration. The publisher's in-domain metrics are not VERITAS results. A subject-disjoint manipulation benchmark, crop-policy comparison, compression and demographic robustness checks, and latency measurement are needed before any decision threshold. The model requires server CPU/GPU memory; users do not download weights.

## Replacement review

- [Smaug-AI-Image-Detector](https://huggingface.co/abacusai/Smaug-AI-Image-Detector) is an Apache-2.0, 2026 checkpoint with documented evaluation on OpenFake and CommunityForensics. The optional adapter pins revision `c7c95951e04a87b884a4ad479401b1128c3903bd` and implements the publisher's three 528-pixel crop and mean-logit preprocessing. It has a larger (~0.4B parameter) embedding backbone. A real smoke run was attempted but the Hub connection reset five times before the snapshot downloaded, so compatibility, latency, and local accuracy remain unverified. Its published AUC is not a VERITAS result. The adapter always returns inconclusive until evaluated.
- [Imager-1-Pro](https://huggingface.co/Imagers/imager-1-pro) is Apache-2.0 and trained on newer generators, but its release is explicitly a base model and its weights are a PyTorch `.bin` file. Inspect the supplied inference code and loading safety before execution.
- [open-deepfake-detection](https://huggingface.co/prithivMLmods/open-deepfake-detection) supplies safetensors and an Apache-2.0 label mapping, but its own model card marks it deprecated. Do not adopt without a strong independent result.
- [Community Forensics 384](https://huggingface.co/OwensLab/commfor-model-384) is an official MIT-licensed safetensors checkpoint for general synthetic-image detection. Its [project repository](https://github.com/JeongsooP/Community-Forensics) provides evaluation instructions. It is a promising replacement candidate, not a face-manipulation detector or a validated VERITAS model.
- [DeiTFake v2](https://huggingface.co/sakshamkr1/deitfake-v2) is now an optional experimental face-crop adapter as described above. Its publisher explicitly limits production use without further validation; its in-domain metrics are not VERITAS results.

## Temporal diagnostic evaluation supplement — 2026-11-15

`docs/VIDEO_TEMPORAL_EVALUATION.md` records 20 procedural control clips, 60 executions
and no independent camera or manipulated-video evaluation. Baseline candidate burden
was 16 sampled intervals per source minute; this is not accuracy or a genuine-video
false-positive rate. Neither tested offline filter improved the control count. No
temporal policy, model, verdict or probability was promoted. Phase 2d remains open;
local temporal results remain INCONCLUSIVE with null decision probability. Prior model
benchmark results and reserved datasets are unchanged.
