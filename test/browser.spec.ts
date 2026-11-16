import { test, expect } from "@playwright/test";
import { encodeWav } from "../src/utils/audioSegments";
import {episodeControls,coverage as episodeCoverage} from './fixtures/campaign/episodeControls';
import fs from 'node:fs';

test('Engine4.1 actual OCR requires human review before claim investigation',async({page})=>{
 test.skip(process.env.VERITAS_EXPECT_EXTRACTION!=='1','Requires isolated OCR model, Python preparation service, corpus and store');test.setTimeout(90000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const fresh=(await(await page.request.post('/api/investigations',{data:{title:'Fresh Engine4.1 browser software control'}})).json()).investigation;
 await page.goto('/');await page.getByRole('button',{name:'Live analysis',exact:true}).click();await page.getByRole('button',{name:'Media forensics',exact:true}).first().click();await page.getByLabel('Active investigation').selectOption(fresh.id);
 await page.locator('input[type=file]').setInputFiles('.model-cache/extraction-fixtures/clear.png');
 await page.getByRole('button',{name:/Check this file/}).click();await page.getByRole('button',{name:'Save to a case',exact:true}).click();await expect(page.getByRole('button',{name:/Saved to SUR-/})).toBeVisible();
 await page.getByRole('button',{name:'Investigations',exact:true}).first().click();
 await page.getByLabel('Original image for extraction').setInputFiles('.model-cache/extraction-fixtures/clear.png');
 await expect(page.getByAltText('Original evidence for OCR review')).toBeVisible();
 const extractionResponse=page.waitForResponse(r=>r.url().endsWith('/extract')&&r.request().method()==='POST');await page.getByRole('button',{name:'Extract image text',exact:true}).click();const extracted=await(await extractionResponse).json();expect(extracted.result.originalText).toContain('Amber Museum');expect(extracted.result.candidates[0].reviews).toHaveLength(0);
 await expect(page.getByRole('button',{name:'Investigate reviewed text',exact:true}).first()).toBeDisabled();
 await page.getByLabel('Extraction review note').first().fill('Inspected the actual authored fixture; confirms source representation, not truth.');
 await page.getByLabel('I inspected the displayed original and confirm this text represents it. This does not confirm factual truth.').first().check();
 const reviewResponse=page.waitForResponse(r=>r.url().endsWith('/review')&&r.request().method()==='POST');await page.getByRole('button',{name:'Save extraction review',exact:true}).first().click();expect((await(await reviewResponse).json()).investigation.extractions[0].candidates[0].reviews[0].state).toBe('accepted');
 const claimResponse=page.waitForResponse(r=>r.url().endsWith('/investigate')&&r.request().method()==='POST');await page.getByRole('button',{name:'Investigate reviewed text',exact:true}).first().click();const investigated=await(await claimResponse).json();expect(investigated.result.verdict).toBe('Insufficient Evidence');expect(investigated.result.sources.some((s:any)=>s.title==='Fictional Engine4 source')).toBe(true);
 // Actual Engine3 public-post controls joined to this same case through the owned API.
 const claim=investigated.result.originalInput;const posts=episodeControls.find(c=>c.name==='multi_episode_pattern')!.rows.map(p=>({...p,content:claim+' https://example.org/engine4-source'}));
 const network=(await(await page.request.post('/api/campaigns/analyze',{data:{posts,coverage:episodeCoverage,datasetName:'Authored OCR public-post controls'}})).json()).result;
 expect((await page.request.post(`/api/investigations/${extracted.investigation.id}/attach`,{data:{kind:'campaign',result:network}})).ok()).toBe(true);
 const region=page.getByRole('region',{name:'Cross-engine evidence correlation'});const correlationResponse=page.waitForResponse(r=>r.url().endsWith('/correlate')&&r.request().method()==='POST');await region.getByRole('button',{name:'Correlate evidence',exact:true}).click();const linked=await(await correlationResponse).json();
 for(const type of ['MEDIA_CONTAINS_TEXT','TEXT_PROPOSES_CLAIM','CLAIM_REVIEWED_FROM_TEXT','CLAIM_INVESTIGATED_BY_ENGINE2','POST_CONTAINS_CLAIM','SHARED_CANONICAL_URL'])expect(linked.result.relationships.some((r:any)=>r.type===type),type).toBe(true);
 const stored=JSON.parse(fs.readFileSync(process.env.VERITAS_E41_TEST_STORE!,'utf8')).find((i:any)=>i.id===extracted.investigation.id);expect(stored.extractions).toEqual(linked.investigation.extractions);
 await page.getByRole('button',{name:'Report',exact:true}).click();const report=page.frameLocator('iframe[title="report"]');await expect(report.getByRole('heading',{name:'Machine extraction and human review',exact:true})).toBeVisible();await expect(report.getByText(/Original machine text/)).toBeVisible();await expect(report.getByText(/CLAIM_INVESTIGATED_BY_ENGINE2/).first()).toBeVisible();
 await page.screenshot({path:'test-results/engine41-reviewed-ocr.png',fullPage:true});expect(errors).toEqual([]);
 if(process.env.VERITAS_E41_BROWSER_REPORT){expect(fs.existsSync(process.env.VERITAS_E41_BROWSER_REPORT)).toBe(false);fs.writeFileSync(process.env.VERITAS_E41_BROWSER_REPORT,JSON.stringify({scope:'authored browser workflow, NOT independent accuracy',url:process.env.VERITAS_TEST_URL,mediaHash:extracted.result.sourceMediaHash,extraction:linked.investigation.extractions[0],claim:investigated.result,correlation:linked.result,diskApiReportParity:true},null,2));}
 console.log(JSON.stringify({scope:'authored engine41 browser workflow, not accuracy',extractionTiming:extracted.result.timing,correlationMs:linked.result.elapsedMs,claimVerdict:investigated.result.verdict,counts:linked.result.counts}));
});

test('Engine4 connects actual saved media, reviewed claim and public posts',async({page})=>{
 test.skip(process.env.VERITAS_EXPECT_ENGINE4!=='1','Requires explicitly isolated Engine4 corpus/store setup');test.setTimeout(60000);
 const claim='Software fixture: the fictional Amber Museum offers free entry.';
 await page.goto('/');await page.getByRole('button',{name:'Media forensics',exact:true}).first().click();
 const bytes=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=64;c.height=64;c.getContext('2d')!.fillRect(0,0,64,64);return c.toDataURL().split(',')[1];});
 await page.locator('input[type=file]').setInputFiles({name:'engine4-authored.png',mimeType:'image/png',buffer:Buffer.from(bytes,'base64')});
 const mediaResponse=page.waitForResponse(r=>r.url().includes('/api/forensics/analyze-media')&&r.request().method()==='POST');await page.getByRole('button',{name:/Check this file/}).click();
 const media=(await(await mediaResponse).json()).result;expect(media.aiGeneratedProbability).toBeNull();expect(media.submittedMedia.computedBy).toBe('server');
 await page.getByRole('button',{name:'Save to a case',exact:true}).click();await expect(page.getByRole('button',{name:/Saved to SUR-/})).toBeVisible();
 await page.getByRole('button',{name:'Claim intelligence',exact:true}).first().click();await page.locator('textarea').first().fill(claim);await page.getByRole('button',{name:'Check this claim',exact:true}).click();
 await expect(page.getByRole('link',{name:'Fictional Engine4 source'})).toBeVisible();
 await page.getByText('Analyst review · assess source applicability',{exact:true}).click();await page.getByLabel('Stance for Fictional Engine4 source').selectOption('supports');await page.getByLabel('Evidence quote for Fictional Engine4 source').fill(claim);await page.getByLabel('Analyst review rationale').fill('Authored software fixture: complete assertion and source context reviewed; not a real factual assessment.');await page.getByRole('checkbox').check();
 const reviewedResponse=page.waitForResponse(r=>r.url().includes('/api/claims/review')&&r.request().method()==='POST');await page.getByRole('button',{name:'Record evidence assessment'}).click();const reviewed=(await(await reviewedResponse).json()).result;
 await page.getByRole('button',{name:'Save to a case',exact:true}).click();await expect(page.getByRole('button',{name:/Saved to SUR-/})).toBeVisible();
 await page.getByRole('button',{name:'Network intelligence',exact:true}).first().click();
 const posts=episodeControls.find(c=>c.name==='multi_episode_pattern')!.rows.map(p=>({...p,content:claim+' https://example.org/engine4-source',url:'https://example.org/engine4-source'}));
 await page.locator('input[type=file]').setInputFiles({name:'engine4-authored-posts.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({posts,coverage:episodeCoverage}))});await expect(page.getByText('Observed post relationships',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Save to a case',exact:true}).click();await expect(page.getByRole('button',{name:/Saved to SUR-/})).toBeVisible();
 await page.getByRole('button',{name:'Investigations',exact:true}).first().click();const region=page.getByRole('region',{name:'Cross-engine evidence correlation'});
 await region.getByRole('button',{name:'Correlate evidence',exact:true}).click();await expect(region.getByText(/Correlation status:/)).toBeVisible();
 await region.getByText('Document a media caption or description',{exact:true}).click();await region.getByLabel('Supplied context text').fill(claim);await region.getByLabel('Context attribution rationale').fill('This caption is analyst supplied for the software fixture; no OCR or transcription ran.');
 const correlationResponse=page.waitForResponse(r=>r.url().endsWith('/correlate')&&r.request().method()==='POST');const renderStart=performance.now();await region.getByRole('button',{name:'Save supplied context and correlate'}).click();
 const linked=await(await correlationResponse).json();await expect(region.getByText(/Correlation status:/)).toBeVisible();const uiReadyMs=performance.now()-renderStart;
 expect(linked.result.relationships.some((e:any)=>e.type==='MEDIA_CONTEXT_CLAIM'&&e.strength==='analyst_asserted')).toBe(true);expect(linked.result.relationships.some((e:any)=>e.type==='POST_CONTAINS_CLAIM')).toBe(true);expect(linked.result.relationships.some((e:any)=>e.type==='SOURCE_ADDRESSES_CLAIM')).toBe(true);expect(linked.result.relationships.some((e:any)=>e.type==='SHARED_CANONICAL_URL')).toBe(true);
 expect(linked.investigation.forensicResult).toEqual(media);expect(linked.investigation.claimResult).toEqual(reviewed);expect(linked.investigation.campaignResult.overallCoordinationIndex).toBeNull();
 expect(await region.getByRole('list',{name:'Evidence relationships'}).locator('button').count()).toBeLessThanOrEqual(100);
 await region.getByLabel('Filter relationship type').selectOption('MEDIA_CONTEXT_CLAIM');await region.getByLabel('Filter match basis').selectOption('analyst_asserted');await expect(region.getByLabel('Selected correlation relationship')).toContainText('not extraction');
 const download=page.waitForEvent('download');await region.getByRole('button',{name:'Download correlation JSON'}).click();expect((await download).suggestedFilename()).toBe('veritas-correlation.json');
 const report=(await page.request.get(`/api/reports/${linked.investigation.id}`).then(r=>r.json())).report;expect(report.investigation.correlation).toEqual(linked.result);
 expect(JSON.parse(fs.readFileSync(process.env.VERITAS_E4_TEST_STORE!,'utf8')).find((i:any)=>i.id===linked.investigation.id).correlation).toEqual(linked.result);
 await page.getByRole('button',{name:'Report',exact:true}).click();await expect(page.frameLocator('iframe[title="report"]').getByRole('heading',{name:'CROSS-ENGINE EVIDENCE CORRELATION',exact:true})).toBeVisible();await expect(page.frameLocator('iframe[title="report"]').getByText(/MEDIA_CONTEXT_CLAIM/).first()).toBeVisible();
 console.log(JSON.stringify({scope:'authored_engine4_browser_workflow_not_accuracy',uiReadyMsIncludingApi:uiReadyMs,correlationMs:linked.result.elapsedMs,counts:linked.result.counts}));
 await page.screenshot({path:'test-results/engine4-correlated-workflow.png',fullPage:true});
 await page.keyboard.press('Escape');
 if(!await region.getByLabel('Supplied context text').isVisible())await region.getByText('Document a media caption or description',{exact:true}).click();
 await region.getByLabel('Supplied context text').fill('Unrelated authored text without the investigated claim.');await region.getByRole('button',{name:'Save supplied context and correlate'}).click();
 await expect(region.getByRole('alert')).toBeVisible();await expect(region.getByText(/Previous graph retained/)).toBeVisible();await expect(region.getByRole('list',{name:'Evidence relationships'})).toHaveCount(0);
 const preserved=(await page.request.get(`/api/investigations/${linked.investigation.id}`).then(r=>r.json())).investigation;expect(preserved.correlation).toEqual(linked.result);expect(preserved.correlationRun.status).toBe('failed');
 await region.getByRole('button',{name:'Correlate evidence',exact:true}).click();await expect(region.getByText(/Correlation status:/)).toBeVisible();
});

