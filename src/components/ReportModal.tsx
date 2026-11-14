import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, Printer, X } from "lucide-react";
import { fetchReport, Report } from "../services/api";
import { Button, ErrorBox } from "./ui";

const esc = (s: any) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
const list = (xs?: string[]) =>
  xs?.length
    ? `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
    : '<p class="muted">None.</p>';
const engineLabel = (e?: string) =>
  e === "model_adapter"
    ? "Dedicated classifier adapter"
    : e === "gemini"
      ? "Gemini explanation (not a classifier)"
      : e === "simulated_demo"
        ? "SIMULATED DEMO DATA"
        : e === "graph_heuristics"
          ? "Graph heuristics (computed)"
          : "Measured signals only";
const safeUrl = (value: string) => (/^https?:\/\//i.test(value) ? esc(value) : "#");

export function reportHtml(r: Report): string {
  const inv = r.investigation;
  const media = inv.mediaFindings?.length
    ? inv.mediaFindings
    : inv.forensicResult
      ? [inv.forensicResult]
      : [];
  const claims = inv.claimResults?.length
    ? inv.claimResults
    : inv.claimResult
      ? [inv.claimResult]
      : [];
  const c = inv.campaignResult;
  const allLimits = Array.from(
    new Set([...media.flatMap((m) => m.limitations), ...claims.flatMap((x) => x.limitations)]),
  );
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.reportId)} — VERITAS AI Investigation Report</title>
<style>
body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#0f172a;max-width:860px;margin:32px auto;padding:0 24px;font-size:13px;line-height:1.5}
h1{font-size:22px;margin:0}h2{font-size:15px;border-bottom:2px solid #0e7490;padding-bottom:4px;margin-top:28px;color:#0e7490}h3{font-size:13px;margin:14px 0 4px}
.meta{font-family:monospace;font-size:11px;color:#475569}.muted{color:#64748b}.box{border:1px solid #cbd5e1;border-radius:6px;padding:10px 12px;margin:8px 0}
.sim{background:#fdf4ff;border:1px solid #d946ef;color:#86198f;padding:8px 12px;border-radius:6px;font-weight:600;margin:12px 0}
table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #e2e8f0;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f1f5f9}
.tag{display:inline-block;font-family:monospace;font-size:10px;padding:1px 6px;border-radius:4px;background:#e2e8f0;margin-right:4px}
.crit{color:#be123c;font-weight:700}a{color:#0e7490}@media print{body{margin:0}}
</style></head><body>
<div class="meta">VERITAS AI · SURAKSHA SUCHAN | DIGITAL TRUST &amp; FORENSIC INTELLIGENCE</div>
<h1>Unified Investigation Report</h1>
<div class="meta">Report ${esc(r.reportId)} · Case ${esc(inv.caseNumber)} · ID ${esc(inv.id)} · Generated ${esc(new Date(r.generatedAt).toLocaleString())}</div>
<div class="meta">Integrity hash (SHA-256 of case record): ${esc(r.integrityHash)}</div>
${inv.isSimulatedDemo ? '<div class="sim">SIMULATED DEMONSTRATION — This report describes fictional incident data. It is not a real emergency, and no real government announcement is represented.</div>' : ""}
<h2>1. Incident summary</h2>
<div class="box"><b>Executive evidence summary</b><p>Media authenticity: ${media.length} analysis record(s), ${media.filter((m) => m.inference?.status === "available").length} with an available dedicated classifier. Factual accuracy: ${claims.length} claim assessment(s), ${claims.filter((x) => x.verdict === "Insufficient Evidence").length} with insufficient evidence. Distribution: ${esc(c?.classification || (c ? "Legacy baseline; intent undetermined" : "Not assessed"))}.</p><p>These are independent evidence dimensions. AI generation is not itself misinformation, and relationship density does not establish malicious intent. ${inv.isSimulatedDemo ? "All findings in this case are simulated." : "Unavailable inference remains unassessed, not authentic or fake."}</p></div>
<table><tr><th>Title</th><td>${esc(inv.title)}</td></tr><tr><th>Subject</th><td>${esc(inv.targetSubject)}</td></tr>
<tr><th>Risk classification</th><td class="${inv.riskLevel === "Critical" ? "crit" : ""}">${esc(inv.riskLevel)}</td></tr><tr><th>Status</th><td>${esc(inv.status)}</td></tr>
<tr><th>Opened</th><td>${esc(new Date(inv.createdAt).toLocaleString())}</td></tr><tr><th>Analyst</th><td>${esc(inv.analyst)}</td></tr></table>
<p>${esc(inv.description)}</p>${inv.summary ? `<p><b>Assessment:</b> ${esc(inv.summary)}</p>` : ""}
${inv.timeline?.length ? `<h3>Threat timeline</h3><table><tr><th>Time</th><th>Module</th><th>Event</th></tr>${inv.timeline.map((t) => `<tr><td>${esc(new Date(t.time).toLocaleTimeString())}</td><td>${esc(t.module)}</td><td>${esc(t.label)}</td></tr>`).join("")}</table>` : ""}
<h2>2. Media analysis (${media.length})</h2>
${
  media.length
    ? media
        .map(
          (
            m,
            i,
          ) => `<div class="box"><h3>2.${i + 1} ${esc(m.fileName || m.modality)} <span class="tag">${esc(m.modality)}</span><span class="tag">${esc(engineLabel(m.engine))}</span></h3>
