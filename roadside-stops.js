(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./beast-climbing') : root.HelixBeastClimbing);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixRoadsideStops = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Climbing) {
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
    const id = `stop:${routeId}:${positionKm.toFixed(9)}`;
    let seed = 2166136261;
    for (const ch of `${binding.worldId}:${id}`) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
    const baseline = [];
    for (let y = 6; y < 16; y++) for (let x = 8; x < 20; x++) {
      const terrainId = y === 10 ? 'gravel' : (Math.imul(seed ^ (x * 31 + y), 16777619) >>> 0) % 3 ? 'grass' : 'soil';
      baseline.push({ cell: { x, y, z }, terrainId });
    }
    site = { id, routeId, positionKm, roomId: `roadsideStop-${state.sites.length + 1}`, entry: { x: 10, y: 10, z },
      createdAt: at, lastVisitedAt: at, visits: 1, baseline, shelter: null, destination: { ...weather } };
    site.climbSurfaces = Climbing.surfaces(site, terrainSource);
    state.sites.push(site); const normalized = normalize(state);
    return { state: normalized, site: normalized.sites.at(-1) };
  }
  function rebind(value, from, to) {
    const s = normalize(value);
    return s && s.worldId === from?.worldId && s.runId === from?.runId && text(to?.worldId) && text(to?.runId)
      ? normalize({ ...s, ...to }) : s;
  }
  return { normalize, ensure, rebind };
});
