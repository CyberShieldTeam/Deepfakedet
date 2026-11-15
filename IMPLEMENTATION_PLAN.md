# VERITAS AI implementation plan

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
| 3. Text | Local multilingual embeddings plus keyword retrieval, evidence provenance, and a contradiction model evaluated for English/Hindi/Telugu. Keep unsupported claims insufficient; retain optional Search/Gemini. | Evidence corpus or configured retrieval source; language-specific evaluation | Very high |
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

- Model weights, licenses, dataset permissions, and hardware requirements are unresolved. Do not select a checkpoint by architecture name alone or claim quality without an independent evaluation. AASIST speech anti-spoofing does not cover arbitrary synthetic sounds.
- Current browser video sends keyframes, not the original video; server-side frame extraction and audio extraction require a new upload/job path. Existing lightweight flow should remain usable during migration.
- The image fallback can label low heuristic scores `likely_authentic` without a trained classifier. Future local-model paths must use explicit `INCONCLUSIVE` when evidence is weak; do not present heuristic scores as model confidence.
- The 60 MB JSON limit and unauthenticated mutable routes are deployment risks. Restrict exposure until upload validation, rate limits, auth, ownership, and protected SSE/reports are implemented.
- Synchronous in-memory/JSON storage can lose updates under multiple processes. Preserve `data/investigations.json` and verify counts and IDs during any database migration.
- `docker-compose.yml` references a missing `Dockerfile`. Container deployment is currently incomplete.
- `test/forensics.test.ts` checks pure rules, not API, browser, or real model inference. CI is absent. Each engine needs both software-contract tests and a separately reported model evaluation.

## Phase completion rule

Each completed phase requires implemented code, tests run with recorded results, an integration check, changed-file summary, and an updated `IMPLEMENTATION_PROGRESS.md`. A documented plan or adapter alone is not a completed detection engine.
