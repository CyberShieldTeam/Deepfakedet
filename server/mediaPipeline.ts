import { classify, modelConfig } from "./inference";
import { callImageEvidence } from "./imageEvidence";
import type { DetectionAssessment, ForensicAnalysisResult } from "../src/types";
import type {AnalysisStage} from '../src/types';
import {mediaDiagnostics,diagnosticError} from './analysisDiagnostics';
import {performance} from 'node:perf_hooks';
import { callLocalImage, localImageResult, type LocalImageResponse } from "./localImage";
import { callLocalAudio, localAudioResult, type LocalAudioResponse } from "./localAudio";
import {
  callLocalVideo,
  callLocalVideoFrames,
  localVideoResult,
  type LocalVideoEvidence,
} from "./localVideo";

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
  originalImageData?: string;
  temporalIntervalSeconds?: number;
  keyframes?: string[];
  frameTimes?: number[];
  audioSegments?: { start: number; end: number; data: string }[];
}): Promise<ForensicAnalysisResult> {
  const { modality, fileName, measurements: m, mediaData, keyframes = [], frameTimes = [] } = input;
  const started=performance.now(),stages:AnalysisStage[]=[];
  const findings: string[] = [];
  const limitations = [
    "AI generation, manipulation, misleading context and factual accuracy are different questions.",
    "Browser measurements are client-supplied screening evidence, not trusted server forensic attestation.",
    "ELA, ordinary scene differences, codec bandwidth and missing metadata do not prove deepfaking.",
    "Browser C2PA byte-pattern hints are unverified; consult the separate server provenance result when available.",
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
  stages.push({stage:'client_measurements_received',status:'available',count:Object.values(m).filter(v=>typeof v==='number'&&Number.isFinite(v)).length});
  if(!inference.length)stages.push({stage:'dedicated_classifier',status:'unconfigured'});
  inference.forEach((r,i)=>stages.push({stage:`dedicated_classifier_sample_${i}`,status:!config.endpoint?'unconfigured':r.status,...(r.status==='failed'?{errorCategory:'CLASSIFIER_FAILED_OR_INVALID_RESPONSE'}:{})}));
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
  let result: ForensicAnalysisResult = {
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

  // Preserve the existing, pinned Python engines as separate experimental evidence.
  // They never upgrade an uncalibrated raw score into a verdict.
  const localEndpoint = process.env.VERITAS_AI_SERVICE_URL?.trim();
  const finish=()=>{
    result.limitations=[...new Set([...limitations,...result.limitations])];
    result.analysis=mediaDiagnostics(result,stages,performance.now()-started);
    return result;
  };
  if (!localEndpoint) {stages.push({stage:'local_evidence_service',status:'unconfigured'});return finish();}
  let localImage: LocalImageResponse | undefined;
  let localAudio: LocalAudioResponse | undefined;
  let localVideo: LocalVideoEvidence | undefined;
  try {
    if (modality === "image" && mediaData) {
      localImage = await callLocalImage(mediaData, localEndpoint);
    } else if (modality === "audio" && mediaData) {
      localAudio = await callLocalAudio(mediaData, localEndpoint);
    } else if (modality === "video") {
      if (mediaData) {
        try {
          localVideo = await callLocalVideo(mediaData, localEndpoint, fetch, input.temporalIntervalSeconds ?? 1);
        } catch (error) {
          stages.push({stage:'original_video_decode',status:'failed',errorCategory:diagnosticError(error)});
        }
      }
      if (!localVideo && keyframes.length) {
        localVideo = await callLocalVideoFrames(
          keyframes.slice(0, 6).map((imageData, index) => ({
            imageData,
            timestampSeconds: frameTimes[index] ?? index,
          })),
          localEndpoint,
        );
      }
    }
  } catch (error) {
    stages.push({stage:`local_${modality}_service`,status:'failed',errorCategory:diagnosticError(error)});
  }

  if (localImage) {
    stages.push({stage:'local_image_service',status:'available'},{stage:'experimental_image_model',status:localImage.model_status==='ready'?'available':localImage.model_status==='skipped'?'skipped':'unavailable'});
    if (available.length === 0) result = localImageResult(localImage, fileName, m, findings);
    else result.localImage = localImage;
  } else if (localAudio) {
    stages.push({stage:'local_audio_service',status:'available',count:localAudio.segments.length});
    if (available.length === 0) result = localAudioResult(localAudio, fileName, m, findings);
    else result.localAudio = localAudio;
  } else if (localVideo) {
    stages.push({stage:'local_video_service',status:'available',count:localVideo.frames.length});
    if(localVideo.temporalDiagnostics&&['partial','timed_out','failed'].includes(localVideo.temporalDiagnostics.status))stages.push({stage:'temporal_analysis',status:'failed',errorCategory:'INCOMPLETE_TEMPORAL_ANALYSIS'});
    if(localVideo.audioTrack&&['model_unavailable','extraction_failed'].includes(localVideo.audioTrack.status))stages.push({stage:'video_audio_analysis',status:localVideo.audioTrack.status==='model_unavailable'?'unavailable':'failed',...(localVideo.audioTrack.status==='extraction_failed'?{errorCategory:'AUDIO_EXTRACTION_FAILED'}:{})});
    if (available.length === 0) result = localVideoResult(localVideo, fileName, m, findings);
    else result.localVideo = localVideo;
  }
  if (modality === "image" && mediaData) {
    // Keep credentials on original bytes, even when the classifier received a resize.
    const evidenceData = input.originalImageData || (!String(m.analysisInput || "").startsWith("lossless PNG resize") ? mediaData : undefined);
    if (evidenceData) {
      try {
        result.imageDiagnostics = await callImageEvidence(evidenceData, localEndpoint);
        const d = result.imageDiagnostics;
        stages.push({stage:'image_signals',status:d.signals.status==='measured'?'available':'skipped'},{stage:'credential_validation',status:d.c2pa.status==='failed'?'failed':d.c2pa.status==='unavailable'?'unavailable':'available',...(d.c2pa.status==='failed'?{errorCategory:'CREDENTIAL_VERIFICATION_FAILED'}:{})});
        result.originalImageProvenance = {
          status: d.c2pa.status === 'valid_trusted' ? 'trusted' : d.c2pa.status === 'valid_untrusted' ? 'valid' :
            d.c2pa.status === 'failed' ? 'unavailable' : d.c2pa.status,
          aiDeclaration: d.c2pa.ai_disclosure === 'declared', note: d.c2pa.note,
          exif: { present: d.metadata.exif_present, software: d.metadata.fields.software || null }
        };
      } catch(error) {
        stages.push({stage:'image_provenance_and_signals',status:'failed',errorCategory:diagnosticError(error)});
        result.limitations.push("Server provenance and image diagnostics unavailable; no metadata or signal verdict inferred.");
      }
    } else {
      stages.push({stage:'original_image_provenance',status:'unavailable'});
      result.limitations.push("Original image was not supplied within evidence limits; provenance was not checked on the resized classifier input.");
    }
  }
  return finish();
}
