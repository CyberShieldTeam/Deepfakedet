# Core capability verification — 2026-11-17 local date

This is engineering verification of a real-source vertical slice, not a claim that all
20 requested phases or independent media/stance validation are complete.

## Completed checks

- `npm test`: existing Node/media/claim/network/API authentication, signed attachments,
  ownership, CSRF, persistence rollback and report controls passed.
- `npm run test:claim-provider`: 24 new deterministic provider/citation controls passed.
- `npm run test:engine3`, `test:engine4`, `test:diagnostics`, `test:extraction`,
  `test:engine42`, `test:startup`: passed.
- Actual `test:extraction:api` and `test:engine42:runtime`: passed with the explicit
  Python endpoint and current-run ignored output; review/failure retention and recovery
  exercised. First attempt omitted the required endpoint and stopped at setup assertion;
  corrected configuration passed without application changes.
- Production authored-demo acceptance also passed after adding online retrieval: real UI
  sign-in and OCR → review → corpus retrieval → posts → correlation → report, one browser
  test, with Wikipedia forced off despite the operator's local opt-in.
- Full installed Python unittest discovery: **98 passed, zero skipped** after AASIST
  installation. Earlier pre-install run had one optional-weight skip.
- TypeScript check and production build passed. Existing >500 kB main-chunk warning
  remains; no build-size optimization claim.
- Actual Chromium sign-in, external retrieval, source/revision links, exact-quote review,
  save, correlation and report checked against API and temporary store. Optional combined
  run added actual image, audio, video and network processing. Raw local report records
  observed sources and transport controls. It does not intercept Wikipedia or substitute
  a corpus. An initial combined run's console summary dereferenced `sources` on a media
  result after checks completed; the summary was corrected and the entire run passed.

Reproduce the online check after building, with an existing Chromium installation:

```powershell
node --import tsx scripts/verify-live-claims.mjs
# Optional full local service must already be healthy on 8001:
$env:VERITAS_LIVE_MEDIA='1'
node --import tsx scripts/verify-live-claims.mjs
```

Temporary stores are isolated from user cases. Optional port:
`VERITAS_LIVE_TEST_PORT` (default 3339). Default deterministic regressions should use
`VERITAS_WIKIPEDIA_ENABLED=0` to avoid inheriting an operator's online opt-in.

## Measured performance and failure boundaries

Live claim API observations were roughly 0.36–0.91 seconds in the final integration
run, not an SLA or distribution estimate. Process RSS is reported as a snapshot, not
peak. Audio/video browser processing returned actual segment/frame evidence; processing
timings are retained in `reports/core_capability_verification.json`. The full Python
process after the integration run had a Windows peak working set of 564.91 MiB; that
includes imports/OCR/video/audio, not model-only memory. Startup was not instrumented
as a controlled service benchmark.

Offline cached Dima corrected process-tree run: 21.493 seconds including imports,
652.633 MiB sampled tree peak. Initial worker-only stage RSS and launcher undercount
were retained, not overwritten. See [image evaluation](IMAGE_MODEL_EVALUATION.md).
No new representative model latency/accuracy benchmark is claimed.

Wikipedia: 10 s / 1 MiB / 6 candidates / 2 in-flight requests / 32 cache entries / 60 s
TTL. Streamed byte caps, timeout/failure states, cache isolation and no automatic retry
are tested. No arbitrary source fetching was introduced. Existing media, campaign and
OCR caps/security are preserved. No secrets, user stores or weights are committed.

## Local testing / restart

Current real-input workspace: **http://localhost:3000**, full Python **8001**.
Separate **3001** workspace is the authored demonstration, not live source verification.
Re-sign in after restart using the existing private access record; credentials are not
included in docs. The prior case-store hash matched before and after restart.

For a fresh configured environment, retain existing authentication/store settings and
add the nonsecret flags in [citation setup](CLAIM_SOURCE_CITATIONS.md). Start Python
in one terminal from repository root (existing dependencies/checkpoint required):

```powershell
$env:VERITAS_IMAGE_MODEL_ENABLED='0'
$env:VERITAS_FACE_MODEL_ENABLED='0'
$env:VERITAS_AUDIO_MODEL_ENABLED='1'
$env:HF_HUB_OFFLINE='1'
.\.venv-win\Scripts\python.exe -m uvicorn ai_service.app:app --host 127.0.0.1 --port 8001
```

Then start Express with the same configured store/identity as before:

```powershell
$env:VERITAS_AI_SERVICE_URL='http://127.0.0.1:8001'
npm run dev
```

On this operator machine the existing private resume launcher reuses the store/token:
`node --import tsx .model-cache/manual-review/resume.mts`. It is not a portable setup
artifact and is intentionally ignored. Do not run a fresh demo launcher over manual cases.

Try the Charminar sample in Claim Intelligence, inspect actual passages and source
limitations, then make your own attributed review. Audio now offers experimental
segment evidence. Images/video retain measurements and explicit abstention. Neither
successful inference nor citations establish universal detection/verification accuracy.

Highest-value next work: a rights-approved primary-source retrieval corpus/feed and
source-separated labelled stance/relevance evaluation. Independent media evaluation
requires better provenance and suitable licensed real/generated/modified inputs.
