# VERITAS AI implementation progress

Updated: 2026-11-15. Published integration branch: `codex/integrate-figma-upgrade`, tracking the same branch on origin. Reconciled local `ee28104` with fetched `codex/phase1-audit` at `6cadda8` in merge `855b414`, successfully pushed. Earlier read-only-access observations below are historical; Git push is now working. Baseline commit: `fa888241d838de9ce835d2277183add633f28d29`.

## Engine 3 structured episodes and attribution — 2026-11-15

- Continued from `aa28502` on `codex/integrate-figma-upgrade`. Preserved Engine 1/2,
  original union-find/sparse-DBSCAN implementations, earlier commits and raw reports.
  `bede7ad` freezes the episode application, protocol, controls and exact measured
  experiment code before subsequent subprocess-cleanup hardening. No main merge or
  heavyweight model/dependency added. Scientific validation remains open.
- Added named `analyzeDensityCampaignBaseline` and API `density_baseline_v1` comparison.
  Default `episodes_v1` reuses lexical candidate generation, .65 association threshold,
  120-second window, minSamples three, 80-entry lists and 200,000 candidate cap. Optional
  observer hook does not alter legacy baseline results. No clustering threshold fitting.
- Structured records bind each graph edge to actual account/post IDs, source input
  references, original/UTC timestamps, declared/inferred precision, exact text/URL/tag
  observations, one-to-one witnesses and pair-episode IDs. Missing IDs remain null with
  labeled input references; conflicting supplied IDs reject. Duplicate rows collapse.
  Shared coverage/warnings and candidate/evidence omission apply to every association.
- Predeclared `docs/CAMPAIGN_EPISODE_PROTOCOL_V1.md`: per account-pair/content family,
  <=300-second bins, >=30-minute conservative temporal separation, >=three precisely
  identified separated episodes plus complete declared coverage/no truncation for
  recurrence-review eligibility. Coverage is an attestation, not authenticated collection.
  Missing windows/IDs or coarse precision cannot manufacture eligible recurrence. Pair
  episodes are not independently established global events. New outputs abstain from
  accusations: legacy suspicion false/zero and probabilities null, with descriptive states.
- New evidence bounds <=5,000 pairs/20,000 witnesses/eight families per pair; edges without
  retained witnesses are not reported. DBSCAN is reused on the retained graph. Current
  HTML/panel display caps are disclosed separately from analysis truncation; complete
  retained JSON remains downloadable and persists through signed owner-bound case/report
  routes. Existing graph/community inspection, receipt integrity and modality separation
  remain. Weight-total overflow is now rejected instead of producing NaN scores.
- Explicit campaign embedding contract preserves generic raw inputs and supports pinned
  E5 query-prefix similarity only under compatible format/revision. Unsupported settings
  fail to lexical/Jaccard operation. Semantic values are diagnostic-only in episodes v1;
  no retrieval cosine threshold is promoted to campaign detection. Actual cached E5 smoke
  on English/Hindi/Telugu authored sentences returned finite 384-dimensional vectors in
  384.23 ms; incompatible generic/E5 configuration rejected. No quality benchmark claimed.
- Ten frozen authored controls cover all requested legitimate-sharing contexts and a
  separated pattern. One-minute repeated official bulletins: legacy flags four accounts;
  episodes yield one bin per pair and zero recurrence-review pairs. Scheduled bulletins
  and repeated patterns show three pair episodes and six review-eligible pairs, with zero
  automatic suspicious accounts; legitimate alternatives remain explicit. Not independent
  false-positive rates or accuracy. Precision/recall/F1/AUROC remain unavailable/null.
- Separate 3,000-short-post runs: sparse baseline/episodes 96.13/159.00 ms, dense
  1,400.25/1,860.97 ms. Dense episode construction 82.32 ms and final graph 7.23 ms;
  200,000 candidates hit the cap, 5,000 attributable edges retained, recurrence disabled.
  Sampled whole-tree RSS baseline/new: sparse 125.84/138.05 MiB, dense 406.78/444.98 MiB.
  Initial v1 sampler captured only the launcher (~40 MB); its correction file explicitly
  supersedes those memory figures with v2. Exact raw records and caveats are preserved.
  No concurrency, long-text worst-case or p95 SLA is claimed.
- Full Node/API tests, TypeScript and production build passed (existing chunk warning).
  Final Python 69 total: 68 passed, one optional absent-weight AASIST skip; includes actual
  owned launcher/worker termination after cleanup hardening. Actual E5 HTTP contract
  integration passed. Development browser ten passed/two expected skips; authenticated
  production five passed; separate quoted-claim workflow one passed. Graph circles,
  source inspection, JSON download, case saving, cross-owner/tamper rejection and export
  attribution verified. Temporary services stopped. Media and claim workflows retained.
