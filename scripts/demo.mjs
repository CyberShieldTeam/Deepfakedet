/** Real application + preparation service, isolated authored corpus/store and ephemeral auth. */
import fs from 'node:fs';import path from 'node:path';import net from 'node:net';import crypto from 'node:crypto';import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';import {verifiedOcrModel} from '../server/extraction.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
const args=process.argv.slice(2),get=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1]};
const allowed=new Set(['--production','--python','--port','--python-port']);
for(let i=0;i<args.length;i++){if(!allowed.has(args[i]))throw new Error('Unknown demo option: '+args[i]);if(args[i]!=='--production'){if(!args[i+1]||args[i+1].startsWith('--'))throw new Error('Missing demo option value');i++;}}
const production=args.includes('--production'),port=Number(get('--port','3000')),pythonPort=Number(get('--python-port','8001'));
if(![port,pythonPort].every(p=>Number.isInteger(p)&&p>0&&p<=65535)||port===pythonPort)throw new Error('Distinct valid application/Python ports required');
const python=path.resolve(get('--python',process.platform==='win32'?'.venv-demo/Scripts/python.exe':'.venv-demo/bin/python'));
if(!fs.existsSync(python))throw new Error('Create .venv-demo and install ai_service/requirements-demo.txt, or pass --python PATH');
if(production&&!fs.existsSync('dist/index.html'))throw new Error('Production build missing; run npm run build first');
verifiedOcrModel();
const manifest=JSON.parse(fs.readFileSync('fixtures/submission/manifest.json','utf8'));
if(crypto.createHash('sha256').update(fs.readFileSync('fixtures/submission/notice.png')).digest('hex')!==manifest.sha256)throw new Error('Authored image hash mismatch');
async function available(p){await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',()=>reject(new Error(`Port ${p} is occupied; choose another port, do not stop unrelated services`)));server.listen(p,'127.0.0.1',()=>server.close(resolve));});}
await available(port);await available(pythonPort);
fs.mkdirSync('.model-cache/submission-demo',{recursive:true});const directory=fs.mkdtempSync(path.resolve('.model-cache/submission-demo/run-'));
const store=path.join(directory,'investigations.json'),token=crypto.randomBytes(32).toString('hex'),url=`http://localhost:${port}`,access=path.join(directory,'access.json');
fs.writeFileSync(store,'[]',{flag:'wx',mode:0o600});
const env={...process.env};for(const key of Object.keys(env))if(/^VERITAS_(IMAGE|AUDIO|EMBEDDING|FACE)_/.test(key))delete env[key];
Object.assign(env,{NODE_ENV:production?'production':'development',VERITAS_EMBEDDED:'false',PORT:String(port),VERITAS_HOST:'127.0.0.1',DISABLE_HMR:'true',APP_GEMINI_API_KEY:'MY_DISABLED',GOOGLE_FACT_CHECK_API_KEY:'',VERITAS_EMBEDDING_ENDPOINT:'',VERITAS_USERS:JSON.stringify({[token]:'local-analyst'}),VERITAS_STORE:store,VERITAS_PUBLIC_ORIGIN:url,VERITAS_DEMO_FEED:'false',VERITAS_AI_SERVICE_URL:`http://127.0.0.1:${pythonPort}`,VERITAS_CLAIM_CORPUS:path.resolve('fixtures/submission/corpus.json'),VERITAS_CLAIM_CORPUS_SHA256:crypto.createHash('sha256').update(fs.readFileSync('fixtures/submission/corpus.json')).digest('hex')});
const children=[];let stopping=false;
env.VERITAS_AUTHORED_DEMO='1';
env.VERITAS_WIKIPEDIA_ENABLED='0';
env.VERITAS_OCR_PREPARATION_URL=env.VERITAS_AI_SERVICE_URL;env.VERITAS_AI_SERVICE_URL='';
function stop(code){if(stopping)return;stopping=true;for(const child of children)if(child.exitCode===null)child.kill('SIGTERM');const force=setTimeout(()=>process.exit(code),4000);force.unref();Promise.all(children.map(child=>child.exitCode!==null?Promise.resolve():new Promise(resolve=>child.once('exit',resolve)))).then(()=>process.exit(code));}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop(0));
process.on('message',message=>{if(message?.type==='stop')stop(0)});
function launch(command,argv){const child=spawn(command,argv,{cwd:root,env,stdio:['ignore','inherit','inherit'],windowsHide:true});children.push(child);child.on('error',()=>{console.error('Demo dependency process failed to start');stop(1)});child.on('exit',code=>{if(!stopping){console.error('Demo service exited; saved run retained:',directory);stop(code||1)}});return child;}
async function wait(endpoint,check){const deadline=Date.now()+30000;while(Date.now()<deadline&&!stopping){try{const r=await fetch(endpoint,{signal:AbortSignal.timeout(1000)});if(r.ok&&check(await r.json()))return;}catch{}await new Promise(r=>setTimeout(r,150));}throw new Error('Service readiness timed out; inspect the startup error above');}
try{
 launch(python,['-m','uvicorn','ai_service.ocr_app:app','--host','127.0.0.1','--port',String(pythonPort)]);
 await wait(env.VERITAS_OCR_PREPARATION_URL+'/health',h=>h.ocrPreparation==='ready');
 launch(process.execPath,['--import','tsx','server.ts']);await wait(`http://127.0.0.1:${port}/api/health`,h=>h.authenticationMode==='required');
 fs.writeFileSync(access,JSON.stringify({url,token,store,mode:env.NODE_ENV,image:path.resolve('fixtures/submission/notice.png'),scope:'AUTHORED DEMONSTRATION, real OCR; no external fact-check/model verdict'},null,2),{flag:'wx',mode:0o600});
 process.send?.({type:'ready',access});
 if(process.env.VERITAS_DEMO_AUTOMATION!=='1')console.log(`\nAUTHORED DEMONSTRATION — real OCR, fictional local evidence, no external providers.\nOpen ${url}\nManage access → token: ${token}\nPrivate run configuration: ${access}\nCtrl+C stops both services; saved investigations remain.\n`);
}catch(error){console.error(error.message);stop(1)}
