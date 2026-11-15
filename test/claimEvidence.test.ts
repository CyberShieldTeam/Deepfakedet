import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { analyzeClaim, claimTokens, normalizeClaim } from "../server/claimText";
import {
  sourceUrl,
  googleEvidence,
  corpusEvidence,
  deduplicateEvidence,
  type RetrievedEvidence,
} from "../server/claimSources";
import {
  bm25,
  rankEvidence,
  verifyWithEvidence,
  reviewEvidence,
} from "../server/claimVerification";
import { reportHtml } from "../src/components/ReportModal";
import { buildDemoInvestigation } from "../server/demoScenario";

delete process.env.GOOGLE_FACT_CHECK_API_KEY;
delete process.env.VERITAS_EMBEDDING_ENDPOINT;
delete process.env.VERITAS_CLAIM_CORPUS;
assert.equal(normalizeClaim("  హైదరాబాద్\n  వార్త  "), "హైదరాబాద్ వార్త");
for (const [text, lang] of [
  ["Water is safe", "English"],
  ["पानी सुरक्षित नहीं है", "Hindi"],
  ["నీరు సురక్షితం కాదు", "Telugu"],
])
  assert.equal(analyzeClaim(text).language, lang);
assert.match(analyzeClaim("Hyderabad में पानी safe కాదు").language, /Mixed/);
assert.match(analyzeClaim("水安全吗").language, /Unknown/);
assert.equal(analyzeClaim("123").language, "Unknown");
assert.ok(claimTokens("not no नहीं కాదు").includes("no"));
assert.deepEqual(analyzeClaim("The bridge is not open in 2025.").negationMarkers, ["not"]);
assert.ok(analyzeClaim("Hyderabad in 2025").entityCandidates.includes("Hyderabad"));
assert.ok(analyzeClaim("हैदराबाद").entityMethod.includes("unavailable"));
for (const url of [
  "http://example.org",
  "https://127.0.0.1/x",
  "https://[::1]/x",
  "https://localhost/x",
  "https://x.local/x",
  "https://user:pass@example.org",
  "javascript:alert(1)",
])
  assert.throws(() => sourceUrl(url));
