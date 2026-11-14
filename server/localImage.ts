import type { ForensicAnalysisResult } from '../src/types';

export interface LocalImageResponse {
  classification: 'REAL' | 'MANIPULATED' | 'INCONCLUSIVE';
  fake_probability: number | null;
  model_confidence: number | null;
  model_status: 'ready' | 'unavailable' | 'skipped';
  model: string;
  revision: string;
  scope: 'general_ai_generated_image';
  face_analysis: 'not_performed' | 'none_found' | 'candidate_regions';
  face_boxes: { x: number; y: number; width: number; height: number; confidence: number }[];
  signals: string[];
  explanation: string;
  processing_ms: number;
}

export async function callLocalImage(mediaData: string, endpoint: string, fetcher: typeof fetch = fetch): Promise<LocalImageResponse> {
  const match = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(mediaData);
  if (!match || match[1].length > 14_000_000) throw new Error('Unsupported or oversized image data');
  const response = await fetcher(`${endpoint.replace(/\/$/, '')}/v1/image/analyze`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: match[1] }), signal: AbortSignal.timeout(45_000)
  });
  if (!response.ok) throw new Error(`Local image service returned HTTP ${response.status}`);
  const value = await response.json() as LocalImageResponse;
  if (!['REAL', 'MANIPULATED', 'INCONCLUSIVE'].includes(value.classification) ||
      value.scope !== 'general_ai_generated_image' || !value.model || !value.revision ||
      !['ready', 'unavailable', 'skipped'].includes(value.model_status) ||
      !['not_performed', 'none_found', 'candidate_regions'].includes(value.face_analysis) ||
      !Array.isArray(value.face_boxes) || !Array.isArray(value.signals) ||
      typeof value.processing_ms !== 'number' || !Number.isFinite(value.processing_ms) || value.processing_ms < 0 ||
      (value.model_status !== 'ready' && (value.classification !== 'INCONCLUSIVE' || value.fake_probability !== null)) ||
      (value.classification !== 'INCONCLUSIVE' && value.fake_probability === null) ||
      (value.fake_probability !== null && (!Number.isFinite(value.fake_probability) || value.fake_probability < 0 || value.fake_probability > 1))) {
    throw new Error('Invalid local image model response');
  }
  return value;
}

export function localImageResult(raw: LocalImageResponse, fileName: string, measurements: Record<string, any>, signalFindings: string[]): ForensicAnalysisResult {
  const classifierRan = raw.model_status === 'ready';
  const suspicious = raw.classification === 'MANIPULATED';
  const clean = raw.classification === 'REAL';
  const probability = raw.fake_probability === null ? null : Math.round(raw.fake_probability * 100);
  const decisionProbability = raw.classification === 'INCONCLUSIVE' ? null : probability;
  return {
    modality: 'image', fileName, engine: classifierRan ? 'local_pretrained' : 'local_image_screening',
    engineNote: classifierRan
      ? `${raw.model}@${raw.revision.slice(0, 12)}; experimental whole-image classifier. ${raw.face_boxes.length} unverified face candidate(s); face manipulation was not checked. Model probability is not calibrated confidence.`
      : `Whole-image classifier ${raw.model_status}; ${raw.face_boxes.length} unverified face candidate(s). Face manipulation was not checked.`,
    authenticity: suspicious ? 'likely_synthetic' : clean ? 'likely_authentic' : 'inconclusive',
    confidenceScore: 0, aiGeneratedProbability: decisionProbability,
    aiGeneration: { verdict: suspicious ? 'likely' : clean ? 'no_indicators_found' : 'inconclusive', probability: decisionProbability,
      confidence: 0, indicators: [], counterIndicators: [], rationale: raw.explanation },
    headlineSummary: suspicious ? 'Local model flagged possible AI generation.' : clean ? 'Local model found no strong AI-generation signal.' : classifierRan ? 'Local model result is inconclusive.' : 'Image authenticity could not be determined.',
    detailedFindings: [...raw.signals, ...signalFindings.map(s => `[Browser signal] ${s}`)],
    limitations: [...(classifierRan ? ['Pretrained classifier failed the initial out-of-domain fixture smoke test; its score cannot establish authenticity.'] : ['Whole-image classifier did not run.']),
      'Face candidates do not establish manipulation or authenticity.', 'A real-looking result is not proof of authenticity.'],
    alternativeHypotheses: ['Compression, resizing, and newer generators can change classifier output.'],
    compressionArtifacts: { elaScore: Number(measurements.elaScore) || 0, doubleCompressionFound: false,
      noiseInconsistencyMapAvailable: true, notes: 'ELA is a separate browser signal, not evidence for this model score.' },
    modelsUsed: [...(classifierRan ? [{ name: raw.model, version: raw.revision, provider: 'Hugging Face checkpoint (local inference)' }] : []),
      ...(raw.face_analysis !== 'not_performed' ? [{ name: 'YuNet face detector', version: '2023mar', provider: 'OpenCV Zoo' }] : [])],
    measurements, analyzedAt: new Date().toISOString(),
    localImage: raw
  };
}
