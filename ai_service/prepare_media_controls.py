"""Private, explicitly procedural transport controls; no invented authenticity labels."""
import io,json,wave,subprocess
from pathlib import Path
from PIL import Image,ImageOps
root=Path('.model-cache/engine1-upgrade');out=root/'controls';out.mkdir(exist_ok=True)
rows=json.loads((root/'image-frozen.json').read_bytes())['rows']
for label,name in [('genuine','recompressed.jpg'),('synthetic','resized.png')]:
    row=next(r for r in rows if r['role']=='development' and r['label']==label)
    with Image.open(root/row['path']) as source:
        image=ImageOps.exif_transpose(source).convert('RGB')
        if label=='genuine':image.save(out/name,quality=60)
        else:image.resize((384,384)).save(out/name)
Image.new('RGB',(200,160),'gray').save(out/'no-face.png')
for name,frames in [('silence.wav',32000),('short.wav',8000)]:
    with wave.open(str(out/name),'wb') as file:
        file.setnchannels(1);file.setsampwidth(2);file.setframerate(16000);file.writeframes(b'\0\0'*frames)
print('Private derived/procedural controls prepared; short control is silence, not labelled speech.')
audio=json.loads((root/'audio-source/frozen.json').read_bytes())['rows']
speech=root/'audio-source'/next(r['path'] for r in audio if r['role']=='development' and r['label']=='genuine')
import soundfile as sf
samples,rate=sf.read(speech);sf.write(out/'short-speech.wav',samples[:rate//2],rate,subtype='PCM_16')
import imageio_ffmpeg
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-nostdin','-y','-v','error','-i','test/fixtures/video/test_pattern_3s.mp4','-i',str(speech),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-t','3',str(out/'pattern-with-speech.mp4')],check=True,timeout=25,capture_output=True)
