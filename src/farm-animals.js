import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  isLand,
  pointClear,
  segmentClear,
  routeBetween,
} from "./navigation.js";

const TAU = Math.PI * 2;
const STARTS = [
  { x: 4.7, z: 26.7, scale: 1.08, coat: "rooster" },
  { x: 8.1, z: 22.6, scale: 0.91, coat: "buff" },
  { x: 10.8, z: 24.4, scale: 0.94, coat: "cream" },
  { x: -5.2, z: 23.8, scale: 0.9, coat: "brown" },
  { x: -8.5, z: 21.6, scale: 0.88, coat: "black" },
  { x: 8.8, z: 24, scale: 0.42, coat: "chick" },
  { x: 9.6, z: 23.5, scale: 0.39, coat: "chick" },
];
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Independent of the camera route and landscape seed. The simulation can be
// checked against the real fences, trees and buildings without a WebGL context.
export function createFlockSimulation(colliders, seed = 7391) {
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const birds = STARTS.map((start, i) => {
    const radius = 0.43 * start.scale;
    return {
      ...start,
      id: i,
      radius,
      home: [start.x, start.z],
      heading: random() * TAU,
      phase: random(),
      age: random() * 10,
      state: i % 2 ? "peck" : "idle",
      remaining: 0.7 + random() * 2.5,
      speed: 0,
      cruise: start.coat === "chick" ? 0.28 : 0.3 + random() * 0.17,
      target: null,
      obstacles: colliders.map((c) => ({
        x1: c.x1 - radius,
        x2: c.x2 + radius,
        z1: c.z1 - radius,
        z2: c.z2 + radius,
      })),
    };
  });
  function allowed(bird, x, z) {
    return (
      x > -18 &&
      x < 14 &&
      z > 20 &&
      z < 36 &&
      isLand(x, z, 3) &&
      pointClear(x, z, bird.obstacles)
    );
  }
  function apart(bird, x, z, extra = 0.04) {
    return birds.every(
      (other) =>
        other === bird ||
        Math.hypot(x - other.x, z - other.z) >
          bird.radius + other.radius + extra,
    );
  }
  function chooseTarget(bird, player, startled = false) {
    for (let attempt = 0; attempt < 32; attempt++) {
      const angle =
        startled && attempt < 20
          ? Math.atan2(bird.x - player.x, bird.z - player.z) +
            (random() - 0.5) * 1.3
          : random() * TAU;
      const distance = 1.1 + random() * (startled ? 2.4 : 2.8);
      let x = bird.x + Math.sin(angle) * distance,
        z = bird.z + Math.cos(angle) * distance;
      // Chicks forage near their hen, while adults stay loosely around the yard.
      const hen = birds[1];
      if (
        !startled &&
        bird.coat === "chick" &&
        Math.hypot(x - hen.x, z - hen.z) > 3.5
      ) {
        x = hen.x + (random() - 0.5) * 2.5;
        z = hen.z + (random() - 0.5) * 2.5;
      }
      if (
        !allowed(bird, x, z) ||
        !apart(bird, x, z, 0.15) ||
        !segmentClear([bird.x, bird.z], [x, z], bird.obstacles)
      )
        continue;
      bird.target = [x, z];
      bird.state = "walk";
      bird.remaining = 14;
      bird.startled = startled;
      return true;
    }
    bird.state = "idle";
    bird.remaining = 0.5 + random();
    bird.target = null;
    return false;
  }
  // In case a future prop occupies a spawn, find a clear nearby patch first.
  for (const bird of birds) {
    if (allowed(bird, bird.x, bird.z) && apart(bird, bird.x, bird.z)) continue;
    let placed = false;
    for (let i = 0; i < 200 && !placed; i++) {
      const x = bird.home[0] + (random() - 0.5) * 6,
        z = bird.home[1] + (random() - 0.5) * 6;
      if (allowed(bird, x, z) && apart(bird, x, z)) {
        bird.x = x;
        bird.z = z;
        placed = true;
      }
    }
    if (!placed) throw new Error("No clear ground for a chicken");
  }
  function update(delta, player = null) {
    const dt = Math.min(Math.max(delta, 0), 0.055);
    for (const bird of birds) {
      bird.age += dt;
      bird.remaining -= dt;
      bird.speed = 0;
      const nearPlayer =
        player &&
        player.y < 3.4 &&
        Math.hypot(bird.x - player.x, bird.z - player.z) < 1.65;
      if (nearPlayer && !bird.startled) chooseTarget(bird, player, true);
      if (bird.remaining <= 0) {
        if (bird.state === "walk") {
          bird.state = random() < 0.76 ? "peck" : "idle";
          bird.remaining = 1.7 + random() * 4;
          bird.target = null;
          bird.startled = false;
        } else chooseTarget(bird, player);
      }
      if (bird.state !== "walk" || !bird.target) continue;
      const dx = bird.target[0] - bird.x,
        dz = bird.target[1] - bird.z;
      const distance = Math.hypot(dx, dz),
        desired = Math.atan2(dx, dz);
      const angle = wrapAngle(desired - bird.heading);
      bird.heading += THREE.MathUtils.clamp(angle, -2.8 * dt, 2.8 * dt);
      const step = Math.min(
        distance,
        bird.cruise *
          (bird.startled ? 1.85 : 1) *
          dt *
          Math.max(0, Math.cos(angle)),
      );
      const nx = bird.x + Math.sin(bird.heading) * step,
        nz = bird.z + Math.cos(bird.heading) * step;
      if (
        allowed(bird, nx, nz) &&
        apart(bird, nx, nz) &&
        segmentClear([bird.x, bird.z], [nx, nz], bird.obstacles)
      ) {
        bird.x = nx;
        bird.z = nz;
        bird.speed = dt ? step / dt : 0;
        bird.phase = (bird.phase + (step / (0.24 * bird.scale)) * 0.6) % 1;
      } else {
        bird.remaining = 0;
      }
      if (distance < 0.09) bird.remaining = 0;
    }
  }
  return { birds, update, allowed };
}

