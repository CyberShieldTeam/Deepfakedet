import {Worker} from 'node:worker_threads';
import type {CorrelationProjection} from './correlation';
import type {CorrelationResult,MediaContext} from '../src/correlationTypes';
let active=false;
export class CorrelationError extends Error{constructor(message:string,public status:number,public code:string){super(message);}}
export function runCorrelation(input:CorrelationProjection,contexts:MediaContext[],signal?:AbortSignal,timeoutMs=15000):Promise<CorrelationResult>{
 if(active)return Promise.reject(new CorrelationError('Correlation is busy; retry later.',429,'CORRELATION_BUSY'));
 if(Buffer.byteLength(JSON.stringify([input,contexts]))>12*1024*1024)return Promise.reject(new CorrelationError('Correlation projection exceeds 12 MiB; narrow the investigation.',413,'CORRELATION_INPUT_LIMIT'));
 if(signal?.aborted)return Promise.reject(new CorrelationError('Correlation interrupted.',503,'CORRELATION_INTERRUPTED'));
 active=true;
 return new Promise((resolve,reject)=>{
  let worker:Worker;
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|TEMP|TMP|LOCALAPPDATA|APPDATA|HOME|USERPROFILE)$/i.test(key)));
  try{worker=new Worker(new URL('./correlationWorker.mjs',import.meta.url),{workerData:{input,contexts},env,execArgv:['--import','tsx'],resourceLimits:{maxOldGenerationSizeMb:512,maxYoungGenerationSizeMb:32,stackSizeMb:4}});}
  catch{active=false;reject(new CorrelationError('Correlation worker unavailable.',503,'CORRELATION_UNAVAILABLE'));return;}
  let done=false;
  const finish=async(error?:Error,result?:CorrelationResult)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);await worker.terminate();active=false;if(error)reject(error);else resolve(result!);};
  const abort=()=>void finish(new CorrelationError('Correlation interrupted; no new graph saved.',503,'CORRELATION_INTERRUPTED'));
  const timer=setTimeout(()=>void finish(new CorrelationError('Correlation deadline exceeded; no new graph saved.',504,'CORRELATION_TIMEOUT')),Math.min(15000,Math.max(1,timeoutMs)));
  signal?.addEventListener('abort',abort,{once:true});
  worker.on('message',m=>{if(m.error)void finish(new CorrelationError(m.error,m.status??400,m.code??'CORRELATION_INVALID_INPUT'));else if(m.result?.schemaVersion===1&&m.result.investigationId===input.id)void finish(undefined,m.result);else void finish(new CorrelationError('Correlation protocol failed.',503,'CORRELATION_PROTOCOL'));});
  worker.on('error',()=>void finish(new CorrelationError('Correlation worker failed or exhausted its budget.',503,'CORRELATION_WORKER_FAILED')));
  worker.on('exit',()=>{if(!done)void finish(new CorrelationError('Correlation worker exited without a graph.',503,'CORRELATION_WORKER_FAILED'));});
 });
}
