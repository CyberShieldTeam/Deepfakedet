"""Pinned cached media assets. Runtime lookup never downloads or executes remote code."""
import hashlib
from pathlib import Path

MODELS={
 'dima':{'id':'dima806/ai_vs_real_image_detection','revision':'9d17b51b9367d6b5720ac81dc339455c45d50ae3','license':'Apache-2.0','files':{
  'model.safetensors':(343223968,'sha256','0acd0809a91fbda050c043f3da7365337400c55919df09a19e35b894688ca742'),
  'config.json':(720,'git','c069301c3ae4d9f630235e50c6d4dbf1cf1abe8e'),
  'preprocessor_config.json':(325,'git','273d24924a8bd10227b532d603484f165dcb0b5d')}},
 'community':{'id':'OwensLab/commfor-model-384','revision':'6076002bf0d9dd37537f965ee2f06f826c333b61','license':'MIT','files':{
  'model.safetensors':(87262324,'sha256','b89f36275f3bf5e2b040eee36597a8f19db051bff9a473a9cf7b2466284fb387'),
  'config.json':(116,'git','3dabc9120aff4c1a1f57f1db87489c0af5236ced')}},
 'sdxl':{'id':'Organika/sdxl-detector','revision':'b37fede8562cb72b89ec201c0987f96ba21b518a','license':'CC-BY-NC-3.0','files':{
  'model.safetensors':(347498816,'sha256','f8809f67fbbf4b455b13aaebf2bfc90192e7c6c881fd8efce0eb51fba9a06e5c'),
  'config.json':(1130,'git','321d15454e002727090950a4e19c899b1f17c751'),
  'preprocessor_config.json':(337,'git','c51f9953abca17af652063d4d341ede2cfda7397')}},
 'face':{'id':'sakshamkr1/deitfake-v2','revision':'f70338d328ba268d2b9d5c6af11044cf0b0e1400','license':'Apache-2.0','files':{
  'model.safetensors':(343223968,'sha256','da21b55e34cf185b38f65fc3c6b8c433708e23ea47c407aa675804de0194328e'),
  'config.json':(710,'git','b4e95c4b8c7ed5523c5192e28b71c6c2d5c2b86f'),
  'preprocessor_config.json':(351,'git','658ffceeabf492d50f178a281293c1c3e26d0928')}}}


def verify_file(path,spec):
    size,kind,expected=spec
    if path.stat().st_size!=size:raise ValueError('PINNED_SIZE_MISMATCH')
    with path.open('rb') as stream:
        if kind=='sha256':actual=hashlib.file_digest(stream,'sha256').hexdigest()
        else:
            result=hashlib.sha1(b'blob '+str(size).encode()+b'\0');result.update(stream.read());actual=result.hexdigest()
    if actual!=expected:raise ValueError('PINNED_HASH_MISMATCH')


def cached_snapshot(kind,override=None):
    spec=MODELS[kind]
    if override:root=Path(override)
    else:
        from huggingface_hub import hf_hub_download
        root=Path(hf_hub_download(spec['id'],'model.safetensors',revision=spec['revision'],local_files_only=True)).parent
    for name,pin in spec['files'].items():verify_file(root/name,pin)
    return root


def tensor_fingerprint(tensor):
    value=tensor.detach().cpu().contiguous()
    return {'sha256':hashlib.sha256(value.numpy().tobytes()).hexdigest(),'shape':list(value.shape),'dtype':str(value.dtype)}
