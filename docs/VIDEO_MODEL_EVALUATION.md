# Video capability and evaluation decision — 2026-11-17 local date

Actual browser upload of the existing procedural three-second moving test-pattern clip
with tone exercised original-video decode, **6 server-decoded frames**, timestamped
image evidence and separately extracted audio with AASIST inference. Inconclusive
authenticity and null decision probability survived save/correlation/report. This is
functional evidence, not a genuine/manipulated-video benchmark. The clip has no people,
speech or real-world authenticity label.

Existing quality sampling, YuNet candidates, geometric face continuity, optical-flow
observations, frame limits, FFmpeg extraction and failure-preservation logic were kept.
No trained video-level model or calibrated frame aggregation was added. An unavailable
frame classifier still cannot create a video verdict, and successful audio inference
cannot label the video manipulated. No audio-visual lip synchronization detector ran.

Research reference: [official DeepfakeBench](https://github.com/SCLBD/DeepfakeBench).
The repository describes image/frame and video detector families and reproducible
evaluation tooling. Framework CC BY-NC terms and each dataset/checkpoint's independent
conditions require review. A framework is not a ready validated VERITAS checkpoint;
frame classifiers and trained temporal architectures have different input/crop/sequence
contracts. No weights/data from this source were downloaded or its code executed.

No legally admitted independent real/manipulated-video corpus with subject/source splits
was available. Video-level accuracy, FPR/FNR, AUROC, aggregation stability across
compression and true audio-visual consistency remain unmeasured. Prior procedural
temporal controls already showed ordinary motion triggering candidates; those are not
genuine-video false-positive rates. See [video engine](../VIDEO_ENGINE.md),
[temporal evaluation](VIDEO_TEMPORAL_EVALUATION.md) and
[feasibility](FORENSIC_CAPABILITY_FEASIBILITY.md).

Next feasible scientific work: acquire permitted source/subject-separated clips, fix
frame/face policy and predeclare aggregation/coverage/abstention, evaluate compression,
scene cuts, missing audio and unseen manipulation families. Select a task-compatible
trained temporal model only after resource/license checks, keeping video and speech
evidence separate. Existing experimental observations remain available immediately.
