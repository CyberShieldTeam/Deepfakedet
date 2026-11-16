# Engine 3 decision record — 2026-11-16

Starting commit `91b2b76`, feature branch `codex/integrate-figma-upgrade`. See audit, evaluation, false-positive and performance documents plus raw reports for supporting observations.

| Decision | Evidence and consequence | Alternatives rejected |
|---|---|---|
| Merge duplicate precision conservatively and retain all source declarations | Reversing duplicate imports changed retained uncertainty 1 second ↔ 1 day. Now both produce 1 day, source variants survive and recurrence is suppressed. | First-row wins, silently prefer precise metadata, discard contradictory source timestamps. |
| Isolate graph CPU in one bounded child per Express process | Dense direct work blocked parent timer ~1.87 seconds. Worker and HTTP health/busy regressions pass. Preserve algorithms and result fields. | Unbounded worker pool, async function wrapping synchronous CPU, silently increase input caps, remove baseline. |
| Add independent importer/evaluator, admit no corpus yet | Access, rights, evidence-field or label-scope gaps in all inspected candidates. Genuine unknown is reported explicitly. | IO membership as all-positive pairs, rumours as coordination, all controls as known organic, inferred timing labels, authored examples as independent ground truth. |
| Keep fixed thresholds and semantic diagnostics | E5 supports cross-language similarity but contradictions also score highly. No independent association/coordination sample exists. | Turn on semantic admission, tune hybrid weights/thresholds on authored controls, claim accuracy from lexical/semantic agreement. |
| Preserve descriptive recurrence for scheduled/organic patterns | Legitimate schedules can exhibit three separated bins. Default classification abstains and legitimate alternatives remain visible. | Hardcode government/emergency exceptions; suppress observed recurrence solely because an example is labelled legitimate by its author. |
| Publish null unsupported metrics / no intervals | No admitted independent sampling frame; pair observations are correlated. Conditional reviewed-pair evaluator and explicit campaign abstention are available. | Invent precision/F1, binomial confidence intervals over dependent pairs, promote recurrence to malicious campaign label. |
| Retain 3k cap and explicit truncation | Bounded 1k/3k matrix; 200k candidate and evidence caps reached on dense input. | Claim 10k scalability from fast input rejection; hide omitted observations; treat incomplete processing as a negative verdict. |

## Preservation and verification

No image/audio/video inference code, model weights, image decision gate, claim evidence/review logic, existing investigation files, thresholds, episode policy constants or frozen historical protocol was replaced. No fabricated classifier output was added. The new UI text only discloses retained duplicate declarations; original design and human-review language remain.

Existing Node/API tests pass, including authentication, receipts, ownership, modality isolation, report integrity and failed-store rollback. New tests cover precision/order, offset-source preservation, missing timezone/time, Unicode worker transport, invalid input, busy/deadline/interruption, slot recovery, parent responsiveness, importer rights/hash/path/split/holdout gates, uncertainty denominators and simulated embedding fallback. Expanded controls and resource/semantic runs have separate reports. Python baseline remains 68 passed/one absent-AASIST skip. See final verification record for browser/build results.

The first browser run exposed an old test assumption: classifier unavailable was incorrectly equated with all provenance measurements unavailable. Corrected the assertion to inspect actual API probability and classifier state, retaining the unavailable check when no local-image result exists. This is an assertion correction, not a skipped failure or changed application verdict. TypeScript initially found two type errors in new evaluation tools; both were corrected and checks rerun. Existing build chunk-size warning remains a warning, not a pass suppression.

## Remaining decision gate

This milestone improves correctness/reliability and prepares reproducible evaluation. It does **not** close independent Engine 3 validation or prove production readiness. Highest-value next step: obtain authorized bounded IO/control data (or documentary bounty instructions plus independently reviewed legitimate comparisons), agree on task-specific labels and blind annotation, freeze source/campaign/translation-aware development/holdout splits, then run the importer/evaluator before proposing detection changes. Rights review and data access cannot be manufactured by code. No final holdout has been opened or tuned.
