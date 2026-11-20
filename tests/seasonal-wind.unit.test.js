const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), B = require('../beast-bodies'), W = require('../wilderness-beasts');
const { windSource } = require('./helpers/wind-source');
const binding = { worldId: 'seasonal-coast', runId: 'original' }, copy = x => JSON.parse(JSON.stringify(x));
const turnAt = 432, offshore = { x: -.25, y: 0 }, onshore = { x: .5, y: 0 };
const calendar = { epochAt: 0, monthDays: [turnAt / P.DAY, 1, 1, 1] };
function coast(returning) {
  const source = windSource({ preyX: -68, wind: onshore }), [coast] = source.regions;
  const sea = copy(coast);
  sea.id = 'offshore'; sea.kind = 'waterColumn'; sea.floor = false;
  sea.depthM = 100; sea.wildlife.pools.forEach(p => p.id += ':offshore');
  const edge = (id, x) => ({ id, traversable: true, distanceKm: .2,
    windBoundary: { normal: { x, y: 0 }, offsetM: 100, exit: { eastM: x * 100, northM: 0 }, entry: { eastM: -x * 100, northM: 0 } } });
  coast.kind = 'surface'; coast.edges = [edge(sea.id, -1)]; sea.edges = [edge(coast.id, 1)];
  source.calendar = calendar;
  sea.wind = offshore; sea.seasons[1].wind = returning ? onshore : offshore;
  source.regions.push(sea);
  const [g] = source.groups;
  g.regionId = sea.id; g.home.patchId = sea.id;
  const s = P.create(source, binding), c = s.groups[0].cohorts[0], prey = s.groups[1];
  c.regional.stamina = 300;
  P.kill(s, prey.id, prey.cohorts[0].id, 0, 0, 'actual-original-death');
  return s;
}
const lantern = s => s.groups.find(g => g.windDriven);
test('a seasonal turn returns actual drifters to a coastal carcass, without crossing before the turn', () => {
  const s = coast(true), c = lantern(s).cohorts[0];
  P.advance(s, turnAt - 1, true, true);
  assert.equal(lantern(s).regionId, 'offshore');
  assert.equal(c.regionalPosition.eastM, -(turnAt - 1) / 4);
  assert.equal(c.carrionApproach, undefined);
  assert.equal(c.stores.foodKg, 0);
  assert.equal(c.regional.stamina, 300);
  const saved = P.normalize(copy(s), binding); assert.ok(saved);
  const bad = copy(s); lantern(bad).cohorts[0].windDrift.until += 1;
  assert.equal(P.normalize(bad), null, 'an archived wind segment must end by the phase boundary');
  P.advance(s, turnAt, true, true);
  assert.equal(lantern(s).regionId, 'offshore');
  assert.equal(c.regionalPosition.eastM, -turnAt / 4);
  assert.deepEqual(c.windDrift.flow, onshore);
  assert.equal(c.carrionApproach, undefined);
  P.advance(s, 1200, true, true); P.advance(saved, 1200, true, true);
  assert.equal(lantern(s).regionId, 'ground');
  assert.equal(P.audit(s)['actual-prey-population'].dead, 1);
  assert.ok(s.regions[0].foraging.receipts.eatenKg > 0);
  assert.ok(c.stores.foodKg > 0);
  assert.deepEqual(saved.groups, s.groups);
  assert.deepEqual(saved.regions, s.regions);
  assert.ok(P.normalize(s)); assert.ok(P.normalize(saved));
});
test('an offshore seasonal current does not guide a Lantern toward the same real carcass', () => {
  const s = coast(false), g = lantern(s), c = g.cohorts[0];
  P.advance(s, 1200, true, true);
  assert.equal(g.regionId, 'offshore');
  assert.equal(c.regionalPosition.eastM, -300);
  assert.equal(c.carrionApproach, undefined);
  assert.equal(c.regional.stamina, 300);
  assert.equal(c.stores.foodKg, 0);
  assert.equal(s.regions[0].foraging.receipts.eatenKg, 0);
  assert.ok(P.normalize(s));
});
test('native drift does not apply a new phase retroactively to elapsed calm or offshore wind', () => {
  for (const before of [offshore, { x: 0, y: 0 }]) {
    const a = W.actor('beast:carrion-lantern', 'native-seasonal', { x: 10, y: 0, z: 6 }, 'original', turnAt - 2);
    const terrain = () => ({ floor: true, oxygen: true, ceilingM: 100, wind: before,
      windSchedule: { calendar, vectors: [before, onshore, before, before] } });
    const ctx = { alive: true, local: true, terrain, tileSizeM: 1 };
    B.advance(a, turnAt + 2, ctx);
    assert.ok(Math.abs(B.position(a, 1).eastM - (11 + before.x * 2)) < 1e-8);
    assert.ok(Math.abs(a.bodyPhysics.distanceM - (1 + Math.abs(before.x) * 2)) < 1e-8);
    assert.equal(a.bodyPhysics.spentStamina, 0);
  }
});
