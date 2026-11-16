(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./creature-life') : root.HelixCreatureLife);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HelixBeastSeasonalJourneys = api;
})(globalThis, function (Life) {
  'use strict';
  const DAY = 86400, EPS = 1e-8, copy = x => JSON.parse(JSON.stringify(x));
  const PHASES = ['thaw', 'highSun', 'stormturn', 'deepCold'];
  const finite = n => Number.isFinite(n) && n >= 0;
  const moving = g => Boolean(g.transit && !g.transit.stop);
  const next = g => g.transit ? g.transit.stop?.until
    ?? Math.min(g.transit.edgeIndex === 0 ? g.transit.crossAt : g.transit.edgeArriveAt, g.transit.nextStopCheckAt ?? Infinity) : Infinity;
  function monthAt(calendar, at) {
    if (!calendar?.monthDays?.length || !calendar.monthDays.every(n => Number.isFinite(n) && n > 0)
      || !Number.isFinite(calendar.epochAt)) throw Error('An explicit game calendar is required');
    const year = calendar.monthDays.reduce((n, days) => n + days * DAY, 0);
    const cycle = Math.floor((at - calendar.epochAt) / year);
    let start = calendar.epochAt + cycle * year;
    for (let index = 0; index < calendar.monthDays.length; index++) {
      const end = start + calendar.monthDays[index] * DAY;
      if (at < end - EPS) return { index: cycle * calendar.monthDays.length + index, start, end, season: index };
      start = end;
    }
    return monthAt(calendar, start + EPS * 2);
  }
  const phaseIds = calendar => calendar.phaseIds || (calendar.monthDays.length === 4 ? PHASES : calendar.monthDays.map((_, i) => String(i)));
  const configured = g => Boolean(g.instinct?.seasonal);
  function validSpec(g, calendar, allowUnresolved = false) {
    if (!configured(g)) return true;
    const spec = g.instinct.seasonal, phases = phaseIds(calendar), path = spec.outboundRoute;
    return g.instinct.mode === 'instinctive' && Array.isArray(path) && path.length >= 2
      && path.every(p => Boolean(typeof p === 'string' && p.length || allowUnresolved && p === null))
      && phases.length === calendar.monthDays.length && new Set(phases).size === phases.length
      && spec.phases && new Set(Object.values(spec.phases)).size === 4
      && ['outboundPhase', 'residencePhase', 'returnPhase', 'homePhase'].every(key => phases.includes(spec.phases[key]));
  }
  function windowAfter(calendar, phaseId, at) {
    let month = monthAt(calendar, at);
    for (let i = 0; i <= calendar.monthDays.length; i++) {
      if (phaseIds(calendar)[month.season] === phaseId) return { start: month.start, end: month.end };
      month = monthAt(calendar, month.end);
    }
    throw Error('Seasonal phase does not belong to the actual calendar');
  }
  function emit(g, result, kind, at, detail = {}) {
    const event = { kind, at, groupId: g.id, ...detail };
    result.push(event); g.seasonal.history.push(copy(event));
    if (g.seasonal.history.length > 96) g.seasonal.history.shift();
  }
  function intent(g, at) {
    const active = g.seasonal?.active;
    if (!active || !['waiting', 'travelling'].includes(active.status) || g.transit) return null;
    return { destination: active.path[active.nextIndex], chosenAt: active.chosenAt,
      departAt: Math.max(active.departAt, at + 1e-6), seasonalLegId: active.id };
  }
  function activate(g, plan, at, events) {
    g.intention = null;
    if (g.regionId === plan.path.at(-1)) {
      g.seasonal.active = null;
      emit(g, events, 'seasonalAlreadyAtDestination', at, { leg: plan.leg }); return;
    }
    g.seasonal.active = { ...copy(plan), nextIndex: 1, status: 'waiting' };
    if (g.regionId !== plan.path[0] || plan.path.some(p => p === null)) {
      g.seasonal.active.status = 'blocked';
      emit(g, events, 'seasonalBlocked', at, { leg: plan.leg, reason: g.regionId !== plan.path[0]
        ? 'Original body is not at the traditional route origin; no invented approach path' : 'Traditional route has unresolved habitat' });
    }
  }
  // Only calendar, original instincts and the group's own saved position are
  // inputs. No destination stocks, census, future weather or private capacity.
  function planMonth(g, calendar, month, at = month.start) {
    if (!configured(g) || g.will === false) return [];
    if (!validSpec(g, calendar, true)) throw Error('Invalid original seasonal route');
    g.seasonal ||= { lastPlannedMonth: null, serial: 0, active: null, pending: null, history: [] };
    if (g.seasonal.lastPlannedMonth === month.index) return [];
    g.seasonal.lastPlannedMonth = month.index;
    const spec = g.instinct.seasonal, phase = phaseIds(calendar)[month.season], events = [];
    const leg = phase === spec.phases.outboundPhase ? 'outbound' : phase === spec.phases.returnPhase ? 'return' : null;
    if (!leg) return events;
    const serial = g.seasonal.serial++;
    const plan = { id: `${g.id}:seasonal:${month.index}:${serial}`, leg,
      path: leg === 'outbound' ? copy(spec.outboundRoute) : [...spec.outboundRoute].reverse(),
      chosenAt: at, departAt: Math.max(at + 1e-6, month.start + (month.end - month.start) * (.05 + .9 * Life.random(`${g.id}:seasonal-departure:${month.index}`))),
      arrivalWindow: windowAfter(calendar, leg === 'outbound' ? spec.phases.residencePhase : spec.phases.homePhase, month.end) };
    const active = g.seasonal.active;
    if (g.transit || active && ['waiting', 'travelling'].includes(active.status)) {
      if (active?.leg !== leg && !g.seasonal.pending) {
        g.seasonal.pending = plan;
        emit(g, events, 'seasonalWindowQueued', at, { leg, activeLegId: active?.id || null });
      } else emit(g, events, 'seasonalWindowMissed', at, { leg });
      return events;
    }
    activate(g, plan, at, events);
    const next = intent(g, at); if (next) g.intention = next;
    return events;
  }
  function blocked(g, at, reason) {
    const events = [];
    if (g.seasonal?.active) {
      g.seasonal.active.status = 'blocked'; g.seasonal.active.blockedAt = at;
      emit(g, events, 'seasonalBlocked', at, { leg: g.seasonal.active.leg, reason });
    }
    return events;
  }
  function depart(g, at, region, speedKmDay, spatial = null) {
    const events = [], intention = g.intention;
    if (!intention || intention.departAt > at + EPS || g.transit) return events;
    g.intention = null;
    const edge = region.edges.find(e => e.id === intention.destination);
    if (!edge?.traversable || edge.allowedSpecies && !edge.allowedSpecies.includes(g.speciesId) || !(speedKmDay > 0)) {
      events.push({ kind: 'blockedDeparture', at, groupId: g.id, destination: intention.destination });
      events.push(...blocked(g, at, 'Actual encountered edge or body capability prevents passage')); return events;
    }
    const approach = spatial?.approachKm || 0, final = spatial?.finalKm || 0;
    g.transit = { path: [g.regionId, intention.destination], edgeIndex: 0, departedAt: at,
      edgeStartedAt: at, crossAt: at + (approach + edge.distanceKm / 2) / speedKmDay * DAY,
      edgeArriveAt: at + (approach + edge.distanceKm + final) / speedKmDay * DAY,
      ...(spatial ? { spatial: { ...copy(spatial), speedKmDay }, nextStopCheckAt: at + DAY / 4,
        pausedSeconds: { beforeCross: 0, afterCross: 0 } } : {}) };
    if (intention.seasonalLegId && g.seasonal?.active?.id === intention.seasonalLegId) g.seasonal.active.status = 'travelling';
    events.push({ kind: 'departure', at, groupId: g.id, from: g.regionId, destination: intention.destination }); return events;
  }
  const location = g => g.transit ? g.transit.path[g.transit.edgeIndex] : g.regionId;
  function pause(g, at, position, until, reason) {
    const t = g.transit;
    if (!t?.spatial || t.stop || !(until > at) || until - at > DAY / 4 + EPS
      || position?.regionId !== location(g) || !['eastM', 'northM', 'altitudeM'].every(k => Number.isFinite(position[k]))) return null;
    t.pausedSeconds ||= { beforeCross: 0, afterCross: 0 };
    t.stop = { startedAt: at, until, position: copy(position), reason };
    return { kind: 'journeyStopped', at, groupId: g.id, regionId: location(g), reason, until };
  }
  function resume(g, at) {
    const t = g.transit, stop = t?.stop; if (!stop || at < stop.startedAt || at > stop.until + EPS) return null;
    const elapsed = at - stop.startedAt;
    t.pausedSeconds[t.edgeIndex === 0 ? 'beforeCross' : 'afterCross'] += elapsed;
    if (t.edgeIndex === 0) t.crossAt += elapsed;
    t.edgeArriveAt += elapsed; delete t.stop;
    t.nextStopCheckAt = at + DAY / 4;
    return { kind: 'journeyResumed', at, groupId: g.id, regionId: location(g), stoppedSeconds: elapsed };
  }
  function arrive(g, at) {
    if (!g.transit || g.transit.stop) return [];
    if (g.transit.crossAt <= at + EPS) g.transit.edgeIndex = 1;
    if (g.transit.edgeArriveAt > at + EPS) return [];
    const events = [];
    g.regionId = g.transit.path.at(-1); g.transit = null; g.observedShortage = false;
    g.knowledge ||= []; g.knowledge.push({ regionId: g.regionId, at, source: 'personalArrival', confidence: 'localOnly' });
    if (g.knowledge.length > 96) g.knowledge.shift();
    events.push({ kind: 'arrival', at, groupId: g.id, regionId: g.regionId });
    const active = g.seasonal?.active;
    if (active?.status === 'travelling') {
      if (active.path[active.nextIndex] !== g.regionId) return events.concat(blocked(g, at, 'Original route/edge identity no longer matches'));
      active.nextIndex++;
      if (active.nextIndex < active.path.length) {
        active.departAt = at + 1e-6; g.intention = intent(g, at);
      } else {
        emit(g, events, 'seasonalLegArrived', at, { leg: active.leg, legId: active.id,
          arrivalWindow: copy(active.arrivalWindow), late: at > active.arrivalWindow.end + EPS });
        g.seasonal.active = null;
        if (g.seasonal.pending) {
          const pending = g.seasonal.pending; g.seasonal.pending = null;
          activate(g, pending, at, events);
          g.intention = intent(g, at);
        }
      }
    } else if (!configured(g) && g.instinct?.mode === 'instinctive')
      g.instinct.cursor = ((g.instinct.cursor || 0) + 1) % g.instinct.route.length;
    return events;
  }
  function validState(g, calendar, at, allowUnresolved = false) {
    const t = g.transit;
    if (t?.pausedSeconds && (!t.spatial || !['beforeCross', 'afterCross'].every(k => finite(t.pausedSeconds[k]))
      || t.pausedSeconds.beforeCross + t.pausedSeconds.afterCross > at - t.departedAt + EPS)) return false;
    if (t?.nextStopCheckAt != null && (!t.spatial || !finite(t.nextStopCheckAt))) return false;
    if (t?.stop && (!t.spatial || !t.pausedSeconds || !finite(t.stop.startedAt) || t.stop.startedAt > at + EPS
      || !(t.stop.until > at - EPS) || t.stop.until - at > DAY / 4 + EPS
      || t.stop.startedAt >= t.edgeArriveAt || t.stop.position?.regionId !== location(g)
      || !['eastM', 'northM', 'altitudeM'].every(k => Number.isFinite(t.stop.position[k]))
      || !['hunger', 'thirst', 'fatigue'].includes(t.stop.reason))) return false;
    if (!validSpec(g, calendar, allowUnresolved)) return false;
    if (!configured(g)) return !g.seasonal;
    const s = g.seasonal; if (!s) return true;
    if (!Number.isInteger(s.lastPlannedMonth) || s.lastPlannedMonth > monthAt(calendar, at).index
      || !Number.isSafeInteger(s.serial) || s.serial < 0 || !Array.isArray(s.history)) return false;
    for (const plan of [s.active, s.pending].filter(Boolean)) {
      const expected = plan.leg === 'outbound' ? g.instinct.seasonal.outboundRoute
        : plan.leg === 'return' ? [...g.instinct.seasonal.outboundRoute].reverse() : null;
      if (!expected || typeof plan.id !== 'string' || !plan.id.length || JSON.stringify(plan.path) !== JSON.stringify(expected)
        || !finite(plan.chosenAt) || plan.chosenAt > at + EPS || !finite(plan.departAt) || plan.departAt < plan.chosenAt
        || !finite(plan.arrivalWindow?.start) || !finite(plan.arrivalWindow.end) || !(plan.arrivalWindow.end > plan.arrivalWindow.start)) return false;
    }
    const active = s.active;
    if (active && (!['waiting', 'travelling', 'blocked'].includes(active.status)
      || !Number.isInteger(active.nextIndex) || active.nextIndex < 1 || active.nextIndex >= active.path.length)) return false;
    if (g.intention?.seasonalLegId && (!active || active.status !== 'waiting'
      || g.intention.seasonalLegId !== active.id || g.intention.destination !== active.path[active.nextIndex])) return false;
    if (active?.status === 'travelling' && g.transit && (g.transit.path[0] !== active.path[active.nextIndex - 1]
      || g.transit.path[1] !== active.path[active.nextIndex])) return false;
    return true;
  }
  // Generator-only replay using the SAME month/edge transitions as the consumed
  // population model. Segments are residence/work intervals, not a teleport or
  // a reservation. The caller accounts actual stocks separately.
  function trace(original, regions, calendar, until, speedKmDay) {
    const g = copy(original), segments = [], events = [], byId = regions instanceof Map ? regions : new Map(regions.map(r => [r.id, r]));
    g.intention = null; g.transit = null; g.seasonal = null; g.knowledge ||= [];
    let at = 0, month = monthAt(calendar, 0);
    events.push(...planMonth(g, calendar, month));
    while (at < until - EPS) {
      const next = Math.min(until, month.end, g.intention?.departAt ?? Infinity,
        g.transit ? g.transit.edgeIndex === 0 ? g.transit.crossAt : g.transit.edgeArriveAt : Infinity);
      if (!(next > at)) throw Error('Seasonal trace did not advance');
      segments.push({ from: at, to: next, regionId: location(g), travelling: Boolean(g.transit) }); at = next;
      if (g.intention?.departAt <= at + EPS) events.push(...depart(g, at, byId.get(g.regionId), speedKmDay));
      events.push(...arrive(g, at));
      if (month.end <= at + EPS) { month = monthAt(calendar, at); events.push(...planMonth(g, calendar, month)); }
    }
    return { segments, events, at, regionId: g.regionId, transit: copy(g.transit), seasonal: copy(g.seasonal) };
  }
  return { DAY, monthAt, phaseIds, configured, validSpec, planMonth, intent, depart, arrive, pause, resume, moving, next, blocked, location, validState, trace };
});
