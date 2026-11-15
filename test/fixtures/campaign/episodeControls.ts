/** Authored fictional controls. Expected observations frozen before evaluation, not account truth. */
const at = (seconds: number) => new Date(Date.UTC(2026, 0, 1) + seconds * 1000).toISOString();
export const coverage = {
  start: at(-60),
  end: at(20000),
  complete: true,
  source: "Explicit authored software control observation window",
};
const rows = (rounds: number[], text: string) =>
  ["a", "b", "c", "d"].flatMap((account, i) =>
    rounds.map((seconds, j) => ({
      account_id: account,
      post_id: `${account}-${j}`,
      content: text,
      timestamp: at(seconds + i),
      url: "https://example.org/public-bulletin",
    })),
  );
export const episodeControls = [
  ...[
    ["public_health", "Fictional public health announcement: clinic open today."],
    ["emergency_alert", "Fictional emergency alert: use the marked exit safely."],
    ["breaking_news", "Fictional breaking news: the road reopened this afternoon."],
    ["sports", "Fictional sports update: the local team won the match."],
    ["news_syndication", "Fictional syndicated bulletin: weather conditions remain stable."],
    ["independent_users", "Fictional independent users share the same useful news report."],
  ].map(([name, text]) => ({
    name,
    rows: rows([0], text),
    expected: { episodesPerPair: 1, recurrenceEligiblePairs: 0, maliciousAccounts: 0 },
  })),
  {
    name: "repeated_official_bulletins",
    rows: rows([0, 30, 60], "Fictional official bulletin: the clinic is open for appointments."),
    expected: { episodesPerPair: 1, recurrenceEligiblePairs: 0, maliciousAccounts: 0 },
  },
  {
    name: "shared_popular_url",
    rows: ["a", "b", "c", "d"].map((account, i) => ({
      account_id: account,
      post_id: account,
      content: [
        "Fictional rainfall forecast",
        "Fictional chess tournament",
        "Fictional school calendar",
        "Fictional art exhibition",
      ][i],
      timestamp: at(i),
      url: "https://example.org/public-bulletin",
    })),
    expected: { episodesPerPair: 0, recurrenceEligiblePairs: 0, maliciousAccounts: 0 },
  },
  {
    name: "scheduled_organizational_announcements",
    rows: rows(
      [0, 3600, 7200],
      "Fictional scheduled organizational announcement: registration remains open.",
    ),
    expected: { episodesPerPair: 3, recurrenceEligiblePairs: 6, maliciousAccounts: 0 },
  },
  {
    name: "multi_episode_pattern",
    rows: rows(
      [0, 4000, 8000],
      "Fictional repeated posting pattern for an authored software control.",
    ),
    expected: { episodesPerPair: 3, recurrenceEligiblePairs: 6, maliciousAccounts: 0 },
  },
];
