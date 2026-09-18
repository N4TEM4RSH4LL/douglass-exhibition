import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createFlockSimulation,
  createDuckSimulation,
} from "../src/farm-animals.js";
import { isLand, pointClear, segmentClear } from "../src/navigation.js";

export function verifyAnimals(world, solids) {
  const flock = createFlockSimulation(world.colliders);
  const house = createDuckSimulation(world.colliders);
  const distances = flock.birds.map(() => 0);
  const behaviors = flock.birds.map(() => new Set());
  const rooms = new Set();
  let duckDistance = 0;
  const duckBehaviors = new Set();
  assert.equal(flock.birds.length, 7);
  assert.equal(
    world.duck.root.parent.children.filter((o) => o.name === "The house duck")
      .length,
    1,
  );
  // Ten minutes of independent foraging and a full museum circuit. Assertions
  // use the built world's obstacles, not an empty fixture or a mocked route.
  for (let frame = 0; frame < 18000; frame++) {
    const before = flock.birds.map((b) => [b.x, b.z]);
    const previousDuck = [house.duck.x, house.duck.z];
    flock.update(1 / 30);
    house.update(1 / 30);
    for (const [i, bird] of flock.birds.entries()) {
      const here = [bird.x, bird.z];
      const distance = Math.hypot(bird.x - before[i][0], bird.z - before[i][1]);
      assert.ok(distance < 0.03, "Chickens must not teleport");
      distances[i] += distance;
      behaviors[i].add(bird.state);
      assert.ok(
        bird.z > 20 && isLand(...here, 3),
        "Chickens stay in the outdoor yard, clear of the house and lake",
      );
      assert.ok(pointClear(...here, world.colliders));
      assert.ok(
        segmentClear(before[i], here, world.colliders),
        "Chickens cannot cross fences or tree trunks",
      );
      for (const other of flock.birds.slice(i + 1))
        assert.ok(
          Math.hypot(bird.x - other.x, bird.z - other.z) >
            bird.radius + other.radius,
          "The flock cannot phase through itself",
        );
    }
    const duck = house.duck,
      here = [duck.x, duck.z];
    const distance = Math.hypot(
      duck.x - previousDuck[0],
      duck.z - previousDuck[1],
    );
    duckDistance += distance;
    duckBehaviors.add(duck.state);
    assert.ok(distance < 0.016, "The duck must not teleport");
    assert.ok(
      Math.abs(duck.x) < 10.35 && duck.z > -20.35 && duck.z < 12.1,
      "The single duck must remain inside",
    );
    assert.ok(pointClear(...here, world.colliders));
    assert.ok(
      segmentClear(previousDuck, here, world.colliders),
      "The duck must use doorways",
    );
    if (duck.z < -11.5) rooms.add(5);
    else if (duck.z > 1.4 && Math.abs(duck.x) > 3)
      rooms.add(duck.x < 0 ? 1 : 2);
    else if (duck.z < -1 && duck.z > -10 && Math.abs(duck.x) > 3)
      rooms.add(duck.x > 0 ? 3 : 4);
    // The bill extends farther than the body. Check a conservative footprint
    // against the actual low-level furniture and wall meshes along the circuit.
    if (frame % 30 === 0) {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const ray = new THREE.Raycaster(
          new THREE.Vector3(duck.x, 0.72, duck.z),
          new THREE.Vector3(Math.sin(a), 0, Math.cos(a)),
          0,
          0.52,
        );
        const hit = ray.intersectObjects(solids, false)[0];
        assert.ok(
          !hit,
          `Duck footprint touches actual furniture at ${hit?.point.toArray()}`,
        );
      }
    }
  }
  distances.forEach((d) =>
    assert.ok(d > 20, "Every bird must wander independently"),
  );
  behaviors.forEach((b) =>
    assert.deepEqual([...b].sort(), ["idle", "peck", "walk"]),
  );
  assert.deepEqual(
    [...rooms].sort(),
    [1, 2, 3, 4, 5],
    "The duck should visit all five rooms",
  );
  assert.ok(duckDistance > 80);
  assert.deepEqual([...duckBehaviors].sort(), ["idle", "walk"]);

  // Visitors cause a pause without changing position, then the same route resumes.
  const visitorDuck = createDuckSimulation(world.colliders);
  for (let i = 0; i < 150; i++) visitorDuck.update(1 / 30);
  const pauseAt = [visitorDuck.duck.x, visitorDuck.duck.z];
  const visitor = { x: pauseAt[0], y: 2.1, z: pauseAt[1] };
  for (let i = 0; i < 90; i++) visitorDuck.update(1 / 30, visitor);
  assert.deepEqual([visitorDuck.duck.x, visitorDuck.duck.z], pauseAt);
  for (let i = 0; i < 90; i++) visitorDuck.update(1 / 30);
  assert.ok(
    Math.hypot(
      visitorDuck.duck.x - pauseAt[0],
      visitorDuck.duck.z - pauseAt[1],
    ) > 0.5,
  );
  const beforeDelay = [visitorDuck.duck.x, visitorDuck.duck.z];
  visitorDuck.update(60);
  assert.ok(
    Math.hypot(
      visitorDuck.duck.x - beforeDelay[0],
      visitorDuck.duck.z - beforeDelay[1],
    ) < 0.025,
  );
  visitorDuck.update(0);
  assert.ok(Number.isFinite(visitorDuck.duck.speed));

  const beforeReduced = [
    world.duck.duck.x,
    world.duck.duck.z,
    ...world.flock.birds.flatMap((b) => [b.x, b.z]),
  ];
  for (let i = 0; i < 300; i++) {
    world.duck.update(1 / 30, null, { reduced: true });
    world.flock.update(1 / 30, null, { reduced: true });
  }
  assert.deepEqual(
    [
      world.duck.duck.x,
      world.duck.duck.z,
      ...world.flock.birds.flatMap((b) => [b.x, b.z]),
    ],
    beforeReduced,
  );
  console.log(
    "PASS: ten minutes of chicken foraging, flock separation, one indoor duck visiting all five rooms without crossing walls or rendered furniture, visitor pauses, delayed frames and reduced motion.",
  );
}
