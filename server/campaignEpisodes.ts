import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { normalizePosts, tokenize, jaccard } from "./campaign";
import {
  analyzeDensityCampaignBaseline,
  densityClusters,
  type CoordinationConfig,
  type PairObservation,
} from "./densityCampaign";
import { cosine } from "./inference";
import type { CampaignAnalysisResult, CampaignCluster, NetworkEdge } from "../src/types";

export const EPISODE_POLICY = {
  id: "episodes_v1",
  spanSeconds: 300,
  separationSeconds: 1800,
  minSeparatedEpisodes: 3,
  maxPairs: 5000,
  maxWitnesses: 20000,
  maxFamiliesPerPair: 8,
} as const;
export interface CampaignCoverage {
  start: string;
  end: string;
  complete: boolean;
  source: string;
}
export interface CampaignPostRecord {
  declaredTimestampPrecision?: string;
  reference: string;
  accountId: string;
  postId: string | null;
  idKind: "provided" | "input_reference";
  timestamp: string;
  originalTimestamp: string;
  resolutionMs: number;
  latestPossibleTimestamp: string;
  content: string;
  urls: string[];
  hashtags: string[];
  inputRows: number[];
}
export interface CampaignWitness extends PairObservation {
  id: string;
  source: string;
  target: string;
  sourcePost: string;
  targetPost: string;
  sourceTimestamp: string;
  targetTimestamp: string;
  sharedUrls: string[];
  sharedHashtags: string[];
  semanticCosine: number | null;
  episodeId: string;
}
export interface CampaignEpisode {
  id: string;
  source: string;
  target: string;
  familyId: string;
  start: string;
  end: string;
  latestPossibleEnd: string;
  witnessIds: string[];
  separatedFromPrevious: boolean;
  preciseProvidedIds: boolean;
}
export interface CampaignEpisodeEvidence {
  policy: typeof EPISODE_POLICY;
  observation:
    | "NO_ASSOCIATION"
    | "SINGLE_EPISODE_ASSOCIATION"
    | "SEPARATED_EPISODE_ASSOCIATION"
    | "INCOMPLETE_OBSERVATION";
  posts: CampaignPostRecord[];
  witnesses: CampaignWitness[];
  episodes: CampaignEpisode[];
  associations: {
    edgeId: string;
    source: string;
    target: string;
    witnessIds: string[];
    episodeIds: string[];
    separatedEpisodeCount: number;
    recurrenceEligible: boolean;
  }[];
  coverage: CampaignCoverage | null;
  coverageComplete: boolean;
  duplicatesRemoved: number;
  omittedWitnesses: number;
  omittedAssociations: number;
  warnings: string[];
  timing: {
    preparationMs: number;
    baselineMs: number;
    episodesMs: number;
    graphMs: number;
    totalMs: number;
  };
  memory: { rssBeforeBytes: number; rssAfterBytes: number };
}
const digest = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 24);
const pairKey = (a: string, b: string) => JSON.stringify([a, b].sort());
const intersect = (a: string[], b: string[]) => [...new Set(a.filter((x) => b.includes(x)))].sort();

export function timestampEvidence(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error("Timestamp requires an ISO date or explicit UTC offset");
  const dateOnly = value.length === 10;
  const datePart = value.slice(0, 10),
    calendar = new Date(datePart + "T00:00:00Z");
  if (calendar.toISOString().slice(0, 10) !== datePart) throw new Error("Invalid calendar date");
  const seconds = /T\d{2}:\d{2}:\d{2}/.test(value),
    fraction = value.match(/\.(\d+)(?:Z|[+-])/);
  const resolutionMs = dateOnly
    ? 86400000
    : !seconds
      ? 60000
      : fraction
        ? 10 ** (3 - fraction[1].length)
        : 1000;
  const start = Date.parse(dateOnly ? value + "T00:00:00Z" : value);
  return {
    timestamp: new Date(start).toISOString(),
    originalTimestamp: value,
    resolutionMs,
    latestPossibleTimestamp: new Date(start + resolutionMs - 1).toISOString(),
  };
}

