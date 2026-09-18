import * as THREE from "three";

// Separate deterministic surface noise keeps the landscape's seed unchanged.
function grain(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}
function noise(x, y) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const u = x - ix,
    v = y - iy;
  const a = u * u * (3 - 2 * u),
    b = v * v * (3 - 2 * v);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(grain(ix, iy), grain(ix + 1, iy), a),
    THREE.MathUtils.lerp(grain(ix, iy + 1), grain(ix + 1, iy + 1), a),
    b,
  );
}
export function createForgedIron() {
  const size = 256,
    color = new Uint8Array(size * size * 4),
    relief = new Uint8Array(color.length);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const mottling = noise(x / 21, y / 17),
        fine = grain(x, y);
      const rust = Math.max(0, noise(x / 38, y / 29) - 0.54) * 2.3;
      const steel = 72 + mottling * 46 + fine * 13;
      color[i] = steel + rust * 16;
      color[i + 1] = steel + 3 - rust * 39;
      color[i + 2] = steel + 5 - rust * 57;
      color[i + 3] = relief[i + 3] = 255;
      const pit = fine > 0.93 ? 38 : 112 + noise(x / 3, y / 3) * 64;
      relief[i] = relief[i + 1] = relief[i + 2] = pit;
    }
  const makeTexture = (pixels) => {
    const texture = new THREE.DataTexture(pixels, size, size);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  };
  const map = makeTexture(color),
    bumpMap = makeTexture(relief);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.0018,
    roughness: 0.68,
    metalness: 0.78,
  });
}

class OvalLink extends THREE.Curve {
  getPoint(t, out = new THREE.Vector3()) {
    const a = t * Math.PI * 2;
    return out.set(0.142 * Math.cos(a), 0.078 * Math.sin(a), 0);
  }
}
const linkGeometry = new THREE.TubeGeometry(
  new OvalLink(),
  64,
  0.022,
  12,
  true,
);
// Very slight forging irregularity, rather than perfectly machined rings.
const positions = linkGeometry.attributes.position;
for (let i = 0; i < positions.count; i++) {
  const x = positions.getX(i),
    y = positions.getY(i),
    z = positions.getZ(i);
  const variation = 1 + 0.013 * Math.sin(Math.atan2(y / 0.078, x / 0.142) * 7);
  positions.setXYZ(i, x * variation, y * variation, z * variation);
}
linkGeometry.computeVertexNormals();

export function forgedChain(
  material,
  { x, surface, z, count = 8, scale = 1, yaw = 0 },
) {
  const group = new THREE.Group();
  group.position.set(x, surface, z);
  group.scale.setScalar(scale);
  group.rotation.y = yaw;
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(linkGeometry, material);
    // Alternating planes pass through each other's openings. Each link's
    // lowest vertex sits on the table, with no hovering or buried iron.
    mesh.rotation.x =
      ((i % 2 ? -1 : 1) * Math.PI) / 4 + Math.sin(i * 0.9) * 0.045;
    mesh.rotation.y = -0.07 * Math.cos(i * 0.5);
    mesh.updateMatrix();
    let bottom = Infinity;
    const vertex = new THREE.Vector3();
    for (let j = 0; j < positions.count; j++) {
      vertex.fromBufferAttribute(positions, j).applyMatrix4(mesh.matrix);
      bottom = Math.min(bottom, vertex.y);
    }
    mesh.position.set(i * 0.213, -bottom + 0.001, 0.029 * Math.sin(i * 0.5));
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function forgedCuff(material, x, surface, z) {
  const group = new THREE.Group();
  group.position.set(x, surface, z);
  const band = new THREE.Shape();
  const start = 0.35,
    end = Math.PI * 2 - 0.35;
  band.absarc(0, 0, 0.205, start, end, false);
  band.lineTo(Math.cos(end) * 0.166, Math.sin(end) * 0.166);
  band.absarc(0, 0, 0.166, end, start, true);
  band.closePath();
  const geometry = new THREE.ExtrudeGeometry(band, {
    depth: 0.064,
    bevelEnabled: true,
    bevelSize: 0.004,
    bevelThickness: 0.004,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 48,
  });
  geometry.translate(0, 0, -0.032);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0.037;
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  // Hinge barrel and peened pin heads distinguish a forged restraint from a ring.
  const hinge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.031, 0.031, 0.078, 16),
    material,
  );
  hinge.position.set(-0.205, 0.043, 0);
  hinge.castShadow = true;
  group.add(hinge);
  for (const zOffset of [-0.063, 0.063]) {
    const rivet = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 12, 8),
      material,
    );
    rivet.scale.y = 0.45;
    rivet.position.set(-0.174, 0.075, zOffset);
    rivet.castShadow = true;
    group.add(rivet);
  }
  return group;
}
