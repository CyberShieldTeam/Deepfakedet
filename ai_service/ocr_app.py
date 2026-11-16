"""Optional preparation-only service. Real OCR remains in the existing bounded Node worker."""
from fastapi import FastAPI
from ai_service.extraction_prepare import router

app = FastAPI(title='VERITAS bounded OCR preparation')
app.include_router(router)

@app.get('/health')
def health():
    # Do not advertise a ready classifier to existing model-health consumers.
    return dict(status='unavailable', service='ocr-preparation', ocrPreparation='ready',
                reason='Preparation-only service; image/audio/face classifiers are not installed here.')
