/**
 * Core type definitions for VERITAS AI - Suraksha Suchan
 * Digital Forensics, Claim Verification & Campaign Intelligence Platform
 */

export type ModalityType = "image" | "video" | "audio" | "text_claim" | "social_dataset";

/** Processing/evidence state, independent of authenticity, truth or maliciousness verdicts. */
export type AnalysisState='SUFFICIENT_EVIDENCE'|'INSUFFICIENT_EVIDENCE'|'NO_RELEVANT_SIGNALS'|'ANALYSIS_UNAVAILABLE'|'ANALYSIS_FAILED'|'PARTIAL_ANALYSIS';
export interface AnalysisStage {
  stage:string;status:'available'|'unconfigured'|'unavailable'|'failed'|'skipped';count?:number;errorCategory?:string;
}
export interface AnalysisDiagnostics {
  id:string;engine:'media'|'claim'|'network';state:AnalysisState;
  inputValidation:'valid'|'invalid';completeness:'complete'|'partial'|'not_performed'|'failed';
  evidenceCount:number;counts:Record<string,number>;stages:AnalysisStage[];
  filteringReasons:string[];errorCategory:string|null;elapsedMs:number|null;summary:string;
}

export type RiskLevel = "Critical" | "High" | "Medium" | "Low" | "Informational";

export type VerificationVerdict =
  | "Supported"
  | "Contradicted"
  | "Mixed Evidence"
  | "Insufficient Evidence"
  | "Refuted"
  | "Misleading Context";

export type MediaAuthenticity =
  | "likely_synthetic"
  | "suspicious_artifacts"
  | "inconclusive"
  | "likely_authentic";

export interface FaceBoundingBox {
  id: string;
  x: number; // percentage 0-100
  y: number;
  width: number;
  height: number;
  confidence: number;
  manipulationScore: number;
  anomaliesDetected: string[];
}

export interface VideoFrameAnalysis {
  frameIndex: number;
  timestampSeconds: number;
  anomalyScore: number; // 0 - 100
  isKeyframe: boolean;
  artifactsDetected: string[];
  thumbnailUrl?: string;
}

export interface AudioSpectralAnalysis {
  sampleRateHz: number;
  durationSeconds: number;
  spectralRollOffHz: number;
  voiceCloningProbability: number;
  pitchContinuityScore: number;
  backgroundAcousticDiscontinuity: boolean;
  anomalousFrequencyBands: string[];
}

export interface ForensicAnalysisResult {
  analysis?:AnalysisDiagnostics;
  modality: "image" | "video" | "audio";
  authenticity: MediaAuthenticity;
  confidenceScore: number | null; // null when not independently estimated
  headlineSummary: string;
  detailedFindings: string[];
  faces?: FaceBoundingBox[];
  videoFrames?: VideoFrameAnalysis[];
  audioSpectrum?: AudioSpectralAnalysis;
  compressionArtifacts: {
    elaScore: number;
    doubleCompressionFound: boolean;
    noiseInconsistencyMapAvailable: boolean;
    notes: string;
  };
  modelsUsed: {
    name: string;
    version: string;
    provider: string;
  }[];
  limitations: string[];
  alternativeHypotheses: string[];
  analyzedAt: string;
  /** Which engine produced the verdict. 'simulated_demo' = scripted demo data, never real. */
  engine?: AnalysisEngine;
  engineNote?: string;
  /** Real measurements computed in the browser (ELA, frame diffs, audio stats). */
  measurements?: Record<string, number | string | boolean>;
  /** Only populated when a model actually produced it; null = not available. */
  aiGeneratedProbability?: number | null;
  riskLevel?: RiskLevel;
  fileName?: string;
  isSimulated?: boolean;
  /** Images: is the whole image AI-generated? (separate from editing/splicing) */
  aiGeneration?: DetectionAssessment;
  /** Images: was a real image edited / spliced? */
  manipulation?: DetectionAssessment;
  provenance?: ProvenanceInfo;
  misleadingContext?: { status: string; reason: string };
  inference?: {
    status: string;
    modelId: string;
    version: string;
    calibration: string;
    trainingData: string;
    license: string;
    limitations: string;
  };
  sampledFrames?: {
    timestamp: number | null;
    status: string;
    probability: number | null;
    thumbnail: string;
  }[];
  audioSegments?: { start: number; end: number; probability: number }[];
  /** Raw local whole-image screening; its score is experimental and never calibrated confidence. */
  localImage?: LocalImageEvidence;
  imageDiagnostics?: ImageDiagnostics;
  originalImageProvenance?: import('../server/imageProvenance').ImageProvenance;
  /** Raw AASIST segment evidence; never an authenticity verdict. */
  localAudio?: LocalAudioEvidence;
  /** Timestamped image/audio evidence from local video screening; never a fused verdict. */
  localVideo?: LocalVideoEvidence;
}

