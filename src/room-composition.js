import {
  ROOMS,
  CARDS,
  CARD_BY_ID,
  getDisplay,
  eventParagraph,
  isJourneyEvent,
  visibleCardFields,
} from "./exhibition-schema.js";
import { mediaURL } from "./exhibition-media.js";
const esc = (s) =>
  String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function compositionHTML(
  room,
  values,
  { audience = false, field = null } = {},
) {
  const editable = !!field;
  const r = ROOMS[room - 1],
    get = (id, key) =>
      isJourneyEvent(id) && key === "analysis"
        ? eventParagraph(id, values)
        : values[`${id}.${key}`] || "";
  const photo = (id) => {
    if (editable)
      return `<details class="composition-image-fields"><summary>Image, caption &amp; credit</summary>${["image", "imageCaption", "imageCredit"].map((key) => field(id, key)).join("")}</details>`;
    const url = mediaURL(get(id, "image"));
    return url
      ? `<figure class="composition-photo"><img src="${url}" alt="${esc(get(id, "imageCaption") || "Exhibition image")}" loading="lazy"><figcaption>${esc(get(id, "imageCaption"))}<small>${esc(get(id, "imageCredit"))}</small></figcaption></figure>`
      : "";
  };
  const text = (id, key, prompt) =>
    editable
      ? field(id, key)
      : audience && !get(id, key)
        ? ""
        : `<section><h4>${esc(prompt)}</h4><p class="${get(id, key) ? "" : "composition-empty"}">${esc(get(id, key) || "Add this in the exhibition studio.")}</p></section>`;
  const quote = (id) =>
    editable
      ? field(id, "quote") + field(id, "source")
      : get(id, "quote")
        ? `<blockquote>${esc(get(id, "quote"))}<cite>${esc(get(id, "source"))}</cite></blockquote>`
        : "";
  const title = (id) => esc(getDisplay(id, values)?.title);
  const open = (id) =>
    audience &&
    !visibleCardFields(CARD_BY_ID[id]).some(
      (f) => f.key !== "title" && getDisplay(id, values).values[f.key].trim(),
    )
      ? ""
      : `<button type="button" data-open-entry="${id}">${editable ? "All fields" : "View entry"} ↗</button>`;
  const entry = (id, body, number = "") =>
    `<article class="composition-card" data-composition-card="${id}">${number ? `<span class="composition-number">${esc(number)}</span>` : ""}<h3 data-composition-title="${id}">${title(id)}</h3>${editable ? field(id, "title") : ""}${isJourneyEvent(id) ? "" : photo(id)}${body}${isJourneyEvent(id) ? photo(id) : ""}${open(id)}</article>`;
  let body = "";
  if (room === 1) {
    body = `<div class="control-map"><div class="control-centre"><span>DOUGLASS</span>${photo("r1-symbol")}${text("r1-symbol", "context", "Douglass’s starting position")}${editable ? field("r1-symbol", "title") + field("r1-symbol", "meaning") : ""}${open("r1-symbol")}</div>${[1, 2, 3, 4].map((i) => entry(`r1-control-${i}`, quote(`r1-control-${i}`) + text(`r1-control-${i}`, "effect", "How it affects Douglass") + (editable ? field(`r1-control-${i}`, "method") : ""), String(i))).join("")}</div><div class="composition-connection"><h3>CONTROL → RESISTANCE</h3>${entry("r1-turning-point", quote("r1-turning-point") + text("r1-turning-point", "before", "Before") + text("r1-turning-point", "event", "The confrontation") + text("r1-turning-point", "after", "The turning point"))}${entry("r1-resistance", text("r1-resistance", "change", "What changes?") + text("r1-resistance", "connection", "Towards greater agency and freedom"))}</div>`;
  }
  if (room === 2)
    body = `<div class="visual-journey">${[1, 2, 3, 4, 5]
      .map((i) => {
        const id = `r2-stage-${i}`;
        return entry(
          id,
          text(id, "analysis", "Event paragraph") +
            quote(id) +
            (editable
              ? field(id, "freedom")
              : get(id, "freedom")
                ? `<span class="freedom-type">${esc(CARD_BY_ID[id].fields.find((f) => f.key === "freedom").options.find(([v]) => v === get(id, "freedom"))?.[1] || get(id, "freedom"))}</span>`
                : "") +
            (editable
              ? `<details class="previous-event-fields" data-earlier-wrap hidden><summary>Earlier saved writing (preserved)</summary><p data-earlier-event="${id}"></p></details>`
              : ""),
          `${i} / 5`,
        );
      })
      .join(
        "",
      )}</div><div class="composition-connection">${entry("r2-internal-freedom", text("r2-internal-freedom", "claim", "Was Douglass internally free before he was physically free?") + quote("r2-internal-freedom") + text("r2-internal-freedom", "analysis", "Evidence and explanation"))}${entry("r2-connection", text("r2-connection", "connection", "Resistance → agency → freedom"))}</div>`;
  if (room === 3)
    body = `<div class="contradiction-wall"><header><h3>WHAT RELIGION CLAIMS</h3><h3>WHAT SLAVEHOLDERS ACTUALLY DO</h3></header>${[
      1, 2, 3,
    ]
      .map((i) => {
        const id = `r3-pair-${i}`;
        return `<article class="contradiction-pair"><h3 data-composition-title="${id}" data-title-prefix="${i}. ">${i}. ${title(id)}</h3>${editable ? field(id, "title") : ""}<div class="contradiction-columns">${text(id, "claim", "Claim")}${text(id, "action", "Action")}</div>${photo(id)}${quote(id)}${text(id, "method", "Douglass’s method")}${text(id, "analysis", "What the contradiction exposes")}${open(id)}</article>`;
      })
      .join(
        "",
      )}</div><div class="composition-connection">${entry("r3-contradiction", (editable ? field("r3-contradiction", "example") + field("r3-contradiction", "format") : "") + text("r3-contradiction", "copy", "Creative museum exhibit"))}${entry("r3-analysis", text("r3-analysis", "analysis", "Approximately 150 words"))}</div>`;
  if (room === 4)
    body = `<div class="identity-archive">${CARDS.filter((c) =>
      /^r4-stage-/.test(c.id),
    )
      .map((c, i) =>
        entry(
          c.id,
          `<p class="stage-name">${esc(c.label.toUpperCase())}</p>` +
            text(c.id, "event", "One important event") +
            quote(c.id) +
            text(c.id, "method", "One authorial choice") +
            text(c.id, "change", "How Douglass changes") +
            (editable ? field(c.id, "meaning") : ""),
          `${i + 1} / 6`,
        ),
      )
      .join(
        "",
      )}</div>${entry("r4-representation", quote("r4-representation") + text("r4-representation", "withholding", "Choosing what to reveal") + text("r4-representation", "shift", "Controlling the representation of his life"))}`;
  if (room === 5)
    body =
      entry(
        "r5-authors-desk",
        text("r5-authors-desk", "meaning", "Writing artifacts") +
          text("r5-authors-desk", "connection", "Authorship"),
      ) +
      entry(
        "r5-curator-statement",
        text(
          "r5-curator-statement",
          "statement",
          "100-word Curator’s Statement",
        ),
      ) +
      `<div class="quotation-gallery">${[1, 2, 3, 4, 5, 6, 7, 8]
        .map((i) => {
          const id = `r5-quotation-${i}`;
          return entry(
            id,
            quote(id) +
              text(id, "interpretation", "What this quotation helps prove") +
              text(id, "connection", "Connection to the exhibition"),
            String(i),
          );
        })
        .join("")}</div>` +
      entry(
        "r5-synthesis",
        text("r5-synthesis", "argument", "One coherent exhibition") +
          text("r5-synthesis", "creative", "The creative feature"),
      );
  return `<div class="room-composition ${editable ? "composition-editable" : ""} ${audience ? "composition-audience" : ""}"><header class="composition-heading"><span>ROOM ${r.number}</span><h2>${esc(r.feature)}</h2><p>${esc(r.title)}</p>${audience ? "" : `<p class="composition-order">${esc(r.chronology)}</p>`}</header>${body}${audience ? "" : `<p class="composition-bridge">${esc(r.bridge)}</p>`}</div>`;
}
