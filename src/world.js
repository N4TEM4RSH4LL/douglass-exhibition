import * as THREE from "three";
import { shoreline, farShore, isLand } from "./navigation.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

let seed = 4128;
export const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const PI = Math.PI;
export function createWorld(
  scene,
  {
    textureLoader = new THREE.TextureLoader(),
    assetBase = import.meta.env?.BASE_URL || "./",
  } = {},
) {
  const exterior = new THREE.Group(),
    house = new THREE.Group(),
    roof = new THREE.Group(),
    exhibits = new THREE.Group();
  scene.add(exterior, house, roof, exhibits);
  const displays = [],
    treePositions = [];
  const colliders = [],
    hotspots = [],
    flames = [],
    windMaterials = [];
  const mat = (c, r = 0.8, m = 0) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  function texture(kind, base) {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 14000; i++) {
      const v = random();
      ctx.fillStyle = `rgba(${v > 0.5 ? "255,242,211" : "15,10,5"},${random() * 0.075})`;
      let x = random() * 512,
        y = random() * 512;
      ctx.fillRect(
        x,
        y,
        kind === "wood" ? random() * 2 + 1 : random() * 3 + 1,
        kind === "wood" ? random() * 100 + 3 : random() * 3 + 1,
      );
    }
    if (kind === "wood") {
      for (let i = 0; i < 75; i++) {
        ctx.strokeStyle = `rgba(20,12,5,${random() * 0.15})`;
        ctx.lineWidth = random() * 1.2;
        ctx.beginPath();
        const x = random() * 512;
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(
          x + random() * 35,
          180,
          x - random() * 30,
          320,
          x + random() * 12,
          512,
        );
        ctx.stroke();
      }
    }
    if (kind === "brick") {
      for (let y = 0; y < 512; y += 42) {
        ctx.fillStyle = "#b3a183";
        ctx.fillRect(0, y, 512, 3);
        for (let x = ((y / 42) % 2) * 60; x < 512; x += 120) {
          ctx.fillRect(x, y, 3, 42);
          ctx.fillStyle = `rgba(35,21,13,${random() * 0.25})`;
          ctx.fillRect(x + 3, y + 3, 117, 39);
          ctx.fillStyle = "#b3a183";
        }
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }
  const loader = textureLoader;
  function loadTexture(name, color = true, repeat = 1) {
    const t = loader.load(assetBase + "textures/" + name + ".jpg");
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 8;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const woodMap = loadTexture("wood-color"),
    woodNormal = loadTexture("wood-normal", false),
    plasterMap = loadTexture("plaster-color"),
    brickMap = texture("brick", "#735348");
  const wood = new THREE.MeshStandardMaterial({
    map: woodMap,
    normalMap: woodNormal,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.78,
  });
  const darkwood = new THREE.MeshStandardMaterial({
    map: woodMap,
    normalMap: woodNormal,
    color: "#645640",
    roughness: 0.7,
  });
  const trim = mat("#bdb7a0"),
    pale = mat("#d0c8ad"),
    black = mat("#18211c"),
    iron = mat("#302c26", 0.45, 0.78),
    brass = mat("#a88749", 0.32, 0.75),
    paper = mat("#ac9874", 0.95),
    stone = mat("#777569");
  const plaster = new THREE.MeshStandardMaterial({
    map: plasterMap,
    normalMap: loadTexture("plaster-normal", false),
    roughness: 0.95,
  });
  const brick = new THREE.MeshStandardMaterial({
    map: brickMap,
    roughness: 0.9,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#d6ebdc",
    transparent: true,
    opacity: 0.1,
    roughness: 0.06,
    metalness: 0.15,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glow = new THREE.MeshBasicMaterial({
    color: "#ffd28a",
    toneMapped: false,
  });
  function box(w, h, d, x, y, z, m = wood, parent = house, collision = false) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    if (m === wood || m === darkwood) {
      const uv = geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const face = Math.floor(i / 4);
        const sw = face < 2 ? d : w,
          sh = face < 2 ? h : face < 4 ? d : h;
        uv.setXY(i, (uv.getX(i) * sw) / 2.8, (uv.getY(i) * sh) / 2.8);
      }
    }
    const o = new THREE.Mesh(geometry, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    if (collision)
      colliders.push({
        x1: x - w / 2 - 0.24,
        x2: x + w / 2 + 0.24,
        z1: z - d / 2 - 0.24,
        z2: z + d / 2 + 0.24,
      });
    return o;
  }
  function cyl(rt, rb, h, x, y, z, m = wood, parent = house, n = 16) {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, n), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function sphere(r, x, y, z, m, parent = house, detail = 1) {
    const o = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    parent.add(o);
    return o;
  }
  function beam(a, b, r, m = wood, parent = house) {
    const v1 = new THREE.Vector3(...a),
      v2 = new THREE.Vector3(...b);
    const o = cyl(r, r, v1.distanceTo(v2), 0, 0, 0, m, parent, 8);
    o.position.copy(v1).add(v2).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      v2.sub(v1).normalize(),
    );
    return o;
  }
  function line(points, m = brass, r = 0.018, parent = exhibits) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
    );
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        Math.max(8, points.length * 8),
        r,
        6,
        false,
      ),
      m,
    );
    parent.add(mesh);
    return mesh;
  }
  const grassMat = new THREE.MeshStandardMaterial({
      map: loadTexture("grass-color", true, 80),
      normalMap: loadTexture("grass-normal", false, 80),
      color: "#929b79",
      roughness: 1,
    }),
    dirt = new THREE.MeshStandardMaterial({
      map: loadTexture("earth-color", true, 12),
      color: "#c0ac85",
      roughness: 1,
    }),
    fieldMat = mat("#63563a"),
    leafMaterials = ["#344831", "#465637", "#56623a", "#62683b", "#768044"].map(
      (c) => mat(c),
    );
  // The landscape is a deliberately interpretive Eastern Shore setting, not a surveyed reconstruction.
  const groundGeometry = new THREE.PlaneGeometry(480, 480, 120, 120);
  groundGeometry.rotateX(-PI / 2);
  const groundPos = groundGeometry.attributes.position;
  for (let i = 0; i < groundPos.count; i++) {
    const x = groundPos.getX(i),
      z = groundPos.getZ(i);
    const near = shoreline(x),
      far = farShore(x);
    let y = -0.1;
    if (z < near && z > far)
      y = -0.1 - Math.min(1, Math.min(near - z, z - far) / 3) * 1.3;
    groundPos.setY(i, y);
  }
  groundGeometry.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeometry, grassMat);
  ground.receiveShadow = true;
  exterior.add(ground);
  box(7, 0.055, 78, 0, -0.03, 51, dirt, exterior);
  box(33, 0.058, 11, 0, -0.02, 19, dirt, exterior);
  box(24, 0.06, 34, -30, -0.015, 5, dirt, exterior);
  box(46, 0.045, 88, 48, -0.015, 7, fieldMat, exterior);
  const waterNormal = new THREE.DataTexture(
    new Uint8Array(128 * 128 * 4),
    128,
    128,
    THREE.RGBAFormat,
  );
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 4;
      waterNormal.image.data[i] = 128 + Math.sin(x * 0.62 + y * 0.15) * 22;
      waterNormal.image.data[i + 1] = 128 + Math.cos(y * 0.72 - x * 0.2) * 18;
      waterNormal.image.data[i + 2] = 252;
      waterNormal.image.data[i + 3] = 255;
    }
  waterNormal.wrapS = waterNormal.wrapT = THREE.RepeatWrapping;
  waterNormal.repeat.set(55, 22);
  waterNormal.needsUpdate = true;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 155, 100, 50),
    new THREE.MeshStandardMaterial({
      color: "#517f89",
      roughness: 0.17,
      metalness: 0.62,
      normalMap: waterNormal,
      normalScale: new THREE.Vector2(0.35, 0.35),
    }),
  );
  water.rotation.x = -PI / 2;
  water.position.set(0, -0.31, -121.5);
  water.userData.dynamic = true;
  exterior.add(water);
  // Hundreds of reeds and stalks share one draw call each.
  function vegetation(count, kind) {
    const geo =
      kind === "grain"
        ? mergeGeometries([
            new THREE.ConeGeometry(0.055, 0.24, 5).translate(0, 0.35, 0),
            new THREE.CylinderGeometry(0.011, 0.014, 0.62, 3),
          ])
        : new THREE.PlaneGeometry(0.07, 0.44, 1, 3);
    if (kind !== "grain") {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++)
        p.setX(i, p.getX(i) * (1 - (p.getY(i) + 0.22) / 0.46));
    }
    const material = mat(kind === "grain" ? "#b3a36a" : "#738052");
    material.side = THREE.DoubleSide;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      windMaterials.push(shader);
      shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n float windPhase = instanceMatrix[3].x * 0.19 + instanceMatrix[3].z * 0.14;\n transformed.x += sin(uTime * 1.4 + windPhase) * 0.09 * (position.y + 0.4);",
      );
    };
    const inst = new THREE.InstancedMesh(geo, material, count);
    const dummy = new THREE.Object3D();
    let placed = 0;
    while (placed < count) {
      let x, z;
      if (kind === "grain") {
        x = 28 + random() * 40;
        z = -35 + random() * 84;
      } else {
        x = (random() - 0.5) * 185;
        z = (random() - 0.5) * 170;
        if (
          !isLand(x, z, 2) ||
          (Math.abs(x) < 14 && z > -24 && z < 20) ||
          (Math.abs(x) < 5 && z > 10) ||
          (x > 24 && x < 73 && z > -40 && z < 54) ||
          (x < -17 && x > -42 && z > -15 && z < 30)
        )
          continue;
      }
      dummy.position.set(
        x,
        kind === "grain" ? 0.41 + random() * 0.13 : 0.19,
        z,
      );
      dummy.rotation.set(
        0,
        random() * PI,
        kind === "grain" ? (random() - 0.5) * 0.2 : 0,
      );
      dummy.scale.setScalar(0.65 + random() * 0.8);
      dummy.updateMatrix();
      inst.setMatrixAt(placed++, dummy.matrix);
    }
    inst.receiveShadow = true;
    exterior.add(inst);
  }
  vegetation(34000, "grass");
  vegetation(6200, "grain");
  for (let x = 28; x < 70; x += 2.1)
    box(0.13, 0.022, 89, x, 0.02, 7, mat("#8a7b4f"), exterior);
  // Tobacco leaves provide a second distinct agricultural texture near the field edge.
  const leafGeo = new THREE.SphereGeometry(1, 6, 4),
    tobacco = new THREE.InstancedMesh(leafGeo, mat("#586640"), 700);
  const td = new THREE.Object3D();
  let ti = 0;
  for (let x = 17; x < 26; x += 1.3)
    for (let z = -26; z < 27; z += 2.2) {
      for (let j = 0; j < 4; j++) {
        td.position.set(
          x + Math.cos((j * PI) / 2) * 0.23,
          0.35 + j * 0.13,
          z + Math.sin((j * PI) / 2) * 0.23,
        );
        td.scale.set(0.48, 0.055, 0.19);
        td.rotation.set(0.2, (j * PI) / 2, 0.3);
        td.updateMatrix();
        if (ti < 700) tobacco.setMatrixAt(ti++, td.matrix);
      }
    }
  tobacco.count = ti;
  exterior.add(tobacco);
  const foliage = [];
  const bark = mat("#4f4737");
  function tree(x, z, s = 1, detail = 100) {
    if (!isLand(x, z, 7)) return;
    treePositions.push([x, z]);
    if (z > -80)
      colliders.push({
        x1: x - 0.4 * s,
        x2: x + 0.4 * s,
        z1: z - 0.4 * s,
        z2: z + 0.4 * s,
      });
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    exterior.add(g);
    beam([0, 0, 0], [0.15, 7.4, 0], 0.31, bark, g);
    for (let j = 0; j < 11; j++) {
      const a = j * 2.4,
        rr = 1.4 + random() * 2.3,
        yy = 5.1 + random() * 3;
      beam(
        [0.07, 3.7, 0],
        [Math.cos(a) * rr, yy, Math.sin(a) * rr],
        0.085,
        bark,
        g,
      );
      const cx = Math.cos(a) * rr,
        cz = Math.sin(a) * rr;
      for (let k = 0; k < detail; k++) {
        const theta = random() * PI * 2,
          v = random() * 2 - 1,
          r = Math.pow(random(), 0.333) * 2.45;
        foliage.push({
          x: x + (cx + Math.sqrt(1 - v * v) * Math.cos(theta) * r) * s,
          y: (yy + 0.6 + v * r * 0.78) * s,
          z: z + (cz + Math.sqrt(1 - v * v) * Math.sin(theta) * r) * s,
          s: s * (0.34 + random() * 0.48),
        });
      }
    }
  }
  for (let i = 0; i < 46; i++) {
    let a = random() * PI * 2,
      r = 49 + random() * 50;
    tree(Math.cos(a) * r, Math.sin(a) * r - 3, 0.75 + random() * 0.7);
  }
  tree(-18, 24, 1.5);
  tree(30, 23, 1.25);
  tree(-18, -31, 1.7);
  tree(22, -32, 1.4);
  tree(-47, 4, 1.15);
  for (let x = -190; x <= 190; x += 12) {
    tree(x, farShore(x) - 12 - random() * 8, 0.85 + random() * 0.65, 40);
  }
  const leafCanvas = document.createElement("canvas");
  leafCanvas.width = 64;
  leafCanvas.height = 64;
  const lc = leafCanvas.getContext("2d");
  lc.fillStyle = "#e0e1b6";
  lc.beginPath();
  lc.moveTo(32, 3);
  lc.bezierCurveTo(60, 18, 60, 44, 32, 62);
  lc.bezierCurveTo(4, 44, 4, 18, 32, 3);
  lc.fill();
  lc.strokeStyle = "#697145";
  lc.lineWidth = 1;
  lc.beginPath();
  lc.moveTo(32, 5);
  lc.lineTo(32, 59);
  lc.stroke();
  const leafTex = new THREE.CanvasTexture(leafCanvas);
  leafTex.colorSpace = THREE.SRGBColorSpace;
  const foliageMat = new THREE.MeshStandardMaterial({
    map: leafTex,
    color: "#6c793e",
    side: THREE.DoubleSide,
    alphaTest: 0.5,
    roughness: 0.85,
  });
  foliageMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    windMaterials.push(shader);
    shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n transformed.x += sin(uTime * 1.3 + instanceMatrix[3].x * .3 + instanceMatrix[3].z * .2) * .11;",
    );
  };
  const leaves = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1.4),
    foliageMat,
    foliage.length,
  );
  const ld = new THREE.Object3D();
  const leafColor = new THREE.Color();
  foliage.forEach((f, i) => {
    ld.position.set(f.x, f.y, f.z);
    ld.rotation.set(random() * PI, random() * PI * 2, random() * PI);
    ld.scale.setScalar(f.s);
    ld.updateMatrix();
    leaves.setMatrixAt(i, ld.matrix);
    leafColor.setHSL(
      0.2 + random() * 0.04,
      0.24 + random() * 0.15,
      0.32 + random() * 0.24,
    );
    leaves.setColorAt(i, leafColor);
  });
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  exterior.add(leaves);
  function fence(x1, z1, x2, z2) {
    const n = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 3.3);
    for (let i = 0; i <= n; i++) {
      let t = i / n,
        x = x1 + (x2 - x1) * t,
        z = z1 + (z2 - z1) * t;
      box(0.17, 1.2, 0.17, x, 0.6, z, darkwood, exterior);
      if (i < n) {
        let nx = x1 + ((x2 - x1) * (i + 1)) / n,
          nz = z1 + ((z2 - z1) * (i + 1)) / n;
        beam([x, 0.5, z], [nx, 0.5, nz], 0.063, darkwood, exterior);
        beam([x, 0.99, z], [nx, 0.99, nz], 0.063, darkwood, exterior);
      }
    }
  }
  fence(15, 25, 76, 25);
  fence(16, -35, 16, 20);
  fence(-48, 28, -6, 28);
  fence(6, 76, 55, 76);
  fence(-55, 76, -6, 76);
  function pitchedRoof(x, z, w, d, y, m, parent) {
    const rise = w * 0.22,
      slant = Math.sqrt((w * w) / 4 + rise * rise);
    for (const side of [-1, 1]) {
      const ro = box(
        slant + 0.4,
        0.2,
        d + 0.7,
        x + (side * w) / 4,
        y + rise / 2,
        z,
        m,
        parent,
      );
      ro.rotation.z = -side * Math.atan2(rise, w / 2);
    }
    return rise;
  }
  const roofMat = new THREE.MeshStandardMaterial({
    map: loadTexture("roof-color", true, 4),
    normalMap: loadTexture("roof-normal", false, 4),
    color: "#767b72",
    roughness: 0.94,
  });
  function cabin(x, z, w = 6, d = 7) {
    colliders.push({
      x1: x - w / 2 - 0.3,
      x2: x + w / 2 + 0.3,
      z1: z - d / 2 - 0.3,
      z2: z + d / 2 + 0.3,
    });
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    exterior.add(g);
    box(w, 0.35, d, 0, 0.14, 0, stone, g);
    box(w, 2.8, d, 0, 1.7, 0, darkwood, g);
    for (let y = 0.4; y < 3.2; y += 0.22) {
      box(w + 0.03, 0.035, d + 0.03, 0, y, 0, wood, g);
    }
    box(1.2, 2.15, 0.04, 0, 1.4, d / 2 + 0.025, black, g);
    box(1, 1, 0.045, -w * 0.31, 2, d / 2 + 0.05, pale, g);
    box(0.045, 1, 0.07, -w * 0.31, 2, d / 2 + 0.09, wood, g);
    box(1, 0.045, 0.07, -w * 0.31, 2, d / 2 + 0.1, wood, g);
    pitchedRoof(0, 0, w, d, 3.15, roofMat, g);
    box(0.8, 2, 0.8, w * 0.3, 3.5, -1.8, brick, g);
  }
  cabin(-29, 3);
  cabin(-31, -9, 6, 8);
  cabin(-32, 18, 8, 11);
  function barrel(x, z) {
    colliders.push({ x1: x - 0.6, x2: x + 0.6, z1: z - 0.6, z2: z + 0.6 });
    const g = new THREE.Group();
    g.position.set(x, 0.02, z);
    exterior.add(g);
    cyl(0.35, 0.32, 0.98, 0, 0.49, 0, wood, g, 16);
    for (const y of [0.13, 0.5, 0.86]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.027, 6, 24),
        iron,
      );
      ring.rotation.x = PI / 2;
      ring.position.y = y;
      g.add(ring);
    }
    cyl(0.31, 0.31, 0.025, 0, 0.99, 0, darkwood, g, 16);
  }
  barrel(-25, 7);
  barrel(-25, 8);
  barrel(-11.8, -17);
  for (let i = 0; i < 16; i++) {
    const log = cyl(
      0.095,
      0.12,
      1.4,
      -24.5 + (i % 4) * 0.23,
      0.22 + Math.floor(i / 4) * 0.17,
      -9.4,
      wood,
      exterior,
      7,
    );
    log.rotation.x = PI / 2;
  }
  const cart = new THREE.Group();
  cart.position.set(-23, 0.03, 18);
  cart.rotation.y = 0.3;
  exterior.add(cart);
  box(2.2, 0.16, 3.4, 0, 0.8, 0, wood, cart);
  for (const side of [-1, 1]) {
    for (let y = 1; y < 1.55; y += 0.2)
      box(0.08, 0.16, 3.4, side * 1.08, y, 0, darkwood, cart);
    for (const z of [-1.2, 1.2]) {
      const wheel = new THREE.Mesh(
        new THREE.TorusGeometry(0.65, 0.065, 8, 24),
        iron,
      );
      wheel.rotation.y = PI / 2;
      wheel.position.set(side * 1.24, 0.65, z);
      cart.add(wheel);
      for (let i = 0; i < 8; i++)
        beam(
          [side * 1.24, 0.65, z],
          [
            side * 1.24,
            0.65 + Math.sin((i * PI) / 4) * 0.61,
            z + Math.cos((i * PI) / 4) * 0.61,
          ],
          0.027,
          wood,
          cart,
        );
    }
  }
  beam([-0.7, 0.7, 1.6], [-0.7, 0.45, 4.4], 0.055, wood, cart);
  beam([0.7, 0.7, 1.6], [0.7, 0.45, 4.4], 0.055, wood, cart);
  // Main house: low brick foundation, clapboard exterior, full open doorway and five rooms.
  box(22.5, 0.45, 34.5, 0, 0.04, -4, brick);
  box(22, 0.13, 34, 0, 0.31, -4, wood);
  for (let z = -20.8; z < 13; z += 0.43) {
    for (let x = -10.85; x < 11; x += 3.63) {
      const b = box(3.6, 0.045, 0.4, x + 1.72, 0.397, z, wood);
      if (random() > 0.6) b.material = darkwood;
    }
  }
  box(22.4, 0.5, 4.2, 0, 0.04, 15.1, brick);
  box(22.6, 0.13, 4.3, 0, 0.37, 15.1, wood);
  for (let i = 0; i < 3; i++)
    box(4.4, 0.16 * (3 - i), 0.58, 0, 0.08 * (3 - i), 17.45 + i * 0.57, stone);
  const wallColors = ["#3f4137", "#546763", "#555d4d", "#514c48", "#7a7b63"];
  const roomMats = wallColors.map(
    (c) =>
      new THREE.MeshStandardMaterial({
        color: c,
        map: plasterMap,
        roughness: 1,
      }),
  );
  function wall(w, d, x, z, m = plaster) {
    box(w, 4.4, d, x, 2.57, z, m, house, true);
    box(w + 0.02, 0.13, d + 0.03, x, 0.61, z, darkwood);
    box(w + 0.04, 0.12, d + 0.05, x, 4.65, z, darkwood);
  }
  function frontSegment(x, w) {
    wall(w, 0.35, x, 13);
  }
  for (const side of [-1, 1]) {
    for (const xx of [4.1, 8]) {
      const x = side * xx;
      box(2.3, 1.12, 0.35, x, 0.96, 13, plaster);
      box(2.3, 1.18, 0.35, x, 4.16, 13, plaster);
      box(2.15, 2.12, 0.035, x, 2.55, 13, glass);
      for (const yy of [1.46, 2.55, 3.67])
        box(2.5, 0.07, 0.48, x, yy, 13, trim);
      for (const dx of [-1.18, 0, 1.18])
        box(0.075, 2.3, 0.5, x + dx, 2.55, 13, trim);
      for (const dx of [-1.5, 1.5])
        box(0.46, 2.4, 0.09, x + dx, 2.55, 13.25, darkwood);
    }
    frontSegment(side * 2.4, 1.2);
    frontSegment(side * 6.05, 1.6);
    frontSegment(side * 10.075, 1.85);
  }
  box(3.6, 0.95, 0.35, 0, 4.29, 13, plaster);
  wall(22, 0.35, 0, -21);
  function windowSide(side, z) {
    const x = side * 11;
    wall(0.35, 1.45, x, z - 2.12);
    wall(0.35, 1.45, x, z + 2.12);
    box(0.35, 1.15, 2.8, x, 0.97, z, plaster);
    box(0.35, 1.15, 2.8, x, 4.17, z, plaster);
    box(0.06, 2.05, 2.62, x, 2.58, z, glass);
    for (const yy of [1.49, 2.55, 3.66]) box(0.52, 0.065, 2.91, x, yy, z, trim);
    for (const zz of [z - 1.4, z, z + 1.4])
      box(0.51, 2.24, 0.07, x, 2.57, zz, trim);
    for (const zz of [z - 1.9, z + 1.9]) {
      box(0.17, 2.5, 0.71, x + side * 0.28, 2.55, zz, darkwood);
      for (let y = 1.4; y < 3.8; y += 0.17)
        box(0.19, 0.04, 0.71, x + side * 0.34, y, zz, wood);
    }
  }
  for (const side of [-1, 1]) {
    for (const z of [10, 4, -2, -8, -14]) windowSide(side, z);
    for (const z of [7, 1, -5, -11]) wall(0.35, 0.34, side * 11, z);
    wall(0.35, 4.2, side * 11, -18.9);
  }
  // Glazed windows still form a physical boundary for free walking.
  for (const side of [-1, 1])
    colliders.push({
      x1: side * 11 - 0.4,
      x2: side * 11 + 0.4,
      z1: -21.3,
      z2: 13.3,
    });
  colliders.push(
    { x1: -11.3, x2: -1.95, z1: 12.6, z2: 13.4 },
    { x1: 1.95, x2: 11.3, z1: 12.6, z2: 13.4 },
  );
  // Fill the small seams between the window bays and at the corners.
  for (const side of [-1, 1]) {
    wall(0.4, 0.5, side * 11, 12.85);
    wall(0.4, 0.5, side * 11, -20.8);
  }
  for (const x of [-2, 2]) {
    wall(0.23, 5.1, x, 10.45, roomMats[x < 0 ? 0 : 1]);
    wall(0.23, 7.3, x, 1.45, roomMats[x < 0 ? 0 : 1]);
    wall(0.23, 6, x, -8.0, roomMats[x < 0 ? 3 : 2]);
    for (const z of [6.5, -3.6]) {
      box(0.3, 0.87, 2.65, x, 4.28, z, darkwood);
      for (const dz of [-1.4, 1.4])
        box(0.37, 3.4, 0.13, x, 2.11, z + dz, darkwood);
    }
  }
  for (const x of [-6.5, 6.5]) wall(9, 0.23, x, 1, roomMats[x < 0 ? 3 : 2]);
  wall(9, 0.24, -6.5, -11, roomMats[4]);
  wall(9, 0.24, 6.5, -11, roomMats[4]);
  box(4, 0.87, 0.24, 0, 4.27, -11, darkwood);
  // Wainscoting, timber beams and individual joists.
  for (const side of [-1, 1]) {
    box(0.12, 0.8, 33.5, side * 10.77, 0.88, -4, darkwood);
    for (let z = -20; z < 13; z += 1.05)
      box(0.16, 0.88, 0.055, side * 10.68, 0.9, z, wood);
  }
  for (let z = -20; z <= 13; z += 3.3) {
    box(22, 0.22, 0.21, 0, 4.61, z, darkwood);
  }
  for (const x of [-6.6, 0, 6.6]) box(0.2, 0.18, 33.8, x, 4.48, -4, darkwood);
  box(22.3, 0.16, 34.4, 0, 4.85, -4, darkwood, roof);
  pitchedRoof(0, -4, 23, 35, 4.96, roofMat, roof);
  for (let z = -21.5; z < 14; z += 0.7) {
    for (const side of [-1, 1]) {
      const seam = box(
        12.2,
        0.025,
        0.035,
        side * 5.75,
        7.49,
        z,
        mat("#373d37"),
        roof,
      );
      seam.rotation.z = -side * Math.atan(0.44);
    }
  }
  // Gable end triangles close the roof in the exterior view.
  for (const z of [-21.5, 13.5]) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [-11.6, 4.86, z, 11.6, 4.86, z, 0, 10.02, z],
        3,
      ),
    );
    geo.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2),
    );
    geo.computeVertexNormals();
    const g = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: "#beb9a2",
        side: THREE.DoubleSide,
      }),
    );
    roof.add(g);
  }
  for (const x of [-7.7, 7.7]) {
    box(1.2, 5.35, 1.55, x, 7.62, -7, brick, roof);
    box(1.5, 0.22, 1.8, x, 10.3, -7, stone, roof);
  }
  const atticWindow = new THREE.Mesh(new THREE.CircleGeometry(0.74, 40), black);
  atticWindow.position.set(0, 7.2, 13.54);
  roof.add(atticWindow);
  const atticRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.77, 0.055, 8, 48),
    trim,
  );
  atticRing.position.set(0, 7.2, 13.57);
  roof.add(atticRing);
  box(0.055, 1.43, 0.08, 0, 7.2, 13.6, trim, roof);
  box(1.43, 0.055, 0.08, 0, 7.2, 13.6, trim, roof);
  for (let yy = 4.95; yy < 9.8; yy += 0.19) {
    const width = ((10.02 - yy) / 5.06) * 23;
    box(width, 0.023, 0.025, 0, yy, 13.53, trim, roof);
  }
  colliders.push(
    { x1: -11.3, x2: -1.9, z1: 16.45, z2: 17 },
    { x1: 1.9, x2: 11.3, z1: 16.45, z2: 17 },
    { x1: -11.4, x2: -10.8, z1: 13, z2: 17 },
    { x1: 10.8, x2: 11.4, z1: 13, z2: 17 },
    { x1: -24.7, x2: -21.3, z1: 15.5, z2: 22.8 },
  );
  // Full-length porch and its hand-built balustrade.
  for (const x of [-10, -6, 6, 10]) {
    box(0.2, 3.3, 0.22, x, 2.12, 16.6, trim);
    box(0.4, 0.16, 0.43, x, 0.56, 16.6, trim);
    box(0.36, 0.13, 0.38, x, 3.66, 16.6, trim);
  }
  const pr = box(23, 0.16, 5, 0, 4.0, 15.25, roofMat);
  pr.rotation.x = 0.13;
  for (const side of [-1, 1]) {
    box(8.4, 0.1, 0.13, side * 6.2, 1.48, 16.72, darkwood);
    box(8.4, 0.08, 0.13, side * 6.2, 0.63, 16.72, darkwood);
    for (let x = 2.1; x < 10.5; x += 0.4)
      box(0.065, 0.86, 0.065, side * x, 1.02, 16.72, trim);
  }
  for (const side of [-1, 1]) {
    const door = box(1.7, 3.3, 0.13, side * 1.82, 2.04, 12.55, darkwood);
    door.rotation.y = side * 0.55;
    colliders.push({
      x1: side * 1.82 - 0.99,
      x2: side * 1.82 + 0.99,
      z1: 11.86,
      z2: 13.24,
    });
    for (const y of [1.25, 2.8]) {
      const panel = box(1.2, 1.1, 0.05, side * 1.86, y, 12.69, wood);
      panel.rotation.y = side * 0.55;
    }
  }
  // Runner: a thin continuous brass line makes the connected exhibition legible without text.
  box(0.028, 0.009, 27.7, 0, 0.436, 2, brass, exhibits);
  for (const z of [6.5, -3.6, -11]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.33, 0.018, 6, 40),
      brass,
    );
    ring.rotation.x = PI / 2;
    ring.position.set(0, 0.448, z);
    exhibits.add(ring);
  }
  // Recessed fireplace and furnishings in the final room.
  box(3.8, 3.2, 0.42, 0, 2.0, -20.55, brick);
  box(2.2, 1.9, 0.47, 0, 1.36, -20.3, black);
  box(4.2, 0.22, 0.72, 0, 3.58, -20.25, darkwood);
  box(3.1, 0.15, 1.3, 0, 0.5, -20, stone);
  for (let j = 0; j < 5; j++) {
    const log = cyl(0.15, 0.15, 1.5, 0, 0.7, -20, wood, house);
    log.rotation.z = PI / 2;
    log.rotation.y = j * 0.5;
  }
  for (let j = 0; j < 5; j++) {
    const f = new THREE.Mesh(
      new THREE.ConeGeometry(0.13 + random() * 0.08, 0.5 + random() * 0.3, 5),
      new THREE.MeshBasicMaterial({
        color: j % 2 ? "#fba454" : "#e0c177",
        transparent: true,
        opacity: 0.55,
      }),
    );
    f.position.set((random() - 0.5) * 1.2, 0.96, -19.93);
    house.add(f);
    flames.push(f);
  }
  const firelight = new THREE.PointLight("#ffae5d", 6, 7, 1.6);
  firelight.position.set(0, 1, -19.1);
  scene.add(firelight);
  function lantern(x, y, z, parent = house) {
    box(0.3, 0.07, 0.3, x, y - 0.22, z, iron, parent);
    box(0.32, 0.055, 0.32, x, y + 0.28, z, iron, parent);
    for (const dx of [-0.13, 0.13])
      for (const dz of [-0.13, 0.13])
        box(0.025, 0.5, 0.025, x + dx, y, z + dz, iron, parent);
    cyl(0.047, 0.06, 0.2, x, y - 0.07, z, paper, parent);
    sphere(0.065, x, y + 0.07, z, glow, parent);
  }
  lantern(-2.7, 2.3, 13.35);
  lantern(2.7, 2.3, 13.35);
  for (const z of [9, -1, -10]) {
    beam([0, 4.6, z], [0, 3.8, z], 0.014, iron);
    lantern(0, 3.55, z);
    const light = new THREE.PointLight("#ffd49b", 7, 9, 1.6);
    light.position.set(0, 3.25, z);
    scene.add(light);
  }
  // Shared exhibit construction. Every screen maps to an assignment entry.
  function hotspot(id, room, x, y, z, type = "object") {
    hotspots.push({ id, room, position: new THREE.Vector3(x, y, z), type });
  }
  function panel(x, y, z, w, h, ry = 0, room = 0, id = "panel", color = paper) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    exhibits.add(g);
    box(w + 0.14, h + 0.14, 0.095, 0, 0, 0, darkwood, g);
    box(w, h, 0.025, 0, 0, 0.062, color, g);
    for (const xx of [-w / 2, w / 2])
      box(0.025, h + 0.035, 0.035, xx, 0, 0.08, brass, g);
    for (const yy of [-h / 2, h / 2])
      box(w + 0.025, 0.025, 0.035, 0, yy, 0.08, brass, g);
    if (room) {
      const material = new THREE.MeshBasicMaterial({
        color: "#ddd1b4",
        toneMapped: false,
      });
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(w - 0.065, h - 0.065),
        material,
      );
      screen.position.z = 0.088;
      screen.userData.dynamic = true;
      g.add(screen);
      displays.push({ id, material, width: w - 0.065, height: h - 0.065 });
    }
    if (room)
      hotspot(
        id,
        room,
        x + Math.sin(ry) * 0.1,
        y,
        z + Math.cos(ry) * 0.1,
        "analysis",
      );
    return g;
  }
  function plinth(x, z, w = 1.3, h = 1.2, d = 1.3) {
    box(w, h, d, x, 0.44 + h / 2, z, black, exhibits, true);
    box(w + 0.06, 0.065, d + 0.06, x, 0.44 + h, z, brass, exhibits);
    return 0.51 + h;
  }
  function caseBox(x, z, w, h, d, top) {
    box(w, h, d, x, top + h / 2, z, glass, exhibits);
    for (const xx of [-w / 2, w / 2])
      for (const zz of [-d / 2, d / 2])
        box(0.018, h, 0.018, x + xx, top + h / 2, z + zz, brass, exhibits);
    for (const side of [-1, 1]) {
      box(
        0.025,
        0.025,
        d + 0.025,
        x + (side * w) / 2,
        top + h,
        z,
        brass,
        exhibits,
      );
      box(
        w + 0.025,
        0.025,
        0.025,
        x,
        top + h,
        z + (side * d) / 2,
        brass,
        exhibits,
      );
    }
  }
  function chain(x, y, z, n = 8, scale = 1, parent = exhibits) {
    for (let i = 0; i < n; i++) {
      const link = new THREE.Mesh(
        new THREE.TorusGeometry(0.115 * scale, 0.032 * scale, 7, 16),
        iron,
      );
      link.position.set(x + i * 0.17 * scale, y + 0.012 * Math.sin(i), z);
      link.rotation.x = PI / 2 + (i % 2 ? 0.35 : -0.35);
      parent.add(link);
    }
  }
  function book(x, y, z, s = 1, open = false, parent = exhibits) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    parent.add(g);
    if (open) {
      for (const side of [-1, 1]) {
        const p = box(0.59, 0.085, 0.76, side * 0.28, 0, 0, paper, g);
        p.rotation.z = side * 0.12;
        const c = box(0.61, 0.045, 0.79, side * 0.28, -0.07, 0, darkwood, g);
        c.rotation.z = side * 0.12;
      }
      box(0.06, 0.07, 0.8, 0, -0.018, 0, brass, g);
    } else {
      box(0.66, 0.11, 0.88, 0, 0.05, 0, paper, g);
      box(0.71, 0.035, 0.92, 0, 0.125, 0, darkwood, g);
      box(0.71, 0.035, 0.92, 0, -0.024, 0, darkwood, g);
      box(0.04, 0.16, 0.92, -0.345, 0.05, 0, darkwood, g);
    }
    return g;
  }
  function compass(x, y, z, s = 1) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    exhibits.add(g);
    cyl(0.24, 0.26, 0.09, 0, 0, 0, brass, g, 32);
    cyl(0.205, 0.205, 0.013, 0, 0.05, 0, paper, g, 32);
    for (let j = 0; j < 8; j++) {
      const a = (j * PI) / 4;
      beam(
        [Math.sin(a) * 0.16, 0.065, Math.cos(a) * 0.16],
        [Math.sin(a) * 0.19, 0.065, Math.cos(a) * 0.19],
        0.007,
        iron,
        g,
      );
    }
    const needle = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.3, 3), iron);
    needle.position.y = 0.08;
    needle.rotation.x = PI / 2;
    g.add(needle);
  }
  function quill(x, y, z, s = 1) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    exhibits.add(g);
    beam([0, 0, 0], [0.42, 0.94, 0], 0.012, brass, g);
    const shape = new THREE.Shape();
    shape.moveTo(0.08, 0.18);
    shape.bezierCurveTo(-0.13, 0.72, 0.22, 1.26, 0.49, 1.4);
    shape.bezierCurveTo(0.65, 1.05, 0.62, 0.56, 0.08, 0.18);
    const f = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshStandardMaterial({
        color: "#e5ddbe",
        side: THREE.DoubleSide,
        roughness: 0.9,
      }),
    );
    g.add(f);
    for (let j = 1; j < 9; j++)
      beam(
        [0.1 + j * 0.032, 0.23 + j * 0.1, 0.008],
        [0.01 + j * 0.029, 0.4 + j * 0.09, 0.008],
        0.004,
        brass,
        g,
      );
  }
  function bench(x, z, rot = 0) {
    const bw = Math.abs(Math.cos(rot)) * 1.25 + Math.abs(Math.sin(rot)) * 0.31,
      bd = Math.abs(Math.cos(rot)) * 0.31 + Math.abs(Math.sin(rot)) * 1.25;
    colliders.push({
      x1: x - bw - 0.2,
      x2: x + bw + 0.2,
      z1: z - bd - 0.2,
      z2: z + bd + 0.2,
    });
    const g = new THREE.Group();
    g.position.set(x, 0.43, z);
    g.rotation.y = rot;
    exhibits.add(g);
    box(2.5, 0.12, 0.62, 0, 0.47, 0, wood, g);
    for (const xx of [-0.95, 0.95]) box(0.1, 0.47, 0.46, xx, 0.22, 0, iron, g);
  }
  function roomLight(x, z, color) {
    const light = new THREE.SpotLight(color, 105, 15, 0.65, 0.7, 1.65);
    light.position.set(x, 4.35, z + 1.3);
    light.target.position.set(x, 1, z);
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    light.shadow.bias = -0.0004;
    scene.add(light, light.target);
    cyl(0.12, 0.16, 0.24, x, 4.35, z + 1.3, black, exhibits);
    const fill = new THREE.PointLight(color, 10, 12, 1.8);
    fill.position.set(x, 3, z);
    scene.add(fill);
  }
  // I — central empty identity space, four control spokes and a broken chain.
  const r1 = [-6.5, 7];
  box(8.3, 0.018, 9.8, -6.5, 0.43, 6.8, mat("#35362f"), exhibits);
  const top1 = plinth(-6.5, 6.4, 1.65, 1.08, 1.65);
  caseBox(-6.5, 6.4, 1.56, 0.78, 1.56, top1);
  chain(-7.03, top1 + 0.08, 6.58, 5);
  chain(-6.25, top1 + 0.08, 6.1, 3, 0.8);
  const cuff = new THREE.Mesh(
    new THREE.TorusGeometry(0.21, 0.048, 10, 27, PI * 1.7),
    iron,
  );
  cuff.rotation.x = PI / 2;
  cuff.position.set(-6.55, top1 + 0.15, 6.22);
  exhibits.add(cuff);
  hotspot("r1-symbol", 1, -6.5, 2.05, 6.4);
  const spokeLocations = [
    [-9.3, 8.7],
    [-9.3, 3.9],
    [-3.6, 8.7],
    [-3.6, 3.9],
  ];
  spokeLocations.forEach(([x, z], i) => {
    line(
      [
        [-6.5, 0.462, 6.4],
        [x, 0.462, 6.4],
        [x, 0.462, z],
      ],
      brass,
      0.012,
    );
    const h = plinth(x, z, 0.55, 0.8, 1.3);
    const p = panel(x, 1.85, z, 1.08, 1.05, 0, 1, `r1-control-${i + 1}`);
    p.rotation.x = -0.15;
    p.rotation.y = x < -6.5 ? PI / 2 : -PI / 2;
  });
  panel(-10.6, 2.57, 6.6, 2.5, 1.5, PI / 2, 1, "r1-turning-point");
  panel(-6.5, 2.7, 1.19, 3.4, 1.65, 0, 1, "r1-resistance");
  bench(-6.7, 11.35);
  roomLight(-6.5, 6.5, "#f5c88a");
  // II — five physical stages connected by a winding brass route.
  box(8.3, 0.018, 9.8, 6.5, 0.43, 6.8, mat("#455553"), exhibits);
  const journey = [
    [3.6, 9.4],
    [6.15, 9.15],
    [8.9, 7],
    [6.6, 4.5],
    [3.8, 3.6],
  ];
  line(
    journey.map(([x, z]) => [x, 0.467, z]),
    brass,
    0.026,
  );
  journey.forEach(([x, z], i) => {
    const h = plinth(x, z, 1.03, 0.85 + i * 0.08, 0.88);
    caseBox(x, z, 0.99, 0.56, 0.84, h);
    if (i === 0) {
      book(x, h + 0.06, z, 0.64);
    } else if (i === 1) {
      compass(x, h + 0.12, z, 0.85);
    } else if (i === 2) {
      box(0.62, 0.025, 0.43, x, h + 0.04, z, paper, exhibits);
      box(0.48, 0.022, 0.34, x + 0.09, h + 0.07, z - 0.02, paper, exhibits);
    } else if (i === 3) {
      const boat = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 12, 6, 0, PI * 2, 0, PI / 2),
        wood,
      );
      boat.rotation.x = PI;
      boat.scale.set(1, 0.45, 0.48);
      boat.position.set(x, h + 0.19, z);
      exhibits.add(boat);
      beam([x, h + 0.18, z], [x, h + 0.56, z], 0.012, brass, exhibits);
    } else {
      const key = new THREE.Mesh(
        new THREE.TorusGeometry(0.09, 0.022, 8, 16),
        brass,
      );
      key.rotation.x = PI / 2;
      key.position.set(x - 0.12, h + 0.1, z);
      exhibits.add(key);
      beam(
        [x - 0.03, h + 0.1, z],
        [x + 0.25, h + 0.1, z],
        0.025,
        brass,
        exhibits,
      );
      box(0.055, 0.025, 0.13, x + 0.22, h + 0.1, z + 0.04, brass, exhibits);
    }
    const label = panel(
      x,
      h - 0.23,
      z + 0.5,
      0.86,
      0.36,
      0,
      2,
      `r2-stage-${i + 1}`,
    );
  });
  panel(10.57, 2.55, 6.4, 3.3, 1.55, -PI / 2, 2, "r2-internal-freedom");
  panel(6.4, 2.55, 1.2, 3.4, 1.6, 0, 2, "r2-connection");
  roomLight(6.4, 6.3, "#d8e9dd");
  // III — opposing triptychs and a split lectern. Six empty evidence panels, three pairs.
  box(8.3, 0.018, 11.5, 6.5, 0.43, -5, mat("#484737"), exhibits);
  for (let i = 0; i < 3; i++) {
    const z = -8.6 + i * 3.25;
    panel(10.57, 2.6, z, 2.25, 2.2, -PI / 2, 3, `r3-claim-${i + 1}`, pale);
    panel(
      2.23,
      2.6,
      z,
      2.25,
      2.2,
      PI / 2,
      3,
      `r3-action-${i + 1}`,
      mat("#625f4f"),
    );
    line(
      [
        [2.45, 0.46, z],
        [10.25, 0.46, z],
      ],
      brass,
      0.012,
    );
  }
  const rt = plinth(6.5, -5.3, 2.2, 1.06, 1.25);
  book(6.08, rt + 0.16, -5.25, 0.8, true);
  chain(6.5, rt + 0.1, -5.2, 7, 0.8);
  hotspot("r3-contradiction", 3, 6.5, 2.18, -5.3);
  panel(6.6, 2.5, -10.78, 3.6, 1.5, 0, 3, "r3-analysis");
  roomLight(6.5, -5.2, "#efce92");
  bench(6.5, -0.3);
  // IV — a six-part archive with linked vitrines and blank portrait / interpretation panels.
  box(8.3, 0.018, 11.5, -6.5, 0.43, -5, mat("#4b4846"), exhibits);
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1,
      j = i % 3,
      x = side < 0 ? -9.1 : -3.9,
      z = -8.5 + j * 3.2,
      h = plinth(x, z, 1.35, 1.0, 1.05);
    caseBox(x, z, 1.3, 0.68, 1, h);
    const rotation = side < 0 ? PI / 2 : -PI / 2;
    panel(
      side < 0 ? -10.58 : -2.25,
      2.88,
      z,
      2,
      1.45,
      rotation,
      4,
      `r4-stage-${i + 1}`,
    );
    if (i === 0) {
      box(0.4, 0.32, 0.4, x, h + 0.16, z, wood, exhibits);
    } else if (i === 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.19, 0.03, 8, 24),
        brass,
      );
      ring.position.set(x, h + 0.26, z);
      exhibits.add(ring);
    } else if (i === 2) {
      book(x, h + 0.08, z, 0.65, true);
    } else if (i === 3) {
      chain(x - 0.38, h + 0.13, z, 3);
      chain(x + 0.21, h + 0.13, z - 0.14, 2);
    } else if (i === 4) {
      compass(x, h + 0.09, z, 0.8);
    } else {
      cyl(0.09, 0.12, 0.18, x, h + 0.09, z, iron, exhibits);
      quill(x, h + 0.17, z, 0.43);
    }
    hotspot(`r4-artifact-${i + 1}`, 4, x, h + 0.77, z);
  }
  line(
    [
      [-9.1, 0.468, -8.5],
      [-9.1, 0.468, -2.1],
      [-6.5, 0.468, -1.35],
      [-3.9, 0.468, -2.1],
      [-3.9, 0.468, -8.5],
    ],
    brass,
    0.02,
  );
  panel(-6.5, 2.65, -10.77, 3.5, 1.55, 0, 4, "r4-representation");
  roomLight(-6.5, -5.2, "#e1d5c7");
  // V — the author reclaims the desk. Eight blank quotation leaves encircle the room.
  box(20.8, 0.018, 8.8, 0, 0.43, -16.2, mat("#77785f"), exhibits);
  box(3.8, 0.16, 1.65, 0, 1.6, -16.4, wood, exhibits, true);
  for (const x of [-1.6, 1.6])
    for (const z of [-17, -15.85]) {
      box(0.13, 1.1, 0.13, x, 1, z, darkwood, exhibits);
      box(0.26, 0.1, 0.26, x, 0.48, z, darkwood, exhibits);
    }
  box(3.1, 0.34, 0.52, 0, 1.37, -15.86, darkwood, exhibits);
  for (const x of [-0.8, 0.8]) sphere(0.045, x, 1.37, -15.57, brass, exhibits);
  book(-0.45, 1.77, -16.3, 1.22, true);
  book(1.2, 1.78, -16.6, 0.6);
  book(1.21, 1.94, -16.58, 0.6);
  cyl(0.12, 0.16, 0.23, 0.65, 1.83, -16.2, iron, exhibits);
  quill(0.65, 1.95, -16.2, 0.7);
  box(0.65, 0.018, 0.84, 0.25, 1.7, -15.98, paper, exhibits);
  hotspot("r5-authors-desk", 5, 0, 2.3, -16.35);
  const chair = new THREE.Group();
  chair.position.set(0, 0.45, -17.65);
  exhibits.add(chair);
  box(0.85, 0.12, 0.7, 0, 0.63, 0, darkwood, chair);
  for (const x of [-0.34, 0.34])
    for (const z of [-0.24, 0.24])
      box(0.075, 0.6, 0.075, x, 0.3, z, wood, chair);
  box(0.87, 0.8, 0.1, 0, 1.08, -0.28, darkwood, chair);
  for (let x = -0.3; x <= 0.31; x += 0.15)
    box(0.045, 0.78, 0.06, x, 1.1, -0.35, wood, chair);
  for (const side of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const z = -13.3 - i * 1.85;
      panel(
        side * 10.55,
        2.6,
        z,
        1.28,
        1.9,
        (-side * PI) / 2,
        5,
        `r5-quotation-${side < 0 ? i + 1 : i + 5}`,
      );
    }
  panel(-5.6, 2.7, -20.72, 4.6, 1.9, 0, 5, "r5-curator-statement");
  panel(5.6, 2.7, -20.72, 4.6, 1.9, 0, 5, "r5-synthesis");
  bench(-5, -14.4);
  bench(5, -14.4);
  roomLight(0, -16, "#ffe1ac");
  // Blank suspended leaves: an architectural sculpture for the unwritten exhibition.
  for (let i = 0; i < 13; i++) {
    const a = i * 0.48,
      x = Math.sin(a) * 2.9,
      y = 3.2 + Math.cos(i * 0.55) * 0.5,
      z = -16.7 + Math.cos(a) * 1.25;
    const sheet = box(0.46, 0.012, 0.67, x, y, z, paper, exhibits);
    sheet.rotation.set(
      0.15 + random() * 0.3,
      random() * 0.6,
      0.1 + random() * 0.3,
    );
    beam([x, y + 0.06, z], [x, 4.5, z], 0.003, brass, exhibits);
  }
  // A modest jetty connects the agricultural landscape to the water.
  const dockStart = shoreline(-6) + 2;
  for (let z = dockStart; z > dockStart - 20; z -= 0.45)
    box(2.7, 0.12, 0.42, -6, 0.4, z, wood, exterior);
  for (const z of [dockStart, dockStart - 7, dockStart - 15, dockStart - 20])
    for (const x of [-7.5, -4.5])
      cyl(0.12, 0.15, 1.6, x, 0.22, z, darkwood, exterior);
  // Fine atmospheric dust, visible in raking window light.
  const positions = new Float32Array(700 * 3);
  for (let i = 0; i < 700; i++) {
    positions[i * 3] = (random() - 0.5) * 21;
    positions[i * 3 + 1] = 0.7 + random() * 3.7;
    positions[i * 3 + 2] = -20 + random() * 33;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: "#f4d8a6",
      size: 0.023,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(dust);
  // Merge static opaque meshes by material to keep the entire scene light enough for a browser.
  function mergeStatic(group) {
    group.updateMatrixWorld(true);
    const batches = new Map();
    const remove = [];
    group.traverse((o) => {
      if (
        !o.isMesh ||
        o.isInstancedMesh ||
        Array.isArray(o.material) ||
        o.material.transparent ||
        flames.includes(o) ||
        o.userData.dynamic
      )
        return;
      const key = o.material.uuid;
      const geo = o.geometry.index
        ? o.geometry.toNonIndexed()
        : o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);
      if (!batches.has(key))
        batches.set(key, { material: o.material, geometries: [] });
      batches.get(key).geometries.push(geo);
      remove.push(o);
    });
    remove.forEach((o) => o.removeFromParent());
    for (const { material, geometries } of batches.values()) {
      try {
        const geom = mergeGeometries(geometries, false);
        if (geom) {
          const merged = new THREE.Mesh(geom, material);
          merged.castShadow = true;
          merged.receiveShadow = true;
          group.add(merged);
        }
      } finally {
        geometries.forEach((g) => g.dispose());
      }
    }
  }
  mergeStatic(exterior);
  mergeStatic(house);
  mergeStatic(roof);
  mergeStatic(exhibits);
  return {
    displays,
    treePositions,
    waterNormal,
    exterior,
    house,
    roof,
    exhibits,
    colliders,
    hotspots,
    water,
    dust,
    flames,
    firelight,
    windMaterials,
  };
}
