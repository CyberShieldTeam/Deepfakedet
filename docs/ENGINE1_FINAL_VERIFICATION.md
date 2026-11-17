# Engine 1 implementation and verification record

## Delivered versus unvalidated

Implemented reproducible pinned external image/audio comparisons; original/transformed input identities; offline cached model loading; memory admission; image/audio busy rejection and recovery; retained image evidence on model-forward failure; accurate no-window audio status; researcher model/source/score/evaluation details; video original→extracted-audio identity and segment display; traceable graph/report evidence. No model/threshold or cross-modal authenticity fusion promoted.

Image: Community promising on the small external sample, but encoding/source/independence and confidence-bound gates fail. Dima/SDXL remain poor on that sample. Audio: severe genuine false positives; AASIST remains experimental. Video: trained temporal detector/independent genuine-manipulated metrics unavailable. [Audit](ENGINE1_MEDIA_CAPABILITY_AUDIT.md), [comparison](ENGINE1_MODEL_COMPARISON.md), [image results](ENGINE1_IMAGE_EVALUATION.md), [audio results](ENGINE1_AUDIO_EVALUATION.md), [video blockers](ENGINE1_VIDEO_EVALUATION.md).

## Local and browser evidence

Normal authenticated `http://localhost:3000`: actual-input development workspace, existing operator cases retained. Four publisher-labelled original genuine/synthetic image and speech upload journeys passed; image classifier correctly unavailable, YuNet ready, AASIST actually executes, all authenticity results inconclusive. Operator store byte comparison passed. Local credentials remain private, uncommitted.

Isolated authenticated actual-input workspace, not demo fixtures: Community service8003 for image; actual service8001 for AASIST/video. Browser checks passed original genuine/synthetic images, recompressed genuine, resized synthetic, CC0 portrait face-region control, authored no-face image, original genuine/synthetic speech, silence, short silent audio, derived0.5s genuine speech, video without audio, video with tone, scene cut, procedural speech-bearing video, actual disabled AASIST, unsupported text and corrupt PNG. Fifteen processed records saved to a scratch case; eighteen checks total. Genuine/manipulated video accuracy was not tested: those clips are procedural software controls.

Each received source hash agreed with the selected file; actual model outputs/statuses survived receipt-backed attachment, disk storage, report API and Engine4; rendered report displayed source identities and official documentation. No browser runtime errors. Cases are stored newest first; the first test harness incorrectly assumed oldest first, failed, then was corrected to compare stable analysis IDs. No evidence-loss application defect was found at that boundary. The failed diagnostic report remains private history.

Local private browser artifacts live under `.model-cache/engine1-upgrade/browser-*`; the reproducible opt-in harness is [verify-engine1.mjs](../scripts/verify-engine1.mjs). It requires separately authorized cached media/models and both services. Default uses a scratch owned case; `VERITAS_E1_MANUAL=1` reads existing local access and never attaches results. Authored transformations are explicit [controls](../ai_service/prepare_media_controls.py), not a fabricated benchmark. [Preprocessing controls](../reports/engine1_preprocessing_controls_v1.json) passed actual cached model inference, but use direct service/lifespan calls after the installed Starlette test client requested an unavailable `httpx2`; they are not HTTP checks. Browser runs separately exercise actual HTTP.

## Tests

Final full Python suite:118 tests passed, zero skips (including installed-weight AASIST/YuNet contracts and image/audio busy/failure recovery). `npm test`, TypeScript, production build and114 repository-relative documentation targets passed. Existing large-chunk build warning retained. Startup, claim-provider, NLI, advanced claims, Engine3, Engine4, diagnostics, extraction and OCRgeometry suites passed. Actual OCR/API and OCRworker runtime/recovery suites passed. New trace contract rejects wrong hashes, byte counts, dimensions, false segment status and invalid padding; legacy responses without traces remain accepted. Final actual-service browser refresh passed18 isolated checks and4 normal-workspace uploads; operator case-store SHA unchanged since restart. CI results are recorded separately after push. Inconclusive zero-confidence sentinels now render as not estimated in case lists/reports, consistent with the existing media view, without changing stored scores or verdict rules.

No original Mirage reserved files opened. No raw research images/audio, checkpoints, personal screenshots, credentials or case stores committed. Original evaluation results preserved. Resource/rights limitations remain explicit rather than counted as passed validation.

## Startup

Use the existing private launchers when available:

```powershell
# Terminal1: actual local media service; uses already-installed pinned weights only
$env:VERITAS_IMAGE_MODEL_ENABLED='0'
$env:VERITAS_FACE_MODEL_ENABLED='0'
$env:VERITAS_AUDIO_MODEL_ENABLED='1'
$env:HF_HUB_OFFLINE='1'
$env:TRANSFORMERS_OFFLINE='1'
.\.venv-win\Scripts\python.exe -m uvicorn ai_service.app:app --host 127.0.0.1 --port 8001
# Terminal2: existing owner/token/store and Engine2 research configuration
node --import tsx .model-cache/engine2-advanced/resume.mts
```

Do not start duplicate services on occupied ports. Open `http://localhost:3000` and use your existing local analyst token; it is intentionally not printed in this document. On a fresh checkout, use the documented auth/store environment in README and `.env.example`; ignored private launchers are not distributed. Optional Community research uses a separate port and explicit opt-in, not a validated default.

Highest-impact next step: rights-cleared source/speaker/identity-disjoint target-domain data, matched channel/encoding controls and publisher-score parity for AASIST, followed by frozen calibration/acceptance gates. Additional raw model scores without that evidence would not justify stronger user-facing verdicts.
