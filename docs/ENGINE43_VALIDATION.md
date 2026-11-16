# Engine 4.3 validation

## Baseline and preserved contracts

Started at `32f5b850de8d5c02e4ea5ea98ba406f149e1eac1`, clean feature branch
`codex/integrate-figma-upgrade`, fetched remote synchronized 0/0. Read Engine 4.1/4.2
architecture/audit/evaluation/validation and actual evaluator, extraction/review routes
and Engine 2/4 integrations. Found the legacy evaluator excluded null outputs from its
CER/WER; added explicit failure/coverage accounting while retaining legacy fields.
No application model, threshold, profile default, verdict, semantic/recurrence safeguard,
ownership API or user investigation changed. Old reports remain intact.

## Verification ledger

- Python initial aggregate: 94 tests, 93 passed, one optional AASIST-weight skip.
  Two further release tests added afterward; targeted scoring/release/legacy evaluator
  suite: 12 passed. Final aggregate recorded below.
- `npm test`: Engines 1/2 and campaign/API/storage/report contracts passed.
- `npm run test:engine3`, `test:engine4`, `test:diagnostics`, `test:extraction`,
  `test:engine42`: passed, including preserved uncertainty, ownership, deterministic
  provenance, recurrence, failed/stale graph retention and report compatibility.
- New `npx tsx test/engine43Propagation.test.ts`: five authored controls passed;
  no unsupported mixed-language final link or negation equivalence.
- `npm run test:extraction:api`: actual cached OCR passed; saved current report as
  `reports/engine43_api_controls.json`, preserving older report files. Hash checks,
  owner gates, withdrawal, atomic rollback and actual-source retrieval passed.
- `npm run test:engine42:runtime`: actual worker busy rejection, preparation/worker
  abort, explicit 504, recovery and invalid-profile checks passed. No natural timeout
  occurred in the short workload; failure recovery uses controlled interruption.
- TypeScript and production build passed. Existing >500 kB client chunk warning remains.
- Authored real-OCR release: ten passes completed, five baseline then five upscale.
  Five-record resume reused all records without running inference again. Aggregate
  retains every expected result and separate failure accounting.
- New injected-error browser workflow: development 1 passed; authenticated production
  1 passed. First attempt timed out selecting a case from Overview; the test now
  navigates to Media forensics before case selection. No application fix was needed.
- Actual OCR + manual Engine 4 browser workflows: development singleLine and production
  baseline: 2 passed in each mode, including actual retrieved fictional source, current
  review/correction, all six provenance/post/source link types, source/full-resolution
  overlays, retained failure status and API/disk/report parity.
- Final Python aggregate: **96 run, 95 passed, one optional AASIST-weight skip**.
  Final TypeScript check passed. Build passed with the existing chunk-size warning.
- Full unconfigured browser suite: **10 passed, 7 setup-gated skips** in development
  (30.7s) and authenticated production (25.3s). Of those skips, injected number correction,
  actual OCR and manual correlation ran separately and passed in both modes. The other
  four workflows (separate claim-corpus UI fixture, signed provenance, temporal diagnostics
  and pinned face classifier) were not enabled in this run. Existing gates were unchanged;
  no missing weights or credentials were fabricated to enable them. Unit/API contracts
  for those engines passed, but this is not equivalent to their optional live browser setup.

## Security, integrity and reproducibility

Release tests cover deterministic 50/5 batching, family job cap, global lineage leaks,
near-duplicate screening, holdout lock, post-freeze changes, source hash/dimensions/path
validation, explicit budgets, pending-language separation, failed/missing score
reconstruction, resume, corrupt checksums, duplicate outputs and blind packet filtering.
Scoring matches the old dynamic-programming distance on exhaustive short strings and
seeded Unicode/token examples. Real models are not downloaded by evaluation tools.

No new URL fetcher, prompt/model execution of OCR text or external API credentials were
introduced. Existing HTML escaping/input/ownership tests passed. Reports contain authored
strings and fixture metadata only, no tokens or private investigation data. Plans and
packets can contain local paths/text and stay ignored. Software checks do not establish
legal rights, human identity or adversarial authenticity of operator-written manifests.

## Performance and limits

Baseline/upscale mean OCR subprocess wall: 1.588/1.587s; sampled tree peaks:
231,997,440/207,552,512 bytes. These are OCR process trees, not whole-server memory.
Within-job overhead ~25/136ms; resume validation ~10.5ms for five results. Every job
performs release admission beforehand; full-dataset admission overhead is not included
in these job timers. Detailed preparation/startup/OCR/candidate times are in raw results.
No general scalability claim follows from ten passes.

Development real-OCR browser: preparation 24.0ms, startup 202.9ms, OCR 82.6ms,
candidates 1.14ms, total 500.9ms; graph 43.8ms. Production: preparation 47.0ms,
startup 239.7ms, OCR 103.7ms, candidates 1.35ms, total 598.3ms; graph 42.8ms.
Injected-control graph: 3.49ms development / 6.69ms production (different
smaller graph). No human completion-time metric is available.

Production remains one OCR pass/request, serialized worker lease, original deadlines,
input/pixel/output caps and bounded graph/report rows. Research supervision is isolated,
with explicit approved total passes; no production cap was enlarged.

## Release limits

No independent screenshot benchmark/holdout was completed. No selector validated or
enabled. No human study, native-script accuracy, independent candidate/relationship
accuracy or factual-verification accuracy is claimed. Next task is rights-cleared
original acquisition plus actual blind transcription/adjudication and a pre-frozen
source-family development/holdout protocol. Video/STT/new models were not started.

## Changed-file inventory

Added Python tooling: `ocr_release.py`, `ocr_scoring.py`, `screenshot_annotation.py`,
`create_engine43_controls.py`, `export_ocr_release_audit.py`, `test_ocr_release.py`,
`test_ocr_scoring.py` under `ai_service/`. Added isolated TypeScript fixture, API test and
browser setup: `test/engine43Controls.ts`, `engine43Propagation.test.ts`,
`engine43PropagationPreview.ts`. Added the five ENGINE43 documents and six reports:
`engine43_api_controls.json`, `engine43_authored_ocr_controls.json`,
`engine43_authored_release_audit.json`, `engine43_browser_ocr_development.json`,
`engine43_browser_ocr_production.json`, `engine43_error_propagation_controls.json`.
Modified only legacy evaluation reporting, gated browser controls and continuity memory
(`ai_service/ocr_evaluation.py`, `test/browser.spec.ts`, `IMPLEMENTATION_PROGRESS.md`).
No Engine 2/4 production code change was required. Reports/fixtures describe software
controls explicitly; images, private stores, models, credentials and packets are excluded.
