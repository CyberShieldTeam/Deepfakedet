// Explicit isolated preview fixture setup. Never opens or changes the user's case store.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
const corpusEnabled = process.env.VERITAS_EXTRACTION_PREVIEW_CORPUS !== "0";
const mode =
  (process.env.NODE_ENV === "production" ? "production" : "development") +
  (corpusEnabled ? "" : "-unconfigured");
process.env.VERITAS_STORE = path.resolve(
  `.model-cache/${process.env.VERITAS_PREVIEW_PREFIX || "engine41"}-browser-${mode}.json`,
);
process.env.APP_GEMINI_API_KEY = "MY_DISABLED";
process.env.GOOGLE_FACT_CHECK_API_KEY = "";
process.env.VERITAS_EMBEDDING_ENDPOINT = "";
process.env.DISABLE_HMR = "true";
process.env.VERITAS_USERS = JSON.stringify({
  "engine41-browser-token-not-secret-000000": "local-analyst",
});
const text = "Software fixture: the fictional Amber Museum offers free entry.";
const raw = JSON.stringify({
  schemaVersion: 1,
  id: "engine41-browser",
  license: "project-authored software fixture",
  approvalReference: "software-control-only",
  approvedBy: "fixture-author",
  approvedAt: "2026-01-01T00:00:00Z",
  documents: [
    {
      title: "Fictional Engine4 source",
      url: "https://example.org/engine4-source",
      excerpt: text,
      retrievedAt: "2026-01-01T00:00:00Z",
      provider: "operator_corpus",
      license: "project-authored",
    },
  ],
});
const file = path.resolve(".model-cache/engine41-browser-corpus.json");
fs.writeFileSync(file, raw);
process.env.VERITAS_CLAIM_CORPUS = corpusEnabled ? file : "";
process.env.VERITAS_CLAIM_CORPUS_SHA256 = corpusEnabled
  ? createHash("sha256").update(raw).digest("hex")
  : "";
await import("../server");
