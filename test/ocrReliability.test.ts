import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { runExtraction, ExtractionError } from "../server/extractionRunner";
const raw = fs.readFileSync(".model-cache/extraction-fixtures/clear.png"),
  hash = createHash("sha256").update(raw).digest("hex"),
  data = "data:image/png;base64," + raw.toString("base64");
assert.ok(process.env.VERITAS_AI_SERVICE_URL, "Explicit test preparation endpoint required");
const signal = new AbortController(),
  pending = runExtraction("abort-control", hash, data, "eng", "image", signal.signal);
await assert.rejects(
  runExtraction("busy-control", hash, data, "eng", "image"),
  (e) => e instanceof ExtractionError && e.status === 429,
);
signal.abort();
await assert.rejects(pending, (e) => e instanceof ExtractionError && e.status === 504);
const workerAbort = new AbortController();
const running = runExtraction("worker-abort", hash, data, "eng", "image", workerAbort.signal);
const timer = setTimeout(() => workerAbort.abort(), 150);
await assert.rejects(running, (e) => e instanceof ExtractionError && e.status === 504);
clearTimeout(timer);
const recovered = await runExtraction("recovery-control", hash, data, "eng", "image");
assert.ok(recovered.originalText.includes("Amber Museum"));
await assert.rejects(
  runExtraction("profile-control", hash, data, "eng", "image", undefined, "invalid-profile"),
  (e) => e instanceof ExtractionError && e.status === 400,
);
console.log(
  "OCR reliability controls passed: busy rejection, preparation/worker interruption, explicit 504, lease recovery, actual OCR after abort and invalid profile.",
);
