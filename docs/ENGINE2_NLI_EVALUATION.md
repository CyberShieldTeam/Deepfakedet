# External NLI evaluation and rejection

**Decision: no authoritative promotion.** MiniLM2 failed the criteria frozen before
inference in `test/fixtures/claims/nli_protocol.json`. No thresholds were fitted or
relaxed afterward. Charminar diagnostics are separate software examples, not validation.

## Dataset, rights and split integrity

Official [ANLI v1.0](https://github.com/facebookresearch/anli) round 1 development/test,
18,708,061-byte versioned archive, observed SHA-256
`e5c058f2bb4e6190b0651badca2c590e45db95248f8b28cde674615ee40820bf`.
This is a locally recorded download identity, not a publisher-provided checksum.
[Publisher license](https://github.com/facebookresearch/anli/blob/main/LICENSE):
CC BY-NC 4.0. Used for this noncommercial research evaluation; source passages/reasons
are kept in ignored local files, not redistributed in this repository.

ANLI uses adversarial human-authored hypotheses with human verification labels. It is
an external NLI benchmark outside the checkpoint's declared SNLI/MultiNLI fine-tuning
sets. Undisclosed training overlap and backbone pretraining overlap remain unknown;
this is not proof of complete training/source independence or a target-domain fact-check
benchmark. Unique exact premises do not establish disjoint entities/articles/topics.

Frozen SHA-256 ID ordering, one pair per exact normalized premise, class quotas:
**120 development (40/class)** and **300 held-out (100/class)**. Test premises occurring
anywhere in development were excluded; IDs/pair hashes/group overlap checked before
loading/scoring. The preparation scan recorded 189 premise-overlap and 49 duplicate
candidate rejections; these are scan events, not failures among the selected 420.
No fitting/model changes occurred between split evaluation. Outputs include IDs, hashes,
labels, raw scores and failures; they exclude dataset source text.

## Predeclared policy and results

Research suggestions require maximum raw softmax ≥0.90 and margin ≥0.50. These are
uncalibrated scores. All other outputs abstain; no truth probability is produced.
Numerical research gates: macro-F1 ≥0.85; accepted false-support and false-contradiction
Wilson 95% upper limits ≤5%; accepted coverage ≥50%; accepted accuracy Wilson lower
limit ≥95%. Independent target-domain/multilingual work and human review remain required
even if those numeric gates pass.

| Metric | Development, 120 | Held-out, 300 |
| --- | --- | --- |
| Executed / skipped | 120 / 0 | 300 / 0 |
| Three-class accuracy | 35.83% | 32.33% (Wilson 95% 27.29–37.82%) |
| Macro-F1 | .3524 | .3184 |
| Accepted coverage / abstention | 35% / 65% | 44% / 56% |
| Accepted accuracy | 30.95% | 27.27% (Wilson 95% 20.40–35.43%) |
| Accepted false support / non-entailment gold | 5/80 | 24/200 = 12% (upper 17.23%) |
| Accepted false contradiction / non-contradiction gold | 10/80 | 30/200 = 15% (upper 20.61%) |

Held-out class order: contradiction, entailment, neutral. Confusion matrix rows are gold,
columns argmax: `[[28,31,41],[27,25,48],[37,19,44]]`.
Precision/recall: contradiction .3043/.28; entailment .3333/.25; neutral .3308/.44.
Unfiltered argmax false-support rate 50/200 =25%; false-contradiction 64/200 =32%.
Among accepted support suggestions, 24/34 were wrong; accepted contradictions 30/37.
High softmax did not reliably indicate correctness on this adversarial sample.

Intervals assume independent pairs and omit selection/source-dependence uncertainty.
Class balancing and adversarial sampling are unlike deployment prevalence; precision
and these error rates must not be advertised as real-world verification accuracy.
Complete per-class metrics/denominators and observations are in
`reports/engine2_nli_anli_v1.json`. Confusion/three-class accuracy use executed pairs;
all-selected coverage and accuracy include nonexecuted inputs. None skipped here.
No real-world factual accuracy, multilingual accuracy or calibrated confidence claim.

## Runtime and reproduction

CPU run: startup 59.42 s including verification/import/load; 420-pair median 144.93 ms,
p95 194.04 ms, mean 141.21 ms; process peak working set 609,075,200 bytes (~580.9 MiB).
Later persistent-worker startup was ~20.84 s on warmed OS caches; this is not a controlled
optimization claim. Three simple authored premise/hypothesis sanity pairs produced
expected E/C/N labels, checking order/mapping without overturning the external failure.

```powershell
.\.venv-win\Scripts\python.exe -m ai_service.download_nli --output .model-cache/nli-minilm2
.\.venv-win\Scripts\python.exe -m ai_service.prepare_nli_evaluation --output .model-cache/engine2-nli/new-frozen.json
.\.venv-win\Scripts\python.exe -m ai_service.evaluate_nli --manifest .model-cache/engine2-nli/new-frozen.json --snapshot .model-cache/nli-minilm2 --output reports/new-nli-evaluation.json
```

Download/preparation/evaluation refuse existing invalid snapshots or output overwrites.
The benchmark CLI now supervises a fixed finite sample with a 600-second deadline and
owned-process-tree termination; an authored timeout control tests that mechanism. The
original recorded scoring run completed before this wrapper was added; its results were
not rescored or changed. Production request deadlines are enforced by the Node supervisor.
Use isolated resources and retain failed runs. Do not use the
held-out observations to tune another threshold and then call the same split independent.
