# Image engine model record

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

Scope: whole-image real versus AI-generated classification. It is **not** a facial manipulation detector, edit localizer, provenance verifier, or universal deepfake model. Processor normalization is loaded from the same pinned checkpoint. The service converts decoded JPEG/PNG/WEBP to RGB and uses the checkpoint's `AutoImageProcessor`. Optional face boxes now come from the [OpenCV Zoo YuNet](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) detector (MIT license, pinned 2023mar ONNX and SHA-256), replacing the unreliable Haar cascade. The boxes are still face candidates and never manipulation scores. No face-crop classifier or Grad-CAM is present.

Status: real checkpoint inference ran on five repository fixtures on 2026-11-14. This tiny, out-of-domain smoke set exposed poor transfer: two of four genuine photos scored above 0.95 for the fake class, while the known synthetic image scored 0.632. The other genuine photos scored 0.594 and 0.457. This is a software smoke check, not an accuracy estimate. The checkpoint is quarantined as **experimental**: the API always returns `INCONCLUSIVE`, retains the raw softmax score for inspection, and reports null calibrated confidence. It cannot drive the application verdict. Published model-card metrics are not VERITAS metrics. The card warns of drift from newer generators. No model weights are committed.

Local setup on a Python-enabled machine: install `ai_service/requirements.txt`, choose `VERITAS_IMAGE_MODEL=dima` or `smaug`, set `VERITAS_IMAGE_MODEL_ENABLED=1`, and run `uvicorn ai_service.app:app --host 127.0.0.1 --port 8001`. Set `VERITAS_AI_SERVICE_URL=http://127.0.0.1:8001` for Express. The selected checkpoint downloads from Hugging Face at first startup; review terms and network policy first. `/health` reports unavailable if model loading fails. The existing Gemini/heuristic route remains the fallback.

To enable face-region candidates, run `python -m ai_service.download_yunet`. This verifies SHA-256 `8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4` before storing the ONNX file in ignored `ai_service/models/`. `/health` reports the face detector separately. On the repository smoke fixtures YuNet found the CC0 headshot face (0.944 detector score), rejected four landmark photos and the synthetic dam image, and missed a distant face in another CC0 portrait. This small check is not a sensitivity or false-positive estimate.

If the whole-image classifier is disabled or cannot load, the image endpoint can still return YuNet face candidates with `model_status: unavailable`, a null fake probability, and an inconclusive classification. If neither model nor YuNet is available, the endpoint returns HTTP 503. The client marks face-only output as local screening and does not list the configured classifier as a model used.

Before completion: evaluate a suitable current model on a representative held-out real/synthetic image set beyond the tiny existing fixtures, validate calibration and thresholds, and add a separately licensed face-manipulation checkpoint. The browser upload and face-box display were exercised with the CC0 headshot; this verifies integration only. Keep general-image and face results separate.

## Replacement review

- [Smaug-AI-Image-Detector](https://huggingface.co/abacusai/Smaug-AI-Image-Detector) is an Apache-2.0, 2026 checkpoint with documented evaluation on OpenFake and CommunityForensics. The optional adapter pins revision `c7c95951e04a87b884a4ad479401b1128c3903bd` and implements the publisher's three 528-pixel crop and mean-logit preprocessing. It has a larger (~0.4B parameter) embedding backbone. A real smoke run was attempted but the Hub connection reset five times before the snapshot downloaded, so compatibility, latency, and local accuracy remain unverified. Its published AUC is not a VERITAS result. The adapter always returns inconclusive until evaluated.
- [Imager-1-Pro](https://huggingface.co/Imagers/imager-1-pro) is Apache-2.0 and trained on newer generators, but its release is explicitly a base model and its weights are a PyTorch `.bin` file. Inspect the supplied inference code and loading safety before execution.
- [open-deepfake-detection](https://huggingface.co/prithivMLmods/open-deepfake-detection) supplies safetensors and an Apache-2.0 label mapping, but its own model card marks it deprecated. Do not adopt without a strong independent result.
- [Community Forensics 384](https://huggingface.co/OwensLab/commfor-model-384) is an official MIT-licensed safetensors checkpoint for general synthetic-image detection. Its [project repository](https://github.com/JeongsooP/Community-Forensics) provides evaluation instructions. It is a promising replacement candidate, not a face-manipulation detector or a validated VERITAS model.
- [DeiTFake v2](https://huggingface.co/sakshamkr1/deitfake-v2) is an Apache-2.0 safetensors checkpoint trained on face-cropped data derived from OpenForensics. The publisher explicitly limits production use without further validation. Its reported test metrics are in-domain and are not VERITAS results. A direct Hub metadata request on 2026-11-14 reset the connection, so the checkpoint has not been downloaded or run here.
