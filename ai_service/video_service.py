"""Bounded original-video frame decoding; frame scores remain experimental evidence."""
import base64
import binascii
import math
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
MAX_VIDEO_BYTES = 8 * 1024 * 1024
MAX_DURATION_SECONDS = 120
MAX_FRAME_COUNT = 3600
MAX_FRAME_PIXELS = 1920 * 1080


class VideoRequest(BaseModel):
    video_base64: str


def decode_sampled_frames(raw: bytes):
    import cv2

    if raw[:4] != b"\x1a\x45\xdf\xa3" and raw[4:8] != b"ftyp":
        raise HTTPException(415, "Supported video containers: MP4, MOV, WEBM")
    suffix = ".webm" if raw[:4] == b"\x1a\x45\xdf\xa3" else ".mp4"
    path = None
    cap = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temporary:
            temporary.write(raw)
            path = Path(temporary.name)
        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            raise HTTPException(400, "Could not decode video")
        fps = float(cap.get(cv2.CAP_PROP_FPS))
        count = float(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = float(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = float(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if not all(math.isfinite(n) for n in (fps, count, width, height)) or fps <= 0 or count < 1 or \
           count > MAX_FRAME_COUNT or width < 64 or height < 64 or width * height > MAX_FRAME_PIXELS or \
           count / fps > MAX_DURATION_SECONDS:
            raise HTTPException(413, "Video duration, frame count, or dimensions exceed local screening limits")
        count = int(count)
        duration = count / fps
        frames = []
        # Match the browser's six selections from its 16-position timeline.
        for slot in range(0, 16, 3):
            index = min(count - 1, round((slot + 0.5) * count / 16))
            if frames and index <= frames[-1][0]:
                continue
            if not cap.set(cv2.CAP_PROP_POS_FRAMES, index):
                raise HTTPException(400, "Could not seek to a sampled video frame")
            ok, bgr = cap.read()
            if not ok or bgr is None:
                raise HTTPException(400, "Could not decode a sampled video frame")
            frame_height, frame_width = bgr.shape[:2]
            if frame_width * frame_height > MAX_FRAME_PIXELS:
                raise HTTPException(413, "Decoded video frame exceeds pixel limit")
            scaled_height = max(1, round(frame_height * 480 / frame_width))
            small = cv2.resize(bgr, (480, scaled_height), interpolation=cv2.INTER_AREA)
            encoded_ok, jpg = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, 75])
            if not encoded_ok:
                raise HTTPException(400, "Could not encode a sampled video frame")
            frames.append((index, base64.b64encode(jpg.tobytes()).decode("ascii")))
        return duration, int(width), int(height), [(round(i / fps, 3), jpg) for i, jpg in frames]
    finally:
        if cap is not None:
            cap.release()
        if path is not None:
            path.unlink(missing_ok=True)


@router.post("/v1/video/analyze")
def analyze_video(request: VideoRequest):
    if len(request.video_base64) > 4 * math.ceil(MAX_VIDEO_BYTES / 3):
        raise HTTPException(413, "Video exceeds 8 MB")
    try:
        raw = base64.b64decode(request.video_base64, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(400, "Invalid base64 video")
    if not raw or len(raw) > MAX_VIDEO_BYTES:
        raise HTTPException(413, "Video exceeds 8 MB or is empty")
    duration, width, height, samples = decode_sampled_frames(raw)
    from ai_service import app as image_app
    frames = [{"timestampSeconds": timestamp,
               "image": image_app.analyze_image(image_app.ImageRequest(image_base64=jpg))}
              for timestamp, jpg in samples]
    return {"scope": "server_decoded_frames", "frames": frames,
            "samplingNote": "Six or fewer JPEG frames decoded from the original video by the local server; scores are experimental.",
            "videoMetadata": {"durationSeconds": round(duration, 3), "width": width, "height": height}}
