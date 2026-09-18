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

const { createCameraJourney, advanceCameraJourney, viewRotation } =
  await import("../src/camera-journey.js");
const { views, roomJourney } = await import("../src/museum-views.js");
const galleryViews = [1, 2, 3, 4, 5].map((id) => views[id]);
const routeTo = (p, view) =>
  roomJourney(new THREE.Vector3(...p), galleryViews.indexOf(view) + 1);
let transitions = 0,
  interruptions = 0;
function verifyJourney(journey) {
  assert.ok(journey, "A continuous route must exist");
  let steps = 0;
  while (!journey.done && steps++ < 1800) {
    const before = journey.position.clone(),
      rotation = journey.rotation.clone();
    advanceCameraJourney(journey, 1 / 60);
    assert.ok(
      journey.position.distanceTo(before) < 0.12,
      "Camera position must not jump",
    );
    assert.ok(
      rotation.angleTo(journey.rotation) <= 1.5 / 60 + 0.0011,
      "Camera cannot snap its direction",
    );
    assert.ok(
      pointClear(journey.position.x, journey.position.z, world.colliders),
      "Rounded route must avoid furniture and walls",
    );
    assert.equal(
      journey.fade,
      0,
      "Ordinary navigation must never use a flash or fade",
    );
  }
  assert.ok(journey.done, "Camera must settle into its final view");
  transitions++;
}
for (const a of galleryViews)
  for (const b of galleryViews) {
    const rotation = viewRotation(a.p, a.t),
      journey = createCameraJourney(
        a.p,
        rotation,
        routeTo(a.p, b),
        world.colliders,
        {
          duration: 3.8,
        },
      );
    verifyJourney(journey);
    assert.ok(journey.position.distanceTo(new THREE.Vector3(...b.p)) < 0.0001);
    assert.ok(journey.rotation.angleTo(viewRotation(b.p, b.t)) < 0.0001);
    // Interrupt midway and choose another room from the camera's current position.
    const partial = createCameraJourney(
      a.p,
      rotation,
      routeTo(a.p, b),
      world.colliders,
      {
        duration: 3.8,
      },
    );
    for (let n = 0; n < 80; n++) advanceCameraJourney(partial, 1 / 60);
    for (const c of galleryViews) {
      const next = createCameraJourney(
        partial.position,
        partial.rotation,
        routeTo(partial.position.toArray(), c),
        world.colliders,
        { duration: 3.8 },
      );
      assert.ok(next.position.equals(partial.position));
      assert.ok(next.rotation.equals(partial.rotation));
      verifyJourney(next);
      interruptions++;
    }
  }
const reduced = createCameraJourney(
  galleryViews[0].p,
  viewRotation(galleryViews[0].p, galleryViews[0].t),
  [galleryViews[4]],
  world.colliders,
  { reduced: true },
);
let last = reduced.position.clone();
for (let i = 0; i < 45; i++) {
  advanceCameraJourney(reduced, 1 / 60);
  if (!last.equals(reduced.position))
    assert.equal(
      reduced.fade,
      1,
      "Reduced-motion relocation must be fully covered",
    );
  last.copy(reduced.position);
}
assert.ok(reduced.done);
assert.equal(reduced.fade, 0);
console.log(
  `PASS: ${transitions} continuous camera journeys including ${interruptions} mid-flight changes; bounded rotation, collision-free curves, exact endpoints, no normal-navigation fades.`,
);

// Independently raycast the rendered geometry: collider-only tests missed
// exhibit frames protruding into the doorway between the last galleries.
scene.updateMatrixWorld(true);
const solids = [];
for (const group of [world.house, world.exhibits])
  group.traverse((mesh) => {
    if (mesh.isMesh && !mesh.material.transparent) {
      mesh.material.side = THREE.DoubleSide;
      solids.push(mesh);
    }
  });
const offsets = [
  [0, 0, 0],
  [-0.125, -0.051, -0.08],
  [0.125, -0.051, -0.08],
  [-0.125, 0.051, -0.08],
  [0.125, 0.051, -0.08],
].map((p) => new THREE.Vector3(...p));
for (const [from, to] of [
  [3, 4],
  [4, 5],
  [5, 4],
  [4, 3],
]) {
  const start = views[from];
  const journey = createCameraJourney(
    start.p,
    viewRotation(start.p, start.t),
    routeTo(start.p, views[to]),
    world.colliders,
    { duration: 3.2 },
  );
  let previous = offsets.map((o) =>
    o.clone().applyQuaternion(journey.rotation).add(journey.position),
  );
  let n = 0;
  while (!journey.done && n++ < 1000) {
    advanceCameraJourney(journey, 1 / 60);
    const next = offsets.map((o) =>
      o.clone().applyQuaternion(journey.rotation).add(journey.position),
    );
    next.forEach((p, i) => {
      const delta = p.clone().sub(previous[i]),
        distance = delta.length();
      if (distance < 1e-7) return;
      const ray = new THREE.Raycaster(
        previous[i],
        delta.normalize(),
        0,
        distance,
      );
      const hit = ray.intersectObjects(solids, false)[0];
      assert.ok(
        !hit,
        `${from}→${to}: camera or near plane crossed actual mesh at ${hit?.point.toArray()}`,
      );
    });
    previous = next;
  }
  assert.ok(journey.done);
}
// Closing an artifact follows one rotation directly back to the gallery,
// even if translation moves backwards relative to the current view.
for (const view of galleryViews) {
  const destination = new THREE.Vector3(...view.p),
    target = new THREE.Vector3(...view.t);
  const closeup = destination.clone().lerp(target, 0.1);
  const startQ = viewRotation(
    closeup,
    target.clone().add(new THREE.Vector3(0.45, 0, 0)),
  );
  const journey = createCameraJourney(
    closeup,
    startQ,
    [view],
    world.colliders,
    { duration: 1.2 },
  );
  assert.ok(journey);
  let remaining = startQ.angleTo(journey.endQ),
    n = 0;
  while (!journey.done && n++ < 400) {
    advanceCameraJourney(journey, 1 / 60);
    const angle = journey.rotation.angleTo(journey.endQ);
    assert.ok(
      angle <= remaining + 1e-7,
      "Artifact close must not pan away before returning",
    );
    remaining = angle;
  }
  assert.ok(journey.done);
}
const entrance = createCameraJourney(
  views[0].p,
  viewRotation(views[0].p, views[0].t),
  roomJourney(new THREE.Vector3(...views[0].p), 1),
  world.colliders,
  { duration: 6 },
);
assert.equal(
  entrance.duration,
  6,
  "Preserve the original six-second entrance pacing",
);
advanceCameraJourney(entrance, 30);
assert.ok(
  entrance.elapsed <= 0.055,
  "A delayed frame cannot skip an entire animation",
);
console.log(
  "PASS: III↔IV and IV↔V camera/near-plane sweeps clear actual rendered meshes; artifact exits never pan away; original entrance timing retained without flash.",
);
const { verifyAnimals } = await import("./animals.mjs");
verifyAnimals(world, solids);
