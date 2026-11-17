/** Evidence-page proxy evaluation: unlisted pages remain unjudged. No stance labels. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {prioritizeSubject} from '../server/claimRanking';
import {retrievalMetrics} from '../test/claimRetrievalMetrics';
const [input,output,rerankerPath]=process.argv.slice(2);
if(!input||!output||fs.existsSync(output))throw Error('New output required');
const raw=fs.readFileSync(input),data=JSON.parse(raw.toString()),reranker=rerankerPath?JSON.parse(fs.readFileSync(rerankerPath,'utf8')):null;
if(data.protocolSha256!==crypto.createHash('sha256').update(fs.readFileSync('test/fixtures/claims/advanced_protocol.json')).digest('hex'))throw Error('Protocol mismatch');
if(reranker&&reranker.manifestSha256!==crypto.createHash('sha256').update(raw).digest('hex'))throw Error('Reranker input mismatch');
const page=(url:string)=>decodeURIComponent(new URL(url).pathname.slice('/wiki/'.length)).replaceAll('_',' ').normalize('NFC');
const gold=(p:string)=>p.replaceAll('_',' ').replaceAll('-LRB-','(').replaceAll('-RRB-',')').replaceAll('-COLON-',':').normalize('NFC');
const rows=data.rows.map((r:any)=>{
  const ranked=r.baseline.map((b:any)=>({...r.items.find((x:any)=>x.url===b.url),rank:b.score})),start=performance.now(),entity=prioritizeSubject(r.claim,ranked),entityMs=performance.now()-start;
  const predictions=reranker?.rows.find((x:any)=>x.id===r.id)?.candidates;
  // Any unscored pair makes the whole query a documented baseline fallback.
  const complete=!!predictions?.length&&predictions.every((p:any)=>p.status==='executed');
  const reranked=complete?[...ranked].sort((a:any,b:any)=>predictions.find((x:any)=>x.url===b.url).values[0]-predictions.find((x:any)=>x.url===a.url).values[0]):ranked;
  const judgment=Object.fromEntries([...new Set([...r.pages.map(gold),...r.items.map((x:any)=>page(x.url))])].map(p=>[p,r.pages.map(gold).includes(p)?1:0]));
  const measure=(items:any[])=>Object.fromEntries([1,3,6].map(k=>[k,retrievalMetrics(items.map(x=>page(x.url)),judgment,k,true)]));
  return {id:r.id,role:r.role,claimSha256:crypto.createHash('sha256').update(r.claim).digest('hex'),annotatedPages:r.pages,providerStatus:r.provider.status,retrievalMs:r.elapsedMs,entityMs,baseline:measure(ranked),entity:measure(entity),reranker:reranker?measure(reranked):null,rerankerComplete:complete,orders:{baseline:ranked.map((x:any)=>x.url),entity:entity.map(x=>x.url),reranker:reranker?reranked.map((x:any)=>x.url):null},entityMatches:entity.filter(x=>x.entityTitleMatch).map(x=>x.url)};
});
const splits=Object.fromEntries(['development','validation','held_out'].map(role=>{
  const part=rows.filter((r:any)=>r.role===role),methods=Object.fromEntries(['baseline','entity',...(reranker?['reranker']:[])].map(method=>[method,Object.fromEntries([1,3,6].map(k=>[k,Object.fromEntries(['recall','mrr','ndcg'].map(metric=>[metric,part.reduce((n:number,r:any)=>n+(r[method][k][metric]??0),0)/part.length]))]))]));
  return [role,{queries:part.length,providerFailures:part.filter((r:any)=>r.providerStatus!=='available').length,...methods}];
}));
const val:any=splits.validation;
const adopted=val.entity[1].mrr>=val.baseline[1].mrr&&val.entity[3].ndcg>=val.baseline[3].ndcg&&val.entity[6].recall===val.baseline[6].recall;
const result={scope:'External FEVER evidence-page identity proxy only; binary known-page nDCG, unlisted candidates unjudged. No passage relevance or factual accuracy claim.',at:new Date().toISOString(),baselineSha256:crypto.createHash('sha256').update(raw).digest('hex'),protocolSha256:data.protocolSha256,entityCodeSha256:crypto.createHash('sha256').update(fs.readFileSync('server/claimRanking.ts')).digest('hex'),splits,entityValidationGatePassed:adopted,rerankerProductionPromotion:false,rows,limitations:['Current search and lead extracts differ from FEVER 2017 sentence evidence; annotated pages may be renamed/missing.', 'No exhaustive passage annotations; absence from gold does not establish irrelevance. Page retrieval metrics cannot justify stance.', 'Source-page and near-claim separation do not ensure disjoint topics/families or absence from model pretraining.', 'MRR uses the full bounded list; recall denominator includes all annotated pages even absent from candidate pool.', 'Reranker failure/over-limit uses unchanged baseline order and is counted; never fabricated scores.']};
fs.writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify({splits,entityValidationGatePassed:adopted}));
