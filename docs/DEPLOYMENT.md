# Deployment boundaries

Supported verification paths are local development and local production-like Express plus
a loopback preparation service. No public deployment, cloud scale test, container build or
production certification is claimed. Historical Compose references a missing Dockerfile;
it is marked unsupported rather than advertised as a working installation.

## One-server configuration

`npm ci`, `npm run build` and the small locked CPython environment support the tested demo.
For an operator-managed server, the following is a configuration outline, **not a verified
public deployment or TLS proxy recipe**:

- Set `NODE_ENV=production`; `npm start` runs Express. Keep dev dependencies because runtime
  currently uses `tsx` and imports Vite. Static hosting/Vite preview cannot serve the API.
- Provision random >=32-character tokens in `VERITAS_USERS`, mapped to stable owner IDs,
  through a secret manager. Empty production credentials leave case APIs locked.
- Set exact HTTPS `VERITAS_PUBLIC_ORIGIN` and protected `VERITAS_HOST`; use a maintained TLS
  reverse proxy. Cookies remain HttpOnly/Secure/SameSite Strict. Sessions expire after
  eight hours and on restart; there is no OAuth/MFA/directory system.
- Put `VERITAS_STORE` on private persistent storage with backups. Windows mode bits do not
  replace appropriate ACLs. Original uploaded media is not archived; preserve it separately.
- Run `ai_service.ocr_app:app` with uvicorn on loopback and set `VERITAS_OCR_PREPARATION_URL`.
  Never expose the unauthenticated Python service publicly. The original full media
  service remains optional and separately configured.

Windows/Node 24/CPython 3.13 is the verified local path. Hosted Windows and Ubuntu CI also
passed the core/demo workflow; see FINAL_VERIFICATION.md. Other host combinations are unverified. The full service
uses `ai_service/requirements.txt`; its larger ML dependencies/checkpoints are unnecessary
for the judged OCR path. Individual model cards describe optional inference limitations.

## Operational limits

One process owns each JSON store. Do not use replicas, cluster mode or concurrent writers.
There is no shared session store, transactional database, distributed rate limiter or
durable job queue. Deployment needs retention/access policies and a backup plan.

Existing upload/pixel/output limits, worker deadlines and admission guards remain. OCR's
V8 cap is 512 MiB, not a bound on total native/process-tree memory. No minimum production
RAM or concurrent-user capacity is validated; full models have model-specific needs.
Small demo timings do not establish cloud capacity, cost or service-level objectives.

`/api/health` is a liveness/configuration summary, not all-model readiness. Preparation
health reports `ocrPreparation: ready` and classifier unavailable. Startup rejects invalid
ports/missing builds and explains occupied ports. SIGINT/SIGTERM close the listener with
a five-second deadline; this is not durable in-flight job draining. The demo stops its
two owned child processes. Serverless worker/model packaging has not been verified.

[CLOUD_DEPLOYMENT.md](../CLOUD_DEPLOYMENT.md) describes a future hosted direction, not an
existing deployment.
