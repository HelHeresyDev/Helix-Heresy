// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const Networks = require('../strategic-non-state-networks');
const StrategicWorld = require('../strategic-world');
const GlobeRenderer = require('../strategic-globe-renderer');

function generatedMap(seed = 'network-world', worldTheme = 'unbound') {
  return Library.createWorld({ id: `networks-${seed}-${worldTheme}`, worldSeed: seed, worldTheme, createdAt: 'test' }).generatedData.strategicMap;
}

function resignNetworks(map) {
  const directory = map.publicNonStateNetworkDirectory;
  delete directory.digest;
  directory.digest = `public-non-state-networks-${StrategicWorld.stableHash(directory)}`;
  const record = map.strategicNonStateNetworks;
  record.publicDirectoryDigest = directory.digest;
  delete record.digest;
  record.digest = `strategic-non-state-networks-${StrategicWorld.stableHash({
    sourceHumanGeographyDigest: record.sourceHumanGeographyDigest,
    sourceCityRecognitionDigest: record.sourceCityRecognitionDigest,
    sourceReligionsDigest: record.sourceReligionsDigest,
    publicDirectoryDigest: record.publicDirectoryDigest,
    covertPresenceCodes: record.covertPresenceCodes,
    hiddenNetworkStateCodes: record.hiddenNetworkStateCodes,
    hiddenAffiliatePurposeCodes: record.hiddenAffiliatePurposeCodes,
    hiddenInfluenceCodes: record.hiddenInfluenceCodes,
    diagnostics: record.diagnostics,
  })}`;
  map.digest = StrategicWorld.strategicMapDigest(map);
}

test('all seven non-state categories generate deterministically with bounded authority', () => {
  const map = generatedMap('deterministic-networks');
  const same = generatedMap('deterministic-networks');
  const directory = Networks.publicNonStateNetworkDirectory(map);

  expect(map.strategicNonStateNetworks).toEqual(same.strategicNonStateNetworks);
  expect(map.publicNonStateNetworkDirectory).toEqual(same.publicNonStateNetworkDirectory);
  expect(directory.networks).toHaveLength(21);
  for (const category of Networks.NETWORK_CATEGORIES) expect(directory.networks.filter((network) => network.category === category)).toHaveLength(3);
  expect(directory.networks.every((network) => !network.sovereignAuthority && !network.automaticEnforcementAuthority && !network.guaranteesLongRangeMaterialSupport)).toBe(true);
  expect(Networks.auditStrategicNonStateNetworks(map)).toMatchObject({ valid: true, everyCategoryPresent: true, everyNetworkNonSovereign: true, physicalReachLocallyBound: true });
});

test('the global internet uses magical orbital relays while rocket and individual spaceflight remain explicit facts', () => {
  const map = generatedMap('orbital-internet');
  const directory = Networks.publicNonStateNetworkDirectory(map);

  expect(directory.internetBaseline).toMatchObject({
    architecture: 'orbitalSatelliteConstellationWithArcaneRelayMesh',
    globalAddressability: true,
    orbitalSatellites: true,
    arcaneRelayLinks: true,
    localGatewaysAndPowerRequired: true,
    createsPhysicalAuthority: false,
  });
  expect(directory.spaceflightBaseline).toMatchObject({ rocketSpaceflight: true, individuallyPoweredSpaceflight: true, orbitalInfrastructure: true, routineSurfaceFreightBySpaceflight: false });
  expect(directory.networks.some((network) => network.orbitalRoles.includes('rocketLaunchServices'))).toBe(true);
  expect(directory.networks.some((network) => network.orbitalRoles.includes('orbitalRelayOperations'))).toBe(true);
  expect(Networks.auditStrategicNonStateNetworks(map)).toMatchObject({ globalInternetUsesOrbitalArcaneMesh: true, rocketSpaceflightExists: true, individualSpaceflightExists: true });
});

test('every city publishes standing and physical branches stay local without promising delivery', () => {
  const map = generatedMap('city-network-standing');
  const directory = Networks.publicNonStateNetworkDirectory(map);

  expect(map.publicNonStateNetworkDirectory.standingRows).toHaveLength(map.humanGeography.cities.length);
  expect(map.publicNonStateNetworkDirectory.standingRows.every((row) => row.length === directory.networks.length)).toBe(true);
  for (const city of map.humanGeography.cities) {
    const profile = Networks.cityNetworkProfile(map, city.id);
    expect(profile.standings).toHaveLength(directory.networks.length);
    for (const entry of profile.standings) {
      if (['chartered', 'licensed', 'recognized'].includes(entry.standing)) expect(entry.branch).toBeTruthy();
      if (entry.standing === 'proscribed') expect(entry.branch).toBeNull();
    }
  }
  expect(directory.branches.every((branch) => branch.physicalScope === 'thisCityAndContractedLocalAssetsOnly' && !branch.sovereignAuthority && !branch.longRangeDeliveryGuaranteed && !branch.enforcementAuthority)).toBe(true);
});

