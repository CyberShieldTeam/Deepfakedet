import { config as loadEnv } from 'dotenv';
import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ApiError, GoogleGenAI } from '@google/genai';
import { INITIAL_INVESTIGATIONS } from './server/demoData';
import { analyzeCampaign, detectScriptLanguage, jaccard, parseCSV, tokenize } from './server/campaign';
import { AI_DIRECT_PROMPT, calibrate, calibrateDirect, elaIndicators, IMAGE_PROMPT, overallVerdict, provenanceAssessment, RawDirectProbe, RawImageSample } from './server/imageDetection';
import { buildDemoInvestigation, demoPosts, DEMO_TIMELINE, DEMO_VERIFIED_REGISTRY } from './server/demoScenario';
import { callLocalImage, localImageResult, type LocalImageResponse } from './server/localImage';
import { callLocalAudio, localAudioResult, type LocalAudioResponse } from './server/localAudio';
import { ClaimVerificationResult, ForensicAnalysisResult, Investigation, LiveEvent, ModelRegistryItem, RiskLevel, GroundedSource } from './src/types';

// ---------------------------------------------------------------- Gemini (server-side only)
// The key is read from the root-level .env on the server and never sent to the browser
// (Vite only exposes VITE_-prefixed variables, and no API response includes it).
loadEnv({ path: path.resolve(import.meta.dirname, '.env'), quiet: true });
const rawKey = (process.env.GEMINI_API_KEY || '').trim();
const GEMINI_KEY = rawKey && !rawKey.startsWith('MY_') ? rawKey : '';
// gemini-2.5-flash is closed to new API keys ("no longer available to new users"). GEMINI_MODEL in .env is
// tried first; if a model is missing, overloaded or out of quota the server fails over to the next one
// and stays there until restart.
const MODEL_CANDIDATES = Array.from(new Set([(process.env.GEMINI_MODEL || '').trim(), 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-lite-latest'].filter(Boolean)));
let GEMINI_MODEL = MODEL_CANDIDATES[0];
const GEMINI_TIMEOUT_MS = 30000;
const ai = GEMINI_KEY ? new GoogleGenAI({ apiKey: GEMINI_KEY, httpOptions: { timeout: GEMINI_TIMEOUT_MS } }) : null;

type GeminiStatus = 'not_configured' | 'checking' | 'ready' | 'invalid_key' | 'model_not_found' | 'quota_exceeded' | 'rate_limited' | 'overloaded' | 'error';
const gemini: { status: GeminiStatus; message: string; lastModelUsed: string | null } = ai
  ? { status: 'checking', message: 'Validating API key and model…', lastModelUsed: null }
  : { status: 'not_configured', message: 'GEMINI_API_KEY is not set in .env — fallback engines in use.', lastModelUsed: null };

/**
 * Google Search grounding has its own quota, separate from plain generation. When it is exhausted we stop
 * calling it for a cool-down period instead of re-sending requests that will certainly fail.
 */
const GROUNDING_COOLDOWN_MS = 15 * 60 * 1000;
const grounding: { status: 'unknown' | 'available' | 'quota_exhausted' | 'rate_limited'; message: string; blockedUntil: number } = {
  status: 'unknown', message: 'Not used yet.', blockedUntil: 0
};

/**
 * Read Google's structured error details. A temporary rate limit carries google.rpc.RetryInfo (retryDelay) and/or a
 * per-minute QuotaFailure; a 429 with neither is a hard quota / plan / billing limit that retrying will not fix.
 */
function parse429(e: any): { kind: 'rate_limited' | 'quota_exhausted'; retryDelayMs?: number; quotaId?: string } {
  const msg = String(e?.message || '');
  let details: any[] = [];
  try { details = JSON.parse(msg.slice(msg.indexOf('{'))).error?.details || []; } catch {}
  const retry = details.find(d => String(d['@type']).endsWith('RetryInfo'))?.retryDelay as string | undefined;
  const quotaId: string | undefined = details.find(d => String(d['@type']).endsWith('QuotaFailure'))?.violations?.[0]?.quotaId;
  const retryDelayMs = retry ? Math.round(parseFloat(retry) * 1000) : undefined;
  // Daily quotas also carry a retryDelay (often an hour+), but waiting is not an option — treat them as exhausted
  // so callers fail over to another model (free-tier quotas are per model).
  if (/PerDay/i.test(quotaId || '')) return { kind: 'quota_exhausted', retryDelayMs, quotaId };
  if (retryDelayMs !== undefined || /PerMinute/i.test(quotaId || '')) return { kind: 'rate_limited', retryDelayMs, quotaId };
  return { kind: 'quota_exhausted', quotaId };
}

/** Map SDK / network errors to an actionable status. Never includes the key itself. */
function classifyGeminiError(e: any): { status: GeminiStatus; message: string; retryDelayMs?: number } {
  const code = e instanceof ApiError ? e.status : Number(e?.status) || 0;
  const msg = String(e?.message || e);
  if (code === 401 || code === 403 || /API key not valid|API_KEY_INVALID|PERMISSION_DENIED|unregistered callers/i.test(msg))
    return { status: 'invalid_key', message: 'Gemini rejected the API key (invalid, revoked, or API not enabled for this project).' };
  if (code === 404 || /NOT_FOUND|no longer available/i.test(msg)) return { status: 'model_not_found', message: `Model "${GEMINI_MODEL}" is not available for this key.` };
  if (code === 429 || /RESOURCE_EXHAUSTED/i.test(msg)) {
    const q = parse429(e);
    return q.kind === 'rate_limited'
      ? { status: 'rate_limited', retryDelayMs: q.retryDelayMs, message: `Temporary rate limit${q.retryDelayMs ? ` (Google asked to retry in ${Math.ceil(q.retryDelayMs / 1000)}s)` : ''}${q.quotaId ? ` [${q.quotaId}]` : ''}.` }
      : { status: 'quota_exceeded', message: `Quota exhausted${q.quotaId ? ` [${q.quotaId}]` : ''} — Google sent no retry information, which indicates a plan/billing limit rather than a temporary rate limit. Check usage at ai.dev/rate-limit.` };
  }
  if (code === 503 || code === 504 || /UNAVAILABLE|DEADLINE_EXCEEDED|high demand|timed? ?out|aborted/i.test(msg))
    return { status: 'overloaded', message: `Gemini is overloaded or timed out (>${GEMINI_TIMEOUT_MS / 1000}s) — temporary, retry shortly.` };
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(msg)) return { status: 'error', message: 'Could not reach the Gemini API (network error).' };
  return { status: 'error', message: `Gemini API error${code ? ` (HTTP ${code})` : ''}: ${msg.slice(0, 160)}` };
}

const scrubKey = (s: string) => (GEMINI_KEY ? s.split(GEMINI_KEY).join('[KEY]') : s);

/** Log a failed call (key scrubbed) and record it as the current Gemini status. */
function noteGeminiFailure(e: any, where: string) {
  const c = classifyGeminiError(e);
  console.warn(`[gemini] ${where} failed → ${c.status}: ${c.message}\n  raw (HTTP ${e?.status ?? '?'}): ${scrubKey(String(e?.message || e)).replace(/\s+/g, ' ').slice(0, 400)}`);
  Object.assign(gemini, { status: c.status, message: c.message });
  return c;
}

const sleepMs = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * generateContent with failover across MODEL_CANDIDATES:
 *  - missing / overloaded model → next model, and GEMINI_MODEL moves on for future calls;
 *  - temporary rate limit → exponential backoff on the same model (1s, 2s, 4s, or Google's retryDelay if ≤ 8s);
 *  - exhausted quota → never retried on the same model; optionally tried once on the next model
 *    (plain-generation quotas are per model), but not for features with a shared quota such as Search grounding.
 * Throws the last error for the caller to fall back on.
 */
async function geminiGenerate(
  req: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>,
  opts: { failoverOnQuota?: boolean } = {}
) {
  const { failoverOnQuota = true } = opts;
  let model = GEMINI_MODEL;
  let backoff = 0;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const r = await ai!.models.generateContent({ ...req, model });
      Object.assign(gemini, { status: 'ready', message: `Working; model ${model}.`, lastModelUsed: model });
      return Object.assign(r, { modelUsed: model });
    } catch (e) {
      const c = classifyGeminiError(e);
      const next = MODEL_CANDIDATES[MODEL_CANDIDATES.indexOf(model) + 1];
      if (c.status === 'rate_limited' && backoff < 3) {
        const wait = c.retryDelayMs && c.retryDelayMs <= 8000 ? c.retryDelayMs : 1000 * 2 ** backoff;
        if (c.retryDelayMs && c.retryDelayMs > 8000) throw e; // too long to hold an HTTP request open
        backoff++;
        console.warn(`[gemini] ${model} rate limited, backing off ${wait}ms (attempt ${backoff}/3)`);
        await sleepMs(wait);
        continue;
      }
      const switchable = c.status === 'model_not_found' || c.status === 'overloaded' || (c.status === 'quota_exceeded' && failoverOnQuota);
      if (switchable && next) {
        console.warn(`[gemini] ${model} ${c.status.replace(/_/g, ' ')} (HTTP ${(e as any)?.status ?? '?'}), trying ${next}`);
        if (c.status !== 'quota_exceeded' && model === GEMINI_MODEL) GEMINI_MODEL = next;
        model = next;
        backoff = 0;
        continue;
      }
      if (c.status === 'overloaded' && attempt === 0) {
        await sleepMs(1500);
        continue;
      }
      throw e;
    }
  }
  throw new Error('Gemini: retry budget exhausted');
}

/** Startup check: a tiny real generation (models.get alone reports models the key can no longer use). */
async function validateGemini() {
  if (!ai) return;
  try {
    const r = await geminiGenerate({ contents: 'Reply with OK.', config: { maxOutputTokens: 5 } });
    Object.assign(gemini, { status: 'ready', message: `Key valid; model ${r.modelUsed} responding.` });
  } catch (e) {
    noteGeminiFailure(e, 'startup validation');
  }
  console.log(`[gemini] ${gemini.status}: ${gemini.message} (active model: ${GEMINI_MODEL})`);
}
/** Transient states (quota, overload, network) still allow attempts; only a bad key or no model blocks calls. */
const geminiUsable = () => !!ai && gemini.status !== 'invalid_key' && gemini.status !== 'model_not_found';
const fallbackNote = (kind: string) =>
  !ai ? `Gemini not configured — ${kind}.` : `Gemini unavailable (${gemini.status.replace(/_/g, ' ')}: ${gemini.message}) — ${kind}.`;

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.use(express.json({ limit: '60mb' }));

// ---------------------------------------------------------------- Local JSON persistence
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE = path.join(DATA_DIR, 'investigations.json');

/** Seed cases shipped with the project are demo data: mark their sources simulated and drop unverifiable links. */
function sanitizeSeed(inv: Investigation): Investigation {
  const clean = JSON.parse(JSON.stringify(inv)) as Investigation;
  clean.isSimulatedDemo = true;
  if (!clean.tags.includes('SIMULATED DEMO')) clean.tags = ['SIMULATED DEMO', ...clean.tags];
  if (clean.claimResult) {
    clean.claimResult.isSimulated = true;
    clean.claimResult.engine = 'simulated_demo';
    clean.claimResult.verificationMode = 'simulated_demo';
    clean.claimResult.sources = clean.claimResult.sources.map(s => ({ ...s, url: '', isSimulated: true, title: s.title.startsWith('[SIMULATED]') ? s.title : `[SIMULATED] ${s.title}` }));
  }
  if (clean.forensicResult) {
    clean.forensicResult.isSimulated = true;
    clean.forensicResult.engine = 'simulated_demo';
    clean.forensicResult.engineNote = 'SIMULATED DEMO RESULT — scripted case data, not output of a real forensic model.';
  }
  if (clean.campaignResult) clean.campaignResult.isSimulated = true;
  return clean;
}

function loadStore(): Investigation[] {
  try {
    if (fs.existsSync(STORE)) return JSON.parse(fs.readFileSync(STORE, 'utf8'));
  } catch (e) {
    console.warn('Could not read store, reseeding', e);
  }
  return INITIAL_INVESTIGATIONS.map(sanitizeSeed);
}
let investigations: Investigation[] = loadStore();
function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE, JSON.stringify(investigations, null, 1));
  } catch (e) {
    console.warn('Persist failed', e);
  }
}
persist();

