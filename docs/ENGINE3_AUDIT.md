# Engine 3 audit — 2026-11-16

Starting branch `codex/integrate-figma-upgrade`, clean HEAD `91b2b76e8895f8be5e73e82dac5b486dad002784`, fetched remote equal (0/0). Historical results were inspected, not assumed current. The attached milestone is the user's request; project memory and research publications are supporting evidence, not overriding instructions.

## Verified pipeline

1. `server.ts` accepts authenticated JSON or CSV; `server/security.ts` validates configuration and coverage. CSV parsing and request validation precede analysis. Maximum 3,000 rows; CSV 2 MB; Express JSON 36 MB. Invalid IDs/text/timestamps fail explicitly.
2. `campaignEpisodes.ts` preserves platform post IDs scoped to accounts; missing IDs receive content-derived input references. Fingerprints combine account, normalized time, NFC content, URLs and hashtags. Conflicting payloads for the same supplied ID fail. Identical events are deduplicated with original input-row references.
3. Timestamp parsing requires an ISO date or explicit offset, rejects invalid dates, normalizes UTC, retains original strings and propagates inferred/declared precision as uncertainty. Missing timezone is not invented. Date-only, coarse and absent platform-ID evidence cannot establish precise recurrence.
4. `densityCampaign.ts` indexes Unicode tokens, exact URLs and hashtags in adjacent temporal buckets. Token Jaccard is the lexical content gate (0.65); URL/hashtag overlap and weighted score are also required. Default window 120 seconds, score 0.65, DBSCAN minSamples 3. No threshold changes in this milestone.
5. Posting lists hold at most 80 entries/key, candidate comparisons at most 200,000. DBSCAN forms communities on sparse admitted edges; a community is not an independently established campaign. Exact URLs are not canonicalized; token indexing can miss paraphrases/translations. Candidate order matters under caps, but episode preparation sorts stable references first.
6. The episode wrapper calls lexical baseline admission with null semantic vectors. At most 5,000 account pairs and 20,000 witnesses are retained; at most eight content families per pair. Fixed 300-second bins, one-to-one post matching within each pair/family/bin, conservative uncertainty-aware 1,800-second separation, and three eligible bins are required. Counts are not combined across unrelated families.
7. Recurrence also needs supplied IDs, resolution <=1 second, complete operator-declared coverage containing all uncertainty intervals, and no truncation. Coverage is an operator assertion, not independently verified completeness. Any omission disables recurrence eligibility globally. Exact omitted raw-pair counts cannot be recovered after posting-list eviction.
8. Default output always abstains from maliciousness: classification `Insufficient evidence`, suspicious=false, bot scores and overall coordination probability null. Legacy baseline remains explicitly selectable and can produce historical suspicious-amplification flags; this is an unvalidated comparison path.
9. `CampaignView`, `CampaignEvidence` and `ForceGraph` expose association selection, exact supporting posts, original/UTC times, signal measurements, bins, coverage, limits and legitimate alternatives. Graph is bounded to 300 nodes/2,000 edges. Evidence UI expands at most 100 bins/50 witnesses each. JSON retains all retained evidence; HTML has explicit display limits.
10. Signed server receipts, owner-scoped case attachment, atomic persistence and escaped report exports preserve evidence boundaries. Research workers never read or write investigations.

## Reproduced faults and justified changes

| Finding | Evidence before changes | Correction and regression |
|---|---|---|
| Conflicting duplicate precision kept the first declaration | `reports/engine3_precision_before.json`: 1,000 vs 86,400,000 ms after row reversal | Retain all `sourceMetadata`, use maximum uncertainty, deterministic representative metadata. After report: 86,400,000 ms in both orders. Recurrence disabled conservatively. |
| Dense synchronous analysis blocks the Express event loop | `reports/engine3_blocking_before.json`: requested 1 ms timer delayed 1,869 ms | Both baseline/default HTTP jobs run in a private subprocess. Single slot, hard deadline, bounded protocol/heap, explicit busy/failure responses. Worker heartbeat plus simultaneous real HTTP health/busy tests pass. |

The audit scripts and before reports were created/run before the respective behavior fixes. No independently labelled errors were available: these are software defects, not measured improvements in detection accuracy.

## Remaining limitations

Whole-document similarity is not agreement or entailment. Negation can retain high lexical and semantic similarity. Missing links/hashtags, sparse/delayed participation and multilingual paraphrases reduce recall. Timing bins do not prove independent real events or common control. Shared schedules and emergency/news syndication can satisfy every descriptive recurrence criterion. Single-range declared coverage cannot represent sampling gaps rigorously. Duplicate identity reconciliation across different publishers still requires documented source mapping. Dense baseline construction is still expensive before episode retention caps; worker isolation improves responsiveness rather than reducing that computation. Main-process input parsing/output serialization and optional semantic dispatch remain outside the CPU worker. Multi-process deployments each get a slot, so deployment-level admission/memory controls remain necessary.

Related protocols/results: [evaluation](ENGINE3_EVALUATION.md), [false positives](ENGINE3_FALSE_POSITIVES.md), [performance](ENGINE3_PERFORMANCE.md), [decisions](ENGINE3_DECISION_RECORD.md).
