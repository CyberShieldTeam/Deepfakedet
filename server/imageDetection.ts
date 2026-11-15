/**
 * Image authenticity: two separate questions, calibrated by transparent server-side rules.
 *
 *  1. AI generation — was the whole image produced by a generative model?
 *  2. Manipulation  — was a real image edited / spliced / retouched?
 *
 * The model supplies observations (indicators with a strength) and a raw probability; the verdict and
 * confidence are decided here, so a single over- or under-confident model answer cannot produce certainty.
 * Missing EXIF is never evidence of AI generation; ELA only ever supports the manipulation question.
 */
import { DetectionAssessment, DetectionIndicator, IndicatorStrength, ProvenanceInfo } from '../src/types';

export interface RawAssessment {
  probability?: number;
  /** AI generation only: specific evidence of a real camera capture. */
  cameraEvidence?: string[];
  indicators?: { indicator?: string; location?: string; strength?: string }[];
  counterIndicators?: string[];
  rationale?: string;
}
export interface RawImageSample {
  aiGeneration?: RawAssessment;
  manipulation?: RawAssessment;
  summary?: string;
  limitations?: string[];
}

/**
 * AI-generation probe. Deliberately short: in side-by-side tests a long forensic checklist pushed the
 * model into rationalising realism ("lighting is consistent, so it is real") and it missed a known
 * generated image (15%), while this direct question scored it 99% and genuine camera photos 0–5%.
 */
export const AI_DIRECT_PROMPT = `Is this image AI-generated (made by a text-to-image model) or a real photograph? Examine fine details: buildings, windows, roofs, trees, water, edges. Do not use missing metadata as evidence.
Respond ONLY with JSON {"aiGeneratedProbability":0-100,"reasons":string[]}`;

export interface RawDirectProbe { aiGeneratedProbability?: number; reasons?: string[] }

/**
 * Calibrate the direct probes (independent samples):
 *  - Majority rule (3+ checks): the checks within 20 points of the median form the majority and decide;
 *    a lone outlier is reported but cannot flip the verdict (confidence is reduced instead).
 *    No majority (e.g. 0 / 50 / 99) → inconclusive.
 *  - Two checks disagreeing by > 35 points → inconclusive.
 *  - median ≥ 80 → likely; ≥ 55 → possible; ≤ 20 → no_indicators_found; otherwise inconclusive
 * Probability is capped at 90 and confidence at 80 / 60 / 55 / 40 — visual judgement alone never reaches certainty.
 * Explanatory indicators from the detailed prompt are attached but do not move the verdict.
 */
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

export function calibrateDirect(probes: RawDirectProbe[], explanatory: DetectionIndicator[] = []): DetectionAssessment {
  const probs = probes.map(p => clamp(p.aiGeneratedProbability));
  let used = probs;
  let outliers: number[] = [];
  let noMajority = false;
  if (probs.length >= 3) {
    const med = median(probs);
    const inMajority = probs.map(p => Math.abs(p - med) <= 20);
    if (inMajority.filter(Boolean).length * 2 > probs.length) {
      used = probs.filter((_, i) => inMajority[i]);
      outliers = probs.filter((_, i) => !inMajority[i]);
    } else noMajority = true;
  }
  const center = median(used.length ? used : [50]);
  const spread = used.length > 1 ? Math.max(...used) - Math.min(...used) : 20;
  const agreement = Math.round(Math.max(0, 100 - spread) * (outliers.length ? 0.85 : 1));
  const reasons = Array.from(new Set(probes.flatMap(p => p.reasons || []))).slice(0, 5);
  let verdict: DetectionAssessment['verdict'];
  let confidence: number;
  if (noMajority || spread > 35) { verdict = 'inconclusive'; confidence = Math.min(40, agreement); }
  else if (center >= 80) { verdict = 'likely'; confidence = Math.min(80, Math.round(agreement * 0.8)); }
  else if (center >= 55) { verdict = 'possible'; confidence = Math.min(60, Math.round(agreement * 0.6)); }
  else if (center <= 20) { verdict = 'no_indicators_found'; confidence = Math.min(55, Math.round(agreement * 0.55)); }
  else { verdict = 'inconclusive'; confidence = Math.min(40, Math.round(agreement * 0.4)); }
  const positive = verdict === 'likely' || verdict === 'possible';
  const outlierNote = outliers.length ? ` ${outliers.length === 1 ? 'One check' : `${outliers.length} checks`} disagreed (${outliers.join('% / ')}%) and ${outliers.length === 1 ? 'was' : 'were'} outvoted.` : '';
  return {
    verdict,
    probability: Math.round(Math.min(90, center)),
    confidence,
    indicators: mergeIndicators([positive ? reasons.map(r => ({ indicator: r, strength: 'moderate' as const })) : [], explanatory]),
    counterIndicators: positive ? [] : reasons,
    rationale: positive
      ? `Independent model checks rated the image ${probs.join('% / ')}% likely AI-generated.${outlierNote}`
      : verdict === 'no_indicators_found'
      ? `Independent model checks rated it ${probs.join('% / ')}% likely AI-generated.${outlierNote} This is not proof of authenticity.`
      : `Model checks were split or mid-range (${probs.join('% / ')}%); the evidence is insufficient either way.`,
    samples: probs
  };
}