// ---------------------------------------------------------------- Live event stream (SSE)
const clients = new Set<Response>();
const recentEvents: LiveEvent[] = [];
const stats = { postsIngested: 0, alertsRaised: 0, byLanguage: { English: 0, Hindi: 0, Telugu: 0 } as Record<string, number>, startedAt: new Date().toISOString() };

function broadcast(ev: LiveEvent) {
  recentEvents.unshift(ev);
  recentEvents.splice(200);
  if (ev.kind === 'alert') stats.alertsRaised++;
  const payload = `data: ${JSON.stringify(ev)}\n\n`;
  clients.forEach(c => c.write(payload));
}

function raiseAlert(alertType: LiveEvent['alertType'], severity: LiveEvent['severity'], title: string, text: string, isSimulated: boolean, investigationId?: string) {
  broadcast({ id: crypto.randomUUID(), ts: new Date().toISOString(), platform: 'VERITAS', handle: 'veritas-engine', language: 'English', text, kind: 'alert', severity, alertType, title, investigationId, isSimulated });
}

app.get('/api/stream', (req: Request, res: Response) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`event: snapshot\ndata: ${JSON.stringify(recentEvents.slice(0, 40))}\n\n`);
  clients.add(res);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
});

// Simulated social feed — clearly flagged isSimulated. A real detector runs over it.
const PLATFORMS = ['X', 'WhatsApp fwd', 'Facebook', 'Instagram', 'Telegram', 'YouTube'];
const FEED_POOL: { text: string; lang: string; tag: string }[] = [
  { text: 'Traffic heavy on ORR near Gachibowli this morning, plan accordingly', lang: 'English', tag: '#hyderabad' },
  { text: 'Forwarded as received: drinking water supply will be cut for 5 days, store water now!!', lang: 'English', tag: '#alert' },
  { text: 'Great match at Uppal stadium yesterday!', lang: 'English', tag: '#cricket' },
  { text: 'सरकार ने घोषणा की है कि कल से सभी बैंक 7 दिन बंद रहेंगे, अभी पैसे निकालें', lang: 'Hindi', tag: '#बैंक_बंद' },
  { text: 'आज मौसम सुहाना है, शाम को बारिश की संभावना', lang: 'Hindi', tag: '#मौसम' },
  { text: 'హైదరాబాద్‌లో ఈ రోజు వర్షం పడే అవకాశం ఉంది', lang: 'Telugu', tag: '#వాతావరణం' },
  { text: 'ఈ వీడియో షేర్ చేయండి: నగరంలో నీటిలో విషం కలిపారు, నీళ్లు తాగవద్దు', lang: 'Telugu', tag: '#హెచ్చరిక' },
  { text: 'Metro services running normally on all lines today', lang: 'English', tag: '#hydmetro' },
  { text: 'URGENT: new deepfake video of minister announcing curfew is going viral, is it real?', lang: 'English', tag: '#curfew' }
];
const HANDLES = ['ravi_t', 'news_flash_99', 'sita.m', 'hyd_insider', 'kiran_dev', 'alert_bharat', 'anu_reddy', 'truthbomb_in', 'local_voice', 'vartha_now', 'desh_news24', 'meena_s'];
const window60: LiveEvent[] = [];
const alertedKeys = new Map<string, number>();

function emitPost(text: string, lang: string, tag: string, handle?: string) {
  const ev: LiveEvent = {
    id: crypto.randomUUID(), ts: new Date().toISOString(), platform: PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)],
    handle: handle || HANDLES[Math.floor(Math.random() * HANDLES.length)] + Math.floor(Math.random() * 90), language: lang,
    text: `${text} ${tag}`, kind: 'post', severity: 'info', isSimulated: true
  };
  stats.postsIngested++;
  stats.byLanguage[lang] = (stats.byLanguage[lang] || 0) + 1;
  broadcast(ev);
  detectOnWindow(ev);
}

