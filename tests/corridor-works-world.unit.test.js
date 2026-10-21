const { test } = require('node:test');
const assert = require('node:assert/strict');
const Library = require('../world-run-library'), Journeys = require('../strategic-journeys'), World = require('../strategic-world');
const Joint = require('../joint-transit'), Works = require('../corridor-works');
test('generated corridor topology, separate measured lengths and historical joint sources survive runtime ID binding without changing the world', { timeout: 600000 }, () => {
  const world = Library.createWorld({ id: 'corridor-source-check', worldSeed: 'world-seed-one', worldTheme: 'unbound', createdAt: 'test' });
  const map = world.generatedData.strategicMap, before = JSON.stringify(map), cityId = map.strategicPlayableSettlementState.cityRows.find(c => c.currentPopulation > 0).cityId;
  const network = Journeys.createDestinationDirectory(map, { id: 'test-site', nearestSettlement: { cityId } });
  const distance = (a, b) => World.greatCircleDistanceKm(map, World.cellIndex(a), World.cellIndex(b));
  assert.ok(network.routes.length > 0);
  for (const r of network.routes) assert.equal(r.distanceKm, map.humanGeography.corridors.find(c => c.id === r.corridorId).lengthKm);
  const sources = network.routes.map(r => ({ route: r, source: Joint.sourceFromWorld(map, r, distance) })).filter(s => s.source);
  assert.ok(sources.length > 0, JSON.stringify({ forts: map.cityExpansionHistory.strongholdRows.slice(0, 3), routes: network.routes.slice(0, 3) }));
  for (const { route, source } of sources) {
    assert.equal(route.id, `corridor:${route.corridorId}`); assert.equal(source.corridorId, route.id); assert.equal(source.canonicalCorridorId, route.corridorId);
    assert.ok(source.positionKm > 0 && source.positionKm < route.distanceKm);
    assert.deepEqual(source.sponsors.map(s => s.cityId), route.endpointCityIds);
    const work = Works.sourceFromWorld(map, route, distance);
    if (work) { assert.ok(Works.validSource(work)); assert.ok(map.strategicCrisisHistory.eventRows.some(e => e.id === work.causeId)); }
  }
  assert.equal(JSON.stringify(map), before);
});
