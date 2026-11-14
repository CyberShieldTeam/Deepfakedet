# VERITAS AI — Suraksha Suchan

An evidence-driven investigation workspace combining **media authenticity**, **factual
accuracy**, and **distribution-pattern analysis**, without an unexplained fake/real score.
The existing React/TypeScript + Express + Vite architecture is preserved.

**This is a production-oriented upgrade, not a claim of production certification or validated
deepfake accuracy.** Dedicated ML inference and external retrieval require configured services.
Missing services return explicit unavailable/insufficient-evidence states, never invented results.

## Run outside Figma Make

Node.js 22+ and npm:

```sh
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000. No credentials are needed for local, single-analyst development.
The Figma Make preview uses its existing supervised Vite server with the same Express API
mounted in middleware; do not start another server in that environment.

```sh
npm test
npm run lint
npm run build
# Optional browser tests, against an already-running app:
npx playwright install chromium
npm run test:e2e
```

`VERITAS_TEST_URL` overrides the browser-test URL. Browser tests assume a local development
store and unconfigured external services; they do not measure ML accuracy.

## What works without external services

- Owner-scoped case workflow, history, signed result attachments and exportable HTML/print-PDF reports.
- Strict Zod request validation; protected fields cannot be PATCHed.
- Atomic single-process JSON repository, corruption fail-closed behavior, persistence rollback/errors.
- Browser image ELA, metadata hints, source-file SHA-256, video frames/temporal differences,
  audio waveform/spectrogram, mono resampling and real WAV segmentation.
- Sparse multi-signal graph construction and DBSCAN communities, node/post/relationship inspection,
  configurable windows/thresholds/minimum density, and disclosed candidate-budget limits.
- Multilingual script screening and claim extraction; BM25 ranking when evidence is retrieved.
- Four clearly labeled seed demonstrations and an explicit guided fictional scenario.
- Separate live/demo case lists, metrics and alerts. The initial view is explicitly demonstration mode.
  Uploaded media and submitted claims switch to live analysis automatically.

## Optional model and evidence services

See [the model contract](docs/MODEL_CONTRACT.md) and `.env.example`.

| Capability | Configuration / behavior |
|---|---|
| Image generation/manipulation classifier | `VERITAS_IMAGE_*`; null probabilities until a suitable trained model responds |
| Audio spoofing classifier | `VERITAS_AUDIO_*`; must include a trained spoofing head, not bare Wav2Vec2 |
| Multilingual SBERT | `VERITAS_EMBEDDING_*`; may be locally hosted; lexical fallback is explicit |
| Fact-check retrieval | `GOOGLE_FACT_CHECK_API_KEY`; real Google Fact Check Tools reviews, source URLs/dates when provided |
| Explanation and translation | `APP_GEMINI_API_KEY`, optional `GEMINI_MODEL`; never supplies classifier probabilities or factual verdicts |
| C2PA cryptographic verification | Not installed; byte markers are unverified hints only |

An existing `GEMINI_API_KEY` in the repository's own `.env` remains compatible. Platform-reserved
provider environment variables are not consumed as fallback credentials. New deployments should
use `APP_GEMINI_API_KEY`.

Retrieval and semantic similarity do not establish entailment or truth. Live claims remain
**Insufficient Evidence** until an authenticated/local analyst checks retrieved sources and
records applicability, stance and a rationale. Reviewed verdicts are Supported, Refuted,
Misleading Context or Insufficient Evidence. Historical demo verdict names remain readable.
Google review ratings are not automatically converted into VERITAS verdicts.

## Protected production deployment

1. Build with `npm run build`.
2. Configure `VERITAS_USERS` as a JSON mapping of random, at-least-32-character tokens to stable
   owner IDs. Provision/rotate these through your secret manager, never through Git.
3. Set `NODE_ENV=production`, `VERITAS_PUBLIC_ORIGIN` to the exact HTTPS application origin,
   and `VERITAS_STORE` to a path on a protected persistent volume.
4. Run `NODE_ENV=production npx tsx server.ts` behind a TLS reverse proxy.
5. Sign in using Analyst workspace → Manage access. Tokens are exchanged for eight-hour
   HttpOnly, Secure, SameSite=Strict cookies. API clients may instead use bearer tokens.

Without production credentials, case APIs are locked (401), not publicly readable.
Do not deploy using Vite's static preview or a static-only host: Express must serve `/api`.
Authentication is a minimal operator-provisioned token/session system, not OAuth, MFA or an
organization/role directory. Sessions are in memory and expire on restart.

Request logs contain method, route template, status, duration and request ID, not case text or
tokens. Origin checks, size/signature checks, mutation rate limits and bounded upstream calls
provide defense in depth; configure gateway rate limits and TLS. The app does not blindly trust
forwarded client IP headers.

## Storage and compatibility

`data/investigations.json` remains the default, with atomic temporary-file/fsync/rename writes,
0600 files and rollback of in-memory state on failure. Invalid existing data stops loading;
it is never silently replaced by demos. Back up the directory.

The repository is **single-process only**, not a multiwriter database. A managed database,
encrypted evidence object storage, quotas, immutable audit trail and retention controls remain
deployment work. Original media bytes are not archived; source hashes, measurements, sampled
frame thumbnails and analysis records are retained. Browser evidence is client-supplied,
not independently attested on the server.

Existing routes are retained. Security changes deliberately reject protected PATCH fields and
arbitrary attachment payloads. `/attach` accepts current, same-owner, server-signed analysis
results only; re-run an unsaved analysis after a server restart. Live/simulated attachment mixing
is rejected. Legacy cases without ownership are visible only to the local development analyst;
an administrator must explicitly assign ownership before production use.

Network communities and association strengths are not bot probabilities or proof of malice.
Repeated multi-signal activity can merit review, but organic viral activity and legitimate
campaigns remain plausible. The original union-find engine remains available as a comparison
baseline and in historical demo records.

## Implementation details

See [UPGRADE_REPORT.md](UPGRADE_REPORT.md) for the phase-by-phase implementation, file inventory,
verification and limitations. ML integration tests use clearly identified protocol mocks;
no external model accuracy, live API quota or unseen evaluation dataset is claimed.
