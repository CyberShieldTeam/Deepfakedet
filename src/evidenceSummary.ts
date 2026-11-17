import type {ClaimVerificationResult,GroundedSource} from './types';
/** Deterministic citation index, never a generative factual explanation. */
export interface EvidenceSummary {
  claim:string;
  assessment:string;
  citations:{citationId:string;sourceId:string;url:string;title:string;relationship:'supports'|'contradicts'|'mixed'|'unreviewed';quote:string;quoteTruncated?:boolean;passageSha256?:string}[];
  limitations:string[];
}
export function evidenceSummary(result:ClaimVerificationResult):EvidenceSummary{
  const citations=result.sources.map((source,i)=>{
    const reviewed=!!source.review?.contextConfirmed&&source.review.claim===result.normalizedClaim&&source.excerpt.includes(source.review.quote)&&source.review.quote.length>=12;
    const relationship=reviewed&&source.stance!=='neutral'?source.stance:'unreviewed';
    // Reviewed quotes stay exact; unreviewed snippets are exact contiguous substrings.
    // A period can be an abbreviation (e.g. "lit."). Do not mistake it for a
    // complete explanation. Show a bounded exact preview and label any cut.
    const quote=reviewed?source.review!.quote:source.excerpt.slice(0,600);
    const sourceId=source.id||`legacy-${i+1}`;
    return {citationId:`C${i+1}`,sourceId,url:source.url,title:source.title,relationship,quote,quoteTruncated:!reviewed&&source.excerpt.length>600,passageSha256:source.passageSha256} as EvidenceSummary['citations'][number];
  });
  const count=(value:string)=>citations.filter(c=>c.relationship===value).length;
  return {claim:result.targetClaim,assessment:citations.length?`${citations.length} source passages retained: ${count('supports')} with attributed supporting review, ${count('contradicts')} with attributed contradicting review, ${count('mixed')} with mixed review, and ${count('unreviewed')} awaiting relationship review. ${result.verificationStatus==='INSUFFICIENT_EVIDENCE'?'The claim remains unresolved.':''}`.trim():'No source passages retained. Missing evidence does not establish that the claim is false.',citations,limitations:['Quoted source text is evidence to examine, not an endorsement of its accuracy. A link or relevance score does not prove a claim.',...(result.sources.some(s=>!s.publishDate)?['Some sources have no publication date. Retrieval or revision time must not be treated as publication or event time.']:[]),...(result.sources.some(s=>s.provider==='google_fact_check')?['Fact-check database entries contain reviewed-claim metadata; the underlying article body was not fetched.']:[])]};
}
export function citationGroup(source:GroundedSource){
  return source.review?.contextConfirmed&&source.stance!=='neutral'?`Human-reviewed: ${source.stance}`:'Other relevant source · relationship unverified';
}
