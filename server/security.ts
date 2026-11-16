import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Express, RequestHandler, ErrorRequestHandler } from "express";
import { z } from "zod";
import {engineForPath,failedDiagnostic,logAnalysis} from './analysisDiagnostics';

export const context = new AsyncLocalStorage<{ ownerId: string }>();
export const owner = () => context.getStore()?.ownerId || "local-analyst";
const text = (max = 500) => z.string().trim().min(1).max(max);
const risk = z.enum(["Informational", "Low", "Medium", "High", "Critical"]);
export const correlationInput=z.object({contexts:z.array(z.object({mediaId:text(200),claimId:text(200),kind:z.enum(['user_caption','user_description']),text:text(10000),rationale:text(2000),mediaUrl:z.string().url().max(3000).optional()}).strict()).max(32).optional()}).strict();
export const caseCreate = z
  .object({
    title: text(200),
    targetSubject: text().optional(),
    modality: z.enum(["image", "video", "audio", "text_claim", "social_dataset"]).optional(),
    description: z.string().max(10000).optional(),
    analyst: text(100).optional(),
    tags: z.array(text(80)).max(30).optional(),
    riskLevel: risk.optional(),
    isSimulatedDemo: z.boolean().optional(),
  })
  .strict();
export const casePatch = caseCreate
  .omit({ modality: true, isSimulatedDemo: true })
  .partial()
  .extend({
    notes: z.string().max(20000).optional(),
    status: z
      .enum(["In Progress", "Verified", "Suspicious", "Critical Flag", "Archived"])
      .optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "At least one editable field is required");
export const claimInput = z.object({ claimText: text(10000).refine(v=>/[\p{L}\p{N}]/u.test(v), 'A textual assertion is required') }).strict();
const dataUrl = z
  .string()
  .max(16 * 1024 * 1024)
  .regex(
    /^data:(image\/(jpeg|png|webp)|video\/(mp4|quicktime|webm)|audio\/(mpeg|wav|x-wav|mp4|webm|ogg));base64,[A-Za-z0-9+/]*={0,2}$/,
  );
export const mediaInput = z
  .object({
    modality: z.enum(["image", "video", "audio"]),
    fileName: text(255),
    mimeType: z.enum([
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
    ]),
    measurements: z.record(
      z.string().max(80),
      z.union([z.number().finite(), z.string().max(2000), z.boolean()]),
    ),
    mediaData: dataUrl.optional(),
    originalImageData: dataUrl.optional(),
    temporalIntervalSeconds: z.number().finite().min(.25).max(60).optional(),
    keyframes: z.array(dataUrl).max(48).optional(),
    frameTimes: z.array(z.number().finite().nonnegative()).max(48).optional(),
    detailTiles: z.array(dataUrl).max(4).optional(),
    audioSegments: z
      .array(
        z
          .object({ start: z.number().nonnegative(), end: z.number().positive(), data: dataUrl })
          .strict()
          .refine((s) => s.end > s.start && s.end - s.start <= 6),
      )
      .max(24)
      .optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!v.mimeType.startsWith(`${v.modality}/`))
      ctx.addIssue({ code: "custom", message: "MIME type and modality do not match" });
    if (v.mediaData && !v.mediaData.startsWith(`data:${v.modality}/`))
      ctx.addIssue({ code: "custom", message: "Media bytes and modality do not match" });
    if (
      [...(v.keyframes || []), ...(v.detailTiles || [])].some(
        (data) => !data.startsWith("data:image/"),
      )
    )
      ctx.addIssue({ code: "custom", message: "Frames and tiles must contain image data" });
    if (v.audioSegments?.length && v.modality !== "audio")
      ctx.addIssue({ code: "custom", message: "Audio segments require audio modality" });
    const inputs = [
      v.mediaData,
      v.originalImageData,
      ...(v.keyframes || []),
      ...(v.detailTiles || []),
      ...(v.audioSegments || []).map((s) => s.data),
    ].filter(Boolean) as string[];
    let bytes = 0;
    for (const input of inputs) {
      const [header, encoded] = input.split(",");
      const data = Buffer.from(encoded, "base64");
      bytes += data.length;
      const mime = header.slice(5).split(";")[0];
      const image = mime.startsWith("image/");
      const valid =
        mime === "image/jpeg"
          ? data[0] === 255 && data[1] === 216 && data[2] === 255
          : mime === "image/png"
            ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : mime === "image/webp"
              ? data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP"
              : mime.includes("wav")
                ? data.toString("ascii", 0, 4) === "RIFF" &&
                  data.toString("ascii", 8, 12) === "WAVE"
                : mime === "audio/ogg"
                  ? data.toString("ascii", 0, 4) === "OggS"
                  : mime === "audio/mp4"
                    ? data.toString("ascii", 4, 8) === "ftyp"
                    : mime === "audio/webm"
                      ? data.subarray(0, 4).toString("hex") === "1a45dfa3"
                : mime === "video/webm"
                  ? data.subarray(0, 4).toString("hex") === "1a45dfa3"
                  : mime === "video/mp4" || mime === "video/quicktime"
                    ? data.toString("ascii", 4, 8) === "ftyp"
                      : data.toString("ascii", 0, 3) === "ID3" ||
                        (data[0] === 255 && (data[1] & 224) === 224);
      if (!valid || (v.modality === "image" && !image))
        ctx.addIssue({
          code: "custom",
          message: "Media signature does not match its declared type",
        });
    }
    if (v.originalImageData && (v.modality !== "image" || !v.originalImageData.startsWith("data:image/") ||
        Buffer.from(v.originalImageData.split(",")[1], "base64").length > 10 * 1024 * 1024))
      ctx.addIssue({ code: "custom", message: "Original image evidence must be an image up to 10 MiB" });
    if (bytes > 24 * 1024 * 1024)
      ctx.addIssue({ code: "custom", message: "Combined decoded media exceeds 24 MiB" });
    if (v.modality === "image" && !v.mediaData)
      ctx.addIssue({ code: "custom", message: "Image data is required" });
    if (
      v.audioSegments?.some(
        (s, i) =>
          !s.data.startsWith("data:audio/wav;") || (i > 0 && s.start < v.audioSegments![i - 1].end),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Audio segments must be ordered, non-overlapping WAV data",
      });
  });
