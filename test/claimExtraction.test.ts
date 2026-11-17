import assert from "node:assert/strict";
import {
  extractClaimCandidates,
  approveClaimSelection,
  textHash,
  suspectedRomanized,
} from "../server/claimExtraction";
import { claimInput, claimExtractionInput } from "../server/security";
const input =
  "BREAKING: The dam near Hyderabad has collapsed. Evacuate immediately and share this with everyone!";
const candidates = extractClaimCandidates(input);
assert.equal(candidates.length, 2);
assert.equal(candidates[0].text, "The dam near Hyderabad has collapsed.");
assert.equal(candidates[0].category, "assertion_candidate");
assert.equal(candidates[1].category, "instruction");
for (const c of candidates) assert.equal(input.slice(c.start, c.end), c.text);
const examples: [string, string][] = [
  ["Has the dam collapsed?", "question"],
  ["Please share this alert.", "instruction"],
  ["I think this is misleading.", "opinion"],
  ["The bridge might collapse.", "prediction"],
  ["“The museum opened in 1992.”", "quotation"],
  ["Imagine a fictional scenario.", "hypothetical_or_satire"],
  ["The bridge opened in 1992 and it closed in 1993.", "compound"],
  ["The dam has not collapsed.", "assertion_candidate"],
  ["The museum opened on May 14, 1988.", "assertion_candidate"],
  ["पुल 1992 में खुला था।", "assertion_candidate"],
  ["దయచేసి ఈ సందేశం పంపండి.", "instruction"],
  ["क्या पुल टूट गया?", "question"],
];
for (const [text, category] of examples) {
  const result = extractClaimCandidates(text);
  assert.equal(result[0].category, category, text);
  for (const c of result) assert.equal(text.slice(c.start, c.end), c.text);
}
assert.equal(suspectedRomanized("Yeh pul nahi toota hai."), true);
assert.equal(suspectedRomanized("Ee bridge kaadu."), true);
const selection = {
  candidateId: candidates[0].id,
  text: candidates[0].text,
  language: "en" as const,
  contextConfirmed: true as const,
  note: "Authored control: reviewed complete original context.",
};
const review = approveClaimSelection(input, selection, "test");
assert.equal(review.originalInputSha256, textHash(input));
assert.equal(review.originalCandidate?.start, 10);
assert.equal(review.edited, false);
assert.equal(
  approveClaimSelection(
    input,
    { ...selection, text: "The dam near Hyderabad has not collapsed." },
    "test",
  ).edited,
  true,
);
assert.throws(() =>
  approveClaimSelection(input, { ...selection, candidateId: "invented" }, "test"),
);
assert.throws(() => approveClaimSelection(input, { ...selection, note: "short" }, "test"));
assert.equal(claimInput.safeParse({ claimText: input }).success, true);
assert.equal(claimInput.safeParse({ claimText: input, selection }).success, true);
assert.equal(
  claimInput.safeParse({ claimText: input, selection: { ...selection, contextConfirmed: false } })
    .success,
  false,
);
assert.equal(claimExtractionInput.safeParse({ claimText: input, sources: [] }).success, false);
console.log(
  "Claim extraction controls passed: exact offsets, assertions/instructions/questions/opinions/predictions/quotations/compound cases, dates/negation, limited Hindi/Telugu/romanized controls, explicit original-bound selection. Not multilingual accuracy validation.",
);