/** Real (lightweight) detection over the simulated stream: near-duplicate text and hashtag bursts in a 90 s window. */
function detectOnWindow(ev: LiveEvent) {
  const now = Date.now();
  window60.push(ev);
  while (window60.length && now - new Date(window60[0].ts).getTime() > 90000) window60.shift();
  const t = tokenize(ev.text);
  const similar = window60.filter(e => e.handle !== ev.handle && jaccard(tokenize(e.text), t) >= 0.6);
  const key = 'sim:' + Array.from(t).slice(0, 4).join(' ');
  if (similar.length >= 2 && now - (alertedKeys.get(key) || 0) > 120000) {
    alertedKeys.set(key, now);
    raiseAlert('similar_content', 'high', `${similar.length + 1} accounts posting near-identical content`, `"${ev.text.slice(0, 90)}…" (${ev.language}) — detected on simulated feed`, true);
  }
  const tag = (ev.text.match(/#[\p{L}\p{M}\p{N}_]+/u) || [])[0];
  if (tag) {
    const n = window60.filter(e => e.text.includes(tag)).length;
    const bk = 'burst:' + tag;
    if (n >= 5 && now - (alertedKeys.get(bk) || 0) > 120000) {
      alertedKeys.set(bk, now);
      raiseAlert('propagation_burst', 'medium', `Propagation burst on ${tag}`, `${n} posts in 90 s on simulated feed`, true);
    }
  }
}

setInterval(() => {
  const p = FEED_POOL[Math.floor(Math.random() * FEED_POOL.length)];
  emitPost(p.text, p.lang, p.tag);
  // Occasionally a coordinated "wave" of copies from different accounts
  if (Math.random() < 0.12) {
    const w = FEED_POOL.filter((_, i) => [1, 3, 6, 8].includes(i))[Math.floor(Math.random() * 4)];
    [0, 1, 2, 3].forEach(i => setTimeout(() => emitPost(w.text, w.lang, w.tag), 400 + i * 700));
  }
}, 3500);

// ---------------------------------------------------------------- Model registry (honest)
async function modelRegistry(): Promise<ModelRegistryItem[]> {
  const g = gemini.status === 'ready' ? 'ONLINE' : ai ? 'DEGRADED' : 'STANDBY';
  let aasistReady = false;
  if (process.env.VERITAS_AI_SERVICE_URL) {
    try {
      const response = await fetch(`${process.env.VERITAS_AI_SERVICE_URL.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) aasistReady = (await response.json()).audio?.status === 'ready';
    } catch { /* The registry reports the service as degraded below. */ }
  }
  return [
    { id: 'gemini', name: `Google Gemini (${GEMINI_MODEL})`, task: 'Multimodal media reasoning, claim verification, translation', architecture: 'Hosted multimodal LLM + Google Search grounding', license: 'Google API ToS', version: GEMINI_MODEL, status: g as any, inferenceLatencyAvg: ai ? 'network-bound' : 'not configured', accuracyBenchmark: 'No in-house benchmark', description: ai ? `${gemini.status}: ${gemini.message}` : 'Set GEMINI_API_KEY in .env to enable. Fallback engines are used meanwhile.' },
    { id: 'ela', name: 'Browser ELA (JPEG re-encode residual)', task: 'Image compression inconsistency', architecture: 'Canvas re-encode at q=0.90, per-pixel |Δ|, 16×16 block stats', license: 'Project code', version: '1.0', status: 'ONLINE', inferenceLatencyAvg: '<1 s in browser', accuracyBenchmark: 'Signal only — not a classifier', description: 'Real computation on the uploaded pixels.' },
    { id: 'frames', name: 'Video frame sampler + temporal diff', task: 'Temporal anomaly indicators', architecture: 'HTMLVideoElement seek → canvas, mean abs frame difference, z-score spikes', license: 'Project code', version: '1.0', status: 'ONLINE', inferenceLatencyAvg: '1–4 s in browser', accuracyBenchmark: 'Signal only', description: 'Detects cuts/splices; does not detect face swaps on its own.' },
    { id: 'audio', name: 'WebAudio spectral statistics', task: 'Waveform, spectrogram, band-limit & pause analysis', architecture: 'AudioContext decode + radix-2 FFT', license: 'Project code', version: '1.0', status: 'ONLINE', inferenceLatencyAvg: '<2 s in browser', accuracyBenchmark: 'Signal only', description: 'Synthetic-voice indicators are heuristics, not a trained detector.' },
    { id: 'aasist', name: 'AASIST speech anti-spoofing', task: 'Experimental segment-level speech spoof screening', architecture: 'Sinc front end + spectro-temporal graph attention', license: 'MIT (NAVER Clova AI)', version: 'a04c9863f63d', status: aasistReady ? 'ONLINE' : process.env.VERITAS_AI_SERVICE_URL ? 'DEGRADED' : 'STANDBY', inferenceLatencyAvg: aasistReady ? 'CPU-bound' : 'unavailable', accuracyBenchmark: 'No VERITAS accuracy benchmark; scores uncalibrated', description: aasistReady ? 'Local checkpoint loaded. Segment scores are experimental and do not determine authenticity.' : 'Run the Python service with verified AASIST weights and VERITAS_AUDIO_MODEL_ENABLED=1.' },
    { id: 'graph', name: 'Coordination graph heuristics', task: 'Coordinated account clustering', architecture: 'Token Jaccard + shared URL + 120 s sync window → union-find components', license: 'Project code', version: '1.0', status: 'ONLINE', inferenceLatencyAvg: '<100 ms', accuracyBenchmark: 'Transparent thresholds', description: 'Every edge carries a human-readable reason.' },
    { id: 'rules', name: 'Rule-based claim screener', task: 'Offline claim triage', architecture: 'Keyword signals + local verified-claims registry', license: 'Project code', version: '1.0', status: 'ONLINE', inferenceLatencyAvg: '<10 ms', accuracyBenchmark: 'n/a', description: 'Never produces external citations; returns Insufficient Evidence unless the local registry matches.' }
  ];
}

// ---------------------------------------------------------------- Helpers
const riskFrom = (score: number): RiskLevel => (score >= 80 ? 'Critical' : score >= 60 ? 'High' : score >= 40 ? 'Medium' : 'Low');

function parseJSON(text: string): any | null {
  const m = (text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Core APIs
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ONLINE', geminiConfigured: !!ai, geminiReady: gemini.status === 'ready', geminiStatus: gemini.status, geminiMessage: gemini.message,
    geminiModel: ai ? GEMINI_MODEL : null, geminiLastModelUsed: gemini.lastModelUsed, geminiModelCandidates: ai ? MODEL_CANDIDATES : [],
    searchGrounding: ai ? { status: grounding.status, message: grounding.message, retryAfter: grounding.blockedUntil > Date.now() ? new Date(grounding.blockedUntil).toISOString() : null } : null, activeInvestigations: investigations.length, streamClients: clients.size, timestamp: new Date().toISOString() });
});

app.get('/api/models', async (_req, res) => res.json({ models: await modelRegistry() }));

app.get('/api/stats', (_req, res) => {
  const recentAlerts = recentEvents.filter(e => e.kind === 'alert' && Date.now() - new Date(e.ts).getTime() < 10 * 60000);
  const crit = recentAlerts.filter(a => a.severity === 'critical').length;
  const threat = crit >= 2 ? 'CRITICAL' : crit >= 1 || recentAlerts.length >= 4 ? 'HIGH' : recentAlerts.length >= 1 ? 'ELEVATED' : 'GUARDED';
  res.json({ ...stats, threatLevel: threat, recentAlertCount: recentAlerts.length });
});

app.get('/api/investigations', (_req, res) => res.json({ investigations }));

app.get('/api/investigations/:id', (req, res) => {
  const inv = investigations.find(i => i.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Investigation not found' });
  res.json({ investigation: inv });
});

app.post('/api/investigations', (req, res) => {
  const { title, targetSubject, modality, description, analyst, tags, riskLevel } = req.body || {};
  if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required' });
  const now = new Date().toISOString();
  const inv: Investigation = {
    id: `inv-${Date.now().toString(36)}`,
    caseNumber: `SUR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    title,
    targetSubject: targetSubject || 'Unspecified',
    modality: modality || 'image',
    status: 'In Progress',
    riskLevel: riskLevel || 'Medium',
    createdAt: now,
    updatedAt: now,
    analyst: analyst || 'Analyst',
    tags: Array.isArray(tags) ? tags : [],
    description: description || '',
    isSimulatedDemo: false,
    mediaFindings: [],
    claimResults: [],
    timeline: [{ time: now, label: 'Investigation opened', severity: 'info', module: 'Case' }]
  };
  investigations.unshift(inv);
  persist();
  res.status(201).json({ investigation: inv });
});

const RISK_ORDER: RiskLevel[] = ['Informational', 'Low', 'Medium', 'High', 'Critical'];
const maxRisk = (a: RiskLevel, b?: RiskLevel) => (b && RISK_ORDER.indexOf(b) > RISK_ORDER.indexOf(a) ? b : a);

/** Attach a module result to an investigation and log it on the case timeline. */
app.post('/api/investigations/:id/attach', (req, res) => {
  const inv = investigations.find(i => i.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Investigation not found' });
  const { kind, result } = req.body || {};
  if (!result) return res.status(400).json({ error: 'result is required' });
  const now = new Date().toISOString();
  inv.timeline = inv.timeline || [];
  if (kind === 'media') {
    inv.mediaFindings = [result, ...(inv.mediaFindings || [])];
    inv.forensicResult = result;
    inv.riskLevel = maxRisk(inv.riskLevel, result.riskLevel);
    inv.timeline.push({ time: now, label: `Media analysed: ${result.fileName || result.modality} → ${result.authenticity}`, severity: result.riskLevel === 'Critical' ? 'critical' : 'medium', module: 'Media' });
  } else if (kind === 'claim') {
    inv.claimResults = [result, ...(inv.claimResults || [])];
    inv.claimResult = result;
    if (result.verdict === 'Contradicted') inv.riskLevel = maxRisk(inv.riskLevel, 'High');
    inv.timeline.push({ time: now, label: `Claim verified: ${result.verdict}`, severity: result.verdict === 'Contradicted' ? 'high' : 'info', module: 'Claims' });
  } else if (kind === 'campaign') {
    inv.campaignResult = result;
    inv.riskLevel = maxRisk(inv.riskLevel, riskFrom(result.overallCoordinationIndex));
    inv.timeline.push({ time: now, label: `Campaign analysed: ${result.clusters.length} clusters, index ${result.overallCoordinationIndex}`, severity: result.clusters.length ? 'high' : 'info', module: 'Campaign' });
  } else return res.status(400).json({ error: 'kind must be media | claim | campaign' });
  if (inv.riskLevel === 'Critical') inv.status = 'Critical Flag';
  else if (inv.riskLevel === 'High') inv.status = 'Suspicious';
  inv.updatedAt = now;
  persist();
  res.json({ investigation: inv });
});

app.patch('/api/investigations/:id', (req, res) => {
  const idx = investigations.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Investigation not found' });
  investigations[idx] = { ...investigations[idx], ...req.body, id: investigations[idx].id, updatedAt: new Date().toISOString() };
  persist();
  res.json({ investigation: investigations[idx] });
});

app.delete('/api/investigations/:id', (req, res) => {
  const before = investigations.length;
  investigations = investigations.filter(i => i.id !== req.params.id);
  if (investigations.length === before) return res.status(404).json({ error: 'Investigation not found' });
  persist();
  res.json({ success: true });
});

// ---------------------------------------------------------------- Media analysis
/** Transparent rules over measurements computed in the browser. */
function heuristicMedia(modality: string, m: Record<string, any>): { score: number; findings: string[]; alternatives: string[] } {
  const f: string[] = [];
  let score = 15;
  if (modality === 'image') {
    if (m.elaBlockRatio > 4) { score += m.elaBlockRatio > 10 ? 40 : 30; f.push(`ELA: strongest 16×16 block residual is ${Number(m.elaBlockRatio).toFixed(1)}× the median block — localized compression inconsistency (possible splice/edit).`); }
    else if (m.elaBlockRatio > 2.5) { score += 15; f.push(`ELA: moderate block residual spread (${Number(m.elaBlockRatio).toFixed(1)}× median).`); }
    else f.push(`ELA residual fairly uniform (max/median block ratio ${Number(m.elaBlockRatio ?? 0).toFixed(1)}).`);
    if (m.hasExif === false) f.push('No EXIF metadata (normal for screenshots, social-media re-uploads and generator output alike — not evidence either way).');
    else if (m.hasExif) f.push(`EXIF metadata present${m.exifSoftware ? ` (software tag: ${m.exifSoftware})` : ''}.`);
    if (m.exifSoftware && /photoshop|gimp|stable|midjourney|dall|firefly|canva/i.test(m.exifSoftware)) { score += 20; f.push(`Editing/generation software named in metadata: ${m.exifSoftware}.`); }
    if (m.provenanceAI) { score += 45; f.push(`Embedded provenance metadata declares AI generation${m.provenanceHints ? ` (${m.provenanceHints})` : ''}.`); }
    else if (m.c2paManifest) f.push('C2PA Content Credentials present (no AI-generation declaration found).');
  } else if (modality === 'video') {
    if (m.cutCount > 0) { score += Math.min(30, m.cutCount * 12); f.push(`${m.cutCount} abrupt frame-difference spike(s) (z > 3) — scene cuts or splices at ${m.cutTimes || 'n/a'}.`); }
    else f.push('No abrupt temporal discontinuities among sampled frames.');
    if (m.meanFrameDiff < 1.5) { score += 10; f.push('Very low inter-frame motion — possible static image re-encoded as video.'); }
    f.push(`${m.framesSampled} frames sampled over ${Number(m.duration).toFixed(1)} s at ${m.width}×${m.height}.`);
    f.push('Facial inconsistency analysis requires Gemini (keyframes are sent when configured).');
  } else if (modality === 'audio') {
    if (m.sampleRate >= 32000 && m.hfEnergyRatio < 0.01) { score += 25; f.push(`Almost no energy above 8 kHz (${(m.hfEnergyRatio * 100).toFixed(2)}%) despite ${m.sampleRate} Hz sampling — band-limited like some neural vocoders or phone codecs.`); }
    else f.push(`High-frequency energy above 8 kHz: ${(Number(m.hfEnergyRatio ?? 0) * 100).toFixed(2)}%.`);
    if (m.pauseRatio < 0.05 && m.duration > 8) { score += 20; f.push(`Pause ratio ${(m.pauseRatio * 100).toFixed(1)}% — very few breathing gaps for ${m.duration.toFixed(0)} s of speech.`); }
    else f.push(`Pause ratio ${(Number(m.pauseRatio ?? 0) * 100).toFixed(1)}%.`);
    if (m.rmsCV < 0.35) { score += 10; f.push(`Low loudness variation (CV ${Number(m.rmsCV).toFixed(2)}) — flat delivery.`); }
    if (m.clippingRatio > 0.01) f.push(`Clipping on ${(m.clippingRatio * 100).toFixed(1)}% of samples.`);
  }
  return {
    score: Math.min(95, score),
    findings: f,
    alternatives: modality === 'audio'
      ? ['Phone/WhatsApp codecs remove high frequencies.', 'Scripted, professionally read speech has few pauses.']
      : modality === 'video'
      ? ['Normal editing (cuts between camera angles).', 'Platform re-encoding.']
      : ['Social platforms strip metadata and recompress images.', 'Legitimate edits such as cropping, captions or filters.']
  };
}

/** Provenance fields are sent flat in measurements (so they also show in the signals table). */
function provenanceFrom(m: Record<string, any>): ForensicAnalysisResult['provenance'] | undefined {
  if (m.c2paManifest === undefined && m.provenanceAI === undefined) return undefined;
  return { c2paManifest: !!m.c2paManifest, declaresAIGenerated: !!m.provenanceAI, generatorHints: m.provenanceHints ? String(m.provenanceHints).split(', ') : [] };
}

/** Images: two independent Gemini samples → separately calibrated AI-generation and manipulation assessments. */
async function geminiImageAnalysis(fileName: string, mediaData: string, measurements: Record<string, any>, signalFindings: string[], tiles: string[] = []): Promise<ForensicAnalysisResult> {
  const m = mediaData.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error('Invalid image data');
  const dims = measurements.width ? `${measurements.width}×${measurements.height}px, ${measurements.format || 'image'}` : 'unknown size';
  const tileParts = tiles.slice(0, 4).map(t => t.match(/^data:([^;]+);base64,(.+)$/)).filter(Boolean).map(t => ({ inlineData: { mimeType: t![1], data: t![2] } }));
  const ask = () =>
    geminiGenerate({
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: m[1], data: m[2] } }, ...tileParts, { text: IMAGE_PROMPT(dims, tileParts.length) }] }],
      config: { responseMimeType: 'application/json', temperature: 0.4 }
    });
  const probe = () =>
    geminiGenerate({
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: m[1], data: m[2] } }, { text: AI_DIRECT_PROMPT }] }],
      // Temperature 0: the probe's answer should depend on the image, not on sampling luck.
      config: { responseMimeType: 'application/json', temperature: 0 }
    });
  // Three short AI-generation probes (majority rule) + one detailed pass (manipulation + explanatory artifacts).
  const [p1, p2, p3, detailed] = await Promise.allSettled([probe(), probe(), probe(), ask()]);
  const parseProbe = (x: PromiseSettledResult<Awaited<ReturnType<typeof probe>>>) =>
    x.status === 'fulfilled' ? (parseJSON(x.value.text ?? '') as RawDirectProbe | null) : null;
  const probes = [parseProbe(p1), parseProbe(p2), parseProbe(p3)].filter((x): x is RawDirectProbe => !!x && typeof x.aiGeneratedProbability === 'number');
  if (probes.length < 3) {
    // A malformed or failed probe gets one retry, so a single bad response does not discard the analysis.
    const extra = await probe().then(r => parseJSON(r.text ?? '') as RawDirectProbe | null).catch(() => null);
    if (extra && typeof extra.aiGeneratedProbability === 'number') probes.push(extra);
  }
  const sample = detailed.status === 'fulfilled' ? (parseJSON(detailed.value.text ?? '') as RawImageSample | null) : null;
  if (!probes.length && !sample) throw (p1 as PromiseRejectedResult).reason ?? new Error('Gemini returned an unparseable response');
  const firstOk = [p1, p2, p3, detailed].find(x => x.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof probe>>> | undefined;
  const modelUsed = firstOk?.value.modelUsed ?? GEMINI_MODEL;
  const samples = sample ? [sample] : [];

  const prov = provenanceFrom(measurements);
  const explanatory = calibrate(sample?.aiGeneration ? [sample.aiGeneration] : []).indicators;
  const aiGeneration =
    (prov && provenanceAssessment(prov)) ||
    (probes.length ? calibrateDirect(probes, explanatory) : { verdict: 'inconclusive' as const, probability: null, confidence: 0, indicators: explanatory, counterIndicators: [], rationale: 'AI-generation probes failed; no verdict.' });
  const manipulation = calibrate(sample?.manipulation ? [sample.manipulation] : [{ probability: 50 }], elaIndicators(Number(measurements.elaBlockRatio)));
  const o = overallVerdict(aiGeneration, manipulation);
  const label: Record<string, string> = { likely: 'likely', possible: 'possibly', inconclusive: 'inconclusive for', no_indicators_found: 'no indicators of' };
  const headline =
    `AI generation: ${aiGeneration.verdict === 'inconclusive' ? 'inconclusive' : `${label[aiGeneration.verdict]} AI-generated`.replace('no indicators of AI-generated', 'no indicators found')} (${aiGeneration.probability}%). ` +
    `Manipulation: ${manipulation.verdict === 'inconclusive' ? 'inconclusive' : `${label[manipulation.verdict]} manipulated`.replace('no indicators of manipulated', 'no indicators found')} (${manipulation.probability}%).`;

  return {
    modality: 'image', fileName, engine: 'gemini',
    engineNote: `${modelUsed}: ${probes.length} independent AI-generation probe${probes.length === 1 ? '' : 's'} + 1 detailed forensic pass${tileParts.length ? ` with ${tileParts.length} close-up crops` : ''}; verdicts and confidence calibrated by VERITAS rules, not taken from the model directly.`,
    authenticity: o.authenticity, confidenceScore: o.confidence, riskLevel: o.risk,
    aiGeneratedProbability: aiGeneration.probability,
    aiGeneration, manipulation, provenance: prov,
    headlineSummary: headline,
    detailedFindings: [
      ...aiGeneration.indicators.map(i => `[AI-gen · ${i.strength}] ${i.indicator}${i.location ? ` — ${i.location}` : ''}`),
      ...manipulation.indicators.map(i => `[Manipulation · ${i.strength}] ${i.indicator}${i.location ? ` — ${i.location}` : ''}`),
      ...signalFindings.map(x => `[Signal] ${x}`)
    ],
    limitations: [
      ...Array.from(new Set(samples.flatMap(s => s.limitations || []))).slice(0, 3),
      'Visual AI-generation detection is probabilistic; modern generators can produce images with no visible artifacts.',
      prov?.c2paManifest ? 'Provenance metadata was found and checked.' : 'No provenance metadata (C2PA) in this file — screenshots and re-uploads remove it.'
    ],
    alternativeHypotheses: [...aiGeneration.counterIndicators, ...manipulation.counterIndicators].slice(0, 4).concat(aiGeneration.counterIndicators.length ? [] : ['A real photograph that has been heavily processed or compressed.']),
    compressionArtifacts: { elaScore: Number(measurements.elaScore) || 0, doubleCompressionFound: false, noiseInconsistencyMapAvailable: true, notes: 'ELA computed in browser; used only for the manipulation assessment.' },
    modelsUsed: [{ name: 'Gemini', version: modelUsed, provider: 'Google' }, { name: 'VERITAS calibration rules', version: '2.0', provider: 'VERITAS' }],
    measurements, analyzedAt: new Date().toISOString()
  };
}

