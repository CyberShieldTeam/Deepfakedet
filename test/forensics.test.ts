/**
 * Tests for the campaign engine and demo scenario (run: npm test).
 */
import assert from 'assert';
import { analyzeCampaign, detectScriptLanguage, jaccard, parseCSV, tokenize } from '../server/campaign';
import { buildDemoInvestigation, demoPosts } from '../server/demoScenario';
import { calibrate, calibrateDirect, elaIndicators, overallVerdict, provenanceAssessment } from '../server/imageDetection';

console.log('--- VERITAS AI TESTS ---');

assert.equal(detectScriptLanguage('హైదరాబాద్'), 'Telugu');
assert.equal(detectScriptLanguage('हैदराबाद'), 'Hindi');
assert.equal(detectScriptLanguage('Hyderabad'), 'English');

assert(jaccard(tokenize('dam has collapsed evacuate now'), tokenize('dam has collapsed evacuate now!')) > 0.9);
assert(jaccard(tokenize('cricket match tonight'), tokenize('dam collapsed evacuate')) === 0);

const csv = parseCSV('account_id,username,content,timestamp\n1,a,"hello, world",2026-01-01T10:00:00Z\n2,b,"say ""hi""",2026-01-01T10:01:00Z\n');
assert.equal(csv.length, 2);
assert.equal(csv[0].content, 'hello, world');
assert.equal(csv[1].content, 'say "hi"');

const r = analyzeCampaign('demo', demoPosts(), true);
assert.equal(r.totalAccounts, 22);
assert.equal(r.clusters.length, 3, 'expected EN / HI / TE clusters');
assert(r.nodes.filter(n => n.clusterId === 0).length === 4, 'organic accounts stay unclustered');
assert(r.edges.every(e => e.description.length > 0), 'every edge has a reason');
console.log('Campaign:', r.clusters.map(c => `${c.name}=${c.accountCount}@${c.coordinationScore}`).join(', '), 'index', r.overallCoordinationIndex);

const organic = analyzeCampaign('organic', [
  { account_id: 'x', content: 'Lovely weather in Hyderabad today', timestamp: '2026-01-01T09:00:00Z' },
  { account_id: 'y', content: 'Traffic jam near the airport road', timestamp: '2026-01-01T13:00:00Z' }
], false);
assert.equal(organic.clusters.length, 0);

const inv = buildDemoInvestigation();
assert(inv.isSimulatedDemo);
assert(inv.mediaFindings!.every(m => m.isSimulated && m.engine === 'simulated_demo'));
assert(inv.claimResult!.sources.every(s => s.isSimulated && s.url === ''), 'demo sources must not carry fake links');

// Image calibration rules
const strong = { indicator: 'Railing merges into wall', location: 'dam crest', strength: 'strong' };
const mod = { indicator: 'Repeated foliage texture', location: 'left hillside', strength: 'moderate' };
const likely = calibrate([{ probability: 85, indicators: [strong] }, { probability: 80, indicators: [strong, mod] }]);
assert.equal(likely.verdict, 'likely');
assert(likely.confidence <= 85 && likely.probability! <= 90, 'visual-only results are capped');
assert.equal(calibrate([{ probability: 90, indicators: [strong] }, { probability: 30, indicators: [] }]).verdict, 'inconclusive', 'disagreeing samples → inconclusive');
assert.equal(calibrate([{ probability: 90, indicators: [] }, { probability: 88, indicators: [] }]).verdict, 'inconclusive', 'high probability without indicators is not enough');
const none = calibrate([{ probability: 10, indicators: [] }, { probability: 15, indicators: [] }]);
assert.equal(none.verdict, 'no_indicators_found');
const realismOnly = { probability: 10, indicators: [], cameraEvidence: ['Natural lighting and realistic water physics'] };
assert.equal(calibrate([realismOnly, realismOnly], [], { requireCameraEvidence: true }).verdict, 'inconclusive', 'realism is not camera evidence');
const camera = { probability: 10, indicators: [], cameraEvidence: ['Luminance-dependent sensor noise in shadows'] };
assert.equal(calibrate([camera, camera], [], { requireCameraEvidence: true }).verdict, 'no_indicators_found');
assert(none.confidence <= 55, 'absence of evidence is never high confidence');
assert.notEqual(calibrate([{ probability: 15, indicators: [mod] }]).verdict, 'no_indicators_found', 'a moderate indicator blocks a clean verdict');
const d99 = calibrateDirect([{ aiGeneratedProbability: 99, reasons: ['Merged rooftops'] }, { aiGeneratedProbability: 97 }]);
assert.equal(d99.verdict, 'likely');
assert(d99.probability === 90 && d99.confidence <= 80, 'direct probes are capped below certainty');
assert.equal(calibrateDirect([{ aiGeneratedProbability: 95 }, { aiGeneratedProbability: 20 }]).verdict, 'inconclusive', 'split probes → inconclusive');
assert.equal(calibrateDirect([{ aiGeneratedProbability: 40 }, { aiGeneratedProbability: 45 }]).verdict, 'inconclusive', 'mid-range → inconclusive');
// Majority rule with three checks
const outvoted = calibrateDirect([{ aiGeneratedProbability: 99 }, { aiGeneratedProbability: 0 }, { aiGeneratedProbability: 99 }]);
assert.equal(outvoted.verdict, 'likely', 'a single outlier cannot flip the verdict');
assert(outvoted.confidence < d99.confidence + 1 && /outvoted/.test(outvoted.rationale));
assert.equal(calibrateDirect([{ aiGeneratedProbability: 0 }, { aiGeneratedProbability: 99 }, { aiGeneratedProbability: 5 }]).verdict, 'no_indicators_found', 'majority low → no indicators');
assert.equal(calibrateDirect([{ aiGeneratedProbability: 0 }, { aiGeneratedProbability: 50 }, { aiGeneratedProbability: 99 }]).verdict, 'inconclusive', 'no majority → inconclusive');
assert.equal(calibrateDirect([{ aiGeneratedProbability: 95 }, { aiGeneratedProbability: 99 }, { aiGeneratedProbability: 99 }]).verdict, 'likely');
const d5 = calibrateDirect([{ aiGeneratedProbability: 5 }, { aiGeneratedProbability: 0 }]);
assert.equal(d5.verdict, 'no_indicators_found');
assert(d5.confidence <= 55 && /not proof/.test(d5.rationale));
assert.equal(elaIndicators(2).length, 0);
assert.equal(elaIndicators(20)[0].strength, 'moderate');
assert.equal(provenanceAssessment({ c2paManifest: false, declaresAIGenerated: false, generatorHints: [] }), null);
assert.equal(provenanceAssessment({ c2paManifest: true, declaresAIGenerated: true, generatorHints: ['OpenAI'] }), null);
assert.equal(provenanceAssessment({ c2paManifest: true, declaresAIGenerated: true, generatorHints: ['OpenAI'], verificationStatus: 'invalid' }), null);
assert.equal(provenanceAssessment({ c2paManifest: true, declaresAIGenerated: true, generatorHints: ['OpenAI'], verificationStatus: 'validated' })!.verdict, 'likely');
assert.equal(overallVerdict(none, none).authenticity, 'likely_authentic');
assert.equal(overallVerdict(likely, none).authenticity, 'likely_synthetic');

console.log('--- ALL TESTS PASSED ---');
