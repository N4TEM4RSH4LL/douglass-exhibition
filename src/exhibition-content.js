import { applyBoardVisibility } from "./board-interaction.js";
import { mediaURL } from "./exhibition-media.js";
import * as THREE from "three";
import { SharedExhibition } from "./shared-store.js";
import {
  CARDS,
  isBoardVisible,
  CARD_BY_ID,
  ROOMS,
  getDisplay,
  displayBinding,
  visibleCardFields,
} from "./exhibition-schema.js";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function lines(ctx, text, width, max) {
  const words = String(text).replace(/\s+/g, " ").trim().split(" "),
    out = [];
  let line = "";
  for (const word of words) {
    const trial = line ? line + " " + word : word;
    if (ctx.measureText(trial).width > width && line) {
      out.push(line);
      line = word;
    } else line = trial;
  }
  if (line) out.push(line);
  if (out.length > max) {
    out.length = max;
    let last = out[max - 1];
    while (last.length && ctx.measureText(last + "…").width > width)
      last = last.slice(0, -1);
    out[max - 1] = last.replace(/\s+$/, "") + "…";
  }
  return out;
}
const imageCache = new Map();
function screenTexture(display, data, resolution = 1024, anisotropy = 4) {
  const c = document.createElement("canvas");
  c.width = resolution;
  c.height = Math.round((resolution * display.height) / display.width);
  const ctx = c.getContext("2d"),
    w = 1024,
    h = (1024 * display.height) / display.width,
    pad = 64;
  ctx.scale(resolution / 1024, resolution / 1024);
  ctx.fillStyle = "#ded5bb";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#9c8857";
  ctx.lineWidth = 2;
  ctx.strokeRect(25, 25, w - 50, h - 50);
  ctx.textBaseline = "top";
  const scale = Math.min(1, h / 520),
    small = Math.round(20 * scale),
    title = Math.round(43 * scale),
    body = Math.round(30 * scale);
  let y = pad * scale;
  ctx.fillStyle = "#77623b";
  ctx.font = `500 ${small}px Arial`;
  ctx.fillText(
    `ROOM ${ROOMS[data.card.room - 1].number}  /  ${ROOMS[data.card.room - 1].feature.toUpperCase()}`,
    pad,
    y,
  );
  y += small * 2.2;
  ctx.fillStyle = "#24352e";
  ctx.font = `${title}px Georgia`;
  for (const line of lines(ctx, data.title, w - pad * 2, 2)) {
    ctx.fillText(line, pad, y);
    y += title * 1.15;
  }
  y += 22 * scale;
  ctx.strokeStyle = "#aa9670";
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(w - pad, y);
  ctx.stroke();
  y += 24 * scale;
  const image = imageCache.get(data.values.image);
  if (image?.complete && image.naturalWidth) {
    const area = Math.max(65 * scale, Math.min(h * 0.42, h - y - 120 * scale));
    const ratio = Math.min(
      (w - pad * 2) / image.naturalWidth,
      area / image.naturalHeight,
    );
    const iw = image.naturalWidth * ratio,
      ih = image.naturalHeight * ratio;
    ctx.drawImage(image, (w - iw) / 2, y, iw, ih);
    y += ih + 22 * scale;
  }
  const quoteShown = !!data.quote && !data.binding.field;
  const content = data.binding.field
    ? data.primary || data.quote
    : data.quote || data.primary;
  ctx.font = `${quoteShown ? "italic " : ""}${body}px Georgia`;
  ctx.fillStyle = "#354339";
  const max = Math.max(1, Math.floor((h - y - 88 * scale) / (body * 1.42)));
  const sample = content
    ? `${quoteShown ? "“" : ""}${content}${quoteShown ? "”" : ""}`
    : "Awaiting the class contribution";
  for (const line of lines(ctx, sample, w - pad * 2, max)) {
    ctx.fillText(line, pad, y);
    y += body * 1.42;
  }
  ctx.font = `${small}px Arial`;
  ctx.fillStyle = "#7c6844";
  const source =
    data.quote && data.source
      ? data.source
      : "Open the display to read the full entry";
  ctx.fillText(lines(ctx, source, w - pad * 2, 1)[0], pad, h - 50 * scale);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}
