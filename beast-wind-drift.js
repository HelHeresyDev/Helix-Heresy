// Saved cohort advection in actual regional air. No destination or food policy.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./beast-bodies') : root.HelixBeastBodies);
  if (node) module.exports = api;
  root.HelixBeastWindDrift = api;
})(globalThis, function (Bodies) {
  'use strict';
  const EPS = 1e-8, HOUR = 3600, copy = x => JSON.parse(JSON.stringify(x));
  const point = p => p && typeof p.regionId === 'string' && ['eastM', 'northM', 'altitudeM'].every(k => Number.isFinite(p[k]));
  const enabled = g => g.windDriven === true;
  const moving = c => Boolean(c.windDrift && Math.hypot(c.windDrift.velocity.x, c.windDrift.velocity.y) > 0);
  const anchorMass = (body, meal) => Math.max(0, body.massKg - body.edibleKg)
    + (meal.anchors || []).reduce((n, p) => n + p.kg, 0);
  const windAt = (r, season) => r.seasons?.[season]?.wind ?? r.wind ?? null;
  const flow = w => w == null || Number.isFinite(w.x) && Number.isFinite(w.y);
  const layoutValid = f => f && Number.isSafeInteger(f.firstOrdinal) && f.firstOrdinal >= 0
    && Number.isSafeInteger(f.columns) && f.columns > 0 && [f.eastSpacingM, f.northSpacingM].every(n => Number.isFinite(n) && n >= 0);
  function validDefinition(s) {
    const ids = new Set(s.regions.map(r => r.id));
    return s.regions.every(r => [r.wind, ...(r.seasons || []).map(p => p.wind)].every(flow)
      && r.edges.every(e => !e.windBoundary || ids.has(e.id) && e.traversable && (() => {
        const b = e.windBoundary;
        return Number.isFinite(b.offsetM) && b.offsetM > 0 && [b.normal, b.exit, b.entry].every(p => p
          && (p === b.normal ? [p.x, p.y] : [p.eastM, p.northM]).every(Number.isFinite))
          && Math.abs(Math.hypot(b.normal.x, b.normal.y) - 1) < 1e-6
          && Math.hypot(b.entry.eastM, b.entry.northM) > EPS
          && Math.abs(b.exit.eastM * b.normal.x + b.exit.northM * b.normal.y - b.offsetM) < 1e-5;
      })())) && s.groups.every(g => g.windDriven == null || s.regionalFoodWeb === true
        && g.windDriven === true && g.speciesId === 'beast:carrion-lantern' && !g.transit && !g.intention);
  }
  function contactSeconds(position, velocity, meal, reach, clearance = 0) {
    const site = meal.field ? { ...meal.field, radiusM: Math.max(0, meal.field.radiusM - clearance) } : { ...meal.position, radiusM: reach };
    const x = position.eastM - site.eastM, y = position.northM - site.northM;
    if (Math.hypot(x, y) > site.radiusM + EPS || !meal.field && Math.abs(position.altitudeM - site.altitudeM) > reach) return 0;
    const speed2 = velocity.x ** 2 + velocity.y ** 2;
    if (!(speed2 > EPS)) return Infinity;
    const dot = x * velocity.x + y * velocity.y;
    return Math.max(0, (-dot + Math.sqrt(Math.max(0, dot * dot - speed2 * (x * x + y * y - site.radiusM ** 2)))) / speed2);
  }
  function extent(g, c, position, site) {
    const f = c.windDrift?.layout || c.regionalFormation || g.regionalFormation?.[c.originId];
    if (!f) return Infinity;
    const first = f.firstOrdinal ?? c.ranges[0][0];
    let far = 0;
    for (const [lo, hi] of c.ranges) {
      const row0 = Math.floor(lo / f.columns), row1 = Math.floor((hi - 1) / f.columns);
      const columns = row0 === row1 ? [lo % f.columns, (hi - 1) % f.columns] : [0, f.columns - 1];
      for (const col of columns) for (const row of [row0, row1]) far = Math.max(far,
        Math.hypot(position.eastM + (col - first % f.columns) * f.eastSpacingM - site.eastM,
          position.northM + (row - Math.floor(first / f.columns)) * f.northSpacingM - site.northM,
          position.altitudeM - (site.altitudeM ?? position.altitudeM)));
    }
    return far;
  }
  function holding(g, c, r, wind, position, prospective = false) {
    if (!wind || !r.floor || !position || !prospective && !['handling', 'eating'].includes(c.foraging?.phase)
      || !(c.regional?.stamina > 0)) return null;
    const b = Bodies.profiles[c.speciesId], n = c.ranges.reduce((sum, [a, z]) => sum + z - a, 0);
    const organs = (c.regional?.parts['feeding organs'] ?? 0) / 100;
    const drag = .5 * 1.225 * b.lengthM * b.heightM * (c.massKg / b.massKg) ** (2 / 3) * Math.hypot(wind.x, wind.y) ** 2;
    if (!n || organs < .35 || drag > c.massKg * 9.81 * .25 * organs) return null;
    for (const id of c.foraging.mealIds) {
      const meal = r.foraging?.meals[id], body = meal?.kind === 'beast' && (r.remains?.[meal.sourceId] || r.remainsBatches?.[meal.sourceId]);
      const p = body && Bodies.profiles[body.speciesId]; if (!body?.position || !p || !(meal.kg > EPS)) continue;
      // Typed structure is exclusively claimed, still decays, and cannot also
      // feed another mouth. Leave a worst-case decay margin for a 2-hour meal.
      if (anchorMass(body, meal) * Math.exp(-.02 * 7200 / 86400) * 9.81 * .5 < drag * n) continue;
      const scale = Math.cbrt(body.massKg / p.massKg), radius = Math.hypot(p.lengthM, p.widthM) * scale * .5 + b.reachM;
      const far = extent(g, c, position, body.position);
      if (far <= radius) return { mealId: id, effortRate: drag / (c.massKg * 9.81) * .1,
        bodyMassKg: c.massKg, organIntegrity: organs, members: n };
    }
    return null;
  }
  function convergence(r, edge, actor, season, region) {
    if (!edge?.windBoundary || !region) return null;
    const other = region(edge.id), wind = other && windAt(other, season), a = Bodies.flowVelocity(actor, windAt(r, season)), b = Bodies.flowVelocity(actor, wind);
    const normal = edge.windBoundary.normal, entry = edge.windBoundary.entry, length = Math.hypot(entry.eastM, entry.northM);
    return a && b && length > 0 && a.x * normal.x + a.y * normal.y > EPS
      && (b.x * entry.eastM + b.y * entry.northM) / length > EPS ? { neighborId: edge.id, thereFlow: copy(wind) } : null;
  }
  function frontMargin(g, c) {
    const f = c.windDrift?.layout || c.regionalFormation || g.regionalFormation?.[c.originId];
    const last = Math.max(c.windDrift?.layout?.firstOrdinal || 0, ...c.ranges.map(([, hi]) => hi - 1));
    // The cohort anchor is its first surviving ordinal. Losing that ordinal
    // rebases the anchor within the same retained formation, not a new voyage.
    return f ? .001 + Math.hypot(f.columns * f.eastSpacingM, (1 + Math.floor(last / f.columns)) * f.northSpacingM) : .001;
  }
  function plan(g, c, r, at, month, position, actor, region) {
    if (!enabled(g) || !position || !actor) return Infinity;
    const wind = windAt(r, month.season), hold = holding(g, c, r, wind, position);
    const edge = r.edges.find(e => e.traversable && e.windBoundary && (!e.allowedSpecies || e.allowedSpecies.includes(g.speciesId))
      && Math.abs(e.windBoundary.offsetM - position.eastM * e.windBoundary.normal.x - position.northM * e.windBoundary.normal.y) <= frontMargin(g, c)
      && convergence(r, e, actor, month.season, region));
    const front = edge && !hold ? convergence(r, edge, actor, month.season, region) : null;
    const velocity = hold || front ? { x: 0, y: 0 } : Bodies.flowVelocity(actor, wind) || { x: 0, y: 0 };
    const signature = JSON.stringify([wind, velocity, r.id, hold?.mealId, ...(front ? [front] : [])]);
    let d = c.windDrift;
    if (d && d.until > at + EPS && d.signature === signature) return d.until;
    const f = c.regionalFormation || g.regionalFormation?.[c.originId];
    d = c.windDrift = { anchor: copy(position), startedAt: at, appliedAt: at,
      layout: { firstOrdinal: c.ranges[0][0], columns: f.columns, eastSpacingM: f.eastSpacingM, northSpacingM: f.northSpacingM },
      until: Math.min(month.end, at + HOUR), velocity, known: wind !== null, signature, flow: copy(wind),
      ...(hold ? { hold } : {}), ...(front ? { front } : {}) };
    c.regionalPosition = copy(position);
    const fAction = c.foraging?.action;
    if (fAction && ['eating', 'handling'].includes(fAction.phase)) {
      const meal = r.foraging?.meals[c.foraging.mealIds[0]];
      const seconds = hold ? (hold.effortRate > 0 ? c.regional.stamina / hold.effortRate : Infinity)
        : meal ? contactSeconds(position, velocity, meal, Bodies.profiles[c.speciesId].reachM, extent(g, c, position, position)) : 0;
      if (at + seconds < fAction.dueAt) {
        fAction.dueAt = c.foraging.nextAt = at + Math.max(1e-6, seconds); c.contactBusyUntil = fAction.dueAt;
      }
      d.until = Math.min(d.until, fAction.dueAt);
    }
    // Each real adjoining cell supplies a physical separating plane and entry
    // frame. Unlike local media labels are not extra airspace or new food sites.
    for (const edge of r.edges) {
      const b = edge.windBoundary; if (!edge.traversable || !b || edge.allowedSpecies && !edge.allowedSpecies.includes(g.speciesId)) continue;
      const speed = velocity.x * b.normal.x + velocity.y * b.normal.y;
      if (!(speed > EPS)) continue;
      const remaining = b.offsetM - position.eastM * b.normal.x - position.northM * b.normal.y;
      const crossing = at + Math.max(.0001, remaining / speed);
      if (crossing <= d.until) { d.until = crossing; d.crossing = { destination: edge.id, boundary: copy(b) }; }
    }
    return d.until;
  }
  function integrate(c, to) {
    const d = c.windDrift; if (!d || !(to >= d.appliedAt)) return;
    c.regionalPosition = { ...copy(d.anchor), eastM: d.anchor.eastM + d.velocity.x * (to - d.startedAt),
      northM: d.anchor.northM + d.velocity.y * (to - d.startedAt) };
    d.appliedAt = to;
  }
  function destinations(g, at) {
    return g.cohorts.flatMap(c => c.windDrift?.crossing && c.windDrift.until <= at + EPS ? [c.windDrift.crossing.destination] : []);
  }
  function entry(c) {
    const d = c.windDrift, b = d.crossing.boundary, p = c.regionalPosition;
    const tangent = -(p.eastM - b.exit.eastM) * b.normal.y + (p.northM - b.exit.northM) * b.normal.x;
    const forward = (p.eastM - b.exit.eastM) * b.normal.x + (p.northM - b.exit.northM) * b.normal.y;
    const length = Math.hypot(b.entry.eastM, b.entry.northM), x = b.entry.eastM / length, y = b.entry.northM / length;
    return { regionId: d.crossing.destination, eastM: b.entry.eastM + tangent * y - forward * x,
      northM: b.entry.northM - tangent * x - forward * y, altitudeM: p.altitudeM };
  }
  function valid(s) {
    if (!validDefinition(s)) return false;
    for (const g of s.groups) {
      if (g.windDriven != null && (g.windDriven !== true || g.speciesId !== 'beast:carrion-lantern' || g.transit)) return false;
      for (const c of g.cohorts) if (c.windDrift) {
        const d = c.windDrift, at = s.regionClocks?.[g.regionId]?.appliedAt ?? s.appliedAt;
        const formation = c.regionalFormation || g.regionalFormation?.[c.originId];
        if (!enabled(g) || !point(d.anchor) || d.anchor.regionId !== g.regionId || !Number.isFinite(d.startedAt) || d.startedAt < 0
          || !Number.isFinite(d.appliedAt) || d.appliedAt < d.startedAt || d.appliedAt > at + EPS
          || !Number.isFinite(d.until) || d.until < d.appliedAt - EPS || d.until - d.startedAt > HOUR + EPS
          || typeof d.known !== 'boolean' || typeof d.signature !== 'string'
          || !layoutValid(d.layout) || !flow(d.flow) || d.known !== (d.flow !== null)
          || c.windCrossings != null && (!Number.isSafeInteger(c.windCrossings) || c.windCrossings < 0)
          || !formation || ['columns', 'eastSpacingM', 'northSpacingM'].some(k => d.layout[k] !== formation[k])
          || !Number.isFinite(d.velocity?.x) || !Number.isFinite(d.velocity?.y)
          || Math.hypot(d.velocity.x, d.velocity.y) > Bodies.profiles[g.speciesId].speed + EPS
          || d.velocity.x && d.velocity.y || !d.known && (d.velocity.x || d.velocity.y)) return false;
        if (d.signature !== JSON.stringify([d.flow, d.velocity, g.regionId, d.hold?.mealId, ...(d.front ? [d.front] : [])])) return false;
        const raw = d.flow, magnitude = raw && Math.hypot(raw.x, raw.y);
        if (c.ranges.length && JSON.stringify(raw) !== JSON.stringify(windAt(s.regions.find(r => r.id === g.regionId), s.plans.at(-1).season))) return false;
        if (d.front) {
          const region = s.regions.find(r => r.id === g.regionId), edge = region.edges.find(e => e.id === d.front.neighborId), b = edge?.windBoundary;
          const incoming = d.front.thereFlow, length = b && Math.hypot(b.entry.eastM, b.entry.northM);
          if (!b || edge.allowedSpecies && !edge.allowedSpecies.includes(g.speciesId)
            || !flow(incoming) || !incoming || !(Math.hypot(incoming.x, incoming.y) > .001) || d.hold || d.velocity.x || d.velocity.y || !(magnitude > .001)
            || Math.abs(b.offsetM - d.anchor.eastM * b.normal.x - d.anchor.northM * b.normal.y) > frontMargin(g, c)
            || !((Math.abs(raw.x) >= Math.abs(raw.y) ? Math.sign(raw.x) * b.normal.x : Math.sign(raw.y) * b.normal.y) > 0)
            || !((Math.abs(incoming.x) >= Math.abs(incoming.y) ? Math.sign(incoming.x) * b.entry.eastM : Math.sign(incoming.y) * b.entry.northM) / length > 0)
            || c.ranges.length && JSON.stringify(incoming) !== JSON.stringify(windAt(s.regions.find(r => r.id === edge.id), s.plans.at(-1).season))) return false;
        }
        if (c.ranges.length && !d.hold && !d.front && magnitude > .001) {
          const buoyant = Object.entries(c.regional.parts).every(([part, health]) =>
            !(/bladder|membrane|buoyancy/.test(part) && health <= 40 || /torso|core|thorax|trunk|^bell$|bladder|forebody/.test(part) && health <= 5));
          if (buoyant !== Boolean(d.velocity.x || d.velocity.y)) return false;
        }
        if (!d.hold && magnitude > .001 && Math.hypot(d.velocity.x, d.velocity.y) > EPS) {
          const expected = Math.abs(raw.x) >= Math.abs(raw.y)
            ? { x: Math.sign(raw.x) * Math.min(Bodies.profiles[g.speciesId].speed, magnitude), y: 0 }
            : { x: 0, y: Math.sign(raw.y) * Math.min(Bodies.profiles[g.speciesId].speed, magnitude) };
          if (d.velocity.x !== expected.x || d.velocity.y !== expected.y) return false;
        } else if (!d.hold && !(magnitude > .001) && (d.velocity.x || d.velocity.y)) return false;
        if (d.hold) {
          const h = d.hold, b = Bodies.profiles[c.speciesId], region = s.regions.find(r => r.id === g.regionId), meal = region?.foraging?.meals[h.mealId];
          const drag = .5 * 1.225 * b.lengthM * b.heightM * (h.bodyMassKg / b.massKg) ** (2 / 3) * magnitude ** 2;
          // Empty/dead cohorts may retain their last segment as history. Live
          // held mouths must still own the very same finite corpse claim.
          if (!Number.isFinite(h.bodyMassKg) || !(h.bodyMassKg > 0) || !(h.organIntegrity >= .35 && h.organIntegrity <= 1)
            || !Number.isSafeInteger(h.members) || h.members < 1 || !Number.isFinite(h.effortRate)
            || Math.abs(h.effortRate - drag / (h.bodyMassKg * 9.81) * .1) > EPS
            || drag > h.bodyMassKg * 9.81 * .25 * h.organIntegrity + EPS || d.velocity.x || d.velocity.y
            || c.ranges.length && (!meal || meal.kind !== 'beast' || !c.foraging.mealIds.includes(h.mealId))) return false;
          if (c.ranges.length) {
            const corpse = region.remains?.[meal.sourceId] || region.remainsBatches?.[meal.sourceId], p = Bodies.profiles[corpse?.speciesId];
            if (!region.floor || !corpse?.position || !p || h.members < c.ranges.reduce((n, [lo, hi]) => n + hi - lo, 0)
              || anchorMass(corpse, meal) * 9.81 * .5 + EPS < drag * h.members
              || extent(g, c, c.regionalPosition, corpse.position) > Math.hypot(p.lengthM, p.widthM) * Math.cbrt(corpse.massKg / p.massKg) * .5 + b.reachM + EPS) return false;
          }
        }
        const p = c.regionalPosition;
        if (!point(p) || p.regionId !== g.regionId || Math.abs(p.eastM - d.anchor.eastM - d.velocity.x * (d.appliedAt - d.startedAt)) > 1e-6
          || Math.abs(p.northM - d.anchor.northM - d.velocity.y * (d.appliedAt - d.startedAt)) > 1e-6 || p.altitudeM !== d.anchor.altitudeM) return false;
        if (d.crossing && !s.regions.find(r => r.id === g.regionId)?.edges.some(e => e.id === d.crossing.destination
          && JSON.stringify(e.windBoundary) === JSON.stringify(d.crossing.boundary))) return false;
      }
    }
    return true;
  }
  return { enabled, moving, plan, integrate, destinations, entry, valid, validDefinition, windAt, holding, contactSeconds, extent, convergence };
});