- See `docs/CAMPAIGN_EPISODES.md`, `docs/CAMPAIGN_API.md`. Next: rights-cleared independent
  campaign/event/account annotation with legitimate viral negatives, authenticated capture
  and multi-window coverage, source/time-disjoint evaluation and real workload resource
  tails. Implemented descriptive episodes do not establish malicious coordination or
  close the incomplete scientific gates for any engine.

## Engine 2 reliability/runtime and Engine 3 readiness — 2026-11-15

- Continued from `7b40c48`, retaining all previous implementations and artifacts. No main
  merge, unrelated model, GPU dependency, reserved-data scoring or campaign rewrite.
  Audit confirmed E5 already uses a persistent model and Express caches embeddings;
  these were retained rather than duplicated.
- Added named startup and bounded per-request timing scopes. Historical 70.789 s measured
  Encoder setup/imports/hashes/tokenizer/model loading, not full process startup or query
  computation. New fresh-process ready times 28.570/23.786 s with warm OS caches; Encoder
  loads 26.926/22.150 s, mostly torch/transformers imports. Do not attribute the historical
  difference causally to optimization. Peak working sets 709.81/703.36 MiB. Warm direct
  HTTP inference 68.96–103.18 ms; repeated vectors identical on fixed controls.
- Strengthened existing cache with endpoint identity, within-request text deduplication,
  sequential <=32-text/60,000-character requests and whole-result validation before cache
  insertion. Same weights, CPU thread one, 512 tokens/batch eight model computation and
  existing fallback/TTL/cap. Warm application E5/hybrid queries made zero embedding calls;
  measured .28–.53/.15–.53 ms excluding external evidence acquisition. No memory reduction
  or latency percentile claim. `docs/CLAIM_RUNTIME_PROFILE.md` records exact scopes/limits.
- Preserve distinct same-URL passages and cross-publisher attribution/ratings, removing
  exact duplicate records only. Review source IDs prevent ambiguous URL assignment.
  Candidate omission is disclosed and blocks decisive review until narrowed. Existing
  exact quotes, context, receipt ownership, dates and null confidence remain. Regression
  tests cover same-URL conflicts, numerical/date/location/negation and ambiguous language.
- Reviewed authoritative FEVER, AVeriTeC, X-FACT, IndicClaimBuster, IndicLink and MultiClaim
  terms, annotations and access. No independent corpus admitted or restricted data fetched.
  Public permissive rights are distinguished from missing compatible evidence/lineage;
  generated evidence/translations are not independent factual labels. Details and next
  admission protocol: `docs/CLAIM_EVALUATION_READINESS.md`, `EVALUATION_DATASETS.md`.
- Added tested Recall@K/Precision@K/MRR/optional graded nDCG math and source/translation/hash
  split guards. New fixed BM25/E5-only/hybrid comparison: nine fictional queries, twice
  per method (54 executions, not 54 independent samples). Top-1 relevance 6/9 vs 9/9 vs
  9/9; cross-language 0/3 vs 3/3 vs 3/3. No parameter fitting. Independent retrieval,
  agreement accuracy and graded nDCG remain unavailable/null. Old reports unchanged.
- Engine 3 code unchanged. Authored public-news controls show four accounts flagged for
  repeated one-minute legitimate-style bulletins, highlighting recurrence inflation and
  same-event confounding, not a real-world false-positive rate. Documented shared E5
  prefix-contract incompatibility, evidence-record gaps and a bounded episode-based
  next slice with acceptance gates in `docs/ENGINE3_IMPLEMENTATION_PLAN.md`.
- Verification: full Node/API suite passed; Python 68 total, 67 passed/one optional
  absent-weight AASIST skip; actual embedding HTTP/profile integration passed. TypeScript
  and production build passed (existing large-chunk warning). A new test fixture initially
  needed explicit required URL typing; fixed and TypeScript rerun. Development browser
  nine passed/two expected skips; authenticated production four passed; separate quoted
  corpus review/case workflow one passed. Production auth 401 and built assets verified;
  temporary workers/servers stopped. Final diff/preservation checks recorded before push.
- **Scientific Phase 3 validation remains open.** Next: approved independent claim/evidence
  corpus and frozen protocol; Engine 3 next implementation should add inspectable episodes
  and legitimate-event controls, not new maliciousness models or a large rewrite.

## Phase 3 evidence-engine implementation — 2026-11-15

- Explicit user authorization begins Phase 3 from `dd6b1ca`, retaining `feb5d74`, all
  Phase 2 functionality and incomplete validation. No main merge, temporal optimization,
  image model search or reserved dataset access. Starting gaps were recorded before
  implementation in `docs/CLAIM_AUDIT.md`.
- Extended existing claim APIs, evidence pipeline, embedding adapter, receipts and case
  workflow instead of creating a second system. Added Unicode normalization, approximate
  English/Hindi/Telugu/mixed script diagnostics, conservative sentence candidates and
  bounded exact entity-like spans. No full multilingual NER/translation/entailment claim.
