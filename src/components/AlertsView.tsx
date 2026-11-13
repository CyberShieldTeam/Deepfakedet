import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { LiveEvent } from '../types';
import { PageHeader } from './plain';
import { Card, Empty, SimulatedBadge, fmtTime } from './ui';

const TYPES: Record<string, string> = {
  suspicious_media: 'Fake-looking media',
  claim_contradicted: 'False claim',
  campaign_detected: 'Fake account group',
  similar_content: 'Copy-paste posts',
  propagation_burst: 'Sudden spike',
  system: 'System'
};
const SEV: Record<string, string> = { critical: 'bg-rose-500', high: 'bg-orange-400', medium: 'bg-amber-300', info: 'bg-cyan-400' };

export const AlertsView: React.FC<{ alerts: LiveEvent[] }> = ({ alerts }) => {
  const [type, setType] = useState<string>('all');
  const list = alerts.filter(a => type === 'all' || a.alertType === type);
  const counts = alerts.reduce<Record<string, number>>((m, a) => ((m[a.alertType || 'system'] = (m[a.alertType || 'system'] || 0) + 1), m), {});
  return (
    <div className="space-y-4">
      <PageHeader
        title="Alerts"
        subtitle="Warnings appear here the moment something suspicious is found — a fake-looking file, a false claim, or many accounts posting the same thing. Alerts from the demo feed are tagged “simulated”."
      />
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setType('all')} className={`rounded-lg border px-2.5 py-1 text-xs ${type === 'all' ? 'border-cyan-500/60 text-cyan-200' : 'border-slate-800 text-slate-400'}`}>All ({alerts.length})</button>
        {Object.entries(TYPES).map(([k, v]) => (
          <button key={k} onClick={() => setType(k)} className={`rounded-lg border px-2.5 py-1 text-xs ${type === k ? 'border-cyan-500/60 text-cyan-200' : 'border-slate-800 text-slate-400'}`}>{v} ({counts[k] || 0})</button>
        ))}
      </div>
      <Card title="Latest alerts (newest first)">
        {list.length === 0 ? <Empty icon={Bell} title="No alerts yet" hint="Alerts appear when a check finds something suspicious. Press “Try the demo” to see some." /> : (
          <div className="divide-y divide-slate-800/70">
            {list.map(a => (
              <div key={a.id} className="flex items-start gap-3 py-2.5 text-xs">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEV[a.severity]}`} />
                <span className="w-16 shrink-0 font-mono text-[10px] text-slate-500">{fmtTime(a.ts)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-100">{a.title}</span><span className="rounded bg-slate-800 px-1.5 text-[10px] text-slate-400">{TYPES[a.alertType || 'system']}</span><span className="text-[10px] uppercase text-slate-500">{a.severity}</span>{a.isSimulated && <SimulatedBadge label="simulated" />}</div>
                  <div className="mt-0.5 text-slate-400">{a.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
