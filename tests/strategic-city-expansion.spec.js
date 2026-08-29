// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const Expansion = require('../strategic-city-expansion');
const Settlements = require('../strategic-settlements');

const cache = new Map();

function generatedWorld(seed = 'world-seed-one', theme = 'unbound', playableYear) {
  const key = `${seed}:${theme}:${playableYear || 'generated'}`;
  if (!cache.has(key)) cache.set(key, Library.createWorld({ id: `expansion-${key}`, worldSeed: seed, worldTheme: theme, playableYear, createdAt: 'test' }));
  return cache.get(key);
}

test('later city foundations are deterministic, causal, population-backed, and historically bounded', () => {
  const first = generatedWorld();
  const same = Library.createWorld({ id: 'expansion-same', worldSeed: 'world-seed-one', worldTheme: 'unbound', createdAt: 'test' });
  const map = first.generatedData.strategicMap;
  const record = map.cityExpansionHistory;

  expect(record).toEqual(same.generatedData.strategicMap.cityExpansionHistory);
  expect(record.historicalHorizonYear).toBe(first.playableYear);
  expect(record.foundationRows.length).toBeGreaterThan(0);
  expect(record.foundationRows.every((foundation) => foundation.parentCityId && foundation.originLineageCityId && foundation.foundingPopulation >= 700 && foundation.materialRows.every((row) => row[1] >= row[2]))).toBe(true);
  expect(record.foundationRows.every((foundation) => foundation.founderRows.length >= 1 && foundation.founderRows.length <= 3)).toBe(true);
  expect(record.diagnostics.totalCityCount).toBeLessThanOrEqual(38);
  expect(record.diagnostics.representedPrimaryResourceFamilyCount).toBe(12);
  expect(Expansion.auditCityExpansionHistory(map)).toMatchObject({ valid: true, everyLaterCityHasCausalParent: true, parentageNeverImpliesAllegiance: true, everyOrdinaryCityPhysicallySupported: true });
});

test('lineage corridors, component bridges, and strongholds preserve separate political concepts', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const record = map.cityExpansionHistory;
  const bridges = record.corridorRows.filter((corridor) => corridor.corridorClass === 'componentBridge');

  expect(record.corridorRows.filter((corridor) => corridor.corridorClass === 'lineageSupport')).toHaveLength(record.foundationRows.filter((foundation) => !foundation.independentRefuge).length);
  expect(bridges.length).toBeGreaterThan(0);
  expect(record.strongholdRows.length).toBeGreaterThan(0);
  expect(record.strongholdRows.every((stronghold) => stronghold.sponsorCityIds.length === 2 && stronghold.sponsorContributionRows.reduce((total, row) => total + row[1], 0) === 100 && stronghold.sponsorContributionRows.reduce((total, row) => total + row[2], 0) === 100)).toBe(true);
  expect(map.publicCityExpansionDirectory.currentSupportComponents.every((component) => !component.politicalUnity)).toBe(true);
  expect(Expansion.auditCityExpansionHistory(map)).toMatchObject({ strongholdsJointlyResponsible: true, bridgesDoNotMergeLineages: true });
});

test('rare independent refuges retain lineage while rejecting gods and physical support corridors', () => {
  const map = generatedWorld('refuge-0', 'grim', 1200).generatedData.strategicMap;
  const refuge = map.cityExpansionHistory.foundationRows.find((foundation) => foundation.independentRefuge);
  const publicFoundation = Settlements.publicSettlementDirectory(map).foundations.find((foundation) => foundation.city.id === refuge.cityId);

  expect(refuge).toMatchObject({ foundationCause: 'politicalEscape', relationshipAtFoundation: 'openlyHostile', patronGodId: null, foundingAffiliation: 'selfPoweredIndependent' });
  expect(refuge.originLineageCityId).toBeTruthy();
  expect(map.cityExpansionHistory.corridorRows.every((corridor) => !corridor.endpointCityIds.includes(refuge.cityId))).toBe(true);
  expect(publicFoundation).toMatchObject({ foundingPurpose: 'independentRefuge', supportException: 'intentionalIsolationFromGodsAndPolitics', foundingPower: { patronGod: null, affiliation: 'selfPoweredIndependent' }, foundationHistory: { independentRefuge: true, supportAtFoundation: 'intentionalIsolation' } });
  expect(Expansion.auditCityExpansionHistory(map).refugesIntentionallyDisconnected).toBe(true);
});

test('public expansion history exposes consequences and connectivity without leaking canonical truth', () => {
  const world = generatedWorld();
  const map = world.generatedData.strategicMap;
  const directory = Expansion.publicCityExpansion(map);
  const publicJson = JSON.stringify(directory);

  expect(directory.chronology).toHaveLength(map.cityExpansionHistory.foundationRows.length + map.cityExpansionHistory.corridorRows.length + map.cityExpansionHistory.failedProjectRows.length);
  expect(directory.chronology.some((event) => event.kind === 'failedExpansion')).toBe(true);
  expect(directory.chronology.some((event) => event.kind === 'supportComponentBridge')).toBe(true);
  expect(publicJson).not.toMatch(/canonicalMotive|"foundingPopulation":|populationSourceRows|materialRows|failureCause|relativeConstructionCost/);
  expect(Library.normalizeWorld(JSON.parse(JSON.stringify(world)))).toEqual(world);
  expect(JSON.stringify(world).length).toBeLessThan(5_500_000);
  expect(Expansion.auditCityExpansionHistory(map)).toMatchObject({ failedProjectsRetainedOnlyWithConsequences: true, publicHistoryHidesCanonicalTruth: true });
});

test('geography and settlement projections preserve authoritative cities, routes, and strongholds', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const foundations = Settlements.publicSettlementDirectory(map).foundations;

  for (const history of Expansion.allCitySeeds(map)) {
    expect(map.humanGeography.cities.find((city) => city.id === history.cityId)).toMatchObject({ name: history.cityName, cellId: history.cellId });
    expect(foundations.find((foundation) => foundation.city.id === history.cityId)).toMatchObject({ foundingPower: { exceptionalIndividualCount: history.founderRows.length, affiliation: history.foundingAffiliation } });
  }
  for (const corridor of Expansion.corridorSeeds(map)) {
    expect(map.routeGraph.routes.find((route) => route.id === corridor.id)).toMatchObject({ endpointIds: corridor.endpointCityIds, cellPath: corridor.cellPath });
  }
  expect(Settlements.auditStrategicSettlements(map)).toMatchObject({ expansionHistoryAuthoritative: true, strongholdHistoryAuthoritative: true });
});
