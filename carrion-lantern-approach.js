// Local sensory pursuit and weak, drag-limited propulsion. No food lookup here.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HelixCarrionLanternApproach = api;
})(globalThis, function () {
  'use strict';
  const ID = 'beast:carrion-lantern', WINDOW = 300, LOST = 12, RETRY = 300, REVIEW = 5;
  const copy = x => JSON.parse(JSON.stringify(x));
  const finite = n => Number.isFinite(n) && n >= 0;
  const point = p => p && ['eastM', 'northM', 'altitudeM'].every(k => Number.isFinite(p[k]));
  function stop(owner, at, reason) {
    if (!owner.carrionApproach) return;
    delete owner.carrionApproach;
    owner.carrionApproachOutcome = { at, reason };
    owner.carrionApproachCooldownUntil = at + (reason === 'arrived' ? 0 : RETRY);
  }
  function observe(owner, at, target, usable = true) {
    let a = owner.carrionApproach;
    if (a && (!usable || at >= a.deadlineAt || target?.id !== a.target.id && at >= a.lastSeenAt + LOST)) {
      stop(owner, at, !usable ? 'unable' : at >= a.deadlineAt ? 'timeBudgetSpent' : 'lostContact'); a = null;
    }
    if (!usable || !target || at < (owner.carrionApproachCooldownUntil || 0)) return a;
    // Keep the original target for this bounded pursuit; a different visible
    // meal cannot repeatedly reset the effort/time budget.
    if (a && a.target.id !== target.id) return a;
    if (!a) a = owner.carrionApproach = { startedAt: at, deadlineAt: at + WINDOW, lastSeenAt: at, target: copy(target) };
    else { a.lastSeenAt = at; a.target = copy(target); }
    return a;
  }
  function course(massKg, parts, wind, delta, cardinal = false, intercept = false) {
    if (!(massKg > 0) || !parts || !wind || ![wind.x, wind.y].every(Number.isFinite) || !point(delta)) return null;
    const integrity = Math.min(...['bladder', 'membrane', 'buoyancy organs'].map(k => (parts[k] || 0) / 100));
    if (integrity <= .4) return null;
    const length = Math.hypot(delta.eastM, delta.northM, delta.altitudeM);
    if (length < 1e-8) return null;
    const drag = .5 * 1.225 * 1.4 * 2 * (massKg / 30) ** (2 / 3);
    const maximumForceN = massKg * 9.81 * .0025 * integrity;
    const airSpeed = Math.sqrt(maximumForceN / drag);
    let requested = { x: delta.eastM / length * .25 - wind.x,
      y: delta.northM / length * .25 - wind.y, z: delta.altitudeM / length * .25 };
    const airflow = Math.hypot(wind.x, wind.y);
    if (intercept && airflow > airSpeed && Math.hypot(requested.x, requested.y, requested.z) > airSpeed) {
      // In uncancellable wind, spend force on an attainable intercept instead
      // of wasting it mostly braking toward an impossible .25 m/s course.
      const along = { x: wind.x / airflow, y: wind.y / airflow };
      const target = { x: delta.eastM / length, y: delta.northM / length, z: delta.altitudeM / length };
      const projection = target.x * along.x + target.y * along.y;
      if (projection > 0) {
        const side = { x: target.x - projection * along.x, y: target.y - projection * along.y, z: target.z };
        const lateral = Math.hypot(side.x, side.y, side.z), sine = airSpeed / airflow;
        const cosine = Math.sqrt(1 - sine ** 2);
        const q = lateral <= sine && projection >= cosine
          ? Math.max(.25, airflow * projection - Math.sqrt(Math.max(0, airSpeed ** 2 - (airflow * lateral) ** 2)))
          : airflow * cosine;
        const aim = lateral <= sine && projection >= cosine ? target : {
          x: along.x * cosine + side.x / lateral * sine,
          y: along.y * cosine + side.y / lateral * sine, z: side.z / lateral * sine
        };
        requested = { x: q * aim.x - wind.x, y: q * aim.y - wind.y, z: q * aim.z };
      }
    }
    const magnitude = Math.hypot(requested.x, requested.y, requested.z), scale = Math.min(1, airSpeed / Math.max(1e-12, magnitude));
    const raw = { x: wind.x + requested.x * scale, y: wind.y + requested.y * scale, z: requested.z * scale };
    const horizontal = Math.hypot(raw.x, raw.y), speed = Math.min(.5, horizontal);
    // Uncapped actual wind opposes thrust. Only the resulting ground velocity
    // is capped, without discarding its lateral component. The old projection
    // is used solely to validate already cached legacy regional segments.
    const velocity = cardinal ? Math.abs(raw.x) >= Math.abs(raw.y) ? { x: Math.sign(raw.x) * speed, y: 0, z: raw.z }
      : { x: 0, y: Math.sign(raw.y) * speed, z: raw.z }
      : { x: horizontal ? raw.x * speed / horizontal : 0, y: horizontal ? raw.y * speed / horizontal : 0,
        z: intercept && horizontal > speed ? raw.z * speed / horizontal : raw.z };
    const forceN = drag * Math.min(magnitude, airSpeed) ** 2;
    return { velocity, forceN, maximumForceN, effortRate: .1 * forceN / maximumForceN };
  }
  const intercept = (mass, parts, wind, delta) => course(mass, parts, wind, delta, false, true);
  function contactSeconds(position, velocity, target, radius) {
    const d = [position.eastM - target.eastM, position.northM - target.northM, position.altitudeM - target.altitudeM];
    const v = [velocity.x, velocity.y, velocity.z || 0], speed2 = v.reduce((n, x) => n + x * x, 0);
    const distance2 = d.reduce((n, x) => n + x * x, 0), dot = d.reduce((n, x, i) => n + x * v[i], 0);
    if (distance2 <= radius * radius) return 0;
    const discriminant = dot * dot - speed2 * (distance2 - radius * radius);
    if (!(speed2 > 0) || discriminant < 0 || dot >= 0) return Infinity;
    return Math.max(0, (-dot - Math.sqrt(discriminant)) / speed2);
  }
  function valid(owner, at = Infinity) {
    const a = owner.carrionApproach;
    return (owner.carrionApproachCooldownUntil == null || finite(owner.carrionApproachCooldownUntil))
      && (owner.carrionApproachOutcome == null || finite(owner.carrionApproachOutcome.at) && owner.carrionApproachOutcome.at <= at
        && ['arrived', 'unable', 'timeBudgetSpent', 'lostContact', 'interrupted'].includes(owner.carrionApproachOutcome.reason))
      && (!a || ['startedAt', 'deadlineAt', 'lastSeenAt'].every(k => finite(a[k])) && a.deadlineAt === a.startedAt + WINDOW
        && a.startedAt <= a.lastSeenAt && a.lastSeenAt <= at && a.lastSeenAt <= a.deadlineAt
        && a.target && typeof a.target.id === 'string' && point(a.target.position));
  }
  return { ID, WINDOW, LOST, RETRY, REVIEW, stop, observe, course, intercept, contactSeconds, valid, point };
});