assert.equal(sourceUrl("https://example.org/a?utm_source=x&z=2#x"), "https://example.org/a?z=2");
const item: RetrievedEvidence = {
  title: "Fictional bridge notice",
  url: "https://example.org/bridge",
  excerpt: "Software fixture: the fictional bridge remains open and has not collapsed.",
  retrievedAt: "2026-01-01T00:00:00.000Z",
  provider: "software_test",
};
assert.equal(
  deduplicateEvidence([
    item,
    { ...item, url: item.url + "?utm_source=x" },
    { ...item, url: "https://example.net/copy" },
  ]).length,
  1,
);
assert.equal(
  (
    await googleEvidence("x", async () => {
      throw new Error("must not call");
    })
  ).state.status,
  "unconfigured",
);
process.env.GOOGLE_FACT_CHECK_API_KEY = "test-only-not-real";
const provider = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
const g = await googleEvidence(
  "bridge",
  provider({
    claims: [
      {
        text: item.excerpt,
        claimReview: [
          {
            url: item.url,
            title: item.title,
            publisher: { name: "Fixture Publisher" },
            textualRating: "False",
            reviewDate: "2026-01-01T00:00:00Z",
          },
        ],
      },
    ],
  }),
);
assert.equal(g.state.status, "available");
assert.equal(g.items[0].publisherRating, "False");
assert.equal(g.items[0].excerpt, item.excerpt);
assert.equal(
  (await googleEvidence("x", provider({ claims: "malformed" }))).state.status,
  "unavailable",
);
assert.equal((await googleEvidence("x", provider({}, 429))).state.status, "unavailable");
assert.equal(
  (
    await googleEvidence(
      "x",
      provider({ claims: [{ text: "x", claimReview: [{ url: "https://localhost/x" }] }] }),
    )
  ).items.length,
  0,
);
assert.equal(
  (await googleEvidence("x", provider({ padding: "x".repeat(1024 * 1024) }))).state.status,
  "unavailable",
);
delete process.env.GOOGLE_FACT_CHECK_API_KEY;
const root = fs.mkdtempSync(path.join(os.tmpdir(), "veritas-claim-"));
try {
  const corpus = {
    schemaVersion: 1,
    id: "software-controls",
    license: "Authored unit fixtures",
    approvalReference: "Software tests only",
    approvedBy: "test-operator",
    approvedAt: "2026-01-01T00:00:00.000Z",
    documents: [{ ...item, provider: "operator_corpus", license: "Authored software fixture" }],
  };
  const file = path.join(root, "corpus.json");
  fs.writeFileSync(file, JSON.stringify(corpus));
  process.env.VERITAS_CLAIM_CORPUS = file;
  assert.equal((await corpusEvidence()).state.status, "unavailable");
  process.env.VERITAS_CLAIM_CORPUS_SHA256 = createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
  assert.equal((await corpusEvidence()).items.length, 1);
  const result = await verifyWithEvidence("The fictional bridge collapsed");
  assert.equal(result.verificationStatus, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].stance, "neutral");
  assert.equal(result.confidenceScore, null);
  const review = {
    url: item.url,
    stance: "contradicts" as const,
    quote: "the fictional bridge remains open and has not collapsed.",
    contextConfirmed: true,
  };
  assert.throws(() =>
    reviewEvidence(
      result,
      [{ ...review, quote: "Invented supporting quote" }],
      "Context checked in a software test",
      "test",
    ),
  );
  assert.throws(() =>
    reviewEvidence(
      result,
      [{ ...review, contextConfirmed: false }],
      "Context checked in a software test",
      "test",
    ),
  );
  assert.throws(() =>
    reviewEvidence(result, [review, review], "Context checked in a software test", "test"),
  );
  const reviewed = reviewEvidence(result, [review], "Context checked in a software test", "test");
  assert.equal(reviewed.verificationStatus, "CONTRADICTED");
  assert.match(reviewed.contradictingEvidence![0], /E1/);
  assert.throws(
    () =>
      reviewEvidence(
        {
          ...result,
          sources: result.sources.map((s) => ({ ...s, provider: "google_fact_check" })),
        },
        [review],
        "Metadata is not source evidence",
        "test",
      ),
    /metadata/,
  );
  const second = {
    ...result.sources[0],
    id: "E2",
    url: "https://example.net/bridge",
    excerpt: "Software fixture: the fictional bridge collapsed yesterday.",
  };
  const conflict = reviewEvidence(
    { ...result, sources: [...result.sources, second] },
    [
      review,
      { url: second.url, stance: "supports", quote: second.excerpt, contextConfirmed: true },
    ],
    "Conflicting fictional passages, no real factual claims",
    "test",
  );
  assert.equal(conflict.verificationStatus, "CONFLICTING_EVIDENCE");
  assert.equal(conflict.confidenceScore, null);
  assert.equal(
    reviewEvidence(
      result,
      [{ ...review, stance: "neutral" }],
      "Cannot establish source applicability",
      "test",
    ).verificationStatus,
    "INSUFFICIENT_EVIDENCE",
  );
  const inv = buildDemoInvestigation();
  inv.claimResults = [{ ...reviewed, originalInput: "<script>claim</script>" }];
  const html = reportHtml({
    reportId: "test",
    generatedAt: new Date().toISOString(),
    integrityHash: "unit",
    geminiConfigured: false,
    recommendations: [],
    investigation: inv,
  });
  assert.match(html, /CONTRADICTED/);
  assert.match(html, /E1/);
  assert.ok(!html.includes("<script>claim"));
  inv.claimResults=[{...result,sources:result.sources.map(s=>({...s,provider:'google_fact_check',publishDate:'2026-01-01'}))}];
  const googleHtml=reportHtml({reportId:'metadata-date-test',generatedAt:new Date().toISOString(),integrityHash:'unit',geminiConfigured:false,recommendations:[],investigation:inv});
  assert.match(googleHtml,/review date: 2026-01-01/);
  assert.ok(!googleHtml.includes('published: 2026-01-01'));
  fs.appendFileSync(file, " ");
  assert.equal((await corpusEvidence()).state.status, "unavailable");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.VERITAS_CLAIM_CORPUS;
  delete process.env.VERITAS_CLAIM_CORPUS_SHA256;
}
assert.equal(
  (await verifyWithEvidence("A wholly unsupported event")).verificationStatus,
  "UNAVAILABLE",
);
const controls = JSON.parse(
  fs.readFileSync("test/fixtures/claims/retrieval_controls.json", "utf8"),
);
for (const query of controls.queries) {
  const docs = controls.documents.filter((d: any) => d.language === query.pool);
  const ranked = await rankEvidence(
    query.text,
    docs.map((d: any) => ({
      ...item,
      title: "Software control",
      url: `https://example.org/${d.id}`,
      excerpt: d.text,
    })),
    false,
  );
  if (query.kind === "monolingual")
    assert.equal(new URL(ranked.ranked[0].url).pathname, `/${query.relevant}`);
  if (query.kind === "cross_language") assert.equal(ranked.ranked.length, 0); // no invented translation
  assert.ok(
    bm25(
      query.text,
      docs.map((d: any) => d.text),
    ).every(Number.isFinite),
  );
}
console.log(
  "Claim evidence software tests passed: multilingual diagnostics, provenance, bounded provider parsing, attribution, quote/context gates, conflicts, abstention and export. No factual accuracy benchmark.",
);
