# Engine 3 independent evaluation

## Current decision

**Zero independent datasets admitted.** `reports/engine3_independent_verified.json` records null precision, recall, F1, false-positive/negative rates and confidence intervals. Baseline and updated real-world metrics are unavailable. Earlier v1/final/release reports remain intermediate code-hash snapshots. No research posts were downloaded, hydrated, redistributed or committed. Existing fictional sample packs and software controls are excluded from independent evaluation.

## Candidate review (2026-11-16)

| Publisher and official record/download entry | Rights/access and evidence fields | Label fit and admission decision |
|---|---|---|
| Indiana University/USC OSOME, [Egypt_UAE release](https://zenodo.org/records/14189018) | Restricted academic access; CC BY-NC-ND 4.0; one file/researcher/day. Version metadata inspected; no access requested. Describes anonymized post/account IDs, times, text, language, tags, hashed URLs and IO/control flags. Record lists 1.6 GB download volume, not a verified file size. | Best IO-plus-comparison candidate. Platform IO membership and topic/time-matched controls do not establish pair-level, episode or maliciousness truth. Hashed URLs would need a documented equality adapter, not fabricated HTTP links. **Deferred**: access, intended-use/derivative review, label-scope audit and independent pair annotation. |
| X/Twitter [official IO disclosure](https://blog.x.com/en/company/info-ops-disclosure-data-september-2019), [expanded researcher access](https://blog.x.com/en/company/-expanding-access-beyond-information-operations-) | Official historical account/post archive descriptions. Current downloadable fields, access terms, retained original timestamps and redistribution permissions were not verified. No archive accessed. | Takedown membership is contextual campaign evidence, not every pair's coordination label. No independently adjudicated legitimate comparison pool verified. **Not admitted**. |
| Kochkina/Liakata/Zubiaga, [PHEME official API record v1](https://api.figshare.com/v2/articles/6392078), [download entry](https://figshare.com/articles/dataset/PHEME_dataset_for_Rumour_Detection_and_Veracity_Classification/6392078) | Public metadata lists ~46.5 MB archive and tweet/conversation IDs. Annotation license CC BY 4.0; tweet content retains Twitter rights. Raw timestamp/account coverage not inspected. Browser page returned 403; official API readable. | Rumour/veracity labels, not coordination or malicious intent. Non-rumour does not mean uncoordinated. **Rejected for current ground-truth task**; possible future contextual annotation source after content-rights review. |
| CrisisLex authors, [official collections](https://www.crisislex.org/data-collections.html) | CrisisLexT26 documents crisis informativeness/type/source labels and download links. Labelled CSV includes tweet IDs/text/labels; full account/time coverage and explicit applicable license were not verified. No file acquired. | Useful emergency context, but informativeness is not non-coordination evidence. **Not admitted**: task mismatch, field and rights gaps. |
| Zilius/Spiliotopoulos/van Moorsel, [bounty campaigns release v2](https://zenodo.org/records/7813450), [paper v3](https://arxiv.org/abs/2301.06601) | Open record lists 7.5 GB archive, 9.9 MB samples and supplementary documentation. Dataset license did not render in inspected rights section; paper availability does not grant dataset rights. No sample/archive downloaded. Forum events, participants and social URLs are described; social post text/time completeness not verified. | External bounty instructions may supply stronger independent coordination evidence. Legitimate negative labels and social post coverage are not established. **Deferred**, high-value alternative for bounded manual admission review. No inference that paid participation proves maliciousness. |

These decisions apply to inspected releases, not blanket judgments of the research. Unknown rights are not approval. No access forms or messages were submitted.

## Annotation protocol v1

Before collection, freeze source release, permitted use, privacy review, sampling frame, task definitions, annotation handbook and split allocation. Keep raw data outside Git under approved access controls. Record SHA256 of every local file and release manifest. An operator must review the rights registry; schema validation alone cannot establish rights or independence.

Two distinct annotators review source evidence **without Engine 3 predictions**. Resolve disagreement with an adjudicator; retain original decisions, rationale, agreement measure/denominator and uncertainty in a separate restricted annotation log. Include documentary provenance: campaign instructions, independently established control relationships, platform findings with explicit scope, or independently adjudicated legitimate participation. Similarity/timing alone are insufficient. Explicitly distinguish association, repeated episodes, coordination and malicious intent. Use `uncertain`/`unavailable` rather than forced negatives. Record emergency, scheduled, news, organic repeated, multilingual and incomplete-coverage strata. Do not label all possible within-campaign pairs positive or all controls negative.

Each campaign records ID, source/version, source group, translation group, split, language/category, file hash, supplied account/post IDs, original timestamps/precision, declared observation bounds, completeness/source, missing-data indicators, separate coordination/malicious-intent annotations, and reviewed account pairs. Each annotation has label, source, independent evidence, >=2 annotator identifiers, agreement and uncertainty. Record identities privately; expose pseudonyms in allowed manifests. Episode annotations require independently justified boundaries, a named protocol and a tolerance fixed before predictions; UTC conversion must preserve original precision. Missing posts/unknown exposure cannot establish negative recurrence.

Split at campaign/source lineage level, retaining translations together. Check duplicate hashes and shared accounts across train/development/test. Document cross-publisher identity aliases and time overlaps manually; the importer cannot discover unknown aliases/translations. Train content never tunes this fixed configuration. A final test release stays sealed until protocol/config/code are frozen; the development CLI refuses any manifest containing test files before opening those post files.

## Executable interface

Schemas are exported from `test/engine3/dataset.ts`: `manifestSchema` and `registrySchema`. The real registry `test/engine3/sources.json` is intentionally empty. Manifests contain `version:1`, `id`, `datasetVersion`, `independent:true`, `annotationProtocol`, fixed `config` (`episodes_v1`, 120-second window, minSamples 3, threshold 0.65), and `campaigns`. Each campaign has the metadata/annotations above, `postsFile` relative to the manifest directory, `sha256`, and `pairs`. Post files are JSON arrays in the normal campaign API format. Annotation labels are `positive|negative|uncertain|unavailable`. Reviewed pairs use `accounts:[id1,id2]`, `association`, optional `recurrence`, optional `episodes:[{start,end}]`, `episodeProtocol` and `episodeToleranceMs`. Registry sources require publisher/URL/version, rights/permission evidence, reviewer/date, local-research use, no redistribution, independent documentary/human adjudication method, and privacy review. The unit test constructs an explicitly fictional temporary schema example; it is never copied into the real registry.

```powershell
# No corpus: creates an explicit unavailable-metrics report, never invented labels.
npm run evaluate:engine3 -- reports/NEW_independent.json
# Only after manual admission; files remain outside Git:
npm run evaluate:engine3 -- reports/NEW_development.json C:/approved-data/manifest.json C:/approved-data/rights.json
npm run test:engine3
```

The importer rejects unreviewed sources, hashes/path escapes, invalid IDs/timestamps/pairs, duplicate campaign IDs, split leakage, missing source IDs, >3,000 posts/campaign, >30,000 total posts, >200 campaigns and oversized files. A valid registry is a human attestation, not proof that its claims are true.

## Tasks and statistical limits

**A association:** confusion counts and derived metrics apply only to explicitly reviewed pairs, never unlabelled pairs as negatives. Report reviewed/excluded counts and undefined denominators as null. These are conditional pool metrics, not population estimates. Truncated cases retain a report entry and withhold quality metrics.

**B recurrence/episodes:** recurrence confusion requires a separate independent recurrence label. Missing coverage or coarse/missing source IDs produces a separately counted recurrence abstention, never a true negative. Boundary comparison uses maximum-cardinality one-to-one matching of annotated and observed intervals under the prespecified tolerance; TP/FP/FN counts are reported only where annotations exist, with at most 100 annotated intervals/pair. Structural duplicate prevention, precision/coverage/truncation checks are software regressions, not episode detection accuracy.

**C campaign:** current engine abstains; coordination and maliciousness truth are stored separately. Report abstentions and zero decision coverage if a corpus is admitted. Recurrence eligibility is not promoted to a campaign verdict. Malicious-campaign accuracy remains unavailable.

Per-campaign language/category/coverage records support error review. Aggregate estimates and confidence intervals are withheld until there is a documented independent sampling frame and a preregistered source/campaign-group resampling protocol. Pair-wise binomial intervals would ignore dependence. No final-test threshold tuning is implemented or permitted.

## Semantic diagnostic experiment

`reports/engine3_semantic_v1_scores.json` compares actual Jaccard, pinned cached E5 query/query cosine and prespecified descriptive 50:50 hybrid scores on 11 authored pairs (English/Hindi/Telugu paraphrases, translations, legitimate repetition, contradictions and an unrelated example). No quality metrics are computed. E5 revision `614241f622f53c4eeff9890bdc4f31cfecc418b3`, 384 dimensions, single CPU thread; 65.21-second startup, 0.89-second batch inference, sampled tree peak 716 MiB. English–Hindi/Telugu translation cosines were 0.902/0.868 with zero lexical overlap, but contradictory examples scored 0.959–0.970 and the unrelated pair 0.840. Similarity is not agreement, coordination or intent. **Retain diagnostic-only behavior and lexical fallback.** Resource supervisor report: `reports/engine3_semantic_v1.json`; local-only verified model files, 180-second/2 GiB caps, no downloads.
