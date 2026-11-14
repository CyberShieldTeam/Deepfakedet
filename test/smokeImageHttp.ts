/** Run against live Express and Python services. Set VERITAS_EXPECT_MODEL_READY=0 for face-only mode. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const apiUrl = process.env.VERITAS_BASE_URL || 'http://127.0.0.1:3002';
const modelUrl = process.env.VERITAS_AI_SERVICE_URL || 'http://127.0.0.1:8001';
const expectReady = process.env.VERITAS_EXPECT_MODEL_READY !== '0';

async function analyze(relativePath: string, mimeType: string) {
  const bytes = await readFile(resolve(relativePath));
  const response = await fetch(`${apiUrl}/api/forensics/analyze-media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modality: 'image', fileName: relativePath.split(/[\\/]/).at(-1), mimeType,
      measurements: { elaScore: 0 },
      mediaData: `data:${mimeType};base64,${bytes.toString('base64')}`
    }),
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`Express returned ${response.status}: ${await response.text()}`);
  const { result } = await response.json();
  assert.equal(result.engine, expectReady ? 'local_pretrained' : 'local_image_screening');
  assert.equal(result.authenticity, 'inconclusive');
  assert.equal(result.confidenceScore, 0);
  assert.equal(result.aiGeneratedProbability, null);
  assert.equal(result.localImage.classification, 'INCONCLUSIVE');
  assert.equal(result.localImage.scope, 'general_ai_generated_image');
  assert.equal(result.localImage.model, 'dima806/ai_vs_real_image_detection');
  assert.equal(result.localImage.model_status, expectReady ? 'ready' : 'unavailable');
  if (expectReady) assert.ok(result.localImage.fake_probability >= 0 && result.localImage.fake_probability <= 1);
  else assert.equal(result.localImage.fake_probability, null);
  assert.ok(result.localImage.processing_ms > 0);
  return result.localImage;
}

const healthResponse = await fetch(`${modelUrl}/health`, { signal: AbortSignal.timeout(10_000) });
assert.equal(healthResponse.status, 200);
const health = await healthResponse.json();
assert.equal(health.status, expectReady ? 'ready' : 'unavailable', health.reason);
assert.equal(health.face_detector, 'ready');

const landscape = await analyze('test/fixtures/eval/genuine/charminar_nikon_d60_2013.jpg', 'image/jpeg');
assert.equal(landscape.face_analysis, 'none_found');
assert.equal(landscape.face_boxes.length, 0);

const portrait = await analyze('test/fixtures/face/headshot_cc0.jpg', 'image/jpeg');
assert.equal(portrait.face_analysis, 'candidate_regions');
assert.ok(portrait.face_boxes.length > 0);
if (process.env.VERITAS_EXPECT_FACE_READY === '1') {
  assert.equal(portrait.face_manipulation.status, 'analyzed');
  assert.equal(portrait.face_manipulation.classification, 'INCONCLUSIVE');
  assert.ok(portrait.face_manipulation.faces.length > 0);
  assert.ok(portrait.face_manipulation.faces.every((face: any) =>
    Number.isFinite(face.raw_fake_score) && face.raw_fake_score >= 0 && face.raw_fake_score <= 1));
}
console.log(`Live image HTTP smoke passed: Express → Python ${expectReady ? 'inference' : 'face-only screening'}, inconclusive verdict, YuNet face candidates.`);
