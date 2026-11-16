import fs from 'node:fs';
import {runCampaign} from '../../server/campaignRunner';
import {loadDataset,emptyConfusion,observe,metrics,sha256,matchEpisodeBoundaries} from './dataset';
const [output,manifestFile,registryFile]=process.argv.slice(2);
if(!output||fs.existsSync(output))throw new Error('New output path required');
if(!!manifestFile!==!!registryFile)throw new Error('Provide both manifest and rights registry');
const unavailable={precision:null,recall:null,f1:null,falsePositiveRate:null,falseNegativeRate:null,confidenceIntervals:null};
const results:any[]=[];let provenance:any=null;
if(manifestFile&&registryFile){
  const dataset=loadDataset(manifestFile,registryFile);
  provenance={manifestSha256:dataset.manifestSha256,registrySha256:dataset.registrySha256,id:dataset.manifest.id,version:dataset.manifest.datasetVersion,config:dataset.manifest.config};
  for(const campaign of dataset.campaigns.filter(c=>c.split==='development')){
    const r=await runCampaign({datasetName:campaign.id,rows:campaign.rows,isSimulated:false,coverage:campaign.coverage,config:dataset.manifest.config});
    const association=emptyConfusion(),recurrence=emptyConfusion();let excludedUncertain=0,recurrenceAbstentions=0,episodeCounts={tp:0,fp:0,fn:0},annotatedEpisodePairs=0;
    for(const pair of campaign.pairs){
      const predicted=r.episodeEvidence!.associations.find(a=>JSON.stringify([a.source,a.target].sort())===JSON.stringify([...pair.accounts].sort()));
      observe(association,pair.association.label,!!predicted);
      if(['uncertain','unavailable'].includes(pair.association.label))excludedUncertain++;
      if(pair.recurrence){
        const pairPosts=r.episodeEvidence!.posts.filter(p=>pair.accounts.includes(p.accountId));
        const canAssess=!r.truncated&&r.episodeEvidence!.coverageComplete&&pairPosts.every(p=>p.postId&&p.resolutionMs<=1000);
        if(canAssess)observe(recurrence,pair.recurrence.label,!!predicted?.recurrenceEligible);
        else recurrenceAbstentions++;
      }
      if(pair.episodes&&pair.episodeProtocol&&pair.episodeToleranceMs!==undefined){
        annotatedEpisodePairs++;
        const episodes=r.episodeEvidence!.episodes.filter(e=>predicted?.episodeIds.includes(e.id));
        const matched=matchEpisodeBoundaries(pair.episodes as {start:string;end:string}[],episodes,pair.episodeToleranceMs);
        episodeCounts.tp+=matched.tp;episodeCounts.fp+=matched.fp;episodeCounts.fn+=matched.fn;
      }
    }
    results.push({campaign:campaign.id,language:campaign.language,category:campaign.category,sourceGroup:campaign.sourceGroup,truncated:r.truncated,coverageComplete:r.episodeEvidence!.coverageComplete,
      association:r.truncated?{...unavailable,reason:'Truncated processing'}:metrics(association),recurrence:r.truncated?{...unavailable,reason:'Truncated processing'}:metrics(recurrence),
      episodes:annotatedEpisodePairs&&!r.truncated?{...episodeCounts,annotatedEpisodePairs}:null,excludedUncertain,reviewedPairs:campaign.pairs.length,
      recurrenceAbstentions,campaignDecision:'abstain',coordinationTruth:campaign.coordination.label,maliciousIntentTruth:campaign.maliciousIntent.label});
  }
}
const report={scope:'independent_development_evaluation_only',provenance,independentCampaigns:results.length,results,aggregate:unavailable,
  aggregateReason:results.length?'Inspect conditional reviewed-pair counts per campaign; no population or cross-source pooled accuracy is inferred.':'No admitted independent corpus. All detection metrics unavailable.',
  campaign:{...unavailable,abstentions:results.length,coverage:results.length?0:null,reason:'Engine emits observations, not calibrated coordination or maliciousness verdicts.'},
  confidenceIntervalReason:'No admitted independent sampling frame or prespecified group-bootstrap protocol. Pair-level binomial intervals would ignore correlated accounts/campaigns.',
  config:{algorithm:'episodes_v1',windowSeconds:120,minSamples:3,threshold:0.65,seed:0,semanticAdmission:false},
  codeSha256:Object.fromEntries(['server/campaignEpisodes.ts','server/densityCampaign.ts','test/engine3/dataset.ts','test/engine3/evaluate.ts'].map(p=>[p,sha256(fs.readFileSync(p))])),
  limitations:['Authored controls are never loaded by this command.','Conditional metrics apply only to explicitly reviewed pairs; unlabelled pairs are not negatives.','Final test files are locked. Train files are validated for leakage but not used to fit thresholds.','Episode boundaries require independent prespecified tolerance annotations.']};
fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});console.log({output,independentCampaigns:results.length});
