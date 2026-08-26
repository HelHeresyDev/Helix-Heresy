// @ts-check
const { test, expect } = require('@playwright/test');
const StrategicWorld = require('../strategic-world');
const PlanetaryRelief = require('../planetary-relief');
const Environment = require('../climate-hydrology-biomes');
const StrategicGeology = require('../strategic-geology');
const ArcaneGeography = require('../strategic-arcane-geography');
const LocalGeology = require('../geology-field');

function generatedArcaneWorld(seed) {
  let map = StrategicWorld.createStrategicMap(seed);
  map = PlanetaryRelief.attachRelief(seed, map);
  map = Environment.attachEnvironment(seed, map);
  map = StrategicGeology.attachGeology(seed, map);
  return ArcaneGeography.attachArcaneGeography(seed, map);
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
}

test('arcane geography and magical hazards are deterministic, source-linked, and compact', () => {
  const first = generatedArcaneWorld('arcane-determinism');
  const same = generatedArcaneWorld('arcane-determinism');
  const different = generatedArcaneWorld('different-arcane-world');

  expect(first.arcaneGeography).toEqual(same.arcaneGeography);
  expect(first.magicalHazards).toEqual(same.magicalHazards);
  expect(first.arcaneGeography.digest).not.toBe(different.arcaneGeography.digest);
  expect(first.arcaneGeography.sourceGeologyDigest).toBe(first.geology.digest);
  expect(first.arcaneGeography.sourceHydrologyDigest).toBe(first.hydrology.digest);
  expect(first.magicalHazards.sourceArcaneGeographyDigest).toBe(first.arcaneGeography.digest);
  expect(JSON.stringify(first).length).toBeLessThan(2_100_000);
  expect(ArcaneGeography.validateStrategicArcaneGeography(first)).toEqual({ arcaneGeography: first.arcaneGeography, magicalHazards: first.magicalHazards });
});

test('mana flow is adjacent and acyclic while ley, null, and aspect geography follows physical causes', () => {
  const map = generatedArcaneWorld('arcane-causality');
  const audit = ArcaneGeography.auditArcaneGeography(map);
  const indices = Array.from({ length: map.topology.cellCount }, (_, index) => index);
  const highGeothermalMana = indices.filter((index) => map.geology.geothermalPermille[index] >= 700).map((index) => map.arcaneGeography.manaConcentrationPermille[index]);
  const quietGeologyMana = indices.filter((index) => map.geology.geothermalPermille[index] <= 150).map((index) => map.arcaneGeography.manaConcentrationPermille[index]);
  const strongNullMana = indices.filter((index) => map.arcaneGeography.nullPermille[index] >= 600).map((index) => map.arcaneGeography.manaConcentrationPermille[index]);
  const ordinaryMana = indices.filter((index) => map.arcaneGeography.nullPermille[index] <= 100).map((index) => map.arcaneGeography.manaConcentrationPermille[index]);
  const leyFlow = indices.filter((index) => map.arcaneGeography.leyClasses[index] !== '.').map((index) => map.arcaneGeography.manaFlowStrengthPermille[index]);
  const ordinaryFlow = indices.filter((index) => map.arcaneGeography.leyClasses[index] === '.').map((index) => map.arcaneGeography.manaFlowStrengthPermille[index]);
  const wetCells = indices.filter((index) => map.surface.classes[index] === 'W' || map.hydrology.riverClasses[index] !== '.' || map.hydrology.wetlandClasses[index] !== '.');
  const dryLandCells = indices.filter((index) => map.surface.classes[index] === 'L' && map.hydrology.riverClasses[index] === '.' && map.hydrology.wetlandClasses[index] === '.');
  const frozenCells = indices.filter((index) => map.climate.snowIcePermille[index] >= 700);
  const warmCells = indices.filter((index) => map.climate.snowIcePermille[index] <= 100);

  expect(audit).toMatchObject({ valid: true, acyclicFlow: true, representedPrimaryAspectCount: 8 });
  expect(audit.leyCellCount).toBeGreaterThan(400);
  expect(audit.leyNodeCount).toBeGreaterThan(20);
  expect(audit.naturalNullZoneCount).toBeGreaterThan(0);
  expect(mean(highGeothermalMana)).toBeGreaterThan(mean(quietGeologyMana));
  expect(mean(strongNullMana)).toBeLessThan(mean(ordinaryMana));
  expect(mean(leyFlow)).toBeGreaterThan(mean(ordinaryFlow));
  expect(wetCells.filter((index) => map.arcaneGeography.primaryAspectClasses[index] === 'W').length / wetCells.length).toBeGreaterThan(dryLandCells.filter((index) => map.arcaneGeography.primaryAspectClasses[index] === 'W').length / dryLandCells.length);
  expect(frozenCells.filter((index) => map.arcaneGeography.primaryAspectClasses[index] === 'I').length / frozenCells.length).toBeGreaterThan(warmCells.filter((index) => map.arcaneGeography.primaryAspectClasses[index] === 'I').length / warmCells.length);
});

test('optional arcane context biases local mana pockets without changing legacy callers', () => {
  const seed = 'local-arcane-context';
  let saturatedManaPockets = 0;
  let nullZoneManaPockets = 0;
  expect(LocalGeology.profileForCell(seed, { x: 4, y: 8, z: -1 })).toEqual(LocalGeology.profileForCell(seed, { x: 4, y: 8, z: -1 }, null));
  for (let index = 0; index < 5000; index += 1) {
    const cell = { x: index % 100, y: Math.floor(index / 100), z: -1 };
    const saturated = LocalGeology.hazardForCell(seed, cell, {
      manaPermille: 1000,
      nullPermille: 0,
      magicalHazardPermille: { manaSurge: 1000, realityDistortion: 800 },
    });
    const suppressed = LocalGeology.hazardForCell(seed, cell, {
      manaPermille: 0,
      nullPermille: 1000,
      magicalHazardPermille: { manaSurge: 0, realityDistortion: 0 },
    });
    if (saturated?.id === 'manaPocket') saturatedManaPockets += 1;
    if (suppressed?.id === 'manaPocket') nullZoneManaPockets += 1;
  }
  expect(saturatedManaPockets).toBeGreaterThan(nullZoneManaPockets * 10);
});

test('validation rejects altered arcane geography and magical hazards', () => {
  const map = generatedArcaneWorld('arcane-integrity');
  const changedFlow = JSON.parse(JSON.stringify(map));
  changedFlow.arcaneGeography.manaFlowToCell[0] = 0;
  expect(() => ArcaneGeography.validateArcaneGeography(changedFlow)).toThrow(/adjacent strategic cells/i);

  const cyclicFlow = JSON.parse(JSON.stringify(map));
  const neighbor = StrategicWorld.topologyForMap(map).neighbors[0][0];
  cyclicFlow.arcaneGeography.manaFlowToCell[0] = neighbor;
  cyclicFlow.arcaneGeography.manaFlowToCell[neighbor] = 0;
  expect(() => ArcaneGeography.validateArcaneGeography(cyclicFlow)).toThrow(/acyclic/i);

  const changedHazards = JSON.parse(JSON.stringify(map));
  changedHazards.magicalHazards.manaSurgePermille[0] += 1;
  expect(() => ArcaneGeography.validateMagicalHazards(changedHazards)).toThrow(/does not match its digest/i);
});
