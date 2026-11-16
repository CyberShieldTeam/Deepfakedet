# Engine 4.2 OCR audit

Baseline: clean/synchronized `00b6d06`, `codex/integrate-figma-upgrade`, 2026-11-16.
No investigation migration or original model/threshold change. Existing Engines 1–4.1,
manual claims/captions, source-review gates, semantic diagnostic restrictions, Engine 3
recurrence/coverage and Engine 4 deterministic relationships are retained.

Path: browser original selection → existing MIME/signature analysis and submitted-byte
hash → owned case extraction API/hash equality → Pillow preparation → isolated offline
Tesseract.js worker → TSV line/word extraction → exact-span candidate rules → attributed
human review → existing Engine 2 retrieval → current-review Engine 4 link → stored report.
The reviewer reselects the original file; raw media is not duplicated into case JSON.

Baseline supports PNG/JPEG/WebP, ≤10 MiB, ≤24M original pixels, EXIF transpose, RGB,
aspect-preserving thumbnail ≤1600px and ≤8 MiB prepared PNG. Tesseract.js/core 7.0.0,
fixed tessdata_fast English SHA-256 `7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2`,
OEM LSTM-only, PSM.AUTO. No runtime model download, translation or language detection.
UTF-8/NFC claim normalization is separate from immutable machine text. Worker stdout now
uses streaming UTF-8 decoding so chunk boundaries cannot split a multibyte character.

Verified causes and distinctions:
- Pixel orientation metadata was applied, but sideways printed text without suitable EXIF
  was not explicitly corrected. Actual authored sideways baseline is garbled; an explicit
  quarter-turn recovers the authored text. This does not validate arbitrary skew handling.
- Gaussian-blurred authored letters are misrecognized; contrast/sharpening did not restore
  the lost wording. More output/confidence is not a validated quality selector.
- Four of nine independent line crops returned NO_TEXT_DETECTED under page-layout AUTO;
  explicit SINGLE_LINE returned text for all nine, with remaining transcription errors.
  This points to layout sensitivity; it is not proof that every failure has this cause.
- Candidate rules preserve exact nonempty line substrings, including incomplete text.
  They did not cause these lost-text cases: raw OCR itself was empty or incorrect.
- COMPLETE describes process completion, not correct transcription or factual truth.
  NO_TEXT_DETECTED is distinct from technical FAILED, UNAVAILABLE and capped PARTIAL.
  Unavailable languages never become evidence-insufficient factual assessments.

Existing caps retained: 512 words, 32 lines, 2000 characters/line, 16 candidates, 20k raw
characters; 20 records/case and 32 reviews/candidate. Worker 30s, request 40s, one active
job per Express process, bounded IPC, V8 old-space 512 MiB. Native/WASM RSS is not an OS
hard cap. Offline profiling adds a 45s/1GiB supervisor without relaxing runtime limits.

API compatibility: optional `profile`, default baseline. Every request still runs one OCR
pass. Different nonbaseline configurations receive distinct extraction IDs even if text
matches; baseline ID inputs remain unchanged. Existing record IDs/reviews are reused on
identical reruns. Old records keep their recorded processing coordinates; missing original
coordinate maps are disclosed, never invented. Deploy updated Python and web components
together: mismatched preparation protocols fail explicitly rather than invent mappings.

Box integrity: processing-pixel boxes remain unchanged. New records retain exact affine
maps to encoded-source and EXIF-oriented display coordinates; line envelopes transform
all four corners. Original/display dimensions, bitmap hash and selected profile are saved.
Geometry tests cover all eight EXIF orientations including mirrors, rotation, scaling and
actual marker positions. Default prepared bitmap hashes match frozen 4.1 across these
controls. New UI overlays use display coordinates; API/graph/report expose source boxes.

See ENGINE42_PREPROCESSING/EVALUATION/MULTILINGUAL/VALIDATION for measurements and limits.
