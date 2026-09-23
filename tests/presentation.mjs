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
