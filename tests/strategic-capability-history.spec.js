// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const Capabilities = require('../strategic-capability-history');
const Networks = require('../strategic-non-state-networks');
const Settlements = require('../strategic-settlements');

const cache = new Map();

function generatedMap(seed = 'world-seed-one', worldTheme = 'unbound', playableYear) {
  const key = `${seed}:${worldTheme}:${playableYear || 'generated'}`;
  if (!cache.has(key)) cache.set(key, Library.createWorld({ id: `capabilities-${key}`, worldSeed: seed, worldTheme, playableYear, createdAt: 'test' }).generatedData.strategicMap);
  return cache.get(key);
}

test('capability eras are deterministic causal histories rather than isolated unlock rolls', () => {
  const map = generatedMap();
  const same = Library.createWorld({ id: 'capabilities-same', worldSeed: 'world-seed-one', worldTheme: 'unbound', createdAt: 'test' }).generatedData.strategicMap;
  const record = map.strategicCapabilityHistory;

  expect(record).toEqual(same.strategicCapabilityHistory);
  expect(record.milestoneRows).toHaveLength(Capabilities.CAPABILITY_DEFINITIONS.length);
  expect(record.milestoneRows.every((milestone) => milestone.resourceRequirementRows.length > 0 && milestone.energyRequirement && milestone.institution && milestone.infrastructureRows.length > 0)).toBe(true);
  expect(record.milestoneRows.every((milestone) => milestone.prerequisiteIds.every((id) => record.milestoneRows.find((dependency) => dependency.capabilityId === id).standardizationYear <= milestone.discoveryYear))).toBe(true);
  expect(Capabilities.auditStrategicCapabilityHistory(map)).toMatchObject({ valid: true, capabilitiesAreCausalSystems: true, prerequisitesAreChronological: true });
});

test('knowledge becomes global while infrastructure adoption remains physical and uneven', () => {
  const map = generatedMap('refuge-0', 'grim', 1300);
  const directory = Capabilities.publicCapabilityHistory(map);
  const rocket = directory.milestones.find((milestone) => milestone.capability.id === 'rocketSpaceflight');
  const holograms = directory.milestones.find((milestone) => milestone.capability.id === 'holographicSystems');

  expect(rocket.adoption).toMatchObject({ knowledgeIsGlobalAtPlayableYear: true, deploymentIsUneven: true });
  expect(rocket.adoption.deployedCityCount).toBeGreaterThan(0);
  expect(rocket.adoption.deployedCityCount).toBeLessThan(directory.cityProfiles.length);
  expect(holograms.adoption.deployedCityCount).toBe(directory.cityProfiles.length);
  expect(directory.cityProfiles.every((profile) => profile.allStandardizedCapabilitiesKnown)).toBe(true);
  expect(Capabilities.auditStrategicCapabilityHistory(map).knowledgeAndDeploymentSeparated).toBe(true);
});

test('the playable-year orbital baseline is guaranteed through maintained sites without granting authority or freight', () => {
  const map = generatedMap('orbital-capability-baseline');
  const directory = Capabilities.publicCapabilityHistory(map);
  const baseline = directory.currentBaseline;
  const orbital = directory.milestones.find((milestone) => milestone.capability.id === 'orbitalArcaneRelayMesh');

  expect(baseline).toMatchObject({
    aircraftAndFlyingMountsExist: true,
    mechsExist: true,
    holographicSystemsExist: true,
    everySupportComponentHasOrbitalGateway: true,
    knowledgeDoesNotCreateMaterialSupport: true,
    internet: { architecture: 'orbitalSatelliteConstellationWithArcaneRelayMesh', createsPhysicalAuthority: false, localGatewaysAndPowerRequired: true },
    spaceflight: { rocketSpaceflight: true, individuallyPoweredSpaceflight: true, routineSurfaceFreightBySpaceflight: false },
  });
  expect(orbital.infrastructureSites.every((site) => site.maintenanceRequirements.length >= 3)).toBe(true);
  expect(orbital.adoption.supportComponentCount).toBe(orbital.adoption.totalSupportComponentCount);
  expect(Networks.publicNonStateNetworkDirectory(map).internetBaseline).toEqual(baseline.internet);
  expect(Networks.publicNonStateNetworkDirectory(map).spaceflightBaseline).toEqual(baseline.spaceflight);
});

test('settlement transport modes consume local capability deployment and public history hides canonical weaknesses', () => {
  const map = generatedMap();
  const settlements = Settlements.publicSettlementDirectory(map);
  const publicJson = JSON.stringify(map.publicCapabilityHistory);

  for (const satellite of settlements.satellites) {
    const sponsorIds = satellite.ultimateSponsorCityIds;
    if (['aircraft', 'mixedFleet'].includes(satellite.logistics.vehicleMode)) expect(sponsorIds.some((cityId) => Capabilities.cityHasCapability(map, cityId, 'poweredAircraft'))).toBe(true);
    if (['flyingMounts', 'mixedFleet'].includes(satellite.logistics.vehicleMode)) expect(sponsorIds.some((cityId) => Capabilities.cityHasCapability(map, cityId, 'flyingMountInfrastructure'))).toBe(true);
  }
  expect(map.strategicCapabilityHistory.failedProgramRows.every((failure) => failure.actualCause && failure.retainedConsequence.discoverable)).toBe(true);
  expect(publicJson).not.toMatch(/actualCause|hiddenConditionBand|hiddenSinglePointOfFailure|resourceRequirementRows/);
  expect(Capabilities.auditStrategicCapabilityHistory(map)).toMatchObject({ failuresRetainedOnlyWithConsequences: true, publicHistoryHidesCanonicalWeaknesses: true });
});
