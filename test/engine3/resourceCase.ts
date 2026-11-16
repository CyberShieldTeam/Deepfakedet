import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {analyzeEpisodeCampaign,prepareCampaignPosts} from '../../server/campaignEpisodes';
import {analyzeDensityCampaignBaseline,CampaignTelemetry} from '../../server/densityCampaign';
import {workload,coverage,workloadNames} from './workloads';
import {sha256} from './dataset';
import type {CampaignAnalysisResult} from '../../src/types';
const [output,name,countText,algorithm='episodes']=process.argv.slice(2),count=Number(countText);
if(!output||fs.existsSync(output))throw new Error('New output required');
if(![1000,3000,5000,10000].includes(count))throw new Error('Unsupported resource size');
if(!workloadNames.includes(name as any)||!['baseline','episodes'].includes(algorithm))throw new Error('Unknown workload or algorithm');
const rows=workload(name,count),inputHash=sha256(JSON.stringify(rows)),start=performance.now();
let report:any={scope:'authored_resource_control_not_accuracy',name,count,algorithm,inputHash};
try {
  if(count>3000)prepareCampaignPosts(rows); // Exercise the production guard, never bypass it.
  let telemetry:CampaignTelemetry;
  const r=algorithm==='baseline'?analyzeDensityCampaignBaseline(name,rows,true,{},null,undefined,t=>telemetry=t):analyzeEpisodeCampaign(name,rows,true,{},null,name==='incomplete_coverage'?{...coverage,complete:false}:coverage);
  const wallMs=performance.now()-start;
  const stable=(r:CampaignAnalysisResult)=>sha256(JSON.stringify({edges:r.edges,posts:r.episodeEvidence?.posts.map(({inputRows,...p})=>p),episodes:r.episodeEvidence?.episodes,associations:r.episodeEvidence?.associations}));
  const repeat=algorithm==='baseline'?analyzeDensityCampaignBaseline(name,rows,true):analyzeEpisodeCampaign(name,[...rows].reverse(),true,{},null,name==='incomplete_coverage'?{...coverage,complete:false}:coverage);
  report={...report,status:'completed',wallMs,stages:r.episodeEvidence?.timing??null,baselineTelemetry:r.episodeEvidence?.baselineTelemetry??telemetry!,candidatePairs:r.candidatePairs,truncated:r.truncated,
    truncatedPairCount:null,truncatedPairCountReason:'Posting-list eviction and candidate caps prevent enumeration of all omitted raw pairs.',omittedWitnesses:r.episodeEvidence?.omittedWitnesses??null,omittedAssociations:r.episodeEvidence?.omittedAssociations??null,
    episodes:r.episodeEvidence?.episodes.length??null,associations:r.edges.length,stabilityCheck:algorithm==='baseline'?'same_input_repeat':'reversed_input',stable:stable(r)===stable(repeat)};
}catch(error){report={...report,status:count>3000?'rejected_input_cap':'invalid_input',error:error instanceof Error?error.message:String(error),wallMs:performance.now()-start};}
fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});
