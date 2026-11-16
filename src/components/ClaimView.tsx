import React, { useState } from "react";
import { Brain, CheckCircle2, ExternalLink, Globe, Loader2, Search, SearchX } from "lucide-react";
import { ClaimVerificationResult, Investigation } from "../types";
import { verifyClaim, reviewClaim } from "../services/api";
import {
  Button,
  Card,
  Empty,
  EngineBadge,
  ErrorBox,
  Meter,
  SimulatedBadge,
  VERDICT_CLS,
  fmtDate,
} from "./ui";
import { claimAssessment, Details, PageHeader, plainClaim, Term, VerdictBanner } from "./plain";
import type { AttachFn } from "../App";
import {AnalysisStatus} from './AnalysisStatus';

const SAMPLES = [
  {
    lang: "English",
    text: "BREAKING: The dam near Hyderabad has collapsed. Evacuate immediately and share this with everyone!",
  },
  { lang: "Hindi", text: "हैदराबाद के पास बांध टूट गया है, तुरंत घर खाली करें और सबको भेजें" },
  { lang: "Telugu", text: "హైదరాబాద్ దగ్గర డ్యామ్ కూలిపోయింది, వెంటనే ఖాళీ చేయండి" },
  { lang: "English", text: "The Charminar in Hyderabad was built in 1591." },
];

const MODE: Record<string, [string, string, React.ElementType]> = {
  analyst_reviewed: [
    "Analyst-reviewed source evidence",
    "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
    CheckCircle2,
  ],
  search_grounded: [
    "Checked against web sources",
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    Globe,
  ],
  ai_knowledge_only: [
    "AI knowledge only — not verified",
    "border-amber-500/40 bg-amber-500/10 text-amber-300",
    Brain,
  ],
  insufficient_external_evidence: [
    "Retrieved evidence needs review",
    "border-slate-500/50 bg-slate-700/30 text-slate-300",
    SearchX,
  ],
  rule_based: [
    "Basic screening only",
    "border-amber-500/40 bg-amber-500/10 text-amber-300",
    Search,
  ],
  simulated_demo: [
    "Simulated demo data",
    "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300",
    Search,
  ],
};
const ASSESS: Record<string, [string, string]> = {
  verified_true: ["Verified: supported by cited sources", "text-emerald-300"],
  verified_false: ["Verified false: contradicted by sources", "text-rose-300"],
  verified_mixed: ["Verified: sources disagree", "text-amber-300"],
  plausible: ["Plausible per AI knowledge (unverified)", "text-sky-300"],
  implausible: ["Likely false per AI knowledge (unverified)", "text-orange-300"],
  unverified: ["Unverified", "text-slate-300"],
};

