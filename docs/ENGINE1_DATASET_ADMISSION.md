# Engine 1 independent image dataset admission audit — 2026-11-17

## Decision

No new images were downloaded or admitted, and no model was run. Public availability is
not proof that every underlying image is cleared for this project's use, nor that labels,
source groups, and preprocessing make a defensible independent evaluation. The existing
CommunityForensics-Eval results remain historical exploratory evidence; their known
lineage and encoding limitations are described in
[the external image evaluation](ENGINE1_IMAGE_EVALUATION.md).

## Candidate review

| Candidate | Publisher scope and labels | Terms/access evidence | Evaluation fit and unresolved issues | Decision |
|---|---|---|---|---|
| [GenImage](https://github.com/GenImage-Dataset/GenImage), with [Harvard Dataverse v2](https://doi.org/10.7910/DVN/AKDIHF) | Official benchmark describes over one million generated/real pairs, 1,000 ImageNet classes, and Midjourney, Stable Diffusion variants, ADM, GLIDE, Wukong, VQDM and BigGAN. Real images are collected from ImageNet; train/val folders and a public metadata CSV are published. | Harvard Dataverse lists the deposited v2 record as CC0 and public. The upstream benchmark repository describes public download locations but does not itself state a dataset license. A repository/record-level CC0 declaration cannot by itself resolve the provenance and upstream terms of embedded ImageNet files. | Broad generator coverage and metadata make this a useful audit candidate. The published class split is not source/identity-disjoint evidence; exact image/derivation relations, deduplication, model training overlap, and matched encoding need to be independently checked. ImageNet origin is not camera-capture provenance. A newer bias study specifically constructs a 5k/5k “unbiased GenImage” subset to reduce format bias; this confirms that the original benchmark needs encoding controls before use. | Do not acquire until upstream image rights and a groupable, deduplicated subset are verified. Consider metadata-only inspection after rights review. |
| [CIFAKE](https://arxiv.org/abs/2303.14126) | The paper describes 120,000 items: 60,000 CIFAR-10 images and 60,000 generated with latent diffusion, across ten CIFAR-10 subject classes. The real images are 32×32; generated images are class-aligned examples, not a documented camera-source-paired manipulation set. | The paper links to a Kaggle-hosted archive. The paper's publication license is not a dataset license; an applicable image-level redistribution/use grant was not established from the reviewed publisher material. CIFAR-10's upstream terms also need to be checked for any selected material. | One generator and very low resolution do not cover the current high-resolution detector task. The paper's own Grad-CAM discussion reports that its model used small background imperfections, making class/dataset cues a direct concern. It is not an independent modern generator evaluation or a manipulation-localization dataset. | Not suitable for the primary evaluation; no download. |
| [Synthbuster](https://github.com/qbammey/synthbuster) and the publisher's [download script](https://github.com/grip-unina/ClipBased-SyntheticImageDetection/blob/main/data/synthbuster_download.sh) | 9,000 generated samples (1,000 each from nine diffusion systems) and a 1,000-image RAISE reference set are described in the published benchmark. Synthetic images are generated from captions extracted from real images, so any available source/caption pairing must be kept in one partition. | The dataset download script states non-commercial use only. The official [RAISE terms](https://loki.disi.unitn.it/RAISE/download.html) also restrict use to non-commercial research and education and provide download forms. This project's permitted use under both terms has not been confirmed. | Better diversity and real high-resolution camera-native source images than CIFAKE, but still older generator coverage. The underlying RAISE acquisition uses four photographers and a limited camera set; photographer/source groups and synthetic prompt ancestry must be inspected and split together. Not a social-media-transformation benchmark. | Strong conditional candidate for a future non-commercial research slice, but not admitted until project-use authorization and source/prompt grouping are verified. No download. |
| [FaceForensics++](https://github.com/ondyari/FaceForensics) | Face manipulation data for DeepFakes, Face2Face, FaceSwap and NeuralTextures; appropriate only for a separate face-manipulation task, not general AI-image generation. | Access requires application and acceptance of the publisher's [Terms of Use](https://kaldir.vc.in.tum.de/faceforensics/webpage/FaceForensics_TOS.pdf), which limit use to non-commercial research/education. | Videos and extracted frames must stay grouped by source identity/video. A face-crop classifier must match a specifically declared manipulation type and crop protocol. This does not supply broad whole-image generation labels. | Not admitted without approved access and a face-manipulation-specific protocol. No download. |

Primary publisher materials reviewed on 2026-11-17. License terms and access controls must be reviewed again before a future acquisition. Dataset-level labels describe the publisher's annotation; they do not independently establish camera origin, subject identity, or complete manipulation history.

## Admission requirements before any acquisition

1. Preserve the exact publisher version, dataset access terms, upstream-image terms, source citation, and written permission or accepted access record.
2. Define the intended task (whole-image generation, localized edit, face swap, or another manipulation) and admit only labels that support it.
3. Establish sample-level source, identity, original-image, prompt, and generator relations. Assign all related samples to the same split before model inference.
4. Verify archive and per-image hashes. Remove exact-byte, decoded-pixel, and near-duplicate samples across the entire evaluation manifest.
5. Freeze a new development/validation/held-out protocol, sample counts, generator/category strata, encoding controls, and metrics before inference. No held-out threshold selection.
6. Keep original inputs immutable. Store each transform as a separately hashed derived input and retain the exact transform parameters and model/checkpoint identity.
7. Do not commit restricted media, private per-image manifests, personal data, or model caches.

## Engineering changes in this phase

The external image evaluation now requires manifest schema v2 and validates the pinned dataset,
revision, license, protocol hash, admission-policy hash, sample schema, publisher label basis,
generator/task labels, partition quotas, sample/source/prompt uniqueness, POSIX-relative image
paths, byte/geometry limits, source-byte SHA-256, decoded RGB hash, and stored perceptual hash
before model loading. It rejects perceptual-hash matches at Hamming distance 6 or less. The
freezer records publisher-label basis and perceptual hashes; these checks do not establish
identity independence. The hash-distance and image-bound policy is included in each manifest
so an evaluation cannot silently inherit a different admission rule. A 6-bit pHash radius is
an operational near-duplicate filter, not a validated semantic or identity test; visually
similar but distinct images may be excluded and unrelated subjects may still pass.

Every new inference row records sample/dataset IDs, publisher source, label basis, partition,
original and derived hashes, preprocessing profile/hash, checkpoint identity/hash, raw score,
diagnostic threshold class, model tensor fingerprint, and inference timestamp. Reports record
the protocol version, preprocessing definition/hash, runtime environment, startup, latency,
and measured memory. The fixed protocol and threshold are unchanged; the existing frozen
reports are not rewritten.

Metric summaries now include specificity and balanced accuracy as well as the prior metrics,
with deterministic source-group bootstrap intervals for defined metrics and valid replicate
counts per metric. Wilson intervals are retained for comparability. These intervals still depend on the completeness of source groups;
they cannot repair unknown subject/source lineage or selection bias. Category accuracy remains
unavailable because the admitted manifest does not contain independently reviewed categories.

No model was promoted. Production classifications remain `INCONCLUSIVE` where evaluation is
insufficient or unavailable.
