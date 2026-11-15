/** Authored software controls ONLY. No external/reserved dataset loader. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { rankEvidence } from "../server/claimVerification";
import { modelConfig } from "../server/inference";
const output = process.argv[2];
if (!output || fs.existsSync(output)) throw new Error("New output path required");
const fixture = "test/fixtures/claims/retrieval_controls.json",
  bytes = fs.readFileSync(fixture),
  data = JSON.parse(bytes.toString());
if (data.scope !== "authored_software_controls_not_factual_benchmark")
  throw new Error("Software controls only");
delete process.env.GOOGLE_FACT_CHECK_API_KEY;
const results = [];
for (const q of data.queries) {
  const pool = data.documents.filter((d: any) => d.language === q.pool);
  const items = pool.map((d: any) => ({
    title: "Software control",
    url: `https://example.org/${d.id}`,
    excerpt: d.text,
    retrievedAt: "2026-01-01T00:00:00.000Z",
    provider: "software_test" as const,
  }));
  const lexicalStart = performance.now(),
    lexical = await rankEvidence(q.text, items, false),
    lexicalMs = performance.now() - lexicalStart;
  const semanticStart = performance.now(),
    hybrid = await rankEvidence(q.text, items, true),
    hybridMs = performance.now() - semanticStart;
  const rank = (r: typeof lexical) =>
    r.ranked.findIndex((d) => new URL(d.url).pathname === `/${q.relevant}`) + 1;
  results.push({
    id: q.id,
    language: q.language,
    pool: q.pool,
    kind: q.kind,
    query: q.text,
    relevant: q.relevant,
    bm25: {
      rank: rank(lexical) || null,
      hit1: rank(lexical) === 1,
      elapsedMs: lexicalMs,
      items: lexical.ranked,
    },
    hybrid: hybrid.semanticMeasured
      ? {
          rank: rank(hybrid) || null,
          hit1: rank(hybrid) === 1,
          elapsedMs: hybridMs,
          items: hybrid.ranked,
        }
      : null,
    semanticStatus: hybrid.embeddingStatus,
  });
}
const sha = (file: string) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const report = {
  scope: data.scope,
  timestamp: new Date().toISOString(),
  fixtureSha256: sha(fixture),
  code: Object.fromEntries(
    [
      "server/claimText.ts",
      "server/claimSources.ts",
      "server/claimVerification.ts",
      "test/evaluateClaims.ts",
      "ai_service/claim_embedding.py",
    ].map((f) => [f, sha(f)]),
  ),
  environment: { node: process.version, platform: process.platform },
  model: {
    id: modelConfig("embedding").modelId,
    version: modelConfig("embedding").version,
    format: process.env.VERITAS_CLAIM_EMBEDDING_FORMAT || "generic",
  },
  independentLabeledClaims: 0,
  factualAccuracy: null,
  entailmentAccuracy: null,
  processRssBytes: process.memoryUsage().rss,
  results,
  limitations: [
    "Authored fictional examples and relevance labels, not independently annotated factual claims.",
    "Negation/date/location mismatch queries test topic relevance only, never agreement or factual truth.",
    "Small correlated examples, no confidence interval or real-world language quality claim.",
    "Hybrid uses existing 0.5 lexical/0.5 cosine ranking and 0.65 semantic candidate gate; no threshold fitting.",
    "Node RSS is whole-process current memory, not isolated model peak; first endpoint call can include warmup.",
  ],
};
fs.writeFileSync(output, JSON.stringify(report, null, 2), { flag: "wx" });
console.log(
  JSON.stringify({
    output,
    queries: results.length,
    bm25Hit1: results.filter((r) => r.bm25.hit1).length,
    hybridHit1: results.every((r) => r.hybrid)
      ? results.filter((r) => r.hybrid?.hit1).length
      : null,
    rssBytes: report.processRssBytes,
  }),
);
