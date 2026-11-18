# Vercel deployment readiness (18 November 2026)

**Status: NOT deployable as a complete functional Vercel multi-service project yet.** This is a repository-specific assessment, not a successful deployment.

## Verified repository facts

- The root `package.json` builds a Vite SPA with `npm run build`, producing `dist`. The same root also starts the **Express** application via `node --import tsx server.ts`.
- `server.ts` handles `/api/*`, serves the SPA in production, and calls `app.listen(...)` at startup. It does not currently export an Express handler for Vercel Functions.
- `server/repository.ts` performs atomic writes to a local JSON file. Serverless function filesystems are not durable multiwriter storage.
- `ai_service/requirements.txt` contains large ML dependencies including PyTorch, Transformers and OpenCV; model weights, startup times, runtime limits, and packaging have not been validated on Vercel.
- The root has no `vercel.json`. Vercel's automatic detection of Vite and FastAPI does **not** cover the existing Express API or prove functionality.

## Environment variables: important correction

The server currently reads `process.env.APP_GEMINI_API_KEY` first, then `GEMINI_API_KEY` **only from the parsed root .env file**. Therefore setting **only** `GEMINI_API_KEY` in Vercel's dashboard will not configure Gemini in the existing code. For any future hosted Express service, set `APP_GEMINI_API_KEY` as a server-only secret, or change the code deliberately to accept `process.env.GEMINI_API_KEY` with tests.

Do not expose Gemini keys via `VITE_*`. Production case APIs also require securely provisioned `VERITAS_USERS` and `VERITAS_PUBLIC_ORIGIN` (see `docs/DEPLOYMENT.md`). Never commit secret values.

## Recommended implementation path

1. Decide between a **frontend-only Vercel deployment** (not a working investigation app) and a **full hosted deployment**. Do not present a frontend-only site as a working four-engine demo.
2. For the full app, first deploy the Express API on an appropriate persistent Node host, with a single-writer persistent volume for `VERITAS_STORE` and HTTPS. Securely configure `VERITAS_USERS`, `VERITAS_PUBLIC_ORIGIN`, and `APP_GEMINI_API_KEY` if used.
3. Host the Python OCR/media services privately alongside the API, or behind authenticated private networking. Test dependencies, models, CPU/RAM and cold-start behavior; never publicly expose an unauthenticated inference endpoint.
4. Only then configure Vercel for the Vite frontend. Implement and test same-origin `/api/*` proxy routing to the deployed Express host, or an explicit secure API origin with correct cookie/CORS/CSRF behavior. Do not point the SPA at `localhost`.
5. Validate login, case create/edit, media upload, claims, networks, correlation, reports, and persistence after restart. Run `npm run lint`, `npm run build`, and relevant tests before merging deployment changes.

**Do not paste Vercel's suggested multi-service `vercel.json` without adapting the Express API and persistence architecture.** This branch intentionally does not add an unverified configuration that would give a false impression of deployability.
