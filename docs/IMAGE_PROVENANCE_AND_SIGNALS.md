# Image provenance and signal diagnostics — 2026-11-15

## Implemented scope

The user selected C2PA/metadata and image signal diagnostics as the first slice after
sharing the [developer article](https://dev.to/qindev/a-developers-guide-to-detecting-ai-generated-images-39ic).
This extends the evidence pipeline; it does not reopen indefinite classifier searches,
enable authenticity verdicts, train models, or implement Engine 2 or temporal video methods.
The advanced-model decision gate remains applicable. No reserved images or manifests
were accessed. No repository push or merge was performed.

- New Python `/v1/image/evidence` endpoint works independently of image-classifier and
  YuNet availability. It always returns `INCONCLUSIVE` and a null decision probability.
- Optional **c2pa-python 0.39.0** reads and validates embedded credentials against the
  exact received bytes. It reports absent, valid-untrusted, valid-trusted, invalid,
  unavailable or failed; SDK validation codes and active-manifest source types are
  retained separately. A valid credential is a signed assertion, not proof that the
  depicted event happened or that a signer's declaration is accurate.
- Trust is explicit: `valid_trusted` requires an operator-configured PEM anchor file
  and the SDK's `Trusted` state. Without that configuration a credential is never
  labeled trusted, even if an SDK built-in policy would trust it. No certificate from
  an uploaded asset is automatically added to deployment trust.
- Remote-manifest and OCSP fetching are disabled. A remote-only credential is reported
  unavailable, not absent or valid. This prevents an embedded URL from being fetched;
  it also means online revocation freshness and external provenance cannot be assured.
  Embedded timestamp/chain results are those of the configured SDK, not an independent
  online trust-list/revocation audit.
- AI-use disclosure is taken from the active manifest's `c2pa.actions*` assertions,
  using IPTC `trainedAlgorithmicMedia` and `compositeWithTrainedAlgorithmicMedia` URIs.
  Generic `algorithmicMedia` can include conventional computer graphics; it is **not**
  treated as generative-AI disclosure. Invalid/failed/unavailable credentials never
  receive an authenticated AI disclosure. Missing disclosure does not mean human origin.
- Structured EXIF extraction uses Pillow, with camera make/model, software, orientation,
  exposure, aperture, ISO and lens when present. All are editable/unverified. GPS,
  serial numbers and arbitrary metadata payloads are omitted. This is not a complete
  ExifTool/XMP dump. Existing browser byte-pattern hints remain explicitly unverified.
- Descriptive signal measurements use grayscale, a maximum 512-pixel thumbnail and
  mean-subtracted Hann-windowed FFT power. High-frequency energy is the fraction at
  radius >=0.25 cycles/pixel; flat inputs return zero. A Gaussian high-pass residual
  standard deviation and Laplacian variance are also measured in grayscale intensity
  units. These are **not PRNU extraction, a sensor fingerprint, or an AI probability**.
  Small inputs (<32 pixels on either analyzed side) are explicitly skipped.
- The new evidence is displayed in Media Forensics and included in escaped HTML
  exports. It does not vote with the quarantined classifier or change an authenticity
  decision. Existing face/audio/video inference contracts remain unchanged.

## Original-byte transport

The browser may resize an image for classifier processing. It now supplies a separate
optional `originalImageData` when that happens and the original is <=10 MiB. Express
validates its image signature, modality and size and counts it toward the existing
24 MiB aggregate decoded-media budget. The evidence endpoint applies its own 10 MiB
and 24-million-pixel bounds before SDK verification and pixel processing.

Provenance uses the separate original when supplied. For ordinary API uploads without
that extra field, it uses submitted image bytes; if the browser has explicitly marked
the input as a resize without providing the original, verification is skipped with
a limitation instead of falsely reporting stripped credentials. The original-file
designation is a client assertion, not a chain-of-custody attestation. Cryptographic
validation concerns the actual received bytes, not an unseen camera original.

Origins outside the byte/pixel/format budget remain unsupported; missing SDK, failed
verification, malformed data or missing original bytes do not generate fake results.
Classifier input preprocessing is preserved. The original and any resize are not
archived by this feature; the evidence result can be saved to an existing case.

## Setup

```powershell
.\.venv-win\Scripts\pip.exe install -r ai_service/requirements-provenance.txt
$env:VERITAS_AI_SERVICE_URL = 'http://127.0.0.1:8001'
# Optional operator-managed certificate anchors, read by Python only:
# $env:VERITAS_C2PA_TRUST_ANCHORS = 'C:\managed-config\trusted-signers.pem'
```

Start the existing Python and Express services as usual. The Python process needs its
own optional trust-anchor setting; Express does not install or configure SDK trust.
The optional SDK adds no neural weights. Without it the signal/metadata endpoint
continues working and reports C2PA as unavailable. This session installed SDK 0.39.0,
cryptography 50.0.2 and toml 0.10.2 in the native Python 3.13.12 environment. Existing
torch/transformers versions were not upgraded; `pip check` found no broken requirements.

Do not configure the public test certificate below as production trust. A maintained
deployment trust policy, trust-list updates and requirements for online revocation
checking remain operational work, not implied by installing this SDK.

## Actual verification

Pinned public SDK test assets were downloaded **only into the ignored cache** from
`contentauth/c2pa-python` revision `48d07023d4f37e978c5b30745b49b26668774b08`:
`tests/fixtures/A.jpg`, `C.jpg`, `cloud.jpg`, and public `ps256.pub` saved locally as
`test-anchors.pem`. The repository provides Apache-2.0/MIT licensing; test image rights
should still be checked before separate redistribution. No images, private keys or
trust-anchor configuration were committed. These fixtures are software inputs, not
a representative detection benchmark or an independent ground-truth corpus.

Reproduce the cached-fixture software smoke:

```powershell
.\.venv-win\Scripts\python.exe -m ai_service.smoke_image_evidence --output reports/image_evidence_smoke.json
# To include live Express -> Python checks (local services already running):
.\.venv-win\Scripts\python.exe -m ai_service.smoke_image_evidence --base-url http://127.0.0.1:3017 --output reports/image_evidence_smoke.json
```

`reports/image_evidence_smoke.json` records original fixture hashes, the altered-input
hash, SDK version, measurements, validation codes and live HTTP results:

| Case | Actual result |
| --- | --- |
| Unsigned A.jpg | `absent`; no authenticity decision |
| Signed C.jpg, no configured trust anchors | `valid_untrusted`; signature and binding validated |
| Same signed image, explicit public test anchor in smoke process only | `valid_trusted` |
| Image entropy byte altered while preserving manifest | `invalid`; `assertion.dataHash.mismatch`; no AI disclosure or verdict |
| cloud.jpg referencing external credentials | `unavailable`; remote fetch disabled |
| Unsigned/signed/altered originals sent separately from classifier resize through Express | Matching SDK statuses; authenticity inconclusive; null decision probability |

The C.jpg fixture declares generic `algorithmicMedia`; it correctly does not become a
specific generative-AI disclosure. Actual positive generative-AI declarations across
vendors, fresh revocation handling, and all C2PA assertion/format variants are not yet
covered by these fixtures. No C2PA conformance certification or detector accuracy is claimed.

Python regression checks cover unavailable SDK, invalid bytes/pixel limits, metadata
whitelisting, flat/periodic FFT behavior, small-image skips, invalid trust configuration
and real untrusted/trusted/tampered SDK behavior. Node tests cover response validation,
original-byte selection, classifier-independent evidence, no replacement probabilities,
request validation and HTML export escaping. Browser tests exercise unsigned and signed
uploads. This session: full Python **39 tests, 38 passed / one AASIST-weight skip**;
the final seven image-evidence tests also passed. Node/API, TypeScript, build and
dependency checks passed; the existing Vite chunk-size warning remains. The real
YuNet image HTTP smoke passed with inconclusive output and null decision probability.

Two browser checks passed on the built client against real Express/Python endpoints
(8.3 seconds total); the screenshot `test-results/image-provenance.png` was visually
inspected. Two earlier development-server runs timed out at page navigation before
feature assertions. Blocking external cosmetic font requests did not resolve that
navigation issue; the successful built-client run bypassed Vite middleware. Development
navigation remains a separate unresolved limitation, not a passed check. No full browser
suite, video benchmark or classifier accuracy evaluation was run for this slice.

The loopback-only `test/serveBuiltClient.ts` harness reproduces built-client/API testing
without changing production serving. After building and starting Python on 8017, set
`VERITAS_AI_SERVICE_URL=http://127.0.0.1:8017`, an isolated `VERITAS_STORE`, blank trust
anchors and disabled optional classifiers/provider. Run `npx tsx test/serveBuiltClient.ts`
with `PORT=3017`; in the test process set `VERITAS_TEST_URL=http://127.0.0.1:3017`,
`VERITAS_EXPECT_IMAGE_EVIDENCE=1` and `VERITAS_EXPECT_FACE_READY=0`, then run:

```powershell
npx playwright test --grep 'Signed image provenance|Image measurements'
```

The harness uses local development security settings and is not a production server.

## Corrections to the proposed research rules

| Suggestion | VERITAS interpretation |
| --- | --- |
| Missing camera signatures imply AI | Unsupported: stripping, screenshots, editing and ordinary exports remove metadata. Missing fields stay descriptive. |
| C2PA is an EXIF string scan | Incorrect: structured credentials need cryptographic validation, content binding and an explicit signer trust policy. |
| FFT checkerboards identify generated content | Unsupported as a general decision rule: resizing, texture, compression and camera processing also affect spectra. No threshold or classifier accuracy is established here. |
| Lack of PRNU means AI | Unsupported without suitable source-camera references, alignment and quality controls. Denoising/resizing/compression weaken sensor traces. Current high-pass residual is not PRNU. |
| Optical flow reveals broken physics | Flow estimates motion; cuts, occlusion, camera movement, interpolation and estimation error need controls. It is not a standalone authenticity detector. |
| No rPPG pulse means an AI person | Unsupported: motion, illumination, resolution, codec, duration and skin visibility can prevent a pulse estimate. A failed estimate must abstain. |
| Low DIRE error means almost certainly AI | The research uses reconstruction-error representations and a trained detector, with dataset-dependent evaluation. It is not a universal one-number proof. |
| Several weak classifiers voting produce reliable confidence | Requires independent ensemble evaluation/calibration and error-diversity evidence; voting does not fix correlated errors or provenance-confounded data. |

Follow-on research remains separate: source-referenced PRNU, bounded optical flow before
RAFT, quality-gated rPPG/face geometry, and task-specific face/video datasets. FaceForensics++
and DFDC concern face/video manipulation and cannot substitute for a general-image
generation benchmark. Any new training needs licenses, identity/source/generator splits,
dedicated compute and independent validation. None was started in this slice.

SynthID/Truepic integrations are not implemented. Vendor watermark detection covers
supported marks and access arrangements; an unmarked result is not a human-origin
verdict. No endpoint, access credential or paid capability was invented, and no media
was uploaded to an external vendor by this feature.

Primary references:
[C2PA Python SDK usage](https://github.com/contentauth/c2pa-python/blob/48d07023d4f37e978c5b30745b49b26668774b08/docs/usage.md),
[context settings](https://github.com/contentauth/c2pa-python/blob/48d07023d4f37e978c5b30745b49b26668774b08/docs/context-settings.md),
[C2PA explainer](https://spec.c2pa.org/specifications/specifications/2.3/explainer/_attachments/Explainer.pdf),
[C2PA harms model](https://spec.c2pa.org/specifications/specifications/2.0/security/Harms_Modelling.html),
[PRNU research implementation](https://github.com/pkorus/multiscale-prnu),
[official RAFT documentation](https://docs.pytorch.org/vision/stable/models/raft.html),
[pyVHR](https://github.com/phuselab/pyVHR),
[DIRE authors' repository](https://github.com/ZhendongWang6/DIRE),
[SynthID](https://deepmind.google/models/synthid/).
