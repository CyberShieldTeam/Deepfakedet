/** Actual application BM25 over the complete frozen corpus, without annotation injection. */
import fs from 'node:fs';import crypto from 'node:crypto';import {performance} from 'node:perf_hooks';
import {bm25} from '../server/claimVerification';
const [input,output]=process.argv.slice(2);
if(!input||!output||fs.existsSync(output))throw Error('New output required');
const bytes=fs.readFileSync(input),data=JSON.parse(bytes.toString()),hash=(x:string|Buffer)=>crypto.createHash('sha256').update(x).digest('hex');
if(data.protocolSha256!==hash(fs.readFileSync('test/fixtures/claims/scifact_protocol.json')))throw Error('Protocol mismatch');
const texts=data.corpus.map((d:any)=>`${d.title} ${d.text}`),rows=[];
for(const row of data.rows){const start=performance.now(),scores=bm25(row.claim,texts),order=scores.map((score,i)=>({i,score})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,6);rows.push({...row,baselineMs:performance.now()-start,items:order.map(x=>({id:data.corpus[x.i]._id,text:texts[x.i],lexicalScore:x.score,passageSha256:hash(texts[x.i])}))});}
fs.writeFileSync(output,JSON.stringify({source:data.source,license:data.license,archiveSha256:data.archiveSha256,protocolSha256:data.protocolSha256,manifestSha256:hash(bytes),bm25CodeSha256:hash(fs.readFileSync('server/claimVerification.ts')),rows}),{flag:'wx'});
console.log(JSON.stringify({queries:rows.length,candidates:rows.reduce((n,r)=>n+r.items.length,0)}));
