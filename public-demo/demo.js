const panel = document.querySelector("#stage-panel");
const stageTitle = document.querySelector("#stage-title");
const stageKicker = document.querySelector("#stage-kicker");
const stageIntro = document.querySelector("#stage-intro");
const stageBadge = document.querySelector("#stage-badge");
const stageBody = document.querySelector("#stage-body");

const stages = {
  media: {
    number: "01",
    title: "A fictional image, inspected",
    intro: "This authored notice is a software fixture. The displayed OCR transcript comes from a prior verified local run and is shown as a recorded output.",
    badge: "ACTUAL · PRECOMPUTED",
    badgeClass: "actual",
    body: document.querySelector("#media-grid").outerHTML + `
      <div class="section-divider"><span>WHAT THE OUTPUT MEANS</span></div>
      <div class="insight-row"><div class="insight-icon neutral">≋</div><div><strong>Text was recognized in a prior local run</strong><p>The output records a configured English OCR pass on an earlier authored revision.</p></div><span class="tag actual">VERIFIED OUTPUT</span></div>
      <div class="insight-row"><div class="insight-icon muted">?</div><div><strong>Authenticity remains undetermined</strong><p>No image authenticity classifier was configured for this fixture. OCR alone cannot establish whether a claim is true.</p></div><span class="tag muted">NO VERDICT</span></div>`,
  },
  claim: {
    number: "02",
    title: "Context without a verdict",
    intro: "The claim review uses a project-authored local corpus. The example source is fictional and was not fetched from the web.",
    badge: "ACTUAL · PRECOMPUTED",
    badgeClass: "actual",
    body: `<div class="claim-layout">
      <article class="claim-card"><span class="label">FICTIONAL ASSERTION</span><blockquote>“Software fixture: the fictional Amber Museum offers free entry.”</blockquote><span class="tag fictional">PROJECT-AUTHORED TEXT</span></article>
      <article class="verdict-card"><span class="label">RECORDED REVIEW STATUS</span><strong class="verdict">Insufficient Evidence</strong><p>One neutral relevance candidate was present in the local authored corpus. No supporting or contradicting evidence was counted.</p><span class="tag actual">PRIOR LOCAL OUTPUT</span></article>
    </div>
    <div class="section-divider"><span>SOURCE SCOPE</span></div>
    <div class="source-card"><div class="source-mark">E1</div><div><strong>Fictional Engine4 source</strong><p>Project-authored excerpt · operator corpus · unverified source</p><code>example.org/engine4-source · displayed as text only</code></div><span class="tag simulated">NOT RETRIEVED</span></div>
    <div class="callout"><strong>Why the result stays cautious</strong><p>Relevance is not factual support. This recorded result does not use Google Fact Check or any live external retrieval. The fictional setup cannot validate real-world claims.</p></div>`,
  },
  network: {
    number: "03",
    title: "A synthetic post pattern",
    intro: "Twelve project-authored posts across four fictional accounts form a small software control. Counts below are recorded from a prior deterministic run on synthetic input.",
    badge: "ACTUAL · SYNTHETIC INPUT",
    badgeClass: "simulated",
    body: `<div class="metric-grid"><div class="metric"><span>AUTHORED POSTS</span><strong>12</strong><small>synthetic fixture records</small></div><div class="metric"><span>FICTIONAL ACCOUNTS</span><strong>4</strong><small>labels a · b · c · d</small></div><div class="metric"><span>GRAPH NODES</span><strong>51</strong><small>precomputed output</small></div><div class="metric"><span>RELATIONSHIPS</span><strong>116</strong><small>precomputed output</small></div></div>
    <div class="network-card"><div class="network-visual" aria-label="Four fictional account nodes connected in a simulated graph"><span class="edge e1"></span><span class="edge e2"></span><span class="edge e3"></span><span class="edge e4"></span><i class="node n1">a</i><i class="node n2">b</i><i class="node n3">c</i><i class="node n4">d</i><span class="network-caption">SYNTHETIC GRAPH · VISUAL GUIDE</span></div><div class="network-notes"><span class="label">RECORDED ENGINE OUTPUT</span><strong>25 cross-engine links</strong><p>The graph combines fixture entities from the prior run. Associations do not establish coordination, manipulation, or intent.</p><span class="tag actual">PRECOMPUTED RESULT</span></div></div>
    <div class="callout"><strong>Interpret with care</strong><p>All accounts and posts are fictional. Repeated wording and graph links are intentionally authored software data, not observed public activity.</p></div>`,
  },
  summary: {
    number: "04",
    title: "A review aid, not a decision",
    intro: "This recorded walkthrough joins precomputed outputs from the fictional control case. It illustrates presentation and limitations, not validated real-world performance.",
    badge: "PRECOMPUTED SNAPSHOT",
    badgeClass: "actual",
    body: `<div class="summary-banner"><div><span class="label">CASE CONCLUSION</span><strong>Insufficient Evidence</strong></div><p>No global truth or manipulation verdict is produced by this example.</p></div>
    <div class="summary-list"><div><span class="summary-index">01</span><div><strong>Image text</strong><p>Actual OCR transcript from an earlier local run; older image revision, text matches the bundled fixture.</p></div><span class="tag actual">PRECOMPUTED</span></div><div><span class="summary-index">02</span><div><strong>Claim context</strong><p>One neutral, project-authored source excerpt; no external retrieval or factual verification.</p></div><span class="tag simulated">FICTIONAL SOURCE</span></div><div><span class="summary-index">03</span><div><strong>Post relationships</strong><p>Recorded counts from deterministic analysis of twelve fictional posts.</p></div><span class="tag simulated">SYNTHETIC INPUT</span></div></div>
    <div class="callout"><strong>What this page does</strong><p>Displays bundled example files and precomputed outputs. Navigation only changes the visible panel in your browser.</p><strong>What this page does not do</strong><p>No live inference, external retrieval, API access, upload, investigation storage, authentication, or mutations.</p></div>`,
  },
};

function selectStage(button) {
  const key = button.dataset.stage;
  const stage = stages[key];
  if (!stage) return;
  document.querySelectorAll(".stage").forEach((tab) => {
    const active = tab === button;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  stageKicker.textContent = `${stage.number} / ${key.toUpperCase()} REVIEW`;
  stageTitle.textContent = stage.title;
  stageIntro.textContent = stage.intro;
  stageBadge.textContent = stage.badge;
  stageBadge.className = `output-pill ${stage.badgeClass}`;
  panel.setAttribute("aria-labelledby", button.id);
  stageBody.innerHTML = stage.body;
}

document.querySelectorAll(".stage").forEach((button, index, buttons) => {
  button.addEventListener("click", () => selectStage(button));
  button.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
    selectStage(buttons[next]);
  });
});
