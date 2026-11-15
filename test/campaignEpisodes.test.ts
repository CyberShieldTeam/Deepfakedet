import assert from "node:assert/strict";
import { analyzeDensityCampaignBaseline } from "../server/densityCampaign";
import {
  analyzeEpisodeCampaign,
  prepareCampaignPosts,
  timestampEvidence,
  EPISODE_POLICY,
} from "../server/campaignEpisodes";
import { campaignEmbeddingInputs, campaignEmbeddings } from "../server/campaignEmbedding";
import { episodeControls, coverage } from "./fixtures/campaign/episodeControls";
import { reportHtml } from "../src/components/ReportModal";
import { buildDemoInvestigation } from "../server/demoScenario";
for (const control of episodeControls) {
  const r = analyzeEpisodeCampaign(control.name, control.rows, false, {}, null, coverage),
    e = r.episodeEvidence!;
  assert.equal(
    e.associations.filter((a) => a.recurrenceEligible).length,
    control.expected.recurrenceEligiblePairs,
    control.name,
  );
  assert.ok(
    e.associations.every((a) => a.episodeIds.length === control.expected.episodesPerPair),
    control.name,
  );
  assert.ok(r.nodes.every((n) => !n.suspicious && n.botLikelihoodScore === null));
  assert.equal(r.overallCoordinationIndex, null);
  assert.notEqual(r.classification, "Suspicious coordinated amplification");
  for (const edge of r.edges) {
    const a = e.associations.find((a) => a.edgeId === edge.id)!;
    assert.ok(a.witnessIds.length);
    for (const id of a.witnessIds) {
      const w = e.witnesses.find((w) => w.id === id)!;
      assert.ok(e.posts.some((p) => p.reference === w.sourcePost && p.accountId === edge.source));
      assert.ok(e.posts.some((p) => p.reference === w.targetPost && p.accountId === edge.target));
    }
  }
  for (const ep of e.episodes) {
    const used = new Set<string>();
    for (const id of ep.witnessIds) {
      const w = e.witnesses.find((w) => w.id === id)!;
      assert.ok(!used.has(w.sourcePost) && !used.has(w.targetPost));
      used.add(w.sourcePost);
      used.add(w.targetPost);
    }
    assert.ok(Date.parse(ep.end) - Date.parse(ep.start) <= 300000);
  }
}
const repeated = episodeControls.find((c) => c.name === "repeated_official_bulletins")!;
assert.equal(
  analyzeDensityCampaignBaseline("baseline", repeated.rows, false).nodes.filter((n) => n.suspicious)
    .length,
  4,
);
const pattern = episodeControls.find((c) => c.name === "multi_episode_pattern")!;
assert.ok(
  analyzeEpisodeCampaign(
    "missing coverage",
    pattern.rows,
    false,
  ).episodeEvidence!.associations.every((a) => !a.recurrenceEligible),
);
const noIds = pattern.rows.map(({ post_id, ...row }) => row);
assert.ok(
  analyzeEpisodeCampaign(
    "missing IDs",
    noIds,
    false,
    {},
    null,
    coverage,
  ).episodeEvidence!.associations.every((a) => !a.recurrenceEligible),
);
const duplicated = [
  ...repeated.rows,
  ...repeated.rows.map((r) => ({ ...r, post_id: r.post_id + "-copy" })),
];
const d = analyzeEpisodeCampaign("duplicates", duplicated, false, {}, null, coverage);
assert.equal(d.totalPosts, repeated.rows.length);
assert.equal(d.episodeEvidence!.duplicatesRemoved, repeated.rows.length);
assert.throws(
  () =>
    prepareCampaignPosts([pattern.rows[0], { ...pattern.rows[0], content: "Conflicting payload" }]),
  /Conflicting/,
);
const reverse = analyzeEpisodeCampaign(
  "reversed",
  [...pattern.rows].reverse(),
  false,
  {},
  null,
  coverage,
);
assert.deepEqual(
  reverse.episodeEvidence!.episodes.map((e) => [e.id, e.witnessIds]),
  analyzeEpisodeCampaign(
    "original",
    pattern.rows,
    false,
    {},
    null,
    coverage,
  ).episodeEvidence!.episodes.map((e) => [e.id, e.witnessIds]),
);
assert.equal(timestampEvidence("2026-01-01T05:30:00+05:30").timestamp, "2026-01-01T00:00:00.000Z");
assert.equal(timestampEvidence("2026-01-01").resolutionMs, 86400000);
assert.equal(timestampEvidence("2026-01-01T00:00Z").resolutionMs, 60000);
assert.throws(() => timestampEvidence("2026-01-01T00:00:00"));
assert.throws(() => timestampEvidence("2026-02-30"));
const coarse = pattern.rows.map((r) => ({ ...r, timestamp: r.timestamp.slice(0, 16) + "Z" }));
assert.ok(
  analyzeEpisodeCampaign(
    "coarse",
    coarse,
    false,
    {},
    null,
    coverage,
  ).episodeEvidence!.associations.every((a) => !a.recurrenceEligible),
);
assert.throws(() => analyzeEpisodeCampaign("limit", Array(3001).fill(pattern.rows[0]), false));
const dense = Array.from({ length: 150 }, (_, i) => ({
  account_id: "acct-" + i,
  post_id: "post-" + i,
  content: "Identical authored public bulletin for candidate cap software testing only.",
  timestamp: "2026-01-01T00:00:00Z",
  url: "https://example.org/news",
}));
const limited = analyzeEpisodeCampaign("bounded", dense, false, {}, null, coverage);
assert.ok(limited.truncated);
assert.ok(limited.edges.length <= EPISODE_POLICY.maxPairs);
assert.ok(limited.episodeEvidence!.witnesses.length <= EPISODE_POLICY.maxWitnesses);
assert.ok(limited.episodeEvidence!.associations.every((a) => !a.recurrenceEligible));
const config = {
  task: "embedding" as const,
  modelId: "software-generic",
  version: "v1",
  license: "fixture",
  trainingData: "none",
  limitations: "software only",
};
assert.deepEqual(campaignEmbeddingInputs(["Hindi हिन्दी", "Telugu తెలుగు"], config, "generic"), [
  "Hindi हिन्दी",
  "Telugu తెలుగు",
]);
const e5 = {
  ...config,
  modelId: "intfloat/multilingual-e5-small",
  version: "614241f622f53c4eeff9890bdc4f31cfecc418b3",
};
assert.deepEqual(campaignEmbeddingInputs(["తెలుగు"], e5, "e5-similarity"), ["query: తెలుగు"]);
assert.throws(() => campaignEmbeddingInputs(["x"], e5, "generic"));
assert.throws(() => campaignEmbeddingInputs(["x"], { ...e5, version: "unknown" }, "e5-similarity"));
delete process.env.VERITAS_EMBEDDING_ENDPOINT;
assert.equal((await campaignEmbeddings(["x"])).metadata.status, "unavailable");
const inv = buildDemoInvestigation();
inv.campaignResult = analyzeEpisodeCampaign(
  "Escaped <script>control</script>",
  pattern.rows,
  false,
  {},
  null,
  coverage,
);
const html = reportHtml({
  reportId: "episode-test",
  generatedAt: new Date().toISOString(),
  integrityHash: "software",
  geminiConfigured: false,
  recommendations: [],
  investigation: inv,
});
assert.ok(!html.includes("<script>control")); // Export ledger assertions added with renderer integration.
assert.ok(html.includes('Campaign episode evidence'));assert.ok(html.includes('witness:'));assert.ok(html.includes(pattern.rows[0].post_id));assert.ok(html.includes(pattern.rows[0].timestamp));
const declared=pattern.rows.map(row=>({...row,timestamp_precision:'hour'}));
assert.ok(analyzeEpisodeCampaign('declared precision',declared,false,{},null,coverage).episodeEvidence!.associations.every(a=>!a.recurrenceEligible));
console.log(
  "Campaign episode controls passed: traceability, one-to-one matching, separated episodes, duplicates, coverage/precision, caps, contracts and no maliciousness labels.",
);
