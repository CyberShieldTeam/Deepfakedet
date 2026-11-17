"""Optional AASIST speech anti-spoofing evidence. No calibrated authenticity verdict."""
import base64
import binascii
import hashlib
import io
import math
import os
import time
from pathlib import Path
from threading import Lock

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
MODEL_ID = "clovaai/aasist"
MODEL_REVISION = "a04c9863f63d44471dde8a6abcb3b082b07cd1d1"
WEIGHTS = Path(__file__).resolve().parent / "models" / "AASIST.pth"
WEIGHTS_SHA256 = "51d2d9cf0738172f61e2a384ec50a54a55363240f67c971ed55a92435bc1a1c0"
SAMPLE_RATE = 16000
WINDOW_SAMPLES = 64600
MAX_BYTES = 12 * 1024 * 1024
MAX_SECONDS = 60
MIN_SEGMENT_SECONDS = 1.0
MIN_RMS = 0.003  # Silence gate only; this is not a speech activity detector.
MODEL_CONFIG = {
    "nb_samp": WINDOW_SAMPLES, "first_conv": 128,
    "filts": [70, [1, 32], [32, 32], [32, 64], [64, 64]],
    "gat_dims": [64, 32], "pool_ratios": [0.5, 0.7, 0.5, 0.5],
    "temperatures": [2.0, 2.0, 100.0, 100.0],
}

model = None
torch_module = None
load_error = "Set VERITAS_AUDIO_MODEL_ENABLED=1 to load AASIST"
inference_lock=Lock()


def load_model():
    global model, torch_module, load_error
    model = None
    torch_module = None
    if os.getenv("VERITAS_AUDIO_MODEL_ENABLED", "0") != "1":
        load_error = "Set VERITAS_AUDIO_MODEL_ENABLED=1 to load AASIST"
        return
    try:
        from ai_service.media_input_trace import require_headroom
        require_headroom(1)
        if not WEIGHTS.is_file() or hashlib.sha256(WEIGHTS.read_bytes()).hexdigest() != WEIGHTS_SHA256:
            raise ValueError("AASIST checkpoint missing or checksum mismatch")
        import torch
        from ai_service.vendor.aasist_model import Model
        # AASIST's small graph layers are much slower with excessive CPU threads.
        torch.set_num_threads(min(torch.get_num_threads(), 4))
        loaded = Model(MODEL_CONFIG).eval()
        loaded.load_state_dict(torch.load(WEIGHTS, map_location="cpu", weights_only=True), strict=True)
        model = loaded
        torch_module = torch
        load_error = ""
    except Exception as exc:
        load_error = f"AASIST load failed: {type(exc).__name__}: {exc}"


def health():
    return {"status": "ready" if model is not None else "unavailable", "model": MODEL_ID,
            "revision": MODEL_REVISION, "reason": load_error if model is None else None}


class AudioRequest(BaseModel):
    audio_base64: str


