import fs from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {campaignEmbeddings} from '../server/campaignEmbedding';
import {cosine} from '../server/inference';
const output=process.argv[2];if(!output||fs.existsSync(output))throw new Error('New output required');
const texts=['Software control: the fictional museum is open.','सॉफ्टवेयर परीक्षण: काल्पनिक संग्रहालय खुला है।','సాఫ్ట్‌వేర్ పరీక్ష: కల్పిత సంగ్రహాలయం తెరిచి ఉంది.'];
const start=performance.now(),encoded=await campaignEmbeddings(texts),wallMs=performance.now()-start;
assert.equal(encoded.metadata.status,'available');assert.ok(encoded.vectors?.every(v=>v.length===384&&v.every(Number.isFinite)));
process.env.VERITAS_CAMPAIGN_EMBEDDING_FORMAT='generic';const rejected=await campaignEmbeddings(texts);assert.equal(rejected.metadata.status,'unavailable');assert.equal(rejected.vectors,null);
const backendHealth=await fetch('http://127.0.0.1:8021/health').then(r=>r.json());
fs.writeFileSync(output,JSON.stringify({scope:'actual_cached_e5_input_contract_software_smoke_not_campaign_accuracy',languages:['English','Hindi','Telugu'],metadata:encoded.metadata,
 dimensions:encoded.vectors!.map(v=>v.length),cosines:encoded.vectors!.map(a=>encoded.vectors!.map(b=>cosine(a,b))),wallMs,backendHealth,
 incompatibleConfiguration:rejected.metadata,
 adapterSha256:createHash('sha256').update(fs.readFileSync('server/campaignEmbedding.ts')).digest('hex'),
 limitations:['Three authored sentences check task formatting and finite outputs only.','No multilingual campaign detection quality, semantic admission threshold or maliciousness accuracy is measured.']},null,2),{flag:'wx'});
console.log(JSON.stringify({output,wallMs,dimensions:encoded.vectors!.map(v=>v.length)}));
