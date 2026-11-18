import fs from 'node:fs';import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function cloudRouting(origin){
  if(!origin)throw new Error('VERITAS_BACKEND_ORIGIN must be the actual deployed Render HTTPS origin; frontend-only publication is refused');
  const u=new URL(origin);
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||!u.hostname.endsWith('.onrender.com'))throw new Error('Expected an actual Render HTTPS origin without path or credentials');
  return {version:3,routes:[{src:'/api/(.*)',dest:u.origin+'/api/$1',headers:{'Cache-Control':'no-store','x-vercel-enable-rewrite-caching':'0'}},{handle:'filesystem'},{src:'/(.*)',dest:'/index.html'}]};
}
export function writeCloudOutput(){
  const config=cloudRouting(process.env.VERITAS_BACKEND_ORIGIN);
  const output=path.resolve('.vercel/output');fs.mkdirSync(output,{recursive:true});
  fs.cpSync(path.resolve('dist'),path.join(output,'static'),{recursive:true});
  fs.writeFileSync(path.join(output,'config.json'),JSON.stringify(config,null,2));
  console.log('Generated Vercel static output and uncached same-origin Render API route; no server source or secrets copied');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))writeCloudOutput();
