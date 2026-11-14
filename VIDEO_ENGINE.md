# Experimental video frame screening

Status: Phase 2c partial implementation. This path supplies timestamped local image evidence for a video timeline. It does not produce a local video authenticity verdict.

## Processing path

The existing browser sampler reads 16 evenly spaced video frames, computes simple frame differences, and displays a timeline. It now sends up to six of those frames as 480-pixel-wide JPEG data URLs with timestamps to the Express media route. Express checks that the frame list has 1–6 entries with finite, ascending timestamps and passes each image to the optional Python image service. The response keeps each frame's raw image-model output and YuNet face candidates separate from the video result.

When local frame screening is the only AI path available, the result is `inconclusive`, confidence 0, and no AI-made probability. If Gemini is configured and succeeds, the local frame evidence is attached without changing Gemini's verdict. The whole-image Dima checkpoint failed an initial out-of-domain smoke check and remains quarantined as an experimental raw score. YuNet supplies unverified face regions, not a face-forgery judgment.

## Verification

The repository includes a three-second, 320×180 H.264 test-pattern clip made with FFmpeg's `testsrc`, plus three extracted JPEG frames. They are transport fixtures without real/fake labels. Mock contract tests cover frame ordering and the no-verdict result. A real HTTP smoke used the three JPEGs through Express and Python with cached Dima and YuNet; a browser upload of the clip displayed 16 timeline frames, six local-screening markers, and an inconclusive result. Neither test measures detection accuracy.

## Open work

- Decode and validate the original video on the server, with bounded resource use and a job path for long clips.
- Choose frames using quality and face continuity, then evaluate image and face-manipulation models on held-out video frames.
- Define and validate quality-aware aggregation before any local video verdict or probability.
- Extract video audio for the separate audio engine. Add and evaluate a temporal model for Phase 2d.
