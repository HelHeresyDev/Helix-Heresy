// @ts-check
const { test, expect } = require('@playwright/test');
const Library = require('../world-run-library');
const PreUrbanHumanity = require('../strategic-pre-urban-humanity');

function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    clear() { values.clear(); },
  };
}

test('large world and run records use transparent compressed storage while plain JSON remains readable', () => {
  const storage = memoryStorage();
  const repository = Library.createRepository(storage);
  const world = Library.createWorld({ id: 'compressed-world', worldSeed: 'world-seed-one', worldTheme: 'unbound', createdAt: 'test' });
  repository.putWorld(world);

  const storedWorld = storage.getItem(`${Library.WORLD_KEY_PREFIX}${world.id}`);
  expect(storedWorld.startsWith('lz16:')).toBe(true);
  expect(storedWorld.length).toBeLessThan(JSON.stringify(world).length / 4);
  expect(repository.getWorld(world.id)).toEqual(world);
  expect(Library.decompressStorageText(Library.compressStorageText('magic, machinery, and 🛰️ relays'))).toBe('magic, machinery, and 🛰️ relays');

  const plainStorage = memoryStorage();
  plainStorage.setItem(Library.MANIFEST_KEY, JSON.stringify({ version: 2, worldIds: [world.id], runIds: [] }));
  plainStorage.setItem(`${Library.WORLD_KEY_PREFIX}${world.id}`, JSON.stringify(world));
  expect(Library.createRepository(plainStorage).getWorld(world.id)).toEqual(world);
});

