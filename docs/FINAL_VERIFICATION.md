# Submission verification ledger

Starting commit `c26f385b01c721c1f6c3d0605e96c3d3c9a2e6c4`; feature branch
`codex/integrate-figma-upgrade`, clean/fetched remote 0/0 before edits. No main merge,
history rewrite, model/threshold/default change or investigation reset is part of this task.

## Clean-environment method

Created a separate `git clone --no-hardlinks --branch codex/integrate-figma-upgrade` from
the verified local checkout and applied the candidate binary patch. This verifies a clean
dependency/configuration environment, not a second model benchmark. The clone has its own
node_modules, new `.venv-demo`, empty demo stores, explicitly downloaded English data and
project-local Chromium installation. No original .env, private store or model cache copied.
Node may use its registry package cache; Python installation used `--no-cache-dir`.
The first browser installer reused the global Chromium cache; a subsequent explicit
`PLAYWRIGHT_BROWSERS_PATH` installation downloaded fresh Chromium/FFmpeg/headless binaries
into the clean clone before the successful acceptance runs.

Host: Windows, Node 24.19.0, npm 11.17.0, CPython 3.13.12, Pillow 12.3.0. A Windows
`python` on PATH was MSYS; the documented `py -3.13` launcher created the intended venv.
The lightweight environment contains 16 pinned installed distributions, recorded in
requirements-demo-lock.txt. Full PyTorch/Transformers/other optional dependencies are not
installed by this demo path. Existing full-environment regressions are labelled separately.

## Commands exercised

From the clean clone, no personal environment files:

```powershell
npm ci
py -3.13 -m venv .venv-demo
.\.venv-demo\Scripts\python.exe -m pip install --no-cache-dir -r ai_service/requirements-demo.txt
.\.venv-demo\Scripts\python.exe -m pip install -r ai_service/requirements-demo-lock.txt
.\.venv-demo\Scripts\python.exe -m ai_service.download_ocr
.\.venv-demo\Scripts\python.exe -m unittest ai_service.test_extraction_prepare ai_service.test_ocr_geometry ai_service.test_ocr_scoring ai_service.test_ocr_evaluation ai_service.test_ocr_release ai_service.test_ocr_app
npm run lint
npm run build
npm run test:startup
$env:PLAYWRIGHT_BROWSERS_PATH=Join-Path (Get-Location) '.model-cache/browsers'
npx playwright install chromium
npm run demo:check -- --port 3337 --python-port 8417
npm run demo:check -- --production --port 3338 --python-port 8418
```

The explicit downloader verified 4,113,088 bytes and SHA-256
`7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2`.
Node installed 255 packages (262 audited); npm reported zero vulnerabilities at that time.
Deprecated dependency/install-script warnings remain; no blanket script approval or
unrelated dependency upgrade was performed. The build retains its >500 kB chunk warning.

## Observed results

- Lightweight Python: **23 passed**. A new assertion initially accessed an internal FastAPI
  route property; corrected to public OpenAPI paths, then all 23 passed.
- Full existing Python environment: **98 run, 97 passed, one optional AASIST-weight skip**.
  Initial aggregate saw the same new assertion error; after correction the full aggregate passed.
- Existing core Node/API, Engine3, Engine4, diagnostics, extraction and geometry suites
  passed in the working checkout. The same core suites were also run in the clean clone;
  completion status is recorded in the final addendum below.
- TypeScript/build and startup controls passed in the clean clone. Startup rejects invalid
  port, missing production build and occupied listener; these controls do not overwrite cases.
- Complete authored demo: **development 1 passed, production 1 passed**, with real UI
  sign-in/cookie authentication and no bearer-header bypass. Upload, submitted hash, actual
  OCR, full-resolution boxes, mandatory review, actual authored corpus retrieval, UI post
  import, graph/proofs/timeline and API/disk/rendered-report parity passed.
- Default model/semantic/recurrence/review/ownership safeguards remain. Missing classifiers
  are unconfigured, not fabricated predictions. No external provider is mocked or needed.

Successful clean demo measurements (`reports/submission_clean_demo.json`):

