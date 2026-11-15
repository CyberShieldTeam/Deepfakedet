# Engine 3: traceable campaign episodes

Implementation starts at `aa28502`. The previous sparse-DBSCAN method is retained as
`analyzeDensityCampaignBaseline`; its defaults and legacy tests remain. A bounded observer
hook exposes qualifying post pairs without changing baseline results. No model or dependency
was added. Engine 1/2 inference, prior artifacts and incomplete scientific validation remain.

## Implemented policy and evidence

The predeclared policy is `CAMPAIGN_EPISODE_PROTOCOL_V1.md`. `episodes_v1` reuses the
baseline's lexical candidate admissions, 120-second pair window, .65 association threshold,
minSamples three, 80-entry postings lists and 200,000 candidate cap. New evidence is capped
at 5,000 account pairs / 20,000 witness candidates / eight content families per pair.
Retained edges are reclustered with the same DBSCAN implementation and minSamples.

Every edge joins an association record, actual post-pair witness IDs and source input
records. These preserve supplied post/account IDs, stable input references, original
timestamp strings, normalized UTC, resolution/uncertainty, exact content, URLs/tags,
input-row provenance, Jaccard/overlap/time measurements and optional diagnostic cosine.
Shared coverage, missing-data warnings and truncation apply to all associations. A weight
cites one real retained witness; it does not splice a maximum score onto another pair's
measurements. URLs are observations, never fetched as evidence of account communication.

Missing platform IDs remain null and get visibly labeled `input_reference` identifiers,
not invented platform posts. Conflicting payloads for one account/post ID are rejected.
Same-account identical timestamp/content/URL/tag copies collapse even under different IDs;
duplicate input-row provenance/counts remain. Similar text at different actual times is
not deleted as a duplicate. Explicit-offset timestamps normalize to UTC; local datetimes
without offsets are rejected. Date-only/minute-only and declared coarser precision are
retained conservatively and cannot establish precise recurrence.

Episodes are **per account pair and content family**, not globally independent events.
They span at most 300 seconds from the first witness. Chronological one-to-one matching
prevents one post being reused within that episode. Distinct temporal bins count toward
separated recurrence only when the earliest possible start is >=30 minutes after the
previous bin's latest possible end. For four accounts, three time windows can produce
18 pair-episode records; that is not 18 separate real-world campaigns/events.

At least three separated precisely identified episodes, provided distinct post IDs,
complete declared coverage spanning the input uncertainty and no truncation are needed
for `recurrenceEligible`. Eligibility means inspectable repetition for analyst review,
not intent, common control or a verified independent event. Scheduled organizational
bulletins may satisfy it. Unknown/incomplete coverage never implies silence. Current
coverage is one declared range plus completeness; discontinuous windows must be marked
incomplete. Platform provenance and completeness are not independently authenticated.

The default response retains legacy fields but uses `classification=Insufficient evidence`,
`overallCoordinationIndex=null`, `botLikelihoodScore=null`, `suspicious=false` and zero
legacy suspicious-post count. Separate descriptive observations report no association,
single episodes, separated episodes or incomplete observation. No maliciousness probability,
bot verdict or factual/media conclusion is inferred. Community association strength remains
the measured mean edge weight, explicitly not a probability of wrongdoing.

## Semantic compatibility

`campaignEmbedding.ts` implements an explicit task/model contract. Generic configured
models retain raw text under `generic`. The existing pinned E5-small requires
`VERITAS_CAMPAIGN_EMBEDDING_FORMAT=e5-similarity`, matching model ID/revision and a
`query: ` prefix on both texts for similarity. Unsupported identities/formats, failed
inference and absent endpoints fail closed to lexical/Jaccard operation.

E5 and generic cosine are **diagnostic-only** in the episode path. No claim-retrieval
threshold is promoted to validated campaign similarity; semantic values do not create
extra admissions or count as an independent content family. Cross-language pairs without
shared lexical indexing keys may remain undiscovered. The named baseline function still
supports its original vector argument; the API comparison uses the fixed lexical baseline.

The actual cached E5 HTTP smoke returned finite 384-dimensional vectors for three authored
English/Hindi/Telugu sentences in 384.23 ms, and an incompatible generic-format setting
was rejected. This tests formatting/transport only, not multilingual campaign quality.
No download, GPU requirement or additional model was introduced. Raw artifact:
`reports/campaign_embedding_contract_v1.json`.

## Investigator workflow and integrity

