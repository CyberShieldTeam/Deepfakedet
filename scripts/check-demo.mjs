/** Bounded clean-install browser acceptance runner; credentials never enter logs/artifacts. */
import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';
const started=performance.now(),production=process.argv.includes('--production');
const launcher=spawn(process.execPath,['--import','tsx','scripts/demo.mjs',...process.argv.slice(2)],{stdio:['ignore','pipe','pipe','ipc'],windowsHide:true,env:{...process.env,VERITAS_DEMO_AUTOMATION:'1'}});
let diagnostics='',done=false,readyAt=0;
for(const stream of [launcher.stdout,launcher.stderr])stream.on('data',chunk=>{diagnostics=(diagnostics+chunk.toString()).slice(-12000)});
let tester;
const deadline=setTimeout(()=>finish(1,'Demo acceptance exceeded 120 seconds'),120000);
function finish(code,error){if(done)return;done=true;clearTimeout(deadline);if(error)console.error(error,diagnostics);if(tester&&tester.exitCode===null)tester.kill();if(launcher.connected)launcher.send({type:'stop'});const force=setTimeout(()=>{launcher.kill();process.exit(code)},5000);force.unref();launcher.once('exit',()=>process.exit(code));if(launcher.exitCode!==null)process.exit(code);}
launcher.on('error',error=>finish(1,error.message));launcher.on('exit',code=>{if(!done)finish(code||1,'Demo launcher exited before acceptance completed')});
launcher.on('message',message=>{if(message?.type!=='ready')return;readyAt=performance.now();
 tester=spawn(process.execPath,['scripts/demo-test.mjs',message.access],{stdio:'inherit',windowsHide:true});tester.on('error',error=>finish(1,error.message));tester.on('exit',code=>{
  if(code!==0)return finish(1,'Demo browser acceptance failed');
  const report={scope:'Authored fixture workflow; real OCR and APIs, no independent accuracy',mode:production?'production':'development',startupMs:readyAt-started,browserAndChecksMs:performance.now()-readyAt,os:process.platform,node:process.version,authentication:'real UI session sign-in; no bearer header bypass',processing:'existing OCR/review/retrieval/network/correlation/report APIs',result:'passed'};
  fs.writeFileSync(path.join(path.dirname(message.access),'verification.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report));finish(0);
 });
});
