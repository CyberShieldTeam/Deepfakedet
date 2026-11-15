# Image evaluation dataset readiness

Updated 2026-11-15. This is an acquisition and approval record, not an accuracy report.

Integration update: the local six-generator Mirage development experiments and sealed
96-image reserve are preserved in the benchmark reports. They are exploratory and do
not meet verified source/identity independence requirements; resolution/compression
confounds remain documented in `docs/ADVANCED_IMAGE_MODEL_EVALUATION.md`. The five smoke
items below are the remote gated harness's admitted diagnostics, not the only historical
experiments. Neither reserve nor earlier benchmarks was rerun during reconciliation.
Temporal transport/control fixtures are described in `docs/TEMPORAL_DIAGNOSTICS.md`;
their generated changes and resource measurements are not deepfake ground truth.

## Admission rules

An evaluation row is admitted only when the file is locally present, its SHA-256 matches, the source and license are recorded, and the label has a documented basis. `group` must identify the underlying subject/source lineage (not merely the filename), and a group or identical file hash may occur in only one split. Crops, recompressions, frames, or manipulated derivatives of one source stay in the same group. Unknown or inferred labels are excluded rather than relabeled.

The holdout gate requires at least 20 items and five independent groups per class. Passing that minimum permits metric calculation; it does not by itself establish representativeness. Planned reporting also requires generator/manipulation diversity, capture-device and compression coverage, subgroup sample disclosure, and robustness variants derived only within the parent item's split.

## Current admitted data

`test/fixtures/eval/smoke_manifest.json` contains four licensed Wikimedia camera photographs and one internally generated synthetic screenshot. These five files are smoke diagnostics only. The class balance, source diversity, and group counts are insufficient for a benchmark. No facial-manipulation evaluation rows are currently admitted.

## Candidate sources and blockers

| Task | Candidate | Official source | Current status | Blocker / limitation |
|---|---|---|---|---|
| General image | GenImage | https://github.com/GenImage-Dataset/GenImage | Not admitted | The official repository describes the benchmark and download layout but does not provide a dataset-wide license grant. Its real class is collected from ImageNet and generator subsets have distinct upstream terms. Legal approval and per-subset provenance review are required before download or manifest creation. |
| Face manipulation | FaceForensics++ | https://github.com/ondyari/FaceForensics | Not admitted | Access requires application/acceptance of the dataset terms; use is restricted to non-commercial research and education. No authorized dataset copy or accepted terms are present in this workspace. |
| Face manipulation | OpenForensics | https://sites.google.com/view/ltnghia/research/openforensics | Not admitted | The paper describes labels and splits, but an authoritative redistribution/license grant has not been verified in this workspace. |

These candidates must not be copied from unofficial mirrors to bypass access terms. Dataset acquisition is blocked pending the repository owner's intended-use decision, acceptance where required, storage approval, and verification of the exact applicable license/terms. Consequently, no representative manifest or checkpoint benchmark is claimed in this slice.

## Acquisition checklist

1. Save the official terms/license and dataset version or release identifier alongside the private dataset root.
2. Record the original source identifier, generator/manipulation method, subject/source lineage, and label basis before assigning a split.
3. Deduplicate exact hashes and near-duplicate/source derivatives; assign groups before sampling splits.
4. Freeze the manifest, compute every file SHA-256, and review label/license exceptions manually.
5. Keep validation and holdout sealed. Threshold selection and calibration use validation only; final metrics use holdout once.
6. Publish aggregate results and permitted examples only; do not commit restricted dataset files or manifests containing sensitive personal data.

The machine-readable required fields are defined in `test/fixtures/eval/manifest.schema.json`.
