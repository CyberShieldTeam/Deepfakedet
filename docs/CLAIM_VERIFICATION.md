# Phase 3: auditable multilingual claim evidence — 2026-11-15

Implemented software, **scientific validation open**. Phase 2a–2d implementations,
reports and unresolved validation remain intact. No deepfake model or temporal threshold
was changed. Starting audit: `CLAIM_AUDIT.md`; baseline `dd6b1ca`, including `feb5d74`.

## Architecture and scope

The existing `/api/claims/verify`, `/api/claims/review`, owner-scoped investigations,
receipt signing, reports, optional embedding adapter and BM25 implementation are reused.
`server/evidence.ts` remains the compatible import boundary; implementation is modularized
into `claimText.ts`, `claimSources.ts` and `claimVerification.ts`.

1. Normalize Unicode NFC/whitespace without translating names or removing negation.
   Return original input, normalized assertion, up to eight sentence candidates, script
   diagnostics, exact entity-like Latin spans/numbers and explicit ambiguity warnings.
   This is sentence segmentation, not validated factual-assertion extraction or NER.
2. Retrieve in parallel from an optional approved local corpus and optional Google Fact
   Check Tools key. No claim-supplied URL is fetched. Unconfigured/available/unavailable
   providers are distinguished; failures and empty successful results differ.
3. Canonicalize public HTTPS attribution URLs, remove tracking parameters/fragments,
   deduplicate URLs and normalized identical passages. Rank at most eight candidates
   with Unicode BM25 and optional embedding cosine. Short words and negation remain.
   Ranking measures relevance, never source credibility or entailment. Credibility is
   explicitly unverified, rather than inferred from a publisher/domain name.
4. Return exact retrieved passages, source IDs, URLs, provider/publisher, available date
   metadata, retrieval times, publisher ratings, relevance scores and missing evidence.
   Automatic output always abstains. No fabricated confidence percentages or citations.
5. Optional authenticated analyst review requires a current owner-bound signed result,
   unique retrieved URLs, exact excerpt quotes >=12 characters for decisive stances,
   attribution, rationale >=20 characters and explicit assertion/entity/date/location/
   negation context confirmation. Quotes link to source IDs. Support plus contradiction,
   or a reviewed mixed passage, gives CONFLICTING_EVIDENCE. Neutral/partial applicability
   remains insufficient. This records human judgment; it does not independently prove it.

Google returns reviewed-claim metadata and publisher ratings; the adapter does **not**
fetch article bodies. Repeating a reviewed claim is not evidence for that claim, so Google
metadata alone cannot pass the decisive quote gate. Curate authorized underlying evidence
before review. The former Gemini free-form claim summary/subclaim override was removed:
claim explanations now use deterministic state descriptions and attributed review text.
Existing Gemini media functionality is preserved. No translation is silently substituted.

## API contract

`POST /api/claims/verify`: `{ "claimText": "a factual assertion" }`, 1–10,000 characters,
at least one letter/number, no extra fields. Authentication/CSRF/ownership protections
remain in force. Result retains legacy fields and adds:

- `normalizedClaim`, `claimAnalysis`, `missingEvidence`.
- `verificationStatus`: `SUPPORTED`, `CONTRADICTED`, `INSUFFICIENT_EVIDENCE`,
  `CONFLICTING_EVIDENCE`, `UNAVAILABLE`.
- `retrievalDetails`: provider statuses/counts, actual query, duplicates removed,
  semantic availability, elapsed milliseconds and current whole-Node-process RSS.
- Sources carry IDs, provider/publisher, quoted excerpt, dates, optional license and
  lexical/semantic relevance separately from `credibilityRating`.

UNAVAILABLE means no usable source and no available provider; an available empty corpus
or successful search with no relevant results gives INSUFFICIENT_EVIDENCE. Failed
providers are disclosed even when another provider succeeds. A numerical confidence is
always null. Source retrieval times refer to original corpus capture or API metadata
retrieval; corpus queries do not falsely claim a new web fetch.

