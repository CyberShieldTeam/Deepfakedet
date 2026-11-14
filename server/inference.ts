import { z } from "zod";
import crypto from "node:crypto";
import { owner } from "./security";

export type ModelTask = "image" | "audio" | "embedding";
const probability = z.number().min(0).max(1);
const classification = z
  .object({
    modelId: z.string().min(1),
    version: z.string().min(1),
    aiGeneratedProbability: probability.nullable(),
    manipulationProbability: probability.nullable().default(null),
    segments: z
      .array(z.object({ start: z.number().nonnegative(), end: z.number().positive(), probability }))
      .max(300)
      .optional(),
  })
  .strict()
  .refine((v) => !v.segments?.some((s) => s.end <= s.start), "Invalid segment interval");
export interface ModelConfig {
  task: ModelTask;
  endpoint?: string;
  token?: string;
  modelId: string;
  version: string;
  license: string;
  trainingData: string;
  limitations: string;
  temperature?: number;
  calibrationReference?: string;
}
export function modelConfig(task: ModelTask): ModelConfig {
  const prefix = `VERITAS_${task.toUpperCase()}`;
  return {
    task,
    endpoint: process.env[`${prefix}_ENDPOINT`],
    token: process.env[`${prefix}_TOKEN`],
    modelId: process.env[`${prefix}_MODEL_ID`] || "Not selected",
    version: process.env[`${prefix}_VERSION`] || "Unspecified",
    license: process.env[`${prefix}_LICENSE`] || "Deployment must verify model license",
    trainingData: process.env[`${prefix}_TRAINING_DATA`] || "Not documented by deployment",
    limitations:
      process.env[`${prefix}_LIMITATIONS`] ||
      "No deployed model; cross-domain accuracy is unverified",
    temperature: Number(process.env[`${prefix}_TEMPERATURE`]) || 1,
    calibrationReference: process.env[`${prefix}_CALIBRATION_REFERENCE`],
  };
}
/** Temperature scaling is only claimed as calibration when a held-out calibration reference is supplied. */
export function calibrateProbability(p: number, temperature = 1) {
  if (!Number.isFinite(p) || p < 0 || p > 1 || !Number.isFinite(temperature) || temperature <= 0)
    throw new Error("Invalid calibration input");
  if (p === 0 || p === 1) return p;
  return 1 / (1 + Math.exp(-Math.log(p / (1 - p)) / temperature));
}
const health = new Map<string, { status: "ready" | "failed"; at: string }>();
export function inferenceRegistry() {
  return (["image", "audio", "embedding"] as const).map((task) => {
    const { token: _token, endpoint, ...config } = modelConfig(task);
    return {
      ...config,
      configured: !!endpoint,
      status: endpoint ? health.get(task)?.status || "not_tested" : "unavailable",
      lastChecked: health.get(task)?.at || null,
    };
  });
}
/** Configured only by the server operator; URLs from requests are never fetched. */
export async function callEndpoint(
  config: ModelConfig,
  body: unknown,
  fetcher: typeof fetch = fetch,
) {
  if (!config.endpoint) throw new Error("Model endpoint not configured");
  const url = new URL(config.endpoint);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  )
    throw new Error("Model endpoint must use HTTPS (or loopback HTTP)");
  const response = await fetcher(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Inference service returned HTTP ${response.status}`);
  // Bound the response stream, not just Content-Length (which may be absent).
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty inference response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 2_000_000) {
      await reader.cancel();
      throw new Error("Inference response exceeds limit");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function classify(
  task: "image" | "audio",
  media: string,
  config = modelConfig(task),
  fetcher: typeof fetch = fetch,
) {
  if (!config.endpoint)
    return {
      status: "unavailable" as const,
      reason: "Dedicated classifier endpoint is not configured",
      modelId: config.modelId,
      version: config.version,
    };
  try {
    const output = classification.parse(
      await callEndpoint(
        config,
        { task, media, modelId: config.modelId, version: config.version },
        fetcher,
      ),
    );
    if (output.modelId !== config.modelId || output.version !== config.version)
      throw new Error("Model identity mismatch");
    const temperature = config.calibrationReference ? config.temperature || 1 : 1;
    health.set(task, { status: "ready", at: new Date().toISOString() });
    return {
      status: "available" as const,
      ...output,
      calibration: config.calibrationReference
        ? `Temperature scaling; ${config.calibrationReference}`
        : "Uncalibrated model output; no validated calibration set",
      aiGeneratedProbability:
        output.aiGeneratedProbability === null
          ? null
          : calibrateProbability(output.aiGeneratedProbability, temperature),
      manipulationProbability:
        output.manipulationProbability === null
          ? null
          : calibrateProbability(output.manipulationProbability, temperature),
      segments: output.segments?.map((s) => ({
        ...s,
        probability: calibrateProbability(s.probability, temperature),
      })),
    };
  } catch {
    health.set(task, { status: "failed", at: new Date().toISOString() });
    return {
      status: "failed" as const,
      reason: "Classifier failed, timed out, or returned an invalid/model-mismatched response",
      modelId: config.modelId,
      version: config.version,
    };
  }
}
const embeddingCache = new Map<string, { vector: number[]; expires: number }>();
export async function embed(texts: string[]): Promise<number[][] | null> {
  const config = modelConfig("embedding");
  if (!config.endpoint) return null;
  try {
    const keys = texts.map((text) =>
      crypto
        .createHash("sha256")
        .update(`${owner()}\0${config.modelId}\0${config.version}\0${text}`)
        .digest("hex"),
    );
    const vectors: (number[] | undefined)[] = keys.map((key) => {
      const entry = embeddingCache.get(key);
      return entry && entry.expires > Date.now() ? entry.vector : undefined;
    });
    const missing = vectors.map((v, i) => (v ? null : i)).filter((i): i is number => i !== null);
    const batches = Array.from({ length: Math.ceil(missing.length / 128) }, (_, i) =>
      missing.slice(i * 128, (i + 1) * 128),
    );
    const deadline = Date.now() + 40000;
    for (let i = 0; i < batches.length; i += 4) {
      if (Date.now() > deadline) throw new Error("Embedding budget exceeded");
      await Promise.all(
        batches.slice(i, i + 4).map(async (indices) => {
          const output = z
            .object({
              modelId: z.string(),
              version: z.string(),
              embeddings: z.array(z.array(z.number().finite()).min(8).max(4096)),
            })
            .parse(
              await callEndpoint(config, {
                texts: indices.map((j) => texts[j]),
                modelId: config.modelId,
                version: config.version,
              }),
            );
          if (
            output.modelId !== config.modelId ||
            output.version !== config.version ||
            output.embeddings.length !== indices.length
          )
            throw new Error("Embedding identity/shape mismatch");
          indices.forEach((position, j) => {
            vectors[position] = output.embeddings[j];
            embeddingCache.set(keys[position], {
              vector: output.embeddings[j],
              expires: Date.now() + 30 * 60000,
            });
          });
        }),
      );
    }
    if (vectors.some((v) => !v || v.length !== vectors[0]?.length || !v.some((x) => x !== 0)))
      throw new Error("Invalid embedding vectors");
    while (embeddingCache.size > 5000) embeddingCache.delete(embeddingCache.keys().next().value!);
    health.set("embedding", { status: "ready", at: new Date().toISOString() });
    return vectors as number[][];
  } catch {
    health.set("embedding", { status: "failed", at: new Date().toISOString() });
    return null;
  }
}
export function cosine(a: number[], b: number[]) {
  if (a.length !== b.length) return 0;
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  return dot / (Math.hypot(...a) * Math.hypot(...b) || 1);
}
