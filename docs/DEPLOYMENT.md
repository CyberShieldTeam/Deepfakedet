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

## Render public judge demo mode

For a public hackathon demonstration, configure the Render web service with these
environment variables and commands. This is an explicit opt-in to anonymous public use;
it does not make the service suitable for private investigations.

- Set `NODE_ENV=production` and `VERITAS_PUBLIC_DEMO=true`.
- Set `VERITAS_PUBLIC_ORIGIN=https://deepfakedet-bjq0.onrender.com` to the exact HTTPS
  service origin. Update it if the Render service URL or custom domain changes.
- `VERITAS_USERS` is not required in this mode. Remove it from the Render environment;
  public mode ignores analyst credentials and accepts no token or password.
- Set the Render build command to `npm ci && npm run build` and the start command to
  `npm start`. The production server binds to `0.0.0.0` and Render supplies `PORT`.
- Attach a persistent disk and set `VERITAS_STORE` to a file path on its mount if judge
  investigations should survive a restart. Without persistent storage, saved cases may
  be lost when the service restarts.

On first visit, the browser receives a random, eight-hour, `Secure`, `HttpOnly`,
`SameSite=Strict` cookie. The server maps that cookie to a random owner ID; it never sends
the owner ID in the session response. API ownership checks continue to scope investigations,
reports and streams to that browser. Scripted scenarios and sample datasets are labelled as
simulated; user-submitted media and claims use configured engines, and unavailable evidence remains unavailable or inconclusive. Existing request validation, origin
checks, upload limits and mutation rate limits remain active. Keep provider API keys only
in Render's server-side environment; never put them in `VITE_*` variables.

The session map and IP rate limiter are in memory and are local to one server process.
Run one instance only: multiple instances do not share session state, and a restart expires
all browser sessions. This mode does not provide durable identity, distributed rate limiting,
private analyst access, or a production capacity guarantee. Review Render storage, retention
and provider-quota settings before opening the URL to judges. The switch changes access
behavior only on a redeploy; setting it to `false` or removing it restores the normal
production analyst-token requirement.
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
