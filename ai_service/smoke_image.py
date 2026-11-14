"""Run real checkpoint inference on repository fixtures; this is not a benchmark."""
import asyncio
import base64
import json
import os
from pathlib import Path

os.environ["VERITAS_IMAGE_MODEL_ENABLED"] = "1"
from ai_service import app as service


async def main():
    async with service.lifespan(service.app):
        status = service.health()
        if status["status"] != "ready":
            raise RuntimeError(status["reason"])
        fixture_root = Path(__file__).resolve().parents[1] / "test" / "fixtures" / "eval"
        for label in ("genuine", "synthetic"):
            for path in sorted((fixture_root / label).glob("*")):
                if path.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
                    continue
                data = base64.b64encode(path.read_bytes()).decode("ascii")
                result = service.analyze_image(service.ImageRequest(image_base64=data))
                print(json.dumps({"file": path.name, "fixture_label": label,
                                  "classification": result["classification"],
                                  "fake_probability": result["fake_probability"],
                                  "face_analysis": result["face_analysis"],
                                  "processing_ms": result["processing_ms"]}))


if __name__ == "__main__":
    asyncio.run(main())
