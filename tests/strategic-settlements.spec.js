// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const StrategicWorld = require('../strategic-world');
const Resources = require('../strategic-resource-potential');
const Settlements = require('../strategic-settlements');
const GlobeRenderer = require('../strategic-globe-renderer');

function generatedMap(seed = 'settlement-world', worldTheme = 'unbound') {
  return Library.createWorld({ id: `settlements-${seed}-${worldTheme}`, worldSeed: seed, worldTheme, createdAt: 'test' }).generatedData.strategicMap;
}

function resignSettlements(map) {
  const directory = map.publicSettlementDirectory;
  delete directory.digest;
  directory.digest = `public-strategic-settlements-${StrategicWorld.stableHash(directory)}`;
  const record = map.strategicSettlements;
  record.publicDirectoryDigest = directory.digest;
  delete record.digest;
  record.digest = `strategic-settlements-${StrategicWorld.stableHash({
    sourceResourcePotentialDigest: record.sourceResourcePotentialDigest,
    sourceHumanGeographyDigest: record.sourceHumanGeographyDigest,
    sourceCivilizationOriginsDigest: record.sourceCivilizationOriginsDigest,
    sourceCityPolitiesDigest: record.sourceCityPolitiesDigest,
    sourceBeastEcologyDigest: record.sourceBeastEcologyDigest,
    sourceReligionsDigest: record.sourceReligionsDigest,
    sourceNonStateNetworksDigest: record.sourceNonStateNetworksDigest,
    publicDirectoryDigest: record.publicDirectoryDigest,
    supplementalEndowmentCodes: record.supplementalEndowmentCodes,
    hiddenSatelliteReadinessCodes: record.hiddenSatelliteReadinessCodes,
    hiddenStrongholdTensionCodes: record.hiddenStrongholdTensionCodes,
    diagnostics: record.diagnostics,
  })}`;
  map.digest = StrategicWorld.strategicMapDigest(map);
}

test('city foundations are deterministic, powerful, causal, and cover every resource family', () => {
  const map = generatedMap('world-seed-one');
  const same = generatedMap('world-seed-one');
  const directory = Settlements.publicSettlementDirectory(map);

  expect(map.strategicSettlements).toEqual(same.strategicSettlements);
  expect(map.publicSettlementDirectory).toEqual(same.publicSettlementDirectory);
  expect(directory.foundations).toHaveLength(map.humanGeography.cities.length);
  expect(directory.foundations.every((entry) => entry.foundingPower.exceptionalIndividualCount >= 1)).toBe(true);
  expect(directory.foundations.filter((entry) => entry.foundingPurpose === 'resourceAnchor').every((entry) => entry.primaryExploitation && entry.foundingPower.patronGod)).toBe(true);
  expect(new Set(directory.foundations.flatMap((entry) => [entry.primaryExploitation?.id, entry.secondaryExploitation?.id]).filter(Boolean))).toEqual(new Set(Resources.RESOURCE_FAMILIES.map((family) => family.id)));
  expect(map.strategicSettlements.supplementalEndowmentCodes.length).toBeGreaterThan(0);
  expect(Settlements.auditStrategicSettlements(map)).toMatchObject({ valid: true, everyCityHasFoundingReason: true, everyResourceFamilyExploited: true, powerfulFoundersExplicit: true });
});

test('rare isolationist refuges reject divine patronage and are exempt from mutual support', () => {
  const map = generatedMap('refuge-0', 'grim');
  const directory = Settlements.publicSettlementDirectory(map);
  const refuges = directory.foundations.filter((entry) => entry.foundingPurpose === 'independentRefuge');

  expect(refuges).toHaveLength(1);
  expect(refuges[0]).toMatchObject({ supportException: 'intentionalIsolationFromGodsAndPolitics', foundingPower: { affiliation: 'selfPoweredIndependent', patronGod: null } });
  expect(directory.supportRoutes.filter((route) => route.sponsorCityIds.includes(refuges[0].city.id)).every((route) => !route.supportCapable)).toBe(true);
  expect(Settlements.auditStrategicSettlements(map).independentRefugesRare).toBe(true);
});

