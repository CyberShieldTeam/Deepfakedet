# Reproducible authored demonstration

## Setup

Follow README.md: Node 24, Git, CPython 3.13, `npm ci`, the small locked Python environment
and explicit pinned English data download. The launcher expects `.venv-demo/Scripts/python.exe`
on Windows or `.venv-demo/bin/python` elsewhere; `--python PATH` selects another provisioned
interpreter. Ports 3000/8001 must be free, or use:

```sh
npm run demo -- --port 3337 --python-port 8417
```

Startup verifies image/model hashes, the production build when requested, free ports and
health endpoints. It never downloads dependencies/models automatically. A new
`.model-cache/submission-demo/run-*/investigations.json` starts empty. No default store is
opened. Private `access.json` holds the ephemeral token; never publish it. Enter the printed
token in the automatically opened access dialog; Manage access reopens that dialog later.
Ctrl+C stops the owned services and preserves the run directory.

## Complete manual workflow

1. Sign in at the printed localhost URL. Confirm the persistent **Authored demonstration**
   notice. Choose Live analysis to process these actual fixture files; this refers to
   application processing, not real-world validity of the fictional content.
2. Media forensics: upload `fixtures/submission/notice.png`, Check this file, Save to a case.
   Expect actual measurements and inconclusive authenticity; no classifier is configured.
3. Investigations: select that case and the same Original image for extraction. Leave
   English/Baseline, then Extract image text. Inspect boxes and the full-resolution source.
   This is real Tesseract inference, not a seeded transcript.
4. Inspect the museum candidate. Add a note, confirm source inspection, accept only if it
   matches (otherwise correct), Save extraction review, then Investigate reviewed text.
   Pending/uncertain candidates cannot create a final investigation binding.
5. Inspect **Fictional Engine4 source** and its excerpt. The example.org URL attributes
   authored corpus evidence; no website is fetched. Expect Insufficient Evidence without
   a separate source-stance review. Do not manufacture a supported verdict for the demo.
6. Network intelligence: upload `fixtures/submission/posts.json`, inspect witnesses,
   episodes and coverage, then Save to the same case. These twelve authored posts/four
   fictional accounts demonstrate recurrence, not malicious coordination.
7. Investigations: Correlate evidence. Inspect source/OCR/review/claim/post relationships,
   shared source URL, proofs and timeline. Download correlation JSON.
8. Open Report, inspect original text, reviews, sources and graph; Download exports HTML.
   Browser printing can produce PDF; no server PDF service is claimed. Refresh to inspect
   persistence. Keep the original image to reselect it for later source inspection.

## Automation and recovery

```sh
npx playwright install chromium
npm run demo:check -- --port 3337 --python-port 8417
npm run build
npm run demo:check -- --production --port 3338 --python-port 8418
```

The bounded runner starts/stops actual services, signs in through the UI session without
injected bearer headers, runs the complete workflow and checks API/disk/report parity.
Each private run also receives a sanitized `verification.json` without credentials.
Case IDs are intentionally new. Deterministic evidence IDs remain scoped to case/input/
configuration; do not promise identical cross-case IDs or runtime. Existing engine tests
cover idempotence, contradictions and failed-rerun retention.

If a port is occupied, choose another; never stop an unrelated process. Resolve the
displayed missing dependency and retry. Retain interrupted evidence and start a fresh run.
To inspect an old store, explicitly configure its `VERITAS_STORE` in the normal server;
do not replace it or disable authentication because ephemeral credentials were lost.

The lightweight service intentionally omits full video/audio, C2PA and classifiers. The
separate full environment enables optional evidence where configured. Hindi/Telugu OCR,
automatic acceptance and independent accuracy claims are not part of this demo. No external
provider is mocked: they are disabled, and the authored local retrieval corpus is disclosed.
