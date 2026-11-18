import type { ForensicAnalysisResult } from '../src/types';
import {createHash} from 'node:crypto';
import {imageTraceSchema} from './mediaTrace';
import {pythonServiceHeaders} from './pythonService';

export interface LocalImageResponse {
  inputTrace?:import('../src/mediaTraceTypes').ImageInputTrace;
  face_model?: import('../src/types').LocalImageEvidence['face_model'];
  face_manipulation?: import('../src/types').LocalImageEvidence['face_manipulation'];
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
    method: 'POST', headers: pythonServiceHeaders(), redirect:'error',
    body: JSON.stringify({ image_base64: match[1] }), signal: AbortSignal.timeout(45_000)
  });
  if (!response.ok) throw new Error(`Local image service returned HTTP ${response.status}`);
  const value = await response.json() as LocalImageResponse;
  if(value.inputTrace&&(!imageTraceSchema.safeParse(value.inputTrace).success||value.inputTrace.sourceBytes!==Buffer.from(match[1],'base64').length||value.inputTrace.sourceSha256!==createHash('sha256').update(Buffer.from(match[1],'base64')).digest('hex')))throw new Error('Invalid or mismatched image input identity');
  const legacyFace = value.face_model;
  if (legacyFace && (!['ready','unavailable','not_applicable'].includes(legacyFace.status) ||
      !legacyFace.model || !legacyFace.revision || typeof legacyFace.note !== 'string' ||
      !Array.isArray(legacyFace.faces) || legacyFace.faces.length > 10 ||
      (legacyFace.status !== 'ready' && legacyFace.faces.length > 0) ||
      legacyFace.faces.some(f => !Number.isInteger(f.boxIndex) || f.boxIndex < 0 || f.boxIndex >= value.face_boxes?.length ||
        !Number.isFinite(f.rawFakeSoftmax) || f.rawFakeSoftmax < 0 || f.rawFakeSoftmax > 1)))
    throw new Error('Invalid legacy face evidence');
  const face = value.face_manipulation;
  if (face && (face.classification !== 'INCONCLUSIVE' ||
      !['unavailable', 'analyzed', 'no_faces', 'no_usable_faces', 'failed'].includes(face.status) ||
      !face.model || !face.revision || typeof face.note !== 'string' || !Array.isArray(face.faces) ||
      face.faces.length > 10 || (face.status !== 'analyzed' && face.faces.length > 0) ||
      face.faces.some(f => !Number.isInteger(f.face_index) || f.face_index < 0 ||
        f.face_index >= value.face_boxes?.length || !Array.isArray(f.crop_bounds) || f.crop_bounds.length !== 4 ||
        f.crop_bounds.some(n => !Number.isFinite(n) || n < 0) ||
        f.crop_bounds[2] <= f.crop_bounds[0] || f.crop_bounds[3] <= f.crop_bounds[1] ||
        !Number.isFinite(f.raw_fake_score) || f.raw_fake_score < 0 || f.raw_fake_score > 1)))
    throw new Error('Invalid face classifier evidence');
  if (value.classification !== 'INCONCLUSIVE' ||
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
  const decisionProbability = null;
  const faceRan = raw.face_manipulation?.status === 'analyzed';
  return {
    modality: 'image', fileName, engine: classifierRan ? 'local_pretrained' : 'local_image_screening',
    engineNote: classifierRan
      ? `${raw.model}@${raw.revision.slice(0, 12)}; experimental whole-image classifier. ${raw.face_boxes.length} unverified face candidate(s). Face classifier: ${raw.face_manipulation?.status || 'unavailable'}. Model probability is not calibrated confidence.`
      : `Whole-image classifier ${raw.model_status}; ${raw.face_boxes.length} unverified face candidate(s). Face classifier: ${raw.face_manipulation?.status || 'unavailable'}.`,
    authenticity: 'inconclusive',
    confidenceScore: 0, aiGeneratedProbability: decisionProbability,
    aiGeneration: { verdict: 'inconclusive', probability: decisionProbability,
      confidence: 0, indicators: [], counterIndicators: [], rationale: raw.explanation },
    headlineSummary: classifierRan ? 'Local model result is inconclusive.' : 'Image authenticity could not be determined.',
    detailedFindings: [...raw.signals, ...(faceRan ? ['Experimental face classifier ran; scores do not determine authenticity.'] : []), ...signalFindings.map(s => `[Browser signal] ${s}`)],
    limitations: [...(classifierRan ? ['Pretrained classifier failed the initial out-of-domain fixture smoke test; its score cannot establish authenticity.'] : ['Whole-image classifier did not run.']),
      'Face candidates do not establish manipulation or authenticity.', 'A real-looking result is not proof of authenticity.'],
    alternativeHypotheses: ['Compression, resizing, and newer generators can change classifier output.'],
    compressionArtifacts: { elaScore: Number(measurements.elaScore) || 0, doubleCompressionFound: false,
      noiseInconsistencyMapAvailable: true, notes: 'ELA is a separate browser signal, not evidence for this model score.' },
    modelsUsed: [...(faceRan ? [{ name: raw.face_manipulation!.model, version: raw.face_manipulation!.revision, provider: 'Experimental face-crop inference' }] : raw.face_model?.status === 'ready' ? [{ name: raw.face_model.model, version: raw.face_model.revision, provider: 'Experimental face-crop inference' }] : []), ...(classifierRan ? [{ name: raw.model, version: raw.revision, provider: 'Hugging Face checkpoint (local inference)' }] : []),
      ...(raw.face_analysis !== 'not_performed' ? [{ name: 'YuNet face detector', version: '2023mar', provider: 'OpenCV Zoo' }] : [])],
    measurements, analyzedAt: new Date().toISOString(),
    localImage: raw
  };
}