export const ClaimResult: React.FC<{ r: ClaimVerificationResult }> = ({ r }) => {
  const [modeLabel, modeCls, ModeIcon] =
    MODE[r.verificationMode || (r.engine === "simulated_demo" ? "simulated_demo" : "rule_based")];
  const [assessLabel, assessCls] = ASSESS[claimAssessment(r)];
  const verified =
    r.verificationMode === "search_grounded" ||
    r.verificationMode === "simulated_demo" ||
    r.verificationMode === "analyst_reviewed";
  const lang = r.detectedLanguage && r.detectedLanguage !== "English" ? r.detectedLanguage : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {r.isSimulated || r.engine === "simulated_demo" ? (
          <SimulatedBadge />
        ) : (
          <>
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide ${modeCls}`}
            >
              <ModeIcon className="h-3 w-3" />
              {modeLabel}
            </span>
            <EngineBadge engine={r.engine} note={r.engineNote} />
          </>
        )}
        <span className="text-[11px] text-slate-500">checked {fmtDate(r.timestamp)}</span>
      </div>
      <VerdictBanner {...plainClaim(r)} />
      <AnalysisStatus analysis={r.analysis}/>
      {(r.retrievalDetails?.omittedCount || 0)>0 && <p role="status" className="text-sm text-amber-200">Some ranked evidence was omitted. Narrow the claim or corpus before recording a decisive assessment.</p>}
      {r.verificationStatus && (
        <div className="rounded border border-cyan-900 p-3 text-sm" role="status">
          <b>Claim status: {r.verificationStatus}</b>
          <p className="mt-1 text-xs text-slate-400">
            This claim assessment is separate from media provenance, manipulation observations and
            dissemination indicators.
          </p>
        </div>
      )}
      {r.normalizedClaim && (
        <p className="text-sm text-slate-300">Normalized claim: {r.normalizedClaim}</p>
      )}
      {r.missingEvidence?.length ? (
        <div className="text-xs text-amber-200">
          <b>Missing evidence / review needs</b>
          <ul className="list-disc pl-4">
            {r.missingEvidence.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {r.evidenceSufficiency && (
        <div className="rounded border border-slate-700/80 p-3 text-xs text-slate-400">
          Evidence sufficiency:{" "}
          <span className="text-cyan-200">{r.evidenceSufficiency.replaceAll("_", " ")}</span>
          {r.retrieval && (
            <p className="mt-1">
              Retrieval: {r.retrieval.lexical} · Semantic: {r.retrieval.semantic}
            </p>
          )}
        </div>
      )}
      {r.verdictRationale && (
        <div>
          <div className="mb-1 text-xs font-medium text-slate-400">Why</div>
          <p className="text-sm leading-relaxed text-slate-300">{r.verdictRationale}</p>
        </div>
      )}

      {lang || r.translatedText ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-800 p-3 text-sm">
            <div className="mb-1 text-[11px] text-slate-500">
              What you entered{lang ? ` (${lang})` : ""}
            </div>
            {r.originalInput}
          </div>
          <div className="rounded-lg border border-slate-800 p-3 text-sm">
            <div className="mb-1 text-[11px] text-slate-500">In English</div>
            {r.translatedText || "—"}
          </div>
        </div>
      ) : null}

      <div>
        <div className="mb-1 text-xs font-medium text-slate-400">
          {verified ? "Sources checked" : "Sources"} ({r.sources.length})
        </div>
        {r.sources.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 p-3 text-sm text-slate-400">
            {r.verificationMode === "insufficient_external_evidence"
              ? "We searched the web but found no useful sources for this claim."
              : "No news or official sources were checked for this result."}
          </div>
        ) : (
          <div className="space-y-2">
            {r.sources.map((s, i) => (
              <div key={i} className="rounded-lg border border-slate-800 p-3 text-xs">
                <div className="flex items-center gap-2 text-sm">
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 font-medium text-cyan-300 hover:underline"
                    >
                      {s.title}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="font-medium text-slate-200">{s.title}</span>
                  )}
                  {s.isSimulated && <SimulatedBadge label="fictional" />}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {s.id ? `[${s.id}] ` : ""}
                  {s.publisher || s.domain}
                  {s.isSimulated
                    ? ` · stance: ${s.stance}`
                    : ` · ${s.provider==='google_fact_check' ? 'review date' : 'published'}: ${s.publishDate || "date not provided"}${s.retrievedAt ? ` · found ${fmtDate(s.retrievedAt)}` : ""}`}
                </div>
                <div className="mt-1 text-slate-400">{s.excerpt}</div>
                {s.publisherRating && (
                  <p className="mt-1 text-amber-200">
                    Publisher rating: {s.publisherRating} (not a VERITAS verdict)
                  </p>
                )}
                {s.relevance && (
                  <p className="mt-1 text-slate-500">
                    Relevance: BM25 {s.relevance.lexicalScore.toFixed(3)} · semantic{" "}
                    {s.relevance.semanticScore?.toFixed(3) ?? "unavailable"} · source credibility:{" "}
                    {s.credibilityRating}
                  </p>
                )}
                {s.review && (
                  <p className="mt-1 text-cyan-200">
                    Reviewed by {s.review.reviewedBy} · {fmtDate(s.review.reviewedAt)} · quoted
                    passage: “{s.review.quote}”
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="mb-1 text-xs font-medium text-emerald-300">Evidence that supports it</div>
          {r.supportingEvidence?.length ? (
            <ul className="list-disc space-y-1 pl-4 text-xs text-slate-300">
              {r.supportingEvidence.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-slate-500">None found</div>
          )}
        </div>
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
          <div className="mb-1 text-xs font-medium text-rose-300">Evidence against it</div>
          {r.contradictingEvidence?.length ? (
            <ul className="list-disc space-y-1 pl-4 text-xs text-slate-300">
              {r.contradictingEvidence.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-slate-500">None found</div>
          )}
        </div>
      </div>

      <Details title="Technical details (for experts)">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-slate-500">
              {verified ? "Verdict" : "External verification verdict"}
            </div>
            <span
              className={`inline-block rounded-lg border px-3 py-1.5 text-sm font-semibold ${VERDICT_CLS[r.verdict]}`}
            >
              {r.verdict}
            </span>
          </div>
          <div className="w-48">
            <div className="mb-1 text-[11px] text-slate-500">
              <Term k="confidence">Confidence</Term>{" "}
              {r.confidenceScore == null ? "not estimated" : `${r.confidenceScore}%`}
            </div>
            {r.confidenceScore != null && (
              <Meter value={r.confidenceScore} color={verified ? "#22d3ee" : "#f59e0b"} />
            )}
            {r.confidenceNote && (
              <div className="mt-1 text-[10px] text-slate-500">{r.confidenceNote}</div>
            )}
          </div>
        </div>
        <div className={`text-sm font-semibold ${assessCls}`}>{assessLabel}</div>
        {!verified && r.engine === "gemini" && (
          <div className="text-[11px] text-slate-500">
            Gemini's judgement only — this has not been checked against external sources.
          </div>
        )}
        {r.engineNote && (
          <div className="rounded border border-slate-800 bg-slate-950/50 p-2 text-[11px] text-slate-400">
            {r.engineNote}
            {r.modelUsed ? ` (${r.modelUsed})` : ""}
          </div>
        )}
        <div>
          <div className="mb-1 text-xs font-medium text-slate-400">
            Individual statements checked
          </div>
          <ol className="list-decimal space-y-1 pl-4 text-xs text-slate-300">
            {r.extractedClaims.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
        </div>
        {r.searchQueries && r.searchQueries.length > 0 && (
          <div className="text-[11px] text-slate-400">
            <span className="font-mono uppercase text-slate-500">Google searches run: </span>
            {r.searchQueries.map((q) => `"${q}"`).join(" · ")}
          </div>
        )}
        {r.factCheckerConsensus && (
          <div className="text-[11px] text-amber-200/80">{r.factCheckerConsensus}</div>
        )}
        <div>
          <div className="mb-1 text-xs font-medium text-slate-400">Limitations</div>
          <ul className="list-disc pl-4 text-[11px] text-slate-500">
            {r.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      </Details>
    </div>
  );
};

export const ClaimView: React.FC<{
  attach: AttachFn;
  active: Investigation | null;
  onLiveAnalysis?: () => void;
}> = ({ attach, active, onLiveAnalysis }) => {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ClaimVerificationResult | null>(null);
  const [saved, setSaved] = useState("");
  const [reviews, setReviews] = useState<Record<string, string>>({});
  const [reviewNote, setReviewNote] = useState("");
  const [quotes, setQuotes] = useState<Record<string, string>>({});
  const [contextConfirmed, setContextConfirmed] = useState(false);
  const demo = active?.isSimulatedDemo ? active.claimResult : undefined;

  const run = async () => {
    if (!text.trim()) return;
    setResult(null);
    onLiveAnalysis?.();
    setBusy(true);
    setError("");
    setSaved("");
    try {
      setReviews({});
      setReviewNote("");
      setQuotes({});
      setContextConfirmed(false);
      setResult(await verifyClaim(text));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!result) return;
    try {
      const inv = await attach("claim", result, `Claim: ${result.targetClaim.slice(0, 60)}`);
      setSaved(`Saved to ${inv.caseNumber}`);
    } catch (e: any) {
      setError(e.message);
    }
  };
  const shown = result || demo;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fact-check a claim"
        subtitle="Enter a factual assertion in English, हिन्दी or తెలుగు. Review retrieved evidence and its limits; unavailable sources leave the claim unresolved."
        steps={["Paste or type the claim", "Press “Check this claim”", "Read the result"]}
      />
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-2">
          <Card title="1 · What do you want to check?">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="e.g. “The dam near Hyderabad has collapsed, evacuate now!”"
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none focus:border-cyan-500"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">{text.length} characters</span>
              <Button
                onClick={run}
                loading={busy}
                disabled={!text.trim()}
                className="!px-4 !py-2 !text-sm"
              >
                <Search className="h-4 w-4" />
                Check this claim
              </Button>
            </div>
            {error && (
              <div className="mt-2">
                <ErrorBox message={error} />
              </div>
            )}
          </Card>
          <Card title="No claim handy? Try one of these">
            <div className="space-y-1.5">
              {SAMPLES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setText(s.text)}
                  className="w-full rounded-lg border border-slate-800 p-2.5 text-left text-sm text-slate-300 hover:border-cyan-500/50"
                >
                  <span className="mr-1.5 rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-300">
                    {s.lang}
                  </span>
                  {s.text}
                </button>
              ))}
            </div>
          </Card>
        </div>
        <div className="xl:col-span-3">
          <Card
            title={
              result ? (
                "2 · Result"
              ) : demo ? (
                <span className="flex items-center gap-2">
                  Claim from the demo story · {active!.caseNumber}
                </span>
              ) : (
                "2 · Result"
              )
            }
            right={
              result && (
                <Button
                  variant="ghost"
                  onClick={save}
                  title="Keep this result in a case so you can include it in a report"
                >
                  {saved || "Save to a case"}
                </Button>
              )
            }
          >
            {busy ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                <div className="text-sm text-cyan-200">
                  Checking the claim… (usually a few seconds)
                </div>
              </div>
            ) : shown ? (
              <ClaimResult r={shown} />
            ) : (
              <Empty
                icon={CheckCircle2}
                title="Your result will appear here"
                hint="Evidence, publication dates where provided, and limitations — no invented citations."
              />
            )}
            {!!result?.sources.length && !result.isSimulated && (
              <details className="mt-4 rounded-lg border border-slate-700 p-3 text-xs text-slate-400">
                <summary className="cursor-pointer font-medium text-cyan-200">
                  Analyst review · assess source applicability
                </summary>
                <p className="my-3">
                  Open each source, verify that it addresses this exact claim, then record its
                  stance. This creates an attributed human assessment, not an automated truth score.
                </p>
                {result.sources.map((s) => (
                  <div key={s.id || s.url} className="mb-3 space-y-2">
                    <span className="truncate">{s.id ? `[${s.id}] ` : ''}{s.title}</span>
                    <select
                      aria-label={`Stance for ${s.title}${s.id ? ` [${s.id}]` : ''}`}
                      disabled={s.provider === "google_fact_check"}
                      value={reviews[s.id || s.url] || "neutral"}
                      onChange={(e) => setReviews((v) => ({ ...v, [s.id || s.url]: e.target.value }))}
                      className="rounded border border-slate-700 bg-slate-900 p-2"
                    >
                      {["neutral", "supports", "contradicts", "mixed"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                    {s.provider === "google_fact_check" && (
                      <p>
                        Only claim-review metadata was retrieved. An authorized underlying evidence
                        passage is required for a decisive assessment.
                      </p>
                    )}
                    <textarea
                      aria-label={`Evidence quote for ${s.title}${s.id ? ` [${s.id}]` : ''}`}
                      value={quotes[s.id || s.url] || ""}
                      onChange={(e) => setQuotes((v) => ({ ...v, [s.id || s.url]: e.target.value }))}
                      placeholder="Paste an exact passage from the retrieved excerpt for any non-neutral stance (at least 12 characters)"
                      className="w-full rounded border border-slate-700 bg-slate-950 p-2"
                      rows={2}
                    />
                  </div>
                ))}
                <label className="my-2 flex gap-2">
                  <input
                    type="checkbox"
                    checked={contextConfirmed}
                    onChange={(e) => setContextConfirmed(e.target.checked)}
                  />
                  I reviewed the complete factual assertion, entities, dates, locations and negation
                  against the selected passages. Partial or ambiguous matches remain neutral.
                </label>
                <textarea
                  aria-label="Analyst review rationale"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Explain applicability, context, and limitations (at least 20 characters)"
                  className="my-2 w-full rounded border border-slate-700 bg-slate-950 p-2"
                  rows={3}
                />
                <Button
                  disabled={
                    busy ||
                      ((result.retrievalDetails?.omittedCount || 0)>0 && result.sources.some(s=>(reviews[s.id || s.url] || 'neutral')!=='neutral')) ||
                    reviewNote.trim().length < 20 ||
                    result.sources.some(
                      (s) =>
                        (reviews[s.id || s.url] || "neutral") !== "neutral" &&
                        (!contextConfirmed ||
                          (quotes[s.id || s.url] || "").trim().length < 12 ||
                          !s.excerpt.includes((quotes[s.id || s.url] || "").trim())),
                    )
                  }
                  onClick={async () => {
                    try {
                      setBusy(true);
                      setResult(
                        await reviewClaim(
                          result,
                          result.sources.map((s) => ({
                            url: s.url,
                            sourceId: s.id,
                            stance: reviews[s.id || s.url] || "neutral",
                            quote: quotes[s.id || s.url] || "",
                            contextConfirmed,
                          })),
                          reviewNote,
                        ),
                      );
                      setSaved("");
                    } catch (e: any) {
                      setError(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Record evidence assessment
                </Button>
              </details>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
