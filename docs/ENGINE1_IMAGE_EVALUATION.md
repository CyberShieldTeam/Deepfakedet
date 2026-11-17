# Image comparison — external research sample v1

Actual cached inference: Community, Dima ViT, Organika SDXL; all remain experimental. Existing Mirage reports and reserved partitions were not reopened or altered.

Data: [OwensLab/CommunityForensics-Eval](https://huggingface.co/datasets/OwensLab/CommunityForensics-Eval), revision `7d4a74a88d2cac93b513c0853bf92c260eaceea0`. Publisher card: CC BY-NC-SA 4.0/noncommercial research and education, with underlying COCO/RAISE/FFHQ/LAION rights and attribution. This run uses COCO publisher-labelled genuine images and declared synthetic generator examples. No media redistributed. COCO's publisher label is not an audited camera-original chain of custody.

Explicitly approved acquisition: 16 SHA-verified size-eligible Parquet shards, 139,452,270 bytes; metadata inventory 2,007 rows. An isolated pinned pyarrow 26.0.1 reader was installed outside the application environment. Size/hash selection biases coverage; this is not a representative sample of the full dataset.

Frozen [protocol](../test/fixtures/engine1_image_protocol.json) SHA-256 `9b1aabcc46c0c85e8c856c0d83f304404d0b9fce43436f1f0a2ab955e9dc7cbb`: 20 genuine + 20 synthetic development, separately 20 + 20 held-out, selected before inference. Known filename, exact-prompt, encoded and decoded duplicates excluded. Training overlap, original source lineage and subject identities remain incompletely known. LAION genuine images excluded because of known Community training-distribution overlap. Tiny generator strata cannot support population claims. Semantic category, visible-face and manipulation truth annotations are absent; category-level accuracy is unavailable rather than fabricated.

Each source evaluated as original and a named offline matched sensitivity variant: centered square, Lanczos 256×256, JPEG quality95/subsampling2; the model then applies its own publisher preprocessing. Original evidence is retained; this does not change production inputs or erase earlier compression histories. Original COCO JPEG versus low-resolution generated PNG remains a possible confound. No threshold fitting: fixed diagnostic 0.5 throughout. Batch1/CPU4; 600s supervisor, minimum2GiB free memory, original10MiB/24Mpixel bounds.

Held-out results, 40 scored/zero skipped per model/variant. Specificity and balanced
accuracy below are derived at the unchanged diagnostic threshold of 0.5:

| Model / variant | Accuracy | Precision | Recall | Specificity | Balanced accuracy | FPR | AUROC |
|---|---:|---:|---:|---:|---:|---:|---:|
| Community original | 95.0% | 100% | 90% | 100% | 95.0% | 0/20 | 1.0000 |
| Community matched | 87.5% | 100% | 75% | 100% | 87.5% | 0/20 | .9675 |
| Dima original | 55.0% | 53.13% | 85% | 25% | 55.0% | 75% | .4900 |
| Dima matched | 62.5% | 58.06% | 90% | 35% | 62.5% | 65% | .5375 |
| SDXL original | 50.0% | 50% | 30% | 70% | 50.0% | 30% | .3750 |
| SDXL matched | 55.0% | 66.67% | 20% | 90% | 55.0% | 10% | .5900 |

Machine-readable F1/FNR/confusion matrices, Wilson intervals, historical 300-replicate AUROC group bootstrap, per-generator/source metrics and individual input/tensor hashes: [Community](../reports/engine1_image_community_v1.json), [Dima](../reports/engine1_image_dima_v1.json), [SDXL](../reports/engine1_image_sdxl_v1.json). Single-class strata have undefined metrics, not zero FPR/AUROC. Source-group intervals do not solve unknown lineage dependence.

## Dataset admission and evaluation safeguards

The evaluator requires the inventory JSON as a separate input and requires the caller to
provide an independently pinned SHA-256 with `--expected-inventory-sha256`. Inventory
creation records, for every potentially eligible test row in shards within the 64 MiB
uncompressed image-column budget, the relative source identity
(`data/...parquet#row=<index>`), raw file SHA-256, EXIF-oriented decoded RGB pixel SHA-256,
and source image geometry in that row before the inventory is frozen. The inventory digest
therefore covers both publisher metadata and image evidence. Freeze recomputes this evidence
from the shard and rejects disagreement before writing the manifest. Oversized shards are
kept metadata-only and their rows cannot be selected by freeze. Its canonical inventory
representation is the complete parsed inventory object serialized as UTF-8 JSON
with recursively sorted object keys, compact separators `(',', ':')`, `ensure_ascii=False`,
and `allow_nan=False`. Duplicate JSON object keys and non-finite JSON numbers are rejected.
The digest is SHA-256 over those canonical bytes, so file whitespace and object-key order do
not change it. `manifest.inventorySha256` must equal the recomputed digest, and that digest
must also equal the separately supplied pin. A well-formed digest copied only from the
manifest is not trusted.

After authorized inventory creation, compute the digest for independent review with
`python -m ai_service.prepare_media_image_evaluation inventory-digest --inventory <inventory>`.
The reviewed value must be pinned in a trusted run record outside the manifest, then supplied
to evaluation as `--inventory <inventory> --expected-inventory-sha256 <reviewed-sha256>`.
The repository does not contain a trusted digest for a real private inventory; evaluation
must stop if the operator has no independently reviewed pin. Do not compute a digest and
immediately reuse it as a trust decision without reviewing and pinning it through the
authorized data-admission process.

Every selected sample is matched back to the pinned inventory by shard and row index. The
evaluator verifies its publisher label, source dataset, image name, split, NSFW eligibility,
generator, prompt-group digest, derived source-group hash, and sample ID against that
inventory entry. The manifest's byte hash, decoded pixel hash, and geometry must also exactly
match the inventory entry; they cannot replace or override its pinned values. Evaluation
checks actual bytes and decoded pixels against the inventory evidence before model loading
and again while scoring. Duplicate publisher source identities are rejected, even if a
manifest tries to assign them different group hashes. Existing exact schema,
protocol/dataset/revision/license, role quotas, path containment, image format/dimensions,
EXIF-oriented geometry, and decoded RGB checks remain in force. These hashes establish
integrity relative to the independently pinned inventory; they do not prove an image is
genuine or establish chain of custody. These checks run for every row **before the checkpoint
is loaded**, and image files are checked again when scored.
Original files remain read-only; the matched variant is derived in memory.

The inventory authenticates publisher metadata only to the extent that its independently
pinned contents and upstream publisher records are trustworthy. Inventory label `0` is the
publisher's COCO real-source category used here as “genuine”; it is not proof of a camera
capture, original chain of custody, or absence of manipulation. Label `1` and generator
metadata are also publisher metadata, not independent forensic adjudication. A trusted
inventory pin authenticates the inventory bytes; it does not establish scientific validity.

Each output row records model ID/revision, pinned checkpoint SHA-256, preprocessing
configuration, and model-input tensor digest/shape/dtype. Metric helpers reject unknown
labels, missing scores, malformed values, non-finite scores, and scores outside `[0,1]`;
`score: null` remains the explicit failed/unscored state. Empty and single-class inputs keep
undefined rates/AUROC as null, with confusion counts reconciling to scored rows. Threshold
metrics include specificity and balanced accuracy. Benchmark summaries require unique,
well-formed sample IDs and explicit well-formed source-group IDs; no sample-level fallback
is used for group intervals. The evaluator emits 1,000 deterministic source-group
percentile-bootstrap replicates for accuracy, precision, recall, specificity,
balanced accuracy, FPR, FNR, and AUROC, alongside valid-replicate counts. The historical
`auroc_ci95_group_bootstrap` field name and interval shape remain available; new runs use the
same 1,000-replicate interval as the expanded field. Previously checked-in reports retain
their historical 300-replicate values and were not rewritten. Intervals describe resampling
of recorded groups, are conditional on scored observations and valid class-containing
replicates, and do not establish independent source identity or training-data separation.
Groups must represent the intended independent resampling unit. The percentile intervals
are conditional on these recorded group assignments; incorrect or incomplete group metadata
can still make them statistically misleading.

`ai_service.test_media_image_evaluation` exercises inventory pinning, row-to-inventory
binding, symlink/path rejection, and pre-load rejection with generated test pixels and
metadata. Those fixtures are structural software controls, not research samples or accuracy
evidence. Metric unit tests cover invalid values, empty input, and single-class behavior.

Community original confusion: TP18/FP0/TN20/FN2; matched TP15/FP0/TN20/FN5. Zero observed false positives has Wilson95% upper bound **16.11%**, far from establishing a 2% FPR. Original recall lower bound69.90%; matched53.13%. The sensitivity loss, small genuine count and incomplete independence prevent promotion despite high original accuracy. Prior negative Mirage results remain valid history.

[Actual preprocessing controls](../reports/engine1_preprocessing_controls_v1.json) used authored gradients, not accuracy labels: JPEG, PNG, lossless WEBP, EXIF orientation, opaque/transparent alpha, resized input, corrupt input400, unsupportedGIF415 and tiny-image skip. Lossless/EXIF/RGB tensors matched exactly; JPEG/resizing sensitivity recorded without declaring invariance. Alpha is discarded rather than composited; hidden RGB can influence scores. No new screenshot-specific independent accuracy benchmark was obtained.

Reproduce only with separately authorized private data and installed dependencies; output paths must be new. `python -m ai_service.prepare_media_image_evaluation plan --plan <new-plan>`; `download --plan <plan> --root <shards>`; `inventory --plan <plan> --root <shards> --output <inventory>`. Then `python -m ai_service.freeze_media_images --inventory <inventory> --shards <shards> --output <manifest>`. Independently review and pin `python -m ai_service.prepare_media_image_evaluation inventory-digest --inventory <inventory>`, then run `python -m ai_service.evaluate_media_images --model community --manifest <manifest> --inventory <inventory> --expected-inventory-sha256 <reviewed-sha256> --output <new-report>`. Never substitute reserved Mirage data.

Next scientific step: a rights-cleared, source/identity-disjoint multi-generator evaluation with camera-origin acquisition history, matched transformations, a separately fixed calibration set and substantially more genuine images. No further held-out tuning.
