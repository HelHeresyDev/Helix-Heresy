// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const BeastEcology = require('../strategic-beast-ecology');
const PreUrbanHumanity = require('../strategic-pre-urban-humanity');
const StrategicWorld = require('../strategic-world');

let cachedBaseline;

function baselineMap(seed = 'pre-urban-baseline') {
  if (seed === 'pre-urban-baseline' && cachedBaseline) return cachedBaseline;
  const map = Library.createWorld({ id: `baseline-${seed}`, worldSeed: seed, worldTheme: 'unbound', generationVersion: 7, createdAt: 'test' }).generatedData.strategicMap;
  if (seed === 'pre-urban-baseline') cachedBaseline = map;
  return map;
}

test('pre-urban humans are deterministic aggregated populations generated before cities', () => {
  const first = baselineMap();
  const same = Library.createWorld({ id: 'baseline-same', worldSeed: 'pre-urban-baseline', worldTheme: 'unbound', generationVersion: 7, createdAt: 'test' }).generatedData.strategicMap;
  const audit = PreUrbanHumanity.auditPreUrbanHumanity(first);

  expect(first.humanGeography).toBeUndefined();
  expect(first.cityPolities).toBeUndefined();
  expect(first.preUrbanHumanity).toEqual(same.preUrbanHumanity);
  expect(PreUrbanHumanity.publicPreUrbanOverview(first)).toEqual(PreUrbanHumanity.publicPreUrbanOverview(same));
  expect(first.publicPreUrbanOverview).toBeUndefined();
  expect(audit).toMatchObject({
    valid: true,
    generatedBeforeCities: true,
    everyLandRegionRepresented: true,
    allGroupsAgriculturalLiterateMetalworkingAndMagical: true,
    noModernScaleInfrastructure: true,
  });
});

test('population groups have causal land ranges, carrying capacity, lineage, and concrete capabilities', () => {
  const map = baselineMap();
  const groups = PreUrbanHumanity.expandPopulationGroups(map);
  const peopleIds = new Set(PreUrbanHumanity.publicPreUrbanOverview(map).peoples.map((people) => people.id));

  expect(groups.length).toBeGreaterThanOrEqual(12);
  expect(new Set(groups.map((group) => group.topologyRegionId)).size).toBe(map.surface.regions.filter((region) => region.surfaceClass === 'land').length);
  for (const group of groups) {
    expect(peopleIds.has(group.peopleId)).toBe(true);
    expect(group.population).toBeGreaterThan(0);
    expect(group.supportedCapacity).toBeGreaterThanOrEqual(group.population);
    expect(group.rangeCellIds.length).toBeGreaterThan(0);
    expect(group.rangeCellIds.every((cellId) => map.surface.classes[StrategicWorld.cellIndex(cellId)] === 'L')).toBe(true);
    expect(group.capabilities).toEqual({
      agriculture: expect.stringMatching(/^(established|advanced)$/),
      literacy: expect.stringMatching(/^(established|advanced)$/),
      metalworking: expect.stringMatching(/^(established|advanced)$/),
      establishedMagic: expect.stringMatching(/^(established|advanced)$/),
    });
    expect(group.absentInfrastructure).toEqual(expect.arrayContaining(['fortifiedCity', 'industrialGrid', 'globalLogistics', 'orbitalNetwork']));
  }
});

test('pristine beast ecology is physical, complete, compact, and free of later human pressure', () => {
  const map = baselineMap();
  const pristine = BeastEcology.expandPristineBeastEcology(map);
  const audit = BeastEcology.auditPristineBeastEcology(map);

  expect(audit).toMatchObject({ valid: true, generatedBeforeHumansAndCities: true, physicalAndArcaneCausesOnly: true, everySpeciesPresent: true, noCityTargetedWaves: true, migrationsUsePhysicalMovementRealms: true });
  expect(pristine.species).toEqual(BeastEcology.BEAST_SPECIES);
  expect(pristine.populations.length).toBe(map.pristineBeastEcology.diagnostics.populationCount);
  expect(pristine.relations.length).toBe(map.pristineBeastEcology.diagnostics.relationCount);
  expect(pristine.migrations.length).toBe(map.pristineBeastEcology.diagnostics.migrationCount);
  expect(JSON.stringify(map.pristineBeastEcology)).not.toMatch(/humanGeography|cityPolities|corridor|humanControl|beastPressure/i);
  expect(JSON.stringify(map.pristineBeastEcology).length).toBeLessThan(5_000);
});

test('the public overview exposes broad history without exact population geography or beast counts', () => {
  const map = baselineMap();
  const overview = PreUrbanHumanity.publicPreUrbanOverview(map);

  expect(overview.sharedCapabilities).toEqual(['agriculture', 'literacy', 'metalworking', 'establishedMagic']);
  expect(overview.groupSummaries).toHaveLength(map.preUrbanHumanity.diagnostics.populationGroupCount);
  expect(overview.beastBaseline).toHaveLength(BeastEcology.BEAST_SPECIES.length);
  expect(overview.groupSummaries.every((summary) => summary.locationPrecision === 'broadHistoricalRegionOnly' && !Object.hasOwn(summary, 'centerCellId') && !Object.hasOwn(summary, 'rangeCellIds') && !Object.hasOwn(summary, 'population'))).toBe(true);
  expect(overview.beastBaseline.every((entry) => entry.exactPopulationCountPublic === false && !Object.hasOwn(entry, 'populationCount'))).toBe(true);
});

test('playable-year beast ecology is explicitly derived from the preserved pristine baseline', () => {
  const world = Library.createWorld({ id: 'derived-current-ecology', worldSeed: 'derived-current-ecology', worldTheme: 'grim', createdAt: 'test' });
  const map = world.generatedData.strategicMap;
  const pristine = BeastEcology.expandPristineBeastEcology(map);

  expect(map.beastEcology.sourcePristineBeastEcologyDigest).toBe(map.pristineBeastEcology.digest);
  expect(map.beastEcology.historicalCausalityStatus).toBe('provisionalCityPressureUntilCivilizationHistory');
  expect(map.beastEcology.populations.map((population) => population.id)).toEqual(pristine.populations.map((population) => population.id));
  for (const population of map.beastEcology.populations) {
    expect(population.pristinePopulationId).toBe(population.id);
    expect(population.retainedPristineRangePermille).toBeGreaterThan(0);
    expect(population.retainedPristineRangePermille).toBeLessThanOrEqual(1000);
    const range = Array.from({ length: map.topology.cellCount }, (_, index) => index).filter((index) => BeastEcology.maskIncludes(population.territory.rangeMask, index));
    expect(range.every((index) => map.cityPolities.control.classes[index] !== 'c')).toBe(true);
  }
  expect(BeastEcology.publicBestiary(map).every((entry) => entry.exactPristinePopulationCountPublic === false && /^(few|scattered|numerous|widespread)$/.test(entry.pristinePopulationBand))).toBe(true);
  expect(Library.normalizeWorld(JSON.parse(JSON.stringify(world)))).toEqual(world);
  expect(JSON.stringify(world).length).toBeLessThan(5_500_000);
});
