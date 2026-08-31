// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const manifestKey = 'helix-heresy-v2-library';
const preferencesKey = 'helix-heresy-v1-preferences';

async function openFreshTitle(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

async function beginRun(page, options = {}) {
  await page.locator('#titleNewRunBtn').click();
  if (options.worldSeed) await page.locator('#setupWorldSeedInput').fill(options.worldSeed);
  if (options.theme) await page.locator(`input[name="setupWorldTheme"][value="${options.theme}"]`).check();
  if (options.runSeed) await page.locator('#seedInput').fill(options.runSeed);
  await page.locator('#startRunSubmitBtn').click();
}

test('@smoke fresh startup generates an explicitly themed world before entering its first run', async ({ page }) => {
  test.setTimeout(300_000);
  await openFreshTitle(page);

  await expect(page.locator('#titleScreen')).toBeVisible();
  await expect(page.locator('#titleScreenHeading')).toHaveText('Helix Heresy');
  await expect(page.locator('#loadLastSaveBtn')).toBeDisabled();
  await expect(page.locator('#loadLastSaveStatus')).toContainText('No active run');
  await expect(page.locator('#setupForm')).toBeHidden();
  await expect(page.locator('#appShell')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#titleNewRunBtn')).toBeFocused();

  await page.locator('#titleNewRunBtn').click();
  await expect(page.locator('#setupForm')).toBeVisible();
  await expect(page.locator('#newWorldSetupFieldset')).toContainText('Choose Your Heresy');
  await expect(page.locator('[data-starting-scenario="chemistryFront"]')).toBeVisible();
  await expect(page.locator('#setupBackBtn')).toBeFocused();
  await page.locator('#setupWorldSeedInput').fill('world-seed-one');
  await page.locator('input[name="setupWorldTheme"][value="unbound"]').check();
  await expect(page.locator('#strategicWorldCanvas')).toBeVisible();
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('10,242 cells', { timeout: 300_000 });
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('12 pentagons');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('28 plates');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('watersheds');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('biomes');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('geological provinces');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('ley nodes');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('resource families');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('pre-urban peoples');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('aggregated human communities');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('agriculture, literacy, metalworking, and established magic before cities');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('pristine beast ecology preserved');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('Year 0 first enduring city');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('disconnected divine origin cities');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('6 magitech eras');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('12 causal capabilities');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('fortified cities');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('strategic intercity corridors');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('sovereign city polities');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('24 static beast species');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('reported population ranges');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('reported migrations');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('wave warnings');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('every city attackable');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('public city charters');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('distinct jail and prison authorities');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('independent city law codes');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('no life imprisonment');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('directional city-pair recognition policies');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('foreign warrants require local orders');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('human-authenticated communicating gods');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('supported pre-civic holy sites');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('population-backed human and beast worship');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('unsupported divine identities omitted');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('21 major non-state networks');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('orbital arcane internet');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('rocket and individual spaceflight');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('resource-anchor cities');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('joint route strongholds');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('dependent satellites');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('retained divine events');
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('active gods');
  await expect(page.locator('#strategicCellId')).toContainText('planet-cell:');
  await expect(page.locator('#strategicCellElevation')).toContainText('m');
  await expect(page.locator('#strategicCellTemperature')).toContainText('°C mean');
  await expect(page.locator('#strategicCellBedrock')).toContainText('million years');
  await expect(page.locator('#strategicCellMana')).toContainText('concentration');
  await expect(page.locator('#strategicCellResourceProspect')).toContainText('prospect');
  await page.locator('#strategicGlobeLayerSelect').selectOption('elevation');
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ layer: 'elevation', hasRelief: true });
  await page.locator('#strategicGlobeLayerSelect').selectOption('tectonics');
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ layer: 'tectonics', hasRelief: true });
  for (const layer of ['temperature', 'precipitation', 'hydrology', 'biomes']) {
    await page.locator('#strategicGlobeLayerSelect').selectOption(layer);
    expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ layer, hasEnvironment: true });
    await expect(page.locator('#strategicGlobeLegend span')).not.toHaveCount(0);
  }
  for (const layer of ['geology', 'hazards']) {
    await page.locator('#strategicGlobeLayerSelect').selectOption(layer);
    expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ layer, hasGeology: true });
    await expect(page.locator('#strategicGlobeLegend span')).not.toHaveCount(0);
  }
  await page.locator('#strategicGlobeLayerSelect').selectOption('arcane');
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ layer: 'arcane', hasArcaneGeography: true });
  await expect(page.locator('#strategicGlobeLegend span')).not.toHaveCount(0);
  await page.locator('#strategicGlobeLayerSelect').selectOption('prospects');
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ layer: 'prospects', hasResourceProspects: true });
  await expect(page.locator('#strategicGlobeLegend span')).not.toHaveCount(0);
  await page.locator('#strategicGlobeLayerSelect').selectOption('humanGeography');
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ layer: 'humanGeography', hasHumanGeography: true });
  await expect(page.locator('#strategicGlobeLegend span')).not.toHaveCount(0);
  await page.locator('#strategicGlobeLayerSelect').selectOption('cityPolities');
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ layer: 'cityPolities', hasCityPolities: true });
  await expect(page.locator('#strategicGlobeLegend')).toContainText('Ungoverned wilderness');
  const cityIndices = await page.evaluate(() => window.helixHeresyDebug.strategicHumanGeographyCityIndices());
  const cityCount = cityIndices.length;
  const firstCityIndex = cityIndices[0];
  await page.evaluate((index) => window.helixHeresyDebug.strategicSelectCell(index), firstCityIndex);
  await expect(page.locator('#strategicCellCity')).toContainText('Fortified city');
  await expect(page.locator('#strategicCellCityConditions')).toContainText('defensive position');
  await expect(page.locator('#strategicCellPolity')).toContainText('independent city polity');
  await expect(page.locator('#strategicCellAuthority')).toContainText('authority');
  await expect(page.locator('#strategicCellCivicProfile')).toContainText('priorities:');
  await expect(page.locator('#strategicCellGovernmentCharter')).toContainText('Emergency powers expire without renewal');
  await expect(page.locator('#strategicCellGovernmentInstitutions')).toContainText('capacity');
  await expect(page.locator('#strategicCellGovernmentJurisdiction')).toContainText('exclusive city jurisdiction');
  await expect(page.locator('#strategicCellLawSummary')).toContainText('Genetic Engineering');
  await expect(page.locator('#strategicCellLawProcedure')).toContainText('beyond reasonable doubt');
  await expect(page.locator('#strategicCellPunishmentPolicy')).toContainText('no life imprisonment');
  await expect(page.locator('#strategicCellEnforcementPractice')).toContainText('declared priority');
  await expect(page.locator('#strategicCellJusticeThroughput')).toContainText('Report intake');
  await expect(page.locator('#strategicCellAttackExposure')).toContainText('attack remains possible without a migration route');
  await expect(page.locator('#strategicCityPolityDirectory')).toBeVisible();
  await expect(page.locator('.strategic-city-polity-card')).not.toHaveCount(0);
  await expect(page.locator('#strategicCityGovernmentDirectory')).toBeVisible();
  await expect(page.locator('.strategic-city-government-card')).toHaveCount(cityCount);
  const governments = await page.evaluate(() => window.helixHeresyDebug.strategicPublicCityGovernmentDirectory());
  expect(governments).toHaveLength(cityCount);
  expect(JSON.stringify(governments)).not.toContain('hiddenOperationalRisks');
  await expect(page.locator('#strategicCityLawDirectory')).toBeVisible();
  await expect(page.locator('.strategic-city-law-card')).toHaveCount(cityCount);
  const cityLaws = await page.evaluate(() => window.helixHeresyDebug.strategicPublicCityLawDirectory());
  expect(cityLaws).toHaveLength(cityCount);
  expect(JSON.stringify(cityLaws)).not.toContain('hiddenEnforcement');
  await expect(page.locator('#crossCityRecognitionDirectory')).toBeVisible();
  await expect(page.locator('#crossCityRecognitionProfile')).toContainText('double criminality required');
  await expect(page.locator('#crossCityRecognitionProfile')).toContainText('Foreign warrants never self-execute');
  const recognitionCityIds = await page.locator('#recognitionRequestingCitySelect option').evaluateAll((options) => options.map((option) => option.value));
  await page.locator('#recognitionRequestingCitySelect').selectOption(recognitionCityIds[1]);
  await page.locator('#recognitionReceivingCitySelect').selectOption(recognitionCityIds[0]);
  const publicRecognition = await page.evaluate(([requestingCityId, receivingCityId]) => window.helixHeresyDebug.strategicPublicCrossCityRecognitionProfile(requestingCityId, receivingCityId), [recognitionCityIds[1], recognitionCityIds[0]]);
  expect(publicRecognition).toMatchObject({ extradition: { foreignWarrantSelfExecuting: false, receivingCityMustIssueLocalCustodyOrder: true } });
  expect(JSON.stringify(publicRecognition)).not.toContain('discretionaryCooperationPosture');
  await expect(page.locator('#strategicReligionDirectory')).toBeVisible();
  const publicReligions = await page.evaluate(() => window.helixHeresyDebug.strategicPublicReligionDirectory());
  const faithAudit = await page.evaluate(() => window.helixHeresyDebug.strategicPreCivicFaithsAudit());
  const divinityAudit = await page.evaluate(() => window.helixHeresyDebug.strategicPreCivicDivinityAudit());
  const publicDivinity = await page.evaluate(() => window.helixHeresyDebug.strategicPublicDivinityDirectory());
  const publicFaiths = await page.evaluate(() => window.helixHeresyDebug.strategicPublicFaithDirectory());
  const preUrbanAudit = await page.evaluate(() => window.helixHeresyDebug.strategicPreUrbanHumanityAudit());
  const pristineAudit = await page.evaluate(() => window.helixHeresyDebug.strategicPristineBeastEcologyAudit());
  const publicPreUrban = await page.evaluate(() => window.helixHeresyDebug.strategicPublicPreUrbanOverview());
  expect(preUrbanAudit).toMatchObject({ valid: true, generatedBeforeCities: true, allGroupsAgriculturalLiterateMetalworkingAndMagical: true });
  expect(pristineAudit).toMatchObject({ valid: true, generatedBeforeHumansAndCities: true, physicalAndArcaneCausesOnly: true });
  expect(publicPreUrban.groupSummaries.every((summary) => !Object.hasOwn(summary, 'population') && !Object.hasOwn(summary, 'centerCellId'))).toBe(true);
  expect(divinityAudit).toMatchObject({ valid: true, everyCohortPopulationBacked: true, humanDirectoryOmitsUnsupportedGods: true, beastOnlyUnknownGodPreserved: true, publicPracticesHideExactAllocations: true });
  expect(faithAudit).toMatchObject({ valid: true, independentOfCities: true, everyFaithSemantic: true, routineCommunicationNeedsNoSite: true, humanDirectoryOmitsUnsupportedFaithsAndSites: true });
  expect(publicDivinity.knowledgePolicy).toBe('omitUnsupportedIdentitiesAndTotals');
  expect(publicDivinity.knownPractices.every((practice) => practice.exactFollowerCountPublic === false && practice.sourcePopulationIdentityPublic === false)).toBe(true);
  expect(publicFaiths.faiths).toHaveLength(publicReligions.gods.length);
  await expect(page.locator('.strategic-god-card')).toHaveCount(publicReligions.gods.length);
  await page.locator('.strategic-god-card').first().click();
  await expect(page.locator('.strategic-god-card').first()).toContainText('Core tenets:');
  await expect(page.locator('.strategic-god-card').first()).toContainText('Finite promises:');
  await expect(page.locator('.strategic-god-card').first()).toContainText('Authenticated worship:');
  await expect(page.locator('.strategic-god-card').first()).toContainText('exact cohorts, population sources, and follower allocations hidden');
  await expect(page.locator('#religionCityStandingList .religion-city-standing-entry')).toHaveCount(publicReligions.traditions.length);
  expect(publicReligions.gods.every((god) => god.objectiveExistence === 'confirmed' && god.communication.routine && god.avatarManifestation.possible)).toBe(true);
  expect(JSON.stringify(publicReligions)).not.toContain('hiddenGodStateCodes');
  expect(JSON.stringify(publicReligions)).not.toContain('currentAttentionBand');
  expect(JSON.stringify(publicReligions)).not.toMatch(/Unknown Monster|hiddenGod|unknownGod|sourcePopulationId|followerUnits/);
  const divineHistory = await page.evaluate(() => window.helixHeresyDebug.strategicPublicDivineHistory());
  const divineHistoryAudit = await page.evaluate(() => window.helixHeresyDebug.strategicDivineHistoryAudit());
  expect(divineHistoryAudit).toMatchObject({ valid: true, preCivicBaselineImmutable: true, retainedEventsHaveConsequences: true, descentPreservesLivingIdentity: true, deathPermanentAndIdentityNotTransferred: true, successorsRemainUnconfirmed: true, publicHistoryHidesExactPowerAndCausality: true });
  expect(divineHistory.chronology.length).toBeGreaterThan(0);
  expect(JSON.stringify(divineHistory)).not.toMatch(/exactContributions|actualCause|followerDispositionRows|worshipIncome|reserveAfterward|attackerScore|defenderScore|exactResidualPower/);
  await expect(page.locator('#strategicDivineHistoryChronology .strategic-divine-history-entry')).toHaveCount(divineHistory.chronology.length);
  await page.locator('#strategicGlobeLayerSelect').selectOption('religions');
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ layer: 'religions', hasReligions: true });
  await expect(page.locator('#strategicGlobeLegend')).toContainText('Confirmed holy site');
  const firstHolySiteIndex = Number(publicReligions.holySites[0].cellId.split(':')[1]);
  await page.evaluate((index) => window.helixHeresyDebug.strategicSelectCell(index), firstHolySiteIndex);
  await expect(page.locator('#strategicCellHolySites')).toContainText('divine identity not transferred');
  await expect(page.locator('.strategic-beast-card').first()).toContainText('reconstructed pre-urban distribution');
  await expect(page.locator('.strategic-beast-card').first()).toContainText('exact pristine counts hidden');
  await expect(page.locator('#strategicNetworkDirectory')).toBeVisible();
  const publicNetworks = await page.evaluate(() => window.helixHeresyDebug.strategicPublicNonStateNetworkDirectory());
  expect(publicNetworks.networkRows).toHaveLength(21);
  expect(new Set(publicNetworks.networkRows.map((network) => network.category)).size).toBe(7);
  expect(JSON.stringify(publicNetworks)).not.toContain('covertPresenceCodes');
  expect(JSON.stringify(publicNetworks)).not.toContain('actualCapacityBand');
  await expect(page.locator('.strategic-network-card')).toHaveCount(21);
  await expect(page.locator('#networkCityStandingList .network-city-standing-entry')).toHaveCount(21);
  await expect(page.locator('#strategicNetworkAffiliateList .strategic-network-affiliate-entry')).toHaveCount(15);
  await page.locator('#strategicGlobeLayerSelect').selectOption('networks');
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ layer: 'networks', hasNonStateNetworks: true });
  await expect(page.locator('#strategicGlobeLegend')).toContainText('Orbital launch or relay hub');
  const firstOrbitalNetworkIndex = Number.parseInt(publicNetworks.cellFeatures.find((feature) => feature.endsWith(':o')), 36);
  await page.evaluate((index) => window.helixHeresyDebug.strategicSelectCell(index), firstOrbitalNetworkIndex);
  await expect(page.locator('#strategicCellOrbitalInfrastructure')).toContainText('public launch or relay');
  await expect(page.locator('#strategicSettlementDirectory')).toBeVisible();
  const originsAudit = await page.evaluate(() => window.helixHeresyDebug.strategicCivilizationOriginsAudit());
  const publicOrigins = await page.evaluate(() => window.helixHeresyDebug.strategicPublicCivilizationOrigins());
  const expansionAudit = await page.evaluate(() => window.helixHeresyDebug.strategicCityExpansionAudit());
  const publicExpansion = await page.evaluate(() => window.helixHeresyDebug.strategicPublicCityExpansion());
  const capabilityAudit = await page.evaluate(() => window.helixHeresyDebug.strategicCapabilityHistoryAudit());
  const publicCapabilities = await page.evaluate(() => window.helixHeresyDebug.strategicPublicCapabilityHistory());
  const publicSettlements = await page.evaluate(() => window.helixHeresyDebug.strategicPublicSettlementDirectory());
  expect(originsAudit).toMatchObject({ valid: true, firstCityFoundedAtYearZero: true, everyOriginPopulationBacked: true, everySuccessfulOriginMateriallyViable: true, divineAidFiniteAndMaterialLaborRequired: true, qualifiedMinorityAttempts: true, originCitiesInitiallyDisconnected: true, publicChronologyHidesPrivateTruth: true });
  expect(publicOrigins.chronology.length).toBeGreaterThan(1);
  expect(JSON.stringify(publicOrigins)).not.toMatch(/canonicalMotive|divinePowerSpent|endingDivineReserve|sourcePopulationId|initialPopulation|materialRows/);
  await expect(page.locator('.strategic-origin-card')).toHaveCount(publicOrigins.chronology.length);
  expect(expansionAudit).toMatchObject({ valid: true, everyLaterCityHasCausalParent: true, parentageNeverImpliesAllegiance: true, everyOrdinaryCityPhysicallySupported: true, strongholdsJointlyResponsible: true, bridgesDoNotMergeLineages: true, publicHistoryHidesCanonicalTruth: true });
  expect(publicExpansion.chronology.length).toBeGreaterThan(0);
  expect(JSON.stringify(publicExpansion)).not.toMatch(/canonicalMotive|"foundingPopulation":|populationSourceRows|materialRows|failureCause|relativeConstructionCost/);
  await expect(page.locator('.strategic-expansion-card')).toHaveCount(publicExpansion.chronology.length);
  expect(capabilityAudit).toMatchObject({ valid: true, capabilitiesAreCausalSystems: true, prerequisitesAreChronological: true, knowledgeAndDeploymentSeparated: true, everyComponentHasOrbitalGateway: true, orbitalInternetCreatesNoAuthority: true, publicHistoryHidesCanonicalWeaknesses: true });
  expect(publicCapabilities.eras).toHaveLength(6);
  expect(publicCapabilities.milestones).toHaveLength(12);
  expect(JSON.stringify(publicCapabilities)).not.toMatch(/actualCause|hiddenConditionBand|hiddenSinglePointOfFailure|resourceRequirementRows/);
  await expect(page.locator('.strategic-capability-era-card')).toHaveCount(6);
  expect(publicSettlements.foundations).toHaveLength(cityCount);
  expect(publicSettlements.strongholds.length).toBeGreaterThan(0);
  expect(publicSettlements.satellites.length).toBeGreaterThan(cityCount);
  expect(JSON.stringify(publicSettlements)).not.toContain('hiddenSatelliteReadinessCodes');
  expect(JSON.stringify(publicSettlements)).not.toContain('supplementalEndowmentCodes');
  await expect(page.locator('.strategic-foundation-card')).toHaveCount(publicSettlements.foundations.length);
  await expect(page.locator('.strategic-stronghold-card')).toHaveCount(publicSettlements.strongholds.length);
  await expect(page.locator('.strategic-satellite-card')).not.toHaveCount(0);
  await page.locator('#strategicGlobeLayerSelect').selectOption('settlements');
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ layer: 'settlements', hasSettlements: true });
  await expect(page.locator('#strategicGlobeLegend')).toContainText('Joint route stronghold');
  const firstStrongholdIndex = Number.parseInt(publicSettlements.cellFeatures.find((feature) => feature.endsWith(':s')), 36);
  await page.evaluate((index) => window.helixHeresyDebug.strategicSelectCell(index), firstStrongholdIndex);
  await expect(page.locator('#strategicCellSettlement')).toContainText('jointly governed dependency');
  await expect(page.locator('#strategicCellSettlementLogistics')).toContainText('jointly staff and fund upkeep');
  await page.locator('#strategicGlobeLayerSelect').selectOption('beastEcology');
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ layer: 'beastEcology', hasBeastEcology: true });
  await expect(page.locator('#strategicGlobeLegend')).toContainText('Reported migration corridor');
  await expect(page.locator('#strategicGlobeLegend')).toContainText('Wave-pressure approach');
  await expect(page.locator('#strategicGlobeLegend')).toContainText('Known lair');
  const firstBeastReportIndex = await page.evaluate(() => window.helixHeresyDebug.strategicPublicBeastReportedIndices()[0]);
  await page.evaluate((index) => window.helixHeresyDebug.strategicSelectCell(index), firstBeastReportIndex);
  await expect(page.locator('#strategicCellBeastReports')).not.toContainText('No major beast population');
  await expect(page.locator('#strategicBeastBestiary')).toBeVisible();
  await expect(page.locator('.strategic-beast-card')).toHaveCount(24);
  await expect(page.locator('#strategicBeastPressureDirectory')).toBeVisible();
  await expect(page.locator('.strategic-beast-pressure-card')).toHaveCount(cityCount);
  const crisisHistory = await page.evaluate(() => window.helixHeresyDebug.strategicPublicCrisisHistory());
  const crisisAudit = await page.evaluate(() => window.helixHeresyDebug.strategicCrisisHistoryAudit());
  expect(crisisAudit).toMatchObject({ valid: true, pristineEcologyImmutable: true, everyEventCausalAndConsequential: true, coalitionsTemporaryAndNonSovereign: true, contributionsCapabilityBacked: true, routeSplitsArePhysicalOnly: true, publicHistoryHidesExactCausality: true });
  expect(crisisHistory.chronology.length).toBeGreaterThan(0);
  expect(JSON.stringify(crisisHistory)).not.toMatch(/sourcePopulationId|exactCellPath|exactFactors|commitmentPoints|populationIndexDeltaPermille|startingPopulationIndex|resultingPopulationIndex|localReadinessPower|assaultPower|defensePower/);
  await expect(page.locator('#strategicCrisisChronology .strategic-crisis-card')).toHaveCount(crisisHistory.chronology.length);
  const cityThreats = await page.evaluate(() => window.helixHeresyDebug.strategicPublicCityThreatDirectory());
  expect(cityThreats.every((entry) => entry.attackAssessment.attackPossible)).toBe(true);
  expect(cityThreats.some((entry) => entry.migrations.length === 0)).toBe(true);
  expect(cityThreats.some((entry) => entry.waveWarnings.length === 0)).toBe(true);
  const firstWaveIndex = await page.evaluate(() => window.helixHeresyDebug.strategicPublicWavePressureIndices()[0]);
  await page.evaluate((index) => window.helixHeresyDebug.strategicSelectCell(index), firstWaveIndex);
  await expect(page.locator('#strategicCellWavePressure')).not.toContainText('No recurring wave approach');
  const globeBefore = await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot());
  await page.locator('[data-globe-action="rotate-right"]').click();
  const globeAfter = await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot());
  expect(globeAfter.yaw).toBeGreaterThan(globeBefore.yaw);
  await page.locator('#seedInput').fill('run-seed-one');
  await page.locator('#startRunSubmitBtn').click();

  const snapshot = await page.evaluate(() => window.helixHeresyDebug.currentWorldRunSnapshot());
  expect(snapshot.world).toMatchObject({
    worldSeed: 'world-seed-one',
    worldTheme: 'unbound',
    generationVersion: 9,
    nameGeneratorVersion: 2,
  });
  expect(snapshot.world.name).toBe(await page.evaluate(() => window.helixHeresyDebug.generatedWorldName('world-seed-one', 'unbound')));
  expect(['madcap', 'grim']).toContain(snapshot.world.generatedData.themeContent.worldName.sourceTheme);
  expect(['madcap', 'grim']).toContain(snapshot.world.generatedData.themeContent.worldSummary.sourceTheme);
  expect(snapshot.world.generatedData.strategicMap).toMatchObject({
    topology: { kind: 'geodesic-icosphere-dual', cellCount: 10242, hexagonCount: 10230, pentagonCount: 12 },
    diagnostics: { boundaryCellCount: 0 },
  });
  const storedLibrary = await page.evaluate(() => window.helixHeresyDebug.worldLibrarySnapshot());
  expect(storedLibrary.worlds).toHaveLength(1);
  expect(storedLibrary.runs).toHaveLength(1);
  expect(storedLibrary.manifest.activeRunId).toBe(snapshot.run.id);
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicMapAudit())).toMatchObject({ valid: true, boundaryCellCount: 0 });
  expect(await page.evaluate(() => window.helixHeresyDebug.planetaryReliefAudit())).toMatchObject({ valid: true, plateCount: 28 });
  expect(await page.evaluate(() => window.helixHeresyDebug.climateHydrologyBiomeAudit())).toMatchObject({ valid: true, drainageAcyclic: true, equatorWarmerThanPoles: true });
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGeologyAudit())).toMatchObject({ valid: true, contiguousProvinces: true, representedBedrockClassCount: 7 });
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicArcaneGeographyAudit())).toMatchObject({ valid: true, acyclicFlow: true, representedPrimaryAspectCount: 8 });
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicResourcePotentialAudit())).toMatchObject({ valid: true, publicProjectionHidesTruth: true, representedFamilyCount: 12 });
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicHumanGeographyAudit())).toMatchObject({ valid: true, allCitiesOnLand: true, allCorridorsOnLand: true, citiesFavorHabitableCells: true });
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicCityPolitiesAudit())).toMatchObject({ valid: true, oneIndependentPolityPerCity: true, maximumCitiesPerPolity: 1, globalInternetCoverage: true, permanentAllianceCount: 0 });
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicBeastEcologyAudit())).toMatchObject({ valid: true, staticSpeciesCount: 24, everySpeciesPresent: true, everyCityAttackable: true, causalWaveProfiles: true, sharedThreatsUseWarningProtocols: true, publicAtlasHidesPopulationIdentity: true, publicAtlasHidesPopulationIndex: true, publicAtlasHidesUnknownLairs: true, publicAtlasHidesExactPaths: true });
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicCityGovernmentsAudit())).toMatchObject({ valid: true, oneGovernmentPerCity: true, everyGovernmentCityOnly: true, everyEssentialRoleCovered: true, jailAndPrisonAlwaysDistinct: true, publicDirectoryHidesOperationalRisks: true, publicDirectoryHidesOfficeholders: true, allOfficeholdersLazy: true, emergencyPowersExpireWithoutRenewal: true });
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicCityLawsAudit())).toMatchObject({ valid: true, oneCodePerCity: true, everyCodeCoversCatalog: true, majorityProhibitGeneticEngineering: true, animancyNeverOrdinaryCommerce: true, noLifeImprisonment: true, publicEnemyRequiresSeparateFinding: true, penalFlightIsNonterminalRelease: true, publicDirectoryHidesEnforcementPolicy: true, hiddenPolicyCannotInferGuilt: true });
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicCrossCityRecognitionAudit())).toMatchObject({ valid: true, everyOrderedCityPairCovered: true, recognitionIsDirectional: true, standingAgreementsAreSparse: true, foreignWarrantsNeverSelfExecute: true, localCustodyOrderAlwaysRequired: true, doubleCriminalityAlwaysRequired: true, deportationAlwaysDistinct: true, wildernessNeverOrdinaryJurisdiction: true, publicDirectoryHidesDiscretion: true, hiddenPolicyCannotAlterDueProcess: true });
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicReligionsAudit())).toMatchObject({ valid: true, everyGodObjectivelyReal: true, everyGodFinite: true, routineDirectCommunication: true, everyGodAvatarCapable: true, exactlyOneConfirmedFaithPerGod: true, noSameGodHeresyOrSchism: true, everyTraditionHasCityStanding: true, everyNetworkNonSovereign: true, everyBranchLocallyBound: true, everyHolySiteDivinelyConfirmed: true, nonTheisticMovementsAcknowledgeGods: true, publicDirectoryHidesDivineAttention: true, publicDirectoryHidesBranchIntegrity: true, hiddenAttentionCannotBePubliclyInferred: true });
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicNonStateNetworksAudit())).toMatchObject({ valid: true, everyCategoryPresent: true, everyNetworkNonSovereign: true, physicalReachLocallyBound: true, globalInternetUsesOrbitalArcaneMesh: true, rocketSpaceflightExists: true, individualSpaceflightExists: true, cityStandingComplete: true, shellOwnershipSeparated: true, publicDirectoryHidesCovertCells: true, playerCompanyExcludedFromCanonicalWorld: true });
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicSettlementsAudit())).toMatchObject({ valid: true, everyCityHasFoundingReason: true, everyResourceFamilyExploited: true, independentRefugesRare: true, powerfulFoundersExplicit: true, originFoundationsAuthoritative: true, expansionHistoryAuthoritative: true, strongholdHistoryAuthoritative: true, normalCitiesMutuallySupported: true, supportLegsWithinMaximum: true, strongholdsJointlyResponsible: true, everySatelliteFunctionCausal: true, everySatelliteHasPopulationCapacity: true, everySatelliteHasEvacuationPlan: true, publicDirectoryHidesOperationalTruth: true });
  expect(snapshot.run).toMatchObject({
    worldId: snapshot.world.id,
    runSeed: 'run-seed-one',
    status: 'active',
    site: { selectionStatus: 'deferredWorldPlacement' },
    worldState: { changes: {} },
  });
  expect(snapshot.run.id).not.toBe(snapshot.world.id);
  expect(snapshot.run.state.themeContent).toMatchObject({
    version: 2,
    opening: { definitionId: expect.stringMatching(/^run-opening\./) },
  });
  expect(['madcap', 'grim']).toContain(snapshot.run.state.themeContent.opening.sourceTheme);
  expect(snapshot.run.state.events).toContainEqual(expect.objectContaining({
    message: snapshot.run.state.themeContent.opening.text,
    sourceKind: 'themeContent',
    sourceId: snapshot.run.state.themeContent.opening.definitionId,
  }));

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const reloaded = await page.evaluate(() => window.helixHeresyDebug.currentWorldRunSnapshot());
  expect(reloaded.run.state.themeContent).toEqual(snapshot.run.state.themeContent);
  expect(reloaded.world.generatedData.strategicMap.digest).toBe(snapshot.world.generatedData.strategicMap.digest);
});

