# Audio inference restoration — 2026-11-17 local date

The earlier unavailability was a missing checkpoint plus disabled configuration, not
evidence that AASIST could not run. The existing pinned downloader obtained **1,281,532
bytes** from [official AASIST](https://github.com/clovaai/aasist), revision
`a04c9863f63d44471dde8a6abcb3b082b07cd1d1`, SHA-256
`51d2d9cf0738172f61e2a384ec50a54a55363240f67c971ed55a92435bc1a1c0`.
MIT notice is preserved in `ai_service/vendor/LICENSE.AASIST`. Size/hash checks and
PyTorch `weights_only=True`, strict state matching passed. Weights stay ignored, outside Git.

Full Python service on port 8001 now runs `VERITAS_AUDIO_MODEL_ENABLED=1`, image/face
classifiers disabled, Hub offline. Actual browser audio upload → Express → Python
returned **3 timestamped AASIST segments**, `INCONCLUSIVE`, null decision probability
and raw uncalibrated scores. Actual video audio extraction also returned a separate
AASIST segment. The UI names the executed model/revision, links official documentation
and states training/evaluation limits. Missing-confidence presentation says assessment
unavailable rather than implying a calibrated 0% confidence.

The repository `sample_voice.wav` has no independently established genuine/spoof label;
it is only a transport/inference input. The video track is a procedural 440 Hz tone,
not speech. Neither measures speech anti-spoofing accuracy. All six audio software
tests now pass, including the formerly skipped installed-weight inference. Full Python
suite: 98 passed, zero skipped after installation.

Training domain: ASVspoof 2019 LA speech. Existing decode/downmix/polyphase 16 kHz
resampling, 64,600-sample windows, repeat-padding, one-second minimum final window and
RMS silence gate were preserved. RMS does not verify speech. Limits remain 12 MiB/60 s
Python audio (browser transport lower), with invalid/oversized input rejected.

No suitable independently labelled, licensed, speaker-separated genuine/synthetic/
voice-conversion dataset was available locally. FPR/FNR/precision/recall/AUROC/EER,
calibration, multilingual/noise/compression generalization and a deployment threshold
remain **unmeasured here**. Do not treat raw softmax as calibrated probability or apply
this speech model to music/general audio. The independent deployment decision remains
abstention, with optional experimental researcher evidence.

See [existing audio model record](../AUDIO_MODEL_CARD.md) for complete preprocessing,
checkpoint source and earlier limitations. Next: speech applicability gating and a
licensed speaker/source-disjoint evaluation protocol, separate from transport controls.
