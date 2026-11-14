import type { ForensicAnalysisResult } from '../src/types';
import { callLocalImage, type LocalImageResponse } from './localImage';

export interface SampledVideoFrame { timestampSeconds: number; imageData: string }
export interface LocalVideoEvidence {
  scope: 'sampled_video_frames';
  frames: { timestampSeconds: number; image: LocalImageResponse }[];
  samplingNote: string;
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
  return {
    modality: 'video', fileName, engine: 'local_video_frames',
    engineNote: `${evidence.frames.length} browser-sampled frame(s) screened locally. Image-model scores are experimental and cannot determine video authenticity.`,
    authenticity: 'inconclusive', confidenceScore: 0, aiGeneratedProbability: null,
    headlineSummary: 'Frame-level evidence is available, but video authenticity is undetermined.',
    detailedFindings: [`Screened ${evidence.frames.length} sampled frame(s).`, ...signalFindings.map(s => `[Browser signal] ${s}`)],
    limitations: ['Frames were sampled and JPEG-compressed in the browser; the original video was not decoded by the server.',
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