test('political, civic, legal, public-attitude, settlement, religious, and network history are visible through knowledge-safe public previews', async ({ page }) => {
  test.setTimeout(480_000);
  await openFreshTitle(page);
  await page.locator('#titleNewRunBtn').click();
  await page.locator('#setupWorldSeedInput').fill('world-seed-one');
  await page.locator('input[name="setupWorldTheme"][value="unbound"]').check();

  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('10,242 cells', { timeout: 300_000 });
  await expect(page.locator('#strategicCityPolityDirectory')).toBeVisible();
  await expect(page.locator('#strategicPoliticalChronology')).toContainText('Year');
  const politicalHistory = await page.evaluate(() => window.helixHeresyDebug.strategicPublicPoliticalHistory());
  expect(politicalHistory.chronology.some((event) => event.kind === 'intercityCampaign')).toBe(true);
  expect(politicalHistory.currentControlRows.some((row) => row.publicControlStatus !== 'sovereign')).toBe(true);
  expect(JSON.stringify(politicalHistory)).not.toMatch(/exactFactors|attackerPower|defenderPower|exactCellPath|covertPuppetSponsorPolityId/);
  await expect(page.locator('#strategicCivicHistoryChronology')).toContainText('Year');
  const civicHistory = await page.evaluate(() => window.helixHeresyDebug.strategicPublicCivicHistory());
  expect(civicHistory.chronology.length).toBeGreaterThan(0);
  expect(civicHistory.currentInstitutionRows.some((row) => row.publicControlStatus === 'overtOccupation')).toBe(true);
  expect(JSON.stringify(civicHistory)).not.toMatch(/exactFactors|actualControlStatus|actualControllerPolityId|captureState|foreignSponsorControl|capacityShift|independenceShift/);
  await expect(page.locator('#strategicCityLawDirectory')).toContainText('prospective amendment');
  const legalHistory = await page.evaluate(() => window.helixHeresyDebug.strategicPublicLegalHistory());
  expect(legalHistory.amendmentChronology.length).toBeGreaterThan(0);
  expect(legalHistory.directiveChronology.every((event) => !event.recognizedAsLocalCriminalLaw && !event.independentConvictionAuthority)).toBe(true);
  expect(JSON.stringify(legalHistory)).not.toMatch(/hiddenSponsorPolityId|discoverableHooks|nominalAuthorityActorIds|retroactiveGuiltPermitted|proofStandardChanged|offenseElementsChanged/);
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicLegalHistoryAudit())).toMatchObject({ valid: true, foundingCodesImmutable: true, proofStandardPreserved: true, directivesRemainSeparateAndTemporary: true });
  await expect(page.locator('#strategicCityLawDirectory')).toContainText('Observed public pressure');
  const attitudes = await page.evaluate(() => window.helixHeresyDebug.strategicPublicAttitudeHistory());
  expect(attitudes.currentProfileRows.length).toBeGreaterThan(0);
  expect(attitudes.currentProfileRows.every((row) => row.uncertaintyAcknowledged && row.aggregatePressureNotPopulationConsensus)).toBe(true);
  expect(JSON.stringify(attitudes)).not.toMatch(/exactFactors|discoverableHooks|sourceEventId|sourceLayer|retainedBySeed|channelShifts/);
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicPublicAttitudeHistoryAudit())).toMatchObject({ valid: true, oneProfilePerCityOffense: true, attitudesNeverChangeLawOrGuilt: true, publicDirectoryAcknowledgesUncertainty: true });
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('authoritative current support components');
  await expect(page.locator('.strategic-foundation-card').first()).toContainText('Playable year:');
  const currentSettlements = await page.evaluate(() => window.helixHeresyDebug.strategicPublicPlayableSettlementState());
  expect(currentSettlements.cityRows.length).toBeGreaterThan(0);
  expect(currentSettlements.cityRows.every((row) => row.populationRange.minimum <= row.populationRange.maximum && !row.exactPopulationPublic && !row.exactCapacityPublic)).toBe(true);
  expect(currentSettlements.routeRows.every((row) => !row.createsState && !row.createsAlliance)).toBe(true);
  expect(JSON.stringify(currentSettlements)).not.toMatch(/populationLedger|protectedCapacity|currentPopulation|exactFactors|crisisFatalities|unresolvedDisplacedPopulation|admittedPopulation/);
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicPlayableSettlementStateAudit())).toMatchObject({ valid: true, everyPopulationLedgerBalanced: true, currentComponentsFollowUsableRoutes: true, connectivityCreatesNoPoliticalUnity: true, atLeastOneViableRunStartRegion: true, publicDirectoryHidesExactPopulationAndLosses: true });
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('authoritative religious institutions');
  await expect(page.locator('#strategicReligiousInstitutionChronology')).toContainText('Year');
  await expect(page.locator('#religionCityStandingList')).toContainText('founded Year');
  const religiousInstitutions = await page.evaluate(() => window.helixHeresyDebug.strategicPublicReligiousInstitutionHistory());
  expect(religiousInstitutions.currentBranchRows.length).toBeGreaterThan(0);
  expect(religiousInstitutions.currentBranchRows.every((branch) => !branch.sovereignAuthority)).toBe(true);
  expect(religiousInstitutions.cityStandingRows.every((row) => row.standings.filter((entry) => entry.standing === 'established').length <= 1)).toBe(true);
  expect(religiousInstitutions.holySiteCustodyRows.every((row) => !row.divineIdentityTransferred && !row.religionTransferred && !row.createsSovereignty)).toBe(true);
  expect(JSON.stringify(religiousInstitutions)).not.toMatch(/integrityBand|concealedMisconduct|covertPersistence|exactFactors|sourceEventId|hiddenAttention|exposureRoll|sponsorPolityId/);
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicReligiousInstitutionHistoryAudit())).toMatchObject({ valid: true, oneAggregateBranchPerCityTradition: true, everyBranchFoundedAfterItsCity: true, activeGodCensureCreatesNoConfirmedSchism: true, successorsRemainUnconfirmed: true, publicHistoryHidesIntegrityMisconductAndCovertInfluence: true, divinePowerHistoryNotRecalculated: true });
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('retained network events');
  await expect(page.locator('#strategicNetworkChronology')).toContainText('Year');
  await expect(page.locator('#networkCityStandingList')).toContainText('founded Year');
  const networkHistory = await page.evaluate(() => window.helixHeresyDebug.strategicPublicNonStateNetworkHistory());
  expect(networkHistory.networkRows).toHaveLength(21);
  expect(networkHistory.currentBranchRows.every((branch) => !branch.sovereignAuthority && !branch.enforcementAuthority && !branch.longRangeDeliveryGuaranteed)).toBe(true);
  expect(networkHistory.cityStandingRows.every((row) => row.standings.length === 21)).toBe(true);
  expect(JSON.stringify(networkHistory)).not.toMatch(/covertRows|actualCapacityBand|integrityBand|privatePriority|actualParentNetworkId|hiddenPurpose|exactFactors|sourceEventId|exposureRoll/);
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicNonStateNetworkHistoryAudit())).toMatchObject({ valid: true, everyNetworkFoundedAfterCityAndCapabilities: true, everyRetainedChangeCausallySourced: true, relocationRequiresPhysicalTransport: true, lifecycleAllowsDormancyAndDefunction: true, networksRemainNonSovereign: true, publicHistoryHidesCovertCapacityIntegrityAndOwnership: true, priorHistoryNotRecalculated: true });
});

