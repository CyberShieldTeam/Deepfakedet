# Cross-engine diagnostic investigation — 2026-11-16

## Verified scope and reproduction

Started clean on `codex/integrate-figma-upgrade` at `71819c192670bb3ec3b1da8ef4ac17dd1b15d47d`; fetched feature remote matched 0/0. No unexpected changes. The new diagnostic request took priority over further Engine 3 research. No model, classification rule, numerical threshold, calibration reference or episode/coverage/truncation policy was changed.

The exact literal **“Not Enough Evidence” does not occur in this revision**. Reproduced its functional equivalents through the actual Playwright-driven frontend: media authenticity undetermined; claim unavailable/insufficient; network `Insufficient evidence`. Existing preview ports 3000/3001 were not listening during this investigation, so this is a controlled local reproduction, not a claim to have inspected an unseen user's session.

Before application behavior changes, `test/traceCrossEngine.ts` drove seven cases through actual file/claim input, real Express routes, actual Python image processing or deliberately unavailable dependencies, save-to-case, disk storage and authenticated report JSON. Before report: `reports/cross_engine_before.json`. Test services/stores were isolated under `.model-cache`; no real investigation store was read or modified. Fictional corpus documents and generated PNG are authored software fixtures, not research ground truth. Experimental image/face/audio classifiers were deliberately disabled; real YuNet/provenance/signal/video processing was available. No models or datasets were downloaded and no paid/external provider calls were needed.

## Findings by engine

| Engine | Reproduced equivalent | Raw → API → disk/report | Exact responsible stage | Correction | Remaining limits |
|---|---|---|---|---|---|
| Media | Yes: successful measurements and failed service both led with authenticity undetermined | Python returned INCONCLUSIVE with classifier unavailable; server signal measurements remained available. Failed service returned no raw evidence; six client measurement values survived. All API results equalled saved/report records. | `server/mediaPipeline.ts` caught dependency errors into generic warnings/fallback; local-result replacement also dropped common limitations. `plainMedia` emphasized verdict without processing completeness. | Structured stage/error categories, independent processing state/counts, retained upstream limitations and existing raw evidence; explicit partial/unavailable/failed distinctions. | ELA/noise/metadata and uncalibrated model scores cannot establish authenticity. Disabled models did not run. No real-world manipulation accuracy measured. |
| Claim | Yes: retrieved candidates, no matches and unconfigured retrieval shared “We couldn't verify” / “Only basic warning-sign screening” | Three raw relevance candidates became three API passages and the same three saved/report passages. No-match case returned zero; unconfigured case correctly had legacy UNAVAILABLE. No passage loss found. | `src/components/plain.tsx::plainClaim` used heuristic engine/assessment fallback, ignoring retrieval status and retained passages. Legacy verdict `Insufficient Evidence` also conflated unresolved truth with unavailable processing. | Existing verdict retained; separate state, provider/count/filter diagnostics, candidate-review wording, and explicit no-match vs retrieval unavailable/failed. Review recomputes diagnostics without removing partial-retrieval warnings. | Candidate relevance is not entailment/credibility. One nominally unrelated authored document matched a common token under the unchanged gate. No automatic translation, trained entailment or LLM factual judgment ran. |
| Network | Yes: six relationships/18 pair episodes and zero relationships both headed `Insufficient evidence` | Raw counts 6/18 matched API evidence; exact posts/witnesses/episodes/associations subsequently compared in final production trace. Saved/report ledger identical. | `campaignEpisodes.ts` deliberately abstains from campaign/intent judgment; `CampaignView.tsx` used that legacy classification as the observation headline. No detection/evidence loss found. | Show observed relationships, no qualifying relationships or partial processing independently of unchanged campaign classification; expose actual import/unique/candidate/episode/eligibility counts and original safeguards. | Similarity, temporal association and recurrence do not prove common control or maliciousness. Missing coverage is not silence. Semantics remain diagnostic-only; independent campaign accuracy unavailable. |

The small authored corpus intentionally exposed lexical relevance limitations; this task did **not** tune away an inconvenient example. Every source retained by the existing gate remains available for applicability/stance review.

## Processing state contract (additive)

Results optionally add `analysis: AnalysisDiagnostics`. Old fields and receipt/ownership contracts remain. These states concern **processing and the evidence workflow**, not real/fake, true/false or malicious/benign classifications.

