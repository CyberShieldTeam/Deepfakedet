/** Deterministic text diagnostics, not a language/NER/entailment model. */
import {extractClaimCandidates} from './claimExtraction';
export const normalizeClaim = (text: string) =>
  text
    .normalize("NFC")
    .replace(/[\u200B\uFEFF]/g, "")
    .replace(/\s+/gu, " ")
    .trim();
export const claimTokens = (text: string): string[] =>
  normalizeClaim(text)
    .toLowerCase()
    .match(/[\p{L}\p{M}\p{N}]+/gu) || [];

export function analyzeClaim(text: string) {
  const normalized = normalizeClaim(text);
  const languages = [
    /[A-Za-z]/u.test(normalized) && "English",
    /[\u0900-\u097F]/u.test(normalized) && "Hindi",
    /[\u0C00-\u0C7F]/u.test(normalized) && "Telugu",
  ].filter((v): v is string => !!v);
  const unknownScript = /[\p{L}]/u.test(
    normalized.replace(/[A-Za-z\u0900-\u097F\u0C00-\u0C7F]/gu, ""),
  );
  const language = unknownScript
    ? "Unknown / mixed script"
    : languages.length > 1
      ? `Mixed (${languages.join(", ")})`
      : languages[0] || "Unknown";
  const assertions = text
    .normalize("NFC")
    .split(/(?<=[!?।])\s*|(?<=\.)\s+|\n+/u)
    .map(normalizeClaim)
    .filter(Boolean);
  return {
    normalized,
    language,
    languages,
    assertions: assertions.slice(0, 8),
    candidates:extractClaimCandidates(text),
    extraction:
      "Conservative sentence/category rules, not a validated multilingual assertion model; analyst selection preserves original offsets and context.",
    truncated: assertions.length > 8,
    // Exact spans only. No inferred entity type or translated spelling.
    entityCandidates: Array.from(
      new Set(normalized.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b|\b\d{4}\b/gu) || []),
    ).slice(0, 30),
    entityMethod:
      "Capitalized Latin spans and four-digit numbers only; Hindi/Telugu NER unavailable.",
    negationMarkers: claimTokens(normalized).filter((t) =>
      ["not", "no", "never", "नहीं", "मत", "కాదు", "లేదు"].includes(t),
    ),
    ambiguities: [
      "Dates, time zones, locations, entity identity and negation scope require source-context review.",
      "Devanagari is not uniquely Hindi; Latin script may be romanized Hindi/Telugu. Script identification is approximate.",
      ...(languages.length > 1 || unknownScript
        ? [
            "Code-mixed or unsupported scripts detected; no automatic translation/equivalence guarantee.",
          ]
        : []),
    ],
  };
}
