# Contributing

Use a feature branch and a separate case store. Start with README.md/current verification.
Install locked Node/demo dependencies; optional full ML dependencies are separate. Do not
commit credentials, case stores, model caches or restricted datasets. Repository-wide
licensing is undeclared; obtain maintainer guidance before reuse.

Describe the concrete problem and before/after behavior. Keep implemented/tested/planned
features distinct. Preserve model/threshold/review safeguards; do not tune results for a
demonstration. A UI workflow change requires browser/API/persistence/report verification.
Run types/build and relevant existing engine tests; `npm run demo:check` uses isolated stores.
See docs/FINAL_VERIFICATION.md for commands and setup gates.

Historical reports are evidence, not disposable test output. Engine 4.3 propagation reruns
now write ignored cache output unless explicitly redirected. Submit actual results, skips
and limitations with asset provenance. Never describe fixture scores as independent accuracy
or publish private investigation evidence as part of testing.
