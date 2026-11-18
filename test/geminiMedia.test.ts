import assert from "node:assert/strict";
import { geminiMediaFailure, notRequestedGeminiAssessment, parseGeminiMediaResponse, prepareGeminiMedia } from "../server/geminiMedia";

const frame = "data:image/jpeg;base64,/9j/AA==";
const image = prepareGeminiMedia({ modality: "image", measurements: {}, mediaData: frame });
assert.equal(image.status, "ready");
assert.equal(image.parts.length, 1);
assert.equal(image.parts[0].inlineData.mimeType, "image/jpeg");
assert.equal(prepareGeminiMedia({ modality: "image", measurements: {}, mediaData: "data:video/mp4;base64,AAAA" }).status, "input_limit");

const video = prepareGeminiMedia({
  modality: "video", measurements: { duration: 20 }, keyframes: Array(12).fill(frame),
  frameTimes: Array.from({ length: 12 }, (_, i) => i * 2),
});
assert.equal(video.status, "ready");
assert.equal(video.parts.length, 6);
assert.deepEqual(video.sampledTimes, [0, 4, 8, 14, 18, 22]);
assert.equal(prepareGeminiMedia({ modality: "video", measurements: { duration: 31 }, keyframes: [frame] }).status, "unsupported_duration");
assert.equal(prepareGeminiMedia({ modality: "audio", measurements: {}, mediaData: frame }).status, "unsupported_media");
assert.equal(prepareGeminiMedia({ modality: "video", measurements: { duration: 1 }, keyframes: ["data:image/jpeg;base64," + "A".repeat(9 * 1024 * 1024)] }).status, "input_limit");

assert.deepEqual(parseGeminiMediaResponse(JSON.stringify({ explanation: "Visible scene details.", observations: ["A sign appears in the frame."], alternativeExplanations: ["The blur may be motion blur."], additionalInvestigation: { required: true, rationale: "Review the original resolution." }, limitations: ["A still image cannot establish provenance."] })), {
  explanation: "Visible scene details.", observations: ["A sign appears in the frame."], alternativeExplanations: ["The blur may be motion blur."], additionalInvestigation: { required: true, rationale: "Review the original resolution." }, limitations: ["A still image cannot establish provenance."],
});
assert.equal(parseGeminiMediaResponse('{"verdict":"real","probability":0.99}'), null);
assert.equal(parseGeminiMediaResponse(JSON.stringify({ explanation: "A visible sign.", observations: [], alternativeExplanations: [], additionalInvestigation: { required: false, rationale: "None indicated." }, limitations: [], probability: 0.99 })), null);
assert.equal(parseGeminiMediaResponse("not json"), null);
assert.equal(notRequestedGeminiAssessment().status, "not_requested");
assert.equal(geminiMediaFailure("quota_exceeded").status, "quota_exceeded");
assert.equal(geminiMediaFailure("rate_limited").status, "rate_limited");
assert.equal(geminiMediaFailure("overloaded", "request deadline exceeded").status, "timeout");
assert.equal(geminiMediaFailure("overloaded", "provider unavailable").status, "provider_error");
assert.equal(geminiMediaFailure("error", "secret-looking message").explanation.includes("secret-looking"), false);
console.log("Gemini media bounds and response validation passed.");
