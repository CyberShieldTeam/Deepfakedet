import {parentPort,workerData} from 'node:worker_threads';
const {buildCorrelation}=await import('./correlation.ts');
try{
 const result=buildCorrelation(workerData.input,workerData.contexts);
 if(Buffer.byteLength(JSON.stringify(result))>24*1024*1024)parentPort.postMessage({error:'Correlation output exceeds 24 MiB; narrow the investigation.',code:'CORRELATION_OUTPUT_LIMIT',status:503});
 else parentPort.postMessage({result});
}
catch{parentPort.postMessage({error:'Invalid correlation input or context references'});}
