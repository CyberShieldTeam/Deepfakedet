import fs from 'node:fs';import assert from 'node:assert/strict';
import {projectInvestigation,correlationFingerprint} from '../server/correlation';
const [output,store,base]=process.argv.slice(2);if(!output||fs.existsSync(output)||!store||!base)throw new Error('New output, isolated store and test URL required');
const inv=JSON.parse(fs.readFileSync(store,'utf8')).find((i:any)=>i.correlationRun?.status==='current'&&i.correlationContexts?.length);assert.ok(inv);
const headers=process.env.VERITAS_TEST_TOKEN?{Authorization:`Bearer ${process.env.VERITAS_TEST_TOKEN}`}:{ };
const response=await fetch(base+`/api/investigations/${inv.id}`,{headers});assert.equal(response.status,200);const api=(await response.json()).investigation;
const reportResponse=await fetch(base+`/api/reports/${inv.id}`,{headers});assert.equal(reportResponse.status,200);const report=(await reportResponse.json()).report;
assert.deepEqual(api,inv);assert.deepEqual(report.investigation,inv);assert.equal(correlationFingerprint(projectInvestigation(inv),inv.correlationContexts),inv.correlation.inputFingerprint);
const result={scope:'authored_actual_frontend_engine4_workflow_not_accuracy',investigationId:inv.id,apiDiskReportIdentical:true,sourceFingerprintCurrent:true,
 engineStates:{media:inv.forensicResult.analysis?.state,claim:inv.claimResult.analysis?.state,network:inv.campaignResult.analysis?.state},
 invariants:{mediaAuthenticity:inv.forensicResult.authenticity,mediaDecisionProbability:inv.forensicResult.aiGeneratedProbability,networkProbability:inv.campaignResult.overallCoordinationIndex},
 supportedPath:inv.correlation.relationships.filter((e:any)=>['MEDIA_CONTEXT_CLAIM','POST_CONTAINS_CLAIM','SOURCE_ADDRESSES_CLAIM','SHARED_CANONICAL_URL'].includes(e.type)),
 correlation:inv.correlation,limitations:['Authored example.org corpus and posts, generated image and test-analyst source review.','Caption/description is explicitly analyst supplied; no OCR/transcription was performed.','No independent detection accuracy or maliciousness conclusion.']};
fs.writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx'});console.log({output,id:inv.id,pathLinks:result.supportedPath.length,counts:inv.correlation.counts});