export interface ImageDiagnostics {
  scope: 'image_provenance_and_signals';
  classification: 'INCONCLUSIVE';
  decision_probability: null;
  note: string;
  metadata: {
    width: number; height: number; format: string; exif_present: boolean;
    fields: Record<string, string>; fields_verified: false; note: string;
  };
  c2pa: {
    status: 'absent' | 'valid_untrusted' | 'valid_trusted' | 'invalid' | 'unavailable' | 'failed';
    sdk: string | null; trust_policy: 'none' | 'operator_anchors'; validation_state: string | null;
    validation_codes: string[]; source_types: string[];
    ai_disclosure: 'declared' | 'not_declared' | 'not_assessed'; signer: string | null; note: string;
  };
  signals: {
    status: 'measured' | 'skipped'; reason?: string; note?: string;
    analysis_width?: number; analysis_height?: number; high_frequency_energy_fraction?: number;
    noise_residual_std?: number; laplacian_variance?: number;
  };
}

export interface LocalImageEvidence {
  face_model?: { status: 'ready' | 'unavailable' | 'not_applicable'; model: string; revision: string; faces: { boxIndex: number; rawFakeSoftmax: number }[]; note: string };
  face_manipulation?: {
    status: "unavailable" | "analyzed" | "no_faces" | "no_usable_faces" | "failed";
    model: string;
    revision: string;
    classification: "INCONCLUSIVE";
    note: string;
    faces: { face_index: number; crop_bounds: number[]; raw_fake_score: number }[];
  };
  classification: "REAL" | "MANIPULATED" | "INCONCLUSIVE";
  fake_probability: number | null;
  model_confidence: number | null;
  model_status: "ready" | "unavailable" | "skipped";
  model: string;
  revision: string;
  scope: "general_ai_generated_image";
  face_analysis: "not_performed" | "none_found" | "candidate_regions";
  face_boxes: { x: number; y: number; width: number; height: number; confidence: number }[];
  signals: string[];
  explanation: string;
  processing_ms: number;
}

export interface LocalAudioEvidence {
  classification: "INCONCLUSIVE";
  model: string;
  revision: string;
  scope: "speech_anti_spoofing";
  sample_rate_input: number;
  sample_rate_model: 16000;
  duration_seconds: number;
  segments: { start_seconds: number; end_seconds: number; raw_bonafide_logit: number; raw_spoof_softmax: number }[];
  processing_ms: number;
  explanation: string;
}

export interface LocalVideoEvidence {
  temporalDiagnostics?: import('../server/localVideo').TemporalDiagnostics;
  scope: "sampled_video_frames" | "server_decoded_frames";
  frames: {
    timestampSeconds: number;
    image: LocalImageEvidence;
    quality?: { laplacianVariance: number; meanLuma: number; clippedFraction: number; selectionScore: number };
    temporal?: import('../server/localVideo').TemporalMeasurement;
  }[];
  samplingNote: string;
  faceContinuity?: import('../server/videoFaces').FaceContinuity;
  videoMetadata?: { durationSeconds: number; width: number; height: number };
  audioTrack?: {
    status: "analyzed" | "no_audio" | "model_unavailable" | "extraction_failed";
    note: string;
    truncated: boolean;
    evidence?: LocalAudioEvidence;
  };
}

export type IndicatorStrength = "weak" | "moderate" | "strong";
export interface DetectionIndicator {
  indicator: string;
  location?: string;
  strength: IndicatorStrength;
}

/** One detection question (AI generation OR manipulation), answered separately and calibrated by the server. */
export interface DetectionAssessment {
  verdict: "likely" | "possible" | "inconclusive" | "no_indicators_found";
  /** Calibrated 0–100 likelihood; null when no model ran. */
  probability: number | null;
  /** How much the evidence supports the verdict (agreement + indicator quality), 0–100. */
  confidence: number | null;
  indicators: DetectionIndicator[];
  counterIndicators: string[];
  rationale: string;
  /** Raw per-sample probabilities from independent model runs (for transparency). */
  samples?: number[];
}

