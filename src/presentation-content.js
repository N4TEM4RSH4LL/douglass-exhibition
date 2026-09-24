import {
  CARDS,
  isBoardVisible,
  ROOMS,
  getDisplay,
  isJourneyEvent,
  visibleCardFields,
} from "./exhibition-schema.js";
import { mediaURL } from "./exhibition-media.js";
export const escapeHTML = (value) =>
  String(value || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function presentationEntries(room, values) {
  return CARDS.filter(
    (c) =>
      c.room === room &&
      isBoardVisible(c.id, values) &&
      visibleCardFields(c).some(
        (f) =>
          f.key !== "title" && getDisplay(c.id, values).values[f.key].trim(),
      ),
  );
}
export function presentationEntryHTML(id, values) {
  const data = getDisplay(id, values);
  if (!data || !isBoardVisible(id, values)) return "";
  const { card } = data,
    room = ROOMS[card.room - 1],
    v = data.values;
  const fields = visibleCardFields(card).filter(
    (f) =>
      ![
        "title",
        "image",
        "imageCaption",
        "imageCredit",
        "quote",
        "source",
      ].includes(f.key) && v[f.key],
  );
  const photo = mediaURL(v.image);
  const quote = v.quote
    ? `<blockquote>${escapeHTML(v.quote)}${v.source ? `<cite>${escapeHTML(v.source)}</cite>` : ""}</blockquote>`
    : "";
  const source =
    !v.quote && v.source
      ? `<p class="presentation-source">${escapeHTML(v.source)}</p>`
      : "";
  const section = (f) =>
    `<section>${fields.length > 1 && !(isJourneyEvent(card.id) && f.key === "analysis") ? `<h2>${escapeHTML(f.label)}</h2>` : ""}<p>${escapeHTML(f.options?.find(([value]) => value === v[f.key])?.[1] || v[f.key])}</p></section>`;
  const writing = isJourneyEvent(card.id)
    ? fields
        .filter((f) => f.key === "analysis")
        .map(section)
        .join("") +
      quote +
      source +
      fields
        .filter((f) => f.key === "freedom")
        .map(section)
        .join("")
    : quote + fields.map(section).join("") + source;
  return `<article class="presentation-entry ${photo ? "has-image" : ""}" data-presentation-entry="${id}"><header><p class="presentation-eyebrow">ROOM ${room.number} · ${escapeHTML(room.feature)}</p><h1>${escapeHTML(data.title)}</h1></header><div class="presentation-entry-body">${photo ? `<figure><img src="${photo}" alt="${escapeHTML(v.imageCaption || card.label)}"><figcaption>${escapeHTML(v.imageCaption)}<small>${escapeHTML(v.imageCredit)}</small></figcaption></figure>` : ""}<div class="presentation-writing">${writing}</div></div></article>`;
}
export const FEATURE_ANCHORS = [
  { room: 1, position: [-7.5, 3.18, 6.4], icon: "map" },
  { room: 2, position: [7.6, 3.2, 6.4], icon: "journey" },
  { room: 3, position: [7.4, 3.35, -5.1], icon: "contrast" },
  { room: 4, position: [-7.3, 3.3, -5.5], icon: "archive" },
  { room: 5, position: [0, 3.38, -17.1], icon: "statement" },
];
export const FEATURE_ICONS = {
  map: '<circle cx="12" cy="12" r="3"/><path d="M9 10 4 5m11 5 5-5M9 14l-5 5m11-5 5 5"/><circle cx="3" cy="4" r="2"/><circle cx="21" cy="4" r="2"/><circle cx="3" cy="20" r="2"/><circle cx="21" cy="20" r="2"/>',
  journey:
    '<circle cx="4" cy="18" r="2"/><circle cx="12" cy="10" r="2"/><circle cx="20" cy="5" r="2"/><path d="m5 16 5-5m4-2 4-3"/>',
  contrast: '<path d="M3 4h7v16H3zM14 4h7v16h-7zM5 8h3m-3 4h3m8-4h3m-3 4h3"/>',
  archive: '<path d="M3 5h18v5H3zM5 10v11h14V10M9 14h6"/>',
  statement: '<path d="M5 3h14v18H5zM8 8h8m-8 4h8m-8 4h5"/>',
};
export const featureIcon = (room) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${FEATURE_ICONS[FEATURE_ANCHORS[room - 1].icon]}</svg>`;
