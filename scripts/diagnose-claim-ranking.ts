/** Real paired ranking diagnostic, not independent accuracy evaluation. */
import fs from 'node:fs';import crypto from 'node:crypto';
import {wikipediaEvidence} from '../server/wikipediaEvidence';import {rankEvidence} from '../server/claimVerification';import {rerankEvidence,shutdownReranker} from '../server/claimReranking';
const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('New output required');
Object.assign(process.env,{VERITAS_WIKIPEDIA_ENABLED:'1',VERITAS_WIKIPEDIA_LANGUAGE:'en',VERITAS_RERANKER_ENABLED:'1'});
try{
const claim='The Charminar in Hyderabad was built in 1591.',retrieval=await wikipediaEvidence(claim),baseline=await rankEvidence(claim,retrieval.items,false),reranker=await rerankEvidence(claim,baseline.ranked,'en');
const report={at:new Date().toISOString(),scope:'Real live paired candidate/ranking diagnostic for the user-reported historical example; not a labelled independent benchmark',claim,query:retrieval.state.query,provider:retrieval.state,baseline:baseline.ranked.map((x,i)=>({rank:i+1,title:x.title,url:x.url,lexicalScore:x.lexicalScore,passageSha256:crypto.createHash('sha256').update(x.excerpt).digest('hex')})),reranked:reranker.ranked.map((x,i)=>({rank:i+1,title:x.title,url:x.url})),analysis:reranker.analysis,causalScope:'Same candidates, same passage bytes and unchanged BM25; only optional relevance reranking changes order. Live current search can differ from prior sessions.'};
fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({baseline:report.baseline,reranked:report.reranked,status:report.analysis.status}));
}finally{shutdownReranker()}
