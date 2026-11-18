# Final submission hotfix verification

Date: 2026-11-18

Branch: `codex/final-submission-hotfix`

Base: `origin/main` at `9c22347`, which includes the merged Engine 2/3 result-summary integration.

## Scope

This is a presentation and release-hardening change. It does not replace or alter inference, OCR preparation, extraction, retrieval ranking, analyst review policy, campaign episode construction, correlation, authentication, persistence or integrity hashing.

Implemented:

- Decisive Engine 2 results now show the source title, clickable URL, exact reviewed quote, date availability, stance, reviewer and a plain-English explanation directly in the prominent result.
- `NOT_VERIFIED` results show retrieved-but-unreviewed passages or configured-provider availability, plus missing evidence and a next action.
- Engine 3 summaries now include posts, accounts, observed relationships, episode counts and bounded witness examples with post IDs, timestamps and shared URLs. The community score is explicitly labeled a heuristic index, not maliciousness.
- Engine 4 starts with a concise explanation of contributing engines, record/relationship counts, important cross-engine connections, unresolved evidence and the next action.
- The case screen shows an `Investigation Result` with separate media, claim, network and correlation dimensions. It does not create an overall fake/real score.
- The HTML report begins with an `Executive Investigation Summary` and decisive clickable citations while retaining all existing technical evidence and audit history.

## Straightforward-claim retrieval finding

The authored production demo intentionally sets `VERITAS_WIKIPEDIA_ENABLED=0`, clears `GOOGLE_FACT_CHECK_API_KEY`, and uses a small approved fictional corpus. Therefore a claim such as “Charminar is in Hyderabad” correctly remains `NOT_VERIFIED` in that deterministic offline demo unless an operator enables and tests an established provider and then performs the existing attributable source review.

Wikipedia retrieval is already implemented as an opt-in, bounded public API provider. It returns attributable page/revision URLs, exact retained extracts, timestamps and license metadata, but retrieval remains neutral until analyst review. Google Fact Check requires its existing API key configuration. No provider, credential or sample verdict is hardcoded by this hotfix.

## Scientific limitations

- A matching passage, BM25 score, semantic score, NLI suggestion or publisher reputation does not establish truth.
- Conflicting, incomplete, outdated or unreviewed evidence remains `NOT_VERIFIED`.
- Wikipedia is an encyclopedia source, not an independent fact-check verdict.
- Network recurrence does not establish bots, malicious intent, common ownership or misinformation.
- Correlation density does not establish factual accuracy or media authenticity.
- Authored fixtures test transport and policy behavior, not real-world accuracy.

## Verification record

Passed on Windows with Node 26.13.0 and Python 3.14:

- TypeScript checks (`npm run lint`) and production build (`npm run build`).
- Complete Node/API suite (`npm test`), Engine 2 extraction/NLI/stance/API, advanced-claim and reranking controls, Engine 3 controls, Engine 4 controls/API, and cross-engine diagnostics.
- OCR extraction, geometry, service reliability, image-hash/review/API integration and 21 Python OCR/evaluation/release tests.
- Opt-in live Wikipedia browser/API check, including neutral retrieval, attributable review, report citations and correlation. The test demonstrates retrieval and policy behavior, not factual accuracy.
- Authored production browser workflow across OCR, human review, claim investigation, network analysis, correlation and report generation.

The Google Fact Check provider was unconfigured because no API key was supplied. External embedding, reranking and NLI models were not used for truth authorization. The deterministic authored demo keeps Wikipedia and Gemini disabled and correctly reports insufficient evidence where its approved corpus has no reviewed source.
