export const shoreline = (x) =>
  -55 + Math.sin(x * 0.035) * 3.5 + Math.sin(x * 0.083) * 1.5;
export const farShore = (x) => -178 + Math.sin(x * 0.023) * 5;
export const isLand = (x, z, margin = 0) =>
  z >= shoreline(x) + margin || z <= farShore(x) - margin;
export function pointClear(x, z, colliders) {
  return !colliders.some(
    (c) => c.enabled !== false && x > c.x1 && x < c.x2 && z > c.z1 && z < c.z2,
  );
}
export function segmentClear(a, b, colliders) {
  // Intersect the entire segment with each open rectangle: sampling can miss a narrow corner.
  for (const c of colliders) {
    if (c.enabled === false) continue;
    let enter = 0,
      exit = 1,
      miss = false;
    for (const [axis, min, max] of [
      [0, c.x1, c.x2],
      [1, c.z1, c.z2],
    ]) {
      const delta = b[axis] - a[axis];
      if (Math.abs(delta) < 1e-12) {
        if (a[axis] <= min || a[axis] >= max) {
          miss = true;
          break;
        }
      } else {
        const t1 = (min - a[axis]) / delta,
          t2 = (max - a[axis]) / delta;
        enter = Math.max(enter, Math.min(t1, t2));
        exit = Math.min(exit, Math.max(t1, t2));
        if (enter >= exit) {
          miss = true;
          break;
        }
      }
    }
    if (!miss && exit > 0 && enter < 1) return false;
  }
  return true;
}
// A bounded A* route is used only for ground-level camera movement through the museum.
export function routeBetween(start, end, colliders) {
  if (segmentClear(start, end, colliders)) return [end];
  if (!pointClear(...start, colliders) || !pointClear(...end, colliders))
    return null;
  const cell = 0.4,
    minX = Math.min(-13, Math.floor(Math.min(start[0], end[0])) - 4),
    minZ = Math.min(-22, Math.floor(Math.min(start[1], end[1])) - 4),
    maxX = Math.max(13, Math.ceil(Math.max(start[0], end[0])) + 4),
    maxZ = Math.max(27, Math.ceil(Math.max(start[1], end[1])) + 4);
  const width = Math.round((maxX - minX) / cell) + 1;
  const toGrid = (p) => [
    Math.round((p[0] - minX) / cell),
    Math.round((p[1] - minZ) / cell),
  ];
  const position = (x, z) => [minX + x * cell, minZ + z * cell],
    key = (x, z) => z * width + x;
  const nearest = (p) => {
    const [gx, gz] = toGrid(p);
    let best = null,
      dist = Infinity;
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        const q = position(gx + dx, gz + dz),
          d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (d < dist && segmentClear(p, q, colliders)) {
          dist = d;
          best = [gx + dx, gz + dz];
        }
      }
    return best;
  };
  const from = nearest(start),
    to = nearest(end);
  if (!from || !to) return null;
  const goal = key(...to),
    first = key(...from),
    open = [{ x: from[0], z: from[1], g: 0, f: 0, k: first }],
    best = new Map([[first, 0]]),
    parent = new Map(),
    nodes = new Map([[first, from]]);
  let count = 0;
  while (open.length && count++ < 18000) {
    open.sort((a, b) => b.f - a.f);
    const n = open.pop();
    if (n.k === goal) {
      let k = goal,
        path = [end];
      while (k !== first) {
        const q = nodes.get(k);
        path.push(position(...q));
        k = parent.get(k);
      }
      path.push(position(...from), start);
      path.reverse();
      const simplified = [path[0]];
      let i = 0;
      while (i < path.length - 1) {
        let j = path.length - 1;
        while (j > i + 1 && !segmentClear(path[i], path[j], colliders)) j--;
        simplified.push(path[j]);
        i = j;
      }
      return simplified.slice(1);
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const x = n.x + dx,
        z = n.z + dz,
        p = position(x, z);
      if (
        p[0] < minX ||
        p[0] > maxX ||
        p[1] < minZ ||
        p[1] > maxZ ||
        !segmentClear(position(n.x, n.z), p, colliders)
      )
        continue;
      const k = key(x, z),
        g = n.g + Math.hypot(dx, dz);
      if (g >= (best.get(k) ?? Infinity)) continue;
      best.set(k, g);
      parent.set(k, n.k);
      nodes.set(k, [x, z]);
      open.push({ x, z, g, f: g + Math.hypot(to[0] - x, to[1] - z), k });
    }
  }
  return null;
}
export function moveWithCollisions(
  start,
  delta,
  colliders,
  allowed = () => true,
) {
  const steps = Math.max(1, Math.ceil(Math.hypot(...delta) / 0.1));
  let [x, z] = start;
  for (let i = 0; i < steps; i++) {
    const nx = x + delta[0] / steps,
      nz = z + delta[1] / steps;
    if (pointClear(nx, z, colliders) && allowed(nx, z)) x = nx;
    if (pointClear(x, nz, colliders) && allowed(x, nz)) z = nz;
  }
  return [x, z];
}
