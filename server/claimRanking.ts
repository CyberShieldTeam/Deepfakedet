/** Narrow subject identity heuristic. No credibility, agreement or date-match bonus. */
import {claimTokens} from './claimText';
import type {RetrievedEvidence} from './claimSources';
const articles=new Set(['the','a','an']);
const words=(value:string)=>{const tokens=claimTokens(value);return articles.has(tokens[0])?tokens.slice(1):tokens;};
const starts=(value:string[],prefix:string[])=>prefix.length>0&&prefix.every((t,i)=>value[i]===t);
export const ENTITY_RANKING_VERSION='exact-subject-lead-v1';
export function subjectTitleMatches(claim:string,items:RetrievedEvidence[]):boolean[]{
  const query=words(claim);
  return items.map(item=>{
    if(item.provider!=='wikipedia'||item.sourceType!=='encyclopedia_excerpt')return false;
    const title=words(item.title),base=words(item.title.replace(/\s*\([^)]*\)\s*$/u,''));
    if(!title.length||title.length>12||title.join('').length<4||!starts(query,title)||!starts(words(item.excerpt),title))return false;
    // Do not resolve parenthetical identities from their shared short name. Multiple
    // candidate identities in that family cancel priority, rather than guessing.
    const family=new Set(items.filter(x=>x.provider==='wikipedia'&&words(x.title.replace(/\s*\([^)]*\)\s*$/u,'')).join(' ')===base.join(' ')).map(x=>x.title.toLowerCase()));
    if(family.size>1||/\b(?:may refer to|can refer to|disambiguation)\b/iu.test(item.excerpt.slice(0,500)))return false;
    // Require a nearby explicit predicate after the full title; merely appearing
    // somewhere in the claim is insufficient. No trained NER/equivalence implied.
    return query.slice(title.length,title.length+6).some(t=>['is','are','was','were','has','have','had','can','does','did'].includes(t));
  });
}

export function prioritizeSubject<T extends RetrievedEvidence & {rank:number}>(claim:string,ranked:T[]){
  const matches=subjectTitleMatches(claim,ranked);
  return ranked.map((item,i)=>({...item,entityTitleMatch:matches[i],rankingMethod:ENTITY_RANKING_VERSION}))
    .sort((a,b)=>Number(b.entityTitleMatch)-Number(a.entityTitleMatch)||b.rank-a.rank);
}
