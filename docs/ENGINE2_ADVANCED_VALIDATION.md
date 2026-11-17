# Engine 2 advanced validation and local testing

Implemented: bounded opt-in pretrained relevance reranking; exact-source citation index
and deterministic evidence summary; review/correction, persistence, Engine 4 and report
continuity; frozen external retrieval/NLI comparisons with retained negative results.
No automatic factual verification model passed validation. Original MiniLM2 remains
quarantined. No production thresholds, source authority rules or unrelated engine
classification policies changed. Query/identity experiments that failed to generalize
did not become defaults. Broader primary-source ingestion remains planned.

## Recorded verification

- Local Python: **113 tests passed, zero skipped** (107 existing +6 new safeguards).
- Node/API full suite passed with fixture providers explicitly disabled, plus provider,
  NLI, advanced-claim, Engine 3, Engine 4, diagnostics, extraction, geometry and startup
  suites. Actual OCR/API and abort/busy/recovery controls passed against port 8001.
- TypeScript and frontend production build passed. Existing >500-kB chunk warning remains.
- Actual advanced browser: **17 checks**, real UI sign-in, live Wikipedia and actual pinned
  models. Correct historical assertion, wrong year/location, negation, no sources,
  missing dates, citation opening, explicit human correction, Hindi/Telugu abstention,
  compound assertion selection, Engine 4 and API/disk/report equality passed software
  checks. Timeout was a labelled transport-injection control; model-unavailable checks
  used actual missing-snapshot worker responses in isolated configuration. Conflict
  passages and review actions were labelled authored controls, not external accuracy.
- All five Charminar NLI diagnostic relationships **abstained**, preserving unresolved
  status. Passing browser checks does not mean the model correctly verified those claims.
- Actual existing localhost workspace also passed real sign-in/claim processing with
  reranking applied, Charminar first, six cited passages and six experimental NLI inputs.
  Its existing case store remained byte-for-byte unchanged. Local research reranking is
  enabled in that launcher process only; `.env` and credentials were not edited.
- Existing production-mode authored-demo acceptance passed with actual OCR, APIs,
  review/network/graph/report and real session sign-in. It forcibly disables Wikipedia,
  NLI and reranker research providers. It is not an accuracy benchmark.
- First broad Node run inherited operator `.env` Wikipedia=1: an isolated one-source
  fixture received six live sources and failed. Reran with explicit research providers=0;
  all suites passed without weakening assertions or changing the operator configuration.
- Python SciFact TLS chain failure was corrected through verified Windows TLS plus
  publisher checksum, never certificate-verification bypass. Type/test contract issues
  found during implementation were corrected before final checks. No benchmark outputs
  or gates were overwritten to hide failures.

The first actual browser screenshot exposed an abbreviation-only preview (`lit.`).
The final preview uses an exact bounded substring, labels truncation and was reverified
through the full browser flow. Screenshots remain in ignored local browser artifacts;
sanitized reports exclude tokens, private dataset passages and operator case data.
`reports/engine2_advanced_verification_v2.json` records the final 17-check browser run;
the earlier v1 observation is retained. Frontend runtime-error capture was empty.
New CI invokes `test:advanced-claims` on Windows/Linux. Hosted CI results must be checked
for the pushed commit separately; earlier green CI is not evidence for these changes.

## Using the local workspace

Open **http://localhost:3000** and use your existing analyst sign-in. This is actual-input
mode; demonstration fixtures are a separate workflow. Select Claim intelligence, enter
one factual assertion, extract/select it, explicitly approve wording/context and English,
then check. With optional reranking enabled, inspect the visible experimental relevance
notice and the expandable raw-score/hash details. Open cited passages and assess context;
relevance does not establish support. Human review still requires exact quote, context
confirmation and a rationale. Save/correlate/export only when you intend to modify a case.

Generic optional local research configuration, from repository root in PowerShell:

```powershell
$env:VERITAS_RERANKER_ENABLED='1'
$env:VERITAS_RERANKER_PYTHON=(Resolve-Path '.venv-win/Scripts/python.exe').Path
$env:VERITAS_RERANKER_MODEL_PATH=(Resolve-Path '.model-cache/msmarco-minilm-l6').Path
npm run dev
```

Authentication, case-store location and Python preparation endpoint must use your
existing approved configuration; see [README setup](../README.md). Never put secrets
in `VITE_` variables or tracked files. `VERITAS_RERANKER_ENABLED=0` disables it. The
snapshot must already exist; application startup never downloads it. Optional MiniLM2
NLI setup remains in [the prior workflow](ENGINE2_USER_WORKFLOW.md), with its failed
evaluation warning. Default `.env.example` keeps reranking off.

For this existing operator workspace, the ignored launcher
`.model-cache/manual-review/resume.mts` preserves its original private token/store.
The local advanced resume wrapper enables research reranking only in that process,
without editing `.env`; it can be restarted with:

```powershell
node --import tsx .model-cache/engine2-advanced/resume.mts
```

If the Python process is absent, run the existing installed service in another terminal,
preserving its authorized configuration and cached assets:

```powershell
.\.venv-win\Scripts\python.exe -m uvicorn ai_service.app:app --host 127.0.0.1 --port 8001
```

Whole-image classifier unavailability must not be mistaken for OCR/signal-service
unavailability. Do not enable quarantined image classifiers to obtain a verdict. These
Engine 2 changes do not establish new image/audio/video detection accuracy.

## Reproducibility and remaining scientific gate

Protocols under `test/fixtures/claims/` were frozen before their respective model runs.
Prepared text/manifests and candidate pools stay under ignored `.model-cache/engine2-advanced/`;
public `reports/engine2_*_v*.json` contain IDs, hashes, labels, raw scores, timing and
failure states. Preparation/evaluation refuse output overwrite. Resource estimates,
pins and frozen JSON use LF checkout rules so Windows/Linux line-ending conversion
cannot silently change protocol/report byte identities. Resource estimates,
licenses, all-sample metrics, uncertainty and transfer limits are in
[model comparison](ENGINE2_MODEL_COMPARISON.md),
[reranker evaluation](ENGINE2_RERANKER_EVALUATION.md),
[retrieval optimization](ENGINE2_RETRIEVAL_OPTIMIZATION.md) and
[target-domain evaluation status](ENGINE2_TARGET_DOMAIN_EVALUATION.md).

Highest-impact remaining work: rights-approved, independently adjudicated claim/full-
passage stance data with source/event/claim-family/translation separation and a sealed
final test. Then compare a task-matched model before any stance promotion. More returned
links, high relevance logits or high raw softmax cannot close that gate.
