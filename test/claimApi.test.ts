import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import request from "supertest";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "claim-api-"));
process.env.VERITAS_EMBEDDED = "true";
process.env.NODE_ENV = "production";
process.env.APP_GEMINI_API_KEY = "MY_DISABLED";
process.env.VERITAS_STORE = path.join(root, "cases.json");
const tokenA = "claim-test-analyst-a-not-secret-000000",
  tokenB = "claim-test-analyst-b-not-secret-000000";
process.env.VERITAS_USERS = JSON.stringify({ [tokenA]: "analyst-a", [tokenB]: "analyst-b" });
delete process.env.GOOGLE_FACT_CHECK_API_KEY;
delete process.env.VERITAS_EMBEDDING_ENDPOINT;
const excerpt = "Software fixture: the fictional Amber Museum opened on Monday. Entry is free.";
const corpus = {
  schemaVersion: 1,
  id: "api-software-fixture",
  license: "Authored test fixture",
  approvalReference: "Software tests only",
  approvedBy: "test",
  approvedAt: "2026-01-01T00:00:00.000Z",
  documents: [
    {
      title: "Fictional museum notice",
      url: "https://example.org/museum",
      excerpt,
      retrievedAt: "2026-01-01T00:00:00.000Z",
      provider: "operator_corpus",
      license: "Authored software test only",
    },
  ],
};
const file = path.join(root, "corpus.json");
fs.writeFileSync(file, JSON.stringify(corpus));
process.env.VERITAS_CLAIM_CORPUS = file;
process.env.VERITAS_CLAIM_CORPUS_SHA256 = createHash("sha256")
  .update(fs.readFileSync(file))
  .digest("hex");
try {
  const { app } = await import("../server");
  const api = request(app),
    a = { Authorization: `Bearer ${tokenA}` },
    b = { Authorization: `Bearer ${tokenB}` };
  await api.post("/api/claims/verify").send({ claimText: "x" }).expect(401);
  for (const body of [
    { claimText: "" },
    { claimText: "x".repeat(10001) },
    { claimText: "x", sources: [] },
    { claimText: 42 },
  ])
    await api.post("/api/claims/verify").set(a).send(body).expect(400);
  const {
    body: { result },
  } = await api
    .post("/api/claims/verify")
    .set(a)
    .send({ claimText: "The fictional Amber Museum has free entry." })
    .expect(200);
  assert.equal(result.verificationStatus, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].relevance.semanticScore, null);
  const review = {
    url: "https://example.org/museum",
    stance: "supports",
    quote: excerpt,
    contextConfirmed: true,
  };
  const payload = {
    result,
    reviews: [review],
    note: "Software fixture: applicability and full context reviewed.",
  };
  await api.post("/api/claims/review").set(b).send(payload).expect(400);
  await api
    .post("/api/claims/review")
    .set(a)
    .send({ ...payload, result: { ...result, normalizedClaim: "tampered" } })
    .expect(400);
  await api
    .post("/api/claims/review")
    .set(a)
    .send({
      ...payload,
      reviews: [{ ...review, quote: "A fabricated sentence about free admission." }],
    })
    .expect(400);
  await api
    .post("/api/claims/review")
    .set(a)
    .send({ ...payload, reviews: [{ ...review, contextConfirmed: false }] })
    .expect(400);
  await api
    .post("/api/claims/review")
    .set(a)
    .send({ ...payload, reviews: [{ ...review, url: "https://example.org/invented" }] })
    .expect(400);
  const reviewed = (await api.post("/api/claims/review").set(a).send(payload).expect(200)).body
    .result;
  assert.equal(reviewed.verificationStatus, "SUPPORTED");
  assert.equal(reviewed.confidenceScore, null);
  assert.equal(reviewed.sources[0].review.reviewedBy, "analyst-a");
  const created = await api
      .post("/api/investigations")
      .set(a)
      .send({ title: "Phase 3 software API control" })
      .expect(201),
    id = created.body.investigation.id;
  await api
    .post(`/api/investigations/${id}/attach`)
    .set(a)
    .send({ kind: "claim", result: reviewed })
    .expect(200);
  const report = (await api.get(`/api/reports/${id}`).set(a).expect(200)).body.report;
  assert.equal(report.investigation.claimResults[0].verificationStatus, "SUPPORTED");
  assert.equal(report.investigation.claimResults[0].sources[0].review.quote, excerpt);
  delete process.env.VERITAS_CLAIM_CORPUS;
  delete process.env.VERITAS_CLAIM_CORPUS_SHA256;
  for (const [text, language] of [
    ["पानी सुरक्षित नहीं है", "Hindi"],
    ["నీరు సురక్షితం కాదు", "Telugu"],
    ["Hyderabad पानी safe కాదు", "Mixed"],
  ]) {
    const r = (await api.post("/api/claims/verify").set(a).send({ claimText: text }).expect(200))
      .body.result;
    assert.match(r.detectedLanguage, new RegExp(language));
    assert.equal(r.verificationStatus, "UNAVAILABLE");
    assert.deepEqual(r.sources, []);
  }
  console.log(
    "Claim API controls passed: authentication, attribution, signed-result integrity, quote/context review, multilingual abstention and case/report persistence.",
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
