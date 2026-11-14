import React, { useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  ChevronRight,
  Clock3,
  FileSearch,
  FlaskConical,
  FolderKanban,
  Layers3,
  Network,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Investigation, LiveEvent } from "../types";
import type { Health } from "../services/api";
import type { Tab } from "../App";
import { Button, RiskBadge } from "./ui";
import { ForceGraph } from "./ForceGraph";

export const DashboardView: React.FC<{
  investigations: Investigation[];
  events: LiveEvent[];
  active: Investigation | null;
  health: Health | null;
  mode: "live" | "demo";
  query: string;
  onQuery: (q: string) => void;
  onOpenCase: (id: string) => void;
  onOpenReport: (id: string) => void;
  onNavigate: (t: Tab) => void;
  onRunDemo: () => void;
  demoLoading: boolean;
}> = ({
  investigations,
  events,
  active,
  health,
  mode,
  query,
  onQuery,
  onOpenCase,
  onOpenReport,
  onNavigate,
  onRunDemo,
  demoLoading,
}) => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [graphSelection, setGraphSelection] = useState<string | null>(null);
  const media = investigations.flatMap((i) =>
    i.mediaFindings?.length ? i.mediaFindings : i.forensicResult ? [i.forensicResult] : [],
  );
  const claims = investigations.flatMap((i) =>
    i.claimResults?.length ? i.claimResults : i.claimResult ? [i.claimResult] : [],
  );
  const campaigns = investigations.filter(
    (i) => i.campaignResult && i.campaignResult.clusters.length,
  );
  const campaign = active?.campaignResult || campaigns[0]?.campaignResult;
  const filtered = investigations.filter(
    (i) =>
      `${i.title} ${i.caseNumber} ${i.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (statusFilter === "all" || i.status === statusFilter),
  );
  const dateLabel = (v: string) =>
    new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const metrics = [
    {
      label: "Total investigations",
      value: investigations.length,
      icon: FolderKanban,
      caption: `${investigations.filter((i) => i.status !== "Archived").length} active cases`,
      color: "#48c9e7",
      tab: "investigations" as Tab,
    },
    {
      label: "Media analyzed",
      value: media.length,
      icon: FileSearch,
      caption: "Image · video · audio",
      color: "#8795fb",
      tab: "media" as Tab,
    },
    {
      label: "Claims assessed",
      value: claims.length,
      icon: CheckCheck,
      caption: `${claims.filter((c) => c.verdict === "Insufficient Evidence").length} awaiting evidence`,
      color: "#54c9a4",
      tab: "claims" as Tab,
    },
    {
      label: "Network investigations",
      value: campaigns.length,
      icon: Network,
      caption: mode === "demo" ? "Synthetic campaign datasets" : "Cases with detected communities",
      color: "#e7b36d",
      tab: "campaign" as Tab,
    },
  ];
  const activity = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - 6 + index);
    const key = day.toDateString();
    return {
      day: day.toLocaleDateString("en-US", { weekday: "short" }),
      media: media.filter((m) => new Date(m.analyzedAt).toDateString() === key).length,
      claims: claims.filter((c) => new Date(c.timestamp).toDateString() === key).length,
    };
  });
  const recentActivity = [
    ...events
      .slice(0, 8)
      .map((e) => ({
        id: e.id,
        time: e.ts,
        label: e.title || e.text,
        module: e.kind === "alert" ? "Alert" : "Post",
      })),
    ...investigations.flatMap((i) =>
      (i.timeline || [])
        .slice(-2)
        .map((t, index) => ({
          id: `${i.id}-${index}`,
          time: t.time,
          label: t.label,
          module: t.module,
        })),
    ),
  ]
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
    .slice(0, 4);
  const engines = [
    {
      task: "image",
      name: "Media forensics",
      detail: "Image & speech classifiers",
      icon: FileSearch,
      tab: "media" as Tab,
    },
    {
      task: "embedding",
      name: "Claim intelligence",
      detail: "Multilingual evidence retrieval",
      icon: CheckCheck,
      tab: "claims" as Tab,
    },
    {
      task: "network",
      name: "Network intelligence",
      detail: "Multi-signal density clustering",
      icon: Network,
      tab: "campaign" as Tab,
    },
  ];
  const graphNodes = campaign?.nodes.slice(0, 100) || [],
    graphIds = new Set(graphNodes.map((n) => n.id));
  const graphEdges = (campaign?.edges || []).filter(
    (e) => graphIds.has(e.source) && graphIds.has(e.target),
  );
  const selectedNode = graphNodes.find((n) => n.id === graphSelection);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 text-[9px] font-medium tracking-[.2em] text-cyan-500">
            INTELLIGENCE COMMAND CENTER
          </div>
          <h1 className="text-[27px] font-semibold tracking-[-.035em] text-slate-100 sm:text-[30px]">
            Investigation overview<span className="text-cyan-400">.</span>
          </h1>
          <p className="mt-2 text-xs text-slate-500">
            A clear view of your evidence. A stronger foundation for the truth.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={!active}
            onClick={() => active && onOpenReport(active.id)}
            className="!px-3 !py-2.5"
          >
            <ArrowDownToLine size={13} />
            Export report
          </Button>
          <Button onClick={() => onNavigate("investigations")} className="!px-4 !py-2.5">
            <Plus size={14} />
            New investigation
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((m, index) => (
          <button
            onClick={() => onNavigate(m.tab)}
            key={m.label}
            className="metric-card group relative overflow-hidden rounded-xl border border-slate-800/80 p-4 text-left transition hover:border-slate-600 lg:p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">{m.label}</span>
              <span
                className="rounded-lg p-2"
                style={{ color: m.color, background: `${m.color}12` }}
              >
                <m.icon size={15} strokeWidth={1.6} />
              </span>
            </div>
            <div className="my-2 text-[32px] font-semibold leading-none tracking-tight text-slate-100">
              {String(m.value).padStart(2, "0")}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[9px] text-slate-500">
              <span className="h-1 w-1 rounded-full" style={{ background: m.color }} />
              {m.caption}
            </div>
            <div
              className="absolute bottom-0 left-0 h-px w-full opacity-40"
              style={{ background: `linear-gradient(90deg,transparent,${m.color},transparent)` }}
            />
          </button>
        ))}
      </div>
      <section className="command-hero relative overflow-hidden rounded-xl border border-cyan-500/20 px-6 py-6 sm:px-7">
        <div
          className="hero-orbit absolute -right-5 top-[-100px] h-[370px] w-[500px] opacity-30"
          aria-hidden="true"
        />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded border border-cyan-500/20 bg-cyan-400/5 px-2 py-1 text-[8px] font-semibold tracking-[.14em] text-cyan-300">
              <ShieldCheck size={11} />
              THREE ENGINES. ONE INVESTIGATION.
            </span>
            <h2 className="text-[23px] font-medium leading-tight tracking-[-.025em] text-slate-100">
              See beyond the surface.
            </h2>
            <p className="mt-2 max-w-[430px] text-[11px] leading-[1.8] text-slate-400">
              Connect media authenticity, factual accuracy, and distribution patterns.
              <br className="hidden sm:block" /> Follow the evidence — not an unexplained
              fake-or-real score.
            </p>
            <button
              onClick={() => onNavigate("media")}
              className="mt-4 inline-flex items-center gap-2 text-[11px] font-medium text-cyan-300 hover:text-cyan-100"
            >
              Start an analysis
              <ArrowRight size={13} />
            </button>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 md:w-auto">
            {[
              {
                label: "AUTHENTICITY",
                icon: FileSearch,
                name: "Media forensics",
                tab: "media" as Tab,
              },
              {
                label: "ACCURACY",
                icon: CheckCheck,
                name: "Claim intelligence",
                tab: "claims" as Tab,
              },
              {
                label: "DISTRIBUTION",
                icon: Network,
                name: "Network intelligence",
                tab: "campaign" as Tab,
              },
            ].map((e, i) => (
              <button
                onClick={() => onNavigate(e.tab)}
                key={e.name}
                className="hero-engine group relative flex w-full flex-col items-center rounded-xl border border-cyan-500/10 bg-[#0b1828]/80 px-3 py-4 transition hover:border-cyan-400/40 sm:w-[123px]"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/5 text-cyan-300">
                  <e.icon size={21} strokeWidth={1.3} />
                </div>
                <div className="text-[7px] tracking-[.14em] text-cyan-500/80">{e.label}</div>
                <div className="mt-1.5 whitespace-nowrap text-[9px] text-slate-300">{e.name}</div>
              </button>
            ))}
          </div>
        </div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="panel min-w-0 overflow-hidden rounded-xl border border-slate-800/80">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/70 px-5 py-4">
            <div className="flex items-center gap-2">
              <FolderKanban size={14} className="text-cyan-400" />
              <h2 className="text-xs font-medium">Recent investigations</h2>
              <span className="rounded bg-slate-800/70 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                {investigations.length}
              </span>
            </div>
            <button
              onClick={() => onNavigate("investigations")}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-cyan-300"
            >
              View all
              <ChevronRight size={12} />
            </button>
          </div>
          <div className="flex gap-2 px-5 py-3">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/30 px-2.5">
              <Search size={13} className="shrink-0 text-slate-600" />
              <input
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                aria-label="Search investigations"
                placeholder="Search by case name, ID or tag..."
                className="w-full bg-transparent py-2 text-[10px] outline-none placeholder:text-slate-600"
              />
            </label>
            <label className="flex items-center gap-1.5 rounded-lg border border-slate-800 px-2 text-slate-400">
              <SlidersHorizontal size={12} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter investigations by status"
                className="max-w-24 bg-transparent py-1 text-[9px]"
              >
                <option value="all">All statuses</option>
                {["In Progress", "Verified", "Suspicious", "Critical Flag", "Archived"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left">
              <thead className="border-y border-slate-800/60 bg-slate-950/20 text-[8px] uppercase tracking-[.1em] text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Investigation</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                  <th className="relative pr-4">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 5).map((inv, index) => (
                  <tr
                    key={inv.id}
                    className="group border-b border-slate-800/50 last:border-none hover:bg-slate-800/20"
                  >
                    <td className="max-w-[260px] px-5 py-[17px]">
                      <button
                        onClick={() => onOpenCase(inv.id)}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${index % 2 ? "border-indigo-400/15 bg-indigo-500/5 text-indigo-300" : "border-cyan-400/15 bg-cyan-500/5 text-cyan-400"}`}
                        >
                          <FileSearch size={14} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[11px] text-slate-200 group-hover:text-cyan-200">
                            {inv.title}
                          </span>
                          <span className="mt-1 block font-mono text-[8px] text-slate-500">
                            {inv.caseNumber}
                            {inv.isSimulatedDemo && (
                              <span className="ml-2 text-violet-400/80">SIMULATED</span>
                            )}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-3 text-[9px]">
                      <span
                        className={`inline-flex items-center gap-1.5 ${inv.status === "Verified" ? "text-emerald-300" : inv.status === "Critical Flag" ? "text-rose-300" : "text-amber-200/80"}`}
                      >
                        <span className="h-1 w-1 rounded-full bg-current" />
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-3">
                      <RiskBadge level={inv.riskLevel} />
                    </td>
                    <td className="px-5 text-[9px] text-slate-500">{dateLabel(inv.updatedAt)}</td>
                    <td className="pr-4">
                      <button
                        aria-label={`Open ${inv.title}`}
                        onClick={() => onOpenCase(inv.id)}
                        className="p-1 text-slate-600 hover:text-cyan-300"
                      >
                        <ArrowUpRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <div className="flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center">
                <FolderKanban size={28} strokeWidth={1} className="text-slate-600" />
                <h3 className="text-sm text-slate-300">
                  {query ? "No matching investigations" : "Your next investigation starts here"}
                </h3>
                <p className="max-w-xs text-[11px] leading-relaxed text-slate-500">
                  {query
                    ? "Try a different case name or status filter."
                    : "Create a case or analyze real media. Evidence will appear here when you save it."}
                </p>
                <button
                  onClick={() => onNavigate("investigations")}
                  className="text-[11px] text-cyan-300"
                >
                  Create investigation
                  <ArrowRight size={12} className="ml-2 inline" />
                </button>
              </div>
            )}
          </div>
          <div className="flex justify-between border-t border-slate-800/70 px-5 py-3 text-[9px] text-slate-500">
            <span>
              Showing {Math.min(filtered.length, 5)} of {filtered.length} investigations
            </span>
            <span>
              {mode === "demo" ? "Isolated synthetic records" : "Owner-scoped case records"}
            </span>
          </div>
        </section>
        <section className="panel rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between border-b border-slate-800/70 px-5 py-4">
            <h2 className="text-xs font-medium">Engine availability</h2>
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          </div>
          <div className="space-y-1 px-4 py-2">
            {engines.map((e) => {
              const status =
                e.task === "network"
                  ? health
                    ? "ready"
                    : "unavailable"
                  : health?.engines?.find((m) => m.task === e.task)?.status || "unavailable";
              const ready = status === "ready";
              return (
                <button
                  key={e.name}
                  onClick={() => onNavigate(e.tab)}
                  className="flex w-full items-start gap-3 border-b border-slate-800/70 py-4 text-left last:border-none"
                >
                  <span
                    className={`rounded-lg border p-2 ${ready ? "border-cyan-400/15 bg-cyan-400/5 text-cyan-300" : "border-slate-700/50 bg-slate-800/30 text-slate-400"}`}
                  >
                    <e.icon size={15} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-[11px] text-slate-200">{e.name}</span>
                    <span className="mt-1 block text-[9px] text-slate-500">{e.detail}</span>
                    <span
                      className={`mt-2 inline-flex items-center gap-1.5 text-[8px] ${ready ? "text-emerald-400" : "text-amber-300/80"}`}
                    >
                      <span className="h-1 w-1 rounded-full bg-current" />
                      {ready
                        ? "AVAILABLE"
                        : status === "not_tested"
                          ? "NOT TESTED"
                          : status === "failed"
                            ? "FAILED / RETRY AVAILABLE"
                            : "NOT CONFIGURED"}
                    </span>
                  </span>
                  <ArrowUpRight size={12} className="mt-1 text-slate-600" />
                </button>
              );
            })}
          </div>
          <div className="mx-4 mb-4 flex gap-2 rounded-lg border border-slate-700/40 bg-slate-900/60 p-3 text-[9px] leading-relaxed text-slate-500">
            <ShieldCheck size={14} className="shrink-0 text-cyan-500" />
            No fabricated confidence scores. Configure dedicated model endpoints to enable live
            inference.
          </div>
        </section>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="panel overflow-hidden rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between border-b border-slate-800/70 px-5 py-4">
            <h2 className="flex items-center gap-2 text-xs font-medium">
              <Layers3 size={14} className="text-cyan-400" />
              Evidence activity
            </h2>
            <span className="text-[9px] text-slate-500">
              Last 7 days · {mode === "demo" ? "synthetic records" : "saved analyses"}
            </span>
          </div>
          <div className="flex gap-4 px-5 pt-4 text-[9px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <i className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              Media findings
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              Claim assessments
            </span>
          </div>
          <div className="h-[200px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activity} margin={{ left: -25, top: 15, right: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop stopColor="#22c9df" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#22c9df" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#202c3c" vertical={false} strokeDasharray="3 5" />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#66758d", fontSize: 9 }}
                  dy={7}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  tick={{ fill: "#66758d", fontSize: 9 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111c2c",
                    border: "1px solid #2a3b50",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <Area
                  dataKey="media"
                  name="Media findings"
                  type="monotone"
                  stroke="#39c4dc"
                  strokeWidth={2}
                  fill="url(#activity-fill)"
                />
                <Area
                  dataKey="claims"
                  name="Claim assessments"
                  type="monotone"
                  stroke="#8285ef"
                  strokeWidth={1.5}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel overflow-hidden rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between border-b border-slate-800/70 px-5 py-4">
            <h2 className="flex items-center gap-2 text-xs font-medium">
              <Network size={14} className="text-indigo-300" />
              Distribution intelligence
            </h2>
            <button
              onClick={() => onNavigate("campaign")}
              className="flex items-center gap-1 text-[9px] text-slate-500 hover:text-cyan-300"
            >
              Open network
              <ArrowUpRight size={12} />
            </button>
          </div>
          {campaign ? (
            <div className="relative h-[239px] overflow-hidden">
              <div className="absolute left-4 top-3 z-10 rounded border border-slate-700/70 bg-slate-950/80 px-2 py-1 text-[8px] text-slate-400">
                {campaign.totalAccounts} accounts · {campaign.clusters.length} communities
                {campaign.isSimulated ? " · SYNTHETIC" : ""}
              </div>
              <div className="h-[239px] [&_svg]:!h-full [&_svg]:!min-h-0">
                <ForceGraph
                  nodes={graphNodes}
                  edges={graphEdges}
                  clusters={campaign.clusters}
                  selected={graphSelection}
                  onSelect={setGraphSelection}
                  filter={null}
                />
              </div>
              {selectedNode && (
                <button
                  onClick={() => onNavigate("campaign")}
                  className="absolute bottom-3 left-4 right-4 rounded border border-cyan-500/30 bg-slate-950/90 p-2 text-left text-[9px] text-cyan-200"
                >
                  {selectedNode.accountHandle} · {selectedNode.content.slice(0, 80)}
                  <span className="ml-2 text-slate-400">Inspect evidence →</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex h-[239px] flex-col items-center justify-center gap-3 text-center">
              <Network size={32} strokeWidth={1} className="text-indigo-400/60" />
              <p className="text-xs text-slate-300">Relationships need evidence.</p>
              <p className="max-w-xs text-[10px] leading-relaxed text-slate-500">
                Upload actual posts to map multi-signal communities.
                <br />A shared headline alone is not suspicious coordination.
              </p>
              <button onClick={() => onNavigate("campaign")} className="text-[10px] text-cyan-300">
                Analyze a dataset
                <ArrowRight size={12} className="ml-2 inline" />
              </button>
            </div>
          )}
        </section>
      </div>
      <section className="panel rounded-xl border border-slate-800/80">
        <div className="flex items-center justify-between border-b border-slate-800/70 px-5 py-4">
          <h2 className="flex items-center gap-2 text-xs font-medium">
            <Clock3 size={14} className="text-cyan-400" />
            Recent activity &amp; alerts
          </h2>
          <button
            onClick={() => onNavigate("alerts")}
            className="text-[10px] text-slate-500 hover:text-cyan-300"
          >
            View alerts →
          </button>
        </div>
        <div className="divide-y divide-slate-800/50 px-5">
          {recentActivity.length ? (
            recentActivity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/70" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] text-slate-300">{item.label}</p>
                  <p className="mt-1 text-[9px] text-slate-500">
                    {item.module}
                    {mode === "demo" ? " · SIMULATED" : ""}
                  </p>
                </div>
                <time className="shrink-0 text-[9px] text-slate-500">{dateLabel(item.time)}</time>
              </div>
            ))
          ) : (
            <p className="py-6 text-[11px] text-slate-500">
              No activity yet. Case history and actual analysis events appear here. No live
              social-platform ingestion service is configured.
            </p>
          )}
        </div>
      </section>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800/70 bg-slate-900/20 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-violet-400/20 bg-violet-400/5 p-2.5 text-violet-300">
            <FlaskConical size={18} />
          </div>
          <div>
            <h2 className="text-xs text-slate-300">Follow the evidence, end to end.</h2>
            <p className="mt-1 text-[10px] text-slate-500">
              Explore a clearly labeled, fictional multilingual investigation with all three
              engines.
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={onRunDemo} loading={demoLoading}>
          Launch guided demo
          <ArrowRight size={12} />
        </Button>
      </section>
    </div>
  );
};
