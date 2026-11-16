# Engine 4.2 validation

Starting commit `00b6d06`, branch `codex/integrate-figma-upgrade`, clean/remote 0/0.
Only isolated fixture cases/stores/ports were used. Default investigation data and prior
Engine 4.1 reports were not overwritten; no model threshold or verdict rule changed.

Implemented: versioned rights-gated local evaluator and attributed sample import,
bounded rotation/scaling/layout alternatives, exact source/display affine provenance,
source overlays, explicit layout/profile selection and unchanged mandatory human review.
Failed/unavailable/partial/no-text statuses remain separate from factual evidence status.

## Verification evidence

- Default bitmap identity vs frozen 4.1; all eight EXIF rotations/mirrors; actual marker
  positions; scale/profile budgets; invalid EXIF and profile handling.
- Four-corner affine boxes, capped 32-line/16-candidate behavior; unchanged five review
  states/history and pending/current-revision gates.
- Manifest rights/path/hash/split/near-duplicate checks; no-text vs unavailable/failure
  math; streaming nested/Unicode annotations and incomplete/over-budget rejection.
- Actual OCR/API baseline and rotated image, invalid profile, real original-source boxes,
  accepted/corrected text, reviewed Engine 2/4 linkage, owner isolation, wrong hash,
  missing model, failed rerun retention, withdrawal, storage rollback, API/disk/report parity.
- Actual OCR reliability: busy request rejects 429; abort during preparation/worker
  returns explicit 504; subsequent OCR recovers. Fixed 30s worker/40s total deadlines
  remain; natural deadline exhaustion did not occur in measured workloads.
- Existing Node engines/API, Engine 3 reliability, Engine 4, cross-engine diagnostics and
  extraction controls passed. TypeScript/build passed; existing large-chunk warning remains.
- Initial Python aggregate: 85 tests, one optional AASIST skip. Final count/browser profiles
  recorded below after final checks.

Independent metrics and authored experiments are separated in ENGINE42_EVALUATION.md.
Measured independent pass times ~0.94–1.05s including runner startup, sampled OCR-tree
peaks generally ~182–187 MiB with a layout-probe baseline peak ~239 MiB. Authored first
clear pass ~1.98s/~250MiB; other printed controls commonly ~1.0–1.2s/~175–186MiB.
The 4.1 historical ~0.9s/~203MiB observation has a different sampling/startup/workload
context. No speedup, percentile, concurrency, real-time or hard native-memory claim.
Preparation/web services are excluded from OCR-process-tree RSS; sampling interval20ms.

## Browser trace

Original image upload → selected OCR profile → actual raw OCR → source/display boxes →
pending candidate → authenticated accepted/corrected review → actual authored corpus
retrieval → current-review Engine 4 relationships → HTML report and persisted case.
Browser tests inspect actual SVG rectangle coordinates and compare API, disk and report
JSON. No-text/unsupported/technical-failure behavior is independently covered by API/
worker controls, not reinterpreted as a factual verdict.

A development regression exposed the existing 100-row HTML graph cap hiding a manual
MEDIA_CONTEXT_CLAIM edge for some case IDs. The graph/API were intact. The dedicated
provenance summary now includes both extraction and analyst-context bindings, preserving
manual-caption attribution without removing the table cap or any assertion/test.
Independent-import whole-JSON decompression first failed safely at its cap; streaming
fixed this without increasing limits. These earlier failures are not counted as passes.

## Reproduction

From repository root, with explicit fixed English model and existing dependencies:
1. `python -m unittest discover -s ai_service -p 'test_*.py'`
2. `python -m ai_service.create_engine42_controls`
3. Start Python preparation on isolated 8417; set VERITAS_AI_SERVICE_URL in test processes.
4. `python -m ai_service.ocr_evaluation .model-cache/engine42-controls/manifest.json --output fresh-authored.json`
5. `python -m ai_service.admit_hiertext_sample` explicitly downloads the bounded sample;
   do not run against an existing completed sample. Frozen hashes/attributions are in
   `reports/engine42_hiertext_manifest.json`. No final holdout is opened.
6. `python -m ai_service.ocr_evaluation .model-cache/engine42-hiertext/manifest.json --output fresh-independent.json`
7. Node engine suites, `npm run test:extraction`, `npm run test:engine42`, lint/build;
   actual extraction API uses VERITAS_EXTRACTION_TEST_REPORT to preserve prior reports.
8. `test/extractionPreview.ts` supports VERITAS_PREVIEW_PREFIX=engine42, fixture corpus
   enabled/disabled, isolated store per mode. Browser flags and outcome artifacts below.

## Final results and change inventory

- Python aggregate: **87 tests, 86 passed / one optional absent-AASIST skip**.
- `npm test`, Engine 3, Engine 4, cross-engine diagnostics, extraction unit/API, Engine 4.2
  box/cap controls, runtime interruption/recovery, TypeScript and build passed. No new
  package or model dependency was installed. Existing >500 kB chunk warning remains.
- Full unconfigured development browser: **12 passed / four setup skips**; authenticated
  production: **12 passed / same four skips**. Skips are the two configured Engine 4 paths,
  separate museum-corpus quote fixture and optional pinned face classifier. No assertions
  or existing tests were removed/skipped to mask failures.
- Configured dev/authenticated production: baseline, explicit rotated OCR with corrected
  review and SINGLE_LINE OCR with corrected review each passed, along with preserved
  manual-caption/source-review/public-post workflow. A final rotated-image pass also
  verifies full-resolution source inspection. SVG display boxes match actual response
  coordinates; case/report JSON equal stored evidence. All claim results remain
  Insufficient Evidence until existing separate factual-source review conditions are met.
- `reports/engine42_browser_{development,production}_{baseline,rotated,singleline,fullresolution}.json`
  preserve actual authored case/OCR/review/retrieval/graph records and parity assertions.
  The manual-caption cap failure was fixed and rechecked. A test HMR-port collision was
  cleared by stopping the extra development preview; only one was used for the final check.
- Tall-image source overlays were visually checked. A full-resolution scrolling inspection
  view was added because compact scaling made the vertical source difficult to read.
- No OCR worker processes remained after abort/recovery tests. Only task-owned fixture
  services are stopped at completion; user case storage and original media are preserved.

Added runtime/helper code: `server/ocrGeometry.ts`, `ai_service/ocr_geometry.py`.
Added research/tools: `ai_service/ocr_evaluation.py`, `ai_service/admit_hiertext_sample.py`,
`ai_service/create_engine42_controls.py`, `test/ocrPass.ts`.
Added tests: `test/ocrGeometry.test.ts`, `test/ocrReliability.test.ts`,
`ai_service/test_ocr_geometry.py`, `ai_service/test_ocr_evaluation.py`,
`ai_service/test_hiertext_admission.py`.

Modified: image preparation, extraction runner/worker/routes/types, correlation provenance,
ExtractionView/ReportModal, browser/API/preview fixtures, package test scripts and continuity
documents. Added the five ENGINE42 documents, actual engine42 research/browser artifacts
and `reports/ENGINE42_DATA_ATTRIBUTION.md`. Prior Engine 4.1 reports remain unchanged.
