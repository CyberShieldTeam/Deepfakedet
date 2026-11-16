/** Check repository-relative Markdown targets; no remote fetching or private-cache traversal. */
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
const root=process.cwd(),files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','--','*.md'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
let checked=0;const broken=[];
for(const file of files){const text=fs.readFileSync(file,'utf8').replace(/```[\s\S]*?```/g,'');for(const match of text.matchAll(/!?\[[^\]]*\]\((?:<([^>]+)>|([^\)]+))\)/g)){
 const href=(match[1]||match[2]).split(/\s+"/)[0].trim();if(!href||href.startsWith('#')||/^[a-z][a-z0-9+.-]*:/i.test(href))continue;
 const target=path.resolve(path.dirname(path.resolve(file)),decodeURIComponent(href.split('#')[0]));checked++;
 if(!target.startsWith(root+path.sep)||!fs.existsSync(target))broken.push({file,target:href});
}}
if(broken.length){console.error(JSON.stringify({broken},null,2));process.exit(1)}
console.log(`${checked} repository-relative Markdown targets exist. Remote URLs/anchors are not fetched or validated.`);