- Added modular provider states, operator-approved/hash-bound local corpus retrieval,
  bounded optional Google Fact Check parsing, canonical URL/excerpt deduplication,
  timestamps and attribution. No real Fact Check key was present; live external retrieval
  was not run. Corpus review/rights remain operator responsibilities.
- Automatic status abstains with UNAVAILABLE or INSUFFICIENT_EVIDENCE. Optional human
  conclusions require signed owner-bound results, exact retrieved quotes and explicit
  full-assertion/context review; contradictions/conflicts are distinct. Google reviewed-
  claim metadata alone cannot satisfy that gate. Free-form Gemini claim summaries were
  removed to keep explanations traceable; media Gemini paths remain. Confidence null.
- Added optional separate offline-only pinned E5-small CPU service. MIT publisher
  snapshot `614241f622f53c4eeff9890bdc4f31cfecc418b3` verified against six Git/LFS hashes;
  safetensors, no remote code, CPU one thread, batches eight, 512 tokens, 2 GiB available
  load headroom. Not enabled by default; no model download/startup in the browser or
  existing media service. Actual weights remain in ignored cache.
- Authored fictional retrieval controls: nine passages/queries, three languages.
  BM25 topic top-1 hits 6/9; hybrid 9/9. Cross-language subset 0/3 versus 3/3. Three
  negation/date/location mismatch queries measure topic relevance, not factual agreement.
  Zero independently labeled factual claims; verification/entailment accuracy remains
  unavailable. Raw hashed rankings/resources in `reports/claim_*_v1.json`.
- Actual local model startup 70.789 s; peak working set 744,275,968 bytes (709.8 MiB).
  Hybrid query wall times 33.85–594.51 ms with cache reuse, Node RSS 92,893,184 bytes.
  Single-run diagnostics, no SLA/generalization claim. No new dependencies installed.
- Final checks: Node/API contracts (including new claim unit and API suites) passed;
  TypeScript and production build passed, retaining the existing large-chunk warning.
  Python 66 total: 65 passed, one optional absent-weight AASIST skip. The first new test
  used an unavailable Starlette TestClient dependency; aligned it to existing direct
  function tests without installing dependencies, then reran the full suite successfully.
- Actual browser: full development nine passed/two expected skips (optional face model
  and separate corpus setup); authenticated production four passed, with 401 protection
  and built assets verified. Dedicated fictional corpus quote/review/case workflow one
  passed. Screenshot inspected. HTML export preserves escaped passages/status/reviewer
  attribution; API tests confirm persisted review metadata. Temporary services stopped.
- **Phase 3 remains partial and scientifically open.** Next milestone: rights-cleared,
  independently annotated claim/evidence pairs in all three languages, audited splits,
  frozen retrieval/abstention protocol and separate relevance/entailment evaluation.
  See `docs/CLAIM_VERIFICATION.md` for API/configuration, actual measurements and limits.

## Temporal scientific-readiness assessment — 2026-11-15

- Continued from `a6733103992bee8417cd8ad860b2f403570e5f17` on
  `codex/integrate-figma-upgrade`; no main merge, history rewrite or reserved-data access.
  `feb5d74` preserves exact experiment code and raw reports; later admission hardening
  leaves the temporal policy and historical report bytes unchanged.
- Added shared evaluation file verification and a gated development-only video evaluator:
  hashes, reviewed dataset registry and evidence, source/identity-disjoint splits,
  derivative lineage, CFR/native metadata/codec checks, independent annotation gates,
  complete/incomplete denominators and structured reproducible reports. Validation media
  are not opened/scored. Registry metadata requires real operator review; it cannot
  automatically certify legal permissions, subject identities or independent truth.
- Reviewed authoritative FaceForensics++, DFDC, DAVIS, GenVideo/DeMamba, GenVidBench
  and permissively licensed TUM RGB-D sources. Exact access/license/label limitations
  are recorded in `EVALUATION_DATASETS.md`. Both tested compact TUM preview URLs returned
  HTTP 404. No restricted video was downloaded. Independent data remains unavailable.
- Used the authorized fallback: 20 procedural H.264 software controls, one correlated
  source group, with raw/encoded hashes and exact generation settings. No authentic
  camera or independently labeled manipulated/generated video was evaluated. Sixty
  executions span .5/.25/1-second sampling; baseline counts 16 intervals per source
  minute (occlusion 12, patch appearance four), sensitivities six and ten. These are
  control candidate burdens, not genuine-video false-positive rates or deepfake accuracy.
- Neither predeclared offline filter removed candidates; neither was deployed. Existing
  motion compensation, scene/quality gates, thresholds and eight-second deadline remain.
  Native decoder metadata is additive; no heavyweight model, verdict or probability added.
  Temporal/spatial localization precision/recall remains unavailable, not zero.
