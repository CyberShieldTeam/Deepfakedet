import assert from 'node:assert/strict';import {cloudRouting} from '../scripts/vercel-output.mjs';
for(const bad of ['', 'http://localhost:3000','https://backend.example/api','https://user:password@fixture.onrender.com','https://fixture.onrender.com/evil','https://fixture.onrender.com?key=secret'])assert.throws(()=>cloudRouting(bad));
// Explicit software fixture, not an asserted deployed service.
const config=cloudRouting('https://routing-fixture.onrender.com');
assert.equal(config.version,3);assert.equal(config.routes[0].src,'/api/(.*)');assert.equal(config.routes[0].dest,'https://routing-fixture.onrender.com/api/$1');assert.equal(config.routes[0].headers['Cache-Control'],'no-store');assert.deepEqual(config.routes[1],{handle:'filesystem'});assert.equal(config.routes[2].dest,'/index.html');
console.log('Cloud routing contracts passed: exact HTTPS Render origin, no credentials/localhost/path injection, API before SPA, no caching');
