import { Investigation, ModelRegistryItem } from '../src/types';

export const INITIAL_MODELS: ModelRegistryItem[] = [
  {
    id: 'mdl-gemini-vision',
    name: 'Gemini 3.8 Flash Vision Forensics',
    task: 'Multimodal Spatial & Artifact Manipulation Analysis',
    architecture: 'Multimodal Transformer (Vision-Language-Audio)',
    license: 'Google Cloud Terms of Service',
    version: '3.8.0',
    status: 'ONLINE',
    inferenceLatencyAvg: '480ms',
    accuracyBenchmark: '96.2% on FaceForensics++ & DeepfakeDetection',
    description: 'Server-side forensic vision analysis for facial boundary warping, GAN generative noise, skin texture degradation, and lighting inconsistencies.'
  },
  {
    id: 'mdl-ela-residual',
    name: 'Veritas-ELA Frequency Residual Engine',
    task: 'Error Level Analysis & Discrete Cosine Transform (DCT) Analysis',
    architecture: 'Custom JPEG Quantization Error & High-Frequency Noise Estimator',
    license: 'Apache-2.0',
    version: '2.4.1',
    status: 'ONLINE',
    inferenceLatencyAvg: '45ms',
    accuracyBenchmark: '91.8% on CASIA 2.0 Tampered Image Dataset',
    description: 'Identifies resaved regions, double JPEG compression artifacts, and localized splice anomalies at 8x8 pixel block boundaries.'
  },
  {
    id: 'mdl-wav-speech',
    name: 'Acoustic-Spectra v3 (Synthetic Speech)',
    task: 'Synthetic Voice & Deepfake Speech Classification',
    architecture: 'Wav2Vec2 + Mel-Spectrogram Temporal Convolutional Network',
    license: 'MIT / Veritas Research',
    version: '3.1.0',
    status: 'ONLINE',
    inferenceLatencyAvg: '310ms',
    accuracyBenchmark: '94.7% EER on ASVspoof 2021 Deepfake Track',
    description: 'Detects vocoder frequency rolloffs (>8kHz truncation), phase incoherence, missing human glottal pulses, and unnatural respiratory cadences.'
  },
  {
    id: 'mdl-claim-grounded',
    name: 'Veritas Grounded Claim Verification Engine',
    task: 'Fact Verification & Web Grounding Corroboration',
    architecture: 'Google Search Retrieval Grounding + NLI Stance Classifier',
    license: 'Google AI / Veritas',
    version: '2.5.0',
    status: 'ONLINE',
    inferenceLatencyAvg: '620ms',
    accuracyBenchmark: '89.4% on FEVER & MultiFC Benchmarks',
    description: 'Queries verified external web sources via real-time search grounding, compares claims against primary source reporting, and scores stance.'
  },
  {
    id: 'mdl-semantic-embed',
    name: 'Coordination-Embed (All-MiniLM-L6)',
    task: 'Semantic Vectorization & Text Similarity',
    architecture: 'Sentence Transformer (6-layer MiniLM)',
    license: 'Apache-2.0',
    version: '1.2.0',
    status: 'ONLINE',
    inferenceLatencyAvg: '65ms',
    accuracyBenchmark: '88.1% on STSBenchmark',
    description: 'Transforms multi-post social media messages into dense 384-dimensional vector space for cosine similarity and copypasta clustering.'
  },
  {
    id: 'mdl-graph-louvain',
    name: 'Veritas Louvain Network Community Detector',
    task: 'Graph Clustering & Inauthentic Coordination Discovery',
    architecture: 'Modularity Optimization & Temporal Burst Graph Partitioning',
    license: 'BSD-3-Clause',
    version: '4.0.2',
    status: 'ONLINE',
    inferenceLatencyAvg: '110ms',
    accuracyBenchmark: '0.84 Normalized Mutual Info on Twitter Bot Repositories',
    description: 'Discovers covert astroturfing rings by linking nodes through semantic overlap, shared phishing/amplifier URLs, and <120s posting bursts.'
  }
];

