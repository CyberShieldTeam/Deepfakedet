import { classify, modelConfig } from "./inference";
import type { DetectionAssessment, ForensicAnalysisResult } from "../src/types";

function assessment(p: number | null, note: string): DetectionAssessment {
  return {
    verdict:
      p === null
        ? "inconclusive"
        : p >= 0.8
          ? "likely"
          : p >= 0.55
            ? "possible"
            : p <= 0.2
              ? "no_indicators_found"
              : "inconclusive",
    probability: p === null ? null : Math.round(p * 100),
    confidence: null, // Class probability is not a validated confidence estimate.
    indicators: [],
    counterIndicators: [],
    rationale: note,
  };
}
export async function analyzeMediaPipeline(input: {
  modality: "image" | "video" | "audio";
  fileName: string;
  measurements: Record<string, any>;
  mediaData?: string;
  keyframes?: string[];
  frameTimes?: number[];
  audioSegments?: { start: number; end: number; data: string }[];
}): Promise<ForensicAnalysisResult> {
  const { modality, fileName, measurements: m, mediaData, keyframes = [], frameTimes = [] } = input;
  const findings: string[] = [];
  const limitations = [
    "AI generation, manipulation, misleading context and factual accuracy are different questions.",
    "Browser measurements are client-supplied screening evidence, not trusted server forensic attestation.",
    "ELA, ordinary scene differences, codec bandwidth and missing metadata do not prove deepfaking.",
    "C2PA byte-pattern hints are unverified; cryptographic verification is not installed.",
  ];
  if (m.elaBlockRatio !== undefined)
    findings.push(
      `ELA 16×16 block residual ratio: ${m.elaBlockRatio}; recompression/editing indicator only.`,
    );
  if (m.hasExif !== undefined)
    findings.push(`EXIF marker ${m.hasExif ? "present" : "absent"}; neither proves authenticity.`);
  if (m.provenanceAI || m.c2paManifest)
    findings.push(
      "Unsigned metadata hints were found. Do not treat them as authenticated credentials.",
    );
  if (modality === "video")
    findings.push(
      `${m.framesSampled || keyframes.length} frames sampled; ${m.cutCount || 0} temporal difference spikes. Scene transitions are an alternative explanation.`,
    );
  if (modality === "audio")
    findings.push(
      `Sample rate: ${m.sampleRate ?? "unavailable"} Hz; pause ratio: ${m.pauseRatio ?? "unavailable"}; high-frequency ratio: ${m.hfEnergyRatio ?? "unavailable"}. Codec and recording conditions can explain these measurements.`,
    );
  const task = modality === "audio" ? "audio" : "image";
  const config = modelConfig(task);
  const mediaInputs =
    modality === "video"
      ? keyframes
      : modality === "audio" && input.audioSegments?.length
        ? input.audioSegments.map((s) => s.data)
        : mediaData
          ? [mediaData]
          : [];
  // Bound concurrency and request budget; no paid request retries without operator action.
  const inference: Awaited<ReturnType<typeof classify>>[] = [];
  for (let i = 0; i < mediaInputs.length; i += 4) {
    inference.push(
      ...(await Promise.all(mediaInputs.slice(i, i + 4).map((data) => classify(task, data)))),
    );
  }
  const available = inference.filter((r) => r.status === "available");
  const probabilities = available
    .map((r) => r.aiGeneratedProbability)
    .filter((p): p is number => p !== null);
  const complete = inference.length > 0 && available.length === inference.length;
  const probability =
    probabilities.length && probabilities.length === inference.length && complete
      ? probabilities.reduce((a, b) => a + b, 0) / probabilities.length
      : null;
  const manipulationProbabilities = available
    .map((r) => r.manipulationProbability)
    .filter((p): p is number => p !== null);
  const manipulation =
    complete &&
    manipulationProbabilities.length &&
    manipulationProbabilities.length === inference.length
      ? manipulationProbabilities.reduce((a, b) => a + b, 0) / manipulationProbabilities.length
      : null;
  const status = !mediaInputs.length
    ? "unavailable"
    : available.length === inference.length
      ? "available"
      : available.length
        ? "partial"
        : inference.some((r) => r.status === "failed")
          ? "failed"
          : "unavailable";
  const note =
    status === "available"
      ? `${config.modelId}@${config.version}. ${available[0]?.calibration}. Confidence is not independently validated.`
      : `Dedicated ${task} classifier ${status}. No replacement probability or Gemini guess was generated.`;
  const frames =
    modality === "video"
      ? inference.map((r, i) => ({
          timestamp: frameTimes[i] ?? null,
          status: r.status,
          probability: r.status === "available" ? r.aiGeneratedProbability : null,
          thumbnail: keyframes[i],
        }))
      : undefined;
  const segments =
    modality === "audio" && input.audioSegments?.length
      ? inference.flatMap((r, i) =>
          r.status === "available" && r.aiGeneratedProbability !== null
            ? [
                {
                  start: input.audioSegments![i].start,
                  end: input.audioSegments![i].end,
                  probability: r.aiGeneratedProbability,
                },
              ]
            : [],
        )
      : available.flatMap((r) => r.segments || []);
  return {
    modality,
    fileName,
    authenticity:
      probability !== null && probability >= 0.8
        ? "likely_synthetic"
        : manipulation !== null && manipulation >= 0.8
          ? "suspicious_artifacts"
          : "inconclusive",
    confidenceScore: null,
    aiGeneratedProbability: probability === null ? null : Math.round(probability * 100),
    headlineSummary:
      probability === null
        ? "Classifier unavailable — measured signals only"
        : `Model assessment available; ${modality === "video" ? "sampled-frame mean, not a validated video-level probability" : "not an accuracy guarantee"}.`,
    detailedFindings: findings,
    engine: available.length ? "model_adapter" : "heuristic",
    engineNote: note,
    riskLevel: "Informational",
    measurements: m,
    aiGeneration: assessment(probability, note),
    manipulation: assessment(
      manipulation,
      "Only a trained manipulation classifier can populate this probability.",
    ),
    misleadingContext: {
      status: "not_assessed",
      reason:
        "Requires source, date and claim verification; image appearance alone is insufficient.",
    },
    inference: {
      status,
      modelId: config.modelId,
      version: config.version,
      calibration: available[0]?.calibration || "Not applicable",
      trainingData: config.trainingData,
      license: config.license,
      limitations: config.limitations,
    },
    sampledFrames: frames,
    audioSegments: segments,
    provenance: {
      c2paManifest: !!m.c2paManifest,
      declaresAIGenerated: !!m.provenanceAI,
      generatorHints: String(m.provenanceHints || "")
        .split(", ")
        .filter(Boolean),
      verified: false,
    },
    compressionArtifacts: {
      elaScore: Number(m.elaScore) || 0,
      doubleCompressionFound: false,
      noiseInconsistencyMapAvailable: modality === "image",
      notes: "Client-computed ELA; not a detector probability.",
    },
    modelsUsed: available.length
      ? [
          {
            name: config.modelId,
            version: config.version,
            provider: "Operator-configured inference service",
          },
        ]
      : [],
    limitations: [
      ...limitations,
      config.limitations,
      ...(modality === "video"
        ? [
            "Sampled-frame mean is descriptive, not a calibrated probability for the entire video. Unobserved intervals are not assessed.",
          ]
        : []),
      ...(inference.some((r) => r.status !== "available") ? [note] : []),
    ],
    alternativeHypotheses: [
      "Legitimate editing or scene changes",
      "Platform recompression or recording artifacts",
    ],
    analyzedAt: new Date().toISOString(),
    isSimulated: false,
  };
}
