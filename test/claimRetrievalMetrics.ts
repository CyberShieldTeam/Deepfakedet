/** Pure retrieval metrics. Relevance judgments must cover the declared candidate pool. */
export function retrievalMetrics(
  ranked: string[],
  judgments: Record<string, number>,
  k: number,
  graded = false,
) {
  if (
    !Number.isInteger(k) ||
    k < 1 ||
    new Set(ranked).size !== ranked.length ||
    ranked.some((id) => !Object.hasOwn(judgments, id)) ||
    Object.values(judgments).some((v) => !Number.isInteger(v) || v < 0 || v > 3)
  )
    throw new Error("Unique, completely judged retrieval pool and positive K required");
  const positives = Object.values(judgments).filter((v) => v > 0).length;
  const found = ranked.slice(0, k).filter((id) => judgments[id] > 0).length;
  const first = ranked.findIndex((id) => judgments[id] > 0);
  const dcg = (grades: number[]) =>
    grades.slice(0, k).reduce((sum, g, i) => sum + (2 ** g - 1) / Math.log2(i + 2), 0);
  const ideal = dcg(Object.values(judgments).sort((a, b) => b - a));
  return {
    k,
    recall: positives ? found / positives : null,
    precision: found / k,
    mrr: positives ? (first < 0 ? 0 : 1 / (first + 1)) : null,
    ndcg: graded && ideal ? dcg(ranked.map((id) => judgments[id])) / ideal : null,
  };
}

/** Translations and source derivatives stay in one split. Reserved roles never enter development. */
export function validateEvaluationGroups(
  rows: {
    id: string;
    split: string;
    sourceIds: string[];
    translationGroup: string;
    sha256: string;
  }[],
) {
  const seen = new Map<string, string>(),
    ids = new Set<string>();
  for (const row of rows) {
    if (
      !["development", "validation"].includes(row.split) ||
      !row.id ||
      ids.has(row.id) ||
      !row.translationGroup ||
      !row.sourceIds.length ||
      row.sourceIds.some((s) => !s) ||
      !/^[a-f0-9]{64}$/.test(row.sha256)
    )
      throw new Error("Incomplete, duplicate or reserved evaluation entry");
    ids.add(row.id);
    for (const key of [
      `translation:${row.translationGroup}`,
      `hash:${row.sha256}`,
      ...row.sourceIds.map((s) => `source:${s}`),
    ]) {
      if (seen.has(key) && seen.get(key) !== row.split)
        throw new Error("Source or translation lineage crosses splits");
      seen.set(key, row.split);
    }
  }
}
