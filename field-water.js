(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixFieldWater = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const COSTS = Object.freeze({ steelPanels: 2, metalParts: 2, cloth: 2, rubber: 1 });
  const SECONDS = Object.freeze({ inspect: 60, build: 600, filter: 60, collect: 180, load: 60, treat: 900, drink: 20, drain: 60, dispose: 30 });
  const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const same = (a, b) => a && b && ['x', 'y', 'z'].every(k => a[k] === b[k]);
  const create = () => ({ sites: {}, vessels: {}, plant: null, efforts: {}, history: [], reports: {} });
  function site(context, baseline, roomId, clear) {
    if (!context?.worldId || !context.siteId || baseline?.worldId !== context.worldId || baseline.placeId !== context.siteId) return null;
    const potential = Number(context.truth?.potentialPermille?.freshWater) || 0, access = Number(context.truth?.surfaceAccessibilityPermille) || 0;
    const candidates = potential < 400 || access < 400 ? [] : (baseline.cells || [])
      .map(cell => ({ cell, n: hash(`${context.seed}:${context.siteId}:${JSON.stringify(cell)}:surface-water`) }))
      .filter(c => c.n % 1000 < potential * access / 1000).sort((a, b) => a.n - b.n);
    const c = candidates.find(c => clear(c.cell)), quality = c && hash(`${context.seed}:${context.siteId}:water-quality`) % 10;
    return { worldId: context.worldId, siteId: context.siteId, roomId, nodes: c ? [{ id: `${context.siteId}:surface-water`, cell: copy(c.cell),
      litres: 15 + c.n % 26, initialLitres: 15 + c.n % 26, quality: quality < 7 ? 'filterable' : quality < 9 ? 'chemical' : 'magical', fixtureId: '', inspected: null }] : [] };
  }
  function vessel(s, id) { return s.vessels[id] || { litres: 0, kind: 'empty', sourceId: '' }; }
  function setVessel(s, id, litres, kind, sourceId = '') {
    if (!id || !Number.isInteger(litres) || litres < 0 || litres > 5 || !['empty', 'raw', 'reject'].includes(kind) || litres && kind === 'empty') return false;
    s.vessels[id] = { litres, kind: litres ? kind : 'empty', sourceId: litres ? sourceId : '' }; return true;
  }
  function inspect(node, now) {
    if (!node || !Number.isFinite(now)) return false;
    node.inspected = { at: now, litres: node.litres, quality: node.quality }; return true;
  }
  function install(s, place, fixtureId, now) {
    if (s.plant || !place?.siteId || !place.worldId || !fixtureId || !Number.isFinite(now)) return false;
    s.plant = { ...copy(place), fixtureId, installedAt: now, cleanL: 0, rejectL: 0, rawL: 0, sourceId: '', filter: null, batch: null, serial: 0 };
    s.history.push({ at: now, kind: 'installed', fixtureId }); return true;
  }
  function loadFilter(s, stackId, now) {
    const p = s.plant; if (!p || p.batch || !stackId) return false;
    const old = p.filter && copy(p.filter); p.filter = { id: `${stackId}:installed`, stackId, remaining: 25, at: now }; return { old };
  }
  function collect(s, node, canId, now) {
    if (!canId || !node?.inspected || node.quality !== 'filterable' || node.litres < 5 || vessel(s, canId).litres) return false;
    node.litres -= 5; setVessel(s, canId, 5, 'raw', node.id);
    s.history.push({ at: now, kind: 'collected', nodeId: node.id, canId, litres: 5 }); return true;
  }
  function load(s, canId, now) {
    const p = s.plant, v = vessel(s, canId);
    if (!p || p.rawL || p.batch || v.kind !== 'raw' || v.litres !== 5
      || !Object.values(s.sites).some(t => t.worldId === p.worldId && t.nodes.some(n => n.id === v.sourceId && n.quality === 'filterable' && n.inspected))) return false;
    p.rawL = 5; p.sourceId = v.sourceId; setVessel(s, canId, 0, 'empty');
    s.history.push({ at: now, kind: 'loaded', canId, sourceId: p.sourceId, litres: 5 }); return true;
  }
  function treatmentReason(s) {
    const p = s.plant;
    return !p || p.rawL !== 5 ? 'Load five actual litres of inspected filterable raw water.'
      : !p.filter || p.filter.remaining + 1e-8 < 5 * (1 - (p.batch?.fraction || 0)) ? 'The original installed cartridge lacks the remaining rated capacity.'
        : p.cleanL > 16 || p.rejectL >= 5 ? 'The twenty-litre clean tank and five-litre reject tank need space for the whole batch.' : '';
  }
  function beginBatch(s) {
    if (treatmentReason(s)) return false;
    const p = s.plant;
    if (!p.batch) p.batch = { id: `${p.fixtureId}:batch-${++p.serial}`, filterId: p.filter.id, sourceId: p.sourceId, fraction: 0, filterStart: p.filter.remaining };
    return p.batch.filterId === p.filter.id;
  }
  function creditBatch(s, fraction) {
    const p = s.plant, b = p?.batch;
    if (!b || treatmentReason(s) || b.filterId !== p.filter.id || fraction < b.fraction || fraction > 1) return false;
    b.fraction = fraction; p.filter.remaining = Math.max(0, b.filterStart - 5 * fraction); return true;
  }
  function finishBatch(s, now) {
    const p = s.plant, b = p?.batch;
    if (!b || b.fraction < 1 || treatmentReason(s) || b.filterId !== p.filter.id) return false;
    p.rawL = 0; p.cleanL += 4; p.rejectL++; p.sourceId = ''; p.batch = null;
    s.history.push({ at: now, kind: 'treated', batchId: b.id, sourceId: b.sourceId, filterId: b.filterId, rawL: 5, cleanL: 4, rejectL: 1 }); return true;
  }
  function drink(s, now, actorId) {
    if (!(s.plant?.cleanL >= 1)) return false;
    s.plant.cleanL--; s.history.push({ at: now, kind: 'drank', actorId, litres: 1 }); return true;
  }
  function drain(s, canId, now) {
    if (!s.plant?.rejectL || vessel(s, canId).litres) return false;
    const litres = Math.min(5, s.plant.rejectL); s.plant.rejectL -= litres; setVessel(s, canId, litres, 'reject', s.plant.fixtureId);
    s.history.push({ at: now, kind: 'rejectCollected', canId, litres }); return true;
  }
  function observe(s, key, value, now) { s.reports[key] = { at: now, ...copy(value) }; }
  function job(s, kind, token, totalSeconds, now, binding = {}) {
    const from = Math.max(0, Math.min(1, s.efforts[token] || 0));
    return { ...copy(binding), kind, token, from, progress: 0, required: Math.max(1, totalSeconds * (1 - from)), lastAt: now, attended: false, status: 'working' };
  }
  function advance(s, j, now, attended, alive = true) {
    if (!j || j.status !== 'working' || !alive || !Number.isFinite(now) || now < j.lastAt) return 0;
    const delta = attended && j.attended ? Math.max(0, Math.min(now - j.lastAt, j.required - j.progress)) : 0;
    j.lastAt = now; j.attended = Boolean(attended); j.progress += delta;
    if (delta) s.efforts[j.token] = j.from + (1 - j.from) * j.progress / j.required;
    return delta;
  }
  function finish(s, j) {
    if (j.status !== 'working' || j.progress < j.required) return false;
    j.status = 'completed'; delete s.efforts[j.token]; return true;
  }
  return { COSTS, SECONDS, create, site, same, vessel, setVessel, inspect, install, loadFilter, collect, load, treatmentReason,
    beginBatch, creditBatch, finishBatch, drink, drain, observe, job, advance, finish };
});
