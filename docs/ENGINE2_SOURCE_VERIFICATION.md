# Source-grounded explanations and citation integrity

The new explanation is deterministic. It repeats the exact selected assertion, counts
attributed supporting/contradicting/mixed reviews and unreviewed passages, and links
exact retained quotations/previews. It introduces no external facts and calls no LLM.
An unreviewed preview is at most 600 exact source characters; cuts are explicitly
labelled. Abbreviation periods are not treated as complete explanations. Source text
remains untrusted, escaped text, never instructions to execute or a reason to promote
a verdict. Only existing exact-quote/context human review changes aggregate assessment.

Citation IDs `C1…C8` are local to one claim result and bind existing source IDs `E1…E8`,
actual canonical HTTPS URLs, titles and exact passage hashes. They are not global IDs.
Original URL, publisher, publication date if supplied, retrieval timestamp, provider,
revision locator/URL where available and source limitations remain in source records.
New results compute missing passage hashes for every provider, while preserving supplied
fingerprints (a mismatch blocks model execution). No date is invented: revision time
is not first publication, retrieval time is not event time. Google reviewed-claim
metadata remains distinct from article bodies and cannot receive a decisive review.

Signed owner-bound verification/review receipts include new summary/model observations.
Corrections recompute summary relationships and retain original review history. New
case records preserve the same citations and hashes through API, disk, Engine 4 source
node metadata and HTML report. Experimental relevance/NLI cannot create an authoritative
`SOURCE_ADDRESSES_CLAIM` edge. Existing investigations remain readable through additive
optional fields and a deterministic display fallback; they are not rewritten or rescored.
All actual browser runs use separate temporary case stores. Operator-store verification
checks byte identity without attaching a new result.

## Provider coverage

Currently integrated: optional approved corpus, optional Google Fact Check Tools and
opt-in Wikipedia lead API. No new Google key or private service credential was created.
Wikipedia is an encyclopedia, not an official fact-check authority. Its extract and
reported revision metadata are not an atomic revision-pinned text fetch; exact retained
SHA-256 remains the byte identity. See [existing citation setup](CLAIM_SOURCE_CITATIONS.md).

Authorized primary-source options investigated:

| Source | Official integration reference | Current implementation status |
| --- | --- | --- |
| NDMA SACHET alerts | [Official CAP/RSS subscription page](https://sachet.ndma.gov.in/CapFeed), [agency integration guide](https://sachet.ndma.gov.in/docs/Integration_Guide_For_Agencies.pdf) | Concrete next India-focused adapter; no claim of implemented live ingestion or redistribution permission |
| PIB announcements | [Official RSS page](https://www.pib.gov.in/ViewRss.aspx?lang=1&reg=1) | Feed availability identified; scope/reuse terms, language and article-body access still require review |
| US NWS alerts | [Official API documentation](https://www.weather.gov/documentation/services-web-API), [alerts service](https://www.weather.gov/documentation/services-web-alerts) | Documented public API option for US weather only; not India/event-general evidence |

Next adapter plan: fixed allowlisted publisher endpoint and credential configuration,
bounded verified-TLS fetch with redirects disabled, 10-second/1-MiB/finite-result limits,
no arbitrary user URL fetching, parser with external entities disabled, exact text/
publisher/identifier/location/event-time/expiry/correction fields, hashes and retrieval
timestamps. Preserve original language and distinguish alert text from linked article
content. Operator approval must identify permitted use before imported text enters the
existing ≤128-document hash-pinned approved corpus. Feed absence/expired alerts are not
evidence that an event did not happen. No source gets a truth bonus merely for its name.

The existing corpus adapter is the tested bridge: authored, explicitly labelled
conflicting-source fixtures exercise hash/rights-attestation validation, retrieval,
manual stance, correction history, graph and report. Live SACHET/PIB/NWS ingestion is
**planned**, not implemented or claimed tested. This avoids inventing access terms or
credentials and keeps the current task's measured reranking work reviewable.
