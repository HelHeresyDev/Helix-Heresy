const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), F = require('../beast-regional-foodweb'), D = require('../creature-biology');
const { source: breeding } = require('../scripts/benchmark-beast-demography');
const { source: foodweb } = require('./helpers/regional-foodweb-source');
const DAY = P.DAY, binding = { worldId: 'locations', runId: 'original' }, copy = x => JSON.parse(JSON.stringify(x));
const point = (regionId, eastM = 0, northM = 0) => ({ regionId, eastM, northM, altitudeM: 0 });
function birthSource() {
  const src = breeding(200, 'beast:storm-kite'); src.regionalFoodWeb = src.spatialContinuity = true;
  Object.assign(src.regions[0], { floor: true, oxygen: true, kind: 'surface' });
  src.regions[0].nurseries[0].position = point('habitat', 17, 29);
  src.groups[0].home = { patchId: 'habitat', cellId: 'test', eastKm: .017, northKm: .029, depthM: 0 };
  return src;
}
function routeSource(positioned = true) {
  const src = foodweb([['gravebloom-elk', 3000, 3]]); src.spatialContinuity = true;
  const r = copy(src.regions[0]); r.id = 'destination'; src.regions.push(r);
  const edge = (from, to) => ({ id: to, distanceKm: 2, traversable: true,
    ...(positioned ? { departurePosition: point(from), arrivalPosition: point(to) } : {}) });
  src.regions[0].edges = [edge('ground', 'destination')]; r.edges = [edge('destination', 'ground')];
  return src;
}
test('paid newborn cohorts acquire distinct original nursery positions without individual actor allocation', () => {
  const s = P.create(birthSource(), binding);
  P.advance(s, 20 * DAY, true, true);
  const g = s.groups[0], young = g.cohorts.filter(c => c.generated && P.count(c)); assert.ok(young.length);
  const c = young.find(c => P.count(c) > 1); assert.ok(c);
  const first = F.position(g, s.regions[0], c, c.ranges[0][0]), last = F.position(g, s.regions[0], c, c.ranges.at(-1)[1] - 1);
  assert.equal(first.eastM, 17); assert.equal(first.northM, 29); assert.notDeepEqual(first, last);
  assert.equal(Object.keys(s.details).length, 0); assert.ok(P.normalize(s));
  const branch = P.rebind(P.normalize(copy(s), binding), binding, { ...binding, runId: 'continued' });
  P.advance(s, 25 * DAY, true, true); P.advance(branch, 25 * DAY, true, true);
  assert.deepEqual(P.audit(branch), P.audit(s)); assert.deepEqual(branch.groups, s.groups);
});
test('a missing nursery location stays unknown even when paid recruitment succeeds', () => {
  const src = birthSource(); delete src.regions[0].nurseries[0].position;
  const s = P.create(src, binding); P.advance(s, 20 * DAY, true, true);
  const g = s.groups[0], c = g.cohorts.find(c => c.generated && P.count(c)); assert.ok(c);
  assert.equal(F.position(g, s.regions[0], c, c.ranges[0][0]), null); assert.ok(P.normalize(s));
});
test('live-birth location geometry retains each actual maternal family rather than moving all litters to a nursery centre', () => {
  const src = breeding(4, 'beast:rimefang-pack'); src.regionalFoodWeb = src.spatialContinuity = true;
  const r = src.regions[0]; Object.assign(r, { kind: 'surface', floor: true, oxygen: true });
  r.nurseries[0].position = point(r.id, 100, 100);
  src.groups[0].home = { patchId: r.id, cellId: 'test', eastKm: 0, northKm: 0, depthM: 0 };
  const s = P.create(src, binding), g = s.groups[0], mother = g.cohorts[0], litter = D.lifecycle[g.speciesId].offspring;
  const child = { speciesId: g.speciesId, massKg: D.lifecycle[g.speciesId].newbornKg, ranges: [[40, 40 + litter * 2]] };
  const a = F.position(g, s.regions[0], mother, 0), b = F.position(g, s.regions[0], mother, 1);
  F.birthPosition(s, g, mother, child, { regionId: r.id, nurseryId: r.nurseries[0].id, successful: [[0, 2]], offspringOffset: 0 }, 0);
  assert.deepEqual(F.position(g, s.regions[0], child, 40), a);
  assert.deepEqual(F.position(g, s.regions[0], child, 40 + litter), b);
  mother.ranges = []; assert.deepEqual(F.position(g, s.regions[0], child, 40), a, 'maternal loss cannot erase an established birth position');
});
test('arrival pays the actual origin approach and retains formation spacing and wounds through a partial save', () => {
  const src = routeSource(), s = P.create(src, binding), g = s.groups[0], c = g.cohorts[0]; c.deathThreshold = 1e12;
  c.regional.parts.head = 81;
  g.intention = { destination: 'destination', chosenAt: 0, departAt: 10 };
  P.removeStock(s, 'ground', 'waterL', 0, 0, 'prepared-known-route'); P.advance(s, 10, true, true);
  const t = copy(g.transit); assert.ok(t.spatial);
  assert.equal(t.spatial.approachKm, 3);
  const approaching = F.transitPosition(g, 10 + DAY / D.lifecycle[g.speciesId].travelKmDay);
  assert.equal(approaching.phase, 'approach'); assert.ok(Math.abs(approaching.position.eastM - 2000) < 1e-7);
  assert.ok(Math.abs(t.edgeArriveAt - 10 - 5 / D.lifecycle[g.speciesId].travelKmDay * DAY) < 1e-7);
  assert.equal(F.position(g, s.regions[0], c, 0), null, 'no stationary contact during paid transit');
  P.advance(s, t.crossAt + 1, true, true);
  assert.equal(F.transitPosition(g, s.clock).phase, 'route'); assert.equal(F.summary(s).positionedTravellingLiving, 3);
  assert.equal(F.summary(s).unlocatedLiving, 0);
  const branch = P.normalize(copy(s), binding); assert.ok(branch);
  P.advance(branch, t.edgeArriveAt, true, true); const moved = branch.groups[0], region = branch.regions[1];
  assert.equal(moved.regionId, region.id); assert.equal(moved.cohorts[0].regional.parts.head, 81);
  const a = F.position(moved, region, moved.cohorts[0], 0), b = F.position(moved, region, moved.cohorts[0], 1);
  assert.equal(a.eastM, 0); assert.notDeepEqual(a, b); assert.ok(P.normalize(branch));
  moved.intention = { destination: 'ground', chosenAt: branch.clock, departAt: branch.clock + 10 };
  P.removeStock(branch, 'destination', 'waterL', 0, branch.clock, 'prepared-return-route');
  P.advance(branch, moved.intention.departAt, true, true); assert.equal(moved.transit.spatial.finalKm, 3);
  P.advance(branch, moved.transit.edgeArriveAt, true, true);
  assert.equal(F.position(moved, branch.regions[0], moved.cohorts[0], 0).eastM, 3000); assert.ok(P.normalize(branch));
});
test('an unpositioned edge or an actually blocked passage grants no arrival coordinates', () => {
  for (const blocked of [false, true]) {
    const src = routeSource(false); src.regions[0].edges[0].traversable = !blocked;
    const s = P.create(src, binding), g = s.groups[0]; g.intention = { destination: 'destination', chosenAt: 0, departAt: 10 };
    P.removeStock(s, 'ground', 'waterL', 0, 0, 'original-route'); P.advance(s, 10, true, true);
    if (blocked) { assert.equal(g.transit, null); assert.equal(g.regionalPosition, undefined); }
    else { P.advance(s, g.transit.edgeArriveAt, true, true); assert.equal(F.position(g, s.regions[1], g.cohorts[0], 0), null); }
    assert.ok(P.normalize(s));
  }
});
test('malformed newborn layouts and future or wrong-region arrival frames cannot load', () => {
  const s = P.create(birthSource(), binding); P.advance(s, 20 * DAY, true, true);
  const index = s.groups[0].cohorts.findIndex(c => c.regionalFormation);
  for (const corrupt of [f => f.columns = 0, f => f.eastSpacingM = -1, f => f.anchor.regionId = 'invented',
    f => f.firstOrdinal = -1, f => f.establishedAt = s.clock + 1]) {
    const bad = copy(s); corrupt(bad.groups[0].cohorts[index].regionalFormation); assert.equal(P.normalize(bad), null);
  }
  const travelling = P.create(routeSource(), binding), g = travelling.groups[0];
  g.intention = { destination: 'destination', chosenAt: 0, departAt: 10 };
  P.removeStock(travelling, 'ground', 'waterL', 0, 0, 'known-route'); P.advance(travelling, 10, true, true);
  const bad = copy(travelling); bad.groups[0].transit.spatial.arrival.regionId = 'ground'; assert.equal(P.normalize(bad), null);
  const forged = copy(travelling); forged.groups[0].transit.spatial.approachKm = 0; assert.equal(P.normalize(forged), null);
});
