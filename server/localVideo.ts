import type { ForensicAnalysisResult } from '../src/types';
import {createHash} from 'node:crypto';
import {imageTraceSchema,audioTraceSchema} from './mediaTrace';
import { callLocalImage, type LocalImageResponse } from './localImage';
import type { LocalAudioResponse } from './localAudio';
import { computeFaceContinuity, type FaceContinuity } from './videoFaces';

export interface SampledVideoFrame { timestampSeconds: number; imageData: string }
export interface FrameQuality { laplacianVariance: number; meanLuma: number; clippedFraction: number; selectionScore: number }
export interface TemporalMeasurement {
  status: 'measured' | 'unavailable';
  note?: string;
  startSeconds?: number;
  endSeconds?: number;
  scope?: 'adjacent_original_frames';
  method?: 'farneback_forward_backward_v1';
  medianFlowPixels?: number;
  p95FlowPixels?: number;
  meanRoundTripErrorPixels?: number;
  meanMotionCompensatedResidual?: number;
  maxTileResidual?: number;
  validPixelFraction?: number;
}
export interface VideoAudioTrack {
  sourceVideoSha256?:string;extractedAudioSha256?:string;
  status: 'analyzed' | 'no_audio' | 'model_unavailable' | 'extraction_failed';
  note: string;
  truncated: boolean;
  evidence?: LocalAudioResponse;
}
export interface TemporalInterval {
  startSeconds:number; endSeconds:number; observation:string;
  analysisWidth:number; analysisHeight:number;
  medianFlowPixels:number; meanRoundTripErrorPixels:number; maxTileResidual:number;
  regions:{x:number;y:number;width:number;height:number;residual:number}[];
}
export interface TemporalDiagnostics {
  status:'measured'|'partial'|'insufficient_evidence'|'timed_out'|'failed';
  classification:'INCONCLUSIVE'; decisionProbability:null; method:'bounded_farneback_v1';
  intervals:TemporalInterval[];sampledFrames:number;processedPairs:number;note:string;
  requestedIntervalSeconds?:number;effectiveIntervalSeconds?:number;durationSeconds?:number;
  sourceFrameCount?:number;elapsedSeconds?:number;peakWorkingSetBytes?:number|null;
  sourceFrameRate?:number;sourceWidth?:number;sourceHeight?:number;sourceFourcc?:number;
}
export function validateTemporalDiagnostics(d:TemporalDiagnostics):boolean {
  if(!d || !['measured','partial','insufficient_evidence','timed_out','failed'].includes(d.status) ||
    d.classification!=='INCONCLUSIVE' || d.decisionProbability!==null || d.method!=='bounded_farneback_v1' ||
    typeof d.note!=='string' || !Array.isArray(d.intervals) || d.intervals.length>24 ||
    !Number.isInteger(d.sampledFrames) || d.sampledFrames<0 || d.sampledFrames>25 ||
    d.processedPairs!==d.intervals.length || d.processedPairs>Math.max(0,d.sampledFrames-1)) return false;
  if(['failed','timed_out'].includes(d.status)) return d.intervals.length===0;
  const metadata=[d.sourceFrameRate,d.sourceWidth,d.sourceHeight,d.sourceFourcc];
  if(metadata.some(v=>v!==undefined) && (metadata.some(v=>!Number.isFinite(v) || v!<=0) ||
    !Number.isInteger(d.sourceWidth) || !Number.isInteger(d.sourceHeight) || !Number.isInteger(d.sourceFourcc) ||
    d.sourceWidth!*d.sourceHeight!>1920*1080)) return false;
  if(!Number.isFinite(d.durationSeconds) || d.durationSeconds!<=0 || d.durationSeconds!>120 ||
    !Number.isFinite(d.effectiveIntervalSeconds) || d.effectiveIntervalSeconds!<=0 ||
    !Number.isInteger(d.sourceFrameCount) || d.sourceFrameCount!<1 || d.sourceFrameCount!>3600) return false;
  const observations=['scene_transition_candidate','insufficient_light','insufficient_texture','motion_ambiguous',
    'localized_change_candidate','coherent_motion','no_localized_change_observed'];
  return d.intervals.every((r,i)=>r && observations.includes(r.observation) &&
    [r.startSeconds,r.endSeconds,r.medianFlowPixels,r.meanRoundTripErrorPixels,r.maxTileResidual].every(n=>Number.isFinite(n)&&n>=0) &&
    r.endSeconds>r.startSeconds && r.endSeconds<=d.durationSeconds! && (i===0 || r.startSeconds>=d.intervals[i-1].endSeconds) &&
    Number.isInteger(r.analysisWidth) && Number.isInteger(r.analysisHeight) &&
    r.analysisWidth>0 && r.analysisHeight>0 && r.analysisWidth<=480 && r.analysisHeight<=480 &&
    Array.isArray(r.regions) && r.regions.length<=3 && r.regions.every(b=>
      [b.x,b.y,b.width,b.height,b.residual].every(n=>Number.isFinite(n)&&n>=0) &&
      b.width>0 && b.height>0 && b.x+b.width<=r.analysisWidth && b.y+b.height<=r.analysisHeight && b.residual<=255));
}
export interface LocalVideoEvidence {
  sourceSha256?:string;
  scope: 'sampled_video_frames' | 'server_decoded_frames';
  frames: { timestampSeconds: number; image: LocalImageResponse; quality?: FrameQuality; temporal?: TemporalMeasurement }[];
  samplingNote: string;
  videoMetadata?: { durationSeconds: number; width: number; height: number };
  audioTrack?: VideoAudioTrack;
  faceContinuity?: FaceContinuity;
  temporalDiagnostics?:TemporalDiagnostics;
}

