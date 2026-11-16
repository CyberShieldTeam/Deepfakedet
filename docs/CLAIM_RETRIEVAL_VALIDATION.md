# Claim retrieval validation — 2026-11-17 local date

Implemented opt-in Wikipedia retrieval using the official MediaWiki API. Existing
Google, approved corpus, lexical/optional semantic ranking and review contracts remain.
No independent stance or truth benchmark was fabricated.

## Actual online/browser observations

`node --import tsx scripts/verify-live-claims.mjs` starts the actual Express app and built
frontend with isolated authenticated cases on loopback port 3339, opens Chromium and
performs real network requests. It does not use bearer bypass for browser sign-in,
intercept provider responses, import a fictional corpus or change a user's cases.
Run after `npm run build`; Chromium must already be installed. This is an opt-in
online check, not the default deterministic CI test.

| Live query | Observation | Assessment before review |
| --- | --- | --- |
| Charminar, Hyderabad, built 1591 | 6 retained sources, including actual Charminar lead with construction year | Insufficient evidence / needs context review |
| Earth has two moons | 6 real source candidates | Neutral, no automatic contradiction |
| Charminar built 1891 | 6 candidates | Relevance did not imply support |
| Charminar in Delhi, built 1591 | 6 candidates | Location mismatch did not imply support |
| Deliberately unfindable token | Available provider, zero sources, `NO_RELEVANT_SIGNALS` | Unresolved, not unavailable or false |

An explicitly authored software action reviewed an exact Charminar passage, confirming
its entities/year against the assertion, and recorded attributed support. The browser
status changed only after review. This tests quote/review transport and provenance;
it is not independent human adjudication or a factual-accuracy result. Source IDs,
actual passage hash, canonical/revision links and review attribution matched API,
stored case, correlation source node and exported report. Existing automated controls
test conflicts, omitted sources, forged quotes/receipts and ownership.

Local raw observation: `.model-cache/core-capability/live-claims.json`; screenshot:
`.model-cache/core-capability/live-claim.png`. These are current-run, ignored artifacts,
not a reproducible frozen truth corpus. Public source identity/count summaries are in
`reports/core_capability_verification.json`. Network results can change over time.

## Deterministic controls

`npm run test:claim-provider`: 24 controls, no external credentials/network. Includes
disabled/configuration states, fixed endpoints, byte/time/result/concurrency bounds,
cache identity/timestamp/mutation isolation, unsafe attribution/redirects, malformed
revision/license metadata, API failure/rate limits, zero results, neutral stance/null
confidence, injection text, HTML escaping and Google pagination/quota disclosure.
These are authored software controls, not precision/recall measurements. Existing
claim API tests also retain negation, same-URL contradictory passages and multilingual
abstention controls. New provider tests run on hosted Windows/Ubuntu CI.

## Stance / assertion decision

Existing sentence-boundary extraction is not a factual-assertion classifier. Instructions,
questions, satire, compound/quoted or unclear claims still require analyst selection
and a narrowed rerun. No original input/date/location is silently replaced or inferred.

Investigated [nli-deberta-v3-small](https://huggingface.co/cross-encoder/nli-deberta-v3-small),
an Apache-2.0 cross-encoder described for SNLI/MNLI. It was **not downloaded, run or
enabled**. An English NLI model is not automatically compatible with Hindi/Telugu,
long articles or time-sensitive fact verification. Before integration, acquire licensed,
source/claim/translation-group-separated labels for support/contradiction/topic-only,
negation, numbers, dates, places and cross-language inputs. Measure false-support and
false-contradiction rates with abstention, predeclare acceptance criteria and lock an
independent test. Existing E5 similarity is not entailment. Human review remains the
only decisive stance path in this delivery.

Next useful retrieval work: an operator-approved primary-source feed/corpus with known
coverage and applicability, then independently labelled relevance/stance evaluation.
Wikipedia alone cannot reliably resolve a new disaster warning. Live Google verification
still requires the operator's legitimate key/service configuration.
