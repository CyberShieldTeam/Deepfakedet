# Engine 4.1 extraction audit and design

Audit baseline: clean `c4fe717`, branch `codex/integrate-figma-upgrade`, remote 0/0.
Existing Pillow/OpenCV/FFmpeg paths provide image decoding, EXIF handling, bounded video
sampling and audio preprocessing. Unicode claim analysis and attributed review already
exist. No OCR, speech-to-text or automatic translation implementation/model was installed.
Gemini must not stand in for validated extraction; no LLM is required for this slice.

First implementation targets image OCR → immutable text/candidates → explicit human
review → existing Engine 2 → Engine 4. It preserves independent manual claims/captions.
OCR uses pinned Tesseract.js and a small pinned Apache-2.0 English tessdata_fast file,
stored outside Git. Runtime is offline and refuses absent/mismatched model data. Existing
Python/Pillow service prepares bounded oriented/resized images; an owned, timed Node
subprocess performs OCR. No model is downloaded automatically at startup or upload.

Ownership-bound case extraction/review/investigation routes persist original machine text,
source byte hashes, processing geometry, actual word confidence and chronological human
decisions. Review confirms representation of source text, not factual truth. Only an
accepted/corrected current revision can launch Engine 2 or bind an extracted claim through
Engine 4. Failures preserve prior extraction/review records. Pending/rejected/uncertain
candidates cannot create final media-to-investigated-claim links.

No media bytes are duplicated in persistent case records. Investigators select the same
hash-matching local image to inspect it again after reload. Extraction records retain the
OCR geometry and provenance, not a fabricated original-media URL or publication time.
Text is untrusted data: no extracted instruction, URL or quotation is executed/fetched.

Video OCR/transcription, audio STT and Hindi/Telugu OCR are explicitly deferred/unavailable
in this first slice. Existing video/audio forensic analysis remains operational. No large
speech model is downloaded, no speech timestamps are invented, and English recognition
configuration is never presented as reliable detection of an unknown source language.

## Installed OCR configuration and APIs

- `tesseract.js@7.0.0` with locked transitive core; Apache-2.0.
- Official English tessdata_fast revision `87416418657359cb625c412a48b6e1d6d41c29bd`,
  4,113,088 bytes; SHA-256 `7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2`.
  [Publisher data repository](https://github.com/tesseract-ocr/tessdata_fast) and
  [Tesseract.js local installation](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md).
- A fixed local `langPath`, gzip=false and cacheMethod=none avoid CDN/model-cache fallback.
  Node uses the installed local WASM core. Each job verifies model size/hash in parent
  and child. The v7 byte-language-object initialization path failed in an actual smoke;
  it is not used. The explicit downloader verifies size, Git blob and SHA-256.
- PSM.AUTO; actual word TSV confidence and processing-pixel boxes. IDs hash case/source/
  model/bitmap/output; timing is excluded. Category IDs reference exact segment substrings.
- POST `/api/investigations/:id/extract`: `{mediaHash,modality,language,mediaData}`;
  matching attached server-received bytes required. Only `image` + `eng` is installed.
- POST `/api/investigations/:id/extractions/:extractionId/review`:
  `{candidateId,revision,state,reviewedText?,reason,sourceConfirmed}`. Strict owner/revision
  checks; reviewer/time generated server-side; client origin/reviewer fields rejected.
- POST same extraction path `/investigate`: `{candidateId,revision}`. Only latest accepted/
  corrected review; verify again after asynchronous retrieval. Origin is server-issued;
  duplicate current investigation reused. Engine 2 original retrieval/review logic unchanged.
- Python POST `/v1/extraction/image/prepare`: base64 only; never a client filename/URL.
  Uses existing Pillow dependency, explicit formats/byte/pixel caps and EXIF orientation.
- Case arrays are additive; no data migration or raw upload storage. Original text,
  reviewed corrections, identities/reasons/revisions, model/hash and geometry remain in
  API/disk/report. New source/review marks correlation stale; failed runs retain evidence.
- Graph structural machine nodes retain provenance but carry no claim-truth inference.
  A current review/segment/hash/text/revision match is required for Engine 2 binding.
  The existing graph worker/caps, manual contexts, sources and public-post matching remain.
