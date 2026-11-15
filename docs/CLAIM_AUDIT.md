# Phase 3 starting audit — 2026-11-15

Baseline dd6b1ca retains feb5d74 and all Phase 2 work. Existing `server/evidence.ts`
provides BM25, optional configured embedding retrieval, Google Fact Check Tools, and
conservative automatic abstention. Express already supports receipt-bound analyst
review, owner-scoped case attachment and report exports. ClaimView already displays
sources and analyst stance controls. No second claim API or investigation store is needed.

Starting gaps: script detection calls all other scripts English and cannot report mixed
input; campaign tokenization removes short claim words including English negation;
no Unicode normalization, duplicate source removal, corpus provenance or structured
availability state; Google response parsing is loosely bounded; relevance is not exposed
separately from credibility; analyst stance lacks a quote/context gate. Optional Gemini
free-form summaries/extracted subclaims are not linked to evidence passages. No independent
English/Hindi/Telugu claim benchmark or configured local multilingual model is present.

Implementation will extend these interfaces, add operator-approved/hash-bound corpus
retrieval, retain Google as an optional authorized provider, preserve unknown dates,
require explicit attributed human review for decisive statuses, and remove untraceable
claim summaries. No automatic entailment model or translation accuracy is claimed.
Software controls must stay separate from independent factual validation.
