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
    frames: [{ timestampSeconds: 0.125, image: raw, quality: { laplacianVariance: 25, meanLuma: 128, clippedFraction: 0, selectionScore: 3.25 }, temporal: { status: 'measured', scope: 'adjacent_original_frames', method: 'farneback_forward_backward_v1', startSeconds: 0.125, endSeconds: 0.167, medianFlowPixels: 0.2, p95FlowPixels: 1.2, meanRoundTripErrorPixels: 0.1, meanMotionCompensatedResidual: 2, maxTileResidual: 5, validPixelFraction: 0.9 } }], samplingNote: 'Server decoded',
    videoMetadata: { durationSeconds: 2, width: 320, height: 180 },
    audioTrack: { status: 'analyzed', note: 'Experimental audio', truncated: false, evidence: {
      classification: 'INCONCLUSIVE', model: 'clovaai/aasist', revision: 'pinned', scope: 'speech_anti_spoofing',
      sample_rate_input: 16000, sample_rate_model: 16000, duration_seconds: 2,
      segments: [{ start_seconds: 0, end_seconds: 2, raw_bonafide_logit: 1, raw_spoof_softmax: 0.8 }],
      processing_ms: 10, explanation: 'Raw only' } } }));
}) as typeof fetch;
const serverEvidence = await callLocalVideo('data:video/mp4;base64,aGVsbG8=', 'http://127.0.0.1:8001', serverFetcher);
assert.equal(serverEvidence.scope, 'server_decoded_frames');
assert.equal(serverEvidence.frames[0].timestampSeconds, 0.125);
assert.equal(localVideoResult(serverEvidence, 'clip.mp4', {}, []).aiGeneratedProbability, null);
assert.equal(localVideoResult(serverEvidence, 'clip.mp4', {}, []).authenticity, 'inconclusive');
assert.equal(serverEvidence.audioTrack?.evidence?.segments[0].raw_spoof_softmax, 0.8);
await assert.rejects(callLocalVideo('data:text/plain;base64,aGVsbG8=', 'http://127.0.0.1:8001', serverFetcher));
console.log('Local video frame contract tests passed');
