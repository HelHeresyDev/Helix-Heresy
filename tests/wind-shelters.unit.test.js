const test = require('node:test'), assert = require('node:assert/strict');
const Lee = require('../wind-shelters'), Wind = require('../beast-wind-drift'), P = require('../beast-populations');
const B = require('../beast-bodies'), W = require('../wilderness-beasts');
const { windSource } = require('./helpers/wind-source');
const binding = { worldId: 'lee-world', runId: 'original' }, copy = x => JSON.parse(JSON.stringify(x));
const shelter = { ridgeCell: 12, bearingDeg: 90, eastM: 10, northM: 0,
  lengthM: 30, widthM: 12, heightM: 8, flowPermille: 10 };
const air = { x: 20, y: 0 };
const point = (eastM, northM = 0, altitudeM = 0) => ({ eastM, northM, altitudeM });
test('a lee volume has real entry, exit, altitude and windward limits', () => {
  for (const outside of [point(9), point(41), point(20, 7), point(20, 0, 8), point(20, 0, -.01)])
    assert.equal(Lee.at(air, shelter, outside), air);
  assert.deepEqual(Lee.at(air, shelter, point(20)), { x: .2, y: 0 });
  for (const contrary of [{ x: -20, y: 0 }, { x: 0, y: 20 }, null])
    assert.equal(Lee.at(contrary, shelter, point(20)), contrary);
  assert.ok(Math.abs(Lee.boundarySeconds(air, shelter, point(0), { x: .5, y: 0 }) - 20) < 1e-4);
  assert.ok(Math.abs(Lee.boundarySeconds(air, shelter, point(20), { x: 0, y: 0, z: .5 }) - 16) < 1e-4);
  assert.equal(Lee.boundarySeconds(air, shelter, point(20, 0, 8), { x: 1, y: 0, z: 1 }), Infinity);
});
function fixture(preyX, shelterLike = shelter) {
  const source = windSource({ wind: air, preyX });
  if (shelterLike) source.regions[0].windShelter = copy(shelterLike);
  const s = P.create(source, binding), g = s.groups[0], c = g.cohorts[0], prey = s.groups[1];
  c.regional.stamina = 300;
  P.kill(s, prey.id, prey.cohorts[0].id, 0, 0, 'actual-original-death');
  return { s, g, c };
}
test('passive regional drift spends actual time outside, inside and past shelter, including after reload', () => {
  const { s, c } = fixture(10000);
  P.advance(s, 18, true, true);
  assert.equal(c.regionalPosition.eastM, 9);
  assert.deepEqual(c.windDrift.flow, air);
  assert.equal(c.carrionApproach, undefined);
  P.advance(s, 50, true, true);
  assert.ok(Math.abs(c.regionalPosition.eastM - 16) < 1e-4);
  assert.deepEqual(c.windDrift.flow, { x: .2, y: 0 });
  assert.equal(c.regional.stamina, 300);
  const saved = P.normalize(copy(s), binding); assert.ok(saved);
  P.advance(s, 200, true, true); P.advance(saved, 200, true, true);
  assert.ok(Math.abs(c.regionalPosition.eastM - 55) < 1e-4);
  assert.deepEqual(c.windDrift.flow, air);
  assert.deepEqual(saved.groups, s.groups); assert.ok(P.normalize(s));
});
test('an actual carcass provides a meal in lee air but not in exposed strong wind', () => {
  for (const cover of [shelter, null]) {
    const { s, c } = fixture(25, cover);
    P.advance(s, 400, true, true);
    assert.equal(s.regions[0].foraging.receipts.eatenKg > 0, Boolean(cover));
    assert.equal(c.stores.foodKg > 0, Boolean(cover));
    if (!cover) {
      assert.equal(c.carrionApproachOutcome.reason, 'arrived');
      assert.equal(s.regions[0].foraging.receipts.approaches, 1);
      assert.equal(Object.keys(c.foraging.carrionSiteReviews).length, 1);
      assert.ok(s.work.boundaries < 30, 'an unusable source should not trigger immediate retries');
    }
    assert.ok(P.normalize(s));
  }
});
test('native Lanterns sample the same shelter with fractional position and lift', () => {
  const a = W.actor('beast:carrion-lantern', 'shelter-lantern', { x: 10, y: 0, z: 6 }, 'original', 0);
  const terrain = cell => ({ floor: true, ceilingM: 100, supportKg: 1e8, oxygen: true,
    wind: air, windShelter: shelter, windParcelCenter: point(cell.x, cell.y) });
  const ctx = { terrain, tileSizeM: 1, alive: true, local: true, blocked: () => false }, r = { wind: air, windShelter: shelter };
  a.bodyPhysics.altitudeM = 1; a.bodyPhysics.airOffset = { x: -.25, y: 0 };
  assert.equal(B.localAir(a, ctx), air);
  B.advance(a, 1, ctx);
  assert.ok(Math.abs(B.position(a, 1).eastM - 10.1) < 1e-4);
  a.bodyPhysics.airOffset.x = .25;
  assert.deepEqual(B.localAir(a, ctx), Wind.windAt(r, 0, point(10.25, 0, 1)));
  a.bodyPhysics.altitudeM = 9;
  assert.equal(B.localAir(a, ctx), air);
});
