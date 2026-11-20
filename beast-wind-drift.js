// Saved advection and bounded sensed-food control in actual regional air.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./beast-bodies') : root.HelixBeastBodies,
    node ? require('./carrion-lantern-approach') : root.HelixCarrionLanternApproach,
    node ? require('./wildlife-carcasses') : root.HelixWildlifeCarcasses,
    node ? require('./wind-shelters') : root.HelixWindShelters);
  if (node) module.exports = api;
  root.HelixBeastWindDrift = api;
})(globalThis, function (Bodies, Approach, Carcasses, Shelters) {
  'use strict';
  const EPS = 1e-8, HOUR = 3600, copy = x => JSON.parse(JSON.stringify(x));
  const point = p => p && typeof p.regionId === 'string' && ['eastM', 'northM', 'altitudeM'].every(k => Number.isFinite(p[k]));
  const enabled = g => g.windDriven === true;
  const moving = c => Boolean(c.windDrift && Math.hypot(c.windDrift.velocity.x, c.windDrift.velocity.y) > 0);
  const anchorMass = (body, meal) => Math.min(Carcasses.anchorLimit(body), Math.max(0, body.massKg - body.edibleKg)
    + (meal.anchors || []).reduce((n, p) => n + p.kg, 0));
  const corpse = (r, meal) => meal?.kind === 'beast' ? r.remains?.[meal.sourceId] || r.remainsBatches?.[meal.sourceId]
    : meal?.kind === 'wildlife' ? Carcasses.source(r, meal.sourceId) : null;
  const corpseProfile = body => body?.poolId ? Carcasses.body(body) : Bodies.profiles[body?.speciesId];
  const bodyMass = body => body.poolId ? body.massKg / Math.max(1, body.count) : body.massKg;
  const gripFloorKg = drag => drag / (9.81 * .5) / Math.exp(-.02 * 7200 / 86400);
  function anchorNeed(c, r, wind, body) {
    const part = (c.regional?.parts['feeding organs'] || 0) / 100, b = Bodies.profiles[c.speciesId];
    if (!wind || !body?.position || !r.floor || part < .35) return null;
    const drag = .5 * 1.225 * b.lengthM * b.heightM * (c.massKg / b.massKg) ** (2 / 3) * Math.hypot(wind.x, wind.y) ** 2;
    if (drag > c.massKg * 9.81 * .25 * part) return Infinity;
    return gripFloorKg(drag);
  }
  function canFeedAt(g, c, r, body, seconds = 60, air) {
    const flow = air === undefined ? c.windDrift?.flow : air, v = c.windDrift?.velocity, b = Bodies.profiles[c.speciesId];
    const speed = air ? Math.min(b.speed, Math.hypot(air.x, air.y)) : v && Math.hypot(v.x, v.y);
    if (speed == null || speed * seconds <= b.reachM * 2) return true;
    if (!flow || !r.floor || (c.regional?.parts['feeding organs'] ?? 0) < 35) return false;
    const drag = .5 * 1.225 * b.lengthM * b.heightM * (c.massKg / b.massKg) ** (2 / 3) * Math.hypot(flow.x, flow.y) ** 2;
    const structure = ['hard', 'tough'].reduce((n, k) => n + Math.max(0, (body.tissues?.[k]?.kg || 0) - (body.tissues?.[k]?.reservedKg || 0)), 0)
      / Math.max(1, body.count);
    return drag <= c.massKg * 9.81 * .25 * (c.regional.parts['feeding organs'] / 100)
      && structure * Math.exp(-.02 * seconds / 86400) * 9.81 * .5 >= drag;
  }
  const ambientWind = (r, season) => r.seasons?.[season]?.wind ?? r.wind ?? null;
  const windAt = (r, season, position) => Shelters.at(ambientWind(r, season), r.windShelter, position);
  const shelterBoundary = (r, season, position, velocity) =>
    Shelters.boundarySeconds(ambientWind(r, season), r.windShelter, position, velocity);
  const flow = w => w == null || Number.isFinite(w.x) && Number.isFinite(w.y);
  const layoutValid = f => f && Number.isSafeInteger(f.firstOrdinal) && f.firstOrdinal >= 0
    && (f.lastOrdinal == null || Number.isSafeInteger(f.lastOrdinal) && f.lastOrdinal >= f.firstOrdinal)
    && Number.isSafeInteger(f.columns) && f.columns > 0 && [f.eastSpacingM, f.northSpacingM].every(n => Number.isFinite(n) && n >= 0);
  function validDefinition(s) {
    const ids = new Set(s.regions.map(r => r.id));
    return s.regions.every(r => [r.wind, ...(r.seasons || []).map(p => p.wind)].every(flow)
      && (!Object.hasOwn(r, 'windShelter') || r.floor && Shelters.valid(r.windShelter))
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
      || !(c.regional?.stamina >= .001)) return null;
    const b = Bodies.profiles[c.speciesId], n = c.ranges.reduce((sum, [a, z]) => sum + z - a, 0);
    const organs = (c.regional?.parts['feeding organs'] ?? 0) / 100;
    const drag = .5 * 1.225 * b.lengthM * b.heightM * (c.massKg / b.massKg) ** (2 / 3) * Math.hypot(wind.x, wind.y) ** 2;
    if (!n || organs < .35 || drag > c.massKg * 9.81 * .25 * organs) return null;
    for (const id of c.foraging.mealIds) {
      const meal = r.foraging?.meals[id], body = corpse(r, meal);
      const p = corpseProfile(body); if (!body?.position || !p || !(meal.kg > EPS)) continue;
      // Typed structure is exclusively claimed, still decays, and cannot also
      // feed another mouth. Leave a worst-case decay margin for a 2-hour meal.
      if (anchorMass(body, meal) + EPS < gripFloorKg(drag * n)) continue;
      const scale = Math.cbrt(bodyMass(body) / p.massKg), radius = Math.hypot(p.lengthM, p.widthM) * scale * .5 + b.reachM;
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
  function frontVelocity(raw, incoming, boundary, maximum) {
    const n = boundary.normal, e = boundary.entry, length = Math.hypot(e.eastM, e.northM);
    // The adjoining frame faces the opposite side of the shared plane. Blend
    // only tangential air components in this frame; inward normal transport
    // stagnates. This is a coarse stationary front, not a weather/fluid solver.
    const hereTangent = -raw.x * n.y + raw.y * n.x;
    const thereTangent = (incoming.x * e.northM - incoming.y * e.eastM) / length;
    const speed = Math.max(-maximum, Math.min(maximum, (hereTangent + thereTangent) / 2));
    return { x: -n.y * speed || 0, y: n.x * speed || 0 };
  }
  function frontMotion(r, raw, front, maximum) {
    const edge = r.edges.find(e => e.id === front.neighborId), n = edge.windBoundary.normal;
    // Two nonparallel convergent planes have no common horizontal tangent.
    // Keep the corner rather than repeatedly crossing opposing source cells.
    for (const other of front.others || []) {
      const b = r.edges.find(e => e.id === other.neighborId)?.windBoundary;
      if (!b || Math.abs(n.x * b.normal.y - n.y * b.normal.x) > EPS) return { x: 0, y: 0 };
    }
    return frontVelocity(raw, front.thereFlow, edge.windBoundary, maximum);
  }
  function frontMargin(g, c) {
    const f = c.windDrift?.layout || c.regionalFormation || g.regionalFormation?.[c.originId];
    const last = Math.max(c.windDrift?.layout?.lastOrdinal ?? c.windDrift?.layout?.firstOrdinal ?? 0, ...c.ranges.map(([, hi]) => hi - 1));
    // The cohort anchor is its first surviving ordinal. Losing that ordinal
    // rebases the anchor within the same retained formation, not a new voyage.
    return f ? .001 + Math.hypot(f.columns * f.eastSpacingM, (1 + Math.floor(last / f.columns)) * f.northSpacingM) : .001;
  }
  function plan(g, c, r, at, month, position, actor, region) {
    if (!enabled(g) || !position || !actor) return Infinity;
    const wind = windAt(r, month.season, position), hold = holding(g, c, r, wind, position);
    const pursuit = c.foraging?.phase === 'approach' && c.carrionApproach;
    const delta = pursuit && { eastM: pursuit.target.position.eastM - position.eastM,
      northM: pursuit.target.position.northM - position.northM, altitudeM: pursuit.target.position.altitudeM - position.altitudeM };
    const course = pursuit && c.regional.stamina >= .001 && Approach.intercept(c.massKg, c.regional.parts, wind, delta);
    const control = course && { ...course, massKg: c.massKg, parts: copy(c.regional.parts), delta, targetId: pursuit.target.id, intercept: true };
    const edges = r.edges.filter(e => e.traversable && e.windBoundary && (!e.allowedSpecies || e.allowedSpecies.includes(g.speciesId))
      && Math.abs(e.windBoundary.offsetM - position.eastM * e.windBoundary.normal.x - position.northM * e.windBoundary.normal.y) <= frontMargin(g, c)
      && convergence(r, e, actor, month.season, region));
    const front = edges.length && !hold && !control ? { ...convergence(r, edges[0], actor, month.season, region),
      ...(edges.length > 1 ? { others: edges.slice(1).map(e => convergence(r, e, actor, month.season, region)) } : {}) } : null;
    const velocity = hold ? { x: 0, y: 0 } : front ? frontMotion(r, wind, front, Bodies.profiles[c.speciesId].speed)
      : control?.velocity || Bodies.flowVelocity(actor, wind) || { x: 0, y: 0 };
    const signature = JSON.stringify([wind, velocity, r.id, hold?.mealId, ...(front ? [front] : []), ...(control ? [control] : [])]);
    let d = c.windDrift;
    if (d && !d.vectorFlow && d.until > at + EPS && !d.control && !d.hold && !control && !hold
      && !['handling', 'eating'].includes(c.foraging?.phase) && JSON.stringify(d.flow) === JSON.stringify(wind)
      && (d.front ? front && JSON.stringify(d.front.thereFlow) === JSON.stringify(front.thereFlow)
        : Boolean(d.velocity.x || d.velocity.y) === Boolean(Bodies.capable(actor, actor.bodyPhysics.mode) && wind && Math.hypot(wind.x, wind.y) > .001)))
      return d.until; // Read/review does not reinterpret a cached legacy trajectory.
    // A newly scheduled meal/handling interval must recheck physical contact
    // even if the airflow signature is unchanged since the previous segment.
    if (d && d.until > at + EPS && d.signature === signature && !['handling', 'eating'].includes(c.foraging?.phase)) return d.until;
    const f = c.regionalFormation || g.regionalFormation?.[c.originId];
    d = c.windDrift = { anchor: copy(position), startedAt: at, appliedAt: at, vectorFlow: true,
      layout: { firstOrdinal: c.ranges[0][0], lastOrdinal: Math.max(...c.ranges.map(([, hi]) => hi - 1)),
        columns: f.columns, eastSpacingM: f.eastSpacingM, northSpacingM: f.northSpacingM },
      until: Math.min(month.end, at + HOUR), velocity, known: wind !== null, signature, flow: copy(wind),
      ...(hold ? { hold } : {}), ...(front ? { front } : {}), ...(control ? { control } : {}) };
    if (control) d.until = Math.min(d.until, c.foraging.action.dueAt, at + c.regional.stamina / Math.max(1e-12, control.effortRate));
    d.until = Math.min(d.until, at + shelterBoundary(r, month.season, position, velocity));
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
      const prior = d.crossing?.boundary;
      // A single globe border may have an edge for the next cell's surface
      // and for its small wetland/shore patches. Winding up over a wetland
      // cannot be inferred from crossing the same plane at the same instant.
      const preferSurface = prior && crossing === d.until && prior.offsetM === b.offsetM
        && prior.normal.x === b.normal.x && prior.normal.y === b.normal.y
        && region(edge.id)?.kind === 'surface' && region(d.crossing.destination)?.kind !== 'surface';
      if (crossing < d.until || crossing === d.until && (!prior || preferSurface)) {
        d.until = crossing; d.crossing = { destination: edge.id, boundary: copy(b) };
      }
    }
    return d.until;
  }
  function integrate(c, to) {
    const d = c.windDrift; if (!d || !(to >= d.appliedAt)) return;
    c.regionalPosition = { ...copy(d.anchor), eastM: d.anchor.eastM + d.velocity.x * (to - d.startedAt),
      northM: d.anchor.northM + d.velocity.y * (to - d.startedAt), altitudeM: d.anchor.altitudeM + (d.velocity.z || 0) * (to - d.startedAt) };
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
          || d.layout.lastOrdinal != null && (d.layout.lastOrdinal >= s.origins[c.originId || c.id].count
            || c.ranges.some(([, hi]) => hi - 1 > d.layout.lastOrdinal))
          || c.windCrossings != null && (!Number.isSafeInteger(c.windCrossings) || c.windCrossings < 0)
          || !formation || ['columns', 'eastSpacingM', 'northSpacingM'].some(k => d.layout[k] !== formation[k])
          || !Number.isFinite(d.velocity?.x) || !Number.isFinite(d.velocity?.y)
          || Math.hypot(d.velocity.x, d.velocity.y) > Bodies.profiles[g.speciesId].speed + EPS
          || d.vectorFlow != null && d.vectorFlow !== true
          || !d.vectorFlow && d.velocity.x && d.velocity.y || !d.known && (d.velocity.x || d.velocity.y)) return false;
        if (d.signature !== JSON.stringify([d.flow, d.velocity, g.regionId, d.hold?.mealId, ...(d.front ? [d.front] : []), ...(d.control ? [d.control] : [])])) return false;
        if (d.control) {
          const q = d.control, expected = q.intercept === true
            ? Approach.intercept(q.massKg, q.parts, d.flow, q.delta)
            : Approach.course(q.massKg, q.parts, d.flow, q.delta, !d.vectorFlow);
          if (!expected || d.front || d.hold || !Number.isFinite(d.velocity.z) || d.until - d.startedAt > Approach.REVIEW + EPS
            || q.intercept != null && (q.intercept !== true || !d.vectorFlow)
            || JSON.stringify(expected.velocity) !== JSON.stringify(d.velocity)
            || ['forceN', 'maximumForceN', 'effortRate'].some(k => q[k] !== expected[k])
            || c.ranges.length && (c.foraging?.phase !== 'approach' || q.targetId !== c.carrionApproach?.target.id
              || ['eastM', 'northM', 'altitudeM'].some((k, i) => Math.abs(q.delta[k] - (c.carrionApproach.target.position[k] - d.anchor[k])) > 1e-6))) return false;
        } else if (d.velocity.z != null) return false;
        const raw = d.flow, magnitude = raw && Math.hypot(raw.x, raw.y);
        if (c.ranges.length && JSON.stringify(raw) !== JSON.stringify(windAt(s.regions.find(r => r.id === g.regionId), s.plans.at(-1).season, d.anchor))) return false;
        if (d.front) {
          const region = s.regions.find(r => r.id === g.regionId);
          if (d.front.others != null && (!d.vectorFlow || !Array.isArray(d.front.others) || !d.front.others.length)
            || new Set([d.front, ...(d.front.others || [])].map(f => f.neighborId)).size !== 1 + (d.front.others?.length || 0)) return false;
          for (const f of [d.front, ...(d.front.others || [])]) {
            const edge = region.edges.find(e => e.id === f.neighborId), b = edge?.windBoundary;
            const incoming = f.thereFlow, length = b && Math.hypot(b.entry.eastM, b.entry.northM);
            if (!b || edge.allowedSpecies && !edge.allowedSpecies.includes(g.speciesId)
              || !flow(incoming) || !incoming || !(Math.hypot(incoming.x, incoming.y) > .001) || d.hold || d.control
              || !d.vectorFlow && (d.velocity.x || d.velocity.y) || !(magnitude > .001)
              || Math.abs(b.offsetM - d.anchor.eastM * b.normal.x - d.anchor.northM * b.normal.y) > frontMargin(g, c)
              || !(d.vectorFlow ? raw.x * b.normal.x + raw.y * b.normal.y > EPS
                : (Math.abs(raw.x) >= Math.abs(raw.y) ? Math.sign(raw.x) * b.normal.x : Math.sign(raw.y) * b.normal.y) > 0)
              || !(d.vectorFlow ? (incoming.x * b.entry.eastM + incoming.y * b.entry.northM) / length > EPS
                : (Math.abs(incoming.x) >= Math.abs(incoming.y) ? Math.sign(incoming.x) * b.entry.eastM : Math.sign(incoming.y) * b.entry.northM) / length > 0)
              || c.ranges.length && JSON.stringify(incoming) !== JSON.stringify(windAt(s.regions.find(r => r.id === edge.id), s.plans.at(-1).season))) return false;
          }
          if (d.vectorFlow) {
            const expected = frontMotion(region, raw, d.front, Bodies.profiles[g.speciesId].speed);
            if (d.velocity.x !== expected.x || d.velocity.y !== expected.y) return false;
          }
        }
        if (c.ranges.length && !d.control && !d.hold && !d.front && magnitude > .001) {
          const buoyant = Object.entries(c.regional.parts).every(([part, health]) =>
            !(/bladder|membrane|buoyancy/.test(part) && health <= 40 || /torso|core|thorax|trunk|^bell$|bladder|forebody/.test(part) && health <= 5));
          if (buoyant !== Boolean(d.velocity.x || d.velocity.y)) return false;
        }
        if (!d.control && !d.hold && !d.front && magnitude > .001 && Math.hypot(d.velocity.x, d.velocity.y) > EPS) {
          const speed = Math.min(Bodies.profiles[g.speciesId].speed, magnitude);
          const expected = d.vectorFlow ? { x: raw.x * speed / magnitude, y: raw.y * speed / magnitude }
            : Math.abs(raw.x) >= Math.abs(raw.y)
            ? { x: Math.sign(raw.x) * Math.min(Bodies.profiles[g.speciesId].speed, magnitude), y: 0 }
            : { x: 0, y: Math.sign(raw.y) * Math.min(Bodies.profiles[g.speciesId].speed, magnitude) };
          if (d.velocity.x !== expected.x || d.velocity.y !== expected.y) return false;
        } else if (!d.control && !d.hold && !(magnitude > .001) && (d.velocity.x || d.velocity.y)) return false;
        if (d.hold) {
          const h = d.hold, b = Bodies.profiles[c.speciesId], region = s.regions.find(r => r.id === g.regionId), meal = region?.foraging?.meals[h.mealId];
          const drag = .5 * 1.225 * b.lengthM * b.heightM * (h.bodyMassKg / b.massKg) ** (2 / 3) * magnitude ** 2;
          // Empty/dead cohorts may retain their last segment as history. Live
          // held mouths must still own the very same finite corpse claim.
          if (!Number.isFinite(h.bodyMassKg) || !(h.bodyMassKg > 0) || !(h.organIntegrity >= .35 && h.organIntegrity <= 1)
            || !Number.isSafeInteger(h.members) || h.members < 1 || !Number.isFinite(h.effortRate)
            || Math.abs(h.effortRate - drag / (h.bodyMassKg * 9.81) * .1) > EPS
            || drag > h.bodyMassKg * 9.81 * .25 * h.organIntegrity + EPS || d.velocity.x || d.velocity.y
            || c.ranges.length && (!meal || meal.kind !== 'beast' && !corpse(region, meal)?.poolId || !c.foraging.mealIds.includes(h.mealId))) return false;
          if (c.ranges.length) {
            const remains = corpse(region, meal), p = corpseProfile(remains);
            if (!region.floor || !remains?.position || !p || h.members < c.ranges.reduce((n, [lo, hi]) => n + hi - lo, 0)
              || anchorMass(remains, meal) * 9.81 * .5 + EPS < drag * h.members
              || extent(g, c, c.regionalPosition, remains.position) > Math.hypot(p.lengthM, p.widthM) * Math.cbrt(bodyMass(remains) / p.massKg) * .5 + b.reachM + EPS) return false;
          }
        }
        const p = c.regionalPosition;
        if (!point(p) || p.regionId !== g.regionId || Math.abs(p.eastM - d.anchor.eastM - d.velocity.x * (d.appliedAt - d.startedAt)) > 1e-6
          || Math.abs(p.northM - d.anchor.northM - d.velocity.y * (d.appliedAt - d.startedAt)) > 1e-6
          || Math.abs(p.altitudeM - d.anchor.altitudeM - (d.velocity.z || 0) * (d.appliedAt - d.startedAt)) > 1e-6) return false;
        if (d.crossing && !s.regions.find(r => r.id === g.regionId)?.edges.some(e => e.id === d.crossing.destination
          && JSON.stringify(e.windBoundary) === JSON.stringify(d.crossing.boundary))) return false;
      }
    }
    return true;
  }
  return { enabled, moving, plan, integrate, destinations, entry, valid, validDefinition, windAt, shelterBoundary, holding, contactSeconds, extent, convergence, canFeedAt, anchorNeed };
});
