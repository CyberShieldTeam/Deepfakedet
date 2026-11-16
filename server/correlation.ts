import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {timestampEvidence} from './campaignEpisodes';
import type {Investigation} from '../src/types';
import type {CorrelationResult,EvidenceNode,EvidenceRelationship,EvidenceEngine,EvidenceType,EvidenceTime,MediaContext,RelationshipType} from '../src/correlationTypes';
export const CORRELATION_LIMITS={nodes:5000,relationships:10000,comparisons:20000,timeline:1000} as const;
export const correlationHash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const canonicalText=(s:string)=>s.normalize('NFC').trim().replace(/\s+/gu,' ');
export function canonicalUrl(s:unknown):string|null {
 if(typeof s!=='string'||s.length>3000)return null;
 try{const u=new URL(s);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;u.hash='';return u.toString();}catch{return null;}
}
export function evidenceTime(kind:EvidenceTime['kind'],value:unknown):EvidenceTime[] {
 if(typeof value!=='string'||!value)return [];
 try{const t=timestampEvidence(value);return [{kind,original:value,utc:t.timestamp,resolutionMs:t.resolutionMs}];}
 catch{return [{kind,original:value,utc:null,resolutionMs:null}];}
}
/** Allowlist projection: no thumbnails, base64 media, tokens, owner credentials or repeated full engine output. */
export function projectInvestigation(inv:Investigation){
 const media=(inv.mediaFindings?.length?inv.mediaFindings:inv.forensicResult?[inv.forensicResult]:[]);
 const claims=(inv.claimResults?.length?inv.claimResults:inv.claimResult?[inv.claimResult]:[]);
 const e=inv.campaignResult?.episodeEvidence;
 return {id:inv.id,createdAt:inv.createdAt,isSimulated:!!inv.isSimulatedDemo,
  extractions:(inv.extractions??[]).slice(0,20),
  totals:{media:media.length,claims:claims.length,posts:e?.posts.length??0,episodes:e?.episodes.length??0,relationships:e?.associations.length??0},
  media:media.slice(0,32).map((m,i)=>({ref:inv.mediaFindings?.length?`/mediaFindings/${i}`:'/forensicResult',key:m.analysis?.id??correlationHash([m.fileName,m.analyzedAt,m.measurements,m.localImage?.revision,m.localImage?.fake_probability,m.localAudio?.segments]),name:m.fileName??m.modality,modality:m.modality,submittedMedia:m.submittedMedia,declaredHash:m.measurements?.sourceSha256,status:m.analysis?.state??m.inference?.status??'legacy_status_not_recorded',time:m.analyzedAt,limitations:m.limitations.slice(0,30),observations:{measurements:Object.fromEntries(Object.entries(m.measurements??{}).filter(([k,v])=>typeof v==='number'||typeof v==='boolean'||['sourceSha256','analysisInput','format'].includes(k)).slice(0,64)),diagnosticCounts:m.analysis?.counts??{},errorCategory:m.analysis?.errorCategory??null,authenticity:m.authenticity,wholeImageModel:m.localImage?.model_status,rawUncalibratedImageScore:m.localImage?.fake_probability,faceModel:m.localImage?.face_manipulation?.status,rawUncalibratedFaceScores:m.localImage?.face_manipulation?.faces,rawUncalibratedAudioSegments:m.localAudio?.segments.slice(0,8),audioSegments:m.localAudio?.segments.length,videoFrames:m.localVideo?.frames.length,frameObservations:m.localVideo?.frames.slice(0,16).map(f=>({timestampSeconds:f.timestampSeconds,modelStatus:f.image.model_status,rawUncalibratedScore:f.image.fake_probability,quality:f.quality,temporal:f.temporal}))}})),
  claims:claims.slice(0,32).map((c,i)=>({ref:inv.claimResults?.length?`/claimResults/${i}`:'/claimResult',key:c.analysis?.id??correlationHash([c.normalizedClaim??c.targetClaim,c.timestamp,c.sources]),text:c.normalizedClaim??c.targetClaim,time:c.timestamp,status:c.analysis?.state??c.verificationStatus??'legacy_status_not_recorded',verdict:c.verdict,limitations:c.limitations.slice(0,30),missing:c.missingEvidence??[],omitted:c.retrievalDetails?.omittedCount??0,sources:c.sources.slice(0,8),origin:c.extractionOrigin})),
  network:inv.campaignResult?{status:inv.campaignResult.analysis?.state??'legacy_status_not_recorded',truncated:!!inv.campaignResult.truncated,coverage:e?.coverage??null,coverageComplete:e?.coverageComplete??false,warnings:e?.warnings??[],posts:e?.posts.slice(0,3000)??[],episodes:e?.episodes.slice(0,1000)??[],associations:e?.associations.slice(0,1000)??[],hasPostLedger:!!e}:null};
}
export type CorrelationProjection=ReturnType<typeof projectInvestigation>;
export function correlationFingerprint(input:CorrelationProjection,contexts:MediaContext[]){return correlationHash([input,contexts]);}
export function buildCorrelation(input:CorrelationProjection,contexts:MediaContext[]=[]):CorrelationResult {
 const started=performance.now(),limits={...CORRELATION_LIMITS};
 const nodes=new Map<string,EvidenceNode>(),edges=new Map<string,EvidenceRelationship>(),referenceSets=new Map<string,Set<string>>(),omittedNodeIds=new Set<string>(),omittedEdgeIds=new Set<string>();let comparisons=0,truncated=false,upstreamPartial=false;
 const notes=new Set<string>(['Evidence relationships indicate observed associations and do not independently establish misinformation, manipulation, or malicious coordination.','No calibrated correlation probability or global verdict is computed.','Literal mentions do not establish agreement, quotation context, truth or endorsement.']);
 const missing=new Set<string>(),contradictions:CorrelationResult['contradictions']=[];
 const id=(type:string,key:unknown)=>`${type}:${correlationHash([input.id,type,key]).slice(0,32)}`;
 const add=(type:EvidenceType,key:unknown,engine:EvidenceEngine,label:string,ref:string,metadata:Record<string,unknown>={},times:EvidenceTime[]=[],statuses:string[]=[],limitations:string[]=[])=>{
  const keyId=id(type,key),old=nodes.get(keyId);
  if(old){old.engines=[...new Set([...old.engines,engine])].sort();referenceSets.get(keyId)!.add(ref);old.statuses=[...new Set([...old.statuses,...statuses])].sort();old.limitations=[...new Set([...old.limitations,...limitations])].sort();old.times=[...new Map([...old.times,...times].map(t=>[JSON.stringify(t),t])).values()];return keyId;}
  if(nodes.size>=limits.nodes){omittedNodeIds.add(keyId);truncated=true;return null;}
  referenceSets.set(keyId,new Set([ref]));
  nodes.set(keyId,{id:keyId,investigationId:input.id,type,engines:[engine],label:label.slice(0,300),references:[ref],times,statuses,limitations,metadata});return keyId;
 };
 const link=(source:string|null,target:string|null,type:RelationshipType,method:string,support:string[],measurements:Record<string,unknown>={},strength:EvidenceRelationship['strength']='exact_reference',crossEngine=false,limitations:string[]=[])=>{
  if(!source||!target)return;
  const edgeId=id('link',[source,target,type,method,measurements]);if(edges.has(edgeId)){const edge=edges.get(edgeId)!;edge.support=[...new Set([...edge.support,...support])].sort();return;}
  if(edges.size>=limits.relationships){omittedEdgeIds.add(edgeId);truncated=true;return;}
  edges.set(edgeId,{id:edgeId,source,target,type,strength,crossEngine,method,support:[...new Set(support)].sort(),measurements,explanation:`${type.replaceAll('_',' ')}: ${method}.`,limitations});
 };
 add('investigation',input.id,'investigation','Investigation',`/id`,{simulated:input.isSimulated},evidenceTime('ingestion',input.createdAt));
 const mediaIds=new Set<string>(),claimTexts=new Map<string,string>(),sourceUrls=new Map<string,{id:string;ref:string}[]>();
 const mediaHashes=new Map<string,string>(),assessments=new Map<string,string>();
 const stances=new Map<string,{supports:Set<string>;contradicts:Set<string>}>();
 const putUrl=(raw:unknown,engine:EvidenceEngine,ref:string)=>{const url=canonicalUrl(raw);return url?{url,id:add('url',url,engine,url,ref,{canonicalUrl:url},[],[],['URL equality is not proof of document or media byte identity. Query strings are preserved; fragments omitted.'])}:null;};
 for(const m of input.media){
  const digest=m.submittedMedia?.computedBy==='server'&&/^[a-f0-9]{64}$/.test(m.submittedMedia.sha256)?m.submittedMedia:null;
  const asset=add('media_asset',digest?['submitted_bytes',digest.sha256]:['record',m.key],'media',m.name,m.ref,{submittedMedia:digest,clientDeclaredHash:m.declaredHash,identityBasis:digest?'server_received_bytes':'analysis_record_only'},[],[m.status],digest?['Byte equality applies only to bytes actually submitted, not publication provenance or authenticity.']:['No server-computed submitted-byte digest; client declarations/filenames do not establish identity.']);
  if(asset)mediaIds.add(asset);
  if(asset&&digest)mediaHashes.set(digest.sha256,asset);
  const observation=add('media_observation',m.key,'media',`${m.modality} observations`,m.ref,m.observations,evidenceTime('analysis',m.time),[m.status],m.limitations);
  link(asset,observation,'HAS_OBSERVATION','attached engine result',[m.ref]);
  if(['PARTIAL_ANALYSIS','ANALYSIS_FAILED','ANALYSIS_UNAVAILABLE','partial','failed','unavailable'].includes(m.status)){upstreamPartial=true;missing.add(`Media analysis ${m.key}: ${m.status}; inspect its retained limitations.`);}
 }
 for(const c of input.claims){
  const text=canonicalText(c.text),claim=add('claim',text,'claim',text,c.ref,{text},[],[c.status],c.limitations);
  if(claim)claimTexts.set(claim,text);
  const assessment=add('claim_assessment',c.key,'claim',c.verdict,c.ref,{verdict:c.verdict},evidenceTime('analysis',c.time),[c.status],c.limitations);
  link(assessment,claim,'ASSESSES_CLAIM','attached claim assessment; not a new verdict',[c.ref]);
  if(assessment)assessments.set(c.key,assessment);
  for(const reason of c.missing)missing.add(reason);
  const supporting:string[]=[],opposing:string[]=[];
  c.sources.forEach((s,i)=>{
   const ref=`${c.ref}/sources/${i}`,url=canonicalUrl(s.url);if(!url)return;
   // Different excerpts/reviews at one URL remain distinct source evidence records.
   const source=add('source',[c.key,s.id??i,url,s.excerpt,s.review??null],'claim',s.title,ref,{url,sourceId:s.id??null,excerpt:s.excerpt,stance:s.stance,review:s.review??null,provider:s.provider??null},[...evidenceTime('publication',s.publishDate),...evidenceTime('retrieved',s.retrievedAt)],[],['Retrieval/relevance is not independent source credibility or entailment.']);
   const reviewed=!!s.review?.contextConfirmed;
   link(source,claim,reviewed?'SOURCE_ADDRESSES_CLAIM':'SOURCE_RETRIEVED_FOR_CLAIM',reviewed?'existing attributed exact-quote/context review':'existing relevance candidate; stance unassessed',[ref],{stance:s.stance,reviewed,sourceId:s.id??null},reviewed?'exact_reference':'contextual',false,['No source credibility or new factual verdict inferred.']);
   if(source&&reviewed&&s.stance==='supports')supporting.push(source);if(source&&reviewed&&s.stance==='contradicts')opposing.push(source);
   const hub=putUrl(url,'claim',ref);if(hub)link(source,hub.id,'REFERENCES_URL','conservative URL normalization',[ref]);
   if(source)sourceUrls.set(url,[...(sourceUrls.get(url)??[]),{id:source,ref}]);
  });
  if(claim){const s=stances.get(claim)??{supports:new Set<string>(),contradicts:new Set<string>()};supporting.forEach(id=>s.supports.add(id));opposing.forEach(id=>s.contradicts.add(id));stances.set(claim,s);}
  if(c.omitted||['PARTIAL_ANALYSIS','ANALYSIS_FAILED','ANALYSIS_UNAVAILABLE','UNAVAILABLE'].includes(c.status)){upstreamPartial=true;missing.add(`Claim assessment ${c.key}: ${c.status}; omitted candidates ${c.omitted}.`);}
 }
 for(const [i,record] of (input.extractions??[]).entries()){
  const media=mediaHashes.get(record.sourceMediaHash);if(!media){missing.add('Extraction source is outside the bounded media projection; no source binding fabricated.');continue;}
  const ref=`/extractions/${i}`,segments=new Map<string,string|null>();
  for(const [j,s] of record.segments.entries()){
   const node=add('extracted_text',[record.id,s.id],'media',s.text,`${ref}/segments/${j}`,{text:s.text,bbox:s.bbox,words:s.words,geometry:record.geometry,method:record.method,modelRevision:record.modelRevision,modelSha256:record.modelSha256,sourceMediaHash:record.sourceMediaHash,recognitionLanguage:record.recognitionLanguage,detectedLanguage:record.detectedLanguage},evidenceTime('analysis',record.extractedAt),[record.state],record.limitations);segments.set(s.id,node);
   link(media,node,'MEDIA_CONTAINS_TEXT','bounded local OCR on hash-matching submitted bytes',[ref,`${ref}/segments/${j}`],{method:record.method,bbox:s.bbox},'exact_reference',false,record.limitations);
  }
  for(const [j,c] of record.candidates.entries()){
   const cref=`${ref}/candidates/${j}`,candidate=add('claim_candidate',c.id,'media',c.originalText,cref,{originalText:c.originalText,start:c.start,end:c.end,category:c.category,method:c.categoryMethod},[],[c.reviews.at(-1)?.state??'pending'],['Unvalidated candidate category; never a factual verdict.']);
   link(segments.get(c.segmentId)??null,candidate,'TEXT_PROPOSES_CLAIM','exact substring of OCR line',[cref],{start:c.start,end:c.end,reviewState:c.reviews.at(-1)?.state??'pending'});
   for(const [k,r] of c.reviews.entries()){
    const rref=`${cref}/reviews/${k}`,review=add('extraction_review',[c.id,r.revision],'analyst',r.reviewedText??r.state,rref,{...r,originalText:c.originalText},evidenceTime('analysis',r.reviewedAt),[r.state],['Review confirms representation of the source, not factual truth.']);
    link(candidate,review,'CLAIM_REVIEWED_FROM_TEXT','authenticated recorded human review',[cref,rref],{reviewState:r.state,revision:r.revision});
    if(k!==c.reviews.length-1||!['accepted','corrected'].includes(r.state))continue;
    for(const assessment of input.claims){const origin=assessment.origin;if(!origin||origin.extractionId!==record.id||origin.candidateId!==c.id||origin.reviewRevision!==r.revision||origin.segmentId!==c.segmentId||origin.mediaHash!==record.sourceMediaHash||origin.reviewedText!==r.reviewedText||canonicalText(assessment.text)!==canonicalText(r.reviewedText??''))continue;
     link(review,assessments.get(assessment.key)??null,'CLAIM_INVESTIGATED_BY_ENGINE2','current accepted/corrected review explicitly investigated by Engine 2',[rref,assessment.ref],{reviewState:r.state,revision:r.revision},'exact_reference',true,['Extraction review does not validate claim truth; Engine 2 safeguards remain applicable.']);
    }
   }
  }
 }
 const postIds=new Map<string,string>(),accountIds=new Map<string,string>(),postUrls=new Map<string,string[]>();
 if(input.network){
  const n=input.network;for(const warning of n.warnings)notes.add(warning);
  if(!n.hasPostLedger||!n.coverageComplete||n.truncated||['PARTIAL_ANALYSIS','ANALYSIS_FAILED','ANALYSIS_UNAVAILABLE'].includes(n.status))upstreamPartial=true;
  if(!n.hasPostLedger)missing.add('Legacy network result has no traceable post ledger; no post-level links fabricated.');
  if(!n.coverageComplete)missing.add('Network observation coverage is incomplete or unknown; missing posts never prove silence.');
  if(n.truncated)missing.add('Network analysis was truncated; recurrence safeguards remain in force.');
  for(const [i,p] of n.posts.entries()){
   const ref=`/campaignResult/episodeEvidence/posts/${i}`;
   const account=add('account',p.accountId,'network',p.accountId,ref,{accountId:p.accountId},[],[],['Account identifiers are dataset-scoped and not independently verified identities.']);if(account)accountIds.set(p.accountId,account);
   const post=add('post',p.reference,'network',p.content,ref,{postId:p.postId,accountId:p.accountId,inputReference:p.reference,text:p.content,resolutionMs:p.resolutionMs,latestPossibleTimestamp:p.latestPossibleTimestamp,sourceMetadata:p.sourceMetadata??null},evidenceTime('publication',p.originalTimestamp).map(t=>({...t,resolutionMs:p.resolutionMs})),[n.status],['Source timestamp precision/coverage limitations remain applicable.']);
   if(!post)continue;postIds.set(p.reference,post);link(post,account,'AUTHORED_BY','account identifier in imported post',[ref]);
   const urls:string[]=[];
   for(const raw of p.urls){const hub=putUrl(raw,'network',ref);if(!hub)continue;urls.push(hub.url);link(post,hub.id,'REFERENCES_URL','conservative URL normalization',[ref]);
    for(const s of sourceUrls.get(hub.url)??[]){if(comparisons>=limits.comparisons){truncated=true;break;}comparisons++;link(post,s.id,'SHARED_CANONICAL_URL','equal normalized HTTP(S) URLs',[ref,s.ref],{url:hub.url},'exact_reference',true,['Equal address, not verified content identity, stance or causal influence.']);}
   }postUrls.set(post,urls);
   for(const tag of p.hashtags){const hub=add('hashtag',tag,'network',tag,ref,{tag});link(post,hub,'SHARED_HASHTAG','identical imported hashtag',[ref],{},'contextual',false,['Common tags do not establish a shared claim or coordination.']);}
   const content=canonicalText(p.content);
   for(const [claim,text] of claimTexts){
    if(comparisons>=limits.comparisons){truncated=true;break;}comparisons++;
    let index=text?content.indexOf(text):-1;
    while(index>=0){const before=index>0?content[index-1]:'',after=content[index+text.length]??'';
      if(!/[\p{L}\p{N}\p{M}]/u.test(before)&&!/[\p{L}\p{N}\p{M}]/u.test(after))break;
      index=content.indexOf(text,index+1);
    }
    if(index>=0)link(post,claim,'POST_CONTAINS_CLAIM','literal NFC/whitespace-normalized span with word boundaries',[ref,...referenceSets.get(claim)!],{spanStart:index,spanEnd:index+text.length,scope:'normalized_text'},'literal_mention',true,['A literal mention may quote or deny a claim; no endorsement, equivalence or truth inferred.']);
   }
  }
  for(const [i,ep] of n.episodes.entries()){
   const ref=`/campaignResult/episodeEvidence/episodes/${i}`,node=add('episode',ep.id,'network',`${ep.source} ↔ ${ep.target}`,ref,{...ep,coverage:n.coverage,coverageComplete:n.coverageComplete},[...evidenceTime('episode_start',ep.start),...evidenceTime('episode_end',ep.end)],[n.status],n.warnings);
   link(accountIds.get(ep.source)??null,node,'PART_OF_EPISODE','existing Engine 3 pair episode membership',[ref],{},'contextual');link(accountIds.get(ep.target)??null,node,'PART_OF_EPISODE','existing Engine 3 pair episode membership',[ref],{},'contextual');
  }
  for(const [i,a] of n.associations.entries()){
   const ref=`/campaignResult/episodeEvidence/associations/${i}`,node=add('network_relationship',a.edgeId,'network',`${a.source} ↔ ${a.target}`,ref,{...a,coverageComplete:n.coverageComplete},[],[n.status],n.warnings);
   link(accountIds.get(a.source)??null,node,'NETWORK_ASSOCIATION','existing Engine 3 observed association',[ref],{},'contextual');link(node,accountIds.get(a.target)??null,'NETWORK_ASSOCIATION','existing Engine 3 observed association',[ref],{},'contextual');
  }
 }
 for(const context of contexts){
  if(!mediaIds.has(context.mediaId)||!claimTexts.has(context.claimId))throw new Error('Context must reference media and claim nodes in this investigation');
  if(!canonicalText(context.text).includes(claimTexts.get(context.claimId)!))throw new Error('Supplied context must contain the complete claim text');
  const proof={kind:context.kind,text:context.text,rationale:context.rationale,providedBy:context.providedBy,providedAt:context.providedAt};
  link(context.mediaId,context.claimId,'MEDIA_CONTEXT_CLAIM','authenticated analyst-supplied context; not extraction',[`/correlationContexts/${context.id}`],proof,'analyst_asserted',true,['Not independently extracted from media; does not verify the caption, claim or media authenticity.']);
  const url=canonicalUrl(context.mediaUrl);
  if(url)for(const [post,urls] of postUrls){if(comparisons>=limits.comparisons){truncated=true;break;}comparisons++;if(urls.includes(url))link(post,context.mediaId,'POST_REFERENCES_MEDIA','post URL equals analyst-documented media URL',[`/correlationContexts/${context.id}`,...nodes.get(post)!.references],{url,providedBy:context.providedBy},'analyst_asserted',true,['Media URL attribution is analyst supplied, not verified byte identity or publication provenance.']);}
 }
 if(input.totals.media>32||input.totals.claims>32||input.totals.episodes>1000||input.totals.relationships>1000){truncated=true;notes.add('Engine adapter caps omitted records; source evidence remains in the investigation.');}
 for(const [claimId,s] of stances)if(s.supports.size&&s.contradicts.size)contradictions.push({claimId,sourceIds:[...s.supports,...s.contradicts].sort()});
 if(!input.media.length)missing.add('No attached media analysis.');if(!input.claims.length)missing.add('No attached claim assessment.');if(!input.network)missing.add('No attached network analysis.');
 if(input.media.length&&input.claims.length&&!contexts.length&&![...edges.values()].some(e=>e.type==='CLAIM_INVESTIGATED_BY_ENGINE2'))missing.add('No documented media/claim binding; no transcript, OCR or caption extraction invented.');
 const orderedNodes=[...nodes.values()].map(n=>({...n,references:[...referenceSets.get(n.id)!].sort()})).sort((a,b)=>a.id.localeCompare(b.id));
 const allTimeline=orderedNodes.flatMap(n=>n.times.filter(t=>t.utc).map(t=>({id:id('time',[n.id,t]),nodeId:n.id,time:t}))).sort((a,b)=>a.time.utc!.localeCompare(b.time.utc!)||a.id.localeCompare(b.id));
 const omittedTimelineEntries=Math.max(0,allTimeline.length-limits.timeline);if(omittedTimelineEntries)truncated=true;
 const crossEngineLinks=[...edges.values()].filter(e=>e.crossEngine).length;
 const partial=truncated||upstreamPartial;
 const state:CorrelationResult['state']=!input.media.length&&!input.claims.length&&!input.network?'CORRELATION_UNAVAILABLE':partial?'PARTIAL_CORRELATION':crossEngineLinks?'CORRELATED_EVIDENCE_AVAILABLE':'NO_SUPPORTED_CROSS_ENGINE_LINKS';
 return {schemaVersion:1,policy:'correlation_v1',investigationId:input.id,inputFingerprint:correlationFingerprint(input,contexts),state,nodes:orderedNodes,relationships:[...edges.values()].sort((a,b)=>a.id.localeCompare(b.id)),timeline:allTimeline.slice(0,limits.timeline),limitations:[...notes].sort(),missingEvidence:[...missing].sort(),contradictions:contradictions.sort((a,b)=>a.claimId.localeCompare(b.claimId)),truncated,limits,counts:{nodes:nodes.size,relationships:edges.size,crossEngineLinks,candidateComparisons:comparisons,omittedNodes:omittedNodeIds.size,omittedRelationships:omittedEdgeIds.size,omittedTimelineEntries},generatedAt:new Date().toISOString(),elapsedMs:performance.now()-started};
}
