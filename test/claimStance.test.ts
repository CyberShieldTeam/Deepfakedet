import assert from "node:assert/strict";
import fs from "node:fs";
import { assessClaimRelationships, selectPassage, suggestStance } from "../server/claimStance";
import { approveClaimSelection, extractClaimCandidates, textHash } from "../server/claimExtraction";
import { reviewEvidence, verifyWithEvidence } from "../server/claimVerification";
import { NliWorkerError } from "../server/nliWorker";
import { buildDemoInvestigation } from "../server/demoScenario";
import { buildCorrelation, projectInvestigation } from "../server/correlation";
import { reportHtml } from "../src/components/ReportModal";
const env = { ...process.env };
delete process.env.GOOGLE_FACT_CHECK_API_KEY;
delete process.env.VERITAS_CLAIM_CORPUS;
process.env.VERITAS_WIKIPEDIA_ENABLED = "0";
try {
  const claim = "The authored museum opened in 1992.";
  const base = await verifyWithEvidence(claim);
  base.sources = [
    {
      id: "E1",
      title: "Authored source",
      url: "https://example.org/source",
      domain: "example.org",
      excerpt: "The authored museum opened in 1993. <script>untrusted</script>",
      language: "en",
      provider: "software_test",
      retrievedAt: new Date().toISOString(),
      stance: "neutral",
      credibilityRating: "Unverified Source",
    },
  ];
  base.selectionReview = approveClaimSelection(
    claim,
    {
      candidateId: extractClaimCandidates(claim)[0].id,
      text: claim,
      language: "en",
      contextConfirmed: true,
      note: "Authored software context selection; not actual evidence.",
    },
    "test",
  );
  process.env.VERITAS_NLI_ENABLED = "1";
  process.env.VERITAS_NLI_MODEL_PATH = "test-snapshot-no-download";
  let calls = 0;
  const infer = async (pairs: any[]) => {
    calls++;
    return {
      requestId: "software-control",
      results: pairs.map(() => ({
        status: "executed" as const,
        scores: { contradiction: 0.98, entailment: 0.01, neutral: 0.01 },
        tokens: 20,
        elapsedMs: 1,
      })),
      elapsedMs: 1,
      memory: { rssBytes: 100, peakWorkingSetBytes: null },
      startupMs: 1,
    };
  };
  base.nli = await assessClaimRelationships(base, infer);
  assert.equal(calls, 1);
  assert.equal(base.nli.relationships[0].suggestion, "contradicts");
  assert.equal(base.nli.relationships[0].passageSha256, textHash(base.sources[0].excerpt));
  assert.equal(base.sources[0].stance, "neutral");
  assert.equal(base.verificationStatus, "UNAVAILABLE");
  assert.equal(base.confidenceScore, null);
  const protocol = JSON.parse(fs.readFileSync("test/fixtures/claims/nli_protocol.json", "utf8"));
  assert.equal(protocol.minimumRawScoreForSuggestion, 0.9);
  assert.equal(protocol.minimumRawScoreMargin, 0.5);
  assert.equal(
    suggestStance({ entailment: 0.8, contradiction: 0.1, neutral: 0.1 }).suggestion,
    "abstained",
  );
  const inv = buildDemoInvestigation();
  inv.claimResults = [base];
  let graph = buildCorrelation(projectInvestigation(inv));
  assert.ok(graph.nodes.find((n) => n.type === "source")?.metadata.modelRelationship);
  assert.ok(graph.relationships.some((r) => r.type === "SOURCE_RETRIEVED_FOR_CLAIM"));
  assert.ok(!graph.relationships.some((r) => r.type === "SOURCE_ADDRESSES_CLAIM"));
  const payload = [
    {
      sourceId: "E1",
      url: base.sources[0].url,
      stance: "supports" as const,
      quote: base.sources[0].excerpt,
      contextConfirmed: true,
    },
  ];
  const reviewed = reviewEvidence(
    base,
    payload,
    "Authored control: independent human choice conflicts with model suggestion.",
    "human-one",
  );
  assert.equal(reviewed.verificationStatus, "SUPPORTED");
  assert.equal(reviewed.nli!.relationships[0].suggestion, "contradicts");
  assert.equal(reviewed.nli!.relationships[0].humanStance, "supports");
  const corrected = reviewEvidence(
    reviewed,
    [{ ...payload[0], stance: "contradicts" }],
    "Authored control: corrected stance with full context and exact quotation.",
    "human-two",
  );
  assert.equal(corrected.sources[0].reviewHistory![0].reviewedBy, "human-one");
  assert.equal(corrected.sources[0].reviewHistory![0].stance, "supports");
  assert.equal(corrected.sources[0].review!.reviewedBy, "human-two");
  const rejected = reviewEvidence(
    corrected,
    [{ ...payload[0], stance: "neutral" }],
    "Authored control: unresolved applicability, rejecting any decisive stance.",
    "human-three",
  );
  assert.equal(rejected.verificationStatus, "INSUFFICIENT_EVIDENCE");
  assert.equal(rejected.nli!.relationships[0].humanStance, "neutral");
  assert.equal(rejected.sources[0].reviewHistory!.length, 3);
  inv.claimResults = [corrected];
  graph = buildCorrelation(projectInvestigation(inv));
  assert.ok(graph.relationships.some((r) => r.type === "SOURCE_ADDRESSES_CLAIM"));
  const html = reportHtml({
    reportId: "control",
    generatedAt: new Date().toISOString(),
    integrityHash: "control",
    geminiConfigured: false,
    recommendations: [],
    investigation: inv,
  });
  assert.ok(html.includes(corrected.nli!.relationships[0].passageSha256));
  assert.ok(html.includes("human-one"));
  assert.ok(html.includes("&lt;script&gt;untrusted&lt;/script&gt;"));
  assert.ok(!html.includes("<script>untrusted"));
  const long = "A distant unrelated sentence. ".repeat(100) + "The authored museum opened in 1993.";
  const selected = selectPassage(claim, long)!;
  assert.ok(selected.text.includes("1993"));
  assert.equal(long.slice(selected.start, selected.end), selected.text);
  assert.ok(selected.text.length <= 1800);
  const never = async () => {
    throw Error("must not call model");
  };
  const noSelection = structuredClone(base);
  delete noSelection.selectionReview;
  assert.equal(
    (await assessClaimRelationships(noSelection, never)).relationships[0].status,
    "selection_required",
  );
  const foreign = structuredClone(base);
  foreign.selectionReview!.language = "hi";
  assert.equal(
    (await assessClaimRelationships(foreign, never)).relationships[0].status,
    "unsupported_language",
  );
  const missingLang = structuredClone(base);
  delete missingLang.sources[0].language;
  assert.equal(
    (await assessClaimRelationships(missingLang, never)).relationships[0].status,
    "unsupported_language",
  );
  const badHash = structuredClone(base);
  badHash.sources[0].passageSha256 = "0".repeat(64);
  assert.equal((await assessClaimRelationships(badHash, never)).relationships[0].status, "failed");
  const metadata = structuredClone(base);
  metadata.sources[0].provider = "google_fact_check";
  assert.equal(
    (await assessClaimRelationships(metadata, never)).relationships[0].status,
    "metadata_only",
  );
  const failed = await assessClaimRelationships(base, async () => {
    throw new NliWorkerError("TIMEOUT");
  });
  assert.equal(failed.relationships[0].status, "timeout");
  assert.equal(failed.relationships[0].scores, undefined);
  assert.equal(
    base.sources[0].excerpt,
    "The authored museum opened in 1993. <script>untrusted</script>",
  );
  process.env.VERITAS_NLI_ENABLED = "0";
  assert.equal((await assessClaimRelationships(base, never)).relationships[0].scores, undefined);
  console.log(
    "Stance controls passed: exact windows/hashes, fixed abstention, no automatic verdict/review/graph promotion, manual correction/rejection history, language/metadata gates, failure preservation, escaped report and old-result compatibility. Authored model outputs are software controls only.",
  );
} finally {
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
  Object.assign(process.env, env);
}
