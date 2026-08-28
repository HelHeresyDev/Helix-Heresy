(function initStrategicFaiths(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const strategicReligions = typeof module === "object" && module.exports ? require("./strategic-religions") : root?.HelixStrategicReligions;
  const strategicDivinity = typeof module === "object" && module.exports ? require("./strategic-divinity") : root?.HelixStrategicDivinity;
  const preUrbanHumanity = typeof module === "object" && module.exports ? require("./strategic-pre-urban-humanity") : root?.HelixStrategicPreUrbanHumanity;
  const api = factory(strategicWorld, strategicReligions, strategicDivinity, preUrbanHumanity);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicFaiths = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicFaithsApi(StrategicWorld, StrategicReligions, StrategicDivinity, StrategicPreUrbanHumanity) {
  "use strict";

  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before strategic-faiths.js");
  if (!StrategicReligions) throw new Error("HelixStrategicReligions must load before strategic-faiths.js");
  if (!StrategicDivinity) throw new Error("HelixStrategicDivinity must load before strategic-faiths.js");
  if (!StrategicPreUrbanHumanity) throw new Error("HelixStrategicPreUrbanHumanity must load before strategic-faiths.js");

  const CONFIRMATION_STATES = Object.freeze(["activelyConfirmed", "historicallyConfirmed", "unconfirmedSuccessor"]);
  const OUTSIDER_STANCES = Object.freeze(["aidWithoutCompulsoryConversion", "cooperativePluralism", "conversionByDemonstration", "cautiousCoexistence", "conditionalSubmission"]);
  const URBAN_TEACHINGS = Object.freeze(["rejectUrbanProjects", "noSpecialUrbanMandate", "supportCitiesConditionally", "encourageDefendedSettlement", "commitDivineResourcesToCities"]);
  const SITE_KINDS = Object.freeze(["naturalConvergence", "primordialManifestation", "domainResonance", "divineThreshold"]);
  const SITE_ORIGINS = Object.freeze(["naturalResonance", "deliberateConsecration", "primordialManifestation", "suppressedAscensionEvent"]);
  const SITE_SIGNIFICANCE = Object.freeze(["local", "notable", "major"]);
  const SITE_ACTIVITY = Object.freeze(["active", "dormant", "residual", "dead"]);
  const SITE_DISCOVERY = Object.freeze(["confirmed", "reported", "undiscovered"]);
  const DOCTRINE_TOPICS = Object.freeze(["geneticEngineering", "artificialCreatureCreation", "animancy", "resurrection", "magicalBeasts", "humanModification", "punishment", "slavery", "warfare", "civicAuthority"]);
  const TOPIC_OPTIONS = Object.freeze({
    geneticEngineering: Object.freeze(["sacredWhenConsensual", "permittedWithConsent", "regulatedStewardship", "forbiddenViolation", "noSpecialDoctrine"]),
    artificialCreatureCreation: Object.freeze(["permittedWithCreatorDuty", "regulatedStewardship", "forbiddenImitation", "noSpecialDoctrine"]),
    animancy: Object.freeze(["forbiddenSoulViolation", "narrowHealingAndFuneraryUseOnly", "regulatedSacrament"]),
    resurrection: Object.freeze(["sacredRestorationWithContinuity", "acceptedWithContinuityProof", "conditionalDivineReview", "forbiddenReturn", "noSpecialDoctrine"]),
    magicalBeasts: Object.freeze(["ecologicalStewardshipAndMeasuredHunt", "defensiveExtermination", "studyAndContainment", "coexistenceWherePossible", "domesticationAndUse"]),
    humanModification: Object.freeze(["affirmedWithConsent", "regulatedByDuty", "discouraged", "forbidden"]),
    punishment: Object.freeze(["restorativeMercy", "strictProportionalJudgment", "proportionalJudgment", "severeCivicProtection"]),
    slavery: Object.freeze(["permittedOnlyByExplicitDivineCovenant", "alwaysForbidden", "penalBondageAlsoForbidden", "noSpecialDoctrine"]),
    warfare: Object.freeze(["defensiveWarAsDuty", "sanctionedWildernessWar", "defensiveOnly", "sanctionedForDeclaredCause", "pacifistExceptImmediateDefense"]),
    civicAuthority: Object.freeze(["authorityBoundByPublishedOath", "cooperationWithoutDivineSovereignty", "conditionalMoralSupport", "strictSeparationFromChurch"])
  });
  const CIVIC_SUMMARIES = Object.freeze({
    authorityBoundByPublishedOath: "Civic authority is legitimate only while bound by published obligations.",
    cooperationWithoutDivineSovereignty: "Faithful institutions may cooperate with a city but possess no automatic sovereignty.",
    conditionalMoralSupport: "City authorities deserve support only while their conduct remains compatible with the faith's duties.",
    strictSeparationFromChurch: "Religious authority and city government should remain institutionally separate."
  });

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function seededNumber(seed, channel) {
    return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff;
  }

  function pick(values, seed, channel) {
    return values[Math.floor(seededNumber(seed, channel) * values.length) % values.length];
  }

  function title(value) {
    return String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
  }

  function semanticTags(text) {
    const value = String(text || "").toLowerCase();
    const tags = [];
    const rules = [
      ["consent", "consentRequired"], ["soul", "identityContinuity"], ["identity", "identityContinuity"],
      ["sanctuary", "sanctuaryDuty"], ["aid", "mutualAid"], ["knowledge", "knowledgePreservation"],
      ["workmanship", "craftIntegrity"], ["killing", "ecologicalRestraint"], ["breeding", "ecologicalRestraint"],
      ["message", "communicationIntegrity"], ["correspondence", "communicationIntegrity"], ["oath", "publishedObligation"],
      ["terms", "publishedObligation"], ["evidence", "evidenceRequired"], ["defense", "defensiveDuty"],
      ["dependents", "protectDependents"], ["pain", "antiCruelty"], ["victims", "victimRecognition"],
      ["mourners", "mourningRights"], ["celebration", "voluntaryParticipation"], ["creation", "creatorDuty"]
    ];
    for (const [needle, tag] of rules) if (value.includes(needle) && !tags.includes(tag)) tags.push(tag);
    return tags.length ? tags : ["explicitDivineRule"];
  }

  function definitionFor(id) {
    const definition = StrategicReligions.DEITY_DEFINITIONS.find((entry) => entry.id === id);
    if (!definition) throw new Error(`Unknown deity definition ${id}.`);
    return definition;
  }

  function doctrineCodes(doctrine) {
    return DOCTRINE_TOPICS.map((topic) => {
      const index = TOPIC_OPTIONS[topic].indexOf(doctrine[topic]);
      if (index < 0) throw new Error(`Unknown doctrine position ${doctrine[topic]} for ${topic}.`);
      return index.toString(36);
    }).join("");
  }

  function doctrineFromCodes(codes) {
    if (typeof codes !== "string" || codes.length !== DOCTRINE_TOPICS.length) throw new Error("A faith doctrine code row is invalid.");
    return Object.fromEntries(DOCTRINE_TOPICS.map((topic, index) => {
      const position = TOPIC_OPTIONS[topic][parseInt(codes[index], 36)];
      if (!position) throw new Error(`A faith doctrine code for ${topic} is invalid.`);
      return [topic, position];
    }));
  }

  function outsiderStanceFor(god, seed) {
    const domains = new Set(god.domains);
    if (["charity", "healing", "affection"].some((domain) => domains.has(domain))) return "aidWithoutCompulsoryConversion";
    if (["dominion", "punishment"].some((domain) => domains.has(domain))) return "conditionalSubmission";
    if (["secrets", "night"].some((domain) => domains.has(domain))) return "cautiousCoexistence";
    return pick(["cooperativePluralism", "conversionByDemonstration"], seed, `outsider:${god.id}`);
  }

  function urbanTeachingFor(urbanInterest) {
    return ({ opposed: "rejectUrbanProjects", indifferent: "noSpecialUrbanMandate", conditional: "supportCitiesConditionally", interested: "encourageDefendedSettlement", committed: "commitDivineResourcesToCities" })[urbanInterest] || "noSpecialUrbanMandate";
  }

  function methodsFor(doctrine) {
    const positions = Object.values(doctrine);
    const acceptable = [
      { id: "method:verified-evidence", summary: "Use repeatable evidence and authenticated divine replies.", tags: ["evidenceRequired", "repeatableVerification"] },
      { id: "method:proportional-action", summary: "Use means proportionate to the declared duty and actual danger.", tags: ["proportionality"] }
    ];
    if (positions.some((position) => /Consent|Consensual/.test(position))) acceptable.push({ id: "method:informed-consent", summary: "Obtain informed consent before altering another living person.", tags: ["consentRequired"] });
    if (positions.some((position) => /Stewardship|CreatorDuty/.test(position))) acceptable.push({ id: "method:documented-stewardship", summary: "Accept continuing responsibility for created life and altered environments.", tags: ["creatorDuty", "stewardship"] });
    const unacceptable = [
      { id: "method:unlimited-sovereignty", summary: "Divine power does not grant a church automatic civic sovereignty.", tags: ["noAutomaticSovereignty"] },
      { id: "method:false-divine-claim", summary: "Do not fabricate divine replies, signatures, or approval.", tags: ["communicationIntegrity", "evidenceRequired"] }
    ];
    if (positions.some((position) => /Consent|Consensual/.test(position))) unacceptable.push({ id: "method:coerced-alteration", summary: "Coercion cannot substitute for consent.", tags: ["consentRequired", "antiCoercion"] });
    return { acceptable, unacceptable };
  }

  function faithSemanticCore(row) {
    const definition = definitionFor(row[3]);
    const doctrine = doctrineFromCodes(row[5]);
    const suffix = definition.id.split(".").pop();
    const methods = methodsFor(doctrine);
    return {
      id: row[0],
      kind: "confirmedDivineFaithIdentity",
      godId: row[1],
      name: row[2],
      confirmation: {
        state: CONFIRMATION_STATES[row[4]],
        authorityId: row[1],
        channel: row[4] === 0 ? "repeatableDirectDivineCommunication" : "lastConfirmedDoctrine",
        doctrineRevision: row[8]
      },
      coreTenets: [
        { id: "tenet:verified-divinity", summary: "Divine claims must remain attributable to a repeatable identity signature.", tags: ["repeatableVerification", "identityContinuity"] },
        ...definition.domains.slice(0, 3).map((domain) => ({ id: `tenet:domain:${domain}`, summary: `${title(domain)} is a divine responsibility rather than unlimited personal license.`, tags: ["domainStewardship", domain] }))
      ],
      commandments: definition.priorities.map((summary, index) => ({ id: `commandment:${suffix}:${index + 1}`, summary: title(summary), tags: semanticTags(summary) })),
      prohibitions: definition.prohibitions.map((summary, index) => ({ id: `prohibition:${suffix}:${index + 1}`, summary: title(summary), tags: semanticTags(summary) })),
      promises: definition.domains.slice(0, 2).map((domain, index) => ({ id: `promise:${suffix}:${index + 1}`, summary: `When attention and power permit, provide authenticated guidance concerning ${domain}.`, conditionalOnFiniteCapacity: true, tags: ["finitePromise", domain] })),
      acceptableMethods: methods.acceptable,
      unacceptableMethods: methods.unacceptable,
      outsiderTreatment: { stance: OUTSIDER_STANCES[row[6]], summary: title(OUTSIDER_STANCES[row[6]]), compulsoryConversionAuthorized: row[6] === 4 },
      civicTeaching: { position: doctrine.civicAuthority, summary: CIVIC_SUMMARIES[doctrine.civicAuthority], churchHasAutomaticSovereignty: false },
      urbanTeaching: { position: URBAN_TEACHINGS[row[7]], summary: title(URBAN_TEACHINGS[row[7]]) },
      topicPositions: doctrine,
      verifiedConduct: [
        { id: `conduct:${suffix}:signature`, kind: "repeatableSignatureResponse", verification: "independentlyRepeatable" },
        { id: `conduct:${suffix}:correction`, kind: "directDoctrineCorrection", verification: "authenticatedByDivineSignature" },
        { id: `conduct:${suffix}:domain`, kind: `bounded${title(definition.domains[0])}Manifestation`, verification: "repeatablyObserved" }
      ],
      doctrinalSchismAvailable: row[4] !== 0,
      sameGodHeresyClaimsValid: false,
      localVariationAllowed: ["liturgy", "clothing", "architecture", "administration", "nonDoctrinalCustom"],
      alignmentLabel: undefined,
      themeContent: { definitionId: definition.id, sourceTheme: definition.compatibility }
    };
  }

  function createFaithRow(god, privateGod, worldSeed) {
    const row = [
      `tradition:divine:${god.id.slice(4)}`,
      god.id,
      `The Faith of ${god.name}`,
      god.themeContent.definitionId,
      CONFIRMATION_STATES.indexOf("activelyConfirmed"),
      doctrineCodes(god.doctrine),
      OUTSIDER_STANCES.indexOf(outsiderStanceFor(god, worldSeed)),
      URBAN_TEACHINGS.indexOf(urbanTeachingFor(privateGod.urbanInterest)),
      1,
      ""
    ];
    row[9] = StrategicWorld.stableHash(faithSemanticCore(row));
    return row;
  }

  function expandFaithRow(row) {
    if (!Array.isArray(row) || row.length !== 10 || row[9] !== StrategicWorld.stableHash(faithSemanticCore(row))) throw new Error("A pre-civic faith row is invalid or no longer matches its semantic content.");
    const faith = faithSemanticCore(row);
    delete faith.alignmentLabel;
    return faith;
  }

  function domainAffinityScore(map, god, index) {
    const domains = new Set(god.domains);
    const land = map.surface.classes[index] !== "W";
    const elevation = map.relief.elevationM[index];
    const stable = map.geology.stabilityPermille[index];
    const geothermal = map.geology.geothermalPermille[index];
    const precipitation = map.climate.precipitationMm[index];
    const wind = map.climate.windStrengthPermille[index];
    const nullStrength = map.arcaneGeography.nullPermille[index];
    const hazard = map.naturalHazards.earthquakePermille[index] + map.naturalHazards.volcanicPermille[index] + map.naturalHazards.floodPermille[index];
    let score = 0;
    if (["shelter", "healing", "charity", "walls", "duty", "defense"].some((domain) => domains.has(domain))) score += (land ? 500 : -300) + stable * 0.8 - hazard * 0.25;
    if (["souls", "death", "memory", "secrets", "night", "resurrection"].some((domain) => domains.has(domain))) score += nullStrength * 0.65 + map.geology.crustAgeMyr[index] * 0.08;
    if (["craft", "invention", "flame"].some((domain) => domains.has(domain))) score += geothermal * 0.8 + map.naturalHazards.volcanicPermille[index] * 0.45;
    if (["beasts", "wilderness", "hunting"].some((domain) => domains.has(domain))) score += (land ? 450 : 0) + Math.min(800, precipitation) * 0.35 + (map.biomes.classes[index] !== "I" ? 180 : 0);
    if (["messages", "travel", "wind", "chance", "discovery"].some((domain) => domains.has(domain))) score += wind * 0.55 + Math.max(0, elevation) * 0.08 + (map.relief.coastClasses[index] !== "." ? 250 : 0);
    if (["transformation", "genetics", "beauty", "celebration", "affection", "courage"].some((domain) => domains.has(domain))) score += map.arcaneGeography.manaConcentrationPermille[index] * 0.5 + Math.min(900, precipitation) * 0.25;
    if (["oaths", "punishment", "dominion"].some((domain) => domains.has(domain))) score += stable * 0.6 + Math.max(0, elevation) * 0.1;
    return score;
  }

  function holySiteScore(map, god, index, worldSeed) {
    const aspect = map.arcaneGeography.primaryAspectClasses[index] === god.preferredArcaneAspect ? 950 : 0;
    const ley = map.arcaneGeography.leyClasses[index] === "n" ? 760 : (map.arcaneGeography.leyClasses[index] === "c" ? 380 : 0);
    const mana = map.arcaneGeography.manaConcentrationPermille[index] * 0.55;
    const arcaneStability = map.arcaneGeography.arcaneStabilityPermille[index] * 0.2;
    return Math.floor(aspect + ley + mana + arcaneStability + domainAffinityScore(map, god, index) + seededNumber(worldSeed, `pre-civic-site:${god.id}:${index}`) * 420);
  }

  function plannedSiteCounts(worldSeed, godStates) {
    const counts = godStates.map((state) => {
      if (state.rank === "major") return 1 + Math.floor(seededNumber(worldSeed, `major-site-count:${state.godId}`) * 3);
      const roll = seededNumber(worldSeed, `minor-site-count:${state.godId}`);
      return roll < 0.48 ? 0 : (roll < 0.92 ? 1 : 2);
    });
    if (!counts.some(Boolean)) counts[0] = 1;
    return counts;
  }

  function publicSiteFactors(map, index, domain) {
    const hydrology = map.hydrology.lakeByCell[index] >= 0 ? "lake" : (map.hydrology.riverClasses[index] !== "." ? "river" : (map.hydrology.wetlandClasses[index] !== "." ? "wetland" : "noMajorSurfaceWater"));
    return [
      `primaryArcaneAspect:${map.arcaneGeography.primaryAspectClasses[index]}`,
      `leyClass:${map.arcaneGeography.leyClasses[index]}`,
      `bedrockClass:${map.geology.bedrockClasses[index]}`,
      `biomeClass:${map.biomes.classes[index]}`,
      `hydrology:${hydrology}`,
      `domainAffinity:${domain}`
    ];
  }

  function createSitePlan(worldSeed, map, gods, godStates) {
    const usedCells = new Set();
    const siteCounts = plannedSiteCounts(worldSeed, godStates);
    const publicRows = [];
    const hiddenRows = [];
    const supportByGod = Object.fromEntries(gods.map((god) => [god.id, 0]));
    for (const [godIndex, god] of gods.entries()) {
      const ranked = Array.from({ length: map.topology.cellCount }, (_, index) => ({ index, score: holySiteScore(map, god, index, worldSeed) }))
        .sort((left, right) => right.score - left.score || left.index - right.index);
      for (let ordinal = 0; ordinal < siteCounts[godIndex]; ordinal += 1) {
        const selected = ranked.find((candidate) => !usedCells.has(candidate.index));
        if (!selected) continue;
        usedCells.add(selected.index);
        const siteId = `holy-site:${god.id.slice(4)}:${ordinal + 1}`;
        const originRoll = seededNumber(worldSeed, `site-origin:${siteId}`);
        const origin = originRoll < 0.1 ? "suppressedAscensionEvent" : (originRoll < 0.35 ? "primordialManifestation" : (originRoll < 0.58 ? "deliberateConsecration" : "naturalResonance"));
        const siteKind = pick(SITE_KINDS, worldSeed, `site-kind:${siteId}`);
        const support = Math.max(120, Math.min(520, 120 + Math.floor(selected.score / 14)));
        supportByGod[god.id] = Math.min(1000, supportByGod[god.id] + support);
        const significance = selected.score >= 3600 ? "major" : (selected.score >= 2500 ? "notable" : "local");
        const domain = god.domains[Math.floor(seededNumber(worldSeed, `site-domain:${siteId}`) * god.domains.length) % god.domains.length];
        publicRows.push([
          siteId,
          god.id,
          `${pick(["Sanctuary", "Threshold", "Anchor", "Shrine", "Seat"], worldSeed, `site-name:${siteId}`)} of ${god.epithet}`,
          selected.index,
          SITE_KINDS.indexOf(siteKind),
          SITE_SIGNIFICANCE.indexOf(significance),
          SITE_ACTIVITY.indexOf("active"),
          SITE_DISCOVERY.indexOf("confirmed"),
          domain
        ]);
        hiddenRows.push([siteId, selected.score, support, SITE_ORIGINS.indexOf(origin)]);
      }
    }
    return { publicRows, hiddenRows, supportByGod };
  }

  function accessClassFor(map, cellId) {
    if (!map.humanGeography) return "preCivicWilderness";
    const city = map.humanGeography.cities.find((entry) => entry.cellId === cellId);
    if (city) return "fortifiedCitySanctuary";
    const corridorCells = new Set(map.routeGraph.routes.flatMap((route) => route.cellPath));
    if (corridorCells.has(cellId)) return "intermittentCorridorPilgrimage";
    const index = StrategicWorld.cellIndex(cellId);
    return map.cityPolities?.control?.classes?.[index] === "a" ? "controlledApproach" : "wildernessExpedition";
  }

  function expandSiteRow(row, map) {
    if (!Array.isArray(row) || row.length !== 9 || !SITE_KINDS[row[4]] || !SITE_SIGNIFICANCE[row[5]] || !SITE_ACTIVITY[row[6]] || !SITE_DISCOVERY[row[7]]) throw new Error("A public pre-civic holy-site row is invalid.");
    const cellId = StrategicWorld.cellId(row[3]);
    return {
      id: row[0],
      godId: row[1],
      name: row[2],
      cellId,
      siteKind: SITE_KINDS[row[4]],
      significance: SITE_SIGNIFICANCE[row[5]],
      divineActivity: SITE_ACTIVITY[row[6]],
      discoveryStatus: SITE_DISCOVERY[row[7]],
      domainAffinity: row[8],
      accessClass: accessClassFor(map, cellId),
      confirmedByGod: row[7] === 0,
      routineCommunicationRequired: false,
      publicEffects: ["enhancedWorshipReception", "boundedManifestationSupport", "authenticatedRitualAccess"],
      causalFactors: publicSiteFactors(map, row[3], row[8])
    };
  }

  function publicCore(directory) {
    return { worldTheme: directory.worldTheme, knowledgePolicy: directory.knowledgePolicy, humanReligiousKnowledgeDigest: directory.humanReligiousKnowledgeDigest, faithRows: directory.faithRows, holySiteRows: directory.holySiteRows };
  }

  function faithCore(record) {
    return {
      sourceDivinityDigest: record.sourceDivinityDigest,
      sourceReliefDigest: record.sourceReliefDigest,
      sourceClimateDigest: record.sourceClimateDigest,
      sourceHydrologyDigest: record.sourceHydrologyDigest,
      sourceBiomeDigest: record.sourceBiomeDigest,
      sourceGeologyDigest: record.sourceGeologyDigest,
      sourceArcaneGeographyDigest: record.sourceArcaneGeographyDigest,
      divinityHolySiteSupportDigest: record.divinityHolySiteSupportDigest,
      publicDirectoryDigest: record.publicDirectoryDigest,
      faithRows: record.faithRows,
      holySiteRows: record.holySiteRows,
      siteKnowledgeRows: record.siteKnowledgeRows,
      hiddenSiteRows: record.hiddenSiteRows,
      diagnostics: record.diagnostics
    };
  }

  function attachPreCivicFaiths(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for pre-civic faith generation.");
    const startingMap = StrategicWorld.validateStrategicMap(map);
    StrategicDivinity.validatePreCivicDivinity(startingMap);
    if (startingMap.humanGeography) throw new Error("Pre-civic faiths and holy sites must be generated before human geography.");
    const gods = StrategicReligions.createGods(seed, startingMap.strategicDivinity.worldTheme);
    const privateGods = gods.map((god) => StrategicDivinity.privateDivineStateFor(startingMap, god.id));
    const godStates = privateGods.map((god) => ({ godId: god.id, rank: god.rank, publicStatus: god.lifecycle.publicStatus }));
    const faithRows = gods.map((god, index) => createFaithRow(god, privateGods[index], seed));
    const sitePlan = createSitePlan(seed, startingMap, gods, godStates);
    const next = StrategicDivinity.applyHolySiteSupport(startingMap, sitePlan.supportByGod);
    const knownGodIds = new Set(next.humanReligiousKnowledge.knownGodRows.map((row) => row[0]));
    const humanGroups = StrategicPreUrbanHumanity.expandPopulationGroups(next);
    const siteKnowledgeRows = sitePlan.publicRows.filter((row) => knownGodIds.has(row[1])).flatMap((row) => {
      const cellId = StrategicWorld.cellId(row[3]);
      const witness = humanGroups.find((group) => group.rangeCellIds.includes(cellId));
      if (witness) return [[row[0], "physicalDiscovery", witness.id]];
      if (seededNumber(seed, `site-disclosure:${row[0]}`) > 0.55) return [[row[0], "authenticatedSiteDisclosure", row[1]]];
      return [];
    });
    const knownSiteIds = new Set(siteKnowledgeRows.map((row) => row[0]));
    const directory = {
      worldTheme: next.strategicDivinity.worldTheme,
      knowledgePolicy: "omitUnsupportedIdentitiesAndSites",
      humanReligiousKnowledgeDigest: next.humanReligiousKnowledge.digest,
      faithRows: faithRows.filter((row) => knownGodIds.has(row[1])),
      holySiteRows: sitePlan.publicRows.filter((row) => knownSiteIds.has(row[0]))
    };
    directory.digest = `public-faiths-${StrategicWorld.stableHash(publicCore(directory))}`;
    const record = {
      sourceDivinityDigest: next.strategicDivinity.digest,
      sourceReliefDigest: next.relief.digest,
      sourceClimateDigest: next.climate.digest,
      sourceHydrologyDigest: next.hydrology.digest,
      sourceBiomeDigest: next.biomes.digest,
      sourceGeologyDigest: next.geology.digest,
      sourceArcaneGeographyDigest: next.arcaneGeography.digest,
      divinityHolySiteSupportDigest: next.strategicDivinity.holySiteSupportDigest,
      publicDirectoryDigest: directory.digest,
      faithRows,
      holySiteRows: sitePlan.publicRows,
      siteKnowledgeRows,
      hiddenSiteRows: sitePlan.hiddenRows,
      diagnostics: {
        faithCount: faithRows.length,
        activelyConfirmedFaithCount: faithRows.filter((row) => row[4] === 0).length,
        holySiteCount: sitePlan.publicRows.length,
        humanKnownFaithCount: directory.faithRows.length,
        humanKnownHolySiteCount: directory.holySiteRows.length,
        majorGodSiteCount: godStates.filter((state) => state.rank === "major").reduce((total, state) => total + sitePlan.publicRows.filter((row) => row[1] === state.godId).length, 0),
        siteSupportedGodCount: Object.values(sitePlan.supportByGod).filter((value) => value > 0).length,
        suppressedAscensionOriginCount: sitePlan.hiddenRows.filter((row) => row[3] === SITE_ORIGINS.indexOf("suppressedAscensionEvent")).length
      }
    };
    record.digest = `strategic-faiths-${StrategicWorld.stableHash(faithCore(record))}`;
    next.preCivicFaiths = record;
    next.publicPreCivicFaithDirectory = directory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function validatePreCivicFaiths(map, record = map?.preCivicFaiths, directory = map?.publicPreCivicFaithDirectory) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    const divinity = StrategicDivinity.validatePreCivicDivinity(strategicMap);
    if (!record || !directory || record.sourceDivinityDigest !== strategicMap.strategicDivinity.digest || record.sourceReliefDigest !== strategicMap.relief?.digest || record.sourceClimateDigest !== strategicMap.climate?.digest || record.sourceHydrologyDigest !== strategicMap.hydrology?.digest || record.sourceBiomeDigest !== strategicMap.biomes?.digest || record.sourceGeologyDigest !== strategicMap.geology?.digest || record.sourceArcaneGeographyDigest !== strategicMap.arcaneGeography?.digest || record.divinityHolySiteSupportDigest !== strategicMap.strategicDivinity.holySiteSupportDigest || record.publicDirectoryDigest !== directory.digest || directory.humanReligiousKnowledgeDigest !== strategicMap.humanReligiousKnowledge?.digest) throw new Error("Pre-civic faith records are incomplete or do not match their causal sources.");
    if (!Array.isArray(record.faithRows) || !Array.isArray(record.holySiteRows) || !Array.isArray(record.siteKnowledgeRows)) throw new Error("Canonical faith and holy-site truth is incomplete.");
    const faiths = record.faithRows.map(expandFaithRow);
    const godIds = divinity.strategicDivinity.godOrder;
    if (faiths.length !== godIds.length || new Set(faiths.map((faith) => faith.id)).size !== faiths.length || godIds.some((godId) => faiths.filter((faith) => faith.godId === godId).length !== 1) || faiths.some((faith) => faith.confirmation.state !== "activelyConfirmed" || faith.sameGodHeresyClaimsValid || faith.coreTenets.length < 3 || faith.commandments.length < 2 || faith.prohibitions.length < 2 || faith.promises.some((promise) => !promise.conditionalOnFiniteCapacity) || faith.civicTeaching.churchHasAutomaticSovereignty || JSON.stringify(faith).toLowerCase().includes("alignment"))) throw new Error("Every divine god requires one semantic actively confirmed faith without alignment or automatic sovereignty.");
    const sites = record.holySiteRows.map((row) => expandSiteRow(row, strategicMap));
    if (new Set(sites.map((site) => site.id)).size !== sites.length || new Set(sites.map((site) => site.cellId)).size !== sites.length || sites.some((site) => !godIds.includes(site.godId) || StrategicWorld.cellIndex(site.cellId) < 0 || StrategicWorld.cellIndex(site.cellId) >= strategicMap.topology.cellCount || site.discoveryStatus !== "confirmed" || !site.confirmedByGod || site.routineCommunicationRequired || site.causalFactors.some((factor) => /city|corridor|beastPressure|population/i.test(factor)))) throw new Error("Pre-civic holy sites must be unique, physical, confirmed, optional for communication, and independent of later settlement facts.");
    const godStates = godIds.map((godId) => StrategicDivinity.privateDivineStateFor(strategicMap, godId));
    if (godStates.some((state) => state.rank === "major" && !sites.some((site) => site.godId === state.id)) || godStates.some((state) => sites.filter((site) => site.godId === state.id).length > (state.rank === "major" ? 3 : 2))) throw new Error("Holy-site distribution does not match bounded major and minor god rules.");
    const knownGodIds = new Set(strategicMap.humanReligiousKnowledge.knownGodRows.map((row) => row[0]));
    const humanGroupById = new Map(StrategicPreUrbanHumanity.expandPopulationGroups(strategicMap).map((group) => [group.id, group]));
    const siteById = new Map(sites.map((site) => [site.id, site]));
    const siteEvidenceSupported = (row) => {
      const site = siteById.get(row[0]);
      if (!site || !knownGodIds.has(site.godId)) return false;
      if (row[1] === "authenticatedSiteDisclosure") return row[2] === site.godId;
      const witness = humanGroupById.get(row[2]);
      return row[1] === "physicalDiscovery" && witness?.rangeCellIds.includes(site.cellId);
    };
    const knownSiteIds = new Set(record.siteKnowledgeRows.map((row) => row[0]));
    if (directory.knowledgePolicy !== "omitUnsupportedIdentitiesAndSites" || directory.faithRows.some((row) => !knownGodIds.has(row[1])) || JSON.stringify(directory.faithRows) !== JSON.stringify(record.faithRows.filter((row) => knownGodIds.has(row[1]))) || JSON.stringify(directory.holySiteRows) !== JSON.stringify(record.holySiteRows.filter((row) => knownSiteIds.has(row[0]))) || record.siteKnowledgeRows.some((row) => !siteEvidenceSupported(row)) || JSON.stringify(directory).match(/undiscovered|hiddenGod|unknownGod|Unknown Monster/i)) throw new Error("Human-facing faith records expose an unsupported identity or site.");
    if (!Array.isArray(record.hiddenSiteRows) || record.hiddenSiteRows.length !== sites.length || record.hiddenSiteRows.some((row) => !sites.some((site) => site.id === row[0]) || !Number.isInteger(row[1]) || !Number.isInteger(row[2]) || !SITE_ORIGINS[row[3]]) || JSON.stringify(directory).includes("hiddenSiteRows") || JSON.stringify(directory).includes("suppressedAscensionEvent") || JSON.stringify(directory).includes("exactScore")) throw new Error("Hidden holy-site origin and power records are invalid or publicly leaked.");
    const diagnostics = record.diagnostics;
    if (!diagnostics || diagnostics.faithCount !== faiths.length || diagnostics.activelyConfirmedFaithCount !== faiths.length || diagnostics.holySiteCount !== sites.length || diagnostics.humanKnownFaithCount !== directory.faithRows.length || diagnostics.humanKnownHolySiteCount !== directory.holySiteRows.length || diagnostics.siteSupportedGodCount !== new Set(sites.map((site) => site.godId)).size || diagnostics.suppressedAscensionOriginCount !== record.hiddenSiteRows.filter((row) => row[3] === SITE_ORIGINS.indexOf("suppressedAscensionEvent")).length) throw new Error("Pre-civic faith diagnostics do not match saved facts.");
    if (directory.digest !== `public-faiths-${StrategicWorld.stableHash(publicCore(directory))}` || record.digest !== `strategic-faiths-${StrategicWorld.stableHash(faithCore(record))}`) throw new Error("Pre-civic faith records do not match their digests.");
    return { preCivicFaiths: clone(record), publicDirectory: clone(directory) };
  }

  function publicFaithDirectory(map) {
    if (!map?.publicPreCivicFaithDirectory) return null;
    return {
      worldTheme: map.publicPreCivicFaithDirectory.worldTheme,
      faiths: map.publicPreCivicFaithDirectory.faithRows.map(expandFaithRow),
      holySites: map.publicPreCivicFaithDirectory.holySiteRows.map((row) => expandSiteRow(row, map)),
      digest: map.publicPreCivicFaithDirectory.digest
    };
  }

  function confirmationStateForDivineLifecycle(lifecycle) {
    if (!lifecycle || !["living", "dead"].includes(lifecycle.lifeState) || !["divine", "descended", "none"].includes(lifecycle.divinityState)) throw new Error("A valid divine lifecycle is required to project faith confirmation.");
    return lifecycle.lifeState === "living" && lifecycle.divinityState === "divine" ? "activelyConfirmed" : "historicallyConfirmed";
  }

  function projectFaithConfirmation(faith, lifecycle) {
    if (!faith?.id || !faith?.godId || !faith?.confirmation) throw new Error("A semantic confirmed faith is required.");
    const projected = clone(faith);
    const state = confirmationStateForDivineLifecycle(lifecycle);
    projected.confirmation.state = state;
    projected.confirmation.authorityId = projected.godId;
    projected.confirmation.channel = state === "activelyConfirmed" ? "repeatableDirectDivineCommunication" : "lastConfirmedDoctrine";
    projected.confirmation.physicalSpeechCountsAsDivineConfirmation = state === "activelyConfirmed";
    projected.doctrinalSchismAvailable = state !== "activelyConfirmed";
    projected.sameGodHeresyClaimsValid = false;
    return projected;
  }

  function createUnconfirmedSuccessorFaith(faith, successorId, successorName) {
    if (!faith?.id || !faith?.godId || !String(successorId || "").trim() || successorId === faith.id) throw new Error("An unconfirmed successor requires a distinct stable identity.");
    const successor = clone(faith);
    successor.id = String(successorId).trim();
    successor.name = String(successorName || `${faith.name} Successor`).trim();
    successor.kind = "unconfirmedSuccessorTradition";
    successor.predecessorFaithId = faith.id;
    successor.confirmation = { state: "unconfirmedSuccessor", authorityId: null, channel: "noDivineConfirmation", doctrineRevision: faith.confirmation?.doctrineRevision || 1, physicalSpeechCountsAsDivineConfirmation: false };
    successor.doctrinalSchismAvailable = true;
    successor.sameGodHeresyClaimsValid = false;
    return successor;
  }

  function privateHolySiteStateFor(map, siteId) {
    const row = map?.preCivicFaiths?.hiddenSiteRows?.find((entry) => entry[0] === siteId);
    if (!row) return null;
    return { siteId: row[0], exactAffinityScore: row[1], worshipSupportPermille: row[2], origin: SITE_ORIGINS[row[3]], publicInferencePermitted: false };
  }

  function auditPreCivicFaiths(map) {
    const { preCivicFaiths } = validatePreCivicFaiths(map);
    const directory = publicFaithDirectory(map);
    const canonicalFaiths = preCivicFaiths.faithRows.map(expandFaithRow);
    const canonicalSites = preCivicFaiths.holySiteRows.map((row) => expandSiteRow(row, map));
    return {
      valid: true,
      independentOfCities: !preCivicFaiths.sourceCityDigest,
      exactlyOneConfirmedFaithPerGod: canonicalFaiths.length === map.strategicDivinity.godOrder.length,
      everyFaithSemantic: canonicalFaiths.every((faith) => faith.coreTenets.length && faith.commandments.length && faith.prohibitions.length && faith.promises.length && faith.acceptableMethods.length && faith.unacceptableMethods.length && faith.verifiedConduct.length),
      noSameGodHeresyWhileCorrectionActive: canonicalFaiths.every((faith) => !faith.doctrinalSchismAvailable && !faith.sameGodHeresyClaimsValid),
      promisesAcknowledgeFiniteCapacity: canonicalFaiths.every((faith) => faith.promises.every((promise) => promise.conditionalOnFiniteCapacity)),
      holySitesIndependentOfCitiesAndBeasts: canonicalSites.every((site) => site.causalFactors.every((factor) => !/city|corridor|beastPressure|population/i.test(factor))),
      routineCommunicationNeedsNoSite: canonicalSites.every((site) => !site.routineCommunicationRequired),
      humanDirectoryOmitsUnsupportedFaithsAndSites: directory.faiths.length < canonicalFaiths.length && directory.holySites.length <= canonicalSites.length && !directory.faiths.some((faith) => faith.godId === map.humanReligiousKnowledge.hiddenGodId),
      exactSitePowerAndOriginsHidden: !JSON.stringify(map.publicPreCivicFaithDirectory).includes("hiddenSiteRows") && !JSON.stringify(map.publicPreCivicFaithDirectory).includes("suppressedAscensionEvent"),
      diagnostics: clone(preCivicFaiths.diagnostics)
    };
  }

  return Object.freeze({
    CONFIRMATION_STATES,
    OUTSIDER_STANCES,
    URBAN_TEACHINGS,
    SITE_KINDS,
    SITE_SIGNIFICANCE,
    SITE_ACTIVITY,
    SITE_DISCOVERY,
    DOCTRINE_TOPICS,
    TOPIC_OPTIONS,
    attachPreCivicFaiths,
    validatePreCivicFaiths,
    publicFaithDirectory,
    confirmationStateForDivineLifecycle,
    projectFaithConfirmation,
    createUnconfirmedSuccessorFaith,
    privateHolySiteStateFor,
    auditPreCivicFaiths
  });
});
