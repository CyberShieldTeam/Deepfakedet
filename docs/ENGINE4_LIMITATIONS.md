# Engine 4 limits and scientific decision gate

Implemented: deterministic, case-scoped adaptation of attached engine results; submitted
byte identity; conservative URL equality; literal claim mentions; existing attributed
source reviews; explicit analyst caption/description/media-URL assertions; imported
account/tag/episode relationships; contradiction preservation; uncertainty-aware timeline;
owned persistence, stale/failed-run safeguards, bounded UI/report/JSON and worker controls.

Not implemented or enabled: automatic OCR/transcription/caption extraction, perceptual
media matching, external publication verification, approximate/semantic claim matching,
topic equivalence, inferred temporal causality, calibrated relation confidence, automated
misinformation/intent/campaign verdicts, cross-case entity resolution, graph database,
deployment-wide concurrency control. These are future work, not silently simulated.

An analyst assertion is attributed but not independently true. A media URL may point to
different content over time. Server SHA256 establishes the bytes submitted, which may
be a resized analysis image; it does not establish a camera original. Client hashes are
not server validation. URL fragment removal/host normalization can join addresses without
proving document versions; query/redirect aliases are intentionally not reconciled. A
literal claim mention can be a quotation or denial. Similar topics, hashtags and timing
do not establish agreement, coordination or malicious intent. Source credibility remains
outside automatic correlation even after a quote/context review.

Case/account identifiers are scoped to stored/imported evidence, not independently
verified global entities. Only the current attached Engine 3 result is available in the
existing schema; Engine 4 does not invent an archive of overwritten historical network
imports. Old results lacking post ledgers or server byte hashes expose that missingness.
Uncertain/unsupported dates are retained without manufacturing UTC publication times.
Timeline order is descriptive. Analysis/case creation time is not publication time.

Adapters and graph/time/byte/comparison caps can omit evidence. Missing coverage never
proves silence; graph completeness does not certify observation completeness. The full
source records remain in the case. Output/deadline/heap failures preserve the previous
saved graph with a failed run marker; stale graphs are not shown as current findings.
AtomicRepository remains a single-process JSON store; multi-server deployment requires
transactional storage and shared admission limits before claiming production reliability.
Worker JS limits and sampled RSS supervision are not total OS memory guarantees. Main
process projection/serialization and large stored investigations still need broader load
testing. Context/graph text is owned investigation evidence, not a public analytics feed.

Validation separates:

1. Verified engineering controls: exact rules, stable references, scope isolation,
   timestamp handling, preservation, limits, API/disk/report agreement and actual UI flows.
2. Exploratory observations: existing Engine 3 associations and analyst-supplied context.
   They are inspectable evidence, not independent detection labels.
3. Unvalidated scientific claims: real-world misinformation precision/recall, malicious
   campaign detection, semantic/perceptual equivalence and calibrated confidence. No such
   metrics or overall misinformation percentage are reported.

Highest-value next step: assemble a rights-approved, independently annotated set of
cross-media claim/source/post relationships, including quotation, negation, URL-version
changes and unrelated controls. Keep development and held-out cases/source lineages
separate. Evaluate reference accuracy and omission/error burden before enabling any
approximate matcher or automatic extraction binding. Also expand adversarial/concurrent
load testing and transactional persistence before scaling beyond the present service.
