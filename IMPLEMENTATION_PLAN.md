# VERITAS AI implementation plan

## Engine 4 first vertical slice — 2026-11-16

Case-level correlation is implemented across backend, owned persistence, case UI, timeline,
reports and regression tests. See `docs/ENGINE4_ARCHITECTURE.md`, `ENGINE4_EVIDENCE_MODEL.md`,
`ENGINE4_VALIDATION.md`, `ENGINE4_LIMITATIONS.md`. It links evidence through documented
references and explicit supplied context, not a new misinformation verdict. Next gate is
rights-approved independent relationship annotations plus adversarial/concurrent load
testing; automatic extraction and approximate semantic/media matching remain unimplemented.

## Cross-engine diagnostic prerequisite — 2026-11-16

Investigated user-observed inconclusive screens before further Engine 3 research.
`docs/CROSS_ENGINE_DIAGNOSTICS.md` records actual frontend/raw/API/storage/report traces,
verified status-mapping/error-retention faults, additive processing states, regressions and
preserved uncertainty safeguards. No models/thresholds changed. Source/model availability
and independent validation remain separate open gates; do not infer scientific completion
from improved evidence visibility.

## Current Engine 3 gate — 2026-11-16

Episode implementation and bounded worker reliability are implemented, with independently
gated evaluation tooling and authored controls. Scientific validation remains open: no
admitted independent campaign corpus or maliciousness metrics. Next task is authorized,
task-matched IO/control or documentary coordination data and blind, separate association/
episode/coordination/intent annotations. Freeze grouped splits and sampling/CI protocol
before evaluation or threshold proposals. See `docs/ENGINE3_DECISION_RECORD.md` and
`docs/ENGINE3_EVALUATION.md`; historical audit below is retained as history.

Audit date: 2026-11-14. Baseline: `main` at `fa888241d838de9ce835d2277183add633f28d29`. Work branch: `codex/phase1-audit`.

## Current system

- React 19/TypeScript/Vite frontend in `src/`. `MediaLabView` extracts image, video, and audio signals in the browser and sends JSON to `POST /api/forensics/analyze-media` through `src/services/api.ts`. `App.tsx` owns navigation, selected case, and result attachment. SSE supplies live events.
- Express backend in `server.ts` owns routes, Gemini failover, simulated feed, reports, and synchronous JSON persistence. `server/imageDetection.ts` calibrates Gemini image judgments. `server/campaign.ts` implements real rule-based account clustering. `server/demoScenario.ts` and `server/demoData.ts` contain marked fictional cases.
- Real local computations: ELA, metadata scanning, video frame differences, audio spectrum, network graph rules, report hash. Gemini-dependent: image/video/audio judgments, translation and claim assessment; Search grounding depends on quota. No dedicated pretrained or fine-tuned detector is present. Demo findings are scripted.
- Public route contracts and `ForensicAnalysisResult`/`ClaimVerificationResult` in `src/types.ts` are the compatibility boundary. Existing `engine` values are `gemini`, `heuristic`, `simulated_demo`, and `graph_heuristics`.

## Delivery sequence and dependencies

The additional provenance, signal, temporal, model-training, and physiological methods requested after the initial audit are sequenced with acceptance gates in `FORENSIC_METHODS_ROADMAP.md`.

| Step | Deliverable and acceptance gate | Depends on | Complexity |
| --- | --- | --- | --- |
| 1. Audit | This plan, progress ledger, baseline type check/build/tests; no runtime change | Existing checkout | Small |
| 2a. Image | Evaluate an openly usable general synthetic-image model and a separate face-manipulation model. Record exact weights, license, preprocessing, class order, input scope, and version. Build a Python inference adapter with startup model loading and health status. Integrate image calls with Express while retaining Gemini/heuristic paths as clearly labeled fallbacks. Return inconclusive for unsupported/low-quality inputs. | Model and license verification; representative evaluation set; API result mapping | High |
| 2b. Audio | Verify AASIST implementation and checkpoint provenance/license. Decode and resample audio, segment speech, return segment timestamps and calibrated anti-spoof scores. Extract video audio independently. | 2a service skeleton, permitted weights, audio fixtures | High |
| 2c. Video frames | Server-side metadata/decoding and sampled frames, image/face inference per timestamp, quality-aware aggregation and traceable timeline. | 2a image inference, video decoder, async jobs for long clips | High |
| 2d. Temporal video | Select and validate a temporal model or train one on video-separated data; report temporal predictions independently before fusion. | 2c frames, licensed video data and evaluation protocol | Very high |
| 3. Text | Partial: modular operator-corpus/Fact Check retrieval, Unicode BM25, optional pinned server-side local E5-small, explicit unavailable/insufficient/conflicting statuses and quote-based attributed review. No client-side model. Independent English/Hindi/Telugu retrieval/entailment validation and approved factual corpus remain open; no automatic trained verification model is promoted. See `docs/CLAIM_VERIFICATION.md`. | Rights-cleared evidence corpus, provider access where used, independently labeled language-specific evaluation | Very high |
| 4–5. Training/provenance | Leakage-safe datasets, licenses, reproducible fine-tuning and evaluation scripts, model cards. Checkpoints count as trained only after a completed run and measured evaluation. | Dataset access, compute, selected models | Very high |
| 6–7. Fusion/Gemini | Calibrated fusion with missing/contradictory modalities and Gemini as secondary explanation. | Evaluated modality models | High |
| 8–10. Services/data/security | Incremental route extraction, jobs, PostgreSQL migration with backup and verification, identity/ownership, validation, limits, protected SSE/reports. | Stable API contracts and migration plan | Very high |
| 11–14. UI/QA/deployment/docs | Evidence timelines, model provenance, tests/CI, containers, operating and training docs. Deliver alongside each engine rather than waiting until the end. | Relevant engine milestones | High |

