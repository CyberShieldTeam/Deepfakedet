/** Explicit authored injected-error browser store. Never opens the user's case store. */
import fs from 'node:fs';import path from 'node:path';
import {authoredControlCases,configureControlCorpus} from './engine43Controls';
const mode=process.env.NODE_ENV==='production'?'production':'development';
const root=path.resolve('.model-cache/engine43-injected-'+mode);fs.mkdirSync(root,{recursive:true});
const store=path.join(root,'cases.json');if(fs.existsSync(store))throw new Error('Use a fresh authored-control store; refusing to overwrite reviews');
process.env.VERITAS_STORE=store;process.env.APP_GEMINI_API_KEY='MY_DISABLED';process.env.GOOGLE_FACT_CHECK_API_KEY='';process.env.VERITAS_EMBEDDING_ENDPOINT='';process.env.DISABLE_HMR='true';
process.env.VERITAS_USERS=JSON.stringify({'engine43-browser-token-not-secret-000000':'local-analyst'});
configureControlCorpus(root);fs.writeFileSync(store,JSON.stringify(authoredControlCases()));
await import('../server');
