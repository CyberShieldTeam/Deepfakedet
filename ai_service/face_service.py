"""Optional face-crop manipulation checkpoint; raw outputs never become a verdict."""
import os
from PIL import Image

MODEL_ID = "sakshamkr1/deitfake-v2"
REVISION = "f70338d328ba268d2b9d5c6af11044cf0b0e1400"
model = None
processor = None
torch_module = None
load_error = "Set VERITAS_FACE_MODEL_ENABLED=1 to load the checkpoint"


def load_model():
    global model, processor, torch_module, load_error
    model = processor = torch_module = None
    if os.getenv("VERITAS_FACE_MODEL_ENABLED", "0") != "1":
        load_error = "Set VERITAS_FACE_MODEL_ENABLED=1 to load the checkpoint"
        return
    try:
        import torch
        from transformers import AutoImageProcessor, AutoModelForImageClassification
        candidate_processor = AutoImageProcessor.from_pretrained(MODEL_ID, revision=REVISION)
        candidate = AutoModelForImageClassification.from_pretrained(
            MODEL_ID, revision=REVISION, use_safetensors=True, trust_remote_code=False).eval()
        if candidate.config.id2label.get(0) != "Fake" or candidate.config.id2label.get(1) != "Real":
            raise ValueError("Unexpected face checkpoint class order")
        if torch.cuda.is_available():
            candidate.to("cuda")
        processor, model, torch_module = candidate_processor, candidate, torch
        load_error = ""
    except Exception as exc:
        load_error = f"Face model load failed: {type(exc).__name__}: {exc}"


def crop_face(image: Image.Image, box: dict) -> Image.Image:
    """Square face crop with 10% context, clamped to the displayed image bounds."""
    width, height = image.size
    cx = box["x"] + box["width"] / 2
    cy = box["y"] + box["height"] / 2
    side = max(box["width"], box["height"]) * 1.2
    left = max(0, int(round(cx - side / 2)))
    top = max(0, int(round(cy - side / 2)))
    right = min(width, int(round(cx + side / 2)))
    bottom = min(height, int(round(cy + side / 2)))
    if right - left < 32 or bottom - top < 32:
        raise ValueError("Face crop is too small")
    return image.crop((left, top, right, bottom))


def screen_faces(image: Image.Image, boxes: list[dict]) -> dict:
    if model is None or processor is None or torch_module is None:
        return {"status": "unavailable", "model": MODEL_ID, "revision": REVISION,
                "faces": [], "note": load_error}
    if not boxes:
        return {"status": "not_applicable", "model": MODEL_ID, "revision": REVISION,
                "faces": [], "note": "No YuNet face candidate was available."}
    results = []
    for index, box in enumerate(boxes[:3]):
        try:
            crop = crop_face(image, box)
        except ValueError:
            continue
        inputs = processor(images=crop, return_tensors="pt")
        device = next(model.parameters()).device
        with torch_module.inference_mode():
            logits = model(**{key: value.to(device) for key, value in inputs.items()}).logits[0]
            raw = torch_module.softmax(logits, dim=-1)[0].item()
        results.append({"boxIndex": index, "rawFakeSoftmax": round(raw, 6)})
    return {"status": "ready" if results else "not_applicable", "model": MODEL_ID,
            "revision": REVISION, "faces": results,
            "note": "Uncalibrated face-crop output; no manipulation verdict." if results else "Face crops were too small."}