| State | Conditions |
|---|---|
| `SUFFICIENT_EVIDENCE` | Claim only: existing attributed exact-quote/context review establishes supported/contradicted/conflicting evidence, with no recorded retrieval/extraction partial condition. Human assessment, not an automated truth probability. |
| `INSUFFICIENT_EVIDENCE` | Relevant observations/candidates were produced but cannot support a stronger validated conclusion. Network relationships remain descriptive. Complete uncalibrated media analysis remains inconclusive. |
| `NO_RELEVANT_SIGNALS` | Successful available claim retrieval produced no retained relevance candidates, or untruncated network analysis produced no qualifying relationships. Applies to this input/window/configuration; never implies false claim, authentic media or no coordination in the world. |
| `ANALYSIS_UNAVAILABLE` | No evidence-producing analysis was available/configured and no technical execution failure was recorded. |
| `ANALYSIS_FAILED` | Input invalid, configured retrieval/execution failed without retained useful observations, or a terminal API/worker failure prevented a completed result. |
| `PARTIAL_ANALYSIS` | Some observations survived missing/failed media stages, retrieval/extraction/source caps, or network truncation. Failed review-provider stages remain partial even after a human assessment. An unused alternate media backend alone does not make successful classifier analysis fail. |

`completeness` means computational processing completeness, not independently proven observation coverage or scientific validity. Network coverage stays in `episodeEvidence`; complete computation on missing coverage cannot establish eligible recurrence. Optional network semantic unavailability does not invalidate lexical processing. Partial/rejected inputs cannot generate a falsely complete result. Failed retrieval can retain HTTP 200 legacy assessment compatibility with `verificationStatus:UNAVAILABLE` and `analysis:ANALYSIS_FAILED`; no factual verdict is generated. Terminal HTTP errors add failure diagnostics and `processingComplete:false`, without a result/receipt. Existing clients can continue reading old fields.

Analysis ID is a random UUID, separate from user inputs. Diagnostics include engine, input validity, state/completeness, stage statuses, actual counts, filtering/limitation reasons, error category and measured elapsed time. Parser failures without an observed start time use null (displayed as not recorded), never an invented zero. `evidenceCount` sums heterogeneous retained observation items for that engine; it is **not** an independent-evidence count, anomaly count or confidence measure. Media explicitly separates client-supplied numeric values, server image measurements, sampled frames, scored segments and raw classifier outputs. Input numeric values are not server forensic attestation.

Claim counts distinguish provider pool, candidates passing the existing relevance gate, duplicates, filtered candidates, retained/omitted passages and reviewed/unassessed stance. URLs, titles, excerpts, provider states, query and missing evidence remain in the owned claim result. Unreviewed neutral sources are not inferred to support, contradict or fail to address a claim. Network counts distinguish imported and valid unique rows, candidates, relationships, pair episodes, eligibility and omitted witnesses. Exact per-rejection network counts are not instrumented; the system says so rather than inventing them.

## Evidence presentation and preservation

- `AnalysisStatus.tsx` presents a concise processing summary. Developer diagnostics expand only on demand. Existing evidence panels/design remain; no percentage confidence was introduced.
- `plainClaim` now uses actual processing/retrieval state. Legacy saved records use their existing explicit availability/source fields without fabricated analysis IDs or rewritten data. Existing reviewed/search-grounded verdict handling remains.
- Network observation headings use retained evidence, including old episode records, rather than treating campaign abstention as no observations. Legacy classification remains in the result.
- Media retains authenticity uncertainty and all measured/local evidence. Common uncertainty/client-attestation limitations now survive local-result replacement. Existing non-inconclusive adapter verdict display is not overridden by the new processing summary.
- API failure messages render as accessible alerts. Claim/network reruns clear the prior transient result; malformed network uploads also clear it. Previous saved investigations remain intact. Failed reruns cannot leave a previous result available to save as the new analysis.
- Report HTML includes processing state, summary, counts, stages and analysis ID; JSON preserves full diagnostics. The executive summary calls legacy claim verdicts unresolved rather than implying every unresolved verdict came from a completed evidence search.

Structured `analysis_diagnostic` logs include only IDs, engine, fixed stage/category names, validity, state/completeness, counts and elapsed time. They exclude content, claims, excerpts, source URLs, filenames, provider detail, payloads and credentials. Detailed source evidence remains in the existing owned response/report. Raw local exception messages were removed from media warning logs. These logs are developer observability, not a new public diagnostics endpoint.

## Tests and actual results

