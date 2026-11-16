# Architecture and evidence boundaries

React 19/TypeScript renders the Vite application. Express serves authenticated APIs and,
in production, static assets. Ownership, Zod validation, origin/upload/rate limits and
signed result attachment apply before case mutation. Separate bounded workers perform
OCR, network and correlation work. Missing dependencies never become positive predictions.
The README Mermaid diagram shows the process relationships; it introduces no new services.

Engine 1 retains browser image/audio/video measurements and optional full Python service
evidence: original-byte provenance/signals, video decoding and configured experimental
image/face/audio inference. These are distinct from validated authenticity verdicts.

`ai_service.ocr_app` mounts **the unchanged existing preparation router only**. It imports
no classifier, Torch or FFmpeg module. Health reports preparation ready and classifier
unavailable. `VERITAS_OCR_PREPARATION_URL` routes OCR there; without it, the original full
service URL fallback remains. Actual Tesseract runs in the existing bounded Node worker,
using pinned local English data and the same geometry/provenance constraints.

OCR returns immutable text, geometry and exact-span candidates. Only a current accepted/
corrected source-confirmed review can launch Engine 2. Retrieved sources remain unassessed
until a distinct applicability/stance review. Engine 3 retains posts, witnesses, episodes,
recurrence eligibility and coverage. Diagnostic embeddings do not become truth/malice
labels. Engine 4 projects the owned case into deterministic evidence relationships and an
uncertainty-aware timeline. JSON and HTML reports read that same saved investigation.

`AtomicRepository` uses temporary-file/fsync/rename writes and rollback after failure.
Failed/stale analyses retain previous evidence with a separate run state. Storage is
single-process JSON: no multiwriter database, object archive, durable queue or graph database.

The submission launcher starts real Express and preparation processes, a fresh empty
store, an authored hash-verified corpus and ephemeral authentication. A server-controlled
banner discloses fixture provenance. It uses normal views/APIs, not a special dashboard,
mock detector or hardcoded verdict. Its sources/posts are fictional; OCR is actual inference.

Detailed contracts: [extraction](ENGINE4_EXTRACTION_ARCHITECTURE.md),
[OCR profiles](ENGINE42_OCR_AUDIT.md), [correlation](ENGINE4_ARCHITECTURE.md),
[model adapters](MODEL_CONTRACT.md), [provenance/signals](IMAGE_PROVENANCE_AND_SIGNALS.md).
Older phase documents are historical snapshots: OCR was added after the original Engine 4
limitations document. Use the current README/verification for installation and capability status.
