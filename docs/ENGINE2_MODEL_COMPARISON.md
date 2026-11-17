# Pretrained model comparison and decisions

No model was trained or fine-tuned. Official model sources/configurations and pinned
Hub metadata were inspected before approved sequential downloads. Initial machine:
~16 GiB RAM, ~3.1 GiB free physical RAM, ~765 GiB disk free. Free RAM varies with apps;
memory admission remains enforced. All active local classifiers retain prior policies.

| Candidate | Task / language / architecture | Assets and execution | Decision |
| --- | --- | --- | --- |
| [MiniLM2 NLI](https://huggingface.co/cross-encoder/nli-MiniLM2-L6-H768) | English SNLI/MultiNLI, RoBERTa/MiniLMv2, six layers/768, ~82.1M parameters, 512 tokens | Existing pinned 328.5 MB weights reused; executed fresh R2 plus authored controls | Failed R1 and fresh R2 gates; remains quarantined |
| [DeBERTa-v3-small NLI](https://huggingface.co/cross-encoder/nli-deberta-v3-small) | English SNLI/MultiNLI, DebertaV2ForSequenceClassification, six layers/768, measured 141,897,219 parameters, 512 tokens | Apache-2.0, 567,605,820-byte safetensors; approved download, offline actual execution | Failed fresh R2 gates; offline evaluation only, no replacement |
| [MS MARCO MiniLM-L6 reranker](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2) | English passage relevance, six layers/384, 22.7M, 512 tokens | Apache-2.0, 90,870,598-byte weights; executed FEVER proxy/SciFact and actual browser | Optional experimental relevance order only; default disabled |
| [mDeBERTa MNLI/XNLI](https://huggingface.co/MoritzLaurer/mDeBERTa-v3-base-mnli-xnli) | Multilingual, 12 layers/768, Hub ~0.3B parameters, 512 tokens; MNLI train and professionally translated XNLI development fine-tuning | MIT publisher card; inspected revision `8adb042d524ecd5c26d3e3ba0e3fbcf7e2d0864c`, 557,652,046-byte F16 safetensors; **not downloaded/executed** | Hindi appears in XNLI; Telugu is not demonstrated by those labels. Higher FP32 memory and different label order require a separate bounded evaluation; deferred |

DeBERTa revision `fa2804872c3b4bd748f38c0185cc85775361e735`; weights SHA-256
`ebc79588dd73ccfb6a3f6078519cfbf512c5305384c5ea1845bc71cd32216e86`.
Snapshot total **578,729,759 bytes** including pinned fast tokenizer, SentencePiece and
config. Built-in Transformers compatibility verified by actual local loading/inference;
no remote code, no package installation needed. Source passage first, claim second,
no silent truncation; label order contradiction/entailment/neutral was checked.
Admission estimate 2.5 GiB free RAM; actual peak 704,671,744 bytes (~672 MiB), startup
9.67 s, median pair 128.07 ms/p95 186.58 ms. This is one CPU run, not a universal budget.

Multilingual inspected weight SHA-256:
`65af59b1ff4450b09ecbf13ca35c840dbf038b26ff8e10e5ea89ca724828ed1e`.
Its config class order is **entailment/neutral/contradiction**, unlike existing NLI.
Its card warns about FP16 support; the smaller on-disk F16 file must not be used to
infer FP32 runtime RAM. An estimated ≥3 GiB free headroom plus framework/loading margin
would need measurement, not lowering existing budgets. No Hindi/Telugu quality or
latency has been measured here. Publisher benchmark claims were not used as local results.

Fresh NLI comparison and annotation limitations are in
[target-domain evaluation status](ENGINE2_TARGET_DOMAIN_EVALUATION.md).
Reranker evidence and deployment bounds are in
[reranker evaluation](ENGINE2_RERANKER_EVALUATION.md). Neither relevance logits nor
three-class softmax are calibrated truth probabilities.
