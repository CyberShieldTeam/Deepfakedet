# Versioned model integration contract

No Python model or third-party inference service is bundled or claimed to be running.
Without configured endpoints, classification returns `unavailable`, with null probabilities.
The UI and tests exercise real signal extraction and the adapter protocol, not model accuracy.

## Deployment responsibilities

Select and independently evaluate an appropriate pretrained model before deploying an endpoint:

- **Images:** a ViT or other image-forensics classifier trained on real/generated or manipulated images.
  An example model-card starting point is
  https://huggingface.co/dima806/deepfake_vs_real_image_detection .
  This is a candidate for operator review, **not a bundled or validated model**.
  Confirm the current model card, training corpus, generator coverage, redistribution license,
  preprocessing and real/generated label mapping. A generation model must return null for
  manipulation unless it has an independently trained manipulation output.
- **Audio:** a trained speech-spoofing classifier with a compatible Wav2Vec2 representation
  and classification head, or another properly trained spoof detector. A bare Wav2Vec2
  feature encoder must never produce a synthetic-speech probability. Record training sets
  (for example the exact ASVspoof protocol if applicable), languages, codecs, license,
  model revision and known out-of-domain limitations.
- **Embeddings:** multilingual Sentence Transformers/SBERT, such as the model-card candidate
  https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 .
  Confirm its current license and language/evaluation coverage. Hosting this encoder locally
  is supported via a loopback endpoint; there is no hidden remote embedding dependency.

Deployment must supply the selected model's ID, pinned version, verified license, documented
training data and limitations via `VERITAS_{IMAGE,AUDIO,EMBEDDING}_*` configuration.
No model license, training provenance, or generalization accuracy is inferred by this application.
Hugging Face dedicated inference endpoints can expose the contract using a custom handler;
the raw HF image-classification response is not interchangeable with this schema.

## Classification

`POST VERITAS_IMAGE_ENDPOINT` or `VERITAS_AUDIO_ENDPOINT`:

```json
{
  "task": "image",
  "modelId": "operator-selected-model",
  "version": "pinned-revision",
  "media": "data:image/png;base64,..."
}
```

Response (probabilities in **0–1**, not percentages):

```json
{
  "modelId": "operator-selected-model",
  "version": "pinned-revision",
  "aiGeneratedProbability": 0.73,
  "manipulationProbability": null
}
```

An audio provider may optionally supply `segments: [{start, end, probability}]`.
The browser also performs real decoding, mono 16 kHz resampling and five-second PCM WAV
segmentation. The backend classifies each segment and retains its actual start/end time.
Maximum audio duration is 120 seconds. Model preprocessing still belongs to the provider.

Images use the original input when small enough, otherwise an explicitly labeled lossless
resize. Video uses configurable frame sampling, capped at 32 frames; timestamps and actual
sampling interval are retained. Per-frame classifier output is separate from temporal-difference
screening. A descriptive sampled-frame/segment mean is **not** a calibrated whole-file probability.
Missing or failed samples block the complete aggregate. Unsupported output heads stay null.

## Embeddings

Request:

```json
{"modelId":"pinned-multilingual-model","version":"revision","texts":["claim","evidence passage"]}
```

Response:

```json
{"modelId":"pinned-multilingual-model","version":"revision","embeddings":[[0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8],[0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9]]}
```

Vectors must be finite, nonzero, equal-length, and between 8 and 4096 dimensions.
Use 384-dimensional vectors for the typical multilingual MiniLM deployment. Responses
are limited to 2 MB. Batches contain at most 128 texts, with four concurrent calls.
A bounded, owner/model/version-scoped hashed-text cache retains vectors for 30 minutes;
it never logs the input text. Failures fall back to lexical BM25/token overlap, explicitly labeled.
Candidate indexing uses lexical/URL/hashtag keys, so semantically related posts without shared
keys may be missed; this is not an exhaustive semantic nearest-neighbor search.

## Operational controls

- Endpoints are server-configured only, never supplied by API callers.
- HTTPS required except loopback HTTP; redirects rejected.
- Optional bearer token stays server-side.
- 20-second per-call timeout; bounded response parsing; no paid automatic retries.
- Identity, version, finite scores, bounds and segment ranges are validated.
- Registry status is unavailable / not tested / ready / failed; `ready` follows a successful
  validated response, not the mere presence of a URL.
- Temperature scaling requires a positive fitted temperature and a held-out calibration
  reference. Otherwise probabilities are labeled uncalibrated and no accuracy/confidence
  estimate is fabricated. No calibration set or accuracy benchmark ships with this project.
- C2PA byte scans remain **unverified metadata hints**. A cryptographic verification
  library/trust policy is not installed; metadata never supplies a probability.