test('corporate affiliates expose incomplete ownership without placing the player company in the reusable world', () => {
  const map = generatedMap('shell-ecosystems');
  const directory = Networks.publicNonStateNetworkDirectory(map);

  expect(directory.affiliates).toHaveLength(15);
  expect(directory.affiliates.some((affiliate) => affiliate.ownershipDisclosure === 'disclosedSubsidiary')).toBe(true);
  expect(directory.affiliates.some((affiliate) => affiliate.ownershipDisclosure === 'opaqueBeneficialOwnership' && !affiliate.disclosedParentNetworkId)).toBe(true);
  expect(directory.affiliates.every((affiliate) => affiliate.playerOrOriginalScientistOwned === false)).toBe(true);
  expect(map.strategicNonStateNetworks.hiddenAffiliatePurposeCodes).toHaveLength(directory.affiliates.length);
  expect(Networks.auditStrategicNonStateNetworks(map)).toMatchObject({ shellOwnershipSeparated: true, playerCompanyExcludedFromCanonicalWorld: true });
});

test('public projections hide covert cells, private priorities, actual capacity, and infiltration', () => {
  const map = generatedMap('network-secrecy');
  const directory = Networks.publicNonStateNetworkDirectory(map);
  const publicJson = JSON.stringify(directory);
  const hidden = Networks.hiddenNetworkStateFor(map, directory.networks.find((network) => network.category === 'blackMarket').id);

  expect(publicJson).not.toContain('covertPresenceCodes');
  expect(publicJson).not.toContain('actualCapacityBand');
  expect(publicJson).not.toContain('privatePriority');
  expect(publicJson).not.toContain('hiddenInfluenceCodes');
  expect(hidden).toMatchObject({ publicInferencePermitted: false, covertCells: expect.any(Array) });
  expect(hidden.covertCells.length).toBeGreaterThanOrEqual(2);

  const leaked = JSON.parse(JSON.stringify(map));
  leaked.publicNonStateNetworkDirectory.covertPresenceCodes = leaked.strategicNonStateNetworks.covertPresenceCodes;
  resignNetworks(leaked);
  expect(() => Networks.validateStrategicNonStateNetworks(leaked)).toThrow(/leaks covert/i);
});

test('theme compatibility is explicit while every theme retains the same institutional categories', () => {
  const maps = ['madcap', 'grim', 'unbound'].map((theme) => generatedMap('network-themes', theme));
  const allowed = { madcap: new Set(['shared', 'madcap']), grim: new Set(['shared', 'grim']), unbound: new Set(['shared', 'madcap', 'grim']) };
  maps.forEach((map, index) => {
    const theme = ['madcap', 'grim', 'unbound'][index];
    const directory = Networks.publicNonStateNetworkDirectory(map);
    expect(directory.networks.every((network) => allowed[theme].has(network.themeContent.sourceTheme))).toBe(true);
    expect(new Set(directory.networks.map((network) => network.category))).toEqual(new Set(Networks.NETWORK_CATEGORIES));
  });
  expect(new Set(Networks.publicNonStateNetworkDirectory(maps[2]).networks.map((network) => network.themeContent.sourceTheme))).toEqual(new Set(['shared', 'madcap', 'grim']));
});

test('the public globe layer identifies real city hubs and the complete map stays compact', () => {
  const map = generatedMap('network-globe');
  const features = map.publicNonStateNetworkDirectory.cellFeatures;

  expect(features.length).toBeGreaterThan(0);
  expect(features.some((entry) => entry.endsWith(':o'))).toBe(true);
  for (const feature of features) {
    const index = parseInt(feature, 36);
    expect(Networks.cellPublicNetworkSnapshot(map, index).publicClass).not.toBe('noMajorPublicNetworkHub');
  }
  expect(GlobeRenderer.availableLayers(map)).toContain('networks');
  expect(GlobeRenderer.legendForLayer('networks').map((entry) => entry.label)).toEqual(expect.arrayContaining(['Orbital launch or relay hub', 'Dense institutional hub', 'Public network branches']));
  expect(JSON.stringify(map).length).toBeLessThan(5_000_000);
});