export const INITIAL_INVESTIGATIONS: Investigation[] = [
  {
    id: 'inv-8841',
    caseNumber: 'SUR-2026-8841',
    title: 'Cabinet Financial Directive Voice Clone Audio',
    targetSubject: 'Alleged Emergency Central Banking Restriction Audio Clip',
    modality: 'audio',
    status: 'Critical Flag',
    riskLevel: 'Critical',
    createdAt: '2026-11-10T14:22:00Z',
    updatedAt: '2026-11-12T08:15:00Z',
    analyst: 'A. Sharma (Forensics Senior Lead)',
    tags: ['Synthetic Audio', 'Financial Panic', 'Voice Cloning', 'High Priority'],
    description: 'A 24-second voice recording circulated widely across WhatsApp and Telegram purporting to be the Central Bank Governor ordering a nationwide freeze on retail banking withdrawals within 48 hours.',
    mediaType: 'audio/mp3',
    mediaName: 'governor_urgent_directive_leak.mp3',
    isSimulatedDemo: true,
    forensicResult: {
      modality: 'audio',
      authenticity: 'likely_synthetic',
      confidenceScore: 94.6,
      headlineSummary: 'High probability synthetic voice generation (AI speech cloning) with vocoder frequency cutoff at 8.2 kHz and zero natural glottal jitter.',
      detailedFindings: [
        'Acoustic spectrum reveals an artificial sharp band-limiting threshold at 8,200 Hz characteristic of neural vocoders (HiFi-GAN / VITS).',
        'Pitch contour analysis displays micro-prosody uniformity with an unnatural flat pitch variance of < 1.4 Hz over 3-second segments.',
        'Absence of physiologic breathing sounds and speech articulatory clicks prior to plosive consonants /p/ and /b/.',
        'Background ambient noise floor was artificially injected post-synthesis, displaying phase mismatch with the vocal track.'
      ],
      audioSpectrum: {
        sampleRateHz: 44100,
        durationSeconds: 24.3,
        spectralRollOffHz: 8200,
        voiceCloningProbability: 94.6,
        pitchContinuityScore: 98.1,
        backgroundAcousticDiscontinuity: true,
        anomalousFrequencyBands: ['7.8kHz - 8.4kHz Vocoder Cutoff', '120Hz Synthetic Fundamental Harmonics']
      },
      compressionArtifacts: {
        elaScore: 0,
        doubleCompressionFound: false,
        noiseInconsistencyMapAvailable: true,
        notes: 'Audio spectrographic analysis indicates dual track mixing: clean synthetic voice layered onto simulated conference room acoustics.'
      },
      modelsUsed: [
        { name: 'Acoustic-Spectra v3', version: '3.1.0', provider: 'Veritas Speech Lab' },
        { name: 'Gemini 3.8 Flash Audio Forensics', version: '3.8.0', provider: 'Google Cloud' }
      ],
      limitations: [
        'Heavily re-compressed WhatsApp audio codecs (Opus @ 16kbps) can introduce minor spectral loss, but cannot account for the pitch contour rigidity observed.',
        'Assessment provides probabilistic evidence based on acoustic features; does not establish identity of the generating actor.'
      ],
      alternativeHypotheses: [
        'Poor quality phone recording through damaged microphone (ruled out due to clean high-frequency background layer).'
      ],
      analyzedAt: '2026-11-10T14:35:10Z'
    },
    claimResult: {
      originalInput: 'Cabinet and Central Bank declare mandatory withdrawal cap of ₹10,000 across all private banks effective midnight.',
      extractedClaims: [
        'Central Bank ordered mandatory emergency bank withdrawal caps of ₹10,000.',
        'Directives apply immediately to all private retail banks from midnight.'
      ],
      targetClaim: 'Central Bank has mandated an emergency nationwide freeze and withdrawal caps on commercial banks.',
      verdict: 'Contradicted',
      confidenceScore: 97.8,
      verdictRationale: 'Directly contradicted by official releases from the Reserve Bank and Ministry of Finance. Official statements confirm all commercial liquidity operations are fully normal with no withdrawal restrictions contemplated.',
      sources: [
        {
          title: 'Reserve Bank Clarifies on Rumours Regarding Banking Operations',
          url: 'https://rbi.org.in/press-releases/banking-liquidity-status',
          domain: 'rbi.org.in',
          publishDate: '2026-11-10',
          excerpt: 'The Reserve Bank cautions public against malicious viral audio clips circulating on messaging apps. No withdrawal limits or operational freezes have been imposed.',
          stance: 'contradicts',
          credibilityRating: 'High Authority'
        },
        {
          title: 'PIB Fact Check: Viral Audio Claiming Banking Freeze is Fabricated',
          url: 'https://pib.gov.in/factcheck/banking-directive-hoax',
          domain: 'pib.gov.in',
          publishDate: '2026-11-10',
          excerpt: 'PIB Fact Check team investigated the audio clip attributed to the Governor. The voice is confirmed to be an AI-generated clone; no such circular has been issued.',
          stance: 'contradicts',
          credibilityRating: 'High Authority'
        },
        {
          title: 'Financial Markets Stable: No Emergency Notifications from Ministry',
          url: 'https://www.reuters.com/markets/asia/banking-operations-normal-clarification',
          domain: 'reuters.com',
          publishDate: '2026-11-10',
          excerpt: 'Commercial bank representatives affirmed full cash availability and ATM replenishment across all metropolitan zones.',
          stance: 'contradicts',
          credibilityRating: 'Established News'
        }
      ],
      supportingCount: 0,
      contradictingCount: 3,
      neutralCount: 0,
      factCheckerConsensus: 'Universal Consensus: Completely Fabricated Hoax',
      limitations: [
        'Real-time web verification relies on published government and established press debunking records.'
      ],
      timestamp: '2026-11-10T14:40:00Z'
    }
  },
  {
    id: 'inv-9014',
    caseNumber: 'SUR-2026-9014',
    title: 'Coordinated Botnet Campaign "Operation Gridlock"',
    targetSubject: 'Inauthentic Synchronized Amplification of Infrastructure Sabotage Panic',
    modality: 'social_dataset',
    status: 'Critical Flag',
    riskLevel: 'Critical',
    createdAt: '2026-11-11T09:10:00Z',
    updatedAt: '2026-11-12T07:30:00Z',
    analyst: 'V. Raman (Network Intelligence Analyst)',
    tags: ['Coordinated Inauthentic Behavior', 'Botnet', 'Astroturfing', 'Graph Theory'],
    description: 'Automated monitoring detected 24 social accounts posting identical phrasing within a 9-minute window, pointing to a deceptive URL hosting panic-inducing phishing content.',
    mediaType: 'application/json',
    mediaName: 'gridlock_campaign_posts_24acc.json',
    isSimulatedDemo: true,
    campaignResult: {
      datasetName: 'Operation Gridlock - 24 Nodes / 42 Inauthentic Edges',
      totalPosts: 24,
      totalAccounts: 24,
      overallCoordinationIndex: 88.4,
      clusters: [
        {
          id: 1,
          name: 'Cluster A: Synchronized Panic Injectors',
          color: '#ef4444',
          postCount: 11,
          accountCount: 11,
          primaryNarrative: 'URGENT: Grid failure confirmed by operators, withdraw fuel & cash now before 6 PM!',
          burstDurationMinutes: 8.5,
          coordinationScore: 93.2,
          topSharedDomains: ['bit.ly/emergency-grid-notice', 'tele-group.me/alertzone'],
          topHashtags: ['#GridBlackout2026', '#EmergencyAlert', '#CashNow'],
          identifiedTactics: ['Copypasta text propagation', 'Exact 45-second offset scheduling', 'Newly created 0-follower accounts']
        },
        {
          id: 2,
          name: 'Cluster B: Secondary Amplification Ring',
          color: '#f97316',
          postCount: 8,
          accountCount: 8,
          primaryNarrative: 'Friends working at substations saying they are hiding the truth from mainstream TV.',
          burstDurationMinutes: 14.0,
          coordinationScore: 84.7,
          topSharedDomains: ['tele-group.me/alertzone'],
          topHashtags: ['#GridBlackout2026', '#PowerCut'],
          identifiedTactics: ['Social proof simulation ("My cousin works at...")', 'Quote-retweet cascades']
        },
        {
          id: 3,
          name: 'Cluster C: Astroturfed Hashtag Trenders',
          color: '#06b6d4',
          postCount: 5,
          accountCount: 5,
          primaryNarrative: 'Why is nobody reporting on the substation fires? Stay safe everyone.',
          burstDurationMinutes: 22.0,
          coordinationScore: 76.5,
          topSharedDomains: [],
          topHashtags: ['#GridBlackout2026', '#SubstationSafety'],
          identifiedTactics: ['Algorithmic hashtag seeding to force trending topics']
        }
      ],
      nodes: [
        {
          id: 'post-01',
          accountHandle: '@AlertsDesk99',
          displayName: 'Citizen Alert Bureau',
          avatarSeed: 'alerts',
          accountAgeDays: 4,
          followerCount: 12,
          timestamp: '2026-11-11T08:45:00Z',
          content: 'URGENT CONFIRMED: National electric grid collapsing across 4 sectors. Withdraw cash and fuel immediately before 6 PM curfew! Full status: bit.ly/emergency-grid-notice #GridBlackout2026',
          urls: ['bit.ly/emergency-grid-notice'],
          hashtags: ['#GridBlackout2026', '#EmergencyAlert'],
          clusterId: 1,
          botLikelihoodScore: 92,
          amplificationWeight: 22
        },
        {
          id: 'post-02',
          accountHandle: '@SafeNewsLive4',
          displayName: 'Daily Metro Brief',
          avatarSeed: 'metro',
          accountAgeDays: 3,
          followerCount: 6,
          timestamp: '2026-11-11T08:45:45Z',
          content: 'URGENT CONFIRMED: National electric grid collapsing across 4 sectors. Withdraw cash and fuel immediately before 6 PM curfew! Full status: bit.ly/emergency-grid-notice #GridBlackout2026',
          urls: ['bit.ly/emergency-grid-notice'],
          hashtags: ['#GridBlackout2026', '#EmergencyAlert'],
          clusterId: 1,
          botLikelihoodScore: 94,
          amplificationWeight: 20
        },
        {
          id: 'post-03',
          accountHandle: '@QuickPulse71',
          displayName: 'Quick Pulse News',
          avatarSeed: 'quick',
          accountAgeDays: 5,
          followerCount: 19,
          timestamp: '2026-11-11T08:46:30Z',
          content: 'URGENT CONFIRMED: National electric grid collapsing across 4 sectors. Withdraw cash and fuel immediately before 6 PM curfew! Check zone status: bit.ly/emergency-grid-notice #GridBlackout2026',
          urls: ['bit.ly/emergency-grid-notice'],
          hashtags: ['#GridBlackout2026', '#CashNow'],
          clusterId: 1,
          botLikelihoodScore: 91,
          amplificationWeight: 19
        },
        {
          id: 'post-04',
          accountHandle: '@PowerWatcher_09',
          displayName: 'Power Observer',
          avatarSeed: 'watcher',
          accountAgeDays: 2,
          followerCount: 3,
          timestamp: '2026-11-11T08:47:15Z',
          content: 'Major substations under cyberattack, total blackout in 2 hours. Stock up provisions now. Verified link: bit.ly/emergency-grid-notice #GridBlackout2026',
          urls: ['bit.ly/emergency-grid-notice'],
          hashtags: ['#GridBlackout2026'],
          clusterId: 1,
          botLikelihoodScore: 96,
          amplificationWeight: 18
        },
        {
          id: 'post-05',
          accountHandle: '@Rajan_SubstationX',
          displayName: 'Rajan Engineer',
          avatarSeed: 'rajan',
          accountAgeDays: 14,
          followerCount: 45,
          timestamp: '2026-11-11T08:52:00Z',
          content: 'My colleagues at northern grid dispatch just evacuated the control room. Media gag order in place. Join Telegram: tele-group.me/alertzone #GridBlackout2026',
          urls: ['tele-group.me/alertzone'],
          hashtags: ['#GridBlackout2026'],
          clusterId: 2,
          botLikelihoodScore: 82,
          amplificationWeight: 16
        },
        {
          id: 'post-06',
          accountHandle: '@TechWorkerPriya',
          displayName: 'Priya K',
          avatarSeed: 'priya',
          accountAgeDays: 18,
          followerCount: 88,
          timestamp: '2026-11-11T08:53:10Z',
          content: 'Heard from internal engineers that generators failed at the main terminal. Why are mainstream channels silent? tele-group.me/alertzone #GridBlackout2026',
          urls: ['tele-group.me/alertzone'],
          hashtags: ['#GridBlackout2026'],
          clusterId: 2,
          botLikelihoodScore: 78,
          amplificationWeight: 15
        },
        {
          id: 'post-07',
          accountHandle: '@TruthFinder901',
          displayName: 'Truth Seeker',
          avatarSeed: 'truth',
          accountAgeDays: 6,
          followerCount: 22,
          timestamp: '2026-11-11T08:55:00Z',
          content: 'Substation fires breaking out simultaneously in 3 districts. Check tele-group.me/alertzone for uncensored footage #GridBlackout2026 #SubstationSafety',
          urls: ['tele-group.me/alertzone'],
          hashtags: ['#GridBlackout2026', '#SubstationSafety'],
          clusterId: 2,
          botLikelihoodScore: 85,
          amplificationWeight: 16
        },
        {
          id: 'post-08',
          accountHandle: '@DailyVoiceIndia',
          displayName: 'Voice of People',
          avatarSeed: 'voice',
          accountAgeDays: 9,
          followerCount: 110,
          timestamp: '2026-11-11T09:01:00Z',
          content: 'Are you guys noticing voltage fluctuations too? Seeing rumors about #GridBlackout2026 everywhere. Stay safe.',
          urls: [],
          hashtags: ['#GridBlackout2026'],
          clusterId: 3,
          botLikelihoodScore: 68,
          amplificationWeight: 14
        },
        {
          id: 'post-09',
          accountHandle: '@UrbanPulseHQ',
          displayName: 'Urban Pulse',
          avatarSeed: 'urban',
          accountAgeDays: 12,
          followerCount: 95,
          timestamp: '2026-11-11T09:03:00Z',
          content: 'Huge crowd gathering at ATMs and petrol bunks following reports of #GridBlackout2026. Anyone has verified updates?',
          urls: [],
          hashtags: ['#GridBlackout2026'],
          clusterId: 3,
          botLikelihoodScore: 61,
          amplificationWeight: 13
        }
      ],
      edges: [
        { id: 'e1-2', source: 'post-01', target: 'post-02', weight: 0.98, coordinationType: 'semantic_copy', description: '99% verbatim text match within 45s' },
        { id: 'e1-3', source: 'post-01', target: 'post-03', weight: 0.95, coordinationType: 'semantic_copy', description: '96% verbatim text match with shared phishing URL' },
        { id: 'e2-3', source: 'post-02', target: 'post-03', weight: 0.94, coordinationType: 'semantic_copy', description: 'Identical call to action and URL' },
        { id: 'e1-4', source: 'post-01', target: 'post-04', weight: 0.88, coordinationType: 'shared_url', description: 'Shared shortened phishing URL within 2 minutes' },
        { id: 'e5-6', source: 'post-05', target: 'post-06', weight: 0.86, coordinationType: 'temporal_burst', description: 'Synchronized "insider source" narrative pushing Telegram channel' },
        { id: 'e5-7', source: 'post-05', target: 'post-07', weight: 0.82, coordinationType: 'shared_url', description: 'Shared Telegram invite link' },
        { id: 'e6-7', source: 'post-06', target: 'post-07', weight: 0.84, coordinationType: 'shared_url', description: 'Shared Telegram invite link' },
        { id: 'e7-8', source: 'post-07', target: 'post-08', weight: 0.72, coordinationType: 'hashtag_cascade', description: 'Hashtag propagation from synthetic cluster to organic trenders' },
        { id: 'e8-9', source: 'post-08', target: 'post-09', weight: 0.69, coordinationType: 'temporal_burst', description: 'Atmospheric panic reaction within 2 minutes' }
      ],
      burstTimestamps: [
        { time: '08:45', count: 4, clusterId: 1 },
        { time: '08:50', count: 6, clusterId: 1 },
        { time: '08:55', count: 7, clusterId: 2 },
        { time: '09:00', count: 4, clusterId: 3 },
        { time: '09:05', count: 3, clusterId: 3 }
      ],
      tacticalSummary: [
        'Phase 1: Seed high-urgency panic message across newly registered burner accounts with exact 45-second intervals.',
        'Phase 2: Introduce "insider testimony" persona accounts pushing readers toward an unmoderated Telegram channel.',
        'Phase 3: Amplify generic questions containing the campaign hashtag to push it into local trending algorithms.'
      ],
      alternativeExplanations: [
        'A small number of nodes in Cluster C represent genuine concerned citizens asking questions after seeing the artificial trend.',
        'Identical wording can occasionally occur from viral copy-pasting by real users, but the exact timestamp spacing strongly indicates programmatic automation.'
      ],
      timestamp: '2026-11-11T09:20:00Z'
    }
  },
  {
    id: 'inv-7429',
    caseNumber: 'SUR-2026-7429',
    title: 'Manipulated Border Security Drone Footage',
    targetSubject: 'Altered Defense Briefing Video with Face-Swap Synthesis',
    modality: 'video',
    status: 'Critical Flag',
    riskLevel: 'Critical',
    createdAt: '2026-11-09T18:00:00Z',
    updatedAt: '2026-11-11T16:20:00Z',
    analyst: 'M. Chen (Computer Vision Forensics)',
    tags: ['Video Face Swap', 'Deepfake', 'Temporal Jitter', 'Defense'],
    description: 'A 14-second video clip claiming to depict an active military commander stating unauthorized cross-border incursions were authorized by higher command.',
    mediaType: 'video/mp4',
    mediaName: 'briefing_command_excerpt_altered.mp4',
    isSimulatedDemo: true,
    forensicResult: {
      modality: 'video',
      authenticity: 'likely_synthetic',
      confidenceScore: 92.4,
      headlineSummary: 'High-confidence facial replacement deepfake with temporal warping jitter and chromatic boundary mismatches around jawline and collar.',
      detailedFindings: [
        'Facial boundary segmentation masks show edge-smoothing blur and bilateral blur inconsistency in frames 34 through 92.',
        'Temporal jitter analysis reveals frame-to-frame eye landmark position oscillations exceeding biological saccadic velocity limits.',
        'Pupillary corneal specular reflection does not match the directional ambient spotlighting in the background briefing room.',
        'Lip-sync audio-visual synchronization offset of +140ms with phoneme-viseme mismatch on bilabial consonants (/m/, /b/, /p/).'
      ],
      faces: [
        {
          id: 'face-01',
          x: 34,
          y: 20,
          width: 32,
          height: 48,
          confidence: 98.7,
          manipulationScore: 92.4,
          anomaliesDetected: [
            'Jawline Poisson blending seam visible at 400% zoom',
            'Corneal reflection incongruity (light source at 210° vs background 45°)',
            'Temporal warping frequency spike at 18 Hz'
          ]
        }
      ],
      videoFrames: [
        { frameIndex: 12, timestampSeconds: 0.4, anomalyScore: 18, isKeyframe: true, artifactsDetected: ['Natural motion blur'] },
        { frameIndex: 28, timestampSeconds: 0.93, anomalyScore: 35, isKeyframe: false, artifactsDetected: ['Initial facial mask alignment shift'] },
        { frameIndex: 45, timestampSeconds: 1.5, anomalyScore: 89, isKeyframe: true, artifactsDetected: ['Jawline blending seam', 'Chromatic aberration step'] },
        { frameIndex: 68, timestampSeconds: 2.26, anomalyScore: 94, isKeyframe: true, artifactsDetected: ['Pupil specular highlight anomaly', 'Unnatural eye blink tearing'] },
        { frameIndex: 92, timestampSeconds: 3.06, anomalyScore: 88, isKeyframe: true, artifactsDetected: ['Phoneme-viseme desynchronization'] },
        { frameIndex: 118, timestampSeconds: 3.93, anomalyScore: 42, isKeyframe: false, artifactsDetected: ['Face turning angle - mask degradation'] },
        { frameIndex: 140, timestampSeconds: 4.66, anomalyScore: 22, isKeyframe: true, artifactsDetected: ['Low confidence transition'] }
      ],
      compressionArtifacts: {
        elaScore: 84,
        doubleCompressionFound: true,
        noiseInconsistencyMapAvailable: true,
        notes: 'H.264 macroblock noise analysis reveals a distinct high-frequency quantization pattern inside the 320x320 facial bounding box compared to the surrounding studio background.'
      },
      modelsUsed: [
        { name: 'Gemini 3.8 Flash Vision Forensics', version: '3.8.0', provider: 'Google Cloud' },
        { name: 'Veritas-ELA Frequency Residual Engine', version: '2.4.1', provider: 'Veritas Computer Vision' }
      ],
      limitations: [
        'Downscaled 720p social media compression reduces high-frequency skin pores; conclusions rely on multi-frame temporal continuity and lighting vectors.',
        'Frame sampling rate (10 fps analyzed) captures primary anomalies; intermittent frame drops may obscure micro-expressions.'
      ],
      alternativeHypotheses: [
        'Aggressive video denoiser or beauty filter software (ruled out due to localized restriction to only facial area while background noise remains high).'
      ],
      analyzedAt: '2026-11-09T18:25:00Z'
    }
  },
  {
    id: 'inv-5120',
    caseNumber: 'SUR-2026-5120',
    title: 'Viral Health Epidemic Fabricated Clinical Graphic',
    targetSubject: 'Manipulated Hospital Mortality Infographic Attributed to Health Ministry',
    modality: 'image',
    status: 'Verified',
    riskLevel: 'Medium',
    createdAt: '2026-11-08T11:40:00Z',
    updatedAt: '2026-11-10T09:12:00Z',
    analyst: 'S. Kulkarni (Fact Verification Lead)',
    tags: ['Medical Misinformation', 'Image Splicing', 'Error Level Analysis', 'Public Health'],
    description: 'An image masquerading as an official health bulletin claiming 42% adverse reactions from a newly distributed vaccine batch in southern districts.',
    mediaType: 'image/png',
    mediaName: 'health_bulletin_urgent_warning.png',
    isSimulatedDemo: true,
    forensicResult: {
      modality: 'image',
      authenticity: 'likely_synthetic',
      confidenceScore: 88.2,
      headlineSummary: 'Image tampering confirmed via Error Level Analysis: spliced numeric figures and fabricated official seal pasted over a genuine 2024 routine advisory.',
      detailedFindings: [
        'Error Level Analysis (ELA) exhibits pronounced high-brightness edge residuals exclusively around the statistical tables ("42% mortality") and the ministry emblem.',
        'Font kerning and anti-aliasing around manipulated numbers do not match the surrounding document typography.',
        'Metadata inspection shows EXIF tag "Software: Adobe Photoshop 25.2" with image creation timestamp 4 days after the alleged release date.',
        'The genuine base document was traced to an October 2024 seasonal dengue advisory with unrelated statistics.'
      ],
      compressionArtifacts: {
        elaScore: 88.2,
        doubleCompressionFound: true,
        noiseInconsistencyMapAvailable: true,
        notes: 'Prominent quantization discrepancy: background text saved at 75% quality, while text box with "42% Adverse Rate" re-encoded at 95% quality.'
      },
      modelsUsed: [
        { name: 'Veritas-ELA Frequency Residual Engine', version: '2.4.1', provider: 'Veritas' },
        { name: 'Gemini 3.8 Flash Vision Forensics', version: '3.8.0', provider: 'Google Cloud' }
      ],
      limitations: [
        'Does not identify author IP or distribution origin; only verifies physical manipulation of the digital document.'
      ],
      alternativeHypotheses: [
        'Compression artifact caused by social media forwarding (refuted by localized text box quality variance).'
      ],
      analyzedAt: '2026-11-08T12:00:00Z'
    },
    claimResult: {
      originalInput: 'Southern clinical trial batch #TR-902 reported 42% severe hospitalization rate according to Health Ministry bulletin.',
      extractedClaims: [
        'Clinical trial batch #TR-902 caused 42% severe hospitalization rate.',
        'Ministry of Health published bulletin warning citizens of batch #TR-902.'
      ],
      targetClaim: 'Official health bulletin warns of 42% hospitalization rate linked to batch #TR-902.',
      verdict: 'Contradicted',
      confidenceScore: 98.4,
      verdictRationale: 'No such batch or bulletin exists in Central Drugs Standard Control Organisation (CDSCO) registers. Health ministry issued a formal alert debunking the forged letterhead.',
      sources: [
        {
          title: 'Ministry of Health & Family Welfare - Fake Document Advisory',
          url: 'https://mohfw.gov.in/updates/fraudulent-batch-warning-debunk',
          domain: 'mohfw.gov.in',
          publishDate: '2026-11-08',
          excerpt: 'A forged letter with altered statistics circulating on WhatsApp is false. The batch code mentioned does not exist in any national regulatory registry.',
          stance: 'contradicts',
          credibilityRating: 'High Authority'
        },
        {
          title: 'WHO National Office: Vaccine Safety Surveillance Metrics Intact',
          url: 'https://who.int/india/news/safety-surveillance-update-2026',
          domain: 'who.int',
          publishDate: '2026-11-08',
          excerpt: 'Adverse event reporting systems indicate standard background rates with zero statistical anomalies in southern districts.',
          stance: 'contradicts',
          credibilityRating: 'High Authority'
        }
      ],
      supportingCount: 0,
      contradictingCount: 2,
      neutralCount: 0,
      factCheckerConsensus: 'Fabricated Spliced Document',
      limitations: ['Verified against national drug safety registries and official gazette.'],
      timestamp: '2026-11-08T12:15:00Z'
    }
  }
];
