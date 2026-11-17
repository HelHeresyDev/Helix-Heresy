const test = require('node:test'), assert = require('node:assert/strict');
const W = require('../background-wildlife'), P = require('../beast-populations'), T = require('../carcass-tissues');
const F = require('../beast-foraging');
const { source: basic } = require('./helpers/regional-foodweb-source');
const copy = x => JSON.parse(JSON.stringify(x)), DAY = P.DAY, binding = { worldId: 'established-wildlife', runId: 'original' };
const near = (a, b) => assert.ok(Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function source({ areaHa = 100, overflow = false, animals = false } = {}) {
  const s = basic(animals ? [['carrion-lantern', 0, 1]] : []), r = s.regions[0];
  s.spatialContinuity = true; r.areaHa = areaHa; r.depthM = 0; r.wind = { x: 0, y: 0 };
  const renew = { forageKg: 100000, organicKg: 100000, waterL: 100000, mineralsKg: 0, meatKg: 0 };
  r.stocks = { forageKg: 1e7, organicKg: 1e7, waterL: 1e8, mineralsKg: 1e7, detritusKg: 0, meatKg: 0 };
  r.capacity = { ...r.stocks, detritusKg: overflow ? 0 : 1e9 };
  r.renewalPerDay = renew; r.seasons = Array.from({ length: 4 }, () => ({ temperatureC: 20, humidity: 70, renewal: renew }));
  if (animals) { s.groups[0].windDriven = true; s.groups[0].resources.foodKg = 'carrionKg'; }
  return s;
}
function apply(s, distributed = true) {
  const record = W.allocate(s, 'fixed-wildlife', { distributed }); W.apply(s, record); return record;
}
const valid = s => assert.ok(P.normalize(s, binding));
test('new patches partition exactly the old integer wildlife and original body matter without multiplying supply', () => {
  const raw = source(), original = W.allocate(raw, 'fixed-wildlife'), newer = W.allocate(raw, 'fixed-wildlife', { distributed: true });
  assert.deepEqual(newer.spatialRows, original.spatialRows);
  const a = W.definitions(original, raw.regions)[0].pools, b = W.definitions(newer, raw.regions)[0].pools;
  assert.equal(b.length, a.length * 4);
  for (const old of a) {
    const parts = b.filter(p => p.guild === old.guild && p.sizeClass === old.sizeClass);
    assert.equal(parts.reduce((n, p) => n + p.originalCount, 0), old.originalCount);
    assert.equal(parts.reduce((n, p) => n + p.capacityCount, 0), old.capacityCount);
    near(parts.reduce((n, p) => n + p.originalMassKg, 0), old.originalMassKg);
    assert.equal(new Set(parts.map(p => `${p.spatial.eastM}:${p.spatial.northM}:${p.areaHa}`)).size, 4);
  }
  const oldSource = copy(raw), newSource = copy(raw); W.apply(oldSource, original); W.apply(newSource, newer);
  near(oldSource.regions[0].stocks.forageKg, newSource.regions[0].stocks.forageKg);
  near(oldSource.regions[0].stocks.organicKg, newSource.regions[0].stocks.organicKg);
});
test('establishment debits real original individuals and conserves every tissue class through its actual corpse age', () => {
  const raw = source(); apply(raw); const s = P.create(raw, binding), r = s.regions[0];
  assert.ok(W.summary(s).startingDead > 0); assert.equal(W.summary(s).born, 0);
  for (const p of r.wildlife.pools) {
    const dead = p.establishment.deaths.reduce((n, x) => n + x, 0), mass = W.profile(p).adultKg;
    assert.equal(W.total(p) + dead, p.originalCount); assert.equal(p.deadCount, dead);
    near(p.carcass.initialMassKg, dead * mass);
    for (const key of T.animalKeys) {
      const profile = T.profiles[key];
      const expected = p.establishment.deaths.reduce((n, count, i) => n + count * mass * profile.share * Math.exp(-profile.decayDay * (6.5 - i)), 0);
      near(p.carcass.tissues[key].kg, expected);
    }
    near(W.mass(p) + p.carcass.massKg + p.carcass.decomposedKg, p.originalMassKg);
  }
  near(r.stocks.detritusKg, W.summary(s).startingDecomposedKg); valid(s);
});
test('initial decay overflow is physical output, not deleted matter or a refill', () => {
  const raw = source({ overflow: true }), original = raw.regions[0].stocks.forageKg + raw.regions[0].stocks.organicKg;
  apply(raw); const s = P.create(raw, binding), r = s.regions[0];
  assert.equal(r.stocks.detritusKg, 0); assert.ok(r.outputs.wildlifeEstablishmentDecayOverflowKg > 0);
  near(r.stocks.forageKg + r.stocks.organicKg + r.wildlife.pools.reduce((n, p) => n + W.mass(p) + p.carcass.massKg, 0)
    + r.outputs.wildlifeEstablishmentDecayOverflowKg, original); valid(s);
});
test('existing unmarked allocations retain their exact geometry and pristine historical initialization', () => {
  const old = source(); const record = apply(old, false), definitions = copy(old.regions[0].wildlife.pools);
  const s = P.create(old, binding); assert.equal(record.distribution, undefined);
  assert.equal(W.summary(s).startingDead, 0); assert.equal(W.summary(s).dead, 0);
  assert.ok(s.regions[0].wildlife.pools.every((p, i) => !p.establishment && p.carcass.massKg === 0
    && JSON.stringify(p.spatial) === JSON.stringify(definitions[i].spatial))); valid(s);
});
test('reload and independent continuation preserve starting remains without replaying mortality or moving corpses', () => {
  const raw = source(); apply(raw); const s = P.create(raw, binding); P.advance(s, DAY / 2, true, true); valid(s);
  const before = copy(s), restored = P.normalize(s, binding); assert.deepEqual(restored.regions, s.regions);
  const branch = P.rebind(restored, binding, { ...binding, runId: 'continued' });
  P.advance(s, 3 * DAY, true, true); P.advance(branch, 3 * DAY, true, true);
  assert.deepEqual(s.regions, branch.regions); valid(s);
  const frozen = copy(s); P.advance(s, 100 * DAY, false, true); assert.deepEqual(s, frozen);
  assert.equal(W.summary(before).startingDead, W.summary(s).startingDead);
  for (let i = 0; i < s.regions[0].wildlife.pools.length; i++)
    assert.deepEqual(s.regions[0].wildlife.pools[i].spatial, before.regions[0].wildlife.pools[i].spatial);
});
test('starting mortality receipts, histories and habitat markers reject corruption', () => {
  const raw = source(); apply(raw); const s = P.create(raw, binding); valid(s);
  for (const change of [p => p.establishment.deaths[0]++, p => p.establishment.decomposedKg++,
    p => p.establishedDays = 100, p => p.habitatPatch = 'invented', p => delete p.establishment]) {
    const bad = copy(s); change(bad.regions[0].wildlife.pools[0]); assert.equal(P.normalize(bad), null);
  }
});
test('patch and tissue-object counts stay bounded when the represented population is multiplied', () => {
  const original = source(), record = W.allocate(original, 'fixed-wildlife', { distributed: true });
  const small = W.definitions(record, original.regions), bigRecord = copy(record);
  bigRecord.spatialRows.forEach(row => row.forEach((n, i) => { if (i) row[i] *= 1000000; }));
  const large = W.definitions(bigRecord, original.regions);
  assert.equal(large[0].pools.length, small[0].pools.length);
  assert.ok(JSON.stringify(large).length < JSON.stringify(small).length * 1.5);
});
test('a supplied compact habitat sustains actual scavenging through 120 days without hunting living wildlife', () => {
  const raw = source({ animals: true }); apply(raw);
  const r = raw.regions[0], g = raw.groups[0], site = r.wildlife.pools.find(p => p.habitatPatch === 'hotspot-0').spatial;
  Object.assign(g.home, { eastKm: site.eastM / 1000, northKm: site.northM / 1000 });
  const s = P.create(raw, binding);
  // Isolate food sufficiency, not a promise of individual survival against unrelated hazards.
  s.groups[0].cohorts[0].deathThreshold = 1e12;
  P.advance(s, 120 * DAY, true, true);
  assert.equal(P.audit(s)['population-0'].background, 1);
  assert.ok(s.groups[0].cohorts[0].health > .99);
  assert.ok(F.summary(s).eatenKg > 10); near(F.summary(s).eatenKg, W.summary(s).consumedKg);
  assert.equal(W.summary(s).hunted, 0); assert.ok(W.summary(s).born > 0);
  assert.ok(!s.losses.some(l => ['starvation', 'dehydration'].includes(l.cause))); valid(s);
});
test('uneconomic diffuse carrion is released and reviewed later instead of repeated handling loops', () => {
  const raw = source({ animals: true, areaHa: 1e9 }); apply(raw);
  raw.regions[0].wind = { x: .5, y: 0 };
  const s = P.create(raw, binding); P.advance(s, DAY, true, true);
  const c = s.groups[0].cohorts[0], receipts = F.summary(s);
  assert.ok(c.foraging.carrionFieldReviewAt > 0);
  assert.equal(receipts.handlingSeconds, 0); assert.equal(receipts.eatenKg, 0);
  assert.equal(W.summary(s).consumedKg, 0); assert.ok(s.work.boundaries < 1000);
  assert.ok(s.regions[0].wildlife.pools.every(p => !p.carcass.reservedKg)); valid(s);
  const restored = P.normalize(s, binding);
  P.advance(s, 2 * DAY, true, true); P.advance(restored, 2 * DAY, true, true);
  assert.deepEqual(restored.regions, s.regions); assert.deepEqual(restored.groups, s.groups); valid(s);
});
test('a sensed original point corpse is not hidden by an overlapping ambient carrion field', () => {
  const raw = source({ animals: true, areaHa: 1e9 }); apply(raw);
  const prey = basic([['gravebloom-elk', 20, 1]]).groups[0];
  prey.id = 'actual-prey'; prey.populationId = 'actual-prey'; prey.cohorts[0].id = 'original-prey'; raw.groups.push(prey);
  const s = P.create(raw, binding);
  P.kill(s, 'actual-prey', prey.cohorts[0].id, 0, 0, 'original-carcass');
  s.groups[0].cohorts[0].regional.stamina = 300;
  P.advance(s, 20, true, true);
  const c = s.groups[0].cohorts[0];
  assert.ok(c.carrionApproach, JSON.stringify(c));
  assert.equal(c.carrionApproach.target.kind, 'beast');
  P.advance(s, 300, true, true); assert.ok(F.summary(s).eatenKg > 0); valid(s);
});
