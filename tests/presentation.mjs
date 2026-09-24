import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fracturePieces } from "../src/opening-slide.js";
import { FIELD_BY_ID, CARDS } from "../src/exhibition-schema.js";
const contract = JSON.parse(
  await readFile(
    new URL("./existing-field-contract.json", import.meta.url),
    "utf8",
  ),
);
for (const [id, field] of Object.entries(contract)) {
  assert.ok(FIELD_BY_ID[id], `Saved field ${id} must remain addressable`);
  for (const key of Object.keys(field))
    assert.deepEqual(FIELD_BY_ID[id][key], field[key], `${id}.${key}`);
}
for (const card of CARDS) assert.ok(card.fields.some((f) => f.key === "image"));
for (const [width, height] of [
  [360, 640],
  [1280, 720],
  [1920, 1080],
  [900, 500],
]) {
  const edges = new Map();
  let area = 0;
  for (const piece of fracturePieces(width, height)) {
    const [a, b, c] = piece.polygon;
    area +=
      Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) /
      2;
    for (let i = 0; i < 3; i++) {
      const a = piece.polygon[i],
        b = piece.polygon[(i + 1) % 3];
      assert.ok(a.every(Number.isFinite));
      assert.ok(a[0] >= 0 && a[0] <= width && a[1] >= 0 && a[1] <= height);
      const key = [a.join(","), b.join(",")].sort().join(":");
      edges.set(key, { a, b, count: (edges.get(key)?.count || 0) + 1 });
    }
  }
  assert.ok(
    Math.abs(area - width * height) < 0.001,
    "Fractures cover the entire title sheet",
  );
  for (const { a, b, count } of edges.values()) {
    const boundary =
      (a[0] === b[0] && (a[0] === 0 || a[0] === width)) ||
      (a[1] === b[1] && (a[1] === 0 || a[1] === height));
    assert.equal(
      count,
      boundary ? 1 : 2,
      "Internal fracture edges meet without gaps",
    );
  }
}
console.log(
  "PASS: all 203 existing field storage contracts preserved; presentation fracture tessellation covers mobile and desktop without holes.",
);
// The new entry point and map view must share the same persistent field IDs.
globalThis.location = { hostname: "localhost" };
const { compositionHTML } = await import("../src/room-composition.js");
const { presentationEntries, presentationEntryHTML, FEATURE_ANCHORS } =
  await import("../src/presentation-content.js");
const { cardProgress, getDisplay } =
  await import("../src/exhibition-schema.js");
for (let room = 1; room <= 5; room++) {
  const ids = [];
  compositionHTML(
    room,
    {},
    {
      field: (id, key) => {
        const fieldId = `${id}.${key}`;
        assert.ok(FIELD_BY_ID[fieldId], fieldId);
        ids.push(fieldId);
        return "";
      },
    },
  );
  assert.equal(
    new Set(ids).size,
    ids.length,
    "A visual editor cannot render duplicate bound fields",
  );
  const audience = compositionHTML(room, {}, { audience: true });
  assert.ok(!audience.includes("Add this in the exhibition studio"));
  assert.ok(!audience.includes("composition-order"));
  assert.equal(FEATURE_ANCHORS.filter((a) => a.room === room).length, 1);
}
const values = {
  "r2-stage-1.analysis": "Consolidated response",
  "r2-stage-1.freedom": "E+I",
  "r2-stage-1.happens": "Earlier detailed response",
  "r2-stage-2.title": "Title only",
  "r2-stage-3.happens": "Existing work from before the merge",
  "r2-stage-4.analysis": "<script>unsafe</script>",
};
assert.equal(getDisplay("r2-stage-1", values).primary, "Consolidated response");
assert.ok(
  cardProgress(
    CARDS.find((c) => c.id === "r2-stage-1"),
    values,
  ).complete,
);
assert.equal(values["r2-stage-1.happens"], "Earlier detailed response");
assert.ok(compositionHTML(2, values).includes("Consolidated response"));
assert.ok(
  compositionHTML(2, values).includes("Existing work from before the merge"),
);
assert.ok(
  !compositionHTML(2, values, { audience: true }).includes(
    'data-open-entry="r2-stage-2"',
  ),
);
assert.deepEqual(
  presentationEntries(2, values).map((c) => c.id),
  ["r2-stage-1", "r2-stage-3", "r2-stage-4"],
);
assert.ok(
  !presentationEntryHTML("r2-stage-1", values).includes(
    "Earlier detailed response",
  ),
);
assert.ok(
  presentationEntryHTML("r2-stage-3", values).includes(
    "Existing work from before the merge",
  ),
);
assert.ok(
  presentationEntryHTML("r2-stage-4", values).includes(
    "&lt;script&gt;unsafe&lt;/script&gt;",
  ),
);
console.log(
  "PASS: Room II consolidated analysis, old-response fallback, shared visual-editor bindings, audience filtering and escaped classroom slides.",
);

