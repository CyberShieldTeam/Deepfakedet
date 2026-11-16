/** Opt-in public API retrieval. No scraped pages, arbitrary URL fetching, LLM or truth inference. */
import { createHash } from "node:crypto";
import { sourceSchema, type RetrievedEvidence, type ProviderState } from "./claimSources";
import { claimTokens } from "./claimText";

export const WIKI_LIMITS = {
  bytes: 1024 * 1024,
  timeoutMs: 10000,
  results: 6,
  excerptCharacters: 2400,
  cacheEntries: 32,
  cacheMs: 60000,
  concurrency: 2,
};
const cache = new Map<
  string,
  { until: number; items: RetrievedEvidence[]; state: ProviderState }
>();
let active = 0;
const stop = new Set(
  "the a an is are was were has have had be been of in on at to for and that this it breaking please share".split(
    " ",
  ),
);
export function wikipediaQuery(claim: string) {
  // Tokens only: input cannot inject CirrusSearch regex/operators or an endpoint/URL.
  return claimTokens(claim)
    .filter((t) => !stop.has(t))
    .slice(0, 24)
    .join(" ")
    .slice(0, 500);
}
export function clearWikipediaCache() {
  cache.clear();
}
export async function wikipediaEvidence(
  claim: string,
  fetcher: typeof fetch = fetch,
): Promise<{ items: RetrievedEvidence[]; state: ProviderState }> {
  const state: ProviderState = {
    provider: "wikipedia",
    status: "unconfigured",
    retrieved: 0,
    detail: "Wikipedia API disabled; no request sent",
  };
  if (process.env.VERITAS_WIKIPEDIA_ENABLED !== "1") return { items: [], state };
  const language = process.env.VERITAS_WIKIPEDIA_LANGUAGE || "en",
    query = wikipediaQuery(claim);
  if (!["en", "hi", "te"].includes(language))
    return {
      items: [],
      state: {
        ...state,
        status: "unavailable",
        errorCategory: "INVALID_CONFIGURATION",
        detail: "Wikipedia edition must be en, hi or te; no request sent",
      },
    };
  if (!query)
    return {
      items: [],
      state: {
        ...state,
        status: "available",
        detail: "No searchable tokens; no request sent",
        query,
      },
    };
  const key = JSON.stringify([language, query]),
    now = Date.now(),
    old = cache.get(key);
  if (old && old.until > now)
    return structuredClone({
      items: old.items,
      state: {
        ...old.state,
        detail: old.state.detail + "; cached original retrieval timestamp retained",
      },
    });
  if (active >= WIKI_LIMITS.concurrency)
    return {
      items: [],
      state: {
        ...state,
        status: "unavailable",
        errorCategory: "PROVIDER_BUSY",
        detail: "Wikipedia concurrency budget busy; no request sent",
        query,
      },
    };
  active++;
  try {
    const host = language + ".wikipedia.org",
      url = new URL("https://" + host + "/w/api.php");
    const params = {
      action: "query",
      generator: "search",
      gsrsearch: query,
      gsrnamespace: "0",
      gsrlimit: String(WIKI_LIMITS.results),
      prop: "extracts|info|revisions",
      exintro: "1",
      explaintext: "1",
      exchars: String(WIKI_LIMITS.excerptCharacters),
      inprop: "url",
      rvprop: "ids|timestamp",
      meta: "siteinfo",
      siprop: "rightsinfo",
      format: "json",
      formatversion: "2",
      maxlag: "5",
    };
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const response = await fetcher(url, {
      redirect: "error",
      signal: AbortSignal.timeout(WIKI_LIMITS.timeoutMs),
      headers: {
        "User-Agent":
          "VERITAS-AI/0.1 (https://github.com/CyberShieldTeam/Deepfakedet; claim-evidence research)",
        Accept: "application/json",
      },
    });
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? "RATE_LIMIT"
          : response.status === 403
            ? "ACCESS_DENIED"
            : "UPSTREAM_HTTP",
      );
    if (response.url && new URL(response.url).origin !== url.origin)
      throw new Error("UNSAFE_REDIRECT");
    if (Number(response.headers.get("content-length")) > WIKI_LIMITS.bytes)
      throw new Error("BYTE_LIMIT");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("MISSING_BODY");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > WIKI_LIMITS.bytes) throw new Error("BYTE_LIMIT");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (data.error) throw new Error(data.error.code === "maxlag" ? "UPSTREAM_BUSY" : "API_ERROR");
    if (!data.query || (!Array.isArray(data.query.pages) && data.batchcomplete !== true))
      throw new Error("INVALID_SCHEMA");
    const pages = data.query.pages || [];
    if (pages.length > WIKI_LIMITS.results) throw new Error("RESULT_LIMIT");
    const rights = data.query.rightsinfo;
    if (
      typeof rights?.text !== "string" ||
      rights.text.length > 300 ||
      rights.url !== "https://creativecommons.org/licenses/by-sa/4.0/deed.en"
    )
      throw new Error("LICENSE_METADATA");
    const at = new Date().toISOString(),
      items: RetrievedEvidence[] = [];
    let omitted = 0;
    for (const page of pages) {
      const rev = page?.revisions?.[0];
      if (!page || typeof page !== "object") throw new Error("INVALID_PAGE");
      if (page.missing || !page.extract) {
        omitted++;
        continue;
      }
      if (
        typeof page.extract !== "string" ||
        page.extract.length > 10000 ||
        typeof page.title !== "string" ||
        !Number.isSafeInteger(page.pageid) ||
        page.pageid <= 0 ||
        !Number.isSafeInteger(rev?.revid) ||
        rev.revid <= 0 ||
        !Number.isFinite(Date.parse(rev.timestamp)) ||
        Date.parse(rev.timestamp) > Date.now()
      )
        throw new Error("INVALID_PAGE");
      const original = new URL(page.fullurl);
      if (
        original.origin !== url.origin ||
        !original.pathname.startsWith("/wiki/") ||
        original.username ||
        original.password
      )
        throw new Error("UNSAFE_ATTRIBUTION");
      const excerpt = page.extract.trim().slice(0, WIKI_LIMITS.excerptCharacters),
        revisionUrl = "https://" + host + "/w/index.php?oldid=" + rev.revid;
      items.push(
        sourceSchema.parse({
          title: page.title,
          url: original.href,
          originalUrl: original.href,
          excerpt,
          retrievedAt: at,
          publisher: "Wikipedia contributors",
          language,
          provider: "wikipedia",
          sourceType: "encyclopedia_excerpt",
          retrievalMethod: "MediaWiki Action API search + TextExtracts lead",
          locator: `Lead extract; page ${page.pageid}; reported revision ${rev.revid}`,
          revisionId: rev.revid,
          revisionUrl,
          modifiedAt: rev.timestamp,
          passageSha256: createHash("sha256").update(excerpt).digest("hex"),
          license: rights.text,
          licenseUrl: rights.url,
          sourceLimitations: [
            "Collaboratively edited encyclopedia; relevance is not credibility or factual truth.",
            "Lead extract only, not complete article. No automatic translation or stance inference.",
            "Edition language is publisher metadata, not detected language. Revision time is not first publication.",
            "Extract and reported current revision are API observations, not an atomic revision-pinned text fetch. SHA-256 identifies the exact retained passage.",
          ],
        }),
      );
    }
    const result = {
      items,
      state: {
        ...state,
        status: "available" as const,
        retrieved: items.length,
        query,
        hasMoreResults: !!data.continue,
        detail: `Wikipedia ${language}: ${items.length} real lead extracts; ${omitted} empty/missing pages omitted; top ${WIKI_LIMITS.results} candidates only, search is not exhaustive. ${data.continue ? "Additional search results were not fetched. " : ""}No automatic stance or truth inferred.`,
      },
    };
    for (const [k, v] of cache) if (v.until <= now) cache.delete(k);
    if (cache.size >= WIKI_LIMITS.cacheEntries) cache.delete(cache.keys().next().value!);
    cache.set(key, { ...structuredClone(result), until: now + WIKI_LIMITS.cacheMs });
    return result;
  } catch (error) {
    const code = error instanceof Error ? error.message : "PROVIDER_FAILURE";
    const category = [
      "RATE_LIMIT",
      "ACCESS_DENIED",
      "UPSTREAM_HTTP",
      "UPSTREAM_BUSY",
      "BYTE_LIMIT",
      "RESULT_LIMIT",
      "LICENSE_METADATA",
      "UNSAFE_REDIRECT",
      "UNSAFE_ATTRIBUTION",
    ].includes(code)
      ? code
      : error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)
        ? "TIMEOUT"
        : "INVALID_OR_FAILED_RESPONSE";
    return {
      items: [],
      state: {
        ...state,
        status: "unavailable",
        query,
        errorCategory: category,
        detail:
          "Wikipedia retrieval failed (" +
          category +
          "); no cached/fictional replacement or automatic retry",
      },
    };
  } finally {
    active--;
  }
}
