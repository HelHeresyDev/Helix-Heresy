// @ts-check
const { test, expect } = require('@playwright/test');
const StrategicWorld = require('../strategic-world');
const PlanetaryRelief = require('../planetary-relief');
const Environment = require('../climate-hydrology-biomes');
const StrategicGeology = require('../strategic-geology');
const ArcaneGeography = require('../strategic-arcane-geography');
const Resources = require('../strategic-resource-potential');
const LocalGeology = require('../geology-field');

function generatedResourceWorld(seed) {
  let map = StrategicWorld.createStrategicMap(seed);
  map = PlanetaryRelief.attachRelief(seed, map);
  map = Environment.attachEnvironment(seed, map);
  map = StrategicGeology.attachGeology(seed, map);
  map = ArcaneGeography.attachArcaneGeography(seed, map);
  return Resources.attachResourcePotential(seed, map);
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
}

test('resource endowment and public prospectivity are deterministic, source-linked, and compact', () => {
  const first = generatedResourceWorld('resource-determinism');
  const same = generatedResourceWorld('resource-determinism');
  const different = generatedResourceWorld('different-resource-world');

  expect(first.resourcePotential).toEqual(same.resourcePotential);
  expect(first.publicResourceProspects).toEqual(same.publicResourceProspects);
  expect(first.resourcePotential.digest).not.toBe(different.resourcePotential.digest);
  expect(first.resourcePotential.sourceGeologyDigest).toBe(first.geology.digest);
  expect(first.resourcePotential.sourceArcaneGeographyDigest).toBe(first.arcaneGeography.digest);
  expect(first.publicResourceProspects.sourceResourcePotentialDigest).toBe(first.resourcePotential.digest);
  expect(JSON.stringify(first).length).toBeLessThan(3_000_000);
  expect(Resources.validateStrategicResources(first)).toEqual({ resourcePotential: first.resourcePotential, publicResourceProspects: first.publicResourceProspects });
});

test('all resource families are represented and their endowment follows physical and arcane causes', () => {
  const map = generatedResourceWorld('resource-causality');
  const audit = Resources.auditResourcePotential(map);
  const indices = Array.from({ length: map.topology.cellCount }, (_, index) => index);
  const compare = (familyId, favored, unfavored) => {
    const values = map.resourcePotential.potentialPermille[familyId];
    expect(mean(favored.map((index) => values[index]))).toBeGreaterThan(mean(unfavored.map((index) => values[index])));
  };

  expect(audit).toMatchObject({ valid: true, publicProjectionHidesTruth: true, representedFamilyCount: 12, representedDominantProspectCount: 12 });
  compare('ferrousOre', indices.filter((index) => 'buv'.includes(map.geology.bedrockClasses[index])), indices.filter((index) => 'cs'.includes(map.geology.bedrockClasses[index])));
  compare('baseMetalOre', indices.filter((index) => 'VROF'.includes(map.geology.tectonicRegimeClasses[index])), indices.filter((index) => map.geology.tectonicRegimeClasses[index] === 'C'));
  compare('nullstone', indices.filter((index) => map.arcaneGeography.nullPermille[index] >= 600), indices.filter((index) => map.arcaneGeography.nullPermille[index] <= 100));
  compare('manaCrystals', indices.filter((index) => map.arcaneGeography.leyClasses[index] !== '.'), indices.filter((index) => map.arcaneGeography.leyClasses[index] === '.'));
  compare('freshWater', indices.filter((index) => map.hydrology.riverClasses[index] !== '.' || map.hydrology.lakeByCell[index] >= 0 || map.hydrology.wetlandClasses[index] !== '.'), indices.filter((index) => map.surface.classes[index] === 'L' && map.hydrology.riverClasses[index] === '.' && map.hydrology.lakeByCell[index] < 0 && map.hydrology.wetlandClasses[index] === '.'));
  compare('biologicalProductivity', indices.filter((index) => 'BFRYW'.includes(map.biomes.classes[index])), indices.filter((index) => 'ID'.includes(map.biomes.classes[index])));
  compare('timberFiber', indices.filter((index) => 'BFRY'.includes(map.biomes.classes[index])), indices.filter((index) => !'BFRY'.includes(map.biomes.classes[index])));
  compare('geothermalEnergy', indices.filter((index) => map.geology.geothermalPermille[index] >= 700), indices.filter((index) => map.geology.geothermalPermille[index] <= 150));
});

