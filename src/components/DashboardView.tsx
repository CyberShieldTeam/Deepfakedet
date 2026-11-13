import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertOctagon, ArrowRight, FileWarning, FlaskConical, FolderKanban, Gauge, Image as ImageIcon, MessageSquareText, Network, Radio, ShieldX } from 'lucide-react';
import { Investigation, LiveEvent, ModelRegistryItem } from '../types';
import { fetchModels, fetchStats, Stats } from '../services/api';
import { Button, Card, Empty, RiskBadge, SimulatedBadge, Stat, fmtTime } from './ui';
import type { Tab } from '../App';

const TIP = { contentStyle: { background: '#0b1220', border: '1px solid #1e293b', fontSize: 11 }, labelStyle: { color: '#94a3b8' } };
const THREAT_CLS: Record<string, string> = { CRITICAL: 'text-rose-400', HIGH: 'text-orange-300', ELEVATED: 'text-amber-300', GUARDED: 'text-emerald-300' };

export const DashboardView: React.FC<{
  investigations: Investigation[];
  events: LiveEvent[];
  active: Investigation | null;
  onOpenReport: (id: string) => void;
  onNavigate: (t: Tab) => void;
  onRunDemo: () => void;
  demoLoading: boolean;
}> = ({ investigations, events, active, onOpenReport, onNavigate, onRunDemo, demoLoading }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [models, setModels] = useState<ModelRegistryItem[]>([]);

  useEffect(() => {
    const load = () => fetchStats().then(setStats).catch(() => {});
    load();
    const t = setInterval(load, 3000);
    fetchModels().then(setModels).catch(() => {});
    return () => clearInterval(t);
  }, []);

  const media = investigations.flatMap(i => i.mediaFindings?.length ? i.mediaFindings : i.forensicResult ? [i.forensicResult] : []);
  const suspicious = media.filter(m => m.authenticity === 'likely_synthetic' || m.authenticity === 'suspicious_artifacts').length;
  const campaigns = investigations.filter(i => (i.campaignResult?.clusters.length || 0) > 0).length;
  const contradicted = investigations.flatMap(i => i.claimResults?.length ? i.claimResults : i.claimResult ? [i.claimResult] : []).filter(c => c.verdict === 'Contradicted').length;

  const authPie = useMemo(() => {
    const m: Record<string, number> = {};
    media.forEach(x => (m[x.authenticity] = (m[x.authenticity] || 0) + 1));
    const col: Record<string, string> = { likely_synthetic: '#f43f5e', suspicious_artifacts: '#f97316', inconclusive: '#eab308', likely_authentic: '#10b981' };
    const plainName: Record<string, string> = { likely_synthetic: 'Fake / AI-made', suspicious_artifacts: 'Warning signs', inconclusive: "Can't tell", likely_authentic: 'No signs found' };
    return Object.entries(m).map(([k, v]) => ({ name: plainName[k] || k, value: v, fill: col[k] }));
  }, [investigations]);

  // Activity per 15 s bucket over the live stream
  const activity = useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: 20 }, (_, i) => ({ t: new Date(now - (19 - i) * 15000).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }), posts: 0, alerts: 0 }));
    events.forEach(e => {
      const idx = 19 - Math.floor((now - new Date(e.ts).getTime()) / 15000);
      if (idx >= 0 && idx < 20) e.kind === 'alert' ? buckets[idx].alerts++ : buckets[idx].posts++;
    });
    return buckets;
  }, [events]);

  const camp = active?.campaignResult || investigations.find(i => i.campaignResult)?.campaignResult;

  return (
    <div className="space-y-5">
      {/* Start here */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/50 via-slate-900/40 to-blue-950/40 p-5 sm:p-6">
        <div className="bg-cyber-grid absolute inset-0 opacity-50" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <h1 className="text-2xl font-semibold tracking-tight text-white">Is it real, or is it fake?</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                VERITAS checks suspicious photos, videos, voice messages and news claims, and spots groups of accounts spreading the same rumour.
                Pick what you want to check:
              </p>
            </div>
            <div className="rounded-xl border border-slate-700/70 bg-slate-950/50 px-4 py-2.5 text-right" title="Based on the number and severity of alerts in the last 10 minutes">
              <div className="text-[11px] text-slate-400">Current threat level</div>
              <div className={`text-2xl font-bold tracking-wider ${THREAT_CLS[stats?.threatLevel || 'GUARDED']}`}>{stats?.threatLevel || '—'}</div>
              <div className="text-[11px] text-slate-500">{stats?.recentAlertCount ?? 0} alerts in the last 10 min</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { tab: 'media' as Tab, icon: ImageIcon, title: 'Check a photo, video or audio', text: 'Find out if it was made by AI or edited.' },
              { tab: 'claims' as Tab, icon: MessageSquareText, title: 'Fact-check a message', text: 'Paste a forward or headline — English, हिन्दी or తెలుగు.' },
              { tab: 'campaign' as Tab, icon: Network, title: 'Find fake account networks', text: 'Upload posts to see who is spreading them together.' }
            ].map(a => (
              <button key={a.tab} onClick={() => onNavigate(a.tab)} className="group flex items-start gap-3 rounded-xl border border-slate-700/70 bg-slate-950/50 p-4 text-left transition hover:border-cyan-500/60 hover:bg-slate-900/80">
                <a.icon className="mt-0.5 h-6 w-6 shrink-0 text-cyan-300" />
                <span>
                  <span className="flex items-center gap-1 text-sm font-semibold text-white">{a.title}<ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" /></span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-400">{a.text}</span>
                </span>
              </button>
            ))}
            <button onClick={onRunDemo} disabled={demoLoading} className="group flex items-start gap-3 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 p-4 text-left transition hover:border-fuchsia-400 disabled:opacity-60">
              <FlaskConical className="mt-0.5 h-6 w-6 shrink-0 text-fuchsia-300" />
              <span>
                <span className="text-sm font-semibold text-white">{demoLoading ? 'Loading demo…' : 'New here? Try the demo'}</span>
                <span className="mt-0.5 block text-xs leading-snug text-slate-400">Walk through a made-up dam-collapse hoax that uses every feature.</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">At a glance</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Saved cases" value={investigations.length} icon={FolderKanban} />
          <Stat label="Suspicious media" value={suspicious} sub={`of ${media.length} checked`} accent="text-orange-300" icon={FileWarning} />
          <Stat label="Fake account groups" value={campaigns} sub="cases with networks" accent="text-rose-300" icon={Network} />
          <Stat label="False claims" value={contradicted} sub="contradicted by sources" accent="text-rose-300" icon={ShieldX} />
          <Stat label="Posts monitored" value={stats?.postsIngested ?? 0} sub="demo feed" icon={Radio} />
          <Stat label="Alerts" value={stats?.alertsRaised ?? 0} sub="since start" accent="text-amber-300" icon={AlertOctagon} />
        </div>
      </div>

      {active?.isSimulatedDemo && active.timeline && (
        <Card title={<span className="flex items-center gap-2">Demo story · {active.caseNumber} <SimulatedBadge /></span>} right={<Button variant="ghost" onClick={() => onOpenReport(active.id)}>View full report</Button>}>
          <p className="mb-3 text-sm leading-relaxed text-slate-300">{active.description}</p>
          <div className="mb-2 text-xs font-medium text-slate-400">What happened, minute by minute:</div>
          <ol className="relative grid gap-2 border-l border-slate-700 pl-4 md:grid-cols-2">
            {active.timeline.map((t, i) => (
              <li key={i} className="relative text-xs">
                <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${t.severity === 'critical' ? 'bg-rose-500' : t.severity === 'high' ? 'bg-orange-400' : 'bg-cyan-400'}`} />
                <span className="font-mono text-cyan-300">{new Date(t.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>{' '}
                <span className="text-slate-500">[{t.module}]</span> <span className="text-slate-200">{t.label}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            {([['media', 'See the fake media'], ['claims', 'See the fact-check'], ['campaign', 'See the account network'], ['multilingual', 'See the 3 languages']] as [Tab, string][]).map(([t, l]) => <Button key={t} variant="ghost" onClick={() => onNavigate(t)}>{l} →</Button>)}
          </div>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Live activity" className="xl:col-span-2" right={<span className="text-[11px] text-slate-500"><span className="text-cyan-300">■</span> posts &nbsp;<span className="text-rose-400">■</span> alerts · every 15 s</span>}>
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={activity}>
                <defs>
                  <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0} /></linearGradient>
                  <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f43f5e" stopOpacity={0.6} /><stop offset="100%" stopColor="#f43f5e" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="t" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} width={24} />
                <Tooltip {...TIP} />
                <Area type="monotone" dataKey="posts" stroke="#22d3ee" fill="url(#gp)" isAnimationActive={false} />
                <Area type="monotone" dataKey="alerts" stroke="#f43f5e" fill="url(#ga)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Media checked so far">
          {authPie.length ? (
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={authPie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3} stroke="none">
                    {authPie.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip {...TIP} />
                </PieChart>
              </ResponsiveContainer>
              <div className="-mt-4 flex flex-wrap justify-center gap-2 text-[10px]">
                {authPie.map(d => <span key={d.name} className="flex items-center gap-1 text-slate-400"><span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />{d.name} ({d.value})</span>)}
              </div>
            </div>
          ) : <Empty icon={Gauge} title="No media analysed yet" />}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Live feed (demo posts + warnings)" className="xl:col-span-2" right={<span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />LIVE</span>}>
          <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {events.length === 0 && <Empty icon={Radio} title="Waiting for stream events…" />}
            {events.slice(0, 40).map(e => (
              <div key={e.id} className={`flex gap-3 rounded-lg border px-3 py-2 text-xs ${e.kind === 'alert' ? (e.severity === 'critical' ? 'border-rose-500/40 bg-rose-500/5' : 'border-orange-500/30 bg-orange-500/5') : 'border-slate-800/80 bg-slate-950/40'}`}>
                <span className="w-16 shrink-0 font-mono text-[10px] text-slate-500">{fmtTime(e.ts)}</span>
                <div className="min-w-0 flex-1">
                  {e.kind === 'alert' ? (
                    <div><span className="font-semibold text-rose-200">⚠ {e.title}</span> <span className="text-slate-400">— {e.text}</span></div>
                  ) : (
                    <div className="truncate"><span className="text-cyan-300">@{e.handle}</span> <span className="text-slate-500">via {e.platform} · {e.language}</span> <span className="text-slate-300">{e.text}</span></div>
                  )}
                </div>
                {e.isSimulated && <span className="shrink-0 text-[9px] font-mono uppercase text-fuchsia-400/70">sim</span>}
              </div>
            ))}
          </div>
        </Card>
        <Card title="How fast the rumour spread">
          {camp ? (
            <>
              <div className="mb-1 text-[11px] text-slate-400">{camp.datasetName} {camp.isSimulated && <SimulatedBadge label="synthetic data" />}</div>
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={camp.burstTimestamps}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} width={24} />
                    <Tooltip {...TIP} />
                    <Bar dataKey="count" name="posts / 5 min" radius={[3, 3, 0, 0]}>
                      {camp.burstTimestamps.map((b, i) => <Cell key={i} fill={camp.clusters.find(c => c.id === b.clusterId)?.color || '#475569'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : <Empty icon={Network} title="No campaign analysed" action={<Button onClick={onRunDemo} loading={demoLoading}><FlaskConical className="h-3.5 w-3.5" />Run demo</Button>} />}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Recent cases" className="xl:col-span-2">
          <div className="divide-y divide-slate-800/70">
            {investigations.slice(0, 6).map(i => (
              <div key={i.id} className="flex items-center gap-3 py-2 text-xs">
                <span className="w-32 shrink-0 font-mono text-cyan-300">{i.caseNumber}</span>
                <span className="min-w-0 flex-1 truncate text-slate-200">{i.title}</span>
                {i.isSimulatedDemo && <SimulatedBadge label="demo" />}
                <RiskBadge level={i.riskLevel} />
                <Button variant="ghost" onClick={() => onOpenReport(i.id)}>Report</Button>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Checking tools">
          <div className="space-y-2">
            {models.map(m => (
              <div key={m.id} className="flex items-center gap-2 text-xs">
                <span className={`h-2 w-2 rounded-full ${m.status === 'ONLINE' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className="min-w-0 flex-1 truncate text-slate-300">{m.name}</span>
                <span className="text-[11px] text-slate-500">{m.status === 'ONLINE' ? 'Working' : 'Not available'}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
