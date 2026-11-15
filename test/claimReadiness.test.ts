import assert from "node:assert/strict";
import { embedDetailed } from "../server/inference";
import { deduplicateEvidence, type RetrievedEvidence } from "../server/claimSources";
import { reviewEvidence, verifyWithEvidence } from "../server/claimVerification";
import { analyzeClaim } from "../server/claimText";
import { retrievalMetrics, validateEvaluationGroups } from "./claimRetrievalMetrics";
process.env.VERITAS_EMBEDDING_ENDPOINT = "http://127.0.0.1:9999/test-a";
process.env.VERITAS_EMBEDDING_MODEL_ID = "software-cache-control";
process.env.VERITAS_EMBEDDING_VERSION = "v1";
const originalFetch = globalThis.fetch;
let calls = 0,
  bad = false,
  requested: string[][] = [];
globalThis.fetch = (async (_url, options) => {
  calls++;
  const body = JSON.parse(String(options?.body));
  requested.push(body.texts);
  return new Response(
    JSON.stringify({
      modelId: body.modelId,
      version: body.version,
      embeddings: body.texts.map(() => Array(bad ? 9 : 8).fill(1)),
    }),
  );
}) as typeof fetch;
try {
  const first = await embedDetailed(["same", "same", "other"]);
  assert.equal(first?.diagnostics.uniqueMisses, 2);
  assert.equal(first?.diagnostics.deduplicatedInputs, 1);
  assert.equal(requested[0].length, 2);
  const warm = await embedDetailed(["same", "other"]);
  assert.equal(warm?.diagnostics.requests, 0);
  assert.deepEqual(warm?.vectors, first?.vectors.slice(1));
  process.env.VERITAS_EMBEDDING_ENDPOINT = "http://127.0.0.1:9999/test-b";
  await embedDetailed(["same"]);
  assert.equal(calls, 2);
  // Mixed cached/new dimensions must fail, without caching the invalid new vector.
  bad = true;
  assert.equal(await embedDetailed(["same", "new"]), null);
  bad = false;
  assert.equal((await embedDetailed(["same", "new"]))?.vectors[1].length, 8);
  assert.equal(calls, 4);
  requested = [];
  await embedDetailed(Array.from({ length: 65 }, (_, i) => "bounded-" + i));
  assert.deepEqual(
    requested.map((x) => x.length),
    [32, 32, 1],
  );
} finally {
  globalThis.fetch = originalFetch;
  delete process.env.VERITAS_EMBEDDING_ENDPOINT;
}
const base: RetrievedEvidence = {
  title: "Software passage",
  url: "https://example.org/source",
  excerpt: "The fictional bridge has not collapsed.",
  provider: "software_test",
  retrievedAt: "2026-01-01T00:00:00.000Z",
};
assert.equal(
  deduplicateEvidence([
    base,
    { ...base, excerpt: "The fictional bridge collapsed." },
    { ...base, url: "https://example.net/source" },
  ]).length,
  3,
);
assert.equal(
  deduplicateEvidence([base, { ...base, url: base.url + "?utm_source=test" }]).length,
  1,
);
assert.equal(
  deduplicateEvidence([
    { ...base, publisherRating: "False" },
    { ...base, publisherRating: "True" },
  ]).length,
  2,
);
delete process.env.GOOGLE_FACT_CHECK_API_KEY;
delete process.env.VERITAS_CLAIM_CORPUS;
const result = await verifyWithEvidence("The fictional bridge collapsed in 2024 in Northport.");
const sources = [
  base,
  { ...base, excerpt: "The fictional bridge collapsed in 2025 in Southport." },
].map((s, i) => ({
  ...s,
  id: `E${i + 1}`,
    url:base.url!,
  domain: "example.org",
  stance: "neutral" as const,
  credibilityRating: "Unverified Source" as const,
}));
const input = { ...result, sources };
const review = {
  url: base.url,
  sourceId: "E1",
  stance: "contradicts" as const,
  quote: base.excerpt,
  contextConfirmed: true,
};
assert.throws(() =>
  reviewEvidence(
    input,
    [{ ...review, sourceId: undefined }],
    "Software context checked across matching sources",
    "test",
  ),
);
assert.equal(
  reviewEvidence(
    input,
    [review, { ...review, sourceId: "E2", stance: "supports", quote: sources[1].excerpt }],
    "Conflicting fictional evidence for source-ID control",
    "test",
  ).verificationStatus,
  "CONFLICTING_EVIDENCE",
);
assert.throws(
  () =>
    reviewEvidence(
      { ...input, retrievalDetails: { ...result.retrievalDetails!, omittedCount: 1 } },
      [review],
      "Truncated candidates need a narrower query",
      "test",
    ),
  /truncated/,
);
for (const text of [
  "No bridge collapsed in 2024 at Northport.",
  "पुल २०२४ में दिल्ली में नहीं टूटा।",
  "వంతెన 2024లో హైదరాబాద్‌లో కూలిపోలేదు.",
  "Hyderabad లో 10 नहीं 100",
]) {
  const r = await verifyWithEvidence(text);
  assert.equal(r.verificationStatus, "UNAVAILABLE");
  assert.equal(r.confidenceScore, null);
  assert.deepEqual(r.sources, []);
  assert.ok(
    analyzeClaim(text).normalized.includes("2024") || text.includes("२०२४") || text.includes("100"),
  );
}
const metric = retrievalMetrics(["b", "a"], { a: 2, b: 1, c: 0 }, 2, true);
assert.equal(metric.recall, 1);
assert.equal(metric.precision, 1);
assert.equal(metric.mrr, 1);
assert.ok(metric.ndcg! < 1);
assert.equal(retrievalMetrics([], { a: 1, b: 0 }, 1).mrr, 0);
assert.equal(retrievalMetrics([], { a: 0 }, 1).recall, null);
assert.equal(retrievalMetrics(["a"], { a: 1 }, 1).ndcg, null);
assert.throws(() => retrievalMetrics(["unjudged"], { a: 1 }, 1));
assert.throws(() => retrievalMetrics(["a", "a"], { a: 1 }, 2));
const row = {
  id: "a",
  split: "development",
  sourceIds: ["source"],
  translationGroup: "same-claim",
  sha256: "a".repeat(64),
};
validateEvaluationGroups([row]);
assert.throws(() =>
  validateEvaluationGroups([
    row,
    { ...row, id: "hi", split: "validation", sha256: "b".repeat(64) },
  ]),
);
assert.throws(() => validateEvaluationGroups([{ ...row, split: "reserved_final" }]));
console.log(
  "Claim readiness controls passed: cache identity/poisoning/batches, exact source IDs, retained contradictions, multilingual abstention, retrieval metric math and translation/source split gates.",
);
