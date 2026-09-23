import { ROOMS, CARDS, getDisplay } from "./exhibition-schema.js";
import { mediaURL } from "./exhibition-media.js";
const esc = (s) =>
  String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function compositionHTML(room, values) {
  const r = ROOMS[room - 1],
    get = (id, key) => values[`${id}.${key}`] || "";
  const photo = (id) => {
    const url = mediaURL(get(id, "image"));
    return url
      ? `<figure class="composition-photo"><img src="${url}" alt="${esc(get(id, "imageCaption") || "Exhibition image")}" loading="lazy"><figcaption>${esc(get(id, "imageCaption"))}<small>${esc(get(id, "imageCredit"))}</small></figcaption></figure>`
      : "";
  };
  const text = (id, key, prompt) =>
    `<section><h4>${esc(prompt)}</h4><p class="${get(id, key) ? "" : "composition-empty"}">${esc(get(id, key) || "Add this in the exhibition studio.")}</p></section>`;
  const quote = (id) =>
    get(id, "quote")
      ? `<blockquote>${esc(get(id, "quote"))}<cite>${esc(get(id, "source"))}</cite></blockquote>`
      : "";
  const title = (id) => esc(getDisplay(id, values)?.title);
  const entry = (id, body, number = "") =>
    `<article class="composition-card" data-composition-card="${id}">${number ? `<span class="composition-number">${esc(number)}</span>` : ""}<h3>${title(id)}</h3>${photo(id)}${body}<button type="button" data-open-entry="${id}">Open full entry ↗</button></article>`;
  let body = "";
  if (room === 1) {
    body = `<div class="control-map"><div class="control-centre"><span>DOUGLASS</span>${photo("r1-symbol")}<p>${esc(get("r1-symbol", "context") || "The man they tried to control")}</p></div>${[1, 2, 3, 4].map((i) => entry(`r1-control-${i}`, quote(`r1-control-${i}`) + text(`r1-control-${i}`, "effect", "How it affects Douglass"), String(i))).join("")}</div><div class="composition-connection"><h3>CONTROL → RESISTANCE</h3>${entry("r1-turning-point", text("r1-turning-point", "before", "Before") + text("r1-turning-point", "event", "The confrontation") + text("r1-turning-point", "after", "The turning point"))}${entry("r1-resistance", text("r1-resistance", "change", "What changes?") + text("r1-resistance", "connection", "Towards greater agency and freedom"))}</div>`;
  }
  if (room === 2)
    body = `<div class="visual-journey">${[1, 2, 3, 4, 5]
      .map((i) => {
        const id = `r2-stage-${i}`;
        return entry(
          id,
          `<span class="freedom-type">${esc(get(id, "freedom") || "E / I / both")}</span>` +
            text(id, "happens", "WHAT HAPPENS?") +
            text(id, "changes", "WHAT CHANGES FOR DOUGLASS?") +
            text(id, "method", "HOW DOES DOUGLASS PRESENT THE CHANGE?"),
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
        return `<article class="contradiction-pair"><h3>${i}. ${title(id)}</h3><div class="contradiction-columns">${text(id, "claim", "Claim")}${text(id, "action", "Action")}</div>${photo(id)}${quote(id)}${text(id, "method", "Douglass’s method")}${text(id, "analysis", "What the contradiction exposes")}<button type="button" data-open-entry="${id}">Open full entry ↗</button></article>`;
      })
      .join(
        "",
      )}</div><div class="composition-connection">${entry("r3-contradiction", text("r3-contradiction", "copy", "Creative museum exhibit"))}${entry("r3-analysis", text("r3-analysis", "analysis", "Approximately 150 words"))}</div>`;
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
            text(c.id, "change", "How Douglass changes"),
          `${i + 1} / 6`,
        ),
      )
      .join(
        "",
      )}</div>${entry("r4-representation", text("r4-representation", "withholding", "Choosing what to reveal") + text("r4-representation", "shift", "Controlling the representation of his life"))}`;
  if (room === 5)
    body =
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
  return `<div class="room-composition"><header class="composition-heading"><span>ROOM ${r.number}</span><h2>${esc(r.feature)}</h2><p>${esc(r.title)}</p><p class="composition-order">${esc(r.chronology)}</p></header>${body}<p class="composition-bridge">${esc(r.bridge)}</p></div>`;
}
