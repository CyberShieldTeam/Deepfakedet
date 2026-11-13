/**
 * Coordinated campaign detection — transparent graph heuristics.
 *
 * Nodes are accounts. Two accounts are linked when their posts show:
 *  - near-duplicate text (token Jaccard >= 0.45)
 *  - the same shared URL
 *  - posting within 120s of each other with a shared hashtag
 * Clusters are connected components (union-find) over those links.
 * Every score below is a documented formula, not a trained model.
 */
import { CampaignAnalysisResult, CampaignCluster, NetworkEdge, SocialPostNode } from '../src/types';

export interface RawPost {
  accountId: string;
  username: string;
  content: string;
  timestamp: string;
  url?: string;
  hashtags: string[];
  language: string;
  accountAgeDays?: number;
  followerCount?: number;
}

const CLUSTER_COLORS = ['#ef4444', '#f97316', '#eab308', '#a855f7', '#ec4899', '#22d3ee', '#84cc16'];

const pick = (o: any, keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  return undefined;
};

export function normalizePosts(input: any[]): RawPost[] {
  return input
    .map((p, i) => {
      const content = String(pick(p, ['content', 'post_content', 'post', 'text', 'message']) ?? '');
      const urlField = pick(p, ['url', 'shared_url', 'sharedUrl', 'link']);
      const urlsInText = content.match(/https?:\/\/[^\s]+/g) || [];
      let tags = pick(p, ['hashtags', 'tags']);
      if (typeof tags === 'string') tags = tags.split(/[\s,;|]+/);
      const tagList: string[] = Array.isArray(tags) ? tags : [];
      const inline = content.match(/#[\p{L}\p{M}\p{N}_]+/gu) || [];
      const hashtags = Array.from(new Set([...tagList, ...inline].map(t => String(t).trim()).filter(Boolean).map(t => (t.startsWith('#') ? t : '#' + t).toLowerCase())));
      const ts = pick(p, ['timestamp', 'time', 'created_at', 'createdAt', 'date']);
      const parsed = ts ? new Date(ts) : new Date(NaN);
      const accountId = String(pick(p, ['account_id', 'accountId', 'user_id', 'userId', 'id']) ?? `acct-${i}`);
      return {
        accountId,
        username: String(pick(p, ['username', 'handle', 'user', 'accountHandle', 'screen_name']) ?? accountId),
        content,
        timestamp: isNaN(parsed.getTime()) ? new Date(Date.now() - i * 60000).toISOString() : parsed.toISOString(),
        url: urlField ? String(urlField) : urlsInText[0],
        hashtags,
        language: String(pick(p, ['language', 'lang']) ?? detectScriptLanguage(content)),
        accountAgeDays: num(pick(p, ['account_age_days', 'accountAgeDays'])),
        followerCount: num(pick(p, ['followers', 'follower_count', 'followerCount']))
      };
    })
    .filter(p => p.content.trim().length > 0);
}

const num = (v: any) => (v === undefined || v === '' || isNaN(Number(v)) ? undefined : Number(v));

export function detectScriptLanguage(text: string): string {
  if (/[ఀ-౿]/.test(text)) return 'Telugu';
  if (/[ऀ-ॿ]/.test(text)) return 'Hindi';
  return 'English';
}

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/https?:\/\/[^\s]+/g, ' ')
      .replace(/#[\p{L}\p{M}\p{N}_]+/gu, ' ')
      .split(/[^\p{L}\p{M}\p{N}]+/u)
      .filter(w => w.length > 2)
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach(w => b.has(w) && inter++);
  return inter / (a.size + b.size - inter);
}

