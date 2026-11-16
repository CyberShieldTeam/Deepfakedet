"""Optional local image classifier. Run with uvicorn ai_service.app:app --host 127.0.0.1 --port 8001."""
import base64
import binascii
import hashlib
import io
import json
import math
import os
import time
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from PIL import Image, ImageOps, UnidentifiedImageError
from ai_service import audio_service, video_service, face_service, image_evidence, provenance_service
from ai_service.extraction_prepare import router as extraction_router

def _timing(stage, event):
    if os.getenv("VERITAS_TIMING_LOG", "0") == "1":
        print(json.dumps(dict(event="stage_"+event, stage=stage, monotonicSeconds=time.monotonic())), file=sys.stderr, flush=True)

MODEL_KIND = os.getenv("VERITAS_IMAGE_MODEL", "dima").lower()
MODELS = {
    "dima": ("dima806/ai_vs_real_image_detection", "9d17b51b9367d6b5720ac81dc339455c45d50ae3"),
    "smaug": ("abacusai/Smaug-AI-Image-Detector", "c7c95951e04a87b884a4ad479401b1128c3903bd"),
    "community": ("OwensLab/commfor-model-384", "6076002bf0d9dd37537f965ee2f06f826c333b61"),
}
MODEL_ID, MODEL_REVISION = MODELS.get(MODEL_KIND, ("unrecognized", "unrecognized"))
MODEL_PATH = os.getenv("VERITAS_IMAGE_MODEL_PATH")
MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 24_000_000
model = None
processor = None
torch_module = None
load_error = "Model not loaded"
face_detector = None
face_lock = Lock()
FACE_MODEL = Path(__file__).resolve().parent / "models" / "face_detection_yunet_2023mar.onnx"
FACE_MODEL_SHA256 = "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"


def load_face_detector():
    global face_detector
    if FACE_MODEL.is_file():
        try:
            import cv2
            if hashlib.sha256(FACE_MODEL.read_bytes()).hexdigest() != FACE_MODEL_SHA256:
                raise ValueError("YuNet model checksum mismatch")
            face_detector = cv2.FaceDetectorYN.create(str(FACE_MODEL), "", (320, 320), score_threshold=0.9)
        except Exception:
            face_detector = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global model, processor, torch_module, load_error, face_detector
    _timing("face_detector", "start")
    load_face_detector()
    _timing("face_detector", "end")
    audio_service.load_model()
    face_service.load_model()
    if os.getenv("VERITAS_IMAGE_MODEL_ENABLED", "0") == "1":
        try:
            import torch
            if MODEL_KIND == "community":
                from ai_service.community_model import load
                model, processor = load()
            elif MODEL_KIND == "dima":
                from transformers import AutoImageProcessor, AutoModelForImageClassification
                source, revision = MODEL_PATH or MODEL_ID, None if MODEL_PATH else MODEL_REVISION
                processor = AutoImageProcessor.from_pretrained(source, revision=revision)
                model = AutoModelForImageClassification.from_pretrained(
                    source, revision=revision, use_safetensors=True
                ).eval()
                if model.config.id2label.get(0) != "REAL" or model.config.id2label.get(1) != "FAKE":
                    raise ValueError("Unexpected checkpoint labels")
                if torch.cuda.is_available():
                    model.to("cuda")
            elif MODEL_KIND == "smaug":
                from huggingface_hub import snapshot_download
                from sentence_transformers import SentenceTransformer
                checkpoint = snapshot_download(MODEL_ID, revision=MODEL_REVISION)
                device = "cuda" if torch.cuda.is_available() else "cpu"
                model = SentenceTransformer(
                    checkpoint, device=device, config_kwargs={"audio_config": None},
                    model_kwargs={"torch_dtype": torch.bfloat16 if device == "cuda" else torch.float32}
                )
                image_processor = model[0].processor.image_processor
                image_processor.max_soft_tokens = image_processor.image_seq_length = 140
                processor = image_processor
            else:
                raise ValueError(f"Unknown VERITAS_IMAGE_MODEL: {MODEL_KIND}")
            torch_module = torch
            load_error = ""
        except Exception as exc:
            model = None
            load_error = f"Model load failed: {type(exc).__name__}: {exc}"
    else:
        load_error = "Set VERITAS_IMAGE_MODEL_ENABLED=1 to load the checkpoint"
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(extraction_router)
app.include_router(audio_service.router)
app.include_router(video_service.router)
app.include_router(image_evidence.router)
app.include_router(provenance_service.router)


class ImageRequest(BaseModel):
    image_base64: str


def detect_faces(image: Image.Image) -> tuple[Literal["candidate_regions", "none_found", "not_performed"], list[dict]]:
    if face_detector is None:
        return "not_performed", []
    import cv2
    import numpy as np
    width, height = image.size
    scale = min(1.0, 640 / max(width, height))
    if scale < 1:
        image = image.resize((round(width * scale), round(height * scale)), Image.Resampling.BILINEAR)
    rgb = np.asarray(image)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    with face_lock:
        face_detector.setInputSize((bgr.shape[1], bgr.shape[0]))
        _, boxes = face_detector.detect(bgr)
    faces = [{"x": round(float(row[0]) / scale), "y": round(float(row[1]) / scale),
              "width": round(float(row[2]) / scale), "height": round(float(row[3]) / scale),
              "confidence": round(float(row[14]), 4)} for row in (boxes[:10] if boxes is not None else [])]
    return ("candidate_regions" if faces else "none_found"), faces


