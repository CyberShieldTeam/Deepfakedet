import { z } from "zod";
import { performance } from "node:perf_hooks";
import {claimDiagnostics} from './analysisDiagnostics';
import { embedDetailed, cosine, modelConfig } from "./inference";
import { analyzeClaim, claimTokens, normalizeClaim } from "./claimText";
import {wikipediaEvidence} from './wikipediaEvidence';
import {approveClaimSelection,textHash} from './claimExtraction';
import {assessClaimRelationships} from './claimStance';
import {owner} from './security';
import {evidenceSummary} from '../src/evidenceSummary';
import {rerankEvidence} from './claimReranking';
import type {ClaimSelection} from '../src/claimTypes';
import {
  corpusEvidence,
  googleEvidence,
  deduplicateEvidence,
  type RetrievedEvidence,
} from "./claimSources";
import type { ClaimVerificationResult, GroundedSource } from "../src/types";

export type Evidence = {
  title: string;
  url: string;
  excerpt: string;
  publishDate?: string;
  stance: "supports" | "contradicts" | "mixed" | "neutral";
  reviewedBy?: string;
  reviewedAt?: string;
};
/** Compatibility helper. Production review applies quote/context checks below. */
export function evidenceVerdict(evidence: Evidence[]) {
  const reviewed = evidence.filter((e) => e.reviewedBy && e.reviewedAt);
  const supports = reviewed.some((e) => e.stance === "supports"),
    contradicts = reviewed.some((e) => e.stance === "contradicts");
  return reviewed.some((e) => e.stance === "mixed") || (supports && contradicts)
    ? ("Misleading Context" as const)
    : supports
      ? ("Supported" as const)
      : contradicts
        ? ("Refuted" as const)
        : ("Insufficient Evidence" as const);
}

/** Unicode BM25 retains short words/negation; similarity does not imply entailment. */
export function bm25(query: string, documents: string[]) {
  const corpus = documents.map(claimTokens),
    tokens = new Set(claimTokens(query));
  const average = corpus.reduce((s, d) => s + d.length, 0) / (corpus.length || 1);
  const frequencies = new Map(
    [...tokens].map((t) => [t, corpus.filter((d) => d.includes(t)).length]),
  );
  return corpus.map((doc) =>
    [...tokens].reduce((score, token) => {
      const tf = doc.filter((w) => w === token).length,
        df = frequencies.get(token)!;
      return (
        score +
        (Math.log(1 + (corpus.length - df + 0.5) / (df + 0.5)) * tf * 2.2) /
          (tf + 1.2 * (0.25 + (0.75 * doc.length) / (average || 1)))
      );
    }, 0),
  );
}

export async function rankEvidence(
  claim: string,
  items: RetrievedEvidence[],
  semantic = true,
  method: "bm25" | "e5" | "hybrid" = semantic ? "hybrid" : "bm25",
) {
  const unique = deduplicateEvidence(items),
    texts = unique.map((e) => `${e.title} ${e.excerpt}`);
  const lexical = bm25(claim, texts),
    maxLex = Math.max(1, ...lexical);
  const e5 = process.env.VERITAS_CLAIM_EMBEDDING_FORMAT === "e5";
  const encoded =
    semantic && unique.length
      ? await embedDetailed([
          `${e5 ? "query: " : ""}${claim}`,
          ...texts.map((t) => `${e5 ? "passage: " : ""}${t}`),
        ])
      : null;
  const vectors = encoded?.vectors || null;
  const ranked = unique
    .map((e, i) => ({
      ...e,
      lexicalScore: lexical[i],
      semanticScore: vectors ? cosine(vectors[0], vectors[i + 1]) : null,
      rank:
        method === "e5" && vectors
          ? Math.max(0, cosine(vectors[0], vectors[i + 1]))
          : vectors?.length
            ? (0.5 * lexical[i]) / maxLex + 0.5 * Math.max(0, cosine(vectors[0], vectors[i + 1]))
            : lexical[i] / maxLex,
    }))
    .filter((e) =>
      method === "e5" && vectors
        ? (e.semanticScore ?? 0) > 0.65
        : e.lexicalScore > 0 || (e.semanticScore ?? 0) > 0.65,
    )
    .sort((a, b) => b.rank - a.rank);
  return {
    ranked: ranked.slice(0, 8),
    candidateCount: ranked.length,
    omittedCount: Math.max(0, ranked.length - 8),
    embeddingDiagnostics: encoded?.diagnostics || null,
    duplicatesRemoved: items.length - unique.length,
    embeddingStatus: vectors
      ? `${modelConfig("embedding").modelId}@${modelConfig("embedding").version}; configured endpoint; language quality unvalidated`
      : "unavailable; BM25 lexical fallback",
    semanticMeasured: !!vectors,
  };
}

