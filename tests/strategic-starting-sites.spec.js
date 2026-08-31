// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const StrategicWorld = require('../strategic-world');
const StartingSites = require('../strategic-starting-sites');

let cachedWorld;
function generatedWorld() {
  cachedWorld ||= Library.createWorld({ id: 'starting-sites-world', worldSeed: 'world-seed-one', worldTheme: 'unbound', createdAt: 'test' });
  return cachedWorld;
}

test('world-seeded scenario catalogs are deterministic, reusable, and cover distinct Chemistry Front distance bands', () => {
  const world = generatedWorld();
  const map = world.generatedData.strategicMap;
  const source = JSON.parse(JSON.stringify(map));
  delete source.strategicStartingSites;
  delete source.publicStartingSiteDirectory;
  const baseMap = StrategicWorld.finalizeStrategicMap(source);
  const regenerated = StartingSites.createStrategicStartingSites(world.worldSeed, baseMap);
  const chemistry = map.strategicStartingSites.scenarioRows.find((row) => row.scenarioId === 'chemistryFront');

  expect(regenerated).toEqual(map.strategicStartingSites);
  expect(chemistry.candidates).toHaveLength(15);
  expect(new Set(chemistry.candidates.map((candidate) => candidate.distanceBand))).toEqual(new Set(['cityDistrict', 'protectedApproaches', 'corridorFringe']));
  expect(chemistry.candidates.every((candidate) => candidate.requiredBlueprintId === 'chemistry-front-site-v3' && candidate.reusableAcrossIndependentRuns && !candidate.existingLaboratoryOccupancyTracked)).toBe(true);
  expect(chemistry.candidates.every((candidate) => map.surface.classes[StrategicWorld.cellIndex(candidate.strategicCellId)] === 'L')).toBe(true);
});

test('candidate cards expose only reported facts and corridor jurisdiction never becomes automatic city authority', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const directory = map.publicStartingSiteDirectory;
  const publicJson = JSON.stringify(directory);
  const chemistry = directory.scenarioRows.find((row) => row.scenarioId === 'chemistryFront');
  const corridorSites = chemistry.candidates.filter((candidate) => candidate.distanceBand === 'corridorFringe');

  expect(corridorSites.length).toBeGreaterThan(0);
  expect(corridorSites.every((candidate) => candidate.access.kind === 'supportedCorridor' && candidate.access.supportCapable && candidate.jurisdiction.kind === 'facilityConvoyOrAgreementOnly' && candidate.jurisdiction.governingCityId === null && !candidate.jurisdiction.automaticCorridorJurisdiction)).toBe(true);
  expect(publicJson).not.toMatch(/hiddenInterference|actualPriority|resourceCommitment|exactFactors|populationIndex|reportedRangeMask/);
  expect(StartingSites.validateStrategicStartingSites(map)).toEqual(map.strategicStartingSites);
});

test('materialized run sites preserve world and candidate provenance without occupying the reusable catalog', () => {
  const world = generatedWorld();
  const candidate = StartingSites.scenarioStartingSites(world.generatedData.strategicMap, 'chemistryFront')[0];
  const scenario = { id: 'chemistryFront', blueprintId: 'chemistry-front-site-v3', blueprintVersion: 3 };
  const first = StartingSites.materializeStartingSite(world, scenario, candidate);
  const second = StartingSites.materializeStartingSite(world, scenario, candidate);

  expect(first).toEqual(second);
  expect(first).toMatchObject({ selectionStatus: 'selectedAndMaterialized', candidateId: candidate.id, worldId: world.id, canonicalWorldDigest: world.canonicalDigest, blueprintId: scenario.blueprintId, materialization: { preservesCanonicalWorld: true, priorRunOccupancyIgnored: true } });
  expect(world.generatedData.strategicMap.publicStartingSiteDirectory.scenarioRows.find((row) => row.scenarioId === 'chemistryFront').candidates[0]).toEqual(candidate);
});
