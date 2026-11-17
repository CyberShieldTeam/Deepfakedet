# Experimental relevance reranker

Selected [cross-encoder/ms-marco-MiniLM-L6-v2](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2),
publisher Apache-2.0; revision `233902d25c440f23af6f7d6e94d2946bac0bee0a`.
Six-layer BERT/MiniLM, hidden 384, **22,713,601 measured parameters**; MS MARCO passage
ranking training, English. Claim first, title plus exact passage second; scalar logit
sorted descending, not a probability or stance. 512 tokens, no silent truncation.
Safetensors 90,870,598 bytes, SHA-256
`821d1aa69520101d6e0737f78a042ae25b19e5cb9160701909d10434f4aeb0ae`.
Six files total 91,815,758 bytes; all tokenizer/config Git-blob pins are in
`ai_service/research_models.py`. Downloads completed sequentially with NLI, after explicit
tool approval. Runtime is offline, safetensors-only, CPU two threads, no remote code.

## Independent labelled abstract relevance

SciFact/BEIR is a more appropriate relevance test than interpreting FEVER page names as
passage annotations. [BEIR's distributed SciFact corpus/qrels](https://github.com/beir-cellar/beir)
contain 5,183 scientific abstracts. Claims/annotations are CC BY 4.0 and S2ORC abstracts
ODC-By 1.0 under the [SciFact publisher license](https://github.com/allenai/scifact/blob/master/LICENSE.md).
The BEIR `test` qrels derive from SciFact's public labelled development set; this is
**not** SciFact's original hidden test set. Declared reranker training is MS MARCO;
unknown pretraining/undisclosed overlap and scientific-to-news transfer remain limitations.

Archive 2,816,079 bytes, publisher-listed MD5 `5f7d1de60b170fc8027bb7898e2efca1`, observed
SHA-256 `536e14446a0ba56ed1398ab1055f39fe852686ecad24a6306c80c490fa8e0165`.
Python's TLS certificate-chain failure was not bypassed: Windows verified TLS fetched
the same archive, then preparation checked its publisher identity. No dataset passages
are redistributed. The frozen protocol preceded inference: 15 development, 15 validation,
30 held-out, hash order; gold source groups and near-claim variants separated. Shared
candidate corpus is intentional. Actual application BM25 searched the full corpus;
top six positive candidates only, with **no injected gold evidence**. Reranker received
whole title+abstract inputs. Any unscored pair retained that query's entire baseline
order. Supplied qrels define document/whole-abstract relevance, not factual correctness.

| Held-out 30 queries, all included | BM25 | Reranked/fallback |
| --- | ---: | ---: |
| Recall@1 | .4833 | .5167 |
| Recall@3 | .6333 | .6333 |
| Recall@6 | .6833 | .6833 |
| Full-list MRR | .5722 | .5944 |
| nDCG@3 | .5727 | .5894 |
| nDCG@6 | .5959 | .6125 |

Validation MRR .5722→.6333, nDCG@3 .5712→.6432, Recall@6 unchanged .7000 passed the
predeclared **optional relevance** gate. Development MRR regressed .8556→.7778; retained,
not hidden. Complete scoring: development 7/15, validation 10/15, held-out 14/30;
the rest used documented whole-query fallback because of token limits. No pairs were
silently shortened. Of 360 candidate pairs, 309 executed and 51 were explicitly over
the token limit. Unjudged documents count as zero only for standard qrel metrics.
No broader relevance guarantee follows. Paired held-out query bootstrap (5,000,
seed 7017): ΔMRR .0222, 95% [0,.0667]; ΔnDCG@6 .0167 [0,.0500]. These small-sample
intervals and selection/source dependencies preclude a strong generalization claim.

Recorded startup 9.19 s, executed-pair median 83.55 ms/p95 138.39 ms; peak working set
475,394,048 bytes (~453.4 MiB). Initial FEVER run: startup 9.12 s, median 57.89 ms,
p95 85.24 ms, peak 471,822,336 bytes. Different inputs/cache/load, not controlled speedups.

## Application decision and resource controls

Disabled by default. With explicit research configuration and approved English claim,
rerank up to eight existing candidates; preserve every candidate and its original BM25/
semantic scores. No source insertion, removal, stance assignment, verdict, model promotion
or automatic translation. Any language/metadata/hash/size/busy/timeout/model failure
retains original order. Google reviewed-claim metadata is ineligible. Diagnostics retain
model revision, raw logits, exact full input and excerpt hashes, runtime and failure state.

The existing supervised transport is shared through separate strict NLI and reranker
schemas: one active request per worker; 64 KiB messages; one pair microbatch; 512 tokens;
startup 90 s/request 20 s; idle 300 s; three starts per ten minutes; owned-process-tree
termination and restart cleanup; no cross-user text cache; secret environment stripping.
Reranker admission requires 1.5 GiB free RAM (engineering budget, not measured minimum).
Both workers may coexist only if their independent memory admissions succeed.

Results: `reports/engine2_scifact_reranker_v1.json`,
`reports/engine2_advanced_reranker_v1.json`, `reports/engine2_advanced_verification_v1.json`.
Use `prepare_scifact`, `scripts/prepare-scifact-pools.ts`, then `evaluate_scifact` to
reproduce on new output paths. Preserve frozen inputs and failed reports; do not tune
on these inspected samples and call them fresh tests.
