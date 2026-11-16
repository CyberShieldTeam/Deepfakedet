import fs from 'node:fs';
import {engine4Fixture} from './engine4Fixtures';
import {projectInvestigation,buildCorrelation,correlationHash} from '../server/correlation';
import {runCorrelation} from '../server/correlationRunner';
const [output,scenario='small']=process.argv.slice(2);if(!output||fs.existsSync(output))throw new Error('New output required');
const count=({small:12,medium:500,dense:3000,partial:500} as Record<string,number>)[scenario];if(!count)throw new Error('Unknown bounded workload');
const input=projectInvestigation(engine4Fixture());const proto=input.network!.posts[0];
input.network!.posts=Array.from({length:count},(_,i)=>{const timestamp=new Date(Date.UTC(2026,0,1)+i*1000).toISOString();return {...proto,reference:`authored:${i}`,postId:`post-${i}`,accountId:scenario==='dense'?`account-${i}`:`account-${i%20}`,timestamp,originalTimestamp:timestamp,latestPossibleTimestamp:new Date(Date.parse(timestamp)+999).toISOString()};});
input.network!.episodes=[];input.network!.associations=[];input.totals.posts=count;input.totals.episodes=0;input.totals.relationships=0;
if(scenario==='partial'){input.network!.coverageComplete=false;input.media[0].status='ANALYSIS_FAILED';}
const preview=buildCorrelation(input),context={id:'authored-profile-context',mediaId:preview.nodes.find(n=>n.type==='media_asset')!.id,claimId:preview.nodes.find(n=>n.type==='claim')!.id,kind:'user_caption' as const,text:input.claims[0].text,rationale:'Authored resource control only',providedBy:'fixture',providedAt:'2026-01-01T00:00:00Z'};
const start=performance.now(),graph=await runCorrelation(input,[context]),workerWallMs=performance.now()-start;
const again=await runCorrelation(input,[context]);
const stable=(g:typeof graph)=>correlationHash([g.nodes,g.relationships,g.timeline,g.counts,g.state]);
if(stable(graph)!==stable(again))throw new Error('Unstable correlation output');
fs.writeFileSync(output,JSON.stringify({scope:'authored_engine4_resource_control_not_accuracy',scenario,inputPosts:count,inputHash:correlationHash(input),workerWallMs,correlationMs:graph.elapsedMs,counts:graph.counts,state:graph.state,truncated:graph.truncated,stable:true,graph:scenario==='small'?graph:undefined},null,2),{flag:'wx'});console.log({output,scenario,counts:graph.counts,correlationMs:graph.elapsedMs});
