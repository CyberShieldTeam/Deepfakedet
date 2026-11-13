# VERITAS AI — Suraksha Suchan
### Digital Trust & Forensic Intelligence

VERITAS checks suspicious **photos, videos, voice notes and news claims**, and finds **groups of accounts spreading the same rumour**, in **English, Hindi and Telugu**. Everything comes together in one investigation with a downloadable report.

Built for **YUKTIK-2026 (Keshav Memorial Institute of Technology)**.

> **Honesty first.** VERITAS never invents sources, never claims certainty it does not have, and clearly labels anything **SIMULATED** (demo data). Automated checks can be wrong. Confirm important claims with an official source.

---

## Contents
1. [Quick start](#1-quick-start)
2. [What each page does (and how to use it)](#2-what-each-page-does)
3. [How the detection works](#3-how-the-detection-works)
4. [What is real, what is simulated, what needs Gemini](#4-what-is-real-what-is-simulated-what-needs-gemini)
5. [Tech stack](#5-tech-stack)
6. [Project structure](#6-project-structure)
7. [API reference](#7-api-reference)
8. [Gemini quotas & troubleshooting](#8-gemini-quotas--troubleshooting)
9. [Test results](#9-test-results)
10. [Limitations](#10-limitations)

---

## 1. Quick start

**Requirements:** Node.js 20 or newer, npm.

```bash
npm install
```

Create a file called **`.env`** in the project folder (next to `package.json`). A template is in `.env.example`.

```env
GEMINI_API_KEY=your-key-from-aistudio.google.com
GEMINI_MODEL=gemini-3.8-flash      # optional; falls back automatically
PORT=3000                          # optional
```

Start the app:

```bash
npm run dev
```

Open **http://localhost:3000**.

- **Without a Gemini key** the app still runs: you get basic checks (edit heatmap, frame and audio analysis, network detection, rule-based screening), all clearly labelled.
- **The key stays on the server.** It is never sent to the browser.
- Check the AI connection at **http://localhost:3000/api/health**. Look for `"geminiReady": true`.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Runs the unit tests (campaign engine, calibration rules, demo data integrity) |
| `npm run lint` | TypeScript type-check |
| `npm run build` | Builds the frontend into `dist/` |
| `NODE_ENV=production npx tsx server.ts` | Serves the built app from `dist/` (run `npm run build` first) |

Saved cases are stored in `data/investigations.json` (created automatically, git-ignored). Delete that file to reset to the 4 original sample cases.

> Docker: `docker-compose.yml` is present but there is no `Dockerfile`, so Docker is **not** currently supported.

---

## 2. What each page does

The sidebar groups the pages into **Start → Check something → Investigate**. The **"Save results to"** box at the top chooses which case your saved results go into. **"Try the demo"** loads a complete fictional story.

### 🏠 Home — *"Is it real, or is it fake?"*
The command centre.
- **Four quick actions:** check media, fact-check a message, find fake account networks, try the demo.
- **Current threat level** (GUARDED → ELEVATED → HIGH → CRITICAL), based on the number and severity of alerts in the last 10 minutes.
- **At a glance:** saved cases, suspicious media, false claims, fake account groups, posts monitored, alerts.
- **Charts:** live activity (posts vs alerts every 15 s), media results so far, and how fast the rumour spread.
- **Live feed:** incoming posts and warnings. The posts are **simulated**; the duplicate-post and hashtag-spike detection on them is real.

**Try the demo** replays a fictional story: at 10:00 a fake *"Hyderabad dam collapsed"* video spreads, followed by AI evacuation audio, a recycled flood photo, a fake official video, coordinated accounts, and posts in 3 languages, until a (fictional) official bulletin contradicts it. Alerts pop up one by one (26 story-minutes in about 20 s) and the threat level rises to CRITICAL. **Click it once**: each click adds another demo case.

### 🖼️ Check media — photos, videos, audio
1. Drag a file in, or click to choose one (JPG/PNG/WEBP, MP4/MOV/WEBM, MP3/WAV/M4A).
2. Press **Check this file**.
3. Read the result on the right: a plain verdict ("This image looks AI-generated", "We can't tell…", "No signs found — not a guarantee") plus **What to do** advice.

Photos get **two separate answers**: *Was it made by AI?* and *Was a real photo edited?* Optional extras:
- **Edit heatmap** (Error Level Analysis) and **Compare** slider
- the video frame timeline
- the audio waveform and spectrogram
- **Technical details (for experts)**

**Save to a case** keeps the result for the report.

### ✅ Fact-check a claim
1. Paste a WhatsApp forward, post or headline (English, हिन्दी or తెలుగు), or click a sample.
2. Press **Check this claim**.
3. Read the verdict, which is one of:
   - **True — confirmed by sources**
   - **False — contradicted by sources**
   - **Partly true**
   - **Probably true / Probably false, but not verified**
   - **We couldn't verify this claim**

You also see the reasons, sources (only real ones), evidence for and against, and the original text beside its English translation.

### 🌐 Hindi & Telugu (Languages)
Rumours travel in several languages at once.
- With the demo case selected, the top table shows **the same rumour in English, Hindi and Telugu**.
- Paste text in any of the three languages → **Translate & check** → original beside English translation, plus a fact-check.
- Charts show the language mix of the live feed and of the selected case's accounts.

Sample inputs:

| Expect | Input |
|---|---|
| Probably false | `హైదరాబాద్ దగ్గర డ్యామ్ కూలిపోయింది! వెంటనే ఇళ్లు ఖాళీ చేయండి, అందరికీ పంపండి` |
| Probably true | `చార్మినార్ హైదరాబాద్‌లో ఉంది` · `ताजमहल आगरा में स्थित है और इसे शाहजहाँ ने बनवाया था` |

### 🕸️ Fake account networks
Finds groups of accounts working together.
- **Try with sample posts:** 22 demo accounts, 3 groups.
- **Upload posts (CSV / JSON):** for example the included **`demo_network_posts.csv`**, which finds 2 groups and correctly leaves the 3 genuine users out.
- **Download sample file:** gives you a template.

Required columns (alternative names in brackets also work):

```
account_id (id, user_id), username (handle, user), content (text, post, message),
timestamp (time, created_at, date), shared_url (url, link), hashtags (tags), language (lang)
```

The **map** shows each account as a dot, coloured by group, with lines linking accounts that act together. Hover a line to see why they are linked; click a dot for account details. Use the group buttons to highlight one group.

### 📁 My cases & reports
- Create a case, or let one be created automatically when you press **Save to a case**.
- Pick a case to see its media findings, claim checks, network analysis and timeline.
- **Report** opens the unified investigation report:
  - case ID, incident summary, media analysis, claim verification and network findings
  - evidence references, confidence, risk, recommendations, limitations and timestamp
  - a **SHA-256 integrity hash** of the case record

  You can **Print / Save PDF** or **Download** (HTML) it.

### 🔔 Alerts
Live warnings, pushed instantly with Server-Sent Events:
- fake-looking media
- false claim
- fake account group
- copy-paste posts
- sudden spike

Filter by type. Alerts from the demo feed are tagged **simulated**.

---

## 3. How the detection works

### 3.1 Photos — two separate questions
**Q1 · Was it made by AI?**
1. The **original file bytes** are sent, never re-compressed. Testing showed JPEG re-encoding erased the detail the model relies on (a known AI image went from 99% to 0%).
2. **Three short, independent Gemini checks** ("Is this AI-generated or a real photograph?") are run at temperature 0.
3. **Majority rule:** checks within 20 points of the median decide. One outlier is outvoted (and noted). With no majority, the verdict is **Can't tell**.
4. **Provenance metadata:** if the file carries a C2PA / IPTC "made with AI" tag, that outranks the visual judgement.

**Q2 · Was a real photo edited?**
- One detailed Gemini pass (full image + 4 close-up crops) looks for splicing, cloning and inconsistent lighting.
- **Error Level Analysis (ELA)**, computed in your browser, supports this question only. It is never used as proof of AI generation.
- Missing EXIF metadata is **never** treated as evidence either way.

**Calibration rules (applied by the server, not taken from the model):**

| Verdict | Rule | Max confidence |
|---|---|---|
| Likely | majority median ≥ 80 | 80 % |
| Possible | ≥ 55 | 60 % |
| No signs found | ≤ 20 (and labelled "not proof") | 55 % |
| Can't tell | checks disagree, no majority, or mid-range | 40 % |

Displayed AI probability is capped at 90% unless provenance metadata declares AI.

### 3.2 Videos
- 16 frames are sampled in the browser.
- **Sudden-change detection** (mean frame difference + robust z-score) flags cuts and spliced clips.
- 6 keyframes are sent to Gemini for an overall judgement.

### 3.3 Audio
- Decoded in the browser with the Web Audio API.
- A hand-written FFT produces the waveform and spectrogram.
- Warning signs:
  - no energy above 8 kHz (some AI voices, but also phone calls)
  - very few breathing pauses
  - flat loudness
- The file (if ≤ 7 MB) and the measurements are sent to Gemini.

### 3.4 Claims
1. The language is detected from the script (Unicode ranges for Devanagari and Telugu).
2. Gemini is asked to translate, split the claim into individual statements, and judge it.
3. **With Google Search grounding** (when the quota allows): sources come only from the real search results. Publisher links are resolved, and the passage each source was cited for is shown. → *Search-grounded verification.*
4. **Without Search** (quota exhausted): the result is labelled **"AI knowledge only — not verified"**, the formal verdict stays *Insufficient Evidence*, Gemini's opinion is shown as *Probably true / Probably false*, and confidence is capped at **55%**.
5. Search ran but found nothing useful → **Insufficient external evidence** (cap 35%).
6. With search sources, confidence is capped at 70 / 80 / 90% for 1 / 2 / 3+ sources.

After a Search quota error, Search is paused for 15 minutes instead of being retried repeatedly.

### 3.5 Fake account networks (no AI — our own algorithm)
1. Every pair of accounts is compared. They are **linked** if:
   - their posts share **≥ 45% of the same words** (copy-paste), or
   - they shared the **same URL**, or
   - they posted **within 120 seconds with the same hashtag**.
2. Linked accounts are grouped with **union-find** (connected components).
3. **Group score** = 100 × (0.35·density + 0.40·mean link strength + 0.25·time compactness).
4. **Account suspicion score** = links + repeated posts + new account (< 30 days) + few followers.
5. A 5-minute posting timeline shows how fast it spread.

Every link carries a human-readable reason.

### 3.6 Gemini reliability layer
- **Automatic model failover:** `gemini-3.8-flash` → `gemini-3.5-flash` → `gemini-flash-lite-latest`.
  - Overloaded or missing models are skipped from then on.
  - A model that hits its daily quota is skipped for that request.
- **Timeouts and retries:** 30 s per request; one retry on overload; exponential backoff for short rate limits.
- **Clear error states** in `/api/health`: invalid key, quota exceeded, rate limited, overloaded.
- If Gemini is unavailable, every check falls back to clearly labelled basic checks.

---

## 4. What is real, what is simulated, what needs Gemini

| Feature | Status |
|---|---|
| Edit heatmap (ELA), EXIF / C2PA reading, video frame analysis, audio spectrogram | ✅ Real, computed in your browser |
| Network detection, clustering, scores, map | ✅ Real (our algorithm) |
| Duplicate-post and spike detection on the live feed | ✅ Real detection |
| Cases, report, SHA-256 hash, local storage | ✅ Real |
| AI-generated detection, translation, claim judgement | ✅ Real, **needs Gemini** |
| Claim verification with web sources | ⚠️ Real, **needs Gemini + Google Search quota** |
| Live social feed posts | 🧪 **Simulated** (labelled) |
| "Try the demo" story: media findings, official bulletin, timeline | 🧪 **Simulated** (labelled). Its network graph is computed by the real algorithm on a synthetic dataset |
| The 4 original sample cases | 🧪 **Simulated** (labelled; their sources have no links) |
| Reverse image search, dedicated trained deepfake model, real social-platform data | ❌ Not implemented |

---

## 5. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Lucide icons, Recharts, custom SVG force-directed graph |
| Backend | Node.js, Express (REST), Server-Sent Events for live alerts, local JSON storage |
| AI | Google Gemini via `@google/genai` (server-side key), with VERITAS calibration layer and model failover |
| Browser forensics | Canvas (ELA, frame extraction), Web Audio API + hand-written FFT, EXIF / C2PA byte scanning |
| Algorithms | Jaccard text similarity, union-find clustering, robust z-score anomaly detection |
| Testing | Unit tests with `tsx` + Node `assert` |

---

## 6. Project structure

```
server.ts                 Express server: APIs, Gemini client + failover, live stream, reports
server/
  imageDetection.ts       Image prompts + calibration rules (majority vote, caps, provenance, ELA)
  campaign.ts             Network detection: similarity, links, union-find, scores, CSV parser
  demoScenario.ts         Fictional "Operation Floodgate" dam-hoax demo (SIMULATED)
  demoData.ts             The 4 original sample cases (SIMULATED)
src/
  App.tsx                 Layout, navigation, alerts pop-ups, case selector
  components/
    DashboardView.tsx     Home
    MediaLabView.tsx      Check media
    ClaimView.tsx         Fact-check
    MultilingualView.tsx  Hindi & Telugu
    CampaignView.tsx      Fake account networks (+ ForceGraph.tsx map)
    InvestigationsView.tsx My cases & reports (+ ReportModal.tsx)
    AlertsView.tsx        Alerts
    plain.tsx             Plain-language verdicts, page headers, glossary tooltips
    ui.tsx                Shared UI pieces
  utils/mediaSignals.ts   Browser-side ELA, metadata, video frames, audio FFT
  services/api.ts         API client
  hooks/useLiveStream.ts  Live alert stream (SSE)
  types.ts                Shared types
test/
  forensics.test.ts       Unit tests
  fixtures/eval/          Known AI image + 4 genuine photos (sources in SOURCES.md)
demo_network_posts.csv    Ready-to-upload sample for the Networks page
```

---

## 7. API reference

| Method & path | Purpose |
|---|---|
| `GET /api/health` | Server + Gemini status (model, failover list, Search-grounding status) |
| `GET /api/stats` | Live counters and threat level |
| `GET /api/models` | Checking tools and their status (shown on the Home page) |
| `GET /api/stream` | Live posts and alerts (Server-Sent Events) |
| `GET /api/investigations` · `GET /api/investigations/:id` | List / read cases |
| `POST /api/investigations` | Create a case (`title` required) |
| `POST /api/investigations/:id/attach` | Add a result: `{ kind: "media" \| "claim" \| "campaign", result }` |
| `PATCH` / `DELETE /api/investigations/:id` | Update / delete a case |
| `POST /api/forensics/analyze-media` | Media check: `{ modality, fileName, mimeType, measurements, mediaData?, keyframes?, detailTiles? }` |
| `POST /api/claims/verify` | Claim check: `{ claimText }` |
| `POST /api/campaigns/analyze` | Network analysis: `{ datasetName, posts? \| csv?, isSimulated? }` |
| `GET /api/demo/sample-dataset` | Synthetic demo posts |
| `POST /api/demo/scenario` | Create the demo case and replay its alerts |
| `GET /api/reports/:id` | Unified report data + SHA-256 integrity hash |

---

## 8. Gemini quotas & troubleshooting

Free-tier Google AI keys have tight limits. Observed for this project's key:
- **About 15 requests per minute per model.** One photo check uses **4 requests**, so allow **~20 s between photo checks**.
- **About 20 requests per day per model** on `gemini-3.5-flash`, after which the app moves to the next model.
- **Google Search grounding returned "quota exceeded"**, so claims show *"AI knowledge only — not verified"*.

| Symptom | Cause | Fix |
|---|---|---|
| Sidebar says "AI not set up" | No `GEMINI_API_KEY` in `.env` | Add the key, restart |
| "AI checks unavailable" / results say *Basic checks (AI unavailable)* | Invalid key, quota or overload | See `/api/health` → `geminiStatus` / `geminiMessage`; wait or enable billing |
| Claims always "not verified" | Search-grounding quota | Enable billing in AI Studio (check **ai.dev/rate-limit**), restart |
| "Translation unavailable" | Gemini not reachable | Wait a minute and retry |
| Same image gives different answers | AI models are not fully deterministic | Handled by the 3-check majority vote; disagreement shows "Can't tell" |

**Enabling billing** on the key's Google Cloud project (via aistudio.google.com) is the most reliable fix.

---

## 9. Test results

Run through the full upload pipeline (small test set, so these are not general accuracy figures):

| Test | Result |
|---|---|
| Known AI image (ChatGPT dam collapse), 5 runs | **5 / 5 "Likely AI-generated"** (3 stray 0% checks outvoted by the majority rule) |
| 4 genuine camera photos (2011–2017, Wikimedia Commons) | **0 / 4 false alarms**: all "No signs found" |
| `demo_network_posts.csv` | 2 groups found (4 English + 3 Telugu accounts), 3 genuine users left out |

The test images and their sources are in `test/fixtures/eval/`.

---

## 10. Limitations

- **There is no custom-trained deepfake model.** AI-content judgement comes from Google Gemini (a general multimodal model), combined with our own forensic signals and calibration.
- **Heavily compressed media is hard.** For example, a WhatsApp-forwarded AI video was not detected by the model available on the free tier, even when sent as a full video.
- **Claim verification against web sources** depends on the Google Search grounding quota.
- **Network detection uses transparent rules**, not a trained model. Real people sharing the same breaking news can look similar, so review flagged accounts before acting.
- The live feed and demo story are **simulated** for demonstration.
- All results are **decision support**: final calls should be made by a human using official sources.
