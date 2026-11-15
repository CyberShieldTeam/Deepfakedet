"""Optional real-weight transport smoke; fixtures cannot establish detector accuracy."""
import asyncio
import base64
import json
import os
from pathlib import Path

os.environ["VERITAS_FACE_MODEL_ENABLED"] = "1"
os.environ["VERITAS_IMAGE_MODEL_ENABLED"] = "0"
from ai_service import app as service


async def main():
    async with service.lifespan(service.app):
        health = service.health()
        if health["face_classifier"]["status"] != "ready":
            raise RuntimeError(health["face_classifier"]["reason"])
        if health["face_detector"] != "ready":
            raise RuntimeError("YuNet is required for face crops")
        root = Path(__file__).resolve().parents[1] / "test" / "fixtures"
        for path in (root / "face" / "headshot_cc0.jpg",
                     root / "eval" / "genuine" / "charminar_nikon_d60_2013.jpg"):
            result = service.analyze_image(service.ImageRequest(
                image_base64=base64.b64encode(path.read_bytes()).decode("ascii")))
            print(json.dumps({"file": path.name, "classification": result["classification"],
                              "faceCount": len(result["face_boxes"]), "faceModel": result["face_model"]}))


if __name__ == "__main__":
    asyncio.run(main())
