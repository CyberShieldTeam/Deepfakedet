import assert from 'assert';
import { callLocalImage, localImageResult, type LocalImageResponse } from '../server/localImage';

const raw: LocalImageResponse = {
  classification: 'INCONCLUSIVE', fake_probability: 0.96, model_confidence: null, model_status: 'ready',
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
assert.equal(mapped.aiGeneratedProbability, null);
assert.equal(mapped.authenticity, 'inconclusive');
const forged = { ...raw, classification: 'MANIPULATED' as const };
assert.equal(localImageResult(forged, 'sample.png', {}, []).authenticity, 'inconclusive');
await assert.rejects(callLocalImage(image, 'http://127.0.0.1:8001',
  (async () => new Response(JSON.stringify(forged))) as typeof fetch));
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
await assert.rejects(callLocalImage(image, 'http://127.0.0.1:8001', (async () => new Response(JSON.stringify({ ...raw, classification: 'MANIPULATED' }))) as typeof fetch));
const legacyFace = {...raw, face_boxes:[{x:1,y:2,width:80,height:80,confidence:.95}], face_model: {
  status:'ready' as const,model:'sakshamkr1/deitfake-v2',revision:'test',faces:[{boxIndex:0,rawFakeSoftmax:.9}],note:'Raw output'}};
assert.equal(localImageResult(legacyFace,'face.jpg',{},[]).authenticity,'inconclusive');
assert.equal(localImageResult(legacyFace,'face.jpg',{},[]).manipulation,undefined);
assert.ok(localImageResult(legacyFace,'face.jpg',{},[]).modelsUsed.some(m=>m.name==='sakshamkr1/deitfake-v2'));
await assert.rejects(callLocalImage(image,'http://127.0.0.1:8001',(async()=>new Response(JSON.stringify({...legacyFace,
  face_model:{...legacyFace.face_model,faces:[{boxIndex:0,rawFakeSoftmax:2}]}}))) as typeof fetch));
const withFace = { ...raw, face_analysis: 'candidate_regions' as const,
  face_boxes: [{ x: 1, y: 2, width: 40, height: 50, confidence: 0.95 }],
  face_manipulation: { status: 'analyzed' as const, classification: 'INCONCLUSIVE' as const,
    model: 'sakshamkr1/deitfake-v2', revision: 'pinned', note: 'Uncalibrated',
    faces: [{ face_index: 0, crop_bounds: [0, 0, 50, 60], raw_fake_score: 0.99 }] } };
const faceFetch = (value: unknown) => (async () => new Response(JSON.stringify(value))) as typeof fetch;
assert.equal((await callLocalImage(image, 'http://127.0.0.1:8001', faceFetch(withFace))).face_manipulation?.faces.length, 1);
assert.equal(localImageResult(withFace, 'sample.png', {}, []).authenticity, 'inconclusive');
await assert.rejects(callLocalImage(image, 'http://127.0.0.1:8001', faceFetch({ ...withFace,
  face_manipulation: { ...withFace.face_manipulation, faces: [{ ...withFace.face_manipulation.faces[0], raw_fake_score: 2 }] } })));