test('normal cities have bounded physical support through jointly responsible route strongholds', () => {
  const map = generatedMap('mutual-support');
  const directory = Settlements.publicSettlementDirectory(map);

  expect(directory.strongholds.length).toBeGreaterThan(0);
  expect(directory.supportRoutes.filter((route) => route.supportCapable).every((route) => route.maximumLegKm <= Settlements.SUPPORT_MAXIMUM_LEG_KM)).toBe(true);
  expect(directory.strongholds.every((entry) => entry.sponsorCityIds.length === 2 && entry.sponsorContributions.length === 2 && !entry.independentlySovereign && !entry.independentDiplomacy)).toBe(true);
  expect(directory.strongholds.every((entry) => entry.sponsorContributions.reduce((total, contribution) => total + contribution.staffingPercent, 0) === 100 && entry.sponsorContributions.reduce((total, contribution) => total + contribution.upkeepPercent, 0) === 100)).toBe(true);
  expect(directory.jointStrongholdBaseline).toMatchObject({ staffingAndUpkeep: 'jointSponsorResponsibility', ordinaryLaw: 'localJointStrongholdCode', localCustodyProcessRequired: true, compactEnforcement: 'mutualNeedWithoutSuperiorState' });
  expect(Settlements.auditStrategicSettlements(map)).toMatchObject({ normalCitiesMutuallySupported: true, supportLegsWithinMaximum: true, strongholdsJointlyResponsible: true });
});

test('arable land, resources, and beasts create populated satellites with physical logistics and evacuation', () => {
  const map = generatedMap('satellite-causality');
  const directory = Settlements.publicSettlementDirectory(map);
  const functions = new Set(directory.satellites.map((entry) => entry.function));

  expect(directory.satellites.length).toBeGreaterThan(map.humanGeography.cities.length);
  expect(functions).toEqual(new Set(Settlements.SATELLITE_FUNCTIONS));
  expect(directory.satellites.every((entry) => entry.initialPopulation > 0 && entry.initialPopulation <= entry.populationCapacity && entry.localRouteCellIds.length > 1)).toBe(true);
  expect(directory.satellites.every((entry) => entry.logistics.storageEnduranceDays > 0 && !entry.logistics.physicalDeliveryGuaranteed)).toBe(true);
  expect(directory.satellites.every((entry) => entry.evacuation.planExists && entry.evacuation.singleLiftCapacity > 0 && !entry.evacuation.survivalGuaranteed && !entry.evacuation.cityGateAccessGuaranteed)).toBe(true);
  expect(directory.satellites.some((entry) => entry.function === 'hunting' && entry.form === 'huntingOutpost')).toBe(true);
  expect(Settlements.auditStrategicSettlements(map)).toMatchObject({ everySatelliteFunctionCausal: true, everySatelliteHasPopulationCapacity: true, everySatelliteHasEvacuationPlan: true });
});

test('public settlement projections hide exact supplemental endowments and operational failures', () => {
  const map = generatedMap('world-seed-one');
  const publicJson = JSON.stringify(map.publicSettlementDirectory);

  expect(publicJson).not.toContain('supplementalEndowmentCodes');
  expect(publicJson).not.toContain('hiddenSatelliteReadinessCodes');
  expect(publicJson).not.toContain('hiddenStrongholdTensionCodes');
  expect(map.strategicSettlements.supplementalEndowmentCodes.length).toBeGreaterThan(0);

  const leaked = JSON.parse(JSON.stringify(map));
  leaked.publicSettlementDirectory.hiddenSatelliteReadinessCodes = leaked.strategicSettlements.hiddenSatelliteReadinessCodes;
  resignSettlements(leaked);
  expect(() => Settlements.validateStrategicSettlements(leaked)).toThrow(/leaks hidden/i);
});

test('the settlement globe layer remains sparse and the complete saved map remains compact', () => {
  const map = generatedMap('settlement-globe');
  const landCells = [...map.surface.classes].filter((code) => code === 'L').length;
  const featureCells = map.publicSettlementDirectory.cellFeatures;

  expect(featureCells.length).toBeLessThan(landCells / 3);
  expect(featureCells.some((entry) => entry.endsWith(':s'))).toBe(true);
  expect(featureCells.some((entry) => entry.endsWith(':a'))).toBe(true);
  expect(GlobeRenderer.availableLayers(map)).toContain('settlements');
  expect(GlobeRenderer.legendForLayer('settlements').map((entry) => entry.label)).toEqual(expect.arrayContaining(['Sovereign resource-anchor city', 'Joint route stronghold', 'Agricultural satellite']));
  expect(JSON.stringify(map).length).toBeLessThan(5_000_000);
});
