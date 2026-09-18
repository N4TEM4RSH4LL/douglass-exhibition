export const views = {
  0: { p: [26, 12, 47], t: [0, 2, -2] },
  1: { p: [-3.15, 2.3, 6.7], t: [-7, 1.85, 6.2] },
  2: { p: [3.05, 2.5, 6.8], t: [7.3, 1.65, 6.4] },
  3: { p: [3.15, 2.4, -3.6], t: [7.1, 2.03, -5.1] },
  4: { p: [-3.15, 2.4, -3.6], t: [-7.1, 1.9, -5.5] },
  5: { p: [0, 2.5, -12.2], t: [0, 2.1, -17.1] },
  overview: { p: [27, 35, 34], t: [0, 0.6, -4] },
};

// Keep the original entrance/hallway composition, using the actual position
// when someone changes destinations before the previous journey is finished.
export function roomJourney(position, destination) {
  const { x, y, z } = position;
  const points = [];
  const inside = y < 4.2 && z < 14 && z > -21 && Math.abs(x) < 11;
  const hallwayZ = Math.abs(x) < 1.5 ? z : z < -11 ? -12 : z > 1 ? 6.5 : -3.6;
  if (destination === 0) {
    if (inside) points.push({ p: [0, 2.13, hallwayZ], t: [0, 2, 14] });
    points.push({ p: [0, 2.1, 18.8], t: [0, 2, 9] }, views[0]);
  } else {
    if (!inside) {
      if (y >= 4.2) points.push({ p: [0, 2.4, 24], t: [0, 2.2, 9] });
      points.push({ p: [0, 2.15, 12], t: [0, 2.2, 0] });
    } else points.push({ p: [0, 2.13, hallwayZ], t: [0, 2, -8] });
    if (destination === 5) points.push({ p: [0, 2.13, -9], t: [0, 2, -17] });
    else {
      const hz = destination < 3 ? 6.5 : -3.6;
      points.push({
        p: [0, 2.13, hz],
        t: [destination === 1 || destination === 4 ? -7 : 7, 2, hz],
      });
    }
    points.push(views[destination]);
  }
  return points;
}