test('@smoke Continue shows world and run metadata and Return to Title suspends time', async ({ page }) => {
  await openFreshTitle(page);
  await beginRun(page, { worldSeed: 'navigation-world', runSeed: 'navigation-run' });
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(90));
  await page.locator('#timeSpeedSelect').selectOption('very-fast');
  await page.locator('#pauseBtn').click();
  await page.waitForTimeout(300);
  await page.locator('#newRunBtn').click();

  const before = await page.evaluate(() => {
    const current = window.helixHeresyDebug.currentWorldRunSnapshot();
    return { clock: current.run.state.clock, paused: current.run.state.paused, timeSpeed: current.run.state.timeSpeed, worldName: current.world.name };
  });
  await expect(page.locator('#loadLastSaveBtn')).toBeEnabled();
  await expect(page.locator('#loadLastSaveStatus')).toContainText(before.worldName);
  await expect(page.locator('#loadLastSaveStatus')).toContainText('Chemistry Front');
  await expect(page.locator('#loadLastSaveStatus')).toContainText('Day 1');
  await page.waitForTimeout(650);
  const after = await page.evaluate(() => {
    const current = window.helixHeresyDebug.currentWorldRunSnapshot();
    return { clock: current.run.state.clock, paused: current.run.state.paused, timeSpeed: current.run.state.timeSpeed };
  });
  expect(after).toEqual({ clock: before.clock, paused: before.paused, timeSpeed: before.timeSpeed });

  await page.locator('#loadLastSaveBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
  await expect(page.locator('#timeSpeedSelect')).toHaveValue(before.timeSpeed);
  await expect(page.locator('#pauseReadout')).toContainText(before.paused ? 'Paused' : 'Running');
});

