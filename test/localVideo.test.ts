import assert from 'node:assert/strict';
import { callLocalVideoFrames, localVideoResult } from '../server/localVideo';
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
console.log('Local video frame contract tests passed');
