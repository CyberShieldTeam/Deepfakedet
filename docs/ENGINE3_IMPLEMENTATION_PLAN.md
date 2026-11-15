# Engine 3 readiness: preserve the existing campaign engine

## Implemented episode slice — 2026-11-15

The bounded plan below is now implemented from `aa28502`, with exact initial application/
control measurements preserved in `bede7ad`. See `CAMPAIGN_EPISODES.md` and `CAMPAIGN_API.md`
for current behavior, API compatibility, measured costs and limits. The historical
readiness audit below remains context, not a statement that the episode implementation
is still only planned. The legacy baseline, unchanged thresholds and previous artifacts
remain. Source-bound witnesses, one-to-one pair episodes, missing-data safeguards,
generic/E5 task contracts, graph inspection and complete retained JSON export are implemented.

Authored controls and endpoint/browser tests passed; independent coordination validation
is **not** complete. Next acceptance gate: lawfully obtained campaign/event/account labels,
ordinary viral negatives, verified collection/coverage and platform/source/time-disjoint
evaluation. Improve multi-window coverage and benchmark realistic long-text/concurrent
loads before deployment claims. Diagnostic semantic compatibility is not validated
multilingual campaign detection. No new classifier is selected or trained.

## Historical readiness audit and proposed slice

Assessment baseline: `7b40c48`. This milestone changes no campaign inference,
threshold, graph or classification code. The next slice is planned, not implemented.

## Existing implementation

`server/campaign.ts` retains the older token-Jaccard/URL/time graph and union-find
baseline. The live route uses `server/densityCampaign.ts`: validated uploaded posts,
UTC-normalized timestamps, token/URL/hashtag inverted indices plus adjacent time buckets,
optional configured embeddings, account-pair aggregation and sparse DBSCAN. Default
window 120 seconds, minSamples three (including self), association threshold .65.
Candidate lists cap at 80 entries/key and 200,000 pairs; truncation is disclosed.

Text Jaccard >=.65 or cosine >=.85 is one content family, with URL or hashtag overlap
also required. A weighted association score includes time proximity. URL and hashtag
matching are exact strings, without robust URL canonicalization. Semantics alone cannot
discover pairs absent a shared indexing key; this limits cross-language candidate recall.

Account edges represent observed post associations, not verified follow/retweet/control
relationships. Every edge is typed `semantic_copy`; its description reports contributing
signals. There is no authenticated social-account relationship ingestion or independent
maliciousness label. DBSCAN communities and degree/post-rate summaries are real computations,
not bot probabilities. `botLikelihoodScore` and overall coordination probability remain null.

Recurrence currently means >=3 matching post pairs and >=3 distinct timestamps on each
account. This need not represent distinct events. A Cartesian product of reposts within
one minute can satisfy it. Stored maximum pair score and last pair's descriptive fields
can also refer to different observations, which warrants an explicit evidence-record model.

`CampaignView.tsx` provides account/community graph exploration, selected-account details,
clusters and temporal/language summaries. Existing owner-bound receipts attach results
to cases and timelines; `ReportModal.tsx` exports communities, methods and limitations.
Raw post-pair attribution is currently prose rather than a structured event ledger.

Embedding integration caveat: the campaign route sends raw texts to the shared `embed`
adapter, while the optional local E5 service requires query/passage prefixes. Claim
retrieval supplies those prefixes; campaign requests currently do not. Pointing the shared
endpoint at E5 therefore makes campaign embeddings fail closed to lexical fallback.
Do not silently reuse E5 retrieval thresholds as validated post-similarity thresholds.
The next slice must add an explicit task/model input contract and comparison before
claiming multilingual campaign semantics. No semantic campaign quality is measured here.

## Observed software controls, not accuracy

`reports/engine3_architecture_controls_v1.json` preserves the current code hash and
three authored scenarios. Single public-news sharing: zero flagged accounts, insufficient
evidence. Different topics sharing a publisher URL: zero flagged accounts, classified
organic. Repeated identical public bulletins by four accounts at 0/30/60 seconds:
**four flagged accounts**, suspicious amplification. No independent account truth was
supplied. This is a concrete design risk, not a measured real-world false-positive rate.
Absence of suspicious associations likewise does not establish organic activity.

Plausible confounders: emergency/public-health bulletins, syndication, sports/news live
updates, advocacy campaigns, official alerts, common scheduling tools and shared popular
URLs. Repetition and simultaneity alone cannot establish intent or common account control.

## Next bounded slice: structured recurrence evidence

Reuse normalization, candidate generation, account graph, DBSCAN and case export. Add
an explicit post-pair evidence record with post IDs, exact UTC timestamps, content/URL/
hashtag measurements, contributing episode IDs and source coverage/truncation. Separate
content similarity, time coincidence and repeated episodes in the response and UI.
Preserve the baseline as a named comparison; do not silently retune its thresholds.

Define and freeze an event/episode policy before tests: independently separated windows
and distinct post IDs, one-to-one matching rather than pair-count inflation, minimum
observed exposure on both accounts, and sensitivity to clock precision/missing coverage.
Without sufficient distinct episodes, report association only. Recurrence across episodes
may warrant analyst review; it still does not prove malicious intent. Model training or
supervised maliciousness classification requires separate labels and authorization.

Use a popular-URL/topic baseline and matched ordinary viral controls. Lexical and semantic
similarity are one dependent signal family; multiple correlated measures cannot be
counted as independent proof. Evaluate missing data and sampling bias. A stronger graph
edge should cite the exact observations that support its weight. Record uncertainty in
available event coverage rather than inventing confidence percentages.

## Acceptance criteria before promotion

1. Existing APIs, ownership, graph rendering, demo isolation and export continue to work.
2. One burst with many pair combinations remains a single episode; duplicate post IDs
   and translation/URL variants cannot manufacture recurrence. Include timestamps with
   time zones, limited precision, identical timestamps, gaps and out-of-order posts.
3. Shared URL alone, similar headlines alone, temporal coincidence alone and legitimate
   repeated same-event bulletins never yield an unqualified malicious-account label.
4. Authored multi-episode controls produce inspectable recurrence observations with exact
   contributing post IDs. Label these software controls, not real coordinated accounts.
5. Candidate truncation, unavailable embeddings and incomplete source coverage lead to
   explicit limitations/abstention. Benchmark time/memory at existing input limits.
   Test configured generic versus E5-specific input contracts and missing-prefix fallback;
   model-specific thresholds require independent evaluation rather than name substitution.
6. Compare the preserved baseline against the new episode method on the same frozen
   controls. Independent precision/recall requires legally usable campaign/account labels,
   platform/source/time-separated splits and legitimate viral negatives; otherwise null.
7. Reports preserve observation provenance and alternative explanations without merging
   media, claim truth and dissemination into one authenticity score.

Do not start a large Engine 3 rewrite or introduce new models under this readiness slice.
