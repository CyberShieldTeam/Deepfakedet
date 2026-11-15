# Cloud inference direction

The end user should need only a browser and an upload. No model weights, local LLM, GPU, or Python installation should be required on the user's computer.

The current `ai_service` is a server component. Development uses `127.0.0.1`, but production should run Express and Python inference on hosted infrastructure behind authenticated, bounded upload routes. Model weights and any Hugging Face downloads belong in a managed server image or model cache. Secrets for Gemini, hosted model APIs, and retrieval providers stay on the server.

Phase 3 uses cloud-hosted multilingual embeddings and a hosted verification/contradiction model with a server-side retrieval corpus or search provider. Responses must cite retrieved evidence and preserve an insufficient-evidence result. English, Hindi, and Telugu require separate held-out evaluation. The provider choice can be Gemini or a licensed Hugging Face model deployed on managed inference; architecture choice alone does not establish accuracy.

Current browser ELA, video-frame difference, and audio-spectrum computations use some client CPU. Migrate them to server jobs incrementally, with upload limits, privacy controls, retention rules, and asynchronous progress before claiming a fully cloud-computed workflow. The server-side video decoder, AASIST path, and experimental optical flow already run in the Python service. The browser preview may remain for display, but cryptographic C2PA verification must inspect the original uploaded bytes on the server.

Deployment remains incomplete: authenticated uploads, background jobs, persistent object storage, hosted model packaging, and performance/cost measurements are open. This document describes the target architecture, not a live cloud deployment.