app.post('/api/forensics/analyze-media', async (req, res) => {
  try {
    const { modality = 'image', fileName = 'upload', mimeType, measurements = {}, mediaData, keyframes, detailTiles } = req.body || {};
    if (!['image', 'video', 'audio'].includes(modality)) return res.status(400).json({ error: 'modality must be image | video | audio' });
    const h = heuristicMedia(modality, measurements);

    let result: ForensicAnalysisResult | null = null;
    let geminiFailure = '';
    let localEvidence: LocalImageResponse | null = null;
    let localAudioEvidence: LocalAudioResponse | null = null;
    if (modality === 'image' && process.env.VERITAS_AI_SERVICE_URL && typeof mediaData === 'string') {
      try {
        const local = await callLocalImage(mediaData, process.env.VERITAS_AI_SERVICE_URL);
        localEvidence = local;
        if (local.classification !== 'INCONCLUSIVE' || !geminiUsable()) {
          result = localImageResult(local, fileName, measurements, h.findings);
          result.provenance = provenanceFrom(measurements);
        }
      } catch (e: any) {
        console.warn(`[local-image] ${String(e?.message || e).slice(0, 160)}`);
      }
    }
    if (modality === 'audio' && process.env.VERITAS_AI_SERVICE_URL && typeof mediaData === 'string') {
      try {
        localAudioEvidence = await callLocalAudio(mediaData, process.env.VERITAS_AI_SERVICE_URL);
        if (!geminiUsable()) result = localAudioResult(localAudioEvidence, fileName, measurements, h.findings);
      } catch (e: any) {
        console.warn(`[local-audio] ${String(e?.message || e).slice(0, 160)}`);
      }
    }
    if (!result && modality === 'image' && geminiUsable() && typeof mediaData === 'string') {
      try {
        result = await geminiImageAnalysis(fileName, mediaData, measurements, h.findings, Array.isArray(detailTiles) ? detailTiles : []);
      } catch (e: any) {
        geminiFailure = noteGeminiFailure(e, 'image analysis').message;
      }
    } else if (!result && geminiUsable()) {
      try {
        const parts: any[] = [];
        const pushData = (d: string) => {
          const m = d.match(/^data:([^;]+);base64,(.+)$/);
          if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
        };
        if (typeof mediaData === 'string') pushData(mediaData);
        if (Array.isArray(keyframes)) keyframes.slice(0, 6).forEach(pushData);
        parts.push({
          text: `You are a careful media-forensics analyst. Examine this ${modality} (${fileName}${modality === 'video' ? ', provided as sampled keyframes' : ''}) for signs of AI generation, deepfake face manipulation, splicing, or synthetic speech.
Browser-computed measurements: ${JSON.stringify(measurements)}.
Be calibrated: if evidence is weak say "inconclusive". Respond ONLY with JSON:
{"authenticity":"likely_synthetic"|"suspicious_artifacts"|"inconclusive"|"likely_authentic","confidenceScore":0-100,"aiGeneratedProbability":0-100,"headlineSummary":string,"detailedFindings":string[],"limitations":string[],"alternativeHypotheses":string[]}`
        });
        const r = await geminiGenerate({ contents: [{ role: 'user', parts }], config: { responseMimeType: 'application/json', temperature: 0.2 } });
        const p = parseJSON(r.text ?? '');
        if (!p) geminiFailure = 'Gemini returned an unparseable response';
        if (p) {
          const conf = Number(p.confidenceScore) || 50;
          const synthetic = p.authenticity === 'likely_synthetic' || p.authenticity === 'suspicious_artifacts';
          result = {
            modality, fileName, engine: 'gemini', engineNote: `Verdict by ${r.modelUsed} combined with browser-computed signals.`,
            authenticity: p.authenticity || 'inconclusive', confidenceScore: conf,
            aiGeneratedProbability: typeof p.aiGeneratedProbability === 'number' ? p.aiGeneratedProbability : null,
            riskLevel: synthetic ? riskFrom(conf) : 'Low',
            headlineSummary: p.headlineSummary || 'Analysis complete.',
            detailedFindings: [...(p.detailedFindings || []), ...h.findings.map(x => `[Signal] ${x}`)],
            limitations: p.limitations || [], alternativeHypotheses: p.alternativeHypotheses || h.alternatives,
            compressionArtifacts: { elaScore: Number(measurements.elaScore) || 0, doubleCompressionFound: false, noiseInconsistencyMapAvailable: modality === 'image', notes: 'ELA computed in browser.' },
            modelsUsed: [{ name: 'Gemini', version: r.modelUsed, provider: 'Google' }, { name: 'Browser signal extraction', version: '1.0', provider: 'VERITAS' }],
            measurements, analyzedAt: new Date().toISOString()
          };
        }
      } catch (e: any) {
        geminiFailure = noteGeminiFailure(e, 'media analysis').message;
      }
    }

    if (!result) {
      if (localEvidence && modality === 'image') {
        result = localImageResult(localEvidence, fileName, measurements, h.findings);
        result.provenance = provenanceFrom(measurements);
      }
      if (localAudioEvidence && modality === 'audio')
        result = localAudioResult(localAudioEvidence, fileName, measurements, h.findings);
    }
    if (!result) {
      const authenticity = h.score >= 60 ? 'suspicious_artifacts' : h.score >= 35 ? 'inconclusive' : 'likely_authentic';
      result = {
        modality, fileName, engine: 'heuristic',
        engineNote: geminiFailure
          ? `Gemini call failed (${geminiFailure}) — heuristic screening from browser-computed signals used instead. This is NOT a trained deepfake classifier.`
          : `${fallbackNote('heuristic screening from browser-computed signals')} This is NOT a trained deepfake classifier.`,
        authenticity, confidenceScore: Math.round(45 + Math.abs(h.score - 50) * 0.6), aiGeneratedProbability: null,
        riskLevel: riskFrom(h.score),
        headlineSummary: `Heuristic manipulation-indicator score ${h.score}/100 from ${h.findings.length} measured signals.`,
        detailedFindings: h.findings,
        limitations: ['Heuristic rules over signal statistics; not a trained classifier.', 'AI-generation probability requires a model (configure GEMINI_API_KEY).', 'Re-encoding by social platforms can mimic or mask artifacts.'],
        alternativeHypotheses: h.alternatives,
        compressionArtifacts: { elaScore: Number(measurements.elaScore) || 0, doubleCompressionFound: false, noiseInconsistencyMapAvailable: modality === 'image', notes: 'ELA computed in browser.' },
        modelsUsed: [{ name: 'Browser signal extraction + rules', version: '1.0', provider: 'VERITAS' }],
        measurements, analyzedAt: new Date().toISOString()
      };
      if (modality === 'image') {
        const prov = provenanceFrom(measurements);
        const ela = elaIndicators(Number(measurements.elaBlockRatio));
        result.provenance = prov;
        result.aiGeneration = (prov && provenanceAssessment(prov)) || {
          verdict: 'inconclusive', probability: null, confidence: 0, indicators: [], counterIndicators: [],
          rationale: 'AI-generation detection needs a vision model (Gemini) or embedded provenance metadata; neither is available for this file.'
        };
        result.manipulation = {
          verdict: ela.some(i => i.strength !== 'weak') ? 'possible' : 'inconclusive', probability: null, confidence: ela.length ? 35 : 15,
          indicators: ela, counterIndicators: [], rationale: 'Heuristic ELA screening only.'
        };
        const o = overallVerdict(result.aiGeneration, result.manipulation);
        Object.assign(result, { authenticity: o.authenticity, riskLevel: o.risk, confidenceScore: o.confidence, aiGeneratedProbability: result.aiGeneration.probability });
      }
    }
    if (localEvidence && result && !result.localImage) {
      result.localImage = localEvidence;
      if (localEvidence.model_status === 'ready') {
        result.modelsUsed.push({ name: localEvidence.model, version: localEvidence.revision, provider: 'Experimental local model; no verdict' });
        result.limitations.push('Experimental local model score failed initial fixture validation and did not determine this verdict.');
      }
      if (localEvidence.face_analysis !== 'not_performed')
        result.modelsUsed.push({ name: 'YuNet face detector', version: '2023mar', provider: 'OpenCV Zoo' });
    }
    if (localAudioEvidence && result && !result.localAudio) {
      result.localAudio = localAudioEvidence;
      result.modelsUsed.push({ name: 'AASIST', version: localAudioEvidence.revision, provider: 'Experimental local model; no verdict' });
      result.limitations.push('AASIST segment scores were not calibrated and did not determine this verdict.');
    }
    if (result.riskLevel === 'High' || result.riskLevel === 'Critical')
      raiseAlert('suspicious_media', result.riskLevel === 'Critical' ? 'critical' : 'high', `Suspicious ${modality} detected`, `${fileName}: ${result.headlineSummary}`, false);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: 'Media analysis failed', details: err.message });
  }
});

