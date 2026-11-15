import assert from 'node:assert/strict';
import { validateTemporalDiagnostics, type TemporalDiagnostics } from '../server/localVideo';
const result:TemporalDiagnostics={status:'measured',classification:'INCONCLUSIVE',decisionProbability:null,
  method:'bounded_farneback_v1',sampledFrames:3,processedPairs:2,note:'Not a classifier',durationSeconds:3,
  effectiveIntervalSeconds:1,sourceFrameCount:72,intervals:[0,1].map(start=>({startSeconds:start,endSeconds:start+1,
    observation:'localized_change_candidate',analysisWidth:160,analysisHeight:128,medianFlowPixels:2,
    meanRoundTripErrorPixels:1,maxTileResidual:30,regions:[{x:10,y:10,width:16,height:16,residual:30}]}))};
assert.ok(validateTemporalDiagnostics(result));
assert.equal(validateTemporalDiagnostics({...result,decisionProbability:.9} as unknown as TemporalDiagnostics),false);
assert.equal(validateTemporalDiagnostics({...result,intervals:[{...result.intervals[0],endSeconds:NaN}]}),false);
assert.equal(validateTemporalDiagnostics({...result,processedPairs:99}),false);
assert.equal(validateTemporalDiagnostics({...result,intervals:result.intervals.map(r=>({...r,observation:'deepfake'}))}),false);
assert.equal(validateTemporalDiagnostics({...result,intervals:result.intervals.map(r=>({...r,regions:[{x:155,y:0,width:16,height:16,residual:20}]}))}),false);
assert.ok(validateTemporalDiagnostics({status:'timed_out',classification:'INCONCLUSIVE',decisionProbability:null,
  method:'bounded_farneback_v1',sampledFrames:0,processedPairs:0,intervals:[],note:'Timed out'}));
console.log('Bounded temporal contracts passed: interval ordering, region bounds, timeouts, no authenticity score.');