def prepare_audio(raw: bytes):
    """Decode with libsndfile, downmix, and polyphase-resample to AASIST's 16 kHz input."""
    import numpy as np
    import soundfile as sf
    from scipy.signal import resample_poly

    try:
        info = sf.info(io.BytesIO(raw))
        if info.samplerate < 8000 or info.samplerate > 192000 or info.channels > 8:
            raise HTTPException(415, "Unsupported audio sample rate or channel count")
        if info.duration > MAX_SECONDS:
            raise HTTPException(413, "Audio exceeds 60 seconds")
        wave, sample_rate = sf.read(io.BytesIO(raw), dtype="float32", always_2d=True)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(415, "Audio format could not be decoded (try WAV, FLAC, OGG, or supported MP3)") from exc
    if sample_rate < 8000 or sample_rate > 192000 or wave.shape[1] > 8:
        raise HTTPException(415, "Unsupported audio sample rate or channel count")
    duration = len(wave) / sample_rate
    if duration > MAX_SECONDS:
        raise HTTPException(413, "Audio exceeds 60 seconds")
    mono = wave.mean(axis=1)
    if not np.isfinite(mono).all():
        raise HTTPException(400, "Audio contains invalid samples")
    if sample_rate != SAMPLE_RATE:
        divisor = math.gcd(sample_rate, SAMPLE_RATE)
        mono = resample_poly(mono, SAMPLE_RATE // divisor, sample_rate // divisor).astype("float32")
    return mono, sample_rate, duration


def window_plan(samples):
    """Non-overlapping 4.0375 s windows; repeat-pad the final usable partial window."""
    import numpy as np
    windows = []
    skipped=[]
    for start in range(0, len(samples), WINDOW_SAMPLES):
        segment = samples[start:start + WINDOW_SAMPLES]
        duration = len(segment) / SAMPLE_RATE
        if duration < MIN_SEGMENT_SECONDS:
            skipped.append(dict(start_seconds=start/SAMPLE_RATE,end_seconds=(start+len(segment))/SAMPLE_RATE,reason='short_tail'))
            continue
        rms = float(np.sqrt(np.mean(np.square(segment, dtype="float64"))))
        if rms < MIN_RMS:
            skipped.append(dict(start_seconds=start/SAMPLE_RATE,end_seconds=(start+len(segment))/SAMPLE_RATE,reason='below_rms_silence_gate'))
            continue
        padded = np.tile(segment, math.ceil(WINDOW_SAMPLES / len(segment)))[:WINDOW_SAMPLES]
        windows.append((start / SAMPLE_RATE, (start + len(segment)) / SAMPLE_RATE, padded))
    return windows,skipped


def make_windows(samples):
    return window_plan(samples)[0]


@router.post("/v1/audio/analyze")
def analyze_audio(request: AudioRequest):
    if model is None or torch_module is None:
        raise HTTPException(503, "AASIST model unavailable")
    if not inference_lock.acquire(blocking=False):raise HTTPException(429,'Audio inference busy; no prediction produced')
    try:return _analyze_audio(request)
    finally:inference_lock.release()


def _analyze_audio(request):
    started = time.monotonic()
    try:
        raw = base64.b64decode(request.audio_base64, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(400, "Invalid base64 audio")
    if not raw or len(raw) > MAX_BYTES:
        raise HTTPException(413, "Audio exceeds 12 MB or is empty")
    samples, source_rate, duration = prepare_audio(raw)
    windows,skipped = window_plan(samples)
    segments = []
    for start, end, waveform in windows:
        x = torch_module.from_numpy(waveform.copy()).unsqueeze(0)
        with torch_module.inference_mode():
            logits = model(x)[1][0]
            raw_spoof_softmax = torch_module.softmax(logits, dim=-1)[0].item()
        if not math.isfinite(raw_spoof_softmax) or not math.isfinite(logits[1].item()):raise HTTPException(502,'Nonfinite AASIST output; no prediction produced')
        segments.append({"start_seconds": round(start, 3), "end_seconds": round(end, 3),
                         "raw_bonafide_logit": round(logits[1].item(), 6),
                         "raw_spoof_softmax": round(raw_spoof_softmax, 6),
                         "model_input_sha256":hashlib.sha256(waveform.astype('<f4',copy=False).tobytes()).hexdigest(),
                         "padded_samples":max(0,WINDOW_SAMPLES-round((end-start)*SAMPLE_RATE))})
    return {"classification": "INCONCLUSIVE", "model": MODEL_ID, "revision": MODEL_REVISION,
            "scope": "speech_anti_spoofing", "sample_rate_input": source_rate,
            "sample_rate_model": SAMPLE_RATE, "duration_seconds": round(duration, 3),
            "segments": segments, "processing_ms": round((time.monotonic() - started) * 1000),
            "inputTrace":{"sourceSha256":hashlib.sha256(raw).hexdigest(),"decoded":True,
                          "resampledFloat32Sha256":hashlib.sha256(samples.astype('<f4',copy=False).tobytes()).hexdigest(),
                          "modelSamples":len(samples),"windowSamples":WINDOW_SAMPLES,"skippedWindows":skipped,
                          "speechPresence":"not_verified","status":"segments_available" if segments else "no_usable_windows",
                          "conversion":"libsndfile float32 decode; arithmetic-mean downmix; polyphase 16kHz resample; repeat-pad usable tail; RMS silence gate only"},
            "explanation": "Experimental AASIST speech anti-spoof scores; no calibrated verdict. Silence was skipped, but speech presence was not verified."}