test('malformed library data disables Continue without deleting it', async ({ page }) => {
  await openFreshTitle(page);
  const corrupt = '{ definitely-not-json';
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), { key: manifestKey, value: corrupt });
  await page.reload();

  await expect(page.locator('#loadLastSaveBtn')).toBeDisabled();
  await expect(page.locator('#loadLastSaveStatus')).toContainText('unreadable');
  await page.locator('#titleNewRunBtn').click();
  await page.locator('#setupBackBtn').click();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), manifestKey)).toBe(corrupt);
});

test('legacy worlds without a globe remain selectable', async ({ page }) => {
  await openFreshTitle(page);
  await page.evaluate(() => {
    const repository = window.HelixWorldRunLibrary.createRepository(window.localStorage);
    repository.putWorld(window.HelixWorldRunLibrary.createWorld({
      id: 'legacy-world',
      worldSeed: 'legacy-world-seed',
      worldTheme: 'grim',
      generationVersion: 1,
      nameGeneratorVersion: 1,
      createdAt: '2026-08-25T00:00:00.000Z',
    }));
  });
  await page.locator('#titleWorldLibraryBtn').click();
  await page.locator('[data-library-action="start-run"]').click();

  await expect(page.locator('#strategicWorldCanvas')).toBeHidden();
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('predates strategic globe generation');
  const snapshot = await page.evaluate(() => window.helixHeresyDebug.worldLibrarySnapshot());
  expect(snapshot.worlds[0].generationVersion).toBe(1);
  expect(snapshot.worlds[0].generatedData.strategicMap).toBeUndefined();
});

