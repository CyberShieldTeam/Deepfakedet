# Engine 1 actual capability audit — 2026-11-17

Starting commit `0a8fb07fd227ca747bffcad2910038842b5e4f71`, branch `codex/integrate-figma-upgrade`; clean and synchronized before changes. Technical execution is separate from validated detection accuracy. No media model was promoted and no threshold was fitted.

| Boundary | Implemented and checked | Scientific limitation |
|---|---|---|
| Image browser → Express | Original file SHA-256, original-image handoff, preview/ELA/frequency signals, strict upload validation | Browser signals are not authenticity classifiers |
| Python image | EXIF transpose, RGB conversion, YuNet, optional pinned cached Community/Dima, separate face classifier | Classifiers experimental; alpha discarded, hidden RGB can affect scores |
| Provenance | Existing EXIF and C2PA signature/binding/trust states retained independently | Missing metadata proves nothing; valid signature is not independent truth |
| Audio browser → Python | Original WAV/MP3 handoff, libsndfile decode, mean downmix, polyphase 16kHz resample, AASIST windows | Silence gate does not establish speech; raw scores uncalibrated |
| Video browser → Python | Original bounded clip, up to six selected JPEG frames, frame quality, adjacent-original flow, temporal worker, FFmpeg audio extraction | No validated video/temporal manipulation model or aggregation |
| Persistence | Server-issued media receipt attached to owned case; source and transformed hashes retained | Does not convert observations to verdicts |
| Engine 4 | Allowlisted hashes, frame times, model states and raw observations in graph metadata | No new authenticity edges, score fusion or malicious-intent inference |
| Reports | API/disk parity and rendered experimental model details, raw evidence, identities and documentation links | Documentation describes a tool, not the uploaded file |

Actual normal workspace: `http://localhost:3000`, authenticated actual-input development mode. Python `127.0.0.1:8001`: YuNet and AASIST ready; whole-image and face classifiers disabled. Four genuine/synthetic publisher-labelled image/speech UI uploads passed without changing operator cases. An isolated **authenticated actual-input** workspace tested Community on `8003`; it is not the authored demo. Research activation was not made the operator default.

Cached checkpoints: Dima, Community, SDXL, DeiTFake face classifier, YuNet and AASIST. SDXL remains an offline comparison, not a selectable production adapter. Smaug and UFD backbones absent; NPR not downloaded. [Model identities, rights and blockers](ENGINE1_MODEL_COMPARISON.md).

New input trace fields are optional for historical/API compatibility, validated when present. Image source bytes/hash and audio/video identities are checked by Express. Image inference failure retains face evidence and null score. Audio and image requests reject overlapping work with 429 and release locks after failure. Existing size/duration/timeouts, ownership, receipts, OCR and all verdict safeguards remain.

Do not conflate four questions: AI generation, image/voice manipulation, provenance, and factual accuracy of accompanying claims. See [image](ENGINE1_IMAGE_EVALUATION.md), [audio](ENGINE1_AUDIO_EVALUATION.md), [video](ENGINE1_VIDEO_EVALUATION.md) and [verification](ENGINE1_FINAL_VERIFICATION.md).