// ---------------------------------------------------------------- Claim verification
const RISK_SIGNALS: [RegExp, string][] = [
  [/urgent|breaking|immediately|now!|right now|turant|तुरंत|వెంటనే|ब्रेकिंग|బ్రేకింగ్/i, 'Urgency language'],
  [/share|forward|सबको भेजें|पंपండి|పంపండి|షేర్/i, 'Explicit request to forward/share'],
  [/collapse|burst|flood|evacuat|curfew|poison|बांध|टूट|కూలి|విషం/i, 'Emergency / disaster claim'],
  [/forwarded as received|whatsapp|insider|sources say/i, 'Unattributed source'],
  [/!!|[A-Z]{6,}/, 'Sensational formatting']
];

/** Follow Google's grounding redirect to the publisher URL (no body download); falls back to the redirect link. */
async function resolveSourceUrl(uri: string): Promise<string> {
  try {
    const r = await fetch(uri, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(4000) });
    const loc = r.headers.get('location');
    r.body?.cancel().catch(() => {});
    return loc && /^https?:\/\//.test(loc) ? loc : uri;
  } catch {
    return uri;
  }
}

const CLAIM_SCHEMA = `Respond ONLY with JSON:
{"detectedLanguage":string,"englishTranslation":string,"targetClaim":string,"extractedClaims":string[],"verdict":"Supported"|"Contradicted"|"Mixed Evidence"|"Insufficient Evidence","confidenceScore":0-100,"verdictRationale":string,"supportingEvidence":string[],"contradictingEvidence":string[],"limitations":string[]}`;

