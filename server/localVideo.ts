import type { ForensicAnalysisResult } from '../src/types';
import { callLocalImage, type LocalImageResponse } from './localImage';

export interface SampledVideoFrame { timestampSeconds: number; imageData: string }
export interface LocalVideoEvidence {
  scope: 'sampled_video_frames' | 'server_decoded_frames';
  frames: { timestampSeconds: number; image: LocalImageResponse }[];
  samplingNote: string;
  videoMetadata?: { durationSeconds: number; width: number; height: number };
}

export async function callLocalVideo(mediaData: string, endpoint: string, fetcher: typeof fetch = fetch): Promise<LocalVideoEvidence> {
  const match = /^data:video\/(?:mp4|quicktime|webm);base64,([A-Za-z0-9+/=]+)$/.exec(mediaData);
  if (!match || match[1].length > 4 * Math.ceil(8 * 1024 * 1024 / 3))
    throw new Error('Unsupported or oversized original video');
  const response = await fetcher(`${endpoint.replace(/\/$/, '')}/v1/video/analyze`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_base64: match[1] }), signal: AbortSignal.timeout(120_000)
  });
  if (!response.ok) throw new Error(`Local video service returned HTTP ${response.status}`);
  const value = await response.json() as LocalVideoEvidence;
  if (value.scope !== 'server_decoded_frames' || !Array.isArray(value.frames) ||
      value.frames.length < 1 || value.frames.length > 6 || typeof value.samplingNote !== 'string' ||
      !value.videoMetadata || !Number.isFinite(value.videoMetadata.durationSeconds) ||
      !Number.isFinite(value.videoMetadata.width) || !Number.isFinite(value.videoMetadata.height) ||
      value.frames.some((frame, i) => !Number.isFinite(frame.timestampSeconds) || frame.timestampSeconds < 0 ||
        (i > 0 && frame.timestampSeconds <= value.frames[i - 1].timestampSeconds) ||
        frame.image?.classification !== 'INCONCLUSIVE' || !['ready', 'unavailable', 'skipped'].includes(frame.image?.model_status)))
    throw new Error('Invalid local video service response');
  return value;
}

export async function callLocalVideoFrames(input: unknown, endpoint: string, fetcher: typeof fetch = fetch): Promise<LocalVideoEvidence> {
  if (!Array.isArray(input) || input.length === 0 || input.length > 6)
    throw new Error('Expected 1–6 sampled video frames');
  let previous = -1;
  const candidates = input as SampledVideoFrame[];
  for (const frame of candidates) {
    if (!frame || !Number.isFinite(frame.timestampSeconds) || frame.timestampSeconds < 0 ||
        frame.timestampSeconds <= previous || frame.timestampSeconds > 7200 || typeof frame.imageData !== 'string')
      throw new Error('Invalid sampled video timestamp or image data');
    previous = frame.timestampSeconds;
  }
  const frames: LocalVideoEvidence['frames'] = [];
  for (const frame of candidates) {
    const image = await callLocalImage(frame.imageData, endpoint, fetcher);
    // This image checkpoint is quarantined. Frame evidence cannot become a video verdict.
    frames.push({ timestampSeconds: frame.timestampSeconds, image });
  }
  return { scope: 'sampled_video_frames', frames,
    samplingNote: 'Browser-sampled JPEG frames at 480 px width; the original video was not decoded by the server.' };
}

export function localVideoResult(evidence: LocalVideoEvidence, fileName: string, measurements: Record<string, any>, signalFindings: string[]): ForensicAnalysisResult {
  const firstModel = evidence.frames.find(frame => frame.image.model_status === 'ready')?.image;
  const faceDetectorRan = evidence.frames.some(frame => frame.image.face_analysis !== 'not_performed');
  const source = evidence.scope === 'server_decoded_frames' ? 'original-video' : 'browser-sampled';
  return {
    modality: 'video', fileName, engine: 'local_video_frames',
    engineNote: `${evidence.frames.length} ${source} frame(s) screened locally. Image-model scores are experimental and cannot determine video authenticity.`,
    authenticity: 'inconclusive', confidenceScore: 0, aiGeneratedProbability: null,
    headlineSummary: 'Frame-level evidence is available, but video authenticity is undetermined.',
    detailedFindings: [`Screened ${evidence.frames.length} sampled frame(s).`, ...signalFindings.map(s => `[Browser signal] ${s}`)],
    limitations: [evidence.scope === 'server_decoded_frames'
      ? 'Only sampled, resized JPEG frames were screened; the full video was not analyzed.'
      : 'Frames were sampled and JPEG-compressed in the browser; the original video was not decoded by the server.',
      'The whole-image checkpoint failed an initial out-of-domain smoke check; raw scores cannot establish authenticity.',
      'No face-manipulation classifier, video audio extraction, or temporal model was run.'],
    alternativeHypotheses: ['Cuts, compression, and changes in lighting can alter frame-level signals.'],
    compressionArtifacts: { elaScore: 0, doubleCompressionFound: false, noiseInconsistencyMapAvailable: false,
      notes: 'No image ELA was performed on the video frames.' },
    modelsUsed: [...(firstModel ? [{ name: firstModel.model, version: firstModel.revision, provider: 'Experimental local image checkpoint; no verdict' }] : []),
      ...(faceDetectorRan ? [{ name: 'YuNet face detector', version: '2023mar', provider: 'OpenCV Zoo' }] : [])],
    measurements, analyzedAt: new Date().toISOString(), localVideo: evidence
  };
}
