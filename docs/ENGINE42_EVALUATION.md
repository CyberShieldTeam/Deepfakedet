# Engine 4.2 evaluation and dataset admission

## Dataset research (2026-11-16)

| Candidate / primary publisher | Rights/access / ground truth | Decision |
|---|---|---|
| [HierText](https://github.com/google-research-datasets/hiertext) | Publisher states CC BY-SA 4.0; JSON word/line/paragraph transcriptions and polygons. Images from Open Images; individual author/license/landing-page metadata retained. | Admit a small **development-only** local subset; no image redistribution. |
| [WIRIndic / IIIT](https://ilocr.iiit.ac.in/icpr_2024_wirindic/dataset.html) | Academic/research use stated; Hindi/Telugu PNG word crops and Unicode label files, validation labels available; public test labels differ. Commercial redistribution not established by that statement. | Relevant future native-script research; not downloaded/admitted this task. Not screenshot/claim ground truth. |
| [ICDAR incidental scene text](https://rrc.cvc.uab.es/files/short_rrc_2015.pdf) | Publisher describes quadrilateral word boxes, Unicode transcription and care/do-not-care labels, focused on Latin scripts. General paper availability alone is not a complete reuse/redistribution review. | Deferred pending explicit release/access terms and task-specific mapping. |
| [DocVQA](https://site.docvqa.org/datasets/docvqa) | Document images and manually annotated QA spans, downloaded through challenge portal. QA answers are not exhaustive independent page transcription. | Not admitted for full-page CER/WER; image rights and transcription protocol need separate review. |

HierText validation image archive HEAD: 577,088,394 bytes; not downloaded. Instead,
`python -m ai_service.admit_hiertext_sample` downloaded 29,578,125 bytes: official
annotation gzip (12,274,736 bytes), attribution CSV, six image sources. Pinned annotation
Git blob `45df5394a71b03dc448771f51d7a9830f15b2658`; full SHA-256 in frozen manifest.
An initial whole-JSON inflation exceeded 128 MiB; import stopped. Streaming parsing keeps
the same 128 MiB decompression limit, ≤4 MiB record buffer and ≤40 MiB download budget.
No oversized archive or resource limit bypass was used.

Admission requires exact publisher annotation blob, per-image CC BY 2.0 author/license/
landing-page metadata, fixed image IDs, dimensions and hashes. The reproducible selection
is the first six qualifying sources in publisher file order, up to two legible, printed,
nonvertical, approximately horizontal ASCII lines per source. Nine lines qualified.
Selection/exclusions were fixed before predictions. Sources are resized to publisher
annotation dimensions and cropped to line envelopes with a small margin. Every operation,
original dimensions, source/crop hashes, original vertices and author attribution is saved.
Media and full downloaded annotations remain ignored under `.model-cache/engine42-hiertext`.
`reports/engine42_hiertext_manifest.json` freezes attribution/protocol and crop identities.

Important: `language=eng` in these manifests/results means the **requested OCR pack**,
not independently annotated source language. The ASCII gate identifies a narrow Latin
script stratum, not English. Visual audit includes Spanish signage and typography/spacing
normalizations in publisher labels. Crops align with source text, but labels were not
re-adjudicated or changed to fit predictions. Adjacent text/crop context and lower served
source resolution can affect results. These are scores against published strings on
derived line crops, not validated English-language or full-screenshot accuracy.

## Actual small independent development results

Nine line crops, **six correlated source images**, same fixed English model:

| Explicit configuration | CER | WER | Exact lines | No text on annotated lines |
|---|---:|---:|---:|---:|
| Baseline AUTO | 0.5333 | 0.7273 | 1/9 | 4/9 |
| Up to 2× scaling | 0.3185 | 0.5455 | 2/9 | 2/9 |
| Contrast | 0.5481 | 0.7727 | 1/9 | 4/9 |
| Explicit SINGLE_LINE, separate layout probe | 0.1111 | 0.3636 | 3/9 | 0/9 |

No technical failures or capped partial outputs in these passes. There were no independent
no-text, Hindi, Telugu, blur or rotation strata, and no held-out evaluation. Exact match
keeps case/punctuation; CER/WER use NFC and remove terminal OCR newlines. Error totals are
micro-aggregated against publisher strings; empty OCR on annotated text remains an error.
No confidence interval/generalization claim: nine crops are not nine independent source
units, model-training overlap is unknown, source language is unadjudicated, and this small
development sample was used to investigate layout. No automatic selector was validated.

Artifacts: `engine42_independent_development.json`, `engine42_layout_probe.json`,
`engine42_evaluation_summary.json` under reports. Authored controls are separately marked
`authored_controls` in `engine42_authored_experiments.json`; never pooled with this sample.

## Reproducible interface and next annotation protocol

`python -m ai_service.ocr_evaluation manifest.json --output fresh-report.json`:
- Local relative source paths only, realpath containment, ≤2 MiB manifest, original byte
  SHA equality, ≤10 MiB/24M pixel image guard. No URL hydration or model downloads.
- Version 2 manifest requires declared scope, publisher/version/source, rights/permission,
  annotation provenance/protocol and approval attribution. These are inspectable operator
  declarations, not an automatic legal or annotation-validity guarantee.
- Requires unique IDs/byte hashes, source groups and train/development roles. Rejects
  group/byte leakage and cross-split 8×8 average-hash distance ≤4. Near-hash screening is
  not proof of uniqueness; flagged material needs manual lineage adjudication. Test-set
  inputs are locked **before source pixels open**; no final holdout tuning.
- At most 50 observations, 8 selected profiles and 100 OCR passes/release. All baseline
  passes precede alternatives. Training rows are lineage controls, not evaluated.
- Metrics stratify recognition configuration, quality, rotation, resolution, density and
  source category. Failed/unavailable outputs are counted separately; missing eligible
  ground truth yields null. No-text references have separate behavior counts.

Next independent screenshot release should use original licensed pixels; source/document/
near-duplicate groups fixed before splitting; native source-language labels; clear, blur,
rotation, low-resolution, density and no-text strata; two blinded transcribers plus separate
adjudication of punctuation/reading order/illegibility. Freeze normalization/exclusions and
default/alternative choices on development data before opening a separate final holdout.
Keep transcription, candidate claim quality, reviewer agreement and graph correctness
separate; 4.1's existing evaluation interface remains available for the latter tasks.
