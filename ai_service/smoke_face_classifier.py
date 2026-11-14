"""Real-weight face inference on attributed fixtures; no accuracy benchmark."""
import base64
import json
import os
from pathlib import Path
from ai_service import app, face_service


def main():
    os.environ["VERITAS_FACE_MODEL_ENABLED"] = "1"
    face_service.load_model()
    app.load_face_detector()
    print(json.dumps(face_service.health()))
    if face_service.model is None or app.face_detector is None:
        raise SystemExit("Pinned face classifier and YuNet must both be ready")
    root = Path(__file__).resolve().parents[1] / "test" / "fixtures" / "face"
    for name in ("headshot_cc0.jpg", "portrait_cc0.jpg"):
        data = base64.b64encode((root / name).read_bytes()).decode("ascii")
        result = app.analyze_image(app.ImageRequest(image_base64=data))
        print(json.dumps({"file": name, "classification": result["classification"],
                          "face_manipulation": result["face_manipulation"]}))


if __name__ == "__main__":
    main()
