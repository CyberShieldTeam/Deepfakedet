# Engine 2/3 reliability audit — 2026-11-18

## Scope inspected

The audit traced the claim API and Gemini grounding path in `server.ts`, campaign parsing/scoring in `server/campaign.ts`, shared contracts in `src/types.ts`, Claim and Campaign result views, graph inspection, case attachment/report paths, demo data, environment/provider documentation, and all existing tests.

## Baseline findings

- The four-engine navigation, case attachment/storage, reports, simulated-demo labeling, source-image provenance work, Gemini provider health, and graph visualization were already functional.
- This checkout had no OCR code, OCR tests, or Tesseract dependency. Therefore there was nothing to “retain”; Tesseract.js has now been added without claiming prior OCR correctness.
- Claim retrieval uses Gemini with Google Search grounding when configured. The only external retrieval provider is Google Search through Gemini. Without `GEMINI_API_KEY`, or when grounding quota/rate limits apply, no live evidence provider is available.
- A grounded model verdict was previously promoted to verified when any grounding citation existed. Every source stance was stored as `neutral`; publication dates and source passage context were not independently checked. The tests did not establish factual claim-verification accuracy.
- Network normalization previously invented timestamps for missing values, compared URLs as raw strings, retained duplicate posts, and presented a heuristic “bot likelihood”/suspicion score. One shared signal could create a cluster. Those outputs could be misunderstood as maliciousness or coordination findings.
- Existing network tests covered basic Jaccard behavior, CSV parsing, the synthetic demo cluster count, and one unrelated organic case. They did not independently cover URL normalization, missing timestamps, duplicates, repeated episodes, scheduled announcements, conflicting/negated claims, or evidence-policy outcomes.
- Existing media fixtures and smoke tests are transport/contract checks, not OCR correctness datasets. No independently labeled clean/noisy/rotated OCR corpus exists in this repository.

## Implemented safeguards

- Added local Tesseract.js OCR with four bounded alternatives: original, enhanced grayscale/upscale, and enhanced 90°/270° rotations. The selected transform, all attempt texts/confidences/word boxes, original OCR, reviewed text, SHA-256, and explicit review history travel with a saved claim result.
- Added a deterministic claim-evidence policy. Retrieval relevance and LLM suggestions cannot authorize a status. Only attributable sources explicitly marked context-reviewed with a non-neutral stance can produce `VERIFIED`, `CONTRADICTED`, or `MISLEADING_CONTEXT`; absent, conflicting, outdated, or unreviewed evidence yields `NOT_VERIFIED`.
- Grounding metadata is conservatively `NOT_VERIFIED` because it does not independently establish source stance/date/context.
- Added URL canonicalization, exact duplicate removal, honest missing-timestamp handling, exact post-pair edge evidence, and pattern labels that describe observations rather than intent.
- Repeated coordination signals require at least two distinct post-pair episodes between the same accounts. A single viral or scheduled episode remains associated activity even if it shares text, URL, and timing.
- Replaced user-facing bot/suspicion probability language with observable association counts and added dataset coverage limitations.

## Remaining accuracy work

- Add a licensed, independently labeled OCR fixture set with clean, degraded, rotated, empty, and human-corrected images. Current implementation and types are tested by compilation/build, but no honest OCR accuracy rate can be reported.
- Add a retrieval provider that returns inspectable publisher passages and dates, or a human review workflow that records exact claim-to-passage stance. Google grounding metadata alone remains insufficient for definitive status.
- Add independently curated claim cases with frozen source passages for support, contradiction, conflict, outdated context, negation, place, and date resolution.
- Validate clustering thresholds against a representative labeled social dataset. Current tests establish deterministic expected behavior, not real-world detection accuracy.
- Consider code-splitting Tesseract; the production bundle currently triggers Vite's existing large-chunk warning.
