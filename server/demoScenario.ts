/**
 * SIMULATED DEMONSTRATION SCENARIO — "Operation Floodgate" (fictional).
 * A fictional dam-collapse hoax near Hyderabad. All accounts, posts, media
 * findings and the government bulletin below are invented for demonstration.
 * Nothing here describes a real event, agency announcement or person.
 */
import { ClaimVerificationResult, ForensicAnalysisResult, Investigation, MultilingualVariant, TimelineEntry } from '../src/types';
import { analyzeCampaign } from './campaign';

export const DEMO_DAM = 'Krishnaveni Reservoir Dam (fictional)';
const DEMO_URL = 'http://dam-alert-live.example/evacuate';
const DEMO_PHOTO_URL = 'http://viral-clips.example/flood-photo.jpg';
const DEMO_VIDEO_URL = 'http://viral-clips.example/dam-burst.mp4';

/** Local registry of previously verified claims used by the rule-based fallback (demo data). */
export const DEMO_VERIFIED_REGISTRY = [
  {
    keywords: ['dam', 'collapse', 'collapsed', 'burst', 'hyderabad', 'evacuat', 'డ్యామ్', 'కూలి', 'హైదరాబాద్', 'बांध', 'टूट', 'हैदराबाद'],
    verdict: 'Contradicted' as const,
    statement: `SIMULATED BULLETIN (fictional State Irrigation Authority, 10:25 AM): ${DEMO_DAM} is structurally intact; water level normal; no evacuation order has been issued. Viral video is old footage from a different location.`
  }
];

function at(min: number, sec = 0) {
  const d = new Date();
  d.setHours(10, min, sec, 0);
  return d.toISOString();
}

export function demoPosts() {
  const en = 'BREAKING: Krishnaveni dam near Hyderabad has COLLAPSED! Water flooding the city. Evacuate NOW, share with family';
  const hi = 'ब्रेकिंग: हैदराबाद के पास कृष्णवेणी बांध टूट गया! शहर में पानी भर रहा है। तुरंत घर खाली करें, सबको भेजें';
  const te = 'బ్రేకింగ్: హైదరాబాద్ దగ్గర కృష్ణవేణి డ్యామ్ కూలిపోయింది! నగరంలో నీరు వస్తోంది. వెంటనే ఖాళీ చేయండి, అందరికీ పంపండి';
  const posts: any[] = [];
  const add = (id: string, user: string, min: number, sec: number, content: string, lang: string, url: string | undefined, tags: string, age: number, fol: number) =>
    posts.push({ account_id: id, username: user, timestamp: at(min, sec), content, shared_url: url, hashtags: tags, language: lang, account_age_days: age, followers: fol });

  // Cluster A — English copy-paste ring seeding the video link
  ['alertnews_hyd', 'citywatch247', 'hyd_updates_now', 'truth_daily_in', 'breakingdesk_x', 'news4u_hyd', 'flashreport_in'].forEach((u, i) =>
    add(`A${i}`, u, 0, 20 + i * 14, i % 2 ? en + ' 🙏' : en, 'English', DEMO_VIDEO_URL, '#DamCollapse #HyderabadFlood', 3 + i, 12 + i * 7)
  );
  // Cluster B — Hindi ring pushing the "evacuation audio"
  ['sach_khabar', 'desh_alert', 'turant_news', 'bharat_flash', 'janata_update'].forEach((u, i) =>
    add(`B${i}`, u, 6, 5 + i * 20, hi, 'Hindi', DEMO_URL, '#बांध_टूटा #HyderabadFlood', 5 + i, 30 + i * 4)
  );
  // Cluster C — Telugu ring re-sharing the old flood photo
  ['telugu_varthalu', 'hyd_samacharam', 'nijam_news', 'vartha_flash', 'praja_alert', 'manavoice_te'].forEach((u, i) =>
    add(`C${i}`, u, 12, i * 25, te, 'Telugu', DEMO_PHOTO_URL, '#డ్యామ్_కూలింది #HyderabadFlood', 2 + i, 8 + i * 5)
  );
  // Organic / unlinked users reacting
  add('O1', 'priya_k', 3, 0, 'Is anyone else seeing this dam video? Is it real? My parents live near there', 'English', undefined, '#hyderabad', 1450, 820);
  add('O2', 'rahul.civil.engg', 18, 0, 'The water colour and hills in that clip do not match the Deccan landscape. Looks like old footage, wait for official word.', 'English', undefined, '', 2200, 1530);
  add('O3', 'ramesh_te', 21, 30, 'మా ఏరియాలో అంతా బాగానే ఉంది, ఎలాంటి వరద లేదు', 'Telugu', undefined, '', 900, 210);
  add('O4', 'factcheck_volunteer', 27, 0, 'Simulated official bulletin says the dam is intact and no evacuation ordered. Please stop forwarding.', 'English', undefined, '#FactCheck', 1800, 4100);
  return posts;
}

