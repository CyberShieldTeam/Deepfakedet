# Temporal evaluation protocol v1 — 2026-11-15

Predeclared development experiment. No final holdout or reserved image dataset may be
opened by this evaluator. Pipeline reference: commit a673310; method bounded_farneback_v1,
25 samples/24 pairs, max480 long side, CPU thread1, soft6/hard8 seconds, default .5-second
spacing. Sampling sensitivity also uses .25 and 1 second, with no threshold fitting.

Only newly generated software controls are approved for this run by the user's task.
They use procedural random texture (seeds101/202), geometric transforms and FFmpeg H.264
encoding, not camera capture, faces, a deepfake generator or a trained model. Video-level
ground truth is NOT_APPLICABLE. No deepfake classification metrics may be emitted for
these controls. Existing transport fixtures and benchmark reports remain unchanged.

Conditions: static, camera translation, moving textured patch, abrupt scene change,
gradual illumination, occlusion, local patch appearance and fast camera translation.
Each uses the same seed101 source at 8 and 24 fps, 320×192, three seconds, H.264 CRF18,
yuv420p. Compression and resolution variants derive from the camera-translation source
(CRF38; 640×384). All derivatives share source lineage and development split. Raw frame
hashes and exact generation/encoding parameters are logged, encoded-file hashes are
verified, and decoder metadata are compared to manifest metadata before admission.

Primary measure: number of sampled intervals labeled localized_change_candidate per
source-video minute, plus observation distributions, pair counts, runtime and worker
peak memory. This is sampling-dependent candidate burden, not independent event rate,
false-positive probability or deepfake accuracy. Controls with expected ordinary changes
can expose nuisance candidates, without serving as genuine camera negatives.

Two offline ablations operate on the SAME frozen output, never change application
thresholds, and are not deployed:
1. Global-coherence suppression: suppress candidate when motionCoherence>.90 and
   medianFlowPixels>1; tests whether legitimate camera motion and local changes collide.
2. Stronger relative-residual gate: require maxTileResidual/max(meanMotionCompensatedResidual,1)>4.
Also describe existing cut/quality gates, compression/lighting/occlusion behavior and
sampling effects. Reject promotion of either rule absent convincing independent data;
a lower count alone is not a benefit if local-change sensitivity/coverage is lost.

Authentic/manipulated/generated evaluation requires a separately approved operator
registry, hashed license/authorization/label/grouping evidence, verified ground truth
and known source/identity lineage. Metadata assertions are not automatically proof of
rights or label truth; the operator registry is a reviewed governance input. Blocked
datasets cannot be admitted by setting a flag in an individual manifest row.

Temporal localization precision/recall is eligible only for independently reviewed,
complete interval annotations with hashed evidence, matching source video SHA-256 and
recorded annotators. Predicted sampled intervals are matched one-to-one at IoU>=.5.
No such annotations are available in this run; metrics remain null. Spatial segmentation
precision/recall is not implemented and must not be inferred from temporal overlap.

Production remains INCONCLUSIVE with decisionProbability=null. No RAFT, rPPG, heavy
model, final-holdout tuning, restricted download or external-media upload is authorized
by this experiment. Independent validation and Phase2d remain open.
