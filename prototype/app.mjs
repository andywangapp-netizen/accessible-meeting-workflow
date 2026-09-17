import {
  parseTranscript,
  participants,
  makeSession,
  generateTranscript,
  stuckOptions,
  practiceOptions,
} from "./coach.mjs";

const $ = (selector) => document.querySelector(selector);
const content = $("#coach-content");
const state = {
  session: null,
  view: "summary",
  stuck: "clarity",
  tone: "direct",
  scripts: {},
  moment: "",
  goal: "clarity",
  drafts: {},
  checks: {},
  plan: [],
  nextId: 1,
};
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const quote = (turn, yours = false) =>
  `<blockquote class="quote ${yours ? "yours" : ""}"><cite>${escape(turn.speaker)}${yours ? " · you" : ""}</cite><p>${escape(turn.text)}</p></blockquote>`;

function announce(message) {
  $("#announcement").textContent = message;
}
function dirty() {
  return (
    state.session &&
    (state.session.text !== $("#transcript").value ||
      state.session.person !== $("#person").value)
  );
}
function updateSourceStatus() {
  $("#source-status").textContent = dirty()
    ? `Changes pending. Coaching still uses the previous transcript for ${state.session.person}. Opening the updated space starts a new plan.`
    : state.session
      ? `Your active coaching session is for ${state.session.person}.`
      : "";
  $("#start-button").innerHTML = state.session
    ? `${dirty() ? "Start updated coaching session" : "Return to my coaching space"} <span aria-hidden="true">→</span>`
    : 'Open my coaching space <span aria-hidden="true">→</span>';
}
function syncParticipants(preferred = $("#person").value) {
  const names = participants(parseTranscript($("#transcript").value));
  $("#person").replaceChildren(new Option("Choose your name", ""));
  for (const name of names) $("#person").add(new Option(name, name));
  if (names.includes(preferred)) $("#person").value = preferred;
  updateSourceStatus();
}
function setMode(mode) {
  $("#generator").hidden = mode !== "generate";
  $("#paste-mode").setAttribute("aria-pressed", String(mode === "paste"));
  $("#generate-mode").setAttribute("aria-pressed", String(mode === "generate"));
}
function loadExample() {
  $("#transcript").value = generateTranscript();
  syncParticipants("Alex");
  $("#session-error").textContent = "";
  announce(
    "Fictional example loaded. Alex is selected as the person to coach.",
  );
}
function navigate(view, focus = true) {
  state.view = view;
  render();
  if (focus) {
    const heading = content.querySelector("h3");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    if (window.innerWidth <= 740)
      $(".coach-panel").scrollIntoView({ block: "start" });
  }
}
function render() {
  for (const button of document.querySelectorAll("[data-view]")) {
    button.disabled = !state.session && button.dataset.view !== "summary";
    if (button.dataset.view === state.view)
      button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  $("#plan-count").textContent = state.plan.length;
  if (!state.session) {
    content.innerHTML = `<div class="welcome"><p class="eyebrow">A PLACE TO PRACTICE, NOT PERFORM</p><h3>What would make your<br>next meeting easier?</h3><p>Start with a transcript and choose yourself. Then explore a difficult moment or practice something you want to say.</p><ol class="welcome-steps"><li><span>1</span> Enter a fictional meeting or make a scenario.</li><li><span>2</span> Choose the person you want to be.</li><li><span>3</span> Open your personal coaching space.</li></ol></div><div class="feature-grid"><div class="feature-card"><span class="feature-icon" aria-hidden="true">≋</span><h3>A way through “I’m stuck”</h3><p>Find a phrase for asking, pausing, or sharing a different view.</p></div><div class="feature-card"><span class="feature-icon" aria-hidden="true">↗</span><h3>Practice with a purpose</h3><p>Try wording that supports your goal. Keep what works for you.</p></div></div>`;
    return;
  }
  const person = state.session.person;
  $("#sidebar-person").textContent = person;
  $("#sidebar-avatar").textContent = [...person][0].toUpperCase();
  $("#person-chip").textContent = `FOR ${person.toUpperCase()} ONLY`;
  $("#coach-heading").textContent = `${person}’s coaching space`;
  if (state.view === "summary") renderSummary();
  if (state.view === "stuck") renderStuck();
  if (state.view === "practice") renderPractice();
  if (state.view === "plan") renderPlan();
}
function renderSummary() {
  const { turns, ownTurns, person } = state.session;
  const opening = turns.slice(0, 2);
  const questions = turns.filter((turn) => turn.text.includes("?")).slice(0, 3);
  content.innerHTML = `<section class="content-card"><p class="eyebrow">A QUICK RECAP</p><h3>Start with what was actually said.</h3><p class="intro-text">You’re practicing as <strong>${escape(person)}</strong>. Everyone else’s words are context; the coaching and plan are yours.</p><div class="context-bar"><span>${participants(turns).length} participants</span><span>${turns.length} speaking turns</span><span>${ownTurns.length} from you</span></div><p class="section-label">How the conversation began</p><ul class="quote-list">${opening.map((turn) => `<li>${quote(turn, turn.speaker === person)}</li>`).join("")}</ul><p class="hint">An excerpt-based recap. This prototype does not infer decisions or people’s intentions.</p></section>
  <section class="content-card"><h3>Your part in the conversation</h3><p class="hint">${ownTurns.length > 3 ? "Your last three contributions." : "Your contributions, in your own words."}</p><ul class="quote-list">${ownTurns
    .slice(-3)
    .map((turn) => `<li>${quote(turn, true)}</li>`)
    .join("")}</ul></section>
  ${questions.length ? `<section class="content-card"><h3>Questions to revisit</h3><p class="hint">These were asked in the meeting. Check the transcript to see whether they were answered.</p><ul class="quote-list">${questions.map((turn) => `<li>${quote(turn, turn.speaker === person)}</li>`).join("")}</ul></section>` : ""}
  <div class="feature-grid"><button class="feature-card" data-go="stuck"><span class="feature-icon" aria-hidden="true">≋</span><h3>I’m stuck</h3><p>Help me find a next step or the words to use.</p></button><button class="feature-card" data-go="practice"><span class="feature-icon" aria-hidden="true">↗</span><h3>I want to work on…</h3><p>Give me a focused exercise to try.</p></button></div>`;
}
function momentPicker() {
  return `<div class="context-select"><label for="moment">A moment from your meeting (optional)</label><select id="moment"><option value="">Work on this generally</option>${state.session.turns.map((turn) => `<option value="${turn.id}" ${String(turn.id) === state.moment ? "selected" : ""}>${escape(turn.speaker)}: ${escape(turn.text.length > 95 ? `${turn.text.slice(0, 95)}…` : turn.text)}</option>`).join("")}</select></div><div id="selected-moment">${selectedMoment()}</div>`;
}
function selectedMoment() {
  const turn = state.session.turns.find(
    (turn) => String(turn.id) === state.moment,
  );
  return turn
    ? `${quote(turn, turn.speaker === state.session.person)}<p class="hint">Use this as context when you adapt the wording below.</p>`
    : "";
}
function scriptKey() {
  return `${state.stuck}:${state.tone}`;
}
function currentScript() {
  return (
    state.scripts[scriptKey()] ?? stuckOptions[state.stuck].scripts[state.tone]
  );
}
function renderStuck() {
  const option = stuckOptions[state.stuck];
  content.innerHTML = `<section class="content-card"><p class="eyebrow">I’M STUCK</p><h3>What would help right now?</h3><p class="intro-text">Pick what fits. You don’t have to explain why.</p><div class="choice-grid" role="group" aria-label="What you need help with">${Object.entries(
    stuckOptions,
  )
    .map(
      ([key, item]) =>
        `<button class="choice" data-stuck="${key}" aria-pressed="${state.stuck === key}"><strong>${item.label}</strong><small>${item.description}</small></button>`,
    )
    .join("")}</div></section>
  <section class="content-card"><p class="eyebrow">YOUR NEXT STEP</p><h3>${option.title}</h3>${momentPicker()}<ol class="ordered-steps">${option.steps.map((step) => `<li>${step}</li>`).join("")}</ol><div class="script-box"><label id="wording-label">Choose wording that fits you</label><div class="segmented" role="group" aria-labelledby="wording-label">${[
    ["direct", "Direct"],
    ["gentle", "More context"],
    ["written", "In writing"],
  ]
    .map(
      ([key, label]) =>
        `<button data-tone="${key}" aria-pressed="${state.tone === key}">${label}</button>`,
    )
    .join(
      "",
    )}</div><label for="script">Your words · edit freely</label><textarea id="script" rows="4" maxlength="3000">${escape(currentScript())}</textarea><div class="button-row"><button class="button primary" data-action="save-script">Keep in my plan</button><button class="button secondary" data-action="copy-script">Copy wording</button></div><p class="micro-status" id="script-status" role="status"></p></div></section>`;
}
function renderPractice() {
  const option = practiceOptions[state.goal];
  const draft = state.drafts[state.goal] || "";
  content.innerHTML = `<section class="content-card"><p class="eyebrow">I WANT TO WORK ON…</p><h3>One skill. One small practice.</h3><p class="intro-text">Choose a goal that matters to you. There is no score and no single right way to say it.</p><div class="choice-grid" role="group" aria-label="Practice goal">${Object.entries(
    practiceOptions,
  )
    .map(
      ([key, item]) =>
        `<button class="choice" data-goal="${key}" aria-pressed="${state.goal === key}"><strong>${item.label}</strong><small>${item.description}</small></button>`,
    )
    .join("")}</div></section>
  <section class="content-card"><p class="eyebrow">1 / PREPARE</p><h3>${option.goal}</h3><ul class="ordered-steps">${option.prep.map((item) => `<li>${item}</li>`).join("")}</ul><div class="scene"><p class="eyebrow">2 / TRY IT · FICTIONAL PRACTICE PARTNER</p><blockquote>${option.prompt}</blockquote></div><label for="practice-draft">What would you like to say, ${escape(state.session.person)}?</label><textarea id="practice-draft" rows="4" maxlength="3000" placeholder="${escape(option.starter)}">${escape(draft)}</textarea><p class="hint">This is a scripted exercise, not a prediction of how someone will respond.</p><p class="eyebrow" style="margin-top:24px">3 / REFLECT</p><p class="intro-text">Check what your wording does. You decide what to revise.</p><ul class="checklist">${option.checks.map((check, index) => `<li><label><input type="checkbox" data-check="${index}" ${state.checks[`${state.goal}:${index}`] ? "checked" : ""}>${check}</label></li>`).join("")}</ul><p class="gentle-note">Your goal is to communicate what you need. Eye contact, sounding a certain way, or agreeing with everyone are not requirements.</p><div class="button-row"><button class="button primary" data-action="save-practice">Keep my practice in my plan</button><button class="button secondary" data-action="copy-practice">Copy my words</button></div><p id="practice-status" class="micro-status" role="status"></p></section>`;
}
function renderPlan() {
  content.innerHTML = `<section class="content-card"><p class="eyebrow">MY PLAN · FOR ${escape(state.session.person.toUpperCase())}</p><h3>Words you want to take with you.</h3><p class="intro-text">Only the things you choose to keep. You can use these aloud, in writing, or just for yourself.</p>${state.plan.length ? `<ul class="plan-list">${state.plan.map((item) => `<li class="plan-item"><div class="plan-top"><p class="eyebrow">${escape(item.label)}</p><button class="text-button" data-remove="${item.id}" aria-label="Remove ${escape(item.label)} from my plan">Remove</button></div>${item.context ? `<p class="plan-context">Meeting context · ${escape(item.context)}</p>` : ""}<p>${escape(item.text)}</p></li>`).join("")}</ul><div class="button-row"><button class="button primary" data-action="copy-plan">Copy my plan</button><button class="button secondary" data-go="practice">Practice something else</button></div><p class="micro-status" id="plan-status" role="status"></p>` : `<div class="empty-plan"><p>You haven’t kept anything yet.</p><p>Find a helpful phrase in “I’m stuck” or try a practice exercise, then add it here.</p><div class="button-row"><button class="button primary" data-go="stuck">Find a helpful phrase</button><button class="button secondary" data-go="practice">Try an exercise</button></div></div>`}<p class="hint" style="margin-top:24px">This plan belongs to ${escape(state.session.person)} only. Copy it before reloading or starting an updated session.</p></section>`;
}
function savePlan(text, label, statusId, context = "") {
  const status = $(statusId);
  if (!text.trim()) {
    status.textContent = "Write something you want to keep first.";
    return;
  }
  if (
    state.plan.some(
      (item) =>
        item.text === text.trim() &&
        item.label === label &&
        item.context === context,
    )
  ) {
    status.textContent = "This is already in your plan.";
    return;
  }
  state.plan.push({ id: state.nextId++, label, text: text.trim(), context });
  $("#plan-count").textContent = state.plan.length;
  status.textContent = `Kept in ${state.session.person}’s plan.`;
}
async function copyText(text, statusId) {
  const status = $(statusId);
  if (!text.trim()) {
    status.textContent = "Write something to copy first.";
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = "Copied. Nothing has been sent.";
  } catch {
    status.textContent =
      "Clipboard access is unavailable. Select your wording and copy it manually.";
  }
}

$("#paste-mode").addEventListener("click", () => setMode("paste"));
$("#generate-mode").addEventListener("click", () => setMode("generate"));
$("#load-example").addEventListener("click", loadExample);
$("#transcript").addEventListener("input", () => {
  syncParticipants();
  $("#session-error").textContent = "";
});
$("#person").addEventListener("change", updateSourceStatus);
$("#generator").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const name = $("#generated-name").value.trim();
    $("#transcript").value = generateTranscript({
      name,
      setting: $("#setting").value,
      challenge: $("#challenge").value,
      length: document.querySelector("[name=length]:checked").value,
    });
    syncParticipants(name);
    $("#generator-error").textContent = "";
    $("#session-error").textContent = "";
    announce(
      `Fictional transcript generated with ${name} selected. Open the coaching space when ready.`,
    );
  } catch (error) {
    $("#generator-error").textContent = error.message;
  }
});
$("#session-form").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const session = makeSession($("#transcript").value, $("#person").value);
    if (!state.session || dirty()) {
      state.session = session;
      state.plan = [];
      state.scripts = {};
      state.drafts = {};
      state.checks = {};
      state.moment = "";
      state.tone = "direct";
      state.stuck = "clarity";
      state.goal = "clarity";
    }
    $("#session-error").textContent = "";
    updateSourceStatus();
    navigate("summary");
    announce(`Coaching space opened for ${session.person} only.`);
  } catch (error) {
    $("#session-error").textContent = error.message;
  }
});
$(".coach-nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (button && !button.disabled) navigate(button.dataset.view);
});
content.addEventListener("input", (event) => {
  if (event.target.id === "script")
    state.scripts[scriptKey()] = event.target.value;
  if (event.target.id === "practice-draft")
    state.drafts[state.goal] = event.target.value;
});
content.addEventListener("change", (event) => {
  if (event.target.id === "moment") {
    state.moment = event.target.value;
    $("#selected-moment").innerHTML = selectedMoment();
  }
  if (event.target.matches("[data-check]"))
    state.checks[`${state.goal}:${event.target.dataset.check}`] =
      event.target.checked;
});
content.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.go) navigate(button.dataset.go);
  for (const [attribute, field] of [
    ["stuck", "stuck"],
    ["tone", "tone"],
    ["goal", "goal"],
  ]) {
    if (button.dataset[attribute]) {
      state[field] = button.dataset[attribute];
      render();
      content
        .querySelector(`[data-${attribute}="${state[field]}"]`)
        .focus({ preventScroll: true });
    }
  }
  if (button.dataset.remove) {
    state.plan = state.plan.filter(
      (item) => item.id !== Number(button.dataset.remove),
    );
    render();
    const next = content.querySelector("[data-remove], [data-go]");
    if (next) next.focus({ preventScroll: true });
    announce("Item removed from your plan.");
  }
  const action = button.dataset.action;
  if (action === "save-script") {
    const turn = state.session.turns.find(
      (turn) => String(turn.id) === state.moment,
    );
    savePlan(
      $("#script").value,
      stuckOptions[state.stuck].title,
      "#script-status",
      turn ? `${turn.speaker}: ${turn.text}` : "",
    );
  }
  if (action === "copy-script") copyText($("#script").value, "#script-status");
  if (action === "save-practice")
    savePlan(
      $("#practice-draft").value,
      practiceOptions[state.goal].label,
      "#practice-status",
    );
  if (action === "copy-practice")
    copyText($("#practice-draft").value, "#practice-status");
  if (action === "copy-plan")
    copyText(
      `Meeting plan for ${state.session.person}\n\n${state.plan.map((item) => `${item.label}\n${item.context ? `Context: ${item.context}\n` : ""}${item.text}`).join("\n\n")}`,
      "#plan-status",
    );
});

loadExample();
render();
