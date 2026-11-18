import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

const root=fs.mkdtempSync(path.join(os.tmpdir(),"veritas-public-demo-"));
process.env.VERITAS_EMBEDDED="true";
process.env.NODE_ENV="production";
process.env.VERITAS_PUBLIC_DEMO="true";
process.env.VERITAS_PUBLIC_ORIGIN="https://demo.example.test";
process.env.VERITAS_STORE=path.join(root,"cases.json");
process.env.VERITAS_USERS=JSON.stringify({"private-test-token-not-a-real-secret-000000":"private-analyst"});
process.env.APP_GEMINI_API_KEY="";
delete process.env.GOOGLE_FACT_CHECK_API_KEY;
delete process.env.VERITAS_IMAGE_ENDPOINT;
delete process.env.VERITAS_AUDIO_ENDPOINT;
delete process.env.VERITAS_EMBEDDING_ENDPOINT;

const cookie=(response:any)=>String(response.headers["set-cookie"]?.[0]||"").split(";")[0];

try{
  const {app}=await import("../server");
  const api=request(app);

  const health=await api.get("/api/health").expect(200);
  assert.equal(health.body.authenticationMode,"public-demo");
  assert.equal(health.body.publicDemo,true);
  assert.equal("geminiModel" in health.body,false);
  assert.equal("geminiMessage" in health.body,false);
  assert.equal("geminiModelCandidates" in health.body,false);
  assert.equal("localMediaService" in health.body,false);

  await api.get("/api/investigations").expect(401);
  await api.get("/api/investigations").set("Authorization","Bearer private-test-token-not-a-real-secret-000000").expect(401);
  await api.post("/api/session").set("Origin","https://attacker.example").send({}).expect(403);
  await api.post("/api/session").send({token:"private-test-token-not-a-real-secret-000000"}).expect(400);

  const sessionA=await api.post("/api/session").set("Origin","https://demo.example.test").send({}).expect(200);
  const sessionB=await api.post("/api/session").send({}).expect(200);
  const cookieA=cookie(sessionA),cookieB=cookie(sessionB);
  assert.match(cookieA,/^veritas_demo_session=[a-f0-9]{64}$/);
  assert.match(String(sessionA.headers["set-cookie"][0]),/HttpOnly/i);
  assert.match(String(sessionA.headers["set-cookie"][0]),/Secure/i);
  assert.match(String(sessionA.headers["set-cookie"][0]),/SameSite=Strict/i);
  assert.notEqual(cookieA,cookieB);
  assert.equal("ownerId" in sessionA.body,false);

  const reused=await api.post("/api/session").set("Cookie",cookieA).send({}).expect(200);
  assert.equal(cookie(reused),cookieA);

  const a=await api.post("/api/investigations").set("Cookie",cookieA).send({title:"Judge A private case"}).expect(201);
  const b=await api.post("/api/investigations").set("Cookie",cookieB).send({title:"Judge B private case"}).expect(201);
  assert.notEqual(a.body.investigation.ownerId,b.body.investigation.ownerId);
  assert.match(a.body.investigation.ownerId,/^public-demo:[a-f0-9]{48}$/);
  assert(!((await api.get("/api/investigations").set("Cookie",cookieB).expect(200)).body.investigations)
    .some((inv:any)=>inv.id===a.body.investigation.id));
  await api.get(`/api/investigations/${a.body.investigation.id}`).set("Cookie",cookieB).expect(404);
  await api.patch(`/api/investigations/${a.body.investigation.id}`).set("Cookie",cookieB).send({title:"overwrite"}).expect(404);
  await api.delete(`/api/investigations/${a.body.investigation.id}`).set("Cookie",cookieB).expect(404);
  await api.get(`/api/reports/${a.body.investigation.id}`).set("Cookie",cookieA).expect(200);
  await api.get(`/api/reports/${a.body.investigation.id}`).set("Cookie",cookieB).expect(404);

  const models=await api.get("/api/models").set("Cookie",cookieA).expect(200);
  assert(models.body.models.length>0);
  assert(models.body.models.some((model:any)=>model.task==="image"));
  assert(models.body.models.every((model:any)=>!('description' in model)&&!('version' in model)));

  const image=await api.post("/api/forensics/analyze-media").set("Cookie",cookieA).send({
    modality:"image",fileName:"judge-upload.png",mimeType:"image/png",measurements:{},
    mediaData:"data:image/png;base64,iVBORw0KGgo=",
  }).expect(200);
  assert.equal(image.body.result.authenticity,"inconclusive");
  const video=await api.post("/api/forensics/analyze-media").set("Cookie",cookieA).send({
    modality:"video",fileName:"judge-video.webm",mimeType:"video/webm",measurements:{framesSampled:0},
  }).expect(200);
  assert.equal(video.body.result.authenticity,"inconclusive");
  await api.post("/api/claims/extract").set("Cookie",cookieA).send({claimText:"The authored city opened in 1992."}).expect(200);
  const sample=await api.get("/api/demo/sample-dataset").set("Cookie",cookieA).expect(200);
  assert.match(sample.body.note,/SIMULATED/i);
  assert(sample.body.posts.length>=2);

  const campaign=await api.post("/api/campaigns/analyze").set("Cookie",cookieA).send({
    datasetName:"Public demo simulated campaign fixture",isSimulated:true,posts:[
      {account_id:"fixture-a",content:"Official weather bulletin says rain is expected in Hyderabad",timestamp:"2026-01-01T10:00:00Z",shared_url:"https://weather.example/bulletin"},
      {account_id:"fixture-b",content:"Official weather bulletin says rain is expected in Hyderabad",timestamp:"2026-01-01T10:00:10Z",shared_url:"https://weather.example/bulletin"},
      {account_id:"fixture-c",content:"Official weather bulletin says rain is expected in Hyderabad",timestamp:"2026-01-01T10:00:20Z",shared_url:"https://weather.example/bulletin"},
    ],
  }).expect(200);
  assert(campaign.body.result.analysis);
  const extractionInput={mediaHash:"a".repeat(64),modality:"image",language:"eng",mediaData:"data:image/png;base64,iVBORw0KGgo="};
  await api.post(`/api/investigations/${a.body.investigation.id}/extract`).set("Cookie",cookieA).send(extractionInput).expect(409);
  await api.post(`/api/investigations/${a.body.investigation.id}/extract`).set("Cookie",cookieB).send(extractionInput).expect(404);
  console.log("Public demo: anonymous secure sessions, unique browser owners, cross-user isolation, validation/origin controls and engine-route access passed.");
}finally{
  fs.rmSync(root,{recursive:true,force:true});
}
