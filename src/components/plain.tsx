/**
 * Plain-language presentation helpers for first-time, non-technical users.
 * They only *describe* results produced elsewhere — no detection logic lives here.
 */
import React from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, HelpCircle, Info, ShieldAlert, XCircle } from 'lucide-react';
import { ClaimVerificationResult, ForensicAnalysisResult } from '../types';

export const PageHeader: React.FC<{ title: string; subtitle: string; steps?: string[]; right?: React.ReactNode }> = ({ title, subtitle, steps, right }) => (
  <div className="flex flex-wrap items-start justify-between gap-4">
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-400">{subtitle}</p>
      {steps && (
        <ol className="mt-3 flex flex-wrap gap-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 py-1 pl-1 pr-3 text-xs text-slate-300">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 text-[11px] font-semibold text-cyan-300">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      )}
    </div>
    {right}
  </div>
);

/** Collapsible section for technical detail most users can skip. */
export const Details: React.FC<{ title?: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ title = 'Technical details', defaultOpen, children }) => (
  <details open={defaultOpen} className="group rounded-lg border border-slate-800 bg-slate-950/40">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200">
      <span className="flex items-center gap-1.5"><Info className="h-3.5 w-3.5" />{title}</span>
      <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
    </summary>
    <div className="space-y-4 border-t border-slate-800 px-3 py-3">{children}</div>
  </details>
);

const GLOSSARY: Record<string, string> = {
  ELA: 'Error Level Analysis: we re-save the image and highlight areas that change differently. Bright, isolated patches can mean part of the picture was edited.',
  C2PA: 'Content Credentials: a tag some cameras and AI tools embed in a file to say how it was made. Screenshots and messaging apps usually remove it.',
  EXIF: 'Hidden camera information stored in a photo (camera model, date). Often removed by social media, so its absence proves nothing.',
  grounding: 'The AI searched Google and cited real web pages for its answer.',
  coordination: 'How strongly a group of accounts appears to act together — posting the same text, the same link, or at the same moment.',
  confidence: 'How sure the system is about this particular result. It is deliberately capped, because no automated check is certain.'
};

/** Dotted-underline term that explains itself on hover / focus. */
export const Term: React.FC<{ k: keyof typeof GLOSSARY | string; children?: React.ReactNode }> = ({ k, children }) => (
  <span tabIndex={0} title={GLOSSARY[k]} className="cursor-help border-b border-dotted border-slate-500 outline-none focus:border-cyan-400">
    {children ?? k}
  </span>
);

type Tone = 'red' | 'orange' | 'amber' | 'green' | 'sky' | 'slate';
const TONE: Record<Tone, { box: string; icon: React.ElementType; text: string }> = {
  red: { box: 'border-rose-500/40 bg-rose-500/10', icon: XCircle, text: 'text-rose-200' },
  orange: { box: 'border-orange-500/40 bg-orange-500/10', icon: ShieldAlert, text: 'text-orange-200' },
  amber: { box: 'border-amber-500/40 bg-amber-500/10', icon: HelpCircle, text: 'text-amber-200' },
  green: { box: 'border-emerald-500/40 bg-emerald-500/10', icon: CheckCircle2, text: 'text-emerald-200' },
  sky: { box: 'border-sky-500/40 bg-sky-500/10', icon: Info, text: 'text-sky-200' },
  slate: { box: 'border-slate-600 bg-slate-800/40', icon: HelpCircle, text: 'text-slate-200' }
};

interface Plain { tone: Tone; headline: string; explain: string; advice?: string }

export const VerdictBanner: React.FC<Plain & { extra?: React.ReactNode }> = ({ tone, headline, explain, advice, extra }) => {
  const t = TONE[tone];
  const Icon = t.icon;
  return (
    <div className={`rounded-xl border p-4 ${t.box}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${t.text}`} />
        <div className="min-w-0">
          <div className={`text-lg font-semibold leading-snug ${t.text}`}>{headline}</div>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{explain}</p>
          {advice && <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-400"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /><span><b className="font-medium text-slate-300">What to do: </b>{advice}</span></p>}
          {extra}
        </div>
      </div>
    </div>
  );
};

const CHECK_SOURCE = 'Find the original source before sharing. Do not forward it as fact.';

/** Everyday-language reading of a media result. */
export function plainMedia(r: ForensicAnalysisResult): Plain {
  const kind = r.modality === 'image' ? 'image' : r.modality === 'video' ? 'video' : 'audio clip';
  const ai = r.aiGeneration;
  if (ai) {
    if (ai.verdict === 'likely') return { tone: 'red', headline: 'This image looks AI-generated', explain: 'Our checks found clear signs that this picture was made by an AI image tool rather than taken with a camera.', advice: CHECK_SOURCE };
    if (ai.verdict === 'possible') return { tone: 'orange', headline: 'This image might be AI-generated', explain: 'We found some warning signs of AI generation, but not enough to be sure.', advice: CHECK_SOURCE };
    if (ai.verdict === 'inconclusive') return { tone: 'amber', headline: "We can't tell if this image is real", explain: 'The checks disagreed or the evidence was too weak. That is common for compressed or forwarded images.', advice: 'Treat it with caution and look for the original photographer or an official source.' };
    if (r.manipulation?.verdict === 'likely' || r.manipulation?.verdict === 'possible')
      return { tone: 'orange', headline: 'This image may have been edited', explain: 'We found no signs of AI generation, but parts of the image may have been altered.', advice: CHECK_SOURCE };
    return { tone: 'green', headline: 'No signs of AI generation or editing found', explain: 'Nothing suspicious was detected. This is not a guarantee — some fakes leave no visible traces.', advice: 'If the claim attached to it is important, still confirm it with a trusted source.' };
  }
  switch (r.authenticity) {
    case 'likely_synthetic': return { tone: 'red', headline: `This ${kind} looks fake or manipulated`, explain: 'Our checks found strong warning signs of manipulation or synthetic (AI-made) content.', advice: CHECK_SOURCE };
    case 'suspicious_artifacts': return { tone: 'orange', headline: `This ${kind} has warning signs`, explain: 'Some parts look unusual, but this could also be caused by normal editing or compression.', advice: CHECK_SOURCE };
    case 'inconclusive': return { tone: 'amber', headline: `We can't tell if this ${kind} is real`, explain: 'The evidence was too weak to decide either way.', advice: 'Treat it with caution and look for the original source.' };
    default: return { tone: 'green', headline: `No warning signs found in this ${kind}`, explain: 'Nothing suspicious was detected. This is not a guarantee of authenticity.' };
  }
}

/** Results saved before the assessment field existed (demo/sample cases) are read from their verdict. */
export function claimAssessment(r: ClaimVerificationResult): NonNullable<ClaimVerificationResult['assessment']> {
  if (r.assessment) return r.assessment;
  return r.verdict === 'Supported' ? 'verified_true' : r.verdict === 'Contradicted' ? 'verified_false' : r.verdict === 'Mixed Evidence' ? 'verified_mixed' : 'unverified';
}

/** Everyday-language reading of a claim result. */
export function plainClaim(r: ClaimVerificationResult): Plain {
  const noSources = 'No news or official sources were checked — this is only the AI’s own knowledge.';
  switch (claimAssessment(r)) {
    case 'verified_true': return { tone: 'green', headline: 'True — confirmed by sources', explain: 'The sources listed below support this claim.' };
    case 'verified_false': return { tone: 'red', headline: 'False — contradicted by sources', explain: 'Reliable sources say this claim is not true.', advice: 'Do not share it. If you received it, let the sender know it is false.' };
    case 'verified_mixed': return { tone: 'amber', headline: 'Partly true — sources disagree', explain: 'Some sources support this claim and others contradict it.', advice: 'Read the sources below before deciding.' };
    case 'plausible': return { tone: 'sky', headline: 'Probably true, but not verified', explain: noSources, advice: 'Confirm with a trusted news or official source before relying on it.' };
    case 'implausible': return { tone: 'orange', headline: 'Probably false, but not verified', explain: noSources, advice: 'Do not share it until a trusted source confirms it.' };
    default:
      return r.engine === 'gemini'
        ? { tone: 'slate', headline: "We couldn't verify this claim", explain: 'There was not enough information to decide. This often happens with very recent or local events.', advice: 'Wait for an official update or a trusted news report.' }
        : { tone: 'slate', headline: "We couldn't verify this claim", explain: 'Only basic warning-sign screening was done, so the claim could not be confirmed either way.', advice: 'Check a trusted news or official source.' };
  }
}
