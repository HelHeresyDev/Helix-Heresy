const test = require('node:test'), assert = require('node:assert/strict');
const W = require('../background-wildlife'), P = require('../beast-populations'), F = require('../beast-foraging');
const Biology = require('../creature-biology'), Bodies = require('../beast-bodies'), Foodweb = require('../beast-regional-foodweb');
const { source: originalSource } = require('./helpers/regional-foodweb-source');
const DAY = P.DAY, seed = 'finite-feeding-grounds', binding = { worldId: seed, runId: 'original' };
const copy = x => JSON.parse(JSON.stringify(x));
const approx = (a, b) => assert.ok(Math.abs(a - b) < 1e-7 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function source({ marine = false, hunter = marine ? 'reef-wyrm' : 'glasswing-roc', scale = 1 } = {}) {
  const src = originalSource(hunter ? [[hunter, 0, 1]] : []), r = src.regions[0]; src.spatialContinuity = true;
  r.areaHa = 1e6; r.depthM = marine ? 100 : 0;
  r.kind = marine ? 'waterColumn' : 'surface'; r.floor = !marine;
  r.stocks = { forageKg: 1e8 * scale, organicKg: 1e8 * scale, planktonKg: 1e8 * scale,
    waterL: 1e10 * scale, seawaterL: marine ? r.areaHa * 10000 * 1000 * r.depthM : 0,
    meatKg: 0, mineralsKg: 1e8, chargeMJ: 1e8, excessMana: 1e8, detritusKg: 0 };
  r.capacity = { ...r.stocks, detritusKg: 1e12 };
  r.seasons = Array.from({ length: 4 }, () => ({ temperatureC: 20,
    renewal: { forageKg: 1e6 * scale, organicKg: 1e6 * scale, planktonKg: 1e6 * scale, waterL: 1e7 * scale } }));
  for (const g of src.groups) {
    const pos = W.initialPosition(r, seed, g.id);
    Object.assign(g.home, { eastKm: pos.eastM / 1000, northKm: pos.northM / 1000,
      depthM: marine ? Bodies.profiles[g.speciesId].heightM * 1.2 : 0 });
    g.resources.foodKg = 'meatKg';
  }
  return src;
}
function fixture(options) {
  const src = source(options); W.apply(src, W.allocate(src, seed)); const s = P.create(src, binding);
  // Only suppress unrelated strategic natural mortality in this food sufficiency control.
  for (const g of s.groups) for (const c of g.cohorts) c.deathThreshold = 1e12;
  return s;
}
const valid = s => assert.ok(P.normalize(s, binding), `invalid spatial account at ${s.clock / DAY}`);
test('size classes share the original food/water budget and partition rather than add standing body matter', () => {
  for (const marine of [false, true]) {
    const src = source({ marine, hunter: null }), before = copy(src.regions[0].stocks), r = src.regions[0];
    const record = W.allocate(src, seed); assert.deepEqual(record, W.allocate(src, seed)); W.apply(src, record);
    assert.deepEqual(r.wildlife.pools.filter(p => p.guild === (marine ? 'fish' : 'smallAnimals')).map(p => p.sizeClass), ['small', 'medium', 'large']);
    for (const key of ['forageKg', 'organicKg', 'planktonKg']) {
      const pools = r.wildlife.pools.filter(p => p.foodKey === key);
      approx(r.stocks[key] + pools.reduce((n, p) => n + p.originalMassKg, 0), before[key]);
      assert.ok(pools.reduce((n, p) => n + p.originalMassKg, 0) <= before[key] * .02);
      const food = pools.reduce((n, pool) => { const p = W.profile(pool); return n + pool.originalCount
        * (p.foodDay + p.offspringDay * p.newbornKg / p.assimilation); }, 0);
      assert.ok(food <= r.seasons[0].renewal[key] * .05);
    }
    assert.ok(r.wildlife.pools.every(p => p.areaHa === r.areaHa * .00025));
    assert.equal(r.stocks.meatKg, 0); assert.equal(r.seasons[0].renewal.meatKg, undefined);
    assert.equal(Object.keys(Biology.lifecycle).length, 36); valid(P.create(src, binding));
  }
});
test('a herd or school has bounded actual geometry, not an everywhere-dense regional field', () => {
  for (const marine of [false, true]) {
    const s = fixture({ marine, hunter: null }), r = s.regions[0], pool = r.wildlife.pools[0], site = pool.spatial;
    const q = { areaHa: pool.areaHa, depthM: 1, position: { regionId: r.id, eastM: site.eastM, northM: site.northM,
      altitudeM: marine ? -site.depthTopM - pool.habitatDepthM / 2 : 0 } };
    approx(W.encounterFraction(pool, q), marine ? 1 / pool.habitatDepthM : 1);
    assert.equal(W.encounterFraction(pool, { ...q, position: null }), 0);
    assert.equal(W.encounterFraction(pool, { ...q, position: { ...q.position, eastM: site.eastM + site.radiusM * 3 } }), 0);
    if (marine) assert.equal(W.encounterFraction(pool, { ...q, position: { ...q.position, altitudeM: -90 } }), 0);
    const partial = W.encounterFraction(pool, { ...q, position: { ...q.position, eastM: site.eastM + site.radiusM } });
    assert.ok(partial > 0 && partial < W.encounterFraction(pool, q));
    const before = W.summary(s);
    assert.deepEqual(W.capture(r, {}, {}, { ...q, id: 'wrong-frame', position: { ...q.position, regionId: 'other' },
      guilds: [pool.id], success: 1, memberCount: 1 }, 100, 0), []);
    assert.deepEqual(W.summary(s), before); valid(s);
  }
});
test('source homes use the same stable geography without revealing it to migration decisions', () => {
  const s = fixture(), g = s.groups[0], r = s.regions[0], c = g.cohorts[0], expected = W.initialPosition(r, seed, g.id);
  approx(g.home.eastKm * 1000, expected.eastM); approx(g.home.northKm * 1000, expected.northM);
  const site = r.wildlife.pools[0].spatial;
  assert.ok(Math.hypot(expected.eastM - site.eastM, expected.northM - site.northM) <= site.radiusM * .7);
  assert.deepEqual(g.knowledge, []); assert.ok(g.instinct == null);
  const a = Foodweb.actor(g, c, c.ranges[0][0], r, 0), classes = W.guilds(r, c, a);
  assert.ok(classes.some(id => id.endsWith(':large')));
  c.massKg = 20;
  assert.ok(!W.guilds(r, c, a).some(id => id.endsWith(':large')), 'a small predator cannot kill adult 100 kg prey');
});
test('supplied classed land and marine grounds sustain actual predators through a seasonal cycle with paid meals', () => {
  for (const marine of [false, true]) {
    const s = fixture({ marine }), g = s.groups[0], c = g.cohorts[0]; P.advance(s, 120 * DAY, true, true);
    assert.equal(P.audit(s)[g.populationId].background, 1); assert.ok(c.health > .99);
    assert.ok(F.summary(s).eatenKg > Biology.lifecycle[g.speciesId].foodKgDay * 90);
    assert.ok(W.summary(s).hunted > 0); assert.ok(s.regions[0].wildlife.pools.some(p => p.sizeClass === 'large' && p.huntedCount > 0));
    assert.equal(s.regions[0].stocks.meatKg, 0); valid(s);
  }
});
test('classed wildlife funds its actual size-specific growth and broods, and loses bodies when food disappears', () => {
  const s = fixture({ marine: true, hunter: null }); P.advance(s, 80 * DAY, true, true);
  for (const p of s.regions[0].wildlife.pools) {
    assert.ok(p.bornCount > 0); assert.ok(p.fundedKg > 0);
    assert.ok(p.cohorts.some(c => c.massKg > W.profile(p).newbornKg && c.massKg < W.profile(p).adultKg));
  }
  valid(s);
  const r = s.regions[0]; P.removeStock(s, r.id, 'seawaterL', r.stocks.seawaterL, s.clock, 'actual-column-loss');
  P.advance(s, 90 * DAY, true, true); assert.equal(W.summary(s).living, 0); valid(s);
});
test('partial classed searches and meals save and branch without rerolling geometry or duplicating prey', () => {
  const s = fixture();
  for (let i = 0; i < 1000 && !s.groups[0].cohorts[0].foraging?.action; i++) P.advance(s, s.nextEventAt, true, true);
  const c = s.groups[0].cohorts[0]; assert.equal(c.foraging.phase, 'search');
  P.advance(s, s.clock + 100, true, true); const savedClock = s.clock, saved = P.normalize(copy(s), binding); assert.ok(saved);
  const branch = P.rebind(saved, binding, { ...binding, runId: 'continued' });
  P.advance(s, 40 * DAY, true, true); P.advance(branch, 40 * DAY, true, true);
  assert.deepEqual(W.summary(branch), W.summary(s)); assert.deepEqual(F.summary(branch), F.summary(s));
  assert.equal(saved.clock, savedClock); assert.ok(saved.clock < s.clock); valid(s);
  const stopped = copy(s); P.advance(s, 50 * DAY, false, true); assert.deepEqual(copy(s), stopped);
});
test('malformed classes or missing, oversized and submerged geometry cannot normalize', () => {
  const s = fixture(); valid(s);
  for (const change of [p => { p.sizeClass = 'invented'; }, p => { p.sizeClass = 'constructor'; },
    p => { delete p.spatial; }, p => { delete p.sizeClass; }, p => { p.spatial.radiusM *= 2; },
    p => { p.spatial.eastM = 1e12; }, p => { p.originalMassKg *= 10; }]) {
    const bad = copy(s); change(bad.regions[0].wildlife.pools[0]); assert.equal(P.normalize(bad, binding), null);
  }
  const bad = fixture({ marine: true, hunter: null }); bad.regions[0].wildlife.pools[0].spatial.depthTopM = 100;
  assert.equal(P.normalize(bad, binding), null);
});
test('millions more classed animals add counts rather than individual objects or planners', () => {
  const results = [];
  for (const scale of [1, 1000]) {
    const s = fixture({ hunter: null, scale }); P.advance(s, 60 * DAY, true, true); valid(s);
    results.push({ count: W.summary(s).original, cohorts: W.summary(s).cohorts,
      visits: s.work.regionIntervals, bytes: JSON.stringify(s.regions[0].wildlife).length });
  }
  assert.ok(results[1].count > results[0].count * 900);
  assert.ok(results[1].cohorts < results[0].cohorts * 2);
  assert.ok(results[1].visits < results[0].visits * 3); assert.ok(results[1].bytes < results[0].bytes * 2);
});
test('compact immutable rows reconstruct the exact definitions, preserve legacy allocations and reject malformed geometry sources', () => {
  const src = source({ hunter: null }), record = W.allocate(src, seed), expanded = W.definitions(record, src.regions);
  const legacyShape = { allocations: copy(expanded) }, a = copy(src), b = copy(src);
  W.apply(a, record); W.apply(b, legacyShape); assert.deepEqual(a, b);
  assert.ok(JSON.stringify(record).length < JSON.stringify(legacyShape).length / 3);
  assert.deepEqual(W.definitions(legacyShape, src.regions), expanded);
  for (const change of [r => r.spatialRows[0].pop(), r => r.spatialRows[0][1] = -1,
    r => r.spatialRows[0][0] = 'missing', r => r.spatialRows.push(copy(r.spatialRows[0])), r => r.seed = '']) {
    const bad = copy(record); change(bad); assert.throws(() => W.definitions(bad, src.regions), /Invalid original spatial wildlife/);
  }
});
