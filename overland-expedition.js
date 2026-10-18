(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./wilderness-survival') : root.HelixWildernessSurvival);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixOverlandExpedition = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Survival) {
  'use strict';
  const date = x => Number.isFinite(x) && x >= 0;
  const id = x => typeof x === 'string' ? x.slice(0, 300) : '';
  const active = s => ['walking', 'stopped'].includes(s?.trip?.status);
  const factors = { municipal: 1, localApproach: 1.05, operational: 1, degraded: 1.25, intermittent: 1.55 };
  function routePlan(home, ground, knowledge) {
    const record = knowledge?.records?.find(r => r.id === 'visit-extract' && r.kind === 'receivedReport' && date(r.at));
    if (!home?.known || !ground?.known || !home.id || !ground.id || home.cityId !== ground.cityId
      || knowledge?.placeId !== ground.id || !record || !record.source || !record.text
      || ![home, ground].every(p => Number.isFinite(p.localDistanceKm) && p.localDistanceKm > 0 && factors[p.routeContinuity])) return null;
    return { id: `${home.id}:${ground.id}:on-foot`, homeId: home.id, groundId: ground.id, label: `${home.label} ↔ ${ground.label}`,
      sourceId: `${ground.id}:visit-extract`, source: record.source, sourceAt: record.at,
      directions: record.text.slice(0, 1200), distanceKm: home.localDistanceKm + ground.localDistanceKm,
      legs: [{ distanceKm: home.localDistanceKm, factor: factors[home.routeContinuity] }, { distanceKm: ground.localDistanceKm, factor: factors[ground.routeContinuity] }] };
  }
  function normalize(value) {
    const r = value?.route, t = value?.trip;
    if (!id(value?.worldId) || !id(value.runId) || !id(r?.id) || !id(r.homeId) || !id(r.groundId)
      || !id(r.sourceId) || !date(r.sourceAt) || !Array.isArray(r.legs) || !r.legs.length
      || !r.legs.every(l => Number.isFinite(l.distanceKm) && l.distanceKm > 0 && Number.isFinite(l.factor) && l.factor >= 1)) return null;
    const route = { id: id(r.id), homeId: id(r.homeId), groundId: id(r.groundId), label: String(r.label || '').slice(0, 500),
      sourceId: id(r.sourceId), source: String(r.source || '').slice(0, 500), sourceAt: r.sourceAt, directions: String(r.directions || '').slice(0, 1200),
      distanceKm: r.legs.reduce((n, l) => n + l.distanceKm, 0), legs: r.legs.map(l => ({ distanceKm: l.distanceKm, factor: l.factor })) };
    if (!id(t?.id) || !['walking', 'stopped', 'arrived', 'interrupted'].includes(t.status) || !date(t.startedAt) || !date(t.lastAt)
      || t.lastAt < t.startedAt || !Number.isInteger(t.bodyEpoch) || t.bodyEpoch < 0 || ![1, -1].includes(t.direction)
      || !Number.isFinite(t.positionKm) || t.positionKm < 0 || t.positionKm > route.distanceKm
      || !date(t.walkedKm) || !date(t.walkingSeconds)) return null;
    return { worldId: id(value.worldId), runId: id(value.runId), route,
      trip: { id: id(t.id), bodyEpoch: t.bodyEpoch, status: t.status, direction: t.direction, startedAt: t.startedAt, lastAt: t.lastAt,
        positionKm: t.positionKm, walkedKm: t.walkedKm, walkingSeconds: t.walkingSeconds,
        arrivedAt: date(t.arrivedAt) ? t.arrivedAt : null, reason: String(t.reason || '').slice(0, 500) },
      history: (Array.isArray(value.history) ? value.history : []).filter(h => id(h?.id) && date(h.at) && date(h.walkedKm) && date(h.walkingSeconds)
        && ['home', 'ground', 'interrupted'].includes(h.endpoint)).map(h => ({ id: id(h.id), at: h.at, walkedKm: h.walkedKm, walkingSeconds: h.walkingSeconds, endpoint: h.endpoint })) };
  }
  function begin(value, route, binding, endpoint, at, bodyEpoch) {
    const old = normalize(value);
    if (!route || !id(binding?.worldId) || !id(binding?.runId) || !date(at) || !Number.isInteger(bodyEpoch)
      || !['home', 'ground'].includes(endpoint) || old && (old.worldId !== binding.worldId || old.runId !== binding.runId)
      || active(old) && old.trip.bodyEpoch === bodyEpoch) return null;
    const history = old?.history || [];
    if (active(old)) history.push({ id: old.trip.id, at, walkedKm: old.trip.walkedKm, walkingSeconds: old.trip.walkingSeconds, endpoint: 'interrupted' });
    return normalize({ ...binding, route, history, trip: { id: `walk-${history.length + 1}:${at}`, bodyEpoch,
      status: 'walking', direction: endpoint === 'home' ? 1 : -1, positionKm: endpoint === 'home' ? 0 : route.distanceKm,
      startedAt: at, lastAt: at, walkedKm: 0, walkingSeconds: 0, arrivedAt: null, reason: '' } });
  }
  function control(value, action, at, capable = true) {
    const s = normalize(value); if (!active(s) || !date(at) || at < s.trip.lastAt || !capable || !['stop', 'resume', 'reverse'].includes(action)) return s;
    if (action === 'reverse') s.trip.direction *= -1;
    s.trip.status = action === 'resume' ? 'walking' : 'stopped'; s.trip.lastAt = at; s.trip.reason = ''; return s;
  }
  function terrainFactor(s) {
    let end = 0;
    for (const l of s.route.legs) { end += l.distanceKm; if (s.trip.positionKm < end - 1e-9 || s.trip.direction < 0 && s.trip.positionKm <= end + 1e-9) return l.factor; }
    return s.route.legs.at(-1).factor;
  }
  function advance(value, needs, at, c = {}) {
    const s = normalize(value), result = { state: s, needs: Survival.normalizeState(needs), damage: 0, warning: false, arrived: false };
    if (!active(s) || !c.alive || !date(at) || at < s.trip.lastAt) return result;
    if (c.bodyEpoch !== s.trip.bodyEpoch || !c.atRoad) { s.trip.status = 'interrupted'; s.trip.reason = 'Original body or physical road position changed; no relocation or inherited journey.'; return result; }
    for (; s.trip.lastAt + 1 <= at; ) {
      const t = s.trip, walking = t.status === 'walking' && c.capable && !c.busy && c.routeOpen && c.speedKph > 0;
      if (t.status === 'walking') t.reason = !c.capable ? 'The scientist cannot currently walk.' : !c.routeOpen ? 'The received approach is not currently traversable.' : c.busy ? 'Other physically attended work pauses walking.' : '';
      const halted = c.playableStops && t.status === 'walking' && (!c.capable || !c.routeOpen);
      if (halted) t.status = 'stopped';
      let reachedStop = false;
      if (walking) {
        const nextStop = (c.stopPositions || []).filter(p => Number.isFinite(p) && p >= 0 && p <= s.route.distanceKm
          && (p - t.positionKm) * t.direction > 1e-9).sort((a, b) => (a - b) * t.direction)[0];
        let budget = c.speedKph / Survival.fatigueMultiplier(result.needs) / 3600;
        // Spend a one-second distance budget over exact terrain boundaries.
        while (budget > 1e-12) {
          let edge = t.direction > 0 ? s.route.distanceKm : 0, end = 0;
          for (const l of s.route.legs) { end += l.distanceKm; if (t.direction > 0 && end > t.positionKm + 1e-9) { edge = end; break; }
            if (t.direction < 0 && end < t.positionKm - 1e-9) edge = end; }
          if (nextStop != null && (edge - nextStop) * t.direction >= 0) edge = nextStop;
          const factor = terrainFactor(s), distance = Math.min(Math.abs(edge - t.positionKm), budget / factor);
          if (distance <= 1e-12) break;
          t.positionKm = Math.max(0, Math.min(s.route.distanceKm, t.positionKm + t.direction * distance));
          t.walkedKm += distance; budget -= distance * factor;
          if (nextStop != null && Math.abs(t.positionKm - nextStop) < 1e-9) { t.positionKm = nextStop; reachedStop = true; break; }
        }
        t.walkingSeconds++;
      }
      const n = Survival.advance(result.needs, t.lastAt + 1, { working: walking || c.busy && !c.resting, resting: c.resting,
        destination: c.weather || null, sheltered: !walking && Boolean(c.sheltered), carriedRadioIds: c.carriedRadioIds || [] });
      result.needs = n.state; result.damage += n.damage; result.warning ||= n.warning; t.lastAt++;
      if (c.health != null && result.damage >= c.health) { t.status = 'stopped'; t.reason = 'Physiological failure stopped walking.'; break; }
      if (reachedStop) { t.status = 'stopped'; t.reason = 'Reached previously visited roadside ground. Resume explicitly from its physical route entry.'; break; }
      if (halted) break;
      const endpoint = t.direction > 0 ? 'ground' : 'home', reached = t.direction > 0 ? t.positionKm >= s.route.distanceKm - 1e-9 : t.positionKm <= 1e-9;
      if (reached && walking) {
        t.positionKm = t.direction > 0 ? s.route.distanceKm : 0;
        const reason = c.arrivalReasons?.[endpoint];
        if (reason) { t.status = 'stopped'; t.reason = reason; }
        else { t.status = 'arrived'; t.arrivedAt = t.lastAt; result.arrived = true;
          s.history.push({ id: t.id, at: t.lastAt, endpoint, walkedKm: t.walkedKm, walkingSeconds: t.walkingSeconds }); }
        break;
      }
    }
    return result;
  }
  function rebind(value, from, to) {
    const s = normalize(value);
    return s && s.worldId === from?.worldId && s.runId === from?.runId && id(to?.worldId) && id(to?.runId)
      ? normalize({ ...s, ...to }) : s;
  }
  return { active, routePlan, normalize, begin, control, advance, rebind };
});
