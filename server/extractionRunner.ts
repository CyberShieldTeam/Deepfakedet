import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { OCR_MODEL, verifiedOcrModel, extractHash, proposeCandidates } from "./extraction";
import type { ExtractionRecord, ExtractedSegment } from "../src/extractionTypes";
export class ExtractionError extends Error {
  constructor(
    message: string,
    public status = 503,
    public state: "FAILED" | "UNAVAILABLE" = "FAILED",
  ) {
    super(message);
  }
}
let active = false;
export async function runExtraction(
  caseId: string,
  sourceHash: string,
  dataUrl: string,
  language: string,
  modality: string,
  signal?: AbortSignal,
): Promise<ExtractionRecord> {
  if (modality !== "image" || language !== "eng")
    throw new ExtractionError(
      "Only English image OCR is installed. Video, speech and other recognition languages are unavailable.",
      503,
      "UNAVAILABLE",
    );
  if (active) throw new ExtractionError("Extraction is busy; retry later.", 429);
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl))
    throw new ExtractionError("A PNG, JPEG or WebP image is required.", 400);
  const encoded = dataUrl.split(",")[1],
    bytes = Buffer.from(encoded, "base64");
  if (bytes.length > 10 * 1024 * 1024 || bytes.toString("base64") !== encoded)
    throw new ExtractionError("Invalid or oversized image.", 413);
  if (createHash("sha256").update(bytes).digest("hex") !== sourceHash)
    throw new ExtractionError("Selected bytes do not match this case media hash.", 409);
  try {
    verifiedOcrModel();
  } catch {
    throw new ExtractionError(
      "Pinned English OCR model is unavailable; manual captions remain available.",
      503,
      "UNAVAILABLE",
    );
  }
  const endpoint = process.env.VERITAS_AI_SERVICE_URL;
  if (!endpoint)
    throw new ExtractionError("Image preparation service is not configured.", 503, "UNAVAILABLE");
  active = true;
  const start = performance.now(),
    controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = setTimeout(abort, 40000);
  try {
    const response = await fetch(new URL("/v1/extraction/image/prepare", endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64: encoded }),
      signal: controller.signal,
    });
    if (!response.ok)
      throw new ExtractionError(
        "Image preparation rejected or failed.",
        response.status === 400 ? 400 : 503,
      );
    let raw = "";
    let size = 0;
    const reader = response.body!.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 12 * 1024 * 1024) {
        controller.abort();
        throw new ExtractionError("Preparation output budget exceeded.", 413);
      }
      raw += Buffer.from(value).toString("utf8");
    }
    const prepared = JSON.parse(raw);
    if (
      prepared.sourceSha256 !== sourceHash ||
      !Number.isInteger(prepared.width) ||
      !Number.isInteger(prepared.height) ||
      prepared.width < 1 ||
      prepared.height < 1 ||
      prepared.width > 1600 ||
      prepared.height > 1600 ||
      typeof prepared.image_base64 !== "string" ||
      createHash("sha256").update(Buffer.from(prepared.image_base64, "base64")).digest("hex") !==
        prepared.bitmapSha256
    )
      throw new ExtractionError("Image preparation provenance failed.");
    const preparationMs = performance.now() - start;
    const output = await new Promise<any>((resolve, reject) => {
      const env = Object.fromEntries(
        Object.entries(process.env).filter(([k]) =>
          /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|TEMP|TMP|LOCALAPPDATA|APPDATA|USERPROFILE)$/i.test(k),
        ),
      );
      const child = spawn(
        process.execPath,
        [
          "--max-old-space-size=512",
          "--import",
          "tsx",
          fileURLToPath(new URL("./extractionWorker.ts", import.meta.url)),
        ],
        { env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
      );
      let out = "",
        done = false;
      const kill = () => {
        child.kill();
      };
      const finish = (error?: Error) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        controller.signal.removeEventListener("abort", interrupted);
        kill();
        if (error) reject(error);
        else {
          try {
            const v = JSON.parse(out);
            if (v.error) throw new Error();
            resolve(v);
          } catch {
            reject(new ExtractionError("OCR worker failed; no text was fabricated."));
          }
        }
      };
      const interrupted = () =>
        finish(new ExtractionError("Extraction interrupted or exceeded its deadline.", 504));
      const timer = setTimeout(interrupted, 30000);
      controller.signal.addEventListener("abort", interrupted, { once: true });
      child.stdout.on("data", (chunk) => {
        out += chunk;
        if (Buffer.byteLength(out) > 2 * 1024 * 1024)
          finish(new ExtractionError("OCR output budget exceeded.", 413));
      });
      child.stderr.resume();
      child.on("error", () => finish(new ExtractionError("OCR worker unavailable.")));
      child.on("close", (code) =>
        finish(
          code === 0 ? undefined : new ExtractionError("OCR worker exited without valid evidence."),
        ),
      );
      child.stdin.on("error", () => {});
      if (controller.signal.aborted) interrupted();
      else
        child.stdin.end(
          JSON.stringify({
            image_base64: prepared.image_base64,
            width: prepared.width,
            height: prepared.height,
          }),
        );
    });
    const id =
      "extraction:" +
      extractHash([
        caseId,
        sourceHash,
        OCR_MODEL.sha256,
        prepared.bitmapSha256,
        output.originalText,
        output.segments,
      ]);
    const segments: ExtractedSegment[] = output.segments.map((s: ExtractedSegment) => ({
      ...s,
      id: "segment:" + extractHash([id, s.id]),
    }));
    const tick = performance.now(),
      proposed = proposeCandidates(id, segments),
      candidateMs = performance.now() - tick;
    const truncated = output.truncated || proposed.truncated;
    return {
      schemaVersion: 1,
      id,
      sourceMediaHash: sourceHash,
      sourceModality: "image",
      state: truncated ? "PARTIAL" : segments.length ? "COMPLETE" : "NO_TEXT_DETECTED",
      method: "tesseract.js@7.0.0",
      modelRevision: OCR_MODEL.revision,
      modelSha256: OCR_MODEL.sha256,
      recognitionLanguage: "eng",
      detectedLanguage: null,
      originalText: output.originalText,
      segments,
      candidates: proposed.candidates,
      geometry: {
        originalWidth: prepared.originalWidth,
        originalHeight: prepared.originalHeight,
        width: prepared.width,
        height: prepared.height,
        transformation: prepared.transformation,
      },
      extractedAt: new Date().toISOString(),
      limitations: [
        "English recognition configured; language was not detected. Other scripts and mixed languages are unsupported.",
        "OCR confidence describes character recognition, never factual truth.",
        "Candidate categories are unvalidated text rules; sentences split across lines may be incomplete.",
        "Review requires original source inspection. Acceptance confirms source representation, not factual truth.",
        ...(truncated
          ? [
              "Output truncated: maximum 512 words, 32 text lines, 16 candidates and 20,000 raw characters.",
            ]
          : []),
      ],
      timing: {
        preparationMs,
        modelStartupMs: output.modelStartupMs,
        ocrMs: output.ocrMs,
        candidateMs,
        totalMs: performance.now() - start,
      },
    };
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError(
      "Extraction preparation or execution failed; saved evidence was preserved.",
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
    active = false;
  }
}