- Measured across 60 runs: worker .1614–1.1863 s, subprocess wall .6764–1.7631 s,
  worker peak 82.42–100.42 MiB; all completed. These are single-run observed ranges,
  not service latency percentiles. `docs/VIDEO_TEMPORAL_EVALUATION.md` provides the
  protocol, artifacts, limitations and independent-data next gate.
- Final Python: 64 tests, 63 passed and one optional absent-weight AASIST skip; includes
  actual worker kill with a temporary short test budget, unchanged production deadline.
  Node/API contracts and HTML export escaping/temporal contents passed; TypeScript and
  build passed with the existing large-chunk warning. Browser: development eight passed
  and one optional face-checkpoint skip; authenticated actual production three passed,
  unauthorized API access returned 401 and built assets were verified. A rerun initially
  used `AI_SERVICE_URL` instead of `VERITAS_AI_SERVICE_URL`; three browser tests correctly
  failed without evidence. Correcting the launcher restored all expected passes without
  product changes or increased timeouts. Temporary servers were stopped.
- **Phase 2d remains open and scientifically unvalidated.** Next: curate authorized
  independent camera/manipulation data, audited groups/identities and complete independent
  interval labels; freeze the next protocol before inference. No new model until the
  bounded baseline has independent evidence of diagnostic utility and nuisance burden.

## Current reconciliation, browser and temporal work — 2026-11-15

- User approved reconciliation after the 11-local/7-remote divergence report. Both
  histories and all evaluation artifacts are retained, with no force-push or main
  merge. Independent evaluator/crop-policy variants remain under explicit names;
  `docs/HISTORY_RECONCILIATION.md` maps their interfaces. Remote progress is preserved
  separately as history. The original provenance commits remain ancestors.
- Both provenance routes use the strict offline original-byte SDK validator and
  operator trust anchors. SDK/HTTP fixtures again verified absent, untrusted-valid,
  explicit test-trusted, altered binding invalid and remote-only unavailable states;
  results saved separately as `reports/image_evidence_reconciled_smoke.json`. No
  reserved images/manifests were opened or scored; original benchmark results unchanged.
- Dev navigation root cause isolated to broad Vite watching in this Windows/OneDrive
  workspace. Fixed watcher ignores preserve HMR. Fixed navigation .510 s versus a
  12.01 s diagnostic timeout; restoring broad watching reproduced the timeout with
  warm caches. Four raw reports and `docs/DEV_NAVIGATION_DIAGNOSIS.md` retain evidence.
- Added bounded CPU temporal endpoint comparisons, quality/scene/camera-motion
  observations, localized residual regions, explicit insufficient/partial/timeout
  states, UI interval inspection/seek and report export. No probability or trained
  temporal model. Worker <=25 frames/24 pairs, <=480 long side, hard 8-second deadline;
  older classifier/audio stages have separate budgets, not a whole-endpoint 8-second SLA.
- Resource smoke on three existing transport inputs: worker .299–.826 seconds,
  subprocess .866–1.421 seconds, peak worker 83.00–108.34 MiB. These are single-run
  software measurements; normal test patterns triggered candidate changes. No detector
  accuracy or calibrated video-level conclusion follows.
- Final checks: Python 54 tests, 53 passed/one optional AASIST-weight skip; Node/API,
  TypeScript, production build, pip and diff checks passed. Development browser suite:
  8 passed/one optional face-checkpoint skip. Actual NODE_ENV=production server with
  temporary authentication: three forensic browser workflows passed. Real YuNet image
  and video face/adjacent-flow HTTP smokes passed. Screenshots inspected; existing
  non-failing build chunk warning remains. Initial missing psutil, fixture count
  assumption and temporal-only browser expectation were corrected and checks rerun.
- Phase 2a/2c representative validation/calibration, trained Phase 2d, and overall
  production readiness remain open. Eight future methods reviewed without installing
  heavy dependencies or claiming vendor scanning access. Next milestone: independent
  annotated temporal/quality corpus and measured false-candidate burden/resource tails.


## Checklist

Classifier-search decision (2026-11-15): **PATH B recommended. Pause further Phase 2a model searches;
Engine 2 implementation awaited explicit approval, now provided for Phase 3 above.** This closes the bounded advanced
evaluation/decision task, not Phase 2a validation or production readiness. New evidence
and proposed gates: `docs/ADVANCED_IMAGE_MODEL_EVALUATION.md`.

