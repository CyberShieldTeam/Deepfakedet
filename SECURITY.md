# Security and evaluation scope

Use permitted demonstration inputs. The submission launcher binds loopback, creates a
fresh empty store and generates a new token. Never publish private access.json files,
credentials, credential screenshots or real investigations.

Production needs operator tokens, HTTPS and protected persistent storage. Existing
ownership, origin, input/signature checks, rate limits, worker bounds and HTML escaping
remain. Keep Python services private: they are not authenticated public upload APIs.
Minimal token/session authentication does not provide MFA or organization-level roles.
Normal single-analyst development now defaults to loopback rather than exposing case APIs
on every interface. Explicit VERITAS_HOST is available for intentionally protected setups.

OCR text/URLs are not automatically executed or fetched. External retrieval needs explicit
server configuration and source-applicability review. Diagnostic anomalies, shared posts
and experimental scores are not enforcement grounds.

Known gaps include single-process storage/admission, no encrypted evidence archive,
durable job/audit system or deployment-wide retention/quotas. See docs/DEPLOYMENT.md.
Dependency audits are point-in-time checks, not security certification.

Report vulnerabilities privately through an established maintainer channel. Use GitHub
private vulnerability reporting only if enabled; do not put secrets or private evidence
in public issues. No unverified contact address/reporting availability is asserted here.
