# Engine 4.1 limitations

Implemented scope: local English still-image OCR, anchored candidate text, authenticated
human review, explicit Engine 2 investigation and Engine 4 correlation. This is a tested
software vertical slice, not completion of every multimodal research phase.

- No video OCR, subtitle deduplication, speech recognition, translation, Hindi/Telugu OCR,
  or trained language detection. Video/audio requests explicitly return UNAVAILABLE;
  existing video/audio forensics are unchanged. No speech/silence/partial-transcript
  result or timestamps are generated. Their quality fixtures/evaluation are deferred.
- English recognition on Hindi/Telugu/mixed-script controls produced incorrect Latin
  text. Rotated and blurred English controls also produced errors. COMPLETE means a
  bounded OCR process finished, **not that its transcription is correct**. The configured
  recognition language is not detected source language. Do not accept unreadable output.
- No independent annotated dataset is admitted. Authored controls test transport,
  provenance, storage and safeguards; they are not real-world accuracy benchmarks.
  CER/WER, candidate quality, agreement and relationship accuracy remain unmeasured.
- Conservative English sentence/category rules are unvalidated suggestions. Line breaks,
  abbreviations, quotation scope, negation and satire can be misclassified. Exact source
  substrings and the original OCR are retained. Corrections are separate revisions.
- Human review cannot establish source credibility, publication provenance, authenticity,
  factual truth, endorsement, misinformation, coordination or malicious intent.
- Original media bytes are not duplicated in the case store. Reviewers must preserve
  originals and reselect matching bytes to inspect them in the UI after reloading.
  Source confirmation is an authenticated analyst attestation; no API can establish
  that a human actually inspected an image. No original-source URL is invented.
- Bounding boxes refer to the EXIF-oriented/resized processing bitmap, not raw encoded
  pixels. Original/processing dimensions and transformation are stored. There is no
  automatic text-angle correction or live box overlay in this first version.
- Failed reruns preserve extraction/reviews. A different successful OCR output creates
  another immutable record; obsolete records are retained, not destructively replaced.
  Withdrawing a review removes its current extraction-to-assessment graph binding;
  historical Engine 2 assessments/sources remain explicitly historical.
- Maximum 10 MiB original, 24M source pixels, 1600px processing side, 8 MiB PNG,
  512 words/32 lines/2000 characters per line/16 candidates/20k raw characters,
  20 extraction records per case, 32 review revisions per candidate. Caps are disclosed.
  OCR is serialized per Express process, with a 30s worker / 40s total deadline, bounded
  IPC output and 512 MiB V8 old-space setting. Native/WASM RSS has no hard runtime OS
  memory cap; measured RSS is not a deployment capacity guarantee. Multiple Express
  processes need an external job queue/resource supervisor before scaling.
- Existing JSON persistence remains single-process. No migration or user store mutation
  was performed. Runtime OCR is offline; explicit Engine 2 investigation can send reviewed
  text to configured retrieval providers, with their existing privacy/availability limits.

Next gate: rights-cleared independent screenshot annotations, prespecified source/script/
rotation strata and blinded reviewers. Measure transcription and downstream relationship
correctness separately before choosing language packs, angle correction or new models.
