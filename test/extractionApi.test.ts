import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { runExtraction } from "../server/extractionRunner";
import { createHash } from "node:crypto";
import { OCR_MODEL } from "../server/extraction";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "veritas-extraction-")),
  store = path.join(root, "cases.json");
process.env.VERITAS_EMBEDDED = "true";
process.env.NODE_ENV = "production";
process.env.APP_GEMINI_API_KEY = "MY_DISABLED";
process.env.VERITAS_STORE = store;
const token = "extraction-test-owner-not-secret-000000",
  other = "extraction-test-other-not-secret-000000";
process.env.VERITAS_USERS = JSON.stringify({ [token]: "extraction-owner", [other]: "other" });
delete process.env.GOOGLE_FACT_CHECK_API_KEY;
delete process.env.VERITAS_EMBEDDING_ENDPOINT;
const text = "Software fixture: the fictional Amber Museum offers free entry.";
const corpus = JSON.stringify({
  schemaVersion: 1,
  id: "engine41-authored",
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
fs.writeFileSync(path.join(root, "corpus.json"), corpus);
process.env.VERITAS_CLAIM_CORPUS = path.join(root, "corpus.json");
process.env.VERITAS_CLAIM_CORPUS_SHA256 = createHash("sha256").update(corpus).digest("hex");
const endpoint = process.env.VERITAS_AI_SERVICE_URL;
assert.ok(endpoint, "Start isolated Python service and explicitly set VERITAS_AI_SERVICE_URL");
const bytes = fs.readFileSync(".model-cache/extraction-fixtures/clear.png"),
  data = "data:image/png;base64," + bytes.toString("base64"),
  hash = createHash("sha256").update(bytes).digest("hex");
try {
  const { app } = await import("../server"),
    api = request(app),
    a = { Authorization: `Bearer ${token}` },
    b = { Authorization: `Bearer ${other}` };
  const inv = (
    await api
      .post("/api/investigations")
      .set(a)
      .send({ title: "Engine4.1 authored extraction test" })
      .expect(201)
  ).body.investigation;
  const media = (
    await api
      .post("/api/forensics/analyze-media")
      .set(a)
      .send({
        modality: "image",
        fileName: "authored-clear.png",
        mimeType: "image/png",
        mediaData: data,
        measurements: {},
      })
      .expect(200)
  ).body.result;
  await api
    .post(`/api/investigations/${inv.id}/attach`)
    .set(a)
    .send({ kind: "media", result: media })
    .expect(200);
  const base = `/api/investigations/${inv.id}`,
    body = { mediaHash: hash, mediaData: data, modality: "image", language: "eng" };
  await api
    .post(base + "/extract")
    .set(b)
    .send(body)
    .expect(404);
  await api
    .post(base + "/extract")
    .send(body)
    .expect(401);
  await api
    .post(base + "/extract")
    .set(a)
    .send({ ...body, mediaHash: "a".repeat(64) })
    .expect(409);
  const begin = performance.now();
  const first = (
    await api
      .post(base + "/extract")
      .set(a)
      .send(body)
      .expect(200)
  ).body.result;
  const apiMs = performance.now() - begin;
  console.log("Actual OCR:", JSON.stringify(first.originalText));
  assert.ok(first.originalText.includes("Amber Museum"));
  assert.ok(first.candidates.length > 0);
  const candidate = first.candidates[0],
    route = base + "/extractions/" + encodeURIComponent(first.id);
  await api
    .post(route + "/investigate")
    .set(a)
    .send({ candidateId: candidate.id, revision: 0 })
    .expect(409);
  const pending = (
    await api
      .post(base + "/correlate")
      .set(a)
      .send({})
      .expect(200)
  ).body.result;
  assert.ok(!pending.relationships.some((e: any) => e.type === "CLAIM_INVESTIGATED_BY_ENGINE2"));
  const review = {
    candidateId: candidate.id,
    revision: 0,
    state: "accepted",
    reason: "Authored source image inspected in software test",
    sourceConfirmed: true,
  };
  await api
    .post(route + "/review")
    .set(b)
    .send(review)
    .expect(404);
  await api
    .post(route + "/review")
    .set(a)
    .send({ ...review, reviewedBy: "forged" })
    .expect(400);
  await api
    .post(route + "/review")
    .set(a)
    .send({ ...review, sourceConfirmed: false })
    .expect(409);
  await api
    .post(route + "/review")
    .set(a)
    .send(review)
    .expect(200);
  await api
    .post(route + "/review")
    .set(a)
    .send(review)
    .expect(409);
  const investigated = (
    await api
      .post(route + "/investigate")
      .set(a)
      .send({ candidateId: candidate.id, revision: 1 })
      .expect(200)
  ).body;
  assert.equal(investigated.result.extractionOrigin.reviewRevision, 1);
  assert.equal(investigated.result.verdict, "Insufficient Evidence");
  assert.ok(investigated.result.sources.length > 0, "actual authored corpus retrieval");
  await api
    .post(route + "/investigate")
    .set(a)
    .send({ candidateId: candidate.id, revision: 1 })
    .expect(200);
  const linked = (
    await api
      .post(base + "/correlate")
      .set(a)
      .send({})
      .expect(200)
  ).body.result;
  for (const type of [
    "MEDIA_CONTAINS_TEXT",
    "TEXT_PROPOSES_CLAIM",
    "CLAIM_REVIEWED_FROM_TEXT",
    "CLAIM_INVESTIGATED_BY_ENGINE2",
    "SOURCE_RETRIEVED_FOR_CLAIM",
  ])
    assert.ok(
      linked.relationships.some((e: any) => e.type === type),
      type,
    );
  const repeat = (
    await api
      .post(base + "/extract")
      .set(a)
      .send(body)
      .expect(200)
  ).body;
  assert.equal(repeat.investigation.extractions.length, 1);
  assert.equal(repeat.result.candidates[0].reviews.length, 1);
  assert.equal(repeat.investigation.claimResults.length, 1);
  const originalStat = fs.statSync,
    statDescriptor = Object.getOwnPropertyDescriptor(fs, "statSync")!;
  try {
    Object.defineProperty(fs, "statSync", {
      ...statDescriptor,
      value: (file: any, ...args: any[]) => {
        if (file === OCR_MODEL.path) throw new Error("Mock missing model control");
        return (originalStat as any)(file, ...args);
      },
    });
    const missing = await api
      .post(base + "/extract")
      .set(a)
      .send(body)
      .expect(503);
    assert.equal(missing.body.state, "UNAVAILABLE");
  } finally {
    Object.defineProperty(fs, "statSync", statDescriptor);
  }
  await api
    .post(base + "/extract")
    .set(a)
    .send({ ...body, language: "hin" })
    .expect(503);
  await api
    .post(base + "/extract")
    .set(a)
    .send({ ...body, language: "tel" })
    .expect(503);
  process.env.VERITAS_AI_SERVICE_URL = "http://127.0.0.1:1";
  await api
    .post(base + "/extract")
    .set(a)
    .send(body)
    .expect(503);
  process.env.VERITAS_AI_SERVICE_URL = endpoint;
  const saved = (await api.get(base).set(a).expect(200)).body.investigation;
  assert.deepEqual(saved.extractions, repeat.investigation.extractions);
  assert.equal(saved.extractionRun.state, "FAILED");
  const report = (await api.get(`/api/reports/${inv.id}`).set(a).expect(200)).body.report;
  assert.deepEqual(report.investigation.extractions, saved.extractions);
  const disk = JSON.parse(fs.readFileSync(store, "utf8")).find((i: any) => i.id === inv.id);
  assert.deepEqual(disk.extractions, saved.extractions);
  const backup = store + ".backup";
  fs.renameSync(store, backup);
  fs.mkdirSync(store);
  await api
    .post(route + "/review")
    .set(a)
    .send({
      ...review,
      revision: 1,
      state: "corrected",
      reviewedText: "the fictional Amber Museum offers free entry.",
      reason: "Storage failure control",
    })
    .expect(500);
  fs.rmdirSync(store);
  fs.renameSync(backup, store);
  const rolledBack = (await api.get(base).set(a).expect(200)).body.investigation;
  assert.deepEqual(rolledBack.extractions, saved.extractions);
  await api
    .post(route + "/review")
    .set(a)
    .send({
      ...review,
      revision: 1,
      state: "rejected",
      sourceConfirmed: false,
      reason: "Withdrawal control",
    })
    .expect(200);
  const revoked = (
    await api
      .post(base + "/correlate")
      .set(a)
      .send({})
      .expect(200)
  ).body;
  assert.ok(
    !revoked.result.relationships.some((e: any) => e.type === "CLAIM_INVESTIGATED_BY_ENGINE2"),
  );
  assert.equal(revoked.investigation.claimResults.length, 1);
  const quality: any[] = [];
  for (const name of [
    "no-text",
    "blurred",
    "low-resolution",
    "rotated",
    "hindi",
    "telugu",
    "mixed",
  ]) {
    const raw = fs.readFileSync(`.model-cache/extraction-fixtures/${name}.png`),
      r = await runExtraction(
        "quality-" + name,
        createHash("sha256").update(raw).digest("hex"),
        "data:image/png;base64," + raw.toString("base64"),
        "eng",
        "image",
      );
    quality.push({
      name,
      state: r.state,
      text: r.originalText,
      timing: r.timing,
      candidates: r.candidates.length,
      recognitionLanguage: "eng",
      unsupportedScriptControl: ["hindi", "telugu", "mixed"].includes(name),
    });
    if (name === "no-text") assert.equal(r.state, "NO_TEXT_DETECTED");
  }
  await assert.rejects(runExtraction("unsupported", hash, data, "eng", "video"), /unavailable/);
  await assert.rejects(runExtraction("unsupported", hash, data, "eng", "audio"), /unavailable/);
  const rotatedBytes = fs.readFileSync(".model-cache/extraction-fixtures/rotated.png"),
    rotatedData = "data:image/png;base64," + rotatedBytes.toString("base64");
  const rotatedMedia = (
    await api
      .post("/api/forensics/analyze-media")
      .set(a)
      .send({
        modality: "image",
        fileName: "authored-rotated.png",
        mimeType: "image/png",
        mediaData: rotatedData,
        measurements: {},
      })
      .expect(200)
  ).body.result;
  await api
    .post(base + "/attach")
    .set(a)
    .send({ kind: "media", result: rotatedMedia })
    .expect(200);
  const rotatedBody = {
    mediaHash: rotatedMedia.submittedMedia.sha256,
    mediaData: rotatedData,
    modality: "image",
    language: "eng",
    profile: "rotate270",
  };
  await api
    .post(base + "/extract")
    .set(a)
    .send({ ...rotatedBody, profile: "unbounded-auto-search" })
    .expect(400);
  const oriented = (
    await api
      .post(base + "/extract")
      .set(a)
      .send(rotatedBody)
      .expect(200)
  ).body.result;
  assert.ok(oriented.originalText.includes("Amber Museum"));
  assert.equal(oriented.geometry.profile, "rotate270");
  assert.notEqual(oriented.id, first.id);
  for (const s of oriented.segments) {
    assert.ok(s.sourceBbox.x >= -1 && s.sourceBbox.y >= -1);
    assert.ok(s.sourceBbox.x + s.sourceBbox.width <= oriented.geometry.originalWidth + 1);
    assert.ok(s.sourceBbox.y + s.sourceBbox.height <= oriented.geometry.originalHeight + 1);
  }
  const rc = oriented.candidates[0],
    rr = base + "/extractions/" + encodeURIComponent(oriented.id);
  const correction = (
    await api
      .post(rr + "/review")
      .set(a)
      .send({
        candidateId: rc.id,
        revision: 0,
        state: "corrected",
        reviewedText: "the fictional Amber Museum offers free entry.",
        reason: "Authored source inspected; shortened exact source wording",
        sourceConfirmed: true,
      })
      .expect(200)
  ).body.investigation;
  assert.equal(
    correction.extractions.find((e: any) => e.id === oriented.id).candidates[0].originalText,
    rc.originalText,
  );
  const rcResult = (
    await api
      .post(rr + "/investigate")
      .set(a)
      .send({ candidateId: rc.id, revision: 1 })
      .expect(200)
  ).body.result;
  assert.equal(
    rcResult.extractionOrigin.reviewedText,
    "the fictional Amber Museum offers free entry.",
  );
  assert.equal(rcResult.verdict, "Insufficient Evidence");
  const rotatedGraph = (
    await api
      .post(base + "/correlate")
      .set(a)
      .send({})
      .expect(200)
  ).body.result;
  assert.ok(
    rotatedGraph.relationships.some(
      (e: any) =>
        e.type === "MEDIA_CONTAINS_TEXT" &&
        e.measurements.profile === "rotate270" &&
        e.measurements.sourceBbox,
    ),
  );
  assert.ok(
    rotatedGraph.relationships.some((e: any) => e.type === "CLAIM_INVESTIGATED_BY_ENGINE2"),
  );
  const sourceEdge = rotatedGraph.relationships.find(
    (e: any) => e.type === "MEDIA_CONTAINS_TEXT" && e.measurements.profile === "rotate270",
  );
  assert.deepEqual(sourceEdge.measurements.bbox, sourceEdge.measurements.processingBbox);
  fs.writeFileSync(
    process.env.VERITAS_EXTRACTION_TEST_REPORT || "reports/engine42_api_controls.json",
    JSON.stringify(
      {
        scope: "authored software controls; NOT independent accuracy",
        clear: { text: first.originalText, timing: first.timing, apiMs },
        correlationMs: linked.elapsedMs,
        quality,
        rotationControl: {
          sourceHash: oriented.sourceMediaHash,
          originalText: oriented.originalText,
          geometry: oriented.geometry,
          segments: oriented.segments,
          reviewedText: rcResult.extractionOrigin.reviewedText,
          claimVerdict: rcResult.verdict,
          sourceEdge,
        },
        independentAccuracy: null,
      },
      null,
      2,
    ),
  );
  console.log(
    "Actual OCR/API passed: owned source bytes, review gate, corpus retrieval, Engine4 path, idempotent reruns, missing-language/failure preservation, withdrawal, report/disk parity, bounded image quality controls.",
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
