// Finite ground-level lee volume in a region's east/north frame.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HelixWindShelters = api;
})(globalThis, function () {
  'use strict';
  const axis = bearing => {
    const radians = bearing * Math.PI / 180;
    return { x: Math.sin(radians), y: Math.cos(radians) };
  };
  const valid = s => s && Number.isFinite(s.eastM) && Number.isFinite(s.northM)
    && ['ridgeCell', 'bearingDeg', 'lengthM', 'widthM', 'heightM', 'flowPermille'].every(k => Number.isSafeInteger(s[k]))
    && s.ridgeCell >= 0 && s.bearingDeg >= 0 && s.bearingDeg < 360
    && s.lengthM > 0 && s.widthM > 0 && s.heightM > 0 && s.flowPermille > 0 && s.flowPermille < 1000;
  function frame(s, a, p) {
    const east = p.eastM - s.eastM, north = p.northM - s.northM;
    return [east * a.x + north * a.y, -east * a.y + north * a.x, p.altitudeM];
  }
  const bounds = s => [[0, s.lengthM], [-s.widthM / 2, s.widthM / 2], [0, s.heightM]];
  const downwind = (w, a) => w && w.x * a.x + w.y * a.y > .7 * Math.hypot(w.x, w.y);
  const contains = (box, p) => box.every(([lo, hi], i) => p[i] >= lo && p[i] < hi);
  function at(wind, shelter, position) {
    if (!shelter || !position) return wind;
    const a = axis(shelter.bearingDeg);
    if (!downwind(wind, a) || !contains(bounds(shelter), frame(shelter, a, position))) return wind;
    return { x: wind.x * shelter.flowPermille / 1000, y: wind.y * shelter.flowPermille / 1000 };
  }
  function boundarySeconds(wind, s, p, velocity) {
    if (!s) return Infinity;
    const a = axis(s.bearingDeg);
    if (!downwind(wind, a)) return Infinity;
    const box = bounds(s), start = frame(s, a, p);
    const velocities = [velocity.x * a.x + velocity.y * a.y, -velocity.x * a.y + velocity.y * a.x, velocity.z || 0];
    let enter = -Infinity, exit = Infinity;
    for (let i = 0; i < box.length; i++) {
      const [lo, hi] = box[i], v = velocities[i], pos = start[i];
      if (Math.abs(v) < 1e-12) {
        if (pos < lo || pos >= hi) return Infinity;
        continue;
      }
      const t0 = (lo - pos) / v, t1 = (hi - pos) / v;
      enter = Math.max(enter, Math.min(t0, t1)); exit = Math.min(exit, Math.max(t0, t1));
    }
    if (exit < 0 || exit <= enter) return Infinity;
    // Settle just across the plane using elapsed motion. Sampling exactly on
    // a plane can replan the same crossing because of floating-point rounding.
    const inside = contains(box, start), crossing = inside ? exit : Math.max(0, enter);
    if (!inside && exit <= crossing + 1e-5) return Infinity;
    return crossing + 1e-5;
  }
  return { axis, valid, at, boundarySeconds };
});