| Measurement | Development | Production |
|---|---:|---:|
| Two-service readiness | 1.953 s | 1.790 s |
| Browser/check phase including browser startup | 16.624 s | 11.816 s |
| Actual OCR pipeline total | 571.2 ms | 538.7 ms |
| OCR recognition | 95.2 ms | 98.7 ms |
| Worker model startup | 209.9 ms | 204.9 ms |
| Candidate extraction | 1.17 ms | 0.56 ms |
| Graph correlation | 27.7 ms | 46.9 ms |

Both graphs had 50 nodes/104 relationships, 25 cross-engine links and no node/relationship
omissions. Partial correlation is a scientific/evidence state, not a failure hidden by
changing verdicts. Timings are single authored-workload observations, not capacity or
accuracy benchmarks. No full-server minimum RAM/concurrency guarantee was established.

## Failures investigated and fixed

The new fixture initially used local-calendar midnight as a UTC timestamp in the future.
The real corpus guard rejected it with RETRIEVAL_PROVIDER_FAILED, and no sources were
invented. Fixed only fixture provenance to the actual recorded UTC time. Existing future
timestamp checks remain. A preparation-only URL initially received classifier requests
and returned 404; the optional dedicated OCR URL now keeps full-service fallback compatible
and avoids reporting deliberately absent classifiers as failed demo dependencies.

Two new automation assumptions were corrected: access opens automatically on 401, and
lazy navigation must settle before selecting the network view's labelled input. Neither
required weakening authentication or rewriting application evidence rules. Historical
Engine43 report output was restored to its exact committed blob; new reruns default to
ignored cache output so ordinary tests do not overwrite that artifact.

## Scope, CI and unverified paths

No independent model/dataset evaluation, human usability study, recorded demo video,
public TLS deployment or container build is claimed. Linux/macOS README commands are
equivalents, not executions on this Windows host. Mermaid syntax is deliberately simple;
GitHub rendering is not an independent architecture validation.

`.github/workflows/verify.yml` adds read-only CI with Windows/Linux application jobs,
full-history baseline checks, locked installs, types/build, Node engines and real OCR
browser acceptance in both modes. A separate CPU Python job installs existing full
dependencies with model loading/offline safeguards. Jobs are bounded at 20/25 minutes,
require no private keys and never use production case storage. Workflow execution on
GitHub is separate from these local results; do not infer it passed from file existence.

## Regeneration and historical evidence

`python -m ai_service.create_submission_fixtures --directory FRESH_DIRECTORY` regenerates
the authored graphic/posts/manifest using Pillow's bundled font. It refuses an existing
notice image; source hashes may vary with renderer versions. The committed bitmap/hash,
not an external developer font, is the demo input. The authored corpus is a separately
reviewable static fixture. Do not replace historical Engine41–43 reports to reduce Git size.
Private run directories and all model/browser caches remain ignored.

## Final local regression addendum

Clean-clone core Node/API, Engine3, Engine4, diagnostics, extraction and geometry all
completed successfully. Generic browser suite: development **10 passed / 7 setup skips**
(29.3s), production **10 passed / 7 setup skips** (24.1s). The real OCR workflow ran
separately in both modes. Injected-number/manual-correlation/separate claim-corpus UI,
signed-provenance, temporal and face-classifier setups were not enabled in those generic
runs; skips are not passes. Their core contracts were covered by Node/Python regressions,
not presented as equivalent to live optional-model browser verification.

Existing OCR API and worker reliability controls passed against the lightweight service
through the legacy URL fallback: source identity, reviews, retrieval, graph/report/disk,
withdrawal, failed rerun/atomic rollback, busy rejection, preparation/worker interruption,
explicit 504 and recovery. Full local Engine43 propagation controls passed; their new
default output is ignored cache. An additional clean development rehearsal passed after
changing only screenshot framing; startup 2.481s, OCR total 644ms, graph 39.6ms. The table
above preserves the first successful paired development/production observations.

The README screenshot is an actual 1440x1100 application viewport from the authored run,
not generated artwork. Local Markdown targets are checked by `npm run docs:check`;
remote URL availability and anchor correctness are not implied by that check.
