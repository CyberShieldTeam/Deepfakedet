import {coverage,episodeControls} from '../fixtures/campaign/episodeControls';
export {coverage};
export const workloadNames=['sparse','dense','popular_url','scheduled','multiple_episodes','multilingual','duplicates','missing_timestamps','large_component','incomplete_coverage'] as const;
export function workload(name:string,count:number){
  const at=(seconds:number)=>new Date(Date.UTC(2026,0,1)+seconds*1000).toISOString();
  const rows=Array.from({length:count},(_,i)=>({account_id:`fictional-${i}`,post_id:`p${i}`,timestamp:at(i*100000),content:`Fictional unrelated token${i}`,url:`https://example.org/item/${i}`}));
  if(name==='sparse')return rows;
  if(name==='missing_timestamps')return rows.map((r,i)=>i===0?{...r,timestamp:undefined}:r);
  return rows.map((r,i)=>{
    const episode=Math.floor(i/(Math.ceil(count/3))),member=i%Math.ceil(count/3);
    const repeated=['scheduled','multiple_episodes','incomplete_coverage'].includes(name);
    const duplicate=name==='duplicates';
    return {...r,account_id:duplicate?`fictional-${Math.floor(i/2)}`:repeated?`fictional-${member}`:r.account_id,
      post_id:duplicate?`p${Math.floor(i/2)}`:r.post_id,
      timestamp:at(repeated?episode*4000:0),
      content:name==='popular_url'?`Independent fictional category${i}`:name==='multilingual'?['Fictional public warning bulletin','काल्पनिक सार्वजनिक चेतावनी सूचना','కల్పిత ప్రజా హెచ్చరిక సమాచారం'][i%3]:'Identical fictional public bulletin for bounded resource testing.',
      url:'https://example.org/public'};
  });
}
export const legitimateControls=[
  ...episodeControls.map(c=>({...c,coverage})),
  {name:'organic_repeated_discussion',rows:episodeControls.find(c=>c.name==='multi_episode_pattern')!.rows,coverage,expected:{recurrenceEligiblePairs:6,maliciousAccounts:0}},
  {name:'incomplete_observation',rows:episodeControls.find(c=>c.name==='multi_episode_pattern')!.rows,coverage:{...coverage,complete:false},expected:{recurrenceEligiblePairs:0,maliciousAccounts:0}},
  {name:'conflicting_duplicate_precision',rows:episodeControls.find(c=>c.name==='multi_episode_pattern')!.rows.flatMap(r=>[r,{...r,timestamp_precision:'unknown'}]),coverage,expected:{recurrenceEligiblePairs:0,maliciousAccounts:0}},
  {name:'emergency_1000_shares',rows:workload('dense',1000),coverage,expected:{recurrenceEligiblePairs:0,maliciousAccounts:0}},
];