test('legacy surface worlds report unavailable relief', async ({ page }) => {
  await openFreshTitle(page);
  await page.evaluate(() => {
    const repository = window.HelixWorldRunLibrary.createRepository(window.localStorage);
    repository.putWorld(window.HelixWorldRunLibrary.createWorld({
      id: 'surface-only-world',
      worldSeed: 'surface-only-seed',
      worldTheme: 'madcap',
      generationVersion: 2,
      createdAt: '2026-08-25T00:00:00.000Z',
    }));
  });
  await page.locator('#titleWorldLibraryBtn').click();
  await page.locator('[data-library-action="start-run"]').click();

  await expect(page.locator('#strategicWorldCanvas')).toBeVisible();
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('Detailed relief unavailable in this saved world');
  await expect(page.locator('#strategicGlobeLayerSelect')).toBeDisabled();
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ layer: 'surface', hasRelief: false });
});

test('legacy relief worlds report unavailable climate', async ({ page }) => {
  await openFreshTitle(page);
  await page.evaluate(() => {
    const repository = window.HelixWorldRunLibrary.createRepository(window.localStorage);
    repository.putWorld(window.HelixWorldRunLibrary.createWorld({
      id: 'relief-only-world',
      worldSeed: 'relief-only-seed',
      worldTheme: 'grim',
      generationVersion: 3,
      createdAt: '2026-08-25T00:00:00.000Z',
    }));
  });
  await page.locator('#titleWorldLibraryBtn').click();
  await page.locator('[data-library-action="start-run"]').click();

  await expect(page.locator('#strategicWorldCanvas')).toBeVisible();
  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('Climate, hydrology, and biomes unavailable in this saved world');
  await expect(page.locator('#strategicGlobeLayerSelect')).toBeEnabled();
  await expect(page.locator('#strategicGlobeLayerSelect option[value="elevation"]')).toBeEnabled();
  await expect(page.locator('#strategicGlobeLayerSelect option[value="temperature"]')).toHaveAttribute('disabled', '');
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ hasRelief: true, hasEnvironment: false });
});

