import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import fs from 'node:fs';
import {prepareCampaignPosts,analyzeEpisodeCampaign} from '../server/campaignEpisodes';
import {runCampaign,CampaignRunError} from '../server/campaignRunner';
import {episodeControls,coverage} from './fixtures/campaign/episodeControls';
import {campaignEmbeddings} from '../server/campaignEmbedding';
const control=episodeControls.find(c=>c.name==='multi_episode_pattern')!;
const rows=control.rows.flatMap(row=>[row,{...row,timestamp_precision:'unknown'}]);
const forward=analyzeEpisodeCampaign('precision regression',rows,true,{},null,coverage);
const reverse=analyzeEpisodeCampaign('precision regression',[...rows].reverse(),true,{},null,coverage);
assert.equal(forward.episodeEvidence!.associations.filter(a=>a.recurrenceEligible).length,0);
const stable=(result:typeof forward)=>result.episodeEvidence!.posts.map(({inputRows,...p})=>p);
assert.deepEqual(stable(forward),stable(reverse));
assert.ok(forward.episodeEvidence!.posts.every(p=>p.resolutionMs===86400000&&p.sourceMetadata?.length===2));
const zoned=[{...control.rows[0],timestamp:'2026-01-01T05:30:00+05:30'},control.rows[0],control.rows[1]];
const prepared=prepareCampaignPosts(zoned);
assert.equal(prepared.duplicatesRemoved,1);
assert.equal(prepared.items.find(x=>x.record.postId===control.rows[0].post_id)!.record.sourceMetadata!.length,2);
assert.throws(()=>prepareCampaignPosts([{...control.rows[0],timestamp:'2026-01-01T05:30:00'},control.rows[1]]),/explicit UTC offset/);
assert.throws(()=>prepareCampaignPosts([{...control.rows[0],timestamp:undefined},control.rows[1]]),/Timestamp/);
const job={datasetName:'worker software regression',rows:control.rows,isSimulated:true,coverage};
const result=await runCampaign(job);
assert.equal(result.episodeEvidence!.associations.filter(a=>a.recurrenceEligible).length,6);
const unicode=await runCampaign({...job,rows:control.rows.map(r=>({...r,content:'సాఫ్ట్‌వేర్ పరీక్ష काल्पनिक सूचना https://example.org/notice'}))});
assert.equal(unicode.episodeEvidence!.posts[0].content,'సాఫ్ట్‌వేర్ పరీక్ష काल्पनिक सूचना https://example.org/notice');
await assert.rejects(runCampaign({...job,rows:[{...control.rows[0],timestamp:undefined},control.rows[1]]}),e=>e instanceof CampaignRunError&&e.status===400);
await assert.rejects(runCampaign(job,undefined,1),e=>e instanceof CampaignRunError&&e.code==='CAMPAIGN_TIMEOUT');
const abort=new AbortController();const interrupted=runCampaign(job,abort.signal);abort.abort();
await assert.rejects(interrupted,e=>e instanceof CampaignRunError&&e.code==='CAMPAIGN_INTERRUPTED');
const dense=Array.from({length:3000},(_,i)=>({...control.rows[0],account_id:`f-${i}`,post_id:`p-${i}`}));
const start=performance.now();let beats=0;
const interval=setInterval(()=>beats++,10);
const pending=runCampaign({...job,rows:dense});
await assert.rejects(runCampaign(job),e=>e instanceof CampaignRunError&&e.status===429);
try{const denseResult=await pending;assert.equal(denseResult.truncated,true);assert.ok(denseResult.episodeEvidence!.associations.every(a=>!a.recurrenceEligible));}finally{clearInterval(interval);}
assert.ok(beats>20,'CPU worker must leave the parent event loop responsive');
// A completed or interrupted worker must release the single job slot.
assert.equal((await runCampaign(job)).algorithm,'episodes_v1');
process.env.VERITAS_EMBEDDING_ENDPOINT='http://127.0.0.1:9/fictional-timeout-test';
process.env.VERITAS_EMBEDDING_MODEL_ID='software-generic';process.env.VERITAS_EMBEDDING_VERSION='v1';
const originalFetch=globalThis.fetch;
try{
  for(const error of [new Error('software load failure'),new DOMException('software timeout','TimeoutError')]){
    globalThis.fetch=(async()=>{throw error;}) as typeof fetch;
    const fallback=await campaignEmbeddings(['Fictional timeout control']);
    assert.equal(fallback.vectors,null);assert.equal(fallback.metadata.status,'unavailable');assert.equal(fallback.metadata.usedForAdmissions,false);
  }
}finally{globalThis.fetch=originalFetch;}
const report={suite:'Engine3 reliability',scope:'software_controls_not_independent_accuracy',precisionOrderIndependent:true,workerHeartbeatTicks:beats,denseWallMsIncludingRecovery:performance.now()-start,timeoutAbortBusyRecovery:true,simulatedEmbeddingFailureAndTimeoutFallback:true};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2),{flag:'wx'});
console.log(JSON.stringify(report));