The existing CampaignView/ForceGraph/community exploration remains. A bounded evidence
panel adds association selection, episode intervals, actual post IDs/text, original/UTC
timestamps, separate signal values, coverage/truncation warnings and legitimate alternatives.
Only one expanded episode's first 50 witnesses renders at a time; episode view caps at 100.
The full retained ledger can be downloaded as JSON. These are display caps, distinct from
analysis truncation. The graph still displays <=300 accounts / 2,000 links.

Signed owner-bound results attach through the existing investigation route. API tests
reject altered results and cross-owner attachments. Campaign evidence does not create a
media or claim result. Authenticated report JSON preserves the complete retained ledger;
escaped HTML adds post/episode/witness attribution with explicit display caps (200 posts,
200 episodes, 500 witnesses). The existing graph and report paths are extended, not replaced.

## Frozen software comparison

Ten authored controls, no independently labeled campaigns. Shared defaults, no tuning.
Expected observations live in `test/fixtures/campaign/episodeControls.ts`; raw results and
code/protocol hashes in `reports/campaign_episode_controls_v1.json`.

| Authored scenario | Legacy flagged accounts | New pair episodes | Recurrence review pairs | New flagged accounts |
|---|---:|---:|---:|---:|
| Public health, emergency, breaking news, sports, syndication, independent users (each) | 0 | 6 | 0 | 0 |
| Repeated official bulletin at 0/30/60 seconds | 4 | 6 (one per pair) | 0 | 0 |
| Popular URL, different topics | 0 | 0 | 0 | 0 |
| Scheduled organizational announcements, three separated windows | 4 | 18 | 6 | 0 |
| Authored repeated pattern, three separated windows | 4 | 18 | 6 | 0 |

The repeated one-minute bulletin no longer manufactures eligible recurrence from Cartesian
pair counts. Scheduled legitimate-style posts still show repetition and alternatives,
demonstrating why recurrence alone must not be an accusation. These are software behavior
checks, not measured false-positive reduction, detection accuracy or independent labels.
Precision, recall, F1, AUROC and maliciousness probabilities remain null/unavailable.

## Bounded runtime and memory

Separate Node/tsx processes, no embeddings, 3,000 short posts per resource scenario:

| Scenario / method | In-process time | Candidates / associations | Sampled peak tree RSS |
|---|---:|---:|---:|
| Sparse / baseline | 96.13 ms | 0 / 0 | 125.84 MiB |
| Sparse / episodes | 159.00 ms | 0 / 0 | 138.05 MiB |
| Dense / baseline | 1,400.25 ms | 200,000 / 200,000 | 406.78 MiB |
| Dense / episodes | 1,860.97 ms | 200,000 / 5,000 | 444.98 MiB |

Dense episode construction 82.32 ms, final DBSCAN/summary 7.23 ms; baseline candidate/
graph work 1,679.58 ms and preparation 78.64 ms. Sparse final graph work 2.75 ms.
Both dense methods disclose candidate truncation; the new path also discloses omitted
witnesses/associations and disables recurrence eligibility. Caps do not imply complete recall.
Process-to-exit wall times including startup were 0.68–2.51 s. RSS is sampled every 20 ms
across launcher plus descendant workers, so instantaneous peaks may be missed. These are
single runs with warm OS caches, not concurrency/p95 or maximum-text-size upload SLAs.

The first external sampler recorded only the tsx launcher (~40 MB), which is not worker
memory. That mistake is preserved and explicitly superseded by
`reports/campaign_resource_measurement_correction.json`; use **v2** tree-memory reports.
Historical v1 latency/counts and in-process snapshots remain, without reinterpreting the
launcher figures. V2 raw report: `reports/campaign_episode_resources_v2.json` and its four
child reports. No claim of memory reduction is made; traceability has measurable overhead.

## Verification and remaining gate

Node/API suite, episode attribution/deduplication/UTC/precision/coverage/cap tests,
ownership, tamper protection and escaped export passed. Python: 68 total, 67 passed,
one optional absent-weight AASIST skip. TypeScript/build passed with the existing large
chunk warning. Browser: development ten passed/two expected skips; authenticated production
five passed; separate quoted-claim review one passed. Graph SVG/circles, post inspection,
JSON download and case saving were exercised. Production auth returned 401 without a token;
built assets were served; temporary services stopped. No image/audio/temporal model changed.

Next: lawfully usable, independently annotated campaign/event/account data with legitimate
viral negatives and platform/source/time-separated splits; verified post capture/coverage,
event definitions, multi-window coverage and recurrence annotation; threshold/semantic
evaluation and resource tails under realistic long posts/concurrency. No such independent
corpus is admitted. Engine 3 is implemented descriptive software, not scientifically
validated attribution of malicious coordination. Engine 1/2 validation remains open too.
