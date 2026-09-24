import "./editor.css";
import { createDeveloperPreview } from "./developer-preview.js";
import "./room-composition.css";
import { mediaURL, uploadImage } from "./exhibition-media.js";
import { compositionHTML } from "./room-composition.js";
import {
  CARDS,
  isBoardVisible,
  OPENING_CARD,
  CARD_BY_ID,
  FIELD_BY_ID,
  ROOMS,
  QUESTION,
  ASSIGNMENT_NOTE,
  cardProgress,
  getDisplay,
  isJourneyEvent,
  eventParagraph,
  earlierEventWriting,
  visibleCardFields,
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
let openingEditing =
  fragment.get("view") === "opening" ||
  fragment.get("card") === OPENING_CARD.id;
let selected = CARDS.some((c) => c.id === fragment.get("card"))
    ? fragment.get("card")
    : CARDS[0].id,
  showOverview = false,
  featureEditing = fragment.get("view") === "feature";
if (
  featureEditing &&
  Number(fragment.get("room")) >= 1 &&
  Number(fragment.get("room")) <= 5
)
  selected = CARDS.find((c) => c.room === Number(fragment.get("room"))).id;
const initialKey = fragment.get("access");
if (initialKey) {
  fragment.delete("access");
  history.replaceState(
    null,
    "",
    location.pathname + (fragment.toString() ? "#" + fragment.toString() : ""),
  );
}
const developer = createDeveloperPreview(store, () =>
  openingEditing || showOverview ? null : selected,
);
let renderKey = "",
  historyField = "",
  importChanges = [];
function roomOfSelection() {
  return CARD_BY_ID[selected].room;
}
function select(id) {
  if (id === OPENING_CARD.id) return editOpening();
  openingEditing = false;
  if (!CARD_BY_ID[id]) return;
  selected = id;
  developer.select();
  showOverview = false;
  featureEditing = false;
  history.replaceState(null, "", `#card=${encodeURIComponent(id)}`);
  renderKey = "";
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function editFeature(room = roomOfSelection()) {
  openingEditing = false;
  selected = CARDS.find((c) => c.room === room).id;
  developer.select();
  showOverview = false;
  featureEditing = true;
  history.replaceState(null, "", `#room=${room}&view=feature`);
  renderKey = "";
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function visibilityHTML(card) {
  const f = FIELD_BY_ID[`${card.id}.visibility`];
  return `<section class="board-visibility" data-visibility="${card.id}"><div><strong data-visibility-label></strong><p>${card.id.startsWith("r3-pair-") ? "This controls both the claim and conduct boards. " : ""}Removal applies to the museum, zoom controls and presentation for everyone. Your writing is kept here.</p></div><button class="button" type="button" data-toggle-board="${card.id}">Remove board</button><details><summary>Visibility status &amp; history</summary>${fieldHTML(card, f)}</details></section>`;
}
function bindVisibility() {
  $$("[data-toggle-board]").forEach(
    (button) =>
      (button.onclick = () => {
        if (!store.authorized) {
          access();
          return;
        }
        const id = button.dataset.toggleBoard,
          field = `${id}.visibility`;
        if (store.pending[field]?.conflict) return;
        store.edit(
          field,
          isBoardVisible(id, store.values()) ? "hidden" : "shown",
          store.pending[field]?.baseRevision ??
            store.fields[field]?.revision ??
            0,
        );
        store.flush();
      }),
  );
}
function renderNavigation(values) {
  $("#edit-opening").classList.toggle("active", openingEditing);
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
          `<button class="card-link ${c.id === selected && !showOverview ? "active" : ""} ${cardProgress(c, values).complete ? "complete" : ""}" data-card="${c.id}"><span class="card-dot" aria-hidden="true"></span>${esc(c.label)}${isBoardVisible(c.id, values) ? "" : ' <small class="removed-badge">Removed</small>'}</button>`,
      )
      .join("");
  $$("#room-tabs button").forEach(
    (b) =>
      (b.onclick = () =>
        featureEditing
          ? editFeature(Number(b.dataset.room))
          : select(CARDS.find((c) => c.room === Number(b.dataset.room)).id)),
  );
  $("#edit-feature").textContent = `Edit ${ROOMS[room - 1].feature}`;
  $("#edit-feature").classList.toggle("active", featureEditing);
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
  $("#collaboration-note").hidden = !store.authorized;
}
function fieldHTML(card, f) {
  const id = `${card.id}.${f.key}`,
    input =
      f.type === "image"
        ? `<input type="hidden" id="field-${id}" data-field="${id}"><div class="image-upload"><img data-image-preview="${id}" alt="" hidden><input aria-label="Upload image for ${esc(card.label)}" data-upload="${id}" type="file" accept="image/jpeg,image/png,image/webp"><button type="button" class="button" data-remove-image="${id}">Remove image</button><p data-upload-status="${id}" role="status"></p></div>`
        : f.type === "select"
          ? `<select id="field-${id}" data-field="${id}"><option value="">Choose…</option>${f.options.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select>`
          : f.type === "text"
            ? `<input id="field-${id}" data-field="${id}" maxlength="${f.maxLength}" autocomplete="off">`
            : `<textarea id="field-${id}" data-field="${id}" maxlength="${f.maxLength}" rows="${f.targetWords ? 7 : f.key === "quote" ? 4 : 5}"></textarea>`;
  return `<div class="field ${f.key === "quote" ? "quote" : ""}" data-field-wrap="${id}"><div class="field-label-row"><label for="field-${id}">${esc(f.label)}${f.required ? "" : ' <span class="optional-field">(optional)</span>'}</label><span class="field-state"></span></div><p class="field-help" id="help-${id}">${esc(f.help)}</p>${input}<div class="field-tools"><span class="word-count" data-count="${id}"></span><button class="history-button" type="button" data-history="${id}">Version history</button></div><div class="field-conflict" hidden></div></div>`;
}
function entryFieldsHTML(card) {
  const fields = card.fields;
  const photos = fields.filter((f) =>
    ["image", "imageCaption", "imageCredit"].includes(f.key),
  );
  const imageFields = `<details class="previous-event-fields"><summary>Image, caption &amp; credit</summary>${photos.map((f) => fieldHTML(card, f)).join("")}</details>`;
  if (isJourneyEvent(card.id)) {
    return (
      visibleCardFields(card)
        .filter((f) => !photos.includes(f))
        .map((f) => fieldHTML(card, f))
        .join("") +
      imageFields +
      `<details class="previous-event-fields" data-earlier-wrap hidden><summary>Earlier saved writing (preserved)</summary><p data-earlier-event="${card.id}"></p></details>`
    );
  }
  return (
    fields
      .filter((f) => !photos.includes(f))
      .map((f) => fieldHTML(card, f))
      .join("") + imageFields
  );
}
function editOpening() {
  openingEditing = true;
  developer.select();
  showOverview = false;
  featureEditing = false;
  history.replaceState(null, "", "#view=opening");
  renderKey = "";
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function renderOpeningEditor() {
  $("#content").innerHTML =
    `<header class="room-intro"><span class="eyebrow">PRESENTATION OPENING</span><h1>Opening slides</h1><p>The main slide starts with the document’s exact title, task sentence and question. The ready screen holds the names. Changes here save for the whole class.</p><a class="button" href="./?mode=presentation" target="_blank" rel="noopener">Preview opening ↗</a></header><article class="entry-card"><form id="entry-form">${OPENING_CARD.fields.map((f) => fieldHTML(OPENING_CARD, f)).join("")}</form></article>`;
  $("#entry-form").onsubmit = (e) => e.preventDefault();
  bindFields();
}
function renderFeatureEditor() {
  const room = roomOfSelection(),
    r = ROOMS[room - 1];
  $("#content").innerHTML =
    `<header class="room-intro"><span class="eyebrow">ROOM ${r.number} · EDIT THE ROOM FEATURE</span><h1>${esc(r.feature)}</h1><p>Edit the text and images directly in the layout. Each box saves to the same shared exhibition.</p><div class="feature-editor-actions"><button class="button" id="show-entry-editor">Edit one entry at a time</button><a class="button" href="./?mode=presentation#room=${room}" target="_blank" rel="noopener">Present this room ↗</a></div></header><form id="entry-form">${compositionHTML(
      room,
      store.values(),
      {
        field: (id, key) => {
          const c = CARD_BY_ID[id],
            f = c.fields.find((f) => f.key === key);
          return f
            ? (key === "title" ? visibilityHTML(c) : "") + fieldHTML(c, f)
            : "";
        },
      },
    )}</form>`;
  $("#entry-form").onsubmit = (e) => e.preventDefault();
  $("#show-entry-editor").onclick = () => select(selected);
  $("#content")
    .querySelectorAll("[data-open-entry]")
    .forEach((b) => (b.onclick = () => select(b.dataset.openEntry)));
  bindFields();
}
function renderEntry() {
  const card = CARD_BY_ID[selected],
    r = ROOMS[card.room - 1],
    index = CARDS.indexOf(card),
    next = CARDS[index + 1];
  $("#content").innerHTML =
    `<header class="room-intro"><span class="eyebrow">ROOM ${r.number} · EXHIBITION STUDIO</span><h1>${esc(r.title)}</h1><p>${esc(r.summary)}</p><div class="reading"><span>Reading</span>${esc(r.reading)}</div><details class="chronology-guide"><summary>Reading order &amp; connection</summary><p>${esc(r.chronology)}</p><p>${esc(r.bridge)}</p></details></header><article class="entry-card"><div class="entry-heading"><div><h2>${esc(card.label)}</h2><p>${esc(card.guide)}</p></div><span class="entry-progress" id="entry-progress"></span></div><form id="entry-form">${visibilityHTML(card)}${entryFieldsHTML(card)}</form></article><details class="composition-preview"><summary>Preview ${esc(r.feature)}</summary><div id="composition-preview"></div></details><div class="entry-bottom"><a href="./#room=${card.room}" target="_blank" rel="noopener">See Room ${r.number} in the museum ↗</a>${next ? `<button class="button" id="next-entry">Next: ${esc(next.label)} →</button>` : '<button class="button" id="review-all">Review the presentation →</button>'}</div>`;
  $("#entry-form").onsubmit = (e) => e.preventDefault();
  bindFields();
  if (next) $("#next-entry").onclick = () => select(next.id);
  else
    $("#review-all").onclick = () => {
      showOverview = true;
      renderKey = "";
      render();
    };
}
function bindFields() {
  bindVisibility();
  $$("[data-field]").forEach((input) => {
    input.setAttribute("aria-describedby", `help-${input.dataset.field}`);
    input.onfocus = () => {
      developer.focus(input.dataset.field);
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
      queueMicrotask(() => hydrateFields(store.values()));
    };
  });
  $$("[data-history]").forEach(
    (b) => (b.onclick = () => openHistory(b.dataset.history)),
  );
  $$("[data-upload]").forEach(
    (input) =>
      (input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        const id = input.dataset.upload,
          message = document.querySelector(`[data-upload-status="${id}"]`);
        if (!store.authorized) {
          message.textContent =
            "Unlock the editor, then select your image again.";
          input.value = "";
          access();
          return;
        }
        const revision =
          store.pending[id]?.baseRevision ?? store.fields[id]?.revision ?? 0;
        input.disabled = true;
        message.textContent = "Uploading and saving image…";
        try {
          const reference = await uploadImage(file, store.token);
          store.edit(id, reference, revision);
          await store.flush();
          message.textContent = store.pending[id]
            ? "Image uploaded · review its save status above."
            : "Image saved for everyone.";
        } catch (error) {
          message.textContent = error.message;
        } finally {
          input.disabled = false;
          input.value = "";
        }
      }),
  );
  $$("[data-remove-image]").forEach(
    (button) =>
      (button.onclick = () => store.edit(button.dataset.removeImage, "")),
  );
}
function renderChecklist(values) {
  const pp = progress(values);
  const done = pp.reduce((a, p) => a + p.complete, 0);
  $("#content").innerHTML =
    `<header class="overview-intro"><span class="eyebrow">COMPLETE PRESENTATION</span><h1>One exhibition. One clear argument.</h1><p>${done} of ${CARDS.length} entries contain all required fields and meet any specified word targets.</p><div class="central-question">${esc(QUESTION)}</div><p>${esc(ASSIGNMENT_NOTE)}</p><p class="readiness-note">Before presenting, also check the accuracy of quotations, the quality of the analysis, chronological order, variety of evidence, and whether the connections between rooms make sense. A filled form alone does not establish these.</p></header>${ROOMS.map(
      (r, i) => {
        const p = pp[i];
        return `<section class="checklist-room"><span class="eyebrow">ROOM ${r.number} · ${p.complete}/${p.total} ENTRIES COMPLETE</span><h2>${esc(r.title)}</h2><p>${esc(r.reading)}</p><p class="chronology-note">${esc(r.chronology)}</p><div class="progress-track"><i style="width:${Math.round((p.fieldsDone / p.fieldsTotal) * 100)}%"></i></div><ul>${r.requirements.map((s) => `<li>${esc(s)}</li>`).join("")}</ul><button class="button" data-review-room="${r.id}">Review Room ${r.number} →</button></section>`;
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
  for (const wrap of $$("[data-visibility]")) {
    const id = wrap.dataset.visibility,
      shown = isBoardVisible(id, values),
      pending = store.pending[`${id}.visibility`];
    wrap.classList.toggle("removed", !shown);
    wrap.querySelector("[data-visibility-label]").textContent = shown
      ? "Board in exhibition"
      : "Board removed from exhibition";
    const button = wrap.querySelector("[data-toggle-board]");
    button.textContent = shown ? "Remove board" : "Restore board";
    button.disabled = !!pending?.conflict;
    if (pending?.conflict) wrap.querySelector("details").open = true;
  }
  for (const archive of $$("[data-earlier-event]")) {
    archive.textContent = earlierEventWriting(
      archive.dataset.earlierEvent,
      values,
    );
    archive.closest("details").hidden = !archive.textContent;
  }
  for (const heading of $$("[data-composition-title]"))
    heading.textContent =
      (heading.dataset.titlePrefix || "") +
      getDisplay(heading.dataset.compositionTitle, values).title;
  const card = CARD_BY_ID[selected],
    p = cardProgress(card, values);
  if ($("#entry-progress"))
    $("#entry-progress").textContent = p.complete
      ? "Entry complete"
      : `${p.completed}/${p.total} fields filled${p.wordIssues.length ? " · check word count" : ""}`;
  for (const input of $$("[data-field]")) {
    const id = input.dataset.field,
      f = FIELD_BY_ID[id],
      card = CARD_BY_ID[f.card],
      wrap = input.closest(".field"),
      pending = store.pending[id],
      row = store.fields[id],
      value =
        isJourneyEvent(card.id) && f.key === "analysis"
          ? eventParagraph(card.id, values)
          : Object.hasOwn(values, id)
            ? values[id]
            : f.defaultValue || "";
    if (document.activeElement !== input && input.value !== value)
      input.value = value;
    if (!pending && input.value === (row?.value || ""))
      input.dataset.baseRevision = String(row?.revision || 0);
    if (f.type === "image") {
      const preview = wrap.querySelector("[data-image-preview]"),
        src = mediaURL(values[id]);
      preview.hidden = !src;
      if (src && preview.getAttribute("src") !== src) preview.src = src;
      preview.alt =
        values[`${card.id}.imageCaption`] || `Image for ${card.label}`;
    }
    const count = wordCount(value),
      countNode = wrap.querySelector(".word-count");
    countNode.textContent =
      f.type === "image"
        ? values[id]
          ? "Shared image"
          : "Optional image"
        : f.targetWords
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
          ? `${store.isOwnSave(row) ? "Your save" : row.writer || "Class contributor"} · v${row.revision}`
          : value && isJourneyEvent(card.id) && f.key === "analysis"
            ? "Earlier writing · originals preserved"
            : f.defaultValue && !Object.hasOwn(values, id)
              ? "Default wording"
              : "Not filled";
    state.classList.toggle("pending", !!pending);
    const conflict = wrap.querySelector(".field-conflict");
    conflict.hidden = !pending?.conflict;
    if (!pending?.conflict) delete conflict.dataset.version;
    if (
      pending?.conflict &&
      conflict.dataset.version !== JSON.stringify(pending.conflict)
    ) {
      const version = pending.conflict;
      conflict.dataset.version = JSON.stringify(version);
      conflict.innerHTML = `<strong>${version.revision ? `${esc(version.writer || "Class contributor")} saved a different version.` : "This local draft has no matching shared version yet."}</strong><p>Your draft is still in the box above. ${version.revision ? `Shared version ${version.revision} · ${esc(new Date(version.updatedAt).toLocaleString())}:` : "Choose which version to keep:"}</p><p>${f.type === "image" && mediaURL(version.value) ? `<img class="conflict-image" src="${mediaURL(version.value)}" alt="Other saved image">` : esc(version.value || "(Empty)")}</p><button type="button" class="button" data-choice="shared">Use shared version</button><button type="button" class="button" data-choice="mine">Save my version instead</button>`;
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
  const drafts = store.recoverableDrafts(),
    recovery = $("#draft-recovery");
  recovery.hidden = !drafts.length;
  const draftSignature = JSON.stringify(drafts);
  if (recovery.dataset.signature !== draftSignature) {
    recovery.dataset.signature = draftSignature;
    recovery.innerHTML = `<div><strong>Unsaved work from another tab</strong><p>Each tab keeps its own drafts. If an earlier tab was closed, recover its work here. Keep working in the original tab if it is still open.</p>${drafts.map((d) => `<p>${esc(d.writer)} · ${d.pending.length} field${d.pending.length === 1 ? "" : "s"} · ${esc(new Date(d.backedUpAt).toLocaleString())} <button class="button" data-recover-draft="${esc(d.key)}">Recover this draft</button></p>`).join("")}</div>`;
    recovery
      .querySelectorAll("[data-recover-draft]")
      .forEach(
        (b) => (b.onclick = () => store.recoverDraft(b.dataset.recoverDraft)),
      );
  }
  const key = openingEditing
    ? "opening"
    : showOverview
      ? "overview"
      : featureEditing
        ? `feature-${roomOfSelection()}`
        : selected;
  if (showOverview) {
    renderChecklist(values);
    developer.select();
    renderKey = key;
    return;
  }
  if (renderKey !== key) {
    if (openingEditing) renderOpeningEditor();
    else if (featureEditing) renderFeatureEditor();
    else renderEntry();
    renderKey = key;
  }
  hydrateFields(values);
  developer.update();
  if (!$("#composition-preview")) return;
  $("#composition-preview").innerHTML = compositionHTML(
    roomOfSelection(),
    values,
  );
  $("#composition-preview")
    .querySelectorAll("[data-open-entry]")
    .forEach((b) => (b.onclick = () => select(b.dataset.openEntry)));
}
$("#edit-opening").onclick = editOpening;
$("#edit-feature").onclick = () => editFeature();
$("#overview-button").onclick = () => {
  openingEditing = false;
  showOverview = true;
  renderKey = "";
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
};
function access() {
  const d = $("#access-dialog");
  $("#writer").value = store.writer === "Class contributor" ? "" : store.writer;
  $("#class-key").value = store.token;
  $("#class-key").type = "password";
  $("#show-key").checked = false;
  $("#access-error").textContent = "";
  d.showModal();
}
$("#access-button").onclick = access;
$("#unlock").onclick = access;
$("#show-key").onchange = (e) => {
  $("#class-key").type = e.target.checked ? "text" : "password";
};
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
$("#export-word").onclick = async () => {
  const button = $("#export-word"),
    message = $("#export-status");
  button.disabled = true;
  message.hidden = false;
  message.textContent = "Preparing your writing backup…";
  try {
    await store.refresh();
    const { writingSnapshot, downloadWritingDocument } =
      await import("./document-export.js");
    const snapshot = writingSnapshot(store.values(), {
      pending: store.pending,
      fields: store.fields,
      online: store.online,
    });
    if (!snapshot.fieldCount)
      throw new Error(
        "No class writing is loaded yet. Connect to the exhibition and try again.",
      );
    await downloadWritingDocument(snapshot);
    message.textContent = `Word download started · ${snapshot.fieldCount} written fields${snapshot.draftCount ? `, including ${snapshot.draftCount} local drafts` : ""}.`;
  } catch (error) {
    message.textContent = "Export could not finish: " + error.message;
  } finally {
    button.disabled = false;
  }
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
                `<div class="history-entry"><div class="history-meta">Version ${row.revision} · ${esc(new Date(row.changedAt).toLocaleString())} · ${esc(row.writer)}</div><p class="history-value">${FIELD_BY_ID[id].type === "image" && mediaURL(row.value) ? `<img class="history-image" src="${mediaURL(row.value)}" alt="Previously saved image">` : esc(row.value || "(Empty field)")}</p><button class="button" data-version="${row.revision}">Restore this version</button></div>`,
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
store.connect({ accessKey: initialKey }).then(() => {
  if (initialKey && !store.authorized) {
    const message = store.error;
    access();
    $("#access-error").textContent = message;
  }
});
