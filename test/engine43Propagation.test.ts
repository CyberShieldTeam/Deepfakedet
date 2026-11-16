import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import request from 'supertest';
import {authoredControlCases,controlRows,configureControlCorpus} from './engine43Controls';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'engine43-control-')),store=path.join(root,'cases.json');
process.env.VERITAS_EMBEDDED='true';process.env.NODE_ENV='production';process.env.APP_GEMINI_API_KEY='MY_DISABLED';process.env.GOOGLE_FACT_CHECK_API_KEY='';process.env.VERITAS_EMBEDDING_ENDPOINT='';process.env.VERITAS_STORE=store;
const token='engine43-control-token-not-secret-00000',other='engine43-other-token-not-secret-000000';process.env.VERITAS_USERS=JSON.stringify({[token]:'local-analyst',[other]:'other'});configureControlCorpus(root);fs.writeFileSync(store,JSON.stringify(authoredControlCases()));
try{
 const {app}=await import('../server'),api=request(app),headers={Authorization:`Bearer ${token}`},observations:any[]=[];
 for(const row of controlRows()){
  const base=`/api/investigations/engine43-${row.id}`,initial=(await api.get(base).set(headers).expect(200)).body.investigation,extraction=initial.extractions[0],candidate=extraction.candidates[0],route=`${base}/extractions/${extraction.id}`;
  await api.post(route+'/investigate').set(headers).send({candidateId:candidate.id,revision:0}).expect(409);
  await api.post(route+'/review').set({Authorization:`Bearer ${other}`}).send({candidateId:candidate.id,revision:0,state:'corrected',reviewedText:row.source,reason:'Unauthorized control',sourceConfirmed:true}).expect(404);
  const before=(await api.post(base+'/correlate').set(headers).send({}).expect(200)).body.result;assert.ok(!before.relationships.some((e:any)=>e.type==='CLAIM_INVESTIGATED_BY_ENGINE2'));
  const state=row.id==='mixed'?'uncertain':'corrected';
  const reviewed=(await api.post(route+'/review').set(headers).send({candidateId:candidate.id,revision:0,state,reviewedText:state==='corrected'?row.source:undefined,reason:'AUTHORED SOFTWARE CONTROL. Not a human-review usability measurement.',sourceConfirmed:state==='corrected'}).expect(200)).body.investigation;
  assert.equal(reviewed.extractions[0].originalText,row.injected);assert.equal(reviewed.extractions[0].candidates[0].originalText,row.injected);
  if(state==='uncertain'){await api.post(route+'/investigate').set(headers).send({candidateId:candidate.id,revision:1}).expect(409);observations.push({case:row.id,state,finalBinding:false,reason:'Unsupported mixed-script uncertainty retained; no translation invented'});continue;}
  const result=(await api.post(route+'/investigate').set(headers).send({candidateId:candidate.id,revision:1}).expect(200)).body.result;assert.equal(result.originalInput,row.source);assert.equal(result.extractionOrigin.reviewedText,row.source);assert.equal(result.verdict,'Insufficient Evidence');
  const graph=(await api.post(base+'/correlate').set(headers).send({}).expect(200)).body.result;assert.ok(graph.relationships.some((e:any)=>e.type==='CLAIM_INVESTIGATED_BY_ENGINE2'));
  const claim=graph.nodes.find((n:any)=>n.type==='claim');assert.equal(claim.metadata.text,row.source);const mentions=graph.relationships.filter((e:any)=>e.type==='POST_CONTAINS_CLAIM');assert.equal(mentions.length,3);assert.ok(mentions.every((e:any)=>graph.nodes.find((n:any)=>n.id===e.source).metadata.text===row.source));
  const report=(await api.get(`/api/reports/engine43-${row.id}`).set(headers).expect(200)).body.report;assert.deepEqual(report.investigation.correlation,graph);assert.deepEqual(report.investigation.extractions[0].candidates[0].reviews,reviewed.extractions[0].candidates[0].reviews);
  assert.ok(report.investigation.extractions[0].segments.every((s:any)=>s.timestamp===null));
  const repeated=(await api.post(route+'/investigate').set(headers).send({candidateId:candidate.id,revision:1}).expect(200)).body.investigation;assert.equal(repeated.claimResults.length,1);
  observations.push({case:row.id,rawInjectedText:row.injected,correctedText:row.source,verdict:result.verdict,sourceCount:result.sources.length,correctPostMentions:mentions.length,graphCounts:graph.counts,sourceHash:extraction.sourceMediaHash,provenanceEdges:graph.relationships.filter((e:any)=>['CLAIM_INVESTIGATED_BY_ENGINE2','CLAIM_REVIEWED_FROM_TEXT'].includes(e.type))});
 }
 const raw=JSON.parse(fs.readFileSync(store,'utf8'));assert.ok(raw.every((i:any)=>i.extractions[0].candidates[0].reviews.length===1));
 fs.writeFileSync(process.env.VERITAS_E43_PROPAGATION_REPORT||'.model-cache/engine43-propagation-latest.json',JSON.stringify({scope:'AUTHORED INJECTED TRANSCRIPT SOFTWARE CONTROLS; not OCR accuracy, analytical relationship accuracy or human usability',observations},null,2));console.log('Five error-propagation controls passed: number, location, negation, date, mixed uncertainty; owned review, original preservation, exact downstream/post links, report/disk parity and idempotence.');
}finally{fs.rmSync(root,{recursive:true,force:true});}
