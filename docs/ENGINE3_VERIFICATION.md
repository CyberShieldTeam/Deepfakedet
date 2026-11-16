# Engine 3 verification record — 2026-11-16

## Story and boundary evidence

An analyst uploads observed posts through Network intelligence; Express validates input,
executes bounded lexical graph/episode analysis in a private worker, optionally annotates
semantic diagnostics, returns signed evidence, and preserves it through graph inspection,
owner-scoped case attachment and report export.

| Boundary | Result | Evidence |
|---|---|---|
| Upload → API | Pass | Real browser JSON uploads; invalid coverage, IDs, timestamps and caps tested in Node/API suites |
| API → worker | Pass | Default and named baseline responses; Unicode transport; invalid input, deadline, interruption, busy and recovery tests |
| Worker → response | Pass | Exact IDs/original/UTC times, witness/episode measurements, conservative precision and truncation retained; no maliciousness probability |
| Response → UI | Pass | Graph inspection, post evidence and duplicate-source disclosure browser assertions |
| Case → report | Pass | Browser JSON/HTML export; API owner/receipt/modality checks and full retained-ledger equality |
| Failed storage | Pass | Existing atomic repository and API rollback tests preserve committed data and fail writes explicitly |

## Commands actually run

- `npm test`: full existing 16-file Node/API command passed, including 17 upgrade tests,
  Engine 1/2 contracts, semantic cache/readiness, campaign episodes, receipts, ownership,
  API/storage rollback and report escaping. After adding simultaneous health/busy coverage,
  `node --import tsx test/campaignApi.test.ts` passed again (health 200, busy 429, dense 200).
- `npm run test:engine3`: importer/math and worker/precision suites passed. Final
  distinct-annotator schema change was checked by rerunning `engine3Dataset.test.ts`.
  Reliability report: `reports/engine3_reliability_v1.json`; the timeout/load-failure
  semantic tests simulate transport errors, rather than claiming an actual 20-second wait.
- `python -m unittest discover -s ai_service -p 'test_*.py' -v` using `.venv-win`:
  **69 tests, 68 passed, one skipped**, 26.50 seconds. Skip is absent optional AASIST
  checkpoint; no tests removed or newly skipped. Includes real cached YuNet/provenance
  fixtures, timestamp/video/audio contracts and actual child-tree timeout cleanup.
- `npm run lint`: TypeScript passed after correcting two new-tool type errors, and again
  after final application/test changes. `npm run build`: passed; existing >500 kB bundle
  warning remains. No unrelated bundle rewrite attempted.
- Fourteen authored controls passed. Independent evaluator release report:
  `reports/engine3_independent_verified.json`, zero admitted campaigns and null accuracy.
  Earlier v1/final/release reports are retained as intermediate code-hash snapshots.
- 24 supervised resource cases completed as intended: 20 valid graph runs (18 episode,
  two legacy), two explicit missing-time rejections, two oversize rejections. Subsequent
  `engine3_cap5000_verified.json` and `engine3_cap10000_verified.json` directly verify
  the production preparation guard. No 5k/10k analysis was performed.
- Actual offline pinned E5 diagnostic experiment completed: 11 authored pairs, no downloads,
  no independent semantic quality metrics. Scores/startup/resources retained separately.
- `git diff --check` passed; feature remote re-fetched at final review, still 0/0 with
  starting HEAD before commit. Final commit/push/clean status is reported in the chat.

## Browser verification and resolved failures

Test services were isolated: development `3317`, authenticated production `3318`, Python
`8417`; separate ignored case stores, disabled image/face/audio classifiers, actual local
YuNet/provenance/video diagnostics enabled. User previews/stores were not repurposed.

Development suite: the ten applicable prior tests passed after correcting an outdated
image-state assertion; the added precision test initially failed due to an ambiguous
locator (same warning appears in two UI regions), then passed when scoped to the evidence
panel. Together **11 applicable tests passed**, with two existing configuration skips.
The successful targeted rerun is recorded separately rather than describing the earlier
failed full run as a pass.

Authenticated production final full run: **11 passed, two skipped, 36.8 seconds**. Skips:
optional face-classifier checkpoint absent; separate claim-corpus workflow not configured.
The first production run exposed setup issues: default seed cases belonged to another
owner, and Playwright's APIRequestContext did not inherit page-route authentication.
Seeded a fictional case for the test analyst in the isolated store and configured the
API/browser fixtures with the same test identity. Ownership/auth logic was not weakened.
The image assertion now checks the actual API null decision probability and classifier
availability separately from successful provenance measurements. No failure was hidden
by skipping a test. Existing signed-image and real video browser flows passed.

Screenshots/downloads remain ignored under `test-results`; raw research/control/resource
reports committed under `reports/engine3_*.json` contain authored data and measurements,
not private investigations or external research posts.

## Changed-file scope

Application: `server.ts`, `server/campaignEpisodes.ts`, `server/densityCampaign.ts`, new
`server/campaignRunner.ts` / `campaignWorker.ts`, and one disclosure in
`src/components/CampaignEvidence.tsx`. Tooling/tests: `package.json`,
`playwright.config.ts`, campaign API/browser regressions, precision/blocking audit scripts,
new importer/reliability tests, `test/engine3/{dataset,evaluate,workloads,controls,resourceCase,semanticInputs}.ts`
and empty `sources.json`, plus two bounded Python experiment supervisors. Documentation:
audit/evaluation/false-positive/performance/decision/verification records, progress/plan,
dataset readiness and campaign API/episode/implementation-plan continuity links. New raw
reports preserve before/after/intermediate measurements; old reports/protocols unchanged.

## Unverified / deliberately withheld

Independent association, recurrence, coordination and malicious-intent accuracy;
confidence intervals; calibrated semantic/hybrid gates; sustained concurrent deployment
load; full RSS enforcement/OS resource reservation; distributed admission control;
multi-window coverage and cross-publisher identity reconciliation. No scientific phase
completion, production readiness or 10k scaling claim follows from these software tests.
