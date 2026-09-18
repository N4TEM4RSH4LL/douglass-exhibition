import { Vector3, Quaternion, Matrix4, MathUtils } from "three";
import { routeBetween, segmentClear } from "./navigation.js";
const up = new Vector3(0, 1, 0);
const asVector = (p) => (p instanceof Vector3 ? p.clone() : new Vector3(...p));
const ease = (t) => t * t * (3 - 2 * t);
export function viewRotation(position, target) {
  return new Quaternion().setFromRotationMatrix(
    new Matrix4().lookAt(asVector(position), asVector(target), up),
  );
}
function clear(a, b, colliders) {
  return (
    a.y >= 4.2 || b.y >= 4.2 || segmentClear([a.x, a.z], [b.x, b.z], colliders)
  );
}
function roundCorners(points, colliders) {
  if (points.length < 3) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1],
      b = points[i],
      c = points[i + 1];
    let radius = Math.min(0.95, a.distanceTo(b) * 0.3, b.distanceTo(c) * 0.3),
      curve = null;
    for (
      let attempt = 0;
      attempt < 6 && radius > 0.015;
      attempt++, radius *= 0.5
    ) {
      const entry = b.clone().lerp(a, radius / b.distanceTo(a)),
        exit = b.clone().lerp(c, radius / b.distanceTo(c));
      const trial = [entry];
      for (let n = 1; n <= 16; n++) {
        const t = n / 16;
        trial.push(
          entry
            .clone()
            .multiplyScalar((1 - t) ** 2)
            .addScaledVector(b, 2 * t * (1 - t))
            .addScaledVector(exit, t * t),
        );
      }
      if (
        clear(out.at(-1), entry, colliders) &&
        trial.every((p, n) => !n || clear(trial[n - 1], p, colliders))
      ) {
        curve = trial;
        break;
      }
    }
    out.push(...(curve || [b]));
  }
  out.push(points.at(-1));
  return out;
}
export function createCameraJourney(
  position,
  rotation,
  views,
  colliders,
  { duration = 3.5, reduced = false } = {},
) {
  const points = [asVector(position)];
  for (const view of views) {
    const start = points.at(-1),
      end = asVector(view.p);
    if (start.distanceTo(end) < 0.001) continue;
    if (start.y < 4.2 && end.y < 4.2) {
      const route = routeBetween([start.x, start.z], [end.x, end.z], colliders);
      if (!route) return null;
      let distance = 0,
        previous = [start.x, start.z];
      const distances = route.map((p) => {
        distance += Math.hypot(p[0] - previous[0], p[1] - previous[1]);
        previous = p;
        return distance;
      });
      route.forEach(([x, z], i) => {
        const p = new Vector3(
          x,
          MathUtils.lerp(
            start.y,
            end.y,
            distance ? distances[i] / distance : 1,
          ),
          z,
        );
        if (p.distanceTo(points.at(-1)) > 0.001) points.push(p);
      });
    } else points.push(end);
  }
  const path = roundCorners(points, colliders),
    lengths = [0];
  for (let i = 1; i < path.length; i++)
    lengths.push(lengths.at(-1) + path[i].distanceTo(path[i - 1]));
  const length = lengths.at(-1),
    last = views.at(-1),
    endQ = viewRotation(last.p, last.t);
  return {
    path,
    lengths,
    length,
    position: asVector(position),
    rotation: rotation.clone(),
    startQ: rotation.clone(),
    endQ,
    elapsed: 0,
    duration: reduced
      ? 0.6
      : Math.max(
          duration,
          length / (points[0].y >= 4.2 || asVector(last.p).y >= 4.2 ? 7 : 3.5),
          rotation.angleTo(endQ) / 1.2,
        ),
    reduced,
    done: false,
    fade: 0,
  };
}
function pointAt(journey, distance) {
  const { path, lengths, length } = journey;
  if (!length) return path[0].clone();
  const d = MathUtils.clamp(distance, 0, length);
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < d) i++;
  return path[i - 1]
    .clone()
    .lerp(path[i], (d - lengths[i - 1]) / (lengths[i] - lengths[i - 1]));
}
export function advanceCameraJourney(journey, delta) {
  const dt = Math.min(Math.max(delta, 0), 0.055);
  journey.elapsed += dt;
  const progress = Math.min(1, journey.elapsed / journey.duration);
  if (journey.reduced) {
    journey.fade =
      progress < 0.4
        ? ease(progress / 0.4)
        : progress > 0.6
          ? 1 - ease((progress - 0.6) / 0.4)
          : 1;
    if (progress >= 0.5) {
      journey.position.copy(journey.path.at(-1));
      journey.rotation.copy(journey.endQ);
    }
    journey.done = progress === 1;
    return journey;
  }
  const distance = ease(progress) * journey.length;
  journey.position.copy(pointAt(journey, distance));
  let desired;
  if (journey.length < 0.05)
    desired = journey.startQ.clone().slerp(journey.endQ, ease(progress));
  else {
    const ahead = pointAt(journey, Math.min(journey.length, distance + 1.4));
    const behind = pointAt(journey, Math.max(0, distance - 0.4));
    const heading = ahead.sub(behind);
    const travel =
      heading.lengthSq() > 0.00001
        ? viewRotation(journey.position, journey.position.clone().add(heading))
        : journey.endQ;
    desired = journey.startQ
      .clone()
      .slerp(travel, ease(Math.min(1, progress / 0.2)))
      .slerp(
        journey.endQ,
        ease(MathUtils.clamp((progress - 0.58) / 0.42, 0, 1)),
      );
  }
  const angle = journey.rotation.angleTo(desired);
  journey.rotation.rotateTowards(
    desired,
    Math.min(1.5 * dt, angle * (1 - Math.exp(-7 * dt))),
  );
  if (progress === 1 && journey.rotation.angleTo(journey.endQ) < 0.001) {
    journey.rotation.copy(journey.endQ);
    journey.done = true;
  }
  return journey;
}
