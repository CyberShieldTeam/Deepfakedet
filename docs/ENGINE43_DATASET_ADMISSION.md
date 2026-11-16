# Engine 4.3 dataset admission — 2026-11-17

## Decision

**Zero new independent full-screen images admitted.** No dataset pixels were bulk
downloaded. No independent transcribers or adjudicator participated. The deliverable is
annotation/evaluation readiness plus separately labelled authored engineering controls.
Publisher reputation, QA answers, UI descriptions and VLM outputs are not exhaustive,
independent screen transcription. Existing Engine 4.2 HierText line crops remain a
separate development probe; they are not relabelled as screenshot data.

## Primary-source review

| Candidate | Rights/access and labels | Admission decision |
|---|---|---|
| [ScreenQA](https://github.com/google-research-datasets/screen_qa) | Google Research annotations state CC BY 4.0; original screen IDs point to RICO. Human QA/selected UI answers do not exhaustively transcribe the screen. Short answers include model-generated variants; ComplexQA is model-generated then human-checked. | Provisional task candidate, not admitted full-screen CER/WER truth. Underlying image rights/access need separate verification. |
| [Screen Annotation](https://github.com/google-research-datasets/screen_annotation) | Google Research annotations state CC BY 4.0; original images from RICO. UI types, locations, text and descriptions began as automated annotations, then human verification/correction. | Promising annotation aid; not two blinded, exhaustive transcriptions or adjudicated reading order. Original-image rights/access unresolved for this release. |
| [Screen2Words](https://github.com/google-research-datasets/screen2words) | RICO screen identifiers and human summaries (22,417 screens/112,085 summaries). A summary is not literal text. A guessed raw LICENSE path returned 404; this is not evidence that every asset lacks a license. | Excluded from transcription scoring. Confirm actual image/annotation terms before future acquisition. |
| [RICO archive](https://www.interactionmining.org/archive/rico) | Original mobile screenshots/view hierarchies collected with human and automated traversal. Referencing datasets do not by themselves establish reuse rights for every underlying app image. Current archive/access and image permission need verification. | No acquisition/admission this release; no original dimensions, image hashes or language labels invented. |
| [ScreenParse publisher](https://saidgurbuz.github.io/screenparse/) / [official release card](https://huggingface.co/datasets/docling-project/screenparse/blob/main/README.md) | Card declares CC BY 4.0. Publisher page describes v1; v2 card reports 1,447,100 screens/25.6M annotations. DOM/Webshot data, Qwen3-VL refinement and VLM judging are not independent human transcription. Underlying website screenshot rights require review. | Not admitted independent OCR truth; no large download. Pin a specific version and independently adjudicate any future subset. |
| HierText, DocVQA, WIRIndic | See [Engine 4.2 review](ENGINE42_EVALUATION.md) for source links and existing admission. HierText is scene text; DocVQA QA spans are incomplete page transcripts; WIRIndic word crops/research terms do not supply original screenshot truth. | No new admission; historical line measurements remain separate. |

All languages in these new candidate sources remain **unverified for a chosen sample**.
Recognition pack `eng` never establishes source language. Original image IDs, encoded
dimensions, SHA-256, transcription coverage and model-training overlap must be recorded
per admitted image. Training overlap is currently unknown. A failed guessed WebSRC URL
was not treated as evidence that the actual dataset is unavailable.

## Local release and annotation protocol

`ai_service.ocr_release` schema 3 requires versioned publisher/source, rights/permission
evidence, annotation provenance/protocol, operator approval and an explicit pass budget.
These fields are operator attestations, not automated legal or scientific verification.
Original relative image paths are contained by realpath, byte-hashed and checked against
encoded dimensions; originals must stay in the approved local root, outside Git when
redistribution is restricted. Do not commit private packets, source images or case stores.

`python -m ai_service.screenshot_annotation release.json --directory fresh-packet --annotator ACTUAL_PARTICIPANT`
creates at most 50 byte-identical original images with a blinded JSON template. It omits
publisher transcripts, OCR predictions and claim labels. Use two separate packets for
two actual independent participants, then a separate adjudicator. No identities are
auto-created; test fixture identities are explicitly software controls.

The protocol preserves NFC, case, punctuation and region reading order, with one newline
between legible regions. Boxes use original encoded pixels. Record region/source language,
mixed scripts, uncertainty and illegible regions without spelling repair or translation.
Illegible text stays empty; explicit no-text is distinct from failed OCR. Record timestamps,
source SHA/dimensions, protocol hash, participant identity and blind-attestation. The
validator exposes both transcriptions and whether they disagree; an adjudicator must
record disagreement review, final regions and complete-screen coverage. Software cannot
prove real independence, participant expertise or truthfulness of these attestations.

`pending` references are null and unscored. `publisher_only` remains provisional even
when scores against those strings are available. `human_adjudicated` full-screen scoring
requires two distinct participants, a distinct adjudicator, matching final language/text,
explicit complete-screen transcription and no unresolved illegible/uncertain regions.
Resolve exclusions before freezing; do not silently drop difficult regions after OCR.

## Next admission gate

Obtain written/explicit rights and resource approval for a small set of original mobile,
web/news and announcement screens; pin exact release identifiers/terms and image IDs.
Recruit actual English/native-script transcribers, retain disagreements and adjudication,
then group source/document/duplicate lineage before freezing development/holdout roles.
No current sample supports independent claim, relationship or human-usability metrics.