const sim = 'SIMULATED DEMO RESULT — scripted scenario data, not output of a real forensic model.';

export function demoMediaFindings(): ForensicAnalysisResult[] {
  const base = { engine: 'simulated_demo' as const, engineNote: sim, isSimulated: true, analyzedAt: new Date().toISOString(), aiGeneratedProbability: null };
  return [
    {
      ...base,
      modality: 'video',
      fileName: 'dam_collapse_viral.mp4',
      authenticity: 'suspicious_artifacts',
      confidenceScore: 81,
      riskLevel: 'Critical',
      headlineSummary: 'Viral "dam collapse" clip: scene-cut discontinuities and a re-encoded segment spliced into the footage (simulated indicators).',
      detailedFindings: [
        'Frame-difference spike at 00:04.2 consistent with a hard cut between two different source clips.',
        'Landscape and vegetation do not match the stated location (analyst observation, scripted).',
        'Embedded timestamp overlay font differs from the surrounding broadcast graphics.'
      ],
      videoFrames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => ({
        frameIndex: i * 15, timestampSeconds: i * 0.5, anomalyScore: [12, 14, 11, 18, 22, 87, 76, 20, 15, 13][i], isKeyframe: i % 3 === 0,
        artifactsDetected: i === 5 ? ['Hard cut / source change'] : i === 6 ? ['Re-encode boundary'] : []
      })),
      compressionArtifacts: { elaScore: 0, doubleCompressionFound: true, noiseInconsistencyMapAvailable: false, notes: 'Simulated: two GOP structures detected in one file.' },
      modelsUsed: [{ name: 'Scripted demo scenario', version: 'n/a', provider: 'VERITAS demo' }],
      limitations: ['Values are scripted for the demonstration.', 'Real analysis would require uploading the actual file.'],
      alternativeHypotheses: ['Legitimate news compilation edited from multiple clips.']
    },
    {
      ...base,
      modality: 'audio',
      fileName: 'evacuation_announcement.m4a',
      authenticity: 'likely_synthetic',
      confidenceScore: 77,
      riskLevel: 'High',
      headlineSummary: '"Official evacuation" voice note shows synthetic-speech indicators: flat prosody, no breath pauses, band-limited spectrum (simulated).',
      detailedFindings: ['Spectral energy above ~8 kHz is near zero, typical of some neural vocoders (also of phone codecs).', 'Pause ratio 2% — almost no breathing gaps across 38 s.', 'Pitch contour variance unusually low for an urgent announcement.'],
      audioSpectrum: { sampleRateHz: 44100, durationSeconds: 38, spectralRollOffHz: 7900, voiceCloningProbability: 77, pitchContinuityScore: 93, backgroundAcousticDiscontinuity: true, anomalousFrequencyBands: ['>8 kHz cutoff'] },
      compressionArtifacts: { elaScore: 0, doubleCompressionFound: false, noiseInconsistencyMapAvailable: false, notes: 'n/a for audio' },
      modelsUsed: [{ name: 'Scripted demo scenario', version: 'n/a', provider: 'VERITAS demo' }],
      limitations: ['Values are scripted for the demonstration.', 'Telephone/WhatsApp codecs also remove high frequencies.'],
      alternativeHypotheses: ['Genuine announcement recorded over a low-bandwidth phone line.']
    },
    {
      ...base,
      modality: 'image',
      fileName: 'flood_photo_current.jpg',
      authenticity: 'suspicious_artifacts',
      confidenceScore: 74,
      riskLevel: 'High',
      headlineSummary: 'Flood photo circulated as "current" appears to be recycled from an older flood in another state (simulated reverse-search match).',
      detailedFindings: ['Simulated reverse-image match to an archive photo from a 2019 flood in a different state.', 'Metadata stripped; image re-compressed at least twice.', 'Signboard text in the image is not in Telugu or Hindi script.'],
      compressionArtifacts: { elaScore: 41, doubleCompressionFound: true, noiseInconsistencyMapAvailable: false, notes: 'Simulated.' },
      modelsUsed: [{ name: 'Scripted demo scenario', version: 'n/a', provider: 'VERITAS demo' }],
      limitations: ['Reverse-image search is not implemented in this build; the match is scripted.'],
      alternativeHypotheses: ['Photo could be genuine and recently taken elsewhere, mislabelled by mistake.']
    },
    {
      ...base,
      modality: 'video',
      fileName: 'official_statement_clip.mp4',
      authenticity: 'likely_synthetic',
      confidenceScore: 79,
      riskLevel: 'Critical',
      headlineSummary: 'Clip of a (fictional) public official "announcing" the collapse shows lip-sync drift and face-boundary flicker (simulated).',
      detailedFindings: ['Mouth movement lags audio by ~180 ms on plosive sounds.', 'Face-region boundary flickers across consecutive frames.', 'Lighting on face inconsistent with background.'],
      faces: [{ id: 'f1', x: 36, y: 18, width: 28, height: 38, confidence: 90, manipulationScore: 79, anomaliesDetected: ['Lip-sync drift', 'Boundary flicker'] }],
      videoFrames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => ({ frameIndex: i * 15, timestampSeconds: i * 0.5, anomalyScore: [30, 44, 62, 71, 58, 66, 74, 69, 40, 35][i], isKeyframe: i % 3 === 0, artifactsDetected: i > 1 && i < 8 ? ['Lip-sync drift'] : [] })),
      compressionArtifacts: { elaScore: 0, doubleCompressionFound: true, noiseInconsistencyMapAvailable: false, notes: 'Simulated.' },
      modelsUsed: [{ name: 'Scripted demo scenario', version: 'n/a', provider: 'VERITAS demo' }],
      limitations: ['Values are scripted for the demonstration.'],
      alternativeHypotheses: ['Poor-quality stream with audio/video desync.']
    }
  ];
}

