# Engine 2 verification record

This delivery adds actual selection and bounded inference functionality, not an approved
automatic fact checker. The model failed external validation; no promotion, threshold
adjustment, media-model change or main-branch merge is authorized by this work.

See [model selection](ENGINE2_NLI_MODEL_SELECTION.md),
[evaluation](ENGINE2_NLI_EVALUATION.md), [stance policy](ENGINE2_STANCE_VALIDATION.md),
[source integrity](ENGINE2_SOURCE_INTEGRITY.md), [user workflow](ENGINE2_USER_WORKFLOW.md).
These six records cover different responsibilities and reuse earlier retrieval/media
documents rather than replacing historical results.

## Implemented checks

- Extraction tests: exact original spans/IDs, instruction/question/opinion/prediction/
  quote/compound handling, dates/negation and limited native/romanized controls. These
  are authored rules tests, not multilingual accuracy evidence.
- Worker tests: persistent inference protocol, identity/scores/size bounds, busy admission,
  crash/timeout/interruption, bounded restarts and no fabricated model responses. Fake
  workers are isolated software controls, never application demo inference.
- Stance/API tests: explicit selection, authentication/ownership, signed model records,
  quote/context requirements, unchanged aggregate gate, preserved corrections/neutral
  history, exact source windows and escaped report/disk/correlation propagation.
- Real offline ANLI evaluation: 420/420 executed; 300 held-out, balanced 100/class;
  failed predeclared criteria. Model/label-order sanity controls passed separately.
- Final local full Python: **107 passed, zero skipped**. Existing full Node/API,
  Engine 3, Engine 4, diagnostics, extraction/geometry, startup, actual OCR API/recovery
  and production authored-demo acceptance passed. Four new Node NLI suites and 25
  provider controls passed. TypeScript and production build passed; existing main-chunk
  warning remains. Hosted CI is recorded separately after pushing; skips are not passes.

## Actual browser and local-workspace outcomes

All seven requested journeys ran through the actual frontend: supported historical
assertion, wrong year, wrong city, negation, no evidence, explicitly authored conflict
passages and assertion-plus-instruction selection. The partial historical claim E ran
as well. Real Wikipedia responses and the real model were used for A–E. No provider
interception, fictional corpus substitution or model output fabrication occurred there.
Conflict passages/review actions are separate labelled software controls.

**Scientific diagnostic result: all five Charminar article relationships abstained.**
The software checks passed, but the expected support/contradiction distinctions were
not resolved by the model. No diagnostic was counted as independent accuracy evidence.
Human support and conflicting-evidence states appeared only after explicit authored
review actions. Exact model windows, raw scores, current human stances and citation
hashes matched API, stored cases, graph metadata and clickable exported HTML.

Final real-source browser warmup: 5.87 s with OS caches warm; five warm claim analyses
0.97–1.17 s, of which the six-passage NLI stage was approximately 0.54–0.62 s. These
observations do not establish an SLA or causal speedup relative to the separate ANLI
profile. Raw per-pair/stage observations and source identities are retained in
`reports/engine2_nli_browser_v1.json`; source text/tokens/private case data are excluded.
Unique ignored browser run directories retain actual screenshots and complete results.

The configured normal development workspace on **http://localhost:3000** was also tested
through real UI sign-in, extraction, explicit English/context approval and actual NLI.
It retained six real sources and six executed model relationships, all labelled failed
validation; aggregate status stayed insufficient evidence with null confidence. Its
manual investigation store was byte-for-byte unchanged. Research-only local flags are
ignored; default repository/demo NLI remains off. Services are loopback-only.

Current local artifacts: `.model-cache/engine2-nli/browser/latest.json` points to the
complete browser run; `manual-ready.json` and `manual-workspace.png` under the same
Engine 2 cache root record the actual manual workspace check. These artifacts are not
scientific benchmark data. No private credentials, user stores or weights enter Git.

## Failures observed and preserved

Initial browser harness selected a case control while still on the dashboard; corrected
navigation and explicit action deadlines fixed the harness setup. A wrong-year query
excluded the expected article; generic bounded numeric/polarity counter-evidence search
was added without changing the claim, scores or thresholds. A subsequent model load was
explicitly refused below its unchanged RAM headroom budget. Browser testing now warms
the worker before opening Chromium; this does not remove admission safeguards.

The model itself remains inaccurate on the external adversarial evaluation. Good-looking
diagnostics cannot supersede those negative results. Source-specific applicability,
currency, independence and factual truth still require review. A successful transport,
browser, persistence or report test is not scientific validation.
