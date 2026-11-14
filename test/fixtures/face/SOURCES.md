# Face detector smoke fixtures

These photographs are for testing face region detection, not for image authenticity benchmarks. They do not establish whether a photograph was edited.

| File | Source | License | Expected smoke result |
| --- | --- | --- | --- |
| `headshot_cc0.jpg` | [Headshot 2026.jpg](https://commons.wikimedia.org/wiki/File:Headshot_2026.jpg), 500 px preview, author Mdb1909 | CC0 1.0 | At least one face candidate |
| `portrait_cc0.jpg` | [Portrait (CreativeCommons).jpg](https://commons.wikimedia.org/wiki/File:Portrait_(CreativeCommons).jpg), 960 px preview, author Wendelin Jacober | CC0 1.0 | May miss a small face; documents scale limitation |

OpenCV Zoo [YuNet](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) weights are MIT-licensed and downloaded separately with a pinned SHA-256 by `ai_service/download_yunet.py`.