/** Confidence ceilings: model knowledge alone is never "high confidence"; grounded results scale with source count. */
const CAP_KNOWLEDGE_ONLY = 55;
const CAP_NO_EXTERNAL_EVIDENCE = 35;
const capForSources = (n: number) => (n >= 3 ? 90 : n === 2 ? 80 : 70);

/**
 * Gemini claim verification. Tries Google Search grounding unless it is in cool-down; on quota/rate failure
 * it records the grounding status and falls back to an explicitly labelled "AI knowledge only" assessment.
 * Sources are only ever those returned in the grounding metadata.
 */
async function geminiVerifyClaim(claimText: string, lang: string): Promise<ClaimVerificationResult> {
  let r: Awaited<ReturnType<typeof geminiGenerate>> | null = null;
  let groundingNote = '';

  if (Date.now() < grounding.blockedUntil) {
    groundingNote = `${grounding.message} Grounding paused until ${new Date(grounding.blockedUntil).toLocaleTimeString()} to avoid repeat failures.`;
  } else {
    try {
      r = await geminiGenerate(
        {
          contents: `You are a rigorous fact-checker. Use Google Search to verify this claim (it may be in English, Hindi or Telugu).\nClaim: """${claimText}"""\n${CLAIM_SCHEMA}\nOnly describe evidence you actually found in search results. If you found nothing relevant, use "Insufficient Evidence".`,
          config: { tools: [{ googleSearch: {} }], temperature: 0.1 }
        },
        { failoverOnQuota: false } // grounding quota is shared across models — retrying elsewhere just burns requests
      );
      Object.assign(grounding, { status: 'available', message: 'Search grounding working.', blockedUntil: 0 });
    } catch (e: any) {
      const c = noteGeminiFailure(e, 'search-grounded claim verification');
      if (c.status === 'invalid_key') throw e;
      if (c.status === 'quota_exceeded') Object.assign(grounding, { status: 'quota_exhausted', message: c.message, blockedUntil: Date.now() + GROUNDING_COOLDOWN_MS });
      else if (c.status === 'rate_limited') Object.assign(grounding, { status: 'rate_limited', message: c.message, blockedUntil: Date.now() + (c.retryDelayMs || 60000) });
      groundingNote = c.message;
      r = null;
    }
  }

  const grounded = !!r;
  if (!r) {
    r = await geminiGenerate({
      contents: `You are a careful fact-checker WITHOUT web access. Assess this claim (it may be in English, Hindi or Telugu) from your own knowledge only.\nClaim: """${claimText}"""\n${CLAIM_SCHEMA}\n"verdict" is your best judgement of whether the claim is true. Do not cite URLs or claim to have checked sources. For recent, local or breaking events you cannot know about, use "Insufficient Evidence".`,
      config: { responseMimeType: 'application/json', temperature: 0.1 }
    });
  }
  const p = parseJSON(r.text ?? '');
  if (!p) throw new Error('Gemini returned an unparseable response');

  const meta = grounded ? r.candidates?.[0]?.groundingMetadata : undefined;
  const chunks: any[] = meta?.groundingChunks || [];
  const supports: any[] = (meta as any)?.groundingSupports || [];
  const retrievedAt = new Date().toISOString();
  const sources: GroundedSource[] = await Promise.all(
    chunks
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.web?.uri)
      .slice(0, 8)
      .map(async ({ c, i }) => {
        const url = await resolveSourceUrl(c.web.uri);
        let domain = c.web.domain || c.web.title || '';
        try { if (url !== c.web.uri) domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
        const citedFor = supports.filter(s => (s.groundingChunkIndices || []).includes(i)).map(s => s.segment?.text).filter(Boolean).slice(0, 2).join(' … ');
        return {
          title: c.web.title || domain, url, domain, retrievedAt, citedFor: citedFor || undefined,
          excerpt: citedFor ? `Cited for: "${citedFor.slice(0, 220)}"` : 'Returned by Google Search grounding for this claim.',
          stance: 'neutral' as const, credibilityRating: /\.gov|\.nic\.in|\.gov\.in/.test(domain) ? 'High Authority' as const : 'Unverified Source' as const
        };
      })
  );

  const modelVerdict: ClaimVerificationResult['verdict'] = ['Supported', 'Contradicted', 'Mixed Evidence', 'Insufficient Evidence'].includes(p.verdict) ? p.verdict : 'Insufficient Evidence';
  const modelConf = Math.max(0, Math.min(100, Number(p.confidenceScore) || 50));
  const lean = (v: string): ClaimVerificationResult['assessment'] => (v === 'Supported' ? 'plausible' : v === 'Contradicted' ? 'implausible' : 'unverified');

  let mode: ClaimVerificationResult['verificationMode'];
  let verdict = modelVerdict;
  let assessment: ClaimVerificationResult['assessment'];
  let cap: number;
  if (grounded && sources.length > 0 && modelVerdict !== 'Insufficient Evidence') {
    mode = 'search_grounded';
    assessment = modelVerdict === 'Supported' ? 'verified_true' : modelVerdict === 'Contradicted' ? 'verified_false' : 'verified_mixed';
    cap = capForSources(sources.length);
  } else if (grounded) {
    mode = 'insufficient_external_evidence';
    verdict = 'Insufficient Evidence';
    assessment = lean(modelVerdict);
    cap = CAP_NO_EXTERNAL_EVIDENCE;
  } else {
    // Model knowledge alone does not verify anything: the 4-way verdict stays "Insufficient Evidence" and the
    // model's own judgement is reported separately as plausible / implausible.
    mode = 'ai_knowledge_only';
    verdict = 'Insufficient Evidence';
    assessment = lean(modelVerdict);
    cap = CAP_KNOWLEDGE_ONLY;
  }
  const confidenceScore = Math.min(modelConf, cap);
  const capped = modelConf > cap;

  return {
    originalInput: claimText, detectedLanguage: p.detectedLanguage || lang, translatedText: p.englishTranslation,
    targetClaim: p.targetClaim || claimText, extractedClaims: p.extractedClaims || [claimText],
    verdict, confidenceScore,
    confidenceNote: capped ? `Model reported ${modelConf}%; capped at ${cap}% for ${mode === 'search_grounded' ? `${sources.length} cited source(s)` : mode === 'ai_knowledge_only' ? 'AI-knowledge-only assessment' : 'no external evidence'}.` : undefined,
    verdictRationale: p.verdictRationale || '',
    supportingEvidence: p.supportingEvidence || [], contradictingEvidence: p.contradictingEvidence || [],
    sources, supportingCount: (p.supportingEvidence || []).length, contradictingCount: (p.contradictingEvidence || []).length, neutralCount: 0,
    limitations: [
      ...(p.limitations || []),
      mode === 'ai_knowledge_only'
        ? 'Google Search grounding was unavailable: this is the model\'s own knowledge. No external sources were checked, so the claim is not verified.'
        : mode === 'insufficient_external_evidence'
        ? 'Google Search was used but returned no usable sources for this claim.'
        : 'Sources are search results cited by Gemini; publication dates are not provided by the grounding API and per-source stance is not independently classified.'
    ],
    timestamp: retrievedAt, engine: 'gemini', modelUsed: r.modelUsed,
    verificationMode: mode, assessment, searchQueries: meta?.webSearchQueries || [],
    engineNote:
      mode === 'search_grounded' ? `Gemini ${r.modelUsed} with Google Search grounding (${sources.length} source${sources.length === 1 ? '' : 's'}).`
      : mode === 'insufficient_external_evidence' ? `Gemini ${r.modelUsed} with Google Search grounding — no usable external sources found.`
      : `Gemini ${r.modelUsed} — AI knowledge only. Search grounding unavailable: ${groundingNote}`
  };
}

