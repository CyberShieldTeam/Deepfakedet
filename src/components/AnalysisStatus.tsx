import React from 'react';
import type {AnalysisDiagnostics} from '../types';
/** Processing status never substitutes for an engine verdict. Full diagnostics are opt-in. */
export function AnalysisStatus({analysis:a}:{analysis?:AnalysisDiagnostics}){
  if(!a)return null;
  return <section aria-label="Analysis processing status" className="space-y-2 rounded-lg border border-slate-700 p-3 text-sm text-slate-300">
    <p role="status"><b>Analysis status: {a.state}</b></p><p>{a.summary}</p>
    <details className="text-xs text-slate-400"><summary className="cursor-pointer">Developer diagnostics</summary>
      <p>Analysis ID: {a.id} · engine: {a.engine} · input: {a.inputValidation} · completeness: {a.completeness} · {a.elapsedMs==null?'processing time not recorded':`${a.elapsedMs.toFixed(1)} ms`}</p>
      <p>Error category: {a.errorCategory??'none'}</p>
      <ul>{Object.entries(a.counts).map(([k,v])=><li key={k}>{k}: {v}</li>)}</ul>
      <ul>{a.stages.map((s,i)=><li key={i}>{s.stage}: {s.status}{s.count!=null?` (${s.count})`:''}{s.errorCategory?` · ${s.errorCategory}`:''}{s.message?` · ${s.message}`:''}</li>)}</ul>
      <ul>{a.filteringReasons.map((r,i)=><li key={i}>{r}</li>)}</ul>
    </details>
  </section>;
}
