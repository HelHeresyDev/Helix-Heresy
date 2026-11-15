const test = require('node:test'), assert = require('node:assert/strict');
const W = require('../background-wildlife'), P = require('../beast-populations'), F = require('../beast-regional-foodweb');
const D = require('../creature-biology'), L = require('../world-run-library'), S = require('../beast-habitat-sources');
const { source: foodWebSource } = require('./helpers/regional-foodweb-source');
const clone = x => JSON.parse(JSON.stringify(x)), DAY = P.DAY, binding = { worldId: 'wildlife-world', runId: 'run' };
const approx = (a, b, eps = 1e-7) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function source({ guild = 'smallAnimals', count = 1000, hunter = 'rimefang-pack', hunters = 1, areaHa = 1 } = {}) {
  const src = foodWebSource(hunter ? [[hunter, 0, hunters]] : []), r = src.regions[0], p = W.profiles[guild];
  r.areaHa = areaHa;
  r.stocks = { forageKg: 1e9, organicKg: 1e9, planktonKg: 1e9, waterL: 1e9, meatKg: 0, mineralsKg: 1e9,
    excessMana: 1e9, chargeMJ: 1e9, detritusKg: 0 };
  r.capacity = { ...r.stocks, detritusKg: 1e10 };
  r.seasons = Array.from({ length: 4 }, () => ({ temperatureC: 20, renewal: {} }));
  r.renewalPerDay = {};
  if (guild === 'fish') { r.kind = 'waterColumn'; r.depthM = 100; r.floor = false; r.stocks.seawaterL = r.capacity.seawaterL = areaHa * 10000 * 1000 * 100; }
  const foodKey = guild === 'fish' ? 'planktonKg' : guild === 'insects' ? 'organicKg' : 'forageKg';
  W.apply(src, { allocations: [{ regionId: r.id, pools: [{ id: `prepared:${guild}`, guild, foodKey, areaHa,
    habitatDepthM: guild === 'fish' ? 100 : 0, capacityCount: Math.floor(count * 1.5), originalCount: count, originalMassKg: count * p.adultKg }] }] });
  return src;
}
function fixture(options) {
  const s = P.create(source(options), binding);
  for (const g of s.groups) for (const c of g.cohorts) {
    c.deathThreshold = 1e12;
    const spent = c.stores.fatKg * (g.speciesId === 'beast:carrion-lantern' ? .4 : .6); c.stores.fatKg -= spent; c.massKg -= spent;
    s.regions[0].outputs ||= {}; s.regions[0].outputs.metabolicWasteKg = spent * P.count(c);
  }
  P.removeStock(s, 'ground', 'waterL', 0, 0, 'original-hungry-bodies'); return s;
}
const pool = s => s.regions[0].wildlife.pools[0];
function valid(s) { assert.ok(P.normalize(s, binding), `invalid at ${s.clock / DAY}`); }
function pending(s) {
  for (let i = 0; i < 2000 && s.clock < 10 * DAY; i++) {
    P.advance(s, s.nextEventAt, true, true);
    for (const g of s.groups) for (const c of g.cohorts) if (c.foraging?.phase === 'search')
      return { ...c.foraging.action, groupId: g.id, cohortId: c.id, memberCount: P.count(c) };
  }
  assert.fail('No elapsed original wildlife search was established');
}
test('original wildlife bodies partition standing matter; guilds add no catalog species or meat renewal', () => {
  const src = source(), r = src.regions[0];
  approx(r.stocks.forageKg + r.wildlife.pools[0].originalMassKg, 1e9);
  const s = P.create(src, binding); assert.equal(W.summary(s).original, 1000);
  assert.equal(Object.keys(D.lifecycle).length, 36); assert.equal(s.regions[0].stocks.meatKg, 0);
  assert.equal(s.regions[0].renewalPerDay.meatKg, undefined); valid(s);
});
test('maintenance competes for the same finite supply and paid growth/embryos conserve physical mass', () => {
  const s = fixture({ hunter: null }), r = s.regions[0], p = pool(s);
  const physical = () => Object.entries(r.stocks).filter(([k]) => k.endsWith('Kg') || k === 'waterL').reduce((n, [, kg]) => n + kg, 0)
    + W.mass(p) + p.broods.reduce((n, b) => n + b.investedKg, 0) + p.carcass.massKg
    + Object.values(r.outputs || {}).reduce((n, kg) => n + kg, 0);
  const before = physical(); P.advance(s, 60 * DAY, true, true);
  assert.ok(p.bornCount > 0); assert.ok(p.fundedKg > 0); assert.ok(p.maintenanceKg > 0); assert.ok(p.wasteKg > 0);
  assert.ok(p.cohorts.some(c => c.massKg > W.profiles.smallAnimals.newbornKg && c.massKg < W.profiles.smallAnimals.adultKg));
  approx(physical(), before, 1e-12); valid(s);
});
test('monthly intent grants no upfront animals or funding and incubation cannot be skipped by a read', () => {
  const s = fixture({ hunter: null }), p = pool(s), b = p.broods[0];
  assert.equal(p.bornCount, 0); assert.equal(b.investedKg, 0); assert.ok(b.targetCount > 0);
  P.advance(s, b.dueAt - 1, true, true); assert.equal(p.bornCount, 0); assert.ok(b.investedKg > 0);
  P.advance(s, b.dueAt, true, true); assert.ok(p.bornCount > 0);
  const before = clone(s); P.advance(s, s.clock, true, true); assert.deepEqual(clone(s), before); valid(s);
});
test('zero resources cannot become new wildlife; starvation leaves finite carcasses rather than rescue spawns', () => {
  const s = fixture({ hunter: null }), r = s.regions[0], p = pool(s);
  P.removeStock(s, r.id, p.foodKey, r.stocks[p.foodKey], 0, 'actual-food-loss');
  P.advance(s, 70 * DAY, true, true);
  assert.equal(p.bornCount, 0); assert.equal(W.total(p), 0); assert.equal(p.deadCount, p.originalCount);
  assert.ok(p.carcass.initialMassKg > 0); assert.equal(p.fundedKg, 0); valid(s);
});
test('drying water kills fish even when plankton remains; seawater is not a freshwater requirement', () => {
  const s = fixture({ guild: 'fish', hunter: null }), r = s.regions[0], p = pool(s);
  P.removeStock(s, r.id, 'seawaterL', r.stocks.seawaterL, 0, 'actual-water-column-loss');
  P.advance(s, 10 * DAY, true, true); assert.equal(W.total(p), 0); assert.equal(p.bornCount, 0);
  assert.ok(r.stocks.planktonKg > 0); valid(s);
});
test('losing all live-bearing parents discards only paid gestation without refilling stocks or creating orphan recruits', () => {
  const s = fixture({ hunter: null }), r = s.regions[0], p = pool(s);
  P.advance(s, 10 * DAY, true, true); assert.ok(p.broods[0].investedKg > 0);
  for (const c of p.cohorts) c.health = 0;
  const paid = p.broods.reduce((n, b) => n + b.investedKg, 0), food = r.stocks.forageKg, discarded = p.discardedKg;
  W.boundary(r, s.clock, false);
  P.removeStock(s, r.id, 'waterL', 0, s.clock, 'actual-parent-loss');
  approx(p.discardedKg - discarded, paid); assert.equal(r.stocks.forageKg, food);
  P.advance(s, 60 * DAY, true, true); assert.equal(p.bornCount, 0); assert.equal(W.total(p), 0); valid(s);
});
test('already funded external eggs may survive parent loss but receive no more investment from dead adults', () => {
  const s = fixture({ guild: 'fish', hunter: null }), r = s.regions[0], p = pool(s);
  P.advance(s, 10 * DAY, true, true); const b = p.broods[0], paid = b.investedKg, expectedMaximum = Math.floor(paid / W.profiles.fish.newbornKg);
  assert.ok(paid > 0);
  for (const c of p.cohorts) c.health = 0;
  W.boundary(r, s.clock, false); P.removeStock(s, r.id, 'planktonKg', 0, s.clock, 'actual-original-parent-loss');
  P.advance(s, b.dueAt - 1, true, true); approx(b.investedKg, paid);
  P.advance(s, b.dueAt, true, true); assert.ok(p.bornCount > 0 && p.bornCount <= expectedMaximum); valid(s);
});
test('separate prey guilds share one actual feeding-time budget', () => {
  const src = source({ hunters: 2 }), r = src.regions[0];
  const definition = { id: 'prepared-insects', guild: 'insects', foodKey: 'organicKg', areaHa: 1, habitatDepthM: 0,
    originalCount: 100000, originalMassKg: 200, capacityCount: 150000 };
  r.stocks.organicKg -= definition.originalMassKg; r.wildlife.pools.push(definition);
  const s = P.create(src, binding), c = s.groups[0].cohorts[0];
  c.massKg -= c.stores.fatKg * .6; c.stores.fatKg *= .4;
  P.removeStock(s, r.id, 'waterL', 0, 0, 'original-hungry-members');
  const q = pending(s); P.advance(s, q.dueAt + 660, true, true);
  assert.ok(W.summary(s).consumedKg > 0);
  assert.ok(W.summary(s).consumedKg <= D.lifecycle[s.groups[0].speciesId].foodKgDay * 660 / 600 * q.memberCount + 1e-7);
  valid(s);
});
test('hunting spends real time/effort and integer prey before food reaches the original hunters', () => {
  const s = fixture({ hunters: 2 }), p = pool(s), q = pending(s), c = s.groups[0].cohorts.find(c => c.id === q.cohortId);
  const count = W.total(p), food = c.stores.foodKg, budget = s.groups[0].foodWebPlan.huntingRemaining;
  P.advance(s, q.startedAt + 100, true, true); assert.ok(c.regional.stamina < 300); assert.equal(p.huntedCount, 0);
  P.advance(s, q.dueAt - 1, true, true); assert.equal(p.huntedCount, 0);
  P.advance(s, q.dueAt, true, true); assert.equal(p.carcass.consumedKg, 0, 'finding prey is not an instant meal');
  P.advance(s, q.dueAt + 660, true, true);
  assert.ok(p.huntedCount > 0); assert.equal(W.total(p), count - p.huntedCount);
  assert.ok(c.stores.foodKg > food); assert.ok(p.carcass.consumedKg > 0);
  assert.equal(s.groups[0].foodWebPlan.huntingRemaining, budget); assert.equal(s.regions[0].stocks.meatKg, 0);
  approx(W.summary(s).original + W.summary(s).born, W.summary(s).living + W.summary(s).dead + W.summary(s).hunted); valid(s);
});
test('search outcomes use local density, do not reserve prey, and cannot spend the same prey twice', () => {
  const s = fixture({ count: 10, hunters: 20 }), p = pool(s), q = pending(s);
  const before = W.total(p); p.cohorts[0].count = 0; p.deadCount += before;
  const kg = before * p.cohorts[0].massKg;
  Object.assign(p.carcass, { initialMassKg: p.carcass.initialMassKg + kg, massKg: p.carcass.massKg + kg, edibleKg: p.carcass.edibleKg + kg * .6 });
  P.removeStock(s, 'ground', 'waterL', 0, s.clock, 'actual-prey-loss-before-arrival');
  P.advance(s, q.dueAt + 660, true, true);
  assert.equal(p.huntedCount, 0); assert.ok(p.carcass.consumedKg <= p.carcass.initialMassKg * .6);
  const eaten = p.carcass.consumedKg; P.advance(s, s.clock, true, true); assert.equal(p.carcass.consumedKg, eaten); valid(s);
});
test('unlocated hunters, obstructed habitat, refusal and wrong media provide no ambient food', () => {
  for (const change of [src => delete src.groups[0].home, src => src.groups[0].willing = false,
    src => src.regions[0].contactBarriers = [{ minEastM: -10, maxEastM: 10, minNorthM: -10, maxNorthM: 10, bottomM: -10, topM: 10 }]]) {
    const src = source(); change(src); const s = P.create(src, binding);
    P.advance(s, 5 * DAY, true, true); assert.equal(pool(s).huntedCount, 0); assert.equal(pool(s).carcass.consumedKg, 0); valid(s);
  }
  const marine = fixture({ guild: 'fish' }); P.advance(marine, 3 * DAY, true, true);
  assert.equal(pool(marine).huntedCount, 0, 'a grounded wolf cannot forage through a deep water column'); valid(marine);
});
test('local wildlife interruption leaves unrelated regional bodies, funding, rates and clocks unchanged', () => {
  const src = source({ hunter: null }), away = clone(src.regions[0]); away.id = 'unrelated';
  away.wildlife.pools[0].id = 'unrelated-animals'; src.regions.push(away);
  const s = P.create(src, binding), before = clone({ region: s.regions[1], rate: s.rates.unrelated, clock: s.regionClocks.unrelated });
  P.removeStock(s, 'ground', 'forageKg', 10, DAY / 4, 'actual-local-material-loss');
  assert.deepEqual(clone({ region: s.regions[1], rate: s.rates.unrelated, clock: s.regionClocks.unrelated }), before);
  valid(s);
});
test('a search interrupted by incapacity, refusal or water loss does not complete a catch', () => {
  for (const change of [s => s.groups[0].willing = false,
    s => { const c = s.groups[0].cohorts[0]; c.regional.parts.head = 0; c.regional.parts.torso = 0; }]) {
    const s = fixture(), q = pending(s); change(s);
    P.advance(s, q.dueAt, true, true); assert.equal(pool(s).huntedCount, 0); assert.equal(pool(s).carcass.consumedKg, 0);
  }
  const s = fixture({ guild: 'fish', hunter: 'reef-wyrm', count: 100000 }), q = pending(s), r = s.regions[0];
  P.removeStock(s, r.id, 'seawaterL', r.stocks.seawaterL, q.startedAt + 100, 'actual-water-loss-during-search');
  P.advance(s, q.dueAt, true, true); assert.equal(pool(s).huntedCount, 0); valid(s);
});
test('partial searches survive normalization and continued branches without refunds or prey refills', () => {
  const s = fixture(), q = pending(s); P.advance(s, q.startedAt + 100, true, true);
  const saved = P.normalize(clone(s), binding); assert.ok(saved);
  const continued = P.rebind(saved, binding, { ...binding, runId: 'continued' });
  P.advance(s, q.dueAt + 660, true, true); P.advance(continued, q.dueAt + 660, true, true);
  assert.deepEqual(W.summary(continued), W.summary(s)); assert.deepEqual(continued.regions[0].wildlife, s.regions[0].wildlife);
  assert.equal(saved.clock, q.startedAt + 100);
  const fresh = fixture(); assert.equal(pool(fresh).huntedCount, 0); assert.equal(pool(fresh).bornCount, 0); valid(s);
});
test('original participant loss and handoff cancel pending batch work without creating a meal or refunding effort', () => {
  const s = fixture({ hunters: 2 }), q = pending(s), g = s.groups[0], c = g.cohorts.find(c => c.id === q.cohortId);
  const stamina = c.regional.stamina;
  assert.ok(P.detail(s, g.id, c.id, c.ranges[0][0], 'original-physical-hunter', q.startedAt + 100));
  assert.equal(c.foraging.action, null); assert.ok(c.regional.stamina <= stamina);
  P.advance(s, q.dueAt, true, true); assert.equal(pool(s).huntedCount, 0); valid(s);
});
test('scavenging consumes local natural carcasses without killing living wildlife', () => {
  const s = fixture({ hunter: 'carrion-lantern', count: 100000 }); const q = pending(s);
  assert.equal(q.scavenge, true);
  P.advance(s, 2 * DAY, true, true);
  assert.equal(pool(s).huntedCount, 0); assert.ok(pool(s).carcass.consumedKg > 0);
  approx(pool(s).carcass.initialMassKg, pool(s).carcass.massKg + pool(s).carcass.consumedKg + pool(s).carcass.decomposedKg); valid(s);
});
test('waterborne predators can encounter finite fish, without treating every fish in the column as nearby', () => {
  const s = fixture({ guild: 'fish', hunter: 'reef-wyrm', count: 100000, areaHa: 1 }), q = pending(s);
  const p = pool(s), before = W.total(p); assert.ok(q.depthM > 0 && q.depthM < p.habitatDepthM);
  P.advance(s, q.dueAt + 660, true, true); assert.ok(p.huntedCount > 0); assert.ok(p.huntedCount < before);
  assert.ok(p.carcass.consumedKg > 0); valid(s);
});
test('arbitrary read partitioning and reloads preserve paid funding, growth, loss and recruitment', () => {
  const direct = fixture({ hunter: null }), src = source({ hunter: null }); P.advance(direct, 100 * DAY, true, true);
  let split = P.create(src, binding);
  for (let i = 1; i <= 400; i++) { P.advance(split, i * DAY / 4, true, true); if (!(i % 17)) { split = P.normalize(clone(split), binding); assert.ok(split); } }
  const a = W.summary(direct), b = W.summary(split);
  for (const key of Object.keys(a)) approx(a[key], b[key]);
  for (const key of Object.keys(direct.regions[0].stocks)) approx(direct.regions[0].stocks[key], split.regions[0].stocks[key]); valid(direct); valid(split);
});
test('births, original membership, body matter, pending claims and cached rates reject corruption', () => {
  const s = fixture(), q = pending(s); P.advance(s, q.startedAt + 1, true, true); valid(s);
  for (const corrupt of [x => pool(x).cohorts[0].count++, x => pool(x).cohorts[0].massKg *= 2,
    x => pool(x).huntedCount++, x => pool(x).carcass.edibleKg = 1e12,
    x => x.rates.ground.wildlifeRates[0].factor = 2,
    x => x.groups[0].cohorts[0].foraging.phase = 'bogus', x => pool(x).broods[0].investedKg = 1e12,
    x => x.groups[0].cohorts[0].foraging.mealIds.push('missing'),
    x => x.groups[0].cohorts[0].foraging.plan.used.search = 1e12]) {
    const bad = clone(s); corrupt(bad); assert.equal(P.normalize(bad, binding), null);
  }
});
test('headcount stays batched and final death freezes all background effects', () => {
  const results = [];
  for (const count of [1000, 1000000]) {
    const s = fixture({ count, hunter: null }); P.advance(s, 120 * DAY, true, true);
    results.push({ cohorts: W.summary(s).cohorts, intervals: s.work.regionIntervals, bytes: JSON.stringify(s.regions[0].wildlife).length });
    const before = clone(s); P.advance(s, 150 * DAY, false, true); assert.deepEqual(clone(s), before); valid(s);
  }
  assert.ok(results[1].cohorts <= results[0].cohorts + 2); assert.ok(results[1].bytes < results[0].bytes * 3);
  assert.ok(results[1].intervals < results[0].intervals * 3);
});
test('new generated worlds archive reproducible wildlife allocations; old archives acquire nothing on load', () => {
  const world = L.createWorld({ id: binding.worldId, worldSeed: 'source-small', generationVersion: 8, createdAt: 'test', creationSettings: { strategicMap: { refinementLevel: 2 } } });
  const map = world.generatedData.strategicMap, record = map.beastHabitatSources, before = clone(world);
  assert.ok(record.backgroundWildlife.allocations.length); assert.ok(S.validate(record, map));
  assert.deepEqual(S.generate(world.worldSeed, map), record); assert.deepEqual(world, before);
  const old = S.generate(world.worldSeed, map, { backgroundWildlife: false }), archivedMap = clone(map); archivedMap.beastHabitatSources = old;
  assert.equal(old.backgroundWildlife, undefined); S.validate(old, archivedMap);
  assert.ok(S.expand(old, archivedMap).regions.every(r => !r.wildlife));
  const corrupt = clone(record); corrupt.backgroundWildlife.allocations[0].pools[0].originalCount++;
  const SW = require('../strategic-world'); corrupt.id = ''; corrupt.id = `beast-habitat-source:${SW.stableHash(corrupt)}`;
  assert.throws(() => S.validate(corrupt, map), /physical accounts/);
  assert.equal(record.assessment.status, 'rejected'); assert.throws(() => S.runtimeSource(record, map), /Rejected/);
});
