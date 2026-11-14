import type { ForensicAnalysisResult } from '../src/types';

export interface LocalAudioResponse {
  classification: 'INCONCLUSIVE';
  model: string;
  revision: string;
  scope: 'speech_anti_spoofing';
  sample_rate_input: number;
  sample_rate_model: 16000;
  duration_seconds: number;
  segments: { start_seconds: number; end_seconds: number; raw_bonafide_logit: number; raw_spoof_softmax: number }[];
  processing_ms: number;
  explanation: string;
}

export async function callLocalAudio(mediaData: string, endpoint: string, fetcher: typeof fetch = fetch): Promise<LocalAudioResponse> {
  const match = /^data:audio\/[\w.+-]+;base64,([A-Za-z0-9+/=]+)$/.exec(mediaData);
  if (!match || match[1].length > 17_000_000) throw new Error('Unsupported or oversized audio data');
  const response = await fetcher(`${endpoint.replace(/\/$/, '')}/v1/audio/analyze`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_base64: match[1] }), signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`Local audio service returned HTTP ${response.status}`);
  const value = await response.json() as LocalAudioResponse;
  if (value.classification !== 'INCONCLUSIVE' || value.scope !== 'speech_anti_spoofing' ||
      value.model !== 'clovaai/aasist' || !value.revision || value.sample_rate_model !== 16000 ||
      !Number.isFinite(value.sample_rate_input) || value.sample_rate_input < 8000 ||
      !Number.isFinite(value.duration_seconds) || value.duration_seconds < 0 || value.duration_seconds > 60 ||
      !Number.isFinite(value.processing_ms) || value.processing_ms < 0 || !Array.isArray(value.segments) ||
      value.segments.length > 15 || value.segments.some(s => !Number.isFinite(s.start_seconds) ||
        !Number.isFinite(s.end_seconds) || s.start_seconds < 0 || s.end_seconds <= s.start_seconds ||
        s.end_seconds > value.duration_seconds + 0.01 || !Number.isFinite(s.raw_bonafide_logit) ||
        !Number.isFinite(s.raw_spoof_softmax) || s.raw_spoof_softmax < 0 || s.raw_spoof_softmax > 1)) {
    throw new Error('Invalid local audio model response');
  }
  return value;
}

export function localAudioResult(raw: LocalAudioResponse, fileName: string, measurements: Record<string, any>, signalFindings: string[]): ForensicAnalysisResult {
  return {
    modality: 'audio', fileName, engine: 'local_aasist',
    engineNote: `${raw.model}@${raw.revision.slice(0, 12)}; speech anti-spoofing only. Raw per-segment scores are uncalibrated and do not determine authenticity.`,
    authenticity: 'inconclusive', confidenceScore: 0, aiGeneratedProbability: null,
    headlineSummary: 'AASIST segment scores are available, but audio authenticity is undetermined.',
    detailedFindings: [`AASIST scored ${raw.segments.length} audio segment(s).`, ...signalFindings.map(s => `[Browser signal] ${s}`)],
    limitations: ['AASIST was trained for speech anti-spoofing; it does not detect arbitrary synthetic sounds.',
      'Raw segment softmax values are not calibrated probabilities or a verdict.',
      'Silence was skipped; speech presence was not verified.'],
    alternativeHypotheses: ['Recording channel, compression, background noise, and new synthesis methods can alter scores.'],
    compressionArtifacts: { elaScore: 0, doubleCompressionFound: false, noiseInconsistencyMapAvailable: false,
      notes: 'Image compression analysis does not apply to audio.' },
    modelsUsed: [{ name: 'AASIST', version: raw.revision, provider: 'NAVER Clova AI (local inference)' }],
    measurements, analyzedAt: new Date().toISOString(), localAudio: raw
  };
}
