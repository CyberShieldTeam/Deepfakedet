// Private stdin/stdout protocol. No HTTP, credentials, repositories or model access.
import {analyzeEpisodeCampaign} from './campaignEpisodes';
import {analyzeDensityCampaignBaseline} from './densityCampaign';
let input='';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) {
  input+=chunk;
  if(Buffer.byteLength(input)>32*1024*1024) throw new Error('Campaign input byte budget exceeded');
}
try {
  const {datasetName,rows,isSimulated,config,coverage}=JSON.parse(input);
  if(!Array.isArray(rows)||rows.length<2||rows.length>3000)throw new Error('Expected 2..3000 observed posts');
  const result=config?.algorithm==='density_baseline_v1'
    ? {...analyzeDensityCampaignBaseline(datasetName,rows,isSimulated,config),algorithm:'density_baseline_v1'}
    : analyzeEpisodeCampaign(datasetName,rows,isSimulated,config,null,coverage);
  process.stdout.write(JSON.stringify({result}));
} catch(error) {
  process.stdout.write(JSON.stringify({error:error instanceof Error?error.message:'Invalid campaign input'}));
}
