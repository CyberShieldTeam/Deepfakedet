import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {analyzeEpisodeCampaign} from '../../server/campaignEpisodes';
import {analyzeDensityCampaignBaseline} from '../../server/densityCampaign';
import {legitimateControls} from './workloads';
import {sha256} from './dataset';
const output=process.argv[2];if(!output||fs.existsSync(output))throw new Error('New output required');
const results=legitimateControls.map(c=>{
  const before=analyzeDensityCampaignBaseline(c.name,c.rows,true),start=performance.now();
  const after=analyzeEpisodeCampaign(c.name,c.rows,true,{},null,c.coverage),e=after.episodeEvidence!;
  const actual={recurrenceEligiblePairs:e.associations.filter(a=>a.recurrenceEligible).length,maliciousAccounts:after.nodes.filter(n=>n.suspicious).length};
  assert.deepEqual(actual,{recurrenceEligiblePairs:c.expected.recurrenceEligiblePairs,maliciousAccounts:c.expected.maliciousAccounts});
  assert.equal(after.overallCoordinationIndex,null);assert.equal(after.classification,'Insufficient evidence');
  return {name:c.name,inputHash:sha256(JSON.stringify(c.rows)),posts:c.rows.length,expected:c.expected,actual,legacyFlaggedAccounts:before.nodes.filter(n=>n.suspicious).length,episodes:e.episodes.length,coverageComplete:e.coverageComplete,truncated:after.truncated,wallMs:performance.now()-start};
});
fs.writeFileSync(output,JSON.stringify({scope:'authored_software_controls_not_independent_accuracy',results,independentCampaigns:0,precision:null,recall:null,f1:null,falsePositiveRate:null,config:{threshold:0.65,windowSeconds:120,minSamples:3,semanticAdmission:false}},null,2),{flag:'wx'});
console.log({controlsPassed:results.length,output});
