import React, { useState } from 'react';
import { FileText, FolderKanban, Plus, Trash2 } from 'lucide-react';
import { Investigation, RiskLevel } from '../types';
import { createInvestigation, deleteInvestigation } from '../services/api';
import { AUTH_LABEL, Button, Card, Empty, ErrorBox, RiskBadge, SimulatedBadge, VERDICT_CLS, fmtDate } from './ui';
import { PageHeader } from './plain';
import type { Tab } from '../App';

export const InvestigationsView: React.FC<{
  investigations: Investigation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => Promise<Investigation[]>;
  onOpenReport: (id: string) => void;
  onNavigate: (t: Tab) => void;
}> = ({ investigations, activeId, onSelect, onChanged, onOpenReport, onNavigate }) => {
  const [form, setForm] = useState({ title: '', targetSubject: '', description: '', riskLevel: 'Medium' as RiskLevel, analyst: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const sel = investigations.find(i => i.id === activeId) || null;

  const create = async () => {
    if (!form.title.trim()) return setError('Title is required');
    setBusy(true); setError('');
    try {
      const inv = await createInvestigation({ ...form, tags: [] });
      await onChanged();
      onSelect(inv.id);
      setForm({ title: '', targetSubject: '', description: '', riskLevel: 'Medium', analyst: '' });
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this investigation? This cannot be undone.')) return;
    await deleteInvestigation(id);
    await onChanged();
  };

  const list = investigations.filter(i => !q || `${i.title} ${i.caseNumber} ${i.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  const media = sel ? (sel.mediaFindings?.length ? sel.mediaFindings : sel.forensicResult ? [sel.forensicResult] : []) : [];
  const claims = sel ? (sel.claimResults?.length ? sel.claimResults : sel.claimResult ? [sel.claimResult] : []) : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="My cases & reports"
        subtitle="A case keeps related results together — photos, fact-checks and account maps — so you can download one report. Results are added to a case when you press “Save to a case”."
        steps={['Create a case (or let one be created when you save)', 'Pick it from the list', 'Press “Report” to view, print or download']}
      />
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-2">
          <Card title="Start a new case">
            <div className="space-y-2">
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Case name * (e.g. Dam collapse rumour)" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
              <input value={form.targetSubject} onChange={e => setForm({ ...form, targetSubject: e.target.value })} placeholder="What is it about? (optional)" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Notes (optional)" rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
              <div className="flex gap-2">
                <select value={form.riskLevel} onChange={e => setForm({ ...form, riskLevel: e.target.value as RiskLevel })} className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs">
                  {['Low', 'Medium', 'High', 'Critical'].map(r => <option key={r}>{r}</option>)}
                </select>
                <input value={form.analyst} onChange={e => setForm({ ...form, analyst: e.target.value })} placeholder="Analyst" className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
              </div>
              {error && <ErrorBox message={error} />}
              <Button onClick={create} loading={busy}><Plus className="h-3.5 w-3.5" />Create case</Button>
            </div>
          </Card>
          <Card title={`All cases (${investigations.length})`}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search your cases…" className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs" />
            <div className="max-h-[460px] space-y-1.5 overflow-y-auto pr-1">
              {list.length === 0 && <Empty icon={FolderKanban} title="No investigations" />}
              {list.map(i => (
                <button key={i.id} onClick={() => onSelect(i.id)} className={`w-full rounded-lg border p-2.5 text-left text-xs transition ${i.id === activeId ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-800 hover:border-slate-600'}`}>
                  <div className="flex items-center justify-between gap-2"><span className="font-mono text-cyan-300">{i.caseNumber}</span><RiskBadge level={i.riskLevel} /></div>
                  <div className="mt-1 truncate text-slate-200">{i.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">{fmtDate(i.createdAt)} · {i.status} {i.isSimulatedDemo && <SimulatedBadge label="demo" />}</div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="xl:col-span-3">
          {!sel ? <Empty icon={FolderKanban} title="Pick a case from the list" /> : (
            <Card title={<span className="flex items-center gap-2">{sel.caseNumber} {sel.isSimulatedDemo && <SimulatedBadge />}</span>} right={
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => onOpenReport(sel.id)}><FileText className="h-3.5 w-3.5" />Report</Button>
                <Button variant="danger" onClick={() => remove(sel.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            }>
              <div className="space-y-4 text-xs">
                <div>
                  <div className="text-base font-semibold text-slate-100">{sel.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-slate-500"><RiskBadge level={sel.riskLevel} /><span>{sel.status}</span><span>· ID {sel.id}</span><span>· created {fmtDate(sel.createdAt)}</span><span>· updated {fmtDate(sel.updatedAt)}</span></div>
                  {sel.description && <p className="mt-2 text-slate-400">{sel.description}</p>}
                  {sel.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{sel.tags.map(t => <span key={t} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px]">{t}</span>)}</div>}
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-slate-500">Forensic findings ({media.length}) <button className="text-cyan-400" onClick={() => onNavigate('media')}>add →</button></div>
                  {media.length === 0 ? <div className="text-slate-500">None yet.</div> : media.map((m, i) => (
                    <div key={i} className="mb-1.5 flex items-center gap-2 rounded border border-slate-800 p-2">
                      <span className="w-12 font-mono uppercase text-slate-500">{m.modality}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-300">{m.fileName || ''} — <span className={AUTH_LABEL[m.authenticity]?.[1]}>{AUTH_LABEL[m.authenticity]?.[0]}</span></span>
                      <span className="font-mono">{m.confidenceScore}%</span><RiskBadge level={m.riskLevel} />
                    </div>
                  ))}
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-slate-500">Claim verifications ({claims.length}) <button className="text-cyan-400" onClick={() => onNavigate('claims')}>add →</button></div>
                  {claims.length === 0 ? <div className="text-slate-500">None yet.</div> : claims.map((c, i) => (
                    <div key={i} className="mb-1.5 flex items-center gap-2 rounded border border-slate-800 p-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] ${VERDICT_CLS[c.verdict]}`}>{c.verdict}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-300">{c.targetClaim}</span><span className="font-mono">{c.confidenceScore}%</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-slate-500">Campaign analysis <button className="text-cyan-400" onClick={() => onNavigate('campaign')}>open →</button></div>
                  {sel.campaignResult ? (
                    <div className="rounded border border-slate-800 p-2 text-slate-300">{sel.campaignResult.datasetName}: {sel.campaignResult.totalAccounts} accounts, {sel.campaignResult.clusters.length} clusters, coordination index {sel.campaignResult.overallCoordinationIndex}</div>
                  ) : <div className="text-slate-500">None yet.</div>}
                </div>
                {sel.timeline?.length ? (
                  <div>
                    <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-slate-500">Case timeline</div>
                    <ol className="space-y-1 border-l border-slate-700 pl-3">
                      {sel.timeline.map((t, i) => <li key={i}><span className="font-mono text-cyan-300">{new Date(t.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> <span className="text-slate-500">[{t.module}]</span> {t.label}</li>)}
                    </ol>
                  </div>
                ) : null}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
