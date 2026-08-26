// @ts-check
const { test, expect } = require('@playwright/test');
const StrategicWorld = require('../strategic-world');
const PlanetaryRelief = require('../planetary-relief');
const Environment = require('../climate-hydrology-biomes');
const StrategicGeology = require('../strategic-geology');
const ArcaneGeography = require('../strategic-arcane-geography');
const Resources = require('../strategic-resource-potential');
const HumanGeography = require('../strategic-human-geography');

function generatedHumanWorld(seed) {
  let map = StrategicWorld.createStrategicMap(seed);
  map = PlanetaryRelief.attachRelief(seed, map);
  map = Environment.attachEnvironment(seed, map);
  map = StrategicGeology.attachGeology(seed, map);
  map = ArcaneGeography.attachArcaneGeography(seed, map);
  map = Resources.attachResourcePotential(seed, map);
  return HumanGeography.attachHumanGeography(seed, map);
}

function meanForIndices(values, indices) {
  return indices.reduce((total, index) => total + values[index], 0) / Math.max(1, indices.length);
}

test('fortified cities and corridors are deterministic, source-linked, validated, and compact', () => {
  const first = generatedHumanWorld('human-geography-determinism');
  const same = generatedHumanWorld('human-geography-determinism');
  const different = generatedHumanWorld('different-human-geography');

  expect(first.humanGeography).toEqual(same.humanGeography);
  expect(first.routeGraph).toEqual(same.routeGraph);
  expect(first.humanGeography.digest).not.toBe(different.humanGeography.digest);
  expect(first.humanGeography.sourceResourcePotentialDigest).toBe(first.resourcePotential.digest);
  expect(first.humanGeography.sourceRouteGraphDigest).toBe(StrategicWorld.stableHash(first.routeGraph));
  expect(HumanGeography.validateHumanGeography(first)).toEqual(first.humanGeography);
  expect(JSON.stringify(first).length).toBeLessThan(3_000_000);
});

test('fortified cities favor viable land while preserving sparse wilderness and separate landmasses', () => {
  const map = generatedHumanWorld('city-probe');
  const audit = HumanGeography.auditHumanGeography(map);
  const cities = map.humanGeography.cities;
  const cityIndices = cities.map((city) => StrategicWorld.cellIndex(city.cellId));
  let minimumSameRegionDistance = Infinity;
  for (let left = 0; left < cities.length; left += 1) {
    for (let right = left + 1; right < cities.length; right += 1) {
      if (cities[left].topologyRegionId !== cities[right].topologyRegionId) continue;
      minimumSameRegionDistance = Math.min(minimumSameRegionDistance, StrategicWorld.greatCircleDistanceKm(map, cityIndices[left], cityIndices[right]));
    }
  }

  expect(audit).toMatchObject({
    valid: true,
    allCitiesOnLand: true,
    allCorridorsOnLand: true,
    citiesFavorHabitableCells: true,
    cityCount: 31,
    inhabitedLandRegionCount: 3,
  });
  expect(cities.length).toBeLessThan([...map.surface.classes].filter((code) => code === 'L').length / 50);
  expect(minimumSameRegionDistance).toBeGreaterThanOrEqual(HumanGeography.DEFAULT_MINIMUM_CITY_SPACING_KM);
  expect(new Set(cities.map((city) => city.name)).size).toBe(cities.length);
  expect(cities.every((city) => city.foundingAdvantages.length === 3)).toBe(true);
});

test('primary and redundant corridors follow adjacent land cells and favor practical terrain', () => {
  const map = generatedHumanWorld('human-geography-causality');
  const cityById = new Map(map.humanGeography.cities.map((city) => [city.id, city]));
  const routeCells = new Set();
  const landIndices = [...map.surface.classes].map((code, index) => code === 'L' ? index : -1).filter((index) => index >= 0);

  expect(map.humanGeography.diagnostics.primaryCorridorCount).toBe(map.humanGeography.cities.length - 1);
  expect(map.humanGeography.diagnostics.redundantCorridorCount).toBeGreaterThan(0);
  for (const route of map.routeGraph.routes) {
    expect(StrategicWorld.validateRouteRecord(map, route)).toEqual(route);
    const path = route.cellPath.map(StrategicWorld.cellIndex);
    path.forEach((index) => routeCells.add(index));
    expect(path.every((index) => map.surface.classes[index] === 'L')).toBe(true);
    const endpointCells = route.endpointIds.map((id) => cityById.get(id)?.cellId).sort();
    expect([route.cellPath[0], route.cellPath.at(-1)].sort()).toEqual(endpointCells);
    expect(new Set(route.endpointIds.map((id) => cityById.get(id)?.topologyRegionId)).size).toBe(1);
  }
  expect(meanForIndices(map.resourcePotential.environmentalDifficultyPermille, [...routeCells]))
    .toBeLessThan(meanForIndices(map.resourcePotential.environmentalDifficultyPermille, landIndices));
  expect(meanForIndices(map.relief.slopePermille, [...routeCells]))
    .toBeLessThan(meanForIndices(map.relief.slopePermille, landIndices));
});

test('cell inspection exposes public city and corridor facts', () => {
  const map = generatedHumanWorld('human-geography-inspection');
  const city = map.humanGeography.cities[0];
  const cityIndex = StrategicWorld.cellIndex(city.cellId);
  const snapshot = HumanGeography.cellHumanGeographySnapshot(map, cityIndex);
  const corridorCell = StrategicWorld.cellIndex(map.routeGraph.routes[0].cellPath[1]);
  const corridorSnapshot = HumanGeography.cellHumanGeographySnapshot(map, corridorCell);

  expect(snapshot?.city).toEqual(city);
  expect(snapshot?.city).toMatchObject({
    name: expect.any(String),
    defensibilityBand: expect.stringMatching(/^(limited|adequate|strong|formidable)$/),
    isolationBand: expect.stringMatching(/^(connected|remote|extreme)$/),
    foundingAdvantages: expect.any(Array),
  });
  expect(corridorSnapshot?.corridors[0]).toMatchObject({
    corridorClass: expect.stringMatching(/^(primary|redundant)$/),
    endpointNames: [expect.any(String), expect.any(String)],
    lengthKm: expect.any(Number),
  });
});

test('validation rejects altered city and route records', () => {
  const map = generatedHumanWorld('human-geography-integrity');
  const changedCity = JSON.parse(JSON.stringify(map));
  changedCity.humanGeography.cities[0].name = 'Tampered City';
  expect(() => HumanGeography.validateHumanGeography(changedCity)).toThrow(/digest/i);

  const changedRoute = JSON.parse(JSON.stringify(map));
  changedRoute.routeGraph.routes[0].cellPath[1] = StrategicWorld.cellId(0);
  changedRoute.digest = StrategicWorld.strategicMapDigest(changedRoute);
  expect(() => HumanGeography.validateHumanGeography(changedRoute)).toThrow(/non-adjacent|route graph/i);
});
