/** Live sampled-frame transport/inference smoke; test pattern is not an accuracy fixture. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const apiUrl = process.env.VERITAS_BASE_URL || 'http://127.0.0.1:3002';
const modelUrl = process.env.VERITAS_AI_SERVICE_URL || 'http://127.0.0.1:8001';
const healthResponse = await fetch(`${modelUrl}/health`, { signal: AbortSignal.timeout(10_000) });
assert.equal(healthResponse.status, 200);
const health = await healthResponse.json();
assert.equal(health.status, 'ready', health.reason);

const sampledFrames = await Promise.all([0, 1, 2].map(async i => ({
  timestampSeconds: i + 0.2,
  imageData: `data:image/jpeg;base64,${(await readFile(resolve(`test/fixtures/video/frame_${i}.jpg`))).toString('base64')}`
})));
const response = await fetch(`${apiUrl}/api/forensics/analyze-media`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ modality: 'video', fileName: 'test_pattern_3s.mp4', mimeType: 'video/mp4',
    measurements: { duration: 3, framesSampled: 3 }, sampledFrames,
    keyframes: sampledFrames.map(frame => frame.imageData) }),
  signal: AbortSignal.timeout(120_000)
});
if (!response.ok) throw new Error(`Express returned ${response.status}: ${await response.text()}`);
const { result } = await response.json();
assert.equal(result.engine, 'local_video_frames');
assert.equal(result.authenticity, 'inconclusive');
assert.equal(result.confidenceScore, 0);
assert.equal(result.aiGeneratedProbability, null);
assert.deepEqual(result.localVideo.frames.map((frame: { timestampSeconds: number }) => frame.timestampSeconds), [0.2, 1.2, 2.2]);
assert.ok(result.localVideo.frames.every((frame: { image: { classification: string; model_status: string; fake_probability: number } }) =>
  frame.image.classification === 'INCONCLUSIVE' && frame.image.model_status === 'ready' &&
  frame.image.fake_probability >= 0 && frame.image.fake_probability <= 1));
console.log('Live video HTTP smoke passed: 3 timestamped frames screened, inconclusive video result.');
