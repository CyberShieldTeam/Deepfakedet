"""Exact evidence/derived-input identities, never authenticity measurements."""
import hashlib


def image_trace(raw,source,image):
    return dict(sourceSha256=hashlib.sha256(raw).hexdigest(),sourceBytes=len(raw),format=source.format,
                originalSize=list(source.size),orientedSize=list(image.size),sourceMode=source.mode,
                exifOrientationApplied=source.getexif().get(274,1) not in (None,1),
                decodedRgbSha256=hashlib.sha256(image.tobytes()).hexdigest(),
                conversion='Pillow EXIF transpose then RGB; alpha is discarded, not a display-background composite',
                tensor=None)


def require_headroom(gib):
    import psutil
    if psutil.virtual_memory().available<gib*2**30:raise RuntimeError('INSUFFICIENT_MEMORY_HEADROOM')
