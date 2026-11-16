export type EvidenceEngine='investigation'|'media'|'claim'|'network'|'analyst';
export type EvidenceType='investigation'|'media_asset'|'media_observation'|'claim'|'claim_assessment'|'source'|'post'|'account'|'url'|'hashtag'|'episode'|'network_relationship'|'extracted_text'|'claim_candidate'|'extraction_review';
export interface EvidenceTime {kind:'publication'|'retrieved'|'analysis'|'ingestion'|'episode_start'|'episode_end';original:string;utc:string|null;resolutionMs:number|null}
export interface EvidenceNode {id:string;investigationId:string;type:EvidenceType;engines:EvidenceEngine[];label:string;references:string[];times:EvidenceTime[];statuses:string[];limitations:string[];metadata:Record<string,unknown>}
export type RelationshipType='HAS_OBSERVATION'|'ASSESSES_CLAIM'|'SOURCE_RETRIEVED_FOR_CLAIM'|'SOURCE_ADDRESSES_CLAIM'|'POST_CONTAINS_CLAIM'|'SHARED_CANONICAL_URL'|'REFERENCES_URL'|'SHARED_HASHTAG'|'AUTHORED_BY'|'PART_OF_EPISODE'|'NETWORK_ASSOCIATION'|'MEDIA_CONTEXT_CLAIM'|'POST_REFERENCES_MEDIA'|'MEDIA_CONTAINS_TEXT'|'TEXT_PROPOSES_CLAIM'|'CLAIM_REVIEWED_FROM_TEXT'|'CLAIM_INVESTIGATED_BY_ENGINE2';
export interface EvidenceRelationship {id:string;source:string;target:string;type:RelationshipType;strength:'exact_reference'|'literal_mention'|'analyst_asserted'|'contextual';crossEngine:boolean;method:string;support:string[];measurements:Record<string,unknown>;explanation:string;limitations:string[]}
export interface MediaContextInput {mediaId:string;claimId:string;kind:'user_caption'|'user_description';text:string;rationale:string;mediaUrl?:string}
export interface MediaContext extends MediaContextInput {id:string;providedBy:string;providedAt:string}
export interface CorrelationResult {
 schemaVersion:1;policy:'correlation_v1';investigationId:string;inputFingerprint:string;
 state:'CORRELATED_EVIDENCE_AVAILABLE'|'PARTIAL_CORRELATION'|'NO_SUPPORTED_CROSS_ENGINE_LINKS'|'CORRELATION_UNAVAILABLE';
 nodes:EvidenceNode[];relationships:EvidenceRelationship[];timeline:{id:string;nodeId:string;time:EvidenceTime}[];
 limitations:string[];missingEvidence:string[];contradictions:{claimId:string;sourceIds:string[]}[];
 truncated:boolean;limits:{nodes:number;relationships:number;comparisons:number;timeline:number};
 counts:{nodes:number;relationships:number;crossEngineLinks:number;candidateComparisons:number;omittedNodes:number;omittedRelationships:number;omittedTimelineEntries:number};
 generatedAt:string;elapsedMs:number;
}
export interface CorrelationRun {status:'current'|'stale'|'failed';at:string;errorCategory?:string}
