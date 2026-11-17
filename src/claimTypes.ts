export type ClaimCategory =
  | "assertion_candidate"
  | "question"
  | "instruction"
  | "opinion"
  | "prediction"
  | "quotation"
  | "hypothetical_or_satire"
  | "compound"
  | "unclear";
export interface ClaimCandidate {
  id: string;
  text: string;
  start: number;
  end: number;
  category: ClaimCategory;
  method: "conservative_rules_unvalidated";
}
export interface ClaimSelection {
  candidateId?: string;
  text: string;
  language: "en" | "hi" | "te" | "unknown";
  contextConfirmed: true;
  note: string;
}
export interface ClaimSelectionReview extends ClaimSelection {
  reviewedBy: string;
  reviewedAt: string;
  originalInputSha256: string;
  edited: boolean;
  originalCandidate?: ClaimCandidate;
}
export interface NliScores {
  contradiction: number;
  entailment: number;
  neutral: number;
}
export interface NliRelationship {
  id: string;
  claimId: string;
  sourceId: string;
  passageId: string;
  sourcePassageSha256: string;
  passageSha256: string;
  passage: string;
  span: { start: number; end: number };
  modelId: string;
  version: string;
  status:
    | "executed"
    | "unconfigured"
    | "unavailable"
    | "unsupported_language"
    | "selection_required"
    | "input_over_limit"
    | "metadata_only"
    | "busy"
    | "timeout"
    | "failed";
  evaluationStatus: "experimental_not_validated" | "experimental_failed_validation";
  suggestion: "supports" | "contradicts" | "neutral" | "abstained" | null;
  scores?: NliScores;
  argmax?: keyof NliScores;
  tokens?: number;
  elapsedMs?: number;
  reason: string;
  humanReviewState: "pending" | "reviewed";
  humanStance?: "supports" | "contradicts" | "mixed" | "neutral";
  reviewedBy?: string;
  reviewedAt?: string;
}
export interface NliAnalysis {
  status: "executed" | "partial" | "unavailable" | "unconfigured" | "not_applicable";
  modelId: string;
  version: string;
  evaluationStatus: "experimental_not_validated" | "experimental_failed_validation";
  relationships: NliRelationship[];
  elapsedMs: number;
  startupMs?: number;
  memory?: { rssBytes: number; peakWorkingSetBytes: number | null };
  summary: string;
}

export interface RerankingAnalysis{
  status:'unconfigured'|'not_applicable'|'executed'|'unavailable'|'unsupported_language'|'input_over_limit'|'busy'|'timeout';
  modelId:string;version:string;evaluationStatus:'experimental_relevance_only';applied:boolean;elapsedMs:number;startupMs?:number;
  memory?:{rssBytes:number;peakWorkingSetBytes:number|null};reason:string;
  candidates:{url:string;inputSha256:string;passageSha256:string;status:string;score?:number;tokens?:number;elapsedMs?:number}[];
}
