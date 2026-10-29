// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const StrategicWorld = require('../strategic-world');
const SettlementState = require('../strategic-playable-settlement-state');

let cachedWorld;
function generatedWorld() {
  cachedWorld ||= Library.createWorld({ id: 'playable-settlement-world', worldSeed: 'world-seed-one', worldTheme: 'unbound', createdAt: 'test' });
  return cachedWorld;
}

test('playable settlement state is deterministic, complete, and causally sourced', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const source = JSON.parse(JSON.stringify(map));
  delete source.strategicPlayableSettlementState;
  delete source.publicPlayableSettlementDirectory;
  const regenerated = SettlementState.createStrategicPlayableSettlementState('world-seed-one', StrategicWorld.finalizeStrategicMap(source));
  const record = map.strategicPlayableSettlementState;
  const crisisIds = new Set(map.strategicCrisisHistory.eventRows.map((event) => event.id));

  expect(regenerated.strategicPlayableSettlementState).toEqual(record);
  expect(record.cityRows).toHaveLength(map.humanGeography.cities.length);
  expect(record.strongholdRows).toHaveLength(map.publicSettlementDirectory.strongholdCodes.length);
  expect(record.satelliteRows).toHaveLength(map.publicSettlementDirectory.satelliteCodes.length);
  expect(record.recoveryRows.every((event) => crisisIds.has(event.sourceEventId) && event.prerequisites.includes(event.sourceEventId))).toBe(true);
  expect(SettlementState.auditStrategicPlayableSettlementState(map)).toMatchObject({ valid: true, everyConstructedAssetResolvedOnce: true, recoveryIsCausallySourced: true });
});

test('aggregate population ledgers balance and preserve separate settlement identities', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const record = map.strategicPlayableSettlementState;
  const assets = [...record.cityRows, ...record.strongholdRows, ...record.satelliteRows];

  expect(assets.every((row) => row.populationLedger.foundingPopulation + row.populationLedger.ordinaryNaturalChange + row.populationLedger.arrivals - row.populationLedger.departures - row.populationLedger.crisisFatalities === row.currentPopulation)).toBe(true);
  expect(record.strongholdRows.every((row) => row.jointlyDependent && !row.independentlySovereign && row.sponsorCityIds.length === 2)).toBe(true);
  expect(record.satelliteRows.every((row) => Number.isInteger(row.foundingYear) && row.foundingYear <= record.playableYear && !row.evacuationPlanGuaranteedSuccess)).toBe(true);
  expect(record.displacementRows.every((row) => row.individualSimulationDeferred && !row.cityGateAdmissionGuaranteed)).toBe(true);
});

test('usable routes alone determine authoritative current support components', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const record = map.strategicPlayableSettlementState;
  const audit = SettlementState.auditStrategicPlayableSettlementState(map);

  expect(record.routeRows.every((row) => row.supportCapable === (row.continuity !== 'closed') && !row.createsState && !row.createsAlliance)).toBe(true);
  expect(record.currentSupportComponents.every((component) => component.physicallyConnected && !component.politicalUnity)).toBe(true);
  expect(audit).toMatchObject({ currentComponentsFollowUsableRoutes: true, connectivityCreatesNoPoliticalUnity: true, atLeastOneViableRunStartRegion: true, destroyedCitiesRemainRuinsWithoutJurisdiction: true });
});

test('public settlement state exposes ranges and conditions while hiding exact losses and readiness', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const directory = SettlementState.publicPlayableSettlementDirectory(map);
  const json = JSON.stringify(directory);

  expect(directory.cityRows).toHaveLength(map.strategicPlayableSettlementState.cityRows.length);
  expect(directory.cityRows.every((row) => row.city && row.populationRange.minimum <= row.populationRange.maximum && !row.exactPopulationPublic && !row.exactCapacityPublic)).toBe(true);
  expect(directory.routeRows.every((row) => row.endpointCities.length === 2 && !row.createsState && !row.createsAlliance)).toBe(true);
  expect(json).not.toMatch(/populationLedger|protectedCapacity|currentPopulation|exactFactors|crisisFatalities|unresolvedDisplacedPopulation|admittedPopulation|sponsorPublicWorksCapacityIndices/);
  expect(SettlementState.auditStrategicPlayableSettlementState(map)).toMatchObject({ publicDirectoryHidesExactPopulationAndLosses: true });
});

test('world save-load preserves canonical and public playable settlement state', () => {
  const world = generatedWorld();
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(normalized.generatedData.strategicMap.strategicPlayableSettlementState).toEqual(world.generatedData.strategicMap.strategicPlayableSettlementState);
  expect(normalized.generatedData.strategicMap.publicPlayableSettlementDirectory).toEqual(world.generatedData.strategicMap.publicPlayableSettlementDirectory);
});

test('current claimant and local-carrier allocations retain actual admitted people, original infrastructure and private finite budgets', () => {
  test.setTimeout(900000);
  const world = generatedWorld(), map = world.generatedData.strategicMap, record = map.strategicPlayableSettlementState;
  expect(record.claimantContactRows).toEqual(SettlementState.claimantContacts(map, record.cityRows, record.displacementRows));
  for (const channel of record.claimantContactRows) {
    const displacement = record.displacementRows.find(d => d.id === channel.displacementId);
    expect(displacement.admissions.find(a => a.cityId === channel.hostCityId).admittedPopulation).toBeGreaterThanOrEqual(channel.allocatedPopulation);
    expect(channel.allocatedPopulation).toBeLessThanOrEqual(channel.admittedPopulation);
    expect(channel.reservedEnergy).toBe(720 * Math.max(1, record.cityRows.find(c => c.cityId === channel.hostCityId).currentPopulation / 1000));
  }
  expect(record.satelliteRows.every(s => s.transportAllocation.populationSourceId === s.assetId
    && s.transportAllocation.operators <= s.currentPopulation
    && s.transportAllocation.fuelKm === s.transportAllocation.carriers * s.transportAllocation.rangeKm)).toBe(true);
  expect(JSON.stringify(map.publicPlayableSettlementDirectory)).not.toMatch(/claimantContactRows|reservedEnergy|transportAllocation|operatorId|powerUnits/);
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));
  expect(normalized.generatedData.strategicMap.strategicPlayableSettlementState).toEqual(record);
  const corrupt = JSON.parse(JSON.stringify(map)); corrupt.strategicPlayableSettlementState.satelliteRows[0].transportAllocation.fuelKm++;
  expect(() => SettlementState.validateStrategicPlayableSettlementState(corrupt)).toThrow();
});
