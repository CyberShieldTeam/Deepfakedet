/** Live sampled-frame transport/inference smoke; test pattern is not an accuracy fixture. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const apiUrl = process.env.VERITAS_BASE_URL || 'http://127.0.0.1:3002';
const modelUrl = process.env.VERITAS_AI_SERVICE_URL || 'http://127.0.0.1:8001';
const healthResponse = await fetch(`${modelUrl}/health`, { signal: AbortSignal.timeout(10_000) });
assert.equal(healthResponse.status, 200);
const health = await healthResponse.json();
assert.equal(health.video.status, 'ready', health.video.reason);

const sampledFrames = await Promise.all([0, 1, 2].map(async i => ({
  timestampSeconds: i + 0.2,
  imageData: `data:image/jpeg;base64,${(await readFile(resolve(`test/fixtures/video/frame_${i}.jpg`))).toString('base64')}`
})));
const mediaData = `data:video/mp4;base64,${(await readFile(resolve('test/fixtures/video/test_pattern_with_tone_3s.mp4'))).toString('base64')}`;
const response = await fetch(`${apiUrl}/api/forensics/analyze-media`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ modality: 'video', fileName: 'test_pattern_with_tone_3s.mp4', mimeType: 'video/mp4',
    measurements: { duration: 3, framesSampled: 3 }, mediaData,
    keyframes: sampledFrames.map(frame => frame.imageData) }),
  signal: AbortSignal.timeout(120_000)
});
if (!response.ok) throw new Error(`Express returned ${response.status}: ${await response.text()}`);
const { result } = await response.json();
assert.equal(result.engine, 'local_video_frames');
assert.equal(result.localVideo.scope, 'server_decoded_frames');
assert.equal(result.authenticity, 'inconclusive');
assert.equal(result.confidenceScore, 0);
assert.equal(result.aiGeneratedProbability, null);
assert.equal(result.localVideo.frames.length, 6);
assert.equal(result.localVideo.videoMetadata.width, 320);
assert.ok(['analyzed','model_unavailable'].includes(result.localVideo.audioTrack.status));
if(result.localVideo.audioTrack.status==='analyzed')assert.ok(result.localVideo.audioTrack.evidence.segments.length >= 1);
assert.ok(result.localVideo.frames.every((frame: { quality: { selectionScore: number; meanLuma: number } }) =>
  frame.quality.selectionScore >= 0 && frame.quality.meanLuma >= 0 && frame.quality.meanLuma <= 255));
assert.ok(result.localVideo.frames.every((frame: { image: { classification: string; model_status: string; fake_probability: number|null } }) =>
  frame.image.classification === 'INCONCLUSIVE' && ['ready','unavailable'].includes(frame.image.model_status) &&
  (frame.image.model_status==='unavailable'?frame.image.fake_probability===null:frame.image.fake_probability! >= 0 && frame.image.fake_probability! <= 1)));
assert.equal(result.analysis.counts.serverDecodedFrames,6);
assert.equal(result.analysis.counts.sampledFrames,6);
assert.match(result.analysis.summary,/6 server-decoded frames retained/);
assert.ok(result.modelsUsed.every((model:{name:string})=>!/gemini/i.test(model.name)));
assert.ok(!/gemini/i.test(result.engineNote));
console.log(`Live video HTTP smoke passed: 6 decoded frames retained; frame classifier ${health.status}; audio ${result.localVideo.audioTrack.status}; inconclusive video result.`);
