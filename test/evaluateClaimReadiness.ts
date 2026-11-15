/** Fixed fictional controls, separate retrieval methods and repeated warm queries. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { rankEvidence } from "../server/claimVerification";
import { retrievalMetrics } from "./claimRetrievalMetrics";
const output = process.argv[2];
if (!output || fs.existsSync(output)) throw new Error("New output path required");
const fixture = "test/fixtures/claims/retrieval_controls.json",
  data = JSON.parse(fs.readFileSync(fixture, "utf8"));
if (data.scope !== "authored_software_controls_not_factual_benchmark")
  throw new Error("Fixed software controls only");
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
  const judgments = Object.fromEntries(pool.map((d: any) => [d.id, d.id === q.relevant ? 1 : 0]));
  for (const method of ["bm25", "e5", "hybrid"] as const) {
    for (let repeat = 0; repeat < 2; repeat++) {
      const start = performance.now(),
        r = await rankEvidence(q.text, items, method !== "bm25", method),
        elapsedMs = performance.now() - start;
      const ids = r.ranked.map((d) => new URL(d.url).pathname.slice(1));
      results.push({
        id: q.id,
        language: q.language,
        kind: q.kind,
        method,
        repeat,
        elapsedMs,
        available: method === "bm25" || r.semanticMeasured,
        embeddingDiagnostics: r.embeddingDiagnostics,
        metrics:
          method === "bm25" || r.semanticMeasured
            ? [1, 3].map((k) => retrievalMetrics(ids, judgments, k))
            : null,
        ranked: r.ranked,
      });
    }
  }
}
const hash = (p: string) => createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const code = Object.fromEntries(
  [
    "server/inference.ts",
    "server/claimVerification.ts",
    "server/claimSources.ts",
    "ai_service/claim_embedding.py",
    "test/evaluateClaimReadiness.ts",
    "test/claimRetrievalMetrics.ts",
  ].map((p) => [p, hash(p)]),
);
const report = {
  scope: data.scope,
  fixtureSha256: hash(fixture),
  code,
  independentClaims: 0,
  verificationAccuracy: null,
  ndcg: null,
  fixedParameters: {
    semanticGate: 0.65,
    hybridWeights: [0.5, 0.5],
    k: [1, 3],
    cpuThreads: 1,
    maxTokens: 512,
    batchSize: 8,
  },
  results,
  nodeRssBytes: process.memoryUsage().rss,
  limitations: [
    "Fictional topic relevance controls, not independently validated retrieval or factual agreement.",
    "Binary relevance only: nDCG omitted without independent relevance grades.",
    "Repeated queries share document/query cache; repeat=1 measures warm application retrieval, not uncached inference.",
    "Method order fixed; E5 may incur first embedding calls before hybrid. No tuning or latency-based quality tradeoff.",
  ],
};
fs.writeFileSync(output, JSON.stringify(report, null, 2), { flag: "wx" });
console.log(JSON.stringify({ output, rows: results.length }));