- [x] Phase 1 — repository audit and staged implementation plan (`IMPLEMENTATION_PLAN.md`).
- [ ] Phase 2a — dedicated general-image and facial-manipulation detectors. General-image inference, YuNet, optional experimental face-crop classifier, Express/UI contracts, real HTTP/browser verification and development benchmarking implemented. Independently source-audited evaluation, calibration and validated face-manipulation detection remain open.
- [ ] Phase 2b — AASIST audio detector and segment-level output. Official checkpoint inference, resampling, segments, Express/UI contract, live HTTP smoke, browser WAV upload, and bounded video-audio extraction implemented. Speech activity detection, representative evaluation/calibration, and file-format coverage remain open.
- [ ] Phase 2c — frame-level video detector and evidence timeline. Browser-sampled frames and bounded server-side original-video decoding supply timestamped local image evidence; original-video frame selection uses documented exposure/detail heuristics, and video audio is separate AASIST evidence when available. Representative evaluation, face-manipulation inference, quality-aware aggregation, and a long-clip upload/job path remain open.
- [ ] Phase 2d — trained/evaluated temporal video analysis.
- [ ] Phase 3 — partial auditable multilingual evidence retrieval and attributed quote-based review implemented, optional pinned local E5-small software comparison complete; independent multilingual relevance/entailment validation remains open.
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

## C2PA/metadata and image signal diagnostics — 2026-11-15

- User explicitly selected this slice after sharing a forensic-methods attachment and
  article. Added independent Python `/v1/image/evidence`, optional pinned C2PA SDK 0.39.0,
  explicit signer trust, original-byte validation and bounded EXIF/FFT/noise measurements.
  Existing image classifier, face/audio/video implementations and inconclusive policy
  are preserved. No model search, training, Engine 2 implementation or reserved-data
  access occurred.
- Added optional original-byte transport alongside resized classifier input, strict
  Express validation, typed evidence responses, UI and escaped report export. Missing
  EXIF/C2PA and generic `algorithmicMedia` are not turned into AI verdicts. Remote
  manifests/OCSP are not fetched; test certificates are never production trust defaults.
- Actual SDK smoke: unsigned absent, signed valid-untrusted, explicitly test-trusted
  valid-trusted, changed image binding invalid, remote-only unavailable. All three
  unsigned/signed/altered HTTP cases matched while sending a separate classifier resize;
  no decision probability. `reports/image_evidence_smoke.json` retains hashes/results.
- Checks: full Python 39 tests, 38 passed and one AASIST-weight skip; final seven image
  evidence tests also passed. Node/API, TypeScript, build, pip check and existing real
  YuNet HTTP smoke passed. Two browser upload tests passed against the built client and
  real Express/Python API; screenshot inspected. Two development-server browser runs
  timed out during initial navigation before feature assertions. Font isolation alone
  did not resolve that; built-client validation bypassed Vite middleware, without fixing
  or claiming resolution of development navigation. Existing build chunk warning remains.
- Full scope, setup, limitations, method corrections and next research boundaries:
  `docs/IMAGE_PROVENANCE_AND_SIGNALS.md`. This is provenance/measurement software, not
  validated image detection or completed Phase 2a. No remote push/merge.
  Local implementation commit: `fc836c1`.

## Advanced image evaluation decision — 2026-11-15

- Advanced evaluation update: `ai_service/advanced_image_audit.py` audited only the
  development manifest and 96 listed images; all checksums passed, no decoded/pHash
  duplicates, minimum pHash distance 14. Source groups are filenames, independence and
  individual rights remain unresolved. All synthetics are 1024-square and all genuine
  images larger/nonsquare; quantization tables differ. Existing benchmark estimates
  remain exploratory. Reserved images/manifest were not accessed or scored.
- Smaug and official UniversalFakeDetect were investigated with pinned sources and
  preprocessing. Saved resources: 3.060 GiB free RAM / 3.457 GiB available commit, no
  CUDA. Conservative free-memory gates (5/4 GiB respectively) deferred checkpoint loads;
  publisher UFD validation also hardcodes CUDA. These are preflight deferrals, not
  failed checkpoint loads or successful inference. Local accuracy, latency and peak
  inference memory remain unmeasured for both. Main environment unchanged.
- Proposed project-specific gates distinguish exploration, source-independent
  validation, separate calibration, a locked final test, and production approval.
  The three already measured models do not qualify; no further candidate search or
  Engine 2 implementation was started. Image verdicts remain `INCONCLUSIVE`.
- This session's checks: Python 32 total, 31 passed / one skipped (AASIST weights absent);
  Node/API tests, TypeScript, production build and live Express-to-Python YuNet
  face-only HTTP smoke passed. Existing Vite chunk warning remains. Application,
  face/audio/video code and contracts unchanged. Local audit commit: `db67a14`.
## Cross-branch integration checkpoint — 2026-11-14