@app.get("/health")
def health():
    return {"status": "ready" if model is not None else "unavailable", "model": MODEL_ID,
            "revision": MODEL_REVISION, "reason": load_error if model is None else None,
            "face_detector": "ready" if face_detector is not None else "unavailable",
            "audio": audio_service.health(), "face_classifier": face_service.health()}


@app.post("/v1/image/analyze")
def analyze_image(request: ImageRequest):
    model_ready = model is not None and processor is not None and torch_module is not None
    if not model_ready and face_detector is None:
        raise HTTPException(503, "Image model unavailable")
    start = time.monotonic()
    try:
        raw = base64.b64decode(request.image_base64, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(400, "Invalid base64 image")
    if not raw or len(raw) > MAX_BYTES:
        raise HTTPException(413, "Image exceeds 10 MB or is empty")
    try:
        with Image.open(io.BytesIO(raw)) as source:
            if source.format not in ("JPEG", "PNG", "WEBP"):
                raise HTTPException(415, "Supported formats: JPEG, PNG, WEBP")
            if source.width * source.height > MAX_PIXELS:
                raise HTTPException(413, "Image dimensions exceed limit")
            if min(source.size) < 64:
                return _inconclusive("Image is too small for this classifier", start)
            # Match browser display orientation so candidate boxes map to visible pixels.
            image = ImageOps.exif_transpose(source).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(400, "Corrupt or unsupported image")
    face_status, faces = detect_faces(image)
    face_evidence = face_service.analyze(image, faces)
    if not model_ready:
        return {"classification": "INCONCLUSIVE", "fake_probability": None,
                "model_confidence": None, "model_status": "unavailable", "model": MODEL_ID,
                "revision": MODEL_REVISION, "scope": "general_ai_generated_image",
                "face_analysis": face_status, "face_boxes": faces, "face_manipulation": face_evidence,
                "face_model": face_service.legacy_projection(face_evidence), "signals": [],
                "explanation": "Classifier unavailable; face candidates are unverified regions, not manipulation analysis.",
                "processing_ms": round((time.monotonic() - start) * 1000)}
    if MODEL_KIND == "community":
        from ai_service.community_model import score
        fake_probability = score(model, processor, image)
    elif MODEL_KIND == "smaug":
        fake_probability = smaug_probability(image)
    else:
        inputs = processor(images=image, return_tensors="pt")
        device = next(model.parameters()).device
        with torch_module.inference_mode():
            logits = model(**{key: value.to(device) for key, value in inputs.items()}).logits[0]
            fake_probability = torch_module.softmax(logits, dim=-1)[1].item()
    # The checkpoint failed the initial out-of-domain fixture smoke test. Do not promote
    # its softmax score to a real/fake decision before independent validation/calibration.
    return {"classification": "INCONCLUSIVE", "fake_probability": round(fake_probability, 6),
            "model_confidence": None, "model_status": "ready", "model": MODEL_ID, "revision": MODEL_REVISION,
            "scope": "general_ai_generated_image", "face_analysis": face_status, "face_boxes": faces, "face_manipulation": face_evidence,
            "face_model": face_service.legacy_projection(face_evidence),
            "signals": [], "explanation": "Experimental whole-image classifier score only; face boxes are unverified candidates, not manipulation analysis.",
            "processing_ms": round((time.monotonic() - start) * 1000)}


def _inconclusive(reason, start):
    return {"classification": "INCONCLUSIVE", "fake_probability": None, "model_confidence": None,
            "model_status": "skipped",
            "model": MODEL_ID, "revision": MODEL_REVISION, "scope": "general_ai_generated_image",
            "face_analysis": "not_performed", "face_boxes": [], "signals": [], "explanation": reason,
            "processing_ms": round((time.monotonic() - start) * 1000)}


def smaug_views(image: Image.Image) -> list[Image.Image]:
    """Published Smaug preprocessing: 576 short side, three 528-pixel crops."""
    image = ImageOps.exif_transpose(image).convert("RGB")
    width, height = image.size
    if min(width, height) > 576:
        scale = 576 / min(width, height)
        image = image.resize((round(width * scale), round(height * scale)), Image.Resampling.LANCZOS)
    elif min(width, height) < 528:
        scale = 528 / min(width, height)
        image = image.resize((math.ceil(width * scale), math.ceil(height * scale)), Image.Resampling.BICUBIC)
    width, height = image.size
    center_x, center_y = (width - 528) // 2, (height - 528) // 2
    if width >= height:
        return [image.crop((x, center_y, x + 528, center_y + 528)) for x in (0, center_x, width - 528)]
    return [image.crop((center_x, y, center_x + 528, y + 528)) for y in (0, center_y, height - 528)]


def smaug_probability(image: Image.Image) -> float:
    views = [{"image": view} for view in smaug_views(image)]
    with torch_module.inference_mode():
        logits = model.encode(views, batch_size=3, convert_to_tensor=True).float().view(1, 3)
        return torch_module.sigmoid(logits.mean(1)).item()
