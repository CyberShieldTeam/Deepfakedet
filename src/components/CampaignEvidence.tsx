import React from "react";
import type { CampaignAnalysisResult } from "../types";
export function CampaignEvidence({ result }: { result: CampaignAnalysisResult }) {
  const [selected, setSelected] = React.useState("");
  const [openEpisode, setOpenEpisode] = React.useState("");
  const evidence = result.episodeEvidence;
  if (!evidence) return null;
  const association =
    evidence.associations.find((a) => a.edgeId === selected) || evidence.associations[0];
  const episodeIds = new Set(association?.episodeIds || []);
  const witnessMap = new Map(evidence.witnesses.map((w) => [w.id, w]));
  const posts = new Map(evidence.posts.map((p) => [p.reference, p]));
  return (
    <section
      className="min-w-0 break-words space-y-3 rounded-lg border border-cyan-900 p-4"
      aria-label="Campaign episode evidence"
    >
      <h3 className="font-semibold text-cyan-200">Campaign episodes and post evidence</h3>
      <button
        className="rounded border border-cyan-800 px-3 py-1 text-xs text-cyan-200"
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob(
              [
                JSON.stringify(
                  {
                    algorithm: result.algorithm,
                    episodeEvidence: evidence,
                    embeddingCompatibility: result.embeddingCompatibility,
                    edges: result.edges,
                  },
                  null,
                  2,
                ),
              ],
              { type: "application/json" },
            ),
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = "veritas-campaign-evidence.json";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        Download campaign evidence JSON
      </button>
      <p className="text-sm text-slate-300">
        {evidence.observation} · {evidence.episodes.length} bounded pair episodes ·{" "}
        {evidence.associations.filter((a) => a.recurrenceEligible).length} pairs eligible for
        recurrence review.
      </p>
      <p className="text-xs text-slate-400">
        Dissemination observations do not determine media authenticity, claim truth, malicious
        intent or common account control.
      </p>
      <ul className="list-disc pl-4 text-xs text-amber-200">
        {evidence.warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <p className="text-xs text-slate-400">
        Duplicates removed: {evidence.duplicatesRemoved} · omitted witnesses:{" "}
        {evidence.omittedWitnesses} · omitted associations: {evidence.omittedAssociations}.
        Coverage: {evidence.coverage?.source || "not supplied"};{" "}
        {evidence.coverageComplete ? "declared complete" : "incomplete or unknown"}.
      </p>
      {result.embeddingCompatibility && (
        <p className="text-xs text-slate-400">
          Semantic evidence: {result.embeddingCompatibility.status} ·{" "}
          {result.embeddingCompatibility.format}. {result.embeddingCompatibility.detail}
        </p>
      )}
      <label className="flex flex-wrap gap-2 text-xs text-slate-300">
        Inspect association
        <select
          aria-label="Inspect campaign association"
          value={association?.edgeId || ""}
          onChange={(e) => {
            setSelected(e.target.value);
            setOpenEpisode("");
          }}
          className="max-w-full rounded border border-slate-700 bg-slate-950 p-2"
        >
          {!evidence.associations.length && <option value="">No observed associations</option>}
          {evidence.associations.map((a) => (
            <option value={a.edgeId} key={a.edgeId}>
              {a.source} ↔ {a.target} · {a.separatedEpisodeCount} separated episodes
            </option>
          ))}
        </select>
      </label>
      {association && (
        <p className="text-xs text-slate-400">
          {association.recurrenceEligible
            ? "Repeated separated observations eligible for analyst review; legitimate schedules remain possible."
            : "No eligible recurrence conclusion; inspect timing, IDs, coverage and limits."}
        </p>
      )}
      <div className="max-h-96 space-y-3 overflow-auto">
        {evidence.episodes
          .filter((e) => episodeIds.has(e.id))
          .slice(0, 100)
          .map((ep) => (
            <details
              key={ep.id}
              className="rounded border border-slate-700 p-3 text-xs"
              open={(openEpisode || association?.episodeIds[0]) === ep.id}
              onToggle={(event) => {
                if (event.currentTarget.open) setOpenEpisode(ep.id);
              }}
            >
              <summary className="cursor-pointer text-cyan-200">
                {ep.id} · {ep.start} — {ep.end}
              </summary>
              <p className="my-2 text-slate-400">
                First or conservatively separated bin: {String(ep.separatedFromPrevious)} · provided precise
                IDs/times: {String(ep.preciseProvidedIds)}
              </p>
              {(openEpisode || association?.episodeIds[0]) === ep.id &&
                ep.witnessIds.slice(0, 50).map((id) => {
                  const w = witnessMap.get(id);
                  if (!w) return null;
                  const a = posts.get(w.sourcePost)!,
                    b = posts.get(w.targetPost)!;
                  return (
                    <div
                      key={id}
                      className="my-2 space-y-1 rounded bg-slate-950 p-2 text-slate-300"
                    >
                      <p className="break-all font-mono">{id}</p>
                      {[a, b].map((p) => (
                        <div key={p.reference} className="border-l border-slate-700 pl-2">
                          <b>
                            {p.accountId} · {p.postId || p.reference} ({p.idKind})
                          </b>
                          <p>
                            UTC {p.timestamp}; original {p.originalTimestamp}; resolution{" "}
                            {p.resolutionMs} ms
                          </p>
                          <p>{p.content}</p>
                          {(p.sourceMetadata?.length || 0)>1 && <p className="text-amber-200">Multiple source declarations retained; widest uncertainty used. Inspect sourceMetadata in the evidence JSON.</p>}
                        </div>
                      ))}
                      <p>
                        Content Jaccard {w.text.toFixed(3)} · URL overlap {w.url.toFixed(3)} ·
                        hashtag overlap {w.tag.toFixed(3)} · gap {w.dt.toFixed(3)} s · semantic{" "}
                        {w.semanticCosine?.toFixed(3) ?? "unavailable"} (diagnostic only)
                      </p>
                      <p className="break-all">
                        Shared URLs: {w.sharedUrls.join(", ") || "none"} · hashtags:{" "}
                        {w.sharedHashtags.join(", ") || "none"}
                      </p>
                    </div>
                  );
                })}
              {ep.witnessIds.length > 50 && (
                <p>
                  View limited to 50 witnesses; complete retained records remain in the case export.
                </p>
              )}
            </details>
          ))}
      </div>
      {(association?.episodeIds.length || 0) > 100 && (
        <p className="text-xs text-slate-400">
          View limited to 100 episodes; complete retained records remain in the case export.
        </p>
      )}
    </section>
  );
}
