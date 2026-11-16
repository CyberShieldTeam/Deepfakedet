# Engine 4.3 evaluation

## Status and scope

Independent screenshot CER/WER, held-out accuracy, confidence intervals, factual-assertion
precision/recall, reviewer agreement/time and analytical relationship accuracy are
**unavailable**. No new independent images or human-adjudicated observations were admitted.
Do not pool authored controls with the nine historical HierText line crops.

The new real-OCR workload contains **five original authored bitmaps, one related authored
family, five renderer-input references, all development; zero holdout**. Four English
strings and one mixed English/Hindi/Telugu source string were rendered locally. Language
labels describe authored input strings, not independent native-speaker verification of
glyph rendering or translation. Original pixels remain ignored; generator and hashes
are reproducible. Model-training overlap of real external data remains unknown.

## Bounded release workflow

Run from repository root with installed local dependencies/model; no downloader is called:

```powershell
.\.venv-win\Scripts\python.exe -m ai_service.create_engine43_controls
.\.venv-win\Scripts\python.exe -m ai_service.ocr_release freeze .model-cache/engine43-controls/release.json --output .model-cache/engine43-controls/plan.json
# Read the frozen jobs and invoke one job ID at a time:
.\.venv-win\Scripts\python.exe -m ai_service.ocr_release run .model-cache/engine43-controls/plan.json --job JOB_ID --directory .model-cache/engine43-controls/results
.\.venv-win\Scripts\python.exe -m ai_service.ocr_release aggregate .model-cache/engine43-controls/plan.json --directory .model-cache/engine43-controls/results --output fresh-report.json
```

The Python image-preparation service must be running and `VERITAS_AI_SERVICE_URL` set.
Use fresh output names; freeze/aggregate refuse to overwrite. The generator creates
software controls, not a screenshot acquisition workflow. Local Windows fonts are used;
no font binaries are redistributed.

`python -m ai_service.export_ocr_release_audit PLAN --output fresh-audit.json` validates
the freeze and exports configuration/source seals without local paths, image bytes,
transcripts or participant identities. Review the remaining provenance/IDs for rights
and privacy before sharing. The authored release's export is
`reports/engine43_authored_release_audit.json`; Node/Python/Pillow versions and exact
runtime/model hashes are recorded there. Private plans and packets stay ignored.

Legacy schema 2 retains <=50 observations, <=8 profiles, <=100 passes. Schema 3 adds
explicitly approved releases of <=500 observations, <=8 profiles, <=1,000 total development
passes, <=8 MiB manifest and <=512 MiB original bytes. Each deterministic job is <=50
observations and one profile (therefore <=50 passes, within the existing 100-pass cap).
One command runs one job; no automatic unbounded scheduler. Existing per-image 10 MiB,
24M-pixel, preprocessing/output, worker deadlines and application busy guards are unchanged.

Connected source/family/lineage components never cross splits or batches. A component
over 50 is rejected rather than divided to evade the cap. Unique IDs and byte hashes,
cross-split 8x8 average-hash distance <=4 screening and source hashes are checked before
evaluation. A perceptual screen is conservative, not proof of uniqueness; ambiguous
cases require manual lineage review before a new freeze.

Frozen plans seal the exact manifest bytes, split metadata, jobs, model SHA/revision,
lockfile and relevant runtime/evaluation source hashes plus Python/Pillow versions.
Changing annotations, data, code or configuration invalidates resume. Baseline jobs must
all have recorded results before alternatives run. Failed baseline results are retained,
not repeatedly retried until successful. Holdout rows can be sealed but **no holdout OCR
jobs are produced**; final opening requires a separately reviewed/versioned protocol.
This is a development tool and holdout lock, not an implemented final-test evaluator.

An exclusive run lock prevents simultaneous writes. Each observation is journalled with
source/reference/configuration identity and a checksum. Resume reuses only validated
records. A hard crash may leave a stale lock or incomplete exclusive-written record;
the next run fails closed. Verify the process is gone and preserve the failed journal
before operator recovery in a fresh directory. Checksums detect accidental changes;
they are not signatures against a malicious operator who can rewrite the whole release.

Aggregation reconstructs every expected observation/profile pair. Missing records are
explicit `MISSING`; unexpected/duplicate result filenames fail. Failure accounting scores
FAILED/UNAVAILABLE/MISSING as empty while separately reporting coverage and operational
states. Conditional-success metrics cannot be reported alone. PARTIAL retains its text
and disclosure. No-text references have separate counts and failures cannot count as
correct no-text. Pending references remain unscored with all state counts retained.

Exact NFC Levenshtein uses tested Myers bit vectors, unit edit costs, code-point CER and
whitespace-word WER; case/punctuation remain. Only terminal OCR newlines are removed.
The old evaluator adds failure accounting without removing its legacy conditional fields.
Scores group by source language, quality, source category and annotation status; the
source metadata audit retains rotation, resolution, density and provenance. Unsupported
categories stay absent.

## Actual authored workload

Artifact: `reports/engine43_authored_ocr_controls.json`. Ten actual OCR passes, five
baseline before five upscaled; no failures/unavailable/partial/missing or empty outputs.
Each profile: English 4/4 exact, mixed 0/1 exact. Across these five correlated controls:
CER 18/283 = **6.36%**, WER 2/42 = **4.76%**, exact 4/5 = **80%**, identical for both
profiles. Mixed-only CER 18/37 = 48.65%, WER 2/4 = 50%; **not native-script accuracy**.
The English-only scores are zero error on these easy authored strings, not a general
English performance claim. COMPLETE processing does not mean a correct transcription.

No rotation, blur, low-resolution, dense or no-text stratum was measured in this new
five-image workload; their independent metrics are unavailable. No confidence interval
is justified for one authored family. Existing regression fixtures cover engineering
behavior in other conditions, not independent screenshot accuracy.

Baseline job wall 7.966s; upscale job 8.072s. Sum of worker walls 7.941s/7.936s leaves
~25/136ms within-job overhead (not admission/scoring time). Resume reused 5/5 with zero
new passes in 10.5ms. Every CLI invocation revalidates the release, including image
admission; this overhead grows with release size. Report aggregation is independently
reconstructed from journals, not repeated-sample inflation.
