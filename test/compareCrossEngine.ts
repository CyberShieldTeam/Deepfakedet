import fs from 'node:fs';import assert from 'node:assert/strict';
const [beforeFile,afterFile,output]=process.argv.slice(2);
if(!output||fs.existsSync(output))throw new Error('New output required');
const before=JSON.parse(fs.readFileSync(beforeFile,'utf8')),after=JSON.parse(fs.readFileSync(afterFile,'utf8'));
const evidence=(value:any)=>value==null?value:JSON.parse(JSON.stringify(value,(key,v)=>key==='processing_ms'?undefined:v));
const results=before.cases.map((b:any)=>{
 const a=after.cases.find((a:any)=>a.name===b.name);assert.ok(a);
 if(b.kind==='media')for(const key of ['localImage','imageDiagnostics','measurements','authenticity','aiGeneratedProbability'])assert.deepEqual(evidence(a.api[key]),evidence(b.api[key]));
 if(b.kind==='claim')for(const key of ['sources','verificationStatus','verdict','supportingEvidence','contradictingEvidence','confidenceScore'])assert.deepEqual(a.api[key],b.api[key]);
 if(b.kind==='campaign'){
  for(const key of ['edges','nodes','classification','overallCoordinationIndex'])assert.deepEqual(a.api[key],b.api[key]);
  for(const key of ['posts','witnesses','episodes','associations','coverage','coverageComplete','warnings'])assert.deepEqual(a.api.episodeEvidence[key],b.api.episodeEvidence[key]);
 }
 assert.ok(a.storedIdentical&&a.reportIdentical);
 return {name:b.name,observationsAndVerdictsPreserved:true,storedAndReportIdentical:true,state:a.api.analysis.state,counts:a.api.analysis.counts,errorCategory:a.api.analysis.errorCategory,beforeRawCounts:b.raw?{associations:b.raw.associations,episodes:b.raw.episodes,sources:b.raw.ranked}:null};
});
fs.writeFileSync(output,JSON.stringify({scope:'authored_frontend_before_after_preservation_not_accuracy',results,comparisonExclusions:['Local response processing_ms wall time; publication and episode timestamps are not excluded.'],modelThresholdRuleChanges:false},null,2),{flag:'wx'});console.log({preservedCases:results.length,output});
