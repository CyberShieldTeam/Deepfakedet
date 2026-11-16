/** Explicitly invoked against one isolated demo run; never discovers a user's default store. */
import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';
const file=process.argv[2];if(!file)throw new Error('Usage: npm run demo:test -- PATH_TO_PRIVATE_RUN_ACCESS_JSON');
const access=JSON.parse(fs.readFileSync(file,'utf8')),store=path.resolve(access.store),base=path.resolve('.model-cache/submission-demo');
if(!store.startsWith(base+path.sep)||!['localhost','127.0.0.1'].includes(new URL(access.url).hostname))throw new Error('Only explicitly isolated loopback demo runs may be tested');
const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','--grep','Engine4.1 actual OCR','--reporter=list'],{stdio:'inherit',windowsHide:true,env:{...process.env,VERITAS_TEST_URL:access.url,VERITAS_TEST_TOKEN:access.token,VERITAS_DEMO_AUTH_UI:'1',VERITAS_SUBMISSION_DEMO:'1',VERITAS_EXPECT_EXTRACTION:'1',VERITAS_EXPECT_ENGINE4:'0',VERITAS_EXPECT_ENGINE43:'0',VERITAS_E42_PROFILE:'baseline',VERITAS_E41_TEST_STORE:store,VERITAS_DEMO_IMAGE:access.image,VERITAS_E41_BROWSER_REPORT:''}});
child.on('error',()=>process.exit(1));child.on('exit',code=>process.exit(code??1));
