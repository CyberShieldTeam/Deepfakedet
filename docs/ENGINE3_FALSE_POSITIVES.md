# Engine 3 false-positive controls and error review

## Evidence status

No independently supported real-world false-positive/negative estimates exist. `reports/engine3_controls_v1.json` contains **14 authored software controls**, all passing their stated expectations. Zero automatic maliciousness flags in these controls is an abstention safeguard, not validated specificity. Confusion rates and confidence intervals remain null. The legacy path is retained for transparent comparison, including its existing suspicious-amplification behavior.

| Context | Expected descriptive behavior | Observed safeguard |
|---|---|---|
| A emergency/public health, including 1,000 simultaneous fictional shares | Retain shared content/time/URL observations | No maliciousness verdict; dense truncation disclosed and recurrence disabled |
| B scheduled organizational bulletins | Three separated bins can remain eligible for review | Six eligible account pairs in four-account authored case; malicious accounts zero |
| C breaking news/sports/syndication/independent shares | Single-event association | No eligible recurrence or maliciousness conclusion |
| D repeated organic discussion | Same observable pattern may recur | Six eligible pairs retained without converting common interests into intent |
| E repeated coordinated-looking pattern | Exact IDs, witness measurements and three separated bins | Six review-eligible pairs; classification abstains |
| F incomplete observation | Preserve observed associations/bins, disclose coverage | No recurrence eligibility |
| Popular URL with distinct topics | URL alone insufficient | No admitted associations in the small control |
| Duplicate precision conflict | Contradictory declarations survive deduplication | One-day uncertainty in either import order; recurrence disabled |

The six original single-event contexts plus short repeated official bulletins, popular URL, scheduled bulletins and separated pattern remain unchanged. Four additional controls cover repeated organic discussion, incomplete coverage, precision conflict and 1,000-share volume. Emergency volume here is 1,000; 3,000-post dense behavior is measured separately. The original ten-control historical report and frozen protocol remain untouched.

## Error-driven changes

**Precision hypothesis:** dropping a contradictory coarse declaration can unjustifiably enable recurrence. Before-fix audit reproduced one-second versus one-day uncertainty solely by reversing rows. Correction merges the widest uncertainty and retains all original source declarations. Regression compares stable evidence in both orders and verifies zero eligible pairs. Trade-off: a poorly documented import can conservatively suppress a real recurrence; resolve source uncertainty rather than silently select its most precise claim.

**Responsiveness hypothesis:** synchronous dense processing stalls other analysts' requests. Before-fix one-millisecond heartbeat delayed 1.87 seconds. Bounded worker isolation preserves results while health stays responsive; simultaneous requests return explicit busy status. This changes scheduling, not detection accuracy. Worker startup increases short-request latency (roughly half a second on this machine); parallel CPU jobs are deliberately refused.

## Remaining risks / next error analysis

Popular URLs, headlines, scheduled announcements and broad community participation can create graph communities and eligible recurrence. Missing contexts prevent maliciousness judgments. High-volume truncation can hide associations and disables even otherwise plausible recurrence. Shared text with negation retains high similarity. The actual cached E5 diagnostics show contradictory sentences scoring above some translations/paraphrases, so semantic admission remains disabled. These are observed similarity behaviors, not independently annotated campaign false positives.

Likely recall gaps include translations with no shared indexing key, sparse/delayed posts, missing URLs/tags, exact-URL variants, strict bin/precision requirements, incomplete exposure and capped posting lists. Without independent labels their frequency is unknown. Do not loosen thresholds to recover individual examples.

For each future independently adjudicated error, retain the campaign/source/split hash, annotation provenance, exact post/witness IDs, missingness, candidate/retention limits, lexical/URL/tag/time values, episode boundaries, clustering effects and legitimate alternatives. Group errors by cause and language/category before proposing a general correction. Freeze hypothesis and regression first, rerun baseline/development comparisons, review cross-category harm, and keep the final holdout sealed.

Reproduce software controls with `node --import tsx test/engine3/controls.ts reports/NEW_controls.json`. This command refuses existing output files; it never claims independent accuracy.