app.post('/api/claims/verify', async (req, res) => {
  try {
    const { claimText } = req.body || {};
    if (!claimText || typeof claimText !== 'string' || !claimText.trim()) return res.status(400).json({ error: 'claimText is required' });
    const lang = detectScriptLanguage(claimText);
    let result: ClaimVerificationResult | null = null;
    let geminiFailure = '';

    if (geminiUsable()) {
      try {
        result = await geminiVerifyClaim(claimText, lang);
      } catch (e: any) {
        geminiFailure = noteGeminiFailure(e, 'claim verification').message;
      }
    }

    if (!result) {
      const lower = claimText.toLowerCase();
      const signals = RISK_SIGNALS.filter(([re]) => re.test(claimText)).map(([, l]) => l);
      const reg = DEMO_VERIFIED_REGISTRY.find(r => r.keywords.filter(k => lower.includes(k)).length >= 2);
      const subclaims = claimText.split(/(?<=[.!?।])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 8).slice(0, 4);
      result = {
        originalInput: claimText, detectedLanguage: lang,
        translatedText: lang === 'English' ? undefined : 'Translation unavailable — Gemini not available.',
        targetClaim: subclaims[0] || claimText, extractedClaims: subclaims.length ? subclaims : [claimText],
        verdict: reg ? reg.verdict : 'Insufficient Evidence',
        confidenceScore: reg ? 70 : 20,
        verdictRationale: reg
          ? 'Matched an entry in the local verified-claims registry (demo data). No live web search was performed.'
          : `No live evidence retrieval is configured, so the claim cannot be verified. Rule-based screening found ${signals.length} misinformation risk signal(s)${signals.length ? ': ' + signals.join(', ') : ''}.`,
        supportingEvidence: [], contradictingEvidence: reg ? [reg.statement] : [],
        sources: reg ? [{ title: '[SIMULATED] Local registry — fictional official bulletin', url: '', domain: 'local registry (demo)', excerpt: reg.statement, stance: 'contradicts', credibilityRating: 'High Authority', isSimulated: true }] : [],
        supportingCount: 0, contradictingCount: reg ? 1 : 0, neutralCount: 0,
        factCheckerConsensus: signals.length ? `Risk signals: ${signals.join(', ')}` : undefined,
        limitations: ['No external sources were checked (Gemini not available).', ai ? `Gemini status: ${gemini.message}` : 'Configure GEMINI_API_KEY for search-grounded verification with real citations.'],
        timestamp: new Date().toISOString(), engine: 'heuristic',
        engineNote: geminiFailure ? `Gemini call failed (${geminiFailure}) — rule-based fallback used.` : fallbackNote('rule-based fallback used'),
        isSimulated: !!reg,
        verificationMode: reg ? 'simulated_demo' : 'rule_based',
        assessment: reg ? 'verified_false' : 'unverified'
      };
    }
    if (result.assessment === 'verified_false' || (result.verdict === 'Contradicted' && !result.assessment))
      raiseAlert('claim_contradicted', 'high', 'Claim contradicted', result.targetClaim.slice(0, 140), !!result.isSimulated);
    else if (result.assessment === 'implausible')
      raiseAlert('claim_contradicted', 'medium', 'Claim likely false (AI knowledge only, unverified)', result.targetClaim.slice(0, 140), false);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: 'Claim verification failed', details: err.message });
  }
});

