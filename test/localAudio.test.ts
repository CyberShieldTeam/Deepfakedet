import assert from 'node:assert/strict';
import { callLocalAudio, localAudioResult, type LocalAudioResponse } from '../server/localAudio';

const raw: LocalAudioResponse = {
  classification: 'INCONCLUSIVE', model: 'clovaai/aasist', revision: 'pinned-revision',
  scope: 'speech_anti_spoofing', sample_rate_input: 44100, sample_rate_model: 16000,
  duration_seconds: 4, segments: [{ start_seconds: 0, end_seconds: 4,
    raw_bonafide_logit: 1.2, raw_spoof_softmax: 0.2 }], processing_ms: 120,
  explanation: 'Experimental segment scores'
};
const input = 'data:audio/wav;base64,aGVsbG8=';
const fetcher = (async (_url: string, init?: RequestInit) => {
  assert.equal(JSON.parse(String(init?.body)).audio_base64, 'aGVsbG8=');
  return new Response(JSON.stringify(raw));
}) as typeof fetch;
assert.deepEqual(await callLocalAudio(input, 'http://127.0.0.1:8001', fetcher), raw);
const mapped = localAudioResult(raw, 'sample.wav', {}, []);
assert.equal(mapped.engine, 'local_aasist');
assert.equal(mapped.authenticity, 'inconclusive');
assert.equal(mapped.aiGeneratedProbability, null);
assert.equal(mapped.confidenceScore, 0);
assert.equal(mapped.localAudio?.segments.length, 1);
await assert.rejects(callLocalAudio('data:text/plain;base64,aGVsbG8=', 'http://127.0.0.1:8001', fetcher));
await assert.rejects(callLocalAudio(input, 'http://127.0.0.1:8001', (async () => new Response('no', { status: 503 })) as typeof fetch));
await assert.rejects(callLocalAudio(input, 'http://127.0.0.1:8001', (async () => new Response(JSON.stringify({ ...raw, segments: [{ ...raw.segments[0], raw_spoof_softmax: 2 }] }))) as typeof fetch));
console.log('Local audio contract tests passed');
