# Testing Engine 2

Use the normal authenticated **http://localhost:3000** workspace, not the separately
labelled authored demonstration. Existing cases/access configuration must be preserved.

1. Open Claim Intelligence and enter original text.
2. Choose **Extract candidate claims**. Inspect suggested categories and complete context.
3. Select/edit the assertion, declare its language, explain the selection and approve
   wording/context. This approval does not confirm factual truth.
4. Choose **Check this claim**. Inspect actual source passages and original/revision links.
5. If optional NLI is enabled/available, inspect clearly experimental relationships.
   **This model failed held-out validation**; its output is not a reliable factual verdict.
6. Open sources and conduct your own review. Accept/correct/reject suggestions with an
   exact retrieved quote, context confirmation and rationale. Only this attributed human
   path changes the aggregate assessment. Save to a case, correlate and export its report.

The old direct **Check this claim** path still retrieves sources without selection.
It does not run NLI until a clear English assertion/language is explicitly approved.
Hindi/Telugu and unknown/romanized text retain manual review without unsupported NLI or
silent translation. Research diagnostics expand to show model version, raw scores,
window hashes, tokens, timings and availability failures. Sources remain clickable even
when inference fails. No external key or model score is a prerequisite for manual review.

## Optional research setup

After explicit model-download approval and installing the existing full Python dependencies:

```powershell
.\.venv-win\Scripts\python.exe -m ai_service.download_nli --output .model-cache/nli-minilm2
```

Server-only environment (`.env`, ignored), with your actual installed Python/snapshot paths:

```dotenv
VERITAS_WIKIPEDIA_ENABLED=1
VERITAS_WIKIPEDIA_LANGUAGE=en
VERITAS_NLI_ENABLED=1
VERITAS_NLI_PYTHON=.venv-win/Scripts/python.exe
VERITAS_NLI_MODEL_PATH=.model-cache/nli-minilm2
```

Restart Express using the existing store/owner/token configuration. It supervises the
NLI worker; no separate public model endpoint, API key or runtime download is needed.
Default NLI is off, and authored demo forces it off. 1.5 GiB available RAM is checked
before loading; browser/other apps can cause refusal. No output is invented on failure.
For a fresh standalone configuration see [existing startup guidance](CORE_CAPABILITY_VERIFICATION.md).
Do not run a fresh demo launcher over manual cases.

## Reproduction checks

```powershell
npm run test:nli
npm run build
$env:VERITAS_NLI_PYTHON=(Resolve-Path '.venv-win/Scripts/python.exe').Path
$env:VERITAS_NLI_MODEL_PATH=(Resolve-Path '.model-cache/nli-minilm2').Path
node --import tsx scripts/verify-engine2.mjs
```

The online browser check uses real Wikipedia and model inference, an isolated authenticated
temporary store on loopback 3341 and unique ignored artifacts. It warms the model before
launching Chromium to reduce startup resource contention. Diagnostic examples are not
accuracy validation. A separate explicitly authored conflict-control phase uses local
fictional passages and is labelled as software testing. No personal cases are modified.
