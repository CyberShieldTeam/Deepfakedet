# Engine 2 model selection and implementation

Baseline: clean/synchronized `6430738` on `codex/integrate-figma-upgrade`.
Audited input → sentence diagnostics → corpus/Google/Wikipedia → dedup/BM25/optional
E5 → neutral sources → signed attributed review → cases/correlation/report. No automatic
stance model ran previously. Existing E5 represents retrieval similarity, not entailment.
Earlier records [claim verification](CLAIM_VERIFICATION.md),
[retrieval validation](CLAIM_RETRIEVAL_VALIDATION.md) and
[runtime profiling](CLAIM_RUNTIME_PROFILE.md) remain history.

Implemented plan: original-bound assertion selection; separate bounded NLI worker;
predeclared external evaluation; explicitly experimental source relationships; retained
human review/history; source-linked UI, graph and report; regression/browser verification.

## Candidate decision

| Candidate | Publisher terms/task | Checkpoint/resources | Decision |
| --- | --- | --- | --- |
| cross-encoder/nli-deberta-v3-small | Apache-2.0, English SNLI/MultiNLI NLI, DeBERTa-v3 | 567,605,820-byte safetensors; extra tokenizer/SentencePiece requirements | Researched, not downloaded/executed; larger than selected bounded experiment |
| cross-encoder/nli-MiniLM2-L6-H768 | Apache-2.0, English SNLI/MultiNLI NLI; MiniLMv2 distilled from RoBERTa-large | 82.1M parameters, six layers, hidden 768, 512-token pairs; 328,499,560-byte weights | User explicitly approved download; executed and evaluated; failed promotion criteria |

MiniLM selection was a resource-constrained experiment, not an assertion that the smallest
model is best. Available RAM varied roughly 1.7–2.1 GiB during setup; one browser/model
load was refused below the unchanged 1.5 GiB engineering admission estimate. Model
architecture/size do not establish inference accuracy. No other large weights downloaded.

Pinned model revision: `b95119ce93d3e065de6214e38cd4a97b0f2f2c6d`;
weight SHA-256 `ec9c5b6a08b60d7a01b465c7ed44b496244dfd1bed3274c95875a74cea89ab35`.
All seven files (331,111,701 bytes total) match pinned publisher size and Git/LFS hashes.
Safetensors only, local offline load, no remote code, strict class map:
0 contradiction / 1 entailment / 2 neutral. Exact passage is premise, claim is hypothesis.
Installed CPU PyTorch/Transformers/tokenizers suffice; no working dependencies upgraded.

## Runtime boundaries

`ai_service.claim_nli` is an isolated JSON-line CPU worker supervised by Express, separate
from media/OCR services. No runtime download. At most one active request, eight pairs,
one pair per forward, two CPU threads, 512 tokens, no silent truncation. Pair character
bounds and 64 KiB protocol/output caps apply. Startup deadline 90 s, inference deadline
20 s; failures terminate the owned process tree and return no invented scores. At most
three starts in ten minutes per supervisor; idle worker expires after five minutes.
No request/result cache or retained claim log. Auth/retrieval secrets are removed from
the child environment; stderr is drained without retaining or returning private text.

Resource admission is an engineering estimate, not a validated minimum. Other local
apps/browser memory can make inference unavailable. Do not lower the budget to conceal
that condition. Closing unrelated apps is an operator decision; none were closed here.

Primary sources:
[MiniLM publisher model card](https://huggingface.co/cross-encoder/nli-MiniLM2-L6-H768),
[pinned config](https://huggingface.co/cross-encoder/nli-MiniLM2-L6-H768/blob/b95119ce93d3e065de6214e38cd4a97b0f2f2c6d/config.json),
[DeBERTa publisher model card](https://huggingface.co/cross-encoder/nli-deberta-v3-small).
NLI classifies textual relationships; it cannot establish source credibility, timeliness
or factual truth. Failed validation is documented in [evaluation](ENGINE2_NLI_EVALUATION.md).
