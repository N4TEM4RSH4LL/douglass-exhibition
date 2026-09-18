import assert from "node:assert/strict";
import {
  routeBetween,
  segmentClear,
  pointClear,
  moveWithCollisions,
  isLand,
  shoreline,
  farShore,
} from "../src/navigation.js";
// A wall with a doorway and a display cabinet in the direct line of travel.
const obstacles = [
  { x1: -2.35, x2: -1.65, z1: -10, z2: -1.4 },
  { x1: -2.35, x2: -1.65, z1: 1.4, z2: 10 },
  { x1: -7, x2: -5, z1: -1, z2: 1 },
];
for (const [a, b] of [
  [
    [0, 6],
    [-9, -6],
  ],
  [
    [-9, -6],
    [0, 6],
  ],
  [
    [-9, 0],
    [-3, 0],
  ],
]) {
  const path = routeBetween(a, b, obstacles);
  assert.ok(path, "A route through the doorway must exist");
  let previous = a;
  for (const p of path) {
    assert.ok(
      segmentClear(previous, p, obstacles),
      "No segment can cut through a wall or case",
    );
    previous = p;
  }
  assert.deepEqual(path.at(-1), b);
}
assert.equal(routeBetween([0, 0], [-6, 0], obstacles), null);
const moved = moveWithCollisions([0, 5], [-20, 0], obstacles);
assert.ok(pointClear(...moved, obstacles));
assert.ok(moved[0] > -1.66, "Fast movement must not tunnel through a wall");
for (let x = -200; x <= 200; x += 5) {
  assert.ok(isLand(x, shoreline(x) + 8, 7));
  assert.ok(isLand(x, farShore(x) - 8, 7));
  assert.ok(!isLand(x, (shoreline(x) + farShore(x)) / 2));
}
console.log(
  "PASS: doorway routes, cabinet avoidance, blocked destinations, movement tunnelling and shoreline classification.",
);

const THREE = await import("three");
const { createWorld } = await import("../src/world.js");
const { getDisplay, CARDS } = await import("../src/exhibition-schema.js");
// Texture drawing is irrelevant to collision geometry; use an inert canvas surface.
globalThis.document = {
  createElement: () => ({
    width: 512,
    height: 512,
    getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
  }),
};
const scene = new THREE.Scene(),
  world = createWorld(scene, {
    textureLoader: { load: () => new THREE.Texture() },
  });
assert.ok(world.treePositions.length > 40);
assert.ok(
  world.treePositions.every(([x, z]) => isLand(x, z, 7)),
  "All tree trunks must be on land",
);
assert.ok(world.displays.length >= 30);
assert.ok(
  world.displays.every((d) => getDisplay(d.id, {})),
  "Every 3D screen must have an editable assignment entry",
);
assert.ok(
  world.hotspots.every((h) => getDisplay(h.id, {})),
  "Every artifact must have an explanation entry",
);
const represented = new Set(
  world.hotspots.map((h) => getDisplay(h.id, {}).card.id),
);
assert.ok(
  CARDS.every((c) => represented.has(c.id)),
  "Every assignment entry must be reachable in 3D",
);
const viewpoints = [
  [0, 19],
  [-3.15, 6.7],
  [3.05, 6.8],
  [3.15, -3.6],
  [-3.15, -3.6],
  [0, -12.2],
];
for (const a of viewpoints)
  for (const b of viewpoints) {
    assert.ok(pointClear(...a, world.colliders));
    const path = routeBetween(a, b, world.colliders);
    assert.ok(path, `No museum route ${a} to ${b}`);
    let previous = a;
    for (const p of path) {
      assert.ok(segmentClear(previous, p, world.colliders));
      previous = p;
    }
  }
console.log(
  `PASS: actual world has ${world.treePositions.length} trees on land, all ${CARDS.length} entries mapped, all 36 gallery routes clear of built collision geometry.`,
);
