# Bounded temporal evaluation — 2026-11-15

Phase 2d remains **open**. This slice completes dataset-readiness infrastructure and
software-control experiments under the user's explicit fallback. It does not validate
deepfake detection. Authentic camera videos evaluated: **0**. Independently labeled
manipulated videos: **0**. Model-generated videos: **0**.

## Frozen method and reproducibility

Starting application commit: `a6733103992bee8417cd8ad860b2f403570e5f17`.
Experiment implementation and original report code hashes are preserved in `feb5d74`.
Subsequent admission hardening adds protocol/codec/lineage checks and does not change
the Farneback policy or recorded experiment results. `ai_service/temporal.py` is unchanged.
The predeclared, hashed protocol is `TEMPORAL_EVALUATION_PROTOCOL.md`; do not edit that
historical protocol in place. New experiments require new manifests and report paths.

The existing method measures forward/backward Farneback flow, roundtrip error,
motion-compensated residual, valid-pixel fraction, tile residual, histogram distance,
and motion coherence. Existing cut, darkness, texture, ambiguous-motion and coherent-motion
observations remain. Residual regions are candidate coordinates, not verified forgeries.
All local temporal responses remain `INCONCLUSIVE`, with `decisionProbability=null`.
No RAFT, rPPG, new classifier, threshold fitting or final-holdout access was introduced.

The production worker still uses sequential bounded decoding: <=8 MiB original bytes,
<=120 seconds, <=3,600 frames, <=1920x1080 pixel count; downscaled long side <=480;
<=25 samples/24 pairs; one OpenCV CPU thread; soft six-second and hard eight-second
subprocess deadlines. These are temporal-stage budgets, not a whole-service SLA.
Native FPS, dimensions and FOURCC are now exposed additively for metadata checking.

## Admission and data handling

`ai_service/evaluation_data.py` shares SHA/path checks with the existing gated image
evaluator. `evaluate_video.py` requires development-role manifests and a separately
reviewed operator registry. Reserved/final roles are rejected before sample access.
`test/fixtures/video/evaluation_manifest.schema.json` describes the structural format;
Python enforces additional cross-row and evidence semantics.

Admission requires local file SHA-256, source and dataset version, license URI, label
basis/reference, cohort, source lineage, contamination review, reviewed identities or
documented non-applicability, FPS/resolution/frame count, CFR evidence and codec/encoding
provenance. Approval evidence files are hashed. Independent camera/manipulation cohorts
also require independent label and grouping evidence. Source IDs, subjects, exact hashes
and groups cannot cross splits; derivatives retain parent lineage and split; cyclic
lineage is rejected. Unknown identities, unverifiable labels and unauthorized entries
are excluded. Development/validation rows undergo lineage checks, but validation media
are neither opened nor scored. Duration and resource guards precede worker invocation.

Decoded FPS/frame count/dimensions/FOURCC must match the manifest, and codec claims must
match the decoded FOURCC. Pixel format and encoder settings remain provenance declarations;
CFR requires reviewed source evidence, not automatic presentation-timestamp analysis.
Registry review is a governance input, not cryptographic proof of rights, identity or
label truth. The operator must actually examine the evidence before approving a corpus.

Independent localization needs complete reviewed interval annotations, evidence SHA,
reviewer IDs and matching video SHA. Predicted intervals match one-to-one at temporal
IoU >=0.5. Software annotations never qualify. Spatial precision/recall is not implemented.
Partial/timeout/failed/insufficient results are retained but excluded from complete-video
candidate-burden denominators; missing cohorts and unsupported metrics remain null.

Example commands from the repository root (use a new output path for each run):

```powershell
.\.venv-win\Scripts\python.exe -m ai_service.prepare_video_controls --help
.\.venv-win\Scripts\python.exe -m ai_service.evaluate_video --manifest .model-cache/video-controls-v1/manifest.json --registry .model-cache/video-controls-v1/registry.json --root . --interval .5 --output reports/video_controls_new_run.json
```

The generator refuses a nonempty destination and evaluation refuses an existing output.
Media stays in ignored `.model-cache`; committed manifests, registry, generation report
and raw evaluation JSON preserve hashes, parameters, code/environment and per-video data.
The controls registry approves only these procedural controls, not external datasets.

## Exact corpus and findings

Twenty procedural, three-second H.264/yuv420p clips: eight conditions at 8 and 24 FPS,
320x192 CRF18, plus camera-translation variants at CRF38 and 640x384 for both FPS values.
Conditions: static, camera translation, subject patch motion, abrupt cut, illumination,
occlusion, local patch appearance, fast camera translation. Seeds 101/202; one correlated
source group; raw-frame and encoded-file hashes recorded. No camera capture, faces or
deepfake generation. Generated patch intervals are software annotations only.

