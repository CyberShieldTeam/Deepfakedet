# Experimental video frame screening

Status: Phase 2c partial implementation. This path supplies timestamped local image evidence for a video timeline. It does not produce a local video authenticity verdict.

## Processing path

The existing browser sampler reads 16 evenly spaced video frames, computes simple frame differences, and displays a timeline. For clips up to 8 MB, the browser also sends the original video to Express. The Python service accepts MP4/MOV or WEBM containers, checks metadata limits (120 seconds, 3,600 frames, 1920×1080), decodes up to six positions with OpenCV, resizes each to 480-pixel width, and screens the JPEG frames with the existing image endpoint. The response includes source scope, timestamps, video dimensions, raw image outputs, and YuNet face candidates.

For larger clips or when server decoding fails, Express retains the browser-sampled path. It validates 1–6 ascending timestamps and screens the browser's JPEG frames through the image endpoint. This path does not decode the original video on the server. The UI marks the nearest corresponding timeline frame for each screened frame and labels whether screening used original-video or browser-sampled frames.

When local frame screening is the only AI path available, the result is `inconclusive`, confidence 0, and no AI-made probability. If Gemini is configured and succeeds, the local frame evidence is attached without changing Gemini's verdict. The whole-image Dima checkpoint failed an initial out-of-domain smoke check and remains quarantined as an experimental raw score. YuNet supplies unverified face regions, not a face-forgery judgment.

## Verification

The repository includes a three-second, 320×180 H.264 test-pattern clip made with FFmpeg's `testsrc`, plus three extracted JPEG frames. They are transport fixtures without real/fake labels. Python tests decode the original clip and reject malformed or oversized input. Node contract tests cover response mapping and the no-verdict result. A live HTTP smoke passed the original clip through Express and Python with cached Dima and YuNet; a browser upload displayed the server-decoded source and an inconclusive result. Neither test measures detection accuracy.

## Open work

- Add streaming/multipart upload and a job path for long clips. The current short-clip path uses base64 JSON and a synchronous decode.
- Choose frames using quality and face continuity, then evaluate image and face-manipulation models on held-out video frames.
- Define and validate quality-aware aggregation before any local video verdict or probability.
- Extract video audio for the separate audio engine. Add and evaluate a temporal model for Phase 2d.
