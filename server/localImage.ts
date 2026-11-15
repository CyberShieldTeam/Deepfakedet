import type { ForensicAnalysisResult } from '../src/types';

export interface LocalImageResponse {
  classification: 'INCONCLUSIVE';
  fake_probability: number | null;
  model_confidence: number | null;
  model_status: 'ready' | 'unavailable' | 'skipped';
  model: string;
  revision: string;
  scope: 'general_ai_generated_image';
  face_analysis: 'not_performed' | 'none_found' | 'candidate_regions';
  face_boxes: { x: number; y: number; width: number; height: number; confidence: number }[];
  face_model?: { status: 'ready' | 'unavailable' | 'not_applicable'; model: string; revision: string; faces: { boxIndex: number; rawFakeSoftmax: number }[]; note: string };
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
  if (value.classification !== 'INCONCLUSIVE' ||
      value.scope !== 'general_ai_generated_image' || !value.model || !value.revision ||
      !['ready', 'unavailable', 'skipped'].includes(value.model_status) ||
      !['not_performed', 'none_found', 'candidate_regions'].includes(value.face_analysis) ||
      !Array.isArray(value.face_boxes) || !Array.isArray(value.signals) ||
      typeof value.processing_ms !== 'number' || !Number.isFinite(value.processing_ms) || value.processing_ms < 0 ||
      (value.model_status !== 'ready' && value.fake_probability !== null) ||
      (value.fake_probability !== null && (!Number.isFinite(value.fake_probability) || value.fake_probability < 0 || value.fake_probability > 1))) {
    throw new Error('Invalid local image model response');
  }
  if (value.face_model && (!['ready', 'unavailable', 'not_applicable'].includes(value.face_model.status) ||
      !value.face_model.model || !value.face_model.revision || typeof value.face_model.note !== 'string' ||
      !Array.isArray(value.face_model.faces) || value.face_model.faces.length > 3 ||
      value.face_model.faces.some(face => !Number.isInteger(face.boxIndex) || face.boxIndex < 0 ||
        face.boxIndex >= value.face_boxes.length || !Number.isFinite(face.rawFakeSoftmax) ||
        face.rawFakeSoftmax < 0 || face.rawFakeSoftmax > 1) ||
      (value.face_model.status === 'ready' && value.face_model.faces.length === 0) ||
      (value.face_model.status !== 'ready' && value.face_model.faces.length !== 0)))
    throw new Error('Invalid face-crop model evidence');
  return value;
}

export function localImageResult(raw: LocalImageResponse, fileName: string, measurements: Record<string, any>, signalFindings: string[]): ForensicAnalysisResult {
  const classifierRan = raw.model_status === 'ready';
  return {
    modality: 'image', fileName, engine: classifierRan ? 'local_pretrained' : 'local_image_screening',
    engineNote: classifierRan
      ? `${raw.model}@${raw.revision.slice(0, 12)}; experimental whole-image classifier. ${raw.face_boxes.length} unverified face candidate(s). Model probability is not calibrated confidence.`
      : `Whole-image classifier ${raw.model_status}; ${raw.face_boxes.length} unverified face candidate(s).`,
    authenticity: 'inconclusive',
    confidenceScore: 0, aiGeneratedProbability: null,
    aiGeneration: { verdict: 'inconclusive', probability: null,
      confidence: 0, indicators: [], counterIndicators: [], rationale: raw.explanation },
    headlineSummary: classifierRan ? 'Local model result is inconclusive.' : 'Image authenticity could not be determined.',
    detailedFindings: [...raw.signals, ...signalFindings.map(s => `[Browser signal] ${s}`)],
    limitations: [...(classifierRan ? ['Pretrained classifier failed the initial out-of-domain fixture smoke test; its score cannot establish authenticity.'] : ['Whole-image classifier did not run.']),
      raw.face_model?.status === 'ready' ? 'Face-crop scores are uncalibrated and cannot establish a manipulation verdict.' : 'Face candidates do not establish manipulation or authenticity.',
      'A real-looking result is not proof of authenticity.'],
    alternativeHypotheses: ['Compression, resizing, and newer generators can change classifier output.'],
    compressionArtifacts: { elaScore: Number(measurements.elaScore) || 0, doubleCompressionFound: false,
      noiseInconsistencyMapAvailable: true, notes: 'ELA is a separate browser signal, not evidence for this model score.' },
    modelsUsed: [...(classifierRan ? [{ name: raw.model, version: raw.revision, provider: 'Hugging Face checkpoint (local inference)' }] : []),
      ...(raw.face_analysis !== 'not_performed' ? [{ name: 'YuNet face detector', version: '2023mar', provider: 'OpenCV Zoo' }] : []),
      ...(raw.face_model?.status === 'ready' ? [{ name: raw.face_model.model, version: raw.face_model.revision, provider: 'Experimental face-crop checkpoint; no verdict' }] : [])],
    measurements, analyzedAt: new Date().toISOString(),
    localImage: raw
  };
}