test('legacy environment worlds report unavailable geology', async ({ page }) => {
  await openFreshTitle(page);
  await page.evaluate(() => {
    const repository = window.HelixWorldRunLibrary.createRepository(window.localStorage);
    repository.putWorld(window.HelixWorldRunLibrary.createWorld({
      id: 'environment-only-world',
      worldSeed: 'environment-only-seed',
      worldTheme: 'madcap',
      generationVersion: 4,
      createdAt: '2026-08-25T00:00:00.000Z',
    }));
  });
  await page.locator('#titleWorldLibraryBtn').click();
  await page.locator('[data-library-action="start-run"]').click();

  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('Geology and natural hazards unavailable in this saved world');
  await expect(page.locator('#strategicGlobeLayerSelect option[value="biomes"]')).toBeEnabled();
  await expect(page.locator('#strategicGlobeLayerSelect option[value="geology"]')).toHaveAttribute('disabled', '');
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ hasEnvironment: true, hasGeology: false });
});

test('legacy geology worlds report unavailable arcane geography', async ({ page }) => {
  await openFreshTitle(page);
  await page.evaluate(() => {
    const repository = window.HelixWorldRunLibrary.createRepository(window.localStorage);
    repository.putWorld(window.HelixWorldRunLibrary.createWorld({
      id: 'geology-only-world',
      worldSeed: 'geology-only-seed',
      worldTheme: 'grim',
      generationVersion: 5,
      createdAt: '2026-08-25T00:00:00.000Z',
    }));
  });
  await page.locator('#titleWorldLibraryBtn').click();
  await page.locator('[data-library-action="start-run"]').click();

  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('Arcane geography and magical hazards unavailable in this saved world');
  await expect(page.locator('#strategicGlobeLayerSelect option[value="geology"]')).toBeEnabled();
  await expect(page.locator('#strategicGlobeLayerSelect option[value="arcane"]')).toHaveAttribute('disabled', '');
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ hasGeology: true, hasArcaneGeography: false });
});