export const campaignInput = z
  .object({
    coverage:z.object({start:z.string().datetime({offset:true}),end:z.string().datetime({offset:true}),complete:z.boolean(),source:text(500)}).strict().refine(c=>Date.parse(c.start)<Date.parse(c.end)).optional(),
    datasetName: text(200).optional(),
    posts: z.array(z.record(z.string(), z.unknown())).min(2).max(3000).optional(),
    csv: text(2_000_000).optional(),
    isSimulated: z.boolean().optional(),
    config: z
      .object({
        algorithm:z.enum(['density_baseline_v1','episodes_v1']).optional(),
        windowSeconds: z.number().min(10).max(3600).optional(),
        minSamples: z.number().int().min(3).max(20).optional(),
        threshold: z.number().min(0.4).max(1).optional(),
        weights: z
          .object({
            text: z.number().nonnegative(),
            url: z.number().nonnegative(),
            temporal: z.number().nonnegative(),
            hashtag: z.number().nonnegative(),
            semantic: z.number().nonnegative(),
          })
          .strict()
            .refine((w) => {const total=Object.values(w).reduce((a,b)=>a+b,0);return Number.isFinite(total)&&total>0;})
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((v) => !!v.posts !== !!v.csv, "Provide posts or CSV, not both");
export const attachmentInput = z
  .object({
    kind: z.enum(["media", "claim", "campaign"]),
    result: z.record(z.string(), z.unknown()),
  })
  .strict();
export const validate =
  (schema: z.ZodType): RequestHandler =>
  (req, res, next) => {
    const started=performance.now();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const engine=engineForPath(req.originalUrl.split('?')[0]);
      const analysis=engine?failedDiagnostic(engine,'INVALID_INPUT',performance.now()-started,true):undefined;
      if(analysis)logAnalysis(analysis);
      return void res
        .status(400)
        .json({
          error: "Invalid request",
          ...(analysis?{analysis,processingComplete:false}:{}),
          issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        });
    }
    req.body = parsed.data;
    next();
  };

export function installSecurity(app: Express) {
  const production = process.env.NODE_ENV === "production";
  const users: Record<string, string> = JSON.parse(process.env.VERITAS_USERS || "{}");
  if (Object.entries(users).some(([token, id]) => token.length < 32 || !id.trim()))
    throw new Error(
      "VERITAS_USERS requires tokens of at least 32 characters mapped to nonempty owner IDs",
    );
  const sessions = new Map<string, { ownerId: string; expires: number }>();
  const limits = new Map<string, { count: number; until: number }>();
  app.disable("x-powered-by");
  app.use("/api", (req, res, next) => {
    const requestId = crypto.randomUUID();
    res.set({
      "X-Request-ID": requestId,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    });
    const start = Date.now();
    res.on("finish", () =>
      console.info(
        JSON.stringify({
          level: "info",
          requestId,
          method: req.method,
          route: req.route?.path || "/api",
          status: res.statusCode,
          durationMs: Date.now() - start,
        }),
      ),
    );
    if (
      req.method !== "GET" &&
      req.headers.origin &&
      req.headers.origin !== `${req.protocol}://${req.get("host")}`
    ) {
      // Figma preview's trusted public origin must be configured explicitly when proxied.
      if (req.headers.origin !== process.env.VERITAS_PUBLIC_ORIGIN)
        return void res.status(403).json({ error: "Cross-origin mutation rejected" });
    }
    if (req.method !== "GET") {
      const key = req.ip || "unknown",
        now = Date.now();
      if (limits.size > 10000) for (const [k, v] of limits) if (v.until < now) limits.delete(k);
      let bucket = limits.get(key);
      if (!bucket || bucket.until < now)
        limits.set(key, (bucket = { count: 0, until: now + 60000 }));
      if (++bucket.count > 40)
        return void res
          .status(429)
          .set("Retry-After", "60")
          .json({ error: "Request rate exceeded; retry in one minute" });
    }
    next();
  });
  app.post("/api/session", validate(z.object({ token: text(512) }).strict()), (req, res) => {
    const digest = (value: string) => crypto.createHash("sha256").update(value).digest();
    const match = Object.entries(users).find(([token]) =>
      crypto.timingSafeEqual(digest(token), digest(req.body.token)),
    );
    if (!match) return void res.status(401).json({ error: "Invalid analyst access token" });
    for (const [id, session] of sessions) if (session.expires < Date.now()) sessions.delete(id);
    const id = crypto.randomBytes(32).toString("hex");
    sessions.set(id, { ownerId: match[1], expires: Date.now() + 8 * 3600000 });
    res.cookie("veritas_session", id, {
      httpOnly: true,
      sameSite: "strict",
      secure: production,
      maxAge: 8 * 3600000,
      path: "/api",
    });
    res.json({ authenticated: true });
  });
  app.delete("/api/session", (req, res) => {
    const id = /(?:^|;\s*)veritas_session=([^;]+)/.exec(req.headers.cookie || "")?.[1];
    if (id) sessions.delete(id);
    res.clearCookie("veritas_session", { path: "/api" }).json({ authenticated: false });
  });
  app.use("/api", (req, res, next) => {
    const id = /(?:^|;\s*)veritas_session=([^;]+)/.exec(req.headers.cookie || "")?.[1];
    const session = id ? sessions.get(id) : undefined;
    const bearer = req.headers.authorization?.replace(/^Bearer /, "");
    const match = bearer
      ? Object.entries(users).find(([key]) =>
          crypto.timingSafeEqual(
            crypto.createHash("sha256").update(key).digest(),
            crypto.createHash("sha256").update(bearer).digest(),
          ),
        )
      : undefined;
    const ownerId = session && session.expires > Date.now() ? session.ownerId : match?.[1];
    if (req.path === "/health") return context.run({ ownerId: ownerId || "anonymous" }, next);
    if (ownerId) return context.run({ ownerId }, next);
    if (!production && !Object.keys(users).length)
      return context.run({ ownerId: "local-analyst" }, next);
    res.status(401).json({ error: "Analyst authentication required", code: "AUTH_REQUIRED" });
  });
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "request_failed",
      code: error.code || error.type || "INTERNAL",
    }),
  );
  if (res.headersSent) return;
  const status = error.type === "entity.too.large" ? 413 : error instanceof SyntaxError ? 400 : 500;
  const engine=engineForPath(req.originalUrl.split('?')[0]);
  const analysis=engine?failedDiagnostic(engine,status===400?'MALFORMED_JSON':status===413?'INPUT_LIMIT':'EXECUTION_FAILED',null,status<500):undefined;
  if(analysis)logAnalysis(analysis);
  res
    .status(status)
    .json({
      ...(analysis?{analysis,processingComplete:false}:{}),
      error:
        status === 413
          ? "Request exceeds upload limit"
          : status === 400
            ? "Invalid JSON body"
            : "Operation failed; no successful persistence was acknowledged",
    });
};
