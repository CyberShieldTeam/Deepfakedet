# VERITAS AI implementation progress

Updated: 2026-11-14. Working branch: `codex/phase1-audit`. Baseline commit: `fa888241d838de9ce835d2277183add633f28d29`.

## Checklist

- [x] Phase 1 — repository audit and staged implementation plan (`IMPLEMENTATION_PLAN.md`).
- [ ] Phase 2a — dedicated general-image and facial-manipulation detectors. General-image ViT inference and Express/UI contract, YuNet face candidates, live HTTP upload smoke, and browser UI upload verification implemented. Representative evaluation, calibration, and a face-manipulation classifier remain open.
- [ ] Phase 2b — AASIST audio detector and segment-level output.
- [ ] Phase 2c — frame-level video detector and evidence timeline.
- [ ] Phase 2d — trained/evaluated temporal video analysis.
- [ ] Phase 3 — evidence-based multilingual text verification with local models.
- [ ] Phase 4 — modality and reasoning-model fine-tuning pipelines and completed training runs.
- [ ] Phase 5 — dataset and model provenance documentation.
- [ ] Phase 6 — calibrated evidence fusion.
- [ ] Phase 7 — Gemini as optional secondary reasoning.
- [ ] Phase 8 — modular backend and inference service/jobs.
- [ ] Phase 9 — safe database migration and persistence.
- [ ] Phase 10 — authentication, authorization, and upload/security controls.
- [ ] Phase 11 — model-aware frontend evidence and progress views.
- [ ] Phase 12 — comprehensive QA and CI test gates.
- [ ] Phase 13 — deployment baseline.
- [ ] Phase 14 — full operating, model, dataset, and training documentation.

## Phase 1 evidence

- Read the repository tree, README, package/config files, backend routes, image calibration and campaign engines, simulated data/scenario, frontend views/API/media signals/types, and existing tests.
- Confirmed existing local heuristics and simulated data are labeled separately from Gemini results. No dedicated pretrained weights, Python service, training pipeline, database, authentication, or CI workflow exists.
- Baseline checks on Node dependencies from `npm ci --no-audit --no-fund`: `npm run lint` passed; `npm test` passed (all campaign/image calibration assertions); `npm run build` passed. Vite reported a non-failing large-chunk warning (770.06 kB JS). The install reported three lifecycle scripts not yet covered by `allowScripts`; no inference model was installed.
- Runtime smoke check: `npm run dev` started and logged the Express/Vite server on port 3000 with Gemini unconfigured. The environment forbade the local socket request, so an HTTP response and browser upload were not verified in this session. No route or UI code changed in Phase 1.
- Runtime files changed: none. Planning files added: `IMPLEMENTATION_PLAN.md`, `IMPLEMENTATION_PROGRESS.md`.

## Next session entry point

Read `MODEL_CARD.md`. The pinned candidate failed the five-fixture smoke check and is restricted to an experimental raw score. Evaluate a stronger model on representative held-out images before permitting local verdicts. Then select a separately licensed face-manipulation model and add face-crop inference. Live HTTP and browser UI uploads pass with the quarantined model. Never mark the engine complete based on an adapter or mock result.

## Phase 2a partial implementation

- Added `ai_service/app.py` and `ai_service/requirements.txt` for optional startup-loaded ViT inference and health reporting.
- Added `server/localImage.ts`, response typing, Express route integration, UI model label/details, environment template entries, a model record, and mocked contract tests.
- `npm run lint`, `npm test`, `npm run build`, and `python -m py_compile ai_service/app.py` passed after this slice. Tests cover the Express adapter contract with mocked service responses, not actual weights or HTTP integration. The build retains its existing large-chunk warning.
- The pinned checkpoint downloaded to ignored `.model-cache/` and real inference ran on 4 genuine + 1 synthetic fixture. Two genuine photos scored >0.95 for the fake class; the synthetic photo scored 0.632. These results are not an accuracy benchmark. Local classification is now forced to `INCONCLUSIVE`; Gemini remains available to form a separate verdict. Raw model output is shown only as experimental evidence.
- Added OpenCV Haar face-region candidates. False candidates appeared on landmark photographs; they are labeled unverified and do not affect the verdict. No face-crop manipulation classifier, calibrated confidence, Grad-CAM, representative evaluation, or end-to-end upload is complete. This phase remains open.
- After the quarantine change, `npm run lint`, `npm test`, `python -m unittest ai_service.test_app -v` (3 tests), and `npm run build` pass. The build retains its large-chunk warning. Browser-to-Express-to-Python integration remains unverified.
- Added an optional pinned Smaug adapter using the publisher's crop/logit method and a crop-geometry unit test. The model remains experimental and cannot return a real/fake verdict. The attempted real smoke run failed before download because `huggingface.co/api/models/.../tree` reset the connection five times, including on an escalated network run. No Smaug output or benchmark is claimed.
- Read-only `git ls-remote` against the same Hugging Face repository also failed with `Recv failure: Connection was reset`. The remaining blocker is access to that host, not a model score. After this slice, Python tests (4), Node tests, and TypeScript check passed; no frontend/runtime behavior changed beyond the optional model selection.
- Replaced Haar face candidates with pinned MIT-licensed YuNet ONNX. `ai_service/download_yunet.py` verifies SHA-256 and stores the binary outside Git. Added CC0 face fixtures and source attribution. YuNet detected the close-up headshot (score 0.944), returned no faces for four landmark photos and the dam image, and missed a distant portrait face. The new optional real-weight smoke test passes; Python tests (5), Node tests, and TypeScript check pass. This is region detection only, not face manipulation classification. Phase 2a remains open.
- Added `test/smokeImageHttp.ts` and `npm run smoke:image:http`. With the pinned Dima checkpoint and YuNet loaded, two real HTTP uploads passed through Express to Python: a landscape returned no face candidates and a CC0 headshot returned face candidates. Both responses remained `inconclusive`, with `confidenceScore: 0` and no decision probability; the raw model probability stayed separate. This checks the server integration, not the browser UI or model accuracy. The local Windows sandbox blocked Python's event-loop socket pair, so the smoke ran with local socket permission. `npm run lint`, `npm test`, `npm run build`, five Python unit tests, and `git diff --check` passed. The build retained the existing large-chunk warning.
- Applied EXIF orientation before local inference and YuNet detection so face coordinates match browser display. Added a regression test with a rotated JPEG. The media view now outlines returned face candidates on the Original image and labels them as unverified regions, separate from any forgery verdict. A real browser upload of the CC0 headshot displayed an inconclusive local-model result and one aligned face box. The publisher's DeiTFake v2 face-crop checkpoint was reviewed but direct Hub access still resets; no face-forgery model was run. Six Python tests passed; Phase 2a remains open.
- Decoupled YuNet face candidates from whole-image model availability. The Python endpoint returns face-only evidence and `INCONCLUSIVE` with a null fake score when YuNet is ready but the classifier is unavailable; it still returns HTTP 503 when neither detector is ready. The Express/UI contract now distinguishes `model_status` and labels this path as local image screening, without crediting a model that did not run. Seven Python tests, Node tests, TypeScript checks, and build passed. Both live HTTP modes passed on the landscape and CC0 headshot fixtures: classifier disabled with face-only screening, then cached Dima enabled with an experimental raw score. Neither mode produced an authenticity verdict. The build retains its existing large-chunk warning. Phase 2a remains open.
