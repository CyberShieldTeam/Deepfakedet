import assert from 'node:assert/strict';
import { callLocalVideo, callLocalVideoFrames, localVideoResult } from '../server/localVideo';
import type { LocalImageResponse } from '../server/localImage';

const raw: LocalImageResponse = {
  classification: 'INCONCLUSIVE', fake_probability: 0.72, model_confidence: null, model_status: 'ready',
  model: 'dima806/ai_vs_real_image_detection', revision: 'pinned-revision', scope: 'general_ai_generated_image',
  face_analysis: 'none_found', face_boxes: [], signals: [], explanation: 'Experimental', processing_ms: 50
};
let calls = 0;
const fetcher = (async (_url: string, init?: RequestInit) => {
  assert.equal(JSON.parse(String(init?.body)).image_base64, 'aGVsbG8=');
  calls++;
  return new Response(JSON.stringify(raw));
}) as typeof fetch;
const frames = [
  { timestampSeconds: 0.5, imageData: 'data:image/jpeg;base64,aGVsbG8=' },
  { timestampSeconds: 1.5, imageData: 'data:image/jpeg;base64,aGVsbG8=' }
];
const evidence = await callLocalVideoFrames(frames, 'http://127.0.0.1:8001', fetcher);
assert.equal(calls, 2);
assert.deepEqual(evidence.frames.map(frame => frame.timestampSeconds), [0.5, 1.5]);
const mapped = localVideoResult(evidence, 'clip.mp4', { duration: 2 }, []);
assert.equal(mapped.engine, 'local_video_frames');
assert.equal(mapped.authenticity, 'inconclusive');
assert.equal(mapped.aiGeneratedProbability, null);
assert.equal(mapped.confidenceScore, 0);
assert.equal(mapped.localVideo?.frames[0].image.fake_probability, 0.72);
await assert.rejects(callLocalVideoFrames([...frames].reverse(), 'http://127.0.0.1:8001', fetcher));
assert.equal(calls, 2, 'Invalid timeline must be rejected before inference');
await assert.rejects(callLocalVideoFrames([], 'http://127.0.0.1:8001', fetcher));
const serverFetcher = (async (_url: string, init?: RequestInit) => {
  assert.equal(JSON.parse(String(init?.body)).video_base64, 'aGVsbG8=');
  return new Response(JSON.stringify({ scope: 'server_decoded_frames',
    frames: [{ timestampSeconds: 0.125, image: raw }], samplingNote: 'Server decoded',
    videoMetadata: { durationSeconds: 2, width: 320, height: 180 } }));
}) as typeof fetch;
const serverEvidence = await callLocalVideo('data:video/mp4;base64,aGVsbG8=', 'http://127.0.0.1:8001', serverFetcher);
assert.equal(serverEvidence.scope, 'server_decoded_frames');
assert.equal(serverEvidence.frames[0].timestampSeconds, 0.125);
assert.equal(localVideoResult(serverEvidence, 'clip.mp4', {}, []).aiGeneratedProbability, null);
await assert.rejects(callLocalVideo('data:text/plain;base64,aGVsbG8=', 'http://127.0.0.1:8001', serverFetcher));
console.log('Local video frame contract tests passed');
