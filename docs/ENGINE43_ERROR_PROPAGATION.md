# Engine 4.3 downstream error propagation

## Authored fault injection, separate from actual OCR

`create_engine43_controls.py` renders source strings and records original SHA/dimensions
and the renderer's source region. `engine43Controls.ts` injects a different transcript
into isolated fixture records. It labels the method
`AUTHORED_INJECTED_TRANSCRIPT_NOT_OCR`, revision/hash `not-run`, with no OCR confidence.
Boxes are authored rendered regions, not measured OCR boxes. This does not alter the
production Tesseract contract or substitute fake inference in the application.

| Control | Injected error | Verified behavior |
|---|---|---|
| Number | 75 -> 15 | Pending blocks investigation; corrected 75 becomes Engine 2 input and graph claim. Original 15 remains recorded. |
| Location | Hyderabad -> Hyderbad | Current correction propagates without rewriting the original candidate or source identity. |
| Negation | Removes `not` | Only three exact corrected-text posts link; three opposite-worded posts do not become equivalent claim mentions. |
| Date | `June 17, 2031` -> `June` | Full source string is used only after explicit correction; image segment timestamp stays null. |
| Mixed scripts | Replaces mixed source with English sentence | Review stays uncertain; investigation returns 409; no unsupported translation/final binding. |

The actual owned Express review, Engine 2, correlation, report and persistent repository
were used. Unauthenticated/other-owner enforcement remains; other-owner review returns
404. Repeated investigation does not inflate claim records. Histories preserve one
recorded review/control and immutable original strings. Source hashes remain identical.
These are automated review actions by the test identity, not evidence that human
reviewers detect errors or complete tasks reliably.

Four English controls end with `Insufficient Evidence`. The injected-control corpus
returns **zero retrieved sources** for these queries under current retrieval rules.
This is preserved as an observed limitation, not filled with invented evidence. Source
attribution/retrieval parity is separately verified by the existing real-OCR browser/API
fixture with its actually retrieved fictional source. No live-news accuracy is claimed.

Artifacts: `reports/engine43_error_propagation_controls.json`, real-OCR API/browser
reports. The injection report records original/corrected text, source hash, graph counts,
review-to-claim provenance and post counts. Existing engine tests separately cover
withdrawal/stale review, failure retention, deterministic identity and contradiction
preservation. Deterministic exact-link correctness on authored contrasts is **engineering
correctness**, not independent analytical relationship precision/recall or coordination.

## Actual frontend verification

A new gated Playwright workflow uses a fresh isolated fixture store, opens the original
number image and overlay, sees the explicit injected method, verifies disabled pending
investigation, corrects 15 to 75, investigates and correlates. It checks raw/API/stored
text, graph post count and both strings/provenance in the rendered report. It passed
in development and authenticated production. No reviewer timing/agreement/usability
score is inferred. Separate existing real-OCR workflows verify actual upload/inference,
profile selection, source coordinates/full-resolution overlays, retrieval and graph/report
parity. No frontend redesign or automatic acceptance was necessary.

Independent factual assertion correctness, missing/fragmented assertion rates and
unsupported-candidate rates remain unavailable without independently labelled claims.
Source strings used to render controls are not manufactured independent claim labels.
