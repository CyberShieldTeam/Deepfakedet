import assert from 'node:assert/strict';
import { callImageProvenance } from '../server/imageProvenance';

const good = { status: 'absent', note: 'No manifest', aiDeclaration: false,
  exif: { present: false, software: null } };
const fetcher = (async (_url: string, init?: RequestInit) => {
  assert.equal(JSON.parse(String(init?.body)).image_base64, 'aGVsbG8=');
  return new Response(JSON.stringify(good), { status: 200 });
}) as typeof fetch;
assert.equal((await callImageProvenance('data:image/jpeg;base64,aGVsbG8=', 'http://localhost:8001', fetcher)).status, 'absent');
await assert.rejects(callImageProvenance('data:image/jpeg;base64,aGVsbG8=', 'http://localhost:8001',
  (async () => new Response(JSON.stringify({ ...good, aiDeclaration: true }))) as typeof fetch));
await assert.rejects(callImageProvenance('data:image/jpeg;base64,aGVsbG8=', 'http://localhost:8001',
  (async () => new Response(JSON.stringify({ ...good, status: 'fabricated' }))) as typeof fetch));
console.log('Original-image provenance contract tests passed');