test('ordinary prospect inspection exposes bands and reasons without hidden reserves or extraction facts', () => {
  const map = generatedResourceWorld('resource-knowledge-boundary');
  for (const index of [0, 17, 402, 9001]) {
    const publicSnapshot = Resources.publicCellProspectSnapshot(map, index);
    const truth = Resources.cellResourceTruth(map, index);
    expect(publicSnapshot).toMatchObject({
      dominantProspect: expect.any(String),
      dominantProspectBand: expect.stringMatching(/^(minimal|low|moderate|high)$/),
      inferenceConfidence: expect.stringMatching(/^(low|moderate|high)$/),
      publicReason: expect.any(String),
      prospectBands: expect.any(Object),
    });
    expect(Object.keys(publicSnapshot || {}).join(' ')).not.toMatch(/permille|depth|continuity|difficulty|accessibility/i);
    expect(JSON.stringify(publicSnapshot)).not.toContain(String(truth?.surfaceAccessibilityPermille));
    expect(Object.keys(publicSnapshot?.prospectBands || {})).toHaveLength(12);
  }
});

test('optional resource context biases lazy ore occurrence and type without changing legacy callers', () => {
  const seed = 'local-resource-context';
  const stratum = LocalGeology.STRATUM_BY_ID.shale;
  const counts = { ferrous: { iron: 0, copper: 0 }, base: { iron: 0, copper: 0 }, low: { iron: 0, copper: 0 } };
  expect(LocalGeology.profileForCell(seed, { x: 4, y: 8, z: -1 })).toEqual(LocalGeology.profileForCell(seed, { x: 4, y: 8, z: -1 }, null));
  for (let index = 0; index < 6000; index += 1) {
    const cell = { x: index % 150, y: Math.floor(index / 150), z: -1 };
    for (const [key, resourcePotentialPermille] of Object.entries({
      ferrous: { ferrousOre: 1000, baseMetalOre: 0 },
      base: { ferrousOre: 0, baseMetalOre: 1000 },
      low: { ferrousOre: 0, baseMetalOre: 0 },
    })) {
      const deposit = LocalGeology.depositForCell(seed, cell, stratum, { resourcePotentialPermille });
      if (deposit?.id === 'ironOre') counts[key].iron += 1;
      if (deposit?.id === 'copperOre') counts[key].copper += 1;
    }
  }
  expect(counts.ferrous.iron).toBeGreaterThan(counts.ferrous.copper * 5);
  expect(counts.base.copper).toBeGreaterThan(counts.base.iron * 5);
  expect(counts.ferrous.iron + counts.ferrous.copper).toBeGreaterThan(counts.low.iron + counts.low.copper);
});

test('validation rejects altered resource truth and public prospect records', () => {
  const map = generatedResourceWorld('resource-integrity');
  const changedTruth = JSON.parse(JSON.stringify(map));
  changedTruth.resourcePotential.potentialPermille.ferrousOre[0] += 1;
  expect(() => Resources.validateResourcePotential(changedTruth)).toThrow(/does not match its digest/i);

  const changedPublic = JSON.parse(JSON.stringify(map));
  changedPublic.publicResourceProspects.prospectBands.freshWater = `?${changedPublic.publicResourceProspects.prospectBands.freshWater.slice(1)}`;
  expect(() => Resources.validatePublicResourceProspects(changedPublic)).toThrow(/bands.*invalid/i);
});
