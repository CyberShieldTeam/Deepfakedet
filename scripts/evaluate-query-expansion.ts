/** Frozen live paired retrieval comparison. Gold pages never enter query construction. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {wikipediaEvidence,clearWikipediaCache} from '../server/wikipediaEvidence';
import {rankEvidence} from '../server/claimVerification';
import {prioritizeSubject} from '../server/claimRanking';
import {retrievalMetrics} from '../test/claimRetrievalMetrics';
const [input,output]=process.argv.slice(2),privateOutput='.model-cache/engine2-advanced/query-pools.json';
if(!input||!output||fs.existsSync(output)||fs.existsSync(privateOutput))throw Error('New frozen output paths required');
const raw=fs.readFileSync(input),data=JSON.parse(raw.toString()),hash=(v:string|Buffer)=>crypto.createHash('sha256').update(v).digest('hex');
if(data.protocolSha256!==hash(fs.readFileSync('test/fixtures/claims/retrieval_query_protocol.json')))throw Error('Frozen protocol mismatch');
Object.assign(process.env,{VERITAS_WIKIPEDIA_ENABLED:'1',VERITAS_WIKIPEDIA_LANGUAGE:'en',VERITAS_EMBEDDING_ENDPOINT:''});
const page=(s:string)=>decodeURIComponent(new URL(s).pathname.slice(6)).replaceAll('_',' ').normalize('NFC');
const gold=(s:string)=>s.replaceAll('_',' ').replaceAll('-LRB-','(').replaceAll('-RRB-',')').replaceAll('-COLON-',':').normalize('NFC');
const rows:any[]=[],pools:any[]=[];
for(const row of data.rows){
  const methods:Record<string,any>={},saved:Record<string,any>={};
  // Fixed sequential order is documented, not interpreted as a latency improvement.
  for(const mode of ['legacy','subject'] as const){
    clearWikipediaCache();
    const start=performance.now(),retrieval=await wikipediaEvidence(row.claim,fetch,mode),ranking=await rankEvidence(row.claim,retrieval.items,false),elapsedMs=performance.now()-start;
    const pool=ranking.ranked,identity=Object.fromEntries([...new Set([...row.pages.map(gold),...pool.map(x=>page(x.url))])].map(p=>[p,row.pages.map(gold).includes(p)?1:0]));
    const measure=(order:typeof pool)=>Object.fromEntries([1,3,6].map(k=>[k,retrievalMetrics(order.map(x=>page(x.url)),identity,k,true)]));
    methods[mode]={status:retrieval.state.status,querySha256:hash(retrieval.state.query||''),elapsedMs,metrics:measure(pool),order:pool.map(x=>x.url)};
    if(mode==='subject')methods.subjectPriority={...methods.subject,metrics:measure(prioritizeSubject(row.claim,pool)),order:prioritizeSubject(row.claim,pool).map(x=>x.url)};
    saved[mode]=retrieval;
  }
  rows.push({id:row.id,role:row.role,claimSha256:hash(row.claim),annotatedPages:row.pages,methods});
  pools.push({...row,...saved});
  console.log(JSON.stringify({id:row.id,role:row.role,legacy:methods.legacy.metrics[6].recall,subject:methods.subject.metrics[6].recall}));
}
const splits=Object.fromEntries(['development','validation','held_out'].map(role=>{
  const part=rows.filter(r=>r.role===role);
  return [role,Object.fromEntries(['legacy','subject','subjectPriority'].map(method=>[method,{queries:part.length,failures:part.filter(r=>r.methods[method].status!=='available').length,meanMs:part.reduce((n,r)=>n+r.methods[method].elapsedMs,0)/part.length,k:Object.fromEntries([1,3,6].map(k=>[k,Object.fromEntries(['recall','mrr','ndcg'].map(metric=>[metric,part.reduce((n,r)=>n+(r.methods[method].metrics[k][metric]??0),0)/part.length]))]))}]))];
}));
const val:any=splits.validation,adopt=val.subject.k[6].recall>val.legacy.k[6].recall&&val.subject.k[1].mrr>=val.legacy.k[1].mrr&&val.subject.k[3].ndcg>=val.legacy.k[3].ndcg;
fs.writeFileSync(privateOutput,JSON.stringify({manifestSha256:hash(raw),protocolSha256:data.protocolSha256,rows:pools},null,2),{flag:'wx'});
fs.writeFileSync(output,JSON.stringify({at:new Date().toISOString(),scope:'FEVER known evidence-page identity proxy; not passage relevance/stance. Unlisted pages unjudged.',manifestSha256:hash(raw),protocolSha256:data.protocolSha256,poolsSha256:hash(fs.readFileSync(privateOutput)),queryCodeSha256:hash(fs.readFileSync('server/wikipediaEvidence.ts')),splits,subjectQueryValidationGatePassed:adopt,rows},null,2),{flag:'wx'});
console.log(JSON.stringify({splits,subjectQueryValidationGatePassed:adopt}));