`POST /api/claims/review`: `{result, reviews:[{url, stance, quote, contextConfirmed}], note}`.
Stances: supports/contradicts/mixed/neutral. The server rejects altered receipts, other
owners, invented/duplicate URLs, non-exact quotes and missing context confirmation.
Legacy verdict aliases remain supported for historical investigations; new canonical
status is explicit. Supporting/contradicting passages and human audit metadata persist
through signed case attachment and escaped HTML export. All modalities remain separate.

## Operator corpus and rights

Set `VERITAS_CLAIM_CORPUS` to a local JSON file and `VERITAS_CLAIM_CORPUS_SHA256` to its
complete SHA-256. No corpus is enabled by default. Limit 1 MiB, 128 documents. Schema:

```json
{
  "schemaVersion": 1,
  "id": "operator-reviewed-corpus-version",
  "license": "exact corpus terms",
  "approvalReference": "record of rights/source review",
  "approvedBy": "operator-id",
  "approvedAt": "2026-01-01T00:00:00.000Z",
  "documents": [{
    "title": "Source title",
    "url": "https://example.org/source",
    "excerpt": "Actual authorized captured passage",
    "retrievedAt": "2026-01-01T00:00:00.000Z",
    "provider": "operator_corpus",
    "license": "exact source permission"
  }]
}
```

Optional document fields: `publishDate`, `publisher`, `language`, `publisherRating`.
For Google results the legacy `publishDate` field carries the API's `reviewDate`;
the UI/export label it as a review date, not an independently verified article
publication date. Operator corpus publication dates are recorded only when known.
This example is a schema illustration, not an actual captured source. Do not treat
operator approval strings as automated legal or factual certification. Save actual
rights, capture and version evidence outside public commits; respect source licensing,
retention and redistribution terms. Unknown dates stay absent. Invalid hashes, future
capture/approval timestamps or incomplete provenance fail closed. Client-supplied
evidence/stances are not accepted by `/verify`.

