import React, { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileAudio, FileImage, FileVideo, Loader2, ScanSearch, Upload } from "lucide-react";
import { DetectionAssessment, ForensicAnalysisResult, Investigation } from "../types";
import { analyzeMedia } from "../services/api";
import {
  analyzeAudio,
  analyzeImage,
  analyzeVideo,
  AudioSignals,
  ImageSignals,
  smallDataUrl,
  VideoSignals,
} from "../utils/mediaSignals";
import {
  AUTH_LABEL,
  Button,
  Card,
  Empty,
  EngineBadge,
  ErrorBox,
  Meter,
  RiskBadge,
  SimulatedBadge,
} from "./ui";
import { Details, PageHeader, plainMedia, Term, VerdictBanner } from "./plain";
import type { AttachFn } from "../App";
import {AnalysisStatus} from './AnalysisStatus';
import {mediaModelDetails} from '../mediaModelDetails';

const ACCEPT = ".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,.mp3,.wav,.m4a";
const modalityOf = (f: File): "image" | "video" | "audio" | null => {
  if (f.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(f.name)) return "image";
  if (f.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(f.name)) return "video";
  if (f.type.startsWith("audio/") || /\.(mp3|wav|m4a)$/i.test(f.name)) return "audio";
  return null;
};

export const ResultPanel: React.FC<{ r: ForensicAnalysisResult; onSeek?: (seconds:number)=>void }> = ({ r, onSeek }) => {
  const [label, cls] = AUTH_LABEL[r.authenticity] || AUTH_LABEL.inconclusive;
  const gemini = r.geminiMediaAssessment;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {r.isSimulated || r.engine === "simulated_demo" ? (
          <SimulatedBadge />
        ) : (
          <EngineBadge engine={r.engine} note={r.engineNote} />
        )}
        {r.riskLevel && (
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            Risk <RiskBadge level={r.riskLevel} />
          </span>
        )}
      </div>
      <VerdictBanner {...plainMedia(r)} />
      {gemini && <Card title="AI-assisted media assessment — not validated authenticity detection.">
        <div className="space-y-2 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-wide text-cyan-300">Status: {gemini.status.replaceAll("_", " ")}</p>
          <p>{gemini.explanation}</p>
          {gemini.observations.length > 0 && <><p className="font-medium text-slate-100">Gemini observations</p><ul className="list-disc space-y-1 pl-5">{gemini.observations.map((item, i) => <li key={i}>{item}</li>)}</ul></>}
          <p className="font-medium text-slate-100">Limitations</p><ul className="list-disc space-y-1 pl-5">{gemini.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul>
          {gemini.model && <p className="text-xs text-slate-500">Provider model: {gemini.model}</p>}
          <p className="text-xs text-amber-200">This separate visual assessment does not change the classifier verdict above.</p>
        </div>
      </Card>}
      <AnalysisStatus analysis={r.analysis}/>
      {(r.localImage||r.localAudio||r.localVideo) && <Details title="Research model and input details">
        <p>AI generation, manipulation, provenance and factual accuracy are separate questions. No validated media authenticity conclusion is available.</p>
        {[r.localImage,r.localImage?.face_manipulation,r.localAudio,...(r.localVideo?.frames.flatMap(f=>[f.image,f.image.face_manipulation])??[]),r.localVideo?.audioTrack?.evidence].filter(Boolean).filter((m,i,a)=>a.findIndex(x=>x?.model===m?.model)===i).map(m=>{const d=mediaModelDetails[m!.model];return <div key={m!.model} className="mt-2 break-all"><p>{m!.model} · {m!.revision}</p>{d&&<><p>{d.license} · {d.score}</p><p>{d.status}</p><a href={d.url} target="_blank" rel="noreferrer" className="text-cyan-300 underline">Official model documentation</a></>}</div>;})}
        {r.localImage?.inputTrace&&<><p className="break-all">Received image SHA-256: {r.localImage.inputTrace.sourceSha256}</p><p className="break-all">Model tensor SHA-256: {r.localImage.inputTrace.tensor?.sha256??'No model tensor produced'}</p><p>{r.localImage.inputTrace.conversion}</p></>}
        {r.localAudio?.inputTrace&&<><p>Audio decoded successfully; {r.localAudio.inputTrace.status.replaceAll('_',' ')}. Speech presence: not verified.</p><p className="break-all">Received audio SHA-256: {r.localAudio.inputTrace.sourceSha256}</p><p>{r.localAudio.inputTrace.skippedWindows.length} window(s) skipped by existing duration/silence rules.</p></>}
        {r.localVideo?.sourceSha256&&<p className="break-all">Original video SHA-256: {r.localVideo.sourceSha256}</p>}
        <p>Documentation links identify the model; they are not evidence about this upload. Alpha is discarded during publisher RGB conversion; hidden RGB may affect scores.</p>
      </Details>}
      {r.provenance?.declaresAIGenerated && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-sm text-amber-200">
          Unverified metadata hints at AI generation. This is not cryptographically verified C2PA
          provenance.
        </div>
      )}
      {r.inference && (
        <div className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-3 text-xs text-slate-400">
          <div className="mb-1 flex justify-between font-medium text-slate-200">
            <span>Dedicated classifier</span>
            <span
              className={r.inference.status === "available" ? "text-cyan-300" : "text-amber-300"}
            >
              {r.inference.status.toUpperCase()}
            </span>
          </div>
          <p>
            {r.inference.modelId} · {r.inference.version}
          </p>
          <p className="mt-1">{r.inference.calibration}</p>
          <p className="mt-2 text-slate-500">
            Training data: {r.inference.trainingData} · License: {r.inference.license}
          </p>
        </div>
      )}
      {r.imageDiagnostics && (
        <Card title="Image provenance and measured signals">
          <div className="space-y-2 text-xs text-slate-400">
            <p className="text-slate-200">Content Credentials: {{
              absent: "No embedded credentials found",
              valid_untrusted: "Signature and file binding valid; signer not trusted by this deployment",
              valid_trusted: "Validated under the configured signer trust policy",
              invalid: "Credential validation failed; this does not prove AI generation",
              unavailable: "Verification SDK unavailable",
              failed: "Credentials could not be verified",
            }[r.imageDiagnostics.c2pa.status]}</p>
            {r.imageDiagnostics.c2pa.signer && <p>Signer declaration: {r.imageDiagnostics.c2pa.signer}</p>}
            <p>AI-use disclosure in active credentials: {r.imageDiagnostics.c2pa.ai_disclosure.replaceAll("_", " ")}. A declaration is not independent proof.</p>
            <p>Camera metadata: {r.imageDiagnostics.metadata.exif_present ? "present, editable" : "absent; absence proves nothing"}.</p>
            {Object.entries(r.imageDiagnostics.metadata.fields).map(([key, value]) => <p key={key}>{key.replaceAll("_", " ")}: {value}</p>)}
            {r.imageDiagnostics.signals.status === "measured" && <p>
              High-frequency energy fraction: {r.imageDiagnostics.signals.high_frequency_energy_fraction?.toFixed(4)} ·
              noise residual standard deviation: {r.imageDiagnostics.signals.noise_residual_std?.toFixed(3)}.
              These measurements are not an AI score or a camera fingerprint.
            </p>}
            <p>{r.imageDiagnostics.note}</p>
            <p>{r.imageDiagnostics.c2pa.note}</p>
          </div>
        </Card>
      )}
      {r.localImage && (
        <Card title="Experimental local image screening">
          <div className="space-y-1 text-xs text-slate-400">
            <p>
              {r.localImage.model_status === "ready"
                ? `${r.localImage.model} · raw fake-class output ${r.localImage.fake_probability == null ? "n/a" : r.localImage.fake_probability.toFixed(3)}`
                : "Whole-image classifier unavailable"}
            </p>
            <p>{r.localImage.face_boxes.length} unverified YuNet face candidate(s).</p>
            <a className="text-cyan-300 underline" href="https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet" target="_blank" rel="noreferrer">YuNet 2023mar documentation · MIT · face-region detection only</a>
            {r.localImage.face_manipulation && <div>
              <p>Face classifier: {r.localImage.face_manipulation.status.replaceAll("_", " ")}</p>
              {r.localImage.face_manipulation.faces.map(face => <p key={face.face_index}>
                Face {face.face_index + 1}: raw fake-class output {face.raw_fake_score.toFixed(3)}
              </p>)}
              <p>{r.localImage.face_manipulation.note}</p>
            </div>}
            <p className="text-amber-300">Raw output is uncalibrated and was not used as a verdict.</p>
          </div>
        </Card>
      )}
      {r.localAudio && (
        <Card title="Experimental AASIST evidence">
          <div className="space-y-1 text-xs text-slate-400">
            <p>Model loaded: {r.localAudio.model} · revision {r.localAudio.revision}. {r.localAudio.segments.length?'Segment inference executed.':'No usable windows; no segment inference executed.'}</p>
            <a className="text-cyan-300 underline" href="https://github.com/clovaai/aasist" target="_blank" rel="noreferrer">Official AASIST documentation</a>
            {r.localAudio.segments.map((segment, index) => (
              <div key={index} className="font-mono">
                {segment.start_seconds.toFixed(1)}–{segment.end_seconds.toFixed(1)} s · raw spoof output {segment.raw_spoof_softmax.toFixed(3)}
              </div>
            ))}
            <p className="text-amber-300">Scores are uncalibrated; silence filtering did not verify speech presence.</p>
            <p>Trained for ASVspoof 2019 LA speech; independent VERITAS detection accuracy is not established. Model documentation is not evidence that this file is synthetic.</p>
          </div>
        </Card>
      )}
      {r.localVideo && (
        <Card title="Experimental local video evidence">
          <div className="space-y-1 text-xs text-slate-400">
            <p>{r.localVideo.frames.length} {r.localVideo.scope === "server_decoded_frames" ? "server-decoded" : "browser-sampled"} frame(s) screened.</p>
            {r.localVideo.faceContinuity && <p>{r.localVideo.faceContinuity.tracks.length} geometric face-candidate track(s); these do not verify identity or manipulation.</p>}
            {r.localVideo.frames.map((frame, index) => (
              <div key={index} className="font-mono">
                {frame.timestampSeconds.toFixed(1)} s · {frame.image.fake_probability == null ? "classifier unavailable" : `raw fake output ${frame.image.fake_probability.toFixed(3)}`} · {frame.image.face_boxes.length} face candidate(s)
                {frame.temporal?.status === 'measured' && <p>Adjacent-frame median flow {frame.temporal.medianFlowPixels?.toFixed(2)} px; round-trip error {frame.temporal.meanRoundTripErrorPixels?.toFixed(2)} px. Motion observations only.</p>}
              </div>
            ))}
            {r.localVideo.audioTrack && <p>Video audio: {r.localVideo.audioTrack.status.replaceAll("_", " ")}. {r.localVideo.audioTrack.note}</p>}
            {r.localVideo.audioTrack?.evidence?.segments.map((s,i)=><p key={i}>Audio {s.start_seconds.toFixed(2)}–{s.end_seconds.toFixed(2)} s · raw uncalibrated spoof output {s.raw_spoof_softmax.toFixed(3)}. Speech presence not verified.</p>)}
            <p className="text-amber-300">Frame and audio outputs remain separate and do not form a video verdict.</p>
          </div>
        </Card>
      )}
      {r.localVideo?.temporalDiagnostics && (
        <Card title="Temporal motion observations · not a deepfake verdict">
          <div className="space-y-2 text-xs text-slate-400">
            <p>{r.localVideo.temporalDiagnostics.status.replaceAll('_',' ')} · {r.localVideo.temporalDiagnostics.processedPairs} sampled comparisons.</p>
            <p>{r.localVideo.temporalDiagnostics.note}</p>
            <ol className="space-y-1" aria-label="Temporal observation intervals">
              {r.localVideo.temporalDiagnostics.intervals.map((interval,index)=>(
                <li key={index} className={interval.observation==='localized_change_candidate'?'border-l-4 border-amber-400 pl-2':'border-l-4 border-slate-600 pl-2'}>
                  <button type="button" onClick={()=>onSeek?.(interval.startSeconds)} disabled={!onSeek}
                    className="text-left underline underline-offset-2" aria-label={`Inspect video at ${interval.startSeconds.toFixed(2)} seconds`}>
                    {interval.startSeconds.toFixed(2)}–{interval.endSeconds.toFixed(2)} s: {interval.observation.replaceAll('_',' ')}
                  </button>
                  {interval.regions.map((b,j)=><p key={j}>Change region in {interval.analysisWidth}×{interval.analysisHeight} analysis: ({b.x}, {b.y}), {b.width}×{b.height} px. Occlusion or legitimate motion may explain it.</p>)}
                </li>
              ))}
            </ol>
          </div>
        </Card>
      )}
      {r.misleadingContext && (
        <div className="text-xs text-slate-400">
          <span className="text-slate-200">Misleading context: </span>not assessed.{" "}
          {r.misleadingContext.reason}
        </div>
      )}
      {!!r.sampledFrames?.length && (
        <Card title="Sampled-frame evidence · not a video-level probability">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {r.sampledFrames.map((frame, i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-slate-800">
                <img
                  src={frame.thumbnail}
                  alt={`Sampled frame ${i + 1}`}
                  className="aspect-video w-full object-cover"
                />
                <div className="p-2 text-[11px] text-slate-400">
                  {frame.timestamp === null
                    ? "Timestamp unavailable"
                    : `${frame.timestamp.toFixed(1)} s`}{" "}
                  ·{" "}
                  {frame.probability === null
                    ? frame.status
                    : `${Math.round(frame.probability * 100)}% model output`}
                  {frame.probability !== null && frame.probability >= 0.8 && (
                    <span className="block text-amber-300">Review this interval</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {!!r.audioSegments?.length && (
        <Card title="Audio segment classifier evidence">
          <div className="space-y-2">
            {r.audioSegments.map((segment, i) => (
              <div key={i} className="text-xs text-slate-400">
                <div className="mb-1 flex justify-between">
                  <span>
                    {segment.start.toFixed(1)}–{segment.end.toFixed(1)} s
                  </span>
                  <span>{Math.round(segment.probability * 100)}% model output</span>
                </div>
                <Meter value={segment.probability * 100} />
              </div>
            ))}
          </div>
        </Card>
      )}
      {r.aiGeneration || r.manipulation ? (
        <div className="grid gap-2 2xl:grid-cols-2">
          {r.aiGeneration && <AssessmentCard title="Was it made by AI?" a={r.aiGeneration} />}
          {r.manipulation && (
            <AssessmentCard title="Evidence of digital manipulation?" a={r.manipulation} />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="mb-1 text-slate-400">
              <Term k="confidence">How sure we are</Term>
            </div>
            <div className="mb-1 font-mono text-slate-200">
              {r.confidenceScore == null || (r.confidenceScore === 0 && r.aiGeneratedProbability == null) ? "Assessment unavailable" : `${r.confidenceScore}%`}
            </div>
            {r.confidenceScore != null && !(r.confidenceScore === 0 && r.aiGeneratedProbability == null) && <Meter value={r.confidenceScore} color="#22d3ee" />}
          </div>
          <div>
            <div className="mb-1 text-slate-400">Chance it is AI-made</div>
            {r.aiGeneratedProbability != null ? (
              <>
                <div className="mb-1 font-mono text-slate-200">{r.aiGeneratedProbability}%</div>
                <Meter value={r.aiGeneratedProbability} />
              </>
            ) : (
              <div className="text-[11px] text-slate-500">
                Needs the AI checker, which isn’t available for this result
              </div>
            )}
          </div>
        </div>
      )}
      {r.alternativeHypotheses?.length > 0 && (
        <Section
          title="Could there be an innocent explanation?"
          items={r.alternativeHypotheses.slice(0, 3)}
          tone="text-slate-300"
        />
      )}
      <Details title="Technical details (for experts)">
        <div>
          <div className={`text-sm font-semibold ${cls}`}>{label}</div>
          <p className="mt-1 text-xs text-slate-400">{r.headlineSummary}</p>
        </div>
        {r.engineNote && (
          <div className="rounded border border-slate-800 bg-slate-950/50 p-2 text-[11px] text-slate-400">
            {r.engineNote}
          </div>
        )}
        {r.aiGeneration && (
          <div className="text-[11px] text-slate-400">
            Overall <Term k="confidence">confidence</Term>:{" "}
            {r.confidenceScore == null || (r.confidenceScore === 0 && r.aiGeneratedProbability == null) ? "not estimated" : `${r.confidenceScore}%`}
          </div>
        )}
        {r.provenance && (
          <div className="text-[11px] text-slate-400">
            <span className="font-mono uppercase text-slate-500">
              <Term k="C2PA">Provenance</Term>:{" "}
            </span>
            {r.provenance.declaresAIGenerated ? (
              <span className="text-rose-300">
                metadata declares AI generation ({r.provenance.generatorHints.join(", ") || "C2PA"})
              </span>
            ) : r.provenance.c2paManifest ? (
              "C2PA Content Credentials present, no AI declaration"
            ) : (
              "no C2PA / AI provenance metadata (absence proves nothing — often stripped)"
            )}
          </div>
        )}
        <Section title="Technical findings" items={r.detailedFindings} />
        <Section title="Limitations" items={r.limitations} tone="text-slate-400" />
        {r.measurements && (
          <div>
            <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Measured signals (computed in your browser)
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[11px]">
              {Object.entries(r.measurements).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 border-b border-slate-800/50">
                  <span className="text-slate-500">{k}</span>
                  <span className="truncate text-slate-300">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Details>
    </div>
  );
};

const VERDICT_LABEL: Record<string, [string, string]> = {
  likely: ["Likely yes", "text-rose-300 border-rose-500/40 bg-rose-500/10"],
  possible: ["Maybe", "text-orange-300 border-orange-500/40 bg-orange-500/10"],
  inconclusive: ["Can't tell", "text-amber-300 border-amber-500/40 bg-amber-500/10"],
  no_indicators_found: [
    "No signs found",
    "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  ],
};

const AssessmentCard: React.FC<{ title: string; a: DetectionAssessment }> = ({ title, a }) => {
  const [label, cls] = VERDICT_LABEL[a.verdict];
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3 text-xs">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-200">{title}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
          {label}
        </span>
      </div>
      <div className="mb-1 flex justify-between text-[11px] text-slate-400">
        <span>Chance: {a.probability != null ? `${a.probability}%` : "n/a"}</span>
        <span>
          <Term k="confidence">Confidence</Term>:{" "}
          {a.confidence ? `${a.confidence}%` : "not validated"}
        </span>
      </div>
      {a.probability != null && <Meter value={a.probability} />}
      {a.indicators.length > 0 && (
        <div className="mt-2">
          <div className="text-[11px] text-slate-500">What we noticed:</div>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[12px] text-slate-300">
            {a.indicators.slice(0, 3).map((i, k) => (
              <li key={k}>{i.indicator}</li>
            ))}
          </ul>
        </div>
      )}
      {a.rationale && (
        <div className="mt-1.5 text-[11px] leading-snug text-slate-500">{a.rationale}</div>
      )}
      {a.samples && a.samples.length > 1 && (
        <div className="mt-1 text-[10px] text-slate-600">
          Separate checks scored: {a.samples.join("% · ")}%
        </div>
      )}
    </div>
  );
};

const Section: React.FC<{ title: string; items: string[]; tone?: string }> = ({
  title,
  items,
  tone = "text-slate-300",
}) =>
  items?.length ? (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-400">{title}</div>
      <ul className={`list-disc space-y-1 pl-4 text-xs ${tone}`}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  ) : null;

export const MediaLabView: React.FC<{
  attach: AttachFn;
  active: Investigation | null;
  onLiveAnalysis?: () => void;
}> = ({ attach, active, onLiveAnalysis }) => {
  const videoElement = useRef<HTMLVideoElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [modality, setModality] = useState<"image" | "video" | "audio" | null>(null);
  const [objUrl, setObjUrl] = useState("");
  const [img, setImg] = useState<ImageSignals | null>(null);
  const [vid, setVid] = useState<VideoSignals | null>(null);
  const [aud, setAud] = useState<AudioSignals | null>(null);
  const [view, setView] = useState<"original" | "ela" | "split">("original");
  const [split, setSplit] = useState(50);
  const [stage, setStage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ForensicAnalysisResult | null>(null);
  const [saved, setSaved] = useState("");
  const [drag, setDrag] = useState(false);
  const [demoIdx, setDemoIdx] = useState<number | null>(null);
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [geminiConsent, setGeminiConsent] = useState(false);

  const pick = (f: File) => {
    const m = modalityOf(f);
    if (!m) return setError(`Unsupported file type: ${f.name}`);
    if (f.size > 24 * 1024 * 1024)
      return setError("Upload limit is 24 MiB. Use a shorter clip or a smaller original file.");
    if (
      f.type &&
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "video/mp4",
        "video/quicktime",
        "video/webm",
        "audio/mpeg",
        "audio/wav",
        "audio/x-wav",
        "audio/mp4",
        "audio/webm",
        "audio/ogg",
      ].includes(f.type)
    )
      return setError(
        "Unsupported media format. Use JPEG, PNG, WebP, MP4, MOV, WebM, MP3, WAV or M4A.",
      );
    if (objUrl) URL.revokeObjectURL(objUrl);
    setFile(f);
    setModality(m);
    setGeminiConsent(false);
    setObjUrl(URL.createObjectURL(f));
    setImg(null);
    setVid(null);
    setAud(null);
    setResult(null);
    setError("");
    setSaved("");
    setView("original");
    setDemoIdx(null);
  };

  const run = async () => {
    if (!file || !modality) return;
    onLiveAnalysis?.();
    setBusy(true);
    setError("");
    setResult(null);
    setSaved("");
    try {
      let measurements: any,
        mediaData: string | undefined,
        originalImageData: string | undefined,
        keyframes: string[] | undefined,
        detailTiles: string[] | undefined,
        frameTimes: number[] | undefined,
        audioSegments: AudioSignals["segments"] | undefined;
      if (modality === "image") {
        setStage("Looking at the image…");
        const s = await analyzeImage(file);
        setImg(s);
        setView("ela");
        measurements = s.measurements;
        mediaData = s.previewDataUrl;
        if (s.measurements.analysisInput !== "original file bytes") {
          originalImageData = await smallDataUrl(file, 10 * 1024 * 1024);
          if (originalImageData && !originalImageData.startsWith("data:image/")) {
            const mime = /\.png$/i.test(file.name) ? "image/png" : /\.webp$/i.test(file.name) ? "image/webp" : "image/jpeg";
            originalImageData = originalImageData.replace(/^data:[^;]*;base64,/, `data:${mime};base64,`);
          }
        }
        detailTiles = s.detailTiles;
      } else if (modality === "video") {
        const s = await analyzeVideo(
          file,
          16,
          (p) => setStage(`Reading video frames… ${Math.round(p * 100)}%`),
          intervalSeconds,
        );
        setVid(s);
        measurements = s.measurements;
        keyframes = s.keyframes;
        frameTimes = s.frames.map((f) => f.t);
        mediaData = await smallDataUrl(file, 8 * 1024 * 1024);
      } else {
        setStage("Listening to the audio…");
        const s = await analyzeAudio(file);
        setAud(s);
        measurements = s.measurements;
        mediaData = await smallDataUrl(file);
        audioSegments = s.segments;
      }
      setStage("Running configured classifier and preserving measured evidence…");
      const extensionMime: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        mp4: "video/mp4",
        mov: "video/quicktime",
        webm: "video/webm",
        mp3: "audio/mpeg",
        wav: "audio/wav",
        m4a: "audio/mp4",
      };
      measurements.sourceSha256 = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setResult(
        await analyzeMedia({
          modality,
          geminiConsent: geminiConsent && (modality === "image" || modality === "video"),
          fileName: file.name,
          originalImageData,
          temporalIntervalSeconds: modality==='video' ? intervalSeconds : undefined,
          mimeType: file.type || extensionMime[file.name.split(".").pop()!.toLowerCase()],
          measurements,
          mediaData,
          keyframes,
          frameTimes,
          detailTiles,
          audioSegments,
        }),
      );
    } catch (e: any) {
      setError(e.message || "The check failed. Please try again.");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const save = async () => {
    if (!result) return;
    try {
      const inv = await attach("media", result, `Media analysis: ${result.fileName}`);
      setSaved(`Saved to ${inv.caseNumber}`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const demoFindings = active?.isSimulatedDemo ? active.mediaFindings || [] : [];
  const shown = demoIdx != null ? demoFindings[demoIdx] : result;

  return (
    <div className="space-y-4">
      {modality === "video" && (
        <label className="flex items-center gap-3 text-xs text-slate-400">
          Target frame interval{" "}
          <input
            aria-label="Video frame sampling interval in seconds"
            type="number"
            min="1"
            max="60"
            value={intervalSeconds}
            onChange={(e) =>
              setIntervalSeconds(Math.max(1, Math.min(60, Number(e.target.value) || 5)))
            }
            className="w-20 rounded border border-slate-700 bg-slate-900 p-2"
          />
          seconds · preview capped at 32 frames; temporal observations use up to 25 sample points. Actual gaps are reported.
        </label>
      )}
      <PageHeader
        title="Check a photo, video or audio"
        subtitle="Find out whether a picture, video or voice message was made by AI or edited. Your file is examined in your browser and, when available, by Google’s Gemini AI."
        steps={["Choose a file", "Press “Check this file”", "Read the result on the right"]}
      />

      {demoFindings.length > 0 && (
        <Card
          title={
            <span className="flex items-center gap-2">
              Demo files from the story · {active!.caseNumber} <SimulatedBadge />
            </span>
          }
          right={<span className="text-[11px] text-slate-500">Click one to see its result</span>}
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {demoFindings.map((f, i) => (
              <button
                key={i}
                onClick={() => setDemoIdx(i)}
                className={`rounded-lg border p-3 text-left text-xs transition ${demoIdx === i ? "border-fuchsia-500/60 bg-fuchsia-500/10" : "border-slate-800 hover:border-slate-600"}`}
              >
                <div className="flex items-center gap-1.5 font-mono text-slate-200">
                  {f.modality === "audio" ? (
                    <FileAudio className="h-3.5 w-3.5" />
                  ) : f.modality === "video" ? (
                    <FileVideo className="h-3.5 w-3.5" />
                  ) : (
                    <FileImage className="h-3.5 w-3.5" />
                  )}
                  {f.fileName}
                </div>
                <div className={`mt-1 text-sm ${AUTH_LABEL[f.authenticity][1]}`}>
                  {plainMedia(f).headline}
                </div>
                <div className="mt-1">
                  <RiskBadge level={f.riskLevel} />
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <Card title="1 · Choose a file">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                e.dataTransfer.files[0] && pick(e.dataTransfer.files[0]);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 text-center transition ${drag ? "border-cyan-400 bg-cyan-500/5" : "border-slate-700 hover:border-slate-500"}`}
            >
              <Upload className="h-7 w-7 text-cyan-400" />
              <div className="text-base text-slate-100">
                {file ? file.name : "Drag a file here, or click to choose one"}
              </div>
              <div className="text-xs text-slate-500">
                {file
                  ? `${modality} · ${(file.size / 1024 / 1024).toFixed(2)} MB — click to choose a different file`
                  : "Photos (JPG, PNG, WEBP) · Videos (MP4, MOV, WEBM) · Audio (MP3, WAV, M4A)"}
              </div>
              <input
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
              />
            </label>
            {(modality === "image" || modality === "video") && <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-slate-700 p-3 text-xs text-slate-300">
              <input type="checkbox" checked={geminiConsent} onChange={(e) => setGeminiConsent(e.target.checked)} className="mt-0.5 accent-cyan-400" />
              <span><b className="text-slate-100">Optional Gemini visual assessment (off by default).</b> If selected, the image or up to six sampled video frames from clips no longer than 30 seconds will be sent to Google Gemini for visual description. Video audio is not sent. This assessment is not validated authenticity detection.</span>
            </label>}
            <div className="mt-3 flex items-center gap-2">
              <Button
                onClick={run}
                disabled={!file}
                loading={busy}
                className="!px-4 !py-2 !text-sm"
              >
                <ScanSearch className="h-4 w-4" />
                Check this file
              </Button>
              {stage ? (
                <span className="text-xs text-cyan-300">{stage}</span>
              ) : (
                !file && <span className="text-xs text-slate-500">Choose a file first</span>
              )}
            </div>
            {error && (
              <div className="mt-3">
                <ErrorBox message={error} />
              </div>
            )}
          </Card>

          {modality === "image" && objUrl && (
            <Card
              title={img ? "Look closer (optional)" : "Your image"}
              right={
                img && (
                  <div className="flex gap-1">
                    {(
                      [
                        ["original", "Original"],
                        ["ela", "Edit heatmap"],
                        ["split", "Compare"],
                      ] as const
                    ).map(([v, l]) => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        className={`rounded-md px-2 py-0.5 text-[11px] ${view === v ? "bg-cyan-500/20 text-cyan-200" : "text-slate-500 hover:text-slate-300"}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                )
              }
            >
              <div className="relative mx-auto max-w-full overflow-hidden rounded-lg bg-black">
                <img src={objUrl} className="mx-auto max-h-[460px]" alt="evidence" />
                {busy && <div className="animate-scan-line" />}
                {img && view === "ela" && (
                  <img
                    src={img.elaDataUrl}
                    className="absolute inset-0 m-auto max-h-[460px]"
                    alt="ELA"
                  />
                )}
                {img && view === "split" && (
                  <div
                    className="absolute inset-0 m-auto"
                    style={{ clipPath: `inset(0 0 0 ${split}%)` }}
                  >
                    <img src={img.elaDataUrl} className="mx-auto max-h-[460px]" alt="ELA" />
                  </div>
                )}
              </div>
              {img && view === "split" && (
                <input
                  type="range"
                  value={split}
                  onChange={(e) => setSplit(+e.target.value)}
                  className="mt-2 w-full accent-cyan-400"
                />
              )}
              {img && (
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  The <Term k="ELA">edit heatmap</Term> shows how each part of the picture reacts to
                  being re-saved. A bright, isolated patch can mean that area was pasted in or
                  edited; an even texture is normal. It cannot tell whether an image was made by AI.
                </p>
              )}
              {img && (
                <p className="mt-1 font-mono text-[10px] text-slate-600">
                  ELA = |original − JPEG(q=0.90) re-encode| × 15
                </p>
              )}
            </Card>
          )}

          {modality === "video" && objUrl && (
            <Card title="Your video">
              <video ref={videoElement} src={objUrl} controls className="max-h-72 w-full rounded-lg bg-black" />
              {vid && (
                <>
                  <p className="mt-3 text-xs text-slate-400">
                    The line jumps when the picture changes suddenly between frames — a sign of a
                    cut or a spliced-in clip. Points above the red line are flagged.
                  </p>
                  <div className="mt-2 h-40">
                    <ResponsiveContainer>
                      <LineChart
                        data={vid.frames.map((f) => ({
                          t: f.t.toFixed(1),
                          z: f.z,
                          diff: Number(f.diff.toFixed(2)),
                        }))}
                      >
                        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                        <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 10 }} unit="s" />
                        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={28} />
                        <Tooltip
                          contentStyle={{
                            background: "#0b1220",
                            border: "1px solid #1e293b",
                            fontSize: 11,
                          }}
                        />
                        <ReferenceLine
                          y={3}
                          stroke="#f43f5e"
                          strokeDasharray="4 4"
                          label={{ value: "flag", fill: "#f43f5e", fontSize: 10 }}
                        />
                        <Line
                          dataKey="z"
                          name="sudden-change score"
                          stroke="#22d3ee"
                          dot={{ r: 2 }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                    {vid.frames.map((f, i) => (
                      <div
                        key={i}
                        className={`overflow-hidden rounded border ${f.z > 3 ? "border-rose-500" : "border-slate-800"}`}
                      >
                        <img src={f.thumb} className="w-full" alt={`frame ${i}`} />
                        <div
                          className={`px-1 text-[9px] font-mono ${f.z > 3 ? "text-rose-300" : "text-slate-500"}`}
                        >
                          {f.t.toFixed(1)}s z{f.z}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}

          {modality === "audio" && objUrl && (
            <Card title="Your audio">
              <audio src={objUrl} controls className="w-full" />
              {aud && <AudioCanvases s={aud} />}
            </Card>
          )}

          {!file && demoFindings.length === 0 && (
            <Empty
              icon={ScanSearch}
              title="No file chosen yet"
              hint="Choose a photo, video or audio file above to get started."
            />
          )}
        </div>

        <div className="xl:col-span-2">
          <Card
            title="2 · Result"
            right={
              result &&
              demoIdx == null && (
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
                <div className="text-sm text-cyan-200">{stage || "Checking…"}</div>
              </div>
            ) : shown ? (
              <ResultPanel r={shown} onSeek={objUrl && modality==='video' ? seconds=>{if(videoElement.current)videoElement.current.currentTime=seconds;} : undefined} />
            ) : (
              <Empty
                icon={ScanSearch}
                title="Your result will appear here"
                hint="Choose a file and press “Check this file”."
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

const AudioCanvases: React.FC<{ s: AudioSignals }> = ({ s }) => {
  const wave = useRef<HTMLCanvasElement>(null);
  const spec = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const w = wave.current!,
      ctx = w.getContext("2d")!;
    w.width = 900;
    w.height = 100;
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, 900, 100);
    const max = Math.max(...s.waveform, 1e-6);
    ctx.fillStyle = "#22d3ee";
    s.waveform.forEach((v, i) => {
      const h = (v / max) * 46;
      ctx.fillRect((i / s.waveform.length) * 900, 50 - h, 1.2, h * 2);
    });
    const c = spec.current!,
      sc = c.getContext("2d")!;
    const cols = s.spectrogram.length,
      rows = s.spectrogram[0]?.length || 1;
    c.width = Math.max(1, cols);
    c.height = 256;
    const im = sc.createImageData(c.width, 256);
    let lo = Infinity,
      hi = -Infinity;
    s.spectrogram.forEach((col) =>
      col.forEach((v) => {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }),
    );
    lo = Math.max(lo, hi - 90);
    for (let x = 0; x < cols; x++)
      for (let y = 0; y < 256; y++) {
        const v = (s.spectrogram[x][Math.floor(((255 - y) / 256) * rows)] - lo) / (hi - lo || 1);
        const k = (y * c.width + x) * 4,
          t = Math.max(0, Math.min(1, v));
        im.data[k] = 255 * Math.min(1, t * 2.2 - 0.6);
        im.data[k + 1] = 255 * Math.min(1, t * 1.6 - 0.1) * 0.85;
        im.data[k + 2] = 255 * Math.min(1, 0.35 + t);
        im.data[k + 3] = 255;
      }
    sc.putImageData(im, 0, 0);
  }, [s]);
  const nyq = s.sampleRate / 2;
  return (
    <div className="mt-3 space-y-2">
      <canvas ref={wave} className="h-20 w-full rounded" />
      <div className="relative">
        <canvas
          ref={spec}
          className="h-44 w-full rounded"
          style={{ imageRendering: "pixelated" }}
        />
        <div
          className="absolute left-1 right-0 border-t border-dashed border-rose-400/70"
          style={{ top: `${(1 - 8000 / nyq) * 100}%` }}
        >
          <span className="text-[9px] font-mono text-rose-300">8 kHz</span>
        </div>
        <span className="absolute right-1 top-0 text-[9px] font-mono text-slate-400">
          {(nyq / 1000).toFixed(1)} kHz
        </span>
      </div>
      <p className="text-xs leading-relaxed text-slate-400">
        Top: loudness over time. Bottom: which pitches are present (brighter = louder). Some AI
        voices have nothing above the dashed 8 kHz line — but so do phone calls and WhatsApp voice
        notes, so this alone proves nothing.
      </p>
    </div>
  );
};
