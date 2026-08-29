// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const StrategicWorld = require('../strategic-world');
const CrisisHistory = require('../strategic-crisis-history');
const CapabilityHistory = require('../strategic-capability-history');

let cachedWorld;
function generatedWorld() {
  if (!cachedWorld) cachedWorld = Library.createWorld({ id: 'crisis-history-world', worldSeed: 'world-seed-one', worldTheme: 'unbound', createdAt: 'test' });
  return cachedWorld;
}

test('crisis history is deterministic, bounded, causal, and preserves source ecology', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const source = JSON.parse(JSON.stringify(map));
  delete source.strategicCrisisHistory;
  delete source.publicCrisisHistoryDirectory;
  const regenerated = CrisisHistory.createStrategicCrisisHistory('world-seed-one', StrategicWorld.finalizeStrategicMap(source));
  const record = map.strategicCrisisHistory;

  expect(regenerated.strategicCrisisHistory).toEqual(record);
  expect(record.sourcePristineEcologyDigest).toBe(map.pristineBeastEcology.digest);
  expect(record.sourceBeastEcologyDigest).toBe(map.beastEcology.digest);
  expect(record.eventRows.length).toBeGreaterThan(0);
  expect(record.eventRows.length).toBeLessThanOrEqual(18);
  expect(record.eventRows.every((event) => event.prerequisites.length && event.exactCellPath.length && event.exactFactors && event.stateDelta.ecologyDelta)).toBe(true);
  expect(CrisisHistory.auditStrategicCrisisHistory(map)).toMatchObject({ valid: true, pristineEcologyImmutable: true, everyEventCausalAndConsequential: true, quietWorldsAllowed: true });
});

test('temporary coalitions use real city capabilities and dissolve without creating a state', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const record = map.strategicCrisisHistory;

  expect(record.coalitionRows.length).toBeGreaterThan(0);
  for (const coalition of record.coalitionRows) {
    expect(coalition).toMatchObject({ motive: 'sharedImmediateEcologicalThreat', warningProtocol: 'sharedMonsterWaveWarningProtocol', standingForceAfterDissolution: false, permanentAlliance: false, createsSovereignty: false, dissolutionReason: 'specificCrisisEnded' });
    expect(coalition.dissolutionYear).toBeGreaterThanOrEqual(coalition.formationYear);
    expect(coalition.memberCityIds.length).toBeGreaterThanOrEqual(2);
    for (const member of coalition.contributionRows) for (const contribution of member.contributionRows) {
      if (contribution.capabilityId) expect(CapabilityHistory.cityHasCapability(map, member.cityId, contribution.capabilityId)).toBe(true);
    }
  }
  expect(CrisisHistory.auditStrategicCrisisHistory(map)).toMatchObject({ coalitionsTemporaryAndNonSovereign: true, contributionsCapabilityBacked: true });
});

test('infrastructure loss produces chronological physical support components without rewriting construction history', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const record = map.strategicCrisisHistory;
  const severed = new Set(record.routeConditionRows.filter((row) => row.state === 'severed').map((row) => row.corridorId));

  expect(severed.size).toBeGreaterThan(0);
  expect(map.cityExpansionHistory.corridorRows.length).toBe(map.routeGraph.routes.length);
  expect(record.postCrisisSupportComponents.every((component) => component.physicallyConnected && !component.politicalUnity && component.corridorIds.every((id) => !severed.has(id)))).toBe(true);
  expect(record.supportComponentSnapshots.every((snapshot) => snapshot.components.every((component) => component.physicallyConnected && !component.politicalUnity))).toBe(true);
  expect(CrisisHistory.auditStrategicCrisisHistory(map).routeSplitsArePhysicalOnly).toBe(true);
});

test('public crisis records expose consequences and uncertainty without exact paths, populations, readiness, or force totals', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const publicHistory = CrisisHistory.publicCrisisHistory(map);
  const publicJson = JSON.stringify(publicHistory);

  expect(publicHistory.chronology.length).toBe(map.strategicCrisisHistory.eventRows.length);
  expect(publicHistory.chronology.every((event) => event.species && event.threatenedCities.length && !event.exactPathPublic && !event.exactPopulationPublic && event.hiddenReadinessAcknowledged)).toBe(true);
  expect(publicHistory.principles).toMatchObject({ physicalConnectivityIsNotAlliance: true, coalitionsAreEventSpecific: true, everyCityRemainsAttackable: true, orbitalInternetSurvivesRegionalCrises: true });
  expect(publicJson).not.toMatch(/sourcePopulationId|exactCellPath|exactFactors|commitmentPoints|populationIndexDeltaPermille|startingPopulationIndex|resultingPopulationIndex|localReadinessPower|assaultPower|defensePower/);
  expect(CrisisHistory.auditStrategicCrisisHistory(map).publicHistoryHidesExactCausality).toBe(true);
});

test('world save-load preserves canonical and public crisis history', () => {
  const world = generatedWorld();
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(normalized.generatedData.strategicMap.strategicCrisisHistory).toEqual(world.generatedData.strategicMap.strategicCrisisHistory);
  expect(normalized.generatedData.strategicMap.publicCrisisHistoryDirectory).toEqual(world.generatedData.strategicMap.publicCrisisHistoryDirectory);
});