export async function retrieveEvidence(claim: string, local: Evidence[] = [],language?:string) {
  const [corpus, google, wikipedia] = await Promise.all([corpusEvidence(), googleEvidence(claim), wikipediaEvidence(claim)]);
  const controls: RetrievedEvidence[] = local.map((e) => ({
    title: e.title,
    url: e.url,
    excerpt: e.excerpt,
    publishDate: e.publishDate,
    retrievedAt: new Date().toISOString(),
    provider: "software_test",
  }));
  const ranking = await rankEvidence(claim, [...corpus.items, ...google.items, ...wikipedia.items, ...controls]);
  const reranking=await rerankEvidence(claim,ranking.ranked,language);
  return {
    ...ranking,
    ranked:reranking.ranked,
    reranking:reranking.analysis,
    providers: [corpus.state, google.state, wikipedia.state],
    retrievalStatus: [corpus.state.detail, google.state.detail, wikipedia.state.detail].join("; "),
  };
}

export async function verifyWithEvidence(claim: string,selection?:ClaimSelection): Promise<ClaimVerificationResult> {
  const started = performance.now(),
    selectionReview=selection?approveClaimSelection(claim,selection,owner()):undefined,
    checkedClaim=selectionReview?.text??claim,
    analysis = analyzeClaim(checkedClaim);
  const retrieval = await retrieveEvidence(analysis.normalized,[],selectionReview?.language);
  const sources: GroundedSource[] = retrieval.ranked.map((e, i) => ({
    id: `E${i + 1}`,
    title: e.title,
    url: e.url,
    domain: new URL(e.url).hostname,
    excerpt: e.excerpt,
    publishDate: e.publishDate,
    retrievedAt: e.retrievedAt,
    stance: "neutral",
    credibilityRating: "Unverified Source",
    provider: e.provider,
    publisher: e.publisher,
    publisherRating: e.publisherRating,
    language: e.language,
    relevance: { lexicalScore: e.lexicalScore, semanticScore: e.semanticScore, rank: e.rank },
    license: e.license,
    originalUrl:e.originalUrl,sourceType:e.sourceType,retrievalMethod:e.retrievalMethod,locator:e.locator,
    revisionId:e.revisionId,revisionUrl:e.revisionUrl,modifiedAt:e.modifiedAt,passageSha256:e.passageSha256??textHash(e.excerpt),
    licenseUrl:e.licenseUrl,sourceLimitations:e.sourceLimitations,
    ...(retrieval.reranking.status!=='unconfigured'?{reranking:{modelId:retrieval.reranking.modelId,version:retrieval.reranking.version,status:retrieval.reranking.status,applied:retrieval.reranking.applied,candidate:retrieval.reranking.candidates.find(c=>c.url===e.url&&c.passageSha256===textHash(e.excerpt))}}:{}),
  }));
  const unavailable = !sources.length && !retrieval.providers.some((p) => p.status === "available");
  const missingEvidence = [
    ...(retrieval.omittedCount ? [`${retrieval.omittedCount} relevant candidates omitted by the eight-source limit; decisive review is blocked until the query/corpus is narrowed.`] : []),
    ...(!sources.length
      ? ["No claim-specific evidence passages retrieved."]
      : [
          "Retrieved passages require exact assertion, date, location, negation and source-context review.",
        ]),
    ...(analysis.assertions.length > 1
      ? ["Multiple sentence candidates: all factual assertions need separate applicability review."]
      : []),
    ...(analysis.truncated
      ? ["Input exceeds eight sentence candidates; review the complete original text."]
      : []),
  ];
  const result:ClaimVerificationResult = {
    originalInput: claim,
    targetClaim: selectionReview?.text??analysis.normalized,
    selectionReview,
    normalizedClaim: analysis.normalized,
    extractedClaims: analysis.candidates.filter(c=>['assertion_candidate','compound'].includes(c.category)).map(c=>c.text),
    detectedLanguage: analysis.language,
    claimAnalysis: analysis,
    verificationStatus: unavailable ? "UNAVAILABLE" : "INSUFFICIENT_EVIDENCE",
    verdict: "Insufficient Evidence",
    confidenceScore: null,
    verdictRationale: sources.length
      ? "Retrieved passages are relevance candidates. No stance or factual conclusion has been inferred from similarity or publisher ratings."
      : unavailable
        ? "Evidence retrieval is unavailable or unconfigured. The claim remains unresolved."
        : "Available providers returned no relevant evidence. The claim remains unresolved.",
    sources,
    supportingCount: 0,
    contradictingCount: 0,
    neutralCount: sources.length,
    supportingEvidence: [],
    contradictingEvidence: [],
    missingEvidence,
    limitations: [
      retrieval.retrievalStatus,
      `Semantic retrieval: ${retrieval.embeddingStatus}`,
      ...analysis.ambiguities,
      analysis.extraction,
      analysis.entityMethod,
      "Relevance is not source credibility or entailment. No numerical truth probability is estimated.",
      "No automatic translation or trained NER ran. Optional experimental NLI only suggests textual relationships; Google passages are metadata, not fetched article bodies.",
    ],
    timestamp: new Date().toISOString(),
    engine: "heuristic",
    verificationMode: sources.length ? "insufficient_external_evidence" : "rule_based",
    assessment: "unverified",
    isSimulated: false,
    evidenceSufficiency: sources.length ? "requires_review" : "insufficient",
    retrieval: {
      lexical: "BM25",
      semantic: retrieval.embeddingStatus,
      source: retrieval.retrievalStatus,
    },
    retrievalDetails: {
      candidateCount: retrieval.candidateCount,
      omittedCount: retrieval.omittedCount,
      embeddingDiagnostics: retrieval.embeddingDiagnostics,
      providers: retrieval.providers,
      duplicatesRemoved: retrieval.duplicatesRemoved,
      semanticMeasured: retrieval.semanticMeasured,
      elapsedMs: performance.now() - started,
      processRssBytes: process.memoryUsage().rss,
      queries: [analysis.normalized,...retrieval.providers.flatMap(p=>p.query?[p.query]:[])],
      reranking:retrieval.reranking,
    },
  };
  result.nli=await assessClaimRelationships(result);
  if(result.nli.relationships.some(r=>r.status==='executed')){
    result.verdictRationale=result.nli.summary+' The model failed external validation; no human-reviewed stance or factual conclusion follows automatically.';
    result.limitations.push('Experimental English NLI failed held-out validation. Its raw softmax and suggested relationships are not calibrated truth probabilities.');
  }
  result.analysis=claimDiagnostics(result,performance.now()-started);
  result.evidenceSummary=evidenceSummary(result);
  return result;
}

