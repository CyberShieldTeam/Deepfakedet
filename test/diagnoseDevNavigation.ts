/** Bounded network evidence for dev navigation; never increases product/test deadlines. */
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const base=process.env.VERITAS_TEST_URL || 'http://127.0.0.1:3017';
const probes=[];
for(const path of ['/', '/src/main.tsx', '/api/health']) {
  const start=performance.now();
  try {
    const response=await fetch(base+path,{signal:AbortSignal.timeout(5000)});
    const body=await response.text();
    probes.push({path,status:response.status,elapsedMs:performance.now()-start,bytes:body.length});
  } catch(error) { probes.push({path,error:String(error),elapsedMs:performance.now()-start}); }
}
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const pending=new Set<string>(), failures:unknown[]=[], responses:unknown[]=[], errors:string[]=[];
page.on('request',r=>pending.add(new URL(r.url()).pathname));
page.on('requestfinished',r=>pending.delete(new URL(r.url()).pathname));
page.on('requestfailed',r=>{pending.delete(new URL(r.url()).pathname);failures.push({path:new URL(r.url()).pathname,error:r.failure()});});
page.on('response',r=>responses.push({path:new URL(r.url()).pathname,status:r.status()}));
page.on('pageerror',e=>errors.push(e.message.slice(0,500)));
await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//,route=>route.abort());
let navigationError=null;
const started=performance.now();
try { await page.goto(base,{waitUntil:'domcontentloaded',timeout:12000}); }
catch(error){navigationError=String(error);}
const report={probes,navigationMs:performance.now()-started,navigationError,errors,failures,responses,pending:[...pending],
  bodyText:(await page.locator('body').innerText({timeout:1000}).catch(()=>'' )).slice(0,1200)};
await writeFile(process.env.VERITAS_NAV_REPORT || 'reports/dev_navigation_before.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
await browser.close();
