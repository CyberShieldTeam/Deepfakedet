import React from 'react';
import { AlertTriangle, Cpu, FlaskConical, Loader2, ScanSearch, Sparkles } from 'lucide-react';
import { AnalysisEngine, RiskLevel } from '../types';

export const Card: React.FC<{ title?: React.ReactNode; right?: React.ReactNode; className?: string; children: React.ReactNode }> = ({ title, right, className = '', children }) => (
  <section className={`rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm ${className}`}>
    {(title || right) && (
      <header className="flex items-center justify-between gap-3 border-b border-slate-800/70 px-4 py-2.5">
        <h3 className="text-[11px] font-mono uppercase tracking-[0.14em] text-slate-400">{title}</h3>
        {right}
      </header>
    )}
    <div className="p-4">{children}</div>
  </section>
);

const RISK_CLS: Record<string, string> = {
  Critical: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  High: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  Medium: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  Low: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  Informational: 'bg-sky-500/15 text-sky-300 border-sky-500/40'
};
export const RiskBadge: React.FC<{ level?: RiskLevel | string }> = ({ level = 'Informational' }) => (
  <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide ${RISK_CLS[level] || RISK_CLS.Informational}`}>{level}</span>
);

export const SimulatedBadge: React.FC<{ label?: string }> = ({ label = 'Simulated demo' }) => (
  <span className="inline-flex items-center gap-1 rounded border border-fuchsia-500/40 bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-fuchsia-300">
    <FlaskConical className="h-3 w-3" />
    {label}
  </span>
);

export const EngineBadge: React.FC<{ engine?: AnalysisEngine; note?: string }> = ({ engine, note }) => {
  const map: Record<string, [string, string, React.ElementType]> = {
    gemini: ['Checked by Gemini AI', 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300', Sparkles],
    local_pretrained: ['Local pretrained image model', 'border-sky-500/40 bg-sky-500/10 text-sky-300', Cpu],
    local_image_screening: ['Local image screening (no classifier)', 'border-amber-500/40 bg-amber-500/10 text-amber-300', ScanSearch],
    local_aasist: ['Local AASIST speech screening', 'border-sky-500/40 bg-sky-500/10 text-sky-300', Cpu],
    local_video_frames: ['Local video frame screening', 'border-sky-500/40 bg-sky-500/10 text-sky-300', ScanSearch],
    heuristic: ['Basic checks (AI unavailable)', 'border-amber-500/40 bg-amber-500/10 text-amber-300', AlertTriangle],
    simulated_demo: ['Demo data — not real', 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300', FlaskConical],
    graph_heuristics: ['Pattern analysis (computed)', 'border-sky-500/40 bg-sky-500/10 text-sky-300', Cpu]
  };
  const [label, cls, Icon] = map[engine || 'heuristic'];
  return (
    <span title={note} className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide ${cls}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger'; loading?: boolean }> = ({ variant = 'primary', loading, className = '', children, disabled, ...rest }) => {
  const v =
    variant === 'primary'
      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow shadow-cyan-950/50'
      : variant === 'danger'
      ? 'border border-rose-600/50 text-rose-300 hover:bg-rose-500/10'
      : 'border border-slate-700 text-slate-300 hover:border-cyan-500/60 hover:text-cyan-200';
  return (
    <button {...rest} disabled={disabled || loading} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`}>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
};

export const Stat: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string; icon?: React.ElementType }> = ({ label, value, sub, accent = 'text-cyan-300', icon: Icon }) => (
  <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.14em] text-slate-500">
      {label}
      {Icon && <Icon className={`h-4 w-4 ${accent}`} />}
    </div>
    <div className={`mt-2 text-2xl font-semibold tabular-nums ${accent}`}>{value}</div>
    {sub && <div className="mt-1 text-[11px] text-slate-500">{sub}</div>}
  </div>
);

export const Empty: React.FC<{ icon: React.ElementType; title: string; hint?: string; action?: React.ReactNode }> = ({ icon: Icon, title, hint, action }) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-800 py-10 text-center">
    <Icon className="h-8 w-8 text-slate-600" />
    <div className="text-sm text-slate-300">{title}</div>
    {hint && <div className="max-w-sm text-xs text-slate-500">{hint}</div>}
    {action}
  </div>
);

export const ErrorBox: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
    {message}
  </div>
);

export const Meter: React.FC<{ value: number; color?: string }> = ({ value, color }) => {
  const c = color || (value >= 80 ? '#f43f5e' : value >= 60 ? '#f97316' : value >= 40 ? '#eab308' : '#10b981');
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: c }} />
    </div>
  );
};

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const fmtDate = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export const VERDICT_CLS: Record<string, string> = {
  Supported: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  Contradicted: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
  'Mixed Evidence': 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  'Insufficient Evidence': 'text-slate-300 border-slate-600 bg-slate-800/40'
};

export const AUTH_LABEL: Record<string, [string, string]> = {
  likely_synthetic: ['Likely synthetic / manipulated', 'text-rose-300'],
  suspicious_artifacts: ['Suspicious artifacts', 'text-orange-300'],
  inconclusive: ['Inconclusive', 'text-amber-300'],
  likely_authentic: ['No AI-generation or manipulation indicators found', 'text-emerald-300']
};
