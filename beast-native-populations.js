// Population-owned local encounters. Health assessment is deliberately separate.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./beast-habitat-sources') : root.HelixBeastHabitatSources,
    node ? require('./beast-populations') : root.HelixBeastPopulations,
    node ? require('./beast-regional-foodweb') : root.HelixBeastRegionalFoodweb,
    node ? require('./beast-bodies') : root.HelixBeastBodies,
    node ? require('./beast-seasonal-journeys') : root.HelixBeastSeasonalJourneys);
  if (node) module.exports = api; root.HelixBeastNativePopulations = api;
})(globalThis, function (Sources, P, Food, Bodies, Journeys) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x)), cache = new WeakMap();
  const capacity = record => ({ supported: Array.isArray(record?.patchRows) && Boolean(record.physicalBinding),
    patches: record?.patchRows?.length || 0, execution: 'deferredIndependentRegions' });
  function snapshot(value) {
    return Object.fromEntries(Object.entries(value).map(([key, part]) => [key,
      Array.isArray(part) ? { array: part.map(p => JSON.stringify(p)) }
        : part && typeof part === 'object' ? { object: Object.fromEntries(Object.entries(part).map(([k, p]) => [k, JSON.stringify(p)])) }
          : { scalar: JSON.stringify(part) }]));
  }
  function changes(base, value) {
    const out = [];
    for (const key of Object.keys(base)) if (!Object.hasOwn(value, key)) out.push([[key]]);
    for (const [key, part] of Object.entries(value)) {
      const old = base[key];
      if (!old) { out.push([[key], copy(part)]); continue; }
      if (old.array && Array.isArray(part) && old.array.length === part.length)
        part.forEach((p, i) => diff(JSON.parse(old.array[i]), copy(p), [key, String(i)], out));
      else if (old.object && part && typeof part === 'object' && !Array.isArray(part)) {
        for (const k of Object.keys(old.object)) if (!Object.hasOwn(part, k)) out.push([[key, k]]);
        for (const [k, p] of Object.entries(part)) {
          if (!Object.hasOwn(old.object, k)) out.push([[key, k], copy(p)]);
          else diff(JSON.parse(old.object[k]), copy(p), [key, k], out);
        }
      } else diff(old.array ? old.array.map(JSON.parse) : old.object ? Object.fromEntries(Object.entries(old.object).map(([k, p]) => [k, JSON.parse(p)])) : JSON.parse(old.scalar), copy(part), [key], out);
    }
    return out;
  }
  function create(record, binding) {
    if (!record?.physicalBinding || !binding?.worldId || !binding.runId) throw Error('Native encounters require an original source and run');
    return { ...binding, sourceId: record.id, clock: 0, ecology: 'unverified', deferredHabitats: true, patch: [], sites: {}, parcels: {} };
  }
  function normalize(value, binding) {
    if (!value) return null;
    if (!value.worldId || !value.runId || !value.sourceId || !Number.isFinite(value.clock) || value.clock < 0
      || value.deferredHabitats != null && typeof value.deferredHabitats !== 'boolean'
      || !Array.isArray(value.patch) || value.deltaTree != null && (typeof value.deltaTree !== 'object'
        || Array.isArray(value.deltaTree) || value.patch.length)
      || !value.sites || Array.isArray(value.sites)
      || binding && (value.worldId !== binding.worldId || value.runId !== binding.runId))
      throw Error('Native population binding is invalid');
    const result = copy(value); result.parcels ||= {}; result.ecology = 'unverified';
    for (const p of Object.values(result.parcels)) if (!p?.sourceRegionId || !(p.areaHa > 0) || !p.resources
      || !Object.values(p.resources).every(n => Number.isFinite(n) && n >= 0)
      || p.materialKg !== (p.resources.mineralsKg || 0)) throw Error('Invalid native terrain custody');
    for (const site of Object.values(result.sites)) if (!site?.cellId
      || !['surface', 'wetland', 'shore', 'waterColumn', 'subsurface'].includes(site.kind)
      || !['eastM', 'northM'].every(k => Number.isFinite(site.origin?.[k]))
      || Object.values(site.parcelIds || {}).some(id => !Object.hasOwn(result.parcels, id))) throw Error('Invalid native site binding');
    return result;
  }
  function checkSite(state, site) {
    const old = state.sites[site.id], origin = { eastM: 0, northM: 0, ...site.origin };
    if (old && (old.cellId !== site.cellId || old.kind !== site.kind
      || old.origin.eastM !== origin.eastM || old.origin.northM !== origin.northM)) throw Error('A native site cannot relocate its original geographic window');
  }
  // Sparse changes against the reproducible original account, not an expanded
  // second copy of immutable habitat, wildlife definitions or actor templates.
  function diff(a, b, path = [], out = []) {
    if (a === b) return out;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)
      || Array.isArray(a) && a.length !== b.length) { out.push([path, copy(b)]); return out; }
    for (const key of Object.keys(a)) if (!Object.hasOwn(b, key)) out.push([[...path, key]]);
    for (const key of Object.keys(b)) {
      if (!Object.hasOwn(a, key)) out.push([[...path, key], copy(b[key])]); else diff(a[key], b[key], [...path, key], out);
    }
    return out;
  }
  function apply(base, patch) {
    for (const row of patch) {
      if (!Array.isArray(row) || !Array.isArray(row[0]) || !row[0].length || row[0].some(k =>
        typeof k !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(k))) throw Error('Invalid population delta');
      const path = row[0], last = path.at(-1); let target = base;
      for (const k of path.slice(0, -1)) { if (!Object.hasOwn(target, k) || !target[k] || typeof target[k] !== 'object') throw Error('Missing population delta parent'); target = target[k]; }
      if (row.length === 1) delete target[last]; else if (row.length === 2)
        Object.defineProperty(target, last, { value: copy(row[1]), writable: true, enumerable: true, configurable: true });
      else throw Error('Invalid population delta value');
    }
    return base;
  }
  // Share path prefixes without quantizing numbers or omitting earned state.
  // A leaf [] deletes; [value] assigns, including arrays/objects as values.
  function compactPatch(rows) {
    const tree = Object.create(null);
    for (const row of rows) {
      const path = row[0]; let node = tree;
      for (const key of path.slice(0, -1)) node = node[key] ||= Object.create(null);
      node[path.at(-1)] = row.slice(1);
    }
    return tree;
  }
  function applyTree(base, tree, path = []) {
    if (!tree || typeof tree !== 'object' || Array.isArray(tree)) throw Error('Invalid population delta tree');
    for (const [key, value] of Object.entries(tree)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw Error('Invalid population delta path');
      const child = [...path, key];
      if (Array.isArray(value)) apply(base, [[child, ...value]]);
      else applyTree(base, value, child);
    }
    return base;
  }
  function open(state, record, map) {
    if (state.sourceId !== record.id) throw Error('Native encounters cannot change their original world source');
    if (state.deltaTree && state.patch.length) throw Error('Ambiguous native population history');
    if (!capacity(record).supported) throw Error('Native encounters require original physical habitats');
    if (cache.has(state)) return cache.get(state).account;
    // Existing bounded saves keep their eager baseline/delta meaning. This is
    // a storage strategy, not a regeneration or a change to their originals.
    const source = Sources.runtimeSource(record, map, { deferUnused: state.deferredHabitats === true }), binding = { worldId: state.worldId, runId: state.runId };
    const initial = P.create(source, binding), baseline = snapshot(initial);
    const originalCounts = JSON.stringify(initial.originalCounts);
    const account = state.patch.length || state.deltaTree
      ? P.normalize(state.deltaTree ? applyTree(initial, state.deltaTree) : apply(initial, state.patch), binding, initial._deferredLoader) : initial;
    if (!account || account.sourceId !== record.id || account.clock !== state.clock
      || JSON.stringify(account.originalCounts) !== originalCounts || account.nativeEncounters !== true) throw Error('Native population history is invalid');
    for (const [id, origin] of Object.entries(baseline.origins.object))
      if (JSON.stringify(account.origins[id]) !== origin) throw Error('Original creature identity was changed');
    cache.set(state, { account, baseline }); return account;
  }
  function pack(state, record, map) {
    // An unopened restored account has no new kernel changes. Saving it need
    // not synchronously initialize an entire source before the loading UI paints.
    if (!cache.has(state)) return state;
    const account = open(state, record, map), entry = cache.get(state);
    state.clock = account.clock;
    const rows = changes(entry.baseline, account);
    state.patch = [];
    if (rows.length) state.deltaTree = compactPatch(rows); else delete state.deltaTree;
    return state;
  }
  const hasOpen = state => cache.has(state);
  const ready = (state, at) => (cache.get(state)?.account.clock ?? -1) >= at;
  function advanceBudget(state, record, map, at, budget = 32) {
    const account = open(state, record, map);
    if (account.clock >= at) return true;
    const done = P.advanceBudget(account, at, budget); state.clock = account.clock;
    advanceRemains(account); return done;
  }
  async function prepare(state, record, map, at, options = {}) {
    const wait = options.yield || (() => new Promise(resolve => setTimeout(resolve, 0)));
    await wait(); // Let the real paused/loading state paint before initialization.
    do {
      if (options.continue && !options.continue()) return false;
      if (advanceBudget(state, record, map, at, options.budget || 32)) return true;
      await wait();
    } while (true);
  }
  function rebind(value, from, to) {
    if (!value) return null;
    const s = normalize(value, from);
    for (const key of ['worldId', 'runId']) if (s.deltaTree?.[key]) s.deltaTree[key] = [to[key]];
    return { ...s, ...to, patch: s.patch.map(row => {
      if (row[0].length === 1 && ['worldId', 'runId'].includes(row[0][0])) return [row[0], to[row[0][0]]];
      return row;
    }) };
  }
  function intersects(a, b) { return a && a.max.eastM >= b.x0 && a.min.eastM <= b.x1 && a.max.northM >= b.y0 && a.min.northM <= b.y1; }
  function mineralOwner(p) {
    Object.defineProperty(p, 'materialKg', { enumerable: true, configurable: true,
      get() { return this.resources.mineralsKg || 0; }, set(n) { this.resources.mineralsKg = n; } });
    return p;
  }
  function nearby(g, c, r, box, limit = 8) {
    const result = [], pending = c.ranges.map(range => [...range]); let queries = 0;
    while (pending.length && result.length < limit && queries++ < 4096) {
      const [lo, hi] = pending.pop();
      if (!intersects(Food.bounds(g, r, { ...c, ranges: [[lo, hi]] }), box)) continue;
      if (hi - lo === 1) { result.push(lo); continue; }
      const mid = Math.floor((lo + hi) / 2); pending.push([mid, hi], [lo, mid]);
    }
    return result;
  }
  function materialize(state, record, map, site, context) {
    if (!context.alive || !context.local) return [];
    checkSite(state, site);
    const s = open(state, record, map), regions = s.regions.filter(r => r.cellId === site.cellId && r.kind === site.kind);
    if (!regions.length) return [];
    P.settleRegions(s, context.at, regions.map(r => r.id)); state.clock = s.clock;
    const frame = { eastM: 0, northM: 0, ...site.origin }, tile = context.tileSizeM || 1, b = site.bounds;
    const box = { x0: frame.eastM, x1: frame.eastM + b.width * tile, y0: frame.northM, y1: frame.northM + b.height * tile };
    const actors = Object.values(s.details).filter(d => {
      const n = d.actor?.nativePopulation;
      if (!n) return false;
      if (!n.background) return n.siteId === site.id && d.actor.roomId === site.roomId;
      return d.status === 'dead' && regions.some(r => r.id === n.regionId) && n.sourcePosition
        && n.sourcePosition.eastM >= box.x0 && n.sourcePosition.eastM < box.x1
        && n.sourcePosition.northM >= box.y0 && n.sourcePosition.northM < box.y1
        && P.claimCorpse(s, d.actorId, context.at);
    }).map(d => {
      const a = d.actor, n = a.nativePopulation;
      if (d.status === 'dead' && n.background) a.mapCell = { x: b.x + Math.floor((n.sourcePosition.eastM - frame.eastM) / tile),
        y: b.y + Math.floor((n.sourcePosition.northM - frame.northM) / tile), z: b.z };
      a.roomId = site.roomId; Object.assign(n, { siteId: site.id, frame: copy(frame), bounds: copy(b), tileSizeM: tile, background: false });
      return a;
    }), byId = new Map(regions.map(r => [r.id, r]));
    const groups = [...s.groups].sort((a, b) => Number(b.cohorts.some(c => c.personalActor)) - Number(a.cohorts.some(c => c.personalActor)));
    for (const g of groups) {
      if (context.unavailablePopulations?.has(g.populationId)) continue;
      const r = byId.get(Journeys.location(g)); if (!r) continue;
      const cohorts = [...g.cohorts].sort((a, b) => Number(Boolean(b.personalActor)) - Number(Boolean(a.personalActor)));
      for (const c of cohorts) for (const ordinal of nearby(g, c, r, box)) {
        const memberId = `${c.originId}:${ordinal}`, actorId = c.personalActor?.id || `native:${record.id}:${memberId}`;
        if (s.details[actorId] || actors.length >= (context.limit || 8)) continue;
        const modes = Bodies.profiles[g.speciesId].modes;
        let point;
        const originalPosition = (group, cohort, ordinal) => {
          point = Food.position(group, r, cohort, ordinal);
          if (!point || point.eastM < box.x0 || point.eastM >= box.x1 || point.northM < box.y0 || point.northM >= box.y1
            || point.altitudeM < 0 && modes.every(m => ['flight', 'levitation'].includes(m))) return null;
          const cell = { x: b.x + Math.floor((point.eastM - frame.eastM) / tile), y: b.y + Math.floor((point.northM - frame.northM) / tile), z: b.z };
          const mode = point.altitudeM > 0 && modes.some(m => ['flight', 'levitation'].includes(m))
            ? modes.find(m => ['flight', 'levitation'].includes(m))
            : (r.kind === 'waterColumn' || r.kind === 'wetland') && modes.some(m => ['swimming', 'drifting'].includes(m))
              ? modes.find(m => ['swimming', 'drifting'].includes(m))
              : r.kind === 'subsurface' ? 'burrowing' : modes.includes('walking') ? 'walking' : 'grounded';
          return { regionId: r.id, cell, altitudeM: point.altitudeM, mode };
        };
        const actor = P.claimLocal(s, g.id, c.id, ordinal, actorId, context.at, {
          ...context, blocked: (cell, low, high, body) => context.blocked?.(cell, low, high, body)
            || actors.some(a => Bodies.occupied(a, tile).some(c => c.x === cell.x && c.y === cell.y && c.z === cell.z)
              && a.bodyPhysics.altitudeM < high && a.bodyPhysics.altitudeM + a.bodyPhysics.dimensions.heightM > low),
          originalPosition,
          originalReserves: (_, cohort) => cohort.regional && ({ mana: cohort.regional.mana, stamina: cohort.regional.stamina, energy: copy(cohort.regional.energy) }) });
        if (!actor) continue;
        actor.roomId = site.roomId; actor.nativePopulation = { sourceId: record.id, regionId: r.id, siteId: site.id,
          sourcePosition: copy(point), frame: copy(frame), bounds: copy(b), tileSizeM: tile, background: false };
        actors.push(actor);
      }
    }
    state.sites[site.id] ||= { cellId: site.cellId, kind: site.kind, origin: copy(frame) };
    return actors;
  }
  function terrain(state, record, map, site, cells, at, tile = 1) {
    if (!Number.isFinite(at) || at < state.clock || !Number.isFinite(tile) || tile <= 0)
      throw Error('Native terrain requires current time and a real tile area');
    checkSite(state, site);
    const s = open(state, record, map), r = s.regions.find(r => r.cellId === site.cellId && r.kind === site.kind);
    if (!r) return {};
    P.settleRegions(s, at, [r.id]); state.clock = s.clock;
    const origin = { eastM: 0, northM: 0, ...site.origin }, area = tile * tile, totals = {}, result = {}, parcelIds = {};
    const reserved = {};
    for (const site of r.ecology?.renewalSites || []) if (site.destroyedAt == null)
      for (const [k, n] of Object.entries(site.materials)) reserved[k] = (reserved[k] || 0) + n;
    for (const c of cells) {
      const east = origin.eastM + (c.x - site.bounds.x) * tile, north = origin.northM + (c.y - site.bounds.y) * tile;
      if (Math.hypot(east + tile / 2, north + tile / 2) > Math.sqrt(r.areaHa * 10000 / Math.PI)) continue;
      const id = `${r.id}:${east}:${north}:${tile}`, key = `${c.x},${c.y},${c.z}`;
      parcelIds[key] = id;
      if (state.parcels[id]) { result[key] = mineralOwner(state.parcels[id]); continue; }
      const resources = {};
      for (const [k, amount] of Object.entries(r.stocks)) {
        if (k.includes(':')) continue; // Reserved workfaces are not uniform terrain.
        const available = Math.max(0, amount - (reserved[k] || 0));
        const moved = Math.min(available - (totals[k] || 0), available * area / (r.areaHa * 10000));
        if (moved > 0) { resources[k] = moved; totals[k] = (totals[k] || 0) + moved; }
      }
      const wet = ['wetland', 'waterColumn'].includes(r.kind), sea = r.kind === 'waterColumn';
      const p = { sourceRegionId: r.id, resources, transfers: {}, areaHa: area / 10000, condition: copy(r.condition),
        floor: r.floor, oxygen: r.oxygen, waterKind: sea ? 'seawater' : 'freshwater', waterAccounted: wet,
        waterDepthM: wet ? (resources[sea ? 'seawaterL' : 'waterL'] || 0) / (area * 1000) : 0,
        soilDepthM: r.accessibleMineralDepthM || 0, densityKgM3: r.densityKgM3, materialKg: resources.mineralsKg || 0,
        hardness: 1, supportKg: Math.max(1, (resources.mineralsKg || 0) * 10), ...(r.wind ? { wind: copy(r.wind) } : {}),
        humidity: r.humidity, temperatureC: r.seasons[P.monthAt(s.calendar, at).season].temperatureC };
      state.parcels[id] = mineralOwner(p); result[key] = p;
    }
    for (const [key, amount] of Object.entries(totals))
      if (!P.removeStock(s, r.id, key, amount, at, 'native-local-terrain-custody')) throw Error('Native terrain transfer was not funded');
    state.sites[site.id] = { cellId: site.cellId, kind: site.kind, origin: copy(origin),
      parcelIds: { ...state.sites[site.id]?.parcelIds, ...parcelIds } };
    return result;
  }
  function bindTerrain(state, siteId) {
    return Object.fromEntries(Object.entries(state.sites[siteId]?.parcelIds || {}).map(([key, id]) => [key, mineralOwner(state.parcels[id])]));
  }
  function birth(state, record, map, parent, child, at) {
    const s = open(state, record, map), detail = s.details[parent.id];
    if (!detail || detail.memberId !== parent.life.originalMemberId) return false;
    detail.actor = parent;
    if (!P.registerLocalBirth(s, parent.id, child, at)) return false;
    child.nativePopulation = copy(parent.nativePopulation); state.clock = s.clock; return true;
  }
  function advanceRemains(s) {
    // The regional food web owns the matter; refresh only the private corpse
    // representation after its regular event processing.
    for (const d of Object.values(s.details)) if (d.regionalCorpse && d.actor?.nativePopulation?.background) {
      const r = s.regions.find(r => r.id === d.regionId), row = r.remainsBatches?.[d.remainsKey], a = d.actor;
      a.nativePopulation.corpseGone = !row || row.massKg <= 1e-8;
      if (row && row.massKg > 1e-8) {
        const loss = s.losses.find(l => l.memberId === d.memberId);
        a.life.remains = { ...copy(row), massKgAtDeath: loss.massKg }; a.bodyPhysics.massKg = row.massKg;
        a.nativePopulation.sourcePosition = copy(row.position);
      }
    }
  }
  function sync(state, record, map, actors, at, alive = true, locality = null) {
    if (!alive) return false;
    const s = open(state, record, map);
    for (const actor of actors) {
      if (!actor.nativePopulation) continue;
      const d = s.details[actor.id];
      if (actor.nativePopulation.background) continue;
      if (!d || d.memberId !== actor.life?.originalMemberId || actor.nativePopulation.sourceId !== record.id) throw Error('Local body lost its original population claim');
      d.actor = actor;
      if (actor.status === 'dead' && d.status !== 'dead') P.settleLocalLoss(s, actor.id, Math.max(at, s.clock), 'native-physical-death');
    }
    if (locality) for (const d of Object.values(s.details)) {
      const a = d.actor, n = a?.nativePopulation;
      if (!n || n.background || locality.activeSiteIds?.has(n.siteId) || locality.retainedActorIds?.has(a.id)) continue;
      if (!a.mapCell || at < s.clock) continue;
      const tile = n.tileSizeM || 1;
      const pos = { regionId: n.regionId, eastM: n.frame.eastM + (a.mapCell.x - n.bounds.x + .5) * tile,
        northM: n.frame.northM + (a.mapCell.y - n.bounds.y + .5) * tile, altitudeM: a.bodyPhysics.altitudeM };
      // Keep sub-tile precision for an original that hasn't changed cells.
      for (const [key, cell, origin] of [['eastM', 'x', n.frame.eastM], ['northM', 'y', n.frame.northM]])
        if (Math.floor((n.sourcePosition?.[key] - origin) / tile) === a.mapCell[cell] - n.bounds[cell]) pos[key] = n.sourcePosition[key];
      if (d.status === 'dead') {
        if (!P.releaseCorpse(s, a.id, at, pos)) throw Error('Original corpse could not transfer its remaining matter');
        n.background = true; n.sourcePosition = pos; continue;
      }
      if (!P.returnLocal(s, a.id, at, pos)) throw Error('Original local body could not return to background ownership');
      n.background = true;
    }
    state.clock = s.clock; return true;
  }
  const ownsLocal = (state, actorId) => {
    const d = cache.get(state)?.account.details[actorId]; return Boolean(d && !d.actor?.nativePopulation?.background);
  };
  const hasLocalActors = state => Object.values(cache.get(state)?.account.details || {}).some(d => d.actor?.nativePopulation && !d.actor.nativePopulation.background);
  return { create, normalize, open, pack, rebind, materialize, sync, nearby, terrain, bindTerrain, birth, capacity, diff, apply,
    hasOpen, ready, prepare, advanceBudget, ownsLocal, hasLocalActors };
});
