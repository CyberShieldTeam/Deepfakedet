# Phase 2a image evaluation protocol

The runner `ai_service/evaluate_image.py` measures raw whole-image classifier outputs from
the existing Python service. Face manipulation requires a separate task, dataset, and model.
No evaluation command enables deployment verdicts or modifies model thresholds.

## Manifest

Place a UTF-8 JSON manifest beside the images (subdirectories are supported):

```json
{
  "task": "general_ai_generated_image",
  "samples": [
    {
      "id": "camera-001",
      "path": "images/camera-001.jpg",
      "sha256": "REPLACE_WITH_ACTUAL_FILE_SHA256",
      "source": "Original attributable source URL or dataset record",
      "license": "Verified permission or license",
      "group": "source-or-identity-group-001",
      "split": "test",
      "label": "genuine",
      "domain": "phone-camera"
    }
  ]
}
```

Labels are `genuine` or `synthetic`; splits are `calibration` or `test`. Source/identity
groups cannot cross splits. Duplicate IDs/content hashes and changed image bytes fail
validation before inference. Related crops, recompressions, and frames must share a group.
Keep the held-out test set independent of model selection and threshold fitting.
The runner checks manifest consistency; source truth, license, training-set overlap, and
group correctness still require dataset review.

Include both classes, multiple camera devices, generators, resolutions, and compression
conditions. Report per-domain coverage, false positives, failures, and latency separately.
The existing five fixtures are transport/regression smoke data, not representative evaluation.
This repository does not yet ship an independently curated held-out benchmark.

## Run

Start the configured Python image service with its pinned checkpoint. Then run:

```powershell
python -m ai_service.evaluate_image path/to/manifest.json --endpoint http://127.0.0.1:8001 --threshold 0.5
```

The JSON report includes model ID/revision, manifest and image hashes, per-sample raw
scores, failure counts, split/domain confusion counts, false-positive rates, recall, and
tie-corrected AUROC. Missing classes produce null rates/AUROC rather than invented values.
The threshold is predeclared for diagnostic reporting; do not tune it using test results.
Missing/invalid scores produce a nonzero exit (2); model identity changes abort the run.
No calibration fitting, benchmark confidence intervals, or promotion gate is implemented yet.

## Current checkpoint

The Express image adapter now rejects any non-inconclusive classification from this
experimental service; its result mapper also always abstains. High raw values cannot bypass
the quarantine. The runner's metric/manifest tests use synthetic scores and temporary bytes;
these are software tests and do not measure detector accuracy.
