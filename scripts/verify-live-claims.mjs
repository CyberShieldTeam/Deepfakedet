/** Opt-in online integration check. Real Wikipedia requests; isolated case store, never user cases. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import express from "express";
import { chromium, expect } from "@playwright/test";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "veritas-live-claims-")),
  token = crypto.randomUUID() + crypto.randomUUID(),
  port = Number(process.env.VERITAS_LIVE_TEST_PORT || 3339),
  url = `http://127.0.0.1:${port}`;
const output = path.resolve(".model-cache/core-capability");
fs.mkdirSync(output, { recursive: true });
Object.assign(process.env, {
  NODE_ENV: "production",
  VERITAS_EMBEDDED: "true",
  VERITAS_STORE: path.join(root, "cases.json"),
  VERITAS_USERS: JSON.stringify({ [token]: "live-source-software-check" }),
  VERITAS_PUBLIC_ORIGIN: url,
  VERITAS_WIKIPEDIA_ENABLED: "1",
  VERITAS_WIKIPEDIA_LANGUAGE: "en",
  VERITAS_AUTHORED_DEMO: "0",
  GOOGLE_FACT_CHECK_API_KEY: "",
  VERITAS_CLAIM_CORPUS: "",
  VERITAS_EMBEDDING_ENDPOINT: "",
  APP_GEMINI_API_KEY: "MY_DISABLED",
});
if (process.env.VERITAS_LIVE_MEDIA === "1")
  process.env.VERITAS_AI_SERVICE_URL = "http://127.0.0.1:8001";
const { app } = await import("../server.ts");
app.use(express.static(path.resolve("dist")));
app.get("*", (_req, res) => res.sendFile(path.resolve("dist/index.html")));
const listener = app.listen(port, "127.0.0.1");
await new Promise((resolve, reject) => {
  listener.once("listening", resolve);
  listener.once("error", reject);
});
const browser = await chromium.launch({ headless: true }),
  report = {
    at: new Date().toISOString(),
    scope:
      "Live retrieval and authored software review actions, not independent factual accuracy evaluation",
    checks: [],
  };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } }),
    page = await context.newPage();
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (r) => r.abort());
  await page.goto(url);
  await page.getByLabel("Analyst access token").fill(token);
  await page.getByRole("button", { name: "Sign in securely", exact: true }).click();
  await expect(page.getByLabel("Analyst access token")).toHaveCount(0);
  const inv = (
    await (
      await page.request.post(url + "/api/investigations", {
        data: { title: "Live Wikipedia citation software check", description: report.scope },
      })
    ).json()
  ).investigation;
  await page.getByRole("button", { name: "Live analysis", exact: true }).click();
  await page.getByRole("button", { name: "Claim intelligence", exact: true }).first().click();
  await page.getByLabel("Active investigation").selectOption(inv.id);
  await page.locator("textarea").first().fill("The Charminar in Hyderabad was built in 1591.");
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/api/claims/verify") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Check this claim", exact: true }).click();
  const raw = (await (await pending).json()).result;
  assert.ok(raw.sources.length);
  assert.equal(raw.verificationStatus, "INSUFFICIENT_EVIDENCE");
  assert.equal(raw.confidenceScore, null);
  const source = raw.sources.find((s) => s.title === "Charminar");
  assert.ok(source);
  assert.match(source.excerpt, /1591/);
  assert.equal(source.provider, "wikipedia");
  assert.equal(source.stance, "neutral");
  await expect(page.getByRole("link", { name: "Charminar", exact: true })).toHaveAttribute(
    "href",
    source.url,
  );
  await expect(
    page
      .getByText("Encyclopedia lead excerpt; not an independent fact check.", { exact: true })
      .first(),
  ).toBeVisible();
  await page
    .getByText("Source provenance and limitations", { exact: true })
    .nth(raw.sources.indexOf(source))
    .click();
  await expect(
    page.getByRole("link", { name: `Reported article revision ${source.revisionId}`, exact: true }),
  ).toHaveAttribute("href", source.revisionUrl);
  await page.screenshot({ path: path.join(output, "live-claim.png"), fullPage: true });
  // Authored review operation tests transport and attribution. It is not independent human validation.
  await page.getByText("Analyst review · assess source applicability", { exact: true }).click();
  await page
    .getByLabel(`Stance for Charminar [${source.id}]`, { exact: true })
    .selectOption("supports");
  await page
    .getByLabel(`Evidence quote for Charminar [${source.id}]`, { exact: true })
    .fill(source.excerpt.slice(0, source.excerpt.indexOf("1591") + 5));
  await page
    .getByLabel(
      "I reviewed the complete factual assertion, entities, dates, locations and negation against the selected passages. Partial or ambiguous matches remain neutral.",
    )
    .check();
  await page
    .getByLabel("Analyst review rationale")
    .fill(
      "Authored software check of attributed review and exact quote: Charminar lead names Hyderabad and construction in 1591. Wikipedia is secondary, not independent ground truth.",
    );
  const reviewedPending = page.waitForResponse(
    (r) => r.url().endsWith("/api/claims/review") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Record evidence assessment", exact: true }).click();
  const reviewed = (await (await reviewedPending).json()).result;
  assert.equal(reviewed.verificationStatus, "SUPPORTED");
  assert.equal(reviewed.confidenceScore, null);
  await page.getByRole("button", { name: "Save to a case", exact: true }).click();
  await expect(page.getByRole("button", { name: /Saved to SUR-/ })).toBeVisible();
  const apiReport = (await (await page.request.get(url + "/api/reports/" + inv.id)).json()).report,
    disk = JSON.parse(fs.readFileSync(process.env.VERITAS_STORE, "utf8")).find(
      (i) => i.id === inv.id,
    );
  assert.deepEqual(disk.claimResults[0].sources, reviewed.sources);
  assert.deepEqual(apiReport.investigation.claimResults[0].sources, reviewed.sources);
  if (process.env.VERITAS_LIVE_MEDIA === "1") {
    for (const [kind, file] of [
      ["image", "fixtures/submission/notice.png"],
      ["audio", "test/fixtures/sample_voice.wav"],
      ["video", "test/fixtures/video/test_pattern_with_tone_3s.mp4"],
    ]) {
      await page.getByRole("button", { name: "Media forensics", exact: true }).first().click();
      await page.locator("input[type=file]").setInputFiles(file);
      const analyzed = page.waitForResponse(
        (r) => r.url().endsWith("/api/forensics/analyze-media") && r.request().method() === "POST",
        { timeout: 90000 },
      );
      await page.getByRole("button", { name: /Check this file/ }).click();
      const response = await analyzed;
      assert.equal(response.status(), 200);
      const result = (await response.json()).result;
      assert.equal(result.authenticity, "inconclusive");
      assert.equal(result.aiGeneratedProbability, null);
      if (kind === "image") assert.equal(result.analysis.counts.imageSignalMeasurements, 3);
      if (kind === "audio") {
        assert.equal(result.localAudio.segments.length, 3);
        await expect(page.getByText("Assessment unavailable", { exact: true })).toBeVisible();
        await expect(
          page.getByRole("link", { name: "Official AASIST documentation", exact: true }),
        ).toHaveAttribute("href", "https://github.com/clovaai/aasist");
      }
      if (kind === "video") {
        assert.ok(result.localVideo.frames.length > 0);
        assert.equal(result.localVideo.audioTrack.status, "analyzed");
        assert.ok(result.localVideo.audioTrack.evidence.segments.length > 0);
      }
      await page.getByRole("button", { name: "Save to a case", exact: true }).click();
      await expect(page.getByRole("button", { name: /Saved to SUR-/ })).toBeVisible();
      report.checks.push({
        kind: "live-media-processing",
        modality: kind,
        file,
        scope: "Transport/inference control only; independent genuine/spoof labels not established",
        result,
      });
    }
    await page.getByRole("button", { name: "Network intelligence", exact: true }).first().click();
    const analyzed = page.waitForResponse(
      (r) => r.url().endsWith("/api/campaigns/analyze") && r.request().method() === "POST",
    );
    await page
      .getByLabel("Upload posts (CSV / JSON)")
      .setInputFiles("fixtures/submission/posts.json");
    const network = (await (await analyzed).json()).result;
    assert.equal(network.overallCoordinationIndex, null);
    await page.getByRole("button", { name: "Save to a case", exact: true }).click();
    await expect(page.getByRole("button", { name: /Saved to SUR-/ })).toBeVisible();
    report.checks.push({ kind: "network-preservation", result: network });
  }
  await page.getByRole("button", { name: "Investigations", exact: true }).first().click();
  const region = page.getByRole("region", { name: "Cross-engine evidence correlation" }),
    correlated = page.waitForResponse(
      (r) => r.url().endsWith("/correlate") && r.request().method() === "POST",
    );
  await region.getByRole("button", { name: "Correlate evidence", exact: true }).click();
  const graph = (await (await correlated).json()).result;
  assert.ok(graph.relationships.some((r) => r.type === "SOURCE_ADDRESSES_CLAIM"));
  await page.getByRole("button", { name: "Report", exact: true }).click();
  const frame = page.frameLocator('iframe[title="report"]');
  await expect(frame.getByRole("link", { name: "Charminar", exact: true }).first()).toHaveAttribute(
    "href",
    source.url,
  );
  await expect(
    frame.getByRole("link", {
      name: `Reported article revision ${source.revisionId}`,
      exact: true,
    }).first(),
  ).toHaveAttribute("href", source.revisionUrl);
  await expect(
    frame.getByText(`Passage SHA-256: ${source.passageSha256}`, { exact: true }).first(),
  ).toBeVisible();
  const finalReport = (await (await page.request.get(url + "/api/reports/" + inv.id)).json())
      .report,
    finalDisk = JSON.parse(fs.readFileSync(process.env.VERITAS_STORE, "utf8")).find(
      (i) => i.id === inv.id,
    );
  assert.deepEqual(finalDisk, finalReport.investigation);
  assert.deepEqual(finalDisk.correlation, graph);
  const sourceNode = graph.nodes.find(
    (n) => n.type === "source" && n.metadata.sourceId === source.id,
  );
  assert.equal(sourceNode.metadata.citation.passageSha256, source.passageSha256);
  assert.equal(sourceNode.metadata.citation.revisionUrl, source.revisionUrl);
  report.checks.push({
    kind: "browser-api-store-correlation-report",
    pass: true,
    raw,
    reviewed,
    sourceMetadataParity: true,
    graphCounts: graph.counts,
  });
  for (const text of [
    "The Earth has two moons.",
    "The Charminar was built in 1891.",
    "The Charminar in Delhi was built in 1591.",
    "veritaszzunknownzzqwpj2026",
  ]) {
    const started = performance.now(),
      response = await page.request.post(url + "/api/claims/verify", { data: { claimText: text } });
    assert.equal(response.status(), 200);
    const r = (await response.json()).result;
    assert.equal(r.verificationStatus, "INSUFFICIENT_EVIDENCE");
    assert.equal(r.confidenceScore, null);
    assert.ok(r.sources.every((s) => s.stance === "neutral"));
    assert.equal(
      r.retrievalDetails.providers.find((p) => p.provider === "wikipedia").status,
      "available",
    );
    report.checks.push({
      kind: "live-query-unassessed",
      text,
      ms: performance.now() - started,
      result: r,
    });
  }
  report.result = "passed";
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => listener.close(resolve));
  fs.rmSync(root, { recursive: true, force: true });
  fs.writeFileSync(path.join(output, "live-claims.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      result: report.result,
      checks: report.checks.map((c) => ({
        kind: c.kind,
        text: c.text,
        ms: c.ms,
        sources: c.result?.sources?.length,
      })),
      report: path.join(output, "live-claims.json"),
    }),
  );
}
