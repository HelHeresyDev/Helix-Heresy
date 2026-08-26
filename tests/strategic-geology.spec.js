// @ts-check
const { test, expect } = require('@playwright/test');
const StrategicWorld = require('../strategic-world');
const PlanetaryRelief = require('../planetary-relief');
const Environment = require('../climate-hydrology-biomes');
const StrategicGeology = require('../strategic-geology');
const LocalGeology = require('../geology-field');

function generatedGeology(seed) {
  const relief = PlanetaryRelief.attachRelief(seed, StrategicWorld.createStrategicMap(seed));
  const environment = Environment.attachEnvironment(seed, relief);
  return StrategicGeology.attachGeology(seed, environment);
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
}

test('strategic geology and hazards are deterministic, source-linked, and compact', () => {
  const first = generatedGeology('geology-determinism');
  const same = generatedGeology('geology-determinism');
  const different = generatedGeology('different-geology');

  expect(first.geology).toEqual(same.geology);
  expect(first.naturalHazards).toEqual(same.naturalHazards);
  expect(first.geology.digest).not.toBe(different.geology.digest);
  expect(first.geology.sourceReliefDigest).toBe(first.relief.digest);
  expect(first.geology.sourceHydrologyDigest).toBe(first.hydrology.digest);
  expect(first.naturalHazards.sourceGeologyDigest).toBe(first.geology.digest);
  expect(JSON.stringify(first).length).toBeLessThan(1_600_000);
  expect(StrategicGeology.validateStrategicGeology(first)).toEqual({ geology: first.geology, naturalHazards: first.naturalHazards });
});

test('provinces are contiguous and hazard tendencies follow their physical causes', () => {
  const map = generatedGeology('geology-causality');
  const audit = StrategicGeology.auditGeology(map);
  const nearBoundary = [];
  const stableInterior = [];
  const riverFlood = [];
  const dryFlood = [];
  const steepLandslide = [];
  const flatLandslide = [];
  for (let index = 0; index < map.topology.cellCount; index += 1) {
    if (map.relief.boundaryDistanceByCell[index] <= 1) nearBoundary.push(map.naturalHazards.earthquakePermille[index]);
    if (map.geology.tectonicRegimeClasses[index] === 'C' && map.relief.boundaryDistanceByCell[index] >= 6) stableInterior.push(map.naturalHazards.earthquakePermille[index]);
    if (map.hydrology.riverClasses[index] !== '.') riverFlood.push(map.naturalHazards.floodPermille[index]);
    if (map.surface.classes[index] === 'L' && map.hydrology.riverClasses[index] === '.' && map.hydrology.wetlandClasses[index] === '.') dryFlood.push(map.naturalHazards.floodPermille[index]);
    if (map.relief.slopePermille[index] >= 25) steepLandslide.push(map.naturalHazards.landslidePermille[index]);
    if (map.relief.slopePermille[index] <= 5) flatLandslide.push(map.naturalHazards.landslidePermille[index]);
  }

  expect(audit).toMatchObject({ valid: true, contiguousProvinces: true });
  expect(audit.provinceCount).toBeGreaterThan(100);
  expect(audit.representedBedrockClassCount).toBe(7);
  expect(audit.representedTectonicRegimeCount).toBe(10);
  expect(mean(nearBoundary)).toBeGreaterThan(mean(stableInterior));
  expect(mean(riverFlood)).toBeGreaterThan(mean(dryFlood));
  expect(mean(steepLandslide)).toBeGreaterThan(mean(flatLandslide));
});

test('strategic context biases lazy local rock without changing legacy callers', () => {
  const seed = 'local-geology-context';
  const legacy = [];
  const carbonate = [];
  const volcanic = [];
  for (let index = 0; index < 280; index += 1) {
    const cell = { x: index % 40, y: Math.floor(index / 40) * 7, z: -1 };
    legacy.push(LocalGeology.stratumForCell(seed, cell).id);
    expect(LocalGeology.profileForCell(seed, cell)).toEqual(LocalGeology.profileForCell(seed, cell, null));
    carbonate.push(LocalGeology.stratumForCell(seed, cell, { bedrockClass: 'carbonate' }).id);
    volcanic.push(LocalGeology.stratumForCell(seed, cell, { bedrockClass: 'volcanic' }).id);
  }

  expect(carbonate.filter((value) => value === 'limestone').length).toBeGreaterThan(legacy.filter((value) => value === 'limestone').length);
  expect(volcanic.filter((value) => value === 'basalt').length).toBeGreaterThan(legacy.filter((value) => value === 'basalt').length);
  expect(LocalGeology.profileForCell(seed, { x: 7, y: 9, z: -2 }, { bedrockClass: 'carbonate' })).toEqual(LocalGeology.profileForCell(seed, { x: 7, y: 9, z: -2 }, { bedrockClass: 'carbonate' }));
});

test('validation rejects changed geology and hazard records', () => {
  const map = generatedGeology('geology-integrity');
  const changedGeology = JSON.parse(JSON.stringify(map));
  changedGeology.geology.crustAgeMyr[0] += 1;
  expect(() => StrategicGeology.validateGeology(changedGeology)).toThrow(/does not match its digest/i);

  const changedHazards = JSON.parse(JSON.stringify(map));
  changedHazards.naturalHazards.floodPermille[0] += 1;
  expect(() => StrategicGeology.validateNaturalHazards(changedHazards)).toThrow(/does not match its digest/i);
});
