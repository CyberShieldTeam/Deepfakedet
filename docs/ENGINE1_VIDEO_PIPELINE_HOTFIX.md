# Engine 1 video evidence retention hotfix

Date: 2026-11-18  
Branch: `codex/engine1-video-pipeline-reliability`

## Reported symptom and root cause

A reported 14-second, 2.33 MB video produced browser measurements but zero server image measurements, sampled frames and scored audio segments. The file size and duration are within every relevant limit: 24 MiB frontend selection, 8 MiB original-video submission/decoder, 120 seconds, 3,600 source frames and 1920×1080 decoded dimensions.

The latest `main` and the available Engine 1 history/branches were inspected. The current pipeline is:

1. `MediaLabView` decodes up to 16 browser frames and sends browser measurements, JPEG keyframes, timestamps and the original video when it is at most 8 MiB.
2. Express validates the request and `mediaPipeline` sends original bytes to `/v1/video/analyze` when `VERITAS_AI_SERVICE_URL` is configured.
3. The Python service uses OpenCV to select up to six frames, computes frame-quality and adjacent-frame Farneback measurements, and uses bundled FFmpeg for the first audio track.
4. Each selected JPEG was then passed to `ai_service.app.analyze_image`.

The defect was step 4. When both the optional image checkpoint and YuNet were unavailable, `analyze_image` returned HTTP 503. That exception aborted the entire `/v1/video/analyze` response after decoding had already succeeded. Express attempted the browser-frame fallback, but that fallback called the same unavailable image endpoint and also failed. Consequently none of the successfully decoded timestamps, quality measurements or motion observations reached the result.

A second reporting defect compounded the symptom: media diagnostics counted only browser frames with an available classifier output. Retained browser thumbnails with `status=unavailable` were displayed as zero sampled frames.

## Fix

- The Python video service now treats decoder evidence independently from optional checkpoints. If a valid decoded JPEG receives the specific model-unavailable 503, it returns an explicit `INCONCLUSIVE`, `model_status=unavailable` frame record with its JPEG hash/input trace instead of dropping the video response.
- Other image errors still fail closed; corrupt inputs, unsafe formats, size/duration/frame/dimension limits and invalid responses are unchanged.
- `/health` now reports video decoder/OpenCV/FFmpeg readiness separately from image, face and audio model readiness.
- Express `/api/health` exposes the bounded local-media health result when configured.
- Media diagnostics separately report server-decoded frames, browser-sampled frames and classifier-scored frames. Unscored retained frames no longer appear as zero.
- Stage diagnostics retain a bounded failure message and explicitly report an unconfigured service, original-video size fallback, decoder failure, frame-classifier availability and video-audio availability.
- The Media UI now prominently distinguishes server evidence retained, server analysis failed and server analysis unavailable.
- UI copy no longer suggests Gemini is a forensic video detector.

Latest `main` includes a separate, explicit-consent Gemini visual-description path. When the operator opts in, an image or up to six client-sampled video frames (for clips no longer than 30 seconds) may be sent; video audio is not sent. The response parser accepts bounded observations, explanations, and limitations, and rejects verdict/probability-shaped responses. Gemini output does not populate `aiGeneration`, does not appear in dedicated classifier `modelsUsed`, and does not change the authenticity result. A “Gemini assessment: Complete” status therefore means only that the optional descriptive request completed; it is not retained server-decoded forensic evidence or validated authenticity detection.

## Local environment observation

Before the fix, no service listened on ports 8001 or 8417. After starting the full service locally:

- video decoder: ready (`OpenCV 4.14.0`, bundled FFmpeg available);
- whole-image checkpoint: unavailable and disabled;
- YuNet checkpoint: absent/unavailable;
- AASIST: unavailable and disabled;
- experimental face checkpoint: unavailable and disabled.

No ignored model cache or checkpoint files existed in the isolated worktree. Enabling these models without their pinned files would fail initialization; their documented evaluation gates still apply.

## Reproduction evidence

The checked-in procedural three-second MP4 with tone is transport-only and has no authenticity label. With every optional model unavailable, an actual Express → Python upload now retained:

- 6 server-decoded frames;
- 6 frame hashes/input traces;
- timestamp, quality and adjacent-frame motion observations;
- explicit frame-classifier unavailable state;
- explicit AASIST unavailable state;
- `inconclusive` authenticity and no AI-generation probability.

This demonstrates evidence retention and failure reporting, not deepfake detection accuracy.

## Model recommendation

No video authenticity model is enabled by this change. The repository has no admitted, representative, identity/source-separated genuine/manipulated video benchmark covering unseen generators. Existing DeepfakeBench feasibility notes do not constitute local validation, and no checkpoint was downloaded for this hotfix. A model should be considered only after license review and a frozen evaluation measuring video-level AUROC, false-positive rate, generator-held-out recall, compression robustness, abstention and resource use. Frame/image scores and AASIST speech scores must remain separate until a prespecified fusion rule is independently validated.