export function yardHeight(x, z) {
  if (x >= -16.5 && x <= 16.5 && z >= 13.5 && z <= 24.5) return 0.009;
  if (Math.abs(x) <= 3.5 && z >= 12 && z <= 90) return -0.0025;
  return -0.1;
}

const sphereGeometry = new THREE.SphereGeometry(1, 12, 8);
const boneGeometry = new THREE.CylinderGeometry(0.011, 0.014, 1, 6);
const beakGeometry = new THREE.ConeGeometry(0.036, 0.105, 4);
const up = new THREE.Vector3(0, 1, 0);
const material = (color, roughness = 0.9) =>
  new THREE.MeshStandardMaterial({ color, roughness });
const red = material("#9d3028"),
  horn = material("#bb8c47"),
  eye = material("#171913", 0.25);
const cream = material("#dfd4b6"),
  dark = material("#28332e"),
  rust = material("#994f29");
const coats = {
  rooster: [rust, dark, material("#c49045")],
  buff: [material("#b7894f"), material("#785133"), material("#d5b577")],
  cream: [cream, material("#b6ac94"), cream],
  brown: [material("#885035"), material("#493a2c"), material("#ad7949")],
  black: [dark, material("#1d2421"), material("#5a6152")],
  chick: [material("#d8b96c"), material("#bda060"), material("#e7d18d")],
};
function oval(parent, mat, position, scale, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(sphereGeometry, mat);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function mergePart(group) {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert(),
    batches = new Map(),
    remove = [];
  group.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry.toNonIndexed();
    geometry.applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
    if (!batches.has(mesh.material)) batches.set(mesh.material, []);
    batches.get(mesh.material).push(geometry);
    remove.push(mesh);
  });
  remove.forEach((mesh) => mesh.removeFromParent());
  for (const [mat, geometries] of batches) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), mat);
    mesh.receiveShadow = true;
    group.add(mesh);
    geometries.forEach((g) => g.dispose());
  }
}
function makeChicken(bird) {
  const root = new THREE.Group(),
    body = new THREE.Group(),
    neck = new THREE.Group();
  const [plumage, feather, hackle] = coats[bird.coat],
    chick = bird.coat === "chick",
    rooster = bird.coat === "rooster";
  root.add(body, neck);
  root.scale.setScalar(bird.scale);
  oval(body, plumage, [0, 0.42, 0], [0.2, 0.235, 0.31]);
  oval(body, hackle, [0, 0.43, 0.19], [0.145, 0.2, 0.135]);
  for (const side of [-1, 1]) {
    oval(
      body,
      feather,
      [side * 0.165, 0.44, -0.055],
      [0.068, 0.16, 0.24],
      [0.25, 0, side * 0.08],
    );
    for (let j = 0; j < 6; j++)
      oval(
        body,
        j % 2 ? feather : plumage,
        [side * (0.185 + j * 0.002), 0.43 - j * 0.012, 0.03 - j * 0.045],
        [0.027, 0.1, 0.07],
        [-0.25, 0, side * 0.2],
      );
  }
  for (let j = 0; j < 5; j++)
    oval(
      body,
      feather,
      [(j - 2) * 0.04, 0.49 + (rooster ? 0.09 : 0), -0.27],
      [0.034, rooster ? 0.3 : 0.18, 0.061],
      [-0.85, (j - 2) * 0.13, (j - 2) * 0.12],
    );
  neck.position.set(0, 0.43, 0.15);
  oval(neck, hackle, [0, 0.09, 0], [0.085, 0.18, 0.098], [-0.25, 0, 0]);
  oval(neck, plumage, [0, 0.225, 0.085], [chick ? 0.098 : 0.078, 0.092, 0.098]);
  const beak = new THREE.Mesh(beakGeometry, horn);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.213, 0.218);
  neck.add(beak);
  for (const side of [-1, 1]) {
    oval(neck, eye, [side * 0.07, 0.247, 0.132], [0.012, 0.016, 0.013]);
    oval(neck, cream, [side * 0.077, 0.253, 0.136], [0.0035, 0.004, 0.004]);
    if (!chick)
      oval(neck, red, [side * 0.031, 0.132, 0.157], [0.024, 0.055, 0.017]);
  }
  if (!chick)
    for (let j = 0; j < 5; j++)
      oval(
        neck,
        red,
        [
          0,
          0.304 + Math.sin((j / 4) * Math.PI) * (rooster ? 0.045 : 0.021),
          0.025 + j * 0.033,
        ],
        [0.018, rooster ? 0.043 : 0.027, 0.023],
      );
  mergePart(body);
  mergePart(neck);
  const legs = [-1, 1].map((side) => {
    const upper = new THREE.Mesh(boneGeometry, horn),
      lower = new THREE.Mesh(boneGeometry, horn),
      foot = new THREE.Group();
    root.add(upper, lower, foot);
    for (const spread of [-1, 0, 1])
      oval(
        foot,
        horn,
        [spread * 0.021, 0.012, 0.038],
        [0.008, 0.009, 0.048],
        [0, spread * 0.45, 0],
      );
    oval(foot, horn, [0, 0.013, -0.028], [0.008, 0.009, 0.032]);
    mergePart(foot);
    return { side, upper, lower, foot };
  });
  return { root, body, neck, legs };
}
function groundShadowTexture() {
  const size = 64,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4,
        r = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5);
      data[i] = 20;
      data[i + 1] = 24;
      data[i + 2] = 16;
      data[i + 3] = Math.round(Math.max(0, 1 - r) ** 2 * 112);
    }
  const texture = new THREE.DataTexture(data, size, size);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}
