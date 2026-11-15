"""Original-byte provenance and bounded image measurements, never an AI detector."""
import base64
import binascii
import io
import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from PIL import Image, ImageOps, UnidentifiedImageError

router = APIRouter()
MAX_BYTES = 10 * 1024 * 1024
NOTE = "Metadata and signal measurements do not establish authenticity. Missing credentials prove nothing."


class EvidenceRequest(BaseModel):
    image_base64: str


def c2pa_evidence(raw, mime):
    result = dict(status="unavailable", sdk=None, trust_policy="none", validation_state=None,
                  validation_codes=[], source_types=[], ai_disclosure="not_assessed", signer=None,
                  note="Embedded credentials only; remote manifest and OCSP fetching disabled. No authenticity verdict.")
    try:
        import c2pa
    except Exception:
        return result
    result["sdk"] = "c2pa-python@" + c2pa.__version__
    try:
        anchors_path = os.getenv("VERITAS_C2PA_TRUST_ANCHORS", "").strip()
        anchors = Path(anchors_path).read_text(encoding="utf-8") if anchors_path else None
        if anchors_path and (not anchors or "-----BEGIN CERTIFICATE-----" not in anchors):
            raise ValueError("Invalid operator trust anchors")
        settings = {"verify": {"verify_after_reading": True, "remote_manifest_fetch": False,
                               "ocsp_fetch": False, "verify_trust": True, "verify_timestamp_trust": True}}
        if anchors:
            settings["trust"] = {"trust_anchors": anchors}
            result["trust_policy"] = "operator_anchors"
        with c2pa.Settings.from_dict(settings) as config, c2pa.Context(config) as context:
            with c2pa.Reader(mime, io.BytesIO(raw), context=context) as reader:
                state = reader.get_validation_state()
                store = json.loads(reader.json())
        result["validation_state"] = state
        # Let the SDK assess all validation failures, including ingredients/bindings.
        if state == "Invalid":
            result["status"] = "invalid"
        elif state in ("Valid", "Trusted"):
            result["status"] = "valid_trusted" if state == "Trusted" and anchors else "valid_untrusted"
        else:
            result["status"] = "failed"
        codes = set()
        def visit(value):
            if isinstance(value, dict):
                if isinstance(value.get("code"), str):
                    codes.add(value["code"][:120])
                for child in value.values():
                    visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)
        visit(store.get("validation_results", {}))
        visit(store.get("validation_status", []))
        result["validation_codes"] = sorted(codes)[:32]
        active = store.get("manifests", {}).get(store.get("active_manifest"), {})
        signature = active.get("signature_info", {})
        result["signer"] = str(signature.get("issuer") or signature.get("common_name") or "")[:160] or None
        source_types = set()
        for assertion in active.get("assertions", []):
            if not str(assertion.get("label", "")).startswith("c2pa.actions"):
                continue
            for action in assertion.get("data", {}).get("actions", []):
                value = action.get("digitalSourceType")
                if isinstance(value, str):
                    source_types.add(value[:200])
        result["source_types"] = sorted(source_types)[:16]
        ai = {"http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
              "http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia"}
        if result["status"] in ("valid_trusted", "valid_untrusted"):
            result["ai_disclosure"] = "declared" if source_types & ai else "not_declared"
        # Generic algorithmicMedia is not necessarily generative AI. A signed statement
        # is still a signer's assertion, not independent proof the depicted event is true.
    except c2pa.C2paError.ManifestNotFound:
        result.update(status="absent", ai_disclosure="not_assessed")
    except c2pa.C2paError as error:
        if str(error).startswith("Remote:"):
            result.update(status="unavailable", ai_disclosure="not_assessed",
                          note="Remote credentials referenced; fetching disabled. No authenticity inference.")
        else:
            result.update(status="failed", ai_disclosure="not_assessed")
    except Exception:
        # Do not expose SDK paths, remote URLs or unbounded exception text to clients.
        result.update(status="failed", ai_disclosure="not_assessed")
    return result


def metadata(image):
    exif = image.getexif()
    # Deliberately omit GPS, serial numbers, names and arbitrary XMP payloads.
    allowed = {271: "camera_make", 272: "camera_model", 305: "software", 274: "orientation"}
    fields = {name: str(exif[tag])[:160] for tag, name in allowed.items() if tag in exif}
    try:
        photo = exif.get_ifd(34665)
        for tag, name in {33434: "exposure_seconds", 33437: "f_number", 34855: "iso", 42036: "lens_model"}.items():
            if tag in photo:
                fields[name] = str(photo[tag])[:160]
    except (KeyError, TypeError, ValueError, OSError):
        pass
    return dict(width=image.width, height=image.height, format=image.format,
                exif_present=bool(exif), fields=fields, fields_verified=False,
                note="Editable metadata; absent camera fields are not evidence of AI generation.")


def signal_measurements(image):
    import cv2
    import numpy as np
    from scipy.fft import fft2, fftfreq
    image = ImageOps.exif_transpose(image).convert("L")
    image.thumbnail((512, 512), Image.Resampling.LANCZOS)
    pixels = np.asarray(image, dtype=np.float64)
    if min(pixels.shape) < 32:
        return dict(status="skipped", reason="Image too small for stable descriptive measurements")
    window = np.outer(np.hanning(pixels.shape[0]), np.hanning(pixels.shape[1]))
    power = np.abs(fft2((pixels - pixels.mean()) * window)) ** 2
    radius = np.hypot(fftfreq(pixels.shape[0])[:, None], fftfreq(pixels.shape[1])[None, :])
    total = float(power.sum())
    residual = pixels - cv2.GaussianBlur(pixels, (0, 0), 1.0)
    return dict(status="measured", analysis_width=image.width, analysis_height=image.height,
                high_frequency_energy_fraction=round(float(power[radius >= .25].sum()) / total, 8) if total > 0 else 0.0,
                noise_residual_std=round(float(residual.std()), 6),
                laplacian_variance=round(float(cv2.Laplacian(pixels, cv2.CV_64F).var()), 6),
                note="Descriptive FFT/high-pass measurements after max512 resize. Not PRNU extraction, an AI score or a calibrated detector.")


@router.post("/v1/image/evidence")
def analyze_evidence(request: EvidenceRequest):
    if len(request.image_base64) > 4 * ((MAX_BYTES + 2) // 3):
        raise HTTPException(413, "Image exceeds 10 MB")
    try:
        raw = base64.b64decode(request.image_base64, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(400, "Invalid base64 image")
    if not raw or len(raw) > MAX_BYTES:
        raise HTTPException(413, "Image exceeds 10 MB or is empty")
    try:
        with Image.open(io.BytesIO(raw)) as image:
            if image.format not in ("JPEG", "PNG", "WEBP"):
                raise HTTPException(415, "Supported formats: JPEG, PNG, WEBP")
            if image.width * image.height > 24_000_000:
                raise HTTPException(413, "Image dimensions exceed limit")
            fields = metadata(image)
            measurements = signal_measurements(image)
            mime = Image.MIME[image.format]
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError):
        raise HTTPException(400, "Corrupt or unsupported image")
    return dict(scope="image_provenance_and_signals", classification="INCONCLUSIVE", decision_probability=None,
                metadata=fields, c2pa=c2pa_evidence(raw, mime), signals=measurements, note=NOTE)
