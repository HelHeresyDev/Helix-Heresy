const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), L = require('../creature-life'), W = require('../wilderness-beasts');
const C = require('../carrion-lantern-biology'), F = require('../beast-foraging');
const { windSource } = require('./helpers/wind-source');
const copy = x => JSON.parse(JSON.stringify(x)), DAY = P.DAY;
const binding = { worldId: 'passive-lantern', runId: 'original' };
function fixture({ humidity = 70, vapour = 100, members = 1, wind = { x: .5, y: 0 } } = {}) {
  const src = windSource({ members, cohorts: 1, wind, preyX: 100000 }); src.groups = src.groups.slice(0, 1);
  const r = src.regions[0]; r.humidity = humidity;
  r.seasons.forEach(s => { s.humidity = humidity; });
  r.stocks.atmosphericWaterL = vapour; r.capacity.atmosphericWaterL = vapour;
  const s = P.create(src, binding); for (const c of s.groups[0].cohorts) c.deathThreshold = 1e12;
  return s;
}
const valid = s => assert.ok(P.normalize(s, binding), `invalid at day ${s.clock / DAY}`);
test('approved adult basal demand and finite fasting reserves are actually consumed', () => {
  const p = C.profile(); assert.equal(p.foodKgDay, .05); assert.equal(p.waterLDay, .03); assert.equal(p.foodReserveDays, 60);
  const s = fixture(), c = s.groups[0].cohorts[0]; assert.equal(c.stores.fatKg, 3);
  P.advance(s, 30 * DAY, true, true);
  assert.equal(c.health, 1); assert.ok(c.stores.fatKg > 1.4 && c.stores.fatKg < 1.6);
  assert.equal(F.summary(s).searchSeconds, 0); assert.equal(F.summary(s).eatenKg, 0);
  assert.ok(c.regionalPosition.eastM > 1000000); valid(s);
});
test('humidity is a transfer ceiling, never an inexhaustible source or remote ground-water tap', () => {
  for (const options of [{ humidity: 0 }, { humidity: null }, { vapour: 0 }]) {
    const s = fixture(options); P.advance(s, 30 * DAY, true, true);
    assert.equal(s.regions[0].airMoistureTakenL || 0, 0);
    assert.equal(P.audit(s)['population-0'].background, 0); assert.ok(s.losses.some(l => l.cause === 'dehydration')); valid(s);
  }
});
test('air uptake debits the shared original pool and conserves water and body matter', () => {
  const s = fixture(), r = s.regions[0], c = s.groups[0].cohorts[0]; P.advance(s, 10 * DAY, true, true);
  const taken = r.airMoistureTakenL;
  assert.ok(taken > .25 && taken < .35); assert.ok(Math.abs(100 - r.stocks.atmosphericWaterL - taken) < 1e-8);
  const out = r.outputs;
  assert.ok(Math.abs(30 + 100 - c.massKg - r.stocks.atmosphericWaterL - out.metabolicWasteKg - out.waterVaporKg) < 1e-7); valid(s);
});
test('many mouths compete for one finite moisture pool without individual planning or refill', () => {
  const s = fixture({ members: 1000000, vapour: 1 }); P.advance(s, DAY, true, true);
  assert.ok(s.regions[0].airMoistureTakenL <= 1 + 1e-8); assert.ok(s.work.cohortIntervals < 1000); valid(s);
});
test('membrane damage, cold, dry and unknown air reduce uptake without creating food', () => {
  assert.equal(C.airRate(30, { membrane: 100 }, {}), 0);
  assert.equal(C.airRate(30, { membrane: 100 }, { humidity: 90, temperatureC: -5 }), 0);
  assert.equal(C.airRate(30, { membrane: 100 }, { humidity: 20, temperatureC: 20 }), 0);
  assert.equal(C.airRate(30, { membrane: 50 }, { humidity: 70, temperatureC: 20 }), .03);
  const meal = C.partition(2, .2);
  assert.deepEqual(meal, { food: .9, light: .1, water: .2, wasteWater: .8 });
  assert.equal(Object.values(meal).reduce((a, b) => a + b, 0), 2);
});
test('saved passive sensing and finite air flows resume independently with no backfilled work after death', () => {
  const s = fixture(); P.advance(s, DAY / 2, true, true); valid(s);
  const branch = P.rebind(P.normalize(s, binding), binding, { ...binding, runId: 'continued' });
  P.advance(s, 3 * DAY, true, true); P.advance(branch, 3 * DAY, true, true);
  assert.deepEqual(s.groups, branch.groups); assert.deepEqual(s.regions, branch.regions); valid(s);
  const frozen = copy(s); P.advance(s, 100 * DAY, false, true); assert.deepEqual(copy(s), frozen);
});
test('native passive drift keeps basal metabolism while actual feeding exertion costs more', () => {
  const a = W.actor(C.ID, 'actual-original', { x: 0, y: 0, z: 6 }, 'original-population', 0);
  assert.equal(L.demand(a, DAY, true).foodKg, .05);
  a.life.activity = 'feed'; assert.equal(L.demand(a, DAY, true).foodKg, .4);
  a.life.activity = 'idle'; const patch = { humidity: 70, temperatureC: 20, resources: { atmosphericWaterL: 1 } };
  const before = a.bodyPhysics.massKg;
  L.advance(a, DAY, { alive: true, local: true, travelling: true, patch: () => patch, damage: () => assert.fail('healthy passive body') });
  assert.ok(Math.abs(patch.resources.atmosphericWaterL - .97) < 1e-10);
  assert.ok(Math.abs(a.bodyPhysics.massKg - before + .05) < 1e-10);
});
test('real wet tissue hydrates an empty body and a full store does not create infinitesimal refill events', () => {
  const s = P.create(windSource(), binding), g = s.groups[0], c = g.cohorts[0], r = s.regions[0];
  const removed = c.stores.waterL; c.stores.waterL = 0; c.massKg -= removed; r.outputs = { preparedWaterLossL: removed };
  P.kill(s, s.groups[1].id, s.groups[1].cohorts[0].id, 0, 0, 'original-carcass');
  P.advance(s, 400, true, true); assert.ok(c.stores.waterL > .2); assert.ok(c.stores.foodKg > 0);
  P.advance(s, DAY, true, true); assert.ok(s.work.boundaries < 1000); valid(s);
});
test('forged air receipts, rates, passive flags and impossible humidity are rejected', () => {
  const s = fixture(); P.advance(s, 100, true, true); valid(s);
  for (const change of [x => x.groups[0].cohorts[0].airIntakeLDay = 1000,
    x => x.regions[0].airMoistureTakenL = -1, x => x.regions[0].seasons[0].humidity = 101,
    x => x.groups[0].cohorts[0].foraging.action.manaRate = 1,
    x => x.groups[0].cohorts[0].foraging.action.effortRate = .1]) {
    const bad = copy(s); change(bad); assert.equal(P.normalize(bad), null);
  }
});
