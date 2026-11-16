const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), F = require('../beast-regional-foodweb'), D = require('../creature-biology'), Life = require('../creature-life');
const clone = x => JSON.parse(JSON.stringify(x)), DAY = P.DAY, binding = { worldId: 'world', runId: 'run' };
const approx = (a, b, eps = 1e-7) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const { source } = require('./helpers/regional-foodweb-source');
function fixture(rows) {
  const s = P.create(source(rows), binding);
  for (const g of s.groups) for (const c of g.cohorts) {
    c.deathThreshold = 1e9;
    if (['beast:glasswing-roc', 'beast:rimefang-pack', 'beast:carrion-lantern'].includes(g.speciesId)) {
      const spent = c.stores.fatKg * .6; c.stores.fatKg -= spent; c.massKg -= spent;
      s.regions[0].outputs ||= {}; s.regions[0].outputs.metabolicWasteKg = (s.regions[0].outputs.metabolicWasteKg || 0) + spent * P.count(c);
    }
  }
  P.removeStock(s, 'ground', 'waterL', 0, 0, 'initial-hunger-established'); return s;
}
function valid(s) { assert.ok(P.normalize(s, binding)); P.audit(s); }
test('airborne bodies over ocean retain their actual mode rather than gaining unsupported swimming', () => {
  const src = source([['storm-kite', 0, 1], ['reef-wyrm', 2, 1]]), r = src.regions[0];
  Object.assign(r, { kind: 'waterColumn', floor: false, depthM: 100 });
  r.stocks.seawaterL = r.capacity.seawaterL = r.areaHa * 10000 * 1000 * r.depthM;
  src.groups[1].home.depthM = 15;
  const s = P.create(src, binding);
  const actors = s.groups.map(g => F.actor(g, g.cohorts[0], 0, s.regions[0], 0));
  assert.equal(actors[0].bodyPhysics.mode, 'flight'); assert.equal(actors[0].bodyPhysics.altitudeM, 0);
  assert.equal(actors[1].bodyPhysics.mode, 'swimming'); assert.equal(actors[1].bodyPhysics.altitudeM, -15);
  valid(s);
});
test('monthly intentions have finite authored attempt budgets and accrue no upfront kills, food or remote knowledge', () => {
  const s = fixture(), before = clone(s.foodWeb), p = D.lifecycle['beast:glasswing-roc'];
  assert.equal(s.groups[0].foodWebPlan.huntingRemaining, Math.floor(2 * p.huntsDay * 29));
  assert.equal(s.foodWeb.receipts.kills, 0); assert.equal(s.regions[0].stocks.meatKg, 0);
  P.advance(s, DAY / 2, true, true); assert.deepEqual(s.foodWeb, before);
  assert.deepEqual(s.groups[0].knowledge, []); valid(s);
});
test('a physical hunt spends one opportunity and elapsed contact time before an original prey can die', () => {
  const s = fixture(); P.advance(s, DAY, true, true);
  assert.equal(s.foodWeb.receipts.attempts, 1); assert.equal(s.foodWeb.pending.length, 1);
  assert.equal(s.foodWeb.receipts.kills, 0);
  const pending = s.foodWeb.pending[0]; P.advance(s, pending.dueAt - 1, true, true); assert.equal(s.foodWeb.receipts.kills, 0);
  P.advance(s, pending.dueAt, true, true);
  assert.equal(s.foodWeb.receipts.kills, 1); assert.equal(P.audit(s)['population-1'].dead, 1);
  assert.equal(s.details && Object.keys(s.details).length, 0);
  assert.equal(s.regions[0].stocks.meatKg, 0, 'a kill is not unlocated generic meat'); valid(s);
});
test('same-region distant, obstructed, unlocated and protected prey cannot supply a meal or a victory', () => {
  for (const change of [src => src.groups[1].home.eastKm = 100,
    src => delete src.groups[1].home,
    src => src.groups[0].protectedGroupIds = ['group-1'],
    src => src.regions[0].contactBarriers = [{ minEastM: 1, maxEastM: 2, minNorthM: -100, maxNorthM: 100, bottomM: -10, topM: 100 }]]) {
    const src = source(); change(src); const s = P.create(src, binding);
    const c = s.groups[0].cohorts[0]; c.stores.fatKg *= .4;
    P.advance(s, 2 * DAY, true, true);
    assert.equal(s.foodWeb.receipts.contacts, 0); assert.equal(s.foodWeb.receipts.kills, 0); assert.equal(s.foodWeb.receipts.consumedKg, 0); valid(s);
  }
});
test('a faster sensed prey can escape; failed pursuit preserves original lives and costs finite effort', () => {
  const s = fixture([['rimefang-pack', 0, 1], ['storm-kite', 10, 1]]);
  // Choose a source group seed with a supported, not guaranteed, opportunity.
  for (let i = 0; Life.random(`${s.groups[0].id}:${DAY}:opportunity`) >= .4; i++) s.groups[0].id = `hunter-${i}`;
  P.advance(s, DAY + F.DURATION, true, true);
  assert.equal(s.foodWeb.receipts.contacts, 1); assert.equal(s.foodWeb.receipts.kills, 0); assert.ok(s.foodWeb.receipts.escapes > 0);
  assert.ok(s.groups[0].cohorts[0].regional.stamina < 300); valid(s);
});
test('scavengers consume only actual reachable remains and share finite tissue with decomposition', () => {
  const s = fixture([['carrion-lantern', 0, 3], ['storm-kite', 1, 5]]);
  P.kill(s, 'group-1', 'original-1', 0, 0, 'actual-trauma');
  const row = Object.values(s.regions[0].remainsBatches)[0], initial = row.initialEdibleKg;
  assert.equal(s.foodWeb.receipts.consumedKg, 0); P.advance(s, DAY, true, true);
  assert.ok(row.consumedKg > 0); assert.ok(row.decomposedKg > 0);
  approx(row.edibleKg + row.consumedKg + row.decomposedKg, initial);
  const eaten = row.consumedKg; P.advance(s, DAY, true, true); assert.equal(row.consumedKg, eaten);
  assert.equal(s.foodWeb.receipts.attempts, 0); valid(s);
});
test('one corpse cannot be consumed again by another regional scavenger or copied from a detailed owner', () => {
  const s = fixture([['carrion-lantern', 0, 2], ['carrion-lantern', 0, 2], ['storm-kite', 1, 2]]);
  P.kill(s, 'group-2', 'original-2', 0, 0, 'actual-death');
  const row = Object.values(s.regions[0].remainsBatches)[0]; P.advance(s, 2 * DAY, true, true);
  assert.ok(row.consumedKg <= row.initialEdibleKg); approx(row.edibleKg + row.consumedKg + row.decomposedKg, row.initialEdibleKg);
  assert.equal(s.foodWeb.receipts.kills, 0);
  const d = P.detail(s, 'group-2', 'original-2', 1, 'local-original', s.clock);
  assert.ok(d); P.recordDetailedLoss(s, d.actorId, s.clock, 'local-physical-death', d.massKg);
  assert.equal(Object.keys(s.regions[0].remainsBatches).length, 1); valid(s);
});
test('wood bodies have no edible tissue and a missing position is not a regional carcass-location oracle', () => {
  for (const suffix of ['ironroot-colossus', 'storm-kite']) {
    const s = fixture([['carrion-lantern', 0, 1], [suffix, 1, 1]]);
    if (suffix === 'storm-kite') delete s.groups[1].home;
    P.kill(s, 'group-1', 'original-1', 0, 0, 'actual-death'); P.advance(s, 2 * DAY, true, true);
    assert.equal(s.foodWeb.receipts.consumedKg, 0); valid(s);
  }
});
test('original participant loss interrupts a pending contact without another death or a free meal', () => {
  const s = fixture(); P.advance(s, DAY, true, true); const p = s.foodWeb.pending[0], member = p.members[1];
  P.kill(s, member.groupId, member.cohortId, member.ordinal, DAY + 1, 'independent-actual-trauma');
  assert.equal(s.foodWeb.pending.length, 0); assert.equal(s.foodWeb.receipts.interrupted, 1);
  P.advance(s, p.dueAt, true, true); assert.equal(s.foodWeb.receipts.kills, 0);
  assert.equal(P.audit(s)['population-1'].dead, 1); valid(s);
});
test('partial contacts, consumed carcasses, original wounds and branch ownership survive saves without replaying effort', () => {
  const direct = fixture(), chunked = fixture();
  P.advance(direct, 3 * DAY, true, true); P.advance(chunked, DAY + 5, true, true);
  const saved = P.normalize(JSON.parse(JSON.stringify(chunked)), binding); assert.ok(saved);
  const continued = P.rebind(saved, binding, { ...binding, runId: 'continued' });
  P.advance(continued, 3 * DAY, true, true);
  assert.deepEqual(continued.foodWeb.receipts, direct.foodWeb.receipts); assert.deepEqual(P.audit(continued), P.audit(direct));
  for (const [key, n] of Object.entries(direct.regions[0].stocks)) approx(n, continued.regions[0].stocks[key]);
  assert.notEqual(chunked.clock, continued.clock); const before = clone(continued);
  P.advance(continued, 10 * DAY, false, true); assert.deepEqual(continued, before); valid(direct);
});
test('inflated edible mass, malformed personal reserves and forged pending membership fail normalization', () => {
  const s = fixture(); P.advance(s, DAY, true, true);
  const forged = clone(s); forged.foodWeb.pending[0].members[0].ordinal = 999; assert.equal(P.normalize(forged), null);
  const free = clone(s); free.groups[0].cohorts[0].regional.stamina = 301; assert.equal(P.normalize(free), null);
  P.advance(s, DAY + F.DURATION, true, true);
  const inflated = clone(s); Object.values(inflated.regions[0].remainsBatches)[0].edibleKg++; assert.equal(P.normalize(inflated), null);
});

