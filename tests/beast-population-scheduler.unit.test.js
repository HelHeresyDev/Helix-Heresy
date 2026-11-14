const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), Scheduler = require('../beast-population-scheduler');
const D = require('../creature-biology'), G = require('../beast-demography');
const { source: workSource } = require('./helpers/regional-work-source');
const { source: breedingSource } = require('../scripts/benchmark-beast-demography');
const { source: foodWebSource } = require('./helpers/regional-foodweb-source');
const clone = x => JSON.parse(JSON.stringify(x)), DAY = P.DAY, binding = { worldId: 'world', runId: 'run' };
const approx = (a, b) => assert.ok(Math.abs(a - b) < 1e-7 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function source(n = 2) {
  const speciesId = 'beast:gravebloom-elk', p = D.lifecycle[speciesId];
  return { id: 'regional-clock-source', calendar: { epochAt: 0, monthDays: [29, 31, 28, 32] },
    regions: Array.from({ length: n }, (_, i) => ({ id: `region-${i}`, areaHa: 100,
      stocks: { foodKg: 10000, waterL: 10000, mineralsKg: 10000 },
      capacity: { foodKg: 10000, waterL: 10000, mineralsKg: 10000 }, renewalPerDay: {}, edges: [] })),
    groups: Array.from({ length: n }, (_, i) => ({ id: `group-${i}`, populationId: `population-${i}`, speciesId,
      regionId: `region-${i}`, cohorts: [{ id: `original-${i}`, speciesId, count: 1, ageDays: p.adultDays, massKg: p.adultKg }] })) };
}
const local = (s, i) => clone({ region: s.regions[i], group: s.groups[i], rates: s.rates[`region-${i}`], clock: s.regionClocks[`region-${i}`] });
test('one local interruption visits one account regardless of unrelated world size', () => {
  for (const n of [2, 300]) {
    const s = P.create(source(n), binding), before = clone(s.work), untouched = local(s, n - 1);
    assert.equal(P.removeStock(s, 'region-0', 'foodKg', 1, DAY / 4, 'actual-local-loss'), true);
    assert.deepEqual(local(s, n - 1), untouched);
    for (const key of ['regionRebuilds', 'cohortRateVisits', 'regionIntervals', 'cohortIntervals'])
      assert.equal(s.work[key] - (before[key] || 0), 1, key);
    assert.equal(s.clock, DAY / 4); assert.equal(s.appliedAt, 0);
    assert.equal(s.regionClocks['region-0'].appliedAt, DAY / 4);
    assert.ok(P.normalize(s, binding)); P.audit(s);
  }
});
test('scoped and full reads settle earned work without recalculating rates or replaying it', () => {
  const s = P.create(source(3), binding), rates = clone(s.rates), rebuilds = s.work.regionRebuilds;
  assert.equal(P.settleRegions(s, DAY / 3, ['region-1']), true);
  assert.equal(s.regionClocks['region-0'].appliedAt, 0);
  assert.equal(s.regionClocks['region-1'].appliedAt, DAY / 3);
  assert.deepEqual(s.rates, rates); assert.equal(s.work.regionRebuilds, rebuilds);
  P.advance(s, DAY / 3, true, true); const before = clone(s);
  P.advance(s, DAY / 3, true, true); assert.deepEqual(clone(s), before);
  assert.equal(s.appliedAt, DAY / 3); assert.deepEqual(s.rates, rates);
  assert.equal(P.settleRegions(s, DAY, ['region-0'], false), false); assert.deepEqual(clone(s), before);
  assert.equal(P.settleRegions(s, DAY, ['missing']), false);
});
test('asynchronous regional clocks and caches restore exactly and continued branches remain independent', () => {
  const direct = P.create(source(), binding);
  P.removeStock(direct, 'region-0', 'waterL', 10, DAY / 4, 'actual-fire');
  const snapshot = clone(direct), saved = P.normalize(snapshot, binding);
  assert.ok(saved); assert.deepEqual(clone(saved), snapshot);
  const branch = P.rebind(saved, binding, { ...binding, runId: 'continued' });
  P.advance(direct, 3 * DAY, true, true); P.advance(branch, 3 * DAY, true, true);
  for (let i = 0; i < 2; i++) assert.deepEqual(local(branch, i), local(direct, i));
  assert.deepEqual(P.audit(branch), P.audit(direct)); assert.equal(saved.clock, DAY / 4);
  for (const corrupt of [x => x.regionClocks['region-0'].appliedAt = DAY,
    x => x.regionClocks['region-1'].daily = 1, x => x.nextEventAt++, x => delete x.regionClocks['region-1']]) {
    const bad = clone(snapshot); corrupt(bad); assert.equal(P.normalize(bad, binding), null);
  }
  const empty = source(0), account = P.create(empty, binding); P.advance(account, DAY, true, true);
  assert.ok(P.normalize(account, binding));
});
test('unrelated depletion events do not change a starving account or give it destination knowledge', () => {
  const original = source(), aloneSource = source(1);
  for (const src of [original, aloneSource]) src.regions[0].stocks.foodKg = 0;
  original.regions[1].stocks.foodKg = .01;
  const alone = P.create(aloneSource, binding), together = P.create(original, binding);
  P.advance(alone, 7 * DAY, true, true); P.advance(together, 7 * DAY, true, true);
  assert.deepEqual(local(together, 0), local(alone, 0));
  assert.deepEqual(together.losses.filter(l => l.groupId === 'group-0'), alone.losses);
  assert.deepEqual(together.groups[0].knowledge, []);
});
test('hydraulic dependencies settle together but leave disconnected accounts untouched', () => {
  const src = workSource('buildDam'), extra = source(1);
  src.regions.push(extra.regions[0]); src.groups.push(extra.groups[0]);
  const s = P.create(src, binding), untouched = local(s, 2), before = s.work.regionRebuilds;
  P.removeStock(s, 'workface', 'constructionKg', 1, DAY / 4, 'dam-material-loss');
  assert.equal(s.regionClocks.workface.appliedAt, DAY / 4);
  assert.equal(s.regionClocks.downstream.appliedAt, DAY / 4);
  assert.equal(s.work.regionRebuilds - before, 2); assert.deepEqual(local(s, 2), untouched);
  assert.ok(s.regions[1].receipts.waterL > 0);
  const bad = clone(s); bad.regionClocks.downstream.appliedAt--;
  assert.equal(P.normalize(bad, binding), null); assert.ok(P.normalize(s, binding));
});
test('named dream participants are real dependencies even when physically in another region', () => {
  const src = workSource('dreamWeather'), extra = source(1);
  src.groups[1].regionId = 'downstream'; src.regions.push(extra.regions[0]); src.groups.push(extra.groups[0]);
  const s = P.create(src, binding), before = s.work.regionRebuilds;
  P.setEcologicalActivity(s, 'original-sleepers', { sleeping: false, dreamConsent: false }, DAY / 4, 'sleeper-woke');
  assert.equal(s.work.regionRebuilds - before, 2);
  assert.equal(s.regionClocks.workface.appliedAt, DAY / 4);
  assert.equal(s.regionClocks['region-0'].appliedAt, 0); assert.ok(P.normalize(s, binding));
});
test('lazy event metadata stays bounded during repeated local corrections', () => {
  const s = P.create(source(), binding), before = clone(s.work);
  for (let i = 1; i <= 1000; i++) P.removeStock(s, 'region-0', 'waterL', 0, i, 'actual-local-observation');
  const cache = Scheduler.inspect(s);
  assert.equal(cache.units, 2); assert.ok(cache.eventEntries <= 64); assert.ok(cache.appliedEntries <= 64);
  assert.equal(s.work.cohortRateVisits - before.cohortRateVisits, 1000);
  assert.equal(s.regionClocks['region-1'].appliedAt, 0);
});
test('brood funding does not taper or postpone completion when harmless local refreshes partition time', () => {
  const src = breedingSource(200, 'beast:storm-kite'); src.regions[0].renewalPerDay = {};
  const direct = P.create(src, binding), split = P.create(src, binding);
  for (const s of [direct, split]) s.groups[0].cohorts.forEach(c => c.deathThreshold = 1e12);
  P.advance(direct, 11 * DAY, true, true);
  for (let at = DAY / 16; at <= 11 * DAY; at += DAY / 16)
    P.removeStock(split, 'habitat', 'waterL', 0, at, 'harmless-recorded-interruption');
  assert.ok(direct.births.reduce((n, b) => n + b.count, 0) > 0);
  assert.deepEqual(split.births, direct.births); assert.deepEqual(P.audit(split), P.audit(direct));
  for (const key of Object.keys(direct.regions[0].stocks)) approx(split.regions[0].stocks[key], direct.regions[0].stocks[key]);
  assert.ok(P.normalize(split, binding));
});
test('late structural growth keeps its funded rate until the exact target, without manufacturing mass', () => {
  const src = breedingSource(1, 'beast:rimefang-pack'); delete src.groups[0].breeding;
  src.regions[0].renewalPerDay = {};
  const p = D.lifecycle[src.groups[0].speciesId], s = P.create(src, binding), g = s.groups[0], body = g.cohorts[0];
  body.structuralKg = p.adultKg * .8 - .001;
  body.massKg = body.structuralKg + body.stores.waterL + body.stores.fatKg;
  P.removeStock(s, 'habitat', 'waterL', 0, 0, 'original-nearly-grown-body');
  const rate = G.requests(s, g, body, 0).find(r => r.kind === 'growth');
  approx(rate.perDay, p.adultKg / p.adultDays / p.assimilation);
  const target = p.adultKg * .8, required = (target - body.structuralKg) / p.assimilation;
  const due = required / rate.perDay * DAY, before = s.regions[0].stocks.foodKg;
  P.advance(s, due, true, true); approx(body.structuralKg, target);
  assert.ok(before - s.regions[0].stocks.foodKg >= required - 1e-7);
  assert.equal(G.requests(s, g, body, due).some(r => r.kind === 'growth'), false);
});
test('a separately funded mana tail stops at its exact paid target without waiting for another matter request', () => {
  const src = breedingSource(200, 'beast:ley-manta');
  src.groups[0].breeding.manaStockKey = 'excessMana'; src.regions[0].renewalPerDay = {};
  const s = P.create(src, binding); P.advance(s, 10 * DAY, true, true);
  const g = s.groups[0], c = g.cohorts[0], b = c.demography.broods[0], r = s.regions[0]; assert.ok(b);
  const requiredKg = b.requiredKg * G.size(b.parents), requiredMana = b.requiredMana * G.size(b.parents);
  // Establish an original partially paid fixture by debiting the same finite sources.
  for (const [key, share] of Object.entries(b.materialRecipe)) r.stocks[key] -= (requiredKg - b.investedKg) * share;
  r.stocks.excessMana -= requiredMana * .999 - b.investedMana;
  b.investedKg = requiredKg; b.investedMana = requiredMana * .999;
  P.removeStock(s, 'habitat', 'waterL', 0, s.clock, 'original-paid-matter-and-partial-mana');
  const rate = G.requests(s, g, c, s.clock).find(q => q.brood === b);
  assert.equal(rate.perDay, 0); assert.ok(rate.manaPerDay > 0);
  const due = s.clock + (requiredMana - b.investedMana) / rate.manaPerDay * DAY;
  assert.ok(s.nextEventAt <= due + 1e-7);
  P.advance(s, due, true, true); approx(b.investedMana, requiredMana);
  P.advance(s, due + DAY, true, true); approx(b.investedMana, requiredMana);
  assert.equal(s.births.length, 0, 'funding is not elapsed incubation'); assert.ok(P.normalize(s, binding));
});
test('journey crossings touch their actual endpoints, not unrelated regions, and preserve original mortality residence', () => {
  const src = source(3), g = src.groups[0];
  src.regions[0].edges = [{ id: 'region-1', distanceKm: 2, traversable: true }];
  g.instinct = { mode: 'instinctive', route: ['region-1'] };
  const s = P.create(src, binding); s.groups[0].cohorts[0].deathThreshold = 1e12;
  const depart = s.groups[0].intention.departAt;
  P.advance(s, depart); const transit = clone(s.groups[0].transit);
  assert.ok(transit); const untouched = local(s, 2);
  P.advance(s, transit.crossAt);
  assert.equal(s.regionClocks['region-1'].appliedAt, transit.crossAt);
  assert.deepEqual(local(s, 2), untouched); assert.deepEqual(s.groups[0].knowledge, []);
  P.kill(s, g.id, g.cohorts[0].id, 0, transit.crossAt + 1, 'actual-mid-route-loss');
  P.advance(s, transit.edgeArriveAt);
  assert.equal(s.groups[0].regionId, 'region-1'); assert.equal(s.groups[0].transit, null);
  assert.equal(s.losses.find(l => l.groupId === g.id).regionId, 'region-1');
  assert.ok(P.normalize(s, binding));
});
test('a moving mother retains the original external nursery dependency through a partial save', () => {
  const src = breedingSource(200, 'beast:mire-choir'), extra = source(2);
  src.regions.push(...extra.regions); src.groups.push(...extra.groups.map(g => ({ ...g, id: `extra-${g.id}` })));
  src.regions[0].edges = [{ id: 'region-0', distanceKm: .1, traversable: true }];
  const s = P.create(src, binding); P.advance(s, 2 * DAY, true, true);
  assert.ok(s.groups[0].cohorts[0].demography.broods.length);
  s.groups[0].intention = { destination: 'region-0', departAt: s.clock + 10, chosenAt: s.clock, policy: 'instinctive' };
  P.removeStock(s, 'habitat', 'waterL', 0, s.clock, 'original-departure-established');
  P.advance(s, s.clock + DAY / 2); assert.equal(s.groups[0].regionId, 'region-0');
  const saved = P.normalize(clone(s), binding); assert.ok(saved);
  const before = saved.work.regionRebuilds;
  P.destroyNursery(saved, 'habitat', 'original-nursery', saved.clock + 1, 'actual-nest-loss');
  assert.equal(saved.work.regionRebuilds - before, 2);
  assert.equal(saved.regionClocks.habitat.appliedAt, saved.regionClocks['region-0'].appliedAt);
  assert.equal(saved.regionClocks['region-1'].appliedAt, s.regionClocks['region-1'].appliedAt);
  assert.ok(P.normalize(saved, binding));
});
test('pending food-web contacts normalize against their own regional clocks, not the oldest unrelated account', () => {
  const src = foodWebSource(), extra = source(1); src.regions.push(extra.regions[0]);
  const s = P.create(src, binding), hunter = s.groups[0].cohorts[0];
  hunter.massKg -= hunter.stores.fatKg * .6; hunter.stores.fatKg *= .4;
  P.removeStock(s, 'ground', 'waterL', 0, 0, 'recorded-hungry-body');
  P.advance(s, DAY); assert.equal(s.foodWeb.pending.length, 1);
  const due = s.foodWeb.pending[0].dueAt;
  P.settleRegions(s, DAY + 5, ['ground']);
  assert.equal(s.appliedAt, DAY); assert.equal(s.regionClocks.ground.appliedAt, DAY + 5);
  const saved = P.normalize(clone(s), binding); assert.ok(saved);
  P.advance(s, due); P.advance(saved, due);
  assert.deepEqual(P.audit(saved), P.audit(s)); assert.deepEqual(saved.foodWeb, s.foodWeb);
  assert.equal(saved.foodWeb.receipts.kills, 1); assert.ok(P.normalize(saved, binding));
});