export function prepareCampaignPosts(rows: any[]) {
  const started = performance.now();
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > 3000)
    throw new Error("Expected 2..3000 observed posts");
  const identities = new Map<string, string>();
  const items = rows
    .map((row, index) => {
      if (!row || typeof row !== "object") throw new Error("Post object required");
      const account = row.account_id ?? row.accountId ?? row.user_id ?? row.userId ?? row.id;
      const content = row.content ?? row.post_content ?? row.post ?? row.text ?? row.message;
      if (
        !["string", "number"].includes(typeof account) ||
        !String(account).trim() ||
        String(account).length > 200 ||
        typeof content !== "string" ||
        !content.trim() ||
        content.length > 10000
      )
        throw new Error("Valid account identifier and text required");
      if (
        Array.isArray(row.hashtags) &&
        (row.hashtags.length > 100 ||
          row.hashtags.some((t: any) => typeof t !== "string" || t.length > 200))
      )
        throw new Error("Invalid hashtag bounds");
      const time = timestampEvidence(
        row.timestamp ?? row.time ?? row.created_at ?? row.createdAt ?? row.date,
      );
      const supplied = row.post_id ?? row.postId;
      const declared = row.timestamp_precision ?? row.timestampPrecision;
      const precisions: Record<string, number> = {
        millisecond: 1,
        second: 1000,
        minute: 60000,
        hour: 3600000,
        day: 86400000,
        unknown: 86400000,
      };
      if (declared != null) {
        if (typeof declared !== "string" || !Object.hasOwn(precisions, declared))
          throw new Error("Unsupported declared timestamp precision");
        time.resolutionMs = Math.max(time.resolutionMs, precisions[declared]);
        time.latestPossibleTimestamp = new Date(
          Date.parse(time.timestamp) + time.resolutionMs - 1,
        ).toISOString();
      }
      if (
        supplied != null &&
        (!["string", "number"].includes(typeof supplied) ||
          !String(supplied).trim() ||
          String(supplied).length > 200)
      )
        throw new Error("Invalid provided post ID");
      const accountId = String(account).normalize("NFC").trim(),
        postId = supplied == null ? null : String(supplied);
      const normalized = normalizePosts([
        { ...row, account_id: accountId, content, timestamp: time.timestamp },
      ])[0];
      const urls = [
        ...new Set(
          [
            normalized.url,
            ...(content.match(/https?:\/\/[^\s]+/g) || []),
            ...(Array.isArray(row.urls) ? row.urls : []),
          ].filter(
            (u): u is string =>
              typeof u === "string" && u.length <= 2048 && /^https?:\/\//i.test(u),
          ),
        ),
      ].slice(0, 20);
      const fingerprint = JSON.stringify([
        accountId,
        time.timestamp,
        content.normalize("NFC"),
        [...urls].sort(),
        [...normalized.hashtags].sort(),
      ]);
      if (postId) {
        const key = JSON.stringify([accountId, postId]);
        if (identities.has(key) && identities.get(key) !== fingerprint)
          throw new Error("Conflicting content/timestamp for a supplied account/post ID");
        identities.set(key, fingerprint);
      }
      const reference = "input:" + digest(JSON.stringify([accountId, postId, fingerprint]));
      const record: CampaignPostRecord = {
        ...(declared != null ? { declaredTimestampPrecision: declared as string } : {}),
        reference,
        accountId,
        postId,
        idKind: postId ? "provided" : "input_reference",
        ...time,
        content,
        urls,
        hashtags: normalized.hashtags,
        inputRows: [index],
      };
      return {
        record,
        fingerprint,
        row: {
          ...row,
          account_id: accountId,
          content,
          timestamp: time.timestamp,
          url: normalized.url,
          urls,
          hashtags: normalized.hashtags,
          post_id: reference,
        },
        originalIndex: index,
      };
    })
    .sort(
      (a, b) =>
        a.record.timestamp.localeCompare(b.record.timestamp) ||
        Number(!a.record.postId) - Number(!b.record.postId) ||
        a.record.reference.localeCompare(b.record.reference),
    );
  const unique = new Map<string, (typeof items)[number]>();
  for (const item of items) {
    const previous = unique.get(item.fingerprint);
    if (previous) previous.record.inputRows.push(...item.record.inputRows);
    else unique.set(item.fingerprint, item);
  }
  return {
    items: [...unique.values()],
    duplicatesRemoved: rows.length - unique.size,
    preparationMs: performance.now() - started,
  };
}
export type PreparedCampaign = ReturnType<typeof prepareCampaignPosts>;