export const IMAGE_PROMPT = (dims: string, tiles: number) => `You are an image-forensics analyst. Answer TWO SEPARATE questions about this image (${dims}).${tiles ? `
The first picture is the full image; the next ${tiles} pictures are full-resolution close-up crops of it (top-left, top-right, bottom-left, bottom-right). Inspect the crops closely — generation artifacts are usually only visible in fine detail (windows, roofs, railings, foliage, people, text).` : ''}

Q1 — AI GENERATION: was this entire image produced by a text-to-image / generative model (e.g. GPT-image, DALL·E, Midjourney, Stable Diffusion, Imagen, Firefly)?
Modern generators produce photorealistic lighting, plausible composition and consistent textures. Those properties are NOT evidence that an image is a real photograph. Look specifically for:
 - structural logic failures: walls, railings, windows, roofs, poles or bridges that bend, merge, end abruptly or do not connect; impossible geometry; inconsistent perspective / vanishing lines
 - object coherence: buildings, trees, vehicles or people that blend into each other, duplicated or melted objects, inconsistent scale between similar objects
 - physics: water, spray, smoke, fire or debris whose motion, splash pattern or volume is implausible; missing or wrong reflections; shadows inconsistent with the light direction
 - texture: painterly or over-smooth micro-texture, repeated foliage/brick/stone patterns, uniformly "clean" detail with no sensor noise variation, edges with halos
 - text and signage: illegible, garbled or pseudo-letters
 - "stock-render" composition: dramatic, perfectly framed scene with cinematic lighting and no incidental clutter
Q2 — MANIPULATION: was a REAL photograph edited — spliced objects, cloned regions, removed/added elements, inconsistent lighting between regions, warped areas?

Rules:
 - Report only what you can actually see; give each indicator a location and a strength (weak / moderate / strong).
 - Absence of visible artifacts at this resolution is NOT proof of authenticity: give a middling probability, not a low one, unless you see positive evidence of a real camera capture (e.g. natural sensor noise, motion blur consistent with a lens, real legible text, coherent fine detail everywhere).
 - Do not use missing metadata or compression as evidence for either question.
 - Probabilities must be calibrated: 90+ only with several strong indicators.

For Q1 also list "cameraEvidence": SPECIFIC traces of a physical camera capture you can actually point to (sensor noise/grain varying with brightness, lens chromatic aberration or vignetting, motion blur or depth-of-field consistent with optics, real legible text or signage, real-world identifiable landmark details). Realism, natural lighting, coherence or plausible physics do NOT count as camera evidence. Use [] if you see none.

Respond ONLY with JSON:
{"aiGeneration":{"probability":0-100,"indicators":[{"indicator":string,"location":string,"strength":"weak"|"moderate"|"strong"}],"cameraEvidence":string[],"counterIndicators":string[],"rationale":string},
 "manipulation":{"probability":0-100,"indicators":[{"indicator":string,"location":string,"strength":"weak"|"moderate"|"strong"}],"counterIndicators":string[],"rationale":string},
 "summary":string,"limitations":string[]}`;

