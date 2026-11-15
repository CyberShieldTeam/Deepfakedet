# Additional forensic methods roadmap

Reconciled status (2026-11-15): current provenance/trust and descriptive image signals
are implemented and covered by signed/tampered/re-encoded software fixtures. Bounded
interval Farneback diagnostics, localization and UI/report evidence are now implemented;
representative detection validation is still open. The earlier table below is retained
as historical planning. Updated per-capability purpose, implementation, compute,
license/access, datasets, limitations and independence review for all eight requested
methods: [feasibility review](docs/FORENSIC_CAPABILITY_FEASIBILITY.md).

Status: planned unless explicitly identified as implemented below. These methods add independent evidence; none should silently convert an inconclusive result into an authenticity verdict. Follow the incremental phase gates in `IMPLEMENTATION_PLAN.md` and record tests in `IMPLEMENTATION_PROGRESS.md`.

| Order | Method | Implementation slice and acceptance gate | Dependencies / complexity |
| --- | --- | --- | --- |
| 1 | C2PA provenance and ordinary metadata | Original images up to 8 MB now reach a server [C2PA SDK](https://github.com/contentauth/c2pa-python/blob/main/docs/usage.md) reader. It reports manifest validation state and structured active-manifest AI declaration separately from the verdict; Pillow extracts basic EXIF presence/software. Next: trust-anchor policy, signed and tampered fixtures, signer/claim details, and bounded EXIF/XMP extraction with [ExifTool](https://exiftool.org/). | Original image upload path started; medium to high. Browser byte-string hints remain unverified. |
| 2 | Frequency and sensor noise | Add OpenCV/SciPy FFT or DCT features and controlled PRNU experiments as separately labeled measurements. Evaluate across camera models, generation methods, resizing, screenshots, and compression before displaying an anomaly score. Camera-source PRNU matching requires reference images from the claimed device. | Licensed mixed corpus and evaluation protocol; high. Missing camera fields, periodic peaks, or weak PRNU alone do not prove generation. |
| 3 | Temporal consistency | OpenCV Farneback flow, forward/backward disagreement, and local residuals now run on adjacent original frames as exploratory evidence. Evaluate false positives from cuts, camera motion, compression, and frame rate. Add landmark stability and consider RAFT only if a representative benchmark justifies its cost. | Phase 2c sampling and labeled video evaluation; high. The present browser frame-difference cue produced false spikes on a static encoded fixture. |
| 4 | Discriminator evaluation and training | Benchmark general-image and face-manipulation models separately, then fine-tune a selected PyTorch CNN or ViT only with authorized, split-safe data. Record publisher, weight hash, license, class order, domain, threshold calibration, and held-out metrics. Apply the same discipline to video and text models. | Dataset access (for example, FaceForensics++ or DFDC under their own terms), compute, and reproducible training; very high. A downloaded checkpoint or successful inference smoke is not a validated detector. |
| 5 | Physiological and geometry research | Test face landmark stability with MediaPipe and remote pulse extraction with pyVHR only on eligible, sufficiently long face video. Report signal quality and abstain when lighting, motion, skin visibility, compression, or duration are unsuitable. Check pyVHR licensing before integration. | Consented/authorized evaluation video and model validation; very high. Failure to recover a pulse does not imply a synthetic face, and lighting/mesh rules need measured false-positive rates. |
| Optional | Vendor watermarks | Assess the [SynthID Detector](https://deepmind.google/models/synthid/) access path and [Truepic Lens API](https://vision.truepic.dev/docs/lens-api) capabilities if credentials and terms permit. Treat them as vendor-specific provenance signals. Do not send user media to an external vendor without an approved integration and clear product disclosure. | Provider access, credentials, privacy review; unknown. Public detector pages do not establish a usable scanning API for this project. |

Open-source Hugging Face checkpoints are candidates for image, face-manipulation, and temporal models. Pin a publisher/revision and weight hash, verify the model card and license, reproduce preprocessing, then benchmark on project-relevant held-out data before routing any score into a verdict. A general video-action model or optical-flow model is not automatically a deepfake detector.

## Interpretation rules

- C2PA manifest validation and trust are distinct. Read the [C2PA specification](https://spec.c2pa.org/specifications/specifications/2.3/specs/ContentCredentials.html) and report the actual validation state, not an invented authenticity guarantee. A valid manifest can support provenance claims about the signed asset; it does not prove that its depicted event is true.
- Metadata is often removed by editing, platforms, and re-encoding. A missing camera/lens/shutter tag is an unknown, not an AI label. Explicit software tags are self-reported unless covered by a trusted signature.
- PRNU is primarily a camera-source attribution technique. It requires suitable reference data and can be obscured by processing. Frequency artifacts are distribution-dependent and require out-of-domain evaluation.
- rPPG requires an observable skin signal; pulse absence has many benign causes. All these methods must carry eligibility, quality, and uncertainty through to the UI.