export function createFarmFlock(scene, colliders) {
  const simulation = createFlockSimulation(colliders),
    group = new THREE.Group();
  group.name = "Wandering farm chickens";
  scene.add(group);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: groundShadowTexture(),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const models = simulation.birds.map((bird) => {
    const model = makeChicken(bird);
    group.add(model.root);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.78, 0.97),
      shadowMaterial,
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.setScalar(bird.scale);
    group.add(shadow);
    return { ...model, shadow };
  });
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    direction = new THREE.Vector3();
  function bone(mesh, from, to) {
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    direction.copy(to).sub(from);
    mesh.scale.y = direction.length();
    mesh.quaternion.setFromUnitVectors(up, direction.normalize());
  }
  function pose(bird, model, dt) {
    model.root.position.set(bird.x, yardHeight(bird.x, bird.z) + 0.004, bird.z);
    model.root.rotation.y = bird.heading;
    const moving = Math.min(1, bird.speed / 0.25),
      cycle = bird.phase * TAU;
    const peck =
      bird.state === "peck"
        ? Math.max(0, Math.sin(bird.age * 4.4 + bird.id)) ** 2
        : 0;
    const blend = 1 - Math.exp(-dt * 13);
    model.body.position.y = 0.009 * Math.sin(cycle * 2) * moving;
    model.body.rotation.z = 0.035 * Math.sin(cycle) * moving;
    model.neck.rotation.x = THREE.MathUtils.lerp(
      model.neck.rotation.x,
      peck * 1.45,
      blend,
    );
    model.neck.rotation.y = THREE.MathUtils.lerp(
      model.neck.rotation.y,
      bird.state === "idle" ? Math.sin(bird.age * 1.2) * 0.23 : 0,
      blend,
    );
    model.neck.position.y = 0.43 - peck * 0.15;
    model.neck.position.z = 0.15 + Math.sin(cycle) * 0.017 * moving;
    for (const leg of model.legs) {
      const phase = (bird.phase + (leg.side > 0 ? 0.5 : 0)) % 1;
      const swing = Math.max(0, (phase - 0.6) / 0.4);
      const z =
        (phase < 0.6 ? 0.12 - (phase / 0.6) * 0.24 : -0.12 + swing * 0.24) *
        moving;
      const lift = Math.sin(swing * Math.PI) * 0.075 * moving;
      leg.foot.position.lerp(b.set(leg.side * 0.105, lift, z), blend);
      const foot = leg.foot.position;
      a.set(leg.side * 0.1, 0.32, 0.0);
      b.set(leg.side * 0.105, 0.16 + lift * 0.35, foot.z * 0.4 - 0.04);
      bone(leg.upper, a, b);
      a.copy(b);
      b.set(foot.x, foot.y + 0.027, foot.z);
      bone(leg.lower, a, b);
    }
    model.shadow.position.set(
      bird.x,
      yardHeight(bird.x, bird.z) + 0.008,
      bird.z,
    );
    model.shadow.rotation.z = -bird.heading;
  }
  // Animals use moving contact shadows; they never get baked into the world's
  // intentionally frozen sun shadow map or force all foliage to redraw shadows.
  models.forEach((model, i) => pose(simulation.birds[i], model, 1));
  return {
    ...simulation,
    group,
    update(dt, player, { reduced = false } = {}) {
      if (reduced) return;
      simulation.update(dt, player);
      models.forEach((model, i) => pose(simulation.birds[i], model, dt));
    },
  };
}

