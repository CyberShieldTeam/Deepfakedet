import fs from 'node:fs';import {performance} from 'node:perf_hooks';import {createHash} from 'node:crypto';
import {mediaDiagnostics,claimDiagnostics,networkDiagnostics} from '../server/analysisDiagnostics';
const [input,output]=process.argv.slice(2);if(!output||fs.existsSync(output))throw new Error('New output required');
const cases=JSON.parse(fs.readFileSync(input,'utf8')).cases;
const results=cases.map((c:any)=>{
 const run=()=>c.kind==='media'?mediaDiagnostics(c.api,c.api.analysis.stages,1):c.kind==='claim'?claimDiagnostics(c.api,1):networkDiagnostics(c.api,c.api.analysis.counts.importedPosts,1);
 const times:number[]=[];for(let i=0;i<1000;i++){const start=performance.now();run();times.push(performance.now()-start);}times.sort((a,b)=>a-b);
 return {name:c.name,iterations:1000,medianMs:times[500],p95Ms:times[950],diagnosticJsonBytes:Buffer.byteLength(JSON.stringify(c.api.analysis))};
});
fs.writeFileSync(output,JSON.stringify({scope:'authored_local_diagnostic_helper_microbenchmark_not_end_to_end_performance',sourceSha256:createHash('sha256').update(fs.readFileSync('server/analysisDiagnostics.ts')).digest('hex'),results,limitations:['Local warm-JIT helper timing only; excludes inference, network, serialization, logging and browser rendering.','Evidence counts are heterogeneous retained observation items, not independent evidence or confidence.']},null,2),{flag:'wx'});console.log({output,results});
