# Engine 1 model and resource comparison

Audit date2026-11-17. Official publisher documentation and local verified code take precedence over suggested models. No publisher benchmark is reported as a local result. Exact SHA/size/config pins for the four cached image candidates live in [registry](../ai_service/media_model_registry.py); loading is local-only and remote code disabled. Runtime never downloads a missing checkpoint for these paths. YuNet/AASIST retain their existing explicit download scripts and pinned digests.

| Candidate / source | Identity, rights and input | Training/domain limits | Current decision |
|---|---|---|---|
| [Community](https://huggingface.co/OwensLab/commfor-model-384) | MIT; ViTsmall21.8M;87,262,324bytes; revision6076002bf0d9dd37537f965ee2f06f826c333b61; resize shortside440/center384/ImageNetnorm, sigmoid | Community Forensics broad generator data and LAION genuine distribution; publisher overlap with new eval cannot be wholly excluded | Executed external80-source comparison; prior parity already passed, not repeated. No promotion |
| [Dima](https://huggingface.co/dima806/ai_vs_real_image_detection) | Apache2; ViTbase224;343,223,968bytes; revision9d17b51b9367d6b5720ac81dc339455c45d50ae3; checkpoint processor, REAL0/FAKE1 | Publisher AI-vs-real image dataset; not a universal manipulation model; incomplete source lineage | Executed external comparison; high FPR; disabled by default |
| [Organika SDXL](https://huggingface.co/Organika/sdxl-detector) | CC-BY-NC3; Swin224;347,498,816bytes; revisionb37fede8562cb72b89ec201c0987f96ba21b518a; checkpoint processor, artificial0/human1 | SDXL-versus-human domain; no universal generator coverage | Executed offline comparison; no production adapter or promotion |
| [DeiTFake v2](https://huggingface.co/sakshamkr1/deitfake-v2) | Apache2; ViT224;343,223,968bytes; revisionf70338d328ba268d2b9d5c6af11044cf0b0e1400; Fake0/Real1 | OpenForensics-derived publisher domain; VERITAS20%context/32pixel minimum/max10face crop policy not validated | Cached adapter audited, default disabled; no fresh labelled manipulation accuracy |
| [YuNet](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) | MIT;2023marONNX232,589bytes | Face-region candidate detection only; small/distant faces may be missed | Ready; never described as a face-swap detector |
| [AASIST](https://github.com/clovaai/aasist) | MIT;1,281,532bytes; revisiona04c9863f63d44471dde8a6abcb3b082b07cd1d1;16kHz64600samples | ASVspoof2019LA speech, spoof0/bona-fide1; not universal audio | Actual external evaluation failed target-domain FPR; experimental segments only |
| [Smaug](https://huggingface.co/abacusai/Smaug-AI-Image-Detector) | Apache2; revisionc7c95951e04a87b884a4ad479401b1128c3903bd;877,599,816-byte backbone plus1,690-byte head; three528views/logitmean/sigmoid | Publisher multigenerator training; not verified against local target domain; required publisherST/transformers5 stack differs from workingtransformers<5 | Missing checkpoint; prior5GiB physical/commit conservative research admission failed; not loaded or scored |
| [UniversalFakeDetect](https://github.com/WisconsinAIVision/UniversalFakeDetect) | MIT detector; CLIP separately licensed; official revision030495aea3300a8b54c0ec37ec7fe1dd7e63c619;ViTL14backbone pluslinearhead; CLIP224normalization | ProGAN-trained linear boundary not guaranteed for unseen domains; officialCUDA validation loader | Backbone absent; prior4GiB physical/commit conservative research admission failed; no local accuracy/runtime claim |
| [NPR](https://github.com/chuangchuangtan/NPR-DeepfakeDetection) | Nearest-down/up residual and truncatedResNet50; linked5,842,385-byte model candidate; [author Space](https://huggingface.co/spaces/tancc/Generalizable_Deepfake_Detection-NPR-CVPR2024) revision522a9f1020f7454d486f28a0d5c148ec37919b32 has Apache2 wrapper card | ProGAN/frequency-neighborhood task; no main-repo LICENSE found; wrapper license does not clearly grant linked external checkpoint rights | No weights/code copied; defer checkpoint rights clarification and pinned publisher parity |

New video candidates and their concrete blockers are in [video assessment](ENGINE1_VIDEO_EVALUATION.md). Training data descriptions above are publisher scope, not a local independent audit of complete membership. No third-party code from newly researched candidates was incorporated.

Environment measured before expensive runs: i7-13700H14cores/20logical;16,876,888,064bytes RAM (~15.7GiB), about3.0–3.3GiB available;817,322,405,888bytes free disk (~761GiB). RTX3050Laptop6GB hardware present, but installed **torch2.15.0+cpu**, `torch.cuda.is_available()==False`, CUDA runtime null. Hardware presence is not usable GPU inference. Python3.13.12; transformers4.57.6,timm1.0.31,numpy2.5.4,Pillow12.3.0,soundfile0.14.0,scipy1.18.1,safetensors0.8.0,psutil7.2.2. pyarrow26.0.1 isolated research reader; onnxruntime and webrtcvad not installed. They are not required for current OpenCVYuNet/AASIST execution.

Warm local-cache startup and measured peak Windows working set (not portable minimum or uncached/network cold-start guarantee):

| Run | Startup | Whole evaluation | Peak working set |
|---|---:|---:|---:|
| Community |4.240s|20.804s|510,595,072bytes|
| Dima |15.264s|41.286s|757,379,072bytes|
| SDXL |5.751s|28.910s|798,928,896bytes|
| AASIST |1.778s|32.721s|558,174,208bytes|

Community held-out original p95 inference102.12ms, matched104.04ms. Full per-input and aggregate latency in JSON reports. Working set is per evaluation process and excludes all unrelated system processes; this is not a service concurrency capacity claim. All large comparisons ran sequentially.

Reliability: CPU batch1, offline checkpoint pins,2GiB image/face and1GiB AASIST physical-memory admission, image/audio nonblocking single-request locks, existing Express deadlines45/60/120s and supervised evaluation/temporal worker limits. A client timeout alone does not cancel in-process Python model work; hard-kill supervision of every production image/audio forward is **not implemented**. Do not claim that bounded uploads alone guarantee a fixed compute deadline. Smaug research admission remains blocked; the optional service gate checks physical memory, not a new portable commit-budget guarantee.