export async function callLocalVideo(mediaData: string, endpoint: string, fetcher: typeof fetch = fetch, interval=1): Promise<LocalVideoEvidence> {
  const match = /^data:video\/(?:mp4|quicktime|webm);base64,([A-Za-z0-9+/=]+)$/.exec(mediaData);
  if (!match || match[1].length > 4 * Math.ceil(8 * 1024 * 1024 / 3))
    throw new Error('Unsupported or oversized original video');
  const response = await fetcher(`${endpoint.replace(/\/$/, '')}/v1/video/analyze`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_base64: match[1], temporal_interval_seconds:interval }), signal: AbortSignal.timeout(120_000)
  });
  if (!response.ok) throw new Error(`Local video service returned HTTP ${response.status}`);
  const value = await response.json() as LocalVideoEvidence;
  if(value.sourceSha256&&value.sourceSha256!==createHash('sha256').update(Buffer.from(match[1],'base64')).digest('hex'))throw new Error('Mismatched original-video identity');
  if(value.audioTrack?.sourceVideoSha256&&value.audioTrack.sourceVideoSha256!==createHash('sha256').update(Buffer.from(match[1],'base64')).digest('hex'))throw new Error('Mismatched audio-track parent identity');
  if(value.frames?.some(f=>f.image?.inputTrace&&!imageTraceSchema.safeParse(f.image.inputTrace).success))throw new Error('Invalid decoded-frame input identity');
  if(value.audioTrack?.evidence?.inputTrace&&(!audioTraceSchema.safeParse(value.audioTrack.evidence.inputTrace).success||value.audioTrack.extractedAudioSha256!==value.audioTrack.evidence.inputTrace.sourceSha256))throw new Error('Invalid extracted-audio identity');
  if(value.temporalDiagnostics && !validateTemporalDiagnostics(value.temporalDiagnostics))
    throw new Error('Invalid bounded temporal diagnostics');
  if (value.scope !== 'server_decoded_frames' || !Array.isArray(value.frames) ||
      value.frames.length < 1 || value.frames.length > 6 || typeof value.samplingNote !== 'string' ||
      !value.videoMetadata || !Number.isFinite(value.videoMetadata.durationSeconds) ||
      !Number.isFinite(value.videoMetadata.width) || !Number.isFinite(value.videoMetadata.height) ||
      value.frames.some((frame, i) => !Number.isFinite(frame.timestampSeconds) || frame.timestampSeconds < 0 ||
        (i > 0 && frame.timestampSeconds <= value.frames[i - 1].timestampSeconds) ||
        frame.image?.classification !== 'INCONCLUSIVE' || !['ready', 'unavailable', 'skipped'].includes(frame.image?.model_status)))
    throw new Error('Invalid local video service response');
  if (value.frames.some(frame => !frame.quality ||
      !Number.isFinite(frame.quality.laplacianVariance) || frame.quality.laplacianVariance < 0 ||
      !Number.isFinite(frame.quality.meanLuma) || frame.quality.meanLuma < 0 || frame.quality.meanLuma > 255 ||
      !Number.isFinite(frame.quality.clippedFraction) || frame.quality.clippedFraction < 0 || frame.quality.clippedFraction > 1 ||
      !Number.isFinite(frame.quality.selectionScore) || frame.quality.selectionScore < 0))
    throw new Error('Invalid local video frame quality');
  if (value.frames.some(frame => !frame.temporal || !['measured', 'unavailable'].includes(frame.temporal.status) ||
      (frame.temporal.status === 'measured' && (frame.temporal.scope !== 'adjacent_original_frames' ||
        frame.temporal.method !== 'farneback_forward_backward_v1' ||
        !Number.isFinite(frame.temporal.startSeconds) || !Number.isFinite(frame.temporal.endSeconds) ||
        frame.temporal.endSeconds! <= frame.temporal.startSeconds! ||
        [frame.temporal.medianFlowPixels, frame.temporal.p95FlowPixels,
         frame.temporal.meanRoundTripErrorPixels, frame.temporal.meanMotionCompensatedResidual,
         frame.temporal.maxTileResidual].some(n => !Number.isFinite(n) || n! < 0) ||
        !Number.isFinite(frame.temporal.validPixelFraction) || frame.temporal.validPixelFraction! <= 0 ||
        frame.temporal.validPixelFraction! > 1)) ||
      (frame.temporal.status === 'unavailable' && typeof frame.temporal.note !== 'string')))
    throw new Error('Invalid local video temporal evidence');
  const audio = value.audioTrack;
  if (!audio || !['analyzed', 'no_audio', 'model_unavailable', 'extraction_failed'].includes(audio.status) ||
      typeof audio.note !== 'string' || typeof audio.truncated !== 'boolean' ||
      (audio.status === 'analyzed' && (audio.evidence?.classification !== 'INCONCLUSIVE' ||
        audio.evidence.scope !== 'speech_anti_spoofing' || audio.evidence.model !== 'clovaai/aasist' ||
        !Array.isArray(audio.evidence.segments) || audio.evidence.segments.some(segment =>
          !Number.isFinite(segment.start_seconds) || !Number.isFinite(segment.end_seconds) ||
          !Number.isFinite(segment.raw_spoof_softmax) || segment.raw_spoof_softmax < 0 || segment.raw_spoof_softmax > 1))) ||
      (audio.status !== 'analyzed' && audio.evidence !== undefined))
    throw new Error('Invalid local video audio evidence');
  value.faceContinuity = computeFaceContinuity(value.frames);
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
    samplingNote: 'Browser-sampled JPEG frames at 480 px width; the original video was not decoded by the server.',
    faceContinuity: computeFaceContinuity(frames) };
}

