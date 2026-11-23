// Population-owned local encounters. Health assessment is deliberately separate.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./beast-habitat-sources') : root.HelixBeastHabitatSources,
    node ? require('./beast-populations') : root.HelixBeastPopulations,
    node ? require('./beast-regional-foodweb') : root.HelixBeastRegionalFoodweb,
    node ? require('./beast-bodies') : root.HelixBeastBodies,
    node ? require('./beast-seasonal-journeys') : root.HelixBeastSeasonalJourneys,
    node ? require('./wildlife-carcasses') : root.HelixWildlifeCarcasses,
    node ? require('./foreign-wilderness') : root.HelixForeignWilderness,
    node ? require('./strategic-world') : root.HelixStrategicWorld);
  if (node) module.exports = api; root.HelixBeastNativePopulations = api;
})(globalThis, function (Sources, P, Food, Bodies, Journeys, Carcasses, Foreign, World) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x)), cache = new WeakMap();
  const coverValue = n => Number.isFinite(n) && n >= 0 && n <= 100;
  const clampCover = n => Math.max(0, Math.min(100, n));
  const regionalCover = r => r?.floor && ['surface', 'shore'].includes(r.kind) && coverValue(r.condition?.soilCover)
    ? r.condition.soilCover : undefined;
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
    return { ...binding, sourceId: record.id, clock: 0, ecology: 'unverified', deferredHabitats: true, patch: [], sites: {}, parcels: {}, encounterClaims: [] };
  }
  function normalize(value, binding) {
    if (!value) return null;
    if (!value.worldId || !value.runId || !value.sourceId || !Number.isFinite(value.clock) || value.clock < 0
      || value.deferredHabitats != null && typeof value.deferredHabitats !== 'boolean'
      || !Array.isArray(value.patch) || value.deltaTree != null && (typeof value.deltaTree !== 'object'
        || Array.isArray(value.deltaTree) || value.patch.length)
      || !value.sites || Array.isArray(value.sites)
      || value.encounterClaims != null && (!Array.isArray(value.encounterClaims)
        || value.encounterClaims.some(id => typeof id !== 'string' || !id)
        || new Set(value.encounterClaims).size !== value.encounterClaims.length)
      || binding && (value.worldId !== binding.worldId || value.runId !== binding.runId))
      throw Error('Native population binding is invalid');
    const result = copy(value); result.parcels ||= {}; result.ecology = 'unverified';
    if (result.windSchedules != null && (typeof result.windSchedules !== 'object' || Array.isArray(result.windSchedules)
      || Object.values(result.windSchedules).some(s => !Number.isFinite(s?.calendar?.epochAt)
        || !Array.isArray(s.calendar.monthDays) || !s.calendar.monthDays.length
        || s.calendar.monthDays.some(n => !Number.isFinite(n) || n <= 0)
        || !Array.isArray(s.vectors) || s.vectors.length !== s.calendar.monthDays.length
        || s.vectors.some(v => !Number.isFinite(v?.x) || !Number.isFinite(v?.y)))))
      throw Error('Invalid native seasonal wind');
    for (const p of Object.values(result.parcels)) if (!p?.sourceRegionId || !(p.areaHa > 0) || !p.resources
      || !Object.values(p.resources).every(n => Number.isFinite(n) && n >= 0)
      || p.soilCoverHistory != null && (!p.floor || !coverValue(p.condition?.soilCover)
        || !coverValue(p.soilCoverHistory.baseline) || !coverValue(p.soilCoverHistory.ambient)
        || !Number.isFinite(p.soilCoverHistory.local) || Math.abs(p.soilCoverHistory.local) > 100)
      || p.materialKg !== (p.resources.mineralsKg || 0)) throw Error('Invalid native terrain custody');
    for (const site of Object.values(result.sites)) if (!site?.cellId
      || !['surface', 'wetland', 'shore', 'waterColumn', 'subsurface'].includes(site.kind)
      || site.wetlandBank != null && (site.kind !== 'surface' || !Foreign.validBank(site.wetlandBank))
      || site.coast != null && (site.kind !== 'shore' || site.cellId !== site.coast.landCellId || !Foreign.validCoast(site.coast))
      || site.mouth != null && (site.kind !== 'surface' || site.cellId !== site.mouth.cellId || !Foreign.validMouth(site.mouth) || site.wetlandBank)
      || site.soilCoverAttended != null && site.soilCoverAttended !== true
      || !['eastM', 'northM'].every(k => Number.isFinite(site.origin?.[k]))
      || Object.values(site.parcelIds || {}).some(id => !Object.hasOwn(result.parcels, id))) throw Error('Invalid native site binding');
    return result;
  }
  function encounteredPopulationIds(state) {
    if (!state) return [];
    if (!state.encounterClaims) {
      // Older saves already store full native actors in details or returned
      // personal cohorts. Recover only exact claims without opening the globe
      // or treating an elapsed ecological baseline as an encounter.
      const ids = new Set(), stack = state.deltaTree
        ? [state.deltaTree.details, state.deltaTree.groups]
        : state.patch.filter(([path]) => ['details', 'groups'].includes(path[0])).map(row => row[1]);
      while (stack.length) {
        const row = stack.pop();
        if (!row || typeof row !== 'object') continue;
        if (row.nativePopulation?.sourceId === state.sourceId && row.life?.originalMemberId && typeof row.populationId === 'string') {
          ids.add(row.populationId); continue;
        }
        for (const value of Object.values(row)) if (value && typeof value === 'object') stack.push(value);
      }
      state.encounterClaims = [...ids].sort();
    }
    return state.encounterClaims;
  }
  function checkSite(state, site) {
    const old = state.sites[site.id], origin = { eastM: 0, northM: 0, ...site.origin };
    if (site.wetlandBank != null && (site.kind !== 'surface' || !Foreign.validBank(site.wetlandBank)))
      throw Error('Invalid native wetland bank');
    if (site.coast != null && (site.kind !== 'shore' || site.cellId !== site.coast.landCellId || !Foreign.validCoast(site.coast)))
      throw Error('Invalid native shoreline');
    if (site.mouth != null && (site.kind !== 'surface' || site.cellId !== site.mouth.cellId || !Foreign.validMouth(site.mouth) || site.wetlandBank))
      throw Error('Invalid native burrow mouth');
    if (old && (old.cellId !== site.cellId || old.kind !== site.kind
      || old.origin.eastM !== origin.eastM || old.origin.northM !== origin.northM
      || ['radiusM', 'edgeEastM', 'accessNorthM'].some(k => old.wetlandBank?.[k] !== site.wetlandBank?.[k])
      || !sameCoast(old.coast, site.coast) || !sameMouth(old.mouth, site.mouth)))
      throw Error('A native site cannot relocate its original geographic window');
  }
  const sameCoast = (a, b) => ['landCellId', 'seaCellId', 'axis', 'eastM', 'northM'].every(k => a?.[k] === b?.[k]);
  const sameMouth = (a, b) => ['cellId', 'eastM', 'northM'].every(k => a?.[k] === b?.[k]);
  const siteRecord = (site, origin) => ({ cellId: site.cellId, kind: site.kind, origin: copy(origin),
    ...(site.wetlandBank ? { wetlandBank: copy(site.wetlandBank) } : {}), ...(site.coast ? { coast: copy(site.coast) } : {}),
    ...(site.mouth ? { mouth: copy(site.mouth) } : {}) });
  function siteRegions(state, s, site, map, record) {
    const primary = habitat(state, s, site);
    const bank = site.wetlandBank && habitat(state, s, { ...site, kind: 'wetland' });
    if (site.wetlandBank && (!bank || bank.source?.catchmentPond
      || Math.abs(Math.sqrt(bank.areaHa * 10000 / Math.PI) - site.wetlandBank.radiusM) > 1e-6))
      throw Error('Wetland bank must match an original mapped wetland');
    const sea = site.coast && habitat(state, s, { cellId: site.coast.seaCellId, kind: 'waterColumn' });
    if (site.coast) {
      const entry = cache.get(state);
      entry.coastalGeography ||= new Map();
      if (!entry.coastalGeography.has(site.cellId)) entry.coastalGeography.set(site.cellId, Foreign.coastForLand(map, World.cellIndex(site.cellId), record));
      if (!sea || !primary || !sameCoast(site.coast, entry.coastalGeography.get(site.cellId)))
        throw Error('A shoreline must match its original mapped land and sea accounts');
    }
    const burrow = site.mouth && habitat(state, s, { ...site, kind: 'subsurface' });
    if (site.mouth) {
      const entry = cache.get(state);
      entry.mouthGeography ||= new Map();
      if (!entry.mouthGeography.has(site.cellId))
        entry.mouthGeography.set(site.cellId, Foreign.mouthReference(map, World.cellIndex(site.cellId), burrow?.areaHa));
      if (!primary || !burrow || !sameMouth(site.mouth, entry.mouthGeography.get(site.cellId)))
        throw Error('A burrow mouth must match its original mapped geology');
    }
    return [primary, bank, sea, burrow].filter(Boolean);
  }
  const hasSeam = site => Boolean(site.coast || site.wetlandBank || site.mouth);
  function checkMouthFrame(site, tile) {
    if (!site.mouth) return;
    const frame = Foreign.mouthFrame(site, tile);
    if (frame.eastM !== site.origin?.eastM || frame.northM !== site.origin?.northM)
      throw Error('The burrow mouth window must use its original metre frame');
  }
  const marineFrame = (site, tile) => site.coast && Foreign.coastSeaFrame(site.coast, site.bounds, tile);
  function windowBox(frame, bounds, tile) {
    const corners = [Foreign.offset(frame, 0, 0), Foreign.offset(frame, bounds.width * tile, 0),
      Foreign.offset(frame, 0, bounds.height * tile), Foreign.offset(frame, bounds.width * tile, bounds.height * tile)];
    return { x0: Math.min(...corners.map(p => p.eastM)), x1: Math.max(...corners.map(p => p.eastM)),
      y0: Math.min(...corners.map(p => p.northM)), y1: Math.max(...corners.map(p => p.northM)) };
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
  function mineralOwner(p, state) {
    Object.defineProperty(p, 'materialKg', { enumerable: true, configurable: true,
      get() { return this.resources.mineralsKg || 0; }, set(n) { this.resources.mineralsKg = n; } });
    // Keep a single saved schedule per visited region, not a copy per tile.
    const schedule = state.windSchedules?.[p.sourceRegionId];
    if (schedule && p.windSchedule !== schedule) Object.defineProperty(p, 'windSchedule', { configurable: true, value: schedule });
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
  const reservesFor = (_, cohort) => cohort.regional && ({ mana: cohort.regional.mana, stamina: cohort.regional.stamina, energy: copy(cohort.regional.energy) });
  // Only reached ground is probed, never an animal's future road kilometre.
  // Settlement is earned simulation time; the candidate has no custody or
  // observation record until its pose fits and the traveller can perceive it.
  function roadsideProbe(state, record, map, site, context) {
    if (!context.alive || !context.local || !hasOpen(state)) return null;
    const s = open(state, record, map), r = habitat(state, s, site);
    if (!r || !P.advance(s, context.at)) return null;
    state.clock = s.clock;
    const b = site.bounds, tile = context.tileSizeM || 1, { eastM, northM } = site.origin;
    const box = { x0: eastM, x1: eastM + b.width * tile, y0: northM, y1: northM + b.height * tile };
    const eligible = g => !context.unavailablePopulations?.has(g.populationId) && Bodies.profiles[g.speciesId]?.modes.includes('walking');
    // Scheduled movement is already current. Do not settle an entire habitat
    // for every empty road metre; read its recorded formation envelopes first.
    if (!P.groupsForRegion(s, r.id).some(g => eligible(g) && g.cohorts.some(c => intersects(Food.bounds(g, r, c), box)))
      || !P.settleRegions(s, context.at, [r.id])) return null;
    for (const g of P.groupsForRegion(s, r.id)) {
      if (!eligible(g)) continue;
      for (const c of g.cohorts) {
        if (c.contactBusyUntil > context.at) continue; // Do not interrupt an unseen body merely to test sight.
        for (const ordinal of nearby(g, c, r, box)) {
          const point = Food.position(g, r, c, ordinal);
          if (!point || point.altitudeM !== 0 || point.eastM < box.x0 || point.eastM >= box.x1 || point.northM < box.y0 || point.northM >= box.y1) continue;
          const id = c.personalActor?.id || `native:${record.id}:${c.originId}:${ordinal}`;
          if (s.details[id]) continue;
          const cell = { x: b.x + Math.floor((point.eastM - eastM) / tile), y: b.y + Math.floor((point.northM - northM) / tile), z: b.z };
          const pose = P.previewLocal(g, c, ordinal, id, context.at, {
            ...context, terrain: cell => context.terrain(cell, r), originalReserves: reservesFor
          }, { regionId: r.id, cell, altitudeM: 0, mode: 'walking' });
          if (pose && context.perceived(pose)) return id;
        }
      }
    }
    return null;
  }
  function materialize(state, record, map, site, context) {
    if (!context.alive || !context.local) return [];
    checkSite(state, site);
    checkMouthFrame(site, context.tileSizeM || 1);
    const s = open(state, record, map), regions = siteRegions(state, s, site, map, record);
    if (!regions.length) return [];
    P.settleRegions(s, context.at, regions.map(r => r.id)); state.clock = s.clock;
    const frame = { eastM: 0, northM: 0, ...site.origin }, tile = context.tileSizeM || 1, b = site.bounds, sea = marineFrame(site, tile);
    const positions = new Map(regions.map(r => {
      const f = r.kind === 'waterColumn' && sea || frame;
      return [r.id, { frame: f, box: windowBox(f, b, tile) }];
    }));
    const localCell = (point, f) => {
      const [x, y] = Foreign.relative(f, point.eastM, point.northM);
      return { x: b.x + Math.floor(x / tile), y: b.y + Math.floor(y / tile), z: b.z };
    };
    const inWindow = c => c.x >= b.x && c.x < b.x + b.width && c.y >= b.y && c.y < b.y + b.height;
    const remainsFit = (a, point, f) => !context.requireVisitedTerrain || Bodies.cells(a, localCell(point, f), tile).every(cell => {
      const t = context.terrain(cell);
      return (t?.floor || t?.fieldSeawater || t?.fieldBurrowMouth) && !t.protected && !t.foundation && !(t.obstacleHeightM > 0)
        && (!hasSeam(site) || t.sourceRegionId === point.regionId && t.waterDepthM >= -point.altitudeM);
    });
    const actors = Object.values(s.details).filter(d => {
      const n = d.actor?.nativePopulation;
      if (!n) return false;
      if (!n.background) return n.siteId === site.id && d.actor.roomId === site.roomId;
      const f = positions.get(n.regionId)?.frame;
      return !context.onlyActorId && !context.unavailablePopulations?.has(d.populationId)
        && d.status === 'dead' && f && n.sourcePosition && inWindow(localCell(n.sourcePosition, f)) && remainsFit(d.actor, n.sourcePosition, f)
        && P.claimCorpse(s, d.actorId, context.at);
    }).map(d => {
      const a = d.actor, n = a.nativePopulation;
      const f = positions.get(n.regionId)?.frame || frame;
      if (d.status === 'dead' && n.background) a.mapCell = localCell(n.sourcePosition, f);
      a.roomId = site.roomId; Object.assign(n, { siteId: site.id, frame: copy(f), bounds: copy(b), tileSizeM: tile, background: false });
      return a;
    }), byId = new Map(regions.map(r => [r.id, r]));
    const groups = [...s.groups].sort((a, b) => Number(b.cohorts.some(c => c.personalActor)) - Number(a.cohorts.some(c => c.personalActor)));
    for (const g of groups) {
      if (context.unavailablePopulations?.has(g.populationId)) continue;
      const r = byId.get(Journeys.location(g)); if (!r) continue;
      const { frame: f, box } = positions.get(r.id);
      const cohorts = [...g.cohorts].sort((a, b) => Number(Boolean(b.personalActor)) - Number(Boolean(a.personalActor)));
      for (const c of cohorts) for (const ordinal of nearby(g, c, r, box)) {
        const memberId = `${c.originId}:${ordinal}`, actorId = c.personalActor?.id || `native:${record.id}:${memberId}`;
        if (s.details[actorId] || context.onlyActorId && actorId !== context.onlyActorId || actors.length >= (context.limit || 8)) continue;
        const modes = Bodies.profiles[g.speciesId].modes;
        if (context.groundOnly && !modes.includes('walking')) continue;
        if (site.coast && r.kind === 'waterColumn' && !modes.some(m => ['swimming', 'drifting'].includes(m))) continue;
        let point;
        const originalPosition = (group, cohort, ordinal) => {
          point = Food.position(group, r, cohort, ordinal);
          if (!point || context.groundOnly && point.altitudeM !== 0
            || point.altitudeM < 0 && modes.every(m => ['flight', 'levitation'].includes(m))) return null;
          const cell = localCell(point, f); if (!inWindow(cell)) return null;
          const mode = point.altitudeM > 0 && modes.some(m => ['flight', 'levitation'].includes(m))
            ? modes.find(m => ['flight', 'levitation'].includes(m))
            : (r.kind === 'waterColumn' || r.kind === 'wetland') && modes.some(m => ['swimming', 'drifting'].includes(m))
              ? modes.find(m => ['swimming', 'drifting'].includes(m))
              : r.kind === 'subsurface' ? 'burrowing' : modes.includes('walking') ? 'walking' : 'grounded';
          return { regionId: r.id, cell, altitudeM: point.altitudeM, mode };
        };
        const actor = P.claimLocal(s, g.id, c.id, ordinal, actorId, context.at, {
          ...context, terrain: cell => {
            const t = context.terrain(cell);
            return hasSeam(site) && t?.sourceRegionId !== r.id ? null : t;
          }, blocked: (cell, low, high, body) => context.blocked?.(cell, low, high, body)
            || actors.some(a => Bodies.occupied(a, tile).some(c => c.x === cell.x && c.y === cell.y && c.z === cell.z)
              && a.bodyPhysics.altitudeM < high && a.bodyPhysics.altitudeM + a.bodyPhysics.dimensions.heightM > low),
          originalPosition,
          originalReserves: reservesFor });
        if (!actor) continue;
        actor.roomId = site.roomId; actor.nativePopulation = { sourceId: record.id, regionId: r.id, siteId: site.id,
          sourcePosition: copy(point), frame: copy(f), bounds: copy(b), tileSizeM: tile, background: false };
        actors.push(actor);
      }
    }
    const claims = encounteredPopulationIds(state);
    for (const a of actors) if (!claims.includes(a.populationId)) claims.push(a.populationId);
    state.sites[site.id] ||= siteRecord(site, frame);
    return actors;
  }
  function terrain(state, record, map, site, cells, at, tile = 1) {
    if (!Number.isFinite(at) || at < state.clock || !Number.isFinite(tile) || tile <= 0)
      throw Error('Native terrain requires current time and a real tile area');
    checkSite(state, site);
    checkMouthFrame(site, tile);
    const s = open(state, record, map), regions = siteRegions(state, s, site, map, record);
    if (!regions.length) return {};
    const origin = { eastM: 0, northM: 0, ...site.origin }, result = {}, parcelIds = {};
    const sections = new Map(regions.map(r => [r.kind, []]));
    const sea = marineFrame(site, tile);
    for (const c of cells) {
      const x = (c.x - site.bounds.x) * tile, y = (c.y - site.bounds.y) * tile;
      const marine = sea && c.x >= Foreign.coastEast(site.bounds);
      const corner = marine ? Foreign.offset(sea, x + tile / 2, y + tile / 2) : null;
      const east = corner ? corner.eastM - tile / 2 : origin.eastM + x;
      const north = corner ? corner.northM - tile / 2 : origin.northM + y;
      const kind = marine ? 'waterColumn' : Foreign.mouthCell(site, c) ? 'subsurface'
        : Foreign.wetlandAt(site.wetlandBank, east + tile / 2, north + tile / 2) ? 'wetland' : site.kind;
      sections.get(kind)?.push({ c, east, north });
    }
    P.settleRegions(s, at, regions.map(r => r.id)); state.clock = s.clock;
    const soilSites = attendedSoilSites(state), attended = soilParcels(state, soilSites);
    for (const r of regions) fundTerrain(state, s, r, sections.get(r.kind), site, at, tile, result, parcelIds, attended);
    state.sites[site.id] = { ...siteRecord(site, origin), parcelIds: { ...state.sites[site.id]?.parcelIds, ...parcelIds } };
    if (soilSites.has(site.id) || Object.values(parcelIds).some(id => state.parcels[id].soilCoverHistory)) {
      state.sites[site.id].soilCoverAttended = true;
      soilSites.add(site.id);
    }
    return result;
  }
  function attendedSoilSites(state) {
    const entry = cache.get(state);
    return entry.soilSites ||= new Set(Object.keys(state.sites).filter(id => state.sites[id].soilCoverAttended));
  }
  function soilParcels(state, sites) {
    return new Set([...sites].flatMap(id => Object.values(state.sites[id]?.parcelIds || {}))
      .filter(id => state.parcels[id]?.soilCoverHistory));
  }
  function applyAmbientCover(p, cover, attended) {
    if (cover === undefined || !coverValue(p.condition?.soilCover)) return;
    // Old parcels have no reliable departure snapshot. Preserve their
    // actual local cover and begin measuring from today's regional level.
    if (!p.soilCoverHistory) {
      p.soilCoverHistory = { baseline: cover, ambient: cover, local: p.condition.soilCover - cover };
      return;
    }
    if (attended) return;
    const h = p.soilCoverHistory, ambient = clampCover(h.ambient + cover - h.baseline);
    if (ambient !== h.ambient) {
      // Reconcile changes made by actual local actions separately. A cover
      // reading clipped to bare/dense must not erase the existing scar.
      const adjustment = p.condition.soilCover - clampCover(h.ambient + h.local);
      h.local = Math.max(-100, Math.min(100, h.local + adjustment));
      h.ambient = ambient;
      p.condition.soilCover = clampCover(ambient + h.local);
    }
    h.baseline = cover;
  }
  function leaveSoilSites(state, s, at, activeIds) {
    if (!activeIds || !Number.isFinite(at)) return;
    const sites = attendedSoilSites(state), leaving = [...sites].filter(id => !activeIds.has(id));
    if (!leaving.length) return;
    const stillAttended = soilParcels(state, [...sites].filter(id => activeIds.has(id)));
    const parcels = [...soilParcels(state, leaving)].filter(id => !stillAttended.has(id)).map(id => state.parcels[id]);
    const ids = new Set(parcels.map(p => p.sourceRegionId));
    // A caller servicing an older boundary cannot rewind the source. Use
    // the earliest settled value available rather than leaving a stale hold.
    if (ids.size && !P.settleRegions(s, Math.max(at, s.clock), [...ids])) return;
    const covers = ids.size ? new Map(s.regions.filter(r => ids.has(r.id)).map(r => [r.id, regionalCover(r)])) : null;
    for (const p of parcels) {
      const cover = covers.get(p.sourceRegionId);
      if (cover !== undefined) p.soilCoverHistory.baseline = cover;
    }
    for (const id of leaving) { delete state.sites[id].soilCoverAttended; sites.delete(id); }
  }
  function fundTerrain(state, s, r, cells, site, at, tile, result, parcelIds, attended) {
    if (!cells.length) return;
    if (r.seasons.some(p => p.wind)) {
      state.windSchedules ||= {};
      state.windSchedules[r.id] ??= { calendar: { epochAt: s.calendar.epochAt, monthDays: [...s.calendar.monthDays] },
        vectors: r.seasons.map(p => copy(p.wind ?? r.wind)) };
    }
    const area = tile * tile, totals = {}, cover = regionalCover(r);
    const reserved = {};
    for (const site of r.ecology?.renewalSites || []) if (site.destroyedAt == null)
      for (const [k, n] of Object.entries(site.materials)) reserved[k] = (reserved[k] || 0) + n;
    for (const { c, east, north } of cells) {
      if (Math.hypot(east + tile / 2, north + tile / 2) > Math.sqrt(r.areaHa * 10000 / Math.PI)) continue;
      const id = `${r.id}:${east}:${north}:${tile}`, key = `${c.x},${c.y},${c.z}`;
      parcelIds[key] = id;
      if (state.parcels[id]) {
        if (site.wetlandBank && r.kind === 'wetland') state.parcels[id].fieldWetland = true;
        if (site.coast && r.kind === 'waterColumn') state.parcels[id].fieldSeawater = true;
        if (site.mouth && r.kind === 'subsurface') { state.parcels[id].fieldBurrowMouth = true; state.parcels[id].floor = false; }
        applyAmbientCover(state.parcels[id], cover, attended.has(id));
        result[key] = mineralOwner(state.parcels[id], state); continue;
      }
      const resources = {};
      for (const [k, amount] of Object.entries(r.stocks)) {
        if (k.includes(':')) continue; // Reserved workfaces are not uniform terrain.
        const available = Math.max(0, amount - (reserved[k] || 0));
        const moved = Math.min(available - (totals[k] || 0), available * area / (r.areaHa * 10000));
        if (moved > 0) { resources[k] = moved; totals[k] = (totals[k] || 0) + moved; }
      }
      const wet = ['wetland', 'waterColumn'].includes(r.kind), sea = r.kind === 'waterColumn';
      const mouth = site.mouth && r.kind === 'subsurface';
      const wx = east + tile / 2, wy = north + tile / 2, lee = r.windShelter;
      const nearbyLee = lee && Math.hypot(wx - lee.eastM, wy - lee.northM) <= Math.hypot(lee.lengthM, lee.widthM / 2) + tile * 2;
      const p = { sourceRegionId: r.id, resources, transfers: {}, areaHa: area / 10000, condition: copy(r.condition),
        floor: !mouth && r.floor, oxygen: r.oxygen, waterKind: sea ? 'seawater' : 'freshwater', waterAccounted: wet,
        ...(site.wetlandBank && r.kind === 'wetland' ? { fieldWetland: true } : {}),
        ...(site.coast && sea ? { fieldSeawater: true } : {}),
        ...(mouth ? { fieldBurrowMouth: true } : {}),
        waterDepthM: wet ? (resources[sea ? 'seawaterL' : 'waterL'] || 0) / (area * 1000) : 0,
        soilDepthM: mouth ? r.depthM : r.accessibleMineralDepthM || 0, densityKgM3: r.densityKgM3, materialKg: resources.mineralsKg || 0,
        hardness: 1, supportKg: Math.max(1, (resources.mineralsKg || 0) * 10), ...(r.wind ? { wind: copy(r.wind) } : {}),
        ...(nearbyLee ? { windShelter: copy(lee), windParcelCenter: { eastM: wx, northM: wy } } : {}),
        humidity: r.humidity, temperatureC: r.seasons[P.monthAt(s.calendar, at).season].temperatureC };
      applyAmbientCover(p, cover, false);
      state.parcels[id] = mineralOwner(p, state); result[key] = p;
    }
    for (const [key, amount] of Object.entries(totals))
      if (!P.removeStock(s, r.id, key, amount, at, 'native-local-terrain-custody')) throw Error('Native terrain transfer was not funded');
  }
  function bindTerrain(state, siteId) {
    return Object.fromEntries(Object.entries(state.sites[siteId]?.parcelIds || {}).map(([key, id]) => [key, mineralOwner(state.parcels[id], state)]));
  }
  function soilCoverAt(state, siteId, cellKey) {
    const site = state?.sites?.[siteId], p = state?.parcels?.[site?.parcelIds?.[cellKey]];
    return site?.soilCoverAttended && p?.soilCoverHistory && coverValue(p.condition?.soilCover) ? p.condition.soilCover : undefined;
  }
  function habitat(state, s, site) {
    const entry = cache.get(state);
    entry.habitats ||= new Map(s.regions.map(r => [`${r.cellId}:${r.kind}`, r]));
    return entry.habitats.get(`${site.cellId}:${site.kind}`);
  }
  function carrion(state, record, map, site, observer, context) {
    if (!context.alive || !context.local || !Object.hasOwn(state.sites, site.id) || !hasOpen(state)) return [];
    checkSite(state, site);
    const s = open(state, record, map), regions = siteRegions(state, s, site, map, record)
      .filter(r => !(site.coast && r.kind === 'waterColumn') && !r.deferred && r.wildlife?.pools.some(p => p.carcassSpace));
    if (!regions.length || !P.settleRegions(s, context.at, regions.map(r => r.id))) return [];
    state.clock = s.clock;
    return regions.flatMap(r => Carcasses.window(r, site, observer, context.rangeM, context.tileSizeM || 1, cell => {
      const t = context.terrain(cell);
      return hasSeam(site) && t?.sourceRegionId !== r.id ? null : t;
    }, context.observationOnly)).sort((a, b) => a.distanceM - b.distanceM || a.id.localeCompare(b.id)).slice(0, 64);
  }
  const MIRE_CHOIR = 'beast:mire-choir';
  function cellCenter(n, c) {
    return Foreign.offset(n.frame, (c.x - n.bounds.x + .5) * n.tileSizeM, (c.y - n.bounds.y + .5) * n.tileSizeM);
  }
  function fundedNurseryWindow(state, s, parent, brood, at, terrain) {
    const n = parent?.nativePopulation, d = s?.details[parent?.id];
    if (!s || !state || s.sourceId !== state.sourceId || !n || n.background || n.sourceId !== state.sourceId || parent.speciesId !== MIRE_CHOIR
      || !Number.isFinite(at) || at < s.clock || n.regionId !== brood?.sourceRegionId
      || d?.status !== 'detailed' || d.regionId !== n.regionId || d.memberId !== parent.life?.originalMemberId
      || !brood.externalNursery || brood.disposedAt != null || !parent.life.populationBroods?.includes(brood)) return null;
    const r = s.regions.find(r => r.id === n.regionId), nursery = r?.nurseries?.find(p => p.id === brood.sourceNurseryId);
    const p = nursery?.position, site = state.sites[n.siteId], tile = n.tileSizeM, b = n.bounds;
    if (r?.kind !== 'wetland' || r.oxygen === false || !nursery?.habitatSuitable || nursery.destroyedAt != null
      || nursery.speciesId !== MIRE_CHOIR || nursery.enabled === false || !nursery.phases.includes(P.monthAt(s.calendar, at).season)
      || !site?.parcelIds || p?.regionId !== r.id || !Number.isFinite(p.altitudeM) || !(p.altitudeM < 0)
      || !(nursery.reservedAreaHa > 0) || !(nursery.capacity > 0)) return null;
    const radius = Math.sqrt(nursery.reservedAreaHa * 10000 / Math.PI);
    const [x, y] = Foreign.relative(n.frame, p.eastM, p.northM);
    const center = { x: b.x + Math.floor(x / tile), y: b.y + Math.floor(y / tile), z: b.z };
    const fundedWater = cell => {
      if (cell.z !== b.z || cell.x < b.x || cell.x >= b.x + b.width || cell.y < b.y || cell.y >= b.y + b.height) return false;
      const parcel = state.parcels[site.parcelIds[Bodies.key(cell)]], t = terrain?.(cell);
      return parcel?.sourceRegionId === r.id && parcel.fieldWetland && parcel.oxygen !== false
        && (parcel.resources.waterL || 0) / (parcel.areaHa * 10000 * 1000) >= -p.altitudeM
        && (!terrain || t?.sourceRegionId === r.id && t.known !== false && t.oxygen !== false && !t.protected && !t.foundation
          && !t.warded && !t.solid && t.waterDepthM >= -p.altitudeM);
    };
    if (!fundedWater(center)) return null;
    if (brood.investedKg + 1e-8 < brood.requiredKg || brood.investedMana + 1e-8 < brood.requiredMana) {
      const here = cellCenter(n, parent.mapCell);
      if (!fundedWater(parent.mapCell) || Math.hypot(here.eastM - p.eastM, here.northM - p.northM) > radius + parent.bodyPhysics.dimensions.lengthM) return null;
    }
    const distance = cell => {
      const here = cellCenter(n, cell);
      return Math.hypot(here.eastM - p.eastM, here.northM - p.northM);
    };
    const allows = cell => fundedWater(cell) && distance(cell) <= radius;
    return { altitudeM: p.altitudeM, allows, cells() {
      // Only one bounded local window is searched at a hatch attempt. The
      // rest of the original brood stays batched and keeps its paid matter.
      const span = Math.min(5, Math.ceil(radius / tile)), found = [];
      for (let y = center.y - span; y <= center.y + span; y++) for (let x = center.x - span; x <= center.x + span; x++) {
        const cell = { x, y, z: center.z };
        if (allows(cell)) found.push(cell);
      }
      return found.sort((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x);
    } };
  }
  const nurseryWindow = (state, parent, brood, at, terrain) => fundedNurseryWindow(state, cache.get(state)?.account, parent, brood, at, terrain);
  function claimBirthAtSite(state, s, parent, child, at, terrain) {
    const detail = s.details[parent?.id], n = parent?.nativePopulation;
    if (!n || n.background || n.sourceId !== state.sourceId || s.sourceId !== state.sourceId || !child?.bodyPhysics
      || child.roomId !== parent.roomId || detail?.status !== 'detailed' || detail.regionId !== n.regionId
      || detail.memberId !== parent.life?.originalMemberId) return false;
    const brood = parent.life.populationBroods?.find(b => child.id.startsWith(`${b.id}:`));
    if (brood?.externalNursery) {
      const nest = fundedNurseryWindow(state, s, parent, brood, at, terrain);
      if (!nest || child.bodyPhysics.mode !== 'swimming' || child.bodyPhysics.altitudeM !== nest.altitudeM
        || nest.altitudeM + child.bodyPhysics.dimensions.heightM > 0
        || !Bodies.cells(child, child.mapCell, n.tileSizeM).every(nest.allows)) return false;
    }
    detail.actor = parent;
    if (!P.registerLocalBirth(s, parent.id, child, at)) return false;
    child.nativePopulation = { ...copy(n), sourcePosition: { regionId: n.regionId, ...cellCenter(n, child.mapCell),
      altitudeM: child.bodyPhysics.altitudeM } };
    state.clock = s.clock; return true;
  }
  const birth = (state, record, map, parent, child, at, terrain) => claimBirthAtSite(state, open(state, record, map), parent, child, at, terrain);
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
      // Keep sub-tile precision for an original that hasn't changed cells.
      const old = Foreign.relative(n.frame, n.sourcePosition?.eastM, n.sourcePosition?.northM);
      const cells = [a.mapCell.x - n.bounds.x, a.mapCell.y - n.bounds.y];
      const unchanged = cells.map((v, i) => v === Math.floor(old[i] / tile));
      const world = Foreign.offset(n.frame, ...cells.map((v, i) => unchanged[i] ? old[i] : (v + .5) * tile));
      const swapped = (n.frame.axis || 0) % 2;
      if (unchanged[swapped]) world.eastM = n.sourcePosition.eastM;
      if (unchanged[1 - swapped]) world.northM = n.sourcePosition.northM;
      const pos = { regionId: n.regionId, ...world, altitudeM: a.bodyPhysics.altitudeM };
      if (d.status === 'dead') {
        if (!P.releaseCorpse(s, a.id, at, pos)) throw Error('Original corpse could not transfer its remaining matter');
        n.background = true; n.sourcePosition = pos; continue;
      }
      if (!P.returnLocal(s, a.id, at, pos)) throw Error('Original local body could not return to background ownership');
      n.background = true;
    }
    if (locality) leaveSoilSites(state, s, at, locality.activeSiteIds);
    state.clock = s.clock; return true;
  }
  const ownsLocal = (state, actorId) => {
    const d = cache.get(state)?.account.details[actorId]; return Boolean(d && !d.actor?.nativePopulation?.background);
  };
  const hasLocalActors = state => Object.values(cache.get(state)?.account.details || {}).some(d => d.actor?.nativePopulation && !d.actor.nativePopulation.background);
  return { create, normalize, open, pack, rebind, materialize, roadsideProbe, sync, nearby, terrain, bindTerrain, soilCoverAt, carrion, birth, nurseryWindow,
    fundedNurseryWindow, claimBirthAtSite, capacity, diff, apply,
    hasOpen, ready, prepare, advanceBudget, ownsLocal, hasLocalActors, encounteredPopulationIds };
});
