/** Actual browser baseline/retest using authored fixtures and isolated operator stores only. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {episodeControls,coverage} from './fixtures/campaign/episodeControls';
import {analyzeEpisodeCampaign} from '../server/campaignEpisodes';
import {retrieveEvidence} from '../server/claimVerification';
const [output,normal='http://127.0.0.1:3317',unavailable='http://127.0.0.1:3319']=process.argv.slice(2);
if(!output||fs.existsSync(output))throw new Error('New output path required');
const browser=await chromium.launch({headless:true});const cases:any[]=[];
try{
 for(const [name,kind,base] of [['media_measured','media',normal],['claim_retrieved','claim',normal],['claim_no_match','claim',normal],['network_repeated','campaign',normal],['network_no_match','campaign',normal],['media_service_failure','media',unavailable],['claim_unconfigured','claim',unavailable]]){
  const page=await browser.newPage({extraHTTPHeaders:process.env.VERITAS_TEST_TOKEN?{Authorization:`Bearer ${process.env.VERITAS_TEST_TOKEN}`}:{}});await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
  await page.goto(base);
  await page.getByRole('button',{name:kind==='media'?'Media forensics':kind==='claim'?'Claim intelligence':'Network intelligence',exact:true}).first().click();
  const endpoint=kind==='media'?'/api/forensics/analyze-media':kind==='claim'?'/api/claims/verify':'/api/campaigns/analyze';
  const response=page.waitForResponse(r=>r.url().includes(endpoint)&&r.request().method()==='POST');
  if(kind==='media'){
   const bytes=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=64;c.height=64;c.getContext('2d')!.fillRect(0,0,64,64);return c.toDataURL().split(',')[1];});
   await page.locator('input[type=file]').setInputFiles({name:'authored-diagnostic.png',mimeType:'image/png',buffer:Buffer.from(bytes,'base64')});
   await page.getByRole('button',{name:/Check this file/}).click();
  }else if(kind==='claim'){
   await page.locator('textarea').fill(name==='claim_no_match'?'Zyxwv quasar zebra observatory.':'The fictional Amber Museum has free entry.');
   await page.getByRole('button',{name:'Check this claim',exact:true}).click();
  }else{
   const rows=name==='network_no_match'?episodeControls.find(c=>c.name==='shared_popular_url')!.rows:episodeControls.find(c=>c.name==='multi_episode_pattern')!.rows;
   await page.locator('input[type=file]').setInputFiles({name:'authored-diagnostic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({posts:rows,coverage}))});
  }
  const http=await response,result=(await http.json()).result,payload=http.request().postDataJSON();assert.ok(result);
  if(!output.includes('before')){
   const expected:Record<string,string>={media_measured:'PARTIAL_ANALYSIS',claim_retrieved:'INSUFFICIENT_EVIDENCE',claim_no_match:'NO_RELEVANT_SIGNALS',network_repeated:'INSUFFICIENT_EVIDENCE',network_no_match:'NO_RELEVANT_SIGNALS',media_service_failure:'PARTIAL_ANALYSIS',claim_unconfigured:'ANALYSIS_UNAVAILABLE'};
   assert.equal(result.analysis?.state,expected[name]);
   await page.getByRole('region',{name:'Analysis processing status'}).getByText(`Analysis status: ${expected[name]}`,{exact:true}).waitFor();
   assert.equal(result.aiGeneratedProbability??null,null);
  }
  await page.getByRole('button',{name:'Save to a case',exact:true}).click();await page.getByRole('button',{name:/Saved to SUR-/}).waitFor();
  const investigations=(await page.request.get(base+'/api/investigations').then(r=>r.json())).investigations;
  const inv=investigations.find((i:any)=>JSON.stringify(kind==='media'?i.forensicResult:kind==='claim'?i.claimResult:i.campaignResult)===JSON.stringify(result));assert.ok(inv,'Attached result must equal API result');
  const report=(await page.request.get(base+`/api/reports/${inv.id}`).then(r=>r.json())).report;
  assert.deepEqual(kind==='media'?report.investigation.forensicResult:kind==='claim'?report.investigation.claimResult:report.investigation.campaignResult,result);
  const disk=JSON.parse(fs.readFileSync(base===normal?(process.env.CROSS_TRACE_NORMAL_STORE||'.model-cache/cross-engine-store.json'):(process.env.CROSS_TRACE_UNAVAILABLE_STORE||'.model-cache/cross-engine-unavailable-store.json'),'utf8'));
  const stored=(Array.isArray(disk)?disk:disk.investigations).find((i:any)=>i.id===inv.id);assert.ok(stored);
  assert.deepEqual(kind==='media'?stored.forensicResult:kind==='claim'?stored.claimResult:stored.campaignResult,result);
  let raw:any;
  if(kind==='campaign'){
   const r=analyzeEpisodeCampaign(payload.datasetName,payload.posts,false,payload.config,null,payload.coverage);
   raw={associations:r.edges.length,episodes:r.episodeEvidence?.episodes.length,eligible:r.episodeEvidence?.associations.filter(a=>a.recurrenceEligible).length,evidence:{posts:r.episodeEvidence!.posts,witnesses:r.episodeEvidence!.witnesses,episodes:r.episodeEvidence!.episodes,associations:r.episodeEvidence!.associations}};
   for(const key of ['posts','witnesses','episodes','associations'])assert.deepEqual(raw.evidence[key],result.episodeEvidence[key]);
  }
  if(kind==='claim'&&base===normal){
   const r=await retrieveEvidence(payload.claimText);raw={ranked:r.ranked.length,candidates:r.candidateCount,providers:r.providers,sources:r.ranked.map(s=>({title:s.title,url:s.url,excerpt:s.excerpt,lexicalScore:s.lexicalScore}))};
   assert.deepEqual(raw.sources,result.sources.map((s:any)=>({title:s.title,url:s.url,excerpt:s.excerpt,lexicalScore:s.relevance.lexicalScore})));
  }
  if(kind==='media'&&base===normal){
   raw=await fetch('http://127.0.0.1:8417/v1/image/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image_base64:payload.mediaData.split(',')[1]})}).then(r=>r.json());
   for(const key of ['model_status','fake_probability','classification','face_boxes','face_analysis'])assert.deepEqual(raw[key],result.localImage[key]);
  }
  cases.push({name,kind,httpStatus:http.status(),raw,api:result,storedIdentical:true,reportIdentical:true,displayedText:await page.locator('main').innerText()});
  await page.screenshot({path:`.model-cache/${name}-${output.includes('before')?'before':'after'}.png`,fullPage:true});await page.close();
 }
 fs.writeFileSync(output,JSON.stringify({scope:'authored_frontend_raw_api_storage_report_trace_not_accuracy',cases},null,2),{flag:'wx'});console.log({output,cases:cases.length});
}finally{await browser.close();}
