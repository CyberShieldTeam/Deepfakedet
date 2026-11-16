import type { Express } from "express";
import { z } from "zod";
import type { Investigation } from "../src/types";
import { owner, validate } from "./security";
import { runExtraction, ExtractionError } from "./extractionRunner";
import { reviewExtraction, reviewedCandidate } from "./extraction";
import { verifyWithEvidence } from "./evidence";
const reference = z.string().min(1).max(200);
const selection = z
  .object({ candidateId: reference, revision: z.number().int().nonnegative() })
  .strict();
const review = selection
  .extend({
    state: z.enum(["accepted", "corrected", "rejected", "uncertain"]),
    reviewedText: z.string().max(10000).optional(),
    reason: z.string().trim().min(1).max(2000),
    sourceConfirmed: z.boolean(),
  })
  .strict();
const extract = z
  .object({
    mediaHash: z.string().regex(/^[a-f0-9]{64}$/),
    modality: z.enum(["image", "video", "audio"]),
    language: z.enum(["eng", "hin", "tel"]),
    mediaData: z.string().max(14_000_000),
  })
  .strict();
export function installExtractionRoutes(
  app: Express,
  find: (id: string) => Investigation | undefined,
  persist: () => void,
) {
  const changed = (inv: Investigation) => {
    inv.updatedAt = new Date().toISOString();
    if (inv.correlation) inv.correlationRun = { status: "stale", at: inv.updatedAt };
  };
  app.post("/api/investigations/:id/extract", validate(extract), async (req, res, next) => {
    const inv = find(String(req.params.id));
    if (!inv) return void res.status(404).json({ error: "Investigation not found" });
    if (inv.isSimulatedDemo)
      return void res.status(409).json({ error: "Use a live case for uploaded evidence." });
    const b = req.body;
    const media = inv.mediaFindings?.length
      ? inv.mediaFindings
      : inv.forensicResult
        ? [inv.forensicResult]
        : [];
    if (
      !media.some(
        (m) =>
          m.submittedMedia?.computedBy === "server" &&
          m.submittedMedia.sha256 === b.mediaHash &&
          m.modality === b.modality,
      )
    )
      return void res
        .status(409)
        .json({ error: "Attach the matching server-analyzed media to this case first." });
    const controller = new AbortController();
    const interrupted = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.on("close", interrupted);
    try {
      const result = await runExtraction(
        inv.id,
        b.mediaHash,
        b.mediaData,
        b.language,
        b.modality,
        controller.signal,
      );
      const current = find(inv.id);
      if (!current) return void res.status(404).json({ error: "Investigation not found" });
      const records = (current.extractions ??= []);
      const existing = records.find((r) => r.id === result.id);
      if (!existing) {
        if (records.length >= 20)
          throw new ExtractionError(
            "Extraction record limit reached (20); saved evidence preserved.",
            409,
          );
        records.push(result);
      }
      current.extractionRun = {
        state: result.state,
        at: new Date().toISOString(),
        sourceMediaHash: b.mediaHash,
        detail: existing
          ? "Existing extraction and review history retained."
          : "Extraction saved; candidate review required.",
      };
      changed(current);
      persist();
      res.json({ investigation: current, result: existing ?? result });
    } catch (error) {
      if (controller.signal.aborted || res.destroyed) return;
      const e =
        error instanceof ExtractionError
          ? error
          : new ExtractionError("Extraction failed; no new evidence acknowledged.");
      const current = find(inv.id);
      if (current && e.status !== 429) {
        current.extractionRun = {
          state: e.state,
          at: new Date().toISOString(),
          sourceMediaHash: b.mediaHash,
          errorCategory: e.state,
          detail: e.message,
        };
        try {
          persist();
        } catch (storage) {
          return next(storage);
        }
      }
      res.status(e.status).json({ error: e.message, state: e.state });
    } finally {
      res.off("close", interrupted);
    }
  });
  app.post(
    "/api/investigations/:id/extractions/:extractionId/review",
    validate(review),
    (req, res, next) => {
      const inv = find(String(req.params.id)),
        record = inv?.extractions?.find((r) => r.id === req.params.extractionId);
      if (!inv || !record) return void res.status(404).json({ error: "Extraction not found" });
      try {
        const b = req.body;
        reviewExtraction(
          record,
          b.candidateId,
          b.revision,
          b.state,
          b.reviewedText,
          b.reason,
          b.sourceConfirmed,
          owner(),
        );
        changed(inv);
      } catch (error) {
        return void res.status(409).json({ error: (error as Error).message });
      }
      try {
        persist();
        res.json({ investigation: inv });
      } catch (error) {
        next(error);
      }
    },
  );
  app.post(
    "/api/investigations/:id/extractions/:extractionId/investigate",
    validate(selection),
    async (req, res, next) => {
      const inv = find(String(req.params.id)),
        record = inv?.extractions?.find((r) => r.id === req.params.extractionId);
      if (!inv || !record) return void res.status(404).json({ error: "Extraction not found" });
      try {
        const { candidate, review } = reviewedCandidate(
          record,
          req.body.candidateId,
          req.body.revision,
        );
        const existing = inv.claimResults?.find(
          (c) =>
            c.extractionOrigin?.extractionId === record.id &&
            c.extractionOrigin.candidateId === candidate.id &&
            c.extractionOrigin.reviewRevision === review.revision,
        );
        if (existing) return void res.json({ investigation: inv, result: existing });
        const result = await verifyWithEvidence(review.reviewedText!);
        const current = find(inv.id),
          currentRecord = current?.extractions?.find((r) => r.id === record.id);
        if (!current || !currentRecord)
          return void res.status(404).json({ error: "Extraction not found" });
        const latest = reviewedCandidate(currentRecord, candidate.id, review.revision);
        if (latest.review.reviewedText !== review.reviewedText)
          throw new Error("Review changed; refresh before investigation");
        const duplicate = current.claimResults?.find(
          (c) =>
            c.extractionOrigin?.extractionId === record.id &&
            c.extractionOrigin.candidateId === candidate.id &&
            c.extractionOrigin.reviewRevision === review.revision,
        );
        if (duplicate) return void res.json({ investigation: current, result: duplicate });
        result.extractionOrigin = {
          extractionId: record.id,
          candidateId: candidate.id,
          reviewRevision: review.revision,
          mediaHash: record.sourceMediaHash,
          segmentId: candidate.segmentId,
          reviewedText: review.reviewedText!,
        };
        current.claimResults = [
          result,
          ...(current.claimResults?.length
            ? current.claimResults
            : current.claimResult
              ? [current.claimResult]
              : []),
        ];
        current.claimResult = result;
        changed(current);
        persist();
        res.json({ investigation: current, result });
      } catch (error) {
        if (error instanceof Error && /review|required|Candidate/i.test(error.message))
          return void res.status(409).json({ error: error.message });
        next(error);
      }
    },
  );
}
