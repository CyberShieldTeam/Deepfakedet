# Engine 4 evidence model and API v1

Implemented contracts: `src/correlationTypes.ts`; adapters/rules: `server/correlation.ts`.
This document describes the shipped vertical slice, not planned semantic/media research.

## Snapshot and identity

`CorrelationResult` has schemaVersion 1, policy `correlation_v1`, investigationId,
inputFingerprint, process state, nodes, relationships, timeline, contradictions, missing
evidence, limitations, caps/counts, measured elapsedMs and actual generatedAt.

Node IDs hash investigation ID, node type and source identity. Edge IDs additionally bind
the endpoints, type, matching method and measurements. No IDs derive from array position
alone. Equal IDs cannot bridge investigations. Repeat correlation of unchanged evidence
and contexts produces identical IDs, nodes, relationships, timeline and fingerprint;
generation time/execution duration naturally differ.

Nodes: investigation, media asset/observation, claim/assessment, source evidence, post,
account, URL, hashtag, episode, network relationship. Each has source engines, original
references, statuses, original/UTC times with resolution, limitations and selected metadata.
References identify source-array positions in the fingerprinted case snapshot; analyst
context references are keyed by the persisted context's stable ID. They are evidence
references, not a promise that every string is a directly dereferenceable JSON Pointer.
Original platform/input references and source IDs remain in metadata. Full source engine
records remain in the case rather than being replaced by graph nodes.

- Media: equal **server-computed submitted-byte SHA256** merges the submitted-byte asset,
  retaining distinct analysis observations. `submittedMedia` is computed from the actual
  request bytes (original image payload when supplied, otherwise analysis payload).
  Scope/byteLength remain explicit. Equality does not establish original publication,
  capture authenticity or a shared original before resizing. Client source hashes and
  filenames are declarations only; old results without server hashes stay record-scoped.
- Claims: NFC + whitespace-normalized literal text groups the same recorded text. Separate
  analysis/source-review records and all statuses remain. Text identity is not truth or
  agreement. Opposite meanings are not merged by a semantic/topic score.
- Sources: separate assessment/source/excerpt/review records stay separate even at the same
  address. Source URLs can share a URL hub without merging passages or reviewed stances.
- Posts/accounts: Engine 3's post input reference and account scope are retained. They are
  imported identifiers, not independently verified global identities.

## Relationships actually implemented

| Type | Matching method / basis | Meaning and limitation |
|---|---|---|
| HAS_OBSERVATION / ASSESSES_CLAIM | Attached engine result reference | Structural provenance; no new classification |
| SOURCE_RETRIEVED_FOR_CLAIM | Existing relevance candidate | Contextual; unreviewed stance remains unassessed |
| SOURCE_ADDRESSES_CLAIM | Existing attributed quote/context review | Preserves reviewer, quote and stance; no new credibility/entailment claim |
| POST_CONTAINS_CLAIM | Complete literal NFC/whitespace-normalized span, Unicode boundaries, case sensitive | Literal mention only; can quote or deny the claim, never implies endorsement or semantic equivalence |
| REFERENCES_URL / SHARED_CANONICAL_URL | HTTP(S) URL parsing, host/default-port normalization, fragment removed | Exact normalized address; preserves path/query/query ordering. No tracking-query stripping, alias resolution, content fetch or byte-identity claim |
| AUTHORED_BY / SHARED_HASHTAG | Imported account/tag fields | Dataset provenance / contextual sharing; no maliciousness inference |
| PART_OF_EPISODE / NETWORK_ASSOCIATION | Existing Engine 3 account/episode/association records | Existing temporal/network observation; all coverage/truncation/recurrence warnings retained |
| MEDIA_CONTEXT_CLAIM | Explicit authenticated analyst caption/description containing the full recorded claim | Analyst assertion, not automatic extraction; text/rationale/reviewer/time retained |
| POST_REFERENCES_MEDIA | Post URL equals analyst-documented media URL | Analyst-supplied media attribution; not independently verified media identity |

Every edge has supporting references, method, descriptive strength, measurements,
explanation and limitations. Strength categories are `exact_reference`, `literal_mention`,
`analyst_asserted`, `contextual`, not calibrated confidence or a universal ranking.
URL hubs avoid post-post cliques. There is no automatic embedding, topic-similarity,
perceptual-hash, transcript, OCR or temporal-causality correlation rule. Those methods are
not validated and were not enabled. Existing semantics in Engine 3 remain diagnostic-only.

## Uncertainty and timeline

