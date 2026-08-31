// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const StrategicWorld = require('../strategic-world');
const StrategicCityExpansion = require('../strategic-city-expansion');
const NetworkHistory = require('../strategic-non-state-network-history');

let cachedWorld;
function generatedWorld() {
  cachedWorld ||= Library.createWorld({ id: 'non-state-network-history-world', worldSeed: 'world-seed-one', worldTheme: 'unbound', createdAt: 'test' });
  return cachedWorld;
}

test('non-state network history is deterministic, dated, and causally sourced', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const source = JSON.parse(JSON.stringify(map));
  delete source.strategicNonStateNetworkHistory;
  delete source.publicNonStateNetworkHistoryDirectory;
  const regenerated = NetworkHistory.createStrategicNonStateNetworkHistory('world-seed-one', StrategicWorld.finalizeStrategicMap(source));
  const record = map.strategicNonStateNetworkHistory;
  const cityYears = new Map(StrategicCityExpansion.allCitySeeds(map).map((city) => [city.cityId, city.foundingYear]));
  const capabilityYears = new Map(map.strategicCapabilityHistory.milestoneRows.map((milestone) => [milestone.capabilityId, milestone.standardizationYear]));

  expect(regenerated.strategicNonStateNetworkHistory).toEqual(record);
  expect(record.networkRows).toHaveLength(21);
  expect(record.networkRows.every((network) => network.foundingYear >= cityYears.get(network.originCityId) && network.coreCapabilityIds.every((id) => network.foundingYear >= capabilityYears.get(id)))).toBe(true);
  expect(record.eventRows.every((event) => event.prerequisites.length && event.cause && event.stateDeltas.length)).toBe(true);
  expect(NetworkHistory.auditStrategicNonStateNetworkHistory(map)).toMatchObject({ valid: true, everyNetworkFoundedAfterCityAndCapabilities: true, everyRetainedChangeCausallySourced: true });
});

test('network lifecycle and branches remain non-sovereign and physically bounded', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const record = map.strategicNonStateNetworkHistory;

  expect(record.networkRows.every((network) => !network.sovereignAuthority && !network.automaticEnforcementAuthority && !network.guaranteesLongRangeMaterialSupport)).toBe(true);
  expect(record.branchRows.every((branch) => !branch.sovereignAuthority && !branch.enforcementAuthority && !branch.longRangeDeliveryGuaranteed && branch.physicalScope === 'thisCityAndContractedLocalAssetsOnly')).toBe(true);
  expect(record.eventRows.filter((event) => ['branchRelocated', 'branchConsolidated'].includes(event.kind)).every((event) => event.prerequisites.includes('contemporaryTransportCapability'))).toBe(true);
  expect(NetworkHistory.auditStrategicNonStateNetworkHistory(map)).toMatchObject({ lifecycleAllowsDormancyAndDefunction: true, relocationRequiresPhysicalTransport: true, networksRemainNonSovereign: true, priorHistoryNotRecalculated: true });
});

test('destroyed cities lose standing while relocated branches gain no automatic host standing', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const directory = NetworkHistory.publicNonStateNetworkHistory(map);
  const ruinedCityIds = new Set(map.strategicPlayableSettlementState.cityRows.filter((city) => !city.physicalJurisdictionExists).map((city) => city.cityId));

  expect(directory.cityStandingRows.every((row) => !ruinedCityIds.has(row.cityId) && row.physicalJurisdictionExists && row.standings.length === 21)).toBe(true);
  expect(directory.currentBranchRows.filter((branch) => ruinedCityIds.has(branch.originalCityId)).every((branch) => branch.currentStanding === null)).toBe(true);
  expect(directory.cityStandingRows.every((row) => row.hostedRelocatedBranchIds.every((id) => !row.standings.some((standing) => standing.branchId === id)))).toBe(true);
  expect(NetworkHistory.auditStrategicNonStateNetworkHistory(map)).toMatchObject({ destroyedCitiesHaveNoStanding: true });
});

test('public network history exposes observable lifecycle without covert state or beneficial ownership', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const directory = NetworkHistory.publicNonStateNetworkHistory(map);
  const json = JSON.stringify(directory);

  expect(directory.networkRows).toHaveLength(21);
  expect(directory.currentBranchRows).toHaveLength(map.strategicNonStateNetworkHistory.branchRows.length);
  expect(directory.chronology.every((event) => event.account && event.evidence.length)).toBe(true);
  expect(json).not.toMatch(/covertRows|actualCapacityBand|integrityBand|privatePriority|actualParentNetworkId|hiddenPurpose|exactFactors|sourceEventId|exposureRoll/);
  expect(NetworkHistory.auditStrategicNonStateNetworkHistory(map)).toMatchObject({ publicHistoryHidesCovertCapacityIntegrityAndOwnership: true });
});

test('world save-load preserves canonical and public non-state network history', () => {
  const world = generatedWorld();
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(normalized.generatedData.strategicMap.strategicNonStateNetworkHistory).toEqual(world.generatedData.strategicMap.strategicNonStateNetworkHistory);
  expect(normalized.generatedData.strategicMap.publicNonStateNetworkHistoryDirectory).toEqual(world.generatedData.strategicMap.publicNonStateNetworkHistoryDirectory);
});
