# Bounded temporal diagnostics — 2026-11-15

## Implementation and interpretation

Extends the remote adjacent-frame `temporal.py` measurements, retaining their original
fields/tests, face-candidate tracks, six quality-selected classifier frames and video
audio extraction. `temporal_video.py` adds a separate stream of sparse comparisons
across the source span. OpenCV Farneback runs forward/backward with one CPU thread;
there are no new weights, RAFT or GPU dependencies.

The result always reports `classification=INCONCLUSIVE` and `decisionProbability=null`.
It contains measured/partial/insufficient-evidence/timed-out/failed status, requested
and effective intervals, sample/pair counts, source dimensions per pair, observed
time spans, candidate change-region coordinates, resource measurements and limitations.
Express validates the schema and bounds. Reports retain these diagnostics separately
from experimental image/face/audio outputs. The UI lists intervals, highlights localized
change candidates, and lets an investigator seek the uploaded video to the selected
time. Region coordinates refer to the reported analysis dimensions, not original pixels.

Observations are deliberately separated:

- `scene_transition_candidate`: large histogram and intensity differences; cuts,
  flashes or exposure changes are alternatives, not confirmed manipulation.
- `insufficient_light` / `insufficient_texture`: quality gates, not fake labels.
- `motion_ambiguous`: large estimated movement or poor valid correspondence; may be
  legitimate fast movement, occlusion or estimation failure.
- `coherent_motion`: flow close to the median global translation, without strong local
  residual regions; does not establish camera origin or authentic capture.
- `localized_change_candidate`: up to three unusually high residual tiles after flow
  compensation. Legitimate movement, occlusion, lighting and compression can cause it.
- `no_localized_change_observed`: no such candidate among these endpoints; unobserved
  frames and sophisticated manipulation remain unassessed.

The thresholds are transparent prototype screening choices, **not learned, calibrated
or validated forgery thresholds**: cut-candidate histogram distance >.65 with raw mean
change >45/255; mean light <20/255; Laplacian texture variance <8; large median flow
>10% of the shorter analysis dimension or valid correspondence <50%; strong tiles
>max(25/255, three times mean compensated residual); coherent motion fraction >75%.
The exact ordering and parameters are in `temporal.py`. These gates do not handle all
camera movements, rolling shutter, dissolves, interpolation or compression artifacts;
no real-world false-positive rate is established.

## Limits and configuration

- Original source <=8 MiB, metadata <=120 seconds / 3,600 frames / 1920×1080 pixels;
  decoded frames are checked again. Supported upload containers remain MP4/MOV/WebM.
- Temporal interval API range .25–60 seconds; existing UI supports 1–60. The service
  defaults to 1 second; UI forwards the selected interval, initially 5 seconds.
- At most **25 sampled frames / 24 comparisons**. Effective stride increases to keep
  coverage of the source span within that budget; the final frame is included.
- Frames are read/grabbed sequentially. Only the previous/current small frames and
  current flow/residual arrays are retained, never a full decoded video in memory.
- Temporal analysis uses at most 480 pixels on the long side without upscaling. The
  inherited six-frame path now also avoids unbounded portrait-frame upscaling.
- Worker soft execution budget: 6 seconds; parent subprocess hard deadline: 8 seconds,
  including import/startup. Timeout kills the worker and preserves an inconclusive
  result; the temporary input directory is cleaned. Partial results identify incomplete
  work. Existing frame classifiers and FFmpeg audio extraction retain separate budgets;
  **8 seconds is not a whole-video endpoint SLA**. A general supervised upload/job
  architecture remains unfinished.
- Sparse endpoints do not continuously analyze the intervening interval. Fewer than
  two comparisons reports insufficient evidence. No continuous temporal anomaly
  coverage, identity verification, physiology or trained temporal classifier is claimed.

## Actual validation and resources