const STRENGTH: IndicatorStrength[] = ['weak', 'moderate', 'strong'];
const clamp = (n: any) => Math.max(0, Math.min(100, Number.isFinite(Number(n)) ? Number(n) : 50));

function cleanIndicators(raw?: RawAssessment['indicators']): DetectionIndicator[] {
  return (raw || [])
    .filter(i => i && i.indicator)
    .map(i => ({ indicator: String(i.indicator), location: i.location ? String(i.location) : undefined, strength: STRENGTH.includes(i.strength as any) ? (i.strength as IndicatorStrength) : 'weak' }));
}

/** Indicators from all samples, de-duplicated by their opening words, strongest kept. */
function mergeIndicators(lists: DetectionIndicator[][]): DetectionIndicator[] {
  const map = new Map<string, DetectionIndicator>();
  lists.flat().forEach(i => {
    const key = i.indicator.toLowerCase().replace(/[^a-z ]/g, '').split(' ').slice(0, 5).join(' ');
    const prev = map.get(key);
    if (!prev || STRENGTH.indexOf(i.strength) > STRENGTH.indexOf(prev.strength)) map.set(key, i);
  });
  return Array.from(map.values()).sort((a, b) => STRENGTH.indexOf(b.strength) - STRENGTH.indexOf(a.strength));
}

/**
 * Calibration rules (documented in the UI):
 *  - samples disagreeing by > 35 points → inconclusive
 *  - likely:   mean ≥ 70 and every sample reports ≥1 strong or ≥2 moderate indicators
 *  - possible: mean ≥ 45 and ≥1 moderate/strong indicator
 *  - no_indicators_found: mean ≤ 25, no moderate/strong indicator in any sample and (AI generation only)
 *    every sample names specific camera-capture evidence — realism alone never earns a clean verdict
 *  - otherwise inconclusive
 * Visual-only probability is capped at 90; confidence is capped per verdict (85 / 65 / 40 / 55).
 */
const CAMERA_SPECIFIC = /noise|grain|sensor|aberration|fring|vignett|motion blur|depth of field|bokeh|lens|focus|legible|readable|text|sign|licen[cs]e|landmark|jpeg block/i;

/** Camera evidence that names a concrete capture trait (not "looks realistic"). */
export const specificCameraEvidence = (items?: string[]) => (items || []).filter(i => CAMERA_SPECIFIC.test(i));

