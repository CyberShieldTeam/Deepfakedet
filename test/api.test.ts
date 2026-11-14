import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "veritas-api-"));
process.env.VERITAS_EMBEDDED = "true";
process.env.NODE_ENV = "production";
process.env.APP_GEMINI_API_KEY = "";
process.env.VERITAS_STORE = path.join(root, "cases.json");
const tokenA = "test-only-analyst-a-token-not-a-secret-000000";
const tokenB = "test-only-analyst-b-token-not-a-secret-000000";
process.env.VERITAS_USERS = JSON.stringify({ [tokenA]: "analyst-a", [tokenB]: "analyst-b" });
delete process.env.GOOGLE_FACT_CHECK_API_KEY;
delete process.env.VERITAS_IMAGE_ENDPOINT;
try {
  const { app } = await import("../server");
  const api = request(app),
    a = { Authorization: `Bearer ${tokenA}` },
    b = { Authorization: `Bearer ${tokenB}` };
  await api.get("/api/investigations").expect(401);
  await api.get("/api/health").expect(200);
  await api.post("/api/session").send({ token: "invalid" }).expect(401);
  const session = await api.post("/api/session").send({ token: tokenA }).expect(200);
  assert(String(session.headers["set-cookie"]).includes("HttpOnly"));
  await api.get("/api/investigations").set("Cookie", session.headers["set-cookie"]).expect(200);
  await api
    .post("/api/investigations")
    .set(a)
    .send({ title: "x", ownerId: "analyst-b" })
    .expect(400);
  const created = await api
    .post("/api/investigations")
    .set(a)
    .send({ title: "Integration case" })
    .expect(201);
  const id = created.body.investigation.id;
  assert.equal(created.body.investigation.ownerId, "analyst-a");
  const other = await api.get("/api/investigations").set(b).expect(200);
  assert(!other.body.investigations.some((i: any) => i.id === id));
  await api.get(`/api/investigations/${id}`).set(b).expect(404);
  await api.patch(`/api/investigations/${id}`).set(b).send({ title: "hijack" }).expect(404);
  await api.delete(`/api/investigations/${id}`).set(b).expect(404);
  await api.get(`/api/reports/${id}`).set(b).expect(404);
  await api.patch(`/api/investigations/${id}`).set(a).send({ ownerId: "analyst-b" }).expect(400);
  await api.patch(`/api/investigations/${id}`).set(a).send({ title: "Updated case" }).expect(200);
  await api.post("/api/claims/verify").set(a).send({ claimText: "" }).expect(400);
  const verified = await api
    .post("/api/claims/verify")
    .set(a)
    .send({ claimText: "Dam near Hyderabad collapsed!" })
    .expect(200);
  assert.equal(verified.body.result.verdict, "Insufficient Evidence");
  assert.equal(verified.body.result.isSimulated, false);
  await api
    .post(`/api/investigations/${id}/attach`)
    .set(b)
    .send({ kind: "claim", result: verified.body.result })
    .expect(404);
  await api
    .post(`/api/investigations/${id}/attach`)
    .set(a)
    .send({ kind: "claim", result: { ...verified.body.result, verdict: "Supported" } })
    .expect(400);
  await api
    .post(`/api/investigations/${id}/attach`)
    .set(a)
    .send({ kind: "claim", result: verified.body.result })
    .expect(200);
  const demoCase = await api
    .post("/api/investigations")
    .set(a)
    .send({ title: "Synthetic case", isSimulatedDemo: true })
    .expect(201);
  await api
    .post(`/api/investigations/${demoCase.body.investigation.id}/attach`)
    .set(a)
    .send({ kind: "claim", result: verified.body.result })
    .expect(409);
  const report = await api.get(`/api/reports/${id}`).set(a).expect(200);
  assert.match(report.body.report.integrityHash, /^sha256:[a-f0-9]{64}$/);
  // Simulate a filesystem failure after a successful committed state. Memory must roll back too.
  const backup = fs.readFileSync(process.env.VERITAS_STORE!, "utf8");
  fs.renameSync(root, `${root}-backup`);
  fs.writeFileSync(root, "block directory writes");
  await api
    .patch(`/api/investigations/${id}`)
    .set(a)
    .send({ title: "MUST NOT COMMIT" })
    .expect(500);
  const unchanged = await api.get(`/api/investigations/${id}`).set(a).expect(200);
  assert.equal(unchanged.body.investigation.title, "Updated case");
  assert.equal(fs.readFileSync(`${root}-backup/cases.json`, "utf8"), backup);
  fs.unlinkSync(root);
  fs.renameSync(`${root}-backup`, root);
  await api
    .post("/api/campaigns/analyze")
    .set(a)
    .send({ posts: [{ content: "missing identity" }, { content: "missing timestamp" }] })
    .expect(400);
  const sharing = await api
    .post("/api/campaigns/analyze")
    .set(a)
    .send({
      datasetName: "Ordinary shared news",
      posts: ["a", "b", "c"].map((account) => ({
        account_id: account,
        content: "Official weather bulletin says rain is expected in Hyderabad",
        timestamp: "2026-01-01T10:00:00Z",
        shared_url: "https://weather.example/bulletin",
      })),
    })
    .expect(200);
  assert.equal(sharing.body.result.suspiciousPostCount, 0);
  assert.equal(sharing.body.result.overallCoordinationIndex, null);
  assert.equal(
    (await api.get("/api/stats").set(a).expect(200)).body.recentAlertCount,
    0,
    "single-event sharing must not raise a threat alert",
  );
  await api
    .post("/api/investigations")
    .set(a)
    .set("Origin", "https://attacker.example")
    .send({ title: "CSRF" })
    .expect(403);
  console.log(
    "PASS API integration: authentication, session cookie, ownership, strict validation, signed attachments, demo isolation, reports, persistence rollback and CSRF",
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(`${root}-backup`, { recursive: true, force: true });
}
