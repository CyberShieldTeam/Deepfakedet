import { z } from "zod";

export const GEMINI_MEDIA_LABEL = "AI-assisted media assessment — not validated authenticity detection.";
const MAX_BYTES = 6 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 30;
const MAX_VIDEO_FRAMES = 6;

export type GeminiImagePart = { inlineData: { mimeType: string; data: string } };
export type GeminiMediaAssessment = {
  status: "not_requested" | "not_configured" | "complete" | "input_limit" | "unsupported_duration" | "quota_exceeded" | "rate_limited" | "timeout" | "provider_error";
  explanation: string;
  observations: string[];
  generationAssessment?: "suspected_ai_generated" | "no_clear_ai_indicators" | "inconclusive";
  generationIndicators?: string[];
  limitations: string[];
  model: string | null;
};

export function geminiMediaFailure(kind: "quota_exceeded" | "rate_limited" | "overloaded" | "error", message = ""): GeminiMediaAssessment {
  const status = kind === "quota_exceeded" ? "quota_exceeded"
    : kind === "rate_limited" ? "rate_limited"
    : kind === "overloaded" && /timed? ?out|deadline|abort/i.test(message) ? "timeout"
    : "provider_error";
  const explanation = status === "quota_exceeded" ? "Gemini could not assess this media because the configured provider quota is exhausted."
    : status === "rate_limited" ? "Gemini could not assess this media because the provider is rate limiting requests."
    : status === "timeout" ? "Gemini media assessment timed out."
    : "Gemini media assessment is temporarily unavailable due to a provider error.";
  return { status, explanation, observations: [] as string[], limitations: ["No Gemini observations were returned; the existing classifier and forensic measurements are unchanged."], model: null };
}

const responseSchema = z.object({
  explanation: z.string().trim().min(1).max(1200),
  observations: z.array(z.string().trim().min(1).max(300)).max(8),
  generationAssessment: z.enum(["suspected_ai_generated", "no_clear_ai_indicators", "inconclusive"]).default("inconclusive"),
  generationIndicators: z.array(z.string().trim().min(1).max(300)).max(6).default([]),
  limitations: z.array(z.string().trim().min(1).max(300)).max(8),
}).strict().refine(v => v.generationAssessment !== "suspected_ai_generated" || v.generationIndicators.length > 0, "Suspected AI generation requires specific indicators");

const dataPart = (url: string): { part: GeminiImagePart; bytes: number } | null => {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(url);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  return { part: { inlineData: { mimeType: match[1], data: match[2] } }, bytes: bytes.byteLength };
};

export function prepareGeminiMedia(input: {
  modality: "image" | "video" | "audio";
  measurements: Record<string, unknown>;
  mediaData?: string;
  originalImageData?: string;
  keyframes?: string[];
  frameTimes?: number[];
}): { status: "ready" | "input_limit" | "unsupported_duration" | "unsupported_media"; parts: GeminiImagePart[]; sampledTimes: number[] } {
  if (input.modality === "audio") return { status: "unsupported_media", parts: [], sampledTimes: [] };
  if (input.modality === "image") {
    const part = dataPart(input.originalImageData || input.mediaData || "");
    if (!part) return { status: "input_limit", parts: [], sampledTimes: [] };
    if (part.bytes > MAX_BYTES) return { status: "input_limit", parts: [], sampledTimes: [] };
    return { status: "ready", parts: [part.part], sampledTimes: [] };
  }

  const duration = Number(input.measurements.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_VIDEO_SECONDS)
    return { status: "unsupported_duration", parts: [], sampledTimes: [] };
  const frames = input.keyframes || [];
  if (!frames.length) return { status: "input_limit", parts: [], sampledTimes: [] };
  const indexes = Array.from({ length: Math.min(MAX_VIDEO_FRAMES, frames.length) }, (_, i) =>
    Math.round((i * (frames.length - 1)) / Math.max(1, Math.min(MAX_VIDEO_FRAMES, frames.length) - 1)),
  );
  const unique = [...new Set(indexes)];
  const parts: GeminiImagePart[] = [];
  let total = 0;
  for (const index of unique) {
    const part = dataPart(frames[index]);
    if (!part) return { status: "input_limit", parts: [], sampledTimes: [] };
    total += part.bytes;
    if (total > MAX_BYTES) return { status: "input_limit", parts: [], sampledTimes: [] };
    parts.push(part.part);
  }
  return { status: "ready", parts, sampledTimes: unique.map((index) => input.frameTimes?.[index] ?? index) };
}

export function parseGeminiMediaResponse(text: string | undefined) {
  if (!text || text.length > 12000) return null;
  try {
    const parsed = responseSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const notRequestedGeminiAssessment = (): GeminiMediaAssessment => ({
  status: "not_requested",
  explanation: "No media was sent to Gemini because optional sharing consent was not selected.",
  observations: [],
  limitations: ["This optional assessment was not requested."],
  model: null,
});
