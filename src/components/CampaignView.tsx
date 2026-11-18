import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Database, Download, Network, Upload } from 'lucide-react';
import { CampaignAnalysisResult, Investigation } from '../types';
import { analyzeCampaign } from '../services/api';
import { Button, Card, Empty, EngineBadge, ErrorBox, SimulatedBadge, Stat, fmtTime } from './ui';
import { EDGE_LEGEND, ForceGraph } from './ForceGraph';
import { Details, PageHeader, VerdictBanner } from './plain';
import type { AttachFn } from '../App';

export const CampaignView: React.FC<{ attach: AttachFn; active: Investigation | null }> = ({ attach, active }) => {
  const [result, setResult] = useState<CampaignAnalysisResult | null>(active?.campaignResult || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<number | null>(null);
  const [saved, setSaved] = useState('');
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    if (!fresh) setResult(active?.campaignResult || null);
  }, [active?.id]);

  const run = async (p: Parameters<typeof analyzeCampaign>[0]) => {
    setBusy(true); setError(''); setSelected(null); setFilter(null); setSaved('');
    try { setResult(await analyzeCampaign(p)); setFresh(true); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const onFile = async (f: File) => {
    const text = await f.text();
    if (/\.json$/i.test(f.name) || text.trim().startsWith('[') || text.trim().startsWith('{')) {
      try {
        const data = JSON.parse(text);
        run({ datasetName: f.name, posts: Array.isArray(data) ? data : data.posts || [] });
      } catch { setError('Invalid JSON file.'); }
    } else run({ datasetName: f.name, csv: text });
  };

  const loadSample = async () => {
    const posts = await fetch('/api/demo/sample-dataset').then(r => r.json()).then(d => d.posts);
    run({ datasetName: 'Synthetic sample — Operation Floodgate (SIMULATED)', posts, isSimulated: true });
  };

  const downloadSample = async () => {
    const posts: any[] = await fetch('/api/demo/sample-dataset').then(r => r.json()).then(d => d.posts);
    const cols = ['account_id', 'username', 'content', 'timestamp', 'shared_url', 'hashtags', 'language'];
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...posts.map(p => cols.map(c => esc(p[c])).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'veritas_sample_dataset_SIMULATED.csv';
    a.click();
  };

  const node = result?.nodes.find(n => n.id === selected);
  const nodeEdges = result?.edges.filter(e => e.source === selected || e.target === selected) || [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Find fake account networks"
        subtitle="Rumours often spread through groups of accounts that post the same text, share the same link, or post at the same moment. Upload a list of posts and we will map who is working together."
        steps={['Upload a CSV or JSON file of posts — or try our sample', 'See the groups on the map', 'Click any account for details']}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">Your file needs columns like: account_id, username, content, timestamp, shared_url, hashtags, language.</div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-500/60">
            <Upload className="h-3.5 w-3.5" />Upload posts (CSV / JSON)
            <input type="file" accept=".csv,.json,text/csv,application/json" className="hidden" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          <Button variant="ghost" onClick={loadSample} loading={busy}><Database className="h-3.5 w-3.5" />Try with sample posts</Button>
          <Button variant="ghost" onClick={downloadSample}><Download className="h-3.5 w-3.5" />Download sample file</Button>
          {result && fresh && <Button onClick={async () => { const inv = await attach('campaign', result, `Campaign: ${result.datasetName}`); setSaved(inv.caseNumber); }}>{saved ? `Saved to ${saved}` : 'Save to a case'}</Button>}
        </div>
      </div>
      {error && <ErrorBox message={error} />}

      {!result ? (
        <Empty icon={Network} title="Nothing analysed yet" hint="Upload a file of posts, or press “Try with sample posts” to see how it works." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-medium text-slate-200">{result.datasetName}</span>
            <EngineBadge engine={result.engine || 'graph_heuristics'} />
            {result.isSimulated && <SimulatedBadge label="synthetic dataset" />}
          </div>
          <VerdictBanner
            {...(result.patternStatus === 'REPEATED_COORDINATION_SIGNALS'
              ? { tone: 'orange' as const, headline: 'Repeated coordination signals observed', explain: result.conclusion || 'Multiple observable associations recur in this dataset.', advice: result.nextAction }
              : result.patternStatus === 'ASSOCIATED_ACTIVITY_OBSERVED'
              ? { tone: 'sky' as const, headline: 'Associated activity observed', explain: result.conclusion || 'Some posts share observable features, without establishing intent.', advice: result.nextAction }
              : result.patternStatus === 'INSUFFICIENT_DATA'
              ? { tone: 'slate' as const, headline: 'Insufficient data', explain: result.conclusion || 'The supplied observations are incomplete.', advice: result.nextAction }
              : { tone: 'green' as const, headline: 'No significant pattern observed', explain: result.conclusion || 'No account pair met the configured thresholds in this dataset.' })}
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Coordination score" value={result.overallCoordinationIndex} sub="0 = none · 100 = highly coordinated" accent={result.overallCoordinationIndex >= 60 ? 'text-rose-300' : 'text-amber-300'} />
            <Stat label="Accounts" value={result.totalAccounts} />
            <Stat label="Posts" value={result.totalPosts} />
            <Stat label="Suspicious posts" value={result.suspiciousPostCount ?? '—'} accent="text-orange-300" />
            <Stat label="Groups found" value={result.clusters.length} accent="text-rose-300" />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card title="Map of accounts (each dot is an account; lines connect accounts acting together)" className="xl:col-span-2" right={
              <div className="flex flex-wrap gap-2 text-[10px]">
                {Object.entries(EDGE_LEGEND).slice(0, 3).map(([k, c]) => <span key={k} className="flex items-center gap-1 text-slate-400"><span className="h-0.5 w-3" style={{ background: c }} />{k.replace('_', ' ')}</span>)}
              </div>
            }>
              <ForceGraph nodes={result.nodes} edges={result.edges} clusters={result.clusters} selected={selected} onSelect={setSelected} filter={filter} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button onClick={() => setFilter(null)} className={`rounded px-2 py-0.5 text-[11px] ${filter == null ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>All</button>
                {result.clusters.map(c => (
                  <button key={c.id} onClick={() => setFilter(c.id)} className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] ${filter === c.id ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}
                  </button>
                ))}
                <span className="ml-auto text-[10px] text-slate-500">Drag nodes · click to inspect · grey = unlinked accounts</span>
              </div>
            </Card>
            <Card title={node ? 'Account details' : 'Groups working together'}>
              {node ? (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between"><span className="font-mono text-cyan-300">{node.accountHandle}</span><button className="text-[10px] text-slate-500" onClick={() => setSelected(null)}>close ✕</button></div>
                  <div className="text-slate-300">{node.content}</div>
                  <div className="grid grid-cols-2 gap-1 font-mono text-[11px] text-slate-400">
                    <span>Language: {node.language}</span><span>Cluster: {node.clusterId || '—'}</span>
                    <span>Age: {node.accountAgeDays >= 0 ? `${node.accountAgeDays}d` : 'n/a'}</span><span>Followers: {node.followerCount >= 0 ? node.followerCount : 'n/a'}</span>
                    <span>First post: {fmtTime(node.timestamp)}</span><span>Links: {nodeEdges.length}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">Observable association signals: {node.associationSignalCount ?? nodeEdges.length}. This is not a bot or maliciousness score.</div>
                  {node.urls.length > 0 && <div className="break-all text-[11px] text-amber-300">{node.urls.join(', ')}</div>}
                  <div className="max-h-44 space-y-1 overflow-y-auto">
                    {nodeEdges.map(e => <details key={e.id} className="rounded border border-slate-800 p-1.5 text-[11px] text-slate-400"><summary className="cursor-pointer"><span style={{ color: EDGE_LEGEND[e.coordinationType] }}>{e.coordinationType}</span> ↔ {result.nodes.find(n => n.id === (e.source === node.id ? e.target : e.source))?.accountHandle}: {e.description}</summary><div className="mt-2 space-y-1">{e.evidence?.map((x, i) => <div key={i} className="rounded bg-slate-950 p-2"><div>Posts {x.sourcePostId} ↔ {x.targetPostId}</div><div>{x.sourceTimestamp || 'timestamp missing'} ↔ {x.targetTimestamp || 'timestamp missing'}</div><div>{x.signals.join(' · ')}</div>{(x.sourceUrl || x.targetUrl) && <div className="break-all">{x.sourceUrl || '—'} ↔ {x.targetUrl || '—'}</div>}</div>)}</div></details>)}
                  </div>
                </div>
              ) : result.clusters.length === 0 ? (
                <div className="text-xs text-slate-500">No clusters met the thresholds.</div>
              ) : (
                <div className="max-h-[470px] space-y-3 overflow-y-auto pr-1">
                  {result.clusters.map(c => (
                    <button key={c.id} onClick={() => setFilter(filter === c.id ? null : c.id)} className="w-full rounded-lg border border-slate-800 p-3 text-left text-xs hover:border-slate-600">
                      <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 font-semibold" style={{ color: c.color }}><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />{c.name}</span><span className="font-mono text-slate-300">{c.coordinationScore}</span></div>
                      <div className="mt-1 text-slate-400">{c.accountCount} accounts · {c.postCount} posts · {c.burstDurationMinutes} min span</div>
                      <div className="mt-1 line-clamp-2 text-slate-300">"{c.primaryNarrative}"</div>
                      <div className="mt-1.5 flex flex-wrap gap-1">{c.identifiedTactics.map(t => <span key={t} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{t}</span>)}</div>
                      {c.topSharedDomains.length > 0 && <div className="mt-1 break-all text-[10px] text-amber-300/80">{c.topSharedDomains.join(' · ')}</div>}
                    </button>
                  ))}
                  <Details title="How groups are scored"><div className="text-[11px] text-slate-400">Accounts are linked when their posts share ≥45% of words, the same URL, or a hashtag within 120 seconds. Groups are sets of linked accounts. Group score = 100 × (0.35·density + 0.40·mean link weight + 0.25·time compactness).</div></Details>
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
                    <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} width={24} />
                    <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #1e293b', fontSize: 11 }} />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>{result.burstTimestamps.map((b, i) => <Cell key={i} fill={result.clusters.find(c => c.id === b.clusterId)?.color || '#475569'} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="What we found — and innocent explanations">
              <ul className="list-disc space-y-1 pl-4 text-xs text-slate-300">{result.tacticalSummary.map((t, i) => <li key={i}>{t}</li>)}</ul>
              <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-amber-200/70">{result.alternativeExplanations.map((t, i) => <li key={i}>{t}</li>)}</ul>
              {result.coverageLimitations?.length ? <Details title="Dataset coverage and missing signals"><ul className="list-disc space-y-1 pl-4 text-xs text-slate-400">{result.coverageLimitations.map((t, i) => <li key={i}>{t}</li>)}</ul><div className="text-[11px] text-slate-500">Duplicates removed: {result.duplicatePostCount || 0} · Missing timestamps: {result.missingTimestampCount || 0}</div></Details> : null}
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