export function localVideoResult(evidence: LocalVideoEvidence, fileName: string, measurements: Record<string, any>, signalFindings: string[]): ForensicAnalysisResult {
  const firstModel = evidence.frames.find(frame => frame.image.model_status === 'ready')?.image;
  const faceModel = evidence.frames.find(frame => frame.image.face_model?.status === 'ready')?.image.face_model;
  const faceDetectorRan = evidence.frames.some(frame => frame.image.face_analysis !== 'not_performed');
  const source = evidence.scope === 'server_decoded_frames' ? 'original-video' : 'browser-sampled';
  const audioScored = evidence.audioTrack?.status === 'analyzed';
  return {
    modality: 'video', fileName, engine: 'local_video_frames',
    engineNote: `${evidence.frames.length} ${source} frame(s) retained. ${firstModel?'Experimental image-model outputs are shown separately and cannot determine video authenticity.':'No optional image classifier was available; decode, timestamp, quality and motion evidence remain available.'}`,
    authenticity: 'inconclusive', confidenceScore: 0, aiGeneratedProbability: null,
    headlineSummary: 'Frame-level evidence is available, but video authenticity is undetermined.',
    detailedFindings: [`Screened ${evidence.frames.length} sampled frame(s).`,
      ...(evidence.faceContinuity ? [`YuNet returned face candidates in ${evidence.faceContinuity.framesWithCandidates}/${evidence.faceContinuity.detectorFrames} detector-screened frame(s); geometric tracks do not verify identity or manipulation.`] : []),
      ...signalFindings.map(s => `[Browser signal] ${s}`)],
    limitations: [evidence.scope === 'server_decoded_frames'
      ? 'Only sampled, resized JPEG frames were screened; the full video was not analyzed.'
      : 'Frames were sampled and JPEG-compressed in the browser; the original video was not decoded by the server.',
      'The whole-image checkpoint failed an initial out-of-domain smoke check; raw scores cannot establish authenticity.',
      'Face candidate continuity is a geometric association only; it cannot verify identity or detect a face swap.',
      ...(faceModel ? ['Face-crop frame scores are uncalibrated and cannot establish video manipulation or authenticity.'] : []),
      evidence.frames.some(frame => frame.temporal?.status === 'measured')
        ? 'Adjacent-frame optical-flow measurements are exploratory, not a trained or validated temporal manipulation detector.'
        : 'No temporal manipulation detector was run.',
      ...(audioScored ? ['Video AASIST segment scores are uncalibrated, speech presence was not verified, and they do not determine authenticity.'] :
        [evidence.audioTrack?.note || 'Video audio extraction and AASIST were not run.'])],
    alternativeHypotheses: ['Cuts, compression, and changes in lighting can alter frame-level signals.'],
    compressionArtifacts: { elaScore: 0, doubleCompressionFound: false, noiseInconsistencyMapAvailable: false,
      notes: 'No image ELA was performed on the video frames.' },
    modelsUsed: [...(firstModel ? [{ name: firstModel.model, version: firstModel.revision, provider: 'Experimental local image checkpoint; no verdict' }] : []),
      ...(faceDetectorRan ? [{ name: 'YuNet face detector', version: '2023mar', provider: 'OpenCV Zoo' }] : []),
      ...(faceModel ? [{ name: faceModel.model, version: faceModel.revision, provider: 'Experimental frame face-crop evidence; no verdict' }] : []),
      ...(audioScored ? [{ name: 'AASIST', version: evidence.audioTrack!.evidence!.revision, provider: 'Experimental video-audio evidence; no verdict' }] : [])],
    measurements, analyzedAt: new Date().toISOString(), localVideo: evidence
  };
}
