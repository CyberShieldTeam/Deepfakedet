# Real source retrieval and citation contract

## Enable a real, keyless source

Normal development/production opt-in, server-side `.env` (restart Express):

```dotenv
VERITAS_WIKIPEDIA_ENABLED=1
VERITAS_WIKIPEDIA_LANGUAGE=en
```

`en`, `hi`, `te` are the only accepted editions. English was live-tested; native Hindi
and Telugu retrieval quality was not evaluated. Edition choice is explicit, not inferred
from script and not translation. Queries leave the server for the configured public
Wikipedia API. Do not submit private claims without considering that disclosure.
No key, subscription, new ML checkpoint or scraping is required. Default is off;
the fictional demo forces it off. Access authentication and origin controls still apply.

The provider calls only fixed `https://{edition}.wikipedia.org/w/api.php` endpoints,
uses an identified User-Agent, rejects redirects and never fetches arbitrary source
URLs. Search namespace is articles only. It requests plain-text **lead extracts**,
canonical URLs, current revision metadata and publisher license metadata together.
Keyword tokens retain negation/numbers. Existing BM25 ranks and exact deduplication
remain unchanged; relevance never becomes stance or source credibility.

Limits: 10 seconds/request, 1 MiB streamed response, 6 candidates, 2,400 characters per
retained passage, 2 in-flight requests. In-memory cache: at most 32 query/edition entries,
60 seconds, original retrieval timestamp preserved. No error retries or fictional
fallback. Extra search pages are disclosed but not fetched. Search is not exhaustive.

## What travels with a source

Existing source IDs, URL, title, publisher, passage, retrieved time and optional publication
date remain compatible. Additive fields retain original URL, source type, method,
locator, source language, reported revision ID/link/time, SHA-256 of the exact retained
UTF-8 passage, license/link and limitations. Missing publication dates remain missing.
Article modification time is not first publication. Extracts and reported current
revisions are API observations, not an atomic revision-pinned text fetch. The retained
passage hash identifies exactly what the investigator saw, not the whole article.

Wikipedia contributors and actual CC BY-SA metadata are attributed, with canonical,
reported-revision and license links in evidence cards and exported HTML. This provider
is a collaboratively edited encyclopedia source, **not independent fact-check evidence
or an official emergency announcement**. Lead truncation may omit qualifying or
contradictory material. Opening the full source and checking context remains necessary.
Retention is not a certification that every embedded element has identical reuse terms.

Google Fact Check Tools preserves original article URLs and reviewed-claim metadata;
its article body is not fetched. Publisher ratings cannot produce a decisive review.
401/403 access failures and 429 rate/quota failures are separate safe diagnostics.
Only one page is requested (10 claim records); continuation is disclosed. API-default
query language behaviour is not a multilingual validation claim. Configure a legitimate
`GOOGLE_FACT_CHECK_API_KEY`, enabled service, restrictions and quota on the operator
account to validate Google live. No key was available here.

Operator corpus configuration still requires explicit rights/approval and a complete
file SHA-256; see [existing corpus/review contract](CLAIM_VERIFICATION.md).
No authored corpus is presented as real evidence in the new online flow.

## Conclusions and security

Initially every retrieved source is neutral and the claim unresolved, with null truth
confidence. An owner-bound server receipt, exact retrieved source ID/URL, exact quote,
context confirmation and attributed rationale are required for analyst review. Existing
eight-source omission safeguards, contradictory-passage handling, CSRF and case ownership
remain active. Review states describe an attributed assessment, not calibrated truth.

Source content is untrusted plain text, escaped in HTML and React. No retrieved text
executes instructions or supplies a model/tool command. Public HTTPS attribution URLs
are validated; private/local/IP URLs are rejected. No arbitrary linked-page fetching
was added. Signed source metadata survives storage, correlation references and reports.

Primary documentation: [MediaWiki Search](https://www.mediawiki.org/wiki/API:Search),
[TextExtracts](https://www.mediawiki.org/wiki/Extension:TextExtracts),
[API etiquette](https://www.mediawiki.org/wiki/API:Etiquette),
[Wikimedia reuse terms](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use),
[Google claims.search](https://developers.google.com/fact-check/tools/api/reference/rest/v1alpha1/claims/search).
