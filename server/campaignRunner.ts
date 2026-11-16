import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import type {CampaignAnalysisResult} from '../src/types';
import type {CampaignCoverage} from './campaignEpisodes';
import type {CoordinationConfig} from './densityCampaign';
export class CampaignRunError extends Error {
  constructor(message:string,public status:number,public code:string){super(message);}
}
export interface CampaignJob {datasetName:string;rows:unknown[];isSimulated:boolean;config?:CoordinationConfig & {algorithm?:string};coverage?:CampaignCoverage}
let busy=false;
/** Single CPU job, no queue. Wall deadline includes startup and serialization. */
export function runCampaign(job:CampaignJob,signal?:AbortSignal,timeoutMs=20000):Promise<CampaignAnalysisResult> {
  if(busy)return Promise.reject(new CampaignRunError('Campaign analysis is busy; retry later.',429,'CAMPAIGN_BUSY'));
  if(signal?.aborted)return Promise.reject(new CampaignRunError('Campaign analysis interrupted; no complete result.',503,'CAMPAIGN_INTERRUPTED'));
  const input=JSON.stringify(job);
  if(Buffer.byteLength(input)>32*1024*1024)return Promise.reject(new CampaignRunError('Campaign input byte budget exceeded.',413,'CAMPAIGN_INPUT_LIMIT'));
  busy=true;
  return new Promise((resolve,reject)=>{
    // The worker does not inherit provider credentials, auth or investigation paths.
    const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|TEMP|TMP|LOCALAPPDATA|APPDATA|HOME|USERPROFILE)$/i.test(key)));
    const child=spawn(process.execPath,['--max-old-space-size=768','--import','tsx',fileURLToPath(new URL('./campaignWorker.ts',import.meta.url))],{stdio:['pipe','pipe','pipe'],windowsHide:true,env});
    let output='',bytes=0,settled=false,failure:CampaignRunError|undefined;
    const fail=(error:CampaignRunError)=>{
      failure??=error;
      // Only this owned child tree is targeted. Do not kill shared dev servers.
      if(child.pid&&process.platform==='win32')spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).on('error',()=>child.kill()).on('exit',code=>{if(code!==0)child.kill();});
      else child.kill('SIGKILL');
    };
    const abort=()=>fail(new CampaignRunError('Campaign analysis interrupted; no complete result.',503,'CAMPAIGN_INTERRUPTED'));
    const timer=setTimeout(()=>fail(new CampaignRunError('Campaign analysis deadline exceeded; no complete result.',504,'CAMPAIGN_TIMEOUT')),Math.max(1,Math.min(timeoutMs,20000)));
    const finish=(error?:Error,result?:CampaignAnalysisResult)=>{
      if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);busy=false;
      if(error)reject(error);else resolve(result!);
    };
    signal?.addEventListener('abort',abort,{once:true});
    child.stdout.setEncoding('utf8');
    child.stdout.on('data',(chunk:string)=>{
      bytes+=Buffer.byteLength(chunk);
      if(bytes>64*1024*1024)fail(new CampaignRunError('Campaign output budget exceeded; no complete result.',503,'CAMPAIGN_OUTPUT_LIMIT'));
      else output+=chunk;
    });
    // Drain stderr without retaining arbitrary data or leaking source text.
    child.stderr.on('data',()=>{});
    child.stdin.on('error',()=>{});
    child.on('error',()=>finish(new CampaignRunError('Campaign worker unavailable; no complete result.',503,'CAMPAIGN_WORKER_UNAVAILABLE')));
    child.on('close',(code)=>{
      if(failure)return finish(failure);
      if(code!==0)return finish(new CampaignRunError('Campaign worker failed or reached its resource limit; no complete result.',503,'CAMPAIGN_WORKER_FAILED'));
      try {
        const parsed=JSON.parse(output);
        if(parsed.error)return finish(new CampaignRunError(parsed.error,400,'CAMPAIGN_INVALID_INPUT'));
        if(!parsed.result||!Array.isArray(parsed.result.nodes)||!Array.isArray(parsed.result.edges))throw new Error('Worker contract');
        finish(undefined,parsed.result);
      }catch{return finish(new CampaignRunError('Campaign worker output invalid; no complete result.',503,'CAMPAIGN_WORKER_PROTOCOL'));}
    });
    child.stdin.end(input);
  });
}
