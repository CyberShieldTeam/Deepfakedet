# Development navigation diagnosis — 2026-11-15

## Reproduction and controlled checks

`test/diagnoseDevNavigation.ts` probes root HTML, the main source module and API health,
then records browser responses, unfinished requests and page errors with a fixed
12-second DOM-content-loaded deadline. Cosmetic external fonts are blocked consistently.
The diagnostics use an isolated local store and disabled external model provider.

| Configuration | Actual navigation outcome | Evidence |
| --- | --- | --- |
| Original broad watching, HMR enabled | Timed out at 12.01 s; source-module probe also exceeded 5 s; no JavaScript page errors | `reports/dev_navigation_before.json` |
| Existing DISABLE_HMR=true (watcher disabled) | DOM loaded in .439 s; main module 10.4 ms | `reports/dev_navigation_watching_disabled.json` |
| Watcher excludes cache/env/generated trees; HMR enabled | DOM loaded in .510 s; main module 13.3 ms, API 4.4 ms; no JavaScript page errors | `reports/dev_navigation_scoped_watching.json` |
| Reversible crossover: restore broad watching after caches were warm | Timed out again at 12.01 s with source/CSS/dependency requests pending | `reports/dev_navigation_unscoped_recheck.json` |

Root HTML/API could respond while frontend module/CSS/dependency requests stalled.
The root cause isolated here is broad Vite file watching in this Windows/OneDrive
workspace containing inference environments, cached assets and generated outputs. The
crossover rules out simply attributing improvement to warm module caches. It does not
identify which individual directory or OneDrive internals consumed the resources, nor
prove that all operating systems reproduce the same behavior. No frontend route error,
console exception or model initialization was observed to cause this navigation stall.
Blocking external fonts alone had already failed to resolve it in prior runs.

## Fix

`vite.config.ts` now ignores `.venv*`, `.model-cache`, `ai_service/models`, reports,
data and generated test/browser output trees while retaining source watching and HMR.
The existing DISABLE_HMR switch remains available. Product/browser test deadlines were
not increased. The two initial 30-second navigation failures from the prior session
remain historical results, not retroactively passed tests.

After the change, full development and built-production browser execution results are
recorded in `IMPLEMENTATION_PROGRESS.md`. Production uses built assets and therefore
does not run this watcher. This is a concrete local fix with a reproducible diagnostic;
performance on other hosts remains subject to measurement.
