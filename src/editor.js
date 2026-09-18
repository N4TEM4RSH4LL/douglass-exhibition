import "./editor.css";
import {
  CARDS,
  CARD_BY_ID,
  FIELD_BY_ID,
  ROOMS,
  QUESTION,
  cardProgress,
  progress,
  wordCount,
} from "./exhibition-schema.js";
import { SharedExhibition } from "./shared-store.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const store = new SharedExhibition({ editor: true });
const fragment = new URLSearchParams(location.hash.slice(1));
let selected = CARD_BY_ID[fragment.get("card")]
    ? fragment.get("card")
    : CARDS[0].id,
  showOverview = false;
const initialKey = fragment.get("access");
if (initialKey) {
  fragment.delete("access");
  history.replaceState(
    null,
    "",
    location.pathname + (fragment.toString() ? "#" + fragment.toString() : ""),
  );
}
let renderKey = "",
  historyField = "",
  importChanges = [];
function roomOfSelection() {
  return CARD_BY_ID[selected].room;
}
function select(id) {
  if (!CARD_BY_ID[id]) return;
  selected = id;
  showOverview = false;
  history.replaceState(null, "", `#card=${encodeURIComponent(id)}`);
  renderKey = "";
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function renderNavigation(values) {
  const pp = progress(values),
    room = roomOfSelection();
  $("#overall-count").textContent =
    `${pp.reduce((a, p) => a + p.complete, 0)} of ${CARDS.length} entries complete`;
  $("#room-tabs").innerHTML = ROOMS.map(
    (r) =>
      `<button class="${r.id === room ? "active" : ""}" data-room="${r.id}" aria-label="Room ${r.number}: ${esc(r.title)}" aria-current="${r.id === room ? "page" : "false"}">${r.number}</button>`,
  ).join("");
  $("#card-links").innerHTML =
    `<div class="sidebar-room-title">${esc(ROOMS[room - 1].title)}</div>` +
    CARDS.filter((c) => c.room === room)
      .map(
        (c) =>
          `<button class="card-link ${c.id === selected && !showOverview ? "active" : ""} ${cardProgress(c, values).complete ? "complete" : ""}" data-card="${c.id}"><span class="card-dot" aria-hidden="true"></span>${esc(c.label)}</button>`,
      )
      .join("");
  $$("#room-tabs button").forEach(
    (b) =>
      (b.onclick = () =>
        select(CARDS.find((c) => c.room === Number(b.dataset.room)).id)),
  );
  $$(".card-link").forEach((b) => (b.onclick = () => select(b.dataset.card)));
}
function status() {
  const pending = Object.values(store.pending),
    conflicts = pending.filter((p) => p.conflict).length,
    s = $("#save-status");
  let text,
    state = "ready";
  if (store.saving) {
    text = `Saving ${pending.length} field${pending.length === 1 ? "" : "s"}…`;
    state = "saving";
  } else if (conflicts) {
    text = `${conflicts} conflicting edit${conflicts === 1 ? "" : "s"} to review`;
    state = "problem";
  } else if (!store.online) {
    text = pending.length
      ? "Draft saved on this device · waiting for shared server"
      : "Connecting to shared exhibition…";
    state = "problem";
  } else if (pending.length && !store.authorized) {
    text = `${pending.length} local draft${pending.length === 1 ? "" : "s"} · unlock to share`;
    state = "problem";
  } else if (pending.length) {
    text = `${pending.length} field${pending.length === 1 ? "" : "s"} waiting to save`;
    state = "saving";
  } else {
    text = store.streamLive
      ? "Live · all changes saved"
      : "All changes saved to the shared exhibition";
  }
  if (!store.loaded && !pending.length) text = "Loading shared exhibition…";
  if (store.localError && pending.length) {
    text = "Draft not backed up on this device · download a backup";
    state = "problem";
  }
  s.textContent = text;
  s.dataset.state = state;
  $("#access-notice").hidden = !!store.authorized;
  const warnings = [
    store.localError,
    ...(!store.online && store.error ? [store.error] : []),
  ].filter(Boolean);
  $("#connection-notice").hidden = !warnings.length;
  $("#connection-notice").textContent = warnings.join(" ");
  $("#copy-invite").hidden = !store.authorized;
  $("#lock-editor").hidden = !store.authorized;
}
function fieldHTML(card, f) {
  const id = `${card.id}.${f.key}`,
    input =
      f.type === "select"
        ? `<select id="field-${id}" data-field="${id}"><option value="">Choose…</option>${f.options.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select>`
        : f.type === "text"
          ? `<input id="field-${id}" data-field="${id}" maxlength="${f.maxLength}" autocomplete="off">`
          : `<textarea id="field-${id}" data-field="${id}" maxlength="${f.maxLength}" rows="${f.targetWords ? 7 : f.key === "quote" ? 4 : 5}"></textarea>`;
  return `<div class="field ${f.key === "quote" ? "quote" : ""}" data-field-wrap="${id}"><div class="field-label-row"><label for="field-${id}">${esc(f.label)}${f.required ? "" : ' <span class="optional-field">(optional)</span>'}</label><span class="field-state"></span></div><p class="field-help" id="help-${id}">${esc(f.help)}</p>${input}<div class="field-tools"><span class="word-count" data-count="${id}"></span><button class="history-button" type="button" data-history="${id}">Version history</button></div><div class="field-conflict" hidden></div></div>`;
}
function renderEntry() {
  const card = CARD_BY_ID[selected],
    r = ROOMS[card.room - 1],
    index = CARDS.indexOf(card),
    next = CARDS[index + 1];
  $("#content").innerHTML =
    `<header class="room-intro"><span class="eyebrow">ROOM ${r.number} · EXHIBITION STUDIO</span><h1>${esc(r.title)}</h1><p>${esc(r.summary)}</p><div class="reading"><span>Reading</span>${esc(r.reading)}</div></header><article class="entry-card"><div class="entry-heading"><div><h2>${esc(card.label)}</h2><p>${esc(card.guide)}</p></div><span class="entry-progress" id="entry-progress"></span></div><form id="entry-form">${card.fields.map((f) => fieldHTML(card, f)).join("")}</form></article><div class="entry-bottom"><a href="./#room=${card.room}" target="_blank" rel="noopener">See Room ${r.number} in the museum ↗</a>${next ? `<button class="button" id="next-entry">Next: ${esc(next.label)} →</button>` : '<button class="button" id="review-all">Review the presentation →</button>'}</div>`;
  $("#entry-form").onsubmit = (e) => e.preventDefault();
  $$("[data-field]").forEach((input) => {
    input.setAttribute("aria-describedby", `help-${input.dataset.field}`);
    input.onfocus = () => {
      input.dataset.baseRevision = String(
        store.pending[input.dataset.field]?.baseRevision ??
          store.fields[input.dataset.field]?.revision ??
          0,
      );
    };
    input.oninput = () =>
      store.edit(
        input.dataset.field,
        input.value,
        Number(input.dataset.baseRevision || 0),
      );
    input.onchange = () => store.flush();
    input.onblur = () => {
      store.flush();
      queueMicrotask(render);
    };
  });
  $$("[data-history]").forEach(
    (b) => (b.onclick = () => openHistory(b.dataset.history)),
  );
  if (next) $("#next-entry").onclick = () => select(next.id);
  else
    $("#review-all").onclick = () => {
      showOverview = true;
      renderKey = "";
      render();
    };
}
function renderChecklist(values) {
  const pp = progress(values);
  const done = pp.reduce((a, p) => a + p.complete, 0);
  $("#content").innerHTML =
    `<header class="overview-intro"><span class="eyebrow">COMPLETE PRESENTATION</span><h1>One exhibition. One clear argument.</h1><p>${done} of ${CARDS.length} entries contain all required fields and meet any specified word targets.</p><div class="central-question">${esc(QUESTION)}</div><p class="readiness-note">Before presenting, also check the accuracy of quotations, the quality of the analysis, chronological order, variety of evidence, and whether the connections between rooms make sense. A filled form alone does not establish these.</p></header>${ROOMS.map(
      (r, i) => {
        const p = pp[i];
        return `<section class="checklist-room"><span class="eyebrow">ROOM ${r.number} · ${p.complete}/${p.total} ENTRIES COMPLETE</span><h2>${esc(r.title)}</h2><p>${esc(r.reading)}</p><div class="progress-track"><i style="width:${Math.round((p.fieldsDone / p.fieldsTotal) * 100)}%"></i></div><ul>${r.requirements.map((s) => `<li>${esc(s)}</li>`).join("")}</ul><button class="button" data-review-room="${r.id}">Review Room ${r.number} →</button></section>`;
      },
    ).join("")}`;
  $$("[data-review-room]").forEach(
    (b) =>
      (b.onclick = () => {
        const cc = CARDS.filter((c) => c.room === Number(b.dataset.reviewRoom));
        select((cc.find((c) => !cardProgress(c, values).complete) || cc[0]).id);
      }),
  );
}
function hydrateFields(values) {
  const card = CARD_BY_ID[selected],
    p = cardProgress(card, values);
  $("#entry-progress").textContent = p.complete
    ? "Entry complete"
    : `${p.completed}/${p.total} fields filled${p.wordIssues.length ? " · check word count" : ""}`;
  for (const f of card.fields) {
    const id = `${card.id}.${f.key}`,
      input = document.getElementById("field-" + id),
      wrap = input.closest(".field"),
      pending = store.pending[id],
      row = store.fields[id];
    if (document.activeElement !== input && input.value !== (values[id] || ""))
      input.value = values[id] || "";
    if (!pending && input.value === (row?.value || ""))
      input.dataset.baseRevision = String(row?.revision || 0);
    const count = wordCount(values[id]),
      countNode = wrap.querySelector(".word-count");
    countNode.textContent = f.targetWords
      ? `${count} / ${f.targetWords} words${f.wordRange[0] !== f.wordRange[1] ? " approximately" : ""}`
      : `${count} word${count === 1 ? "" : "s"}`;
    countNode.classList.toggle(
      "issue",
      !!f.wordRange &&
        count > 0 &&
        (count < f.wordRange[0] || count > f.wordRange[1]),
    );
    const state = wrap.querySelector(".field-state");
    state.textContent = pending?.conflict
      ? "Conflict — review below"
      : pending
        ? store.localError
          ? "Not backed up locally"
          : "Saved locally · pending"
        : row
          ? "Shared · v" + row.revision
          : "Not filled";
    state.classList.toggle("pending", !!pending);
    const conflict = wrap.querySelector(".field-conflict");
    conflict.hidden = !pending?.conflict;
    if (pending?.conflict) {
      const version = pending.conflict;
      conflict.innerHTML = `<strong>Another classmate changed this field.</strong><p>Your draft is still in the box above. Shared version ${version.revision}:</p><p>${esc(version.value || "(Empty)")}</p><button class="button" data-choice="shared">Use shared version</button><button class="button" data-choice="mine">Save my version instead</button>`;
      conflict
        .querySelectorAll("button")
        .forEach(
          (b) => (b.onclick = () => store.resolve(id, b.dataset.choice)),
        );
    }
  }
}
function render() {
  const values = store.values();
  status();
  renderNavigation(values);
  const key = showOverview ? "overview" : selected;
  if (showOverview) {
    renderChecklist(values);
    renderKey = key;
    return;
  }
  if (renderKey !== key) {
    renderEntry();
    renderKey = key;
  }
  hydrateFields(values);
}
$("#overview-button").onclick = () => {
  showOverview = true;
  renderKey = "";
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
};
function access() {
  const d = $("#access-dialog");
  $("#writer").value = store.writer === "Class contributor" ? "" : store.writer;
  $("#class-key").value = store.token;
  $("#access-error").textContent = "";
  d.showModal();
}
$("#access-button").onclick = access;
$("#unlock").onclick = access;
$$(".dialog-close").forEach(
  (b) => (b.onclick = () => b.closest("dialog").close()),
);
$("#access-form").onsubmit = async (e) => {
  e.preventDefault();
  const button = e.submitter;
  button.disabled = true;
  store.writer = $("#writer").value.trim() || "Class contributor";
  store.persist();
  const ok = await store.authenticate($("#class-key").value);
  button.disabled = false;
  if (ok) $("#access-dialog").close();
  else $("#access-error").textContent = store.error;
};
$("#copy-invite").onclick = async () => {
  const url = new URL("editor.html", location.href);
  url.hash = new URLSearchParams({ access: store.token, card: selected });
  try {
    await navigator.clipboard.writeText(url.href);
    $("#copy-invite").textContent = "Editor link copied";
  } catch {
    $("#access-error").textContent =
      "Clipboard unavailable. Share the class key manually.";
  }
};
$("#lock-editor").onclick = () => {
  store.logout();
  $("#class-key").value = "";
  $("#access-dialog").close();
};
$("#download").onclick = () => {
  const blob = new Blob([JSON.stringify(store.export(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `douglass-exhibition-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("#import-button").onclick = () => $("#import-file").click();
$("#import-file").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 2000000) throw new Error("This backup is too large.");
    const b = JSON.parse(await file.text());
    if (
      b.format !== "douglass-exhibition-backup" ||
      !b.values ||
      b.version !== 2
    )
      throw new Error(
        "Choose an exhibition backup downloaded from this studio.",
      );
    const current = store.values();
    importChanges = [];
    for (const [id, value] of Object.entries(b.values)) {
      const def = FIELD_BY_ID[id];
      if (!def) continue;
      if (typeof value !== "string" || value.length > def.maxLength)
        throw new Error("The backup contains an invalid field.");
      if (def.options && value && !def.options.some((o) => o[0] === value))
        throw new Error("The backup contains an invalid choice.");
      if (value !== (current[id] || "")) importChanges.push([id, value]);
    }
    $("#import-summary").textContent =
      `${importChanges.length} fields differ from the current exhibition. Backup created ${b.exportedAt ? new Date(b.exportedAt).toLocaleString() : "at an unknown time"}.`;
    $("#import-list").innerHTML =
      importChanges
        .map(
          ([id]) =>
            `<div>${esc(CARD_BY_ID[FIELD_BY_ID[id].card].label)} — ${esc(FIELD_BY_ID[id].label)}</div>`,
        )
        .join("") || "No changes to restore.";
    $("#confirm-import").disabled = !importChanges.length;
    $("#import-dialog").showModal();
  } catch (error) {
    $("#connection-notice").hidden = false;
    $("#connection-notice").textContent = error.message;
  } finally {
    e.target.value = "";
  }
};
$("#confirm-import").onclick = () => {
  for (const [id, value] of importChanges) store.edit(id, value);
  $("#import-dialog").close();
  store.flush();
};
async function openHistory(id) {
  if (!store.authorized) {
    access();
    return;
  }
  historyField = id;
  $("#history-title").textContent = FIELD_BY_ID[id].label;
  $("#history-content").textContent = "Loading saved versions…";
  $("#history-dialog").showModal();
  let rows = [];
  async function load(before) {
    try {
      const data = await store.history(id, before);
      rows.push(...data.history);
      $("#history-content").innerHTML = rows.length
        ? rows
            .map(
              (row) =>
                `<div class="history-entry"><div class="history-meta">Version ${row.revision} · ${esc(new Date(row.changedAt).toLocaleString())} · ${esc(row.writer)}</div><p class="history-value">${esc(row.value || "(Empty field)")}</p><button class="button" data-version="${row.revision}">Restore this version</button></div>`,
            )
            .join("")
        : '<p class="empty-history">No shared versions yet. Unsaved drafts remain in your local backup.</p>';
      if (data.nextBefore)
        $("#history-content").innerHTML +=
          '<button class="button" id="more-history">Load earlier versions</button>';
      $$("[data-version]").forEach(
        (b) =>
          (b.onclick = () => {
            const row = rows.find(
              (r) => r.revision === Number(b.dataset.version),
            );
            store.edit(id, row.value);
            $("#history-dialog").close();
            store.flush();
          }),
      );
      if (data.nextBefore)
        $("#more-history").onclick = () => load(data.nextBefore);
    } catch (e) {
      $("#history-content").textContent = e.message;
    }
  }
  await load();
}
store.subscribe(render);
store.connect().then(async () => {
  if (initialKey) {
    const ok = await store.authenticate(initialKey);
    if (!ok) access();
  }
});
