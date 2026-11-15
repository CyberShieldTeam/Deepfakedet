import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {analyzeDensityCampaignBaseline} from '../server/densityCampaign';
import {analyzeEpisodeCampaign} from '../server/campaignEpisodes';
import {episodeControls,coverage} from './fixtures/campaign/episodeControls';
const [output,scenario='controls',algorithm='episodes']=process.argv.slice(2);
if(!output||fs.existsSync(output))throw new Error('New output path required');
const hash=(p:string)=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const run=(name:string,rows:any[],baseline:boolean)=>{
 const rssBefore=process.memoryUsage().rss,start=performance.now();
 const r=baseline?analyzeDensityCampaignBaseline(name,rows,false):analyzeEpisodeCampaign(name,rows,false,{},null,coverage);
 return {algorithm:baseline?'density_baseline_v1':'episodes_v1',inputPosts:rows.length,posts:r.totalPosts,accounts:r.totalAccounts,
  candidatePairs:r.candidatePairs,associations:r.edges.length,communities:r.clusters.length,truncated:r.truncated,
  legacySuspiciousAccounts:r.nodes.filter(n=>n.suspicious).length,classification:r.classification,
  episodes:r.episodeEvidence?.episodes.length??null,recurrenceEligiblePairs:r.episodeEvidence?.associations.filter(a=>a.recurrenceEligible).length??null,
  separatedEpisodes:r.episodeEvidence?.associations.map(a=>a.separatedEpisodeCount)??null,
  wallMs:performance.now()-start,rssBeforeBytes:rssBefore,rssAfterBytes:process.memoryUsage().rss,
  stageTimings:r.episodeEvidence?.timing??null,evidence:scenario==='controls'?r.episodeEvidence:undefined};
};
let results;
if(scenario==='controls')results=episodeControls.map(c=>({name:c.name,expected:c.expected,baseline:run(c.name,c.rows,true),episodes:run(c.name,c.rows,false)}));
else {
 if(!['dense3000','sparse3000'].includes(scenario)||!['baseline','episodes'].includes(algorithm))throw new Error('Unknown bounded scenario');
 const rows=Array.from({length:3000},(_,i)=>({account_id:`account-${i}`,post_id:`post-${i}`,timestamp:new Date(Date.UTC(2026,0,1)+(scenario==='sparse3000'?i*1000000:0)).toISOString(),
  content:scenario==='dense3000'?'Identical fictional public bulletin for bounded resource testing.':`Independent fictional input row token${i}`,url:'https://example.org/public'}));
 results=[run(scenario,rows,algorithm==='baseline')];
}
const report={scope:'authored_campaign_software_controls_not_detection_accuracy',scenario,results,
 code:Object.fromEntries(['server/campaignEpisodes.ts','server/densityCampaign.ts','test/fixtures/campaign/episodeControls.ts','test/evaluateCampaignEpisodes.ts'].map(p=>[p,hash(p)])),
 protocolSha256:hash('docs/CAMPAIGN_EPISODE_PROTOCOL_V1.md'),independentCampaigns:0,precision:null,recall:null,f1:null,auroc:null,
 limits:{inputPosts:3000,candidatePairs:200000,postingList:80,evidencePairs:5000,witnesses:20000},
 limitations:['Fictional contexts/expected observations, not independent campaign/account labels.','Control comparisons run baseline first; GC/host/cache effects limit latency conclusions.',
 'RSS snapshots are not algorithm-isolated peak memory. Resource scenarios use separate child processes and external sampling.','Separated episodes do not prove independent real events, truth, common control or maliciousness.']};
fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({output,scenario,records:results.length}));
