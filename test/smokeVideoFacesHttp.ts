/** Live YuNet face-continuity smoke on a CC0 headshot video; not an authenticity benchmark. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const apiUrl = process.env.VERITAS_BASE_URL || 'http://127.0.0.1:3002';
const modelUrl = process.env.VERITAS_AI_SERVICE_URL || 'http://127.0.0.1:8001';
const health = await (await fetch(`${modelUrl}/health`, { signal: AbortSignal.timeout(10_000) })).json();
assert.equal(health.face_detector, 'ready');
const mediaData = `data:video/mp4;base64,${(await readFile(resolve('test/fixtures/video/headshot_cc0_3s.mp4'))).toString('base64')}`;
const response = await fetch(`${apiUrl}/api/forensics/analyze-media`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ modality: 'video', fileName: 'headshot_cc0_3s.mp4', mimeType: 'video/mp4',
    measurements: { duration: 3 }, mediaData }), signal: AbortSignal.timeout(120_000)
});
if (!response.ok) throw new Error(`Express returned ${response.status}: ${await response.text()}`);
const { result } = await response.json();
assert.equal(result.engine, 'local_video_frames');
assert.equal(result.authenticity, 'inconclusive');
assert.equal(result.aiGeneratedProbability, null);
assert.equal(result.confidenceScore, 0);
assert.equal(result.localVideo.scope, 'server_decoded_frames');
assert.equal(result.localVideo.frames.length, 6);
assert.equal(result.localVideo.faceContinuity.detectorFrames, 6);
assert.equal(result.localVideo.faceContinuity.framesWithCandidates, 6);
assert.equal(result.localVideo.faceContinuity.tracks[0].frameIndices.length, 6);
assert.equal(result.localVideo.audioTrack.status, 'no_audio');
console.log('Live video face continuity smoke passed: one candidate track across 6 frames, no verdict.');
