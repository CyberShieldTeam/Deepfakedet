import {z} from 'zod';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {NliWorker,NliWorkerError,NLI_CAPS,type NliPair} from './nliWorker';
import {analyzeClaim} from './claimText';
import {suspectedRomanized} from './claimExtraction';
import type {RetrievedEvidence} from './claimSources';
import type {RerankingAnalysis} from '../src/claimTypes';
export const RERANKER_MODEL='cross-encoder/ms-marco-MiniLM-L6-v2',RERANKER_VERSION='233902d25c440f23af6f7d6e94d2946bac0bee0a';
const memory=z.object({rssBytes:z.number().int().nonnegative(),peakWorkingSetBytes:z.number().int().nonnegative().nullable()}).strict();
const result=z.discriminatedUnion('status',[
  z.object({status:z.literal('executed'),score:z.number().finite(),tokens:z.number().int().min(1).max(512),elapsedMs:z.number().finite().nonnegative()}).strict(),
  z.object({status:z.literal('input_over_limit'),tokens:z.number().int().positive().optional()}).strict(),
  z.object({status:z.literal('unsupported_language')}).strict(),
]);
export const rerankerProtocol={ready:z.object({event:z.literal('ready'),modelId:z.literal(RERANKER_MODEL),version:z.literal(RERANKER_VERSION),startupMs:z.number().finite().nonnegative(),memory}).strict(),reply:z.object({requestId:z.string(),results:z.array(result).min(1).max(8),elapsedMs:z.number().finite().nonnegative(),memory}).strict()};
let worker:NliWorker<z.infer<typeof result>>|undefined,key='';
export async function runReranker(pairs:NliPair[]){
  const current=JSON.stringify([process.env.VERITAS_RERANKER_PYTHON,process.env.VERITAS_RERANKER_MODEL_PATH]);
  if(key!==current){worker?.stop();worker=undefined;key=current;}
  worker??=new NliWorker(process.env.VERITAS_RERANKER_PYTHON||'python',['-u','-m','ai_service.claim_reranker','--worker','--snapshot',process.env.VERITAS_RERANKER_MODEL_PATH||''],NLI_CAPS,rerankerProtocol);
  return worker.infer(pairs);
}
export function shutdownReranker(){worker?.stop();worker=undefined;}
process.once('exit',shutdownReranker);
type Candidate=RetrievedEvidence&{rank:number;lexicalScore:number;semanticScore:number|null};
/** Optional relevance ordering only. All-or-nothing fallback retains contradictory candidates. */
export async function rerankEvidence<T extends Candidate>(claim:string,items:T[],language?:string,infer=runReranker):Promise<{ranked:T[];analysis:RerankingAnalysis}>{
  const start=performance.now(),analysis:RerankingAnalysis={status:'unconfigured',modelId:RERANKER_MODEL,version:RERANKER_VERSION,evaluationStatus:'experimental_relevance_only',applied:false,elapsedMs:0,reason:'Reranker disabled or snapshot unconfigured; original relevance order retained.',candidates:[]};
  const finish=()=>{analysis.elapsedMs=performance.now()-start;return {ranked:items,analysis}};
  if(process.env.VERITAS_RERANKER_ENABLED!=='1'||!process.env.VERITAS_RERANKER_MODEL_PATH)return finish();
  if(!items.length){analysis.status='not_applicable';analysis.reason='No candidates; no inference.';return finish();}
  if(language!=='en'||analyzeClaim(claim).language!=='English'||suspectedRomanized(claim)||items.some(x=>x.language!=='en'||x.provider==='google_fact_check')){analysis.status='unsupported_language';analysis.reason='Explicit English assertion and English article passages required for every candidate; metadata-only or unsupported candidates retain original order.';return finish();}
  if(items.length>8||claim.length>1000){analysis.status='input_over_limit';analysis.reason='Input budget exceeded; original order retained.';return finish();}
  const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
  if(items.some(x=>x.passageSha256&&x.passageSha256!==hash(x.excerpt))){analysis.status='unavailable';analysis.reason='Passage fingerprint mismatch; no inference or reordering.';return finish();}
  try{
    const inputs=items.map(x=>`${x.title} ${x.excerpt}`),response=await infer(inputs.map(premise=>({premise,hypothesis:claim,language:'en'})));
    analysis.startupMs=response.startupMs;analysis.memory={rssBytes:response.memory.rssBytes,peakWorkingSetBytes:response.memory.peakWorkingSetBytes??null};
    analysis.candidates=response.results.map((r,i)=>({url:items[i].url!,inputSha256:hash(inputs[i]),passageSha256:hash(items[i].excerpt),...r}));
    if(response.results.some(r=>r.status!=='executed')){analysis.status=response.results.some(r=>r.status==='unsupported_language')?'unsupported_language':'input_over_limit';analysis.reason='At least one exact input could not be scored; whole-query original order retained, without truncation.';return finish();}
    analysis.status='executed';analysis.applied=true;analysis.reason='Experimental English relevance order. Raw logits are not stance, truth or credibility probabilities. Small scientific-abstract benchmark does not validate this deployment domain.';analysis.elapsedMs=performance.now()-start;
    return {ranked:items.map((value,i)=>({value,i,score:(response.results[i] as Extract<z.infer<typeof result>,{status:'executed'}>).score})).sort((a,b)=>b.score-a.score||a.i-b.i).map(x=>x.value),analysis};
  }catch(error){const code=error instanceof NliWorkerError?error.category:'FAILED';analysis.status=code==='BUSY'?'busy':code==='TIMEOUT'?'timeout':code==='INPUT_LIMIT'?'input_over_limit':'unavailable';analysis.reason=`Reranker ${code}; original relevance order and all passages retained. No replacement score invented.`;return finish();}
}
