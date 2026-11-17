"""Bounded publisher-range WaveFake/LJSpeech research acquisition, no full archives."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile
from urllib.request import Request,urlopen
import zipfile

WAVE_URL='https://zenodo.org/records/5642694/files/generated_audio.zip?download=1'
WAVE_BYTES=28918626084
LJ_URL='https://data.keithito.com/data/speech/LJSpeech-1.1.tar.bz2'
MAX_WAVE_BYTES=80*1024*1024
MAX_LJ_BYTES=48*1024*1024


class RangeArchive(io.RawIOBase):
    def __init__(self):self.position=0;self.transferred=0
    def readable(self):return True
    def seekable(self):return True
    def tell(self):return self.position
    def seek(self,offset,whence=0):
        position=offset if whence==0 else self.position+offset if whence==1 else WAVE_BYTES+offset
        if not 0<=position<=WAVE_BYTES:raise ValueError('RANGE_SEEK_LIMIT')
        self.position=position;return position
    def read(self,size=-1):
        size=WAVE_BYTES-self.position if size<0 else min(size,WAVE_BYTES-self.position)
        if not size:return b''
        if size>32*1024*1024 or self.transferred+size>MAX_WAVE_BYTES:raise ValueError('RANGE_BYTE_BUDGET')
        end=self.position+size-1
        request=Request(WAVE_URL,headers={'Range':f'bytes={self.position}-{end}','User-Agent':'VERITAS-AI-bounded-noncommercial-research'})
        with urlopen(request,timeout=30) as response:
            if response.status!=206 or response.headers.get('Content-Range')!=f'bytes {self.position}-{end}/{WAVE_BYTES}':raise ValueError('RANGE_UNSUPPORTED_OR_IDENTITY_CHANGED')
            raw=response.read(size+1)
        if len(raw)!=size:raise ValueError('RANGE_SIZE_MISMATCH')
        self.position+=size;self.transferred+=size;return raw


class LimitedStream:
    def __init__(self,response):self.response=response;self.bytes=0
    def read(self,size=-1):
        if size<0 or self.bytes+size>MAX_LJ_BYTES:raise ValueError('GENUINE_STREAM_BUDGET')
        data=self.response.read(size);self.bytes+=len(data);return data


def acquire(root):
    manifest=root/'acquired.json'
    if manifest.exists():raise ValueError('ACQUISITION_EXISTS')
    root.mkdir(parents=True,exist_ok=True)
    # Central-directory names are publisher metadata, not ground-truth inferred from sound.
    remote=RangeArchive();archive=zipfile.ZipFile(remote)
    entries=[i for i in archive.infolist() if re.search(r'LJ\d{3}-\d{4}',i.filename) and i.filename.lower().endswith('.wav') and 0<i.file_size<=2*1024*1024]
    generators=sorted({i.filename.split('/')[0] for i in entries})
    print(json.dumps({'waveMetadataBytes':remote.transferred,'generatorDirectories':generators,'eligibleEntries':len(entries)}),flush=True)
    # The designated generators must be present; no selecting replacements by model scores.
    candidates={}
    for info in entries:
        identity=re.search(r'LJ\d{3}-\d{4}',info.filename)[0]
        candidates.setdefault(identity,[]).append(info)
    matched={identity:items for identity,items in candidates.items() if any('ljspeech_melgan/' in i.filename for i in items) and any('ljspeech_waveglow/' in i.filename for i in items)}
    if not matched:raise ValueError('EXPECTED_PUBLISHER_GENERATOR_LAYOUT_MISSING')
    real=[];downloaded=[]
    with urlopen(Request(LJ_URL,headers={'User-Agent':'VERITAS-AI-bounded-speech-research'}),timeout=30) as response:
        stream=LimitedStream(response)
        with tarfile.open(fileobj=stream,mode='r|bz2') as source:
            for member in source:
                identity=Path(member.name).stem
                if not member.isfile() or not member.name.endswith('.wav') or identity not in matched or member.size>2*1024*1024:continue
                raw=source.extractfile(member).read(member.size+1)
                if len(raw)!=member.size:raise ValueError('SOURCE_MEMBER_SIZE')
                target=root/(identity+'-genuine.wav')
                with target.open('xb') as file:file.write(raw)
                real.append(dict(id=identity,label='genuine',generator='human_Linda_Johnson',speaker='Linda Johnson',source=LJ_URL,member=member.name,path=target.name,sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw),license='LJSpeech 1.1 / LibriVox public domain; original MP3-derived recordings'))
                if len(real)==48:break
    if len(real)!=48:raise ValueError('INSUFFICIENT_MATCHED_GENUINE_POOL')
    # Store both generators for frozen generator-disjoint selection, without scoring.
    for row in real:
        for generator in ['ljspeech_melgan','ljspeech_waveglow']:
            matches=[i for i in matched[row['id']] if generator+'/' in i.filename]
            if len(matches)!=1:raise ValueError('AMBIGUOUS_PUBLISHER_MEMBER')
            info=matches[0];raw=archive.read(info)
            target=root/(row['id']+'-'+generator+'.wav')
            with target.open('xb') as file:file.write(raw)
            downloaded.append(dict(id=row['id'],label='synthetic',generator=generator,speaker='LJSpeech-conditioned single voice',source=WAVE_URL,member=info.filename,path=target.name,sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw),zipCRC32=f'{info.CRC:08x}',license='WaveFake CC BY-SA 4.0, Joel Frank and Lea Schönherr; LJSpeech-based English subsets only'))
    result=dict(schemaVersion=1,scope='Small bounded single-speaker research pool, not speaker/source-independent deployment validation',sourceVersions={'ljspeech':'1.1','wavefake':'Zenodo 5642694'},wholeArchiveHashesVerified=False,declaredWaveArchiveMd5='76b3e62d69f866e57ad6b1debaff434b',waveRangeBytes=remote.transferred,ljStreamBytes=stream.bytes,rows=real+downloaded,limitations=['Only partial archives transferred; full publisher archive checksum is not verified. Exact member hashes and WaveFake ZIP CRC retained.', 'Initial streaming pool is order/size-limited, single English speaker, book/source recording dependence remains.', 'WaveFake contains vocoder/TTS reconstruction, not a labelled voice-conversion or multilingual benchmark.'])
    with manifest.open('x',encoding='utf8') as file:json.dump(result,file,ensure_ascii=False,indent=2)
    print(json.dumps({'recordings':len(result['rows']),'waveRangeBytes':remote.transferred,'ljStreamBytes':stream.bytes,'wholeArchiveDownloaded':False}),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output-root',type=Path,required=True);acquire(parser.parse_args().output_root)
