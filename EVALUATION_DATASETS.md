# Image and video evaluation dataset readiness

## Engine 3 episode controls — 2026-11-15

Ten project-authored scenarios in `test/fixtures/campaign/episodeControls.ts` cover public
health/emergency/news/sports sharing, repeated official bulletins, popular URLs, syndication,
scheduled organizations, independent users and repeated separated patterns. Expected
observations were specified before the comparison; contexts and IDs are fictional.
The 3,000-post resource scenarios are also authored controls, not real account captures.
No independently labeled campaign/event/account corpus is admitted, so no precision,
recall, F1, AUROC or maliciousness probability is calculated. Future evaluation requires
exact rights/source versions, verified capture windows, source/time-separated splits,
legitimate viral negatives and independently reviewed recurrence/event labels. Claim
truth labels do not substitute for account coordination labels; translations/copies of
one event do not increase independent sample count. Existing reserves remain untouched.
See `docs/CAMPAIGN_EPISODES.md` and the immutable software reports for current findings.

## Subsequent claim dataset review — 2026-11-15

See `docs/CLAIM_EVALUATION_READINESS.md` for the current authoritative review: FEVER and
AVeriTeC (English), X-FACT (Hindi), IndicClaimBuster (Hindi/English/code-mix), IndicLink
(permissive English/Hindi/Telugu adjacent fact-linking) and restricted MultiClaim v2
(cross-language matching). Verified public licenses are distinguished from source rights,
task compatibility, missing corpus snapshots and access approvals. X-FACT's listed release
does not include Telugu; translated IndicLink sentences are not independent claims.
No restricted data/access form or reserved evaluation split was used. No independent
claim-evidence corpus is admitted. New BM25/E5/hybrid measurements remain explicitly
fictional software controls; independent retrieval/verification metrics remain unavailable.

## Claim evidence readiness — Phase 3, 2026-11-15

`test/fixtures/claims/retrieval_controls.json` is project-authored fictional software
test data: nine passages in English/Hindi/Telugu and nine topic-relevance queries.
No externally retrieved article or independently labeled factual claim is included.
Unit/API/browser evidence corpora are explicitly fictional controls, not real bulletins.
The optional local E5/BM25 comparison is a software retrieval measurement only.

No production evidence corpus or live Google Fact Check key is configured here.
External article rights and independent entailment labels are unavailable, so no factual
accuracy or scientific Phase 3 completion is claimed. An operator corpus requires the
complete file SHA, exact source URLs/capture dates, per-document terms and rights/source
approval; these are reviewed attestations, not proof supplied by a client flag. Google
metadata does not grant article redistribution rights or substitute for article evidence.
Next: acquire rights-cleared independent claim/evidence pairs with topic/source/time-
disjoint splits and English/Hindi/Telugu labels before factual performance measurement.
See `docs/CLAIM_VERIFICATION.md` for gates and current limits. All image/video reserves
and previous results below remain unchanged.

## Video development readiness — 2026-11-15

Only **20 procedural software controls**, one correlated source group, are admitted for
the current temporal experiment. **Zero authentic camera recordings and zero independently
labeled manipulated/generated videos were evaluated.** See
`docs/VIDEO_TEMPORAL_EVALUATION.md` for exact inputs, admission evidence, protocol and
results. Existing image reserves and benchmark artifacts were not opened or rescored.

| Candidate / scope | Authoritative rights and labels | Current eligibility / blocker |
|---|---|---|
| Internal procedural controls: motion, cuts, light, occlusion, compression | User-authorized procedural generation; original textures, encoded/raw hashes, exact settings and software-only annotations | Admitted only as software controls with `ground_truth=not_applicable`. Not camera negatives or deepfake positives. |
| FaceForensics++: face swap and reenactment | [Official repository](https://github.com/ondyari/FaceForensics), [official terms](https://kaldir.vc.in.tum.de/faceforensics/webpage/FaceForensics_TOS.pdf): application/acceptance; noncommercial research/education. Associates/colleagues may receive access only after agreeing to the terms. Labels derive from known manipulation pipelines; generated masks require independent review before localization use. | Not admitted: no approved local copy or accepted terms/intended-use review. Do not use mirrors to bypass access. |
| DFDC: actor-based facial modifications | [Meta dataset page](https://ai.meta.com/datasets/dfdc/) describes consenting paid actors and original/manipulated sources; access instructions require AWS account/IAM/account-ID registration. Full applicable agreement and redistribution permissions have not been verified here. | Not admitted: access/terms review and source/identity/label audit required. Public landing-page descriptions are not a license grant. |
| DAVIS: object motion, camera motion and occlusion | [Official code page](https://davischallenge.org/davis2017/code.html), [2019 challenge](https://davischallenge.org/challenge2019/unsupervised.html). Explicit CC-BY 4.0 grant on new 2019 annotations does not establish blanket rights to all underlying videos. Object masks are not manipulation labels. | Not admitted: verify video rights chain, capture provenance and identity/source groups. No independent authenticity/manipulation interval labels verified. |
| GenVideo / DeMamba: generated videos and real-source collections | [Author repository](https://github.com/chenhaoxing/DeMamba): Apache 2.0 code license; real sources include Kinetics-400, Youku-mPLUG and MSR-VTT. Code licensing does not authorize every dataset source or generator output. | Not admitted: per-source rights, labels, generation provenance, group/identity review and quality-confound assessment needed. |
| GenVidBench: real/generated cross-source videos | [Official project](https://genvidbench.github.io/), [author dataset](https://huggingface.co/datasets/jian-0/GenVidBench). Hub metadata queried at revision `701cafb6f999d7ea0cbf3c354df6177311a4d824`: ungated, license field absent/null. Known generator categories do not provide independent interval annotations. | Not admitted: no verified dataset-wide grant or source/identity evidence. Ungated download is not permission for all uses. |
| TUM RGB-D: actual indoor camera motion | [Author paper](https://cvg.cit.tum.de/_media/spezial/bib/sturm12iros.pdf) states CC-BY 3.0. Kinect RGB/depth capture and motion-capture trajectory ground truth; no deepfake labels. [Official listing](https://webshare.cvg.cit.tum.de/g/rgbd/dataset/) identifies floor/desk translation sequences. | Permissive candidate, not admitted in this run: both tested compact `freiburg1_floor-rgb.avi` and `freiburg1_xyz-rgb.avi` preview links returned HTTP 404. Large raw archives were not downloaded. Curate supported CFR inputs within resource limits, retain attribution/transcoding/source evidence and audit identities/groups before evaluation. |

No restricted dataset media were downloaded and no access agreement was submitted.
TUM's permissive license is distinct from the access/rights blockers above; its current
blocker is usable local input and curation, not a claim that restricted permission is
required. Camera trajectories/object segmentation do not supply manipulation truth.
Approval must include saved exact terms/version and label/grouping evidence, not only
a URL or manifest flag. The current operator registry contains only the software corpus.
Phase 2d remains scientifically unvalidated pending independent data and annotations.

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

The original image gates below remain unchanged. Video development admission and its
separate operator registry are specified in `docs/VIDEO_TEMPORAL_EVALUATION.md`.

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
