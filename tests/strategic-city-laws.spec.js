// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const CityLaws = require('../strategic-city-laws');
const StrategicWorld = require('../strategic-world');

function generatedMap(seed, theme = 'madcap') {
  return Library.createWorld({ id: `laws-${seed}-${theme}`, worldSeed: seed, worldTheme: theme, createdAt: 'test' }).generatedData.strategicMap;
}

test('every independent city receives a deterministic complete legal code', () => {
  const map = generatedMap('city-law-foundation');
  const same = generatedMap('city-law-foundation');
  const audit = CityLaws.auditCityLegalCodes(map);

  expect(map.cityLegalCodes).toEqual(same.cityLegalCodes);
  expect(map.publicCityLawDirectory).toEqual(same.publicCityLawDirectory);
  expect(audit).toMatchObject({ valid: true, oneCodePerCity: true, everyCodeCoversCatalog: true });
  expect(map.cityLegalCodes.codes).toHaveLength(map.humanGeography.cities.length);
  for (const code of CityLaws.publicCityLawDirectory(map)) {
    expect(code.offenseRules).toHaveLength(CityLaws.OFFENSE_CATALOG.length);
    expect(new Set(code.offenseRules.map((rule) => rule.offenseId)).size).toBe(CityLaws.OFFENSE_CATALOG.length);
    expect(code.procedure).toMatchObject({ criminalProofStandard: 'beyondReasonableDoubt', chargeElementsMustBeProvenSeparately: true });
  }
});

test('science law varies by city without World Theme assigning severity', () => {
  const maps = ['madcap', 'grim', 'unbound'].map((theme) => generatedMap('same-city-law-policy', theme));
  const policyProjection = (map) => CityLaws.publicCityLawDirectory(map).map((code) => ({
    cityId: code.city.id,
    statuses: Object.fromEntries(code.offenseRules.map((rule) => [rule.offenseId, rule.legalStatus])),
    prisonMaximumMonths: code.punishmentPolicy.finitePrisonMaximumMonths,
    availableSanctions: code.punishmentPolicy.availableSanctions,
    penalLegionAvailable: code.punishmentPolicy.penalLegion.available,
    penalFlightAvailable: code.punishmentPolicy.penalFlight.available,
    publicExecutionAvailable: code.punishmentPolicy.publicExecution.available,
  }));

  expect(policyProjection(maps[0])).toEqual(policyProjection(maps[1]));
  expect(policyProjection(maps[1])).toEqual(policyProjection(maps[2]));
  for (const map of maps) {
    const publicCodes = CityLaws.publicCityLawDirectory(map);
    const geneticStatuses = publicCodes.map((code) => code.offenseRules.find((rule) => rule.offenseId === 'geneticEngineering').legalStatus);
    const animancyStatuses = publicCodes.map((code) => code.offenseRules.find((rule) => rule.offenseId === 'animancy').legalStatus);
    expect(geneticStatuses.filter((status) => status === 'prohibited').length).toBeGreaterThan(geneticStatuses.length / 2);
    expect(new Set(geneticStatuses)).toEqual(new Set(['prohibited', 'restricted', 'licensed', 'tolerated']));
    expect(new Set(animancyStatuses)).toEqual(new Set(['prohibited', 'restricted']));
  }
});

test('punishment policy forbids life imprisonment and distinguishes capital outcomes', () => {
  const map = generatedMap('city-punishment-policy', 'grim');
  const audit = CityLaws.auditCityLegalCodes(map);

  expect(audit).toMatchObject({ noLifeImprisonment: true, publicEnemyRequiresSeparateFinding: true, penalFlightIsNonterminalRelease: true });
  for (const code of CityLaws.publicCityLawDirectory(map)) {
    expect(code.punishmentPolicy.finitePrisonMaximumMonths).toBeGreaterThanOrEqual(36);
    expect(code.punishmentPolicy.finitePrisonMaximumMonths).toBeLessThanOrEqual(120);
    expect(code.punishmentPolicy.lifeImprisonmentAvailable).toBe(false);
    expect(code.punishmentPolicy.publicEnemyDesignation).toMatchObject({ separateFindingRequired: true, sovereignFiatSufficient: false });
    expect(code.punishmentPolicy.penalFlight).toMatchObject({ eligibility: 'capitalSentenceWithoutPublicEnemyDesignation', automaticDeath: false });
    if (code.punishmentPolicy.publicExecution.available) expect(code.punishmentPolicy.publicExecution.method).toBe('publicBeheading');
  }
});

test('public law exposes elements and runtime adapters without hidden enforcement or guilt inference', () => {
  const map = generatedMap('city-law-public-boundary');
  const directory = CityLaws.publicCityLawDirectory(map);
  const city = map.humanGeography.cities[0];
  const cellIndex = StrategicWorld.cellIndex(city.cellId);
  const snapshot = CityLaws.cellPublicCityLawSnapshot(map, cellIndex);

  expect(directory).toHaveLength(map.humanGeography.cities.length);
  expect(snapshot).toEqual(directory.find((entry) => entry.city.id === city.id));
  expect(snapshot?.offenseRules[0]).toMatchObject({ label: expect.any(String), elements: expect.any(Array), defenses: expect.any(Array) });
  expect(JSON.stringify(map.publicCityLawDirectory)).not.toContain('hiddenEnforcement');
  expect(JSON.stringify(directory)).not.toContain('hiddenEnforcement');
  expect(map.cityLegalCodes.codes.flatMap((code) => CityLaws.hiddenEnforcementFor(map, code.cityId)).every((directive) => directive.guiltInferencePermitted === false)).toBe(true);
  for (const [chargeId, offenseId] of Object.entries(CityLaws.RUNTIME_CHARGE_TO_OFFENSE)) {
    expect(CityLaws.publicRuleFor(map, city.id, chargeId)?.offenseId).toBe(offenseId);
  }
});

test('validation rejects altered punishment and leaked enforcement records', () => {
  const map = generatedMap('city-law-integrity');
  const alteredTruth = JSON.parse(JSON.stringify(map));
  alteredTruth.publicCityLawDirectory.entries[0].punishmentProfile.finitePrisonMaximumMonths = 121;
  alteredTruth.digest = StrategicWorld.strategicMapDigest(alteredTruth);
  expect(() => CityLaws.validateCityLegalCodes(alteredTruth)).toThrow(/punishment policy/i);

  const alteredPublic = JSON.parse(JSON.stringify(map));
  alteredPublic.publicCityLawDirectory.entries[0].hiddenEnforcement = [];
  alteredPublic.digest = StrategicWorld.strategicMapDigest(alteredPublic);
  expect(() => CityLaws.validateCityLegalCodes(alteredPublic)).toThrow(/leaks enforcement/i);
});