export function analyzeEpisodeCampaign(
  datasetName: string,
  rows: any[],
  isSimulated: boolean,
  config: CoordinationConfig = {},
  vectors: number[][] | null = null,
  coverage?: CampaignCoverage,
) {
  return analyzePreparedEpisodeCampaign(
    datasetName,
    prepareCampaignPosts(rows),
    isSimulated,
    config,
    vectors,
    coverage,
  );
}

export function analyzePreparedEpisodeCampaign(
  datasetName: string,
  prepared: PreparedCampaign,
  isSimulated: boolean,
  config: CoordinationConfig = {},
  vectors: number[][] | null = null,
  coverage?: CampaignCoverage,
): CampaignAnalysisResult {
  const started = performance.now(),
    rssBeforeBytes = process.memoryUsage().rss;
  const records = prepared.items.map((i) => i.record),
    rows = prepared.items.map((i) => i.row);
  if (
    coverage &&
    (!coverage.source?.trim() ||
      !Number.isFinite(Date.parse(coverage.start)) ||
      !Number.isFinite(Date.parse(coverage.end)) ||
      Date.parse(coverage.start) >= Date.parse(coverage.end))
  )
    throw new Error("Invalid source coverage declaration");
  const coverageComplete =
    !!coverage?.complete &&
    records.every(
      (p) =>
        p.timestamp >= new Date(coverage.start).toISOString() &&
        p.latestPossibleTimestamp <= new Date(coverage.end).toISOString(),
    );
  const kept: PairObservation[] = [],
    pairs = new Set<string>(),
    omittedPairs = new Set<string>();
  let omittedWitnesses = 0;
  const tick = performance.now();
  // Lexical baseline admissions stay fixed. Optional embeddings are evidence-only, never an E5 verdict gate.
  const base = analyzeDensityCampaignBaseline(
    datasetName,
    rows,
    isSimulated,
    config,
    null,
    (pair) => {
      const key = pairKey(records[pair.left].accountId, records[pair.right].accountId);
      if (!pairs.has(key) && pairs.size >= EPISODE_POLICY.maxPairs) {
        omittedPairs.add(key);
        omittedWitnesses++;
        return;
      }
      if (kept.length >= EPISODE_POLICY.maxWitnesses) {
        omittedWitnesses++;
        return;
      }
      pairs.add(key);
      kept.push(pair);
    },
  );
  const baselineMs = performance.now() - tick,
    episodeStarted = performance.now();
  const byPair = new Map<string, PairObservation[]>();
  for (const pair of kept) {
    const key = pairKey(records[pair.left].accountId, records[pair.right].accountId);
    const list = byPair.get(key) || [];
    list.push(pair);
    byPair.set(key, list);
  }
  const witnesses: CampaignWitness[] = [],
    episodes: CampaignEpisode[] = [],
    associations: CampaignEpisodeEvidence["associations"] = [];
  const edges: NetworkEdge[] = [];
  let familyTruncation = false;
  for (const [key, observations] of byPair) {
    const [source, target] = JSON.parse(key) as string[];
    const families: {
      id: string;
      anchor: Set<string>;
      overlap: string;
      episodes: CampaignEpisode[];
      used: Set<string>;
    }[] = [];
    const pairWitnesses: CampaignWitness[] = [];
    observations.sort(
      (a, b) =>
        records[a.left].timestamp.localeCompare(records[b.left].timestamp) ||
        records[a.right].timestamp.localeCompare(records[b.right].timestamp) ||
        records[a.left].reference.localeCompare(records[b.left].reference) ||
        records[a.right].reference.localeCompare(records[b.right].reference),
    );
    for (const observation of observations) {
      const left = records[observation.left],
        right = records[observation.right];
      const a = left.accountId === source ? left : right,
        b = left.accountId === source ? right : left;
      const sharedUrls = intersect(a.urls, b.urls),
        sharedHashtags = intersect(a.hashtags, b.hashtags);
      const overlap = JSON.stringify([sharedUrls, sharedHashtags]);
      let family = families.find(
        (f) => f.overlap === overlap && jaccard(f.anchor, tokenize(a.content)) >= 0.65,
      );
      if (!family) {
        if (families.length >= EPISODE_POLICY.maxFamiliesPerPair) {
          familyTruncation = true;
          omittedWitnesses++;
          continue;
        }
        family = {
          id: "family:" + digest(key + overlap + a.reference),
          anchor: tokenize(a.content),
          overlap,
          episodes: [],
          used: new Set(),
        };
        families.push(family);
      }
      const start = [a.timestamp, b.timestamp].sort()[0],
        end = [a.timestamp, b.timestamp].sort()[1],
        latest = [a.latestPossibleTimestamp, b.latestPossibleTimestamp].sort()[1];
      if (Date.parse(end) - Date.parse(start) > EPISODE_POLICY.spanSeconds * 1000) {
        omittedWitnesses++;
        continue;
      }
      let episode = family.episodes.at(-1);
      if (
        !episode ||
        Date.parse(end) - Date.parse(episode.start) > EPISODE_POLICY.spanSeconds * 1000
      ) {
        if (episode && Date.parse(end) - Date.parse(start) > EPISODE_POLICY.spanSeconds * 1000) {
          omittedWitnesses++;
          continue;
        }
        const previous = episode;
        episode = {
          id: "episode:" + digest(family.id + start),
          source,
          target,
          familyId: family.id,
          start,
          end,
          latestPossibleEnd: latest,
          witnessIds: [],
          separatedFromPrevious:
            !previous ||
            Date.parse(start) - Date.parse(previous.latestPossibleEnd) >=
              EPISODE_POLICY.separationSeconds * 1000,
          preciseProvidedIds: true,
        };
        family.episodes.push(episode);
        episodes.push(episode);
        family.used = new Set();
      }
      if (family.used.has(a.reference) || family.used.has(b.reference)) continue;
      family.used.add(a.reference);
      family.used.add(b.reference);
      episode.end = end > episode.end ? end : episode.end;
      episode.latestPossibleEnd =
        latest > episode.latestPossibleEnd ? latest : episode.latestPossibleEnd;
      episode.preciseProvidedIds &&=
        !!a.postId && !!b.postId && a.resolutionMs <= 1000 && b.resolutionMs <= 1000;
      const witness: CampaignWitness = {
        ...observation,
        id: "witness:" + digest(a.reference + b.reference),
        source,
        target,
        sourcePost: a.reference,
        targetPost: b.reference,
        sourceTimestamp: a.timestamp,
        targetTimestamp: b.timestamp,
        sharedUrls,
        sharedHashtags,
        semanticCosine:
          vectors?.[observation.left] && vectors?.[observation.right]
            ? cosine(vectors[observation.left], vectors[observation.right])
            : null,
        episodeId: episode.id,
      };
      witnesses.push(witness);
      pairWitnesses.push(witness);
      episode.witnessIds.push(witness.id);
    }
    if (!pairWitnesses.length) continue;
    const ownEpisodes = families.flatMap((f) => f.episodes).filter((e) => e.witnessIds.length);
    const separatedEpisodeCount = Math.max(
      0,
      ...families.map(
        (f) =>
          f.episodes.filter(
            (e) => e.separatedFromPrevious && e.preciseProvidedIds && e.witnessIds.length,
          ).length,
      ),
    );
    const best = pairWitnesses.reduce((a, b) => (a.score >= b.score ? a : b));
    const edgeId = "association:" + digest(key);
    edges.push({
      id: edgeId,
      source,
      target,
      weight: Number(best.score.toFixed(3)),
      coordinationType: "semantic_copy",
      description: `Observed content/URL/hashtag/time association; ${ownEpisodes.length} bounded episodes, ${separatedEpisodeCount} precisely timed separated episodes. Weight cites ${best.id}. Intent and account control unverified.`,
    });
    associations.push({
      edgeId,
      source,
      target,
      witnessIds: pairWitnesses.map((w) => w.id),
      episodeIds: ownEpisodes.map((e) => e.id),
      separatedEpisodeCount,
      recurrenceEligible: false,
    });
  }
  const truncated =
    !!base.truncated || omittedWitnesses > 0 || omittedPairs.size > 0 || familyTruncation;
  for (const association of associations)
    association.recurrenceEligible =
      !truncated &&
      coverageComplete &&
      association.separatedEpisodeCount >= EPISODE_POLICY.minSeparatedEpisodes;
  const episodesMs = performance.now() - episodeStarted,
    graphStarted = performance.now();
  const labels = densityClusters(
    base.nodes.map((n) => n.id),
    edges,
    config.minSamples ?? 3,
  );
  const byReference = new Map(records.map((p) => [p.reference, p]));
  const nodes = base.nodes.map((n) => ({
    ...n,
    clusterId: labels.get(n.id) || 0,
    suspicious: false,
    botLikelihoodScore: null,
    posts: n.posts?.map((p) => ({ ...p, id: byReference.get(p.id!)?.postId || p.id })),
  }));
  const groups = new Map<number, typeof nodes>();
  for (const node of nodes) {
    if (!node.clusterId) continue;
    const list = groups.get(node.clusterId) || [];
    list.push(node);
    groups.set(node.clusterId, list);
  }
  const clusters: CampaignCluster[] = [...groups].map(([id, group]) => {
    const ids = new Set(group.map((n) => n.id)),
      own = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    const times = group.flatMap((n) => (n.posts || []).map((p) => Date.parse(p.timestamp)));
    return {
      id,
      name: `Community ${id}`,
      color: ["#20c5df", "#7481f9", "#e7b451", "#d084f3", "#56c5ab"][(id - 1) % 5],
      postCount: times.length,
      accountCount: group.length,
      primaryNarrative: group[0].content.slice(0, 140),
      burstDurationMinutes: (Math.max(...times) - Math.min(...times)) / 60000,
      coordinationScore: Math.round(
        (own.reduce((sum, e) => sum + e.weight, 0) / Math.max(1, own.length)) * 100,
      ),
      topSharedDomains: [
        ...new Set(
          group
            .flatMap((n) => n.urls)
            .map((url) => {
              try {
                return new URL(url).hostname;
              } catch {
                return "";
              }
            })
            .filter(Boolean),
        ),
      ].slice(0, 5),
      topHashtags: [...new Set(group.flatMap((n) => n.hashtags))].slice(0, 5),
      identifiedTactics: ["Observed associations only; no maliciousness inference"],
    };
  });
  const graphMs = performance.now() - graphStarted;
  const warnings = [
    ...(!coverageComplete
      ? [
          "Observation coverage is missing, incomplete or does not span all timestamp uncertainty; gaps never prove silence.",
        ]
      : ["Coverage completeness is an operator declaration, not independently verified."]),
    ...(records.some((p) => !p.postId)
      ? [
          "Some posts lack platform IDs; stable input references are labeled and cannot establish eligible recurrence.",
        ]
      : []),
    ...(records.some((p) => p.resolutionMs > 1000)
      ? ["Coarse timestamps cannot establish precise separated recurrence."]
      : []),
    ...(truncated
      ? [
          "Candidate/evidence/family/span bounds omitted observations; recurrence eligibility is disabled.",
        ]
      : []),
    "Separated temporal episodes are not independently established real-world events. Legitimate scheduled bulletins can recur.",
    "Semantic values, when available, are diagnostic-only; lexical and semantic similarity are one dependent family.",
  ];
  const evidence: CampaignEpisodeEvidence = {
    policy: EPISODE_POLICY,
    observation: truncated
      ? "INCOMPLETE_OBSERVATION"
      : associations.some((a) => a.separatedEpisodeCount >= 3)
        ? "SEPARATED_EPISODE_ASSOCIATION"
        : edges.length
          ? "SINGLE_EPISODE_ASSOCIATION"
          : "NO_ASSOCIATION",
    posts: records,
    witnesses,
    episodes: episodes.filter((e) => e.witnessIds.length),
    associations,
    coverage: coverage || null,
    coverageComplete,
    duplicatesRemoved: prepared.duplicatesRemoved,
    omittedWitnesses,
    omittedAssociations: omittedPairs.size,
    warnings,
    timing: {
      preparationMs: prepared.preparationMs,
      baselineMs,
      episodesMs,
      graphMs,
      totalMs: prepared.preparationMs + performance.now() - started,
    },
    memory: { rssBeforeBytes, rssAfterBytes: process.memoryUsage().rss },
  };
  return {
    ...base,
    algorithm: "episodes_v1",
    classification: "Insufficient evidence",
    nodes,
    edges,
    clusters,
    truncated,
    suspiciousPostCount: 0,
    overallCoordinationIndex: null,
    methodology: `Episode policy ${EPISODE_POLICY.id}; same lexical association and DBSCAN thresholds as baseline. Observable patterns only; no maliciousness or factual verdict.`,
    episodeEvidence: evidence,
    tacticalSummary: [
      `${edges.length} traceable associations; ${evidence.episodes.length} episodes; ${associations.filter((a) => a.recurrenceEligible).length} pairs eligible for recurrence review.`,
      ...warnings,
    ],
    alternativeExplanations: [
      ...base.alternativeExplanations,
      "Repeated official schedules, news syndication and organizational announcements",
    ],
  };
}
