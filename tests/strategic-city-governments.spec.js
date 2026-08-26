// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const CityGovernments = require('../strategic-city-governments');
const StrategicWorld = require('../strategic-world');

function generatedMap(seed, theme = 'madcap') {
  return Library.createWorld({ id: `government-${seed}-${theme}`, worldSeed: seed, worldTheme: theme, createdAt: 'test' }).generatedData.strategicMap;
}

test('every independent city receives a deterministic bounded charter and complete civic institutions', () => {
  const map = generatedMap('charter-foundation');
  const same = generatedMap('charter-foundation');
  const audit = CityGovernments.auditCityGovernments(map);

  expect(map.cityGovernments).toEqual(same.cityGovernments);
  expect(map.publicCityGovernmentDirectory).toEqual(same.publicCityGovernmentDirectory);
  expect(audit).toMatchObject({
    valid: true,
    oneGovernmentPerCity: true,
    everyGovernmentCityOnly: true,
    everyEssentialRoleCovered: true,
    jailAndPrisonAlwaysDistinct: true,
    allOfficeholdersLazy: true,
    emergencyPowersExpireWithoutRenewal: true,
  });
  expect(new Set(audit.authorityRelationKinds)).toEqual(new Set(CityGovernments.AUTHORITY_RELATIONS));
  for (const government of map.cityGovernments.governments) {
    expect(government).toMatchObject({ sovereigntyScope: 'cityOnly', superiorGovernmentId: null, stateMembership: null });
    expect(government.institutions.length).toBeGreaterThanOrEqual(7);
    expect(government.institutions.length).toBeLessThanOrEqual(10);
    expect(Object.keys(government.roleAssignments).sort()).toEqual([...CityGovernments.CIVIC_ROLES].sort());
    expect(government.roleAssignments.temporaryJailAuthority).not.toBe(government.roleAssignments.longTermCorrectionsAuthority);
    expect(government.charter.jurisdictionClaim).toEqual(CityGovernments.JURISDICTION_SCOPE);
  }
});

test('institutional capacity is causal but not assigned by World Theme', () => {
  const worlds = ['madcap', 'grim', 'unbound'].map((theme) => generatedMap('government-theme-separation', theme));
  for (const map of worlds) {
    for (const government of map.cityGovernments.governments) {
      for (const institution of government.institutions) {
        expect(institution.causalFactors).toEqual(expect.arrayContaining([
          expect.stringMatching(/^infrastructurePotential:/),
          expect.stringMatching(/^isolation:/),
          expect.stringMatching(/^publicWaveWarningCount:/),
        ]));
        expect(CityGovernments.CAPACITY_BANDS).toContain(institution.capacityBand);
      }
    }
  }
  expect(worlds.flatMap((map) => map.cityGovernments.governments).every((government) =>
    government.institutions.every((institution) => institution.causalFactors.every((factor) => !factor.startsWith('worldTheme:'))))).toBe(true);
});

test('the public directory omits operational weaknesses and named officeholders', () => {
  const map = generatedMap('government-public-boundary', 'grim');
  const directory = CityGovernments.publicCityGovernmentDirectory(map);
  const firstCityIndex = StrategicWorld.cellIndex(map.humanGeography.cities[0].cellId);
  const snapshot = CityGovernments.cellPublicCityGovernmentSnapshot(map, firstCityIndex);

  expect(directory).toHaveLength(map.humanGeography.cities.length);
  expect(snapshot).toEqual(directory.find((entry) => entry.city.id === map.humanGeography.cities[0].id));
  expect(JSON.stringify(directory)).not.toContain('hiddenOperationalRisks');
  expect(JSON.stringify(directory)).not.toContain('currentOfficeholderId');
  expect(map.cityGovernments.governments.every((government) => government.hiddenOperationalRisks)).toBe(true);
  expect(map.cityGovernments.governments.flatMap((government) => government.institutions).every((institution) => institution.currentOfficeholderId === null)).toBe(true);
});

test('government validation rejects altered canonical and public records', () => {
  const map = generatedMap('government-integrity');
  const alteredTruth = JSON.parse(JSON.stringify(map));
  alteredTruth.cityGovernments.governments[0].superiorGovernmentId = 'state:forbidden';
  alteredTruth.digest = StrategicWorld.strategicMapDigest(alteredTruth);
  expect(() => CityGovernments.validateCityGovernments(alteredTruth)).toThrow(/independent city-only/i);

  const alteredPublic = JSON.parse(JSON.stringify(map));
  alteredPublic.publicCityGovernmentDirectory.entries[0].hiddenOperationalRisks = { institutionalCapture: 'severe' };
  alteredPublic.digest = StrategicWorld.strategicMapDigest(alteredPublic);
  expect(() => CityGovernments.validateCityGovernments(alteredPublic)).toThrow(/leaks hidden risks/i);
});
