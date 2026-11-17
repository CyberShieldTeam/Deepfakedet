# Engine 2 retrieval investigation

Started from clean, synchronized `4dd8349` on `codex/integrate-figma-upgrade`.
The pipeline is original input → conservative candidates → explicit selection → provider
queries → canonical-URL/passage deduplication → BM25/optional E5 → optional experimental
reranker → selected-window NLI → attributed review → aggregate → case/graph/report.
Relevance, source credibility, textual stance and factual assessment remain distinct.

## Reproduced problem and deployed scope

The exact user query, “The Charminar in Hyderabad was built in 1591.”, returned six live
Wikipedia leads. BM25 ranked Dar-ul-Shifa 2.8995, Old City 2.8196, Gulzar Houz 2.6309,
and Charminar 1.4416. It scores title plus passage using surface tokens; vocabulary and
length/term-frequency normalization can outweigh subject identity. It has no entailment
or identity model. The optional pinned reranker moved **Charminar from fourth to first**
over identical candidate bytes, preserving all six sources. This is a paired diagnostic,
not independent accuracy. See `reports/engine2_charminar_ranking_v1.json`.

Default retrieval/BM25, the 0.65 semantic admission gate and all factual gates remain
unchanged. Reranking is explicitly opt-in, experimental relevance only. E5 was not
configured or executed in these new comparisons; earlier E5 records are preserved and
must not be described as current comparative measurements.

## Frozen external page-identity proxy

[FEVER annotations](https://fever.ai/dataset/fever.html) identify evidence pages and
sentence IDs, not relevance of today's lead extracts. Rights are the
[applicable Wikipedia terms/CC BY-SA 3.0 fallback](https://fever.ai/download/fever/license.html).
The official 19,998-row labelled shared-task development file was 4,349,935 bytes,
observed SHA-256 `e89865bfe1b4dd054e03dd57d7241a6fde24862905f31117cf0cd719f7c78df7`.
Frozen SHA ordering selected 15 development, 15 validation, 30 held-out claims, excluding
shared annotated pages, normalized duplicates and token-Jaccard ≥.8 claim variants.
All 60 provider calls were available; empty results remain in denominators. No gold
page names entered query construction or candidate pools. Source text stays ignored.

| First sample, held-out 30 | BM25 | Optional reranker |
| --- | ---: | ---: |
| Known-page Recall@1 | .3000 | .4000 |
| Recall@3 | .4000 | .4333 |
| Recall@6 | .4333 | .4333 |
| Full-list MRR | .3456 | .4167 |
| Binary known-page nDCG@6 | .3673 | .4210 |

Unlisted pages are **unjudged**, not established irrelevant. These are known-page proxy
metrics, not passage relevance or truth accuracy. A separate, labelled abstract
relevance benchmark is documented in [reranker evaluation](ENGINE2_RERANKER_EVALUATION.md).

## Negative experiments retained

`exact-subject-lead-v1` only prioritizes an exact leading subject title corroborated in
the lead, abstaining on ambiguous parenthetical title families/disambiguation leads.
No date, negation or purported official-authority bonus. It made no metric difference
on the first sample and was not adopted.

A second frozen 60-claim FEVER sample excluded the first sample's gold pages and near
claims. A single bounded legacy-query OR quoted-intitle-subject query improved validation
Recall@6 .2222→.3556 and MRR .2000→.3333. **Held-out regressed:** Recall@6 .6167→.5833,
MRR .5344→.5222, nDCG@6 .5464→.5287. Additional subject-title priority reduced held-out
MRR further to .5056. Neither query nor identity-priority variant became the default.
No further tuning on either inspected held-out sample. Research query mode remains
explicit in the evaluation API, not enabled by an environment default.

Protocols: `test/fixtures/claims/advanced_protocol.json` and
`test/fixtures/claims/retrieval_query_protocol.json`; raw sanitized results in
`reports/engine2_advanced_retrieval_reranked_v1.json` and
`reports/engine2_query_expansion_v2.json`. MRR uses the complete bounded list; nDCG is
reported at K with binary known-page labels. Recall includes annotated pages absent
from candidates. Current pages/search differ from FEVER's 2017 evidence, and exact
source/near-claim exclusion does not prove topic, claim-family or pretraining separation.