test('legacy arcane worlds report unavailable resource potential', async ({ page }) => {
  await openFreshTitle(page);
  await page.evaluate(() => {
    const repository = window.HelixWorldRunLibrary.createRepository(window.localStorage);
    repository.putWorld(window.HelixWorldRunLibrary.createWorld({
      id: 'arcane-only-world',
      worldSeed: 'arcane-only-seed',
      worldTheme: 'unbound',
      generationVersion: 6,
      createdAt: '2026-08-25T00:00:00.000Z',
    }));
  });
  await page.locator('#titleWorldLibraryBtn').click();
  await page.locator('[data-library-action="start-run"]').click();

  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('Resource potential unavailable in this saved world');
  await expect(page.locator('#strategicGlobeLayerSelect option[value="arcane"]')).toBeEnabled();
  await expect(page.locator('#strategicGlobeLayerSelect option[value="prospects"]')).toHaveAttribute('disabled', '');
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ hasArcaneGeography: true, hasResourceProspects: false });
});

test('legacy resource worlds report unavailable human geography', async ({ page }) => {
  await openFreshTitle(page);
  await page.evaluate(() => {
    const repository = window.HelixWorldRunLibrary.createRepository(window.localStorage);
    repository.putWorld(window.HelixWorldRunLibrary.createWorld({
      id: 'resource-only-world',
      worldSeed: 'resource-only-seed',
      worldTheme: 'unbound',
      generationVersion: 7,
      createdAt: '2026-08-25T00:00:00.000Z',
    }));
  });
  await page.locator('#titleWorldLibraryBtn').click();
  await page.locator('[data-library-action="start-run"]').click();

  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('Human geography unavailable in this saved world');
  await expect(page.locator('#strategicGlobeLayerSelect option[value="prospects"]')).toBeEnabled();
  await expect(page.locator('#strategicGlobeLayerSelect option[value="humanGeography"]')).toHaveAttribute('disabled', '');
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ hasResourceProspects: true, hasHumanGeography: false });
});