const DUCK_STOPS = [
  [-7.7, 10.2],
  [0, 6.5],
  [4.3, 5.8],
  [0, -3.6],
  [4.3, -7],
  [0, -3.6],
  [-7.4, -5.6],
  [0, -9],
  [2.8, -13.4],
  [-2.7, -18.5],
  [0, -9],
  [-4.3, 5.4],
];
export function createDuckSimulation(colliders) {
  // Existing camera colliders include 24 cm of clearance. Reserve enough extra
  // space for the bill and tail to turn without entering an exhibit or doorframe.
  const obstacles = colliders.map((c) => ({
    x1: c.x1 - 0.3,
    x2: c.x2 + 0.3,
    z1: c.z1 - 0.3,
    z2: c.z2 + 0.3,
  }));
  const duck = {
    x: -4.3,
    z: 5.4,
    heading: 0.4,
    phase: 0,
    age: 0,
    speed: 0,
    state: "idle",
    remaining: 2.4,
    path: [],
    stop: 0,
  };
  const allowed = (x, z) =>
    Math.abs(x) < 10.35 &&
    z > -20.35 &&
    z < 12.1 &&
    pointClear(x, z, obstacles);
  function nextRoute() {
    for (let i = 0; i < DUCK_STOPS.length; i++) {
      const destination = DUCK_STOPS[duck.stop++ % DUCK_STOPS.length];
      if (!allowed(...destination)) continue;
      const path = routeBetween([duck.x, duck.z], destination, obstacles);
      if (!path || !path.every((p) => allowed(...p))) continue;
      duck.path = path;
      duck.state = "walk";
      return;
    }
    duck.state = "idle";
    duck.remaining = 2;
  }
  return {
    duck,
    allowed,
    update(delta, player = null) {
      const dt = Math.min(Math.max(delta, 0), 0.055);
      if (!dt) return;
      duck.age += dt;
      duck.speed = 0;
      if (duck.state === "idle") {
        duck.remaining -= dt;
        if (duck.remaining <= 0) nextRoute();
        else return;
      }
      if (!duck.path.length) {
        duck.state = "idle";
        duck.remaining = 2.5 + Math.sin(duck.age) * 1.1;
        return;
      }
      const target = duck.path[0],
        dx = target[0] - duck.x,
        dz = target[1] - duck.z,
        distance = Math.hypot(dx, dz);
      if (distance < 0.018) {
        duck.path.shift();
        return;
      }
      const heading = Math.atan2(dx, dz),
        angle = wrapAngle(heading - duck.heading);
      duck.heading += THREE.MathUtils.clamp(angle, -2.5 * dt, 2.5 * dt);
      // Turn in place before tight doorways, then stay on the checked route.
      if (Math.abs(angle) > 0.3) return;
      const step = Math.min(distance, 0.43 * dt),
        nx = duck.x + (dx / distance) * step,
        nz = duck.z + (dz / distance) * step;
      if (
        player &&
        player.y < 3.4 &&
        Math.hypot(nx - player.x, nz - player.z) < 0.7
      ) {
        // A visitor can pass. Retain the route instead of jumping out of the way.
        return;
      }
      if (
        !allowed(nx, nz) ||
        !segmentClear([duck.x, duck.z], [nx, nz], obstacles)
      ) {
        nextRoute();
        return;
      }
      duck.x = nx;
      duck.z = nz;
      duck.speed = step / dt;
      duck.phase = (duck.phase + (step / 0.19) * 0.6) % 1;
    },
  };
}