- Initial before trace: seven actual frontend scenarios, all API/disk/report results identical. After trace: seven scenarios, same equality. `cross_engine_preservation.json` asserts substantive raw observation/verdict fields unchanged across before/after (only local `processing_ms` excluded; publication/episode timestamps included).
- Authenticated production trace: seven scenarios; final `cross_engine_production_verified.json` additionally asserts exact raw title/URL/passage/relevance, network post/witness/episode/association and image model/status/face outputs against API, then exact API/disk/report identity and visible state.
- `npm test`: existing full 16-file Node/API suite passed, including 17 upgrade tests, media contracts, claims/review, episodes, receipt/ownership and storage rollback. Updated claim/campaign API tests passed again after adding bad-corpus and malformed/CSV input cases. Legacy verdicts and null decision probabilities preserved.
- `npm run test:diagnostics`: all six states, partial/provider failure, successful no matches, retained inconclusive observations, exact-context reviewed sufficiency, partial-after-review, alternate classifier success, legacy rendering, invalid input, UI/HTML and log privacy checks passed. The first test fixture lacked retrieval provenance and was correctly rejected by the existing review gate; the fixture was corrected, not the safeguard.
- Python: **69 tests, 68 passed, one optional absent-AASIST-weight skip**, 7.04 seconds. Python inference/preprocessing code unchanged.
- TypeScript and final frontend build passed. Existing >500 kB bundle warning remains. New shared status chunk ~1.18 kB / 0.55 kB gzip.
- Development unavailable-dependency browser suite: **10 passed, four configuration skips**, 29.5 seconds. Production equivalent: **10 passed, four skips**, 25.2 seconds. Subsequent production live-service selection: **four passed**, 13.7 seconds, covering stronger malformed-upload recovery, human claim review, signed image and temporal video. Across configurations, only the optional face-classifier checkpoint remains unexercised; the other skipped full-suite workflows passed in the configured selection.
- React review: shared component has no conditional hooks or side effects, escaped rendering, native accessible disclosure/status/alerts, direct imports and small lazy-loaded shared chunk. Existing layout and graph bounds retained.

The test fixtures are deterministic software controls. No claim of real-world accuracy, sensitivity/specificity, successful model calibration or campaign detection quality follows.

## Performance and reproducibility

`reports/cross_engine_diagnostic_overhead.json`: 1,000 warm helper calls/case; median ~0.0015–0.0025 ms and p95 <=0.0059 ms on the seven small fixtures; diagnostic JSON ~904–1,422 bytes. This excludes inference, logging, serialization and rendering. No added model/API requests or detection comparisons in production processing. Existing runtime/source/evidence caps remain. Before/after wall-time differences are not speedup evidence because startup/cache effects differ. The trace script deliberately makes additional raw reference calls for testing only.

```powershell
npm run test:diagnostics
node --import tsx test/traceCrossEngine.ts reports/NEW_trace.json http://127.0.0.1:3317 http://127.0.0.1:3319
node --import tsx test/compareCrossEngine.ts reports/cross_engine_before.json reports/cross_engine_after.json reports/NEW_preservation.json
node --import tsx test/profileAnalysisDiagnostics.ts reports/cross_engine_after.json reports/NEW_overhead.json
```

The trace requires controlled services: normal with a bounded hash-approved authored corpus/Python endpoint, alternate without retrieval and with an unreachable Python endpoint. Optional `VERITAS_TEST_TOKEN`, `CROSS_TRACE_NORMAL_STORE`, `CROSS_TRACE_UNAVAILABLE_STORE` select authenticated production test identity and disk paths. Only run it against explicitly isolated stores: it intentionally creates cases. Screenshots and service/test logs stay ignored in `.model-cache` / `test-results`. Reports refuse overwrite.

## Changed files and next step

Core: `server/analysisDiagnostics.ts`, `server/mediaPipeline.ts`, `server/claimVerification.ts`, `server/security.ts`, `server.ts`, `src/types.ts`. UI: `AnalysisStatus.tsx`, `plain.tsx`, `MediaLabView.tsx`, `ClaimView.tsx`, `CampaignView.tsx`, `ReportModal.tsx`, `ui.tsx`, `src/services/api.ts`. Tests/tooling: diagnostics/trace/comparison/profiling scripts, claim/campaign API regressions, browser tests and package script. Raw reports plus progress/plan document this investigation. Existing investigation files, model code/weights, thresholds and Engine 3 frozen protocols were preserved.

Actual missing dependencies and scientific validation remain separate open tasks. Configure authorized evidence sources and intentionally selected model services before expecting those analyses to run; do not manufacture predictions to compensate. The next scientific milestone remains independent source/evidence and model validation. This investigation fixes observable state/provenance handling; it does not prove detection quality or turn inconclusive observations into positive predictions.