`python -m ai_service.smoke_temporal_video --output reports/temporal_video_smoke.json`
records hashes, parameters, sample observations and Windows whole-worker peak working
set on fixed transport clips at requested .5-second spacing. Python 3.13.12, CPU OpenCV,
20 logical CPUs and about 15.7 GiB total RAM were recorded; the worker uses one OpenCV
thread. These are single-run measurements, not latency distributions or concurrency SLAs.

| Transport input | Worker seconds | Total subprocess wall seconds | Peak worker MiB | Observations |
| --- | ---: | ---: | ---: | --- |
| test_pattern_3s.mp4 | .299 | .870 | 83.00 | Six localized-change candidates |
| headshot_cc0_3s.mp4 | .826 | 1.421 | 108.34 | Six comparisons with no localized change observed |
| test_pattern_with_tone_3s.mp4 | .313 | .866 | 83.84 | Six localized-change candidates |

Test patterns are explicitly generated transport data; the headshot clip is a known
static-image transport fixture. They are not ground-truth deepfake evaluation samples.
The normal pattern's changing geometry triggered candidates, demonstrating confounds
and the need to keep observations separate from authenticity. These figures provide
**no accuracy, sensitivity, specificity or calibration estimate**. Peak memory includes
worker imports; parent service, browser and any separately enabled models are excluded.

Tests cover controlled camera translation versus a local patch change, dark/flat
inputs, an abrupt transition, sample/pair limits, small/coarse sampling, hard timeout
response and soft-deadline partial results. Existing adjacent-frame tests remain.
An initial new assertion assumed 72 source frames; the existing fixture actually has
24, and the assertion was corrected to match the asset rather than changing the asset.

Final checks: Python **54 total, 53 passed / one optional real-weight AASIST skip**;
Node/API temporal schema and all existing contracts passed; TypeScript/build passed.
Real YuNet image and video face/adjacent-flow HTTP smokes passed. Development browser
suite: **8 passed / one optional face-checkpoint skip**. Actual production server,
protected by an ephemeral test token: **three forensic browser workflows passed**.
The first full dev rerun found a test incorrectly assuming local video evidence needs
the face classifier enabled; its expectation now also handles temporal-only operation.
No test/product navigation timeout was increased to obtain these results.

## Remaining gate

### Subsequent evaluation slice — 2026-11-15

The dataset-readiness/control fallback is now implemented. See
[evaluation report](VIDEO_TEMPORAL_EVALUATION.md) and the repository's
`EVALUATION_DATASETS.md` video table. Twenty procedural clips (one correlated source
group) were each tested at .5, .25 and 1-second spacing: 16, six and ten candidate
intervals per source minute respectively. Baseline nuisance candidates concentrate in
occlusion (12) and local patch appearance (four). These are not camera false-positive
rates or deepfake true positives. Two frozen-output filters retained all candidates;
neither was promoted. Existing Farneback thresholds and eight-second deadline remain.

Additive native metadata fields enable evaluator consistency checks. Independent
camera/manipulation counts remain zero; localization precision/recall remains unavailable.
Phase 2d stays open. Python verification now totals 64 tests (63 passed, one optional
AASIST weight skip), including actual worker termination under a test-only short budget.
Earlier results above remain the historical implementation checks.

This is implemented diagnostic software with controlled software tests, not a validated
deepfake detector or completion of trained temporal Phase 2d. Next: acquire an authorized,
source/identity-disjoint video corpus with ordinary cuts, camera/subject motion,
occlusion, illumination, codecs and frame rates; freeze diagnostic parameters; measure
false candidate burden and localization utility with independent annotations. Include
all unavailable/partial cases and resource tails. Keep actual manipulated-video labels
separate from software-generated change controls. No additional heavy model should be
added until it demonstrates independent value against this baseline.

See [OpenCV optical flow documentation](https://docs.opencv.org/4.x/d4/dee/tutorial_optical_flow.html)
for the underlying algorithm, and `FORENSIC_CAPABILITY_FEASIBILITY.md` for deferred methods.
