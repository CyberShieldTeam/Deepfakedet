import os,unittest,asyncio
from unittest.mock import patch
from fastapi import FastAPI
from ai_service.service_auth import install_service_auth
from starlette.requests import Request
from starlette.responses import JSONResponse

class ServiceAuthTests(unittest.TestCase):
    def test_hosted_service_refuses_missing_secret(self):
        with patch.dict(os.environ,{'VERITAS_SERVICE_PUBLIC':'1','VERITAS_AI_SERVICE_TOKEN':''}):
            with self.assertRaises(RuntimeError):install_service_auth(FastAPI())
    def test_local_mode_remains_compatible(self):
        with patch.dict(os.environ,{'VERITAS_SERVICE_PUBLIC':'0','VERITAS_AI_SERVICE_TOKEN':''}):
            app=FastAPI();install_service_auth(app);self.assertEqual(len(app.user_middleware),1)
    def test_bounded_token_configuration(self):
        with patch.dict(os.environ,{'VERITAS_AI_SERVICE_TOKEN':'short'}):
            with self.assertRaises(RuntimeError):install_service_auth(FastAPI())
    def test_authorization_busy_and_recovery(self):
        token='isolated-test-service-credential-000000000000'
        with patch.dict(os.environ,{'VERITAS_SERVICE_PUBLIC':'1','VERITAS_AI_SERVICE_TOKEN':token}):
            app=FastAPI();install_service_auth(app)
        middleware=app.user_middleware[0].kwargs['dispatch']
        def request(value=None,path='/v1/test'):
            return Request({'type':'http','method':'POST','path':path,'scheme':'http','server':('test',80),'query_string':b'','headers':[] if value is None else [(b'x-veritas-service-token',value)]})
        async def run():
            async def complete(_):return JSONResponse({'actualHandler':True})
            for value in [None,b'wrong',b'\xff']:
                self.assertEqual((await middleware(request(value),complete)).status_code,401)
            self.assertEqual((await middleware(request(path='/health'),complete)).status_code,200)
            started=asyncio.Event();release=asyncio.Event()
            async def blocked(_):started.set();await release.wait();return JSONResponse({'done':True})
            pending=asyncio.create_task(middleware(request(token.encode()),blocked));await started.wait()
            self.assertEqual((await middleware(request(token.encode()),complete)).status_code,429)
            release.set();await pending
            self.assertEqual((await middleware(request(token.encode()),complete)).status_code,200)
        asyncio.run(run())