`GOOGLE_FACT_CHECK_API_KEY` enables the existing official provider. Request/response
bounds: 10 claim records, <=20 reviews each, 1 MiB streamed body, 10-second request
deadline, redirects refused. Unsafe attribution URLs are excluded. No key was available
for this evaluation; live retrieval was **not** performed. Parser/error cases use mocks.
Official API reference: [claims.search](https://developers.google.com/fact-check/tools/api/reference/rest/v1alpha1/claims/search).
An API documentation license does not grant redistribution rights to third-party articles.

## Optional local multilingual embedding

Evaluated candidate: MIT-licensed `intfloat/multilingual-e5-small`, pinned revision
`614241f622f53c4eeff9890bdc4f31cfecc418b3`. Optional isolated server module:
`ai_service/claim_embedding.py`. It is separate from the existing media service and is
not started or downloaded by default. Pin/hash constants verify all six model/tokenizer
files against publisher Git/LFS hashes before loading. Safetensors only, offline local
files, no remote code, CPU thread one, eval/inference mode, masked mean pooling and L2
normalization. Prefixes `query: `/`passage: ` are required for every language. Batch eight,
max 512 tokens (long text truncates), <=128 texts/128,000 characters per call; concurrent
encoding returns busy. Preflight requires 2 GiB available RAM. Failed identity/shape,
resource or availability checks yield BM25 fallback. Preserve private network access;
bind the service to loopback or protect it behind the deployment's authenticated proxy.

After explicitly obtaining the pinned files in an ignored cache, PowerShell setup:

```powershell
$env:VERITAS_CLAIM_EMBEDDING_PATH='.model-cache/multilingual-e5-small'
.\.venv-win\Scripts\python.exe -m uvicorn ai_service.claim_embedding:app --host 127.0.0.1 --port 8021
# In the Express shell:
$env:VERITAS_EMBEDDING_ENDPOINT='http://127.0.0.1:8021/v1/embedding'
$env:VERITAS_EMBEDDING_MODEL_ID='intfloat/multilingual-e5-small'
$env:VERITAS_EMBEDDING_VERSION='614241f622f53c4eeff9890bdc4f31cfecc418b3'
$env:VERITAS_CLAIM_EMBEDDING_FORMAT='e5'
```

The [publisher model card](https://huggingface.co/intfloat/multilingual-e5-small) warns
of weaker low-resource-language performance. Publisher language coverage does not
validate Telugu retrieval or factual verification in VERITAS. No entailment, translation
or full Hindi/Telugu NER model is introduced. Cross-language fallback without embeddings
is lexical only; romanized/code-mixed language identification remains approximate.

## Reproducible software experiment and results

`test/fixtures/claims/retrieval_controls.json`: nine project-authored fictional passages
(three topics in English/Hindi/Telugu), nine predeclared relevance queries. Three
monolingual, three cross-language, three negation/date/location mismatch topic queries.
No external benchmark or reserved dataset was accessed; **zero independently labeled
factual claims** evaluated. Labels mean topic relevance, not agreement or truth.

Run `npx tsx test/evaluateClaims.ts reports/<new-name>.json` with an optional configured
embedding endpoint. It refuses overwrite and only reads the fixed authored fixture.
Raw report records input/code hashes, exact rankings/scores, model revision, query timing,
Node RSS, null factual/entailment accuracy and explicit limitations.

| Authored query category | BM25 top-1 relevance hits | Hybrid E5 + BM25 |
|---|---:|---:|
| Monolingual | 3/3 | 3/3 |
| Cross-language | 0/3 | 3/3 |
| Negation/date/location mismatch topic relevance | 3/3 | 3/3 |

This is a useful integration signal, not 100% verification accuracy or a representative
language benchmark. The mismatch examples intentionally demonstrate that relevance can
remain high while factual agreement fails. Neither similarity threshold nor 0.5/0.5
hybrid weights were fitted to these controls. No model is promoted to automatic verdicts.

Actual CPU run: embedding service startup **70.789 s** including validation/import/load;
peak process working set **744,275,968 bytes (709.8 MiB)**, final 741,081,088 bytes.
Hybrid query wall times **33.85–594.51 ms**, with cross-query document embeddings cached
by the existing owner/model/revision/text cache. Node RSS **92,893,184 bytes** at report
capture. Single run, no concurrency/p95/end-to-end SLA. Weights 470,641,600 bytes.
Environment: Python 3.13.12, torch 2.15.0, transformers 4.57.6; exact versions and raw
resources in `reports/claim_embedding_environment_v1.json` and
`reports/claim_embedding_runtime_v1.json`. Rankings: `reports/claim_retrieval_controls_v1.json`.

## Remaining validation milestone

Verification completed: Node/API suites (including multilingual/security/attribution/
missing-source/conflict/unsupported-claim/review/export tests), TypeScript and build
passed. Python **66 tests: 65 passed, one optional AASIST-weight skip**. Existing media,
provenance and temporal regressions remain. Browser: full development **nine passed,
two expected skips**; authenticated production **four passed** including multilingual
unavailability and forensic uploads; explicit fictional corpus review/case workflow
**one passed**, screenshot inspected. Production returned 401 without authentication
and served built assets. Servers stopped. Existing build chunk warning remains.
The initial Python TestClient import required an absent optional dependency; tests now
follow the repository's direct-function style and the complete suite passed without
dependency changes. These are software correctness checks, not an independent benchmark.

Acquire rights-cleared, independently labeled English/Hindi/Telugu evidence/query pairs,
with subject/topic/source/time-disjoint splits, exact entailment/conflict annotations,
source access and quoted passages. Freeze retrieval and abstention protocols; measure
retrieval recall/MRR and verification precision/abstention independently, including
translation/entity/negation/date/location stress cases and cold/warm resource tails.
No independent dataset, authorized live API key or validated entailment model is currently
available. Phase 3 is a partial evidence-engine implementation, not scientifically complete.
