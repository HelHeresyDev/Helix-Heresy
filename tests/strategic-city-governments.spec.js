// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const CityGovernments = require('../strategic-city-governments');
const StrategicWorld = require('../strategic-world');

function generatedMap(seed, theme = 'madcap') {
  return Library.createWorld({ id: `government-${seed}-${theme}`, worldSeed: seed, worldTheme: theme, createdAt: 'test' }).generatedData.strategicMap;
}

function governmentFoundation(seed) {
  // Generate real charter dependencies without unrelated decades of later
  // political, legal, religious and demographic history.
  let map = StrategicWorld.createStrategicMap(seed);
  map = require('../planetary-relief').attachRelief(seed, map);
  map = require('../climate-hydrology-biomes').attachEnvironment(seed, map);
  map = require('../strategic-geology').attachGeology(seed, map);
  map = require('../strategic-arcane-geography').attachArcaneGeography(seed, map);
  map = require('../strategic-resource-potential').attachResourcePotential(seed, map);
  map = require('../strategic-beast-ecology').attachPristineBeastEcology(seed, map);
  map = require('../strategic-human-geography').attachHumanGeography(seed, map);
  map = require('../strategic-city-polities').attachCityPolities(seed, 'madcap', map);
  map = require('../strategic-beast-ecology').attachBeastEcology(seed, map);
  return CityGovernments.attachCityGovernments(seed, map);
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

test('generated designation review rules are explicit deterministic published local law', () => {
  const map = governmentFoundation('charter-foundation');
  const directory = CityGovernments.publicCityGovernmentDirectory(map);
  let applicable = 0;
  for (const g of map.cityGovernments.governments) {
    // The generator's actual law is copied intact to its public charter, never
    // inferred from a succession label by an attending reviewer.
    expect(directory.find(entry => entry.city.id === g.cityId).charter.designationReview).toEqual(g.charter.designationReview);
    if (g.charter.designationReview) {
      applicable++;
      expect(g.charter.designationReview).toMatchObject({ reviewInstitutionId: g.roleAssignments.civicReview,
        requiredAuthorizationIds: [], principle: g.charter.successionPrinciple });
      expect(g.charter.designationReview.text.length).toBeGreaterThan(30);
      expect(['independentConfirmationPermitted', 'uncoercedDesignationRequired']).toContain(g.charter.designationReview.coercionRule);
    }
    if (!['named experimental successor', 'designation by the reigning protector'].includes(g.charter.successionPrinciple))
      expect(g.charter.designationReview).toBeNull();
  }
  expect(applicable).toBeGreaterThan(0);
  expect(governmentFoundation('charter-foundation').cityGovernments).toEqual(map.cityGovernments);
  expect(CityGovernments.auditCityGovernments(map).valid).toBe(true);
});

test('disputed public-works appointment law is separately published only where independent designation confirmation is permitted', () => {
  const map = governmentFoundation('charter-foundation'), A = require('../public-works-appointments');
  const original = JSON.stringify(map), directory = CityGovernments.publicCityGovernmentDirectory(map);
  let applicable = 0;
  for (const g of map.cityGovernments.governments) {
    const works = g.institutions.find(i => i.id === g.roleAssignments.publicWorksAndProvisioning);
    const supported = g.charter.publicWorksAppointment && g.charter.designationReview?.coercionRule === 'independentConfirmationPermitted';
    expect(g.charter.disputedPublicWorksAppointment).toEqual(supported ? A.disputedRuleFor(g.cityId, works.id, g.roleAssignments.civicReview) : null);
    expect(directory.find(d => d.city.id === g.cityId).charter.disputedPublicWorksAppointment).toEqual(g.charter.disputedPublicWorksAppointment);
    if (supported) applicable++;
  }
  expect(applicable).toBeGreaterThan(0); expect(JSON.stringify(map)).toBe(original);
  expect(governmentFoundation('charter-foundation').cityGovernments).toEqual(map.cityGovernments);
});

test('public-works replacement rules are explicit published law only for separate supported individual offices', () => {
  const map = governmentFoundation('charter-foundation');
  const A = require('../public-works-appointments');
  const Civil = require('../civil-installation-access');
  const directory = CityGovernments.publicCityGovernmentDirectory(map);
  let applicable = 0;
  for (const g of map.cityGovernments.governments) {
    const polity = map.cityPolities.polities.find(p => p.cityId === g.cityId);
    const office = g.institutions.find(i => i.id === g.roleAssignments.publicWorksAndProvisioning);
    const supported = polity.authority.kind === 'individual'
      && ['named experimental successor', 'designation by the reigning protector'].includes(g.charter.successionPrinciple)
      && office.roles.length === 1;
    expect(g.charter.publicWorksAppointment).toEqual(supported ? A.ruleFor(g.cityId, office.id, g.roleAssignments.civicReview) : null);
    expect(directory.find(d => d.city.id === g.cityId).charter.publicWorksAppointment).toEqual(g.charter.publicWorksAppointment);
    expect(g.charter.civilInstallationAccess).toEqual(supported ? Civil.ruleFor(g.cityId, office.id, g.roleAssignments.civicReview, g.roleAssignments.militaryDefenseCommand) : null);
    expect(directory.find(d => d.city.id === g.cityId).charter.civilInstallationAccess).toEqual(g.charter.civilInstallationAccess);
    if (supported) applicable++;
  }
  expect(applicable).toBeGreaterThan(0);
  expect(governmentFoundation('charter-foundation').cityGovernments).toEqual(map.cityGovernments);
  expect(CityGovernments.auditCityGovernments(map).valid).toBe(true);
});
test('combined public-works reassignment publishes an exact role division without separate-office eviction power', () => {
  const map = governmentFoundation('charter-foundation'), A = require('../public-works-appointments');
  const directory = CityGovernments.publicCityGovernmentDirectory(map); let count = 0;
  for (const g of map.cityGovernments.governments) {
    const polity = map.cityPolities.polities.find(p => p.cityId === g.cityId);
    const works = g.institutions.find(i => i.id === g.roleAssignments.publicWorksAndProvisioning);
    const supported = polity.authority.kind === 'individual'
      && ['named experimental successor', 'designation by the reigning protector'].includes(g.charter.successionPrinciple)
      && JSON.stringify(works.roles) === JSON.stringify(['emergencyManagement', 'publicWorksAndProvisioning']);
    expect(g.charter.publicWorksRoleReassignment).toEqual(supported ? A.roleRuleFor(g.cityId, works.id, g.roleAssignments.civicReview) : null);
    expect(directory.find(d => d.city.id === g.cityId).charter.publicWorksRoleReassignment).toEqual(g.charter.publicWorksRoleReassignment);
    if (supported) { count++; expect(g.charter.publicWorksAppointment).toBeNull(); expect(g.charter.civilInstallationAccess).toBeNull(); }
  }
  expect(count).toBeGreaterThan(0);
  expect(governmentFoundation('charter-foundation').cityGovernments).toEqual(map.cityGovernments);
  expect(CityGovernments.auditCityGovernments(map).valid).toBe(true);
});

test('published patron covenants use real known founding patrons and local petitions never mutate reusable worlds', () => {
  test.setTimeout(600000);
  const Religion = require('../religious-recognition');
  const Faiths = require('../strategic-faiths');
  // Use a genuinely generated supported world; tiny worlds can violate the
  // existing diplomacy/recognition minimum-population guards before this layer.
  const map = generatedMap('patron-petition-foundations', 'unbound'), before = JSON.stringify(map);
  const faiths = Faiths.publicFaithDirectory(map).faiths;
  const publicGovernments = CityGovernments.publicCityGovernmentDirectory(map);
  let requirements = 0, usableSources = 0, eligibleLaws = 0;
  for (const government of map.cityGovernments.governments) {
    const law = government.charter.designationReview, requirement = law?.patronRequirement;
    if (law) eligibleLaws++;
    expect(publicGovernments.find(g => g.city.id === government.cityId).charter.designationReview).toEqual(law);
    if (requirement) {
      requirements++;
      const foundation = map.cityExpansionHistory.foundationRows.find(f => f.cityId === government.cityId)
        || map.civilizationOrigins.attemptRows.find(f => f.cityId === government.cityId);
      expect(foundation).toMatchObject({ patronGodId: requirement.godId, foundingAffiliation: 'chosenRepresentative' });
      expect(faiths.find(f => f.id === requirement.faithId)?.godId).toBe(requirement.godId);
      expect(law.requiredAuthorizationIds).toEqual([requirement.authorizationId]); expect(requirement.scope).toBe(Religion.SCOPE);
    } else if (law) expect(law.requiredAuthorizationIds).toEqual([]);
    const source = Religion.sourceFromWorld(map, government.cityId, government.charter.id);
    if (!source) continue;
    const office = { id: 'real-local-counter', cityId: source.cityId, clerk: { id: 'real-local-clerk' } };
    const petition = Religion.create(source, office, 'unbound');
    if (!petition) continue;
    usableSources++;
    expect(source.branch).toMatchObject({ currentCityId: government.cityId, publicPhysicalPresence: true });
    expect(source.god.lifecycle).toMatchObject({ lifeState: 'living', divinityState: 'divine' });
    expect(source.faith.godId).toBe(source.god.id); expect(petition.allocation.people).toBe(1);
    const reserve = source.god.power.reserve; petition.god.power.reserve = reserve + 1; petition.actor.workSeconds = 0;
    expect(source.god.power.reserve).toBe(reserve);
  }
  // A randomly generated world need not adopt any optional patron covenant.
  // The dedicated rule unit check verifies that both covenant and secular laws exist.
  console.log(`Patron-source check: ${eligibleLaws} supported laws, ${requirements} optional covenants, ${usableSources} usable original religious sources`);
  expect(requirements).toBeLessThanOrEqual(eligibleLaws); expect(usableSources).toBeGreaterThan(0);
  expect(JSON.stringify(map)).toBe(before);
  expect(Religion.sourceFromWorld(map, 'unsupported-city', 'unsupported-charter')).toBeNull();
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