<p><b>Verdict:</b> ${esc(m.authenticity.replace(/_/g, " "))} · <b>Confidence:</b> ${m.confidenceScore == null ? "not estimated" : esc(m.confidenceScore) + "%"} · <b>Risk:</b> ${esc(m.riskLevel || "—")} · <b>AI-generated probability:</b> ${m.aiGeneratedProbability != null ? m.aiGeneratedProbability + "%" : "not available"}</p>
<p>${esc(m.headlineSummary)}</p>${m.inference ? `<p><b>Model:</b> ${esc(m.inference.modelId)} @ ${esc(m.inference.version)} · ${esc(m.inference.status)}<br><b>Calibration:</b> ${esc(m.inference.calibration)}<br><b>Training / license:</b> ${esc(m.inference.trainingData)} / ${esc(m.inference.license)}</p>` : ""}<b>Findings</b>${list(m.detailedFindings)}<b>Alternative explanations</b>${list(m.alternativeHypotheses)}${m.sampledFrames?.length ? `<p>Frame evidence: ${m.sampledFrames.map((f) => `${esc(f.timestamp === null ? "time unavailable" : f.timestamp.toFixed(1) + "s")}: ${esc(f.probability === null ? f.status : Math.round(f.probability * 100) + "% model output")}`).join("; ")}</p>` : ""}${m.audioSegments?.length ? `<p>Audio segments: ${m.audioSegments.map((s) => `${esc(s.start)}–${esc(s.end)}s: ${esc(Math.round(s.probability * 100))}% model output`).join("; ")}</p>` : ""}</div>`,
        )
        .join("")
    : '<p class="muted">No media analysed.</p>'
}
<h2>3. Claim verification (${claims.length})</h2>
${
  claims.length
    ? claims
        .map(
          (
            x,
            i,
          ) => `<div class="box"><h3>3.${i + 1} ${esc(x.verdict)} <span class="tag">${esc(engineLabel(x.engine))}</span></h3>
<p><b>Claim:</b> ${esc(x.targetClaim)}</p>${x.translatedText ? `<p><b>Original (${esc(x.detectedLanguage)}):</b> ${esc(x.originalInput)}<br><b>Translation:</b> ${esc(x.translatedText)}</p>` : ""}
<p><b>Verification mode:</b> ${esc((x.verificationMode || "rule_based").replace(/_/g, " "))} · <b>Assessment:</b> ${esc((x.assessment || "unverified").replace(/_/g, " "))}</p>
<p><b>Confidence:</b> ${x.confidenceScore == null ? "not estimated" : esc(x.confidenceScore) + "%"}${x.confidenceNote ? ` (${esc(x.confidenceNote)})` : ""} · checked ${esc(new Date(x.timestamp).toLocaleString())}${x.modelUsed ? ` · ${esc(x.modelUsed)}` : ""}</p><p>${esc(x.verdictRationale)}</p>
<b>Sub-claims</b>${list(x.extractedClaims)}<b>Contradicting evidence</b>${list(x.contradictingEvidence)}<b>Supporting evidence</b>${list(x.supportingEvidence)}</div>`,
        )
        .join("")
    : '<p class="muted">No claims verified.</p>'
}
<h2>4. Campaign network findings</h2>
${
  c
    ? `<p>${esc(c.datasetName)}${c.isSimulated ? ' <span class="tag">SYNTHETIC DATASET</span>' : ""} — ${c.totalAccounts} accounts, ${c.totalPosts} posts, ${c.suspiciousPostCount ?? "—"} posts warranting review. Assessment: ${esc(c.classification || "Legacy baseline; intent undetermined")}. No maliciousness probability is estimated.</p>
