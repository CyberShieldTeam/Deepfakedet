import type { LocalImageResponse } from './localImage';

type FaceBox = LocalImageResponse['face_boxes'][number];
type Frame = { timestampSeconds: number; image: Pick<LocalImageResponse, 'face_analysis' | 'face_boxes'> };
export interface FaceContinuity {
  scope: 'geometric_candidate_tracks';
  detectorFrames: number;
  framesWithCandidates: number;
  candidateCount: number;
  tracks: { id: number; frameIndices: number[]; timestampsSeconds: number[]; meanDetectorConfidence: number }[];
}

function validBox(box: FaceBox): boolean {
  return box && [box.x, box.y, box.width, box.height, box.confidence].every(Number.isFinite) &&
    box.width > 0 && box.height > 0 && box.confidence >= 0 && box.confidence <= 1;
}

function overlap(a: FaceBox, b: FaceBox): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const intersection = width * height;
  return intersection / (a.width * a.height + b.width * b.height - intersection);
}

/** Geometric continuity only. It cannot verify identity or detect face manipulation. */
export function computeFaceContinuity(frames: Frame[]): FaceContinuity {
  const tracks: { id: number; frameIndices: number[]; timestampsSeconds: number[]; meanDetectorConfidence: number; lastBox: FaceBox }[] = [];
  let detectorFrames = 0;
  let framesWithCandidates = 0;
  let candidateCount = 0;
  frames.forEach((frame, frameIndex) => {
    if (frame.image.face_analysis !== 'not_performed') detectorFrames++;
    const boxes = frame.image.face_boxes.filter(validBox);
    if (boxes.length) framesWithCandidates++;
    candidateCount += boxes.length;
    const pairs: { trackIndex: number; boxIndex: number; iou: number }[] = [];
    tracks.forEach((track, trackIndex) => {
      if (track.frameIndices.at(-1) !== frameIndex - 1) return;
      boxes.forEach((box, boxIndex) => {
        const iou = overlap(track.lastBox, box);
        if (iou >= 0.2) pairs.push({ trackIndex, boxIndex, iou });
      });
    });
    pairs.sort((a, b) => b.iou - a.iou);
    const usedTracks = new Set<number>();
    const usedBoxes = new Set<number>();
    for (const pair of pairs) {
      if (usedTracks.has(pair.trackIndex) || usedBoxes.has(pair.boxIndex)) continue;
      const track = tracks[pair.trackIndex];
      const box = boxes[pair.boxIndex];
      const count = track.frameIndices.length;
      track.meanDetectorConfidence = (track.meanDetectorConfidence * count + box.confidence) / (count + 1);
      track.frameIndices.push(frameIndex);
      track.timestampsSeconds.push(frame.timestampSeconds);
      track.lastBox = box;
      usedTracks.add(pair.trackIndex);
      usedBoxes.add(pair.boxIndex);
    }
    boxes.forEach((box, boxIndex) => {
      if (!usedBoxes.has(boxIndex)) tracks.push({ id: tracks.length + 1, frameIndices: [frameIndex],
        timestampsSeconds: [frame.timestampSeconds], meanDetectorConfidence: box.confidence, lastBox: box });
    });
  });
  return { scope: 'geometric_candidate_tracks', detectorFrames, framesWithCandidates, candidateCount,
    tracks: tracks.map(track => ({ id: track.id, frameIndices: track.frameIndices,
      timestampsSeconds: track.timestampsSeconds,
      meanDetectorConfidence: Number(track.meanDetectorConfidence.toFixed(4)) })) };
}
