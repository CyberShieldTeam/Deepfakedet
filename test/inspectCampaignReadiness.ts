/** Preserve existing Engine 3 behavior; authored scenarios identify next-slice risks. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {analyzeDensityCampaign} from '../server/densityCampaign';
const output=process.argv[2];if(!output||fs.existsSync(output))throw new Error('New output path required');
const post=(id:string,round:number,content:string)=>({account_id:id,post_id:`${id}-${round}`,timestamp:new Date(Date.UTC(2026,0,1)+round*30000).toISOString(),content,url:'https://example.org/public-news',hashtags:[]});
const scenarios=[
 {name:'single_public_news_event',rows:['a','b','c','d'].map(id=>post(id,0,'Fictional public news bulletin: road reopened today.')),intendedContext:'Independent public sharing, one event; software control only'},
 {name:'repeated_legitimate_public_bulletin',rows:['a','b','c','d'].flatMap(id=>[0,1,2].map(n=>post(id,n,'Fictional public news bulletin: road reopened today.'))),intendedContext:'Legitimate repeated bulletins in one minute; recurrence does not establish independent coordinated episodes'},
 {name:'shared_url_different_topics',rows:['a','b','c'].map((id,i)=>post(id,i,['Fictional rain forecast','Fictional football result','Fictional school holiday'][i])),intendedContext:'Unrelated topics sharing the same publisher URL'},
];
const results=scenarios.map(s=>{const r=analyzeDensityCampaign(s.name,s.rows,false);return {name:s.name,intendedContext:s.intendedContext,
 posts:r.totalPosts,accounts:r.totalAccounts,classification:r.classification,suspiciousAccounts:r.nodes.filter(n=>n.suspicious).length,
 edges:r.edges,clusters:r.clusters.length,truncated:r.truncated,independentGroundTruth:null};});
fs.writeFileSync(output,JSON.stringify({scope:'authored_engine3_architecture_controls_not_accuracy',
 codeSha256:createHash('sha256').update(fs.readFileSync('server/densityCampaign.ts')).digest('hex'),results,
 limitations:['Scenarios describe intended fictional contexts; not independent account coordination labels.',
 'Existing algorithm intentionally unchanged. A flagged legitimate-style scenario demonstrates a design risk, not a measured real-world false-positive rate.']},null,2),{flag:'wx'});
console.log(JSON.stringify(results.map(({name,classification,suspiciousAccounts})=>({name,classification,suspiciousAccounts}))));
