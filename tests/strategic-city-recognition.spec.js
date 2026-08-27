// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const Recognition = require('../strategic-city-recognition');
const CityLaws = require('../strategic-city-laws');
const StrategicWorld = require('../strategic-world');

function generatedMap(seed = 'cross-city-recognition') {
  return Library.createWorld({ id: `recognition-${seed}`, worldSeed: seed, worldTheme: 'unbound', createdAt: 'test' }).generatedData.strategicMap;
}

test('every ordered city pair receives a deterministic directional recognition profile', () => {
  const map = generatedMap('directional-matrix');
  const same = generatedMap('directional-matrix');
  const audit = Recognition.auditCrossCityRecognition(map);
  const cityCount = map.humanGeography.cities.length;

  expect(map.crossCityRecognition).toEqual(same.crossCityRecognition);
  expect(map.publicCrossCityRecognitionDirectory).toEqual(same.publicCrossCityRecognitionDirectory);
  expect(audit).toMatchObject({
    valid: true,
    directedPairCount: cityCount * (cityCount - 1),
    everyOrderedCityPairCovered: true,
    recognitionIsDirectional: true,
    standingAgreementsAreSparse: true,
  });
  expect(map.crossCityRecognition.diagnostics.standingAgreementCount).toBeGreaterThan(0);
  expect(map.crossCityRecognition.diagnostics.standingAgreementCount).toBeLessThan(cityCount * (cityCount - 1) / 4);
});

test('public profiles preserve city-only jurisdiction and independent local review', () => {
  const map = generatedMap('jurisdiction-guardrails');
  const [requestingCityId, receivingCityId] = map.publicCrossCityRecognitionDirectory.cityOrder;
  const profile = Recognition.publicProfileFor(map, requestingCityId, receivingCityId);

  expect(profile).toMatchObject({
    direction: 'requestingCityAsksReceivingCity',
    extradition: {
      foreignWarrantSelfExecuting: false,
      receivingCityMustIssueLocalCustodyOrder: true,
      doubleCriminality: { required: true, comparison: 'conductUnderSharedSemanticOffenseElements' },
      guiltDeterminationAtRecognitionStage: false,
      politicalOffenseAutomaticExemption: false,
      deportationCountsAsExtradition: false,
    },
    transitCustody: {
      everyIntermediateCityMustConsent: true,
      transferMustUseControlledFacilityOrConvoy: true,
      internetNoticeCreatesPhysicalAuthority: false,
      wildernessHasOrdinarySovereignJurisdiction: false,
    },
    diplomaticConsequences: { createsSuperiorAuthorityOrPermanentAlliance: false },
  });
  expect(profile?.extradition.refusalReasons).toEqual(expect.arrayContaining(['doubleCriminalityMissing', 'unacceptablePunishmentWithoutBindingAssurance', 'safePhysicalTransferUnavailable']));
});

test('double criminality compares conduct under the shared semantic catalog', () => {
  const map = generatedMap('double-criminality');
  const codes = CityLaws.publicCityLawDirectory(map);
  const criminalized = new Set(Recognition.CRIMINALIZED_STATUSES);
  const requesting = codes.find((code) => criminalized.has(code.offenseRules.find((rule) => rule.offenseId === 'geneticEngineering').legalStatus));
  const receiving = codes.find((code) => !criminalized.has(code.offenseRules.find((rule) => rule.offenseId === 'geneticEngineering').legalStatus));

  expect(requesting).toBeTruthy();
  expect(receiving).toBeTruthy();
  expect(Recognition.doubleCriminalityFor(map, requesting.city.id, receiving.city.id, 'geneticEngineering')).toMatchObject({
    sharedSemanticElements: true,
    satisfiedForUnauthorizedConduct: false,
  });
  expect(Recognition.doubleCriminalityFor(map, requesting.city.id, receiving.city.id, 'homicide')).toMatchObject({
    sharedSemanticElements: true,
    requestingLegalStatus: 'prohibited',
    receivingLegalStatus: 'prohibited',
    satisfiedForUnauthorizedConduct: true,
  });
});

