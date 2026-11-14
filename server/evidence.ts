import { z } from "zod";
import { embed, cosine } from "./inference";
import { detectScriptLanguage, tokenize } from "./campaign";
import type { ClaimVerificationResult, GroundedSource } from "../src/types";

const evidenceSchema = z
  .object({
    title: z.string().min(1).max(1000),
    url: z
      .string()
      .url()
      .refine((v) => /^https:\/\//.test(v)),
    excerpt: z.string().min(1).max(10000),
    publishDate: z.string().optional(),
    stance: z.enum(["supports", "contradicts", "mixed", "neutral"]).default("neutral"),
    reviewedBy: z.string().optional(),
    reviewedAt: z.string().datetime().optional(),
  })
  .strict();
export type Evidence = z.infer<typeof evidenceSchema>;
export function bm25(query: string, documents: string[]) {
  const corpus = documents.map((d) =>
    d
      .toLowerCase()
      .split(/[^\p{L}\p{M}\p{N}]+/u)
      .filter(Boolean),
  );
  const average = corpus.reduce((s, d) => s + d.length, 0) / (corpus.length || 1);
  return corpus.map((doc) => {
    return [...tokenize(query)].reduce((score, token) => {
      const df = corpus.filter((d) => d.includes(token)).length;
      const tf = doc.filter((w) => w === token).length;
      const idf = Math.log(1 + (corpus.length - df + 0.5) / (df + 0.5));
      return score + (idf * tf * 2.2) / (tf + 1.2 * (0.25 + (0.75 * doc.length) / (average || 1)));
    }, 0);
  });
}
export function evidenceVerdict(evidence: Evidence[]) {
  // Retrieval similarity is NOT entailment. Only operator-reviewed stances can support a verdict.
  const reviewed = evidence.filter((e) => e.reviewedBy && e.reviewedAt);
  const supports = reviewed.filter((e) => e.stance === "supports").length;
  const contradicts = reviewed.filter((e) => e.stance === "contradicts").length;
  const context = reviewed.some((e) => e.stance === "mixed");
  return context || (supports && contradicts)
    ? ("Misleading Context" as const)
    : supports
      ? ("Supported" as const)
      : contradicts
        ? ("Refuted" as const)
        : ("Insufficient Evidence" as const);
}
export async function retrieveEvidence(claim: string, local: Evidence[] = []) {
  let factCheck: Evidence[] = [];
  let retrievalStatus = "No external retrieval configured";
  if (process.env.GOOGLE_FACT_CHECK_API_KEY) {
    try {
      const url = new URL("https://factchecktools.googleapis.com/v1alpha1/claims:search");
      url.searchParams.set("key", process.env.GOOGLE_FACT_CHECK_API_KEY);
      url.searchParams.set("query", claim);
      url.searchParams.set("pageSize", "10");
      const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "error" });
      if (!response.ok) throw new Error("Fact Check API failed");
      const payload = await response.json();
      factCheck = (payload.claims || [])
        .flatMap((c: any) =>
          (c.claimReview || []).map((r: any) =>
            evidenceSchema.safeParse({
              title: r.title || c.text,
              url: r.url,
              excerpt: `${c.text}\nPublisher rating (not VERITAS verdict): ${r.textualRating || "not provided"}`,
              publishDate: r.reviewDate,
              stance: "neutral",
            }),
          ),
        )
        .filter((r: any) => r.success)
        .map((r: any) => r.data);
      retrievalStatus =
        "Google Fact Check Tools retrieved publisher reviews; exact claim equivalence requires analyst review";
    } catch {
      retrievalStatus = "Google Fact Check Tools unavailable or timed out";
    }
  }
  const evidence = [...local, ...factCheck].map((v) => evidenceSchema.parse(v));
  const lexical = bm25(
    claim,
    evidence.map((e) => `${e.title} ${e.excerpt}`),
  );
  const vectors = evidence.length ? await embed([claim, ...evidence.map((e) => e.excerpt)]) : null;
  const maxLex = Math.max(1, ...lexical);
  const ranked = evidence
    .map((e, i) => ({
      ...e,
      lexicalScore: lexical[i],
      semanticScore: vectors ? cosine(vectors[0], vectors[i + 1]) : null,
      rank: vectors
        ? (0.5 * lexical[i]) / maxLex + 0.5 * Math.max(0, cosine(vectors[0], vectors[i + 1]))
        : lexical[i] / maxLex,
    }))
    .filter((e) => e.lexicalScore > 0 || (e.semanticScore || 0) > 0.65)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 8);
  return {
    ranked,
    retrievalStatus,
    embeddingStatus: vectors ? "available" : "unavailable; BM25 lexical fallback",
  };
}
export async function verifyWithEvidence(claim: string): Promise<ClaimVerificationResult> {
  const { ranked, retrievalStatus, embeddingStatus } = await retrieveEvidence(claim);
  const sources: GroundedSource[] = ranked.map((e) => ({
    title: e.title,
    url: e.url,
    domain: new URL(e.url).hostname,
    excerpt: e.excerpt,
    publishDate: e.publishDate,
    retrievedAt: new Date().toISOString(),
    stance: e.stance,
    credibilityRating: "Unverified Source",
  }));
  return {
    originalInput: claim,
    targetClaim: claim,
    extractedClaims: claim
      .split(/(?<=[.!?।])\s+|\n+/)
      .filter(Boolean)
      .slice(0, 8),
    detectedLanguage: detectScriptLanguage(claim),
    verdict: "Insufficient Evidence",
    confidenceScore: null,
    verdictRationale: sources.length
      ? "Relevant publisher reviews were retrieved. Similarity is not claim equivalence; an analyst must verify their applicability and stance."
      : "No reliable, claim-specific evidence was retrieved. No factual verdict can be issued.",
    sources,
    supportingCount: 0,
    contradictingCount: 0,
    neutralCount: sources.length,
    supportingEvidence: [],
    contradictingEvidence: [],
    limitations: [
      retrievalStatus,
      `Multilingual SBERT: ${embeddingStatus}`,
      "Script-based language detection is approximate; Devanagari is not unique to Hindi.",
      "Retrieval scores measure relevance, not truth.",
    ],
    timestamp: new Date().toISOString(),
    engine: "heuristic",
    verificationMode: sources.length ? "insufficient_external_evidence" : "rule_based",
    assessment: "unverified",
    isSimulated: false,
    evidenceSufficiency: sources.length ? "requires_review" : "insufficient",
    retrieval: { lexical: "BM25", semantic: embeddingStatus, source: retrievalStatus },
  };
}
