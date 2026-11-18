import type { EvidenceGroundedClaimStatus, GroundedSource } from '../src/types';

export interface ClaimEvidenceDecision {
  status: EvidenceGroundedClaimStatus;
  explanation: string;
  missingEvidence: string[];
  nextAction: string;
}

/**
 * A conservative policy boundary between retrieval/relevance and verification.
 * Search hits and LLM prose are not evidence until the source passage, stance,
 * date and claim context have been explicitly reviewed.
 */
export function decideClaimStatus(sources: GroundedSource[], opts: { conflicting?: boolean; outdated?: boolean } = {}): ClaimEvidenceDecision {
  const attributable = sources.filter(s => !!s.url && !!s.excerpt.trim() && s.contextReviewed === true && s.stance !== 'neutral');
  const supports = attributable.filter(s => s.stance === 'supports');
  const contradicts = attributable.filter(s => s.stance === 'contradicts');
  const mixed = attributable.filter(s => s.stance === 'mixed');
  const missing: string[] = [];
  if (!sources.length) missing.push('No attributable external source was retrieved.');
  else if (!attributable.length) missing.push('Retrieved sources have not been reviewed for exact claim context, date and stance.');
  if (opts.outdated) missing.push('The available information may be outdated for the claim date.');
  if (opts.conflicting || (supports.length && contradicts.length)) missing.push('Reviewed sources conflict.');

  if (!attributable.length || opts.conflicting || (supports.length && contradicts.length)) {
    return { status: 'NOT_VERIFIED', explanation: missing[0] || 'The reviewed evidence does not establish one conclusion.', missingEvidence: missing, nextAction: 'Review the cited passages and seek a current primary or authoritative source.' };
  }
  if (mixed.length) return { status: 'MISLEADING_CONTEXT', explanation: 'Reviewed attributable evidence shows that the assertion omits or changes material context.', missingEvidence: missing, nextAction: 'Read the cited passage in full and restate the claim with the missing context.' };
  if (supports.length && !opts.outdated) return { status: 'VERIFIED', explanation: `${supports.length} reviewed attributable source${supports.length === 1 ? '' : 's'} explicitly supports the assertion.`, missingEvidence: missing, nextAction: 'Use the cited source and preserve its date and context when sharing.' };
  if (contradicts.length && !opts.outdated) return { status: 'CONTRADICTED', explanation: `${contradicts.length} reviewed attributable source${contradicts.length === 1 ? '' : 's'} explicitly contradicts the assertion.`, missingEvidence: missing, nextAction: 'Do not share the assertion as fact; cite the contradicting source when correcting it.' };
  return { status: 'NOT_VERIFIED', explanation: 'The available evidence is not current enough to decide.', missingEvidence: missing, nextAction: 'Find a current primary or authoritative source.' };
}
