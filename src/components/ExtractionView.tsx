import React, { useState, useEffect } from "react";
import type { Investigation } from "../types";
import type {
  ExtractionCandidate,
  ExtractionRecord,
  ExtractionReviewState,
} from "../extractionTypes";
import { extractionRequest } from "../services/api";
import { Card, Button, ErrorBox } from "./ui";
import { ClaimResult } from "./ClaimView";
export function ExtractionView({
  investigation: inv,
  onChanged,
}: {
  investigation: Investigation;
  onChanged: () => Promise<Investigation[]>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [hash, setHash] = useState(""),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [language, setLanguage] = useState("eng");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const value = URL.createObjectURL(file);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  const media = inv.mediaFindings?.length
    ? inv.mediaFindings
    : inv.forensicResult
      ? [inv.forensicResult]
      : [];
  const selected = media.find(
    (m) => m.submittedMedia?.sha256 === hash && m.submittedMedia.computedBy === "server",
  );
  async function choose(f: File | undefined) {
    setFile(null);
    setHash("");
    setError("");
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError("Select an image up to 10 MiB.");
      return;
    }
    const digest = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
    setHash([...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, "0")).join(""));
    setFile(f);
  }
  async function run(action: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await extractionRequest(inv.id, action, body);
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }
  async function extract() {
    if (!file || !selected) return;
    setBusy(true);
    try {
      const mediaData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Image read failed"));
        reader.readAsDataURL(file);
      });
      await run("extract", { mediaHash: hash, modality: selected.modality, language, mediaData });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title="Extract and review image text">
      <div className="space-y-3 text-xs">
        <p>
          English image OCR proposes text for investigation. Human acceptance confirms what the
          source says, never whether it is true. Video, speech, Hindi and Telugu extraction are
          unavailable in this version. OCR runs locally; investigating reviewed text uses your
          configured Claim Intelligence retrieval providers.
        </p>
        <label className="block">
          Select the original image already saved to this case
          <input
            aria-label="Original image for extraction"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => void choose(e.target.files?.[0])}
          />
        </label>
        {file && !selected && (
          <p role="alert">
            This image does not match an attached server-computed media hash. Analyze and save the
            original image to this case first.
          </p>
        )}
        {url && selected && (
          <img
            src={url}
            alt="Original evidence for OCR review"
            className="max-h-80 max-w-full object-contain"
          />
        )}
        <label>
          Recognition language{" "}
          <select
            aria-label="OCR recognition language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="eng">English</option>
            <option value="hin">Hindi — unavailable</option>
            <option value="tel">Telugu — unavailable</option>
          </select>
        </label>
        <Button disabled={!selected || busy || inv.isSimulatedDemo} onClick={() => void extract()}>
          {busy ? "Processing extraction or review…" : "Extract image text"}
        </Button>
        {error && <ErrorBox message={error} />}
        {inv.extractionRun && (
          <p role="status">
            Last extraction: {inv.extractionRun.state} — {inv.extractionRun.detail}
          </p>
        )}
        {(inv.extractions ?? []).map((record) => (
          <section key={record.id} className="space-y-2 rounded border border-slate-700 p-3">
            <p>
              Processing: {record.state} · {record.method} · {record.geometry.width} ×{" "}
              {record.geometry.height} processing pixels
            </p>
            <p className="break-all">Source SHA-256: {record.sourceMediaHash}</p>
            <p>
              Saved {record.extractedAt}. Processing completion does not establish transcription
              accuracy; compare the text with the original image.
            </p>
            {["FAILED", "UNAVAILABLE"].includes(inv.extractionRun?.state ?? "") && (
              <p>Retained saved extraction from an earlier run.</p>
            )}
            <details>
              <summary>Original machine-extracted text and provenance</summary>
              <pre className="whitespace-pre-wrap">
                {record.originalText || "No text detected by this OCR configuration."}
              </pre>
              <p>{record.geometry.transformation}</p>
              {record.segments.map((s) => (
                <p key={s.id}>
                  {s.text} · box {JSON.stringify(s.bbox)} · word OCR confidence:{" "}
                  {s.words.map((w) => `${w.text}: ${w.confidence ?? "not provided"}`).join("; ")}{" "}
                  (not factual confidence)
                </p>
              ))}
              {record.limitations.map((l) => (
                <p key={l}>{l}</p>
              ))}
            </details>
            {record.candidates.map((candidate) => (
              <CandidateReview
                key={candidate.id}
                record={record}
                candidate={candidate}
                sourceAvailable={!!selected && hash === record.sourceMediaHash}
                busy={busy}
                run={run}
              />
            ))}
            {(inv.claimResults ?? [])
              .filter((c) => c.extractionOrigin?.extractionId === record.id)
              .map((result, index) => {
                const origin = result.extractionOrigin!,
                  review = record.candidates
                    .find((c) => c.id === origin.candidateId)
                    ?.reviews.at(-1);
                const current =
                  review?.revision === origin.reviewRevision &&
                  ["accepted", "corrected"].includes(review.state);
                return (
                  <details key={result.analysis?.id ?? index}>
                    <summary>
                      Claim Intelligence findings · review revision {origin.reviewRevision} ·{" "}
                      {current
                        ? "current reviewed extraction"
                        : "historical assessment; review changed"}
                    </summary>
                    <ClaimResult r={result} />
                  </details>
                );
              })}
          </section>
        ))}
      </div>
    </Card>
  );
}
function CandidateReview({
  record,
  candidate: c,
  sourceAvailable,
  busy,
  run,
}: {
  record: ExtractionRecord;
  candidate: ExtractionCandidate;
  sourceAvailable: boolean;
  busy: boolean;
  run: (action: string, body: unknown) => Promise<void>;
}) {
  const latest = c.reviews.at(-1),
    [state, setState] = useState<ExtractionReviewState>("accepted"),
    [text, setText] = useState(latest?.reviewedText ?? c.originalText),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const base = `extractions/${encodeURIComponent(record.id)}`;
  return (
    <div className="space-y-2 border-t border-slate-700 pt-3">
      <p>
        <strong>Machine candidate:</strong> {c.originalText}
      </p>
      <p>
        Category suggestion: {c.category} (unvalidated) · Review: {latest?.state ?? "pending"}
      </p>
      {latest?.reviewedText && <p>Human-reviewed text: {latest.reviewedText}</p>}
      <label>
        Review decision{" "}
        <select
          aria-label="Extraction review decision"
          value={state}
          onChange={(e) => setState(e.target.value as ExtractionReviewState)}
        >
          {["accepted", "corrected", "rejected", "uncertain"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      {state === "corrected" && (
        <label className="block">
          Corrected text
          <textarea
            aria-label="Corrected extraction text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="block w-full bg-slate-950"
          />
        </label>
      )}
      <label className="block">
        Review note
        <input
          aria-label="Extraction review note"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={2000}
          className="block w-full bg-slate-950"
        />
      </label>
      <label className="block">
        <input
          type="checkbox"
          disabled={!sourceAvailable}
          checked={confirmed && sourceAvailable}
          onChange={(e) => setConfirmed(e.target.checked)}
        />{" "}
        I inspected the displayed original and confirm this text represents it. This does not
        confirm factual truth.
      </label>
      {!sourceAvailable && (
        <p>Select the same original image above to inspect it before accepting or correcting.</p>
      )}
      <Button
        disabled={
          busy ||
          !reason.trim() ||
          (["accepted", "corrected"].includes(state) && (!confirmed || !sourceAvailable))
        }
        onClick={() =>
          void run(`${base}/review`, {
            candidateId: c.id,
            revision: latest?.revision ?? 0,
            state,
            reviewedText: state === "corrected" ? text : undefined,
            reason,
            sourceConfirmed: confirmed && sourceAvailable,
          })
        }
      >
        Save extraction review
      </Button>
      <Button
        disabled={busy || !latest || !["accepted", "corrected"].includes(latest.state)}
        onClick={() =>
          void run(`${base}/investigate`, { candidateId: c.id, revision: latest?.revision })
        }
      >
        Investigate reviewed text
      </Button>
      <details>
        <summary>Review history ({c.reviews.length})</summary>
        {c.reviews.map((r) => (
          <p key={r.revision}>
            Revision {r.revision} · {r.state} · {r.reviewedBy} · {r.reviewedAt} · {r.reviewedText} ·{" "}
            {r.reason}
          </p>
        ))}
      </details>
    </div>
  );
}
