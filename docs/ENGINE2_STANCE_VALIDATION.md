# Stance policy and assertion selection

## Assertion extraction

New authenticated `POST /api/claims/extract` accepts `{claimText}` and returns original
text, at most eight candidates, exact UTF-16 source offsets, stable original-bound IDs
and heuristic categories. Breaking/update prefixes are excluded by exact span selection,
not erased from original input. Assertions, questions, instructions, opinions, predictions,
quotations, hypothetical/satirical, compound and unclear text are distinguished by
conservative rules. Compound statements remain intact; no semantic splitting invents
entities, dates, places or missing context. Categories are not validated NLP labels.

English/Hindi/Telugu examples and romanized-language controls test software behaviour,
not multilingual extraction accuracy. Hindi/Telugu NER, translation and learned assertion
selection remain unavailable. Proper names, abbreviations, quotation boundaries and
romanized/code-mixed text can defeat these rules. A rule match does not prove checkability.

Existing `/api/claims/verify` with `{claimText}` remains compatible. Optional `selection`
contains candidate ID, editable selected text, declared language, explicit context
approval and rationale ≥20 characters. Server recomputes original candidate IDs and
records owner/time, original-input SHA-256, original span/category and whether edited.
Original input stays immutable in the result; only the approved target drives retrieval
and NLI. Editing changes the claim to investigate, not its factual status.

## Automatic execution and abstention

Research NLI is opt-in. It requires explicit selection of a clear single English
assertion and an English-tagged source passage. Unknown/mixed/native non-English and
detected romanized forms abstain; no translation substitutes for the original. Language
declaration/script rules are themselves fallible and not robust language identification.
Google reviewed-claim metadata cannot become an article-premise inference or decisive
review. Missing selection, model, resources, oversized tokens, busy/timeouts and failures
return explicit statuses with no fabricated scores.

The worker predicts textual entailment/contradiction/neutral from a real exact window,
with fixed score/margin abstention. **The selected model failed external validation.**
Stored `evaluationStatus=experimental_failed_validation` and UI/report warnings disclose
that result. Suggestions remain research observations; no authoritative promotion is
enabled. The aggregate claim remains unresolved until attributed human review.

`supportingEvidence`, `contradictingEvidence`, source `stance`, `verificationStatus`,
confidence and Engine 4 verified-reference rules are not populated from NLI. Separate
model relationship records preserve raw scores/suggestions and source identity. A model
suggestion count is not independent source corroboration or a truth vote.

## Human review and history

Existing owner-bound signed receipt, exact unique source ID/URL, quote/context checks,
Google metadata prohibition and eight-source omission gate remain. Investigators can
copy a suggestion for review, correct it or leave/reject it as neutral. Nothing auto-checks
the context box or submits a stance. Prior reviews remain in bounded history, with
attributed neutral/correction events; partial reviews preserve unmentioned sources.
Capacity is 32 retained history events: further changes are refused rather than silently
discarding history. Old investigations without the new fields remain readable.

Model-suggested stance, current human-reviewed stance and aggregate claim status are
separate. Even human-reviewed support does not certify an encyclopedia's truth, currency
or applicability. Conflicting reviewed passages remain conflicting; lack of sources
does not become falsity. No existing media/network threshold or semantic gate changed.