export function demoClaim(): ClaimVerificationResult {
  return {
    originalInput: 'కృష్ణవేణి డ్యామ్ కూలిపోయింది! వెంటనే ఖాళీ చేయండి — Krishnaveni dam near Hyderabad has collapsed, evacuate now.',
    detectedLanguage: 'Telugu + English',
    translatedText: 'The Krishnaveni dam has collapsed! Evacuate immediately — Krishnaveni dam near Hyderabad has collapsed, evacuate now.',
    extractedClaims: ['The Krishnaveni dam near Hyderabad has collapsed.', 'Floodwater is entering the city.', 'Authorities have ordered an evacuation.'],
    targetClaim: 'The Krishnaveni dam near Hyderabad collapsed this morning and an evacuation has been ordered.',
    verdict: 'Contradicted',
    confidenceScore: 90,
    verdictRationale: 'The (simulated) official bulletin issued at 10:25 states the dam is intact and no evacuation was ordered. The viral video is traced to older footage, and the evacuation audio shows synthetic-speech indicators.',
    supportingEvidence: ['None — no official source reports a collapse.'],
    contradictingEvidence: ['Simulated State Irrigation Authority bulletin (10:25): dam intact, water levels normal.', 'Simulated reverse-search: viral flood photo is from 2019, another state.', 'Organic local posts report no flooding.'],
    sources: [
      { title: '[SIMULATED] State Irrigation Authority bulletin — dam status normal', url: '', domain: 'demo-scenario (fictional)', publishDate: new Date().toISOString().slice(0, 10), excerpt: DEMO_VERIFIED_REGISTRY[0].statement, stance: 'contradicts', credibilityRating: 'High Authority', isSimulated: true },
      { title: '[SIMULATED] District disaster-management control room update', url: '', domain: 'demo-scenario (fictional)', excerpt: 'No evacuation order issued; residents asked not to forward unverified clips.', stance: 'contradicts', credibilityRating: 'High Authority', isSimulated: true }
    ],
    supportingCount: 0,
    contradictingCount: 2,
    neutralCount: 0,
    factCheckerConsensus: 'Contradicted by the (simulated) authoritative bulletin.',
    limitations: ['All sources in this result are fictional demonstration data — no external source was checked.'],
    timestamp: new Date().toISOString(),
    engine: 'simulated_demo',
    engineNote: sim,
    isSimulated: true,
    verificationMode: 'simulated_demo',
    assessment: 'verified_false'
  };
}

