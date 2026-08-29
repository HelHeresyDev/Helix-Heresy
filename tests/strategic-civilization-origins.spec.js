// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const Origins = require('../strategic-civilization-origins');
const Divinity = require('../strategic-divinity');
const PreUrbanHumanity = require('../strategic-pre-urban-humanity');
const Settlements = require('../strategic-settlements');

let cachedWorld;

function originWorld(seed = 'origin-smoke') {
  if (!cachedWorld || cachedWorld.worldSeed !== seed) cachedWorld = Library.createWorld({ id: `origins-${seed}`, worldSeed: seed, worldTheme: 'unbound', createdAt: 'test' });
  return cachedWorld;
}

test('Year 0 first city and rival origin cities form deterministic disconnected history', () => {
  const first = originWorld();
  const same = Library.createWorld({ id: 'origins-same', worldSeed: 'origin-smoke', worldTheme: 'unbound', createdAt: 'test' });
  const map = first.generatedData.strategicMap;
  const record = map.civilizationOrigins;
  const successes = record.attemptRows.filter((attempt) => attempt.outcome === 'enduringCity');

  expect(record).toEqual(same.generatedData.strategicMap.civilizationOrigins);
  expect(record.attemptRows[0]).toMatchObject({ year: 0, outcome: 'enduringCity', cityId: record.firstCityId });
  expect(successes.length).toBeGreaterThan(1);
  expect(new Set(successes.map((attempt) => attempt.initialSupportComponentId)).size).toBe(successes.length);
  expect(record.rivalryTrigger).toBe('firstCityDemonstratedConcentratedWorshipEfficiency');
  expect(record.firstEraInfrastructure).toBe('noIntercityCorridorsOrStrongholds');
  expect(record.attemptRows.length).toBeLessThan(map.strategicDivinity.godOrder.length);
  expect(Origins.auditCivilizationOrigins(map)).toMatchObject({ valid: true, firstCityFoundedAtYearZero: true, qualifiedMinorityAttempts: true, originCitiesInitiallyDisconnected: true });
});

test('every origin uses real people, viable materials, exceptional founders, and finite divine aid', () => {
  const map = originWorld().generatedData.strategicMap;
  const groups = new Map(PreUrbanHumanity.expandPopulationGroups(map).map((group) => [group.id, group]));
  const allocated = new Map();

  for (const attempt of map.civilizationOrigins.attemptRows) {
    const god = Divinity.privateDivineStateFor(map, attempt.patronGodId);
    const humanWorshipGroups = new Set(god.worshipSources.filter((source) => source.kind === 'human').map((source) => source.sourcePopulationId));
    expect(attempt.sourcePopulationRows.some((row) => humanWorshipGroups.has(row[0]))).toBe(true);
    expect(attempt.founderRows.length).toBeGreaterThan(0);
    expect(attempt.founderRows.every((founder) => founder.exceptionalCapabilities.length > 0)).toBe(true);
    expect(attempt.divinePowerSpent).toBeGreaterThan(0);
    expect(attempt.endingDivineReserve).toBe(god.power.reserve - attempt.divinePowerSpent);
    for (const [groupId, population] of attempt.sourcePopulationRows) allocated.set(groupId, (allocated.get(groupId) || 0) + population);
    if (attempt.outcome === 'enduringCity') expect(attempt.materialRows.every((row) => row[1] >= row[2])).toBe(true);
  }
  expect([...allocated].every(([groupId, population]) => population <= groups.get(groupId).population)).toBe(true);
  expect(Origins.auditCivilizationOrigins(map)).toMatchObject({ everyOriginPopulationBacked: true, everySuccessfulOriginMateriallyViable: true, divineAidFiniteAndMaterialLaborRequired: true });
});

test('failed attempts survive only as consequences while the public chronology hides private truth', () => {
  const map = originWorld().generatedData.strategicMap;
  const failed = map.civilizationOrigins.attemptRows.filter((attempt) => attempt.outcome === 'retainedFailure');
  const directory = Origins.publicCivilizationOrigins(map);

  expect(failed.length).toBeGreaterThan(0);
  expect(failed.every((attempt) => attempt.failureCause && attempt.retainedConsequence && !attempt.cityId)).toBe(true);
  expect(directory.rivalryTrigger).toBe('observedUrbanSurvivalAndConcentratedWorshipEfficiency');
  expect(directory.chronology).toHaveLength(map.civilizationOrigins.attemptRows.length);
  expect(directory.chronology[0].publicExplanation).toContain('first enduring walls');
  expect(JSON.stringify(directory)).not.toMatch(/canonicalMotive|divinePowerSpent|endingDivineReserve|sourcePopulationId|initialPopulation|materialRows/);
  expect(Origins.auditCivilizationOrigins(map)).toMatchObject({ failedAttemptsRetainedOnlyWithConsequences: true, publicChronologyHidesPrivateTruth: true });
});

test('origin sites and founders remain authoritative in geography and settlement projections', () => {
  const map = originWorld().generatedData.strategicMap;
  const seeds = Origins.originCitySeeds(map);
  const foundations = Settlements.publicSettlementDirectory(map).foundations;

  for (const origin of seeds) {
    expect(map.humanGeography.cities.find((city) => city.id === origin.cityId)).toMatchObject({ name: origin.cityName, cellId: origin.cellId });
    expect(foundations.find((foundation) => foundation.city.id === origin.cityId)).toMatchObject({
      primaryExploitation: { id: origin.resourcePurposeId },
      foundingPower: { exceptionalIndividualCount: origin.founderCount, affiliation: origin.foundingAffiliation, patronGod: { id: origin.patronGodId }, civicRelationship: origin.civicRelation },
      originHistory: { foundingYear: origin.foundingYear, initialSupportComponentStatus: 'independentWithoutIntercityCorridorsOrStrongholds' },
    });
  }
  expect(Settlements.auditStrategicSettlements(map).originFoundationsAuthoritative).toBe(true);
});

test('origin history survives compact save/load and rejects demographic over-allocation', () => {
  const world = originWorld('origin-roundtrip');
  expect(Library.normalizeWorld(JSON.parse(JSON.stringify(world)))).toEqual(world);
  expect(JSON.stringify(world).length).toBeLessThan(5_500_000);

  const altered = JSON.parse(JSON.stringify(world.generatedData.strategicMap));
  altered.civilizationOrigins.attemptRows[0].sourcePopulationRows[0][1] = 10_000_000;
  altered.civilizationOrigins.attemptRows[0].initialPopulation = altered.civilizationOrigins.attemptRows[0].sourcePopulationRows.reduce((total, row) => total + row[1], 0);
  expect(() => Origins.validateCivilizationOrigins(altered)).toThrow(/population/i);
});