## First engine implementation slice

1. Verify candidate model cards and weights from original publishers. Record task scope, redistribution terms, preprocessing, labels, expected calibration and hardware. General AI-generated image detection and facial manipulation are separate tasks; an absent face must not force a general-image verdict.
2. Introduce a versioned, internal Python image inference contract with a model registry and readiness/diagnostic endpoint. Model loading occurs once at startup. Missing or incompatible weights produce an unavailable state, never a fabricated score.
3. Add narrowly scoped image integration behind the existing Express route. Preserve the existing response fields, add optional local-model evidence fields and explicit provenance. Maintain currently working Gemini and browser-signal behavior when the local engine is unavailable.
4. Add tests for preprocessing, unsuitable files, class mapping, timeouts, unavailable service, response mapping, and a small real-weight evaluation separate from mocked integration tests. Run `npm run lint`, `npm test`, `npm run build`, Python tests, and a manual end-to-end image upload before marking the engine complete.

## Risks and decisions

Engine 3 episode slice from `aa28502` is now implemented as descriptive, traceable
software (`docs/CAMPAIGN_EPISODES.md`, `docs/CAMPAIGN_API.md`), retaining a named original
baseline and fixed thresholds. Controls/test completion does not close scientific
coordination validation. The next Engine 3 gate is independent annotated campaign/event
data and verified source coverage, not a new model or an unsupported maliciousness score.

Current bounded readiness milestone: `docs/CLAIM_RUNTIME_PROFILE.md` separates E5
startup/imports from warm inference/cache performance; `docs/CLAIM_EVALUATION_READINESS.md`
defines independent multilingual admission/measurement gates. Engine 3's existing sparse
DBSCAN/account graph remains the baseline; the next slice is structured recurrence
episodes and legitimate viral controls under `docs/ENGINE3_IMPLEMENTATION_PLAN.md`,
including model-specific embedding input contracts. No campaign rewrite or scientific
phase closure has occurred.

- Production inference is cloud hosted. The current Python service is a backend component that can run on managed CPU/GPU infrastructure; it is not a browser or end-user dependency. Move remaining browser ELA/video/audio signal extraction server-side in bounded slices so users need only upload media. See `CLOUD_DEPLOYMENT.md`.

- Model weights, licenses, dataset permissions, and hardware requirements are unresolved. Do not select a checkpoint by architecture name alone or claim quality without an independent evaluation. AASIST speech anti-spoofing does not cover arbitrary synthetic sounds.
- Current browser video sends keyframes, not the original video; server-side frame extraction and audio extraction require a new upload/job path. Existing lightweight flow should remain usable during migration.
- The image fallback can label low heuristic scores `likely_authentic` without a trained classifier. Future local-model paths must use explicit `INCONCLUSIVE` when evidence is weak; do not present heuristic scores as model confidence.
- The 60 MB JSON limit and unauthenticated mutable routes are deployment risks. Restrict exposure until upload validation, rate limits, auth, ownership, and protected SSE/reports are implemented.
- Synchronous in-memory/JSON storage can lose updates under multiple processes. Preserve `data/investigations.json` and verify counts and IDs during any database migration.
- `docker-compose.yml` references a missing `Dockerfile`. Container deployment is currently incomplete.
- `test/forensics.test.ts` checks pure rules, not API, browser, or real model inference. CI is absent. Each engine needs both software-contract tests and a separately reported model evaluation.

## Phase completion rule

Each completed phase requires implemented code, tests run with recorded results, an integration check, changed-file summary, and an updated `IMPLEMENTATION_PROGRESS.md`. A documented plan or adapter alone is not a completed detection engine.