export const DEMO_MULTILINGUAL: MultilingualVariant[] = [
  { language: 'English', original: 'BREAKING: Krishnaveni dam near Hyderabad has COLLAPSED! Evacuate NOW', translation: '—', posts: 7 },
  { language: 'Hindi', original: 'ब्रेकिंग: हैदराबाद के पास कृष्णवेणी बांध टूट गया! तुरंत घर खाली करें', translation: 'Breaking: Krishnaveni dam near Hyderabad has broken! Vacate homes immediately', posts: 5 },
  { language: 'Telugu', original: 'బ్రేకింగ్: హైదరాబాద్ దగ్గర కృష్ణవేణి డ్యామ్ కూలిపోయింది! వెంటనే ఖాళీ చేయండి', translation: 'Breaking: Krishnaveni dam near Hyderabad has collapsed! Evacuate immediately', posts: 6 }
];

export const DEMO_TIMELINE: { min: number; entry: Omit<TimelineEntry, 'time'>; alertType: string }[] = [
  { min: 0, alertType: 'suspicious_media', entry: { label: 'Viral "dam collapse" video begins circulating (7 seed accounts)', severity: 'critical', module: 'Media' } },
  { min: 2, alertType: 'similar_content', entry: { label: 'Near-duplicate English posts detected across 7 accounts within 90 s', severity: 'high', module: 'Campaign' } },
  { min: 6, alertType: 'suspicious_media', entry: { label: 'AI-generated "evacuation" audio flagged — synthetic speech indicators', severity: 'high', module: 'Media' } },
  { min: 8, alertType: 'suspicious_media', entry: { label: 'Manipulated video of fictional official making false announcement', severity: 'critical', module: 'Media' } },
  { min: 12, alertType: 'propagation_burst', entry: { label: 'Telugu-language burst: 6 accounts in 2 min sharing recycled flood photo', severity: 'high', module: 'Multilingual' } },
  { min: 14, alertType: 'suspicious_media', entry: { label: 'Flood photo matched to older event from another state (reused image)', severity: 'high', module: 'Media' } },
  { min: 25, alertType: 'claim_contradicted', entry: { label: 'Simulated official bulletin contradicts collapse claim', severity: 'critical', module: 'Claims' } },
  { min: 26, alertType: 'campaign_detected', entry: { label: 'Coordinated network confirmed: 3 clusters, EN/HI/TE', severity: 'critical', module: 'Campaign' } }
];

export function buildDemoInvestigation(): Investigation {
  const campaign = analyzeCampaign('Operation Floodgate — simulated social dataset', demoPosts(), true);
  const now = new Date().toISOString();
  return {
    id: `inv-demo-${Date.now().toString(36)}`,
    caseNumber: `SUR-DEMO-${Math.floor(1000 + Math.random() * 9000)}`,
    title: 'Operation Floodgate — Fictional Dam Collapse Hoax (SIMULATED DEMO)',
    targetSubject: DEMO_DAM,
    modality: 'social_dataset',
    status: 'Critical Flag',
    riskLevel: 'Critical',
    createdAt: now,
    updatedAt: now,
    analyst: 'Demo Analyst',
    tags: ['SIMULATED DEMO', 'Dam hoax', 'Multilingual', 'Deepfake audio', 'Coordinated'],
    description:
      'SIMULATED DEMONSTRATION — not a real emergency. At 10:00 AM a video claiming a dam near Hyderabad collapsed begins circulating, accompanied by synthetic evacuation audio, a recycled flood photo, a manipulated official-statement video and coordinated multilingual amplification. A (fictional) official bulletin contradicts it.',
    summary:
      'Coordinated multilingual hoax combining recycled and manipulated media. Campaign graph computed by the real clustering engine over a synthetic dataset; media and claim findings are scripted demo values.',
    isSimulatedDemo: true,
    mediaFindings: demoMediaFindings(),
    forensicResult: demoMediaFindings()[0],
    claimResult: demoClaim(),
    claimResults: [demoClaim()],
    campaignResult: campaign,
    multilingual: DEMO_MULTILINGUAL,
    timeline: DEMO_TIMELINE.map(t => ({ ...t.entry, time: at(t.min) }))
  };
}
