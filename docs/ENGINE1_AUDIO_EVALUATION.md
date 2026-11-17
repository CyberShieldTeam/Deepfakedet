# AASIST external speech evaluation v1

Official [AASIST](https://github.com/clovaai/aasist), MIT, revision `a04c9863f63d44471dde8a6abcb3b082b07cd1d1`; pinned 1,281,532-byte checkpoint SHA-256 `51d2d9cf0738172f61e2a384ec50a54a55363240f67c971ed55a92435bc1a1c0`. Existing vendored architecture and strict weights-only loading retained. ASVspoof2019 LA speech anti-spoofing, not music/arbitrary sound or universal audio editing detection. Spoof class0, bona-fide class1. Official scoring uses bona-fide logits; VERITAS raw spoof softmax is an experimental observation, not a publisher-calibrated threshold.

Actual production preprocessing: libsndfilefloat32, arithmetic-mean downmix, polyphase16kHz resample; 64,600-sample (4.0375s) non-overlapping windows; tail at least1s repeat-padded; RMS below.003 skipped. Speech presence not verified. These thresholds were not changed. Original, resampled float32 and padded model-input SHA-256 identities retained separately with skipped spans and padding counts. No recording verdict deployed.

Rights/provenance: [LJSpeech1.1](https://keithito.com/LJ-Speech-Dataset/) public-domain Linda Johnson LibriVox readings, MP3-derived; [WaveFake](https://github.com/RUB-SysSec/WaveFake), Joel Frank and Lea Schönherr, [Zenodo5642694](https://zenodo.org/records/5642694), CC BY-SA4.0, English LJSpeech MelGAN/WaveGlow subsets. No raw recordings committed. Bounded explicitly approved transfer: WaveFake41,993,900 bytes via validated HTTP206 ranges, LJSpeech10,199,040 streamed bytes; 144 acquired recordings. No full28.9GB archive download or full archive checksum claim. Per-member SHA and WaveFake ZIPCRC verified; full publisher MD5 not verified.

Frozen [protocol](../test/fixtures/engine1_audio_protocol.json), SHA-256 `71075b81fdda0c7eb75ff6a28a26c465582a7ef0b66147946c4977a18e426813`: 12 development utterances genuine/MelGAN pairs; 12 held-out utterances genuine/WaveGlow pairs. No shared utterance IDs across roles. Single English voice, same books/recording sources, streaming order/size bias; **not speaker/source-independent** and sampled generator separation does not establish absence from all model training. No voice-conversion, multilingual or controlled additive-noise benchmark acquired.

48 recordings × original and matched MP3 64kbps/16kHz =96 executions. Zero skips. Fixed raw spoof softmax.5; no fitting. Offline recording research policy: duration-weighted mean of segment scores; undefined if no usable segment. It is not integrated into API decisions. EER is a descriptive interpolated ROC crossing, not a threshold selected for deployment.

Held-out results:

| Scope | N | Accuracy | Precision | Recall | FPR | AUROC | EER |
|---|---:|---:|---:|---:|---:|---:|---:|
| Original recordings |24|50.00%|50.00%|100%|100%|.673611|.333333|
| MP3 recordings |24|54.17%|52.17%|100%|91.67%|.583333|.416667|
| Original segments |38|50.00%|50.00%|100%|100%|.617729|.368421|
| MP3 segments |38|52.63%|51.43%|94.74%|89.47%|.570637|.473684|

Original recording confusion TP12/FP12/TN0/FN0. MP3 TP12/FP11/TN1/FN0. Full F1, FNR, confusion matrices, latency, intervals, input/segment traces in [actual report](../reports/engine1_audio_aasist_v1.json). Original recording AUROC group-bootstrap interval.558854–.823090. Wilson intervals and clip-group bootstraps cannot account for unresolved speaker/book dependence; segment-level nominal intervals especially must not be read as independent population uncertainty.

**Decision: no promotion, no threshold adjustment.** All12 genuine held-out original recordings flagged at the fixed diagnostic threshold. The result identifies severe target-domain false positives, not proof that bona-fide speech is synthetic. Retain INCONCLUSIVE, segment observations, clear domain warning and zero-window status. Next: exact publisher-score parity, a separately frozen speaker-disjoint multi-generator corpus and acquisition/channel controls before calibration.

Reproduce bounded acquisition only after rights/download authorization: `python -m ai_service.prepare_media_audio_evaluation --output-root <new-private-root>`; `python -m ai_service.evaluate_media_audio freeze --manifest <acquired.json> --output <frozen.json>`; `evaluate --manifest <frozen.json> --output <new-report>`. Never overwrite the frozen protocol or prior reports.
