# Image model failure analysis — 2026-11-15

## Evidence and scope

This investigation preserves the completed publisher-parity result. It analyzes the
earlier 80-image Mirage subset as exposed development data, compares three pretrained
classifiers with fixed thresholds, and adds a generator-stratified development partition.
No image labels were changed based on visual appearance or model outputs.

Raw diagnostics are in `reports/image_failure_analysis.json`; per-image scores, source
dimensions/format/JPEG quantization, model identity, transformations and timing are in
the `reports/benchmark_*` JSON files. Source dataset revision is
`820a191bb0844ae74a1bd9eb57b28268257a4053`. Publisher labels are not an independent
forensic authenticity audit.

## Main findings on the exposed original subset

1. **The old fake sample covered one generator folder.** Every synthetic source was under
   `Digicam`; the old first recursive API page did not cover other folders. Previous
   metrics remain reproducible, but are not cross-generator evidence. V2 explicitly samples
   Digicam, Flux_xhs_v2, amateurphoto-v6-forcu, realistic_photography_v1, sd3.5, and
   ultrarealisticFinetune_v4 in Animal, Human, Object and Scene categories.
2. **The classifiers have different failure patterns.** At 0.5, Community Forensics misses
   37/40 synthetic inputs; Dima flags 29/31 scored genuine inputs; SDXL flags 16/31 genuine
   inputs while missing 14/40 synthetic inputs. Raw scores cannot establish calibrated
   probability or confidence.
3. **Source-size policy changes coverage.** Nine of 40 genuine images exceed the existing
   24-million-pixel limit. The scored set is therefore 31 genuine / 40 synthetic, despite
   balanced sampling before rejection. Report denominators and skipped images explicitly.
   V2 separately records candidate exclusions and uses only service-eligible source sizes.
   All 40 original synthetic inputs are 1024x1024, while genuine images span varied camera
   resolutions and aspect ratios. Resolution and class/source are therefore confounded;
   an association by resolution cannot by itself identify the cause of an error.
4. **Compression is not established as the main cause.** Paired quality-75 JPEG re-encoding
   changes one threshold decision each for Community and SDXL and none for Dima. Every
   changed decision in that JPEG experiment becomes wrong. This single recompression level
   does not establish robustness across codecs, existing compression, screenshots or platforms.
5. **Resizing matters but is no universal correction.** A max-512 resize flips three Community
   decisions, all from correct to incorrect; SDXL has five corrections and one newly wrong
   decision; Dima has no threshold flips. This is model sensitivity on development data,
   not evidence to silently replace documented production preprocessing.
6. **A different threshold cannot repair weak ranking.** Original-set AUROCs are 0.5758
   (Community), 0.5274 (Dima), and 0.6613 (SDXL), with broad overlapping exploratory
   confidence intervals. Threshold sweeps are recorded as development diagnostics, not
   used to fit calibration or optimize the reserved test set.

## Representative errors

The following two images were visually inspected locally. Visual inspection helps describe
content; it cannot confirm how either image was made. The original labels are retained.

| Source image | Publisher label | Model / raw output | Observed content and interpretation |
| --- | --- | --- | --- |
| [Animal/1_fake/Digicam/img_4446.jpg](https://huggingface.co/datasets/Yunncheng/Mirage-Test/blob/820a191bb0844ae74a1bd9eb57b28268257a4053/Animal/1_fake/Digicam/img_4446.jpg) | Synthetic | Community: 0.000009754 | Plausible macro scene of an insect on a flower with droplets; a false negative against the dataset label. Photographic plausibility alone does not verify authenticity. |
| [Human portrait 09ce2f…](https://huggingface.co/datasets/Yunncheng/Mirage-Test/blob/820a191bb0844ae74a1bd9eb57b28268257a4053/Human/0_real/09ce2f681c1b655cca3dbc07f189b447dd62ed62ece5c2f25df0ffab64aef649.jpg) | Genuine | SDXL: 0.999919891 | Outdoor portrait with shallow depth of field; a false positive against the dataset label. There is no evidence here that background blur caused the score. |

Additional machine-selected failure cases, with hashes and exact scores, are included in
the raw diagnostics: Community misses `Object/1_fake/Digicam/img_4392.jpg`; SDXL misses
`Animal/1_fake/Digicam/img_4823.jpg`; Dima flags an Object genuine image beginning `1fc773…`.
These are illustrative cases, not a representative accuracy sample.

## Assessment of possible causes

| Factor | Supported evidence | What remains uncertain |
| --- | --- | --- |
| Domain/generator shift | Single-generator bias found; models were trained on different source distributions | Exact training overlap, per-source labels, and causal contribution are unverified |
| Resolution / resizing | Nine genuine images rejected; paired resizing changes some predictions | Whether other sampling/crop policies improve independent performance |
| JPEG compression | Paired Q75 experiment measured; original JPEG quantization associations recorded | Original JPEG quality cannot be inferred exactly; codec/source confounding remains |
| Natural photos vs generated images | Evaluated against publisher labels; two cases visually reviewed | Original camera files, complete generation logs and label audit are unavailable |
| Editing vs full generation | Dataset labels describe real/generated images | No local-edit or face-swap ground truth; these tasks cannot be evaluated by reusing generation labels |
| Training-data limitations | Dima card offers sparse provenance; SDXL card describes diffusion-specific limitations | Reproducible upstream train/test overlap audits are unavailable |
| Class imbalance | Original scored sample is 31/40 after policy skips | Dataset population prevalence and deployment prevalence are unknown |
| Threshold | Fixed 0.5 used for every model; no threshold fitted | A deployment cost/false-positive target and independent calibration set are still needed |
| Out-of-distribution inputs | Cross-source transfer is a plausible explanation consistent with the errors | OOD is a hypothesis, not a proven per-image diagnosis |

## Decision

The V2 development run repeats the principal failure patterns on 96 fresh eligible inputs
from six generator folders: Community detects 10/48 synthetic images and flags 0/48 genuine;
Dima detects 46/48 but flags 41/48 genuine; SDXL detects 36/48 and flags 21/48 genuine.
No errors are explained away by the earlier single-generator limitation: broadening the
sample changes estimates but leaves both reliability and source-audit gaps. This does not
prove a unique cause; see `docs/IMAGE_MODEL_BENCHMARK.md` for intervals, category counts,
generator counts, memory and latency.

On V2, JPEG75 changes only one Community threshold decision (new false positive), and
changes none for Dima or SDXL. Max-512 has no threshold flips for Community or Dima and
changes three for SDXL (two corrections, one new error). Community AUROC changes from
0.634 to 0.603 under resizing; SDXL changes from 0.734 to 0.747. These small development
interventions do not justify undocumented preprocessing changes or establish causal
robustness. V2 raw examples/associations are in `reports/image_failure_analysis_v2.json`.

Keep all experimental whole-image and face outputs inconclusive. Do not fine-tune yet or
choose the highest development accuracy as a winner. Complete the documented development
comparison, then use an isolated compatible runtime for a stronger modern candidate when
RAM allows. Before any final test or calibration, audit source/identity groups and add an
independent dataset with defensible provenance. The current reserved split stays unscored.
