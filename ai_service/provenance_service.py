"""Original-image C2PA inspection. Metadata declarations are evidence, not an authenticity verdict."""
import base64
import binascii

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from PIL import Image, UnidentifiedImageError

router = APIRouter()
MAX_BYTES = 8 * 1024 * 1024
AI_SOURCE_TYPES = {"trainedAlgorithmicMedia", "compositeWithTrainedAlgorithmicMedia"}


class ProvenanceRequest(BaseModel):
    image_base64: str


def declared_ai(manifest):
    """Only structured DigitalSourceType assertions in the active manifest count."""
    for assertion in manifest.get("assertions", []):
        if not isinstance(assertion, dict) or assertion.get("label") != "stds.schema-org.CreativeWork":
            continue
        data = assertion.get("data")
        if isinstance(data, dict):
            value = data.get("digitalSourceType")
            if isinstance(value, str) and value.rsplit("/", 1)[-1] in AI_SOURCE_TYPES:
                return True
    return False


def inspect_original(raw):
    try:
        with Image.open(__import__("io").BytesIO(raw)) as image:
            if image.format not in ("JPEG", "PNG", "WEBP"):
                raise HTTPException(415, "Supported provenance formats: JPEG, PNG, WEBP")
            if image.width * image.height > 40_000_000:
                raise HTTPException(413, "Image dimensions exceed provenance limit")
            mime = Image.MIME[image.format]
            exif = image.getexif()
            software = str(exif.get(305, ""))[:120] or None
            exif_summary = {"present": bool(exif), "software": software}
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(400, "Corrupt or unsupported image")
    from ai_service.image_evidence import c2pa_evidence
    evidence = c2pa_evidence(raw, mime)
    status = {"valid_untrusted": "valid", "valid_trusted": "trusted", "failed": "unavailable"}.get(
        evidence["status"], evidence["status"])
    return dict(status=status, note=evidence["note"],
                aiDeclaration=evidence["ai_disclosure"] == "declared" and status in ("valid", "trusted"),
                claimGenerator=evidence.get("claim_generator"), exif=exif_summary)


@router.post("/v1/image/provenance")
def inspect_image(request: ProvenanceRequest):
    if len(request.image_base64) > 4 * ((MAX_BYTES + 2) // 3):
        raise HTTPException(413, "Image exceeds provenance size limit")
    try:
        raw = base64.b64decode(request.image_base64, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(400, "Invalid base64 image")
    if not raw or len(raw) > MAX_BYTES:
        raise HTTPException(413, "Image exceeds provenance size limit or is empty")
    return inspect_original(raw)
