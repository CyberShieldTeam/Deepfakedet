import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Command,
  FileSearch,
  FlaskConical,
  FolderKanban,
  Languages,
  LockKeyhole,
  LogIn,
  Network,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { Investigation, LiveEvent } from "./types";
import {
  attachResult,
  createInvestigation,
  fetchHealth,
  fetchInvestigations,
  Health,
  runDemoScenario,
} from "./services/api";
import { useLiveStream } from "./hooks/useLiveStream";
import { Button, ErrorBox } from "./components/ui";
import { DashboardView } from "./components/DashboardView";
const MediaLabView = lazy(() =>
  import("./components/MediaLabView").then((m) => ({ default: m.MediaLabView })),
);
const ClaimView = lazy(() =>
  import("./components/ClaimView").then((m) => ({ default: m.ClaimView })),
);
const CampaignView = lazy(() =>
  import("./components/CampaignView").then((m) => ({ default: m.CampaignView })),
);
const MultilingualView = lazy(() =>
  import("./components/MultilingualView").then((m) => ({ default: m.MultilingualView })),
);
const InvestigationsView = lazy(() =>
  import("./components/InvestigationsView").then((m) => ({ default: m.InvestigationsView })),
);
const AlertsView = lazy(() =>
  import("./components/AlertsView").then((m) => ({ default: m.AlertsView })),
);
const ReportModal = lazy(() =>
  import("./components/ReportModal").then((m) => ({ default: m.ReportModal })),
);

export type Tab =
  | "dashboard"
  | "media"
  | "claims"
  | "campaign"
  | "multilingual"
  | "investigations"
  | "alerts";