- Integrated `figma-veritas-upgrade` into a local branch based on `codex/phase1-audit`; `main` was not modified. The source branches had diverged by six Codex commits and one Figma commit.
- Retained the Figma security, ownership, atomic repository, evidence retrieval, sparse DBSCAN, professional UI, API, and browser-test architecture.
- Reattached the pinned Python image/YuNet, AASIST, and bounded video evidence paths through `server/mediaPipeline.ts`. Their raw outputs remain separate experimental evidence and cannot become calibrated verdicts.
- Extended the validated media contract to accept bounded MP4/MOV/WEBM original-video bytes so server decoding and video-audio extraction survive the secured Figma route.
- Added shared local-evidence types, model-aware UI panels, original-video upload for clips up to 8 MiB, combined environment documentation, and a cross-branch regression test.
- Verification on the integrated tree: TypeScript check passed; all legacy, 17 upgrade, local image/audio/video contract, cross-branch integration, and API security tests passed; 20 Python tests passed with two optional real-weight smokes skipped because weights are intentionally absent; production build passed with the existing large-chunk warning; all six Chromium end-to-end tests passed; `git diff --check` passed.
- No model-accuracy claim follows from this integration. Representative evaluation, calibration, face-manipulation inference, temporal video inference, and trained multimodal fusion remain open.

## Phase 1 evidence

- Read the repository tree, README, package/config files, backend routes, image calibration and campaign engines, simulated data/scenario, frontend views/API/media signals/types, and existing tests.
- Confirmed existing local heuristics and simulated data are labeled separately from Gemini results. No dedicated pretrained weights, Python service, training pipeline, database, authentication, or CI workflow exists.
- Baseline checks on Node dependencies from `npm ci --no-audit --no-fund`: `npm run lint` passed; `npm test` passed (all campaign/image calibration assertions); `npm run build` passed. Vite reported a non-failing large-chunk warning (770.06 kB JS). The install reported three lifecycle scripts not yet covered by `allowScripts`; no inference model was installed.
- Runtime smoke check: `npm run dev` started and logged the Express/Vite server on port 3000 with Gemini unconfigured. The environment forbade the local socket request, so an HTTP response and browser upload were not verified in this session. No route or UI code changed in Phase 1.
- Runtime files changed: none. Planning files added: `IMPLEMENTATION_PLAN.md`, `IMPLEMENTATION_PROGRESS.md`.

## Next session entry point

### 2026-11-15 — failure analysis and fair development benchmarking

- Reviewed attached AGENT history, plan, progress, model cards and completed parity; did not repeat the parity investigation. Production inference and face integrations were preserved.
- Found the original 40 synthetic examples all came from Digicam. Original scored-set imbalance (31 genuine / 40 synthetic) resulted from nine genuine images over the pixel limit. Visual case review, source-size/JPEG metadata, threshold sweeps and paired JPEG75/max512 experiments are recorded without assuming a unique cause.
- Added benchmark statistics/uncertainty, process memory and latency, fixed checkpoint processors, source/perceptual overlap guards, final-role rejection and a separate partition audit. Initial fresh reserved set is documented as single-generator-biased; V2 improves selection by enumerating six generator folders per category.
- Prepared 96 fresh generator-stratified development images and 96 unscored reserved images. Every cached checksum passed; no known cross-partition SHA/group/pHash overlap was detected (minimum distance 12, guard threshold 6). Original-source/identity and training overlap remain unverified, so the final split is provisional.
- Benchmarked Community, Dima and Organika SDXL on both exposed-original and V2 development sets with fixed 0.5 threshold and three variants. V2 original AUROCs: 0.634 / 0.608 / 0.734; recalls 20.83% / 95.83% / 75.00%; FPRs 0/48 / 85.42% / 43.75%. No candidate promoted; no threshold fitted or model fine-tuned. Reserved samples were not scored.
- Investigated Smaug, UniversalFakeDetect and TruFor. Smaug/CLIP comparisons were deferred at resource/runtime preflight (no GPU; 3.48 GiB available RAM; Smaug publisher runtime requires transformers 5.x while service pins <5). TruFor addresses manipulation localization and was not conflated with full-generation detection.
- `npm run lint`, full `npm test`, `npm run build` and live image HTTP uploads passed; Python discovery ran 30 tests, 29 passed and one optional AASIST weight test skipped. Four new benchmark regressions and actual split audit passed. Existing Vite chunk warning remains.
- Reports: `docs/IMAGE_FAILURE_ANALYSIS.md`, `docs/IMAGE_MODEL_BENCHMARK.md`, per-image model JSONs, partition manifests, overlap audit and resource inventory. Code commit `d960acb` is local; no push/merge occurred. Recommended next work: isolated modern-candidate runtime with adequate memory, plus source/identity-audited independent evaluation data. Image outputs remain inconclusive.

### 2026-11-15 — Community Forensics publisher-code parity

- Added `ai_service/parity_community.py`. Executed exact reviewed publisher AST definitions at `ee5b71d43db0f3779e1edd64ee927b13f2dd6ad4`, strict-loaded pinned weights and compared with the VERITAS adapter on the same cached screening inputs.
- All parameters identical; 71 image comparisons passed with maximum tensor/logit/sigmoid differences 0.0; nine oversized images skipped. None of the compared inputs changed under EXIF orientation.
- Saved source/checkpoint/manifest hashes and runtime versions in `reports/community_parity_2026-11-15.json`; methodology and limits in `docs/COMMUNITY_PARITY.md`. Syntax compilation and diff checks passed. No production inference code changed.
- Poor screening performance is not explained by an adapter mismatch on this set/runtime. Next work is error/data review and model comparison on development data; this parity pass does not complete Phase 2a or validate the separate face classifier.