/** Embedded provenance metadata (C2PA Content Credentials / IPTC digital source type). */
export interface ProvenanceInfo {
  verificationStatus?: 'validated' | 'invalid' | 'unavailable';
  verified?: boolean;
  c2paManifest: boolean;
  declaresAIGenerated: boolean;
  generatorHints: string[];
}

export type AnalysisEngine =
  | "gemini"
  | "heuristic"
  | "simulated_demo"
  | "graph_heuristics"
  | "model_adapter"
  | "local_pretrained"
  | "local_image_screening"
  | "local_aasist"
  | "local_video_frames";

export interface GroundedSource {
  id?: string;
  provider?: string;
  publisher?: string;
  publisherRating?: string;
  language?: string;
  license?: string;
  relevance?: { lexicalScore: number; semanticScore: number | null; rank: number };
  review?: {
    quote: string;
    contextConfirmed: boolean;
    reviewedBy: string;
    reviewedAt: string;
    claim: string;
    note: string;
  };
  title: string;
  url: string;
  domain: string;
  publishDate?: string;
  excerpt: string;
  stance: "supports" | "contradicts" | "mixed" | "neutral";
  credibilityRating:
    | "High Authority"
    | "Established News"
    | "Independent / Regional"
    | "Unverified Source";
  isSimulated?: boolean;
  /** Search grounding only: the passage of the model's answer this source was cited for. */
  citedFor?: string;
  /** Search grounding only: when the source was retrieved (the API does not provide publication dates). */
  retrievedAt?: string;
}

/** How a claim result was produced â€” shown to the user so verified results are never confused with AI opinion. */
export type VerificationMode =
  | "search_grounded"
  | "ai_knowledge_only"
  | "insufficient_external_evidence"
  | "rule_based"
  | "simulated_demo"
  | "analyst_reviewed";

/** search-verified outcomes vs. what the model merely finds plausible. */
export type ClaimAssessment =
  | "verified_true"
  | "verified_false"
  | "verified_mixed"
  | "plausible"
  | "implausible"
  | "unverified";

export interface ClaimVerificationResult {
  analysis?:AnalysisDiagnostics;
  normalizedClaim?: string;
  verificationStatus?:
    | "SUPPORTED"
    | "CONTRADICTED"
    | "INSUFFICIENT_EVIDENCE"
    | "CONFLICTING_EVIDENCE"
    | "UNAVAILABLE";
  missingEvidence?: string[];
  claimAnalysis?: {
    normalized: string;
    language: string;
    languages: string[];
    assertions: string[];
    extraction: string;
    truncated: boolean;
    entityCandidates: string[];
    entityMethod: string;
    negationMarkers: string[];
    ambiguities: string[];
  };
  retrievalDetails?: {
    candidateCount?:number;
    omittedCount?:number;
    embeddingDiagnostics?:{cacheHits:number;uniqueMisses:number;deduplicatedInputs:number;requests:number}|null;
    providers: {
      provider: string;
      status: "unconfigured" | "available" | "unavailable";
      retrieved: number;
      detail: string;
    }[];
    duplicatesRemoved: number;
    semanticMeasured: boolean;
    elapsedMs: number;
    processRssBytes: number;
    queries: string[];
  };
  originalInput: string;
  extractedClaims: string[];
  targetClaim: string;
  verdict: VerificationVerdict;
  confidenceScore: number | null; // null when not independently estimated
  verdictRationale: string;
  sources: GroundedSource[];
  supportingCount: number;
  contradictingCount: number;
  neutralCount: number;
  factCheckerConsensus?: string;
  limitations: string[];
  timestamp: string;
  engine?: AnalysisEngine;
  engineNote?: string;
  supportingEvidence?: string[];
  contradictingEvidence?: string[];
  detectedLanguage?: string;
  translatedText?: string;
  isSimulated?: boolean;
  verificationMode?: VerificationMode;
  assessment?: ClaimAssessment;
  /** Explains why the confidence was capped (e.g. model knowledge only). */
  confidenceNote?: string;
  searchQueries?: string[];
  modelUsed?: string;
  evidenceSufficiency?: string;
  retrieval?: { lexical: string; semantic: string; source: string };
}

