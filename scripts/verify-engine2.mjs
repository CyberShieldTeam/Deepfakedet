/** Opt-in real-source/model browser check. Never uses the operator's case store or token. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import express from "express";
import { chromium, expect } from "@playwright/test";
const advanced=process.env.VERITAS_E2_ADVANCED==='1',outputRoot=advanced?'.model-cache/engine2-advanced/browser':'.model-cache/engine2-nli/browser';
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "veritas-engine2-browser-")),
  token = crypto.randomUUID() + crypto.randomUUID(),
  port = Number(process.env.VERITAS_E2_TEST_PORT || 3341),
  url = `http://127.0.0.1:${port}`,
  output = path.resolve(outputRoot+"/run-" + Date.now());
fs.mkdirSync(output, { recursive: true });
if (!process.env.VERITAS_NLI_PYTHON || !process.env.VERITAS_NLI_MODEL_PATH)
  throw Error("Explicit installed Python and verified model snapshot required");
Object.assign(process.env, {
  VERITAS_EMBEDDED: "true",
  NODE_ENV: "production",
  VERITAS_NLI_ENABLED: "1",
  VERITAS_WIKIPEDIA_ENABLED: "1",
  VERITAS_WIKIPEDIA_LANGUAGE: "en",
  VERITAS_AUTHORED_DEMO: "0",
  VERITAS_STORE: path.join(scratch, "cases.json"),
  VERITAS_USERS: JSON.stringify({ [token]: "engine2-browser-software-check" }),
  VERITAS_PUBLIC_ORIGIN: url,
  GOOGLE_FACT_CHECK_API_KEY: "",
  VERITAS_CLAIM_CORPUS: "",
  VERITAS_EMBEDDING_ENDPOINT: "",
  APP_GEMINI_API_KEY: "MY_DISABLED",
});
const { app } = await import("../server.ts"),
  { shutdownNli, runNli } = await import("../server/nliWorker.ts");
const {shutdownReranker,runReranker}=await import('../server/claimReranking.ts');
const {clearWikipediaCache}=await import('../server/wikipediaEvidence.ts');
if(advanced){
  if(!process.env.VERITAS_RERANKER_PYTHON||!process.env.VERITAS_RERANKER_MODEL_PATH)throw Error('Explicit reranker snapshot and Python required');
  process.env.VERITAS_RERANKER_ENABLED='1';
}else process.env.VERITAS_RERANKER_ENABLED='0';
app.use(express.static(path.resolve("dist")));
app.get("*", (_req, res) => res.sendFile(path.resolve("dist/index.html")));
const listener = app.listen(port, "127.0.0.1");
await new Promise((resolve, reject) => {
  listener.once("listening", resolve);
  listener.once("error", reject);
});
let browser;
const report = {
  at: new Date().toISOString(),
  scope:
    "Actual live Wikipedia/model processing and authored browser/review actions; diagnostic claims are not independent accuracy evaluation",
  checks: [],
};
try {
  const warmup = await runNli([
    { premise: "A person is eating a meal.", hypothesis: "Someone is eating.", language: "en" },
  ]);
  report.warmup = {
    scope: "Authored transport warmup, not independent accuracy; model ready before browser launch",
    startupMs: warmup.startupMs,
    memory: warmup.memory,
  };
  if(advanced){const reranker=await runReranker([{premise:'The fictional museum opened in 1992.',hypothesis:'The fictional museum opened in 1992.',language:'en'}]);assert.equal(reranker.results[0].status,'executed');report.rerankerWarmup={startupMs:reranker.startupMs,memory:reranker.memory,scope:'Authored transport control, real relevance inference; not accuracy'};}
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  report.pageErrors=[];page.on('pageerror',error=>report.pageErrors.push(error.message.slice(0,500)));
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(30000);
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (r) => r.abort());
  await page.goto(url);
  await page.getByLabel("Analyst access token").fill(token);
  await page.getByRole("button", { name: "Sign in securely", exact: true }).click();
  await expect(page.getByLabel("Analyst access token")).toHaveCount(0);
  const inv = (
    await (
      await page.request.post(url + "/api/investigations", {
        data: {
          title: "Engine 2 live sources and experimental model diagnostics",
          description: report.scope,
        },
      })
    ).json()
  ).investigation;
  await page.reload();
  await page.getByRole("button", { name: "Live analysis", exact: true }).click();
  await page.getByRole("button", { name: "Claim intelligence", exact: true }).first().click();
  await page.getByLabel("Active investigation").selectOption(inv.id);
  async function analyze(text,language='en',expectedStatus='INSUFFICIENT_EVIDENCE') {
    await page.getByRole("button", { name: "Claim intelligence", exact: true }).first().click();
    await page.locator("textarea").first().fill(text);
    const extracting = page.waitForResponse(
      (r) => r.url().endsWith("/api/claims/extract") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Extract candidate claims", exact: true }).click();
    const extraction = await (await extracting).json();
    await page.getByLabel("Selected claim language", { exact: true }).selectOption(language);
    await page
      .getByLabel("Claim selection rationale", { exact: true })
      .fill(
        "Authored browser control: selecting the assertion against original context; no independent factual endorsement.",
      );
    await page
      .getByLabel(
        "I approve this claim wording and language against the original context. This does not confirm its truth.",
        { exact: true },
      )
      .check();
    const analyzing = page.waitForResponse(
      (r) => r.url().endsWith("/api/claims/verify") && r.request().method() === "POST",
      { timeout: 120000 },
    );
    await page.getByRole("button", { name: "Check this claim", exact: true }).click();
    const response = await analyzing;
    assert.equal(response.status(), 200);
    const result = (await response.json()).result;
    assert.equal(result.originalInput, text);
    assert.equal(result.verificationStatus, expectedStatus);
    assert.equal(result.confidenceScore, null);
    assert.ok(result.sources.every((s) => s.stance === "neutral" && !s.review));
    assert.equal(result.nli.evaluationStatus, "experimental_failed_validation");
    if(advanced){await expect(page.getByRole('region',{name:'Source-grounded evidence summary'})).toBeVisible();assert.equal(result.evidenceSummary.citations.length,result.sources.length);for(const c of result.evidenceSummary.citations){const source=result.sources.find(s=>s.id===c.sourceId);assert.equal(c.url,source.url);assert.ok(source.excerpt.includes(c.quote));assert.equal(c.relationship,'unreviewed');}}
    await expect(
      page.getByText("Experimental evidence relationships", { exact: true }),
    ).toBeVisible();
    return { result, extraction };
  }
  async function save() {
    await page.getByRole("button", { name: "Save to a case", exact: true }).click();
    await expect(page.getByRole("button", { name: /Saved to SUR-/ })).toBeVisible();
  }
  const diagnostics = [
    ["A", "Charminar was constructed in Hyderabad in 1591.", "supports"],
    ["B", "Charminar was constructed in Hyderabad in 1891.", "contradicts"],
    ["C", "Charminar is located in Delhi.", "contradicts"],
    ["D", "Charminar was not constructed in 1591.", "contradicts"],
    ["E", "Charminar was constructed in Hyderabad.", "supports"],
  ];
  for (const [id, text, expected] of diagnostics) {
    const { result, extraction } = await analyze(text),
      source = result.sources.find((s) => s.title === "Charminar");
    assert.ok(source, "Live source retrieval did not return the required diagnostic article");
    const relation = result.nli.relationships.find((n) => n.sourceId === source.id);
    assert.equal(
      relation.status,
      "executed",
      JSON.stringify({ status: relation.status, reason: relation.reason }),
    );
    assert.equal(source.excerpt.slice(relation.span.start, relation.span.end), relation.passage);
    assert.equal(
      crypto.createHash("sha256").update(relation.passage).digest("hex"),
      relation.passageSha256,
    );
    await expect(page.getByRole("link", { name: "Charminar", exact: true })).toHaveAttribute(
      "href",
      source.url,
    );
    await save();
    report.checks.push({
      id,
      text,
      expectedDiagnostic: expected,
      observedSuggestion: relation.suggestion,
      diagnosticMatch: relation.suggestion === expected,
      result,
      extraction,
    });
    if (id === "A") {
      if(advanced){
        assert.ok(result.sources.every(s=>s.publishDate===undefined));
        await page.getByText('Read cited passages and review status',{exact:true}).click();
        const citation=page.getByRole('region',{name:'Source-grounded evidence summary'}).getByRole('link',{name:new RegExp('Charminar$')});
        const popupPending=page.waitForEvent('popup');await citation.click();const popup=await popupPending;let loaded=true;try{await popup.waitForLoadState('domcontentloaded',{timeout:15000})}catch{loaded=false}
        assert.equal(new URL(popup.url()).hostname,'en.wikipedia.org');report.checks.push({id:'citation-opening-and-missing-date',openedUrl:popup.url(),domContentLoaded:loaded,publicationDateInvented:false});await popup.close();
      }
      await page.screenshot({ path: path.join(output, "claim-a.png"), fullPage: true });
      await page.getByText("Analyst review · assess source applicability", { exact: true }).click();
      await page
        .getByLabel(`Stance for Charminar [${source.id}]`, { exact: true })
        .selectOption("supports");
      await page
        .getByLabel(`Evidence quote for Charminar [${source.id}]`, { exact: true })
        .fill(source.excerpt);
      await page
        .getByLabel(
          "I reviewed the complete factual assertion, entities, dates, locations and negation against the selected passages. Partial or ambiguous matches remain neutral.",
          { exact: true },
        )
        .check();
      await page
        .getByLabel("Analyst review rationale", { exact: true })
        .fill(
          "Authored software review: source lead identifies Hyderabad and construction in 1591. Wikipedia is secondary; this action tests review transport and is not independent human validation.",
        );
      const reviewedPending = page.waitForResponse(
        (r) => r.url().endsWith("/api/claims/review") && r.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Record evidence assessment", exact: true }).click();
      const reviewed = (await (await reviewedPending).json()).result;
      assert.equal(reviewed.verificationStatus, "SUPPORTED");
      assert.equal(
        reviewed.nli.relationships.find((n) => n.sourceId === source.id).humanStance,
        "supports",
      );
      assert.deepEqual(
        reviewed.nli.relationships.find((n) => n.sourceId === source.id).scores,
        relation.scores,
      );
      await save();
      report.checks.push({
        id: "A-human-review",
        scope: "Authored software action, not independent adjudication",
        result: reviewed,
      });
      if(advanced){
        assert.equal(reviewed.evidenceSummary.citations.find(c=>c.sourceId===source.id).relationship,'supports');
        await page.getByLabel(`Stance for Charminar [${source.id}]`,{exact:true}).selectOption('neutral');
        await page.getByLabel('Analyst review rationale',{exact:true}).fill('Authored correction control: retracting the software review while preserving the original attributed event.');
        const pending=page.waitForResponse(r=>r.url().endsWith('/api/claims/review')&&r.request().method()==='POST');await page.getByRole('button',{name:'Record evidence assessment',exact:true}).click();const corrected=(await(await pending).json()).result;
        assert.equal(corrected.verificationStatus,'INSUFFICIENT_EVIDENCE');assert.equal(corrected.evidenceSummary.citations.find(c=>c.sourceId===source.id).relationship,'unreviewed');assert.ok(corrected.sources.find(s=>s.id===source.id).reviewHistory.some(h=>h.stance==='supports'));await save();report.checks.push({id:'human-review-correction',result:corrected});
      }
    }
  }
  const empty = await analyze("Veritaszzunfindableqwpjxyz is a newly discovered island.");
  assert.equal(empty.result.sources.length, 0);
  assert.equal(empty.result.analysis.state, "NO_RELEVANT_SIGNALS");
  report.checks.push({ id: "no-evidence", ...empty });
  if(advanced){
    for(const [language,text] of [['hi','चारमीनार हैदराबाद में है।'],['te','చార్మినార్ హైదరాబాద్ లో ఉంది.']]){const r=await analyze(text,language);assert.ok(r.result.nli.relationships.every(n=>n.status!=='executed'));assert.equal(r.result.retrievalDetails.reranking.applied,false);report.checks.push({id:'unsupported-language-'+language,...r});}
    const actualFetch=globalThis.fetch;clearWikipediaCache();globalThis.fetch=async(...args)=>{if(new URL(String(args[0])).hostname==='en.wikipedia.org')throw new DOMException('Authored provider timeout transport control','TimeoutError');return actualFetch(...args)};
    try{const r=await analyze('Charminar was constructed in Hyderabad in 1591.','en','UNAVAILABLE');assert.equal(r.result.retrievalDetails.providers.find(p=>p.provider==='wikipedia').errorCategory,'TIMEOUT');report.checks.push({id:'retrieval-timeout',scope:'Injected transport timeout, not a live upstream failure',...r});}finally{globalThis.fetch=actualFetch;clearWikipediaCache();}
    const modelPath=process.env.VERITAS_NLI_MODEL_PATH;process.env.VERITAS_NLI_MODEL_PATH=path.join(scratch,'deliberately-missing-snapshot');
    try{const r=await analyze('Charminar was constructed in Hyderabad in 1591.');assert.ok(r.result.nli.relationships.every(n=>n.status!=='executed'));report.checks.push({id:'nli-unavailable',scope:'Actual worker missing-snapshot response in isolated configuration',...r});}finally{process.env.VERITAS_NLI_MODEL_PATH=modelPath;}
    const rerankerPath=process.env.VERITAS_RERANKER_MODEL_PATH;process.env.VERITAS_RERANKER_MODEL_PATH=path.join(scratch,'deliberately-missing-reranker');
    try{const r=await analyze('Charminar was constructed in Hyderabad in 1591.');assert.equal(r.result.retrievalDetails.reranking.applied,false);assert.equal(r.result.retrievalDetails.reranking.status,'unavailable');report.checks.push({id:'reranker-unavailable',scope:'Actual worker missing-snapshot response in isolated configuration',...r});}finally{process.env.VERITAS_RERANKER_MODEL_PATH=rerankerPath;}
  }
  const compound = await analyze(
    "BREAKING: Charminar was constructed in Hyderabad in 1591. Evacuate immediately and share this with everyone!",
  );
  assert.equal(compound.extraction.candidates[1].category, "instruction");
  assert.equal(compound.result.targetClaim, "Charminar was constructed in Hyderabad in 1591.");
  await save();
  report.checks.push({ id: "compound-selection", ...compound });
  await page.getByRole("button", { name: "Investigations", exact: true }).first().click();
  const region = page.getByRole("region", { name: "Cross-engine evidence correlation" }),
    correlated = page.waitForResponse(
      (r) => r.url().endsWith("/correlate") && r.request().method() === "POST",
    );
  await region.getByRole("button", { name: "Correlate evidence", exact: true }).click();
  const graph = (await (await correlated).json()).result;
  const exported = (await (await page.request.get(url + "/api/reports/" + inv.id)).json()).report,
    disk = JSON.parse(fs.readFileSync(process.env.VERITAS_STORE, "utf8")).find(
      (i) => i.id === inv.id,
    );
  assert.deepEqual(disk, exported.investigation);
  assert.deepEqual(disk.correlation, graph);
  if(advanced){for(const c of disk.claimResults){assert.deepEqual(c.evidenceSummary.citations.map(x=>x.url),c.sources.map(x=>x.url));assert.ok(c.retrievalDetails.reranking);}assert.ok(graph.nodes.some(n=>n.type==='source'&&n.metadata.evidenceCitation));assert.ok(graph.nodes.some(n=>n.type==='source'&&n.metadata.relevanceReranking));}
  assert.ok(
    graph.nodes.some(
      (n) =>
        n.type === "source" &&
        n.metadata.modelRelationship?.evaluationStatus === "experimental_failed_validation",
    ),
  );
  for (const c of disk.claimResults)
    for (const relationship of c.nli.relationships) {
      const source = c.sources.find((s) => s.id === relationship.sourceId);
      assert.equal(
        source.excerpt.slice(relationship.span.start, relationship.span.end),
        relationship.passage,
      );
    }
  await page.getByRole("button", { name: "Report", exact: true }).click();
  const frame = page.frameLocator('iframe[title="report"]');
  await expect(
    frame.getByText("Experimental model relationships", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    frame.locator('a[href="https://en.wikipedia.org/wiki/Charminar"]').first(),
  ).toBeVisible();
  if(advanced){await expect(frame.getByText('Source-grounded evidence assessment',{exact:true}).first()).toBeVisible();await expect(frame.getByText('Relevance reranker',{exact:true}).first()).toBeVisible();}
  report.checks.push({
    id: "persistence-correlation-report",
    pass: true,
    counts: graph.counts,
    exactApiDiskReportParity: true,
  });
  await page.getByRole("button", { name: "Close report", exact: true }).click();
  // Separate explicitly authored conflict case, no claim that these are external facts.
  process.env.VERITAS_WIKIPEDIA_ENABLED = "0";
  const corpus = {
    schemaVersion: 1,
    id: "authored-conflict-software-control",
    license: "Authored software fixture",
    approvalReference: "Software control only; no factual evidence",
    approvedBy: "test",
    approvedAt: "2026-01-01T00:00:00.000Z",
    documents: [1992, 1993].map((year) => ({
      title: "Authored software passage " + year,
      url: "https://example.org/control-" + year,
      excerpt: "The authored museum opened in " + year + ".",
      language: "en",
      provider: "operator_corpus",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      license: "Authored software control only",
    })),
  };
  const corpusFile = path.join(scratch, "corpus.json");
  fs.writeFileSync(corpusFile, JSON.stringify(corpus));
  process.env.VERITAS_CLAIM_CORPUS = corpusFile;
  process.env.VERITAS_CLAIM_CORPUS_SHA256 = crypto
    .createHash("sha256")
    .update(fs.readFileSync(corpusFile))
    .digest("hex");
  const { result: conflict } = await analyze("The authored museum opened in 1992.");
  assert.equal(conflict.sources.length, 2);
  if(advanced){assert.equal(conflict.retrievalDetails.reranking.status,'executed');assert.equal(conflict.retrievalDetails.reranking.applied,true);assert.ok(conflict.retrievalDetails.reranking.candidates.every(c=>Number.isFinite(c.score)));}
  await page.getByText("Analyst review · assess source applicability", { exact: true }).click();
  for (const source of conflict.sources) {
    await page
      .getByLabel(`Stance for ${source.title} [${source.id}]`, { exact: true })
      .selectOption(source.excerpt.includes("1992") ? "supports" : "contradicts");
    await page
      .getByLabel(`Evidence quote for ${source.title} [${source.id}]`, { exact: true })
      .fill(source.excerpt);
  }
  await page
    .getByLabel(
      "I reviewed the complete factual assertion, entities, dates, locations and negation against the selected passages. Partial or ambiguous matches remain neutral.",
      { exact: true },
    )
    .check();
  await page
    .getByLabel("Analyst review rationale", { exact: true })
    .fill(
      "Authored conflict software control: opposite statements deliberately retained; no external factual accuracy inference.",
    );
  const conflicting = page.waitForResponse(
    (r) => r.url().endsWith("/api/claims/review") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Record evidence assessment", exact: true }).click();
  const conflictReviewed = (await (await conflicting).json()).result;
  assert.equal(conflictReviewed.verificationStatus, "CONFLICTING_EVIDENCE");
  report.checks.push({
    id: "authored-conflict",
    scope: "Authored passages and review actions; not independent accuracy evidence",
    result: conflictReviewed,
  });
  assert.equal(report.pageErrors.length,0,'Unexpected frontend runtime errors');
  report.result = "passed";
} catch (error) {
  report.result = "failed";
  report.error = error instanceof Error ? error.message : "Browser verification failed";
  throw error;
} finally {
  shutdownNli();
  shutdownReranker();
  await browser?.close();
  await new Promise((resolve) => listener.close(resolve));
  fs.rmSync(scratch, { recursive: true, force: true });
  fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    outputRoot+"/latest.json",
    JSON.stringify({ result: report.result, path: path.join(output, "verification.json") }),
  );
  console.log(
    JSON.stringify({
      result: report.result,
      diagnostics: report.checks
        .filter((c) => c.expectedDiagnostic)
        .map((c) => ({
          id: c.id,
          expected: c.expectedDiagnostic,
          observed: c.observedSuggestion,
          match: c.diagnosticMatch,
        })),
      checks: report.checks.map((c) => c.id),
      report: path.join(output, "verification.json"),
    }),
  );
}