export const claimReviewSchema = z
  .object({
    result: z.record(z.string(), z.unknown()),
    reviews: z
      .array(
        z
          .object({
            url: z.string().url(),
            sourceId: z.string().max(80).optional(),
            stance: z.enum(["supports", "contradicts", "mixed", "neutral"]),
            quote: z.string().trim().max(10000).default(""),
            contextConfirmed: z.boolean().default(false),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    note: z.string().trim().min(20).max(4000),
  })
  .strict();

/** Caller validates the signed owner-bound receipt first; client-added sources are forbidden. */
export function reviewEvidence(
  result: ClaimVerificationResult,
  reviews: z.infer<typeof claimReviewSchema>["reviews"],
  note: string,
  reviewer: string,
) {
  const started=performance.now();
  if (!result.normalizedClaim || result.normalizedClaim !== normalizeClaim(result.selectionReview?.text??result.originalInput)||
      (result.selectionReview&&result.selectionReview.originalInputSha256!==textHash(result.originalInput)))
    throw new Error("Re-run claim verification before review");
  const seen = new Set<string>();
  for (const review of reviews) {
    const matches = result.sources.filter(
      (s) => s.url === review.url && (!review.sourceId || s.id === review.sourceId),
    );
    const source = matches.length === 1 ? matches[0] : undefined;
    if (!source || seen.has(source.id || review.url))
      throw new Error("Review must reference unique retrieved sources");
    seen.add(source.id || review.url);
    if (review.stance !== "neutral" && (result.retrievalDetails?.omittedCount || 0) > 0)
      throw new Error(
        "Ranked evidence was truncated; narrow the claim/corpus before a decisive review",
      );
    if (
      review.stance !== "neutral" &&
      (!review.contextConfirmed ||
        review.quote.length < 12 ||
        !source.excerpt.includes(review.quote) ||
        !source.retrievedAt ||
        !source.id)
    )
      throw new Error(
        "A decisive stance requires an exact retrieved quote and confirmed assertion/date/location/negation context",
      );
    if (review.stance !== "neutral" && source.provider === "google_fact_check")
      throw new Error(
        "Claim-review metadata is not an article evidence passage; curate authorized underlying evidence before a decisive review",
      );
  }
  const reviewedAt = new Date().toISOString();
  const sources = result.sources.map((s) => {
    const review = reviews.find((r) => r.url === s.url && (!r.sourceId || r.sourceId === s.id));
    if(!review)return s;
    const history=[...(s.reviewHistory||[]),...(s.review?[{...s.review,stance:s.stance}]:[])];
    if(history.length>=32)throw new Error('Review-history capacity reached; preserve/export this result and create a new analysis before further review');
    if(review.stance==='neutral')history.push({stance:'neutral',quote:review.quote,contextConfirmed:review.contextConfirmed,reviewedBy:reviewer,reviewedAt,claim:result.normalizedClaim!,note});
    return {
      ...s,
      reviewHistory:history,
      stance: review?.stance || ("neutral" as const),
      review:
        review && review.stance !== "neutral"
          ? {
              quote: review.quote,
              contextConfirmed: true,
              reviewedBy: reviewer,
              reviewedAt,
              claim: result.normalizedClaim!,
              note,
            }
          : undefined,
    };
  });
  const supporting = sources.filter((s) => s.stance === "supports"),
    contradicting = sources.filter((s) => s.stance === "contradicts");
  const conflicting =
    sources.some((s) => s.stance === "mixed") || (!!supporting.length && !!contradicting.length);
  const status = conflicting
    ? "CONFLICTING_EVIDENCE"
    : supporting.length
      ? "SUPPORTED"
      : contradicting.length
        ? "CONTRADICTED"
        : "INSUFFICIENT_EVIDENCE";
  const reviewedResult = {
    ...result,
    sources,
    verificationStatus: status,
    verdict: conflicting
      ? "Mixed Evidence"
      : supporting.length
        ? "Supported"
        : contradicting.length
          ? "Contradicted"
          : "Insufficient Evidence",
    assessment: conflicting
      ? "verified_mixed"
      : supporting.length
        ? "verified_true"
        : contradicting.length
          ? "verified_false"
          : "unverified",
    verificationMode: "analyst_reviewed",
    evidenceSufficiency: status === "INSUFFICIENT_EVIDENCE" ? "insufficient" : "analyst_reviewed",
    supportingEvidence: supporting.map((s) => `[${s.id}] ${s.review!.quote}`),
    contradictingEvidence: contradicting.map((s) => `[${s.id}] ${s.review!.quote}`),
    supportingCount: supporting.length,
    contradictingCount: contradicting.length,
    neutralCount: sources.filter((s) => s.stance === "neutral").length,
    missingEvidence:
      status === "INSUFFICIENT_EVIDENCE"
        ? result.missingEvidence
        : [
            "Independent source credibility and factual validation remain outside this human review.",
          ],
    verdictRationale: `Analyst ${reviewer} reviewed quoted passages against the complete claim on ${reviewedAt}. ${note}`,
    confidenceScore: null,
    confidenceNote: "Attributed human assessment; no truth probability estimated.",
    timestamp: reviewedAt,
  } as ClaimVerificationResult;
  if(reviewedResult.nli)reviewedResult.nli={...reviewedResult.nli,relationships:reviewedResult.nli.relationships.map(r=>{const s=sources.find(s=>s.id===r.sourceId),current=s?.review?{...s.review,stance:s.stance}:s?.reviewHistory?.at(-1);return {...r,humanReviewState:current?'reviewed':'pending',humanStance:current?.stance,reviewedBy:current?.reviewedBy,reviewedAt:current?.reviewedAt}})};
  reviewedResult.analysis=claimDiagnostics(reviewedResult,performance.now()-started);
  reviewedResult.evidenceSummary=evidenceSummary(reviewedResult);
  return reviewedResult;
}
