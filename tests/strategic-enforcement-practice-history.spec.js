// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const StrategicWorld = require('../strategic-world');
const EnforcementHistory = require('../strategic-enforcement-practice-history');

let cachedWorld;
function generatedWorld() {
  cachedWorld ||= Library.createWorld({ id: 'enforcement-practice-history-world', worldSeed: 'world-seed-one', worldTheme: 'unbound', createdAt: 'test' });
  return cachedWorld;
}

test('enforcement practice and justice throughput are deterministic, bounded, and institution-specific', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const source = JSON.parse(JSON.stringify(map));
  delete source.strategicEnforcementPracticeHistory;
  delete source.publicEnforcementPracticeDirectory;
  const regenerated = EnforcementHistory.createStrategicEnforcementPracticeHistory('world-seed-one', StrategicWorld.finalizeStrategicMap(source));
  const record = map.strategicEnforcementPracticeHistory;

  expect(regenerated.strategicEnforcementPracticeHistory).toEqual(record);
  expect(record.practiceRows).toHaveLength(map.humanGeography.cities.length * 21);
  expect(record.pipelineRows).toHaveLength(map.humanGeography.cities.length * 6);
  expect(record.pipelineRows.every((row) => !row.caseCountGenerated && !row.crimeTotalGenerated && !row.convictionRateGenerated && !row.individualCasesSimulated)).toBe(true);
  for (const government of map.cityGovernments.governments) {
    const rows = record.pipelineRows.filter((row) => row.cityId === government.cityId);
    expect(rows.map((row) => row.stageId)).toEqual(EnforcementHistory.PIPELINE_STAGES.map((stage) => stage.id));
    expect(rows.find((row) => row.stageId === 'temporaryJail').responsibleInstitutionId).toBe(government.roleAssignments.temporaryJailAuthority);
    expect(rows.find((row) => row.stageId === 'longTermCorrections').responsibleInstitutionId).toBe(government.roleAssignments.longTermCorrectionsAuthority);
    expect(government.roleAssignments.temporaryJailAuthority).not.toBe(government.roleAssignments.longTermCorrectionsAuthority);
  }
});

test('destroyed jurisdictions suspend throughput and public records preserve proof while redacting hidden practice', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const record = map.strategicEnforcementPracticeHistory;
  const directory = map.publicEnforcementPracticeDirectory;
  const destroyedCityIds = new Set(map.strategicPlayableSettlementState.cityRows.filter((city) => !city.physicalJurisdictionExists).map((city) => city.cityId));
  const publicJson = JSON.stringify(directory);

  expect(record.pipelineRows.filter((row) => destroyedCityIds.has(row.cityId)).every((row) => row.operationalState === 'suspended' && row.backlogBand === 'suspended' && row.delayBand === 'suspended')).toBe(true);
  expect(record.practiceRows.every((row) => row.proofStandard === 'beyondReasonableDoubt' && row.chargeElementsMustBeProvenSeparately && !row.reportingChangesTruthOrEvidence && !row.establishesGuilt && !row.directiveConvictionAuthority)).toBe(true);
  expect(record.eventRows.every((event) => event.sourceEventId && event.prerequisites.length && event.cause && event.stateDeltas.length && !event.establishesGuilt && !event.convictionAuthority)).toBe(true);
  expect(directory.chronology.every((event) => event.evidence.length && !event.establishesGuilt && !event.convictionAuthority)).toBe(true);
  expect(directory.practiceRows.flatMap((row) => row.activeDirectives).every((directive) => directive.scope && directive.expiresYear && !directive.convictionAuthority)).toBe(true);
  expect(publicJson).not.toMatch(/actualPriority|resourceCommitment|selectiveTolerance|hiddenInterference|exactWorkloadIndex|exactFactors|sourceEventId|covertInterference/);
});

test('world save-load preserves canonical and public enforcement-practice history', () => {
  const world = generatedWorld();
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(normalized.generatedData.strategicMap.strategicEnforcementPracticeHistory).toEqual(world.generatedData.strategicMap.strategicEnforcementPracticeHistory);
  expect(normalized.generatedData.strategicMap.publicEnforcementPracticeDirectory).toEqual(world.generatedData.strategicMap.publicEnforcementPracticeDirectory);
});
