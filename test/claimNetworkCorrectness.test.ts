import assert from 'assert';
import { decideClaimStatus } from '../server/claimEvidence';
import { analyzeCampaign, normalizeUrl } from '../server/campaign';
import type { GroundedSource } from '../src/types';

const source = (stance: GroundedSource['stance'], reviewed = true, publishDate = '2026-01-01'): GroundedSource => ({ title: 'Authority', url: 'https://agency.gov/bulletin', domain: 'agency.gov', publishDate, excerpt: 'An attributable passage.', stance, credibilityRating: 'High Authority', contextReviewed: reviewed });

assert.equal(decideClaimStatus([source('supports')]).status, 'VERIFIED');
assert.equal(decideClaimStatus([source('contradicts')]).status, 'CONTRADICTED');
assert.equal(decideClaimStatus([source('mixed')]).status, 'MISLEADING_CONTEXT');
assert.equal(decideClaimStatus([source('supports'), source('contradicts')]).status, 'NOT_VERIFIED');
assert.equal(decideClaimStatus([source('supports', false)]).status, 'NOT_VERIFIED', 'unreviewed retrieval cannot verify');
assert.equal(decideClaimStatus([source('supports')], { outdated: true }).status, 'NOT_VERIFIED');
assert.equal(decideClaimStatus([]).status, 'NOT_VERIFIED');

assert.equal(normalizeUrl('HTTPS://WWW.Example.com/story/?utm_source=x&b=2&a=1#part'), 'https://example.com/story?a=1&b=2');

const organic = analyzeCampaign('viral', [
  { post_id: '1', account_id: 'a', content: 'Breaking earthquake update from the national agency', timestamp: '2026-01-01T10:00:00Z', url: 'https://agency.gov/update?utm_source=x' },
  { post_id: '2', account_id: 'b', content: 'Breaking earthquake update from the national agency', timestamp: '2026-01-01T10:00:10Z', url: 'https://agency.gov/update' }
], false);
assert.equal(organic.patternStatus, 'ASSOCIATED_ACTIVITY_OBSERVED', 'one viral pair is association, not repeated coordination');

const repeated = analyzeCampaign('repeated', [
  { post_id: '1', account_id: 'a', content: 'Scheduled service notice route seven', timestamp: '2026-01-01T10:00:00Z', url: 'https://city.gov/n', hashtags: '#notice' },
  { post_id: '2', account_id: 'b', content: 'Scheduled service notice route seven', timestamp: '2026-01-01T10:00:20Z', url: 'https://city.gov/n', hashtags: '#notice' },
  { post_id: '3', account_id: 'a', content: 'Scheduled service notice route seven tomorrow', timestamp: '2026-01-02T10:00:00Z', url: 'https://city.gov/n' },
  { post_id: '4', account_id: 'b', content: 'Scheduled service notice route seven tomorrow', timestamp: '2026-01-02T10:00:20Z', url: 'https://city.gov/n' }
], false);
assert.equal(repeated.patternStatus, 'REPEATED_COORDINATION_SIGNALS');
assert(repeated.edges[0].evidence!.length >= 2);

const deduped = analyzeCampaign('duplicates', [
  { account_id: 'a', content: 'same post content', timestamp: '2026-01-01T10:00:00Z' },
  { account_id: 'a', content: 'same post content', timestamp: '2026-01-01T10:00:00Z' },
  { account_id: 'b', content: 'different observation', timestamp: 'bad' }
], false);
assert.equal(deduped.duplicatePostCount, 1);
assert.equal(deduped.missingTimestampCount, 1);
assert.equal(deduped.totalPosts, 2);
assert(deduped.coverageLimitations!.some(x => /no timestamp was invented/i.test(x)));

const lexical = analyzeCampaign('lexical', [
  { account_id: 'a', content: 'The bill did not pass today', timestamp: '2026-01-01T10:00:00Z' },
  { account_id: 'b', content: 'The bill did pass today', timestamp: '2026-01-01T10:00:10Z' }
], false);
assert.equal(lexical.patternStatus, 'ASSOCIATED_ACTIVITY_OBSERVED');
assert(lexical.alternativeExplanations.length > 0, 'near-identical opposite claims require cautious interpretation');

console.log('Claim and network correctness tests passed');
