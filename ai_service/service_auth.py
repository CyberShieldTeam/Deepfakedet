"""Opt-in private service credential and one-request admission for hosted inference."""
import hmac
import os
from starlette.responses import JSONResponse

def install_service_auth(app):
    token=os.getenv('VERITAS_AI_SERVICE_TOKEN','').strip()
    hosted=os.getenv('VERITAS_SERVICE_PUBLIC','0')=='1'
    if (hosted or token) and len(token)<32:
        raise RuntimeError('Hosted Python service requires a server-only token of at least32characters')
    active=False
    @app.middleware('http')
    async def service_boundary(request,call_next):
        nonlocal active
        if request.url.path=='/health':return await call_next(request)
        if token and not hmac.compare_digest(request.headers.get('X-Veritas-Service-Token','').encode('utf8'),token.encode('utf8')):
            return JSONResponse({'detail':'Service authorization required'},status_code=401)
        if hosted and request.method=='POST':
            if active:return JSONResponse({'detail':'Media service busy; retry later'},status_code=429)
            active=True
            try:return await call_next(request)
            finally:active=False
        return await call_next(request)
