import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Database, Download, Network, Upload } from "lucide-react";
import { CampaignAnalysisResult, Investigation } from "../types";
import { analyzeCampaign } from "../services/api";
import {
  Button,
  Card,
  Empty,
  EngineBadge,
  ErrorBox,
  Meter,
  SimulatedBadge,
  Stat,
  fmtTime,
} from "./ui";
import { EDGE_LEGEND, ForceGraph } from "./ForceGraph";
import { Details, PageHeader, VerdictBanner } from "./plain";
import type { AttachFn } from "../App";

export const CampaignView: React.FC<{
  attach: AttachFn;
  active: Investigation | null;
  onLiveAnalysis?: () => void;
  onDemonstration?: () => void;
}> = ({ attach, active, onLiveAnalysis, onDemonstration }) => {
  const [result, setResult] = useState<CampaignAnalysisResult | null>(
    active?.campaignResult || null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<number | null>(null);
  const [saved, setSaved] = useState("");
  const [fresh, setFresh] = useState(false);
  const [windowSeconds, setWindowSeconds] = useState(120);
  const [minSamples, setMinSamples] = useState(3);
  const [threshold, setThreshold] = useState(0.65);

  useEffect(() => {
    if (!fresh) setResult(active?.campaignResult || null);
  }, [active?.id]);

  const run = async (p: Parameters<typeof analyzeCampaign>[0]) => {
    if (!p.isSimulated) onLiveAnalysis?.();
    else onDemonstration?.();
    setBusy(true);
    setError("");
    setSelected(null);
    setFilter(null);
    setSaved("");
    try {
      setResult(await analyzeCampaign({ ...p, config: { windowSeconds, minSamples, threshold } }));
      setFresh(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (f: File) => {
    if (f.size > 2_000_000) return setError("Dataset exceeds the 2 MB upload limit.");
    const text = await f.text();
    if (/\.json$/i.test(f.name) || text.trim().startsWith("[") || text.trim().startsWith("{")) {
      try {
        const data = JSON.parse(text);
        run({ datasetName: f.name, posts: Array.isArray(data) ? data : data.posts || [] });
      } catch {
        setError("Invalid JSON file.");
      }
    } else run({ datasetName: f.name, csv: text });
  };

  const loadSample = async () => {
    const posts = await fetch("/api/demo/sample-dataset")
      .then((r) => r.json())
      .then((d) => d.posts);
    run({
      datasetName: "Synthetic sample — Operation Floodgate (SIMULATED)",
      posts,
      isSimulated: true,
    });
  };

  const downloadSample = async () => {
    const posts: any[] = await fetch("/api/demo/sample-dataset")
      .then((r) => r.json())
      .then((d) => d.posts);
    const cols = [
      "account_id",
      "username",
      "content",
      "timestamp",
      "shared_url",
      "hashtags",
      "language",
    ];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...posts.map((p) => cols.map((c) => esc(p[c])).join(","))].join(
      "\n",
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "veritas_sample_dataset_SIMULATED.csv";
    a.click();
  };

  const node = result?.nodes.find((n) => n.id === selected);
  const nodeEdges =
    result?.edges.filter((e) => e.source === selected || e.target === selected) || [];
  const graphNodes = (result?.nodes || [])
    .filter((n) => filter == null || n.clusterId === filter)
    .slice(0, 300);
  const graphIds = new Set(graphNodes.map((n) => n.id));
  const graphEdges = (result?.edges || [])
    .filter((e) => graphIds.has(e.source) && graphIds.has(e.target))
    .slice(0, 2000);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Network intelligence"
        subtitle="Map evidence-based relationships across actual posts. Multi-signal density clustering identifies associations, not malicious intent. Organic news sharing and legitimate coordination remain alternative explanations."
        steps={[
          "Upload a CSV or JSON file of posts — or try our sample",
          "See the groups on the map",
          "Click any account for details",
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          Your file needs columns like: account_id, username, content, timestamp, shared_url,
          hashtags, language.
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-500/60">
            <Upload className="h-3.5 w-3.5" />
            Upload posts (CSV / JSON)
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
          <Button variant="ghost" onClick={loadSample} loading={busy}>
            <Database className="h-3.5 w-3.5" />
            Try with sample posts
          </Button>
          <Button variant="ghost" onClick={downloadSample}>
            <Download className="h-3.5 w-3.5" />
            Download sample file
          </Button>
          {result && fresh && (
            <Button
              onClick={async () => {
                try {
                  const inv = await attach("campaign", result, `Campaign: ${result.datasetName}`);
                  setSaved(inv.caseNumber);
                } catch (e: any) {
                  setError(e.message);
                }
              }}
            >
              {saved ? `Saved to ${saved}` : "Save to a case"}
            </Button>
          )}
        </div>
      </div>
      <details className="rounded-lg border border-slate-800 p-3 text-xs text-slate-400">
        <summary className="cursor-pointer">Clustering configuration</summary>
        <div className="mt-3 flex flex-wrap gap-4">
          {[
            {
              label: "Time window (s)",
              value: windowSeconds,
              set: setWindowSeconds,
              min: 10,
              max: 3600,
              step: 10,
            },
            {
              label: "Minimum community size",
              value: minSamples,
              set: setMinSamples,
              min: 3,
              max: 20,
              step: 1,
            },
            {
              label: "Association threshold",
              value: threshold,
              set: setThreshold,
              min: 0.4,
              max: 1,
              step: 0.05,
            },
          ].map((c) => (
            <label key={c.label} className="flex items-center gap-2">
              {c.label}
              <input
                aria-label={c.label}
                type="number"
                value={c.value}
                min={c.min}
                max={c.max}
                step={c.step}
                onChange={(e) =>
                  c.set(Math.max(c.min, Math.min(c.max, Number(e.target.value) || c.min)))
                }
                className="w-20 rounded border border-slate-700 bg-slate-900 p-2"
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          Changes apply to the next analysis. Text, URL, temporal, hashtag and optional semantic
          weights are configurable through the validated API.
        </p>
      </details>
      {error && <ErrorBox message={error} />}

      {!result ? (
        <Empty
          icon={Network}
          title="Nothing analysed yet"
          hint="Upload a file of posts, or press “Try with sample posts” to see how it works."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-medium text-slate-200">{result.datasetName}</span>
            <EngineBadge engine={result.engine || "graph_heuristics"} />
            {result.isSimulated && <SimulatedBadge label="synthetic dataset" />}
          </div>
          <VerdictBanner
            tone={
              result.classification === "Suspicious coordinated amplification" ? "orange" : "sky"
            }
            headline={result.classification || "Legacy graph baseline — review required"}
            explain={
              result.methodology ||
              "Union-find comparison on synthetic demonstration data; not a trained coordination classifier."
            }
            advice="A shared URL, headline or hashtag alone does not imply malicious coordination. Review recurring independent signals and source context."
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat
              label="Candidate pairs"
              value={result.candidatePairs ?? "baseline"}
              sub={
                result.truncated
                  ? "Budget reached; recall reduced"
                  : "Indexed multi-signal candidates"
              }
            />
            <Stat label="Accounts" value={result.totalAccounts} />
            <Stat label="Posts" value={result.totalPosts} />
            <Stat
              label="Suspicious posts"
              value={result.suspiciousPostCount ?? "—"}
              accent="text-orange-300"
            />
            <Stat label="Groups found" value={result.clusters.length} accent="text-rose-300" />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card
              title="Account relationships · edges show measured associations"
              className="xl:col-span-2"
              right={
                <div className="flex flex-wrap gap-2 text-[10px]">
                  {Object.entries(EDGE_LEGEND)
                    .slice(0, 3)
                    .map(([k, c]) => (
                      <span key={k} className="flex items-center gap-1 text-slate-400">
                        <span className="h-0.5 w-3" style={{ background: c }} />
                        {k.replace("_", " ")}
                      </span>
                    ))}
                </div>
              }
            >
              <ForceGraph
                nodes={graphNodes}
                edges={graphEdges}
                clusters={result.clusters}
                selected={selected}
                onSelect={setSelected}
                filter={filter}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilter(null)}
                  className={`rounded px-2 py-0.5 text-[11px] ${filter == null ? "bg-slate-700 text-white" : "text-slate-400"}`}
                >
                  All
                </button>
                {result.clusters.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setFilter(c.id)}
                    className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] ${filter === c.id ? "bg-slate-700 text-white" : "text-slate-400"}`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </button>
                ))}
                <span className="ml-auto text-[10px] text-slate-500">
                  Drag nodes · click to inspect · grey = unlinked accounts
                </span>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                Graph view: {graphNodes.length} of {result.totalAccounts} accounts,{" "}
                {graphEdges.length} of {result.edges.length} relationships. Rendering is capped at
                300 nodes / 2,000 edges; analysis records remain intact.
              </p>
              <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                Inspect any account
                <select
                  aria-label="Inspect any account"
                  value={selected || ""}
                  onChange={(e) => setSelected(e.target.value || null)}
                  className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 p-2"
                >
                  <option value="">Choose account</option>
                  {result.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.accountHandle} · {n.id}
                    </option>
                  ))}
                </select>
              </label>
            </Card>
            <Card title={node ? "Account details" : "Detected communities"}>
              {node ? (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-cyan-300">{node.accountHandle}</span>
                    <button
                      className="text-[10px] text-slate-500"
                      onClick={() => setSelected(null)}
                    >
                      close ✕
                    </button>
                  </div>
                  <div className="text-slate-300">{node.content}</div>
                  {node.postingStats && (
                    <p className="text-[11px] text-slate-400">
                      Observed posts: {node.postingStats.totalPosts} · Peak/min:{" "}
                      {node.postingStats.peakPostsPerMinute} · Dataset count z-score:{" "}
                      {node.postingStats.countZScore.toFixed(2)}. Frequency alone is not suspicious.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-1 font-mono text-[11px] text-slate-400">
                    <span>Language: {node.language}</span>
                    <span>Cluster: {node.clusterId || "—"}</span>
                    <span>Age: {node.accountAgeDays >= 0 ? `${node.accountAgeDays}d` : "n/a"}</span>
                    <span>Followers: {node.followerCount >= 0 ? node.followerCount : "n/a"}</span>
                    <span>First post: {fmtTime(node.timestamp)}</span>
                    <span>Links: {nodeEdges.length}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {node.suspicious
                      ? "Repeated multi-signal activity merits review; intent unproven."
                      : "No repeated multi-signal suspicion established."}{" "}
                    Bot likelihood is not estimated.
                  </div>
                  {node.posts?.map((p, i) => (
                    <div key={i} className="rounded border border-slate-800 p-2">
                      <div className="mb-1 text-[9px] text-slate-500">
                        {p.id || "Post ID not supplied"} · {p.timestamp}
                      </div>
                      {p.content}
                    </div>
                  ))}
                  {node.urls.length > 0 && (
                    <div className="break-all text-[11px] text-amber-300">
                      {node.urls.join(", ")}
                    </div>
                  )}
                  <div className="max-h-44 space-y-1 overflow-y-auto">
                    {nodeEdges.map((e) => (
                      <div
                        key={e.id}
                        className="rounded border border-slate-800 p-1.5 text-[11px] text-slate-400"
                      >
                        <span style={{ color: EDGE_LEGEND[e.coordinationType] }}>
                          {e.coordinationType}
                        </span>{" "}
                        ↔{" "}
                        {
                          result.nodes.find(
                            (n) => n.id === (e.source === node.id ? e.target : e.source),
                          )?.accountHandle
                        }
                        : {e.description}
                      </div>
                    ))}
                  </div>
                </div>
              ) : result.clusters.length === 0 ? (
                <div className="text-xs text-slate-500">No clusters met the thresholds.</div>
              ) : (
                <div className="max-h-[470px] space-y-3 overflow-y-auto pr-1">
                  {result.clusters.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setFilter(filter === c.id ? null : c.id)}
                      className="w-full rounded-lg border border-slate-800 p-3 text-left text-xs hover:border-slate-600"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="flex items-center gap-1.5 font-semibold"
                          style={{ color: c.color }}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: c.color }}
                          />
                          {c.name}
                        </span>
                        <span className="font-mono text-slate-300">
                          {c.coordinationScore}% association
                        </span>
                      </div>
                      <div className="mt-1 text-slate-400">
                        {c.accountCount} accounts · {c.postCount} posts · {c.burstDurationMinutes}{" "}
                        min span
                      </div>
                      <div className="mt-1 line-clamp-2 text-slate-300">"{c.primaryNarrative}"</div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {c.identifiedTactics.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      {c.topSharedDomains.length > 0 && (
                        <div className="mt-1 break-all text-[10px] text-amber-300/80">
                          {c.topSharedDomains.join(" · ")}
                        </div>
                      )}
                    </button>
                  ))}
                  <Details title="How groups are scored">
                    <div className="text-[11px] text-slate-400">
                      {result.methodology || "Legacy union-find comparison baseline."} Community
                      association strength is the mean of weighted relationship scores, not a
                      maliciousness probability. Candidate lists are bounded; truncation is
                      disclosed.
                    </div>
                  </Details>
                </div>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="How fast it spread (posts every 5 minutes)">
              <div className="h-52">
                <ResponsiveContainer>
                  <BarChart data={result.burstTimestamps}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10 }} />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#64748b", fontSize: 10 }}
                      width={24}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0b1220",
                        border: "1px solid #1e293b",
                        fontSize: 11,
                      }}
                    />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {result.burstTimestamps.map((b, i) => (
                        <Cell
                          key={i}
                          fill={
                            result.clusters.find((c) => c.id === b.clusterId)?.color || "#475569"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="What we found — and innocent explanations">
              <ul className="list-disc space-y-1 pl-4 text-xs text-slate-300">
                {result.tacticalSummary.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
              <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-amber-200/70">
                {result.alternativeExplanations.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
