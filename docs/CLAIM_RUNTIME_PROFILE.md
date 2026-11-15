# Bounded E5 runtime profile — 2026-11-15

Baseline `7b40c48` already loaded one persistent model per process and cached vectors
in Express for 30 minutes, with owner/model/revision/text isolation and a 5,000-entry
cap. Those mechanisms are reused, not reimplemented. CPU configuration, weights,
pooling, normalization, 512-token cap, eight-text model batches and quality gates stay fixed.

## What the historical number meant

The old `loadingSeconds=70.789` starts inside FastAPI lifespan before `Encoder`.
It includes resource checks, six snapshot hashes, torch/transformers imports, tokenizer
initialization and checkpoint/model construction. It excludes earlier interpreter,
uvicorn/FastAPI/module startup and all embedding computation. There was no per-stage
breakdown, so its dominant cause cannot be reconstructed from that number alone.
The old 709.8 MiB peak is whole-process working-set peak, not just model parameters.

New instrumentation measures bounded named startup stages and keeps only the last 32
request timing records, without logging claim text or vectors. Tokenization, forward pass,
pooling, request totals and full-length token warnings are distinct. Checkpoint loading
and model initialization remain one measured scope because `from_pretrained` performs
both. Full-length sequences are warnings, not proof of truncation. External process-to-
ready time includes interpreter/uvicorn/imports/loading and polling. Nested stage timings
must not be added to that total again.

## Actual runs

Two fresh processes used existing local files; **OS caches were not flushed**. These are
fresh-process starts, not reproducible disk-cold benchmarks or controlled proof of a
70.8-to-23.8-second optimization. Background host load/file cache can affect the numbers.

| Measurement | Process 1 | Process 2 |
|---|---:|---:|
| External process to ready | 28.570 s | 23.786 s |
| Encoder load scope | 26.926 s | 22.150 s |
| Module-to-lifespan scope | 0.879 s | 0.641 s |
| Snapshot verification | 0.441 s | 0.445 s |
| Torch import | 6.773 s | 5.076 s |
| Transformers import | 13.739 s | 11.660 s |
| Tokenizer initialization | 2.221 s | 2.231 s |
| Checkpoint/model initialization | 3.726 s | 2.720 s |
| Peak process working set | 709.81 MiB | 703.36 MiB |
| First two-text inference, HTTP wall | 268.50 ms | 150.16 ms |
| Subsequent direct inference, HTTP wall | 87.86–103.18 ms | 68.96–96.12 ms |

Framework imports dominate the newly measured load scopes (~76%); hashing is <0.5 s.
No hash verification was skipped. Repeated direct requests recompute embeddings, showing
persistent-process warm inference rather than application-cache latency. Identical fixed
inputs produced bit-identical vectors within each process; no quality setting changed.
These are eight requests across two processes, not a p95/concurrency/service SLA.

## Implemented efficiency/reliability changes

- Existing embedding cache now includes endpoint identity as well as owner/model/revision/
  text. It deduplicates equal texts within a request and restores original input order.
- Missing texts use sequential batches <=32 texts and <=60,000 characters, compatible
  with the single CPU encoder; concurrent batches no longer compete for its busy lock.
  Existing 20-second provider request and 40-second dispatch budgets remain; a request
  already dispatched can extend beyond the dispatch deadline. This is not a strict
  whole-endpoint 40-second SLA.
- Entire returned vector sets are validated before cache insertion, preventing a mixed-
  dimension/failed request from poisoning later queries. Existing cache TTL/cap remain.
- Per-call diagnostics report unique hits/misses, duplicate input savings and actual
  provider requests; no claims or vector contents are included in these counters.

In the fixed software retrieval run, repeat queries sent **zero embedding requests**.
Warm E5-only application retrieval was 0.28–0.53 ms; hybrid 0.15–0.53 ms; BM25
0.06–0.26 ms. This includes ranking but excludes external evidence acquisition/HTTP
claim verification. Hybrid runs after E5 and can reuse its vectors, so method latency
is not a fair uncached inference comparison. No cold-start or memory reduction is
attributed to the cache changes; operational benefit is avoiding repeated inference.

No new GPU, model or dependency was added. BM25-only operation still works without the
embedding service; unavailable/invalid embeddings do not become fabricated vectors.
Keep one ready service running in production and gate requests on readiness; do not
launch a model worker per claim or use development reload/multiple workers casually,
which would duplicate startup and RAM. No cross-owner sharing of cached claim text.

Reproduce from repository root using **new** output names:

```powershell
.\.venv-win\Scripts\python.exe -m ai_service.profile_claim_runtime --snapshot .model-cache/multilingual-e5-small --output reports/new_runtime.json --evaluation-output reports/new_retrieval.json
```

The supervisor enforces a 180-second startup/90-second control-evaluation profiling
budget, terminates workers in finally, and refuses existing reports/logs. Production
inference limits are unchanged. Raw results:
`reports/claim_runtime_profile_v2.json`, `reports/claim_readiness_controls_v2.json`.
Previous v1 reports and their exact implementation remain preserved in history.