| Sampling spacing | Clips | Complete runs | Candidate intervals | Candidates/source minute |
|---|---:|---:|---:|---:|
| 0.5 s baseline | 20 | 20 | 16 | 16 |
| 0.25 s sensitivity | same 20 | 20 | 6 | 6 |
| 1.0 s sensitivity | same 20 | 20 | 10 | 10 |

Each corpus pass covers one source minute. These are 60 executions of 20 correlated
clips, not 60 independent examples. No incomplete/timeout runs occurred in this experiment.
At baseline, occlusion contributes 12 intervals and patch appearance four. Camera/fast
camera translation, subject patch movement, cuts, lighting and static controls contribute
zero. Each FPS contributes eight baseline intervals. Compression and resolution variants
are only camera-translation controls; zero flags there cannot establish general codec
robustness. The changed sampling counts demonstrate sensitivity to interval selection,
not improved specificity or recall.

Ordinary occlusion produces nuisance candidates in these controls. This is evidence of
an ambiguity worth testing on camera footage, not a genuine-video false-positive rate.
Patch-appearance candidates likewise are not true-positive deepfakes. Independent temporal
precision/recall, spatial precision/recall and authenticity accuracy are **unavailable**.

Both predeclared offline filters (global coherence suppression and stronger relative
residual) retain all baseline 16 candidates; they also retain six and ten in the other
passes. Neither shows a benefit; neither is deployed. Existing motion compensation,
cut/quality gates and thresholds remain unchanged. More favorable counts alone would
not justify deployment without independent localization and coverage evidence.

## Resources and verification

Across 60 runs: measured worker time **0.1614–1.1863 s**, parent subprocess wall time
**0.6764–1.7631 s**, worker peak memory **82.42–100.42 MiB**. Baseline alone:
worker 0.2863–0.639 s, parent wall 0.8438–1.2285 s, peak 82.42–100.34 MiB.
These are observed single-run ranges, not p95, concurrency or end-to-end guarantees.
Environment: Python 3.13.12, OpenCV 4.14.0, NumPy 2.5.4; generation used
imageio-ffmpeg 0.8.1 / FFmpeg 9.0.2-essentials_build-www.gyan.dev and libx264.

Artifacts: `reports/video_control_generation_v1.json`, `video_control_manifest_v1.json`,
`video_control_registry_v1.json`, `video_controls_baseline_v1.json`,
`video_controls_sampling025_v1.json`, `video_controls_sampling100_v1.json`.
The generation report records the FFmpeg binary hash and generator hash. Reports record
manifest/registry/protocol and evaluator/worker/policy hashes. Preserve the historical
implementation commit when reproducing the exact original evaluator bytes.

Python: **64 tests, 63 passed, one optional absent-weight AASIST skip**. The timeout
regression actually terminates a worker using a temporary test-only 1 ms budget and
restores the production eight-second constant. Other tests cover admission failures,
split leakage, protocol tampering, cyclic derivatives, metadata mismatch, resource
limits, incomplete denominators and independent interval eligibility/matching.
Node/API tests, TypeScript and production build passed, including additive native
metadata validation and escaped HTML report export with temporal observations and null
probability. The build retains its existing large-chunk warning.

Final real-service browser checks: development **eight passed / one optional face-model
skip**; actual production **three passed** with an ephemeral authentication token.
Unauthenticated production API requests returned 401; built assets were served. Video
upload displayed temporal observations and interval inspection. Export contents/escaping
were exercised by the Node report test. An initial repeat used the wrong launcher URL
variable and correctly failed three evidence workflows; correcting it to
`VERITAS_AI_SERVICE_URL` restored passes without application changes. Temporary servers
were stopped; ignored logs retain both runs locally.

## Next scientific gate

See `../EVALUATION_DATASETS.md` for authoritative dataset rights/access review.
Acquire a lawfully usable camera corpus and independently labeled manipulation corpus;
save terms and label/grouping evidence, audit source/identity leakage, document CFR and
encoding, and freeze a new development protocol before inference. Obtain independent
complete interval annotations before localization metrics. Include ordinary motion,
occlusion, lighting, cuts and compression, report unavailable cases and resource tails,
and reserve independent validation/final splits. Do not tune against sealed reserves.
Only promote a policy change after independent benefit and bounded resource cost are
demonstrated. Phase 2d cannot yet be considered scientifically validated.
