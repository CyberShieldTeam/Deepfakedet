# Campaign episode policy v1 — predeclared 2026-11-15

Reference baseline aa28502: unchanged association defaults (120-second pair window,
.65 score threshold, minSamples three; lexical Jaccard .65). Sparse candidate limits
80/key and 200,000 pairs remain. Baseline v1 remains separately callable. No threshold
fitting, new model or independent maliciousness label is authorized by these controls.

Episode v1 normalizes explicit-offset ISO timestamps to UTC. Date-only timestamps have
day uncertainty; minute-only timestamps have minute uncertainty. Original strings and
resolution are preserved. Local datetimes without an offset are rejected. Recurrence
eligibility requires provided distinct post IDs and timestamp resolution <=one second.
Missing post IDs get explicitly labeled stable INPUT REFERENCES, never platform IDs.
Where `timestamp_precision` is declared, its coarser resolution is preserved and disables
precise recurrence; `unknown` is treated conservatively as day-scale uncertainty.
Same account/post-ID conflicting payloads are rejected. Exact same-account timestamp/
content/URL/hashtag duplicates collapse even when IDs differ; duplicate count is recorded.

Qualifying lexical account-pair witnesses come from the preserved sparse algorithm,
not a new all-pairs search. Semantic values are diagnostic-only in episodes v1; generic
inputs remain raw and pinned E5 similarity uses query prefixes on both texts. No E5
retrieval or generic cosine threshold is promoted to validated campaign evidence.

Per account pair, witnesses share a URL/hashtag overlap family and lexical anchor
Jaccard >=.65. At most eight families/pair; exceeding any evidence budget is disclosed.
Within each family, sort by UTC then stable references. Greedy chronological one-to-one
matching disallows a post appearing twice in a pair's episode. Episodes have bounded
300-second spans from their first witness, not rolling chains. Another temporal bin is
not recurrence unless its earliest possible start is >=1,800 seconds after the previous
episode's latest possible end. These are observed separated episodes, not statistically
independent or known distinct real-world events. Repeated official schedules can qualify.

Recurrence review eligibility requires >=three separated eligible episodes, complete
operator-declared coverage spanning the pair's observations, precise provided IDs/times,
and no candidate/evidence truncation. Missing observation windows never imply silence.
Coverage declarations are attestations, not independently verified capture completeness.
All results are descriptive observations; no account is automatically malicious or a bot.
Legacy probability fields stay null, legacy suspicion fields false/zero on episode v1.

Bounds: <=3,000 input posts, <=20,000 retained witness candidates, <=5,000 retained
account pairs, <=eight families/pair. Only edges with retained actual witness records
enter the episode graph; DBSCAN is reused on those edges. Omitted witnesses/edges are
explicit and invalidate recurrence eligibility. Evidence IDs cite exact normalized input
records, original timestamp strings, shared URLs/tags and measurement values. No inferred
follow/communication/control relationship is represented. Pair scores cite a real retained
witness, rather than combining a maximum score with another witness's description.

Frozen controls will cover public health, emergency, news, sports, repeated official
bulletins, popular URLs, syndication, scheduled organizations, unrelated users and separated
multi-episode activity. Expected observations are declared before evaluation. Compare the
same raw inputs against baseline v1 and episodes v1. Results are software controls only;
precision/recall/F1/AUROC and maliciousness probabilities remain unavailable.
