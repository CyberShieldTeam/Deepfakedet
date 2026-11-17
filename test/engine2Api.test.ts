import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import request from "supertest";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "engine2-api-")),
  store = path.join(root, "cases.json"),
  file = path.join(root, "corpus.json"),
  token = "engine2-software-owner-not-secret-000000",
  other = "engine2-software-other-not-secret-000000";
Object.assign(process.env, {
  VERITAS_EMBEDDED: "true",
  NODE_ENV: "production",
  APP_GEMINI_API_KEY: "MY_DISABLED",
  VERITAS_NLI_ENABLED: "0",
  VERITAS_WIKIPEDIA_ENABLED: "0",
  GOOGLE_FACT_CHECK_API_KEY: "",
  VERITAS_EMBEDDING_ENDPOINT: "",
  VERITAS_STORE: store,
  VERITAS_USERS: JSON.stringify({ [token]: "owner", [other]: "other" }),
  VERITAS_CLAIM_CORPUS: file,
});
const original = "BREAKING: The authored museum opened in 1992. Please share this with everyone!",
  excerpt = "The authored museum opened in 1992.";
const corpus = {
  schemaVersion: 1,
  id: "authored-engine2-control",
  license: "Authored software fixture only",
  approvalReference: "Software control, not factual evidence",
  approvedBy: "test",
  approvedAt: "2026-01-01T00:00:00.000Z",
  documents: [
    {
      title: "Authored source",
      url: "https://example.org/source",
      excerpt,
      language: "en",
      provider: "operator_corpus",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      license: "Authored control",
    },
  ],
};
fs.writeFileSync(file, JSON.stringify(corpus));
process.env.VERITAS_CLAIM_CORPUS_SHA256 = createHash("sha256")
  .update(fs.readFileSync(file))
  .digest("hex");
try {
  const { app } = await import("../server");
  const api = request(app),
    a = { Authorization: `Bearer ${token}` },
    b = { Authorization: `Bearer ${other}` };
  await api.post("/api/claims/extract").send({ claimText: original }).expect(401);
  const extraction = (
    await api.post("/api/claims/extract").set(a).send({ claimText: original }).expect(200)
  ).body;
  assert.equal(extraction.candidates[0].category, "assertion_candidate");
  assert.equal(extraction.candidates[1].category, "instruction");
  const selection = {
    candidateId: extraction.candidates[0].id,
    text: extraction.candidates[0].text,
    language: "en",
    contextConfirmed: true,
    note: "Authored software selection: retained exact assertion and original context.",
  };
  await api
    .post("/api/claims/verify")
    .set(a)
    .send({ claimText: original, selection: { ...selection, candidateId: "wrong" } })
    .expect(400);
  await api
    .post("/api/claims/verify")
    .set(a)
    .send({ claimText: original, selection: { ...selection, contextConfirmed: false } })
    .expect(400);
  const result = (
    await api.post("/api/claims/verify").set(a).send({ claimText: original, selection }).expect(200)
  ).body.result;
  assert.equal(result.originalInput, original);
  assert.equal(result.targetClaim, excerpt);
  assert.equal(result.selectionReview.reviewedBy, "owner");
  assert.equal(result.selectionReview.originalCandidate.start, 10);
  assert.equal(result.nli.status, "unconfigured");
  assert.equal(result.verificationStatus, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.confidenceScore, null);
  assert.equal(result.sources[0].stance, "neutral");
  const payload = {
    result,
    reviews: [
      {
        sourceId: "E1",
        url: result.sources[0].url,
        stance: "supports",
        quote: excerpt,
        contextConfirmed: true,
      },
    ],
    note: "Authored source applicability review, not independent factual validation.",
  };
  await api.post("/api/claims/review").set(b).send(payload).expect(400);
  await api
    .post("/api/claims/review")
    .set(a)
    .send({ ...payload, result: { ...result, nli: { ...result.nli, summary: "tampered" } } })
    .expect(400);
  const reviewed = (await api.post("/api/claims/review").set(a).send(payload).expect(200)).body
    .result;
  assert.equal(reviewed.verificationStatus, "SUPPORTED");
  assert.equal(reviewed.nli.relationships[0].suggestion, null);
  assert.equal(reviewed.nli.relationships[0].humanStance, "supports");
  const corrected = (
    await api
      .post("/api/claims/review")
      .set(a)
      .send({
        ...payload,
        result: reviewed,
        reviews: [{ ...payload.reviews[0], stance: "neutral" }],
      })
      .expect(200)
  ).body.result;
  assert.equal(corrected.verificationStatus, "INSUFFICIENT_EVIDENCE");
  assert.equal(corrected.sources[0].reviewHistory[0].stance, "supports");
  assert.equal(corrected.sources[0].reviewHistory[1].stance, "neutral");
  const inv = (
    await api
      .post("/api/investigations")
      .set(a)
      .send({ title: "Engine 2 authored API control" })
      .expect(201)
  ).body.investigation;
  await api
    .post(`/api/investigations/${inv.id}/attach`)
    .set(a)
    .send({ kind: "claim", result: corrected })
    .expect(200);
  await api.post(`/api/investigations/${inv.id}/correlate`).set(a).send({}).expect(200);
  const report = (await api.get(`/api/reports/${inv.id}`).set(a).expect(200)).body.report,
    disk = JSON.parse(fs.readFileSync(store, "utf8")).find((i: any) => i.id === inv.id);
  assert.deepEqual(disk, report.investigation);
  assert.deepEqual(disk.claimResults[0].nli, corrected.nli);
  assert.deepEqual(disk.claimResults[0].selectionReview, corrected.selectionReview);
  assert.equal(disk.claimResults[0].sources[0].excerpt, excerpt);
  console.log(
    "Engine2 API controls passed: authenticated extraction, explicit original-bound selection, owner-bound inference/review receipts, unchanged aggregate gate, review history, graph and exact disk/report preservation.",
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
