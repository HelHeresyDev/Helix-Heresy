// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const StrategicWorld = require('../strategic-world');
const CityLaws = require('../strategic-city-laws');
const PublicAttitudes = require('../strategic-public-attitude-history');

let cachedWorld;
function generatedWorld() {
  cachedWorld ||= Library.createWorld({ id: 'public-attitude-world', worldSeed: 'world-seed-one', worldTheme: 'unbound', createdAt: 'test' });
  return cachedWorld;
}

test('public-attitude history is deterministic, bounded, and sourced from retained history', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const source = JSON.parse(JSON.stringify(map));
  delete source.strategicPublicAttitudeHistory;
  delete source.publicAttitudeHistoryDirectory;
  const regenerated = PublicAttitudes.createStrategicPublicAttitudeHistory('world-seed-one', StrategicWorld.finalizeStrategicMap(source));
  const record = map.strategicPublicAttitudeHistory;
  const sourceIds = new Set([
    ...map.strategicCrisisHistory.eventRows,
    ...map.strategicPoliticalHistory.eventRows,
    ...map.strategicCivicHistory.eventRows,
    ...map.strategicLegalHistory.amendmentRows,
    ...map.strategicLegalHistory.directiveRows,
  ].map((event) => event.id));

  expect(regenerated.strategicPublicAttitudeHistory).toEqual(record);
  expect(record.eventRows.length).toBeGreaterThan(0);
  expect(record.eventRows.every((event) => sourceIds.has(event.sourceEventId) && event.stateDeltas.length && event.aggregatePressureNotPopulationConsensus)).toBe(true);
  expect(PublicAttitudes.auditStrategicPublicAttitudeHistory(map)).toMatchObject({ valid: true, everyShiftCausallySourced: true, aggregatePressureNeverConsensus: true });
});

test('every city and offense receives five independent qualitative pressure channels', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const rows = map.strategicPublicAttitudeHistory.currentProfileRows;
  const expectedCount = map.humanGeography.cities.length * CityLaws.OFFENSE_CATALOG.length;

  expect(rows).toHaveLength(expectedCount);
  expect(new Set(rows.map((row) => `${row.cityId}:${row.offenseId}`)).size).toBe(expectedCount);
  expect(rows.every((row) => PublicAttitudes.PRESSURE_CHANNELS.every((channel) => PublicAttitudes.PRESSURE_BANDS.includes(row.pressures[channel])))).toBe(true);
  const cityId = map.humanGeography.cities[0].id;
  expect(PublicAttitudes.currentPublicAttitudeProfile(map, cityId, 'prohibitedResearch')).toMatchObject({ cityId, offenseId: 'geneticEngineering', aggregatePressureNotPopulationConsensus: true, changesRecognizedLaw: false, establishesGuilt: false });
});

test('attitude shifts never change law, guilt, evidence, offense elements, or sentencing boundaries', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const foundingDigest = map.cityLegalCodes.digest;
  const legalHistoryDigest = map.strategicLegalHistory.digest;
  const audit = PublicAttitudes.auditStrategicPublicAttitudeHistory(map);

  expect(map.strategicPublicAttitudeHistory.sourceCityLegalCodesDigest).toBe(foundingDigest);
  expect(map.strategicPublicAttitudeHistory.sourceLegalHistoryDigest).toBe(legalHistoryDigest);
  expect(map.strategicPublicAttitudeHistory.eventRows.every((event) => !event.changesRecognizedLaw && !event.establishesGuilt && !event.changesEvidenceReliability && !event.changesOffenseElements)).toBe(true);
  expect(audit.attitudesNeverChangeLawOrGuilt).toBe(true);
});

test('public projections expose coarse uncertain pressures while hiding exact causes', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const history = PublicAttitudes.publicAttitudeHistory(map);
  const json = JSON.stringify(history);

  expect(history.currentProfileRows).toHaveLength(map.strategicPublicAttitudeHistory.currentProfileRows.length);
  expect(history.chronology).toHaveLength(map.strategicPublicAttitudeHistory.eventRows.length);
  expect(history.currentProfileRows.every((row) => row.city && row.offense && row.uncertaintyAcknowledged && row.aggregatePressureNotPopulationConsensus)).toBe(true);
  expect(history.chronology.every((event) => event.city && event.affectedOffenses.length && event.uncertaintyAcknowledged && !event.changesRecognizedLaw && !event.establishesGuilt)).toBe(true);
  expect(json).not.toMatch(/exactFactors|discoverableHooks|sourceEventId|sourceLayer|retainedBySeed|channelShifts/);
  expect(PublicAttitudes.auditStrategicPublicAttitudeHistory(map)).toMatchObject({ publicDirectoryAcknowledgesUncertainty: true, publicDirectoryHidesExactFactors: true });
});

test('world save-load preserves canonical and public attitude history', () => {
  const world = generatedWorld();
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(normalized.generatedData.strategicMap.strategicPublicAttitudeHistory).toEqual(world.generatedData.strategicMap.strategicPublicAttitudeHistory);
  expect(normalized.generatedData.strategicMap.publicAttitudeHistoryDirectory).toEqual(world.generatedData.strategicMap.publicAttitudeHistoryDirectory);
});