test('Failed network rerun cannot leave prior findings displayed as a new result',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Network intelligence',exact:true}).first().click();
 const posts=episodeControls.find(c=>c.name==='multi_episode_pattern')!.rows;
 await page.locator('input[type=file]').setInputFiles({name:'valid-fictional.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({posts,coverage:episodeCoverage}))});
 await expect(page.getByText('Observed post relationships',{exact:true})).toBeVisible();
 await page.locator('input[type=file]').setInputFiles({name:'invalid-fictional.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({posts:posts.map((p,i)=>i===0?{...p,timestamp:'missing'}:p)}))});
 await expect(page.getByRole('alert')).toContainText('ANALYSIS_FAILED');
 await expect(page.getByRole('region',{name:'Analysis processing status'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Save to a case',exact:true})).toHaveCount(0);
 await page.locator('input[type=file]').setInputFiles({name:'valid-again.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({posts,coverage:episodeCoverage}))});
 await expect(page.getByText('Observed post relationships',{exact:true})).toBeVisible();
 await page.locator('input[type=file]').setInputFiles({name:'malformed.json',mimeType:'application/json',buffer:Buffer.from('{bad json')});
 await expect(page.getByRole('alert')).toContainText('Invalid JSON file');
 await expect(page.getByRole('region',{name:'Analysis processing status'})).toHaveCount(0);
});

test('Episode campaign evidence survives graph inspection and export',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Network intelligence',exact:true}).first().click();
 const control=episodeControls.find(c=>c.name==='multi_episode_pattern')!;
 const response=page.waitForResponse(r=>r.url().includes('/api/campaigns/analyze')&&r.request().method()==='POST');
 await page.locator('input[type=file]').setInputFiles({name:'authored-episodes.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({posts:control.rows,coverage:episodeCoverage}))});
 const result=(await (await response).json()).result;expect(result.algorithm).toBe('episodes_v1');expect(result.episodeEvidence.associations.filter((a:any)=>a.recurrenceEligible)).toHaveLength(6);
 expect(result.nodes.every((n:any)=>n.suspicious===false&&n.botLikelihoodScore===null)).toBe(true);
 const region=page.getByRole('region',{name:'Campaign episode evidence'});
 await expect(region.getByRole('heading',{name:'Campaign episodes and post evidence'})).toBeVisible();
 await expect(region.getByText(/a-0 \(provided\)/)).toBeVisible();
 await page.getByLabel('Inspect any account').selectOption('a');
 await expect(page.getByText('Account details',{exact:true})).toBeVisible();
 await expect(page.locator('svg[viewBox="0 0 900 520"]')).toBeVisible();
 expect(await page.locator('svg[viewBox="0 0 900 520"] circle').count()).toBeGreaterThan(0);
 const downloaded=page.waitForEvent('download');await region.getByRole('button',{name:'Download campaign evidence JSON'}).click();expect((await downloaded).suggestedFilename()).toBe('veritas-campaign-evidence.json');
 await page.getByRole('button',{name:'Save to a case',exact:true}).click();await expect(page.getByRole('button',{name:/Saved to SUR-/})).toBeVisible();
 await page.screenshot({path:'test-results/campaign-episode-evidence.png',fullPage:true});
 await page.getByRole('button',{name:'Overview',exact:true}).first().click();
 await page.getByRole('button',{name:'Export report',exact:true}).click();
 const report=page.frameLocator('iframe[title="report"]');
 await expect(report.getByRole('heading',{name:'Campaign episode evidence',exact:true})).toBeVisible();
 await expect(report.getByRole('heading',{name:'Processing and evidence status',exact:true})).toBeVisible();
 await expect(report.getByText(new RegExp(result.analysis.id))).toBeVisible();
 await expect(report.getByText(/witness:/).first()).toBeVisible();
 const htmlDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();expect((await htmlDownload).suggestedFilename()).toMatch(/\.html$/);
});

test('Multilingual claim status reports unavailable evidence honestly', async ({page}) => {
  test.skip(process.env.VERITAS_EXPECT_CLAIM_CORPUS==='1','This workflow checks the unconfigured state');
  await page.goto('/');
  await page.getByRole('button',{name:'Claim intelligence',exact:true}).first().click();
  for(const claim of ['यह सॉफ्टवेयर परीक्षण है, पानी सुरक्षित नहीं है','ఇది సాఫ్ట్‌వేర్ పరీక్ష, నీరు సురక్షితం కాదు','Hyderabad में पानी safe కాదు']){
    await page.locator('textarea').first().fill(claim);
    await page.getByRole('button',{name:'Check this claim',exact:true}).click();
    await expect(page.getByText('Claim status: UNAVAILABLE',{exact:true})).toBeVisible();
    await expect(page.getByText('No news or official sources were checked for this result.',{exact:true})).toBeVisible();
  }
});

test('Retrieved claim quotes support attributed review and case attachment', async ({page}) => {
  test.skip(process.env.VERITAS_EXPECT_CLAIM_CORPUS!=='1','Requires the explicit fictional operator corpus test setup');
  await page.goto('/');
  await page.getByRole('button',{name:'Claim intelligence',exact:true}).first().click();
  await page.locator('textarea').first().fill('The fictional Amber Museum has free entry.');
  await page.getByRole('button',{name:'Check this claim',exact:true}).click();
  await expect(page.getByText('Claim status: INSUFFICIENT_EVIDENCE',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Fictional museum notice'})).toHaveAttribute('href','https://example.org/museum');
  await page.getByText('Analyst review · assess source applicability',{exact:true}).click();
  await page.getByLabel('Stance for Fictional museum notice').selectOption('supports');
  const quote='Software fixture: the fictional Amber Museum opened on Monday. Entry is free.';
  await page.getByLabel('Evidence quote for Fictional museum notice').fill(quote);
  await page.getByLabel('Analyst review rationale').fill('Software test only: the exact fictional assertion and context were reviewed.');
  await expect(page.getByRole('button',{name:'Record evidence assessment'})).toBeDisabled();
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Record evidence assessment'}).click();
  await expect(page.getByText('Claim status: SUPPORTED',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Save to a case',exact:true}).click();
  await expect(page.getByRole('button',{name:/Saved to SUR-/})).toBeVisible();
  await page.screenshot({path:'test-results/claim-evidence-review.png',fullPage:true});
});

test.beforeEach(async ({ page }) => {
  // Cosmetic external fonts must not gate functional tests in restricted networks.
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  if(process.env.VERITAS_TEST_TOKEN) {
    const origin=new URL(process.env.VERITAS_TEST_URL || 'http://127.0.0.1:3000').origin;
    await page.route(`${origin}/api/**`,route=>route.continue({headers:{...route.request().headers(),
      authorization:`Bearer ${process.env.VERITAS_TEST_TOKEN}`}}));
  }
});

test("Desktop overview, search, report, and live/demo isolation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Investigation overview." })).toBeVisible();
  await expect(page.getByText("DEMONSTRATION MODE", { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await page.screenshot({ path: "test-results/veritas-desktop.png", fullPage: true });
  await page.getByLabel("Search investigations").fill("nonexistent-case-query");
  await expect(page.getByText("No matching investigations")).toBeVisible();
  await page.getByLabel("Search investigations").fill("");
  await page.getByRole("button", { name: "Export report", exact: true }).click();
  await expect(page.locator('iframe[title=\"report\"]')).toBeVisible();
  await expect(
    page.frameLocator('iframe[title=\"report\"]').getByText("Executive evidence summary"),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.html$/);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Live analysis", exact: true }).click();
  await expect(page.getByText("LIVE ANALYSIS MODE", { exact: true })).toBeVisible();
  await expect(page.locator("tbody").getByText("SIMULATED", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Real claim input remains unverified and saves to an owner-scoped live case", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Claim intelligence", exact: true }).first().click();
  await page
    .locator("textarea")
    .first()
    .fill("Live test: a dam near Hyderabad has collapsed. Evacuate now!");
  await page.getByRole("button", { name: "Check this claim", exact: true }).click();
  await expect(page.getByText("LIVE ANALYSIS MODE", { exact: true })).toBeVisible();
  await expect(page.getByText('Claim verification unavailable', { exact: true })).toBeVisible();
  await expect(page.getByText("insufficient", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save to a case", exact: true }).click();
  await expect(page.getByRole("button", { name: /Saved to SUR-/ })).toBeVisible();
  const data = await request.get("/api/investigations").then((r) => r.json());
  for (const inv of data.investigations.filter((i: any) => i.title.startsWith("Claim: Live test:")))
    await request.delete(`/api/investigations/${inv.id}`);
});

test("Image measurements are processed without fabricating classifier output", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Media forensics", exact: true }).first().click();
  const image = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#346987";
    ctx.fillRect(0, 0, 64, 64);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "generated-test-fixture.png",
      mimeType: "image/png",
      buffer: Buffer.from(image, "base64"),
    });
  const response=page.waitForResponse(r=>r.url().includes('/api/forensics/analyze-media')&&r.request().method()==='POST');
  await page.getByRole("button", { name: /Check this file/ }).click();
  const {result}=await(await response).json();
  expect(result.aiGeneratedProbability).toBeNull();
  await expect(page.getByText("Authenticity remains undetermined", { exact: true })).toBeVisible();
  if(result.localImage&&result.localImage.model_status!=='ready')
    await expect(page.getByText('Whole-image classifier unavailable',{exact:true})).toBeVisible();
  else if(!result.localImage) await expect(page.getByText('UNAVAILABLE',{exact:true})).toBeVisible();
  await expect(page.getByText("LIVE ANALYSIS MODE", { exact: true })).toBeVisible();
});

test('Contradictory duplicate precision remains visible and blocks recurrence',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Network intelligence',exact:true}).first().click();
 const original=episodeControls.find(c=>c.name==='multi_episode_pattern')!;
 const posts=original.rows.flatMap(r=>[r,{...r,timestamp_precision:'unknown'}]);
 const response=page.waitForResponse(r=>r.url().includes('/api/campaigns/analyze')&&r.request().method()==='POST');
 await page.locator('input[type=file]').setInputFiles({name:'fictional-precision-conflict.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({posts,coverage:episodeCoverage}))});
 const {result}=await(await response).json();
 expect(result.episodeEvidence.associations.every((a:any)=>!a.recurrenceEligible)).toBe(true);
 expect(result.episodeEvidence.posts.every((p:any)=>p.resolutionMs===86400000&&p.sourceMetadata.length===2)).toBe(true);
 await expect(page.getByRole('region',{name:'Campaign episode evidence'}).getByText(/Duplicate source declarations were retained/)).toBeVisible();
 await expect(page.getByText(/Multiple source declarations retained; widest uncertainty used/).first()).toBeVisible();
});

test("Signed image provenance survives browser upload without a classifier verdict", async ({ page }) => {
  test.skip(process.env.VERITAS_EXPECT_IMAGE_EVIDENCE !== "1", "Requires SDK, Python service and cached official signed fixture");
  await page.goto("/");
  await page.getByRole("button", { name: "Media forensics", exact: true }).first().click();
  await page.locator("input[type=file]").setInputFiles(".model-cache/provenance-fixtures/C.jpg");
  const response = page.waitForResponse(r => r.url().includes("/api/forensics/analyze-media") && r.request().method() === "POST");
  await page.getByRole("button", { name: /Check this file/ }).click();
  const { result } = await (await response).json();
  expect(result.imageDiagnostics.c2pa.status).toBe("valid_untrusted");
  expect(result.imageDiagnostics.c2pa.ai_disclosure).toBe("not_declared");
  expect(result.authenticity).toBe("inconclusive");
  expect(result.aiGeneratedProbability).toBeNull();
  await expect(page.getByText("Image provenance and measured signals", { exact: true })).toBeVisible();
  await expect(page.getByText(/Signature and file binding valid; signer not trusted/)).toBeVisible();
  await page.screenshot({ path: "test-results/image-provenance.png", fullPage: true });
});

test("Bounded temporal observations survive a real video upload", async ({ page }) => {
  test.skip(process.env.VERITAS_EXPECT_TEMPORAL !== '1','Requires local Python/OpenCV service');
  await page.goto('/');
  await page.getByRole('button',{name:'Media forensics',exact:true}).first().click();
  await page.locator('input[type=file]').setInputFiles('test/fixtures/video/headshot_cc0_3s.mp4');
  const response=page.waitForResponse(r=>r.url().includes('/api/forensics/analyze-media') && r.request().method()==='POST');
  await page.getByRole('button',{name:/Check this file/}).click();
  const {result}=await(await response).json();
  expect(result.authenticity).toBe('inconclusive');
  expect(result.aiGeneratedProbability).toBeNull();
  expect(result.localVideo.temporalDiagnostics.decisionProbability).toBeNull();
  expect(result.localVideo.temporalDiagnostics.intervals.length).toBeGreaterThan(0);
  await expect(page.getByText('Temporal motion observations · not a deepfake verdict',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Inspect video at/}).first().click();
  await page.screenshot({path:'test-results/temporal-observations.png',fullPage:true});
});

test("Pinned face classifier evidence survives browser upload", async ({ page }) => {
  test.skip(process.env.VERITAS_EXPECT_FACE_READY !== "1", "Requires actual YuNet and face checkpoint");
  await page.goto("/");
  await page.getByRole("button", { name: "Media forensics", exact: true }).first().click();
  await page.locator("input[type=file]").setInputFiles("test/fixtures/face/headshot_cc0.jpg");
  const response = page.waitForResponse(r => r.url().includes("/api/forensics/analyze-media") && r.request().method() === "POST");
  await page.getByRole("button", { name: /Check this file/ }).click();
  const { result } = await (await response).json();
  expect(result.authenticity).toBe("inconclusive");
  expect(result.aiGeneratedProbability).toBeNull();
  expect(result.localImage.face_manipulation.status).toBe("analyzed");
  await expect(page.getByText("Face classifier: analyzed", { exact: true })).toBeVisible();
  await expect(page.getByText(/Face 1: raw fake-class output/)).toBeVisible();
});

test("Network sample exposes evidence; mobile navigation fits viewport", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Network intelligence", exact: true }).first().click();
  await page.getByRole("button", { name: "Try with sample posts", exact: true }).click();
  await expect(page.getByText("synthetic dataset", { exact: true })).toBeVisible();
  await expect(page.getByText('Observed post relationships', { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Inspect @/ }).first()).toBeVisible();
  await page
    .getByRole("button", { name: /Inspect @/ })
    .first()
    .click();
  await expect(page.getByText(/Bot likelihood is not estimated/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Investigation overview." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/veritas-mobile.png", fullPage: true });
});

test("Real decoded audio is segmented; no spoofing probability is invented", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Media forensics", exact: true }).first().click();
  const samples = Float32Array.from(
    { length: 16000 },
    (_, i) => 0.3 * Math.sin((2 * Math.PI * 440 * i) / 16000),
  );
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "test-tone.wav",
      mimeType: "audio/wav",
      buffer: Buffer.from(encodeWav(samples, 16000)),
    });
  await page.getByRole("button", { name: /Check this file/ }).click();
  await expect(page.getByText("Authenticity remains undetermined", { exact: true })).toBeVisible();
  await expect(page.getByText("UNAVAILABLE", { exact: true })).toBeVisible();
});

test("Real browser video frame extraction reports its actual interval", async ({ page }) => {
  test.setTimeout(45000);
  await page.goto("/");
  await page.getByRole("button", { name: "Media forensics", exact: true }).first().click();
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 100;
    const stream = canvas.captureStream(10),
      recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<Blob>(
      (resolve) => (recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }))),
    );
    recorder.start();
    let index = 0;
    const timer = setInterval(() => {
      const c = canvas.getContext("2d")!;
      c.fillStyle = index++ % 2 ? "#285a77" : "#224d6d";
      c.fillRect(0, 0, 160, 100);
    }, 100);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    clearInterval(timer);
    recorder.stop();
    const video = await done;
    stream.getTracks().forEach((t) => t.stop());
    return Array.from(new Uint8Array(await video.arrayBuffer()));
  });
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "recorded-test.webm",
      mimeType: "video/webm",
      buffer: Buffer.from(bytes),
    });
  await page.getByRole("button", { name: /Check this file/ }).click();
  await expect(page.getByText("Authenticity remains undetermined", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByText(process.env.VERITAS_EXPECT_FACE_READY === "1" || process.env.VERITAS_EXPECT_TEMPORAL === "1"
      ? "Experimental local video evidence"
      : "Sampled-frame evidence · not a video-level probability", { exact: true }),
  ).toBeVisible();
});
