import { performance } from "node:perf_hooks";
import { claimTokens } from "./claimText";
import {
  suspectedRomanized,
  textHash,
  claimCategory,
  extractClaimCandidates,
} from "./claimExtraction";
import { runNli, NliWorkerError, NLI_MODEL, NLI_VERSION } from "./nliWorker";
import type { ClaimVerificationResult } from "../src/types";
import type { NliAnalysis, NliRelationship, NliScores } from "../src/claimTypes";
export function selectPassage(claim: string, excerpt: string) {
  if (excerpt.length <= 1800) return { text: excerpt, start: 0, end: excerpt.length };
  const spans: { start: number; end: number }[] = [];
  let start = 0;
  for (const m of excerpt.matchAll(/[.!?।](?=\s|$)|\n+/gu)) {
    const end = m.index! + m[0].length;
    spans.push({ start, end });
    start = end;
  }
  if (start < excerpt.length) spans.push({ start, end: excerpt.length });
  const tokens = new Set(claimTokens(claim)),
    ranked = spans
      .map((s, i) => ({
        i,
        score: claimTokens(excerpt.slice(s.start, s.end)).reduce(
          (n, t) => n + Number(tokens.has(t)),
          0,
        ),
      }))
      .sort((a, b) => b.score - a.score || a.i - b.i);
  const best = ranked.find((r) => spans[r.i].end - spans[r.i].start <= 1800);
  if (!best) return null;
  let left = best.i,
    right = best.i;
  if (left > 0 && spans[right].end - spans[left - 1].start <= 1800) left--;
  if (right + 1 < spans.length && spans[right + 1].end - spans[left].start <= 1800) right++;
  return {
    text: excerpt.slice(spans[left].start, spans[right].end),
    start: spans[left].start,
    end: spans[right].end,
  };
}
/** Fixed research abstention policy, predeclared in test/fixtures/claims/nli_protocol.json. */
export function suggestStance(scores: NliScores) {
  const ordered = (Object.entries(scores) as [keyof NliScores, number][]).sort(
    (a, b) => b[1] - a[1],
  );
  return {
    argmax: ordered[0][0],
    suggestion:
      ordered[0][1] >= 0.9 && ordered[0][1] - ordered[1][1] >= 0.5
        ? ({ entailment: "supports", contradiction: "contradicts", neutral: "neutral" } as const)[
            ordered[0][0]
          ]
        : ("abstained" as const),
  };
}
export async function assessClaimRelationships(
  result: ClaimVerificationResult,
  infer = runNli,
): Promise<NliAnalysis> {
  const started = performance.now(),
    enabled = process.env.VERITAS_NLI_ENABLED === "1",
    configured = enabled && !!process.env.VERITAS_NLI_MODEL_PATH;
  const claim = result.targetClaim,
    selection = result.selectionReview,
    claimId = "CL-" + textHash(claim),
    relationships: NliRelationship[] = [],
    eligible: number[] = [];
  for (const source of result.sources) {
    const chosen = selectPassage(claim, source.excerpt),
      fullHash = textHash(source.excerpt),
      passage = chosen?.text || source.excerpt,
      passageSha256 = textHash(passage);
    const relation: NliRelationship = {
      id:
        "NLI-" +
        textHash(JSON.stringify([claimId, source.id, fullHash, passageSha256, NLI_VERSION])).slice(
          0,
          24,
        ),
      claimId,
      sourceId: source.id!,
      passageId: "P-" + passageSha256,
      sourcePassageSha256: fullHash,
      passageSha256,
      passage,
      span: { start: chosen?.start || 0, end: chosen?.end || source.excerpt.length },
      modelId: NLI_MODEL,
      version: NLI_VERSION,
      status: "unconfigured",
      evaluationStatus: "experimental_failed_validation",
      suggestion: null,
      reason: "NLI disabled or model snapshot not configured; no prediction invented.",
      humanReviewState: source.review ? "reviewed" : "pending",
      ...(source.review
        ? {
            humanStance: source.stance,
            reviewedBy: source.review.reviewedBy,
            reviewedAt: source.review.reviewedAt,
          }
        : {}),
    };
    if (configured) {
      if (!selection) {
        relation.status = "selection_required";
        relation.reason =
          "Approve a selected factual assertion and its language before experimental inference.";
      } else if (
        claimCategory(claim) !== "assertion_candidate" ||
        extractClaimCandidates(claim).length !== 1
      ) {
        relation.status = "selection_required";
        relation.reason =
          "This selected text is not a clear single assertion under the conservative rules. Narrow it or review manually; no automatic inference.";
      } else if (
        selection.language !== "en" ||
        result.claimAnalysis?.language !== "English" ||
        suspectedRomanized(claim) ||
        source.language !== "en"
      ) {
        relation.status = "unsupported_language";
        relation.reason =
          "Only explicitly selected English claims and English-tagged passages are supported. No translation ran.";
      } else if (source.provider === "google_fact_check") {
        relation.status = "metadata_only";
        relation.reason =
          "Reviewed-claim database metadata is not an underlying article evidence passage.";
      } else if (source.passageSha256 && source.passageSha256 !== fullHash) {
        relation.status = "failed";
        relation.reason = "Source passage fingerprint mismatch; no inference.";
      } else if (!chosen || claim.length > 1000) {
        relation.status = "input_over_limit";
        relation.reason =
          "No whole-sentence passage fits the bounded context; no silent token truncation.";
      } else eligible.push(relationships.length);
    }
    relationships.push(relation);
  }
  let startupMs: number | undefined, memory: NliAnalysis["memory"];
  if (eligible.length) {
    try {
      const response = await infer(
        eligible.map((i) => ({
          premise: relationships[i].passage,
          hypothesis: claim,
          language: "en",
        })),
      );
      startupMs = response.startupMs;
      memory = {
        rssBytes: response.memory.rssBytes,
        peakWorkingSetBytes: response.memory.peakWorkingSetBytes ?? null,
      };
      response.results.forEach((value, j) => {
        const relation = relationships[eligible[j]];
        relation.status = value.status;
        relation.reason =
          value.status === "executed"
            ? "Experimental textual relationship only; raw softmax is not factual truth, credibility or calibrated confidence. Selected window may omit context."
            : "Model token/language limit; no prediction or truncated replacement.";
        if (value.status === "executed")
          Object.assign(relation, {
            scores: value.scores,
            tokens: value.tokens,
            elapsedMs: value.elapsedMs,
            ...suggestStance(value.scores),
          });
        else if (value.status === "input_over_limit") relation.tokens = value.tokens;
      });
    } catch (error) {
      const category = error instanceof NliWorkerError ? error.category : "FAILED";
      for (const i of eligible) {
        relationships[i].status =
          category === "BUSY" ? "busy" : category === "TIMEOUT" ? "timeout" : "unavailable";
        relationships[i].reason =
          `NLI ${category}; no prediction invented. Retrieval and prior review are preserved.`;
      }
    }
  }
  const executed = relationships.filter((r) => r.status === "executed"),
    counts = { supports: 0, contradicts: 0, neutral: 0, abstained: 0 };
  for (const r of executed) counts[r.suggestion!]++;
  return {
    status: !enabled
      ? "unconfigured"
      : !relationships.length
        ? "not_applicable"
        : executed.length === relationships.length
          ? "executed"
          : executed.length
            ? "partial"
            : configured
              ? "unavailable"
              : "unconfigured",
    modelId: NLI_MODEL,
    version: NLI_VERSION,
    evaluationStatus: "experimental_failed_validation",
    relationships,
    elapsedMs: performance.now() - started,
    startupMs,
    memory,
    summary: executed.length
      ? `Experimental model suggestions: ${counts.supports} support, ${counts.contradicts} contradiction, ${counts.neutral} neutral, ${counts.abstained} abstained. These are textual relationships, not reviewed factual verdicts.`
      : "No model relationship was executed. Review source passages directly; missing inference does not establish truth or falsity.",
  };
}
