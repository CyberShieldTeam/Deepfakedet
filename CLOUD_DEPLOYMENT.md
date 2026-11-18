# Cloud inference direction

## Public free-host deployment work — 2026-11-18

An isolated guest profile, free Render Blueprint and Vercel static/API routing build
are implemented and locally tested. **Cloud publication is not verified**: Vercel team
authorization and Render provisioning are outstanding. Local trained models cannot be
represented as working on512MB free instances. See
[free public deployment](docs/FREE_PUBLIC_DEPLOYMENT.md) for exact feature limits,
temporary-storage policy, secrets, tests and minimum manual provider setup. The earlier
architecture notes below remain history rather than a claim of deployed services.

The end user should need only a browser and an upload. No model weights, local LLM, GPU, or Python installation should be required on the user's computer.

The current `ai_service` is a server component. Development uses `127.0.0.1`, but production should run Express and Python inference on hosted infrastructure behind authenticated, bounded upload routes. Model weights and any Hugging Face downloads belong in a managed server image or model cache. Secrets for Gemini, hosted model APIs, and retrieval providers stay on the server.

Phase 3 uses cloud-hosted multilingual embeddings and a hosted verification/contradiction model with a server-side retrieval corpus or search provider. Responses must cite retrieved evidence and preserve an insufficient-evidence result. English, Hindi, and Telugu require separate held-out evaluation. The provider choice can be Gemini or a licensed Hugging Face model deployed on managed inference; architecture choice alone does not establish accuracy.

Current browser ELA, video-frame difference, and audio-spectrum computations use some client CPU. Migrate them to server jobs incrementally, with upload limits, privacy controls, retention rules, and asynchronous progress before claiming a fully cloud-computed workflow. The server-side video decoder, AASIST path, and experimental optical flow already run in the Python service. The browser preview may remain for display, but cryptographic C2PA verification must inspect the original uploaded bytes on the server.

Operator authentication and owner-scoped bounded uploads are implemented. Durable background
jobs, persistent object storage, hosted model packaging and cloud cost measurements remain
open. This document describes a target cloud architecture, not a live deployment. For the
tested local/server process layout and its limits, see [deployment](docs/DEPLOYMENT.md).
