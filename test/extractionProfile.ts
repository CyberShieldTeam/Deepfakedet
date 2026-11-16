import fs from "node:fs";
import { createHash } from "node:crypto";
import { runExtraction } from "../server/extractionRunner";
const bytes = fs.readFileSync(".model-cache/extraction-fixtures/clear.png");
const result = await runExtraction(
  "profile",
  createHash("sha256").update(bytes).digest("hex"),
  "data:image/png;base64," + bytes.toString("base64"),
  "eng",
  "image",
);
console.log(
  JSON.stringify({
    scope: "authored clear image resource control, not accuracy",
    timing: result.timing,
    state: result.state,
  }),
);
