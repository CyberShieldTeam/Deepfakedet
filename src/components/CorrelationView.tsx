import React,{useState} from 'react';
import type {Investigation} from '../types';
import type {CorrelationResult,MediaContextInput} from '../correlationTypes';
import {correlateInvestigation} from '../services/api';
import {Button,ErrorBox} from './ui';
import {correlationResultSummary} from '../resultSummaries';
export function CorrelationView({investigation:inv,onChanged}:{investigation:Investigation;onChanged:()=>Promise<Investigation[]>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[local,setLocal]=useState<CorrelationResult|null>(null);
 const [engine,setEngine]=useState('all'),[type,setType]=useState('all'),[relation,setRelation]=useState('all'),[strength,setStrength]=useState('all'),[selected,setSelected]=useState('');
 const [media,setMedia]=useState(''),[claim,setClaim]=useState(''),[kind,setKind]=useState<'user_caption'|'user_description'>('user_caption'),[text,setText]=useState(''),[rationale,setRationale]=useState(''),[url,setUrl]=useState('');
 const graph=busy||error||inv.correlationRun?.status==='stale'||inv.correlationRun?.status==='failed'?null:local??(inv.correlationRun?.status==='current'?inv.correlation??null:null);
 const run=async(contexts?:MediaContextInput[])=>{
  setBusy(true);setError('');setLocal(null);setSelected('');setMedia('');setClaim('');
  try{const response=await correlateInvestigation(inv.id,contexts);setLocal(response.result);await onChanged();}
  catch(e){setError(e instanceof Error?e.message:'Correlation failed');try{await onChanged();}catch{ /* Keep the visible failure if refreshing the case is also unavailable. */ }}finally{setBusy(false);}
 };
 const nodes=new Map(graph?.nodes.map(n=>[n.id,n])??[]);
 const visible=graph?.relationships.filter(e=>{
  const a=nodes.get(e.source)!,b=nodes.get(e.target)!;
  return (engine==='all'||a.engines.includes(engine as any)||b.engines.includes(engine as any))&&(type==='all'||a.type===type||b.type===type)&&(relation==='all'||e.type===relation)&&(strength==='all'||e.strength===strength);
 })??[];
 const chosen=visible.find(e=>e.id===selected)??visible[0];
 const summary=graph?correlationResultSummary(graph):null;
 const mediaNodes=graph?.nodes.filter(n=>n.type==='media_asset')??[],claims=graph?.nodes.filter(n=>n.type==='claim')??[];
 const existingContexts=():MediaContextInput[]=>(inv.correlationContexts??[]).map(({mediaId,claimId,kind,text,rationale,mediaUrl})=>({mediaId,claimId,kind,text,rationale,...(mediaUrl?{mediaUrl}:{})}));
 const fieldClass='max-w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs';
 return <section aria-label="Cross-engine evidence correlation" className="space-y-3 rounded-lg border border-cyan-900 p-4 text-xs text-slate-300">
  <h3 className="text-base font-semibold text-cyan-200">Engine 4 · Cross-engine evidence correlation</h3>
  <p>Evidence relationships indicate observed associations and do not independently establish misinformation, manipulation, or malicious coordination.</p>
  <div className="flex flex-wrap gap-2"><Button loading={busy} onClick={()=>run()}>Correlate evidence</Button>{!!inv.correlationContexts?.length&&<Button disabled={busy} onClick={()=>run([])}>Clear supplied contexts and regenerate</Button>}</div>
  {busy&&<p role="status">Correlating the current attached evidence…</p>}
  {error&&<ErrorBox message={error}/>}
  {!graph&&inv.correlation&&<p className="text-amber-200">Previous graph retained in the saved case; it is not shown as a new/current result. Last run: {inv.correlationRun?.status??'unknown'}. Regenerate after evidence changes.</p>}
  {!graph&&!inv.correlation&&!busy&&<p>Generate a graph from attached media, claims and network findings. No correlation has been saved yet.</p>}
  {graph&&<>
   <div className="rounded-lg border border-cyan-700/60 bg-cyan-950/20 p-3 text-sm" aria-label="Correlation result summary"><div className="font-semibold text-cyan-200">Investigation Result · {summary!.headline}</div><p className="mt-1">{summary!.explanation}</p>{summary!.important.length?<ul className="mt-2 list-disc pl-4">{summary!.important.map((item,i)=><li key={i}>{item}</li>)}</ul>:<p className="mt-2 text-slate-400">No supported cross-engine link is available to highlight.</p>}<p className="mt-2"><b>What remains unresolved:</b> {summary!.unresolved[0]||'No additional missing evidence was recorded; source-engine limitations still apply.'}</p><p className="mt-2 text-slate-400"><b>Next action:</b> {summary!.nextAction}</p></div>
   <p role="status"><b>Correlation status: {graph.state}</b> · {graph.counts.nodes} nodes · {graph.counts.relationships} relationships · {graph.counts.crossEngineLinks} cross-engine links · {graph.elapsedMs.toFixed(1)} ms</p>
   <p className="text-amber-200">{graph.truncated?'Bounded processing omitted evidence; inspect the limits and original engine results.':'No correlation cap was reached.'} No overall misinformation score is computed.</p>
   <Button variant="ghost" onClick={()=>{const objectUrl=URL.createObjectURL(new Blob([JSON.stringify(graph,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=objectUrl;a.download='veritas-correlation.json';a.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);}}>Download correlation JSON</Button>
   <details><summary className="cursor-pointer">Missing evidence and limitations</summary><ul className="list-disc pl-4">{[...graph.missingEvidence,...graph.limitations].map((s,i)=><li key={i}>{s}</li>)}</ul><pre className="overflow-auto">{JSON.stringify({limits:graph.limits,counts:graph.counts},null,2)}</pre></details>
   <details><summary className="cursor-pointer">Document a media caption or description</summary>
    <p className="my-2 text-amber-200">This records your supplied context. It is not OCR, transcription or independent extraction, and does not verify the claim.</p>
    <div className="grid gap-2">
     <label>Media asset <select aria-label="Context media asset" className={fieldClass} value={media||mediaNodes[0]?.id||''} onChange={e=>setMedia(e.target.value)}>{mediaNodes.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label>
     <label>Claim <select aria-label="Context claim" className={fieldClass} value={claim||claims[0]?.id||''} onChange={e=>setClaim(e.target.value)}>{claims.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label>
     <label>Context origin <select aria-label="Context origin" className={fieldClass} value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="user_caption">Analyst-supplied caption</option><option value="user_description">Analyst-supplied description</option></select></label>
     <label>Supplied context text <textarea aria-label="Supplied context text" className={fieldClass} maxLength={10000} value={text} onChange={e=>setText(e.target.value)}/></label>
     <label>Attribution rationale <input aria-label="Context attribution rationale" className={fieldClass} maxLength={2000} value={rationale} onChange={e=>setRationale(e.target.value)}/></label>
     <label>Documented media URL (optional, not byte-verified) <input aria-label="Documented media URL" className={fieldClass} maxLength={3000} value={url} onChange={e=>setUrl(e.target.value)}/></label>
     <Button disabled={busy||!mediaNodes.length||!claims.length||!text.trim()||!rationale.trim()} onClick={()=>run([...existingContexts(),{mediaId:media||mediaNodes[0].id,claimId:claim||claims[0].id,kind,text,rationale,...(url.trim()?{mediaUrl:url.trim()}:{})}])}>Save supplied context and correlate</Button>
    </div>
   </details>
   <div className="flex flex-wrap gap-2">
    <label>Engine <select aria-label="Filter correlation engine" className={fieldClass} value={engine} onChange={e=>setEngine(e.target.value)}>{['all','media','claim','network','analyst','investigation'].map(s=><option key={s}>{s}</option>)}</select></label>
    <label>Evidence <select aria-label="Filter evidence type" className={fieldClass} value={type} onChange={e=>setType(e.target.value)}>{['all',...new Set(graph.nodes.map(n=>n.type))].map(s=><option key={s}>{s}</option>)}</select></label>
    <label>Relationship <select aria-label="Filter relationship type" className={fieldClass} value={relation} onChange={e=>setRelation(e.target.value)}>{['all',...new Set(graph.relationships.map(e=>e.type))].map(s=><option key={s}>{s}</option>)}</select></label>
    <label>Match basis <select aria-label="Filter match basis" className={fieldClass} value={strength} onChange={e=>setStrength(e.target.value)}>{['all','exact_reference','literal_mention','analyst_asserted','contextual'].map(s=><option key={s}>{s}</option>)}</select></label>
   </div>
   <ul className="max-h-64 space-y-1 overflow-auto" aria-label="Evidence relationships">{visible.slice(0,100).map(e=><li key={e.id}><button className="w-full rounded border border-slate-700 p-2 text-left hover:border-cyan-600" onClick={()=>setSelected(e.id)}><b>{e.type}</b> · {e.strength}<br/>{nodes.get(e.source)?.label} → {nodes.get(e.target)?.label}</button></li>)}</ul>
   <p>Showing {Math.min(100,visible.length)} of {visible.length} matching relationships; download includes all retained relationships.</p>
   {chosen&&<div className="space-y-2 rounded border border-slate-700 p-3" aria-label="Selected correlation relationship"><b>{chosen.type} · {chosen.strength}</b><p>{chosen.explanation}</p><p>Method: {chosen.method}</p><p>Supporting references: {chosen.support.join(', ')}</p><p>{chosen.limitations.join(' ')}</p><pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify({measurements:chosen.measurements,source:nodes.get(chosen.source),target:nodes.get(chosen.target)},null,2)}</pre></div>}
   <div><h4 className="font-semibold">Contradictory reviewed sources ({graph.contradictions.length})</h4>{graph.contradictions.map(c=><div key={c.claimId}><p>{nodes.get(c.claimId)?.label}</p><ul>{c.sourceIds.map(id=><li key={id}>{nodes.get(id)?.label} · {String(nodes.get(id)?.metadata.stance)}</li>)}</ul></div>)}</div>
   <details><summary className="cursor-pointer">Investigation evidence timeline</summary><p>Event, retrieval, analysis and ingestion times are distinct. Ordering does not imply causation. Missing publication times are not invented.</p><ol className="max-h-72 space-y-2 overflow-auto border-l border-slate-700 pl-3">{graph.timeline.slice(0,200).map(t=><li key={t.id}><b>{t.time.kind}</b> · {t.time.utc} · original {t.time.original} · resolution {t.time.resolutionMs} ms<br/>{nodes.get(t.nodeId)?.label}</li>)}</ol><p>Showing {Math.min(200,graph.timeline.length)} of {graph.timeline.length} retained entries; unknown/unsupported dates remain in node details.</p></details>
  </>}
 </section>;
}