Attributed supporting and contradicting passages are retained together. Contradictions
are grouped across assessments of the same literal claim. Neutral/unreviewed does not mean
unrelated or negative. Unrelated nodes remain inspectable in JSON, not silently discarded.
Failed/partial upstream states, original limitations, omitted claim sources, missing
network ledgers and incomplete coverage remain visible. Correlation does not modify any
engine verdict, probability, case risk or recurrence eligibility.

Graph states: `CORRELATION_UNAVAILABLE` for no attached source outputs;
`NO_SUPPORTED_CROSS_ENGINE_LINKS` for complete processing with no supported links;
`CORRELATED_EVIDENCE_AVAILABLE` when supported links exist; `PARTIAL_CORRELATION` when
known upstream failure/partial coverage or correlation truncation limits the graph.
Absent optional engine inputs or missing analyst context are separately disclosed and do
not invent a technical failure. These states describe correlation, not the truth of content.
Terminal failures produce an HTTP error and persisted run status `failed`, not a false
completed graph.

Timeline separates publication, retrieval, analysis, case ingestion and episode endpoints.
Strict ISO offset/date parsing retains original strings; ambiguous unsupported dates keep
UTC null and stay in node metadata. Date-only precision is one day. Post declared precision
and latest possible timestamp are preserved. Duplicate times remain distinct by node/kind;
sorting is deterministic and establishes no causation. No media publication date or
per-evidence ingestion time is inferred from case creation/analysis time.

## Owned-case API and persistence

`POST /api/investigations/:id/correlate` accepts `{}` to reuse saved contexts, or
`{contexts:[{mediaId,claimId,kind,text,rationale,mediaUrl?}]}`. `kind` is only `user_caption`
or `user_description`; clients cannot claim OCR/transcription through this endpoint.
IDs must resolve to media/claim nodes in this owned case. Maximum 32 contexts; text 10k,
rationale 2k, URL 3k characters. Server assigns context ID, actual provider identity and
time; unchanged assertions reuse their attribution. `contexts:[]` explicitly removes
saved assertions for the next graph. It does not delete engine evidence or old external
reports. No source URL is fetched by Engine 4.

Response: `{investigation,result}`. Existing `GET /api/investigations/:id` and
`GET /api/reports/:id` retrieve the graph/context/run fields. No new graph database or
unowned query endpoint. Existing PATCH/attach schemas cannot inject a graph or attribution.
Owner/receipt/live-demo isolation still applies to source attachments.

The input fingerprint excludes correlation runtime/case update time, but includes the
allowlisted evidence projection and assertions. Evidence changes during a worker run
return 409 and cannot save an obsolete graph. Attaching source results marks a saved graph
stale. Failure preserves the prior graph/assertions, marks the run failed, and the UI hides
it as a current result. Successful reruns replace only Engine 4 fields atomically. Atomic
write failure rolls memory back to the last committed state and returns failure. Legacy
cases require no migration; missing graph data means not yet correlated.

Error categories include invalid context/input (400), input-byte cap (413), busy (429),
deadline (504), worker/output/resource failure (503), stale input (409), storage failure
(500). Errors have `processingComplete:false`. No graph is acknowledged on these errors.

## Resource and presentation bounds

One worker per Express process, no queue; built-in worker thread with 512 MiB old-space,
32 MiB young-space and 4 MiB stack limits. Fifteen-second supervisor deadline, 12 MiB
projected input and 24 MiB serialized graph output caps. Provider/auth/store environment
variables are not passed to the worker. These isolate JS computation; native allocations,
projection, request parsing and deployment-wide concurrency still require OS/service
supervision. Not a total-RSS guarantee.

Adapters cap media/claims at 32 each, sources at eight per claim, posts at the existing
3,000 limit, episodes/associations at 1,000 each. No raw media/base64/thumbnails are copied.
Selected numeric/browser observations and bounded experimental image/face/audio/frame
values retain their uncalibrated/client-supplied labels. Full observations remain in the
original case. Graph caps: 5,000 nodes, 10,000 edges, 20,000 matching comparisons, 1,000
timeline entries. `omittedNodes`/`omittedRelationships` count distinct attempted IDs refused
by caps, not all theoretically possible unseen links. Unenumerated omissions are not
fabricated. Timeline/source adapter omissions and all cap flags are explicit.

The case-detail view shows at most 100 filtered relationship buttons and 200 timeline
entries, with engine/type/relationship/basis filters and selected proof metadata. It does
not render thousands of animated nodes. JSON exports retain the complete bounded graph.
HTML reports cap display at 100 relationships/200 times, identify stale/failed previous
graphs, and retain contradiction/missing-evidence/human-review text.
