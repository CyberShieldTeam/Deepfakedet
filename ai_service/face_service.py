"""Experimental face-crop classifier, independent of whole-image generation scores."""
import math
import os

MODEL_ID = "sakshamkr1/deitfake-v2"
REVISION = "f70338d328ba268d2b9d5c6af11044cf0b0e1400"
model = processor = torch_module = None
reason = "Set VERITAS_FACE_MODEL_ENABLED=1 to load the experimental face checkpoint"
MODEL_PATH = os.getenv("VERITAS_FACE_MODEL_PATH")


def load_model():
    global model, processor, torch_module, reason
    model = processor = torch_module = None
    if os.getenv("VERITAS_FACE_MODEL_ENABLED", "0") != "1":
        return
    try:
        import torch
        from ai_service.media_model_registry import cached_snapshot
        from ai_service.media_input_trace import require_headroom
        require_headroom(2)
        source=cached_snapshot('face',MODEL_PATH)
        from transformers import AutoImageProcessor, AutoModelForImageClassification
        loaded = AutoModelForImageClassification.from_pretrained(
            source,local_files_only=True,use_safetensors=True, trust_remote_code=False).eval()
        if loaded.config.id2label != {0: "Fake", 1: "Real"}:
            raise ValueError("Unexpected face checkpoint class mapping")
        processor = AutoImageProcessor.from_pretrained(source,local_files_only=True,trust_remote_code=False,use_fast=False)
        torch.set_num_threads(min(torch.get_num_threads(), 4))
        model, torch_module, reason = loaded, torch, ""
    except Exception as error:
        reason = f"Face model load failed: {type(error).__name__}: {error}"


def health():
    return {"status": "ready" if model is not None else "unavailable",
            "model": MODEL_ID, "revision": REVISION, "reason": reason or None}


def legacy_projection(evidence):
    """Compatibility representation of the same inference; never load/run a second model."""
    return dict(status="ready" if evidence["status"] == "analyzed" else
                "unavailable" if evidence["status"] in ("unavailable", "failed") else "not_applicable",
                model=evidence["model"], revision=evidence["revision"], note=evidence["note"],
                faces=[dict(boxIndex=f["face_index"], rawFakeSoftmax=f["raw_fake_score"]) for f in evidence["faces"]])


def crop_face(image, box):
    values = [box.get(key) for key in ("x", "y", "width", "height")]
    if not all(type(v) in (int, float) and math.isfinite(v) for v in values):
        return None
    x, y, width, height = values
    if width < 32 or height < 32:
        return None
    # Explicit VERITAS crop policy, pending evaluation: 20% context on each side.
    bounds = (max(0, math.floor(x - width * .2)), max(0, math.floor(y - height * .2)),
              min(image.width, math.ceil(x + width * 1.2)), min(image.height, math.ceil(y + height * 1.2)))
    if bounds[2] - bounds[0] < 32 or bounds[3] - bounds[1] < 32:
        return None
    return image.crop(bounds).convert("RGB"), list(bounds)


def analyze(image, boxes):
    output = {"status": "unavailable" if model is None else "no_faces", "model": MODEL_ID,
              "revision": REVISION, "classification": "INCONCLUSIVE", "faces": [],
              "note": "Experimental face-crop output; no calibrated manipulation verdict. Crop policy is unvalidated."}
    if model is None:
        return output
    for index, box in enumerate(boxes[:10]):
        crop = crop_face(image, box)
        if crop is None:
            continue
        pixels, bounds = crop
        try:
            inputs = processor(images=pixels, return_tensors="pt")
            with torch_module.inference_mode():
                score = torch_module.softmax(model(**inputs).logits[0], dim=-1)[0].item()
            if not math.isfinite(score) or not 0 <= score <= 1:
                raise ValueError("Invalid face score")
            output["faces"].append({"face_index": index, "crop_bounds": bounds, "raw_fake_score": round(score, 6)})
        except Exception:
            output["status"] = "failed"
            output["faces"] = []
            return output
    output["status"] = "analyzed" if output["faces"] else "no_usable_faces" if boxes else "no_faces"
    return output