export type AttachFn = (
  kind: "media" | "claim" | "campaign",
  result: any,
  titleHint: string,
) => Promise<Investigation>;
const NAV: { id: Tab; label: string; icon: React.ElementType; group: string }[] = [
  { id: "dashboard", label: "Overview", icon: Activity, group: "WORKSPACE" },
  { id: "investigations", label: "Investigations", icon: FolderKanban, group: "WORKSPACE" },
  { id: "media", label: "Media forensics", icon: FileSearch, group: "INTELLIGENCE ENGINES" },
  { id: "claims", label: "Claim intelligence", icon: CheckCheck, group: "INTELLIGENCE ENGINES" },
  { id: "campaign", label: "Network intelligence", icon: Network, group: "INTELLIGENCE ENGINES" },
  {
    id: "multilingual",
    label: "Multilingual analysis",
    icon: Languages,
    group: "INTELLIGENCE ENGINES",
  },
  { id: "alerts", label: "Alerts & activity", icon: Bell, group: "MONITORING" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [mode, setMode] = useState<"live" | "demo">(import.meta.env.VITE_PUBLIC_GUEST_MODE==='1'?'live':'demo');
  const [cases, setCases] = useState<Investigation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authToken, setAuthToken] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const [toasts, setToasts] = useState<LiveEvent[]>([]);
  const onAlert = useCallback((ev: LiveEvent) => {
    setToasts((prev) => [ev, ...prev].slice(0, 3));
    setTimeout(() => setToasts((prev) => prev.filter((e) => e.id !== ev.id)), 7000);
  }, []);
  const { events: allEvents, connected } = useLiveStream(onAlert);
  const investigations = useMemo(
    () => cases.filter((i) => !!i.isSimulatedDemo === (mode === "demo")),
    [cases, mode],
  );
  const events = allEvents.filter((e) => e.isSimulated === (mode === "demo"));
  const active = investigations.find((i) => i.id === activeId) || null;
  const reload = useCallback(async () => {
    const list = await fetchInvestigations();
    setCases(list);
    setError("");
    return list;
  }, []);
  useEffect(() => {
    reload()
      .then((list) => {
        const first = list.find((i) => i.isSimulatedDemo);
        if (first) setActiveId(first.id);
      })
      .catch((e) => setError(e.message));
    const poll = () =>
      fetchHealth()
        .then(h=>{setHealth(h);if(h.publicGuests)setMode('live')})
        .catch(() => setHealth(null));
    poll();
    const timer = setInterval(poll, 15000);
    const login = () => setAuthOpen(true);
    window.addEventListener("veritas:auth-required", login);
    return () => {
      clearInterval(timer);
      window.removeEventListener("veritas:auth-required", login);
    };
  }, [reload]);
  const upsert = (inv: Investigation) =>
    setCases((prev) => [inv, ...prev.filter((i) => i.id !== inv.id)]);
  const attach: AttachFn = async (kind, result, titleHint) => {
    let target = active;
    if (!target || !!target.isSimulatedDemo !== !!result.isSimulated)
      target = await createInvestigation({
        title: titleHint,
        modality:
          kind === "media" ? result.modality : kind === "claim" ? "text_claim" : "social_dataset",
        isSimulatedDemo: !!result.isSimulated,
      });
    const inv = await attachResult(target.id, kind, result);
    upsert(inv);
    setActiveId(inv.id);
    setMode(inv.isSimulatedDemo ? "demo" : "live");
    return inv;
  };
  const runDemo = async () => {
    setDemoLoading(true);
    try {
      const inv = await runDemoScenario();
      upsert(inv);
      setActiveId(inv.id);
      setMode("demo");
      setTab("dashboard");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDemoLoading(false);
    }
  };
  useEffect(() => {
    const selected = cases.find((i) => i.id === activeId);
    if (selected) setMode(selected.isSimulatedDemo ? "demo" : "live");
  }, [activeId, cases]);
  const beginLive = () => {
    setMode("live");
    setActiveId(cases.find((i) => !i.isSimulatedDemo)?.id || null);
  };
  const changeMode = (next: "live" | "demo") => {
    setMode(next);
    setActiveId(cases.find((i) => !!i.isSimulatedDemo === (next === "demo"))?.id || null);
    setQuery("");
    setTab("dashboard");
  };
  const navigate = (next: Tab) => {
    setTab(next);
    setQuery("");
  };
  const alerts = events.filter((e) => e.kind === "alert");
  const current = NAV.find((n) => n.id === tab)!;
  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: authToken }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAuthToken("");
      window.location.reload();
    } catch (e: any) {
      setAuthError(e.message);
    } finally {
      setAuthBusy(false);
    }
  };
  return (
    <div className="app-shell flex min-h-screen text-slate-200">
      <aside className="sidebar sticky top-0 hidden h-screen w-[238px] shrink-0 flex-col border-r border-slate-800/80 lg:flex">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("dashboard");
          }}
          className="flex items-center gap-3 px-6 py-7"
          aria-label="VERITAS AI overview"
        >
          <div className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl text-cyan-300">
            <ShieldCheck size={25} strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-[19px] font-bold tracking-[.06em] text-white">
              VERITAS<span className="ml-1 text-cyan-400">AI</span>
            </div>
            <div className="mt-0.5 text-[8px] font-semibold tracking-[.24em] text-slate-500">
              SURAKSHA SUCHAN
            </div>
          </div>
        </a>
        <div className="mx-4 mb-5 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
          <div className="rounded-md bg-slate-800 p-1.5">
            <Command size={14} className="text-slate-400" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-medium">Intelligence workspace</div>
            <div className="mt-0.5 text-[9px] text-slate-500">Evidence-led investigation</div>
          </div>
          <LockKeyhole size={12} className="text-slate-500" />
        </div>
        <nav className="flex-1 overflow-auto px-3" aria-label="Main navigation">
          {NAV.map((n, i) => {
            const Icon = n.icon;
            return (
              <React.Fragment key={n.id}>
                {n.group !== NAV[i - 1]?.group && (
                  <div className="mb-2 mt-5 px-3 text-[9px] font-semibold tracking-[.16em] text-slate-500">
                    {n.group}
                  </div>
                )}
                <button
                  onClick={() => navigate(n.id)}
                  aria-current={tab === n.id ? "page" : undefined}
                  className={`nav-item mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs transition ${tab === n.id ? "active text-cyan-200" : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-100"}`}
                >
                  <Icon size={16} strokeWidth={1.6} />
                  <span className="flex-1">{n.label}</span>
                  {n.id === "alerts" && alerts.length > 0 && (
                    <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[9px] text-amber-300">
                      {alerts.length}
                    </span>
                  )}
                  {tab === n.id && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />}
                </button>
              </React.Fragment>
            );
          })}
        </nav>
        <div className="mx-4 my-4 rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/20 p-3.5">
          <div className="mb-2 flex items-center gap-2 text-[11px]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${health ? "bg-emerald-400" : "bg-amber-400"}`}
            />
            {health ? "Workspace operational" : "Connecting to backend"}
          </div>
          <div className="text-[10px] leading-relaxed text-slate-500">
            {health?.authenticationMode === "required"
              ? "Protected analyst access"
              : "Development · single analyst"}
            <br />
            Classifier availability is reported separately.
          </div>
        </div>
        <button
          onClick={() => setAuthOpen(true)}
          className="flex items-center gap-3 border-t border-slate-800 px-5 py-4 text-left"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-[10px] font-semibold text-slate-300">
            VA
          </div>
          <div className="flex-1">
            <div className="text-xs">Analyst workspace</div>
            <div className="mt-0.5 text-[10px] text-slate-500">Manage access</div>
          </div>
          <LogIn size={14} className="text-slate-500" />
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="workspace-header sticky top-0 z-30 border-b border-slate-800/80 backdrop-blur-xl">
          <div className="flex h-[70px] items-center gap-4 px-5 lg:px-8">
            <div className="flex flex-1 items-center gap-2 text-[11px]">
              <span className="text-slate-500">Workspace</span>
              <ChevronRight size={12} className="text-slate-600" />
              <span className="text-slate-300">{current.label}</span>
            </div>
            <div className="hidden items-center rounded-lg border border-slate-700/60 bg-slate-950/40 p-1 sm:flex">
              {(["live", "demo"] as const).filter(m=>!health?.publicGuests||m==='live').map((m) => (
                <button
                  key={m}
                  onClick={() => changeMode(m)}
                  aria-pressed={mode === m}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-medium transition ${mode === m ? (m === "live" ? "bg-cyan-500/15 text-cyan-200" : "bg-violet-400/15 text-violet-200") : "text-slate-500 hover:text-slate-200"}`}
                >
                  {m === "live" ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  ) : (
                    <FlaskConical size={11} />
                  )}{" "}
                  {m === "live" ? "Live analysis" : "Demonstration"}
                </button>
              ))}
            </div>
            <button
              onClick={() => navigate("alerts")}
              aria-label="Open alerts"
              className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-800"
            >
              <Bell size={17} />
              {alerts.length > 0 && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400" />
              )}
            </button>
            <div className="h-5 w-px bg-slate-800" />
            <button
              aria-label="Open methodology and help"
              onClick={() => setHelp(true)}
              className="p-1 text-slate-400 hover:text-cyan-300"
            >
              <CircleHelp size={17} />
            </button>
          </div>
          <div className="flex overflow-x-auto px-3 pb-3 lg:hidden">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => navigate(n.id)}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-[11px] ${tab === n.id ? "bg-cyan-500/15 text-cyan-200" : "text-slate-400"}`}
              >
                {n.label}
              </button>
            ))}
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-6 lg:px-8 lg:py-7">
          {health?.publicGuests && <p role="note" className="mb-4 rounded border border-amber-700 p-3 text-sm text-amber-200">Public guest workspace. Cases belong only to this browser session. Storage is temporary and can disappear on restart; download reports to keep them. {health.cloudProfile==='free'?'Local audio/image classifiers, NLI, reranking and semantic embeddings are unavailable on this free-host profile. Browser measurements and configured source retrieval remain available.':'Check individual analysis stages for actual model availability.'}</p>}
          <div
            className={`mb-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3.5 py-2 text-[10px] ${mode === "demo" ? "border-violet-400/15 bg-violet-400/5 text-violet-200/80" : "border-cyan-500/15 bg-cyan-400/5 text-cyan-200/80"}`}
          >
            <span className="flex items-center gap-2">
              {mode === "demo" ? <FlaskConical size={12} /> : <ShieldCheck size={12} />}
              <b className="font-semibold tracking-wide">
                {mode === "demo" ? "DEMONSTRATION MODE" : "LIVE ANALYSIS MODE"}
              </b>
              <span className="hidden text-slate-500 sm:inline">/</span>
              {mode === "demo"
                ? "Synthetic case records. No live inference is represented."
                : "Actual inputs only. Unavailable models never produce artificial scores."}
            </span>
            <button
              onClick={() => changeMode(mode === "demo" ? "live" : "demo")}
              hidden={health?.publicGuests}
              className="text-[10px] underline decoration-slate-600 underline-offset-4"
            >
              Switch to {mode === "demo" ? "live analysis" : "demonstration"}
            </button>
          </div>
          {health?.authoredDemonstration && (
            <div role="note" className="mb-5 rounded-lg border border-amber-700 bg-amber-950/30 p-3 text-sm text-amber-100">
              Authored demonstration: real application processing and OCR on fictional inputs.
              Sources and public posts are local fixtures. No live fact-check or validated detection accuracy is represented.
            </div>
          )}
          {error && (
            <div className="mb-5">
              <ErrorBox message={error} />
              <button
                onClick={() => reload().catch((e) => setError(e.message))}
                className="mt-2 text-xs text-cyan-300"
              >
                Retry connection
              </button>
            </div>
          )}
          {tab !== "dashboard" && (
            <div className="mb-5 flex items-center justify-end gap-2 text-[11px] text-slate-500">
              <label htmlFor="active-case">Active investigation</label>
              <select
                id="active-case"
                value={active?.id || ""}
                onChange={(e) => setActiveId(e.target.value || null)}
                className="max-w-[260px] rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300"
              >
                <option value="">Create on save</option>
                {investigations.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.caseNumber} · {i.title.slice(0, 35)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Suspense
            fallback={
              <div
                className="rounded-xl border border-slate-800 p-8 text-sm text-slate-400"
                role="status"
              >
                Loading investigation tools…
              </div>
            }
          >
            {tab === "dashboard" && (
              <DashboardView
                investigations={investigations}
                events={events}
                active={active}
                health={health}
                mode={mode}
                query={query}
                onQuery={setQuery}
                onOpenCase={(id) => {
                  setActiveId(id);
                  setTab("investigations");
                }}
                onOpenReport={setReportFor}
                onNavigate={navigate}
                onRunDemo={runDemo}
                demoLoading={demoLoading}
              />
            )}
            {tab === "media" && (
              <MediaLabView attach={attach} active={active} onLiveAnalysis={beginLive} />
            )}
            {tab === "claims" && (
              <ClaimView attach={attach} active={active} onLiveAnalysis={beginLive} />
            )}
            {tab === "campaign" && (
              <CampaignView
                attach={attach}
                active={active}
                onLiveAnalysis={beginLive}
                onDemonstration={() => {
                  setMode("demo");
                  setActiveId(cases.find((i) => i.isSimulatedDemo)?.id || null);
                }}
              />
            )}
            {tab === "multilingual" && (
              <MultilingualView
                onLiveAnalysis={beginLive}
                active={active}
                events={events}
                geminiConfigured={!!health?.geminiReady}
                attach={attach}
              />
            )}
            {tab === "investigations" && (
              <InvestigationsView
                investigations={investigations}
                activeId={activeId}
                onSelect={setActiveId}
                onChanged={reload}
                onOpenReport={setReportFor}
                onNavigate={navigate}
              />
            )}
            {tab === "alerts" && <AlertsView alerts={alerts} />}
          </Suspense>
          <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-slate-800/70 pt-4 text-[9px] text-slate-500">
            <span>
              VERITAS AI <span className="mx-2 text-slate-700">/</span> Digital trust. Evidence
              first.
            </span>
            <span className="flex items-center gap-1.5">
              <LockKeyhole size={10} />
              Decision support only · Human review required
            </span>
          </footer>
        </main>
      </div>
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 w-80 space-y-2">
        {toasts
          .filter((e) => e.isSimulated === (mode === "demo"))
          .map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto rounded-xl border border-cyan-500/30 bg-slate-900 p-4 text-xs shadow-2xl"
            >
              <div className="flex justify-between">
                <b>{t.title}</b>
                <button
                  aria-label="Dismiss alert"
                  onClick={() => setToasts((p) => p.filter((e) => e.id !== t.id))}
                >
                  <X size={13} />
                </button>
              </div>
              <p className="mt-2 text-slate-400">{t.text}</p>
              {t.isSimulated && (
                <p className="mt-2 text-[9px] text-violet-300">SIMULATED DEMONSTRATION</p>
              )}
            </div>
          ))}
      </div>
      <Suspense fallback={null}>
        {reportFor && (
          <ReportModal investigationId={reportFor} onClose={() => setReportFor(null)} />
        )}
      </Suspense>
      {(authOpen || help) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={authOpen ? "Analyst access" : "Methodology"}
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#101927] p-7">
            <button
              aria-label="Close dialog"
              className="float-right text-slate-500"
              onClick={() => {
                setAuthOpen(false);
                setHelp(false);
              }}
            >
              <X size={18} />
            </button>
            {authOpen ? (
              <form onSubmit={login}>
                <LockKeyhole size={28} className="mb-4 text-cyan-300" />
                <h2 className="text-xl font-semibold">Analyst access</h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  Enter the access token issued by your VERITAS administrator. It is exchanged for
                  an eight-hour HttpOnly session, never stored in browser local storage.
                </p>
                <input
                  autoFocus
                  type="password"
                  aria-label="Analyst access token"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  className="my-5 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm"
                  placeholder="Access token"
                />
                {authError && <ErrorBox message={authError} />}
                <Button loading={authBusy} type="submit" className="mt-3">
                  Sign in securely
                </Button>
                <p className="mt-4 text-[10px] text-slate-500">
                  {health?.authenticationMode === "development-single-analyst"
                    ? "This preview is in single-analyst development mode. Configure VERITAS_USERS before deployment."
                    : "Production requires configured analyst credentials."}
                </p>
              </form>
            ) : (
              <>
                <h2 className="text-xl font-semibold">Evidence, not a single fake score.</h2>
                <div className="mt-5 space-y-4 text-sm leading-relaxed text-slate-400">
                  <p>
                    <b className="text-cyan-200">Media authenticity</b> uses operator-deployed,
                    versioned classifier adapters. ELA and temporal differences remain supporting
                    signals only.
                  </p>
                  <p>
                    <b className="text-cyan-200">Factual accuracy</b> uses evidence retrieval with
                    explicit analyst review. Similarity and LLM opinion are not verification.
                  </p>
                  <p>
                    <b className="text-cyan-200">Distribution risk</b> uses sparse multi-signal
                    density clustering. Shared news alone is not malicious coordination.
                  </p>
                  <p>
                    Demonstration records are fictional and isolated from live cases. No deployment
                    accuracy or C2PA cryptographic verification is claimed.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
