import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AtomicRepository } from "../server/repository";
import { calibrateProbability, classify, type ModelConfig } from "../server/inference";
import { bm25, evidenceVerdict, verifyWithEvidence } from "../server/evidence";
import { analyzeDensityCampaign, densityClusters } from "../server/densityCampaign";
import { analyzeMediaPipeline } from "../server/mediaPipeline";
import { casePatch, claimInput, mediaInput } from "../server/security";
import { reportHtml } from "../src/components/ReportModal";
import { buildDemoInvestigation } from "../server/demoScenario";
import { encodeWav, segmentSamples } from "../src/utils/audioSegments";

let checks = 0;
function test(name: string, fn: () => void) {
  fn();
  checks++;
  console.log(`PASS ${name}`);
}
async function asyncTest(name: string, fn: () => Promise<void>) {
  await fn();
  checks++;
  console.log(`PASS ${name}`);
}
test("Temperature scaling preserves identity, bounds and rejects invalid parameters", () => {
  assert.equal(calibrateProbability(0.7), 0.7);
  assert(calibrateProbability(0.9, 2) < 0.9);
  assert.equal(calibrateProbability(0), 0);
  assert.equal(calibrateProbability(1), 1);
  assert.throws(() => calibrateProbability(NaN));
  assert.throws(() => calibrateProbability(1.1));
  assert.throws(() => calibrateProbability(0.5, 0));
});
test("Real PCM segmentation preserves timestamps, samples and valid WAV headers", () => {
  const samples = Float32Array.from({ length: 16001 }, (_, i) => Math.sin(i / 20));
  const segments = segmentSamples(samples, 16000, 0.5);
  assert.equal(segments.length, 3);
  assert.equal(segments[1].start, 0.5);
  assert.equal(segments[2].end, 16001 / 16000);
  const wav = encodeWav(segments[0].samples, 16000),
    view = new DataView(wav.buffer);
  assert.equal(Buffer.from(wav.subarray(0, 4)).toString(), "RIFF");
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint32(40, true), segments[0].samples.length * 2);
  assert.throws(() => segmentSamples(samples, 0));
});
const config: ModelConfig = {
  task: "image",
  endpoint: "https://inference.example/api",
  modelId: "fixture-model",
  version: "test-1",
  license: "test fixture",
  trainingData: "synthetic protocol fixture only",
  limitations: "not an actual classifier",
};
const mock = (body: unknown, status = 200) =>
  (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
await asyncTest("Missing classifier returns unavailable, never a probability", async () => {
  const result = await classify("image", "data", { ...config, endpoint: undefined });
  assert.equal(result.status, "unavailable");
  assert(!("aiGeneratedProbability" in result));
});
await asyncTest(
  "Adapter validates real provider output and preserves uncalibrated label",
  async () => {
    const result = await classify(
      "image",
      "data",
      config,
      mock({
        modelId: "fixture-model",
        version: "test-1",
        aiGeneratedProbability: 0.83,
        manipulationProbability: null,
      }),
    );
    assert.equal(result.status, "available");
    if (result.status === "available") {
      assert.equal(result.aiGeneratedProbability, 0.83);
      assert.match(result.calibration, /Uncalibrated/);
    }
  },
);
await asyncTest(
  "Failed, malformed, out-of-bounds, mismatched and timed-out inference fails closed",
  async () => {
    for (const body of [
      {},
      { modelId: "wrong", version: "test-1", aiGeneratedProbability: 0.5 },
      { modelId: "fixture-model", version: "test-1", aiGeneratedProbability: 20 },
    ]) {
      assert.equal((await classify("image", "data", config, mock(body))).status, "failed");
    }
    assert.equal((await classify("image", "data", config, mock({}, 503))).status, "failed");
    assert.equal(
      (
        await classify("image", "data", config, (async () => {
          throw new DOMException("Timed out", "TimeoutError");
        }) as typeof fetch)
      ).status,
      "failed",
    );
  },
);
test("BM25 ranks matching evidence above irrelevant text", () => {
  const scores = bm25("Hyderabad water reservoir", [
    "Hyderabad water reservoir report",
    "Cricket match report",
  ]);
  assert(scores[0] > scores[1]);
});
test("Retrieval alone cannot produce a factual verdict; attributed review can", () => {
  const evidence = {
    title: "Source",
    url: "https://example.org/report",
    excerpt: "Claim-specific evidence",
    stance: "contradicts" as const,
  };
  assert.equal(evidenceVerdict([evidence]), "Insufficient Evidence");
  assert.equal(
    evidenceVerdict([{ ...evidence, reviewedBy: "analyst", reviewedAt: new Date().toISOString() }]),
    "Refuted",
  );
  assert.equal(
    evidenceVerdict([{ ...evidence, reviewedBy: "a", reviewedAt: "now", stance: "mixed" }]),
    "Misleading Context",
  );
});
await asyncTest("Live disaster claim cannot match fictional demo bulletin", async () => {
  delete process.env.GOOGLE_FACT_CHECK_API_KEY;
  const result = await verifyWithEvidence("The dam near Hyderabad has collapsed. Evacuate now!");
  assert.equal(result.verdict, "Insufficient Evidence");
  assert.equal(result.isSimulated, false);
  assert.equal(result.sources.length, 0);
});
await asyncTest("Media signal anomalies do not become fake probabilities", async () => {
  delete process.env.VERITAS_IMAGE_ENDPOINT;
  delete process.env.VERITAS_AUDIO_ENDPOINT;
  for (const modality of ["image", "video", "audio"] as const) {
    const r = await analyzeMediaPipeline({
      modality,
      fileName: "input",
      measurements: {
        elaBlockRatio: 99,
        cutCount: 80,
        provenanceAI: true,
        c2paManifest: true,
        hfEnergyRatio: 0,
      },
      mediaData: modality === "video" ? undefined : "test",
    });
    assert.equal(r.authenticity, "inconclusive");
    assert.equal(r.aiGeneratedProbability, null);
    assert.equal(r.confidenceScore, null);
    assert.equal(r.provenance?.verified, false);
  }
});
const post = (account: string, content: string, seconds: number, url?: string) => ({
  account_id: account,
  content,
  timestamp: new Date(Date.UTC(2026, 0, 1, 10, 0, seconds)).toISOString(),
  shared_url: url,
  hashtags: [],
});
test("One thousand people sharing legitimate news do not become suspicious", () => {
  const data = Array.from({ length: 1000 }, (_, i) =>
    post(
      `reader-${i}`,
      "Official weather bulletin: rain forecast for Hyderabad today",
      i % 110,
      "https://weather.example/bulletin",
    ),
  );
  const r = analyzeDensityCampaign("viral news", data, false);
  assert.equal(r.suspiciousPostCount, 0);
  assert(r.nodes.every((n) => !n.suspicious));
  assert.notEqual(r.classification, "Suspicious coordinated amplification");
  assert(r.candidatePairs! < 500000);
  assert(r.truncated, "popular-list cap must be disclosed");
});
test("URL overlap alone cannot create suspicious relationships", () => {
  const r = analyzeDensityCampaign(
    "url",
    [
      post("a", "Rain forecast for the weekend", 1, "https://news.example"),
      post("b", "Football results and match highlights", 2, "https://news.example"),
      post("c", "Museum opens new exhibition", 3, "https://news.example"),
    ],
    false,
  );
  assert.equal(r.edges.length, 0);
  assert.equal(r.suspiciousPostCount, 0);
  const overlap = analyzeDensityCampaign(
    "URL sets",
    [
      {
        ...post("a", "The same specific detailed bulletin headline", 1),
        urls: ["https://one.example/a", "https://two.example/b"],
      },
      {
        ...post("b", "The same specific detailed bulletin headline", 2),
        urls: ["https://two.example/b"],
      },
    ],
    false,
  );
  assert.match(overlap.edges[0].description, /URL overlap 0.5/);
});
test("Recurring synchronized multi-signal posts form explainable DBSCAN communities", () => {
  const rows = ["a", "b", "c", "d"].flatMap((account, i) =>
    Array.from({ length: 3 }, (_, j) => ({
      ...post(
        account,
        "Identical repeated coordinated amplification text for investigation",
        i + j * 30,
        "https://campaign.example/message",
      ),
      post_id: `${account}-${j}`,
    })),
  );
  const result = analyzeDensityCampaign("recurrence", rows, false);
  assert.equal(result.clusters.length, 1);
  assert.equal(result.classification, "Suspicious coordinated amplification");
  assert(result.edges.every((e) => e.description.includes("matching post pairs")));
  assert.equal(result.nodes[0].posts?.length, 3);
});
test("Invalid post timestamps and identities are rejected, never invented", () => {
  assert.throws(() => analyzeDensityCampaign("bad", [{ content: "Some text" }], false));
  assert.throws(() =>
    analyzeDensityCampaign(
      "bad",
      [{ account_id: "a", content: "Some text", timestamp: "not-a-date" }],
      false,
    ),
  );
});
test("DBSCAN excludes isolated noise while retaining a dense group", () => {
  const edge = (a: string, b: string) => ({
    id: a + b,
    source: a,
    target: b,
    weight: 0.9,
    coordinationType: "semantic_copy" as const,
    description: "fixture",
  });
  const labels = densityClusters(
    ["a", "b", "c", "z"],
    [edge("a", "b"), edge("a", "c"), edge("b", "c")],
    3,
  );
  assert.equal(labels.get("a"), labels.get("c"));
  assert(!labels.has("z"));
});
test("Request validation rejects protected PATCH fields and forged MIME signatures", () => {
  assert(!casePatch.safeParse({ id: "other" }).success);
  assert(!casePatch.safeParse({ ownerId: "other" }).success);
  assert(!casePatch.safeParse({ forensicResult: {} }).success);
  assert(casePatch.safeParse({ title: "Updated title" }).success);
  assert(!claimInput.safeParse({ claimText: " " }).success);
  assert(
    !mediaInput.safeParse({
      modality: "image",
      fileName: "evil.png",
      mimeType: "image/png",
      measurements: {},
      mediaData: "data:image/png;base64,PHNjcmlwdD4=",
    }).success,
  );
});
test("Atomic repository preserves committed data on failed writes and corrupt reads fail closed", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "veritas-store-"));
  try {
    const file = path.join(root, "cases.json"),
      validate = (v: any) => {
        assert(Array.isArray(v));
        return v as number[];
      };
    const repo = new AtomicRepository(file, validate);
    repo.write([1]);
    assert.deepEqual(
      repo.read(() => []),
      [1],
    );
    assert.throws(() => repo.write({ bad: true } as any));
    assert.deepEqual(
      repo.read(() => []),
      [1],
    );
    fs.writeFileSync(file, "{broken");
    assert.throws(() => repo.read(() => [99]), /unreadable/);
    const blocked = path.join(root, "blocked");
    fs.writeFileSync(blocked, "file");
    assert.throws(() =>
      new AtomicRepository(path.join(blocked, "cases.json"), validate).write([2]),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test("Report generation escapes untrusted text and labels synthetic evidence", () => {
  const investigation = buildDemoInvestigation();
  investigation.title = "<script>alert(1)</script>";
  const html = reportHtml({
    reportId: "REP-test",
    generatedAt: new Date().toISOString(),
    integrityHash: "sha256:test",
    geminiConfigured: false,
    recommendations: [],
    investigation,
  });
  assert(!html.includes("<script>"));
  assert(html.includes("&lt;script&gt;"));
  assert(html.includes("SIMULATED DEMONSTRATION"));
  assert(html.includes("Methodology"));
});
console.log(`${checks} upgrade tests passed`);
