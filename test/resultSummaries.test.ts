import assert from "node:assert/strict";
import { claimResultSummary, networkResultSummary } from "../src/resultSummaries";
import type { ClaimVerificationResult, GroundedSource } from "../src/types";
import { analyzeEpisodeCampaign } from "../server/campaignEpisodes";
import { coverage, episodeControls } from "./fixtures/campaign/episodeControls";
import { reportHtml } from "../src/components/ReportModal";
import { buildDemoInvestigation } from "../server/demoScenario";
import { renderToStaticMarkup } from "react-dom/server";
import { ClaimResult } from "../src/components/ClaimView";
import React from "react";

const claim = "The fictional bridge is open.";
const source = (stance: GroundedSource["stance"]): GroundedSource => ({
  id: "E1",
  provider: "operator_corpus",
  title: "Authored source",
  url: "https://example.org/bridge",
  domain: "example.org",
  publisher: "Fixture Publisher",
  publishDate: "2026-01-01",
  excerpt: "The fictional bridge is open for visitors.",
  stance,
  credibilityRating: "Unverified Source",
  retrievedAt: "2026-01-01T00:00:00Z",
  review: {
    quote: "The fictional bridge is open for visitors.",
    contextConfirmed: true,
    reviewedBy: "test-analyst",
    reviewedAt: "2026-01-01T01:00:00Z",
    claim,
    note: "Authored control",
  },
});
const result = (
  status: ClaimVerificationResult["verificationStatus"],
  sources: GroundedSource[],
  mode: ClaimVerificationResult["verificationMode"] = "analyst_reviewed",
): ClaimVerificationResult => ({
  originalInput: claim,
  extractedClaims: [claim],
  targetClaim: claim,
  normalizedClaim: claim,
  verdict:
    status === "SUPPORTED"
      ? "Supported"
      : status === "CONTRADICTED"
        ? "Contradicted"
        : status === "CONFLICTING_EVIDENCE"
          ? "Mixed Evidence"
          : "Insufficient Evidence",
  confidenceScore: null,
  verdictRationale: "Authored control",
  sources,
  supportingCount: 0,
  contradictingCount: 0,
  neutralCount: 0,
  limitations: [],
  timestamp: "2026-01-01T00:00:00Z",
  verificationMode: mode,
  verificationStatus: status,
});

assert.equal(claimResultSummary(result("SUPPORTED", [source("supports")])).status, "VERIFIED");
const decisiveMarkup = renderToStaticMarkup(React.createElement(ClaimResult, { r: result("SUPPORTED", [source("supports")]) }));
assert.match(decisiveMarkup, /Verified by reviewed evidence/);
assert.match(decisiveMarkup, /href="https:\/\/example\.org\/bridge"/);
assert.match(decisiveMarkup, /The fictional bridge is open for visitors/);
assert.match(decisiveMarkup, /human-reviewed supports/);
assert.equal(
  claimResultSummary(result("CONTRADICTED", [source("contradicts")])).status,
  "CONTRADICTED",
);
assert.equal(
  claimResultSummary(result("CONFLICTING_EVIDENCE", [source("mixed")])).status,
  "MISLEADING",
);
assert.equal(
  claimResultSummary(
    result("CONFLICTING_EVIDENCE", [
      source("supports"),
      { ...source("contradicts"), id: "E2", url: "https://example.net/bridge" },
    ]),
  ).status,
  "NOT_VERIFIED",
);
assert.equal(
  claimResultSummary(result("SUPPORTED", [source("supports")], "search_grounded")).status,
  "NOT_VERIFIED",
  "retrieval or model grounding cannot authorize a definitive label",
);
const unreviewedMarkup = renderToStaticMarkup(React.createElement(ClaimResult, { r: result("SUPPORTED", [source("supports")], "search_grounded") }));
assert.match(unreviewedMarkup, /Retrieved but unreviewed relationship/);
assert.match(unreviewedMarkup, /href="https:\/\/example\.org\/bridge"/);
assert.equal(claimResultSummary(result("INSUFFICIENT_EVIDENCE", [])).status, "NOT_VERIFIED");
const charminar = { ...result("UNAVAILABLE", [], "insufficient_external_evidence"), originalInput: "Charminar is in Hyderabad", targetClaim: "Charminar is in Hyderabad", normalizedClaim: "Charminar is in Hyderabad" };
const charminarSummary = claimResultSummary(charminar);
assert.equal(charminarSummary.status, "NOT_VERIFIED");
assert.match(charminarSummary.explanation, /unavailable|not passed/i);

const single = episodeControls.find((x) => x.name === "public_health")!;
const repeated = episodeControls.find((x) => x.name === "multi_episode_pattern")!;
const none = episodeControls.find((x) => x.name === "shared_popular_url")!;
assert.equal(
  networkResultSummary(analyzeEpisodeCampaign("single", single.rows, false, {}, null, coverage))
    .status,
  "ASSOCIATED_ACTIVITY_OBSERVED",
);
assert.equal(
  networkResultSummary(analyzeEpisodeCampaign("repeated", repeated.rows, false, {}, null, coverage))
    .status,
  "REPEATED_COORDINATION_SIGNALS",
);
assert.equal(
  networkResultSummary(analyzeEpisodeCampaign("none", none.rows, false, {}, null, coverage)).status,
  "NO_SIGNIFICANT_PATTERN_OBSERVED",
);
assert.equal(
  networkResultSummary(analyzeEpisodeCampaign("incomplete", repeated.rows, false)).status,
  "INSUFFICIENT_DATA",
);

const inv = buildDemoInvestigation();
inv.claimResults = [
  result("SUPPORTED", [source("supports")]),
  result("CONTRADICTED", [source("contradicts")]),
  result("CONFLICTING_EVIDENCE", [source("mixed")]),
  charminar,
];
inv.campaignResult = analyzeEpisodeCampaign("repeated", repeated.rows, false, {}, null, coverage);
const html = reportHtml({
  reportId: "summary-test",
  generatedAt: "2026-01-01T00:00:00Z",
  integrityHash: "fixture",
  geminiConfigured: false,
  recommendations: [],
  investigation: inv,
});
assert.match(html, /VERIFIED/);
assert.match(html, /CONTRADICTED/);
assert.match(html, /MISLEADING/);
assert.match(html, /NOT_VERIFIED/);
assert.match(html, /REPEATED_COORDINATION_SIGNALS/);
assert.match(html, /Recommended next action/);
assert.match(html, /Executive Investigation Summary/);
assert.match(html, /href="https:\/\/example\.org\/bridge"/);
assert.match(html, /The fictional bridge is open for visitors/);
assert.match(html, /human-reviewed supports by test-analyst/);

console.log(
  "Result-summary controls passed: reviewed claim gates, conflicts, network recurrence, incomplete data and report output. No factual or maliciousness accuracy claim.",
);
