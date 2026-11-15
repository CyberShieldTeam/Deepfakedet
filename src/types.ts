/**
 * Core type definitions for VERITAS AI - Suraksha Suchan
 * Digital Forensics, Claim Verification & Campaign Intelligence Platform
 */

export type ModalityType = 'image' | 'video' | 'audio' | 'text_claim' | 'social_dataset';

export type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';

export type VerificationVerdict = 'Supported' | 'Contradicted' | 'Mixed Evidence' | 'Insufficient Evidence';

export type MediaAuthenticity = 'likely_synthetic' | 'suspicious_artifacts' | 'inconclusive' | 'likely_authentic';

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
  modality: 'image' | 'video' | 'audio';
  authenticity: MediaAuthenticity;
  confidenceScore: number; // 0 - 100
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
  originalImageProvenance?: { status: 'absent' | 'valid' | 'trusted' | 'invalid' | 'unknown' | 'unavailable'; note: string; aiDeclaration: boolean; claimGenerator?: string | null; exif: { present: boolean; software: string | null } };
  /** Raw local whole-image classifier output; probability is not calibrated confidence. */
  localImage?: { classification: 'REAL' | 'MANIPULATED' | 'INCONCLUSIVE'; fake_probability: number | null; model_confidence: number | null; model_status: 'ready' | 'unavailable' | 'skipped'; model: string; revision: string; scope: string; face_analysis: string; face_boxes: { x: number; y: number; width: number; height: number; confidence: number }[]; face_model?: { status: 'ready' | 'unavailable' | 'not_applicable'; model: string; revision: string; faces: { boxIndex: number; rawFakeSoftmax: number }[]; note: string }; signals: string[]; explanation: string; processing_ms: number };
  /** Experimental AASIST speech anti-spoofing evidence, never a calibrated verdict. */
  localAudio?: { classification: 'INCONCLUSIVE'; model: string; revision: string; scope: 'speech_anti_spoofing'; sample_rate_input: number; sample_rate_model: 16000; duration_seconds: number; segments: { start_seconds: number; end_seconds: number; raw_bonafide_logit: number; raw_spoof_softmax: number }[]; processing_ms: number; explanation: string };
  /** Experimental image evidence from browser-sampled video frames; no video verdict. */
  localVideo?: { scope: 'sampled_video_frames' | 'server_decoded_frames'; frames: { timestampSeconds: number; image: NonNullable<ForensicAnalysisResult['localImage']>; quality?: { laplacianVariance: number; meanLuma: number; clippedFraction: number; selectionScore: number }; temporal?: { status: 'measured' | 'unavailable'; note?: string; startSeconds?: number; endSeconds?: number; scope?: 'adjacent_original_frames'; method?: 'farneback_forward_backward_v1'; medianFlowPixels?: number; p95FlowPixels?: number; meanRoundTripErrorPixels?: number; meanMotionCompensatedResidual?: number; maxTileResidual?: number; validPixelFraction?: number } }[]; samplingNote: string; videoMetadata?: { durationSeconds: number; width: number; height: number }; audioTrack?: { status: 'analyzed' | 'no_audio' | 'model_unavailable' | 'extraction_failed'; note: string; truncated: boolean; evidence?: NonNullable<ForensicAnalysisResult['localAudio']> }; faceContinuity?: { scope: 'geometric_candidate_tracks'; detectorFrames: number; framesWithCandidates: number; candidateCount: number; tracks: { id: number; frameIndices: number[]; timestampsSeconds: number[]; meanDetectorConfidence: number }[] } };
}

export type IndicatorStrength = 'weak' | 'moderate' | 'strong';
export interface DetectionIndicator { indicator: string; location?: string; strength: IndicatorStrength }

/** One detection question (AI generation OR manipulation), answered separately and calibrated by the server. */
export interface DetectionAssessment {
  verdict: 'likely' | 'possible' | 'inconclusive' | 'no_indicators_found';
  /** Calibrated 0–100 likelihood; null when no model ran. */
  probability: number | null;
  /** How much the evidence supports the verdict (agreement + indicator quality), 0–100. */
  confidence: number;
  indicators: DetectionIndicator[];
  counterIndicators: string[];
  rationale: string;
  /** Raw per-sample probabilities from independent model runs (for transparency). */
  samples?: number[];
}

/** Embedded provenance metadata (C2PA Content Credentials / IPTC digital source type). */
export interface ProvenanceInfo {
  c2paManifest: boolean;
  declaresAIGenerated: boolean;
  generatorHints: string[];
  /** Set only after original-file cryptographic verification, never from browser measurements. */
  verificationStatus?: 'validated' | 'invalid' | 'unavailable';
}

export type AnalysisEngine = 'gemini' | 'heuristic' | 'simulated_demo' | 'graph_heuristics' | 'local_pretrained' | 'local_image_screening' | 'local_aasist' | 'local_video_frames';

export interface GroundedSource {
  title: string;
  url: string;
  domain: string;
  publishDate?: string;
  excerpt: string;
  stance: 'supports' | 'contradicts' | 'mixed' | 'neutral';
  credibilityRating: 'High Authority' | 'Established News' | 'Independent / Regional' | 'Unverified Source';
  isSimulated?: boolean;
  /** Search grounding only: the passage of the model's answer this source was cited for. */
  citedFor?: string;
  /** Search grounding only: when the source was retrieved (the API does not provide publication dates). */
  retrievedAt?: string;
}

/** How a claim result was produced — shown to the user so verified results are never confused with AI opinion. */
export type VerificationMode = 'search_grounded' | 'ai_knowledge_only' | 'insufficient_external_evidence' | 'rule_based' | 'simulated_demo';

/** search-verified outcomes vs. what the model merely finds plausible. */
export type ClaimAssessment = 'verified_true' | 'verified_false' | 'verified_mixed' | 'plausible' | 'implausible' | 'unverified';

export interface ClaimVerificationResult {
  originalInput: string;
  extractedClaims: string[];
  targetClaim: string;
  verdict: VerificationVerdict;
  confidenceScore: number; // 0 - 100
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
}

export interface SocialPostNode {
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
  botLikelihoodScore: number; // 0 - 100
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
  coordinationType: 'semantic_copy' | 'temporal_burst' | 'shared_url' | 'hashtag_cascade' | 'retweet_ring';
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
  datasetName: string;
  totalPosts: number;
  totalAccounts: number;
  overallCoordinationIndex: number; // 0 - 100
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
  severity: 'critical' | 'high' | 'medium' | 'info';
  module: string;
}

export interface MultilingualVariant {
  language: 'English' | 'Hindi' | 'Telugu' | string;
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
  kind: 'post' | 'alert';
  severity: 'critical' | 'high' | 'medium' | 'info';
  alertType?: 'suspicious_media' | 'claim_contradicted' | 'campaign_detected' | 'similar_content' | 'propagation_burst' | 'system';
  title?: string;
  investigationId?: string;
  isSimulated: boolean;
}

export interface Investigation {
  id: string;
  title: string;
  caseNumber: string;
  targetSubject: string;
  modality: ModalityType;
  status: 'In Progress' | 'Verified' | 'Suspicious' | 'Critical Flag' | 'Archived';
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
  status: 'ONLINE' | 'STANDBY' | 'DEGRADED';
  inferenceLatencyAvg: string;
  accuracyBenchmark: string;
  description: string;
}
