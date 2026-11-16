# Core capability audit — 2026-11-17 local date

Starting point: clean, synchronized `codex/integrate-figma-upgrade` at
`caf4a022a9ccba54eb63dcb735cc15e8375f6470`. Attachments were treated as project
history; implementation, local processes, APIs and browser observations were checked.
This delivery completes real retrieval/citation integration and restores feasible
experimental audio inference. It does not complete every scientific development phase.

| Capability | Verified technical state after this work | Accuracy / remaining blocker |
| --- | --- | --- |
| Image measurements / C2PA | Original bytes, 3 retained server measurements, editable metadata and independent credentials route work | Measurements/credentials are not synthetic-image classification |
| Whole-image classifier | Existing cached Dima ran offline on an authored notice; default local service remains disabled | Historical unacceptable FPR; no deployment promotion |
| YuNet / face classifier | YuNet detector ready; optional DeiTFake disabled | Region detection is not manipulation; subject-disjoint evaluation missing |
| Audio | Official pinned AASIST checkpoint obtained and strict-loaded; actual browser returned 3 segments | Raw uncalibrated outputs, no independent genuine/spoof benchmark or reliable speech gate |
| Video | Actual upload returned 6 decoded frames and separately analyzed audio | No validated video-level detector or aggregation rule |
| Claims | Keyless Wikipedia API returns real lead passages; review, storage and clickable report sources work | Encyclopedia relevance is not truth, independence or emergency authority |
| Google / approved corpus | Existing adapters retained; missing credentials / operator-approved real corpus | Live Google authentication, enabled API and quota cannot be validated without a legitimate key |
| Assertion extraction / stance | Existing sentence candidates and attributed exact-quote/context review preserved | No trained claim selector, NER, translation or validated NLI; ambiguous/compound statements require human narrowing |
| Network | Actual authored import produced relationships/episodes; maliciousness probability remains null | No independent malicious-campaign classifier validation |
| Correlation / reports | Exact source passage identity and citation metadata survive signed API → case → graph → HTML/JSON | Links prove provenance, not factual accuracy; analyst assertions remain attributed |
| OCR | Actual pinned English OCR/API/review/recovery tests pass | Independent screenshot generalization and Hindi/Telugu OCR remain incomplete |

## Configuration findings

Actual-input development workspace: Node/Vite/Express on loopback **3000**, full Python
on **8001**. Separate authored demonstration on **3001**, preparation-only Python
**8002**. These are different configurations. The latter's absent image evidence was
an unconfigured full-inference URL, not frontend loss of returned measurements.
The demo launcher now explicitly disables online Wikipedia retrieval.

No root `.env` or inherited real retrieval key existed at audit. Local-only `.env`
now contains only `VERITAS_WIKIPEDIA_ENABLED=1` and edition `en`. No secret is committed.
The original actual-input store/token/owner were reused; its SHA-256 was unchanged
across service restarts. Verification cases for this implementation used isolated
temporary stores, removed after testing. Prior investigations were not reset.

See [verification](CORE_CAPABILITY_VERIFICATION.md),
[citations/setup](CLAIM_SOURCE_CITATIONS.md), [image](IMAGE_MODEL_EVALUATION.md),
[audio](AUDIO_MODEL_EVALUATION.md) and [video](VIDEO_MODEL_EVALUATION.md).
