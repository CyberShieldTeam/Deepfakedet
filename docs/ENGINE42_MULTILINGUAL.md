# Engine 4.2 multilingual readiness

Installed and exercised OCR pack remains English only. Recognition configuration is
explicit; source language is not detected. No translation occurs. Hindi/Telugu requests
still return UNAVAILABLE, preserving existing manual original-language claim entry.
English-model outputs on unsupported scripts remain unvalidated, as the 4.1 controls show.

Smallest practical candidates reuse the existing offline LSTM architecture:

| Official tessdata_fast revision 87416418657359cb625c412a48b6e1d6d41c29bd | Bytes | Publisher Git blob |
|---|---:|---|
| hin.traineddata | 1,122,751 | a8f0aaec09378115b12a2c6287c57695d082aea2 |
| tel.traineddata | 2,769,654 | ee8a33b0f658fc75b8cbfe8c10413eac4f41e6ad |

[Publisher README](https://github.com/tesseract-ocr/tessdata_fast) licenses data Apache-2.0
and specifies LSTM-only compatibility. Official tree metadata was inspected; these packs
were not downloaded/installed. Native and eng+hin/eng+tel combinations would need an
explicit operator install, size/blob/SHA verification, fixed local paths, fail-closed
availability and separate CPU startup/RSS/latency measurements. Current English-only
memory/timing cannot be extrapolated to multiple packs. No such figures are fabricated.

[WIRIndic publisher](https://ilocr.iiit.ac.in/icpr_2024_wirindic/dataset.html) offers relevant
Hindi/Telugu word crops with Unicode validation labels and academic/research permission.
That is useful for future local research, not proof of commercial redistribution rights,
screenshot relevance, trained-model independence or fluent review agreement.

Decision: defer new language activation this slice. The independent probe exposed
substantial English-configured Latin-script errors and layout sensitivity; native-script
ground truth, native-speaking review and multilingual integration measurements have not
been collected. A small successful rendering alone would not establish readiness.
Next native-language gate: rights-cleared validation material, separate source/script and
mixed-language strata, blinded native reviewers, language-pack/input contracts and
resource measurements, with English pixel/output regressions unchanged. Any initial
activation must be explicitly experimental until independent held-out quality is known.