test('legacy routed worlds report unavailable city polities', async ({ page }) => {
  await openFreshTitle(page);
  await page.evaluate(() => {
    const repository = window.HelixWorldRunLibrary.createRepository(window.localStorage);
    repository.putWorld(window.HelixWorldRunLibrary.createWorld({
      id: 'human-geography-world',
      worldSeed: 'human-geography-seed',
      worldTheme: 'madcap',
      generationVersion: 8,
      createdAt: '2026-08-25T00:00:00.000Z',
    }));
  });
  await page.locator('#titleWorldLibraryBtn').click();
  await page.locator('[data-library-action="start-run"]').click();

  await expect(page.locator('#strategicWorldPreviewSummary')).toContainText('City polities unavailable in this saved world');
  await expect(page.locator('#strategicGlobeLayerSelect option[value="humanGeography"]')).toBeEnabled();
  await expect(page.locator('#strategicGlobeLayerSelect option[value="cityPolities"]')).toHaveAttribute('disabled', '');
  await expect(page.locator('#strategicCityPolityDirectory')).toBeHidden();
  expect(await page.evaluate(() => window.helixHeresyDebug.strategicGlobeSnapshot())).toMatchObject({ hasHumanGeography: true, hasCityPolities: false });
});

test('two runs in one world retain independent seeds and saves', async ({ page }) => {
  await openFreshTitle(page);
  await beginRun(page, { worldSeed: 'shared-world-seed', runSeed: 'first-run-seed' });
  await page.locator('#newRunBtn').click();
  await page.locator('#titleWorldLibraryBtn').click();
  const worldName = await page.locator('.world-card h3').textContent();
  await page.locator('[data-library-action="start-run"]').click();
  await expect(page.locator('#strategicWorldCanvas')).toBeVisible();
  await expect(page.locator('#selectedWorldSummary')).toContainText(worldName || '');
  await page.locator('#seedInput').fill('second-run-seed');
  await page.locator('#startRunSubmitBtn').click();

  let snapshot = await page.evaluate(() => window.helixHeresyDebug.worldLibrarySnapshot());
  expect(snapshot.worlds).toHaveLength(1);
  expect(snapshot.runs).toHaveLength(2);
  expect(snapshot.runs.map((run) => run.runSeed).sort()).toEqual(['first-run-seed', 'second-run-seed']);
  expect(snapshot.runs.every((run) => run.worldId === snapshot.worlds[0].id)).toBe(true);

  await page.locator('#newRunBtn').click();
  await page.locator('#titleWorldLibraryBtn').click();
  const firstRun = page.locator('.run-library-entry', { hasText: 'first-run-seed' });
  await firstRun.locator('[data-library-action="resume-run"]').click();
  snapshot = await page.evaluate(() => window.helixHeresyDebug.currentWorldRunSnapshot());
  expect(snapshot.run.runSeed).toBe('first-run-seed');
  expect(snapshot.run.state.seed).toBe('first-run-seed');
});

test('validated bundle import reuses an identical world and remaps a colliding run ID', async ({ page }) => {
  await openFreshTitle(page);
  await beginRun(page, { worldSeed: 'portable-world', runSeed: 'portable-run' });
  const bundle = await page.evaluate(() => {
    const current = window.helixHeresyDebug.currentWorldRunSnapshot();
    return JSON.stringify({ format: 'helix-heresy-run-bundle', version: 2, exportedAt: new Date().toISOString(), ...current });
  });
  await page.locator('#newRunBtn').click();

  await page.locator('#titleImportFileInput').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await expect(page.locator('#titleImportStatus')).toContainText('was not changed');
  expect((await page.evaluate(() => window.helixHeresyDebug.worldLibrarySnapshot())).runs).toHaveLength(1);

  await page.locator('#titleImportFileInput').setInputFiles({
    name: 'portable.json',
    mimeType: 'application/json',
    buffer: Buffer.from(bundle),
  });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
  const library = await page.evaluate(() => window.helixHeresyDebug.worldLibrarySnapshot());
  expect(library.worlds).toHaveLength(1);
  expect(library.runs).toHaveLength(2);
  expect(new Set(library.runs.map((run) => run.id)).size).toBe(2);
  expect(library.runs.every((run) => run.worldId === library.worlds[0].id)).toBe(true);

  const conflictingBundle = await page.evaluate(() => {
    const current = window.helixHeresyDebug.currentWorldRunSnapshot();
    const world = window.HelixWorldRunLibrary.createWorld({
      id: current.world.id,
      worldSeed: 'different-canonical-seed',
      worldTheme: 'grim',
      createdAt: current.world.createdAt,
    });
    const state = JSON.parse(JSON.stringify(current.run.state));
    state.seed = 'different-imported-run';
    state.runEnded = false;
    state.runIdentity = { runId: current.run.id, runSeed: state.seed };
    state.worldReference = { worldId: world.id, generationVersion: world.generationVersion, canonicalDigest: world.canonicalDigest };
    const run = window.HelixWorldRunLibrary.createRun({
      ...current.run,
      worldId: world.id,
      worldGenerationVersion: world.generationVersion,
      canonicalWorldDigest: world.canonicalDigest,
      runSeed: state.seed,
      worldState: { version: 1, canonicalWorldDigest: world.canonicalDigest, changes: {} },
      state,
    });
    return JSON.stringify({ format: 'helix-heresy-run-bundle', version: 2, world, run });
  });
  await page.locator('#newRunBtn').click();
  await page.locator('#titleImportFileInput').setInputFiles({
    name: 'colliding-world.json',
    mimeType: 'application/json',
    buffer: Buffer.from(conflictingBundle),
  });
  const remapped = await page.evaluate(() => window.helixHeresyDebug.worldLibrarySnapshot());
  expect(remapped.worlds).toHaveLength(2);
  expect(remapped.runs).toHaveLength(3);
  expect(remapped.worlds.map((world) => world.worldSeed).sort()).toEqual(['different-canonical-seed', 'portable-world']);
  expect(new Set(remapped.worlds.map((world) => world.id)).size).toBe(2);
});

test('title Settings persist independently and About describes world-backed saves', async ({ page }) => {
  await openFreshTitle(page);
  await page.locator('#titleSettingsBtn').click();
  await page.locator('[data-title-preference="mapRendererMode"]').selectOption('dom');
  await page.locator('[data-title-preference="mapVisualMode"]').selectOption('glyphs');
  await page.locator('[data-title-preference="mapMotion"]').selectOption('reduced');
  await page.locator('[data-title-preference="mapContrast"]').selectOption('high');
  await page.locator('[data-title-preference="compactFeedVisible"]').uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-map-contrast', 'high');
  await page.locator('#titleSettingsBackBtn').click();
  await page.reload();
  await page.locator('#titleSettingsBtn').click();
  await expect(page.locator('[data-title-preference="mapRendererMode"]')).toHaveValue('dom');
  await expect(page.locator('[data-title-preference="mapVisualMode"]')).toHaveValue('glyphs');
  await expect(page.locator('[data-title-preference="compactFeedVisible"]')).not.toBeChecked();
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)).mapRendererMode, preferencesKey)).toBe('dom');

  await page.locator('#titleSettingsBackBtn').click();
  await page.locator('#titleAboutBtn').click();
  await expect(page.locator('#titleAboutPanel')).toContainText('reusable generated worlds');
  await page.locator('#titleAboutBackBtn').click();
  await expect(page.locator('#titleNewRunBtn')).toBeFocused();
});
