# Source, model relationship and report integrity

Existing [citation contract](CLAIM_SOURCE_CITATIONS.md) remains: actual canonical/original/
revision links, exact retrieved passage, publisher/license/language, timestamps and source
limitations. Model-card links describe a detector, not independent evidence for a claim.

New source relationships retain claim/source/passage IDs; full-source SHA-256; exact
model-window text/hash and start/end offsets; model/revision; processing/evaluation state;
uncalibrated three-class scores; model suggestion/abstention; human state/attribution.
Source text is never replaced by generated summaries. Short excerpts use their full text;
long excerpts select a contiguous whole-sentence lexical window, bounded to 1,800 characters.
Token-overlong pairs abstain without truncating. Window selection can miss qualifications;
the complete retained source excerpt and original URL remain visible for review.

Fingerprint mismatch prevents inference. Model relationship identity binds exact target,
source ID, original and selected passage hashes and model revision. Source IDs remain
unchanged within each returned claim result. They are scoped to that result, not global
publisher IDs. Same-content copies do not become independent confirmations.

## Retrieval correction

The wrong-year browser diagnostic exposed strict search terms excluding counter-evidence.
The Wikipedia adapter now builds one bounded query combining original token terms with
a numeric/negation-relaxed alternative when safe. No source/model fact is hardcoded.
Query length ≤500 characters, one HTTP request, 10 s/1 MiB/6-result/concurrency/cache
limits remain. Exact claim text is unchanged for inference/review. Actual query is
recorded, so broadening is inspectable; results are still nonexhaustive candidates.
Primary syntax documentation: [CirrusSearch](https://www.mediawiki.org/wiki/Help:CirrusSearch).
No inference or BM25 threshold was changed to improve diagnostic examples.

## Persistence, graph and exports

Signed receipts cover selection and model records. Model suggestions are metadata on
source nodes, with deterministic scoped source/claim references. They do not create
`SOURCE_ADDRESSES_CLAIM`; only existing attributed quote/context review can do so.
Review history and original selected wording survive case and report serialization.
HTML displays exact model passages, score semantics, failed-validation warning and
current human stance separately; canonical/revision references remain clickable.
Original and normalized/selected claims remain distinguishable.

No arbitrary source fetching, unsafe URL schemes or source-directed tool execution was
added. Existing public HTTPS attribution validation, escaped React/HTML, receipt integrity,
CSRF and owner checks remain. NLI is a sequence classifier, not a tool-executing prompt.
Adversarial source language can still affect its inaccurate scores; treating text as data
does not make its predictions robust. Auth/retrieval secrets are not sent to the worker;
no cross-owner claim cache was introduced. The existing bounded Wikipedia query cache
is now owner-scoped as well as edition/query-scoped, with a cross-owner isolation
regression. Private records/keys/weights stay outside Git.
