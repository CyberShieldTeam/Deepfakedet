import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {loadDataset,metrics,emptyConfusion,observe,sha256,matchEpisodeBoundaries} from './engine3/dataset';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'engine3-import-'));
try{
  const annotation={label:'uncertain',source:'fictional test only',independentEvidence:'Software fixture, never admitted to research registry',annotators:['fixture-a','fixture-b'],agreement:0,uncertainty:'No independent truth'};
  const posts=[{account_id:'a',post_id:'a1',timestamp:'2026-01-01T00:00:00Z',content:'Fictional test bulletin'},{account_id:'b',post_id:'b1',timestamp:'2026-01-01T00:00:00Z',content:'Fictional test bulletin'}];
  const bytes=JSON.stringify(posts);fs.writeFileSync(path.join(root,'posts.json'),bytes);
  const source={id:'fixture',publisher:'Fixture',url:'https://example.org/fixture',version:'fixture-only',rights:'Software fixture only',permissionEvidence:'Fixture only',reviewedBy:'fixture',reviewedAt:'2026-01-01T00:00:00Z',allowedUse:'local-research-evaluation',redistribution:false,independentLabels:true,labelMethod:'independent-human-adjudication',privacyReview:'Fictional'};
  const campaign={id:'fixture-campaign',sourceId:'fixture',sourceGroup:'fixture-group',split:'development',language:'English',category:'software-fixture',postsFile:'posts.json',sha256:sha256(bytes),coverage:{start:'2025-12-31T23:59:00Z',end:'2026-01-02T00:00:00Z',complete:false,source:'fixture'},missingData:['fixture'],coordination:annotation,maliciousIntent:annotation,pairs:[{accounts:['a','b'],association:annotation}]};
  const manifest={version:1,id:'fixture',datasetVersion:'1',independent:true,annotationProtocol:'Fixture tests parsing only',config:{algorithm:'episodes_v1',windowSeconds:120,minSamples:3,threshold:0.65},campaigns:[campaign]};
  const m=path.join(root,'manifest.json'),r=path.join(root,'registry.json');
  const write=()=>fs.writeFileSync(m,JSON.stringify(manifest));write();
  fs.writeFileSync(r,JSON.stringify({version:1,sources:[]}));assert.throws(()=>loadDataset(m,r),/rights/);
  fs.writeFileSync(r,JSON.stringify({version:1,sources:[source]}));assert.equal(loadDataset(m,r).campaigns.length,1);
  manifest.campaigns[0]={...campaign,sha256:'0'.repeat(64)};write();assert.throws(()=>loadDataset(m,r),/hash/);
  manifest.campaigns[0]={...campaign,split:'test',postsFile:'nonexistent-final-holdout.json'};write();assert.throws(()=>loadDataset(m,r),/holdout locked/);
  manifest.campaigns=[campaign,{...campaign,id:'translation',split:'train'}];write();assert.throws(()=>loadDataset(m,r),/leakage/);
  manifest.campaigns=[{...campaign,coordination:{...annotation,annotators:['same','same']}}];write();assert.throws(()=>loadDataset(m,r),/Distinct annotators/);
  manifest.campaigns=[{...campaign,pairs:[{accounts:['a','missing'],association:annotation}]}];write();assert.throws(()=>loadDataset(m,r),/annotation pair/);
  const escapeFile=path.basename(root)+'.json';
  manifest.campaigns=[{...campaign,postsFile:'../'+escapeFile}];write();fs.writeFileSync(path.join(root,'..',escapeFile),'[]',{flag:'wx'});
  try{assert.throws(()=>loadDataset(m,r),/escapes/);}finally{fs.unlinkSync(path.join(root,'..',escapeFile));}
  const confusion=emptyConfusion();observe(confusion,'positive',true);observe(confusion,'positive',false);observe(confusion,'negative',true);observe(confusion,'negative',false);observe(confusion,'uncertain',true);
  assert.deepEqual(confusion,{tp:1,fp:1,tn:1,fn:1});assert.equal(metrics(confusion).f1,.5);assert.equal(metrics(emptyConfusion()).precision,null);
  const interval=(ms:number)=>({start:new Date(ms).toISOString(),end:new Date(ms+1).toISOString()});
  assert.deepEqual(matchEpisodeBoundaries([interval(0),interval(5)],[interval(0),interval(-5)],5),{tp:2,fp:0,fn:0});
  assert.deepEqual(matchEpisodeBoundaries([interval(0),interval(0)],[interval(0)],0),{tp:1,fp:0,fn:1});
  assert.deepEqual(matchEpisodeBoundaries([interval(0)],[{...interval(0),end:new Date(99).toISOString()}],1),{tp:0,fp:1,fn:1});
  assert.throws(()=>matchEpisodeBoundaries(Array(101).fill(interval(0)),[],0),/budget/);
  assert.throws(()=>matchEpisodeBoundaries([{start:'invalid',end:'invalid'}],[],0),/boundary/);
  console.log('Engine3 importer/math software tests passed: rights gate, hashes, holdout lock, split leakage, invalid pairs, path containment, uncertainty and undefined denominators.');
}finally{fs.rmSync(root,{recursive:true,force:true});}
