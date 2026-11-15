# Feature-history reconciliation — 2026-11-15

Authorized after reporting divergence. Inputs: local `ee28104` and remote
`codex/phase1-audit` at `6cadda8`, common ancestor `26de131`; 11 local-only and seven
remote-only commits. Both histories are retained by a merge on
`codex/integrate-figma-upgrade`; main and source branches are not rewritten.

The integration retains the Figma security/persistence/API architecture, local model
adapters, parity and exploratory benchmark artifacts, and remote additions. Overlapping
implementations are reconciled explicitly:

- `evaluate_image.py` retains the earlier development-manifest protocol used by all
  existing image benchmarks. The independent remote gate/schema/CLI is preserved as
  `evaluate_image_gated.py`, with its original tests in `test_evaluate_image_gated.py`.
  Its supervised subprocess uses that module name too. Existing documented commands
  from the remote history must use this renamed gated CLI. Neither tool was run on
  reserved images during reconciliation.
- One pinned face model produces both `face_manipulation` and compatibility
  `face_model` responses without duplicate inference. The integrated crop policy is
  the existing 20%-context rectangle. The independently developed square-crop adapter
  remains available as `face_service_legacy.py`; its tests and standalone smoke remain
  attached to that module. Neither crop policy has new accuracy validation.
- Both `/v1/image/evidence` and `/v1/image/provenance` remain supported. They share the
  original-byte offline verifier and explicit operator trust policy; the legacy route
  maps response field names only. It no longer invokes the removed SDK `try_create`
  interface or implicitly enables remote fetch. Both action and CreativeWork structured
  source declarations are supported. Declarations never become authenticity scores.
- Remote adjacent-frame Farneback measurements, geometric face tracks, fixture,
  diagnostics and regression tests are retained and connected to current types/UI.
- The remote historical progress file is retained separately in
  `REMOTE_PROGRESS_2026-11-15.md`; historical tests/results are not recast as fresh
  measurements on the merged tree. Existing raw evaluation reports are retained.

Reconciliation checks: TypeScript, combined Node/API suite and Python suite (49 total,
48 passed, one optional AASIST-weight skip) passed. The initial combined Python run
found missing psutil for the remote supervisor; installing its declared dependency
resolved it. Production build and subsequent checks are recorded in current progress.

Remaining task scope: validate provenance regressions, diagnose dev navigation using
network evidence, extend bounded temporal diagnostics and document future-method
feasibility. No representative authenticity accuracy or calibration is established.
