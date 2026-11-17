import React from "react";
import type { NliRelationship } from "../claimTypes";
export function SourceRelationship({ relation }: { relation: NliRelationship | undefined }) {
  if (!relation || relation.status === "unconfigured") return null;
  return (
    <div
      className="mt-3 rounded border border-amber-700/50 p-3"
      aria-label="Claim-source model relationship"
    >
      <p className="font-medium text-amber-200">
        Model suggestion: {relation.suggestion || "unavailable"} · experimental
      </p>
      <p>
        {relation.humanReviewState === "reviewed"
          ? `Human-reviewed stance: ${relation.humanStance}; ${relation.reviewedBy}`
          : "Awaiting human review"}
      </p>
      <p className="mt-1">{relation.reason}</p>
      <details className="mt-2">
        <summary className="cursor-pointer">Model diagnostics and exact input passage</summary>
        <p>
          {relation.modelId} · {relation.version} · {relation.status}
        </p>
        <a
          href="https://huggingface.co/cross-encoder/nli-MiniLM2-L6-H768"
          target="_blank"
          rel="noreferrer"
          className="text-cyan-300 underline"
        >
          Official NLI model card
        </a>
        <p>
          Evaluation: failed ANLI held-out criteria (32.3% accuracy, 0.318 macro-F1). Not validated
          for authoritative claim verification. English only.
        </p>
        {relation.scores && (
          <p>
            Raw softmax: entailment {relation.scores.entailment.toFixed(4)}, contradiction{" "}
            {relation.scores.contradiction.toFixed(4)}, neutral {relation.scores.neutral.toFixed(4)}
            . These are not truth probabilities.
          </p>
        )}
        <p>Model input is an exact source window, which may omit surrounding context:</p>
        <blockquote className="border-l border-slate-600 pl-2">{relation.passage}</blockquote>
        <p className="break-all">
          Passage SHA-256: {relation.passageSha256}; source SHA-256: {relation.sourcePassageSha256}
        </p>
        <p>
          Source offsets {relation.span.start}–{relation.span.end}; tokens{" "}
          {relation.tokens ?? "not measured"}; inference{" "}
          {relation.elapsedMs?.toFixed(1) ?? "not measured"} ms.
        </p>
      </details>
    </div>
  );
}
