# Submission readiness assessment

Audit baseline: `c26f385`, clean/synchronized `codex/integrate-figma-upgrade`. This is an
internal engineering assessment, not official hackathon criteria or a score prediction.

## Verified audit findings and actions

| Baseline finding | Evidence | Action |
|---|---|---|
| README omitted OCR setup, current Engine 4 path and reproducible full demo | Original README described optional services without installation/OCR steps | Rewrote around implemented engines, exact setup, fixtures, limits and real screenshot |
| No GitHub Actions | `.github` absent | Added bounded Node/Windows/Linux checks, real OCR demo and separate full Python job |
| Compose was unusable | References missing Dockerfile, no persistent volume/auth example | Preserved and explicitly marked historical/unsupported; documented tested process path |
| Heavy ML environment unnecessary for OCR | Full app imports audio/video/model dependencies; preparation router needs FastAPI/Pillow | Added preparation-only service using unchanged router and small locked environment |
| Cross-platform demo prerequisites were unclear | Older fixture generators depend on Windows fonts | Added permitted portable authored graphic, manifest/hash, corpus and post fixtures |
| No normal production start command; opaque startup failures | Only dev/build/preview scripts | Added npm start, port/build diagnostics and bounded listener shutdown |
| Single-analyst development listener exposed all interfaces | Original app.listen bound 0.0.0.0 regardless of mode | Development now defaults to loopback; explicit VERITAS_HOST and production behavior remain available |
| Historical report overwritten by ordinary regression | Engine43 test wrote directly to tracked report | Reruns now default to ignored cache; original report restored byte-equivalent to HEAD |
| Licensing/team claims unsupported | No root LICENSE or verified individual roster | State actual status; do not invent license or people |
| Historical docs can conflict with current capabilities | Original Engine4 limits predate OCR; cloud direction listed implemented auth as future | Current architecture clarifies chronology; corrected cloud-status paragraph |

Installation was exercised in a separate clone plus candidate patch, new node_modules,
new CPython environment, explicitly downloaded/hash-verified English OCR and a separate
Chromium download. No personal .env, investigation store or model cache was copied.
The demo revealed future UTC fixture provenance and two test-navigation assumptions;
these were corrected without weakening timestamp, retrieval or review safeguards.

## Internal rubric

| Category | Score / maximum | Evidence and remaining weakness |
|---|---:|---|
| Problem relevance | 9 / 10 | Four evidence domains connect to a case/report; real investigator study absent |
| Architecture | 13 / 15 | Owned APIs, bounded workers, provenance/review gates; single-process persistence |
| Functional completeness | 14 / 20 | Complete actual OCR-to-report demo; important detector/native-script/independent evaluation gaps |
| Reproducibility | 12 / 15 | Fresh Windows environment and pinned demo assets/dependencies; other hosts/large-model setup not independently established here |
| Testing/reliability | 12 / 15 | Engine/API/Python/browser controls and failure checks; remote CI status separate, no broad load/security certification |
| Originality/differentiation | 6 / 10 | Evidence integration/review/proofs add value; existing models/tools, no validated new detection method |
| Documentation/presentation | 9 / 10 | Accurate README, screenshot, architecture, demo/recovery/video guide; no recorded video/public deployment |
| Scientific honesty | 5 / 5 | Authored vs independent, missing models, diagnostic outputs and uncertainty explicitly separated |
| **Total** | **80 / 100** | Subjective internal assessment of the verified submission, not official judging |

## Five ranked remaining submission risks

1. Independent detection/OCR generalization and malicious-campaign truth remain unvalidated.
   Demonstrate evidence handling, not unsupported accuracy.
2. Real deployment operations remain incomplete: no verified public TLS deployment,
   multiwriter storage, retention/quota system or broad concurrency/load test.
3. Repository-wide licensing and verified individual team attribution require owner decisions.
   This update cannot choose a license or invent a team roster.
4. Cross-platform/remote CI execution and optional-model environments need their actual
   execution evidence; a workflow file is not a passing CI run. See FINAL_VERIFICATION.md.
5. Rehearsal still needs Node/Python/browser provisioning and the small explicit model
   download. A recording has not been made, and live external retrieval is not demonstrated.

Highest-impact final work: record the rehearsed 2–3 minute guide; have maintainers resolve
licensing/team information and review competition submission rules; confirm a clean CI run
on the final commit; prepare the demonstrated local environment before judging. Longer-term
work should prioritize independent dataset/adjudication and deployment storage/security,
not adding speculative model outputs or weakening uncertainty gates.