export function calibrate(raw: RawAssessment[], extra: DetectionIndicator[] = [], opts: { requireCameraEvidence?: boolean } = {}): DetectionAssessment {
  const perSample = raw.map(r => cleanIndicators(r.indicators));
  if (extra.length) perSample.forEach(list => list.push(...extra));
  const probs = raw.map(r => clamp(r.probability));
  const mean = probs.reduce((s, p) => s + p, 0) / (probs.length || 1);
  const spread = probs.length > 1 ? Math.max(...probs) - Math.min(...probs) : 20; // one sample: assume moderate uncertainty
  const good = (l: DetectionIndicator[]) => l.filter(i => i.strength !== 'weak');
  const strongEnough = (l: DetectionIndicator[]) => l.some(i => i.strength === 'strong') || good(l).length >= 2;
  const indicators = mergeIndicators(perSample);
  const goodCount = good(indicators).length;
  const agreement = Math.max(0, 100 - spread);

  let verdict: DetectionAssessment['verdict'];
  let confidence: number;
  if (spread > 35) {
    verdict = 'inconclusive';
    confidence = Math.min(40, agreement);
  } else if (mean >= 70 && perSample.length > 0 && perSample.every(strongEnough)) {
    verdict = 'likely';
    confidence = Math.min(85, Math.round(agreement * (0.6 + 0.08 * Math.min(4, goodCount))));
  } else if (mean >= 45 && goodCount >= 1) {
    verdict = 'possible';
    confidence = Math.min(65, Math.round(agreement * 0.65));
  } else if (
    mean <= 25 && perSample.every(l => good(l).length === 0) &&
    // For AI generation a clean verdict needs positive evidence of a real camera, not just an absence of artifacts.
    (!opts.requireCameraEvidence || raw.every(r => specificCameraEvidence(r.cameraEvidence).length > 0))
  ) {
    verdict = 'no_indicators_found';
    confidence = Math.min(55, Math.round(agreement * 0.55)); // absence of evidence is weak evidence
  } else {
    verdict = 'inconclusive';
    confidence = Math.min(40, Math.round(agreement * 0.4));
  }
  return {
    verdict,
    probability: Math.round(Math.min(90, mean)),
    confidence,
    indicators,
    counterIndicators: Array.from(new Set(raw.flatMap(r => [...specificCameraEvidence(r.cameraEvidence), ...(r.counterIndicators || [])]))).slice(0, 6),
    rationale:
      opts.requireCameraEvidence && verdict === 'inconclusive' && mean <= 25
        ? 'The model saw no generation artifacts but could not point to specific evidence of a real camera capture; realism alone does not establish authenticity.'
        : raw.map(r => r.rationale).filter(Boolean)[0] || '',
    samples: probs
  };
}

/** Embedded provenance that declares AI generation outranks visual judgement (metadata can be stripped, rarely faked to claim AI). */
export function provenanceAssessment(p: ProvenanceInfo): DetectionAssessment | null {
  if (p.verificationStatus !== 'validated' || !p.declaresAIGenerated) return null;
  return {
    verdict: 'likely',
    probability: 97,
    confidence: 95,
    indicators: [{ indicator: `Embedded provenance metadata declares AI generation${p.generatorHints.length ? ` (${p.generatorHints.join(', ')})` : ''}`, location: 'file metadata', strength: 'strong' }],
    counterIndicators: [],
    rationale: 'C2PA Content Credentials / IPTC digital-source-type metadata in the file states the image was produced by a generative model.'
  };
}

/** ELA can support the manipulation question only (never AI generation). */
export function elaIndicators(elaBlockRatio?: number): DetectionIndicator[] {
  if (!elaBlockRatio || elaBlockRatio <= 4) return [];
  return [{
    indicator: `Localized compression inconsistency (ELA: strongest block ${elaBlockRatio.toFixed(1)}× the median)`,
    location: 'ELA heatmap bright region',
    strength: elaBlockRatio > 10 ? 'moderate' : 'weak'
  }];
}

/** Combine the two assessments into the legacy single verdict used by dashboards and reports. */
export function overallVerdict(ai: DetectionAssessment, manip: DetectionAssessment) {
  const drive = [ai, manip].sort((a, b) => rank(b.verdict) - rank(a.verdict))[0];
  const authenticity =
    drive.verdict === 'likely' ? 'likely_synthetic'
    : drive.verdict === 'possible' ? 'suspicious_artifacts'
    : ai.verdict === 'no_indicators_found' && manip.verdict === 'no_indicators_found' ? 'likely_authentic'
    : 'inconclusive';
  const risk =
    drive.verdict === 'likely' ? ((drive.probability ?? 0) >= 85 && drive.confidence >= 75 ? 'Critical' : 'High')
    : drive.verdict === 'possible' ? 'Medium' : 'Low';
  return { authenticity: authenticity as 'likely_synthetic' | 'suspicious_artifacts' | 'inconclusive' | 'likely_authentic', confidence: drive.confidence, risk: risk as 'Critical' | 'High' | 'Medium' | 'Low' };
}
const rank = (v: DetectionAssessment['verdict']) => ({ likely: 3, possible: 2, inconclusive: 1, no_indicators_found: 0 })[v];
