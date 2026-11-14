# Image screening — 2026-11-15

## Reproducible result

`reports/image_screening_2026-11-15.json` records raw scores, image hashes, URLs,
model revisions, runtime versions, source manifest, domain metrics and failed samples.
Images and weights remain in ignored caches. No face/image authenticity verdict is enabled.

Commands from repository root (native Windows Python environment):

```powershell
python -m ai_service.prepare_mirage --per-class-domain 10
python -m ai_service.run_screening .model-cache/mirage-screening/manifest.json --output reports/image_screening_2026-11-15.json
```

The second command returns a nonzero exit when some inputs are skipped; the report is
still saved. Nine source images exceeded the 24-million-pixel service policy. They were
retained in the denominator as skipped rather than silently replaced or resized.

## Model and data

- Whole image: `OwensLab/commfor-model-384`, revision `6076002bf0d9dd37537f965ee2f06f826c333b61`.
  Publisher declares MIT. Small ViT with one binary logit, fake=1. Strict safetensors
  loading; no pretrained-backbone download or remote code. Test preprocessing: short
  side 440, center crop 384, ImageNet normalization, sigmoid of the logit.
- Face crop: `sakshamkr1/deitfake-v2`, revision `f70338d328ba268d2b9d5c6af11044cf0b0e1400`.
  YuNet candidate regions; current VERITAS 20%-context crop policy.
- Data: `Yunncheng/Mirage-Test`, revision `820a191bb0844ae74a1bd9eb57b28268257a4053`.
  Publisher labels test-only real/generated images and declares MIT. Underlying image
  rights and individual camera/source claims were not independently audited.
- Selection: 10 genuine and 10 synthetic files in each of Animal, Human, Object, Scene;
  deterministic hash order from the first recursive API listing (up to 1000 per stratum).
  Anime excluded because it lacks a matched genuine class. This subset is bounded and
  content-stratified, not a random or population-representative benchmark.

## Whole-image results at the predeclared threshold 0.5

| Measure | Observed value |
| --- | --- |
| Requested | 80 (40 genuine, 40 synthetic) |
| Scored | 71 (31 genuine, 40 synthetic) |
| Skipped | 9 genuine images over pixel limit |
| True positives / false negatives | 3 / 37 |
| False positives / true negatives | 0 / 31 |
| Recall among scored synthetic inputs | 7.5% |
| False-positive rate among scored genuine inputs | 0/31 |
| AUROC among scored inputs | 0.575806 |
| Mean successful direct-local inference/decode time | 0.648 seconds |

Zero observed false positives on 31 genuine images is insufficient evidence for a low
deployment false-positive rate. Excluding oversized genuine inputs changes population
coverage. The measured low recall rules out promoting this checkpoint on these results.
The default whole-image selection is not changed to Community Forensics.

## Face screening

The 20 Human images carry real/generated labels, not facial-manipulation labels. Therefore
they cannot establish face-swap/edit detection accuracy. Six of ten genuine images had
usable detections; five of those six had at least one raw fake-class score above 0.5.
Nine of ten synthetic images had detected faces. This is a generalization warning, not a
face-manipulation benchmark. Source-identity independence and training overlap are unverified.

## Calibration and promotion decision

**Continue abstaining.** No temperature or real/fake threshold is fitted on test data.
All three image adapters and the face classifier remain experimental. Scores cannot
determine a local authenticity verdict. A no-face result cannot establish authenticity.

Remaining acceptance requirements: independently reviewed camera/generated and actual
manipulation datasets; source/identity-separated development, calibration and held-out test
sets; generator and compression coverage; an explicit acceptable false-positive target;
performance with uncertainty intervals and missing-input coverage; calibration on the
calibration split only; and a fresh independent test after any model/crop/threshold choice.
Phase 2a remains incomplete under those requirements; integration success does not satisfy them.

Publisher sources: [Community Forensics](https://github.com/JeongsooP/Community-Forensics),
[checkpoint](https://huggingface.co/OwensLab/commfor-model-384),
[Mirage-Test](https://huggingface.co/datasets/Yunncheng/Mirage-Test),
[DeiTFake](https://huggingface.co/sakshamkr1/deitfake-v2).
