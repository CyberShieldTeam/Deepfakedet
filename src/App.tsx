import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Bell, CheckCircle2, FileSearch, FlaskConical, FolderKanban, Languages, Radio, Share2, ShieldAlert, X } from 'lucide-react';
import { Investigation, LiveEvent } from './types';
import { attachResult, createInvestigation, fetchHealth, fetchInvestigations, Health, runDemoScenario } from './services/api';
import { useLiveStream } from './hooks/useLiveStream';
import { Button } from './components/ui';
import { DashboardView } from './components/DashboardView';
import { MediaLabView } from './components/MediaLabView';
import { ClaimView } from './components/ClaimView';
import { CampaignView } from './components/CampaignView';
import { MultilingualView } from './components/MultilingualView';
import { InvestigationsView } from './components/InvestigationsView';
import { AlertsView } from './components/AlertsView';
import { ReportModal } from './components/ReportModal';

export type Tab = 'dashboard' | 'media' | 'claims' | 'campaign' | 'multilingual' | 'investigations' | 'alerts';
export type AttachFn = (kind: 'media' | 'claim' | 'campaign', result: any, titleHint: string) => Promise<Investigation>;

const NAV: { id: Tab; label: string; hint: string; group: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Home', hint: 'Overview and live activity', group: 'Start', icon: Activity },
  { id: 'media', label: 'Check a photo or video', hint: 'Is it real, edited or AI-made?', group: 'Check something', icon: FileSearch },
  { id: 'claims', label: 'Fact-check a claim', hint: 'Is this message or news true?', group: 'Check something', icon: CheckCircle2 },
  { id: 'multilingual', label: 'Hindi & Telugu', hint: 'Translate and check other languages', group: 'Check something', icon: Languages },
  { id: 'campaign', label: 'Fake account networks', hint: 'Who is spreading it together?', group: 'Investigate', icon: Share2 },
  { id: 'investigations', label: 'My cases & reports', hint: 'Saved results and downloads', group: 'Investigate', icon: FolderKanban },
  { id: 'alerts', label: 'Alerts', hint: 'Live warnings', group: 'Investigate', icon: Bell }
];
const SHORT: Record<Tab, string> = { dashboard: 'Home', media: 'Check media', claims: 'Fact-check', multilingual: 'Languages', campaign: 'Networks', investigations: 'Cases', alerts: 'Alerts' };

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [toasts, setToasts] = useState<LiveEvent[]>([]);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [unread, setUnread] = useState(0);

  const onAlert = useCallback((ev: LiveEvent) => {
    setToasts(t => [ev, ...t].slice(0, 4));
    setUnread(u => u + 1);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== ev.id)), 6000);
  }, []);
  const { events, connected } = useLiveStream(onAlert);

  const reload = useCallback(async () => {
    const list = await fetchInvestigations();
    setInvestigations(list);
    return list;
  }, []);

  useEffect(() => {
    reload().then(l => l[0] && setActiveId(id => id ?? l[0].id)).catch(() => {});
    const poll = () => fetchHealth().then(setHealth).catch(() => setHealth(null));
    poll();
    const t = setInterval(poll, 10000);
    return () => clearInterval(t);
  }, [reload]);

  const active = useMemo(() => investigations.find(i => i.id === activeId) || null, [investigations, activeId]);

  const upsert = (inv: Investigation) => setInvestigations(prev => [inv, ...prev.filter(p => p.id !== inv.id)]);

  const attach: AttachFn = async (kind, result, titleHint) => {
    let target = active;
    if (!target || target.isSimulatedDemo !== !!result.isSimulated) {
      target = await createInvestigation({ title: titleHint, modality: kind === 'media' ? result.modality : kind === 'claim' ? 'text_claim' : 'social_dataset', isSimulatedDemo: !!result.isSimulated } as any);
    }
    const updated = await attachResult(target.id, kind, result);
    upsert(updated);
    setActiveId(updated.id);
    return updated;
  };

  const runDemo = async () => {
    setDemoLoading(true);
    try {
      const inv = await runDemoScenario();
      upsert(inv);
      setActiveId(inv.id);
      setTab('dashboard');
    } finally {
      setDemoLoading(false);
    }
  };

  const alerts = events.filter(e => e.kind === 'alert');

  return (
    <div className="flex min-h-screen bg-[#05080f] text-slate-100">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-800/70 bg-[#070b14] lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-700 p-px">
            <div className="flex h-full w-full items-center justify-center rounded-[7px] bg-[#070b14]">
              <ShieldAlert className="h-4 w-4 text-cyan-300" />
            </div>
          </div>
          <div>
            <div className="text-sm font-bold tracking-wide">VERITAS AI</div>
            <div className="text-[9px] font-mono tracking-[0.18em] text-cyan-400/80">SURAKSHA SUCHAN</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3">
          {NAV.map((n, i) => {
            const Icon = n.icon;
            const on = tab === n.id;
            return (
              <React.Fragment key={n.id}>
                {n.group !== NAV[i - 1]?.group && <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 first:pt-1">{n.group}</div>}
                <button onClick={() => { setTab(n.id); if (n.id === 'alerts') setUnread(0); }} aria-current={on ? 'page' : undefined}
                  className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition ${on ? 'bg-cyan-500/10 text-cyan-100 ring-1 ring-cyan-500/30' : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'}`}>
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${on ? 'text-cyan-300' : 'text-slate-500'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium leading-tight">{n.label}</span>
                    <span className="block text-[11px] leading-tight text-slate-500">{n.hint}</span>
                  </span>
                  {n.id === 'alerts' && unread > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">{unread > 99 ? '99+' : unread}</span>}
                </button>
              </React.Fragment>
            );
          })}
        </nav>
        <div className="space-y-1.5 border-t border-slate-800/70 px-5 py-4 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-emerald-400' : 'bg-rose-500'}`} />Live feed {connected ? 'connected' : 'offline'}</div>
          <div className="flex items-center gap-1.5" title={health?.geminiMessage}>
            <span className={`h-2 w-2 rounded-full ${health?.geminiReady ? 'bg-cyan-400' : health?.geminiConfigured ? 'bg-rose-500' : 'bg-amber-400'}`} />
            {health?.geminiReady ? 'AI checks ready' : health?.geminiConfigured ? 'AI checks unavailable — basic checks only' : 'AI not set up — basic checks only'}
          </div>
          {health?.geminiReady && <div className="pl-3.5 font-mono text-[10px] text-slate-600">{health.geminiModel}</div>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-slate-800/70 bg-[#05080f]/85 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-semibold"><Radio className="h-4 w-4 text-cyan-400 lg:hidden" />VERITAS AI</div>
              <div className="truncate text-[10px] font-mono tracking-[0.16em] text-slate-500">SURAKSHA SUCHAN | DIGITAL TRUST &amp; FORENSIC INTELLIGENCE</div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-400" title="Results you save are added to this case. Choose 'A new case' to start a fresh one.">
              <span className="hidden sm:inline">Save results to</span>
              <select value={activeId ?? ''} onChange={e => setActiveId(e.target.value || null)}
                className="max-w-[240px] rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200">
                <option value="">A new case (created when you save)</option>
                {investigations.map(i => <option key={i.id} value={i.id}>{i.caseNumber} · {i.title.slice(0, 40)}</option>)}
              </select>
            </label>
            <Button onClick={runDemo} loading={demoLoading} title="Loads a fictional dam-collapse hoax so you can see every feature in action" className="!bg-none !bg-fuchsia-600 hover:!bg-fuchsia-500">
              <FlaskConical className="h-3.5 w-3.5" /> Try the demo
            </Button>
          </div>
          <div className="flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
            {NAV.map(n => (
              <button key={n.id} onClick={() => { setTab(n.id); if (n.id === 'alerts') setUnread(0); }} className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs ${tab === n.id ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-400'}`}>{SHORT[n.id]}</button>
            ))}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6">
          {tab === 'dashboard' && <DashboardView investigations={investigations} events={events} active={active} onOpenReport={setReportFor} onNavigate={setTab} onRunDemo={runDemo} demoLoading={demoLoading} />}
          {tab === 'media' && <MediaLabView attach={attach} active={active} />}
          {tab === 'claims' && <ClaimView attach={attach} active={active} />}
          {tab === 'campaign' && <CampaignView attach={attach} active={active} />}
          {tab === 'multilingual' && <MultilingualView active={active} events={events} geminiConfigured={!!health?.geminiReady} attach={attach} />}
          {tab === 'investigations' && (
            <InvestigationsView investigations={investigations} activeId={activeId} onSelect={setActiveId} onChanged={reload} onOpenReport={setReportFor} onNavigate={setTab} />
          )}
          {tab === 'alerts' && <AlertsView alerts={alerts} />}
        </main>
        <footer className="border-t border-slate-800/70 px-6 py-3 text-[11px] text-slate-500">
          VERITAS AI · Suraksha Suchan — YUKTIK-2026 prototype. Anything marked <span className="text-fuchsia-300">SIMULATED</span> is made-up demonstration data, not a real event or announcement. Automated checks can be wrong — always confirm important claims with an official source.
        </footer>
      </div>

      {/* Toast alerts */}
      <div className="pointer-events-none fixed right-4 top-20 z-50 flex w-80 flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto animate-[slidein_.25s_ease-out] rounded-lg border p-3 text-xs shadow-xl backdrop-blur ${t.severity === 'critical' ? 'border-rose-500/50 bg-rose-950/80' : t.severity === 'high' ? 'border-orange-500/50 bg-orange-950/80' : 'border-cyan-500/40 bg-slate-900/90'}`}>
            <div className="flex items-start gap-2">
              <ShieldAlert className={`mt-0.5 h-4 w-4 shrink-0 ${t.severity === 'critical' ? 'text-rose-400' : 'text-orange-300'}`} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-100">{t.title}</div>
                <div className="mt-0.5 line-clamp-2 text-slate-300">{t.text}</div>
                {t.isSimulated && <div className="mt-1 text-[10px] font-mono uppercase text-fuchsia-300">demo / simulated</div>}
              </div>
              <button onClick={() => setToasts(x => x.filter(y => y.id !== t.id))}><X className="h-3.5 w-3.5 text-slate-500" /></button>
            </div>
          </div>
        ))}
      </div>

      {reportFor && <ReportModal investigationId={reportFor} onClose={() => setReportFor(null)} />}
    </div>
  );
}