// ---------------------------------------------------------------- Campaign analysis
app.post('/api/campaigns/analyze', (req, res) => {
  try {
    const { datasetName = 'Uploaded dataset', posts, csv, isSimulated = false } = req.body || {};
    const rows = typeof csv === 'string' ? parseCSV(csv) : posts;
    if (!Array.isArray(rows) || rows.length < 2) return res.status(400).json({ error: 'Provide at least 2 posts as JSON array `posts` or CSV text `csv`.' });
    if (rows.length > 3000) return res.status(400).json({ error: 'Dataset too large for the live demo (max 3000 posts).' });
    const result = analyzeCampaign(datasetName, rows, !!isSimulated);
    if (result.clusters.length) {
      const top = result.clusters[0];
      raiseAlert('campaign_detected', top.coordinationScore >= 70 ? 'critical' : 'high', `Coordinated cluster identified (${top.accountCount} accounts)`, `${datasetName}: ${result.clusters.length} cluster(s), coordination index ${result.overallCoordinationIndex}`, !!isSimulated);
    }
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: 'Campaign analysis failed', details: err.message });
  }
});

// ---------------------------------------------------------------- Demo scenario
app.get('/api/demo/sample-dataset', (_req, res) => res.json({ note: 'SIMULATED synthetic dataset for demonstration', posts: demoPosts() }));

let demoRunning = false;
app.post('/api/demo/scenario', (_req, res) => {
  const inv = buildDemoInvestigation();
  investigations.unshift(inv);
  persist();
  if (!demoRunning) {
    demoRunning = true;
    // Replay the scripted timeline as live alerts (compressed: 1 scenario-minute ≈ 0.8 s)
    DEMO_TIMELINE.forEach((t, i) =>
      setTimeout(() => {
        raiseAlert(t.alertType as any, t.entry.severity, `[DEMO 10:${String(t.min).padStart(2, '0')}] ${t.entry.module}`, t.entry.label, true, inv.id);
        if (i === DEMO_TIMELINE.length - 1) demoRunning = false;
      }, 800 + t.min * 800)
    );
    // Inject the multilingual copy-paste wave into the simulated feed
    inv.multilingual?.forEach((v, i) =>
      [0, 1, 2].forEach(k => setTimeout(() => emitPost(v.original, v.language, '#HyderabadFlood', `demo_${v.language.toLowerCase()}_${k}`), 1500 + i * 3000 + k * 500))
    );
  }
  res.status(201).json({ investigation: inv });
});

// ---------------------------------------------------------------- Report
app.get('/api/reports/:id', (req, res) => {
  const inv = investigations.find(i => i.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Investigation not found' });
  const body = JSON.stringify(inv);
  const recs: string[] = [];
  if (inv.claimResults?.some(c => c.verdict === 'Contradicted') || inv.claimResult?.verdict === 'Contradicted') recs.push('Publish a public clarification through official verified channels and share with fact-checking partners.');
  if ((inv.mediaFindings || []).some(m => m.riskLevel === 'High' || m.riskLevel === 'Critical') || inv.forensicResult) recs.push('Preserve original media files with hashes; request original uploads from platforms for higher-fidelity analysis.');
  if (inv.campaignResult?.clusters.length) recs.push(`Report the ${inv.campaignResult.clusters.reduce((s, c) => s + c.accountCount, 0)} clustered accounts to platforms for coordinated inauthentic behaviour review.`);
  if (inv.multilingual?.length) recs.push('Issue counter-messaging in all affected languages (English, Hindi, Telugu).');
  recs.push('Have a human analyst review all heuristic indicators before any enforcement action.');
  res.json({
    report: {
      reportId: `REP-${inv.caseNumber}`,
      generatedAt: new Date().toISOString(),
      integrityHash: 'sha256:' + crypto.createHash('sha256').update(body).digest('hex'),
      geminiConfigured: gemini.status === 'ready',
      recommendations: recs,
      investigation: inv
    }
  });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route' }));

// ---------------------------------------------------------------- Vite / static
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`VERITAS AI running on http://localhost:${PORT} (Gemini: ${ai ? `key found, validating ${GEMINI_MODEL}` : 'not configured — fallback engines'})`));
  validateGemini();
}
start();
