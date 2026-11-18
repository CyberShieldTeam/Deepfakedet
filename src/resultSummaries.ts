import type { CampaignAnalysisResult, ClaimVerificationResult } from "./types";

export type ClaimDisplayStatus = "VERIFIED" | "CONTRADICTED" | "MISLEADING" | "NOT_VERIFIED";
export type NetworkDisplayStatus =
  | "NO_SIGNIFICANT_PATTERN_OBSERVED"
  | "ASSOCIATED_ACTIVITY_OBSERVED"
  | "REPEATED_COORDINATION_SIGNALS"
  | "INSUFFICIENT_DATA";

export interface ResultSummary<S extends string> {
  status: S;
  headline: string;
  explanation: string;
  evidence: string[];
  nextAction: string;
  tone: "green" | "red" | "amber" | "sky" | "slate";
}

const reviewedForClaim = (result: ClaimVerificationResult) =>
  result.sources.filter(
    (source) =>
      !!source.id &&
      !!source.retrievedAt &&
      !!source.review?.contextConfirmed &&
      source.review.claim === result.normalizedClaim &&
      source.review.quote.length >= 12 &&
      source.excerpt.includes(source.review.quote),
  );

/** Presentation policy only; never upgrades the server's evidence decision. */
export function claimResultSummary(
  result: ClaimVerificationResult,
): ResultSummary<ClaimDisplayStatus> {
  const reviewed = reviewedForClaim(result);
  const evidence = reviewed.map(
    (source) => `[${source.id}] ${source.review!.quote} — ${source.publisher || source.domain}`,
  );
  if (
    result.verificationMode === "analyst_reviewed" &&
    result.verificationStatus === "SUPPORTED" &&
    reviewed.some((s) => s.stance === "supports")
  )
    return {
      status: "VERIFIED",
      headline: "Verified by reviewed evidence",
      explanation:
        "Reviewed, attributable source passages support the complete claim in its stated context.",
      evidence,
      nextAction:
        "Use the cited passages and retain their dates and context when sharing the conclusion.",
      tone: "green",
    };
  if (
    result.verificationMode === "analyst_reviewed" &&
    result.verificationStatus === "CONTRADICTED" &&
    reviewed.some((s) => s.stance === "contradicts")
  )
    return {
      status: "CONTRADICTED",
      headline: "Contradicted by reviewed evidence",
      explanation:
        "Reviewed, attributable source passages contradict the complete claim in its stated context.",
      evidence,
      nextAction:
        "Do not repeat the claim as fact; cite the reviewed contradicting passages when correcting it.",
      tone: "red",
    };
  const mixedOnly =
    result.verificationMode === "analyst_reviewed" &&
    result.verificationStatus === "CONFLICTING_EVIDENCE" &&
    reviewed.some((s) => s.stance === "mixed") &&
    !reviewed.some((s) => s.stance === "supports" || s.stance === "contradicts");
  if (mixedOnly)
    return {
      status: "MISLEADING",
      headline: "Misleading without important context",
      explanation:
        "An analyst reviewed attributable passages and found that the claim combines accurate and inaccurate elements or omits material context.",
      evidence,
      nextAction: "Read the cited passages in full and restate the claim with the missing context.",
      tone: "amber",
    };
  const reason =
    result.verificationStatus === "CONFLICTING_EVIDENCE"
      ? "Reviewed sources conflict, so the evidence does not support one definitive conclusion."
      : result.verificationStatus === "UNAVAILABLE"
        ? "Required evidence providers were unavailable; no factual conclusion was produced."
        : reviewed.length
          ? "The reviewed evidence is insufficient for a definitive conclusion."
          : "Retrieved or model-ranked material has not passed attributable source-context review.";
  return {
    status: "NOT_VERIFIED",
    headline: "Not verified",
    explanation: reason,
    evidence,
    nextAction:
      "Review an exact passage from a current primary or authoritative source before relying on or sharing the claim.",
    tone: "slate",
  };
}

export function networkResultSummary(
  result: CampaignAnalysisResult,
): ResultSummary<NetworkDisplayStatus> {
  const episode = result.episodeEvidence;
  if (
    !episode ||
    !episode.coverageComplete ||
    result.truncated ||
    episode.observation === "INCOMPLETE_OBSERVATION" ||
    result.analysis?.state === "ANALYSIS_FAILED" ||
    result.analysis?.state === "ANALYSIS_UNAVAILABLE"
  )
    return {
      status: "INSUFFICIENT_DATA",
      headline: "Insufficient data for a network pattern conclusion",
      explanation: result.truncated
        ? "Processing limits were reached, so the retained relationships are incomplete."
        : "Complete episode evidence was unavailable for this analysis.",
      evidence: episode
        ? [
            `${episode.posts.length} posts retained`,
            `${episode.omittedWitnesses} witnesses omitted`,
            `coverage ${episode.coverageComplete ? "declared complete" : "unknown or incomplete"}`,
          ]
        : [],
      nextAction:
        "Provide complete post IDs, explicit timestamps and dataset coverage, then rerun the analysis.",
      tone: "slate",
    };
  const recurring = episode.associations.filter((association) => association.recurrenceEligible);
  if (recurring.length)
    return {
      status: "REPEATED_COORDINATION_SIGNALS",
      headline: "Repeated coordination signals observed",
      explanation: `${recurring.length} account pair${recurring.length === 1 ? " has" : "s have"} qualifying observations in separated episodes. This describes recurrence, not malicious intent or common ownership.`,
      evidence: recurring
        .slice(0, 5)
        .map(
          (a) =>
            `${a.source} ↔ ${a.target}: ${a.separatedEpisodeCount} separated episodes (${a.witnessIds.length} witnesses)`,
        ),
      nextAction:
        "Inspect the episode witnesses and compare them with legitimate scheduling, syndication and breaking-news explanations.",
      tone: "amber",
    };
  if (episode.associations.length)
    return {
      status: "ASSOCIATED_ACTIVITY_OBSERVED",
      headline: "Associated activity observed",
      explanation: `${episode.associations.length} account pair${episode.associations.length === 1 ? " has" : "s have"} measured content, URL, hashtag or timing relationships, but no eligible repeated pattern was established.`,
      evidence: episode.associations
        .slice(0, 5)
        .map(
          (a) =>
            `${a.source} ↔ ${a.target}: ${a.episodeIds.length} observed episode${a.episodeIds.length === 1 ? "" : "s"}`,
        ),
      nextAction:
        "Review the source posts and collect additional complete observations before drawing conclusions.",
      tone: "sky",
    };
  return {
    status: "NO_SIGNIFICANT_PATTERN_OBSERVED",
    headline: "No significant pattern observed",
    explanation:
      "No account pair met the configured observable-association policy in the supplied dataset. This does not prove that no relationship exists outside the dataset.",
    evidence: [
      `${episode.posts.length} posts checked`,
      `${episode.duplicatesRemoved} duplicates removed`,
    ],
    nextAction:
      "Preserve the result and expand collection only if the investigation requires broader coverage.",
    tone: "green",
  };
}
