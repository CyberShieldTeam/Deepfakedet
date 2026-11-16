import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { normalizeClaim } from "./claimText";
import type {
  ExtractionCandidate,
  ExtractionRecord,
  ExtractionReview,
  ExtractedSegment,
  ExtractionWord,
} from "../src/extractionTypes";
export const OCR_MODEL = {
  revision: "87416418657359cb625c412a48b6e1d6d41c29bd",
  sha256: "7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2",
  bytes: 4113088,
  path: path.resolve(".model-cache/ocr/eng.traineddata"),
} as const;
export const extractHash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function verifiedOcrModel() {
  if (fs.statSync(OCR_MODEL.path).size !== OCR_MODEL.bytes)
    throw new Error("Pinned OCR model size mismatch");
  const data = fs.readFileSync(OCR_MODEL.path);
  if (
    data.length !== OCR_MODEL.bytes ||
    createHash("sha256").update(data).digest("hex") !== OCR_MODEL.sha256
  )
    throw new Error("Pinned OCR model missing or mismatched");
  return data;
}
export function candidateCategory(text: string): ExtractionCandidate["category"] {
  if (
    /ignore.{0,25}(instructions|system|prompt)|system\s*prompt|execute\s+|api[_ ]?key|<script/i.test(
      text,
    )
  )
    return "instruction_like";
  if (/[?？]\s*$/u.test(text)) return "question";
  if (/^["“‘「]/u.test(text)) return "quotation";
  if (/\b(satire|hypothetical|imagine|suppose|fictional scenario)\b/i.test(text))
    return "hypothetical_or_satire";
  if (/\b(i think|in my opinion|i believe|i feel)\b/i.test(text)) return "opinion";
  if (text.length < 12 || !/[.!।]$/u.test(text)) return "unclear";
  return "assertion_candidate";
}
export function parseOcrTsv(
  tsv: string,
  width: number,
  height: number,
): { segments: ExtractedSegment[]; truncated: boolean } {
  const groups = new Map<string, ExtractionWord[]>();
  let total = 0,
    truncated = false;
  for (const row of tsv.split("\n").slice(1)) {
    const fields = row.split("\t");
    if (fields.length < 12 || fields[0] !== "5") continue;
    const text = fields.slice(11).join("\t").trim();
    if (!text) continue;
    const [x, y, w, h] = fields.slice(6, 10).map(Number),
      confidence = Number(fields[10]);
    if (
      ![x, y, w, h].every(Number.isFinite) ||
      x < 0 ||
      y < 0 ||
      w < 0 ||
      h < 0 ||
      x + w > width + 1 ||
      y + h > height + 1
    )
      throw new Error("Invalid OCR box");
    if (total++ >= 512) {
      truncated = true;
      break;
    }
    const key = fields.slice(1, 5).join(":");
    if (!groups.has(key) && groups.size >= 32) {
      truncated = true;
      continue;
    }
    const words = groups.get(key) ?? [];
    if (
      text.length > 2000 ||
      words.reduce((n, w) => n + w.text.length + 1, 0) + text.length > 2000
    ) {
      truncated = true;
      continue;
    }
    groups.set(key, [
      ...words,
      {
        text,
        bbox: { x, y, width: w, height: h },
        confidence:
          Number.isFinite(confidence) && confidence >= 0 && confidence <= 100 ? confidence : null,
      },
    ]);
  }
  const segments = [...groups.values()].map((words) => {
    const x = Math.min(...words.map((w) => w.bbox.x)),
      y = Math.min(...words.map((w) => w.bbox.y)),
      right = Math.max(...words.map((w) => w.bbox.x + w.bbox.width)),
      bottom = Math.max(...words.map((w) => w.bbox.y + w.bbox.height));
    const text = words.map((w) => w.text).join(" ");
    return {
      id: "segment:" + extractHash([text, words.map((w) => w.bbox)]),
      text,
      bbox: { x, y, width: right - x, height: bottom - y },
      words,
      method: "image_ocr" as const,
      language: "eng",
      languageBasis: "configured_recognition_language" as const,
      timestamp: null,
    };
  });
  return { segments, truncated };
}
export function proposeCandidates(
  extractionId: string,
  segments: ExtractedSegment[],
): { candidates: ExtractionCandidate[]; truncated: boolean } {
  const candidates: ExtractionCandidate[] = [];
  let truncated = false;
  for (const segment of segments) {
    // Exact original substrings only. Classification is a review aid, not trained factuality.
    const pieces = segment.text.match(/[^.!?।]+[.!?।]*(?:\s*|$)/gu) ?? [segment.text];
    let from = 0;
    for (const piece of pieces) {
      const text = piece.trim();
      if (!text) continue;
      const start = segment.text.indexOf(text, from);
      from = start + text.length;
      if (start < 0) throw new Error("Unanchored candidate");
      if (candidates.length >= 16) {
        truncated = true;
        break;
      }
      candidates.push({
        id: "candidate:" + extractHash([extractionId, segment.id, start, text]),
        segmentId: segment.id,
        originalText: text,
        category: candidateCategory(text),
        categoryMethod: "conservative_text_rules_unvalidated",
        start,
        end: start + text.length,
        reviews: [],
      });
    }
  }
  return { candidates, truncated };
}
export function reviewExtraction(
  record: ExtractionRecord,
  candidateId: string,
  expectedRevision: number,
  state: ExtractionReview["state"],
  reviewedText: string | undefined,
  reason: string,
  sourceConfirmed: boolean,
  reviewer: string,
) {
  const candidate = record.candidates.find((c) => c.id === candidateId);
  if (!candidate) throw new Error("Candidate not found in this extraction");
  const previous = candidate.reviews.at(-1);
  if ((previous?.revision ?? 0) !== expectedRevision)
    throw new Error("Review revision changed; refresh before reviewing");
  if (["accepted", "corrected"].includes(state) && !sourceConfirmed)
    throw new Error("Confirm source representation, not factual truth");
  const text =
    state === "accepted"
      ? candidate.originalText
      : state === "corrected"
        ? normalizeClaim(reviewedText ?? "")
        : null;
  if (
    state === "accepted" &&
    reviewedText !== undefined &&
    normalizeClaim(reviewedText) !== normalizeClaim(candidate.originalText)
  )
    throw new Error("Use corrected state for changed text");
  if (state === "corrected" && !text) throw new Error("Corrected text required");
  if (
    previous &&
    previous.state === state &&
    previous.reviewedText === text &&
    previous.reason === reason
  )
    return previous;
  if (candidate.reviews.length >= 32)
    throw new Error("Review history limit reached; export and create a new extraction");
  const review: ExtractionReview = {
    revision: (previous?.revision ?? 0) + 1,
    state,
    reviewedText: text,
    reason,
    reviewedBy: reviewer,
    reviewedAt: new Date().toISOString(),
  };
  candidate.reviews.push(review);
  return review;
}
export function reviewedCandidate(record: ExtractionRecord, candidateId: string, revision: number) {
  const candidate = record.candidates.find((c) => c.id === candidateId),
    review = candidate?.reviews.at(-1);
  if (
    !candidate ||
    !review ||
    review.revision !== revision ||
    !["accepted", "corrected"].includes(review.state) ||
    !review.reviewedText
  )
    throw new Error("Current accepted/corrected extraction review required");
  return { candidate, review };
}
