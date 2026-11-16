import { createWorker, PSM } from "tesseract.js";
import { verifiedOcrModel, parseOcrTsv, OCR_MODEL } from "./extraction";
import path from "node:path";
let data = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) {
  data += chunk;
  if (Buffer.byteLength(data) > 12 * 1024 * 1024) throw new Error("Input budget");
}
try {
  const { image_base64, width, height } = JSON.parse(data),
    start = performance.now();
  verifiedOcrModel();
  // Fixed local path, gzip disabled, no cache/CDN selection. v7 byte-language initialization is broken.
  const worker = await createWorker("eng", 1, {
    langPath: path.dirname(OCR_MODEL.path),
    gzip: false,
    cacheMethod: "none",
    legacyCore: false,
    legacyLang: false,
    logger: () => {},
    errorHandler: () => {},
  });
  const modelStartupMs = performance.now() - start;
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const tick = performance.now();
    const result = await worker.recognize(
      Buffer.from(image_base64, "base64"),
      {},
      { text: true, tsv: true },
    );
    const ocrMs = performance.now() - tick;
    const parsed = parseOcrTsv(result.data.tsv ?? "", width, height);
    process.stdout.write(
      JSON.stringify({
        originalText: result.data.text.slice(0, 20000),
        ...parsed,
        modelStartupMs,
        ocrMs,
        truncated: parsed.truncated || result.data.text.length > 20000,
      }),
    );
  } finally {
    await worker.terminate();
  }
} catch {
  process.stdout.write(
    JSON.stringify({ error: "OCR worker failed; no extracted text was fabricated" }),
  );
}
