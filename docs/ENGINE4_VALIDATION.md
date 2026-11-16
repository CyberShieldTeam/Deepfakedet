# Engine 4 validation — authored engineering controls

Starting commit `2ecf2e4`, branch `codex/integrate-figma-upgrade`. No independent detection
accuracy benchmark, calibrated correlation probability or maliciousness score was created.

## Demonstrated actual frontend workflow

`test/browser.spec.ts` (“Engine4 connects…”) uploads a generated PNG through Media
Forensics, saves its inconclusive measurement result, retrieves an explicitly authored
example.org museum passage, records an attributed exact-quote/context source review,
saves it to the same case, uploads twelve authored public posts and saves Engine 3's
observations. In case details it generates the graph, explicitly supplies a caption, then
filters/inspects relationships, downloads JSON and opens the HTML report.

`reports/engine4_workflow_verified.json` exports the authenticated production case after
verifying current input fingerprint and exact API/on-disk/report equality. Case ID:
`fa28eb87-ed80-4c73-a606-04a2981798e0`. It has 47 nodes, 101 relationships and 25
cross-engine links, without omissions. Exact supporting metadata is in `supportedPath`
and the full graph, including source refs and preserved node IDs:

1. Media asset → claim: persisted authenticated `user_caption` assertion containing
   “Software fixture: the fictional Amber Museum offers free entry.” Attribution includes
   actor/time/rationale. This is supplied context, not a transcript or OCR output.
2. Source → claim: source `E1`, “Fictional Engine4 source”,
   `https://example.org/engine4-source`, existing exact quoted passage/context review
   (`/claimResults/0/sources/0`). It is a fictional review workflow, not a factual benchmark.
3. Posts → claim: original IDs `a-0` through `d-2` and stable Engine 3 input references;
   literal span matching, expressly not endorsement/semantic agreement.
4. Posts → source: equal conservatively normalized source URL, not content/identity proof.

Media stays inconclusive with null decision probability; the human claim assessment and
network's null coordination probability/episode safeguards are preserved. Processing
states remain separate from the correlation graph. No final misinformation verdict results.

Development actual workflow passed (16.8 s). Authenticated production workflow passed
(15.7 s), including invalid context rerun: previous graph retained byte-for-byte, run marked
failed, no current relationship list displayed, then successful recovery using prior valid
assertions. The UI showed no more than 100 relationship buttons. UI-ready time including
API/case refresh was ~1,563 ms development / ~1,449 ms production; correlation itself
~16.5 / ~15.2 ms. These are single local observations, not browser SLA or pure render-time
measurements. Screenshots/downloads remain ignored in test-results.

## Deterministic scenarios and API checks

`npm run test:engine4` passes:

- A: three-engine authored binding, source reference and literal post mentions.
- B: legitimate repeated bulletins keep shared URLs/episodes without maliciousness verdict.
- C: opposing attributed sources both retained and contradiction flagged.
- D/E: unrelated and negated wording does not become exact claim equivalence. Literal
  quotations/mentions remain explicitly non-endorsement relationships.
- F/G: failed media and incomplete network coverage produce partial correlation while
  available links remain. Original failures/coverage/limits are not rewritten.
- H/I: deterministic IDs/graph/fingerprint, duplicate observations deduplicated, server
  byte identity separate from client hashes, different cases have disjoint IDs, cross-owner
  access denied and foreign context IDs rejected.
- J: URL hubs, bounded candidates/nodes/edges, 20k comparison/10k edge caps exercised;
  24 MiB output overflow rejected explicitly. No dense post-post clique generated.
- ISO offset normalization, date-only/declared precision, unknown timestamps, unchanged
  query strings, credential-bearing URL rejection, HTML/UI evidence rendering.
- Actual signed Engine 1/2/3 API outputs attach to one owned case; server-computed submitted
  byte digest matches the request; API/disk/report graph equality; stale/failure retention;
  evidence attachment during a worker run returns 409; write failure cannot acknowledge a
  replacement graph or overwrite prior evidence. No destructive migration.
- Worker deadline, interruption, single-slot busy rejection and slot recovery. Resource
  caps are exercised in isolated controls; no private data or external network needed.