<table><tr><th>Cluster</th><th>Accounts</th><th>Posts</th><th>Span (min)</th><th>Score</th><th>Tactics</th></tr>${c.clusters.map((k) => `<tr><td>${esc(k.name)}</td><td>${k.accountCount}</td><td>${k.postCount}</td><td>${k.burstDurationMinutes}</td><td>${k.coordinationScore}</td><td>${esc(k.identifiedTactics.join("; "))}</td></tr>`).join("")}</table>
${list(c.tacticalSummary)}`
    : '<p class="muted">No campaign analysed.</p>'
}
${inv.multilingual?.length ? `<h3>Multilingual propagation</h3><table><tr><th>Language</th><th>Original</th><th>Translation</th><th>Posts</th></tr>${inv.multilingual.map((v) => `<tr><td>${esc(v.language)}</td><td>${esc(v.original)}</td><td>${esc(v.translation)}</td><td>${v.posts}</td></tr>`).join("")}</table>` : ""}
<h2>5. Evidence references</h2>
${(() => {
  const src = claims.flatMap((x) => x.sources);
  return src.length
    ? `<ol>${src.map((s) => `<li>${s.url ? `<a href="${safeUrl(s.url)}">${esc(s.title)}</a>` : esc(s.title)} — ${esc(s.domain)}${s.isSimulated ? ' <span class="tag">FICTIONAL</span>' : ` · published: ${esc(s.publishDate || "not provided")}${s.retrievedAt ? ` · retrieved ${esc(new Date(s.retrievedAt).toLocaleString())}` : ""}`}${s.citedFor ? `<br><span class="muted">Cited for: ${esc(s.citedFor.slice(0, 200))}</span>` : ""}</li>`).join("")}</ol>`
    : '<p class="muted">No external sources were checked.</p>';
})()}
${media.length ? `<p class="muted">Media files: ${media.map((m) => esc(m.fileName || m.modality)).join(", ")}</p>` : ""}
<h2>6. Recommendations</h2>${list(r.recommendations)}
<h2>Methodology &amp; final conclusions</h2><p>Image/audio inference uses validated, versioned provider responses where configured. ELA, metadata scans, spectrograms and temporal differences are supporting signals, not classifier substitutes. C2PA signatures are not verified. Claim retrieval uses BM25 and optionally multilingual embeddings and Fact Check Tools. Attributed analyst review assesses source applicability and stance. ${esc(c?.methodology || "The legacy union-find baseline is retained for comparison.")}</p><p>Conclusion: rely only on available, claim-specific evidence. Review authenticity, accuracy and distribution independently; no combined fake/real probability is calculated. Original media is not archived here; preserve it in an access-controlled evidence repository.</p>
<h2>7. Analysis limitations</h2>${list([...allLimits, "Gemini is an explanation/translation assistant, not a trained deepfake classifier.", "All indicators require human analyst review before enforcement or public statements."])}
<p class="meta" style="margin-top:30px">Generated by VERITAS AI · ${esc(new Date(r.generatedAt).toISOString())}</p>
</body></html>`;
}

export const ReportModal: React.FC<{ investigationId: string; onClose: () => void }> = ({
  investigationId,
  onClose,
}) => {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    fetchReport(investigationId)
      .then(setReport)
      .catch((e) => setError(e.message));
  }, [investigationId]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  const html = useMemo(() => (report ? reportHtml(report) : ""), [report]);

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = `${report!.reportId}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Investigation report"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2.5">
          <div className="flex-1 text-sm font-semibold">
            Unified Investigation Report{" "}
            {report && <span className="font-mono text-xs text-cyan-300">· {report.reportId}</span>}
          </div>
          <Button
            variant="ghost"
            disabled={!report}
            onClick={() => frame.current?.contentWindow?.print()}
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save PDF
          </Button>
          <Button disabled={!report} onClick={download}>
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
          <button
            autoFocus
            aria-label="Close report"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {error ? (
          <div className="p-4">
            <ErrorBox message={error} />
          </div>
        ) : report ? (
          <iframe ref={frame} title="report" srcDoc={html} className="flex-1 bg-white" />
        ) : (
          <div className="p-8 text-center text-xs text-slate-400">Generating report…</div>
        )}
      </div>
    </div>
  );
};
