// @ts-check
const { test, expect } = require('@playwright/test');
const StrategicWorld = require('../strategic-world');
const PlanetaryRelief = require('../planetary-relief');
const Environment = require('../climate-hydrology-biomes');

function generatedEnvironment(seed) {
  const relief = PlanetaryRelief.attachRelief(seed, StrategicWorld.createStrategicMap(seed));
  return Environment.attachEnvironment(seed, relief);
}

test('climate, hydrology, and biomes are deterministic and preserve relief', () => {
  const seed = 'environment-determinism';
  const relief = PlanetaryRelief.attachRelief(seed, StrategicWorld.createStrategicMap(seed));
  const reliefBefore = JSON.parse(JSON.stringify(relief.relief));
  const first = Environment.attachEnvironment(seed, relief);
  const same = Environment.attachEnvironment(seed, relief);
  const different = generatedEnvironment('different-environment');

  expect(relief.relief).toEqual(reliefBefore);
  expect(first.relief).toEqual(relief.relief);
  expect(first.climate).toEqual(same.climate);
  expect(first.hydrology).toEqual(same.hydrology);
  expect(first.biomes).toEqual(same.biomes);
  expect(first.biomes.digest).not.toBe(different.biomes.digest);
  expect(JSON.stringify(first).length).toBeLessThan(1_000_000);
  expect(StrategicWorld.validateStrategicMap(JSON.parse(JSON.stringify(first)))).toEqual(first);
  expect(Environment.validateEnvironment(first)).toEqual({
    climate: first.climate,
    hydrology: first.hydrology,
    biomes: first.biomes,
  });
});

test('climate responds to latitude and elevation while representing broad currents and biomes', () => {
  const map = generatedEnvironment('climate-physics');
  const topology = StrategicWorld.topologyForMap(map);
  const equatorial = [];
  const polar = [];
  const highMidlatitudeLand = [];
  const lowMidlatitudeLand = [];
  for (let index = 0; index < topology.cellCount; index += 1) {
    const latitude = Math.abs(Math.asin(topology.vertices[index][1]) * 180 / Math.PI);
    const temperature = map.climate.temperatureTenthsC[index];
    if (latitude < 15) equatorial.push(temperature);
    if (latitude > 70) polar.push(temperature);
    if (map.surface.classes[index] !== 'L' || latitude <= 20 || latitude >= 50) continue;
    if (map.relief.elevationM[index] > 2500) highMidlatitudeLand.push(temperature);
    if (map.relief.elevationM[index] < 500) lowMidlatitudeLand.push(temperature);
  }
  const mean = (values) => values.reduce((total, value) => total + value, 0) / values.length;

  expect(mean(equatorial)).toBeGreaterThan(mean(polar));
  expect(mean(lowMidlatitudeLand)).toBeGreaterThan(mean(highMidlatitudeLand));
  expect(new Set(map.climate.oceanCurrentClasses)).toEqual(new Set(['.', 'N', 'W', 'C', 'U']));
  expect(map.climate.settings.axialTiltDeg).toBeGreaterThanOrEqual(18);
  expect(map.climate.settings.axialTiltDeg).toBeLessThanOrEqual(28);
  expect(map.biomes.diagnostics.representedBiomeCount).toBeGreaterThanOrEqual(15);
});

test('conditioned drainage is adjacent, acyclic, and terminates in oceans or saved basins', () => {
  const map = generatedEnvironment('hydrology-graph');
  const topology = StrategicWorld.topologyForMap(map);
  const audit = Environment.auditEnvironment(map);
  expect(audit).toMatchObject({ valid: true, adjacentDrainage: true, drainageAcyclic: true, equatorWarmerThanPoles: true });
  expect(audit.watershedCount).toBeGreaterThan(20);
  expect(audit.lakeCount).toBeGreaterThan(0);
  expect(audit.riverCellCount).toBeGreaterThan(0);

  let valid = true;
  for (let index = 0; index < topology.cellCount; index += 1) {
    if (map.surface.classes[index] === 'W') {
      valid &&= map.hydrology.downstreamByCell[index] === -1 && map.hydrology.watershedByCell[index] === -1;
      continue;
    }
    const downstream = map.hydrology.downstreamByCell[index];
    valid &&= downstream < 0 || topology.neighbors[index].includes(downstream);
    valid &&= map.hydrology.watershedByCell[index] >= 0;
    valid &&= map.hydrology.riverClasses[index] === '.' || map.surface.classes[index] === 'L';
  }
  expect(valid).toBe(true);
  expect(map.hydrology.lakes.every((lake, index) => lake.index === index && lake.id === `major-lake:${String(index + 1).padStart(4, '0')}`)).toBe(true);
});

test('environment validation rejects altered source-linked data', () => {
  const map = generatedEnvironment('environment-integrity');
  const changedClimate = JSON.parse(JSON.stringify(map));
  changedClimate.climate.precipitationMm[0] += 1;
  expect(() => Environment.validateClimate(changedClimate)).toThrow(/does not match its digest/i);

  const changedHydrology = JSON.parse(JSON.stringify(map));
  const landIndex = changedHydrology.surface.classes.indexOf('L');
  changedHydrology.hydrology.downstreamByCell[landIndex] = landIndex;
  expect(() => Environment.validateHydrology(changedHydrology)).toThrow(/downstream cells must be adjacent/i);

  const changedBiome = JSON.parse(JSON.stringify(map));
  changedBiome.biomes.classes = `?${changedBiome.biomes.classes.slice(1)}`;
  expect(() => Environment.validateBiomes(changedBiome)).toThrow(/biome classification is invalid/i);
});
