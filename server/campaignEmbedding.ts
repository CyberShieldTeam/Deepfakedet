import { embed, modelConfig, type ModelConfig } from "./inference";
const E5 = "intfloat/multilingual-e5-small",
  REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3";
export function campaignEmbeddingInputs(texts: string[], config: ModelConfig, format: string) {
  if (format === "e5-similarity" && config.modelId === E5 && config.version === REVISION)
    return texts.map((t) => "query: " + t);
  if (
    format === "generic" &&
    !/e5/i.test(config.modelId) &&
    config.modelId !== "Not selected" &&
    config.version !== "Unspecified"
  )
    return texts;
  throw new Error("Unsupported campaign task/model format; lexical fallback required");
}
export async function campaignEmbeddings(texts: string[]) {
  const config = modelConfig("embedding"),
    format = process.env.VERITAS_CAMPAIGN_EMBEDDING_FORMAT || "generic";
  const metadata = {
    status: "unavailable" as "available" | "unavailable",
    format,
    modelId: config.modelId,
    version: config.version,
    usedForAdmissions: false as const,
    detail: "Embedding evidence unavailable; lexical/Jaccard candidate admission remains active.",
  };
  if (!config.endpoint) return { vectors: null, metadata };
  try {
    const inputs = campaignEmbeddingInputs(texts, config, format),
      vectors = await embed(inputs);
    if (!vectors || (format === "e5-similarity" && vectors.some((v) => v.length !== 384)))
      throw new Error("Invalid campaign embeddings");
    return {
      vectors,
      metadata: {
        ...metadata,
        status: "available" as const,
        detail:
          "Task-compatible embeddings measured as diagnostic evidence only; no semantic campaign threshold is validated.",
      },
    };
  } catch {
    return {
      vectors: null,
      metadata: {
        ...metadata,
        detail:
          "Unsupported input contract or failed inference; lexical/Jaccard fallback retained.",
      },
    };
  }
}
