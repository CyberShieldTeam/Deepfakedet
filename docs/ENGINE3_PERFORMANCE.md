# Engine 3 bounded performance and reliability

Measured on Windows 11, Node 24.19.0, Python 3.13.12, 20 logical CPUs. Raw matrix: `reports/engine3_resources_v1.json` and 24 child JSON files. No external data or model weights used for graph workloads. Single measurements, not percentile SLAs or linear-scaling evidence.

## Resource protocol

One owned child at a time, Node old-space cap 768 MiB, 30-second supervisor budget, 900 MiB sampled process-tree RSS cutoff. RSS and CPU sampled every 20 ms, including descendants. Timeout/resource cleanup uses the existing tested tree-termination helper. Reports refuse overwrite. CPU/RSS include startup and a second stability run; child `wallMs` measures **only the first analysis**. Memory samples can miss instantaneous peaks; Node heap size is not a total OS RSS cap. Cutoff is reactive rather than OS-enforced reservation.

Stable output excludes timestamps of report generation, timing/RSS and original input-row positions; it compares graph edges, retained post metadata, episode boundaries and associations. Episode cases repeat with reversed input; legacy baseline repeats identical input. All 18 valid episode cases and both legacy cases were stable in this matrix. Two missing-time cases failed validation, two oversize cases were rejected; neither is counted as processed workload.

| Authored workload | 1k first-analysis ms / sampled tree MiB | 3k first-analysis ms / sampled tree MiB |
|---|---:|---:|
| Sparse unrelated | 87 / 122 | 137 / 143 |
| Dense identical | 781 / 375 | 1,739 / 531 |
| Popular URL, distinct text | 225 / 116 | 523 / 157 |
| Scheduled announcements | 713 / 325 | 1,793 / 533 |
| Multiple separated bins | 777 / 339 | 1,818 / 532 |
| English/Hindi/Telugu groups | 833 / 369 | 1,281 / 463 |
| Duplicate imports | 506 / 280 | 1,137 / 421 |
| Missing timestamp | Rejected | Rejected |
| Large connected component | 832 / 371 | 1,823 / 536 |
| Incomplete coverage | 833 / 333 | 1,749 / 531 |

Some workload structures intentionally coincide: dense/large-component have identical topology; scheduled/multiple-episode share repeated timings, while incomplete-coverage changes only the declaration. These are diagnostic workload categories, not independent samples. No legitimate-activity labels are inferred from names.

At 3k dense, candidate generation 238.5 ms, similarity loop 786.5 ms, legacy DBSCAN 52.5 ms, preparation 78.4 ms, episode processing 74.5 ms and final graph stage 7.5 ms. These are nested measurements: do not add baseline substage times again to total. The remaining baseline time includes normalization, edge/community/node construction. 200,000 candidates visited; 5,000 retained associations/bins; 195,000 omitted admitted witnesses/associations; truncation true, all recurrence eligibility disabled. Exact omitted **raw** pairs are unknown because posting lists were evicted; report null, not a fabricated total. Evaluated pairs means candidate-loop entries visited, including early rejection by time gap.

Sparse/dense 3k legacy comparison: 86.8/1,358.4 ms first analysis; 135/700 MiB sampled tree peaks across startup plus repeat. Larger baseline repeat memory reflects retaining/building another large graph before GC. This is not evidence that worker isolation reduced algorithm memory.

5k and 10k dense requests remain outside the **3,000-post production cap**. The v1 resource script rejects them before analysis; subsequent regression/resource commands exercise the same guard in `prepareCampaignPosts` directly. No 5k/10k throughput or scalability claim is supported.

Historical 3k dense result: approximately 1,861 ms and 445 MiB tree RSS. Current first-analysis time 1,739 ms is the same order, not a significant performance improvement. Current peak includes a stability repeat, uses a different launch path/heap cap and changed metadata; comparing 531 MiB directly with 445 MiB would be misleading. Both are local synthetic measurements, not production concurrency benchmarks.

## HTTP isolation / failure contract

`campaignRunner.ts` launches a private Node/tsx worker for both algorithms. Each Express process permits one CPU job, no queue; concurrent job => HTTP 429 `CAMPAIGN_BUSY`. Default hard wall deadline 20 seconds includes worker startup/analysis/serialization; heap 768 MiB, request protocol <=32 MiB, response <=64 MiB. Child environment excludes provider/auth/store secrets. Unicode stream decoding retains multibyte boundaries.

Invalid input => 400; protocol/worker/resource failure => 503; deadline => 504; input byte cap => 413. Worker errors include `processingComplete:false`, no result/receipt. Client close aborts the owned child; it never signs interrupted evidence as a complete result. Malformed JSON also passes through existing request-parser error handling. Worker never reads/writes cases. Truncated **successful** analysis is separately explicit in evidence and cannot establish recurrence. Existing atomic-store rollback tests confirm failed writes do not replace committed investigations.

The worker frees the Express event loop during graph CPU work. The before audit delayed a 1 ms timer by 1,869 ms; after tests counted >120 parent heartbeat ticks during dense work. API regression observed HTTP health in 1 ms while a dense request was running and rejected a concurrent analysis with 429. This is a local responsiveness check, not a latency percentile guarantee. Startup costs around 0.5 seconds for small requests. Main-process JSON parsing/receipt serialization, optional semantic requests and process-level deployment limits still need broader concurrency testing.

Optional embeddings are computed after core lexical evidence. Failure/load error/transport timeout retain lexical output and mark semantic evidence unavailable. Simulated timeout/load-failure contract tests are distinct from a real provider timeout measurement. Existing provider dispatch has its own budgets; the 20-second CPU worker deadline does not cover semantic inference. No partial worker result is offered as a completed investigation.

## Reproduction

```powershell
.\.venv-win\Scripts\python.exe -m ai_service.profile_engine3 --output reports/NEW_resources.json
node --import tsx test/engine3/resourceCase.ts reports/NEW_cap5000.json dense 5000 episodes
npm run test:engine3
node --import tsx test/campaignApi.test.ts
# Existing cached model only, no downloads:
node --import tsx test/engine3/semanticInputs.ts reports/NEW_semantic_inputs.json
.\.venv-win\Scripts\python.exe -m ai_service.evaluate_campaign_semantics --input reports/NEW_semantic_inputs.json --output reports/NEW_semantic.json
```

Semantic supervisor: 180 seconds, 2 GiB sampled tree RSS, offline pinned file verification, CPU one thread. Measured startup 65.21 seconds, 22-sentence batch 0.89 seconds, peak ~716 MiB. Scores are diagnostics only; independent semantic precision/recall/F1/FPR remain unavailable.
