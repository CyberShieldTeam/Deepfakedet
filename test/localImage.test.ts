import assert from 'assert';
import { callLocalImage, localImageResult, type LocalImageResponse } from '../server/localImage';

const raw: LocalImageResponse = {
  classification: 'MANIPULATED', fake_probability: 0.96, model_confidence: null, model_status: 'ready',
  model: 'dima806/ai_vs_real_image_detection', revision: 'test-revision',
  scope: 'general_ai_generated_image', face_analysis: 'not_performed', face_boxes: [], signals: [],
  explanation: 'Whole-image classifier', processing_ms: 42
};
const image = 'data:image/png;base64,aGVsbG8=';
const fetcher = async (_url: any, init?: RequestInit) => {
  assert.equal(JSON.parse(String(init?.body)).image_base64, 'aGVsbG8=');
  return new Response(JSON.stringify(raw), { status: 200 });
};
const result = await callLocalImage(image, 'http://127.0.0.1:8001', fetcher as typeof fetch);
assert.deepEqual(result, raw);
const mapped = localImageResult(result, 'sample.png', { elaScore: 5 }, []);
assert.equal(mapped.engine, 'local_pretrained');
assert.equal(mapped.aiGeneratedProbability, 96);
assert.equal(mapped.confidenceScore, 0, 'uncalibrated score must not be called confidence');
assert.equal(mapped.localImage?.face_analysis, 'not_performed');
const experimental = localImageResult({ ...raw, classification: 'INCONCLUSIVE' }, 'sample.png', {}, []);
assert.equal(experimental.authenticity, 'inconclusive');
assert.equal(experimental.aiGeneratedProbability, null);
assert.equal(experimental.localImage?.fake_probability, 0.96);
const faceOnly = localImageResult({ ...raw, classification: 'INCONCLUSIVE', fake_probability: null,
  model_status: 'unavailable', face_analysis: 'candidate_regions', face_boxes: [{ x: 1, y: 2, width: 3, height: 4, confidence: 0.95 }] }, 'sample.png', {}, []);
assert.equal(faceOnly.engine, 'local_image_screening');
assert.equal(faceOnly.authenticity, 'inconclusive');
assert.equal(faceOnly.aiGeneratedProbability, null);
assert.ok(faceOnly.modelsUsed.some(model => model.name === 'YuNet face detector'));
assert.ok(!faceOnly.modelsUsed.some(model => model.name === raw.model));
await assert.rejects(callLocalImage('data:text/plain;base64,aGVsbG8=', 'http://127.0.0.1:8001', fetcher as typeof fetch));
await assert.rejects(callLocalImage(image, 'http://127.0.0.1:8001', (async () => new Response('no', { status: 503 })) as typeof fetch));
await assert.rejects(callLocalImage(image, 'http://127.0.0.1:8001', (async () => new Response(JSON.stringify({ ...raw, fake_probability: 5 }))) as typeof fetch));
await assert.rejects(callLocalImage(image, 'http://127.0.0.1:8001', (async () => new Response(JSON.stringify({ ...raw, face_boxes: null }))) as typeof fetch));
await assert.rejects(callLocalImage(image, 'http://127.0.0.1:8001', (async () => new Response(JSON.stringify({ ...raw, model_status: 'unavailable' }))) as typeof fetch));
console.log('Local image contract tests passed');
