/** Bounded local importer. No hydration, downloads or inferred ground truth. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {prepareCampaignPosts} from '../../server/campaignEpisodes';
const text=z.string().trim().min(1).max(4000),sha=z.string().regex(/^[a-f0-9]{64}$/);
const annotation=z.object({label:z.enum(['positive','negative','uncertain','unavailable']),source:text,independentEvidence:text,annotators:z.array(text).min(2).refine(a=>new Set(a).size===a.length,'Distinct annotators required'),agreement:z.number().min(0).max(1),uncertainty:z.string().max(4000)}).strict();
export const registrySchema=z.object({version:z.literal(1),sources:z.array(z.object({id:text,publisher:text,url:z.string().url(),version:text,rights:text,permissionEvidence:text,reviewedBy:text,reviewedAt:z.string().datetime(),allowedUse:z.literal('local-research-evaluation'),redistribution:z.literal(false),independentLabels:z.literal(true),labelMethod:z.enum(['independent-documentary-adjudication','independent-human-adjudication']),privacyReview:text}).strict())}).strict();
const campaignSchema=z.object({id:text,sourceId:text,sourceGroup:text,translationGroup:text.optional(),split:z.enum(['train','development','test']),language:text,category:text,postsFile:text,sha256:sha,
  coverage:z.object({start:z.string().datetime({offset:true}),end:z.string().datetime({offset:true}),complete:z.boolean(),source:text}).strict().refine(c=>Date.parse(c.start)<Date.parse(c.end)),
  missingData:z.array(text),coordination:annotation,maliciousIntent:annotation,
  pairs:z.array(z.object({accounts:z.tuple([text,text]),association:annotation,recurrence:annotation.optional(),episodes:z.array(z.object({start:z.string().datetime({offset:true}),end:z.string().datetime({offset:true})}).strict().refine(e=>Date.parse(e.start)<=Date.parse(e.end))).max(100).optional(),episodeToleranceMs:z.number().int().min(0).max(300000).optional(),episodeProtocol:text.optional()}).strict()).max(10000)
}).strict();
export const manifestSchema=z.object({version:z.literal(1),id:text,datasetVersion:text,independent:z.literal(true),annotationProtocol:text,config:z.object({algorithm:z.literal('episodes_v1'),windowSeconds:z.literal(120),minSamples:z.literal(3),threshold:z.literal(0.65)}).strict(),campaigns:z.array(campaignSchema).max(200)}).strict();
export const sha256=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
function readBounded(file:string,max=16*1024*1024){if(fs.statSync(file).size>max)throw new Error('Evaluation file exceeds byte budget');return fs.readFileSync(file);}
export function loadDataset(manifestFile:string,registryFile:string){
  const manifestBytes=readBounded(manifestFile),registryBytes=readBounded(registryFile);
  const manifest=manifestSchema.parse(JSON.parse(manifestBytes.toString('utf8'))),registry=registrySchema.parse(JSON.parse(registryBytes.toString('utf8')));
  const sources=new Map(registry.sources.map(s=>[s.id,s]));
  if(sources.size!==registry.sources.length)throw new Error('Duplicate registry source');
  const root=fs.realpathSync(path.dirname(manifestFile)),roles=new Map<string,string>(),ids=new Set<string>();
  const claim=(key:string,split:string)=>{if(roles.has(key)&&roles.get(key)!==split)throw new Error('Split leakage: '+key);roles.set(key,split);};
  // Reject holdout access and lineage leakage before opening post files.
  for(const c of manifest.campaigns){
    if(ids.has(c.id))throw new Error('Duplicate campaign identifier');ids.add(c.id);
    if(!sources.has(c.sourceId))throw new Error('Dataset source has not passed rights/independent-label review');
    claim('source:'+c.sourceId+':'+c.sourceGroup,c.split);
    if(c.translationGroup)claim('translation:'+c.translationGroup,c.split);
    claim('file:'+c.sha256,c.split);
    if(c.split==='test')throw new Error('Final holdout locked: separately frozen evaluation release required');
  }
  let postCount=0;
  const campaigns=manifest.campaigns.map(c=>{
    if(path.isAbsolute(c.postsFile))throw new Error('Use relative local post files');
    const file=fs.realpathSync(path.resolve(root,c.postsFile)),relative=path.relative(root,file);
    if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Post file escapes dataset root');
    const bytes=readBounded(file,32*1024*1024);
    if(sha256(bytes)!==c.sha256)throw new Error('Dataset hash mismatch');
    const rows=JSON.parse(bytes.toString('utf8')),prepared=prepareCampaignPosts(rows);
    postCount+=rows.length;if(postCount>30000)throw new Error('Evaluation release exceeds 30000-post budget');
    const accounts=new Set<string>(prepared.items.map(i=>i.record.accountId));
    for(const account of accounts)claim('account:'+c.sourceId+':'+account,c.split);
    if(prepared.items.some(i=>!i.record.postId))throw new Error('Independent evaluation requires source post IDs');
    const pairs=new Set<string>();
    for(const p of c.pairs){
      const key=JSON.stringify([...p.accounts].sort());
      if(p.accounts[0]===p.accounts[1]||p.accounts.some(a=>typeof a!=='string'||!accounts.has(a))||pairs.has(key))throw new Error('Invalid or duplicate annotation pair');pairs.add(key);
      if(p.episodes&&(!p.episodeProtocol||p.episodeToleranceMs===undefined))throw new Error('Episode boundaries require prespecified independent tolerance protocol');
    }
    return {...c,rows};
  });
  return {manifest,campaigns,manifestSha256:sha256(manifestBytes),registrySha256:sha256(registryBytes)};
}
export interface Confusion {tp:number;fp:number;tn:number;fn:number}
export const emptyConfusion=():Confusion=>({tp:0,fp:0,tn:0,fn:0});
export function observe(c:Confusion,truth:string,predicted:boolean){if(truth==='positive')c[predicted?'tp':'fn']++;else if(truth==='negative')c[predicted?'fp':'tn']++;}
export function metrics(c:Confusion){const ratio=(n:number,d:number)=>d?n/d:null;return {...c,precision:ratio(c.tp,c.tp+c.fp),recall:ratio(c.tp,c.tp+c.fn),f1:ratio(2*c.tp,2*c.tp+c.fp+c.fn),falsePositiveRate:ratio(c.fp,c.fp+c.tn),falseNegativeRate:ratio(c.fn,c.fn+c.tp)};}

/** Maximum-cardinality one-to-one boundary matching; both ends must satisfy tolerance. */
export function matchEpisodeBoundaries(truth:{start:string;end:string}[],observed:{start:string;end:string}[],toleranceMs:number){
  if(truth.length>100||observed.length>5000||!Number.isFinite(toleranceMs)||toleranceMs<0||toleranceMs>300000)throw new Error('Episode comparison budget exceeded');
  if([...truth,...observed].some(e=>!Number.isFinite(Date.parse(e.start))||!Number.isFinite(Date.parse(e.end))||Date.parse(e.start)>Date.parse(e.end)))throw new Error('Invalid episode comparison boundary');
  const matched=new Map<number,number>();
  const augment=(i:number,seen:Set<number>):boolean=>{
    for(let j=0;j<observed.length;j++){
      if(seen.has(j)||Math.abs(Date.parse(truth[i].start)-Date.parse(observed[j].start))>toleranceMs||Math.abs(Date.parse(truth[i].end)-Date.parse(observed[j].end))>toleranceMs)continue;
      seen.add(j);if(!matched.has(j)||augment(matched.get(j)!,seen)){matched.set(j,i);return true;}
    }return false;
  };
  truth.forEach((_,i)=>augment(i,new Set()));
  return {tp:matched.size,fp:observed.length-matched.size,fn:truth.length-matched.size};
}
