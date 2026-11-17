/** Real, bounded API observations; annotations do not enter the search query. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {wikipediaEvidence,clearWikipediaCache} from '../server/wikipediaEvidence';
import {rankEvidence} from '../server/claimVerification';
const manifest=process.argv[2],output=process.argv[3];
if(!manifest||!output||fs.existsSync(output))throw Error('New output and frozen manifest required');
const bytes=fs.readFileSync(manifest),data=JSON.parse(bytes.toString());
if(data.kind!=='fever'||data.protocolSha256!==crypto.createHash('sha256').update(fs.readFileSync('test/fixtures/claims/advanced_protocol.json')).digest('hex'))throw Error('Frozen protocol mismatch');
Object.assign(process.env,{VERITAS_WIKIPEDIA_ENABLED:'1',VERITAS_WIKIPEDIA_LANGUAGE:'en',VERITAS_EMBEDDING_ENDPOINT:''});
const rows=[];
for(const row of data.rows){
  clearWikipediaCache();
  const start=performance.now(),result=await wikipediaEvidence(row.claim),baseline=await rankEvidence(row.claim,result.items,false);
  rows.push({...row,items:result.items,provider:result.state,elapsedMs:performance.now()-start,baseline:baseline.ranked.map(x=>({url:x.url,score:x.rank,lexicalScore:x.lexicalScore}))});
  console.log(JSON.stringify({id:row.id,role:row.role,status:result.state.status,candidates:result.items.length}));
}
fs.mkdirSync('.model-cache/engine2-advanced',{recursive:true});
fs.writeFileSync(output,JSON.stringify({scope:'FEVER annotated evidence-page identity; live current Wikipedia lead candidates; not passage relevance or stance accuracy',at:new Date().toISOString(),manifestSha256:crypto.createHash('sha256').update(bytes).digest('hex'),protocolSha256:data.protocolSha256,rankingCodeSha256:crypto.createHash('sha256').update(fs.readFileSync('server/claimVerification.ts')).digest('hex'),datasetSha256:data.datasetSha256,source:data.source,rows},null,2),{flag:'wx'});
