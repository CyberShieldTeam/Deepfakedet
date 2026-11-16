import {analyzeEpisodeCampaign} from '../server/campaignEpisodes';
import {buildDemoInvestigation} from '../server/demoScenario';
import type {ClaimVerificationResult,Investigation} from '../src/types';
export const ENGINE4_CLAIM='Software fixture: the fictional Amber Museum offers free entry.';
export function engine4Fixture(count=12):Investigation {
 const inv=buildDemoInvestigation();inv.id='engine4-authored-case';inv.isSimulatedDemo=false;
 const base=inv.forensicResult!;inv.mediaFindings=[{...base,fileName:'authored.png',authenticity:'inconclusive',aiGeneratedProbability:null,confidenceScore:null,analyzedAt:'2026-01-01T00:00:00Z',submittedMedia:{sha256:'a'.repeat(64),scope:'submitted_analysis_bytes',computedBy:'server',byteLength:100},limitations:['Authored software fixture; no model quality claim.']}];inv.forensicResult=inv.mediaFindings[0];
 const source=(id:string,stance:'supports'|'contradicts')=>({id,title:`Fictional ${stance} notice`,url:`https://example.org/${id}`,domain:'example.org',excerpt:`Authored ${stance} source passage about the fictional museum.`,retrievedAt:'2026-01-02T00:00:00Z',publishDate:'2025-12-31',stance,credibilityRating:'Unverified Source' as const,review:{quote:`Authored ${stance} source passage about the fictional museum.`,contextConfirmed:true,reviewedBy:'fictional-test-analyst',reviewedAt:'2026-01-02T00:00:00Z',claim:ENGINE4_CLAIM,note:'Authored scenario, not real evidence'}});
 const claim:ClaimVerificationResult={...inv.claimResult!,targetClaim:ENGINE4_CLAIM,normalizedClaim:ENGINE4_CLAIM,originalInput:ENGINE4_CLAIM,timestamp:'2026-01-02T00:00:00Z',verdict:'Mixed Evidence',verificationStatus:'CONFLICTING_EVIDENCE',verificationMode:'analyst_reviewed',confidenceScore:null,sources:[source('support','supports'),source('opposition','contradicts')],supportingCount:1,contradictingCount:1,neutralCount:0,limitations:['Authored conflicting source fixture.'],missingEvidence:[]};
 inv.claimResults=[claim];inv.claimResult=claim;
 const posts=Array.from({length:count},(_,i)=>({account_id:`fixture-${i%4}`,post_id:`post-${i}`,timestamp:new Date(Date.UTC(2026,0,1)+Math.floor(i/4)*4000000+(i%4)*1000).toISOString(),content:ENGINE4_CLAIM+' https://example.org/support',url:'https://example.org/support'}));
 inv.campaignResult=analyzeEpisodeCampaign('Authored legitimate bulletin',posts,false,{},null,{start:'2025-12-31T00:00:00Z',end:'2026-02-01T00:00:00Z',complete:true,source:'Authored observation declaration'});
 return inv;
}