export interface SocialPostNode {
  postingStats?: { totalPosts: number; peakPostsPerMinute: number; countZScore: number };
  posts?: { id?: string; timestamp: string; content: string }[];
  id: string;
  accountHandle: string;
  displayName: string;
  avatarSeed: string;
  accountAgeDays: number;
  followerCount: number;
  timestamp: string; // ISO string
  content: string;
  urls: string[];
  hashtags: string[];
  clusterId: number;
  botLikelihoodScore: number | null; // legacy field; null when no bot model ran
  amplificationWeight: number; // size on graph
  language?: string;
  suspicious?: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  weight: number; // 0 - 1
  coordinationType:
    | "semantic_copy"
    | "temporal_burst"
    | "shared_url"
    | "hashtag_cascade"
    | "retweet_ring";
  description: string;
}

export interface CampaignCluster {
  id: number;
  name: string;
  color: string;
  postCount: number;
  accountCount: number;
  primaryNarrative: string;
  burstDurationMinutes: number;
  coordinationScore: number; // 0 - 100
  topSharedDomains: string[];
  topHashtags: string[];
  identifiedTactics: string[];
}

export interface CampaignAnalysisResult {
  analysis?:AnalysisDiagnostics;
  algorithm?:'density_baseline_v1'|'episodes_v1';
  episodeEvidence?:import('../server/campaignEpisodes').CampaignEpisodeEvidence;
  embeddingCompatibility?:{status:'available'|'unavailable';format:string;modelId:string;version:string;usedForAdmissions:false;detail:string};
  classification?:
    | "Organic viral activity"
    | "Legitimate coordinated campaign"
    | "Suspicious coordinated amplification"
    | "Insufficient evidence";
  methodology?: string;
  candidatePairs?: number;
  truncated?: boolean;
  datasetName: string;
  totalPosts: number;
  totalAccounts: number;
  overallCoordinationIndex: number | null; // legacy index; null for multi-signal DBSCAN
  clusters: CampaignCluster[];
  nodes: SocialPostNode[];
  edges: NetworkEdge[];
  burstTimestamps: { time: string; count: number; clusterId: number }[];
  tacticalSummary: string[];
  alternativeExplanations: string[];
  timestamp: string;
  suspiciousPostCount?: number;
  languageBreakdown?: { language: string; count: number }[];
  engine?: AnalysisEngine;
  isSimulated?: boolean;
}

export interface TimelineEntry {
  time: string;
  label: string;
  severity: "critical" | "high" | "medium" | "info";
  module: string;
}

export interface MultilingualVariant {
  language: "English" | "Hindi" | "Telugu" | string;
  original: string;
  translation: string;
  posts: number;
}

export interface LiveEvent {
  id: string;
  ts: string;
  platform: string;
  handle: string;
  language: string;
  text: string;
  kind: "post" | "alert";
  severity: "critical" | "high" | "medium" | "info";
  alertType?:
    | "suspicious_media"
    | "claim_contradicted"
    | "campaign_detected"
    | "similar_content"
    | "propagation_burst"
    | "system";
  title?: string;
  investigationId?: string;
  isSimulated: boolean;
}

export interface Investigation {
  ownerId?: string;
  id: string;
  title: string;
  caseNumber: string;
  targetSubject: string;
  modality: ModalityType;
  status: "In Progress" | "Verified" | "Suspicious" | "Critical Flag" | "Archived";
  riskLevel: RiskLevel;
  createdAt: string;
  updatedAt: string;
  analyst: string;
  tags: string[];
  description: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaName?: string;
  forensicResult?: ForensicAnalysisResult;
  claimResult?: ClaimVerificationResult;
  campaignResult?: CampaignAnalysisResult;
  notes?: string;
  isSimulatedDemo?: boolean;
  mediaFindings?: ForensicAnalysisResult[];
  claimResults?: ClaimVerificationResult[];
  timeline?: TimelineEntry[];
  multilingual?: MultilingualVariant[];
  summary?: string;
}

export interface ModelRegistryItem {
  id: string;
  name: string;
  task: string;
  architecture: string;
  license: string;
  version: string;
  status: "ONLINE" | "STANDBY" | "DEGRADED";
  inferenceLatencyAvg: string;
  accuracyBenchmark: string;
  description: string;
}
