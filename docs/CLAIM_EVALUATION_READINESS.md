# Engine 2 evaluation readiness — 2026-11-15

No independent claim/evidence corpus is admitted in this milestone. Public authoritative
dataset metadata were researched; no restricted data or sealed evaluation split was
downloaded, scored or requested. Permissive adjacent data are distinguished from datasets
that actually supply retrieval/verification labels. Current reports remain software controls.

## Dataset review

| Dataset and authoritative source | Rights/access and annotations | Suitability and admission status |
|---|---|---|
| [FEVER](https://fever.ai/dataset/fever.html), [terms](https://fever.ai/download/fever/license.html) | Public English claim annotations, human supported/refuted/not-enough-info labels and Wikipedia evidence sentence IDs. Applicable Wikipedia article terms; fallback CC-BY-SA 3.0 where unavailable. | Conditional eligible English candidate, not admitted: matching historical Wikipedia passage corpus/version, attribution and source/topic-disjoint audit not curated locally. Annotation files alone are not a complete retrieval corpus. Claim alterations are not independent real-world natural claims. |
| [AVeriTeC](https://fever.ai/dataset/averitec.html) | Official page links CC-BY-NC 4.0; real-world claims, source metadata, human question/answer evidence and supported/refuted/insufficient/conflicting labels. Public train/dev plus evidence collections; blind test separate. | Conditional noncommercial English candidate, not admitted: intended use/source rights, exact evidence snapshots, claim/source/time lineage and split audit pending. Article accessibility and incomplete evidence collections can affect retrieval. No Hindi/Telugu coverage claimed. |
| [X-FACT author data card](https://huggingface.co/datasets/utahnlp/x-fact/raw/main/README.md), [paper](https://aclanthology.org/2021.acl-short.86/) | Authors declare MIT; 25 languages including Hindi, excluding English/Telugu in the listed release. Expert publisher veracity labels and search-derived evidence; out-of-domain/zero-shot splits. | Hindi candidate, not admitted: publisher rating normalization is not passage agreement or complete relevance judgments. Upstream evidence/source rights, snapshot attribution, duplicates and source separation require audit. Do not label all returned search snippets relevant, or use seven-class veracity as passage entailment. |
| [IndicClaimBuster author repository](https://github.com/pritampal98/indic-claim-buster), [paper](https://aclanthology.org/2025.ijcnlp-long.133/) | English/Hindi/Bengali/Hindi-English code-mix. Author repository says password-protected, research/academic access form. Paper describes two LLM-generated evidence items plus one manually curated item per claim, and generated refuted claims. No blanket license verified. | Blocked pending approved access and exact terms; no form submitted. Generated evidence/refutations must be separated from independent evidence and labels. Translations/source variants must share a split. No Telugu coverage claimed. |
| [IndicLink](https://github.com/google-research-datasets/IndicLink) | Explicit Google CC-BY 4.0 grant. Public English/Hindi/Telugu and other languages; professional translations of WebRED test sentences, linked Wikidata triples. Intended as an MFL test set. | Legally permissive **adjacent fact-linking** candidate, not a claim-verification corpus. KG links are not support/refute/conflict labels or paragraph-retrieval grades. English originals and translations are one lineage, not independent observations. Do not repurpose it as a tuned development holdout or invent verification labels. |
| [MultiClaim v2](https://zenodo.org/records/15413169), [paper](https://aclanthology.org/2023.emnlp-main.1027/) | Author record: restricted, noncommercial research access. Post-to-fact-check mappings and machine translations; full article bodies deliberately absent. Code repository GPL does not grant article/data access. | Blocked pending authorized access/exact terms. Useful potential cross-language claim-matching labels, not article entailment. Translation/original, same-event posts and repeated URLs must share lineage. Per-language Hindi/Telugu counts not verified locally; no coverage assertion. |

Publicly downloadable does not mean automatically admitted. FEVER and IndicLink have
verified rights statements; neither has been falsely marked license-unavailable. Their
current blockers are corpus/task compatibility and audited local evidence, not a blanket
permission requirement. No reviewed independent corpus meeting this engine's source,
language and annotation gates is locally available. Existing Google API credentials are
still unavailable; no live retrieval success is claimed.

## Admission protocol for the next independent run

Record exact dataset release/URL, license and intended-use review, passage capture/version,
SHA-256, original source IDs, annotation provenance and topic/claim/translation lineage.
Group originals, translations, mirrors and derivatives before splitting. Deduplicate exact
and near-duplicate claims/passages; check canonical source URLs and event/time overlap.
Training exposure of the pretrained embedding model is not known; disclose that limitation.
Never inspect final/reserved data while selecting thresholds or preprocessing.

The existing hash-bound operator corpus is a retrieval source, **not** an independent
evaluation approval registry. `validateEvaluationGroups` adds tested translation/source/
content-hash split checks and refuses reserved roles; it is not legal certification,
near-duplicate detection or a complete dataset importer. No independent manifest is
fabricated in this slice. Future import must bind the saved rights/annotation evidence
and dataset version before scoring, not merely set a boolean approval flag.

Freeze the candidate pool and independently judged relevance sets before comparing
BM25, E5-only and hybrid. Use identical pool/filter/K and fixed model/preprocessing.
Unknown relevance is unjudged, not a negative. Measure Recall@K, Precision@K, MRR;
nDCG only with explicit relevance grades. `test/claimRetrievalMetrics.ts` provides tested
math and rejects unjudged returned IDs/duplicates. Precision uses K as denominator even
when fewer than K results survive the gate; MRR uses the returned ranking. No-positive
queries have null recall/MRR; binary fixtures do not authorize graded nDCG.

Report per-language and cross-language results, source groups, query/document counts,
coverage and failure/truncation denominators. Translated claims do not increase independent
sample count. Agreement evaluation needs separate human passage-level labels and source
context; relevance labels, publisher ratings and fictional controls do not supply these.
Evaluate support, contradiction, conflict, insufficiency and unavailability as separate
behaviors, with abstention/coverage and errors, not an invented factual confidence score.

## Current software comparison

`reports/claim_readiness_controls_v2.json`: same nine authored fictional queries, three
translated topics; each of BM25, E5-only and hybrid runs twice (54 executions, not 54
independent queries). Same .65 semantic candidate gate, .5/.5 hybrid weights, token/batch/
CPU configuration and K=1/3; no fitting. E5-only is an evaluation method, not a changed
production default. BM25 remains the unavailable-embedding fallback.

On the nine unique queries, Recall@1 / Precision@1 / MRR: BM25 **6/9**, E5-only **9/9**,
hybrid **9/9**. Each language has three queries; the cross-language subset is BM25 0/3
versus E5/hybrid 3/3. Recall@3, Precision@3 and exact rankings are in the raw report.
Negation/date/location queries label topic relevance only; high retrieval relevance does
not establish agreement. Graded nDCG and factual/entailment accuracy remain **null**.
Software agreement/status tests cover all five statuses, numerical differences, locations,
Hindi/Telugu negation and mixed/ambiguous scripts without issuing automatic verdicts.

Warm method order is fixed and shared cache is disclosed; hybrid can reuse E5's vectors.
Timing differences are not evidence that one retrieval method is intrinsically faster.
Independent multilingual retrieval and factual verification performance remain unmeasured.
