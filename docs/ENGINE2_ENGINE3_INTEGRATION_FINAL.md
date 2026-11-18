# Engine 2 / Engine 3 current-main integration verification

Date: 2026-11-18

Branch: `codex/integrate-engine2-engine3-final`

Base: `origin/main` at `a41578e`

## Integration decision

The outdated feature branch was compared but not merged. Current `main` already has stronger server-side Tesseract 7 extraction, original-media SHA-256 enforcement, immutable OCR text and review revisions, analyst-gated source stance, episode-level network witnesses, authentication, atomic case persistence, reporting and Engine 4 correlation. Those implementations were preserved.

The compatible improvement is a deterministic presentation policy used by the Engine 2 UI, Engine 3 UI and reports:

- Claim labels are `VERIFIED`, `CONTRADICTED`, `MISLEADING` and `NOT_VERIFIED`.
- `VERIFIED` and `CONTRADICTED` require the existing analyst-reviewed mode plus an attributable retained passage whose exact quote and complete claim context passed the current review gates.
- `MISLEADING` requires an attributable, context-confirmed `mixed` review. Conflicting supporting and contradicting sources remain `NOT_VERIFIED`; conflict is not silently converted into “misleading.”
- Retrieval, grounding, NLI suggestions and relevance scores cannot authorize a definitive label.
- Network labels are `NO_SIGNIFICANT_PATTERN_OBSERVED`, `ASSOCIATED_ACTIVITY_OBSERVED`, `REPEATED_COORDINATION_SIGNALS` and `INSUFFICIENT_DATA`.
- Repeated signals come only from the existing recurrence-eligible separated episodes. Truncated analysis or incomplete/unknown dataset coverage produces `INSUFFICIENT_DATA`.
- Every summary provides a plain-English explanation, bounded supporting references and a recommended next action. Network wording explicitly does not infer malicious intent, common ownership or bot status.

## Verification results

Passed:

- `npm run lint`
- `npm run build` (existing non-failing >500 kB main-chunk warning remains)
- `npm test`, including authentication, API integration, claim evidence, campaign episodes, report generation and the new summary controls
- `npm run test:engine3`
- `npm run test:engine4`
- `npm run test:nli`
- `npm run test:advanced-claims`
- `npm run test:diagnostics`
- `npm run test:extraction`
- `npm run test:engine42`
- `npm run test:engine42:runtime` against the local OCR service
- `npm run test:extraction:api` against actual local OCR
- 21 relevant Python OCR/extraction unit tests
- Production authored demo acceptance: real UI authentication, OCR, human review, Engine 2 investigation, Engine 3 upload, save-to-case, Engine 4 correlation and report workflow

The first OCR runtime attempts reported missing ignored fixtures and a missing explicit OCR endpoint; the authored fixture generator and documented local service setup resolved both. The first demo attempts reported a missing demo virtual environment, occupied default port and missing Playwright browser; the documented Python override, unused loopback ports and Playwright Chromium resolved them. One subsequent browser assertion expected the old network headline; it was updated to the new summary and the complete production demo passed.

## Providers and limitations

- Google Fact Check was unconfigured during verification.
- External embedding, NLI and reranking providers were disabled or unavailable where the tests intentionally exercise fallback behavior.
- Gemini was disabled in the authored demo.
- The demo uses authored fictional evidence and does not establish factual-verification, OCR or maliciousness accuracy.
- No model accuracy, fake/real verdict, bot probability, maliciousness probability or account-ownership conclusion is introduced by this integration.
- The generated OCR model, test fixtures, browser binaries and isolated demo stores remain local/ignored and are not committed. Existing saved investigation data was not read or modified.
