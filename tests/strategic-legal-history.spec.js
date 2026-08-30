// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const StrategicWorld = require('../strategic-world');
const CityLaws = require('../strategic-city-laws');
const LegalHistory = require('../strategic-legal-history');

let cachedWorld;
function generatedWorld() {
  cachedWorld ||= Library.createWorld({ id: 'legal-history-world', worldSeed: 'world-seed-one', worldTheme: 'unbound', createdAt: 'test' });
  return cachedWorld;
}

test('legal history is deterministic, bounded, and sourced through retained civic events', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const source = JSON.parse(JSON.stringify(map));
  delete source.strategicLegalHistory;
  delete source.publicLegalHistoryDirectory;
  const regenerated = LegalHistory.createStrategicLegalHistory('world-seed-one', StrategicWorld.finalizeStrategicMap(source));
  const record = map.strategicLegalHistory;
  const civicEventIds = new Set(map.strategicCivicHistory.eventRows.map((event) => event.id));

  expect(regenerated.strategicLegalHistory).toEqual(record);
  expect(record.amendmentRows.length).toBeGreaterThan(0);
  expect(record.amendmentRows.length).toBeLessThanOrEqual(map.strategicCivicHistory.eventRows.length);
  expect(record.amendmentRows.every((event) => civicEventIds.has(event.sourceEventId) && event.formalLocalProcessCompleted && event.prospectiveOnly && !event.retroactiveGuiltPermitted)).toBe(true);
  expect(LegalHistory.auditStrategicLegalHistory(map)).toMatchObject({ valid: true, foundingCodesImmutable: true, everyAmendmentCausallySourced: true, amendmentsProspectiveOnly: true });
});

test('playable-year resolver preserves the semantic catalog, proof standard, and punishment boundaries', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const codes = LegalHistory.currentRecognizedCityCodes(map);
  const audit = LegalHistory.auditStrategicLegalHistory(map);

  expect(codes).toHaveLength(map.humanGeography.cities.length);
  expect(codes.every((code) => code.offenseRules.length === CityLaws.OFFENSE_CATALOG.length)).toBe(true);
  expect(codes.every((code) => code.procedure.criminalProofStandard === 'beyondReasonableDoubt' && code.procedure.chargeElementsMustBeProvenSeparately)).toBe(true);
  expect(codes.every((code) => !code.punishmentPolicy.lifeImprisonmentAvailable && code.punishmentPolicy.finitePrisonMaximumMonths >= 36 && code.punishmentPolicy.finitePrisonMaximumMonths <= 120)).toBe(true);
  expect(codes.every((code) => ['prohibited', 'restricted'].includes(code.offenseRules.find((rule) => rule.offenseId === 'animancy').legalStatus))).toBe(true);
  expect(audit).toMatchObject({ offenseCatalogImmutable: true, proofStandardPreserved: true, punishmentInvariantsPreserved: true });
  const city = codes.find((code) => code.legalHistory.amendmentCount > 0);
  expect(LegalHistory.currentRecognizedRuleFor(map, city.city.id, 'prohibitedResearch')).toMatchObject({ offenseId: 'geneticEngineering' });
});

test('temporary directives expire and never become criminal law or independent conviction authority', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const directives = map.strategicLegalHistory.directiveRows;
  const occupied = new Set(map.strategicPoliticalHistory.currentControlRows.filter((row) => row.controlStatus === 'occupied').map((row) => row.cityId));

  expect(directives.length).toBeGreaterThan(0);
  expect(directives.every((entry) => entry.expiresYear > entry.year && !entry.recognizedAsLocalCriminalLaw && !entry.independentConvictionAuthority && !entry.guiltInferencePermitted && entry.localConvictionRequiresPublishedOffenseAndProof)).toBe(true);
  for (const cityId of occupied) expect(directives.some((entry) => entry.cityId === cityId && entry.status === 'active' && entry.authorityBasis === 'overtOccupationDirection')).toBe(true);
  expect(LegalHistory.auditStrategicLegalHistory(map).directivesRemainSeparateAndTemporary).toBe(true);
});

test('public legal history shows recognized changes while redacting covert sponsors and canonical hooks', () => {
  const map = generatedWorld().generatedData.strategicMap;
  const history = LegalHistory.publicLegalHistory(map);
  const json = JSON.stringify(history);

  expect(history.amendmentChronology).toHaveLength(map.strategicLegalHistory.amendmentRows.length);
  expect(history.directiveChronology).toHaveLength(map.strategicLegalHistory.directiveRows.length);
  expect(history.amendmentChronology.every((entry) => entry.city && entry.enactedByInstitution && entry.reviewedByInstitution)).toBe(true);
  expect(history.directiveChronology.every((entry) => entry.city && entry.issuedThroughInstitution && !entry.recognizedAsLocalCriminalLaw && !entry.independentConvictionAuthority)).toBe(true);
  expect(json).not.toMatch(/hiddenSponsorPolityId|discoverableHooks|nominalAuthorityActorIds|retroactiveGuiltPermitted|proofStandardChanged|offenseElementsChanged/);
  expect(LegalHistory.auditStrategicLegalHistory(map).publicHistoryHidesCovertSponsors).toBe(true);
});

test('world save-load preserves canonical and public legal history', () => {
  const world = generatedWorld();
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(normalized.generatedData.strategicMap.strategicLegalHistory).toEqual(world.generatedData.strategicMap.strategicLegalHistory);
  expect(normalized.generatedData.strategicMap.publicLegalHistoryDirectory).toEqual(world.generatedData.strategicMap.publicLegalHistoryDirectory);
});
