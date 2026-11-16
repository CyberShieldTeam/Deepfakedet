import { runExtraction, ExtractionError } from "../server/extractionRunner";
let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
  if (Buffer.byteLength(input) > 14_100_000) throw new Error("OCR evaluation input budget");
}
const row = JSON.parse(input);
try {
  const result = await runExtraction(
    "evaluation:" + row.id,
    row.sha256,
    "data:" + row.mime + ";base64," + row.image,
    row.language,
    "image",
    undefined,
    row.profile,
  );
  console.log(
    JSON.stringify({
      state: result.state,
      text: result.originalText,
      segments: result.segments,
      geometry: result.geometry,
      timing: result.timing,
      extractionId: result.id,
      candidates: result.candidates.length,
    }),
  );
} catch (e) {
  console.log(
    JSON.stringify({
      state: e instanceof ExtractionError ? e.state : "FAILED",
      errorCategory: e instanceof ExtractionError ? e.status : 503,
      text: null,
    }),
  );
}