export function createHouseDuck(scene, colliders) {
  const simulation = createDuckSimulation(colliders),
    root = new THREE.Group(),
    body = new THREE.Group(),
    head = new THREE.Group();
  root.name = "The house duck";
  root.scale.setScalar(1.05);
  root.add(body, head);
  scene.add(root);
  const grey = material("#8d8c80"),
    chest = material("#654531"),
    green = material("#244e3f", 0.57),
    blue = material("#345666", 0.65),
    bill = material("#caa342"),
    feet = material("#b8793a");
  oval(body, grey, [0, 0.27, 0], [0.18, 0.165, 0.32]);
  oval(body, chest, [0, 0.29, 0.18], [0.145, 0.16, 0.15]);
  for (const side of [-1, 1]) {
    oval(
      body,
      grey,
      [side * 0.145, 0.3, -0.055],
      [0.07, 0.12, 0.24],
      [-0.13, 0, side * 0.12],
    );
    for (let j = 0; j < 6; j++)
      oval(
        body,
        j % 2 ? dark : grey,
        [side * 0.18, 0.275 - j * 0.003, -0.045 - j * 0.04],
        [0.014, 0.068, 0.09],
        [-0.5, 0, 0],
      );
    oval(
      body,
      cream,
      [side * 0.193, 0.319, -0.105],
      [0.013, 0.047, 0.096],
      [-0.5, 0, 0],
    );
    oval(
      body,
      blue,
      [side * 0.201, 0.32, -0.105],
      [0.013, 0.032, 0.078],
      [-0.5, 0, 0],
    );
  }
  oval(body, dark, [0, 0.31, -0.315], [0.088, 0.045, 0.12], [-0.25, 0, 0]);
  head.position.set(0, 0.33, 0.21);
  oval(head, green, [0, 0.045, 0], [0.052, 0.11, 0.065]);
  oval(head, cream, [0, 0.006, -0.003], [0.058, 0.019, 0.068]);
  oval(head, green, [0, 0.147, 0.044], [0.079, 0.086, 0.097]);
  oval(head, bill, [0, 0.124, 0.164], [0.055, 0.021, 0.108]);
  oval(head, dark, [0, 0.132, 0.265], [0.022, 0.008, 0.014]);
  for (const side of [-1, 1]) {
    oval(head, eye, [side * 0.069, 0.165, 0.085], [0.012, 0.014, 0.014]);
    oval(head, cream, [side * 0.077, 0.17, 0.09], [0.003, 0.003, 0.004]);
    oval(head, dark, [side * 0.028, 0.144, 0.164], [0.006, 0.003, 0.006]);
  }
  mergePart(body);
  mergePart(head);
  const footShape = new THREE.Shape();
  footShape.moveTo(0, -0.025);
  footShape.lineTo(-0.047, 0.077);
  footShape.lineTo(-0.021, 0.067);
  footShape.lineTo(0, 0.096);
  footShape.lineTo(0.024, 0.069);
  footShape.lineTo(0.05, 0.074);
  footShape.closePath();
  const footGeometry = new THREE.ExtrudeGeometry(footShape, {
    depth: 0.009,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 1,
  });
  footGeometry.rotateX(Math.PI / 2);
  footGeometry.translate(0, 0.015, 0);
  const legs = [-1, 1].map((side) => {
    const foot = new THREE.Mesh(footGeometry, feet),
      leg = new THREE.Mesh(boneGeometry, feet);
    root.add(foot, leg);
    return { side, foot, leg };
  });
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.75, 1),
    new THREE.MeshBasicMaterial({
      map: groundShadowTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
  const upper = new THREE.Vector3(),
    lower = new THREE.Vector3(),
    direction = new THREE.Vector3();
  function pose(dt) {
    const duck = simulation.duck,
      moving = Math.min(1, duck.speed / 0.3),
      cycle = duck.phase * TAU,
      blend = 1 - Math.exp(-dt * 14);
    root.position.set(duck.x, 0.426, duck.z);
    root.rotation.y = duck.heading;
    body.rotation.z = Math.sin(cycle) * 0.065 * moving;
    body.position.y = Math.sin(cycle * 2) * 0.005 * moving;
    head.position.z = 0.21 + Math.sin(cycle) * 0.012 * moving;
    head.rotation.y = THREE.MathUtils.lerp(
      head.rotation.y,
      duck.state === "idle" ? Math.sin(duck.age * 1.5) * 0.28 : 0,
      blend,
    );
    for (const { side, foot, leg } of legs) {
      const phase = (duck.phase + (side > 0 ? 0.5 : 0)) % 1,
        swing = Math.max(0, (phase - 0.6) / 0.4);
      const z =
        (phase < 0.6 ? 0.095 - (phase / 0.6) * 0.19 : -0.095 + swing * 0.19) *
        moving;
      foot.position.lerp(
        lower.set(side * 0.104, Math.sin(swing * Math.PI) * 0.052 * moving, z),
        blend,
      );
      upper.set(side * 0.095, 0.19, 0);
      lower.copy(foot.position);
      lower.y += 0.025;
      leg.position.copy(upper).add(lower).multiplyScalar(0.5);
      direction.copy(lower).sub(upper);
      leg.scale.y = direction.length();
      leg.quaternion.setFromUnitVectors(up, direction.normalize());
    }
    shadow.position.set(duck.x, 0.424, duck.z);
    shadow.rotation.z = -duck.heading;
  }
  pose(1);
  return {
    ...simulation,
    root,
    update(dt, player, { reduced = false } = {}) {
      if (reduced) return;
      simulation.update(dt, player);
      pose(dt);
    },
  };
}
