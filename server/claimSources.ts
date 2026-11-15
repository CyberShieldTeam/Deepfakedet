import { z } from "zod";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { isIP } from "node:net";

export function sourceUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    isIP(url.hostname.replace(/[\[\]]/g, "")) ||
    !url.hostname.includes(".") ||
    /(^|\.)(localhost|local|internal|test|invalid)$/i.test(url.hostname)
  )
    throw new Error("Public HTTPS attribution URL required");
  url.hash = "";
  for (const key of [...url.searchParams.keys()])
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.toString();
}
const date = z
  .string()
  .max(80)
  .refine((v) => Number.isFinite(Date.parse(v)), "Invalid date");
export const sourceSchema = z
  .object({
    title: z.string().trim().min(1).max(1000),
    url: z.string().max(3000).transform(sourceUrl),
    excerpt: z.string().trim().min(1).max(10000),
    publishDate: date.optional(),
    retrievedAt: z.string().datetime(),
    publisher: z.string().max(300).optional(),
    language: z.string().max(80).optional(),
    provider: z.enum(["operator_corpus", "google_fact_check", "software_test"]),
    license: z.string().min(1).max(1000).optional(),
    publisherRating: z.string().max(300).optional(),
  })
  .strict();
export type RetrievedEvidence = z.infer<typeof sourceSchema>;
export type ProviderState = {
  provider: string;
  status: "unconfigured" | "available" | "unavailable";
  retrieved: number;
  detail: string;
};
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export async function corpusEvidence(): Promise<{
  items: RetrievedEvidence[];
  state: ProviderState;
}> {
  const state: ProviderState = {
    provider: "operator_corpus",
    status: "unconfigured",
    retrieved: 0,
    detail: "No operator-approved corpus configured",
  };
  if (!process.env.VERITAS_CLAIM_CORPUS) return { items: [], state };
  try {
    const path = process.env.VERITAS_CLAIM_CORPUS;
    if ((await stat(path)).size > 1024 * 1024) throw new Error("Corpus byte limit");
    const bytes = await readFile(path);
    if (
      !/^[a-f0-9]{64}$/.test(process.env.VERITAS_CLAIM_CORPUS_SHA256 || "") ||
      hash(bytes) !== process.env.VERITAS_CLAIM_CORPUS_SHA256
    )
      throw new Error("Corpus hash mismatch");
    const corpus = z
      .object({
        schemaVersion: z.literal(1),
        id: z.string().min(1),
        license: z.string().min(1),
        approvalReference: z.string().min(1),
        approvedBy: z.string().min(1),
        approvedAt: z.string().datetime(),
        documents: z
          .array(
            sourceSchema.extend({
              provider: z.literal("operator_corpus"),
              license: z.string().min(1),
            }),
          )
          .max(128),
      })
      .strict()
      .parse(JSON.parse(bytes.toString("utf8")));
    if (
      Date.parse(corpus.approvedAt) > Date.now() ||
      corpus.documents.some((d) => Date.parse(d.retrievedAt) > Date.now())
    )
      throw new Error("Future provenance");
    return {
      items: corpus.documents,
      state: {
        ...state,
        status: "available",
        retrieved: corpus.documents.length,
        detail: `Operator corpus ${corpus.id}; SHA-256 ${hash(bytes)}; rights approval is operator attestation, not automated certification`,
      },
    };
  } catch {
    return {
      items: [],
      state: {
        ...state,
        status: "unavailable",
        detail: "Corpus failed hash, approval, bounds or provenance validation",
      },
    };
  }
}

export async function googleEvidence(
  claim: string,
  fetcher: typeof fetch = fetch,
): Promise<{ items: RetrievedEvidence[]; state: ProviderState }> {
  const state: ProviderState = {
    provider: "google_fact_check",
    status: "unconfigured",
    retrieved: 0,
    detail: "Google Fact Check Tools key not configured; no live retrieval attempted",
  };
  if (!process.env.GOOGLE_FACT_CHECK_API_KEY) return { items: [], state };
  try {
    const url = new URL("https://factchecktools.googleapis.com/v1alpha1/claims:search");
    url.searchParams.set("key", process.env.GOOGLE_FACT_CHECK_API_KEY);
    url.searchParams.set("query", claim);
    url.searchParams.set("pageSize", "10");
    const signal = AbortSignal.timeout(10000);
    const response = await fetcher(url, { signal, redirect: "error" });
    if (!response.ok || Number(response.headers.get("content-length")) > 1024 * 1024)
      throw new Error("Provider failure");
    // Bound streamed bytes, including providers omitting Content-Length.
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing body");
    const parts: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1024 * 1024) throw new Error("Provider byte limit");
        parts.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const payload = z
      .object({
        claims: z
          .array(
            z
              .object({
                text: z.string().max(10000),
                claimReview: z
                  .array(
                    z
                      .object({
                        title: z.string().max(1000).optional(),
                        url: z.string(),
                        reviewDate: z.string().optional(),
                        textualRating: z.string().max(300).optional(),
                        publisher: z
                          .object({
                            name: z.string().max(300).optional(),
                            site: z.string().optional(),
                          })
                          .optional(),
                        languageCode: z.string().max(80).optional(),
                      })
                      .passthrough(),
                  )
                  .max(20)
                  .optional(),
              })
              .passthrough(),
          )
          .max(10)
          .optional(),
      })
      .passthrough()
      .parse(JSON.parse(Buffer.concat(parts).toString("utf8")));
    const at = new Date().toISOString();
    const items: RetrievedEvidence[] = [];
    for (const c of payload.claims || [])
      for (const review of c.claimReview || []) {
        try {
          const parsed = sourceSchema.safeParse({
            title: review.title || c.text,
            url: review.url,
            excerpt: c.text,
            publishDate: review.reviewDate || undefined,
            retrievedAt: at,
            publisher: review.publisher?.name,
            publisherRating: review.textualRating,
            language: review.languageCode,
            provider: "google_fact_check",
          });
          if (parsed.success) items.push(parsed.data);
        } catch {
          /* Unsafe attribution link: never fetch or expose it. */
        }
      }
    return {
      items,
      state: {
        ...state,
        status: "available",
        retrieved: items.length,
        detail:
          "Publisher review metadata retrieved; article bodies not fetched; publisher ratings are not VERITAS verdicts",
      },
    };
  } catch {
    return {
      items: [],
      state: {
        ...state,
        status: "unavailable",
        detail: "Google Fact Check Tools failed, timed out or returned invalid metadata",
      },
    };
  }
}

export function deduplicateEvidence(items: RetrievedEvidence[]) {
  const seen = new Set<string>();
  const unique: RetrievedEvidence[] = [];
  for (const item of items) {
    const url = sourceUrl(item.url),
      digest = hash(item.excerpt.normalize("NFC").replace(/\s+/gu, " ").trim().toLowerCase());
    // Retain different passages from one URL and attribution/ratings from other publishers.
    const key = JSON.stringify([url, digest, item.provider, item.publisherRating || ""]);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...item, url });
  }
  return unique;
}
