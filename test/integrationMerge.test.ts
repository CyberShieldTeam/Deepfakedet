import assert from "node:assert/strict";
import { analyzeMediaPipeline } from "../server/mediaPipeline";
import { mediaInput } from "../server/security";

const previousEndpoint = process.env.VERITAS_AI_SERVICE_URL;
const previousFetch = globalThis.fetch;

try {
  process.env.VERITAS_AI_SERVICE_URL = "http://127.0.0.1:8001";
  globalThis.fetch = (async (input: string | URL | Request) => {
    assert.match(String(input), /\/v1\/image\/analyze$/);
    return new Response(
      JSON.stringify({
        classification: "INCONCLUSIVE",
        fake_probability: 0.81,
        model_confidence: null,
        model_status: "ready",
        model: "pinned-test-image-model",
        revision: "test-revision",
        scope: "general_ai_generated_image",
        face_analysis: "candidate_regions",
        face_boxes: [{ x: 1, y: 2, width: 3, height: 4, confidence: 0.95 }],
        signals: [],
        explanation: "Experimental raw output only",
        processing_ms: 10,
      }),
    );
  }) as typeof fetch;

  const result = await analyzeMediaPipeline({
    modality: "image",
    fileName: "sample.png",
    measurements: { elaScore: 1 },
    mediaData: "data:image/png;base64,aGVsbG8=",
  });
  assert.equal(result.authenticity, "inconclusive");
  assert.equal(result.aiGeneratedProbability, null);
  assert.equal(result.localImage?.fake_probability, 0.81);
  assert.equal(result.localImage?.face_boxes.length, 1);
  assert.match(result.engineNote || "", /experimental whole-image classifier/i);

  const mp4Header = Buffer.concat([Buffer.alloc(4), Buffer.from("ftyp")]).toString("base64");
  assert.equal(
    mediaInput.safeParse({
      modality: "video",
      fileName: "sample.mp4",
      mimeType: "video/mp4",
      measurements: {},
      mediaData: `data:video/mp4;base64,${mp4Header}`,
    }).success,
    true,
    "bounded original-video data must survive the validated Figma API contract",
  );
  console.log("Integrated Figma + local inference contract tests passed");
} finally {
  globalThis.fetch = previousFetch;
  if (previousEndpoint === undefined) delete process.env.VERITAS_AI_SERVICE_URL;
  else process.env.VERITAS_AI_SERVICE_URL = previousEndpoint;
}
