import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Languages, Search } from 'lucide-react';
import { ClaimVerificationResult, Investigation, LiveEvent } from '../types';
import { verifyClaim } from '../services/api';
import { Button, Card, Empty, ErrorBox, SimulatedBadge } from './ui';
import { ClaimResult } from './ClaimView';
import { PageHeader } from './plain';
import type { AttachFn } from '../App';

const LANG_COLORS: Record<string, string> = { English: '#22d3ee', Hindi: '#f97316', Telugu: '#a855f7' };

export const MultilingualView: React.FC<{ active: Investigation | null; events: LiveEvent[]; geminiConfigured: boolean; attach: AttachFn }> = ({ active, events, geminiConfigured, attach }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ClaimVerificationResult | null>(null);

  const feedLang = useMemo(() => {
    const m: Record<string, number> = { English: 0, Hindi: 0, Telugu: 0 };
    events.filter(e => e.kind === 'post').forEach(e => (m[e.language] = (m[e.language] || 0) + 1));
    return Object.entries(m).map(([language, count]) => ({ language, count }));
  }, [events]);
  const campLang = active?.campaignResult?.languageBreakdown;

  const run = async () => {
    setBusy(true); setError('');
    try { setResult(await verifyClaim(text)); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Hindi, Telugu & English"
        subtitle={`Rumours often travel in several languages at once. Type or paste text in हिन्दी, తెలుగు or English — we show the original next to an English translation and check it. ${geminiConfigured ? '' : 'Translation needs the AI checker, which is not available right now.'}`}
        steps={['Paste text in any of the three languages', 'Press “Translate & check”', 'Compare original and translation']}
      />

      {active?.multilingual?.length ? (
        <Card title={<span className="flex items-center gap-2">The same rumour in different languages · {active.caseNumber} {active.isSimulatedDemo && <SimulatedBadge />}</span>}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[10px] font-mono uppercase text-slate-500"><th className="py-1.5">Language</th><th>Original text</th><th>English translation</th><th className="text-right">Posts</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {active.multilingual.map((v, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3 font-mono" style={{ color: LANG_COLORS[v.language] }}>{v.language}</td>
                    <td className="py-2 pr-3 text-slate-200">{v.original}</td>
                    <td className="py-2 pr-3 text-slate-400">{v.translation}</td>
                    <td className="py-2 text-right font-mono text-slate-300">{v.posts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Languages in the live feed (demo posts)">
          <LangBars data={feedLang} />
        </Card>
        <Card title="Languages used by the selected case's accounts">
          {campLang?.length ? <LangBars data={campLang} /> : <Empty icon={Languages} title="No campaign data on active case" />}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card title="1 · Paste text to translate and check" className="xl:col-span-2">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="हिन्दी / తెలుగు / English text…" className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm outline-none focus:border-cyan-500" />
          <div className="mt-2 flex flex-wrap gap-2">
            {['हैदराबाद में बांध टूट गया, तुरंत निकलें', 'హైదరాబాద్‌లో డ్యామ్ కూలిపోయింది', 'సచివాలయం రేపు మూసివేయబడుతుంది'].map(s => (
              <button key={s} onClick={() => setText(s)} className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:border-cyan-500">{s}</button>
            ))}
          </div>
          <Button className="mt-3" onClick={run} loading={busy} disabled={!text.trim()}><Search className="h-3.5 w-3.5" />Translate &amp; check</Button>
          {error && <div className="mt-2"><ErrorBox message={error} /></div>}
        </Card>
        <Card title="2 · Result" className="xl:col-span-3" right={result && <Button variant="ghost" onClick={() => attach('claim', result, `Multilingual claim (${result.detectedLanguage})`)}>Save to a case</Button>}>
          {result ? <ClaimResult r={result} /> : <Empty icon={Languages} title="Submit text to see original and translation side by side" />}
        </Card>
      </div>
    </div>
  );
};

const LangBars: React.FC<{ data: { language: string; count: number }[] }> = ({ data }) => (
  <div className="h-48">
    <ResponsiveContainer>
      <BarChart data={data} layout="vertical">
        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
        <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} />
        <YAxis type="category" dataKey="language" tick={{ fill: '#94a3b8', fontSize: 11 }} width={60} />
        <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #1e293b', fontSize: 11 }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={i} fill={LANG_COLORS[d.language] || '#64748b'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);
