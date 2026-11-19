(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./beast-climbing') : root.HelixBeastClimbing,
    node ? require('./wilderness-beasts') : root.HelixWildernessBeasts);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixRoadsideStops = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Climbing, Wild) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const date = n => Number.isFinite(n) && n >= 0;
  const text = x => typeof x === 'string' ? x.slice(0, 500) : '';
  const cell = c => c && ['x', 'y', 'z'].every(k => Number.isInteger(c[k]));
  function normalize(value) {
    if (!text(value?.worldId) || !text(value.runId)) return null;
    const sites = [], ids = new Set(), rooms = new Set();
    for (const s of Array.isArray(value.sites) ? value.sites : []) {
      if (!text(s?.id) || !text(s.routeId) || !date(s.positionKm) || !date(s.createdAt) || !date(s.lastVisitedAt)
        || !text(s.roomId) || ids.has(s.id) || rooms.has(s.roomId) || !cell(s.entry) || s.entry.z < 21
        || !Array.isArray(s.baseline) || s.baseline.length !== 120
        || !s.baseline.every(t => cell(t.cell) && t.cell.z === s.entry.z && t.cell.x >= 8 && t.cell.x < 20 && t.cell.y >= 6 && t.cell.y < 16
          && ['soil', 'grass', 'gravel'].includes(t.terrainId))
        || new Set(s.baseline.map(t => `${t.cell.x},${t.cell.y}`)).size !== 120 || s.entry.x !== 10 || s.entry.y !== 10) continue;
      ids.add(s.id); rooms.add(s.roomId);
      const shelter = text(s.shelter?.stackId) && cell(s.shelter.cell) && s.baseline.some(t => ['x', 'y', 'z'].every(k => t.cell[k] === s.shelter.cell[k]))
        && date(s.shelter.deployedAt) ? copy(s.shelter) : null;
      sites.push({ id: text(s.id), routeId: text(s.routeId), positionKm: s.positionKm, roomId: text(s.roomId), entry: copy(s.entry),
        createdAt: s.createdAt, lastVisitedAt: s.lastVisitedAt, visits: Math.max(1, Math.floor(Number(s.visits) || 1)),
        baseline: s.baseline.map(t => ({ cell: copy(t.cell), terrainId: t.terrainId })), shelter,
        climbSurfaces: Climbing.normalizeSurfaces(s.climbSurfaces || [], s) || [],
        ...(s.carrierOnly === true ? { carrierOnly: true } : {}),
        ...(s.beasts?.nativeRoomId === s.roomId && s.beasts.siteId === s.id ? { beasts: Wild.normalizeState(s.beasts) } : {}),
        destination: { temperatureC: Number.isFinite(s.destination?.temperatureC) ? s.destination.temperatureC : 18,
          precipitationMm: Number.isFinite(s.destination?.precipitationMm) ? s.destination.precipitationMm : 0 } });
    }
    return { worldId: text(value.worldId), runId: text(value.runId), sites };
  }
  function ensure(value, binding, routeId, positionKm, at, z, weather, terrainSource = null) {
    const old = normalize(value);
    if (!text(binding?.worldId) || !text(binding?.runId) || !text(routeId) || !date(positionKm) || !date(at)
      || !Number.isInteger(z) || z < 21 || old && (old.worldId !== binding.worldId || old.runId !== binding.runId)) return null;
    const state = old || { ...binding, sites: [] };
    // Sub-millimetre numerical tolerance, not a movable camp or distance snap.
    let site = state.sites.find(s => s.routeId === routeId && Math.abs(s.positionKm - positionKm) < 1e-9);
    if (site) { site.lastVisitedAt = at; site.visits++; return { state, site }; }
    site = blueprint(binding.worldId, routeId, positionKm, at, z, weather, terrainSource, `roadsideStop-${state.sites.length + 1}`);
    state.sites.push(site); const normalized = normalize(state);
    return { state: normalized, site: normalized.sites.at(-1) };
  }
  // A prospective window for sensing. No visit, authorisation, terrain debit
  // or knowledge is created until the traveller actually stops here.
  function blueprint(worldId, routeId, positionKm, at, z, weather, terrainSource, roomId = '') {
    const id = `stop:${routeId}:${positionKm.toFixed(9)}`;
    let seed = 2166136261;
    for (const ch of `${worldId}:${id}`) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
    const baseline = [];
    for (let y = 6; y < 16; y++) for (let x = 8; x < 20; x++) {
      const terrainId = y === 10 ? 'gravel' : (Math.imul(seed ^ (x * 31 + y), 16777619) >>> 0) % 3 ? 'grass' : 'soil';
      baseline.push({ cell: { x, y, z }, terrainId });
    }
    const site = { id, routeId, positionKm, roomId, entry: { x: 10, y: 10, z },
      createdAt: at, lastVisitedAt: at, visits: 1, baseline, shelter: null, destination: { ...weather } };
    site.climbSurfaces = Climbing.surfaces(site, terrainSource);
    return site;
  }
  // A recorded start wins. For a leg known only as a distance inside its
  // origin habitat, use a fixed east-west transect centred in that habitat.
  // Adjacent local windows share a metre grid and therefore the same parcels.
  function nativeLeg(route, cellId, areaHa, recordedStart, tile = 1) {
    const lengthKm = route?.legs?.[0]?.distanceKm, radius = Math.sqrt(areaHa * 10000 / Math.PI);
    if (!cellId || !(lengthKm > 0) || !(tile > 0) || !Number.isFinite(radius)) return null;
    const { eastM, northM } = recordedStart || { eastM: -lengthKm * 500, northM: 0 };
    if (![eastM, northM].every(Number.isFinite) || Math.max(Math.hypot(eastM, northM), Math.hypot(eastM + lengthKm * 1000, northM)) + 15 * tile > radius) return null;
    return { routeId: route.id, cellId, lengthKm, eastM, northM, tile };
  }
  function nativeWindow(leg, positionKm, z, roomId = '') {
    if (!leg || !date(positionKm) || positionKm > leg.lengthKm || !Number.isInteger(z)) return null;
    const grid = n => Math.floor(n / leg.tile) * leg.tile;
    return { id: `stop:${leg.routeId}:${positionKm.toFixed(9)}`, cellId: leg.cellId, kind: 'surface', roomId,
      bounds: { x: 8, y: 6, z, width: 12, height: 10 }, origin: {
        eastM: grid(leg.eastM + positionKm * 1000) - 2 * leg.tile, northM: grid(leg.northM) - 4 * leg.tile } };
  }
  function perceived(entry, occupied, lit, clear, tile = 1, direction = 0) {
    return occupied.some(c => {
      if (c.z !== entry.z) return false;
      const gap = Math.hypot(entry.x - c.x, entry.y - c.y) * tile;
      const collision = c.y === entry.y && (direction === 1 || direction === -1) && c.x - entry.x === direction;
      return (collision || lit && gap <= 8) && clear(c);
    });
  }
  function rebind(value, from, to) {
    const s = normalize(value);
    return s && s.worldId === from?.worldId && s.runId === from?.runId && text(to?.worldId) && text(to?.runId)
      ? normalize({ ...s, ...to }) : s;
  }
  return { normalize, ensure, blueprint, nativeLeg, nativeWindow, perceived, rebind };
});
