# Target-domain evaluation status and fresh NLI comparison

**No representative target-domain stance evaluation has been completed.** The new
scientific-abstract relevance benchmark does not fill that gap. Historical examples,
authored hard cases and ANLI textual labels must not be advertised as production
fact-check accuracy. No new NLI model was promoted or substituted.

## Fresh frozen ANLI R2 research comparison

[Official ANLI v1.0](https://github.com/facebookresearch/anli),
[CC BY-NC 4.0](https://github.com/facebookresearch/anli/blob/main/LICENSE), local
noncommercial research; raw passages kept ignored. Same official archive identity as
the preserved R1 run: 18,708,061 bytes, SHA-256
`e5c058f2bb4e6190b0651badca2c590e45db95248f8b28cde674615ee40820bf`.
R1 held-out examples/results were already inspected and were **not** reused as a fresh
selection test. Frozen R2 development/test sample: 60 development, 60 validation,
120 held-out, balanced classes. SHA ID order and immutable protocol preceded inference.
Excluded previous frozen premise/hypothesis hashes, normalized duplicates, shared exact
premises and near-claim token-Jaccard ≥.8 variants. All R2 development premise groups
were excluded from the selected R2 test sample. All 240 pairs executed for each model.
Original article/topic and all semantic claim-family lineage remain unknown. These
checks do not prove source or pretraining independence. Declared fine-tuning SNLI/MNLI
does not include ANLI; undisclosed training overlap remains unknown.

| R2 held-out, 120 / 40 per class | MiniLM2 | DeBERTa-v3-small |
| --- | ---: | ---: |
| Executed / skipped | 120 / 0 | 120 / 0 |
| Accuracy | 30.00% | 33.33% |
| Wilson 95% accuracy interval | 22.53–38.72% | 25.53–42.17% |
| Macro-F1 | .2894 | .3233 |
| Entailment / contradiction / neutral precision | .2424 / .3000 / .3333 | .3333 / .3333 / .3333 |
| Accepted coverage / abstention | 45.00% / 55.00% | 73.33% / 26.67% |
| Accepted accuracy | 22.22% (12/54) | 38.64% (34/88) |
| Accepted false support / non-entailment | 10/80 =12.50% | 9/80 =11.25% |
| Accepted false contradiction / non-contradiction | 10/80 =12.50% | 17/80 =21.25% |

Fixed policy max raw softmax ≥.90 and margin ≥.50; no threshold changes/fitting. Same
numerical criteria as earlier work: macro-F1 ≥.85, accepted coverage ≥.50, selective
accuracy Wilson lower ≥.95, false-support/contradiction Wilson upper ≤.05. Both failed.
Even passing would still require representative target-domain/language validation.
All class metrics, confusion matrices, false-rate denominators and intervals are in
`reports/engine2_advanced_minilm_r2_v1.json` and
`reports/engine2_advanced_deberta_r2_v1.json`. Wilson assumptions omit unknown topic
dependence. Balanced adversarial English NLI is unlike deployment prevalence.

MiniLM2 fresh startup 45.94 s, median 83.02 ms/p95 116.72 ms, peak 596,385,792 bytes.
DeBERTa startup 9.67 s, median 128.07 ms/p95 186.58 ms, peak 704,671,744 bytes.
Different OS cache/load prevents causal startup-speed claims. Supervisor deadline 600 s
per evaluation, owned-process-tree cleanup; failures/skips remain explicit.

## Authored hard-case observations

Fourteen stipulated textual controls cover dates, locations, negation, quantities,
past/current time, attribution, rumors, corrections, ambiguous inspection and injected
instructions. Both models matched 10/14 argmax expectations. This is **software
regression evidence only**, not independently annotated accuracy or retrieved historical
proof. Both failed attribution neutrality; MiniLM2 also failed rumor neutrality, while
DeBERTa failed the corrected-context control. Retained
per-pair observations take precedence over any generalization. No thresholds were tuned.
See `test/fixtures/claims/hard_cases.json` and `reports/engine2_hard_cases_*_v1.json`.

## Most valuable next dataset

Assemble rights-approved English claim/full-passage pairs with two independent reviewers
and adjudication. Include contradictions, unrelated/insufficient context, attribution,
dates/units, corrections and event-time scope. Group all same-event/source/claim-family
and translation derivatives before splitting development/validation/final held-out.
Record publisher/document identity, permissions, exact text hashes, annotation rationale,
disagreement and model-training overlap audit. Neutral means passage does not establish
the claim, not that the claim is false. Seal final labels before model/threshold selection.
Hindi/Telugu require their own sourced annotation and language-quality evaluation, not
automatic translation or transferring English scores. No labelled target-domain corpus
or factual accuracy has been fabricated to close this gate.
