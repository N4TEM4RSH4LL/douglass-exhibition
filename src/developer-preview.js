import {
  CARD_BY_ID,
  FIELD_BY_ID,
  isBoardVisible,
  displayBinding,
} from "./exhibition-schema.js";

// Public exhibit content only. Editor credentials and mutation ownership never cross this bridge.
export function previewMessage(data) {
  if (
    !data ||
    data.type !== "douglass-preview" ||
    !CARD_BY_ID[data.card] ||
    !CARD_BY_ID[data.card].room
  )
    return null;
  if (
    !data.values ||
    typeof data.values !== "object" ||
    Array.isArray(data.values)
  )
    return null;
  const values = {};
  for (const [id, value] of Object.entries(data.values)) {
    const field = FIELD_BY_ID[id];
    if (
      field &&
      typeof value === "string" &&
      value.length <= field.maxLength &&
      (!field.options || !value || field.options.some(([v]) => v === value))
    )
      values[id] = value;
  }
  const slot =
    typeof data.slot === "string" &&
    displayBinding(data.slot).card === data.card
      ? data.slot
      : data.card;
  return {
    card: data.card,
    slot,
    values,
    quality: ["low", "balanced", "high", "maximum"].includes(data.quality)
      ? data.quality
      : "high",
  };
}
export function createDeveloperPreview(store, selection) {
  const button = document.querySelector("#developer-mode"),
    panel = document.querySelector("#developer-preview"),
    host = document.querySelector("#preview-frame-host"),
    label = document.querySelector("#preview-board-name"),
    state = document.querySelector("#preview-state"),
    quality = document.querySelector("#preview-quality"),
    side = document.querySelector("#preview-board-side");
  let enabled = false,
    iframe = null,
    active = "",
    fieldCard = "",
    sent = "",
    ready = false;
  function update() {
    if (!enabled) return;
    const selected = selection(),
      card = CARD_BY_ID[fieldCard || selected];
    if (!card?.room) {
      label.textContent = "Choose an exhibition board";
      state.textContent = "Open a room entry to preview its board in 3D.";
      host.hidden = true;
      iframe?.remove();
      iframe = null;
      ready = false;
      sent = "";
      active = "";
      return;
    }
    host.hidden = false;
    if (active !== card.id) {
      active = card.id;
      side.value = "claim";
    }
    side.hidden = !card.id.startsWith("r3-pair-");
    label.textContent = card.label;
    const values = store.values();
    state.textContent = isBoardVisible(card.id, values)
      ? "Live preview · includes your unsaved typing. Shared save status is above."
      : "Removed from the exhibition · writing preserved. Restore it in the editor to show the board.";
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.title = "Live 3D preview of the selected exhibition board";
      iframe.src = `./?preview=board&quality=${quality.value}#room=${card.room}`;
      host.replaceChildren(iframe);
    }
    const slot = card.id.startsWith("r3-pair-")
      ? card.id.replace("pair", side.value)
      : card.id;
    const message = {
      type: "douglass-preview",
      card: card.id,
      slot,
      values,
      quality: quality.value,
    };
    const signature = JSON.stringify(message);
    if (ready && sent !== signature) {
      iframe.contentWindow.postMessage(message, location.origin);
      sent = signature;
    }
  }
  window.addEventListener("message", (e) => {
    if (
      !iframe ||
      e.source !== iframe.contentWindow ||
      e.origin !== location.origin ||
      e.data?.type !== "douglass-preview-ready"
    )
      return;
    ready = true;
    sent = "";
    update();
  });
  button.onclick = () => {
    enabled = !enabled;
    button.setAttribute("aria-pressed", String(enabled));
    button.textContent = enabled ? "Developer mode: on" : "Developer mode";
    document.body.classList.toggle("developer-mode", enabled);
    panel.hidden = !enabled;
    if (!enabled) {
      iframe?.remove();
      iframe = null;
      ready = false;
      sent = "";
    } else update();
  };
  quality.onchange = update;
  side.onchange = update;
  return {
    update,
    select() {
      fieldCard = "";
      update();
    },
    focus(id) {
      fieldCard = FIELD_BY_ID[id]?.card || "";
      update();
    },
  };
}
