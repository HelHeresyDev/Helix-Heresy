// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const StrategicWorld = require('../strategic-world');
const CivicHistory = require('../strategic-civic-history');

let cachedWorld;
function generatedWorld() {
  cachedWorld ||= Library.createWorld({ id: 'civic-history-world', worldSeed: 'world-seed-one', worldTheme: 'unbound', createdAt: 'test' });
  return cachedWorld;
}

test('civic institutional history is deterministic, bounded, and sourced only from retained crisis or political events', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const source = JSON.parse(JSON.stringify(map));
  delete source.strategicCivicHistory;
  delete source.publicCivicHistoryDirectory;
  const regenerated = CivicHistory.createStrategicCivicHistory('world-seed-one', StrategicWorld.finalizeStrategicMap(source));
  const record = map.strategicCivicHistory;
  const sourceEventIds = new Set([...map.strategicCrisisHistory.eventRows, ...map.strategicPoliticalHistory.eventRows].map((event) => event.id));

  expect(regenerated.strategicCivicHistory).toEqual(record);
  expect(record.sourceCityGovernmentsDigest).toBe(map.cityGovernments.digest);
  expect(record.eventRows.length).toBeGreaterThan(0);
  expect(record.eventRows.length).toBeLessThanOrEqual(map.strategicCrisisHistory.eventRows.length * 3 + map.strategicPoliticalHistory.eventRows.length * 2);
  expect(record.eventRows.every((event) => sourceEventIds.has(event.sourceEventId) && event.prerequisites.includes(event.sourceEventId) && event.stateDeltas.length && event.charterIdentityPreserved && !event.createsSovereignty && !event.createsJurisdiction)).toBe(true);
  expect(CivicHistory.auditStrategicCivicHistory(map)).toMatchObject({ valid: true, baselineGovernmentsImmutable: true, everyEventCausallySourced: true });
});

test('every charter institution survives exactly once with distinct jail and prison authorities', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const record = map.strategicCivicHistory;
  const sourceInstitutions = map.cityGovernments.governments.flatMap((government) => government.institutions);

  expect(record.baselineInstitutionRows).toHaveLength(sourceInstitutions.length);
  expect(record.currentInstitutionRows).toHaveLength(sourceInstitutions.length);
  expect(new Set(record.currentInstitutionRows.map((row) => row.institutionId)).size).toBe(sourceInstitutions.length);
  expect(record.currentInstitutionRows.every((row) => row.charterIdentityPreserved && !row.jurisdictionCreated)).toBe(true);
  for (const government of map.cityGovernments.governments) {
    expect(government.roleAssignments.temporaryJailAuthority).not.toBe(government.roleAssignments.longTermCorrectionsAuthority);
    expect(record.currentInstitutionRows.some((row) => row.institutionId === government.roleAssignments.temporaryJailAuthority)).toBe(true);
    expect(record.currentInstitutionRows.some((row) => row.institutionId === government.roleAssignments.longTermCorrectionsAuthority)).toBe(true);
  }
});

test('occupation directs only selected institutions while tribute creates no foreign authority', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const record = map.strategicCivicHistory;
  const occupied = map.strategicPoliticalHistory.currentControlRows.filter((row) => row.controlStatus === 'occupied');
  const tributaries = map.strategicPoliticalHistory.currentControlRows.filter((row) => row.controlStatus === 'tributary');

  expect(occupied.length).toBeGreaterThan(0);
  expect(tributaries.length).toBeGreaterThan(0);
  for (const control of occupied) {
    const institutions = record.currentInstitutionRows.filter((row) => row.cityId === control.cityId);
    expect(institutions.some((row) => row.actualControlStatus === 'overtOccupation' && row.actualControllerPolityId === control.effectiveControllerPolityId)).toBe(true);
    expect(institutions.some((row) => row.actualControlStatus === 'localCharter' && row.actualControllerPolityId === row.polityId)).toBe(true);
  }
  for (const control of tributaries) expect(record.currentInstitutionRows.filter((row) => row.cityId === control.cityId).every((row) => row.actualControllerPolityId === row.polityId)).toBe(true);
  expect(CivicHistory.auditStrategicCivicHistory(map)).toMatchObject({ occupationIsInstitutionSpecific: true, tributeCreatesNoAuthority: true });
});

test('public institutional history exposes current conditions without capture state or exact operational factors', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const history = CivicHistory.publicCivicInstitutionalHistory(map);
  const publicJson = JSON.stringify(history);

  expect(history.currentInstitutionRows).toHaveLength(map.strategicCivicHistory.currentInstitutionRows.length);
  expect(history.chronology).toHaveLength(map.strategicCivicHistory.eventRows.length);
  expect(history.currentInstitutionRows.every((row) => row.city && row.polity && row.charterIdentityPreserved && !row.jurisdictionCreated)).toBe(true);
  expect(publicJson).not.toMatch(/exactFactors|actualControlStatus|actualControllerPolityId|captureState|foreignSponsorControl|institutionalCapture|capacityShift|independenceShift/);
  expect(history.chronology.filter((event) => event.kind === 'appointmentReorganization').every((event) => event.participantActorIds.every((actorId) => map.strategicPoliticalHistory.actorRows.find((actor) => actor.id === actorId)?.cityId === event.cityId))).toBe(true);
  expect(CivicHistory.auditStrategicCivicHistory(map).publicHistoryHidesCaptureAndExactFactors).toBe(true);
});

test('world save-load preserves canonical and public civic institutional history', () => {
  const world = generatedWorld();
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(normalized.generatedData.strategicMap.strategicCivicHistory).toEqual(world.generatedData.strategicMap.strategicCivicHistory);
  expect(normalized.generatedData.strategicMap.publicCivicHistoryDirectory).toEqual(world.generatedData.strategicMap.publicCivicHistoryDirectory);
});