`npm test` existing 16-file Node/API suite passed. `npm run test:diagnostics` and
`npm run test:engine3` passed, preserving media partial/failed/unavailable states, retained
claim passages/failures, graph episode visibility, receipts, ownership and atomic storage
rollback. Python unchanged: **69 tests, 68 passed, one absent optional AASIST-weight skip**,
8.65 s. TypeScript and frontend build passed; existing >500 kB bundle warning remains.

Authenticated production existing browser suite: **12 passed, three configuration skips**,
35.0 s. Skips are the separately configured Engine 4 workflow, separately configured claim
corpus workflow, and optional face classifier. Engine 4 and attributed claim review were
exercised together in the dedicated workflow; the face checkpoint remains unavailable.
Development: 11 existing tests passed plus the desktop check passed separately after
resolving an isolated-preview HMR port collision (4.6 s targeted run). Initial full runs
failed the strict page-error assertion with “WebSocket closed without opened”; no assertion
was removed or error ignored. Competing owned dev previews were stopped before rerun.

## Resource measurements

Raw separate-process supervisor records: `reports/engine4_resources_v1.json` and four
child reports. Node parent old-space cap 768 MiB; worker 512 MiB; 30-second/900 MiB sampled
tree-RSS supervisor cutoff, 20 ms sampling. RSS includes parent/worker threads, loader,
preview graph construction and two deterministic worker runs. It can miss short peaks;
the cutoff is reactive, not an OS reservation. Only first worker's correlation elapsed
time is shown below.

| Authored input | Correlation ms | Worker wall incl. startup ms | Sampled tree peak MiB | Nodes / edges | Matching comparisons |
|---|---:|---:|---:|---:|---:|
| Small, 12 posts | 4.47 | 474 | 129.1 | 33 / 55 | 24 |
| Medium, 500 posts | 39.86 | 514 | 123.5 | 529 / 2,007 | 1,000 |
| Dense shared URL, 3,000 posts | 198.10 | 707 | 221.8 | 5,000 / 9,987 | 4,990 |
| Partial media/coverage, 500 posts | 43.42 | 526 | 122.5 | 529 / 2,007 | 1,000 |

Dense processing hit node/timeline limits and correctly reported truncation/partial
correlation; it did not analyze beyond Engine 3's 3k cap. Attempted omission counters are
in the child JSON. Two runs per case produced stable graphs. This matrix does not measure
real campaigns, throughput under concurrent load, native memory peaks or production scale.

## Reproduction and changed files

```powershell
npm run test:engine4
npm run test:diagnostics
npm run test:engine3
.\.venv-win\Scripts\python.exe -m ai_service.profile_engine4 --output reports/NEW_engine4_resources.json
```

For the actual UI workflow use an explicitly isolated case store and small hash-approved
authored corpus containing the quoted fixture/title/URL above, existing Python evidence
service, and `VERITAS_EXPECT_ENGINE4=1`, `VERITAS_E4_TEST_STORE=<isolated-store>`. Set
`VERITAS_TEST_URL` and, for production, `VERITAS_TEST_TOKEN`, then run
`npx playwright test -g "Engine4 connects"`. Do not run a case-creating test against user data.
`test/exportEngine4Evidence.ts` verifies/exports that owned test case; output files refuse
overwrite. No researcher dataset/model download is part of reproduction.

Core additions: `server/correlation.ts`, `correlationRunner.ts`, `correlationWorker.mjs`,
`src/correlationTypes.ts`; additive integration in `server.ts`, `server/security.ts`,
`server/mediaPipeline.ts`, `src/types.ts`, `src/services/api.ts`. Frontend/report:
`CorrelationView.tsx`, `InvestigationsView.tsx`, `ReportModal.tsx`. Tests/tooling:
`engine4Fixtures.ts`, `engine4.test.ts`, `engine4Api.test.ts`, `profileEngine4.ts`,
`exportEngine4Evidence.ts`, browser scenario, package script and Python profiler.
Architecture/evidence/validation/limitations docs and progress/plan record the first slice.
No inference model code, thresholds, semantic admission or recurrence policy changed.
