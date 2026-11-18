# VERITAS AI public static demo

This directory is an independent, read-only frontend. It is designed to be hosted as static files on a static host such as GitHub Pages. It does not import the investigator application or its server.

## Scope and provenance

- The notice image and text, local source excerpt, posts, and account labels are project-authored fictional fixtures under `../fixtures/submission/`.
- OCR text and workflow counts shown here are precomputed extracts from the committed verification report. The OCR record is from an earlier local run whose image checksum differs from the currently bundled fixture revision; the page discloses this and does not claim to rerun OCR.
- The verdict is a precomputed `Insufficient Evidence` result against one fictional local corpus entry. No external retrieval occurred.
- Network counts are a precomputed deterministic output over synthetic fixture data. They do not establish real coordination or intent.
- “Actual output” identifies a recorded result from prior local verification. It does not mean this public page performed that analysis.

The page has no API client, server-side runtime, upload, login, storage, external retrieval, or mutation controls. Its CSP sets `connect-src 'none'` and its user interface only switches among bundled content.

## Build and acceptance

From the repository root:

```sh
npm run demo:public:build
npm run demo:public:test
```

The output is `public-demo/dist/`. The Playwright acceptance test serves the built files without credentials, exercises each stage, and checks all observed browser requests for same-origin GET-only behavior and expected static resources. It also checks the built artifact for likely secret markers.

No publishing workflow or hosting configuration is included. Review the built output and security/test results before authorizing any publication.