### 2026-11-15 — real-weight screening and abstention decision

- Added pinned Community Forensics adapter and bounded Mirage subset preparation, plus a direct-local reproducible scoring command. Weights and source images remain ignored; raw report and manifest are in `reports/image_screening_2026-11-15.json`.
- Ran 80 samples across four domains: 71 scored, nine genuine samples skipped at the pixel limit; 3/40 synthetic detections, 0/31 genuine false positives, AUROC 0.575806 at predeclared 0.5 threshold. No model promotion or fitted calibration follows.
- Ran face screening on 20 Human samples; generated-image labels do not establish facial-manipulation accuracy. High raw outputs on several genuine-labeled inputs reinforce abstention.
- TypeScript, full Node/API suite and Python discovery passed (25 passed, one optional AASIST-weight test skipped). See `docs/IMAGE_SCREENING_RESULTS.md` for limitations and remaining acceptance requirements. Phase 2a remains incomplete rather than relabeling a small screening subset as validation.
- Live HTTP uploads passed with cached Community Forensics, YuNet and DeiTFake all loaded: raw outputs traversed Express and the response retained `inconclusive`, confidence 0 and null decision probability. Model identity is now configurable in the smoke script.

### Phase 2a evaluation foundation

- Added optional pinned DeiTFake v2 face-crop inference, crop guards, separate health/evidence states, Express validation, and UI evidence display. Verified publisher revision, Apache-2.0 declaration, safetensors availability, labels and processor settings.
- Installed the native Python inference runtime and checksum-verified YuNet. Actual DeiTFake headshot inference returned raw fake-class output 0.997509; distant portrait returned no faces. These fixtures do not establish accuracy. The face model remains experimental and cannot supply a verdict.
- Added face crop, unavailable/failure, and malformed upstream evidence tests. Representative evaluation and calibration remain incomplete; Phase 2a is not marked complete.
- Verified actual Express-to-Python image uploads with DeiTFake enabled and the whole-image classifier disabled: landscape had no faces, headshot carried experimental face scores, and both remained inconclusive. Python discovery: 26 tests, 25 passed, one optional AASIST-weight test skipped. Node/API suite, TypeScript and build passed; existing bundle warning remains.
- Final connected-service Chromium run: all seven workflows passed, including a new actual headshot upload that verifies DeiTFake evidence in the HTTP response and rendered panel. Unified the uncertainty headline for inconclusive local evidence. React checklist reviewed the two edited components; no new hooks or client inference were introduced.

- Added `ai_service/evaluate_image.py` and `docs/IMAGE_EVALUATION.md`: provenance/checksum manifests, source-group split isolation, duplicate checks, per-sample raw scores, split/domain diagnostics and tie-corrected AUROC. Failed samples remain counted; model identity drift aborts evaluation.
- Closed an existing quarantine bypass in `server/localImage.ts`: the adapter rejects non-inconclusive classifications and the mapper always abstains, including when invoked directly. Regression tests cover forged upstream verdicts.
- TypeScript check, complete Node/API suite, and 10 Python evaluation/image tests passed (one optional YuNet real-weight test skipped). Evaluation metrics were tested using synthetic score rows, not a detector benchmark.
- No representative dataset or new checkpoint inference was run in this slice. Face classifier integration, representative evaluation, calibration, and phase completion remain open. See `docs/IMAGE_EVALUATION.md` for the next evaluation run.

Read `MODEL_CARD.md`, `AUDIO_MODEL_CARD.md`, and `VIDEO_ENGINE.md`. The image checkpoint remains quarantined as an experimental raw score, including when applied to video frames. Evaluate stronger image and face-manipulation models on representative held-out data before permitting local verdicts. For Phase 2c, add a streaming upload/job path and quality-aware frame selection and aggregation. Never mark an engine complete based on an adapter, mock result, or transport smoke.

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

## Phase 2b partial implementation

