import { createHash } from "node:crypto";
import type {
  ClaimCandidate,
  ClaimCategory,
  ClaimSelection,
  ClaimSelectionReview,
} from "../src/claimTypes";
export const textHash = (text: string) => createHash("sha256").update(text).digest("hex");
export function claimCategory(text: string): ClaimCategory {
  if (/[?？]\s*$/u.test(text)) return "question";
  if (/^["“‘「]/u.test(text)) return "quotation";
  if (/\b(satire|hypothetical|imagine|suppose|fictional scenario)\b/i.test(text))
    return "hypothetical_or_satire";
  if (/\b(in my opinion|i think|i believe|i feel)\b/i.test(text)) return "opinion";
  if (
    /^(?:please\b|evacuate\b|share\b|send\b|click\b|execute\b|ignore\b|do not\b|don't\b|stay\b|कृपया|तुरंत|तुरन्त|सबको भेज|దయచేసి|వెంటనే)/iu.test(
      text,
    ) ||
    /ignore.{0,25}(instructions|system|prompt)|<script/iu.test(text)
  )
    return "instruction";
  if (
    /\b(will|might|forecast|predicted|expected to)\b|\bmay\s+(be|have|collapse|occur|happen)\b/iu.test(
      text,
    )
  )
    return "prediction";
  if (/\b(and|but|whereas)\b/iu.test(text)) return "compound";
  if (text.length < 12 || !/[\p{L}]/u.test(text)) return "unclear";
  return "assertion_candidate";
}
export function extractClaimCandidates(original: string): ClaimCandidate[] {
  const candidates: ClaimCandidate[] = [];
  let start = 0;
  const boundaries = [...original.matchAll(/[.!?।](?=\s|$)|\n+/gu)].map(
    (m) => m.index! + m[0].length,
  );
  boundaries.push(original.length);
  for (const boundary of boundaries) {
    let left = start,
      right = boundary;
    start = boundary;
    while (left < right && /\s/u.test(original[left])) left++;
    while (right > left && /\s/u.test(original[right - 1])) right--;
    const prefix = original.slice(left, right).match(/^(?:BREAKING|UPDATE|NEWSFLASH)\s*:\s*/iu);
    if (prefix) left += prefix[0].length;
    if (left >= right) continue;
    const text = original.slice(left, right);
    candidates.push({
      id: "C-" + textHash(JSON.stringify([left, right, text])).slice(0, 20),
      text,
      start: left,
      end: right,
      category: claimCategory(text),
      method: "conservative_rules_unvalidated",
    });
    if (candidates.length === 8) break;
  }
  return candidates;
}
export function approveClaimSelection(
  original: string,
  selection: ClaimSelection,
  reviewer: string,
): ClaimSelectionReview {
  const candidates = extractClaimCandidates(original),
    candidate = selection.candidateId
      ? candidates.find((c) => c.id === selection.candidateId)
      : undefined;
  if (selection.candidateId && !candidate)
    throw new Error("Selection must refer to a current original-text candidate");
  if (
    !selection.contextConfirmed ||
    selection.note.trim().length < 20 ||
    !selection.text.trim() ||
    selection.text.length > 1000
  )
    throw new Error("Claim selection needs explicit context approval and a rationale");
  return {
    ...selection,
    text: selection.text.trim(),
    note: selection.note.trim(),
    reviewedBy: reviewer,
    reviewedAt: new Date().toISOString(),
    originalInputSha256: textHash(original),
    edited: !candidate || candidate.text !== selection.text.trim(),
    originalCandidate: candidate,
  };
}
export function suspectedRomanized(text: string) {
  return /\b(hai|hain|nahi|nahin|kaadu|ledu|undi|avutundi|kya|mein|nuvvu)\b/iu.test(text);
}
