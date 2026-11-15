# Experimental video frame screening

Status: Phase 2c partial implementation. This path supplies timestamped local image evidence for a video timeline. It does not produce a local video authenticity verdict.

## Processing path

The existing browser sampler reads 16 evenly spaced video frames, computes simple frame differences, and displays a timeline. For clips up to 8 MB, the browser also sends the original video to Express. The Python service accepts MP4/MOV or WEBM containers, checks metadata limits (120 seconds, 3,600 frames, 1920×1080), and chooses up to six positions with OpenCV. At each position it compares three nearby decoded frames using Laplacian variance (detail), mean luma (exposure), and the fraction of nearly black/white pixels. It resizes the chosen frame to 480-pixel width and screens its JPEG with the existing image endpoint. The response includes source scope, timestamps, video dimensions, quality measurements, raw image outputs, and YuNet face candidates.

The selection score is an unvalidated convenience heuristic for avoiding flat or poorly exposed frames. It is not a deepfake score or a calibrated quality probability. The underlying image checkpoint remains experimental regardless of the selected frame.

YuNet boxes are linked between adjacent sampled frames when their overlap is sufficient. The response exposes candidate counts, detector coverage, and geometric tracks with timestamps. Tracks describe continuity of detected regions; they do not establish identity, camera origin, or manipulation. A missed detection breaks a track.

For each selected original-video frame, the decoder also reads one adjacent original frame. OpenCV Farneback dense optical flow measures median and upper-tail motion; forward/backward disagreement and motion-compensated grayscale residuals measure local changes. The largest tile residual can surface a small changed region in a controlled pair. These are experimental Phase 2d measurements, not a trained temporal classifier or a microscopic-manipulation verdict. Sparse sampling, camera movement, cuts, texture, lighting, and encoding can change them. Browser-only frames do not receive this adjacent-original analysis.

For larger clips or when server decoding fails, Express retains the browser-sampled path. It validates 1–6 ascending timestamps and screens the browser's JPEG frames through the image endpoint. This path does not decode the original video on the server. The UI marks the nearest corresponding timeline frame for each screened frame and labels whether screening used original-video or browser-sampled frames.

On the original-video path, FFmpeg extracts at most the first 60 seconds of the first audio track as 16 kHz mono WAV. If AASIST is loaded, the existing audio engine scores its usable windows and attaches raw, uncalibrated segment outputs under `audioTrack`. The response distinguishes `analyzed`, `no_audio`, `model_unavailable`, and `extraction_failed`; audio failure does not erase frame evidence. AASIST is a speech anti-spoofing model, so a tone or other non-speech audio is outside its intended scope. No frame/audio fusion or video authenticity decision is made from these outputs.

When local frame screening is the only AI path available, the result is `inconclusive`, confidence 0, and no AI-made probability. If Gemini is configured and succeeds, the local frame evidence is attached without changing Gemini's verdict. The whole-image Dima checkpoint failed an initial out-of-domain smoke check and remains quarantined as an experimental raw score. YuNet supplies unverified face regions, not a face-forgery judgment.

## Verification

The repository includes a three-second, 320×180 H.264 test-pattern clip made with FFmpeg's `testsrc`, three extracted JPEG frames, and a second clip with a generated 440 Hz tone. It also includes a short H.264 video made from a CC0 headshot to exercise face-region continuity. These are transport fixtures without real/fake labels. Python tests decode the original clip, reject malformed or oversized input, select a detailed neighboring frame over a flat one, and distinguish absent audio from an extracted track. Node contract tests cover response mapping, geometric tracking, and the no-verdict result. Live HTTP smokes send the tone and headshot clips through Express and Python; browser uploads display separate frame, audio, and face-track evidence with an inconclusive result. Neither test measures detection accuracy. The browser's simple frame-difference display marked five spikes in the static headshot clip after H.264 encoding, showing that cue needs calibration before any forensic use.

## Open work

- Add streaming/multipart upload and a job path for long clips. The current short-clip path uses base64 JSON and a synchronous decode.
- Evaluate the frame-quality heuristic and geometric face continuity/coverage before selecting a production sampling policy. Correct the browser frame-difference false spikes. Evaluate image and face-manipulation models on held-out video frames.
- Define and validate quality-aware aggregation before any local video verdict or probability.
- Add speech activity detection and representative AASIST evaluation/calibration before interpreting video speech scores. Add and evaluate a temporal model for Phase 2d.
- Build a labeled temporal evaluation set with genuine captures, edited/fake clips, static encodes, camera motion, cuts, and recompression; measure whether local residuals or a trained model actually detect microscopic manipulations. Consider [Torchvision RAFT](https://docs.pytorch.org/vision/stable/models/raft.html) only after benchmarking against the current [OpenCV flow baseline](https://docs.opencv.org/4.12.0/d4/dee/tutorial_optical_flow.html).

## Reconciled temporal diagnostics — 2026-11-15

The retained adjacent-frame Farneback and geometric face continuity are now supplemented
by bounded interval comparisons across the source span: <=25 samples / 24 pairs, CPU
only, max480 long-side analysis, 6-second worker budget and 8-second parent deadline.
The UI exposes interval observations and seek controls, with structured diagnostic
output in exports. Scene/quality/motion observations never produce authenticity scores.
See `docs/TEMPORAL_DIAGNOSTICS.md` for actual tests/resources and limitations. Historical
sections above apply to their respective earlier snapshots; trained temporal detection,
representative video evaluation/calibration and an overall supervised job path remain open.
