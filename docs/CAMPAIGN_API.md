# Campaign analysis API — episodes v1

Existing authenticated endpoints and owner-bound signed receipts remain. The default
`POST /api/campaigns/analyze` preserves existing response fields and adds structured
evidence. Supply either `posts` (2–3,000 input rows) or `csv` (existing 2,000,000-character
bound), not both. The browser file limit remains 2 MB. No source URLs are fetched.

```json
{
  "datasetName": "observed posting sample",
  "posts": [{
    "account_id": "source-account-id",
    "post_id": "source-post-id",
    "content": "actual observed text",
    "timestamp": "2026-01-01T10:00:00+05:30",
    "url": "https://example.org/observed-url"
  }, {
    "account_id": "another-account",
    "post_id": "another-post",
    "content": "actual observed text",
    "timestamp": "2026-01-01T04:30:01Z",
    "url": "https://example.org/observed-url"
  }],
  "config": {"algorithm":"episodes_v1", "windowSeconds":120, "minSamples":3, "threshold":0.65},
  "coverage": {"start":"2026-01-01T00:00:00Z", "end":"2026-01-02T00:00:00Z", "complete":false, "source":"actual collection/coverage description"}
}
```

This is a schema example, not claimed real evidence. Existing account/content/timestamp
aliases remain. Optional `timestamp_precision`/`timestampPrecision`: millisecond, second,
minute, hour, day, unknown; coarser declarations override inferred precision conservatively.
Optional post IDs use `post_id`/`postId`; their authenticity is not independently verified.
Without them, derived input references are clearly labeled and recurrence is ineligible.
Contradictory payloads for an account/post ID reject the request. Local datetimes without
UTC offsets are rejected by the episode path; date-only timestamps retain uncertainty.

`coverage` is optional and describes one declared source window. Missing/partial coverage
does not establish silence or independence. It must span all reported timestamp uncertainty
before recurrence eligibility. Multi-window gaps require `complete=false`. This field is
an operator attestation, not legal rights approval or verified capture completeness.

Original clustering parameter bounds remain: window 10–3,600 seconds, minSamples 3–20,
association threshold .4–1, optional nonnegative weights. Weight totals must be finite and
positive, preventing overflow into NaN scores. The fixed episode duration/separation is
separate from those clustering thresholds; spans above episode bounds are disclosed as
omitted evidence, not silently used for recurrence.

For comparison, set `config.algorithm="density_baseline_v1"`. It calls the original
lexical baseline with original timestamp handling/classification; it does not attach the
new ledger. Its legacy suspicion outputs are heuristic comparison results, not a validated
maliciousness label. The exported baseline function retains its optional vectors argument.

New default response fields:

- `algorithm="episodes_v1"`; `episodeEvidence.policy` identifies the frozen policy.
- `posts`: actual content, provided ID/null, input reference and row provenance, normalized
  and original timestamps/resolution, observed URLs and tags.
- `witnesses`: actual source/target post references, account IDs, UTC timestamps, separate
  content/URL/hashtag/time/cosine measurements and episode ID.
- `episodes`: account pair/family, bounded start/end, timestamp uncertainty, one-to-one
  witness IDs, separation and precision eligibility. These are pair episodes, not a global
  count of independently established real-world events.
  The first bin seeds the separated count; its separation flag is true by convention,
  not evidence of an earlier unobserved episode.
- `associations`: graph edge ID, witness/episode IDs, separated-episode count and eligibility
  for review. Every association inherits shared coverage/warnings/truncation below.
- `coverage`, `coverageComplete`, `duplicatesRemoved`, `omittedWitnesses`,
  `omittedAssociations`, `warnings`, stage timings and process RSS snapshots.
- `embeddingCompatibility`: task-format status, model/version and `usedForAdmissions=false`.
  E5 similarity requires the explicit `e5-similarity` format; unsupported settings retain
  lexical fallback. Semantic metrics are diagnostic-only, not independent proof.

All new automatic classifications abstain; probability fields remain null, legacy suspicion
fields false/zero. Use descriptive `observation` and eligibility, not these legacy fields
as an alternative truth/maliciousness score. Sharing content/URLs, coincident timing,
recurrence and DBSCAN membership do not prove communication, control or malicious intent.

Attach the untampered server-issued result through the existing
`POST /api/investigations/:id/attach` with `{kind:"campaign",result}`. Other owners cannot
attach it, and modified results are rejected. `GET /api/reports/:id` preserves the full
retained ledger in authenticated JSON. HTML rendering and the evidence panel have explicit
display caps; the campaign JSON download contains complete retained records. Analysis
caps and source missingness are separate and never hidden by display limits.