export function analyzeCampaign(datasetName: string, input: any[], isSimulated: boolean): CampaignAnalysisResult {
  const posts = normalizePosts(input).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const tokens = posts.map(p => tokenize(p.content));

  // --- account-level aggregation
  const accounts = new Map<string, { posts: number[] }>();
  posts.forEach((p, i) => {
    if (!accounts.has(p.accountId)) accounts.set(p.accountId, { posts: [] });
    accounts.get(p.accountId)!.posts.push(i);
  });
  const accountIds = Array.from(accounts.keys());

  // --- pairwise post links, rolled up to account pairs
  type Link = { weight: number; type: NetworkEdge['coordinationType']; desc: string };
  const pairLinks = new Map<string, Link>();
  const suspiciousPosts = new Set<number>();
  const keep = (a: string, b: string, l: Link) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const prev = pairLinks.get(key);
    if (!prev || l.weight > prev.weight) pairLinks.set(key, l);
  };

  for (let i = 0; i < posts.length; i++) {
    for (let j = i + 1; j < posts.length; j++) {
      const a = posts[i], b = posts[j];
      if (a.accountId === b.accountId) continue;
      const sim = jaccard(tokens[i], tokens[j]);
      const dt = Math.abs(new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) / 1000;
      const sharedTag = a.hashtags.find(h => b.hashtags.includes(h));
      let link: Link | null = null;
      if (sim >= 0.45) {
        link = { weight: Math.min(1, 0.5 + sim / 2), type: 'semantic_copy', desc: `${Math.round(sim * 100)}% token overlap, ${Math.round(dt)}s apart` };
      } else if (a.url && b.url && a.url === b.url) {
        link = { weight: dt < 600 ? 0.8 : 0.65, type: 'shared_url', desc: `Same URL ${a.url} shared ${Math.round(dt / 60)} min apart` };
      } else if (sharedTag && dt <= 120) {
        link = { weight: 0.6, type: 'temporal_burst', desc: `Posted ${Math.round(dt)}s apart with ${sharedTag}` };
      }
      if (link) {
        keep(a.accountId, b.accountId, link);
        suspiciousPosts.add(i);
        suspiciousPosts.add(j);
      }
    }
  }

  // --- union-find clustering over account links
  const parent = new Map(accountIds.map(id => [id, id]));
  const find = (x: string): string => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x)!)), parent.get(x)!));
  pairLinks.forEach((_, key) => {
    const [a, b] = key.split('|');
    parent.set(find(a), find(b));
  });
  const groups = new Map<string, string[]>();
  accountIds.forEach(id => {
    const r = find(id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(id);
  });
  const multi = Array.from(groups.values()).filter(g => g.length >= 2).sort((a, b) => b.length - a.length);
  const clusterOf = new Map<string, number>();
  multi.forEach((g, idx) => g.forEach(id => clusterOf.set(id, idx + 1)));

  const edges: NetworkEdge[] = Array.from(pairLinks.entries()).map(([key, l], i) => {
    const [source, target] = key.split('|');
    return { id: `e${i}`, source, target, weight: Number(l.weight.toFixed(2)), coordinationType: l.type, description: l.desc };
  });

  const degree = new Map<string, number>();
  edges.forEach(e => {
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
  });

  const clusters: CampaignCluster[] = multi.map((g, idx) => {
    const set = new Set(g);
    const ce = edges.filter(e => set.has(e.source) && set.has(e.target));
    const possible = (g.length * (g.length - 1)) / 2;
    const density = possible ? ce.length / possible : 0;
    const avgW = ce.reduce((s, e) => s + e.weight, 0) / (ce.length || 1);
    const pIdx = g.flatMap(id => accounts.get(id)!.posts);
    const times = pIdx.map(i => new Date(posts[i].timestamp).getTime()).sort((a, b) => a - b);
    const spanMin = (times[times.length - 1] - times[0]) / 60000;
    const compact = 1 / (1 + spanMin / 30); // 1.0 when all within minutes, decays with spread
    const score = Math.round(100 * (0.35 * density + 0.4 * avgW + 0.25 * compact));
    const count = <T,>(arr: T[]) => {
      const m = new Map<T, number>();
      arr.forEach(x => m.set(x, (m.get(x) || 0) + 1));
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(x => x[0]);
    };
    const types = count(ce.map(e => e.coordinationType));
    const tactics: string[] = types.map(t =>
      t === 'semantic_copy' ? 'Copy-paste / near-duplicate text' : t === 'shared_url' ? 'Repeated URL amplification' : 'Synchronized posting (<2 min) on shared hashtag'
    );
    if (g.some(id => (posts[accounts.get(id)!.posts[0]].accountAgeDays ?? 999) < 30)) tactics.push('Recently created accounts (<30 days)');
    const langs = count(pIdx.map(i => posts[i].language));
    if (langs.length > 1) tactics.push(`Cross-language spread (${langs.join(', ')})`);
    return {
      id: idx + 1,
      name: `Cluster ${String.fromCharCode(65 + idx)}`,
      color: CLUSTER_COLORS[idx % CLUSTER_COLORS.length],
      postCount: pIdx.length,
      accountCount: g.length,
      primaryNarrative: posts[pIdx[0]].content.slice(0, 140),
      burstDurationMinutes: Number(spanMin.toFixed(1)),
      coordinationScore: score,
      topSharedDomains: count(pIdx.map(i => posts[i].url).filter(Boolean) as string[]).slice(0, 3),
      topHashtags: count(pIdx.flatMap(i => posts[i].hashtags)).slice(0, 4),
      identifiedTactics: tactics
    };
  });

  const nodes: SocialPostNode[] = accountIds.map(id => {
    const idxs = accounts.get(id)!.posts;
    const first = posts[idxs[0]];
    const deg = degree.get(id) || 0;
    const young = first.accountAgeDays !== undefined && first.accountAgeDays < 30 ? 15 : 0;
    const lowFollow = first.followerCount !== undefined && first.followerCount < 50 ? 10 : 0;
    // Suspicion score: link degree + repetition + account signals (when provided)
    const suspicion = Math.min(99, Math.round(Math.min(50, deg * 10) + Math.min(20, (idxs.length - 1) * 10) + young + lowFollow + (clusterOf.has(id) ? 10 : 0)));
    return {
      id,
      accountHandle: first.username.startsWith('@') ? first.username : '@' + first.username,
      displayName: first.username,
      avatarSeed: id,
      accountAgeDays: first.accountAgeDays ?? -1,
      followerCount: first.followerCount ?? -1,
      timestamp: first.timestamp,
      content: first.content,
      urls: Array.from(new Set(idxs.map(i => posts[i].url).filter(Boolean) as string[])),
      hashtags: Array.from(new Set(idxs.flatMap(i => posts[i].hashtags))),
      clusterId: clusterOf.get(id) ?? 0,
      botLikelihoodScore: suspicion,
      amplificationWeight: 6 + Math.min(14, deg * 2 + idxs.length * 2),
      language: first.language,
      suspicious: clusterOf.has(id)
    };
  });

  // --- temporal bursts: bucket posts per 5 minutes from the first post
  const t0 = posts.length ? new Date(posts[0].timestamp).getTime() : Date.now();
  const buckets = new Map<number, { count: number; cl: Map<number, number> }>();
  posts.forEach(p => {
    const b = Math.floor((new Date(p.timestamp).getTime() - t0) / 300000);
    if (!buckets.has(b)) buckets.set(b, { count: 0, cl: new Map() });
    const e = buckets.get(b)!;
    e.count++;
    const c = clusterOf.get(p.accountId) ?? 0;
    e.cl.set(c, (e.cl.get(c) || 0) + 1);
  });
  const maxB = Math.max(0, ...buckets.keys());
  const burstTimestamps = Array.from({ length: maxB + 1 }, (_, b) => {
    const e = buckets.get(b);
    const dom = e ? Array.from(e.cl.entries()).sort((x, y) => y[1] - x[1])[0][0] : 0;
    const label = new Date(t0 + b * 300000).toTimeString().slice(0, 5);
    return { time: label, count: e?.count ?? 0, clusterId: dom };
  });

  const inCluster = accountIds.filter(id => clusterOf.has(id)).length;
  const avgScore = clusters.reduce((s, c) => s + c.coordinationScore * c.accountCount, 0) / (inCluster || 1);
  const overall = accountIds.length ? Math.round((inCluster / accountIds.length) * avgScore) : 0;

  const langMap = new Map<string, number>();
  posts.forEach(p => langMap.set(p.language, (langMap.get(p.language) || 0) + 1));

  return {
    datasetName,
    totalPosts: posts.length,
    totalAccounts: accountIds.length,
    overallCoordinationIndex: overall,
    clusters,
    nodes,
    edges,
    burstTimestamps,
    tacticalSummary: clusters.length
      ? clusters.map(c => `${c.name}: ${c.accountCount} accounts, ${c.postCount} posts within ${c.burstDurationMinutes} min — ${c.identifiedTactics.join('; ')}.`)
      : ['No coordinated clusters met the linkage thresholds in this dataset.'],
    alternativeExplanations: [
      'Organic users quoting the same breaking-news headline can produce near-duplicate text.',
      'Popular URLs and trending hashtags are shared by unrelated users during real events.',
      'Thresholds (Jaccard 0.45, 120s window) are heuristics; review flagged accounts manually before action.'
    ],
    timestamp: new Date().toISOString(),
    suspiciousPostCount: suspiciousPosts.size,
    languageBreakdown: Array.from(langMap.entries()).map(([language, count]) => ({ language, count })),
    engine: 'graph_heuristics',
    isSimulated
  };
}

/** Minimal CSV parser supporting quoted fields. */
export function parseCSV(text: string): any[] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(x => x.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(x => x.trim())) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return body.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}
