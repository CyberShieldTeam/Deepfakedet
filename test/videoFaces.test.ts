import assert from 'node:assert/strict';
import { computeFaceContinuity } from '../server/videoFaces';
import type { LocalImageResponse } from '../server/localImage';

type Box = LocalImageResponse['face_boxes'][number];
const box = (x: number, y: number): Box => ({ x, y, width: 50, height: 50, confidence: 0.95 });
const frame = (timestampSeconds: number, face_boxes: Box[], face_analysis: LocalImageResponse['face_analysis'] = 'candidate_regions') =>
  ({ timestampSeconds, image: { face_boxes, face_analysis } });

const continuity = computeFaceContinuity([
  frame(0.2, [box(10, 10), box(200, 10)]),
  frame(0.7, [box(12, 11), box(203, 11)]),
  frame(1.2, [box(14, 12)]),
  frame(1.7, [], 'none_found'),
  frame(2.2, [box(15, 13)])
]);
assert.equal(continuity.scope, 'geometric_candidate_tracks');
assert.equal(continuity.detectorFrames, 5);
assert.equal(continuity.framesWithCandidates, 4);
assert.equal(continuity.candidateCount, 6);
assert.deepEqual(continuity.tracks.map(track => track.frameIndices), [[0, 1, 2], [0, 1], [4]]);
assert.equal(continuity.tracks[0].meanDetectorConfidence, 0.95);

const unavailable = computeFaceContinuity([frame(0.2, [], 'not_performed')]);
assert.equal(unavailable.detectorFrames, 0);
assert.equal(unavailable.tracks.length, 0);
const invalid = computeFaceContinuity([frame(0.2, [{ ...box(0, 0), width: Number.NaN }])]);
assert.equal(invalid.candidateCount, 0);
console.log('Video face continuity tests passed');