test('extradition evaluation gates local custody without deciding guilt', () => {
  const map = generatedMap('extradition-evaluation');
  const profile = map.publicCrossCityRecognitionDirectory.cityOrder
    .flatMap((requestingCityId) => Recognition.publicProfilesFrom(map, requestingCityId))
    .find((candidate) => candidate.extradition.reviewAccess !== 'ordinarilyRefused' && candidate.transitCustody.routeClass !== 'noKnownSupportedRoute');
  const baseRequest = {
    requestingCityId: profile.requestingCity.id,
    receivingCityId: profile.receivingCity.id,
    offenseId: 'homicide',
    identityVerified: true,
    evidenceSupportsReasonableGrounds: true,
    requestedOutcome: 'finitePrison',
    transferRouteConfirmed: true,
    intermediateTransitPermissionsConfirmed: true,
  };

  expect(Recognition.evaluateExtraditionRequest(map, baseRequest)).toMatchObject({
    disposition: 'eligibleForLocalJudicialReview',
    blockers: [],
    localCustodyOrderStillRequired: true,
    foreignWarrantExecutedDirectly: false,
    guiltDetermination: 'none',
    diplomaticConsequenceClass: 'cooperationOpportunity',
  });
  expect(Recognition.evaluateExtraditionRequest(map, { ...baseRequest, identityVerified: false, transferRouteConfirmed: false })).toMatchObject({
    disposition: 'notEligibleForLocalCustodyOrder',
    blockers: expect.arrayContaining(['identityNotVerified', 'safePhysicalTransferUnavailable']),
    guiltDetermination: 'none',
  });
  expect(Recognition.evaluateExtraditionRequest(map, { ...baseRequest, localChargesPending: true })).toMatchObject({
    disposition: 'deferredBeforeLocalReview',
    deferrals: ['receivingCityProceedingsTakePriority'],
  });
});

test('public projection hides discretion and hidden policy cannot change due process', () => {
  const map = generatedMap('public-hidden-boundary');
  const [requestingCityId, receivingCityId] = map.crossCityRecognition.cityOrder;
  const hidden = Recognition.hiddenCooperationFor(map, requestingCityId, receivingCityId);

  expect(JSON.stringify(map.publicCrossCityRecognitionDirectory)).not.toContain('hiddenRows');
  expect(JSON.stringify(map.publicCrossCityRecognitionDirectory)).not.toContain('discretionaryCooperationPosture');
  expect(hidden).toMatchObject({ mayAlterPublishedLaw: false, mayLowerEvidenceRequirements: false, guiltInferencePermitted: false });
  expect(Recognition.auditCrossCityRecognition(map)).toMatchObject({ publicDirectoryHidesDiscretion: true, hiddenPolicyCannotAlterDueProcess: true });
});

test('validation rejects altered recognition policy and leaked hidden matrices', () => {
  const map = generatedMap('recognition-integrity');
  const altered = JSON.parse(JSON.stringify(map));
  const row = altered.publicCrossCityRecognitionDirectory.profileRows[0];
  altered.publicCrossCityRecognitionDirectory.profileRows[0] = `${row.slice(0, Recognition.PROFILE_CODE_LENGTH)}x${row.slice(Recognition.PROFILE_CODE_LENGTH + 1)}`;
  altered.digest = StrategicWorld.strategicMapDigest(altered);
  expect(() => Recognition.validateCrossCityRecognition(altered)).toThrow(/invalid compact policy/i);

  const leaked = JSON.parse(JSON.stringify(map));
  leaked.publicCrossCityRecognitionDirectory.hiddenRows = leaked.crossCityRecognition.hiddenRows;
  leaked.digest = StrategicWorld.strategicMapDigest(leaked);
  expect(() => Recognition.validateCrossCityRecognition(leaked)).toThrow(/leaks hidden cooperation/i);
});
