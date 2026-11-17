import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NliWorker, NLI_MODEL, NLI_VERSION, NLI_CAPS } from "../server/nliWorker";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "nli-worker-controls-")),
  file = path.join(root, "worker.mjs");
const previousUsers=process.env.VERITAS_USERS,previousKey=process.env.GOOGLE_FACT_CHECK_API_KEY;
process.env.VERITAS_USERS='authored-private-control-not-a-real-token';
process.env.GOOGLE_FACT_CHECK_API_KEY='authored-private-control-not-a-real-api-key';
fs.writeFileSync(
  file,
  `import readline from 'node:readline';const mode=process.argv[2];if(process.env.VERITAS_USERS||process.env.GOOGLE_FACT_CHECK_API_KEY)process.exit(3);
const memory={rssBytes:100,peakWorkingSetBytes:null};
if(mode!=='startup-timeout')console.log(JSON.stringify({event:'ready',modelId:${JSON.stringify(NLI_MODEL)},version:mode==='wrong-version'?'wrong':${JSON.stringify(NLI_VERSION)},startupMs:1,memory}));
readline.createInterface({input:process.stdin}).on('line',line=>{const r=JSON.parse(line);if(mode==='timeout')return;if(mode==='crash')process.exit(2);if(mode==='bytes'){console.log('x'.repeat(66000));return}const output={requestId:mode==='wrong-id'?'wrong':r.requestId,results:r.pairs.map(()=>({status:'executed',scores:{contradiction:mode==='bad-score'?0.9:0.01,entailment:0.98,neutral:0.01},tokens:12,elapsedMs:1})),elapsedMs:1,memory};setTimeout(()=>console.log(JSON.stringify(output)),mode==='slow'?100:0)});`,
);
const pairs = [
    { premise: "The authored source passage.", hypothesis: "The authored claim.", language: "en" },
  ],
  workers: NliWorker[] = [];
function worker(mode: string, requestMs = 700) {
  const w = new NliWorker(process.execPath, [file, mode], {
    ...NLI_CAPS,
    startupMs: 2500,
    requestMs,
    idleMs: 100,
    restarts: 3,
  });
  workers.push(w);
  return w;
}
try {
  const valid = worker("valid");
  const a = await valid.infer(pairs);
  assert.equal(a.results.length, 1);
  assert.equal(a.results[0].status, "executed");
  const repeat=await valid.infer(pairs);assert.notEqual(repeat.requestId,a.requestId);
  const busy = worker("slow");
  const first = busy.infer(pairs);
  await assert.rejects(() => busy.infer(pairs), /BUSY/);
  await first;
  for (const mode of ["wrong-version", "wrong-id", "bad-score", "bytes", "crash"])
    await assert.rejects(
      () => worker(mode).infer(pairs),
      /INVALID_OR_FAILED_RESPONSE|MISMATCHED_RESPONSE|OUTPUT_LIMIT|WORKER_EXITED/,
    );
  const timed = worker("timeout", 150);
  await assert.rejects(() => timed.infer(pairs), /TIMEOUT/);
  await assert.rejects(() => timed.infer(pairs), /TIMEOUT/);
  await assert.rejects(() => timed.infer(pairs), /TIMEOUT/);
  await assert.rejects(() => timed.infer(pairs), /RESTART_BUDGET_EXHAUSTED/);
  const stop = worker("timeout", 1000);
  const pending = stop.infer(pairs);
  setTimeout(() => stop.stop(), 150);
  await assert.rejects(() => pending, /WORKER_STOPPED/);
  await assert.rejects(() => valid.infer(Array(9).fill(pairs[0])), /INPUT_LIMIT/);
  console.log(
    "NLI worker controls passed: persistent replies, busy admission, identity/scores/byte limits, crash, timeout, bounded restart and explicit interruption. Fake workers are software controls, not model predictions.",
  );
} finally {
  if(previousUsers===undefined)delete process.env.VERITAS_USERS;else process.env.VERITAS_USERS=previousUsers;
  if(previousKey===undefined)delete process.env.GOOGLE_FACT_CHECK_API_KEY;else process.env.GOOGLE_FACT_CHECK_API_KEY=previousKey;
  workers.forEach((w) => w.stop());
  fs.rmSync(root, { recursive: true, force: true });
}
