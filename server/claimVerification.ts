import { z } from "zod";
import { performance } from "node:perf_hooks";
import { embed, cosine, modelConfig } from "./inference";
import { analyzeClaim, claimTokens, normalizeClaim } from "./claimText";
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

export async function rankEvidence(claim: string, items: RetrievedEvidence[], semantic = true) {
  const unique = deduplicateEvidence(items),
    texts = unique.map((e) => `${e.title} ${e.excerpt}`);
  const lexical = bm25(claim, texts),
    maxLex = Math.max(1, ...lexical);
  const e5 = process.env.VERITAS_CLAIM_EMBEDDING_FORMAT === "e5";
  const vectors =
    semantic && unique.length
      ? await embed([
          `${e5 ? "query: " : ""}${claim}`,
          ...texts.map((t) => `${e5 ? "passage: " : ""}${t}`),
        ])
      : null;
  const ranked = unique
    .map((e, i) => ({
      ...e,
      lexicalScore: lexical[i],
      semanticScore: vectors ? cosine(vectors[0], vectors[i + 1]) : null,
      rank: vectors?.length
        ? (0.5 * lexical[i]) / maxLex + 0.5 * Math.max(0, cosine(vectors[0], vectors[i + 1]))
        : lexical[i] / maxLex,
    }))
    .filter((e) => e.lexicalScore > 0 || (e.semanticScore ?? 0) > 0.65)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 8);
  return {
    ranked,
    duplicatesRemoved: items.length - unique.length,
    embeddingStatus: vectors
      ? `${modelConfig("embedding").modelId}@${modelConfig("embedding").version}; configured endpoint; language quality unvalidated`
      : "unavailable; BM25 lexical fallback",
    semanticMeasured: !!vectors,
  };
}

export async function retrieveEvidence(claim: string, local: Evidence[] = []) {
  const [corpus, google] = await Promise.all([corpusEvidence(), googleEvidence(claim)]);
  const controls: RetrievedEvidence[] = local.map((e) => ({
    title: e.title,
    url: e.url,
    excerpt: e.excerpt,
    publishDate: e.publishDate,
    retrievedAt: new Date().toISOString(),
    provider: "software_test",
  }));
  const ranking = await rankEvidence(claim, [...corpus.items, ...google.items, ...controls]);
  return {
    ...ranking,
    providers: [corpus.state, google.state],
    retrievalStatus: [corpus.state.detail, google.state.detail].join("; "),
  };
}

export async function verifyWithEvidence(claim: string): Promise<ClaimVerificationResult> {
  const started = performance.now(),
    analysis = analyzeClaim(claim);
  const retrieval = await retrieveEvidence(analysis.normalized);
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
  }));
  const unavailable = !sources.length && !retrieval.providers.some((p) => p.status === "available");
  const missingEvidence = [
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
  return {
    originalInput: claim,
    targetClaim: analysis.normalized,
    normalizedClaim: analysis.normalized,
    extractedClaims: analysis.assertions,
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
      "No automatic translation or trained entailment/NER model ran. Google passages are claim-review metadata, not fetched article bodies.",
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
      providers: retrieval.providers,
      duplicatesRemoved: retrieval.duplicatesRemoved,
      semanticMeasured: retrieval.semanticMeasured,
      elapsedMs: performance.now() - started,
      processRssBytes: process.memoryUsage().rss,
      queries: [analysis.normalized],
    },
  };
}

export const claimReviewSchema = z
  .object({
    result: z.record(z.string(), z.unknown()),
    reviews: z
      .array(
        z
          .object({
            url: z.string().url(),
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
  if (!result.normalizedClaim || result.normalizedClaim !== normalizeClaim(result.originalInput))
    throw new Error("Re-run claim verification before review");
  const seen = new Set<string>();
  for (const review of reviews) {
    const source = result.sources.find((s) => s.url === review.url);
    if (!source || seen.has(review.url))
      throw new Error("Review must reference unique retrieved sources");
    seen.add(review.url);
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
    const review = reviews.find((r) => r.url === s.url);
    return {
      ...s,
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
  return {
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
}
