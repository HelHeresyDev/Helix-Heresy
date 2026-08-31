// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const StrategicWorld = require('../strategic-world');
const StrategicCityExpansion = require('../strategic-city-expansion');
const ReligiousHistory = require('../strategic-religious-institution-history');

let cachedWorld;
function generatedWorld() {
  cachedWorld ||= Library.createWorld({ id: 'religious-institution-world', worldSeed: 'world-seed-one', worldTheme: 'unbound', createdAt: 'test' });
  return cachedWorld;
}

test('religious institution history is deterministic, dated, and causally sourced', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const source = JSON.parse(JSON.stringify(map));
  delete source.strategicReligiousInstitutionHistory;
  delete source.publicReligiousInstitutionHistoryDirectory;
  const regenerated = ReligiousHistory.createStrategicReligiousInstitutionHistory('world-seed-one', StrategicWorld.finalizeStrategicMap(source));
  const record = map.strategicReligiousInstitutionHistory;
  const cityYears = new Map(StrategicCityExpansion.allCitySeeds(map).map((city) => [city.cityId, city.foundingYear]));

  expect(regenerated.strategicReligiousInstitutionHistory).toEqual(record);
  expect(record.branchRows.length).toBeGreaterThanOrEqual(map.strategicReligions.diagnostics.branchCount);
  expect(record.branchRows.every((branch) => branch.foundingYear >= cityYears.get(branch.originalCityId) && branch.foundingYear <= record.historicalHorizonYear)).toBe(true);
  expect(record.eventRows.every((event) => event.prerequisites.length && event.cause && event.stateDeltas.length)).toBe(true);
  expect(ReligiousHistory.auditStrategicReligiousInstitutionHistory(map)).toMatchObject({ valid: true, everyBranchFoundedAfterItsCity: true, everyRetainedChangeCausallySourced: true });
});

test('playable-year branches preserve local identity, non-sovereignty, and divine correction boundaries', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const record = map.strategicReligiousInstitutionHistory;
  const identities = record.branchRows.map((branch) => `${branch.originalCityId}|${branch.traditionId}`);

  expect(new Set(identities).size).toBe(identities.length);
  expect(record.branchRows.every((branch) => !branch.sovereignAuthority && branch.physicalScope === 'localInstitutionAndControlledPropertyOnly')).toBe(true);
  expect(record.branchRows.filter((branch) => ['censured', 'estranged'].includes(branch.divineRelationship)).every((branch) => {
    const tradition = map.publicReligiousInstitutionHistoryDirectory.traditionRows.find((entry) => entry.id === branch.traditionId);
    return !tradition.sameGodHeresyClaimsValid;
  })).toBe(true);
  expect(ReligiousHistory.auditStrategicReligiousInstitutionHistory(map)).toMatchObject({ oneAggregateBranchPerCityTradition: true, activeGodCensureCreatesNoConfirmedSchism: true, divinePowerHistoryNotRecalculated: true });
});

test('successors, destroyed cities, and holy-site custody retain their approved boundaries', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const directory = ReligiousHistory.publicReligiousInstitutionHistory(map);
  const successors = directory.traditionRows.filter((tradition) => tradition.kind === 'unconfirmedSuccessorTradition');

  expect(successors.every((tradition) => tradition.confirmationState === 'unconfirmedSuccessor' && !tradition.sameGodHeresyClaimsValid && !tradition.sovereignAuthority)).toBe(true);
  expect(directory.cityStandingRows.every((row) => row.standings.filter((entry) => entry.standing === 'established').length <= 1)).toBe(true);
  expect(directory.holySiteCustodyRows.every((row) => !row.divineIdentityTransferred && !row.religionTransferred && !row.createsSovereignty)).toBe(true);
  expect(ReligiousHistory.auditStrategicReligiousInstitutionHistory(map)).toMatchObject({ successorsRemainUnconfirmed: true, destroyedCitiesHaveNoStandingOrPremises: true, holySiteCustodyTransfersNoIdentityOrSovereignty: true });
});

test('public institution history exposes observable conditions without integrity or covert influence', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const directory = ReligiousHistory.publicReligiousInstitutionHistory(map);
  const json = JSON.stringify(directory);

  expect(directory.currentBranchRows.length).toBe(map.strategicReligiousInstitutionHistory.branchRows.length);
  expect(directory.currentBranchRows.every((branch) => !branch.sovereignAuthority && branch.foundingYear <= directory.historicalHorizonYear)).toBe(true);
  expect(directory.chronology.every((event) => event.account && event.evidence.length)).toBe(true);
  expect(json).not.toMatch(/integrityBand|concealedMisconduct|covertPersistence|exactFactors|sourceEventId|privateDivine|hiddenAttention|exposureRoll|sponsorPolityId/);
  expect(ReligiousHistory.auditStrategicReligiousInstitutionHistory(map)).toMatchObject({ publicHistoryHidesIntegrityMisconductAndCovertInfluence: true });
});

test('world save-load preserves canonical and public religious institution history', () => {
  const world = generatedWorld();
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(normalized.generatedData.strategicMap.strategicReligiousInstitutionHistory).toEqual(world.generatedData.strategicMap.strategicReligiousInstitutionHistory);
  expect(normalized.generatedData.strategicMap.publicReligiousInstitutionHistoryDirectory).toEqual(world.generatedData.strategicMap.publicReligiousInstitutionHistoryDirectory);
});
