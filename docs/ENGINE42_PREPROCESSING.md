# Engine 4.2 preprocessing experiments

Default baseline is unchanged: EXIF transpose, RGB, aspect-preserving thumbnail ≤1600px,
PSM.AUTO, fixed English model. Frozen-4.1 bitmap-hash checks pass across eight EXIF
orientations. One selected profile performs **one OCR pass**; no multi-pass ranking,
word-count heuristic, automatic acceptance or confidence-based truth inference.

| Alternative | Hypothesis / applicable input | Measurement and decision |
|---|---|---|
| Explicit quarter-turns | Analyst sees sideways/upside-down text without suitable EXIF | 270° CCW recovered the authored 90° CCW text; other rotations can harm unrelated inputs. Expose explicit rotations with immutable provenance; no automatic angle guess. |
| Up to 2× scaling | Small printed text may be poorly segmented at source resolution | Independent development CER 0.5333→0.3185, with remaining errors. Optional experimental control; ≤1600px stays enforced. |
| SINGLE_LINE / PSM 7 | AUTO page layout misses tight single-line crops | Independent layout probe CER 0.5333→0.1111; WER still 0.3636. Explicit experimental mode for known single lines, not automatic selection or general document replacement. |
| Autocontrast | Low global contrast may impede recognition | Independent CER worsened to 0.5481. Retain in bounded offline/API experiments; do not expose as routine UI enhancement or activate by default. |
| Grayscale | Removing color could simplify recognition | Authored black-on-white control offers no validated general benefit. Offline/API experiment only; no default change. |
| Mild unsharp mask | Limited sharpening might recover blurred strokes | Did not repair authored blur; introduced an extra leading character on a low-resolution control. Rejected for routine UI/default use; experiment remains reproducible. |
| Denoising / adaptive threshold | Could remove noise but erase strokes | Not implemented/enabled without suitable evidence; combinations and aggressive enhancement deferred. |

`reports/engine42_authored_experiments.json`: seven authored cases × eight profiles,
including clear, Gaussian blur, rotation, low resolution, dense, low-contrast and no-text.
Actual OCR text and per-pass timing/RSS are retained. Blur errors are visible and are not
relabeled successful recognition merely because processing returned COMPLETE.

No altered bitmap replaces the original upload. Exact EXIF/rotation/scale maps use
continuous pixel-edge coordinates; all four box corners map to source/display envelopes.
Encoded-source dimensions differ from EXIF-oriented display dimensions when rotated.
UI overlays use the latter. Graph/report specify processing, encoded-source and display
boxes separately. Historical records without a map keep their original processing box
and disclose the missing map; they are not destructively migrated.

Profile is persisted and included in nonbaseline extraction identity, even when two
profiles produce identical pixels/text. Baseline identity remains backward compatible.
An alternative creates pending candidates with its own history; accepting a previous
extraction does not accept an alternative. Existing review revisions and Engine 2/4 gates
remain unchanged. Runtime resource/time limits are preserved; no accuracy/speedup SLA.
