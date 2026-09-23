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