test('world names, years, and canonical digests are deterministic and stable', () => {
  const first = Library.createWorld({
    id: 'world-one',
    worldSeed: 'reusable-seed',
    worldTheme: 'grim',
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const same = Library.createWorld({
    id: 'another-library-id',
    worldSeed: 'reusable-seed',
    worldTheme: 'grim',
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const different = Library.createWorld({
    id: 'world-two',
    worldSeed: 'different-seed',
    worldTheme: 'grim',
    createdAt: '2026-08-25T00:00:00.000Z',
  });

  expect(first.name).toBe(same.name);
  expect(first.playableYear).toBe(same.playableYear);
  expect(first.canonicalDigest).toBe(same.canonicalDigest);
  expect(first.name).not.toBe(different.name);
  expect(Library.normalizeWorld(JSON.parse(JSON.stringify(first)))).toEqual(first);
  expect(first).toMatchObject({
    generationVersion: 9,
    nameGeneratorVersion: 2,
    worldTheme: 'grim',
    creationSettings: {
      worldTheme: 'grim',
      scale: 'planetary-prototype',
      strategicMap: { refinementLevel: 5, radiusKm: 3000, landFraction: 0.38 },
      relief: { plateCount: 28 },
      environment: { climate: { axialTiltMinimumDeg: 18, axialTiltMaximumDeg: 28 } },
      geology: { provinceCellTarget: 72 },
      arcaneGeography: { fieldWaveCount: 5, leyCellFraction: 0.065 },
      humanGeography: { cityCellsPerCity: 125, minimumCityCount: 18, maximumCityCount: 44, minimumCitySpacingKm: 340 },
    },
    generatedData: {
      strategicResolution: 'geodesic-globe-city-polities',
      strategicMap: {
        topology: { cellCount: 10242, hexagonCount: 10230, pentagonCount: 12 },
        relief: { settings: { plateCount: 28 } },
        climate: { settings: { axialTiltMinimumDeg: 18, axialTiltMaximumDeg: 28 } },
        hydrology: { diagnostics: { watershedCount: expect.any(Number), lakeCount: expect.any(Number) } },
        biomes: { diagnostics: { representedBiomeCount: expect.any(Number) } },
        geology: { diagnostics: { provinceCount: expect.any(Number), representedBedrockClassCount: 7 } },
        naturalHazards: { diagnostics: { highHazardCellCount: expect.any(Number) } },
        arcaneGeography: { diagnostics: { leyCellCount: expect.any(Number), representedPrimaryAspectCount: 8 } },
        magicalHazards: { diagnostics: { highHazardCellCount: expect.any(Number) } },
        resourcePotential: { diagnostics: { representedFamilyCount: 12 } },
        publicResourceProspects: { diagnostics: { representedDominantProspectCount: 12 } },
        strategicDivinity: { diagnostics: { godCount: expect.any(Number), livingGodCount: expect.any(Number), descendedGodCount: 0, deadGodCount: 0 } },
        humanReligiousKnowledge: { knownGodRows: expect.any(Array), practiceEvidenceRows: expect.any(Array), hiddenGodId: expect.any(String) },
        publicDivinityDirectory: { knowledgePolicy: 'omitUnsupportedIdentitiesAndTotals', godStateRows: expect.any(Array), knownPracticeRows: expect.any(Array) },
        preCivicFaiths: { diagnostics: { faithCount: expect.any(Number), activelyConfirmedFaithCount: expect.any(Number), holySiteCount: expect.any(Number) } },
        publicPreCivicFaithDirectory: { faithRows: expect.any(Array), holySiteRows: expect.any(Array) },
        civilizationOrigins: { firstCityId: expect.any(String), eraEndYear: expect.any(Number), diagnostics: { successfulOriginCityCount: expect.any(Number), retainedFailureCount: expect.any(Number) } },
        publicCivilizationOrigins: { chronology: expect.any(Array), infrastructureState: 'independentOriginComponentsWithoutIntercityCorridorsOrStrongholds' },
        cityExpansionHistory: { historicalHorizonYear: first.playableYear, diagnostics: { laterCityCount: expect.any(Number), lineageCorridorCount: expect.any(Number), currentSupportComponentCount: expect.any(Number) } },
        publicCityExpansionDirectory: { chronology: expect.any(Array), currentSupportComponents: expect.any(Array) },
        strategicCapabilityHistory: { diagnostics: { eraCount: 6, capabilityCount: 12, infrastructureSiteCount: expect.any(Number), rocketLaunchSiteCount: expect.any(Number) } },
        publicCapabilityHistory: { eras: expect.any(Array), milestoneRows: expect.any(Array), failureRows: expect.any(Array), cityProfileRows: expect.any(Array), currentBaseline: expect.any(Object) },
        pristineBeastEcology: { diagnostics: { speciesCount: 24, populationCount: expect.any(Number), humanPressureFactCount: 0, cityTargetedWaveCount: 0 } },
        preUrbanHumanity: { diagnostics: { peopleCount: expect.any(Number), populationGroupCount: expect.any(Number), cityCount: 0 } },
        humanGeography: { diagnostics: { cityCount: expect.any(Number), corridorCount: expect.any(Number), redundantCorridorCount: expect.any(Number) } },
        cityPolities: { diagnostics: { polityCount: expect.any(Number), corridorRelationCount: expect.any(Number), notableInternetRelationCount: expect.any(Number) } },
        beastEcology: { diagnostics: { speciesCount: 24, populationCount: expect.any(Number), migrationCount: expect.any(Number), attackableCityCount: expect.any(Number), waveProfileCount: expect.any(Number) } },
        publicBeastAtlas: { diagnostics: { reportCount: expect.any(Number), migrationReportCount: expect.any(Number), waveWarningCount: expect.any(Number), knownLairCount: expect.any(Number) } },
        cityGovernments: { diagnostics: { governmentCount: expect.any(Number), institutionCount: expect.any(Number), distinctJailAndPrisonCount: expect.any(Number), independentCityCount: expect.any(Number) } },
        publicCityGovernmentDirectory: { entries: expect.any(Array) },
        cityLegalCodes: { diagnostics: { codeCount: expect.any(Number), offenseRuleCount: expect.any(Number), geneticEngineeringProhibitedCount: expect.any(Number), lifeImprisonmentCityCount: 0 } },
        publicCityLawDirectory: { entries: expect.any(Array), offenseCatalog: expect.any(Array) },
        crossCityRecognition: { diagnostics: { directedPairCount: expect.any(Number), standingAgreementCount: expect.any(Number), standingExtraditionReviewCount: expect.any(Number) } },
        publicCrossCityRecognitionDirectory: { cityOrder: expect.any(Array), profileRows: expect.any(Array) },
        strategicReligions: { diagnostics: { godCount: expect.any(Number), confirmedDivineFaithCount: expect.any(Number), branchCount: expect.any(Number), holySiteCount: expect.any(Number), avatarCapableGodCount: expect.any(Number) } },
        publicReligionDirectory: { gods: expect.any(Array), traditions: expect.any(Array), standingRows: expect.any(Array), preCivicFaithDirectoryDigest: expect.any(String) },
        strategicNonStateNetworks: { diagnostics: { networkCount: 21, categoryCount: 7, publicBranchCount: expect.any(Number), affiliateCount: 15, covertCellCount: expect.any(Number) } },
        publicNonStateNetworkDirectory: { networkRecords: expect.any(Array), standingRows: expect.any(Array), publicBranchCodes: expect.any(Array), publicRelationCodes: expect.any(Array), affiliateCodes: expect.any(Array), cellFeatures: expect.any(Array) },
        strategicSettlements: { diagnostics: { resourceAnchorCount: expect.any(Number), independentRefugeCount: expect.any(Number), representedExploitationFamilyCount: 12, jointRouteStrongholdCount: expect.any(Number), satelliteSettlementCount: expect.any(Number) } },
        publicSettlementDirectory: { foundationRows: expect.any(Array), strongholdCodes: expect.any(Array), satelliteCodes: expect.any(Array), satelliteRoutePaths: expect.any(Array), cellFeatures: expect.any(Array) },
        strategicDivineHistory: { diagnostics: { initialGodCount: expect.any(Number), currentGodCount: expect.any(Number), activeDivineCount: expect.any(Number), descendedCount: expect.any(Number), deadCount: expect.any(Number), ascendedGodCount: expect.any(Number), retainedEventCount: expect.any(Number) } },
        publicDivineHistoryDirectory: { identityRows: expect.any(Array), currentGodRows: expect.any(Array), eventRows: expect.any(Array), successorRows: expect.any(Array), remainsRows: expect.any(Array), principles: expect.any(Object) },
        strategicCrisisHistory: { diagnostics: { retainedEventCount: expect.any(Number), coalitionCount: expect.any(Number), severedRouteCount: expect.any(Number), finalSupportComponentCount: expect.any(Number) } },
        publicCrisisHistoryDirectory: { chronology: expect.any(Array), coalitionRows: expect.any(Array), routeConditionRows: expect.any(Array), currentSupportComponents: expect.any(Array), principles: expect.any(Object) },
        strategicPoliticalHistory: { diagnostics: { namedActorCount: expect.any(Number), retainedEventCount: expect.any(Number), campaignCount: expect.any(Number), revoltCount: expect.any(Number), temporaryWarCompactCount: expect.any(Number), maximumForeignHoldings: expect.any(Number) } },
        publicPoliticalHistoryDirectory: { chronology: expect.any(Array), currentAuthorityRows: expect.any(Array), currentControlRows: expect.any(Array), warCompactRows: expect.any(Array), principles: expect.any(Object) },
        strategicCivicHistory: { diagnostics: { cityCount: expect.any(Number), institutionCount: expect.any(Number), retainedEventCount: expect.any(Number), strainedOrDisruptedCount: expect.any(Number), overtOccupationInstitutionCount: expect.any(Number), capturedInstitutionCount: expect.any(Number) } },
        publicCivicHistoryDirectory: { chronology: expect.any(Array), currentInstitutionRows: expect.any(Array), principles: expect.any(Object) },
        strategicLegalHistory: { diagnostics: { cityCount: expect.any(Number), amendmentCount: expect.any(Number), offenseStatusAmendmentCount: expect.any(Number), procedureAmendmentCount: expect.any(Number), sentencingPolicyAmendmentCount: expect.any(Number), directiveCount: expect.any(Number), activeDirectiveCount: expect.any(Number), occupationDirectiveCount: expect.any(Number) } },
        publicLegalHistoryDirectory: { amendmentChronology: expect.any(Array), directiveChronology: expect.any(Array), activeDirectives: expect.any(Array), currentCodeRows: expect.any(Array), principles: expect.any(Object) },
        strategicPublicAttitudeHistory: { diagnostics: { cityCount: expect.any(Number), offenseCount: expect.any(Number), profileCount: expect.any(Number), retainedEventCount: expect.any(Number), crisisReactionCount: expect.any(Number), occupationReactionCount: expect.any(Number), legalReactionCount: expect.any(Number) } },
        publicAttitudeHistoryDirectory: { pressureChannels: expect.any(Array), currentProfileRows: expect.any(Array), chronology: expect.any(Array), principles: expect.any(Object) },
        strategicPlayableSettlementState: { diagnostics: { cityCount: expect.any(Number), viableCityCount: expect.any(Number), ruinedCityCount: expect.any(Number), strongholdCount: expect.any(Number), satelliteCount: expect.any(Number), closedRouteCount: expect.any(Number), supportComponentCount: expect.any(Number), recoveryEventCount: expect.any(Number), displacementCount: expect.any(Number), totalCurrentSettlementPopulation: expect.any(Number) } },
        publicPlayableSettlementDirectory: { cityRows: expect.any(Array), strongholdRows: expect.any(Array), satelliteRows: expect.any(Array), routeRows: expect.any(Array), currentSupportComponents: expect.any(Array), recoveryChronology: expect.any(Array), principles: expect.any(Object) },
        strategicReligiousInstitutionHistory: { diagnostics: { branchCount: expect.any(Number), foundingBaselineBranchCount: expect.any(Number), laterBranchCount: expect.any(Number), successorInstitutionCount: expect.any(Number), retainedEventCount: expect.any(Number), publicEventCount: expect.any(Number), displacedOrDestroyedCount: expect.any(Number), censuredOrEstrangedCount: expect.any(Number), survivingCityStandingCount: expect.any(Number), holySiteCustodyCount: expect.any(Number) } },
        publicReligiousInstitutionHistoryDirectory: { traditionRows: expect.any(Array), currentBranchRows: expect.any(Array), cityStandingRows: expect.any(Array), chronology: expect.any(Array), holySiteCustodyRows: expect.any(Array), cellFeatures: expect.any(Array), principles: expect.any(Object) },
        strategicNonStateNetworkHistory: { diagnostics: { networkCount: 21, activeNetworkCount: expect.any(Number), diminishedNetworkCount: expect.any(Number), dormantNetworkCount: expect.any(Number), defunctNetworkCount: expect.any(Number), publicBranchCount: expect.any(Number), viablePublicBranchCount: expect.any(Number), covertCellCount: expect.any(Number), affiliateCount: 15, retainedEventCount: expect.any(Number), publicEventCount: expect.any(Number), relocatedOrConsolidatedCount: expect.any(Number) } },
        publicNonStateNetworkHistoryDirectory: { networkRows: expect.any(Array), currentBranchRows: expect.any(Array), cityStandingRows: expect.any(Array), affiliateRows: expect.any(Array), relationshipRows: expect.any(Array), chronology: expect.any(Array), cellFeatures: expect.any(Array), principles: expect.any(Object) },
        strategicEnforcementPracticeHistory: { diagnostics: { cityCount: expect.any(Number), offenseCount: 21, practiceRowCount: expect.any(Number), pipelineStageCount: expect.any(Number), retainedEventCount: expect.any(Number), publicEventCount: expect.any(Number), suspendedStageCount: expect.any(Number), interferenceEventCount: expect.any(Number) } },
        publicEnforcementPracticeDirectory: { practiceRows: expect.any(Array), pipelineRows: expect.any(Array), chronology: expect.any(Array), principles: expect.any(Object) },
        routeGraph: { version: 1, nodes: expect.any(Array), routes: expect.any(Array) },
      },
      themeContent: {
        version: 2,
        worldName: { sourceTheme: 'grim' },
        worldSummary: { sourceTheme: 'grim' },
      },
    },
  });
});

test('Unbound worlds consume both authored theme pools while legacy names remain stable', () => {
  const sourceThemes = new Set();
  for (let index = 0; index < 100; index += 1) {
    const world = Library.createWorld({
      id: `unbound-${index}`,
      worldSeed: `unbound-world-${index}`,
      worldTheme: 'unbound',
      generationVersion: 1,
      createdAt: '2026-08-25T00:00:00.000Z',
    });
    expect(world.worldTheme).toBe('unbound');
    sourceThemes.add(world.generatedData.themeContent.worldName.sourceTheme);
    sourceThemes.add(world.generatedData.themeContent.worldSummary.sourceTheme);
  }
  expect(sourceThemes).toEqual(new Set(['madcap', 'grim']));

  const legacy = Library.createWorld({
    id: 'legacy-world',
    worldSeed: 'legacy-name-seed',
    worldTheme: 'grim',
    generationVersion: 1,
    nameGeneratorVersion: 1,
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  expect(legacy.name).toBe(Library.generatedWorldName('legacy-name-seed', 1));
  expect(legacy.generatedData.strategicMap).toBeUndefined();
  expect(Library.normalizeWorld(legacy)).toEqual(legacy);
});

test('natural strategic geography ignores World Theme while generated civilization history honors it', () => {
  const worlds = ['madcap', 'grim', 'unbound'].map((worldTheme) => Library.createWorld({
    id: `same-planet-${worldTheme}`,
    worldSeed: 'same-physical-world',
    worldTheme,
    createdAt: '2026-08-25T00:00:00.000Z',
  }));
  const physicalMaps = worlds.map((world) => {
    const map = JSON.parse(JSON.stringify(world.generatedData.strategicMap));
    delete map.cityPolities;
    delete map.beastEcology;
    delete map.publicBeastAtlas;
    delete map.cityGovernments;
    delete map.publicCityGovernmentDirectory;
    delete map.cityLegalCodes;
    delete map.publicCityLawDirectory;
    delete map.crossCityRecognition;
    delete map.publicCrossCityRecognitionDirectory;
    delete map.strategicReligions;
    delete map.publicReligionDirectory;
    delete map.strategicDivinity;
    delete map.humanReligiousKnowledge;
    delete map.publicDivinityDirectory;
    delete map.preCivicFaiths;
    delete map.publicPreCivicFaithDirectory;
    delete map.civilizationOrigins;
    delete map.publicCivilizationOrigins;
    delete map.cityExpansionHistory;
    delete map.publicCityExpansionDirectory;
    delete map.strategicCapabilityHistory;
    delete map.publicCapabilityHistory;
    delete map.pristineBeastEcology;
    delete map.preUrbanHumanity;
    delete map.publicPreUrbanOverview;
    delete map.strategicNonStateNetworks;
    delete map.publicNonStateNetworkDirectory;
    delete map.strategicSettlements;
    delete map.publicSettlementDirectory;
    delete map.strategicDivineHistory;
    delete map.publicDivineHistoryDirectory;
    delete map.strategicCrisisHistory;
    delete map.publicCrisisHistoryDirectory;
    delete map.strategicPoliticalHistory;
    delete map.publicPoliticalHistoryDirectory;
    delete map.strategicCivicHistory;
    delete map.publicCivicHistoryDirectory;
    delete map.strategicLegalHistory;
    delete map.publicLegalHistoryDirectory;
    delete map.strategicPublicAttitudeHistory;
    delete map.publicAttitudeHistoryDirectory;
    delete map.strategicPlayableSettlementState;
    delete map.publicPlayableSettlementDirectory;
    delete map.strategicReligiousInstitutionHistory;
    delete map.publicReligiousInstitutionHistoryDirectory;
    delete map.strategicNonStateNetworkHistory;
    delete map.publicNonStateNetworkHistoryDirectory;
    delete map.strategicEnforcementPracticeHistory;
    delete map.publicEnforcementPracticeDirectory;
    delete map.humanGeography;
    map.routeGraph = { version: 1, nodes: [], routes: [] };
    delete map.digest;
    return map;
  });
  expect(physicalMaps[0]).toEqual(physicalMaps[1]);
  expect(physicalMaps[1]).toEqual(physicalMaps[2]);
  expect(worlds[0].generatedData.strategicMap.cityPolities).not.toEqual(worlds[1].generatedData.strategicMap.cityPolities);
  expect(worlds[0].generatedData.strategicMap.civilizationOrigins).not.toEqual(worlds[1].generatedData.strategicMap.civilizationOrigins);
  expect(worlds[0].generatedData.strategicMap.strategicDivineHistory).not.toEqual(worlds[1].generatedData.strategicMap.strategicDivineHistory);
  expect(worlds[0].generatedData.strategicMap.pristineBeastEcology).toEqual(worlds[1].generatedData.strategicMap.pristineBeastEcology);
  expect(worlds[0].generatedData.strategicMap.beastEcology.populations).not.toEqual(worlds[1].generatedData.strategicMap.beastEcology.populations);
  expect(new Set(worlds.map((world) => world.canonicalDigest)).size).toBe(3);
});

test('legacy surface-only worlds do not silently gain relief', () => {
  const world = Library.createWorld({
    id: 'generation-two-world',
    worldSeed: 'generation-two-seed',
    worldTheme: 'madcap',
    generationVersion: 2,
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(world.generatedData.strategicResolution).toBe('geodesic-globe');
  expect(world.generatedData.strategicMap.relief).toBeUndefined();
  expect(normalized).toEqual(world);
});

test('legacy relief worlds do not silently gain climate', () => {
  const world = Library.createWorld({
    id: 'generation-three-world',
    worldSeed: 'generation-three-seed',
    worldTheme: 'madcap',
    generationVersion: 3,
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(world.generatedData.strategicResolution).toBe('geodesic-globe-relief');
  expect(world.generatedData.strategicMap.relief).toBeDefined();
  expect(world.generatedData.strategicMap.climate).toBeUndefined();
  expect(world.generatedData.strategicMap.hydrology).toBeUndefined();
  expect(world.generatedData.strategicMap.biomes).toBeUndefined();
  expect(normalized).toEqual(world);
});

test('legacy environment worlds do not silently gain geology', () => {
  const world = Library.createWorld({
    id: 'generation-four-world',
    worldSeed: 'generation-four-seed',
    worldTheme: 'madcap',
    generationVersion: 4,
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(world.generatedData.strategicResolution).toBe('geodesic-globe-environment');
  expect(world.generatedData.strategicMap.biomes).toBeDefined();
  expect(world.generatedData.strategicMap.geology).toBeUndefined();
  expect(world.generatedData.strategicMap.naturalHazards).toBeUndefined();
  expect(normalized).toEqual(world);
});

test('legacy geology worlds do not silently gain arcane geography', () => {
  const world = Library.createWorld({
    id: 'generation-five-world',
    worldSeed: 'generation-five-seed',
    worldTheme: 'madcap',
    generationVersion: 5,
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(world.generatedData.strategicResolution).toBe('geodesic-globe-geology');
  expect(world.generatedData.strategicMap.geology).toBeDefined();
  expect(world.generatedData.strategicMap.naturalHazards).toBeDefined();
  expect(world.generatedData.strategicMap.arcaneGeography).toBeUndefined();
  expect(world.generatedData.strategicMap.magicalHazards).toBeUndefined();
  expect(normalized).toEqual(world);
});

test('legacy arcane worlds do not silently gain resource potential', () => {
  const world = Library.createWorld({
    id: 'generation-six-world',
    worldSeed: 'generation-six-seed',
    worldTheme: 'madcap',
    generationVersion: 6,
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(world.generatedData.strategicResolution).toBe('geodesic-globe-arcane-geography');
  expect(world.generatedData.strategicMap.arcaneGeography).toBeDefined();
  expect(world.generatedData.strategicMap.magicalHazards).toBeDefined();
  expect(world.generatedData.strategicMap.resourcePotential).toBeUndefined();
  expect(world.generatedData.strategicMap.publicResourceProspects).toBeUndefined();
  expect(normalized).toEqual(world);
});

test('legacy resource worlds do not silently gain human geography', () => {
  const world = Library.createWorld({
    id: 'generation-seven-world',
    worldSeed: 'generation-seven-seed',
    worldTheme: 'madcap',
    generationVersion: 7,
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(world.generatedData.strategicResolution).toBe('geodesic-globe-resource-potential');
  expect(world.generatedData.strategicMap.resourcePotential).toBeDefined();
  expect(world.generatedData.strategicMap.publicResourceProspects).toBeDefined();
  expect(world.generatedData.strategicMap.pristineBeastEcology).toBeDefined();
  expect(world.generatedData.strategicMap.preUrbanHumanity).toBeDefined();
  expect(world.generatedData.strategicMap.humanReligiousKnowledge).toBeDefined();
  expect(world.generatedData.strategicMap.civilizationOrigins).toBeDefined();
  expect(world.generatedData.strategicMap.cityExpansionHistory).toBeDefined();
  expect(world.generatedData.strategicMap.strategicCapabilityHistory).toBeDefined();
  expect(world.generatedData.strategicMap.publicPreUrbanOverview).toBeUndefined();
  expect(PreUrbanHumanity.publicPreUrbanOverview(world.generatedData.strategicMap)).toMatchObject({ peoples: expect.any(Array), groupSummaries: expect.any(Array), beastBaseline: expect.any(Array) });
  expect(world.generatedData.strategicMap.humanGeography).toBeUndefined();
  expect(world.generatedData.strategicMap.routeGraph).toEqual({ version: 1, nodes: [], routes: [] });
  expect(normalized).toEqual(world);
});

test('legacy routed worlds do not silently gain sovereign polities', () => {
  const world = Library.createWorld({
    id: 'generation-eight-world',
    worldSeed: 'generation-eight-seed',
    worldTheme: 'madcap',
    generationVersion: 8,
    createdAt: '2026-08-25T00:00:00.000Z',
  });
  const normalized = Library.normalizeWorld(JSON.parse(JSON.stringify(world)));

  expect(world.generatedData.strategicResolution).toBe('geodesic-globe-fortified-cities');
  expect(world.generatedData.strategicMap.humanGeography).toBeDefined();
  expect(world.generatedData.strategicMap.cityPolities).toBeUndefined();
  expect(normalized).toEqual(world);
});

test('several run records branch independently without modifying their canonical world', () => {
  const storage = memoryStorage();
  const repository = Library.createRepository(storage);
  const world = repository.putWorld(Library.createWorld({
    id: 'shared-world',
    worldSeed: 'shared-world-seed',
    worldTheme: 'madcap',
    createdAt: '2026-08-25T00:00:00.000Z',
  }));
  const canonicalBefore = repository.getWorld(world.id);
  const baseRun = {
    worldId: world.id,
    worldGenerationVersion: world.generationVersion,
    canonicalWorldDigest: world.canonicalDigest,
    scenario: { id: 'chemistryFront' },
    site: { id: 'starting-site:chemistryFront', strategicLocation: null },
  };
  repository.putRun(Library.createRun({
    ...baseRun,
    id: 'run-a',
    runSeed: 'run-seed-a',
    createdAt: '2026-08-25T01:00:00.000Z',
    state: { started: true, clock: 20, company: { legalName: 'Branch A' } },
  }));
  repository.putRun(Library.createRun({
    ...baseRun,
    id: 'run-b',
    runSeed: 'run-seed-b',
    createdAt: '2026-08-25T02:00:00.000Z',
    state: { started: true, clock: 90, company: { legalName: 'Branch B' } },
  }));

  const branchA = repository.getRun('run-a');
  branchA.state.clock = 500;
  branchA.worldState.changes.marketShock = 4;
  repository.putRun(branchA, { overwrite: true });

  expect(repository.listRuns(world.id).map((run) => run.id).sort()).toEqual(['run-a', 'run-b']);
  expect(repository.getRun('run-b').state).toMatchObject({ clock: 90, company: { legalName: 'Branch B' } });
  expect(repository.getRun('run-b').worldState.changes).toEqual({});
  expect(repository.getWorld(world.id)).toEqual(canonicalBefore);
  expect(repository.continuation().id).toBe('run-a');
  expect(() => repository.deleteWorld(world.id)).toThrow(/runs before deleting/i);
});

test('ended runs remain in the library but are not continuations', () => {
  const repository = Library.createRepository(memoryStorage());
  const world = repository.putWorld(Library.createWorld({ id: 'world', worldSeed: 'seed', worldTheme: 'madcap' }));
  const run = Library.createRun({
    id: 'run',
    worldId: world.id,
    worldGenerationVersion: world.generationVersion,
    canonicalWorldDigest: world.canonicalDigest,
    runSeed: 'run-seed',
    state: { started: true, runEnded: false },
  });
  repository.putRun(run);
  repository.putRun(Library.createRun({
    ...run,
    status: 'ended',
    endedAt: '2026-08-25T03:00:00.000Z',
    state: { started: true, runEnded: true },
  }), { overwrite: true, activate: false });

  expect(repository.getRun('run')).toMatchObject({ status: 'ended', endReason: 'death' });
  expect(repository.continuation()).toBeNull();
  expect(repository.manifest().activeRunId).toBeNull();
});

test('state-only test projections retain world and run identity when normalized from storage', () => {
  const state = {
    started: true,
    seed: 'run-seed',
    runEnded: false,
    runIdentity: { runId: 'run-projection', runSeed: 'run-seed' },
    worldReference: { worldId: 'world-projection', generationVersion: 1, canonicalDigest: 'world-digest' },
    startingScenario: { id: 'chemistryFront', blueprintId: 'chemistry-front-site-v3', blueprintVersion: 3 },
  };
  const normalized = Library.normalizeRunStorageRecord('run-projection', {
    version: 1,
    savedAt: '2026-08-25T04:00:00.000Z',
    state,
  });

  expect(normalized).toMatchObject({
    id: 'run-projection',
    worldId: 'world-projection',
    runSeed: 'run-seed',
    canonicalWorldDigest: 'world-digest',
    status: 'active',
    scenario: { id: 'chemistryFront' },
    site: { id: 'starting-site:chemistryFront', selectionStatus: 'deferredWorldPlacement' },
    worldState: { canonicalWorldDigest: 'world-digest', changes: {} },
  });
});
