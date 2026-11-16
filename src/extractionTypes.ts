export type ExtractionState =
  | "COMPLETE"
  | "NO_TEXT_DETECTED"
  | "UNAVAILABLE"
  | "FAILED"
  | "PARTIAL";
export type ExtractionReviewState = "pending" | "accepted" | "corrected" | "rejected" | "uncertain";
export interface ExtractionWord {
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  confidence: number | null;
}
export interface ExtractedSegment {
  id: string;
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  words: ExtractionWord[];
  method: "image_ocr";
  language: string | null;
  languageBasis: "configured_recognition_language";
  timestamp: null;
}
export interface ExtractionReview {
  revision: number;
  state: Exclude<ExtractionReviewState, "pending">;
  reviewedText: string | null;
  reason: string;
  reviewedBy: string;
  reviewedAt: string;
}
export interface ExtractionCandidate {
  id: string;
  segmentId: string;
  originalText: string;
  category:
    | "assertion_candidate"
    | "question"
    | "opinion"
    | "quotation"
    | "hypothetical_or_satire"
    | "unclear"
    | "instruction_like";
  categoryMethod: "conservative_text_rules_unvalidated";
  start: number;
  end: number;
  reviews: ExtractionReview[];
}
export interface ExtractionRecord {
  schemaVersion: 1;
  id: string;
  sourceMediaHash: string;
  sourceModality: "image";
  state: ExtractionState;
  method: "tesseract.js@7.0.0";
  modelRevision: string;
  modelSha256: string;
  recognitionLanguage: "eng";
  detectedLanguage: null;
  originalText: string;
  segments: ExtractedSegment[];
  candidates: ExtractionCandidate[];
  geometry: {
    originalWidth: number;
    originalHeight: number;
    width: number;
    height: number;
    transformation: string;
  };
  extractedAt: string;
  limitations: string[];
  timing: {
    preparationMs: number;
    modelStartupMs: number;
    ocrMs: number;
    candidateMs: number;
    totalMs: number;
  };
}
export interface ExtractionOrigin {
  extractionId: string;
  candidateId: string;
  reviewRevision: number;
  mediaHash: string;
  segmentId: string;
  reviewedText: string;
}
export interface ExtractionRun {
  state: ExtractionState;
  at: string;
  sourceMediaHash: string;
  errorCategory?: string;
  detail: string;
}