test('a heard original pack can attempt larger prey, but distant or unwilling members cannot lend their mass', () => {
  for (const n of [1, 8]) {
    const s = fixture([['rimefang-pack', 0, n], ['gravebloom-elk', 3, 1]]);
    for (let i = 0; Life.random(`${s.groups[0].id}:${DAY}:opportunity`) >= .4; i++) s.groups[0].id = `heard-pack-${i}`;
    P.advance(s, DAY, true, true);
    if (n === 1) assert.equal(s.foodWeb.pending.length, 0);
    else { assert.equal(s.foodWeb.pending.length, 1); assert.equal(s.foodWeb.pending[0].members.length, 9); }
    valid(s);
  }
  const s = fixture([['rimefang-pack', 0, 1], ['rimefang-pack', 0, 1000], ['gravebloom-elk', 3, 1]]);
  s.groups[1].willing = false;
  P.advance(s, DAY, true, true); assert.equal(s.foodWeb.pending.length, 0); valid(s);
});
test('an approved antagonism needs personally sensed recent damage, not labels or an unrelated regional loss', () => {
  for (const harms of [[], [{ groupId: 'someone-else', at: DAY, position: { eastM: 0, northM: 0, altitudeM: 0 } }],
    [{ groupId: 'group-1', at: DAY, position: { eastM: 500, northM: 0, altitudeM: 0 } }],
    [{ groupId: 'group-1', at: DAY, position: { eastM: 1, northM: 0, altitudeM: 0 } }]]) {
    const s = fixture([['ironroot-colossus', 0, 1], ['ashhorn-behemoth', 1, 1]]);
    // No other feeding during this interval can be mistaken for the supplied
    // observation; these source bodies need no food attempt before the pulse.
    s.groups[1].resources.foodKg = 'absent';
    s.groups[1].cohorts[0].stores.fatKg = 0;
    s.regions[0].contactHarms = harms;
    P.removeStock(s, 'ground', 'waterL', 0, 0, 'actual-observation-input');
    P.advance(s, DAY, true, true);
    assert.equal(s.foodWeb.pending.length, harms[0]?.groupId === 'group-1' && harms[0].position.eastM === 1 ? 1 : 0); valid(s);
  }
});
test('a partial local handoff settles only elapsed contact and preserves wounds without a duplicate background member', () => {
  const s = fixture([['rimefang-pack', 0, 8], ['gravebloom-elk', 3, 1]]);
  for (let i = 0; Life.random(`${s.groups[0].id}:${DAY}:opportunity`) >= .4; i++) s.groups[0].id = `local-pack-${i}`;
  P.advance(s, DAY + 20, true, true); const pending = s.foodWeb.pending[0], member = pending.members[1];
  const d = P.detail(s, member.groupId, member.cohortId, member.ordinal, 'actual-local-body', s.clock);
  assert.ok(d); assert.equal(s.foodWeb.pending.length, 0); assert.equal(P.audit(s)['population-1'].detailed, 1);
  assert.ok(d.health < 1); valid(s);
});
test('regional death of an original contributor debits its performed work and does not restore that capacity next month', () => {
  const { source: workSource } = require('./helpers/regional-work-source');
  const src = workSource('tendWetland'), worker = src.groups[0]; src.regionalFoodWeb = true;
  worker.home = { patchId: worker.regionId, eastKm: 0, northKm: 0, depthM: 0 };
  const hunter = source([['glasswing-roc', 1, 1]]).groups[0];
  hunter.id = 'local-roc'; hunter.regionId = worker.regionId; hunter.home.patchId = worker.regionId;
  hunter.cohorts[0].id = 'actual-roc'; src.groups.push(hunter);
  const r = src.regions[0]; Object.assign(r, { kind: 'wetland', floor: true, oxygen: true });
  // Supply an actual shallow landing/rest margin for the winged hunter; a
  // flooded deep column is not a free airborne stamina recovery site.
  r.stocks.waterL = 1.7e9;
  const s = P.create(src, binding), c = s.groups[1].cohorts[0];
  const spent = c.stores.fatKg * .6; c.stores.fatKg -= spent; c.massKg -= spent;
  for (let i = 0; Life.random(`${hunter.id}:${DAY}:opportunity`) >= .65; i++) hunter.id = s.groups[1].id = `local-roc-${i}`;
  P.removeStock(s, r.id, 'waterL', 0, 0, 'recorded-original-hunger');
  P.advance(s, DAY + F.DURATION, true, true);
  assert.equal(P.audit(s)['original-population'].dead, 1);
  assert.ok(s.regions[0].ecologicalAccount.sourceLosses.some(loss => loss.kind === 'contributor'));
  const paid = s.regions[0].ecologicalReceipts.tendWetland;
  P.advance(s, 30 * DAY, true, true); approx(s.regions[0].ecologicalReceipts.tendWetland, paid); valid(s);
});
test('millions of original members use the same bounded spatial/group work, not a per-member hunt loop', () => {
  const measurements = [];
  for (const n of [10, 1000000]) {
    const s = fixture([['mirror-ape', 0, n], ['mirror-ape', 200, n]]);
    P.advance(s, DAY, true, true); measurements.push(s.foodWeb.work);
    assert.ok(s.groups.reduce((n, g) => n + g.cohorts.length, 0) <= 4); valid(s);
  }
  assert.deepEqual(measurements[0], measurements[1]);
  const dense = fixture(Array.from({ length: 200 }, () => ['mirror-ape', 0, 100]));
  P.advance(dense, DAY, true, true);
  assert.equal(dense.foodWeb.work.indexedGroups, 200); assert.ok(dense.foodWeb.receipts.deferred > 0);
  assert.ok(dense.foodWeb.work.candidateChecks <= 200 * F.LIMIT * 9); valid(dense);
});
test('observing one member does not place an entire original cohort or distributed deaths at its centre', () => {
  const s = fixture([['mirror-ape', 0, 10000], ['carrion-lantern', 0, 1]]), g = s.groups[0], c = g.cohorts[0], r = s.regions[0];
  const a = F.actor(g, c, 0, r, 0), b = F.actor(g, c, 9999, r, 0);
  assert.ok(Math.hypot(a.mapCell.x - b.mapCell.x, a.mapCell.y - b.mapCell.y) > 40);
  const stable = F.position(g, r, c, 9999); P.kill(s, g.id, c.id, 0, 0, 'actual-known-death');
  assert.deepEqual(F.position(g, r, c, 9999), stable);
  c.aggregateMortality = true; c.mortalityBalance = 10; c.batchMembers = P.count(c); c.batchHazard = 0;
  P.advance(s, DAY, true, true);
  assert.ok(Object.values(r.remainsBatches).some(row => row.count > 1 && row.position === null)); valid(s);
});
test('personal mana and stored-charge recovery consume actual compatible material and energy, never refill on reads', () => {
  const s = fixture([['ironroot-colossus', 0, 1], ['storm-kite', 200, 1]]), r = s.regions[0];
  s.groups[0].resources.foodKg = 'organicKg'; P.removeStock(s, r.id, 'waterL', 0, 0, 'compatible-original-root-food');
  const beforeCharge = r.stocks.chargeMJ; P.advance(s, DAY, true, true);
  const colossus = s.groups[0].cohorts[0], kite = s.groups[1].cohorts[0];
  assert.ok(colossus.regional.mana > 0); assert.ok(r.outputs.manaRecoveryWasteKg > 0);
  assert.ok(kite.regional.energy.chargeMJ > 0); approx(beforeCharge - r.stocks.chargeMJ, kite.regional.energy.chargeMJ);
  const before = JSON.stringify(s); P.normalize(s); P.advance(s, DAY, true, true); assert.equal(JSON.stringify(s), before); valid(s);
  const imported = clone(s); delete imported.groups[0].cohorts[0].regional; assert.equal(P.normalize(imported), null);
});
test('ordinary source classification cannot attack through solid rock or turn an adult behemoth into roc prey', () => {
  const s = fixture([['glasswing-roc', 0, 1], ['ashhorn-behemoth', 1, 1]]);
  P.advance(s, 2 * DAY, true, true); assert.equal(s.foodWeb.receipts.contacts, 0); valid(s);
  const underground = fixture([['nullmaw-stalker', 0, 1], ['burrowing-furnace', 2, 1]]);
  Object.assign(underground.regions[0], { kind: 'subsurface', depthM: 8, accessibleMineralDepthM: 8 });
  for (const g of underground.groups) g.home.depthM = 3;
  P.advance(underground, 2 * DAY, true, true); assert.equal(underground.foodWeb.receipts.kills, 0); valid(underground);
});
test('corpse provenance and body matter remain conserved rather than trusting a rebalanced edible tally', () => {
  const s = fixture(); P.advance(s, DAY + F.DURATION, true, true);
  const invented = clone(s), row = Object.values(invented.regions[0].remainsBatches)[0];
  row.initialEdibleKg *= 2; row.edibleKg *= 2; row.massKg *= 2; assert.equal(P.normalize(invented), null);
  const vanished = clone(s); vanished.regions[0].remainsBatches = {}; assert.equal(P.normalize(vanished), null);
  const unowned = clone(s); delete unowned.foodWeb; assert.equal(P.normalize(unowned), null);
});
test('physical handoff refreshes an original position after elapsed pursuit and carries its actual wounds and reserves', () => {
  const s = fixture([['rimefang-pack', 0, 8], ['gravebloom-elk', 3, 1]]);
  for (let i = 0; Life.random(`${s.groups[0].id}:${DAY}:opportunity`) >= .4; i++) s.groups[0].id = `handoff-pack-${i}`;
  P.advance(s, DAY + 20, true, true); const m = s.foodWeb.pending[0].members[1], r = s.regions[0];
  const ctx = F.context(r, [], 0);
  ctx.originalPosition = (g, c, ordinal) => {
    const p = F.position(g, r, c, ordinal);
    return { regionId: r.id, cell: { x: Math.round(p.eastM), y: Math.round(p.northM), z: 0 }, altitudeM: p.altitudeM, mode: 'walking' };
  };
  ctx.originalReserves = (g, c) => ({ stamina: c.regional.stamina, mana: c.regional.mana, energy: c.regional.energy });
  const a = P.claimLocal(s, m.groupId, m.cohortId, m.ordinal, 'native-original', s.clock, ctx);
  assert.ok(a); const c = s.groups[1].cohorts.find(c => c.id === m.cohortId);
  assert.equal(a.mapCell.x, Math.round(c.regionalPosition.eastM));
  assert.ok(a.health < a.maxHealth); assert.deepEqual(a.bodyPhysics.parts, c.regional.parts);
  assert.equal(s.foodWeb.pending.length, 0); assert.equal(P.audit(s)['population-1'].detailed, 1); valid(s);
});
