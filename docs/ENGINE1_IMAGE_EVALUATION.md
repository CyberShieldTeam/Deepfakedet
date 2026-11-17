# Image comparison — external research sample v1

Actual cached inference: Community, Dima ViT, Organika SDXL; all remain experimental. Existing Mirage reports and reserved partitions were not reopened or altered.

Data: [OwensLab/CommunityForensics-Eval](https://huggingface.co/datasets/OwensLab/CommunityForensics-Eval), revision `7d4a74a88d2cac93b513c0853bf92c260eaceea0`. Publisher card: CC BY-NC-SA 4.0/noncommercial research and education, with underlying COCO/RAISE/FFHQ/LAION rights and attribution. This run uses COCO publisher-labelled genuine images and declared synthetic generator examples. No media redistributed. COCO's publisher label is not an audited camera-original chain of custody.

Explicitly approved acquisition: 16 SHA-verified size-eligible Parquet shards, 139,452,270 bytes; metadata inventory 2,007 rows. An isolated pinned pyarrow 26.0.1 reader was installed outside the application environment. Size/hash selection biases coverage; this is not a representative sample of the full dataset.

Frozen [protocol](../test/fixtures/engine1_image_protocol.json) SHA-256 `9b1aabcc46c0c85e8c856c0d83f304404d0b9fce43436f1f0a2ab955e9dc7cbb`: 20 genuine + 20 synthetic development, separately 20 + 20 held-out, selected before inference. Known filename, exact-prompt, encoded and decoded duplicates excluded. Training overlap, original source lineage and subject identities remain incompletely known. LAION genuine images excluded because of known Community training-distribution overlap. Tiny generator strata cannot support population claims. Semantic category, visible-face and manipulation truth annotations are absent; category-level accuracy is unavailable rather than fabricated.

Each source evaluated as original and a named offline matched sensitivity variant: centered square, Lanczos 256×256, JPEG quality95/subsampling2; the model then applies its own publisher preprocessing. Original evidence is retained; this does not change production inputs or erase earlier compression histories. Original COCO JPEG versus low-resolution generated PNG remains a possible confound. No threshold fitting: fixed diagnostic 0.5 throughout. Batch1/CPU4; 600s supervisor, minimum2GiB free memory, original10MiB/24Mpixel bounds.

Held-out results, 40 scored/zero skipped per model/variant:

| Model / variant | Accuracy | Precision | Recall | FPR | AUROC |
|---|---:|---:|---:|---:|---:|
| Community original | 95.0% | 100% | 90% | 0/20 | 1.0000 |
| Community matched | 87.5% | 100% | 75% | 0/20 | .9675 |
| Dima original | 55.0% | 53.13% | 85% | 75% | .4900 |
| Dima matched | 62.5% | 58.06% | 90% | 65% | .5375 |
| SDXL original | 50.0% | 50% | 30% | 30% | .3750 |
| SDXL matched | 55.0% | 66.67% | 20% | 10% | .5900 |

Machine-readable F1/FNR/confusion matrices, Wilson intervals, 300-replicate group bootstrap AUROC, per-generator/source metrics and individual input/tensor hashes: [Community](../reports/engine1_image_community_v1.json), [Dima](../reports/engine1_image_dima_v1.json), [SDXL](../reports/engine1_image_sdxl_v1.json). Single-class strata have undefined metrics, not zero FPR/AUROC. Source-group intervals do not solve unknown lineage dependence.

Community original confusion: TP18/FP0/TN20/FN2; matched TP15/FP0/TN20/FN5. Zero observed false positives has Wilson95% upper bound **16.11%**, far from establishing a 2% FPR. Original recall lower bound69.90%; matched53.13%. The sensitivity loss, small genuine count and incomplete independence prevent promotion despite high original accuracy. Prior negative Mirage results remain valid history.

[Actual preprocessing controls](../reports/engine1_preprocessing_controls_v1.json) used authored gradients, not accuracy labels: JPEG, PNG, lossless WEBP, EXIF orientation, opaque/transparent alpha, resized input, corrupt input400, unsupportedGIF415 and tiny-image skip. Lossless/EXIF/RGB tensors matched exactly; JPEG/resizing sensitivity recorded without declaring invariance. Alpha is discarded rather than composited; hidden RGB can influence scores. No new screenshot-specific independent accuracy benchmark was obtained.

Reproduce only with separately authorized private data and installed dependencies; output paths must be new. `python -m ai_service.prepare_media_image_evaluation plan --plan <new-plan>`; `download --plan <plan> --root <shards>`; `inventory --plan <plan> --root <shards> --output <inventory>`. Then `python -m ai_service.freeze_media_images --inventory <inventory> --shards <shards> --output <manifest>`; `python -m ai_service.evaluate_media_images --model community --manifest <manifest> --output <new-report>` (check CLI help for model argument). Never substitute reserved Mirage data.

Next scientific step: a rights-cleared, source/identity-disjoint multi-generator evaluation with camera-origin acquisition history, matched transformations, a separately fixed calibration set and substantially more genuine images. No further held-out tuning.

## Phase 2 reproducibility hardening — 2026-11-17

The separate [dataset admission audit](ENGINE1_DATASET_ADMISSION.md) reviews GenImage,
CIFAKE, Synthbuster/RAISE and FaceForensics++. None was newly admitted or downloaded:
rights, project-use scope, source grouping or task suitability remain incomplete.

The image evaluator now accepts only frozen manifest schema v2 and validates the dataset,
revision, license, protocol, partition quotas, row provenance, label/generator semantics,
source/prompt groups, exact/decoded/perceptual duplicates (63-bit pHash distance >6), safe
paths, image limits and source-byte hashes before loading a checkpoint. The freezer adds
label-basis text and perceptual hashes. This checks manifest consistency; it does not prove
that publisher labels are correct or that source identities are independent.

New reports identify each sample and preserve original, decoded, transformed-pixel and
derived-encoding hashes; the preprocessing and model-processor configurations are recorded
and hashed alongside model/checkpoint pins, raw scores, diagnostic output, timestamps and
protocol version. Aggregate metrics now include specificity and balanced accuracy, plus
deterministic source-group bootstrap intervals for defined metrics. The existing protocol,
diagnostic threshold, historical reports, and `INCONCLUSIVE` deployment policy are unchanged.

This phase did not download images or run inference: the private evaluation shards/checkpoints
and Python ML stack are absent from this checkout. No independent accuracy result or model
promotion is claimed. Source-group bootstrap uncertainty remains conditional on complete
lineage; category metrics remain undefined because the admitted data has no category labels.
