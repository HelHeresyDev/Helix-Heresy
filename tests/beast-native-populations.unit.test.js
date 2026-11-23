const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../world-run-library'), N = require('../beast-native-populations'), P = require('../beast-populations');
const F = require('../beast-regional-foodweb'), B = require('../beast-bodies'), S = require('../beast-habitat-sources');
const Surveys = require('../resource-surveys');
const Carrion = require('../wildlife-carcasses');
const Road = require('../roadside-stops');
const Supply = require('../municipal-supply-threats');
const Regional = require('../regional-encounters'), Suppression = require('../regional-suppression'), Diplomacy = require('../beast-diplomacy');
const { fixture: suppressionSource } = require('./helpers/regional-suppression-source');
const { sourceFixture: apeSource } = require('./helpers/beast-diplomacy-source');
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
test('an existing refuge watch repels one wounded native original and keeps only the received dated outcome', () => {
  const Force = require('../field-force'), Wild = require('../wilderness-beasts'), Life = require('../creature-life'), Behavior = require('../beast-behavior');
  const { map, binding } = original(), record = map.beastHabitatSources;
  let owner = N.create(record, binding), account = N.open(owner, record, map);
  const { site, ctx } = context(account, 'beast:nullmaw-stalker');
  let [beast] = N.materialize(owner, record, map, site, ctx);
  assert.ok(beast?.life.originalMemberId);
  const id = beast.id, memberId = beast.life.originalMemberId;
  // The original starts without attributed effort. It rests using its
  // actual inherited body supplies; neither a strike nor a reload refills it.
  Life.advance(beast, 1, { ...ctx, resting: true });
  Life.advance(beast, 25, { ...ctx, resting: true });
  assert.ok(beast.bodyPhysics.stamina > 1);
  const e = { source: { cityId: 'b', populationSourceId: 'people:b' }, roomId: 'ground', entry: { z: site.bounds.z },
    wilderness: { roomId: site.roomId, gate: { x: 20, y: 12, z: site.bounds.z } } };
  const backing = Force.source({ cityId: 'b', assetId: 'people:b', currentPopulation: 100, physicalCondition: 'intact' }, [
    { standing: 'licensed', network: { id: 'military:b', category: 'military', roles: ['escortContracting', 'perimeterDefense'] },
      branch: { id: 'chapter:b', publicName: 'Original guards', currentCityId: 'b', organizationForm: 'escortChapter', publicPhysicalPresence: true,
        operationalStatus: 'active', physicalCondition: 'intact', capacityBand: 'functional' } }
  ], e);
  let watch = Force.create(backing, e, 'guarded-original', 25);
  const post = { ...beast.mapCell, x: beast.mapCell.x - 1 }, posts = [post, { ...post, y: post.y + 1 }];
  const caller = { source: backing, alive: true, capable: true, originalBody: true, originalTrip: true, near: true, atGround: true,
    bodyEpoch: 1, visitId: 'visit', tripId: 'trip', supplied: true, routeOk: true, refugeValid: true,
    plan: { id: 'original-refuge', roomId: site.roomId, home: { ...post, x: post.x - 6 }, posts, route: [{ ...post, x: post.x - 6 }, post], travelSeconds: 600 } };
  const quote = Force.review(watch, caller, 25); assert.ok(Force.accept(watch, caller, quote, { money: 1000 }, 25));
  const hooks = { alive: true, current: () => true, refugeValid: () => true, physiology() {}, defend() {}, care() {},
    context: m => ({ supplied: true, threatCount: 0, accompanied: true, atPost: B.key(m.actor.mapCell) === B.key(posts[watch.members.indexOf(m)]) }),
    move: (m, c) => { m.actor.mapCell = copy(c); m.actor.roomId = site.roomId; } };
  Force.advance(watch, 26, hooks); assert.equal(watch.operation.phase, 'watch');
  assert.ok(Force.receive(watch, caller, 26)); const initialReport = copy(watch.report);
  let witness = watch.members[0], at = Math.max(27, Math.ceil(beast.nextAttackAt));
  const before = Math.ceil(beast.maxHealth * .3) + 1, damage = 4, part = Object.keys(beast.bodyPhysics.parts)[0];
  beast.health = before;
  assert.equal(Wild.decide(beast, post, at, true, false).behavior, 'pursue');
  assert.ok(Force.observeAttack(watch, witness, beast, B.cells(beast), at));
  // The fixture starts the committed attack already injured. The guard's
  // resolved wound drops health under the ordinary flee threshold.
  beast.health = before - damage; B.damagePart(beast, part, damage, at);
  const injury = beast.bodyPhysics.parts[part];
  assert.ok(Force.observeWound(watch, witness, beast, B.cells(beast), at, damage,
    !Wild.woundedEnoughToFlee(beast, before) && Wild.woundedEnoughToFlee(beast)));
  N.sync(owner, record, map, [beast], at); N.pack(owner, record, map);
  owner = N.normalize(copy(owner), binding); account = N.open(owner, record, map);
  watch = copy(watch); witness = watch.members[0]; beast = account.details[id].actor;
  assert.deepEqual(watch.report, initialReport);
  assert.equal(beast.bodyPhysics.parts[part], injury);
  const start = at;
  for (; at < start + 30 && !watch.operation.defenseContacts[0].outcome; at++) {
    const decision = Wild.decide(beast, post, at, true, false);
    assert.equal(decision.behavior, 'flee'); beast.behavior = decision.behavior;
    assert.equal(Behavior.step(beast, decision, null, at, 1, { ...ctx, patch: ctx.terrain }), false);
    if (!beast.bodyPhysics.motion) B.request(beast, 'walking', { ...beast.mapCell, x: beast.mapCell.x + 3 }, ctx);
    B.advance(beast, at, ctx);
    Force.observeDefense(watch, witness, [{ beast, cells: B.cells(beast) }], at);
  }
  assert.equal(watch.operation.defenseContacts[0].outcome?.kind, 'repelled',
    JSON.stringify({ cell: beast.mapCell, stamina: beast.bodyPhysics.stamina, blocked: beast.bodyPhysics.blockedReason }));
  assert.deepEqual(watch.report, initialReport);
  assert.ok(Force.receive(watch, { ...caller, reporterIds: [watch.members[1].actor.id] }, at));
  assert.equal(watch.report.members[0].defenses, undefined);
  assert.ok(Force.receive(watch, { ...caller, reporterIds: [witness.actor.id] }, at));
  const received = copy(watch.report), [fact] = received.members[0].defenses;
  assert.equal(fact.kind, 'repelled'); assert.equal(fact.refugeId, caller.plan.id);
  assert.ok(fact.at > fact.woundedAt && received.at >= fact.at);
  assert.ok(!JSON.stringify(received).includes(memberId));
  N.sync(owner, record, map, [beast], at, true, { activeSiteIds: new Set(), retainedActorIds: new Set() });
  assert.equal(N.ownsLocal(owner, id), false);
  N.pack(owner, record, map); owner = N.normalize(copy(owner), binding); watch = copy(watch);
  const returned = N.materialize(owner, record, map, site, { ...ctx, at, onlyActorId: id });
  assert.equal(returned.length, 1); assert.equal(returned[0].id, id);
  assert.equal(returned[0].life.originalMemberId, memberId); assert.equal(returned[0].health, beast.health);
  assert.equal(returned[0].bodyPhysics.parts[part], injury);
  assert.deepEqual(watch.report, received);
});
test('native activation checks original source integrity without declaring ecological viability', () => {
  const { map } = original(), before = JSON.stringify(map), source = S.runtimeSource(map.beastHabitatSources, map);
  assert.equal(source.nativeEncounters, true); assert.equal(source.ecologicalStatus, 'unverified');
  assert.equal(source.diagnosticOnly, undefined); assert.equal(JSON.stringify(map), before);
  assert.throws(() => S.runtimeSource({ ...map.beastHabitatSources, id: 'wrong' }, map));
});
test('roadside sensing can find an original body but an empty, hidden or unsupported reach creates no site or claim', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, state = N.create(record, binding), s = N.open(state, record, map);
  const r = s.regions.find(r => r.id === 'habitat:41:surface');
  const leg = Road.nativeLeg({ id: 'real-approach', legs: [{ distanceKm: .08 }] }, r.cellId, r.areaHa, { eastM: -42552, northM: -149825 });
  const window = km => Road.nativeWindow(leg, km, 23, 'actual-road');
  const entry = { x: 10, y: 10, z: 23 }, at = 5000;
  const ctx = { alive: true, local: true, at, tileSizeM: 1,
    terrain: () => ({ floor: true, oxygen: true, supportKg: 300 }), blocked: c => B.key(c) === B.key(entry),
    perceived: a => Road.perceived(entry, B.occupied(a), true, () => true) };
  const probe = (km, extra = {}) => N.roadsideProbe(state, record, map, window(km), { ...ctx, ...extra });
  assert.equal(probe(.006), null); assert.equal(probe(.019, { perceived: () => false }), null);
  assert.equal(probe(.019, { terrain: () => ({ floor: true, oxygen: true, supportKg: 1 }) }), null);
  const id = probe(.019);
  assert.match(id, /nullmaw-stalker:01:2:males:0$/);
  assert.deepEqual(state.sites, {}); assert.deepEqual(state.parcels, {}); assert.deepEqual(s.details, {});
  const site = window(.019), cells = Road.blueprint(binding.worldId, leg.routeId, .019, at, 23, {}).baseline.map(p => p.cell);
  const terrain = N.terrain(state, record, map, site, cells, at);
  const materialize = clock => N.materialize(state, record, map, site, { ...ctx, at: clock, groundOnly: true,
    onlyActorId: id, terrain: c => terrain[B.key(c)] });
  const [a] = materialize(at); assert.equal(a.id, id);
  a.health *= .8; const wounded = a.health;
  N.sync(state, record, map, [a], at, true, { activeSiteIds: new Set() });
  assert.equal(s.details[id], undefined);
  assert.equal(probe(.019), id);
  const [seenAgain] = materialize(at);
  assert.equal(seenAgain.id, id); assert.ok(Math.abs(seenAgain.health - wounded) < 1e-8);
  assert.ok(P.normalize(s, binding));
});
test('a sideways original must clear with its turned footprint before a grain truck can leave', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, state = N.create(record, binding), s = N.open(state, record, map);
  const r = s.regions.find(r => r.id === 'habitat:41:surface'), at = 5000;
  const leg = Road.nativeLeg({ id: 'grain', legs: [{ distanceKm: .064 }] }, r.cellId, r.areaHa, { eastM: -42560, northM: -149824 });
  const site = Road.nativeWindow(leg, .028, 21, 'grain-road');
  const road = Road.blueprint(binding.worldId, leg.routeId, .028, at, 21, {}, null, site.roomId);
  const terrain = N.terrain(state, record, map, site, road.baseline.map(row => row.cell), at);
  const ctx = { alive: true, local: true, at, tileSizeM: 1, terrain: cell => terrain[B.key(cell)],
    blocked: cell => cell.x === road.entry.x && [road.entry.y, road.entry.y + 1].includes(cell.y) };
  const [actor] = N.materialize(state, record, map, site, { ...ctx, groundOnly: true });
  const occupied = () => Supply.nativeObstruction(road.entry, B.occupied(actor, 1), 1);
  assert.equal(occupied(), true);
  assert.ok(B.turn(actor, 1, ctx).ok); B.advance(actor, at + 3, ctx);
  const yieldGoal = () => Supply.nativeYieldGoal(road.entry, 1, actor, B.occupied(actor, 1), 1,
    c => !B.habitatReason(actor, c, 'walking', 0, ctx));
  const goal = yieldGoal();
  assert.equal(goal.y, 7);
  assert.ok(B.request(actor, 'walking', goal, ctx).ok); B.advance(actor, at + 14, ctx);
  assert.equal(actor.mapCell.y, 7); assert.equal(occupied(), false);
  assert.deepEqual(yieldGoal(), actor.mapCell, 'the visible stopped carrier does not cause immediate re-entry');
  assert.ok(actor.bodyPhysics.spentStamina > 0);
});
test('one foreign habitat owner claims the full original footprint only after the adjoining terrain opens', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, state = N.create(record, binding), s = N.open(state, record, map);
  const site = { id: 'foreign-seam', cellId: 'planet-cell:00041', kind: 'surface', roomId: 'foreign-wilderness',
    bounds: { x: 21, y: 8, z: 23, width: 32, height: 24 }, origin: { eastM: -42543.346, northM: -149826.258 } };
  const at = 5000, cells = Array.from({ length: 32 * 12 }, (_, i) => ({ x: 21 + i % 32, y: 8 + Math.floor(i / 32), z: 23 }));
  let terrain = N.terrain(state, record, map, site, cells.filter(c => c.x < 37), at);
  const ctx = { at, alive: true, local: true, requireVisitedTerrain: true, tileSizeM: 1, terrain: cell => terrain[B.key(cell)] };
  assert.deepEqual(N.materialize(state, record, map, site, ctx), []);
  assert.equal(Object.keys(state.parcels).length, 16 * 12);
  const originalParcel = terrain['36,10,23'];
  terrain = N.terrain(state, record, map, site, cells, at);
  assert.equal(terrain['36,10,23'], originalParcel);
  const [actor] = N.materialize(state, record, map, site, ctx);
  assert.equal(actor.speciesId, 'beast:nullmaw-stalker');
  assert.ok(actor.bodyPhysics.massKg > 490);
  const footprint = B.occupied(actor, 1);
  assert.ok(footprint.some(c => c.x < 37) && footprint.some(c => c.x >= 37));
  actor.health -= 1; actor.nextAttackAt = at + 123;
  const again = N.materialize(state, record, map, site, ctx);
  assert.deepEqual(again, [actor]); assert.equal(again[0], actor);
  assert.equal(again[0].nextAttackAt, at + 123);
  assert.equal(Object.keys(s.details).length, 1);
  assert.equal(Object.keys(state.parcels).length, 32 * 12);
  assert.ok(P.normalize(s, binding));
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
  assert.deepEqual(view(owner, overlap).inventory(), row);
  assert.ok(view(owner).take(eater, .001).kg > 0);
  const durable = Carrion.source(region, row.id);
  assert.ok(durable.retained && durable.consumedKg > 0);
  const remaining = durable.massKg, spent = durable.consumedKg;
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
test('a native Ironroot death retains its generated workface loss through withdrawal and revisit', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, state = N.create(record, binding), s = N.open(state, record, map);
  const { site, ctx, r, c } = context(s, 'beast:ironroot-colossus'), at = 3600;
  assert.ok(P.settleRegions(s, at, [r.id]));
  assert.ok(c.ecologyHistory[r.id] > 0, 'the original worked with actual generated supplies');
  const [actor] = N.materialize(state, record, map, site, { ...ctx, at }), member = actor.life.originalMemberId;
  assert.equal(s.details[actor.id].returnCohort.ecologyHistory[r.id], c.ecologyHistory[r.id]);
  Object.assign(actor, { status: 'dead', health: 0, diedAt: at });
  assert.ok(N.sync(state, record, map, [actor], at, true, { activeSiteIds: new Set() }));
  const loss = r.ecologicalAccount.sourceLosses.find(l => l.ref === member);
  assert.equal(loss.firstAt, at); assert.equal(loss.count, 1); assert.ok(loss.channels.includes('soilCover'));
  assert.equal(r.exhausted, false);
  assert.equal(Object.values(r.remainsBatches).filter(b => b.sourceKey === member).length, 1);

  N.pack(state, record, map);
  const saved = copy(state), reload = N.open(saved, record, map);
  const revisited = N.materialize(saved, record, map, site, { ...ctx, at }).find(a => a.id === actor.id);
  assert.equal(revisited.status, 'dead'); assert.equal(revisited.life.originalMemberId, member);
  assert.ok(N.sync(saved, record, map, [revisited], at));
  assert.equal(reload.losses.filter(l => l.memberId === member).length, 1);
  const rr = reload.regions.find(region => region.id === r.id);
  assert.deepEqual(rr.ecologicalAccount.sourceLosses.filter(l => l.ref === member), [loss]);
  assert.ok(P.normalize(reload, binding));
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
  assert.equal(N.soilCoverAt(state, site.id, '128,128,6'), undefined);
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
test('reconnaissance on the same native parcel records decline and paid recovery without refills or lost scars', () => {
  const { source } = require('../scripts/benchmark-beast-regional-ecology');
  const ecology = P.create(source(), { worldId: 'maintenance-trace', runId: 'test' });
  for (const g of ecology.groups) for (const c of g.cohorts) c.deathThreshold = 1e12;
  P.advance(ecology, 10 * P.DAY, true, true);
  const initial = ecology.regions[0].condition.soilCover;
  P.kill(ecology, 'root', 'root-originals', 0, ecology.clock, 'workface-defeated');
  P.advance(ecology, 200 * P.DAY, true, true);
  const depleted = ecology.regions[0].condition.soilCover;
  assert.ok(ecology.regions[0].exhausted && depleted < 30);
  ecology.groups[2].intention = { destination: 'field', chosenAt: ecology.clock, departAt: ecology.clock + 1 };
  P.removeStock(ecology, 'reserve', 'waterL', 0, ecology.clock, 'workface-return');
  P.advance(ecology, 230 * P.DAY, true, true);
  const restored = ecology.regions[0].condition.soilCover;
  assert.ok(!ecology.regions[0].exhausted && restored > depleted);

  // Feed the measured phases from the prepared ecology above to the original
  // terrain/attendance/save path. This is not a generated-world balance test.
  const { map, binding } = original(), record = map.beastHabitatSources;
  let state = N.create(record, binding), s = N.open(state, record, map);
  const { site, r } = context(s, 'beast:ironroot-colossus');
  const overlap = { ...site, id: 'overlapping-plot' }, cell = { x: 128, y: 128, z: 6 }, key = '128,128,6';
  const survey = { worldId: binding.worldId, siteId: site.id, strategicCellId: r.cellId, seed: 'same-plot',
    truth: { environmentalDifficultyPermille: 0 } };
  let journal = Surveys.defaultState(survey);
  const recordCover = () => {
    const captured = Surveys.capture(survey, cell, 'reconnaissance', state.clock, 90, {}, N.soilCoverAt(state, site.id, key));
    const result = Surveys.record(journal, captured); journal = result.state;
    return result.observation;
  };
  const setCover = (at, n) => {
    assert.ok(P.settleRegions(s, at, [r.id]));
    const here = s.regions.find(region => region.id === r.id);
    here.condition.soilCover = n;
    const history = here.ecologicalAccount.viabilityHistory;
    history.minimumCondition.soilCover = Math.min(history.minimumCondition.soilCover, n);
    if (n < here.ecology.viabilityFloors.soilCover) history.floorBreaches.soilCover ||= { firstAt: at, belowDays: 0 };
  };
  const visit = (at, place = site) => N.terrain(state, record, map, place, [cell], at)[key];
  const presence = (at, ...ids) => assert.ok(N.sync(state, record, map, [], at, true, { activeSiteIds: new Set(ids) }));
  setCover(0, initial);
  const first = visit(0);
  first.condition.soilCover -= 30; // A separate local scar.
  first.resources.mineralsKg *= .8; // An independent local withdrawal of finite matter.
  const localBefore = copy(first.resources), opening = recordCover();
  assert.equal(opening.findings.at(-1).result, 'dense');
  setCover(1, initial - 5);
  assert.equal(visit(1, overlap), first);
  assert.equal(first.condition.soilCover, initial - 30, 'overlapping attendance does not apply regional changes');
  presence(1, overlap.id);
  assert.equal(first.soilCoverHistory.baseline, initial);
  setCover(2, initial); presence(1); // An older attendance tick cannot rewind the settled baseline.
  assert.equal(N.soilCoverAt(state, site.id, key), undefined, 'no new sighting while absent');
  assert.equal(first.soilCoverHistory.baseline, initial);

  setCover(3, depleted);
  const after = visit(3), declined = recordCover();
  assert.equal(after, first);
  assert.equal(after.condition.soilCover, 0);
  assert.equal(after.soilCoverHistory.local, -30);
  assert.equal(declined.findings.at(-1).result, 'mostlyBare');
  assert.deepEqual(after.resources, localBefore);
  presence(3);
  N.pack(state, record, map);
  const invalid = copy(state); Object.values(invalid.parcels)[0].soilCoverHistory.baseline = 101;
  assert.throws(() => N.normalize(invalid, binding), /terrain custody/);
  state = N.normalize(copy(state), binding); s = N.open(state, record, map);
  journal = Surveys.normalizeState(copy(journal));
  assert.equal(N.soilCoverAt(state, site.id, key), undefined);
  setCover(4, restored);
  const recovery = visit(4), latest = recordCover();
  assert.equal(recovery.condition.soilCover, restored - 30);
  assert.ok(['patchy', 'dense'].includes(latest.findings.at(-1).result));
  assert.deepEqual(recovery.resources, localBefore);
  const currentStocks = copy(s.regions.find(region => region.id === r.id).stocks);
  assert.equal(visit(4, overlap).condition.soilCover, restored - 30);
  assert.deepEqual(s.regions.find(region => region.id === r.id).stocks, currentStocks);
  assert.deepEqual(journal.observations.slice(0, 2), [opening, declined]);
  assert.deepEqual(journal.observations.map(o => o.sampledAt), [0, 3, 4]);
  assert.ok(journal.observations.every(o => JSON.stringify(o.cell) === JSON.stringify(cell)));
  assert.ok(!JSON.stringify(Surveys.publicKnowledge(journal)).includes('soilCoverHistory'));

  // A pre-feature parcel keeps its stored state and starts from today's
  // regional level; it receives no fabricated historical loss or recovery.
  N.pack(state, record, map);
  const old = copy(state);
  for (const site of Object.values(old.sites)) delete site.soilCoverAttended;
  const legacy = Object.values(old.parcels)[0]; delete legacy.soilCoverHistory; legacy.condition.soilCover = 41;
  state = N.normalize(old, binding);
  assert.equal(visit(4).condition.soilCover, 41);
});
test('native terrain keeps the generated lee frame and seasonal air after reload', () => {
  const { map, binding } = original(), record = map.beastHabitatSources, state = N.create(record, binding);
  const Wind = require('../beast-wind-drift'), Lee = require('../wind-shelters');
  const r = S.expand(record, map).regions.find(r => r.windShelter), lee = r.windShelter, a = Lee.axis(lee.bearingDeg);
  const inside = { eastM: lee.eastM + a.x * lee.lengthM / 2, northM: lee.northM + a.y * lee.lengthM / 2 };
  const site = { id: 'lee-parcel', cellId: r.cellId, kind: 'surface',
    bounds: { x: 0, y: 0, z: 6, width: 3, height: 3 }, origin: { eastM: inside.eastM - .5, northM: inside.northM - .5 } };
  const cell = { x: 0, y: 0, z: 6 };
  const parcels = N.terrain(state, record, map, site, [cell, { ...cell, x: 1 }], 0), parcel = parcels['0,0,6'];
  assert.deepEqual(parcel.windShelter, lee);
  assert.deepEqual(parcel.wind, r.wind);
  assert.equal(parcel.windSchedule, parcels['1,0,6'].windSchedule);
  assert.equal(Object.keys(state.windSchedules).length, 1);
  assert.ok(!Object.keys(parcel).includes('windSchedule'));
  const actor = require('../wilderness-beasts').actor('beast:carrion-lantern', 'local-lee', cell, 'original', 0);
  const expected = Wind.windAt(r, 0, { ...inside, altitudeM: actor.bodyPhysics.altitudeM });
  assert.notDeepEqual(expected, r.wind);
  N.pack(state, record, map); const saved = N.normalize(copy(state), binding);
  const terrain = N.bindTerrain(saved, site.id);
  assert.deepEqual(B.localAir(actor, { terrain: () => terrain['0,0,6'] }), expected);
  actor.bodyPhysics.altitudeM = lee.heightM + 1;
  assert.deepEqual(B.localAir(actor, { terrain: () => terrain['0,0,6'] }), r.wind);
  const nextPhase = saved.windSchedules[r.id].calendar.monthDays[0] * P.DAY;
  assert.deepEqual(B.localAir(actor, { terrain: () => terrain['0,0,6'] }, undefined, nextPhase), Wind.windAt(r, 1));
  const malformed = copy(saved); malformed.windSchedules[r.id].vectors[1].x = 'east';
  assert.throws(() => N.normalize(malformed, binding), /seasonal wind/);
});
test('wetland bank parcels debit their own source and dry or unvisited water never supplies a swimmer', () => {
  const Foreign = require('../foreign-wilderness'), World = require('../strategic-world');
  const world = L.createWorld({ id: 'wetland-bank', worldSeed: 'source-small', generationVersion: 8, createdAt: 'test',
    creationSettings: { strategicMap: { refinementLevel: 2 } } });
  const map = world.generatedData.strategicMap, record = map.beastHabitatSources, binding = { worldId: world.id, runId: 'survey' };
  const bank = Foreign.wetlandBank(record, 45), from = World.cellSnapshot(map, 11), to = World.cellSnapshot(map, 45);
  assert.deepEqual(Foreign.wetlandBank({ ...record, groupRows: [] }, 45), bank);
  const sector = { bounds: { x: 21, y: 8, z: 6, width: 16, height: 12 }, entry: { x: 22, y: 12, z: 6 },
    destination: { approachCellId: from.id, strategicCellId: to.id } };
  const frame = Foreign.populationWindow(sector, from, to, record.patchRows.find(([i, k]) => i === 45 && k === 0)[2], 1, bank);
  const site = { ...frame, id: 'wetland-bank', roomId: 'survey-field', cellId: to.id, kind: 'surface' };
  const state = N.create(record, binding), s = N.open(state, record, map);
  const dry = { x: 30, y: 12, z: 6 }, fields = [dry, ...Array.from({ length: 72 }, (_, i) => ({ x: 31 + i % 8, y: 9 + Math.floor(i / 8), z: 6 }))];
  const cellKey = ({ x, y, z }) => `${x},${y},${z}`, mire = a => a.speciesId === 'beast:mire-choir';
  const ctx = { alive: true, local: true, requireVisitedTerrain: true, at: 0, tileSizeM: 1,
    terrain: c => N.bindTerrain(state, site.id)[cellKey(c)] };
  N.terrain(state, record, map, site, [dry], 0);
  assert.ok(!N.materialize(state, record, map, site, ctx).some(mire));
  const r = s.regions.find(r => r.id === 'habitat:45:wetland'), before = r.stocks.waterL;
  const funded = N.terrain(state, record, map, site, fields, 0);
  assert.equal(funded[cellKey(dry)].sourceRegionId, 'habitat:45:surface');
  assert.equal(funded[cellKey(dry)].waterDepthM, 0);
  const water = Object.values(funded).filter(p => p.fieldWetland);
  assert.ok(water.length > 0);
  assert.ok(water.every(p => p.sourceRegionId === r.id && p.waterDepthM > 1.8));
  assert.ok(Math.abs(before - r.stocks.waterL - water.reduce((n, p) => n + p.resources.waterL, 0)) < before * 1e-12);
  const stock = r.stocks.waterL;
  N.terrain(state, record, map, site, fields, 0);
  assert.equal(r.stocks.waterL, stock);
  const dryCtx = { ...ctx, terrain: c => {
    const p = funded[cellKey(c)];
    return p?.fieldWetland ? { ...p, waterDepthM: 0 } : p;
  } };
  assert.ok(!N.materialize(state, record, map, site, dryCtx).some(mire));
  const actor = N.materialize(state, record, map, site, ctx).find(mire);
  assert.equal(actor?.bodyPhysics.mode, 'swimming');
  assert.equal(actor.nativePopulation.regionId, r.id);
  assert.equal(N.materialize(state, record, map, site, ctx).find(a => a.id === actor.id), actor);
  N.pack(state, record, map); const saved = N.normalize(copy(state), binding);
  assert.deepEqual(saved.sites[site.id].wetlandBank, bank);
  const savedAccount = N.open(saved, record, map), original = savedAccount.details[actor.id];
  assert.equal(original.memberId, actor.life.originalMemberId);
  N.sync(saved, record, map, [original.actor], 0, true, { activeSiteIds: new Set(), retainedActorIds: new Set() });
  assert.equal(N.ownsLocal(saved, actor.id), false);
  const visited = N.bindTerrain(saved, site.id);
  const returning = N.materialize(saved, record, map, site, { ...ctx, terrain: c => visited[cellKey(c)] }).filter(a => a.id === actor.id);
  assert.equal(returning.length, 1);
  assert.equal(returning[0].life.originalMemberId, actor.life.originalMemberId);
  assert.equal(returning[0].bodyPhysics.altitudeM, actor.bodyPhysics.altitudeM);
  assert.equal(savedAccount.regions.find(r => r.id === actor.nativePopulation.regionId).stocks.waterL, stock);
});
test('a mapped shoreline preserves its original rotated offshore body, finite salt water, and surface visibility limits', () => {
  const Foreign = require('../foreign-wilderness'), World = require('../strategic-world');
  const { map, binding } = original(), record = map.beastHabitatSources, coast = Foreign.coastForLand(map, 4, record);
  assert.equal(coast?.seaCellId, World.cellId(88)); assert.equal(coast.axis, 1);
  assert.deepEqual(Foreign.coastForLand(map, 4, { ...record, groupRows: [] }), coast);
  assert.equal(Foreign.coastReference(map, 4, 100), null); // A freshwater/land source is not sea.
  const bounds = { x: 21, y: 8, z: 6, width: 48, height: 24 };
  const site = { id: 'shore', roomId: 'field', cellId: coast.landCellId, kind: 'shore', origin: { eastM: 0, northM: 0 }, bounds, coast };
  const cells = Array.from({ length: bounds.width * bounds.height }, (_, i) => ({
    x: bounds.x + i % bounds.width, y: bounds.y + Math.floor(i / bounds.width), z: bounds.z
  }));
  const state = N.create(record, binding), account = N.open(state, record, map);
  const r = account.regions.find(r => r.id === 'habitat:88:waterColumn'), originalWater = r.stocks.seawaterL;
  const parcelTerrain = p => p && { ...p, obstacleHeightM: 0 };
  const ctx = { alive: true, local: true, at: 0, requireVisitedTerrain: true, terrain: c => parcelTerrain(N.bindTerrain(state, site.id)[B.key(c)]) };
  assert.throws(() => N.terrain(state, record, map, { ...site, coast: { ...coast, seaCellId: World.cellId(45) } }, cells, 0), /original mapped/);
  N.terrain(state, record, map, site, cells.filter(c => c.x < Foreign.coastEast(bounds)), 0);
  assert.equal(r.stocks.seawaterL, originalWater);
  assert.ok(!N.materialize(state, record, map, site, ctx).some(a => a.speciesId === 'beast:reef-wyrm'));
  const view = N.terrain(state, record, map, site, cells, 0), water = Object.values(view).filter(p => p.fieldSeawater);
  assert.ok(water.every(p => p.sourceRegionId === r.id && p.waterKind === 'seawater' && p.resources.seawaterL > 0 && p.floor === false));
  assert.ok(Object.values(view).some(p => p.sourceRegionId === 'habitat:4:shore' && p.floor && !p.fieldSeawater));
  const remainder = r.stocks.seawaterL;
  assert.ok(Math.abs(originalWater - remainder - water.reduce((n, p) => n + p.resources.seawaterL, 0)) < 8);
  N.terrain(state, record, map, site, cells, 0);
  assert.equal(r.stocks.seawaterL, remainder);
  const originalActor = N.materialize(state, record, map, site, ctx).find(a => a.speciesId === 'beast:reef-wyrm');
  assert.equal(originalActor?.bodyPhysics.mode, 'swimming');
  assert.ok(B.occupied(originalActor).every(c => view[B.key(c)]?.sourceRegionId === r.id));
  const { altitudeM, dimensions } = originalActor.bodyPhysics;
  assert.match(B.habitatReason(originalActor, originalActor.mapCell, 'swimming', altitudeM, {
    terrain: c => ({ ...ctx.terrain(c), obstacleBaseM: -4, obstacleHeightM: -2 })
  }), /Solid obstruction/);
  assert.equal(Foreign.coastVisible(altitudeM, dimensions.heightM, 0), true); // Physical breach.
  assert.equal(Foreign.coastVisible(-20, dimensions.heightM, 2), false);
  assert.equal(Foreign.coastVisible(-dimensions.heightM - .5, dimensions.heightM, 0), false);
  assert.equal(Foreign.coastVisible(-dimensions.heightM - .5, dimensions.heightM, 1), true);
  N.pack(state, record, map);
  const saved = N.normalize(copy(state), binding), owner = N.open(saved, record, map);
  N.sync(saved, record, map, [owner.details[originalActor.id].actor], 0, true, { activeSiteIds: new Set(), retainedActorIds: new Set() });
  const parcels = N.bindTerrain(saved, site.id);
  const again = N.materialize(saved, record, map, site, { ...ctx, terrain: c => parcelTerrain(parcels[B.key(c)]) }).find(a => a.id === originalActor.id);
  assert.equal(again.life.originalMemberId, originalActor.life.originalMemberId);
  assert.deepEqual(again.nativePopulation.sourcePosition, originalActor.nativePopulation.sourcePosition);
});
test('shoreline reef placement preserves archived habitat records, population counts, and resource budgets', () => {
  const { map } = original(), seed = map.beastHabitatSources.seed;
  const active = S.generate(seed, map, { reefOpposition: false });
  const archived = S.generate(seed, map, { coastalReefs: false, reefOpposition: false });
  assert.equal(archived.shoreReefOrigins, undefined);
  assert.ok(active.shoreReefOrigins.length > 0);
  const before = JSON.stringify(archived);
  assert.equal(S.validate(archived, map), archived);
  assert.equal(JSON.stringify(archived), before);
  assert.deepEqual(archived.groupRows, active.groupRows);
  assert.deepEqual(archived.populations, active.populations);
  assert.deepEqual(archived.physicalBinding.transfers, active.physicalBinding.transfers);
  assert.deepEqual(archived.physicalBinding.capacities, active.physicalBinding.capacities);
});
test('coastal reef schools partition the original fish and capacity without retrofitting an archive', () => {
  const { map } = original(), seed = map.beastHabitatSources.seed, World = require('../strategic-world');
  const active = S.generate(seed, map, { reefOpposition: false });
  const Foreign = require('../foreign-wilderness'), archived = S.generate(seed, map, { coastalSchools: false, reefOpposition: false });
  const before = JSON.stringify(archived);
  assert.equal(S.validate(archived, map), archived);
  assert.equal(S.validate(active, map), active);
  assert.equal(archived.backgroundWildlife.reefSchoolRows, undefined);
  assert.deepEqual(active.backgroundWildlife.spatialRows, archived.backgroundWildlife.spatialRows);
  assert.deepEqual(active.shoreReefOrigins, archived.shoreReefOrigins);
  assert.deepEqual(active.physicalBinding, archived.physicalBinding);
  assert.deepEqual(active.groupRows, archived.groupRows);
  assert.deepEqual(active.populations, archived.populations);
  const current = S.expand(active, map), legacy = S.expand(archived, map);
  const deferred = S.runtimeSource(active, { ...map, beastHabitatSources: active }, { deferUnused: true });
  const [regionId, site] = active.backgroundWildlife.reefSchoolRows[0];
  const r = current.regions.find(r => r.id === regionId), old = legacy.regions.find(r => r.id === regionId);
  const coast = Foreign.coastReference(map, r.source.cellIndex, r.areaHa);
  assert.ok(Foreign.relative(coast, site.eastM, site.northM)[0] > site.radiusM);
  assert.deepEqual(deferred.regions.find(r => r.id === regionId).wildlife, r.wildlife);
  assert.deepEqual(Object.keys(r.stocks), Object.keys(old.stocks));
  for (const k of Object.keys(r.stocks)) assert.ok(Math.abs(r.stocks[k] - old.stocks[k]) <= Math.abs(old.stocks[k]) * 1e-14);
  for (const donor of old.wildlife.pools.filter(p => p.habitatPatch === 'background')) {
    const next = r.wildlife.pools.find(p => p.id === donor.id);
    const school = r.wildlife.pools.find(p => p.habitatPatch === 'reef-shelf' && p.sizeClass === donor.sizeClass);
    assert.ok(school.originalCount > 0 && school.originalCount <= donor.originalCount * .02);
    for (const k of ['originalCount', 'originalMassKg', 'capacityCount']) assert.equal(next[k] + school[k], donor[k]);
  }
  assert.ok(old.wildlife.pools.every(p => p.habitatPatch !== 'reef-shelf'));
  assert.equal(JSON.stringify(archived), before);
  const forged = copy(active); forged.backgroundWildlife.reefSchoolRows[0][1].eastM++;
  forged.id = ''; forged.id = `beast-habitat-source:${World.stableHash(forged)}`;
  assert.throws(() => S.validate(forged, map), /physical accounts/);
});
test('a generated reef feeds the same original twice, debits finite schools, and resumes without a catch reroll', () => {
  const { map, binding } = original(), active = map.beastHabitatSources;
  const source = S.expand(active, map), r = source.regions.find(r => r.id === 'habitat:88:waterColumn');
  const group = source.groups.find(g => g.regionId === r.id && g.speciesId === 'beast:reef-wyrm'
    && Math.abs(g.home.depthM - 3) < 1e-9);
  assert.ok(group && r.wildlife.pools.some(p => p.habitatPatch === 'reef-shelf'));
  assert.ok(r.ecology.workSites.some(site => site.action === 'cultivateReef'));
  // Use the generated family and local schools unmodified. The isolated
  // diagnostic does not evaluate other regions or assert world viability.
  r.edges = [];
  const diagnostic = { ...source, id: `reef-control:${source.id}`, groups: [group], regions: [r] };
  const s = P.createDiagnostic(diagnostic, binding), current = () => s.regions[0];
  const female = () => s.groups[0].cohorts.find(c => c.role === 'female'), member = copy(female().ranges);
  const schoolLosses = x => x.regions[0].wildlife.pools.filter(p => p.habitatPatch === 'reef-shelf').reduce((n, p) => n + p.huntedCount, 0);
  P.advance(s, 4 * P.DAY, true, true);
  const firstCatch = schoolLosses(s), firstMeal = female().stores.foodKg;
  assert.ok(firstCatch > 0 && firstMeal > 1000 && current().foraging.receipts.eatenKg > 1000);
  P.advance(s, 5 * P.DAY, true, true);
  const afterDigestion = female().stores.foodKg;
  assert.ok(afterDigestion < firstMeal);
  const saved = P.normalize(copy(s), binding); assert.ok(saved);
  const branch = P.rebind(saved, binding, { ...binding, runId: 'continued-reef' });
  let ateAgain = false, lastFood = afterDigestion;
  for (let hour = 121; hour <= 144; hour++) {
    P.advance(s, hour * 3600, true, true);
    P.advance(branch, hour * 3600, true, true);
    if (female().stores.foodKg > lastFood + 1 && schoolLosses(s) > firstCatch) ateAgain = true;
    lastFood = female().stores.foodKg;
  }
  assert.ok(ateAgain, 'the same female gained fresh food after digesting her earlier meal');
  assert.deepEqual(female().ranges, member);
  assert.deepEqual(branch.groups[0].cohorts, s.groups[0].cohorts);
  assert.deepEqual(branch.regions[0].wildlife, current().wildlife);
  assert.deepEqual(branch.regions[0].foraging, current().foraging);
  assert.ok(P.normalize(branch)); assert.ok(P.normalize(s));
  for (const pool of current().wildlife.pools) {
    const living = pool.cohorts.reduce((n, c) => n + c.count, 0);
    assert.equal(living + pool.deadCount + pool.huntedCount, pool.originalCount + pool.bornCount);
  }
  assert.equal(current().stocks.meatKg || 0, 0, 'no regional meat stock supplied the meal');

  // Same fish matter and depth, but the schools all lie at an existing
  // distant position. The Wyrms still search and cannot use the hidden fish.
  const missed = copy(diagnostic), far = r.wildlife.pools.find(p => p.habitatPatch === 'hotspot-2');
  for (const pool of missed.regions[0].wildlife.pools) {
    pool.spatial.eastM = far.spatial.eastM; pool.spatial.northM = far.spatial.northM;
    if (pool.habitatPatch !== 'reef-shelf') { pool.areaHa = far.areaHa; pool.spatial.radiusM = far.spatial.radiusM; }
  }
  const control = P.createDiagnostic(missed, binding);
  P.advance(control, 6 * P.DAY, true, true);
  assert.ok(control.regions[0].foraging.receipts.searches > 0);
  assert.equal(control.regions[0].foraging.receipts.eatenKg, 0);
  assert.ok(control.regions[0].wildlife.pools.every(p => p.huntedCount === 0));
  assert.ok(P.normalize(control));
});
test('a mapped burrow mouth spends original substrate and never reveals a covered or buried body', () => {
  const F = require('../foreign-wilderness'), W = require('../strategic-world');
  const world = L.createWorld({ id: 'burrow-mouth', worldSeed: 'atlas', createdAt: 'test', generationVersion: 8,
    creationSettings: { strategicMap: { refinementLevel: 1 } } });
  const map = world.generatedData.strategicMap, record = map.beastHabitatSources, binding = { worldId: world.id, runId: 'rim' };
  const i = 8, area = record.patchRows.find(([j, k]) => i === j && k === 4)[2];
  const mouth = F.mouthReference(map, i, area);
  const site = { id: 'rim', cellId: W.cellId(i), roomId: 'survey', kind: 'surface', mouth, bounds: { x: 21, y: 8, width: 22, height: 14, z: 6 } };
  site.origin = F.mouthFrame(site, 1);
  assert.ok(mouth && record.burrowMouthOrigins.length);
  const collapse = { ...map, geology: { ...map.geology, stabilityPermille: map.geology.stabilityPermille.map((n, j) => j === i ? 0 : n) } };
  assert.equal(F.mouthReference(collapse, i, area), null);
  const cells = Array.from({ length: site.bounds.width * site.bounds.height }, (_, n) => ({ z: 6,
    x: site.bounds.x + n % site.bounds.width, y: site.bounds.y + Math.floor(n / site.bounds.width) }));
  const state = N.create(record, binding), account = N.open(state, record, map), region = account.regions.find(r => r.id === 'habitat:8:subsurface');
  const before = region.stocks.mineralsKg;
  const incorrect = { ...site, mouth: { ...mouth, eastM: mouth.eastM + 1 } };
  assert.throws(() => N.terrain(state, record, map, { ...incorrect, origin: F.mouthFrame(incorrect, 1) }, cells, 0), /original mapped geology/);
  assert.throws(() => N.terrain(state, record, map, { ...site, origin: { eastM: 0, northM: 0 } }, cells, 0), /original metre frame/);
  N.terrain(state, record, map, site, cells.filter(c => !F.mouthCell(site, c)), 0);
  assert.equal(region.stocks.mineralsKg, before);
  let records = N.bindTerrain(state, site.id);
  const context = { at: 0, alive: true, local: true, requireVisitedTerrain: true, terrain: c => records[B.key(c)] };
  const isFurnace = a => a.speciesId === 'beast:burrowing-furnace';
  assert.ok(!N.materialize(state, record, map, site, context).some(isFurnace));
  records = N.terrain(state, record, map, site, cells, 0);
  const openings = Object.values(records).filter(t => t.fieldBurrowMouth);
  assert.equal(openings.length, 32);
  assert.ok(openings.every(t => t.floor === false && t.sourceRegionId === region.id));
  const remaining = region.stocks.mineralsKg;
  assert.ok(Math.abs(before - remaining - openings.reduce((sum, p) => sum + p.resources.mineralsKg, 0)) < 1);
  const covered = c => ({ ...context.terrain(c), foundation: true });
  assert.ok(!N.materialize(state, record, map, site, { ...context, terrain: covered }).some(isFurnace));
  const found = N.materialize(state, record, map, site, context).find(isFurnace);
  assert.ok(found && found.bodyPhysics.mode === 'burrowing');
  const { altitudeM, dimensions } = found.bodyPhysics, local = context.terrain(found.mapCell);
  assert.equal(F.mouthVisible(local, altitudeM, dimensions.heightM), true);
  assert.equal(F.mouthVisible(covered(found.mapCell), altitudeM, dimensions.heightM), false);
  assert.equal(F.mouthVisible(local, -dimensions.heightM, dimensions.heightM), false);
  assert.equal(F.mouthVisible(context.terrain(cells[0]), altitudeM, dimensions.heightM), false);
  N.pack(state, record, map);
  const saved = N.normalize(copy(state), binding), restored = N.open(saved, record, map);
  N.sync(saved, record, map, [restored.details[found.id].actor], 0, true, { activeSiteIds: new Set(), retainedActorIds: new Set() });
  records = N.terrain(saved, record, map, site, cells, 0);
  const again = N.materialize(saved, record, map, site, context).filter(a => a.id === found.id);
  assert.equal(again.length, 1);
  assert.equal(again[0].life.originalMemberId, found.life.originalMemberId);
  assert.deepEqual(again[0].nativePopulation.sourcePosition, found.nativePopulation.sourcePosition);
  assert.equal(restored.regions.find(r => r.id === region.id).stocks.mineralsKg, remaining);
  const old = S.generate(record.seed, map, { burrowMouths: false }), archived = JSON.stringify(old);
  assert.equal(old.burrowMouthOrigins, undefined);
  assert.equal(S.validate(old, map), old);
  assert.equal(JSON.stringify(old), archived);
  assert.deepEqual(old.groupRows, record.groupRows);
  assert.deepEqual(old.physicalBinding.transfers, record.physicalBinding.transfers);
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
for (const species of [...Suppression.SUPPORTED_SPECIES, Diplomacy.SPECIES]) {
  test(`original encounter ownership works in both orders after reload: ${species}`, () => {
    const { map, binding } = original(), record = map.beastHabitatSources;
    const native = N.create(record, binding), account = N.open(native, record, map);
    const { g, site, ctx } = context(account, species), id = g.populationId;
    const count = record.populations.find(p => p.populationId === id).originalIndividualCount;
    const ape = species === Diplomacy.SPECIES;
    const fixture = ape ? apeSource('ownership-road', 2, count) : suppressionSource(count, 1, species, { crossingOnly: true });
    const source = { ...fixture.source, populationId: id }, habitat = fixture.habitat && { ...fixture.habitat, populationId: id };
    const register = (s, region, owned) => ape
      ? Diplomacy.register(s, source, region, region.beasts.actors, 'ownership', 0, habitat, owned)
      : Suppression.register(s, source, region, region.beasts.actors, 'ownership', 0, owned);
    const createLegacy = () => (ape ? Diplomacy : Suppression).create(binding);
    const owner = (native, region, s) => Regional.ownership({ binding, region, nativeIds: N.encounteredPopulationIds(native),
      ...(ape ? { diplomacy: s } : { suppression: s }) });

    const legacy = createLegacy(), region = Regional.create(binding);
    const first = register(legacy, region, owner(native, region, legacy)); assert.ok(first);
    const wounded = region.beasts.actors[0]; wounded.health *= .75;
    if (ape) {
      assert.ok(first.pool.groups.length > 0);
      assert.ok(first.pool.groups.every(g => g.materializedAt === null));
      // The reserved source must block native claims even without its local
      // representative records (e.g. only the original troop was restored).
      const reserved = owner(native, null, Diplomacy.normalize(copy(legacy)));
      assert.equal(reserved.status(id), 'legacy');
      assert.ok(reserved.unavailableToNative.has(id));
    }
    const savedLegacy = (ape ? Diplomacy : Suppression).normalize(copy(legacy)), savedRegion = Regional.normalize(copy(region));
    const legacyOwned = owner(native, savedRegion, savedLegacy);
    assert.equal(legacyOwned.status(id), 'legacy');
    assert.deepEqual(N.materialize(native, record, map, site, { ...ctx, unavailablePopulations: legacyOwned.unavailableToNative }), []);
    assert.equal(savedRegion.beasts.actors.find(a => a.id === wounded.id).health, wounded.health);

    const [originalBody] = N.materialize(native, record, map, site, ctx);
    assert.equal(originalBody.populationId, id);
    originalBody.health *= .8;
    N.sync(native, record, map, [originalBody], 0, true, { activeSiteIds: new Set() });
    N.pack(native, record, map);
    const serialized = copy(native);
    delete serialized.encounterClaims; // Older compact saves predate the new fast index.
    const restored = N.normalize(serialized, binding), unused = createLegacy(), empty = Regional.create(binding);
    assert.equal(N.hasOpen(restored), false);
    assert.equal(owner(restored, empty, unused).status(id), 'native');
    assert.equal(register(unused, empty, owner(restored, empty, unused)), null);
    assert.deepEqual(empty.members, []);
    const [sameBody] = N.materialize(restored, record, map, site, ctx);
    assert.equal(sameBody.id, originalBody.id); assert.equal(sameBody.health, originalBody.health);

    const conflict = owner(restored, savedRegion, savedLegacy);
    assert.equal(conflict.status(id), 'conflict');
    assert.equal(conflict.canAllocateLegacy(id), false);
    assert.ok(conflict.unavailableToNative.has(id));
    assert.equal(N.materialize(restored, record, map, site, { ...ctx,
      unavailablePopulations: conflict.unavailableToNative })[0].id, sameBody.id, 'existing local actor is not erased');
    N.sync(restored, record, map, [sameBody], 0, true, { activeSiteIds: new Set() });
    assert.deepEqual(N.materialize(restored, record, map, site, { ...ctx, unavailablePopulations: conflict.unavailableToNative }), []);
    if (!ape) {
      for (const a of savedRegion.beasts.actors) { a.status = 'dead'; a.health = 0; }
      assert.equal(Suppression.facts(savedLegacy, savedRegion.beasts.actors, 0)[0].state, 'qualifying');
      const canAssess = id => conflict.status(id) === 'legacy';
      assert.equal(Suppression.facts(savedLegacy, savedRegion.beasts.actors, 0, true, canAssess)[0].state, 'unverified');
    }
    assert.equal(Regional.ownership({ binding: { ...binding, runId: 'independent-run' }, region: savedRegion,
      suppression: ape ? null : savedLegacy, diplomacy: ape ? savedLegacy : null }).status(id), 'unclaimed');
  });
}
test('a managed encounter without attributable identity is not a free second allocation', () => {
  const binding = { worldId: 'world', runId: 'run' }, region = Regional.create(binding), id = 'original-unknown';
  region.managedPopulationIds.push(id);
  const owner = Regional.ownership({ binding, region });
  assert.equal(owner.status(id), 'unverified'); assert.equal(owner.canAllocateLegacy(id), false);
  assert.ok(owner.unavailableToNative.has(id));
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
