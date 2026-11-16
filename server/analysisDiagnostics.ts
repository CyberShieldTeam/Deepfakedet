import {randomUUID} from 'node:crypto';
import type {AnalysisDiagnostics,AnalysisStage,AnalysisState,ForensicAnalysisResult,ClaimVerificationResult,CampaignAnalysisResult} from '../src/types';
export function diagnosticError(error:unknown){
  const name=error instanceof Error?error.name:'';
  return /timeout|abort/i.test(name)?'TIMEOUT_OR_INTERRUPTED':'DEPENDENCY_FAILED';
}
export function diagnostics(engine:AnalysisDiagnostics['engine'],state:AnalysisState,counts:Record<string,number>,stages:AnalysisStage[],summary:string,elapsedMs:number|null,filteringReasons:string[]=[]):AnalysisDiagnostics{
  return {id:randomUUID(),engine,state,inputValidation:'valid',completeness:state==='PARTIAL_ANALYSIS'?'partial':state==='ANALYSIS_UNAVAILABLE'?'not_performed':state==='ANALYSIS_FAILED'?'failed':'complete',
    evidenceCount:counts.evidenceItems??0,counts,stages,filteringReasons,errorCategory:stages.find(s=>s.errorCategory)?.errorCategory??null,elapsedMs:elapsedMs==null?null:Math.max(0,elapsedMs),summary};
}
export function mediaDiagnostics(r:ForensicAnalysisResult,stages:AnalysisStage[],elapsedMs:number){
  const clientMeasurements=Object.values(r.measurements??{}).filter(v=>typeof v==='number'&&Number.isFinite(v)).length;
  const frames=r.localVideo?.frames.length??r.sampledFrames?.filter(f=>f.status==='available').length??0;
  const segments=r.localAudio?.segments.length??r.localVideo?.audioTrack?.evidence?.segments.length??r.audioSegments?.length??0;
  const imageSignalMeasurements=r.imageDiagnostics?.signals.status==='measured'?['high_frequency_energy_fraction','noise_residual_std','laplacian_variance'].filter(k=>Number.isFinite(r.imageDiagnostics!.signals[k])).length:0;
  const rawClassifierOutputs=(r.localImage?.fake_probability!=null?1:0)+(r.aiGeneratedProbability!=null?1:0);
  const evidenceItems=clientMeasurements+frames+segments+imageSignalMeasurements+rawClassifierOutputs;
  const modelRan=rawClassifierOutputs>0||segments>0||r.inference?.status==='available'||!!r.localVideo?.frames.some(f=>f.image.model_status==='ready');
  const failed=stages.some(s=>s.status==='failed'),missing=stages.some(s=>['unavailable','unconfigured'].includes(s.status)&&!(modelRan&&s.status==='unconfigured'&&(s.stage.startsWith('dedicated_classifier')||s.stage==='local_evidence_service')));
  const state:AnalysisState=failed||missing?(evidenceItems?'PARTIAL_ANALYSIS':failed?'ANALYSIS_FAILED':'ANALYSIS_UNAVAILABLE'):'INSUFFICIENT_EVIDENCE';
  const summary=state==='ANALYSIS_FAILED'?'Media analysis failed; no successful forensic result is available.':state==='ANALYSIS_UNAVAILABLE'?'Media analysis is unavailable; no configured analysis produced evidence.':
    `${clientMeasurements} client-supplied measurements, ${imageSignalMeasurements} server image measurements, ${frames} sampled frames and ${segments} scored audio segments retained. ${state==='PARTIAL_ANALYSIS'?'Some analysis stages were unavailable or failed. ':''}Authenticity remains undetermined; measurements and experimental scores are not a validated verdict.`;
  return diagnostics('media',state,{evidenceItems,clientMeasurements,imageSignalMeasurements,sampledFrames:frames,scoredAudioSegments:segments,rawClassifierOutputs},stages,summary,elapsedMs,['Uncalibrated local scores remain separate from authenticity verdicts.','Client measurements are supplied by the browser, not independent server attestation.']);
}
export function claimDiagnostics(r:ClaimVerificationResult,elapsedMs:number){
  const providers=r.retrievalDetails?.providers??[];
  const stages:AnalysisStage[]=providers.map(p=>({stage:p.provider,status:p.status,count:p.retrieved,...(p.status==='unavailable'?{errorCategory:'RETRIEVAL_PROVIDER_FAILED'}:{})}));
  const available=providers.some(p=>p.status==='available'),failed=providers.some(p=>p.status==='unavailable');
  const relevantCandidates=r.retrievalDetails?.candidateCount??r.sources.length,omitted=r.retrievalDetails?.omittedCount??0;
  const reviewed=r.verificationMode==='analyst_reviewed'&&['SUPPORTED','CONTRADICTED','CONFLICTING_EVIDENCE'].includes(r.verificationStatus??'');
  const partial=failed||omitted>0||!!r.claimAnalysis?.truncated;
  const state:AnalysisState=!available&&!r.sources.length?(failed?'ANALYSIS_FAILED':'ANALYSIS_UNAVAILABLE'):partial?'PARTIAL_ANALYSIS':reviewed?'SUFFICIENT_EVIDENCE':r.sources.length?'INSUFFICIENT_EVIDENCE':'NO_RELEVANT_SIGNALS';
  const summary=reviewed?`An identified analyst assessed quoted sources; this is a human evidence assessment, not a truth probability.${partial?' Retrieval or extraction remains partial; the human assessment does not erase that limitation.':''}`:!available&&!r.sources.length?(failed?'Configured evidence retrieval failed; the claim remains unresolved.':'Evidence retrieval is not configured; no external claim verification was performed.'):
    `${r.sources.length} candidate passages retained${omitted?`; ${omitted} omitted by the source cap`:''}. ${r.sources.length?'Relevance candidates require assertion and source-context review; stance is unassessed until reviewed.':'Available retrieval returned no matching passages; this does not make the claim false.'}${partial?' Retrieval or extraction is partial.':''}`;
  const retrieved=providers.reduce((n,p)=>n+p.retrieved,0),duplicates=r.retrievalDetails?.duplicatesRemoved??0;
  return diagnostics('claim',state,{evidenceItems:r.sources.length,retrievedCandidates:retrieved,relevanceCandidates:relevantCandidates,retainedSources:r.sources.length,omittedSources:omitted,duplicatesRemoved:duplicates,filteredCandidates:Math.max(0,retrieved-duplicates-relevantCandidates),supporting:r.supportingCount,contradicting:r.contradictingCount,unassessed:r.sources.filter(s=>!s.review).length},stages,summary,elapsedMs,['Source identity duplicates removed before ranking.','Existing lexical/semantic relevance gate retained; similarity does not establish stance.','At most eight ranked candidates retained; omission blocks decisive review.']);
}
export function networkDiagnostics(r:CampaignAnalysisResult,importedPosts:number,elapsedMs:number){
  const e=r.episodeEvidence,associations=r.edges.length,episodes=e?.episodes.length??0,eligible=e?.associations.filter(a=>a.recurrenceEligible).length??0;
  const state:AnalysisState=r.truncated?'PARTIAL_ANALYSIS':associations?'INSUFFICIENT_EVIDENCE':'NO_RELEVANT_SIGNALS';
  return diagnostics('network',state,{evidenceItems:associations,importedPosts,validUniquePosts:r.totalPosts,duplicatesRemoved:e?.duplicatesRemoved??0,candidatePairs:r.candidatePairs??0,associations,episodes,recurrenceReviewPairs:eligible,omittedWitnesses:e?.omittedWitnesses??0},[
    {stage:'input_validation_and_normalization',status:'available',count:r.totalPosts},{stage:'candidate_comparison',status:'available',count:r.candidatePairs??0},{stage:'association_and_episode_construction',status:'available',count:associations},
    {stage:'semantic_diagnostics',status:r.embeddingCompatibility?.status==='available'?'available':'unavailable'},
  ],`${associations} observed relationships, ${episodes} pair episodes and ${eligible} pairs eligible for recurrence review. ${r.truncated?'Processing was truncated; recurrence eligibility is disabled. ':''}${!e?.coverageComplete?'Observation coverage is incomplete or unknown. ':''}These observations do not establish malicious intent or common control.`,elapsedMs,['Existing content, URL/hashtag, time and weighted-score gates unchanged.','Exact rejected-pair reason counts are not instrumented; none are invented.','Semantic diagnostics never determine association admission.',...(e?.warnings??[])]);
}
/** Privacy-conscious event: never log content, URLs, filenames, provider detail or credentials. */
export function logAnalysis(a:AnalysisDiagnostics){console.info(JSON.stringify({event:'analysis_diagnostic',analysisId:a.id,engine:a.engine,stage:'completed',inputValidation:a.inputValidation,state:a.state,completeness:a.completeness,evidenceCount:a.evidenceCount,errorCategory:a.errorCategory,elapsedMs:a.elapsedMs,stages:a.stages.map(s=>({stage:s.stage,status:s.status,count:s.count,errorCategory:s.errorCategory}))}));}
export function engineForPath(path:string):AnalysisDiagnostics['engine']|undefined{return path==='/api/forensics/analyze-media'?'media':path==='/api/claims/verify'||path==='/api/claims/review'?'claim':path==='/api/campaigns/analyze'?'network':undefined;}
export function failedDiagnostic(engine:AnalysisDiagnostics['engine'],category:string,elapsedMs:number|null=null,invalid=false){
  const a=diagnostics(engine,'ANALYSIS_FAILED',{evidenceItems:0},[{stage:invalid?'input_validation':'analysis_execution',status:'failed',errorCategory:category}],invalid?'Input validation failed; no new analysis completed.':'Analysis could not complete. No complete result or verdict was produced.',elapsedMs);
  if(invalid)a.inputValidation='invalid';return a;
}