const { eventParagraph, visibleCardFields } =
  await import("../src/exhibition-schema.js");
const earlier = {
  "r2-stage-1.happens": "The event.",
  "r2-stage-1.changes": "Its effect.",
  "r2-stage-1.method": "The authorial choice.",
  "r2-stage-1.meaning": "The artifact connection.",
  "r2-stage-1.quote": "Supporting quotation.",
  "r2-stage-1.source": "Chapter 10",
  "r2-stage-1.freedom": "I",
};
const paragraph =
  "The event. Its effect. The authorial choice. The artifact connection.";
assert.equal(eventParagraph("r2-stage-1", earlier), paragraph);
assert.ok(
  !Object.hasOwn(earlier, "r2-stage-1.analysis"),
  "Showing earlier writing cannot modify shared data",
);
assert.equal(
  eventParagraph("r2-stage-1", { ...earlier, "r2-stage-1.analysis": "" }),
  "",
);
for (let i = 1; i <= 5; i++) {
  const card = CARDS.find((c) => c.id === `r2-stage-${i}`);
  assert.deepEqual(
    visibleCardFields(card).map((f) => f.key),
    [
      "title",
      "analysis",
      "quote",
      "source",
      "freedom",
      "image",
      "imageCaption",
      "imageCredit",
    ],
  );
  const rendered = compositionHTML(2, earlier, {
    field: (id, key) => `<input data-test-field="${id}.${key}">`,
  });
  const bound = [...rendered.matchAll(/data-test-field="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((id) => id.startsWith(card.id + "."))
    .map((id) => id.split(".")[1]);
  assert.deepEqual(
    bound,
    visibleCardFields(card).map((f) => f.key),
  );
}
const earlierSlide = presentationEntryHTML("r2-stage-1", earlier);
assert.ok(earlierSlide.includes(paragraph));
assert.ok(
  earlierSlide.indexOf(paragraph) <
    earlierSlide.indexOf("Supporting quotation."),
);
assert.ok(
  earlierSlide.indexOf("Supporting quotation.") <
    earlierSlide.indexOf("I — internal"),
);
assert.ok(!earlierSlide.includes("What happens?"));
assert.ok(!compositionHTML(2, earlier).includes("WHAT HAPPENS?"));
assert.ok(
  cardProgress(
    CARDS.find((c) => c.id === "r2-stage-1"),
    earlier,
  ).complete,
);
console.log(
  "PASS: all five events share one paragraph, quote/source and freedom order; earlier writing is combined without rewriting or deleting originals.",
);

const { OPENING_CARD, openingText } =
  await import("../src/exhibition-schema.js");
assert.equal(openingText().title, "THE DOUGLASS EXHIBITION");
assert.equal(
  openingText().task,
  "Create one connected museum-style exhibition that answers the question:",
);
assert.equal(
  openingText().question,
  "How does Douglass move from having his life controlled by others to controlling his own story?",
);
assert.equal(
  openingText({ "opening-slide.title": "Class title" }).title,
  "Class title",
);
assert.equal(openingText({ "opening-slide.task": "" }).task, "");
assert.equal(CARDS.length, 37);
for (const f of OPENING_CARD.fields)
  assert.ok(FIELD_BY_ID[`opening-slide.${f.key}`]);
const THREE = await import("three");
const { pickBoard } = await import("../src/board-interaction.js");
const testScene = new THREE.Scene(),
  group = new THREE.Group();
const board = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial(),
);
board.position.z = -3;
board.userData.exhibitionSlot = "r2-stage-1";
board.userData.exhibitionRoom = 2;
group.add(board);
testScene.add(group);
testScene.updateMatrixWorld(true);
const ray = new THREE.Raycaster(
  new THREE.Vector3(),
  new THREE.Vector3(0, 0, -1),
);
assert.equal(pickBoard(ray, testScene, 2), "r2-stage-1");
assert.equal(pickBoard(ray, testScene, 1), null);
group.visible = false;
assert.equal(pickBoard(ray, testScene, 2), null);
group.visible = true;
const wall = new THREE.Mesh(
  new THREE.PlaneGeometry(3, 3),
  new THREE.MeshBasicMaterial(),
);
wall.position.z = -2;
testScene.add(wall);
testScene.updateMatrixWorld(true);
assert.equal(
  pickBoard(ray, testScene, 2),
  null,
  "A board behind a wall cannot be clicked",
);
wall.material.transparent = true;
wall.material.opacity = 0.2;
assert.equal(
  pickBoard(ray, testScene, 2),
  "r2-stage-1",
  "Transparent glazing does not block a board",
);
console.log(
  "PASS: verbatim opening defaults, shared editable opening fields, direct board picking and wall occlusion.",
);

const { isBoardVisible } = await import("../src/exhibition-schema.js");
const { graphicsProfile } = await import("../src/graphics-settings.js");
const { previewMessage } = await import("../src/developer-preview.js");
for (const card of CARDS) {
  const writing = Object.fromEntries(
    card.fields
      .filter((f) => f.type !== "image")
      .map((f) => [`${card.id}.${f.key}`, "Writing to preserve"]),
  );
  const hidden = { ...writing, [`${card.id}.visibility`]: "hidden" };
  assert.equal(isBoardVisible(card.id, hidden), false);
  assert.ok(
    !presentationEntries(card.room, hidden).some((c) => c.id === card.id),
  );
  assert.equal(presentationEntryHTML(card.id, hidden), "");
  assert.ok(
    !compositionHTML(card.room, hidden).includes(
      `data-open-entry="${card.id}"`,
    ),
  );
  assert.ok(
    compositionHTML(card.room, hidden, {
      field: (id, key) => `<input data-field="${id}.${key}">`,
    }).includes(`${card.id}.title`),
    "Removed writing stays editable",
  );
  assert.equal(hidden[`${card.id}.title`], "Writing to preserve");
  assert.equal(
    isBoardVisible(card.id, { ...hidden, [`${card.id}.visibility`]: "shown" }),
    true,
  );
}
assert.equal(
  isBoardVisible("r3-claim-1", { "r3-pair-1.visibility": "hidden" }),
  false,
);
assert.equal(
  isBoardVisible("r3-action-1", { "r3-pair-1.visibility": "hidden" }),
  false,
);
assert.equal(
  isBoardVisible("r4-artifact-1", { "r4-stage-1.visibility": "hidden" }),
  false,
);
assert.equal(
  graphicsProfile("maximum", { degraded: true, touch: true }).id,
  "maximum",
  "Manual maximum never automatically downgrades",
);
assert.equal(graphicsProfile("auto", { degraded: true }).id, "low");
assert.equal(
  graphicsProfile("maximum", { maxTextureSize: 2048 }).shadows,
  2048,
);
assert.equal(graphicsProfile("low").bloom, false);
assert.equal(graphicsProfile("low").shadows, 0);
assert.equal(previewMessage({ type: "wrong" }), null);
assert.equal(
  previewMessage({ type: "douglass-preview", card: "invalid", values: {} }),
  null,
);
const safePreview = previewMessage({
  type: "douglass-preview",
  card: "r2-stage-1",
  slot: "r1-symbol",
  quality: "maximum",
  values: {
    "r2-stage-1.analysis": "Live draft",
    "r2-stage-1.visibility": "hidden",
    token: "not content",
    "r2-stage-1.freedom": "bad",
  },
});
assert.equal(safePreview.slot, "r2-stage-1");
assert.deepEqual(safePreview.values, {
  "r2-stage-1.analysis": "Live draft",
  "r2-stage-1.visibility": "hidden",
});
console.log(
  "PASS: every board removal clears presentation links, retains editable writing, hides aliases; device presets respect explicit choices; live preview validates content.",
);
