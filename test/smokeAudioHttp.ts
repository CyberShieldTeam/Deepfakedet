/** Live transport/inference smoke; the sample fixture is not an accuracy benchmark. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const apiUrl = process.env.VERITAS_BASE_URL || 'http://127.0.0.1:3002';
const modelUrl = process.env.VERITAS_AI_SERVICE_URL || 'http://127.0.0.1:8001';
const healthResponse = await fetch(`${modelUrl}/health`, { signal: AbortSignal.timeout(10_000) });
assert.equal(healthResponse.status, 200);
const health = await healthResponse.json();
assert.equal(health.audio.status, 'ready', health.audio.reason);

const bytes = await readFile(resolve('test/fixtures/sample_voice.wav'));
const response = await fetch(`${apiUrl}/api/forensics/analyze-media`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ modality: 'audio', fileName: 'sample_voice.wav', mimeType: 'audio/wav',
    measurements: { duration: 10 }, mediaData: `data:audio/wav;base64,${bytes.toString('base64')}` }),
  signal: AbortSignal.timeout(90_000)
});
if (!response.ok) throw new Error(`Express returned ${response.status}: ${await response.text()}`);
const { result } = await response.json();
assert.equal(result.engine, 'local_aasist');
assert.equal(result.authenticity, 'inconclusive');
assert.equal(result.confidenceScore, 0);
assert.equal(result.aiGeneratedProbability, null);
assert.equal(result.localAudio.classification, 'INCONCLUSIVE');
assert.equal(result.localAudio.sample_rate_input, 44100);
assert.equal(result.localAudio.sample_rate_model, 16000);
assert.equal(result.localAudio.segments.length, 3);
assert.ok(result.localAudio.segments.every((s: { raw_spoof_softmax: number }) => s.raw_spoof_softmax >= 0 && s.raw_spoof_softmax <= 1));
console.log('Live audio HTTP smoke passed: Express → AASIST inference, 3 timestamped segments, inconclusive verdict.');