export function connectExhibition(world) {
  const store = new SharedExhibition();
  let active = null,
    contentKey = "";
  const cache = new Map();
  let previewValues = null,
    resolution = 1024,
    anisotropy = 4,
    sharedValues = store.values();
  const values = () => previewValues || sharedValues;
  function show(id) {
    active = id;
    contentKey = "";
    renderContent();
  }
  function renderContent() {
    const data = getDisplay(active, values());
    if (!data) return;
    const key = active + JSON.stringify(data.values);
    if (key === contentKey) return;
    contentKey = key;
    const card = data.card,
      r = ROOMS[card.room - 1];
    document
      .querySelector("#artifact-panel")
      .setAttribute("aria-label", data.title);
    document.querySelector("#display-content").innerHTML =
      `<span class="display-eyebrow">ROOM ${r.number} · ${esc(r.title)}</span><h1>${esc(data.title)}</h1>${!data.hasContent ? '<p class="display-empty">This exhibit is ready for your class contribution.</p>' : ""}${mediaURL(data.values.image) ? `<figure class="exhibit-image"><img src="${mediaURL(data.values.image)}" alt="${esc(data.values.imageCaption || card.label)}"><figcaption>${esc(data.values.imageCaption)}<small>${esc(data.values.imageCredit)}</small></figcaption></figure>` : ""}${visibleCardFields(
        card,
      )
        .filter(
          (f) =>
            !["title", "image", "imageCaption", "imageCredit"].includes(
              f.key,
            ) && data.values[f.key],
        )
        .map(
          (f) =>
            `<section class="display-section"><h2>${esc(f.label)}</h2>${f.key === "quote" ? `<blockquote>${esc(data.values[f.key])}</blockquote>` : `<p>${esc(f.options?.find(([v]) => v === data.values[f.key])?.[1] || data.values[f.key])}</p>`}</section>`,
        )
        .join(
          "",
        )}<details class="display-guidance"><summary>What belongs in this exhibit</summary><p><strong>Assigned reading:</strong> ${esc(r.reading)}</p><p>${esc(card.guide)}</p><p><strong>Sequence:</strong> ${esc(r.chronology)}</p><ul>${visibleCardFields(
        card,
      )
        .map((f) => `<li><strong>${esc(f.label)}:</strong> ${esc(f.help)}</li>`)
        .join(
          "",
        )}</ul></details><a class="display-edit" href="./editor.html#card=${card.id}" target="_blank" rel="noopener">Contribute to this exhibit ↗</a>`;
  }
  function refresh() {
    const current = values();
    applyBoardVisibility(world, current);
    for (const display of world.displays) {
      const data = getDisplay(display.id, current);
      if (!data) continue;
      const imageRef = data.values.image;
      if (mediaURL(imageRef) && !imageCache.has(imageRef)) {
        const image = new Image();
        imageCache.set(imageRef, image);
        image.crossOrigin = "anonymous";
        image.onload = () => {
          for (const d of world.displays) {
            const latest = getDisplay(d.id, values());
            if (latest?.values.image === imageRef) {
              d.material.map?.dispose();
              d.material.map = screenTexture(d, latest, resolution, anisotropy);
              d.material.needsUpdate = true;
            }
          }
        };
        image.src = mediaURL(imageRef);
      }
      const key = JSON.stringify(data.values);
      if (cache.get(display.id) === key) continue;
      cache.set(display.id, key);
      display.material.map?.dispose();
      display.material.map = screenTexture(
        display,
        data,
        resolution,
        anisotropy,
      );
      display.material.color.set("#ffffff");
      display.material.needsUpdate = true;
    }
    if (active && document.querySelector("#artifact-panel").open)
      renderContent();
    const status = document.querySelector("#exhibition-sync");
    status.textContent = store.online
      ? store.streamLive
        ? "Live class exhibition"
        : "Shared class exhibition"
      : store.loaded
        ? "Offline · showing the last shared version"
        : "Connecting to class exhibition…";
    status.classList.toggle("offline", !store.online);
  }
  store.subscribe(() => {
    sharedValues = store.values();
    refresh();
  });
  store.connect();
  return {
    show,
    store,
    values,
    setPreview(next) {
      previewValues = next;
      refresh();
    },
    setResolution(next, filtering = 4) {
      if (next !== resolution || filtering !== anisotropy) {
        resolution = next;
        anisotropy = filtering;
        cache.clear();
        refresh();
      }
    },
    roomEntries(room) {
      return CARDS.filter(
        (c) => c.room === room && isBoardVisible(c.id, values()),
      );
    },
    title(id) {
      return getDisplay(id, values())?.title || displayBinding(id).label;
    },
  };
}
