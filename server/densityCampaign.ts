import { normalizePosts, tokenize, jaccard, type RawPost } from "./campaign";
import { cosine } from "./inference";
import {performance} from 'node:perf_hooks';
import type {
  CampaignAnalysisResult,
  CampaignCluster,
  NetworkEdge,
  SocialPostNode,
} from "../src/types";

export interface CoordinationConfig {
  windowSeconds?: number;
  minSamples?: number;
  threshold?: number;
  weights?: { text: number; url: number; temporal: number; hashtag: number; semantic: number };
}
/** DBSCAN on a sparse, thresholded multi-signal relationship graph; self counts toward minSamples. */
export function densityClusters(ids: string[], edges: NetworkEdge[], minSamples = 3) {
  const adjacency = new Map(ids.map((id) => [id, new Set([id])]));
  for (const e of edges) {
    adjacency.get(e.source)?.add(e.target);
    adjacency.get(e.target)?.add(e.source);
  }
  const visited = new Set<string>(),
    labels = new Map<string, number>();
  let cluster = 0;
  for (const id of ids) {
    if (visited.has(id)) continue;
    visited.add(id);
    const neighbours = adjacency.get(id)!;
    if (neighbours.size < minSamples) continue;
    cluster++;
    labels.set(id, cluster);
    const queue = [...neighbours],
      queued = new Set(queue);
    for (let i = 0; i < queue.length; i++) {
      const candidate = queue[i];
      if (!visited.has(candidate)) {
        visited.add(candidate);
        const more = adjacency.get(candidate)!;
        if (more.size >= minSamples)
          for (const item of more)
            if (!queued.has(item)) {
              queue.push(item);
              queued.add(item);
            }
      }
      if (!labels.has(candidate)) labels.set(candidate, cluster);
    }
  }
  return labels;
}
function validateRows(rows: any[]) {
  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== "object") throw new Error(`Post ${index + 1}: object required`);
    const id = row.account_id ?? row.accountId ?? row.user_id ?? row.userId ?? row.id;
    const ts = row.timestamp ?? row.time ?? row.created_at ?? row.createdAt ?? row.date;
    const content = row.content ?? row.post_content ?? row.post ?? row.text ?? row.message;
    if (
      (typeof id !== "string" && typeof id !== "number") ||
      !String(id).trim() ||
      String(id).length > 200
    )
      throw new Error(`Post ${index + 1}: account identifier required (maximum 200 characters)`);
    if (typeof content !== "string" || !content.trim() || content.length > 10000)
      throw new Error(`Post ${index + 1}: text required (maximum 10000 characters)`);
    if (typeof ts !== "string" || !Number.isFinite(Date.parse(ts)))
      throw new Error(
        `Post ${index + 1}: valid timestamp required; missing timestamps are never invented`,
      );
    if (
      Array.isArray(row.hashtags) &&
      (row.hashtags.length > 100 ||
        row.hashtags.some((t: any) => typeof t !== "string" || t.length > 200))
    )
      throw new Error(`Post ${index + 1}: invalid hashtags`);
  }
}
const colors = ["#20c5df", "#7481f9", "#e7b451", "#d084f3", "#56c5ab"];
export interface PairObservation {left:number;right:number;text:number;url:number;tag:number;dt:number;score:number}
export interface CampaignTelemetry {candidateGenerationMs:number;similarityComparisonMs:number;clusterConstructionMs:number;evaluatedPairs:number;candidatePairs:number}
export function analyzeDensityCampaign(
  datasetName: string,
  rows: any[],
  isSimulated: boolean,
  config: CoordinationConfig = {},
  vectors: number[][] | null = null,
  observe?: (pair:PairObservation)=>void,
  telemetry?: (measurement:CampaignTelemetry)=>void,
): CampaignAnalysisResult {
  validateRows(rows);
  const normalized = normalizePosts(rows);
  const posts = normalized
    .map((p, i) => ({
      ...p,
      rowIndex:i,
      vector: vectors?.[i],
      postId: rows[i].post_id ?? rows[i].postId,
      allUrls: [
        ...new Set(
          [
            p.url,
            ...(p.content.match(/https?:\/\/[^\s]+/g) || []),
            ...(Array.isArray(rows[i].urls) ? rows[i].urls : []),
          ].filter(
            (url): url is string =>
              typeof url === "string" && url.length <= 2048 && /^https?:\/\//i.test(url),
          ),
        ),
      ].slice(0, 20),
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const window = config.windowSeconds ?? 120,
    minSamples = config.minSamples ?? 3,
    threshold = config.threshold ?? 0.65;
  const weights = config.weights ?? {
    text: 0.35,
    url: 0.15,
    temporal: 0.25,
    hashtag: 0.1,
    semantic: 0.15,
  };
  const weightTotal = Object.values(weights).reduce((a, b) => a + b, 0);
  const tokens = posts.map((p) => tokenize(p.content));
  const byAccount = new Map<string, number[]>();
  posts.forEach((p, i) => byAccount.set(p.accountId, [...(byAccount.get(p.accountId) || []), i]));
  // Inverted keys + adjacent time buckets. Cap popular postings lists and expose reduced recall.
  const index = new Map<string, number[]>(),
    candidates = new Set<string>();
  let truncated = false;
  const candidateStarted=performance.now();
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i],
      bucket = Math.floor(Date.parse(p.timestamp) / (window * 1000));
    const keys = [...tokens[i]].slice(0, 24).map((t) => `t:${t}`);
    keys.push(...p.allUrls.map((url) => `u:${url}`));
    keys.push(...p.hashtags.slice(0, 20).map((t) => `h:${t}`));
    for (const key of keys) {
      for (const b of [bucket - 1, bucket, bucket + 1])
        for (const j of index.get(`${key}:${b}`) || []) {
          if (posts[j].accountId === p.accountId) continue;
          if (candidates.size >= 200000) {
            truncated = true;
            break;
          }
          candidates.add(`${j}:${i}`);
        }
      const k = `${key}:${bucket}`,
        list = index.get(k) || [];
      if (list.length >= 80) {
        list.shift();
        truncated = true;
      }
      list.push(i);
      index.set(k, list);
    }
  }
  const candidateGenerationMs=performance.now()-candidateStarted,comparisonStarted=performance.now();
  type Relationship = {
    source: string;
    target: string;
    score: number;
    observations: number;
    text: number;
    url: number;
    dt: number;
    tag: number;
    semantic: number;
    repeated: boolean;
  };
  const relations = new Map<string, Relationship>();
  let urlActivity = false;
  for (const key of candidates) {
    const [i, j] = key.split(":").map(Number),
      a = posts[i],
      b = posts[j];
    const dt = Math.abs(Date.parse(a.timestamp) - Date.parse(b.timestamp)) / 1000;
    if (dt > window) continue;
    const text = jaccard(tokens[i], tokens[j]),
      url = jaccard(new Set(a.allUrls), new Set(b.allUrls));
    const tag = jaccard(new Set(a.hashtags), new Set(b.hashtags));
    const semantic = a.vector && b.vector ? Math.max(0, cosine(a.vector, b.vector)) : 0;
    if (url) urlActivity = true;
    // Lexical and semantic similarity are one content family, not independent evidence.
    const content = text >= 0.65 || semantic >= 0.85;
    if (!content || (!url && !tag)) continue;
    const temporal = 1 - dt / (window * 2);
    const score =
      (weights.text * text +
        weights.url * url +
        weights.temporal * temporal +
        weights.hashtag * tag +
        weights.semantic * semantic) /
      (weightTotal - (vectors ? 0 : weights.semantic) || 1);
    if (score < threshold) continue;
    observe?.({left:a.rowIndex,right:b.rowIndex,text,url,tag,dt,score});
    const [source, target] = [a.accountId, b.accountId].sort(),
      pair = JSON.stringify([source, target]);
    const previous = relations.get(pair);
    relations.set(pair, {
      source,
      target,
      score: Math.max(previous?.score || 0, score),
      observations: (previous?.observations || 0) + 1,
      text,
      url,
      dt,
      tag,
      semantic,
      repeated: false,
    });
  }
  const similarityComparisonMs=performance.now()-comparisonStarted;
  const edges: NetworkEdge[] = [...relations.values()].map((r, i) => {
    // Require recurrence on BOTH accounts at multiple distinct timestamps, not one viral headline.
    const timed = (id: string) => new Set(byAccount.get(id)!.map((j) => posts[j].timestamp)).size;
    r.repeated = r.observations >= 3 && timed(r.source) >= 3 && timed(r.target) >= 3;
    return {
      id: `relation-${i}`,
      source: r.source,
      target: r.target,
      weight: Number(r.score.toFixed(3)),
      coordinationType: "semantic_copy",
      description: `Token similarity ${(r.text * 100).toFixed(0)}%; URL overlap ${r.url}; hashtag Jaccard ${r.tag.toFixed(2)}; time gap ${r.dt.toFixed(0)}s; ${vectors ? `SBERT cosine ${r.semantic.toFixed(2)}` : "SBERT unavailable"}; ${r.observations} matching post pairs. ${r.repeated ? "Repeated multi-signal activity merits review." : "Single-event association; not evidence of malicious intent."}`,
    };
  });
  const clusterStarted=performance.now();
  const ids = [...byAccount.keys()],
    labels = densityClusters(ids, edges, minSamples);
  const clusterConstructionMs=performance.now()-clusterStarted;
  const groups = new Map<number, string[]>();
  labels.forEach((cl, id) => groups.set(cl, [...(groups.get(cl) || []), id]));
  const suspiciousAccounts = new Set<string>();
  for (const r of relations.values())
    if (r.repeated && labels.has(r.source) && labels.get(r.source) === labels.get(r.target)) {
      suspiciousAccounts.add(r.source);
      suspiciousAccounts.add(r.target);
    }
  const clusters: CampaignCluster[] = [...groups].map(([id, accounts]) => {
    const set = new Set(accounts),
      positions = accounts.flatMap((a) => byAccount.get(a)!);
    const relationshipEdges = edges.filter((e) => set.has(e.source) && set.has(e.target));
    const timestamps = positions.map((i) => Date.parse(posts[i].timestamp));
    const score =
      relationshipEdges.reduce((s, e) => s + e.weight, 0) / (relationshipEdges.length || 1);
    return {
      id,
      name: `Community ${String.fromCharCode(64 + id)}`,
      color: colors[(id - 1) % colors.length],
      postCount: positions.length,
      accountCount: accounts.length,
      primaryNarrative: posts[positions[0]].content.slice(0, 140),
      burstDurationMinutes: (Math.max(...timestamps) - Math.min(...timestamps)) / 60000,
      coordinationScore: Math.round(score * 100),
      topSharedDomains: [
        ...new Set(
          positions
            .flatMap((i) =>
              posts[i].allUrls.map((url) => {
                try {
                  return new URL(url).hostname;
                } catch {
                  return "";
                }
              }),
            )
            .filter(Boolean),
        ),
      ].slice(0, 5),
      topHashtags: [...new Set(positions.flatMap((i) => posts[i].hashtags))].slice(0, 5),
      identifiedTactics: [
        `${relationshipEdges.length} multi-signal associations`,
        accounts.some((a) => suspiciousAccounts.has(a))
          ? "Repeated synchronized amplification; intent unproven"
          : "Single-event overlap; organic or legitimate coordination remains plausible",
      ],
    };
  });
  const meanPosts = posts.length / (ids.length || 1);
  const degreeByAccount = new Map<string, number>();
  edges.forEach((edge) => {
    degreeByAccount.set(edge.source, (degreeByAccount.get(edge.source) || 0) + 1);
    degreeByAccount.set(edge.target, (degreeByAccount.get(edge.target) || 0) + 1);
  });
  const countDeviation = Math.sqrt(
    ids.reduce((s, id) => s + (byAccount.get(id)!.length - meanPosts) ** 2, 0) / (ids.length || 1),
  );
  const nodes: SocialPostNode[] = ids.map((id) => {
    const indices = byAccount.get(id)!,
      first = posts[indices[0]],
      degree = degreeByAccount.get(id) || 0;
    const minutes = new Map<number, number>();
    indices.forEach((i) => {
      const minute = Math.floor(Date.parse(posts[i].timestamp) / 60000);
      minutes.set(minute, (minutes.get(minute) || 0) + 1);
    });
    return {
      id,
      accountHandle: first.username.startsWith("@") ? first.username : `@${first.username}`,
      displayName: first.username,
      avatarSeed: id,
      accountAgeDays: first.accountAgeDays ?? -1,
      followerCount: first.followerCount ?? -1,
      timestamp: first.timestamp,
      content: first.content,
      urls: [...new Set(indices.flatMap((i) => posts[i].allUrls))],
      hashtags: [...new Set(indices.flatMap((i) => posts[i].hashtags))],
      clusterId: labels.get(id) || 0,
      botLikelihoodScore: null,
      amplificationWeight: 6 + Math.min(14, degree),
      language: first.language,
      suspicious: suspiciousAccounts.has(id),
      posts: indices.map((i) => ({
        id: posts[i].postId,
        timestamp: posts[i].timestamp,
        content: posts[i].content,
      })),
      postingStats: {
        totalPosts: indices.length,
        peakPostsPerMinute: Math.max(0, ...minutes.values()),
        countZScore: countDeviation ? (indices.length - meanPosts) / countDeviation : 0,
      },
    };
  });
  const buckets = new Map<string, number>();
  posts.forEach((p) => {
    const key = new Date(Math.floor(Date.parse(p.timestamp) / 300000) * 300000).toISOString();
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });
  const languages = new Map<string, number>();
  posts.forEach((p) => languages.set(p.language, (languages.get(p.language) || 0) + 1));
  telemetry?.({candidateGenerationMs,similarityComparisonMs,clusterConstructionMs,evaluatedPairs:candidates.size,candidatePairs:candidates.size});
  return {
    datasetName,
    totalPosts: posts.length,
    totalAccounts: ids.length,
    overallCoordinationIndex: null,
    classification: truncated
      ? "Insufficient evidence"
      : suspiciousAccounts.size
        ? "Suspicious coordinated amplification"
        : !clusters.length && urlActivity
          ? "Organic viral activity"
          : "Insufficient evidence",
    methodology: `Sparse DBSCAN (minSamples ${minSamples}, score threshold ${threshold}, window ${window}s); weighted multi-signal association, not maliciousness probability. ${vectors ? "SBERT embeddings used." : "SBERT unavailable; lexical fallback."}`,
    candidatePairs: candidates.size,
    truncated,
    clusters,
    nodes,
    edges,
    burstTimestamps: [...buckets].map(([time, count]) => ({ time, count, clusterId: 0 })),
    tacticalSummary: [
      `${clusters.length} communities; ${suspiciousAccounts.size} accounts show repeated multi-signal activity. ${truncated ? "Candidate budget reached; recall reduced." : "No candidate budget truncation."}`,
      "No bot-likelihood or maliciousness probability was computed. Intent cannot be established from posts alone.",
    ],
    alternativeExplanations: [
      "Organic viral breaking news",
      "Legitimate coordinated public-information or advocacy campaign",
      "Shared URL, hashtag or ordinary headline alone never establishes suspicious coordination",
    ],
    timestamp: new Date().toISOString(),
    suspiciousPostCount: posts.filter((p) => suspiciousAccounts.has(p.accountId)).length,
    languageBreakdown: [...languages].map(([language, count]) => ({ language, count })),
    engine: "graph_heuristics",
    isSimulated,
  };
}

/** Named original behavior; observer is optional and does not alter baseline calculations. */
export const analyzeDensityCampaignBaseline=analyzeDensityCampaign;
