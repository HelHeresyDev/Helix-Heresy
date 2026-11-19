const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../world-run-library'), N = require('../beast-native-populations'), P = require('../beast-populations');
const F = require('../beast-regional-foodweb'), B = require('../beast-bodies'), S = require('../beast-habitat-sources');
const Carrion = require('../wildlife-carcasses');
const copy = x => JSON.parse(JSON.stringify(x));
let fixture;
function original() {
  if (!fixture) {
    const world = L.createWorld({ id: 'native-populations', worldSeed: 'native-encounters', createdAt: 'test', generationVersion: 8,
      creationSettings: { strategicMap: { refinementLevel: 2 } } });
    fixture = { world, map: world.generatedData.strategicMap, binding: { worldId: world.id, runId: 'native-run' } };
  }
  return fixture;
}
function context(s, species) {
  const g = s.groups.find(g => g.speciesId === species && !(B.profiles[species].modes.every(m => ['flight', 'levitation'].includes(m))
      && (g.home.depthM > 0 || s.regions.find(r => r.id === g.regionId).kind !== 'surface'))),
    c = g.cohorts[0], r = s.regions.find(r => r.id === g.regionId);
  const p = F.position(g, r, c, c.ranges[0][0]);
  const site = { id: `actual-site:${species}`, cellId: r.cellId, kind: r.kind, roomId: 'wildernessSurveySector',
    bounds: { x: 0, y: 0, z: 6, width: 256, height: 256 }, origin: { eastM: p.eastM - 128, northM: p.northM - 128 } };
  const ctx = { alive: true, local: true, at: 0, limit: 1, tileSizeM: 1,
    terrain: cell => cell.x >= 0 && cell.x < 256 && cell.y >= 0 && cell.y < 256 ? {
      floor: r.floor, oxygen: r.oxygen, soilDepthM: r.kind === 'subsurface' ? r.depthM : r.accessibleMineralDepthM,
      waterDepthM: ['waterColumn', 'wetland'].includes(r.kind) ? r.depthM : 0,
      hardness: 1, densityKgM3: 1600, supportKg: 1e12, wind: r.wind } : null };
  return { g, c, r, site, ctx };
}
test('native activation checks original source integrity without declaring ecological viability', () => {
  const { map } = original(), before = JSON.stringify(map), source = S.runtimeSource(map.beastHabitatSources, map);
  assert.equal(source.nativeEncounters, true); assert.equal(source.ecologicalStatus, 'unverified');
  assert.equal(source.diagnosticOnly, undefined); assert.equal(JSON.stringify(map), before);
  assert.throws(() => S.runtimeSource({ ...map.beastHabitatSources, id: 'wrong' }, map));
});
test('visited wildlife remains share the original regional debit after reload and independent continue', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, owner = N.create(record, binding), s = N.open(owner, record, map);
  const eater = { speciesId: 'beast:carrion-lantern' };
  let region, row;
  for (const r of s.regions) {
    if (r.kind !== 'surface' || !r.floor) continue;
    for (const pool of r.wildlife?.pools || []) {
      if (!pool.carcassSpace?.count || pool.guild === 'fish') continue;
      const { eastM, northM, radiusM } = pool.spatial;
      row = Carrion.query(pool, { regionId: r.id, eastM, northM, altitudeM: 0 }, radiusM * 2).sites[0];
      if (row) { region = r; break; }
    }
    if (row) break;
  }
  assert.ok(row, 'real original wildlife death');
  const site = { id: 'carcass-visit', cellId: region.cellId, kind: region.kind, roomId: 'wildernessSurveySector',
    bounds: { x: 0, y: 0, z: 6, width: 16, height: 16 }, origin: { eastM: row.position.eastM - 8, northM: row.position.northM - 8 } };
  const overlap = { ...site, id: 'overlapping-visit', bounds: { ...site.bounds, x: 20 } };
  const context = { at: 0, rangeM: 4, tileSizeM: 1, alive: true, local: true, terrain: () => ({ floor: true, waterDepthM: 0 }) };
  const view = (state, frame = site, ctx = context) => N.carrion(state, record, map, frame, {
    cell: { x: frame.bounds.x + 8, y: 8, z: 6 }, altitudeM: 0
  }, ctx).find(body => body.id === row.id)?.wildlifeCarrion;
  assert.equal(view(owner), undefined, 'unvisited terrain cannot expose a food source');
  N.terrain(owner, record, map, site, [], 0); N.terrain(owner, record, map, overlap, [], 0);
  assert.equal(view(owner, site, { ...context, local: false }), undefined);
  assert.equal(view(owner, overlap).inventory(), row);
  assert.ok(view(owner).take(eater, .001).kg > 0);
  const remaining = row.massKg, spent = row.consumedKg;
  assert.equal(view(owner, overlap).inventory().massKg, remaining);
  N.pack(owner, record, map);
  const saved = copy(owner), continued = N.rebind(saved, binding, { ...binding, runId: 'carrion-branch' });
  N.open(saved, record, map); N.open(continued, record, map);
  assert.equal(view(saved).inventory().consumedKg, spent);
  assert.equal(view(continued, overlap).inventory().massKg, remaining);
  assert.ok(view(continued).take(eater, .001).kg > 0);
  assert.equal(view(saved).inventory().consumedKg, spent);
  assert.ok(view(continued).inventory().massKg < remaining);
});
test('deferred generated habitats match the eager original at an elapsed ecological read', () => {
  const { map, binding } = original(), record = map.beastHabitatSources;
  const eager = P.create(S.runtimeSource(record, map), binding);
  const state = N.create(record, binding), lazy = N.open(state, record, map), until = P.DAY;
  assert.ok(lazy.regions.some(r => r.deferred));
  P.advance(eager, until, true, true); P.advance(lazy, until, true, true);
  assert.deepEqual(lazy.groups, eager.groups);
  assert.deepEqual(lazy.regions, eager.regions);
  assert.deepEqual(P.audit(lazy), P.audit(eager));
  N.pack(state, record, map);
  assert.deepEqual(N.open(copy(state), record, map).regions, lazy.regions);
});
test('legacy eager deltas retain their baseline and unopened or cancelled work does not initialize', async () => {
  const { map, binding } = original(), record = map.beastHabitatSources;
  const unopened = N.create(record, binding), before = JSON.stringify(unopened);
  assert.equal(N.pack(unopened, record, map), unopened); assert.equal(N.hasOpen(unopened), false);
  assert.equal(await N.prepare(unopened, record, map, P.DAY, { continue: () => false, yield: async () => {} }), false);
  assert.equal(JSON.stringify(unopened), before); assert.equal(N.hasOpen(unopened), false);
  let yields = 0;
  const interrupted = N.create(record, binding);
  assert.equal(await N.prepare(interrupted, record, map, P.DAY, {
    budget: 1, continue: () => yields < 2, yield: async () => { yields++; }
  }), false);
  assert.ok(interrupted.clock < P.DAY);
  N.pack(interrupted, record, map);
  const stopped = JSON.stringify(interrupted);
  assert.equal(await N.prepare(interrupted, record, map, P.DAY, { continue: () => false, yield: async () => {} }), false);
  assert.equal(JSON.stringify(interrupted), stopped);
  assert.equal(N.open(copy(interrupted), record, map).clock, interrupted.clock);
  const old = N.create(record, binding); delete old.deferredHabitats;
  const eager = N.open(old, record, map); assert.ok(eager.regions.every(r => !r.deferred));
  assert.equal(P.removeStock(eager, eager.regions[0].id, 'waterL', 1, 0, 'actual-original-loss'), true);
  N.pack(old, record, map); const restored = N.open(copy(old), record, map);
  assert.deepEqual(restored.regions, eager.regions);
  const legacyRows = [], visit = (tree, path = []) => {
    for (const [key, value] of Object.entries(tree)) {
      if (Array.isArray(value)) legacyRows.push([[...path, key], ...value]);
      else visit(value, [...path, key]);
    }
  };
  visit(old.deltaTree); old.patch = legacyRows; delete old.deltaTree;
  assert.deepEqual(N.open(copy(old), record, map).regions, eager.regions);
});
test('all authored body families can claim their actual original members in appropriate physical habitat', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, state = N.create(record, binding), s = N.open(state, record, map);
  for (const species of Object.keys(B.profiles)) {
    const { site, ctx } = context(s, species), actors = N.materialize(state, record, map, site, ctx);
    assert.equal(actors.length, 1, species);
    assert.ok(actors[0].life.originalMemberId); assert.ok(actors[0].nativePopulation);
    assert.equal(N.materialize(state, record, map, site, ctx)[0], actors[0]);
  }
  assert.ok(P.normalize(s), 'claimed account must normalize');
  assert.equal(Object.values(P.audit(s)).reduce((n, r) => n + r.detailed, 0), 24);
});
test('population deltas reload exact depleted bodies without replacements and reject changed ownership', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, state = N.create(record, binding), s = N.open(state, record, map);
  const { site, ctx } = context(s, 'beast:rimefang-pack'), [a] = N.materialize(state, record, map, site, ctx);
  a.health -= 4; a.bodyPhysics.stamina = Math.max(0, a.bodyPhysics.stamina - 20);
  N.sync(state, record, map, [a], 0); N.pack(state, record, map);
  assert.ok(JSON.stringify(state).length < JSON.stringify(s).length / 4);
  const saved = copy(state), reloaded = N.open(saved, record, map);
  assert.equal(reloaded.details[a.id].actor.health, a.health); assert.equal(reloaded.details[a.id].actor.bodyPhysics.stamina, a.bodyPhysics.stamina);
  assert.equal(N.materialize(saved, record, map, site, ctx).length, 1);
  const branch = N.rebind(saved, binding, { ...binding, runId: 'continued' });
  assert.equal(N.open(branch, record, map).runId, 'continued');
  assert.throws(() => N.normalize(saved, { ...binding, runId: 'wrong' }));
  assert.throws(() => N.apply({}, [[['__proto__', 'polluted'], true]]));
  const corrupt = copy(state); corrupt.deltaTree = JSON.parse('{"__proto__":{"polluted":[true]}}');
  assert.throws(() => N.open(corrupt, record, map), /delta path/);
});
test('native absence returns a moved wounded original, preserves parcel custody and reclaims its saved identity', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, state = N.create(record, binding), s = N.open(state, record, map);
  const { site, ctx } = context(s, 'beast:gravebloom-elk'), [a] = N.materialize(state, record, map, site, ctx);
  a.health -= 3; a.mapCell.x++; a.name = 'Marked original';
  a.life.memories.push({ id: 'scientist', cell: copy(a.mapCell), at: 0 });
  const cells = [copy(a.mapCell)]; N.terrain(state, record, map, site, cells, 0);
  const parcel = Object.values(state.parcels)[0], resources = copy(parcel.resources), before = copy(a);
  N.sync(state, record, map, [a], 0, true, { activeSiteIds: new Set(), retainedActorIds: new Set() });
  assert.equal(N.ownsLocal(state, a.id), false);
  assert.equal(P.returnLocal(s, a.id, 0, {}), false);
  let loops = 0; while (!N.advanceBudget(state, record, map, 900, 32)) assert.ok(++loops < 200);
  assert.deepEqual(parcel.resources, resources);
  N.pack(state, record, map);
  const saved = copy(state), restored = N.open(saved, record, map);
  assert.equal(Object.keys(restored.details).length, 0);
  const [returned] = N.materialize(saved, record, map, site, { ...ctx, at: 900 });
  assert.ok(returned); assert.equal(returned.id, a.id); assert.equal(returned.life.originalMemberId, before.life.originalMemberId);
  assert.equal(returned.name, before.name); assert.equal(returned.health, before.health);
  assert.deepEqual(returned.life.memories, before.life.memories); assert.deepEqual(returned.mapCell, before.mapCell);
  assert.ok(returned.life.ageDays > before.life.ageDays);
  assert.deepEqual(N.bindTerrain(saved, site.id)[`${a.mapCell.x},${a.mapCell.y},${a.mapCell.z}`].resources, resources);
  assert.equal(P.audit(restored)[a.populationId].detailed, 1);
});
test('actual site attendance and explicit external custody retain local ownership, while final death freezes handoffs', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, state = N.create(record, binding), s = N.open(state, record, map);
  const { site, ctx } = context(s, 'beast:gravebloom-elk'), [a] = N.materialize(state, record, map, site, ctx);
  for (const locality of [{ activeSiteIds: new Set([site.id]) }, { activeSiteIds: new Set(), retainedActorIds: new Set([a.id]) }]) {
    N.sync(state, record, map, [a], 0, true, locality); assert.equal(N.ownsLocal(state, a.id), true);
  }
  const before = JSON.stringify(s);
  assert.equal(N.sync(state, record, map, [a], 1, false, { activeSiteIds: new Set() }), false);
  assert.equal(JSON.stringify(s), before);
});
test('an absent native corpse decays once without a second death, refill or duplicate regional carcass', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, state = N.create(record, binding), s = N.open(state, record, map);
  const { site, ctx, r } = context(s, 'beast:gravebloom-elk'), [a] = N.materialize(state, record, map, site, ctx);
  a.status = 'dead'; a.health = 0; a.diedAt = 0;
  N.sync(state, record, map, [a], 0, true, { activeSiteIds: new Set() });
  const initial = a.life.remains.edibleKg;
  while (!N.advanceBudget(state, record, map, P.DAY, 32)) {}
  assert.ok(a.life.remains.edibleKg < initial);
  const after = a.life.remains.edibleKg; N.advanceBudget(state, record, map, P.DAY);
  assert.equal(a.life.remains.edibleKg, after);
  assert.equal(s.losses.filter(l => l.memberId === a.life.originalMemberId).length, 1);
  assert.equal(Object.values(r.remainsBatches || {}).filter(row => row.sourceKey === a.life.originalMemberId).length, 1);
  assert.equal(N.materialize(state, record, map, site, { ...ctx, at: P.DAY })[0].status, 'dead');
  assert.ok(!Object.values(r.remainsBatches || {}).some(row => row.sourceKey === a.life.originalMemberId));
  assert.ok(!N.materialize(state, record, map, { ...site, id: 'overlap' }, { ...ctx, at: P.DAY }).some(other => other.id === a.id));
  assert.ok(P.normalize(s));
});
test('source positions and actual footprint reject remote, undersized and wrong-medium encounters', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, state = N.create(record, binding), s = N.open(state, record, map);
  const { site, ctx } = context(s, 'beast:brine-cathedral');
  assert.deepEqual(N.materialize(state, record, map, { ...site, id: 'remote-window', origin: { eastM: 1e12, northM: 1e12 } }, ctx), []);
  assert.deepEqual(N.materialize(state, record, map, site, { ...ctx, terrain: () => ({ floor: true, waterDepthM: 0 }) }), []);
  assert.deepEqual(N.materialize(state, record, map, site, { ...ctx, alive: false }), []);
});
test('terrain custody is finite, shared across overlapping visits and never turns seawater into drinking water', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, state = N.create(record, binding), s = N.open(state, record, map);
  const { r, site } = context(s, 'beast:brine-cathedral'), before = copy(r.stocks);
  const cells = [{ x: 128, y: 128, z: 6 }, { x: 129, y: 128, z: 6 }];
  const terrain = N.terrain(state, record, map, site, cells, 0), Habitat = require('../beast-habitat');
  const first = terrain['128,128,6']; Habitat.patch(first, cells[0], 1);
  assert.equal(first.resources.waterL || 0, 0); assert.ok(first.resources.seawaterL > 0);
  for (const k of Object.keys(before).filter(k => !k.includes(':'))) {
    const moved = Object.values(terrain).reduce((n, p) => n + (p.resources[k] || 0), 0);
    assert.ok(Math.abs(before[k] - r.stocks[k] - moved) <= Math.max(1e-7, before[k] * 1e-12), k);
  }
  first.resources.seawaterL -= 1;
  const mineral = first.materialKg;
  first.resources.mineralsKg -= 1; assert.equal(first.materialKg, mineral - 1);
  first.materialKg -= 1; assert.equal(first.resources.mineralsKg, mineral - 2);
  const overlap = N.terrain(state, record, map, { ...site, id: 'overlapping-visit' }, cells, 0);
  assert.equal(overlap['128,128,6'], first); assert.deepEqual(N.bindTerrain(state, site.id), terrain);
  N.pack(state, record, map); const saved = copy(state);
  N.open(saved, record, map);
  assert.deepEqual(N.bindTerrain(saved, site.id), terrain);
  assert.equal(Object.keys(saved.parcels).length, 2);
  assert.throws(() => N.terrain(saved, record, map, { ...site, origin: { eastM: 0, northM: 0 } }, cells, 0), /relocate/);
  const corrupt = copy(saved); Object.values(corrupt.parcels)[0].resources.mineralsKg = -1;
  assert.throws(() => N.normalize(corrupt, binding), /terrain custody/);
  const unchanged = JSON.stringify(saved);
  assert.throws(() => N.terrain(saved, record, map, site, cells, -1), /current time/);
  assert.throws(() => N.terrain(saved, record, map, site, cells, 0, 0), /tile area/);
  assert.equal(JSON.stringify(saved), unchanged);
});
test('a local original death is counted once, remains dead after reload, and does not infect an independent run', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, state = N.create(record, binding), s = N.open(state, record, map);
  const { site, ctx } = context(s, 'beast:rimefang-pack'), [a] = N.materialize(state, record, map, site, ctx);
  a.health = 0; a.status = 'dead'; a.diedAt = 0;
  N.sync(state, record, map, [a], 0); N.sync(state, record, map, [a], 0);
  assert.equal(Object.values(P.audit(s)).reduce((n, p) => n + p.dead, 0), 1);
  N.pack(state, record, map); const saved = copy(state), reload = N.open(saved, record, map);
  assert.equal(reload.details[a.id].status, 'dead');
  assert.equal(N.materialize(saved, record, map, site, ctx)[0].status, 'dead');
  const independent = N.create(record, { ...binding, runId: 'independent' });
  assert.equal(N.materialize(independent, record, map, site, ctx)[0].status, 'alive');
  const frozen = JSON.stringify(saved);
  assert.equal(N.sync(saved, record, map, [], P.DAY, false), false);
  assert.deepEqual(N.materialize(saved, record, map, site, { ...ctx, at: P.DAY, alive: false }), []);
  assert.equal(JSON.stringify(saved), frozen);
});
test('source capacity is not an arbitrary patch-count gate and forged larger archives still fail integrity checks', () => {
  const { map, binding } = original(), record = map.beastHabitatSources;
  const large = { ...record, patchRows: Array.from({ length: 513 }, () => record.patchRows[0]) };
  assert.equal(N.capacity(large).supported, true);
  assert.throws(() => N.open(N.create(large, binding), large, map), /identity|physical/);
});
test('a million-member formation is queried in bounded ranges, not a per-animal scan', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, state = N.create(record, binding), s = N.open(state, record, map);
  const { g: originalGroup, c: originalCohort, r } = context(s, 'beast:rimefang-pack');
  const g = copy(originalGroup), c = copy(originalCohort); c.ranges = [[0, 1000000]];
  g.regionalFormation[c.originId] = { columns: 1000, offsetM: 0, eastSpacingM: 2, northSpacingM: 2 };
  const p = F.position(g, r, c, 0), box = { x0: p.eastM, x1: p.eastM + 2.1, y0: p.northM, y1: p.northM + 2.1 };
  const found = N.nearby(g, c, r, box);
  assert.deepEqual(found.sort((a, b) => a - b), [0, 1, 1000, 1001]);
});
test('an external population owner prevents a second native body claim', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, state = N.create(record, binding), s = N.open(state, record, map);
  const { g, site, ctx } = context(s, 'beast:rimefang-pack');
  assert.deepEqual(N.materialize(state, record, map, site, { ...ctx, unavailablePopulations: new Set([g.populationId]) }), []);
  assert.deepEqual(s.details, {});
});
test('an unfunded local child cannot enter original native membership', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, state = N.create(record, binding), s = N.open(state, record, map);
  const { site, ctx } = context(s, 'beast:mire-choir'), [parent] = N.materialize(state, record, map, site, ctx);
  const data = require('../creature-biology').lifecycle[parent.speciesId];
  const child = require('../wilderness-beasts').actor(parent.speciesId, 'not-a-funded-brood:0', parent.mapCell,
    parent.populationId, 0, { ageDays: 0, massKg: data.newbornKg });
  const before = copy(P.audit(s));
  assert.equal(N.birth(state, record, map, parent, child, 0), false);
  assert.deepEqual(P.audit(s), before); assert.equal(s.details[child.id], undefined);
});
test('occupied physical volume does not remove an original from its background owner', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, state = N.create(record, binding), s = N.open(state, record, map);
  const { site, ctx } = context(s, 'beast:rimefang-pack'), before = copy(P.audit(s));
  assert.deepEqual(N.materialize(state, record, map, site, { ...ctx, blocked: () => true }), []);
  assert.deepEqual(P.audit(s), before); assert.deepEqual(s.details, {});
});
