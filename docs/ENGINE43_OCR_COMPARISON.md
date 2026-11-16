# Engine 4.3 OCR configuration decision

**Retain baseline by default. Automatic selection remains disabled.** Production OCR,
model configuration, verdict rules and thresholds are unchanged.

| Same-input authored development set | Baseline | Up to 2x scaling |
|---|---:|---:|
| Source images / related family | 5 / 1 | 5 / 1 |
| CER (all expected observations) | 18/283, 6.36% | 18/283, 6.36% |
| WER | 2/42, 4.76% | 2/42, 4.76% |
| Exact | 4/5 | 4/5 |
| Empty / failed / unavailable / partial / missing | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 |
| Mean subprocess wall including startup | 1.588s | 1.587s |
| Maximum sampled OCR process-tree RSS | 221.25 MiB | 197.94 MiB |

RSS is sampled every 20ms across the OCR runner and children, excludes persistent Python
preparation/web services, and is not an enforced native-memory guarantee. Different run
ordering/startup conditions preclude a memory-efficiency conclusion. Detailed startup,
OCR, preparation and candidate times remain in each observation. Resource caps did not
need increasing; one supervisor limits each subprocess to 45s/1 GiB sampled OCR-tree RSS
and Node V8 to 512 MiB, in addition to existing production worker limits.

The mixed control produces different erroneous Latin output under upscaling but equal
edit counts. More text or a COMPLETE state does not establish better OCR. Four easy
English lines cannot justify a selector, script detector or general layout rule. Font
rendering/native-script label quality lacks independent human adjudication.

No new independent comparison of rotation, contrast, grayscale, sharpening or single-line
was possible. Existing Engine 4.2 line-crop results are historical development findings
on a different dataset; see ENGINE42_EVALUATION.md. Single-line must be compared on
the same appropriate line input, never against baseline on a whole screenshot. The
current browser software check exercises singleLine on a known authored line and
baseline in production; these are functional probes, not a screenshot benchmark.

Future selector work requires an adequately sized independent development dataset and
unopened source-family holdout. Freeze non-label signals and resource budgets, compare
the same images to baseline, retain selected-profile provenance/manual override/fallback
and contradictory alternatives. Never rank by output length. No such rule is validated
or enabled in this release; no claim of scientific OCR improvement is made.