- Reviewed the official MIT-licensed NAVER Clova AI AASIST source, pinned commit `a04c9863f63d44471dde8a6abcb3b082b07cd1d1`, and verified the official 1.28 MB checkpoint SHA-256 `51d2d9cf0738172f61e2a384ec50a54a55363240f67c971ed55a92435bc1a1c0`. Vendored the network definition and license; kept weights in the ignored model directory. `AUDIO_MODEL_CARD.md` records scope and limits.
- Added an optional Python AASIST endpoint with libsndfile decoding, channel downmix, polyphase 16 kHz resampling, 4.0375-second timestamped windows, repeat padding, and a silence gate. The model loads with `weights_only=True` and strict key matching. It reports uncalibrated per-segment raw scores and always returns `INCONCLUSIVE`.
- Added Express adapter and UI evidence display. If Gemini is available, AASIST evidence stays separate from its verdict. If the local audio service is unavailable, the existing fallback remains. The model registry checks Python audio health before advertising readiness.
- A real-weight software smoke on the existing 44.1 kHz WAV fixture produced three timestamped segments. The live HTTP upload through Express to Python passed with an inconclusive response and no decision probability. This is not an accuracy test; the fixture has no verified authenticity label. Phase 2b remains open.
- The browser WAV upload also displayed an inconclusive AASIST result and three timestamped segment outputs. The raw spoof-class output rounded to 1.000 on this fixture, demonstrating why it must not be presented as a calibrated probability or verdict. Updated the UI to show raw decimals and a clear missing-calibration message. The model registry health check reported AASIST `ONLINE` with `No VERITAS accuracy benchmark; scores uncalibrated`. Added pre-decode duration/channel checks to reject oversized compressed clips before sample allocation. Thirteen Python tests, Node tests, TypeScript checks, build, and the live HTTP smoke passed; the build retained its large-chunk warning.

## Phase 2c partial implementation

- The browser now sends up to six timestamped JPEG frames from its existing 16-frame sampler. Express validates the frame count and ascending timestamps, screens each frame through the optional local image endpoint, and returns per-frame raw outputs and face candidates as separate evidence. The UI marks screened frames on the existing timeline and shows their experimental outputs in technical details.
- When Gemini is unavailable and local screening succeeds, the video result is always `inconclusive` with zero confidence and no decision probability. With Gemini available, local frame evidence is attached separately and does not change its verdict. The Dima image checkpoint remains quarantined; no frame score is treated as a calibrated video probability.
- Added a 3-second FFmpeg-generated transport clip and extracted frames with explicit source and no authenticity label. The live Express-to-Python HTTP smoke passed on three timestamped frames using cached Dima and YuNet. A browser upload of the clip displayed 16 sampled frames, six marked as locally screened, and an inconclusive result with no calibrated probability. These tests check transport and rendering, not detection accuracy.
- `npm run lint`, `npm test`, `npm run build`, and `git diff --check` passed for this slice. Phase 2c remains open: server-side original-video decode, validated upload limits, frame quality/face selection, aggregation, representative evaluation, and video audio extraction are not implemented. Phase 2d temporal model work has not begun.
- Added a bounded original-video route in Python using OpenCV. For clips up to 8 MB, it checks container signature, duration (120 s), frame count (3,600), and dimensions (1920×1080), then decodes up to six timestamped frames. Express prefers this route and falls back to browser-sampled frames if it fails. The source is recorded in the response; either way, local video authenticity remains inconclusive.
- Python decoder tests passed with the test-pattern clip and malformed/oversized inputs. Node contract tests, TypeScript check, and build passed. A real HTTP upload through Express to Python returned six server-decoded frames; a browser upload displayed the original-video source and inconclusive result. The clip is unlabeled transport data, so no accuracy claim follows. The first browser rendering marked neighboring thumbnails too broadly; nearest-frame mapping now limits each decoded frame to one timeline marker. After this correction, 15 Python tests, Node tests, TypeScript check, build, and git diff --check passed. The browser showed six timeline markers. The build retained its existing large-chunk warning.
- Added heuristic original-video frame selection: for each of six time windows, the decoder compares up to three nearby frames using detail, luma, and clipped-pixel measurements. It returns the chosen frame's timestamp and quality metrics alongside experimental image evidence. A synthetic selector test verifies that a clear neighboring frame wins over a flat one. These heuristics are not validated quality scores or authenticity evidence.
- After this slice, 17 Python tests, Node contract tests, TypeScript check, build, git diff --check, and the live original-video HTTP smoke passed. A browser upload showed six selected frames and their quality measurements in technical details while keeping the video result inconclusive with no calibrated probability. The test pattern is unlabeled, so detection accuracy remains unevaluated. The build retained its existing large-chunk warning.
- Added bounded video-audio extraction through the bundled FFmpeg executable: first audio track, at most 60 seconds, mono 16 kHz WAV. The original-video response reports analyzed/no-audio/model-unavailable/extraction-failed explicitly; AASIST segment output is attached only when the model runs. Image and audio evidence stay separate and never produce a local video authenticity verdict. The browser technical details show raw segment values and state that speech presence was not verified.
- Added an FFmpeg-generated test clip with a 440 Hz tone solely for transport testing. Python tests cover silent video, extracted audio, unavailable AASIST, and inference failure that preserves frame evidence. Twenty Python tests, Node tests, TypeScript check, build, git diff --check, live Express-to-Python HTTP smoke, and browser upload passed. The live run returned six decoded frames and one separate AASIST segment, with an inconclusive video result and no calibrated probability. The tone is not speech and cannot evaluate AASIST accuracy; representative speech evaluation, calibration, and multimodal fusion remain open. The build retained its existing large-chunk warning.
