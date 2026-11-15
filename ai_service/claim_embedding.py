"""Optional isolated CPU embedding service. Local pinned files only; never downloads at startup.

Run: VERITAS_CLAIM_EMBEDDING_PATH=<cache> python -m uvicorn
ai_service.claim_embedding:app --host 127.0.0.1 --port 8021
"""
from contextlib import asynccontextmanager
import hashlib
import os
from pathlib import Path
import threading
import time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

MODEL_ID='intfloat/multilingual-e5-small'
REVISION='614241f622f53c4eeff9890bdc4f31cfecc418b3'
# Publisher Hub revision metadata: LFS SHA256 for large files, Git blob IDs for small ones.
FILES={
 'model.safetensors':('sha256','1a55775f53449dac10a2bcbc312469fac40b96d53198c407081a831f81c98477'),
 'tokenizer.json':('sha256','0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39'),
 'sentencepiece.bpe.model':('sha256','cfc8146abe2a0488e9e2a0c56de7952f7c11ab059eca145a0a727afce0db2865'),
 'config.json':('git','60a2a84020f1d74cc53ea9e8c4e91cf4af6c2b68'),
 'tokenizer_config.json':('git','059214673d9d6d2ee319411e2ffec8c024b816d5'),
 'special_tokens_map.json':('git','e0b1d18ecd0ae4ff1d47bd297d910c0cf83e504b'),
}

def verify_snapshot(path):
    path=Path(path)
    for name,(kind,expected) in FILES.items():
        file=path/name
        with file.open('rb') as stream:
            if kind=='sha256':actual=hashlib.file_digest(stream,'sha256').hexdigest()
            else:
                digest=hashlib.sha1(b'blob '+str(file.stat().st_size).encode()+b'\0')
                digest.update(stream.read());actual=digest.hexdigest()
        if actual!=expected:raise ValueError('Pinned embedding file mismatch: '+name)

class Encoder:
    def __init__(self,path):
        import psutil
        if psutil.virtual_memory().available<2*2**30:raise RuntimeError('Embedding load requires 2 GiB available RAM headroom')
        verify_snapshot(path)
        import torch
        from transformers import AutoModel,AutoTokenizer
        torch.set_num_threads(1)
        self.torch=torch
        self.tokenizer=AutoTokenizer.from_pretrained(path,local_files_only=True,trust_remote_code=False)
        self.model=AutoModel.from_pretrained(path,local_files_only=True,trust_remote_code=False,use_safetensors=True).eval()
        self.lock=threading.Lock()

    def encode(self,texts):
        if not texts or len(texts)>128 or sum(map(len,texts))>128000 or any(
            not isinstance(text,str) or not text.startswith(('query: ','passage: ')) or len(text)>12000 for text in texts):
            raise ValueError('Bounded prefixed query/passages required')
        if not self.lock.acquire(blocking=False):raise RuntimeError('Embedding worker busy')
        try:
            result=[]
            with self.torch.inference_mode():
                for i in range(0,len(texts),8):
                    batch=self.tokenizer(texts[i:i+8],padding=True,truncation=True,max_length=512,return_tensors='pt')
                    hidden=self.model(**batch).last_hidden_state
                    mask=batch['attention_mask'].unsqueeze(-1)
                    pooled=(hidden*mask).sum(1)/mask.sum(1)
                    result.extend(self.torch.nn.functional.normalize(pooled,p=2,dim=1).tolist())
            return result
        finally:self.lock.release()

class EmbeddingRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    texts:list[str]=Field(min_length=1,max_length=128)
    modelId:str
    version:str

encoder=None
load_error='Local embedding path not configured'
loading_seconds=None
@asynccontextmanager
async def lifespan(_app):
    global encoder,load_error,loading_seconds
    if os.getenv('VERITAS_CLAIM_EMBEDDING_PATH'):
        try:
            started=time.perf_counter()
            encoder=Encoder(os.environ['VERITAS_CLAIM_EMBEDDING_PATH']);load_error=''
            loading_seconds=time.perf_counter()-started
        except Exception:load_error='Pinned model failed file, resource or runtime validation'
    yield

app=FastAPI(lifespan=lifespan)
@app.get('/health')
def health():
    from ai_service.image_benchmark import memory_usage
    return dict(status='ready' if encoder else 'unavailable',modelId=MODEL_ID,version=REVISION,error=load_error,
                loadingSeconds=loading_seconds,memory=memory_usage(),cpuThreads=1,maxTokens=512,batchSize=8)

@app.post('/v1/embedding')
def embedding(request:EmbeddingRequest):
    if request.modelId!=MODEL_ID or request.version!=REVISION:raise HTTPException(400,'Pinned model identity required')
    if encoder is None:raise HTTPException(503,load_error)
    start=time.perf_counter()
    try:vectors=encoder.encode(request.texts)
    except ValueError as error:raise HTTPException(400,str(error)) from error
    except RuntimeError as error:raise HTTPException(503,str(error)) from error
    return dict(modelId=MODEL_ID,version=REVISION,embeddings=vectors,elapsedSeconds=time.perf_counter()-start)
