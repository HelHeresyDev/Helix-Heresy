(function initStrategicDivinity(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports
    ? require("./strategic-world")
    : root?.HelixStrategicWorld;
  const strategicReligions = typeof module === "object" && module.exports
    ? require("./strategic-religions")
    : root?.HelixStrategicReligions;
  const beastEcology = typeof module === "object" && module.exports
    ? require("./strategic-beast-ecology")
    : root?.HelixStrategicBeastEcology;
  const preUrbanHumanity = typeof module === "object" && module.exports
    ? require("./strategic-pre-urban-humanity")
    : root?.HelixStrategicPreUrbanHumanity;
  const api = factory(strategicWorld, strategicReligions, beastEcology, preUrbanHumanity);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicDivinity = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicDivinityApi(StrategicWorld, StrategicReligions, StrategicBeastEcology, StrategicPreUrbanHumanity) {
  "use strict";

  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before strategic-divinity.js");
  if (!StrategicReligions) throw new Error("HelixStrategicReligions must load before strategic-divinity.js");
  if (!StrategicBeastEcology) throw new Error("HelixStrategicBeastEcology must load before strategic-divinity.js");
  if (!StrategicPreUrbanHumanity) throw new Error("HelixStrategicPreUrbanHumanity must load before strategic-divinity.js");

  const LIFE_STATES = Object.freeze(["living", "dead"]);
  const DIVINITY_STATES = Object.freeze(["divine", "descended", "none"]);
  const PUBLIC_STATUSES = Object.freeze(["active", "diminished", "silent", "missing", "fallen", "confirmedDead"]);
  const DIVINE_RANKS = Object.freeze(["minor", "major"]);
  const ORIGIN_KINDS = Object.freeze(["human", "beast", "otherCreature"]);
  const WORSHIP_SOURCE_KINDS = Object.freeze(["human", "beast"]);
  const HUMAN_PRACTICES = Object.freeze(["householdRites", "villageShrines", "oralLiturgy", "ritualGuild", "pilgrimageTradition"]);
  const BEAST_PRACTICES = Object.freeze(["formalDoctrine", "ordainedClergy", "templeCustody", "relicTradition", "ritualCustodians", "sacredTerritory", "sacredMigration", "dominanceRite", "sacredHunt", "learnedOffering", "nestTaboo", "cultivatedDivineBond", "instinctiveOffering"]);
  const KNOWLEDGE_EVIDENCE = Object.freeze(["directHumanWorship", "authenticatedReply", "manifestation", "verifiedBeastPracticeReport"]);
  const POWER_CONDITIONS = Object.freeze(["failing", "strained", "stable", "abundant"]);
  const PRIVATE_OBJECTIVES = Object.freeze(["protectFollowers", "expandWorship", "pursueDomainWork", "opposeRivals", "prepareManifestation", "accumulatePower"]);
  const URBAN_INTERESTS = Object.freeze(["opposed", "indifferent", "conditional", "interested", "committed"]);
  const INVESTMENT_WILLINGNESS = Object.freeze(["none", "limited", "measured", "substantial"]);
  const CORE_STATES = Object.freeze(["stable", "dormant", "destroyed"]);
  const DESCENDED_CONDITIONS = Object.freeze(["dormantWhileDivine", "activeFormerGod"]);
  const EXPENDITURE_KEYS = Object.freeze(["existence", "communication", "miracles", "avatars", "protection", "cityInvestment", "combat"]);

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function seededNumber(seed, channel) {
    return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff;
  }

  function integerBetween(seed, channel, minimum, maximum) {
    return minimum + Math.floor(seededNumber(seed, channel) * (maximum - minimum + 1));
  }

  function pick(values, seed, channel) {
    return values[Math.floor(seededNumber(seed, channel) * values.length) % values.length];
  }

  function clampInteger(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, Math.floor(Number(value) || 0)));
  }

  function powerCondition(reserve, capacity) {
    const ratio = capacity > 0 ? reserve / capacity : 0;
    return ratio < 0.12 ? "failing" : (ratio < 0.35 ? "strained" : (ratio < 0.75 ? "stable" : "abundant"));
  }

  function beastPractice(definition, seed, channel) {
    if (definition.intelligenceBand === "sapient") return pick(["formalDoctrine", "ordainedClergy", "templeCustody", "relicTradition"], seed, channel);
    if (definition.intelligenceBand === "reasoning") {
      const social = !["solitary", "matedPair"].includes(definition.socialPattern);
      return pick(social ? ["formalDoctrine", "ritualCustodians", "templeCustody", "relicTradition"] : ["sacredTerritory", "learnedOffering", "relicTradition"], seed, channel);
    }
    if (definition.intelligenceBand === "cunning") return pick(["dominanceRite", "sacredHunt", "learnedOffering", "nestTaboo"], seed, channel);
    return pick(definition.socialPattern.startsWith("migratory") ? ["sacredMigration", "cultivatedDivineBond"] : ["cultivatedDivineBond", "instinctiveOffering"], seed, channel);
  }

  function beastPracticeAllowed(definition, practiceId) {
    if (definition.intelligenceBand === "sapient") return ["formalDoctrine", "ordainedClergy", "templeCustody", "relicTradition"].includes(practiceId);
    if (definition.intelligenceBand === "reasoning") return ["formalDoctrine", "ritualCustodians", "templeCustody", "relicTradition", "sacredTerritory", "learnedOffering"].includes(practiceId);
    if (definition.intelligenceBand === "cunning") return ["dominanceRite", "sacredHunt", "learnedOffering", "nestTaboo"].includes(practiceId);
    return ["sacredMigration", "cultivatedDivineBond", "instinctiveOffering"].includes(practiceId);
  }

  function worshipPopulationPools(map) {
    StrategicBeastEcology.validatePristineBeastEcology(map);
    StrategicPreUrbanHumanity.validatePreUrbanHumanity(map);
    const humanGroups = StrategicPreUrbanHumanity.expandPopulationGroups(map).map((group) => ({
      kind: "human",
      populationId: group.id,
      populationUnits: group.population,
      practiceOptions: HUMAN_PRACTICES
    }));
    const pristine = StrategicBeastEcology.expandPristineBeastEcology(map);
    const beastGroups = pristine.populations.map((population) => {
      const definition = StrategicBeastEcology.BEAST_SPECIES.find((entry) => entry.id === population.speciesId);
      return {
        kind: "beast",
        populationId: population.id,
        populationUnits: population.devotionalUnitCount,
        speciesId: population.speciesId,
        definition
      };
    });
    return { humanGroups, beastGroups };
  }

  function worshipSource(worldSeed, godId, ordinal, sourcePopulation, remainingUnits) {
    const seed = `${worldSeed}:${godId}:worship:${ordinal}:${sourcePopulation.populationId}`;
    const desiredShare = sourcePopulation.kind === "human"
      ? 35 + integerBetween(seed, "share", 0, 85)
      : 150 + integerBetween(seed, "share", 0, 400);
    const followerUnits = Math.max(1, Math.min(remainingUnits, Math.floor(sourcePopulation.populationUnits * desiredShare / 1000)));
    const practiceId = sourcePopulation.kind === "human"
      ? pick(HUMAN_PRACTICES, seed, "practice")
      : beastPractice(sourcePopulation.definition, seed, "practice");
    return {
      id: `worship:${godId.slice(4)}:${ordinal + 1}`,
      kind: sourcePopulation.kind,
      sourcePopulationId: sourcePopulation.populationId,
      sourcePopulationUnits: sourcePopulation.populationUnits,
      practiceId,
      followerUnits,
      beliefOnlyPopulation: Math.min(sourcePopulation.populationUnits, followerUnits + integerBetween(seed, "belief-only", 0, Math.max(1, Math.floor(sourcePopulation.populationUnits * 0.25)))),
      devotionPermille: integerBetween(seed, "devotion", 420, 940),
      organizationPermille: integerBetween(seed, "organization", sourcePopulation.kind === "human" ? 360 : 180, sourcePopulation.kind === "human" ? 920 : 780),
      ritualInfrastructurePermille: integerBetween(seed, "ritual", sourcePopulation.kind === "human" ? 120 : 20, sourcePopulation.kind === "human" ? 840 : 680),
      offeringPermille: integerBetween(seed, "offerings", 100, 780),
      holySiteSupportPermille: 0,
      coercedWorshipPermille: integerBetween(seed, "coerced", 0, 280),
      receptionEfficiencyPermille: integerBetween(seed, "reception", 650, 1000)
    };
  }

  function allocatePopulationBackedWorship(worldSeed, publicGods, map) {
    const pools = worshipPopulationPools(map);
    const allPopulations = [...pools.humanGroups, ...pools.beastGroups];
    const remaining = new Map(allPopulations.map((population) => [population.populationId, population.populationUnits]));
    const beastDomainGods = publicGods.filter((god) => god.domains.some((domain) => ["beasts", "wilderness", "hunting"].includes(domain)));
    const hiddenGod = [...(beastDomainGods.length ? beastDomainGods : publicGods)]
      .sort((left, right) => seededNumber(worldSeed, `hidden-beast-god:${left.id}`) - seededNumber(worldSeed, `hidden-beast-god:${right.id}`) || left.id.localeCompare(right.id))[0];
    const knownBeastOnlyGod = publicGods.filter((god) => god.id !== hiddenGod.id)
      .sort((left, right) => seededNumber(worldSeed, `known-beast-only-god:${left.id}`) - seededNumber(worldSeed, `known-beast-only-god:${right.id}`) || left.id.localeCompare(right.id))[0];
    const knowledgeRows = [];
    const publicPracticeRows = [];
    const sourcesByGod = {};
    const selectPopulation = (kind, godId, ordinal) => {
      const candidates = (kind === "human" ? pools.humanGroups : pools.beastGroups).filter((population) => remaining.get(population.populationId) > 0);
      if (!candidates.length) throw new Error(`No ${kind} population remains available for ${godId}.`);
      return [...candidates].sort((left, right) => seededNumber(worldSeed, `worship-population:${godId}:${ordinal}:${left.populationId}`) - seededNumber(worldSeed, `worship-population:${godId}:${ordinal}:${right.populationId}`) || left.populationId.localeCompare(right.populationId))[0];
    };
    for (const god of publicGods) {
      const hiddenFromHumans = god.id === hiddenGod.id;
      const beastOnly = hiddenFromHumans || god.id === knownBeastOnlyGod.id;
      const sourceKinds = beastOnly ? ["beast", "beast"] : ["human", seededNumber(worldSeed, `secondary-worship-kind:${god.id}`) < 0.46 ? "beast" : "human"];
      const sources = sourceKinds.map((kind, ordinal) => {
        const population = selectPopulation(kind, god.id, ordinal);
        const source = worshipSource(worldSeed, god.id, ordinal, population, remaining.get(population.populationId));
        remaining.set(population.populationId, remaining.get(population.populationId) - source.followerUnits);
        if (!hiddenFromHumans) {
          const subject = population.kind === "beast" ? population.speciesId : "human";
          const evidence = population.kind === "human" ? "directHumanWorship" : "verifiedBeastPracticeReport";
          if (population.kind === "human" || (god.id === knownBeastOnlyGod.id && ordinal === 0) || seededNumber(worldSeed, `known-practice:${god.id}:${population.populationId}`) > 0.35) publicPracticeRows.push([god.id, WORSHIP_SOURCE_KINDS.indexOf(population.kind), source.practiceId, subject, KNOWLEDGE_EVIDENCE.indexOf(evidence)]);
        }
        return source;
      });
      sourcesByGod[god.id] = sources;
      if (!hiddenFromHumans) {
        const humanSource = sources.find((source) => source.kind === "human");
        const witness = humanSource || selectPopulation("human", god.id, "knowledge-witness");
        const evidence = humanSource ? "directHumanWorship" : (seededNumber(worldSeed, `beast-only-evidence:${god.id}`) < 0.5 ? "authenticatedReply" : "manifestation");
        knowledgeRows.push([god.id, KNOWLEDGE_EVIDENCE.indexOf(evidence), witness.populationId || witness.sourcePopulationId]);
      }
    }
    return { sourcesByGod, hiddenGodId: hiddenGod.id, knowledgeRows, publicPracticeRows };
  }

  function validateWorshipSource(source) {
    const practices = source?.kind === "human" ? HUMAN_PRACTICES : BEAST_PRACTICES;
    if (!source || !WORSHIP_SOURCE_KINDS.includes(source.kind) || !String(source.id || "").startsWith("worship:") || !String(source.sourcePopulationId || "").startsWith(source.kind === "human" ? "human-population:" : "beast-population:") || !Number.isInteger(source.sourcePopulationUnits) || source.sourcePopulationUnits < 1 || !practices.includes(source.practiceId) || !Number.isInteger(source.followerUnits) || source.followerUnits < 0 || source.followerUnits > source.sourcePopulationUnits || !Number.isInteger(source.beliefOnlyPopulation) || source.beliefOnlyPopulation < 0 || source.beliefOnlyPopulation > source.sourcePopulationUnits) throw new Error("A worship source requires a real population, cognition-appropriate practice, and bounded intentional and belief-only populations.");
    for (const key of ["devotionPermille", "organizationPermille", "ritualInfrastructurePermille", "offeringPermille", "holySiteSupportPermille", "coercedWorshipPermille", "receptionEfficiencyPermille"]) {
      if (!Number.isInteger(source[key]) || source[key] < 0 || source[key] > 1000) throw new Error(`Worship source ${source.id} has an invalid ${key}.`);
    }
    return source;
  }

  function worshipPowerFromSource(source) {
    validateWorshipSource(source);
    if (source.followerUnits === 0 || source.devotionPermille === 0) return 0;
    const coercedEfficiencyPermille = 1000 - Math.floor(source.coercedWorshipPermille * 0.7);
    const ritualMultiplierPermille = 500 + Math.floor(source.ritualInfrastructurePermille * 0.5);
    const offeringMultiplierPermille = 600 + Math.floor(source.offeringPermille * 0.4);
    const holySiteMultiplierPermille = 1000 + Math.floor(source.holySiteSupportPermille * 0.35);
    return Math.floor(
      source.followerUnits
      * source.devotionPermille / 1000
      * source.organizationPermille / 1000
      * ritualMultiplierPermille / 1000
      * offeringMultiplierPermille / 1000
      * holySiteMultiplierPermille / 1000
      * coercedEfficiencyPermille / 1000
      * source.receptionEfficiencyPermille / 1000
    );
  }

  function calculateWorshipIncome(sources, receivingCapacity) {
    if (!Array.isArray(sources)) throw new Error("Worship income requires an array of worship sources.");
    const capacity = clampInteger(receivingCapacity, 0, 1000000);
    return Math.min(capacity, sources.reduce((total, source) => total + worshipPowerFromSource(source), 0));
  }

  function rankForSustainablePower(sustainablePower, previousRank = "minor") {
    const power = clampInteger(sustainablePower, 0, 1000000);
    if (previousRank === "major") return power < 620 ? "minor" : "major";
    return power >= 760 ? "major" : "minor";
  }

  function createCanonicalGod(worldSeed, publicGod, sources) {
    const seed = `${worldSeed}:${publicGod.id}:${publicGod.themeContent.definitionId}`;
    const innateCapacity = integerBetween(seed, "innate-capacity", 310, 790);
    const receivingCapacity = integerBetween(seed, "receiving-capacity", 360, 1050);
    const reserveCapacity = integerBetween(seed, "reserve-capacity", 1250, 2800);
    const worshipIncome = calculateWorshipIncome(sources, receivingCapacity);
    const expenditures = {
      existence: integerBetween(seed, "existence-cost", 24, 58),
      communication: integerBetween(seed, "communication-cost", 4, 16),
      miracles: integerBetween(seed, "miracle-cost", 0, 24),
      avatars: integerBetween(seed, "avatar-cost", 0, 18),
      protection: integerBetween(seed, "protection-cost", 2, 22),
      cityInvestment: 0,
      combat: 0
    };
    const reserve = integerBetween(seed, "reserve", Math.floor(reserveCapacity * 0.52), Math.floor(reserveCapacity * 0.94));
    const rank = rankForSustainablePower(innateCapacity + worshipIncome, "minor");
    return {
      id: publicGod.id,
      definitionId: publicGod.themeContent.definitionId,
      stableIdentity: {
        mortalIdentityId: `mortal-origin:${StrategicWorld.stableHash(`${seed}:mortal-identity`)}`,
        originKind: pick(ORIGIN_KINDS, seed, "origin-kind"),
        originPubliclyKnown: false,
        identityContinuity: "continuousThroughAscension"
      },
      domains: [...publicGod.domains],
      objectives: [...publicGod.priorities],
      divineCore: {
        state: "stable",
        innateCapacity,
        receivingCapacity,
        repeatableSignature: `divine-signature:${StrategicWorld.stableHash(`${seed}:signature`)}`,
        identityBound: true
      },
      power: { reserve, reserveCapacity, worshipIncome },
      worshipSources: sources,
      expenditures,
      rank,
      rankThresholds: { riseToMajor: 760, fallToMinor: 620 },
      urbanInterest: pick(URBAN_INTERESTS, seed, "urban-interest"),
      investmentWillingness: pick(INVESTMENT_WILLINGNESS, seed, "investment-willingness"),
      privateObjective: pick(PRIVATE_OBJECTIVES, seed, "private-objective"),
      lifecycle: {
        lifeState: "living",
        divinityState: "divine",
        publicStatus: "active",
        deathPermanent: true,
        canReascendAfterDescent: true
      },
      descendedMortalPower: {
        condition: "dormantWhileDivine",
        remainsExtraordinary: true,
        retainedSources: ["perfectedBody", "ancientSkills", "divineKnowledge", "permanentAscensionChanges"]
      }
    };
  }

  function publicGodState(god) {
    return {
      godId: god.id,
      rank: god.rank,
      publicStatus: god.lifecycle.publicStatus,
      powerCondition: powerCondition(god.power.reserve, god.power.reserveCapacity)
    };
  }

  function publicGodStateRow(god) {
    const state = publicGodState(god);
    return [state.godId, DIVINE_RANKS.indexOf(state.rank), PUBLIC_STATUSES.indexOf(state.publicStatus), POWER_CONDITIONS.indexOf(state.powerCondition)];
  }

  function publicGodStateFromRow(row) {
    return { godId: row[0], rank: DIVINE_RANKS[row[1]], publicStatus: PUBLIC_STATUSES[row[2]], powerCondition: POWER_CONDITIONS[row[3]] };
  }

  function worshipSourceCode(source) {
    validateWorshipSource(source);
    return [
      WORSHIP_SOURCE_KINDS.indexOf(source.kind), source.sourcePopulationId, source.sourcePopulationUnits, source.practiceId, source.followerUnits, source.beliefOnlyPopulation,
      source.devotionPermille, source.organizationPermille, source.ritualInfrastructurePermille,
      source.offeringPermille, source.holySiteSupportPermille, source.coercedWorshipPermille,
      source.receptionEfficiencyPermille
    ].map((value, index) => [1, 3].includes(index) ? value : Number(value).toString(36)).join(".");
  }

  function worshipSourceFromCode(godId, ordinal, code) {
    const values = String(code || "").split(".");
    const source = {
      id: `worship:${godId.slice(4)}:${ordinal + 1}`,
      kind: WORSHIP_SOURCE_KINDS[parseInt(values[0], 36)],
      sourcePopulationId: values[1],
      sourcePopulationUnits: parseInt(values[2], 36),
      practiceId: values[3],
      followerUnits: parseInt(values[4], 36),
      beliefOnlyPopulation: parseInt(values[5], 36),
      devotionPermille: parseInt(values[6], 36),
      organizationPermille: parseInt(values[7], 36),
      ritualInfrastructurePermille: parseInt(values[8], 36),
      offeringPermille: parseInt(values[9], 36),
      holySiteSupportPermille: parseInt(values[10], 36),
      coercedWorshipPermille: parseInt(values[11], 36),
      receptionEfficiencyPermille: parseInt(values[12], 36)
    };
    return validateWorshipSource(source);
  }

  function packCanonicalGod(god) {
    validateCanonicalGod(god);
    return [
      god.definitionId,
      god.stableIdentity.mortalIdentityId.replace("mortal-origin:", ""),
      ORIGIN_KINDS.indexOf(god.stableIdentity.originKind),
      StrategicWorld.stableHash({ domains: god.domains, objectives: god.objectives }),
      [god.divineCore.innateCapacity, god.divineCore.receivingCapacity, god.divineCore.repeatableSignature.replace("divine-signature:", "")],
      [god.power.reserve, god.power.reserveCapacity, god.power.worshipIncome],
      god.worshipSources.map(worshipSourceCode),
      EXPENDITURE_KEYS.map((key) => god.expenditures[key]),
      DIVINE_RANKS.indexOf(god.rank),
      URBAN_INTERESTS.indexOf(god.urbanInterest),
      INVESTMENT_WILLINGNESS.indexOf(god.investmentWillingness),
      PRIVATE_OBJECTIVES.indexOf(god.privateObjective),
      LIFE_STATES.indexOf(god.lifecycle.lifeState),
      DIVINITY_STATES.indexOf(god.lifecycle.divinityState),
      PUBLIC_STATUSES.indexOf(god.lifecycle.publicStatus),
      CORE_STATES.indexOf(god.divineCore.state),
      DESCENDED_CONDITIONS.indexOf(god.descendedMortalPower.condition)
    ];
  }

  function unpackCanonicalGod(godId, row) {
    if (!Array.isArray(row) || row.length !== 17) throw new Error("A packed canonical god row is invalid.");
    const definition = StrategicReligions.DEITY_DEFINITIONS.find((entry) => entry.id === row[0]);
    if (!definition || StrategicWorld.stableHash({ domains: definition.domains, objectives: definition.priorities }) !== row[3]) throw new Error("A packed canonical god no longer matches its authored identity facts.");
    const worshipSources = row[6].map((code, ordinal) => worshipSourceFromCode(godId, ordinal, code));
    return {
      id: godId,
      definitionId: row[0],
      stableIdentity: { mortalIdentityId: `mortal-origin:${row[1]}`, originKind: ORIGIN_KINDS[row[2]], originPubliclyKnown: false, identityContinuity: "continuousThroughAscension" },
      domains: [...definition.domains],
      objectives: [...definition.priorities],
      divineCore: { state: CORE_STATES[row[15]], innateCapacity: row[4][0], receivingCapacity: row[4][1], repeatableSignature: `divine-signature:${row[4][2]}`, identityBound: true },
      power: { reserve: row[5][0], reserveCapacity: row[5][1], worshipIncome: row[5][2] },
      worshipSources,
      expenditures: Object.fromEntries(EXPENDITURE_KEYS.map((key, index) => [key, row[7][index]])),
      rank: DIVINE_RANKS[row[8]],
      rankThresholds: { riseToMajor: 760, fallToMinor: 620 },
      urbanInterest: URBAN_INTERESTS[row[9]],
      investmentWillingness: INVESTMENT_WILLINGNESS[row[10]],
      privateObjective: PRIVATE_OBJECTIVES[row[11]],
      lifecycle: { lifeState: LIFE_STATES[row[12]], divinityState: DIVINITY_STATES[row[13]], publicStatus: PUBLIC_STATUSES[row[14]], deathPermanent: true, canReascendAfterDescent: true },
      descendedMortalPower: { condition: DESCENDED_CONDITIONS[row[16]], remainsExtraordinary: true, retainedSources: ["perfectedBody", "ancientSkills", "divineKnowledge", "permanentAscensionChanges"] }
    };
  }

  function canonicalGods(record) {
    return record.godOrder.map((godId, index) => validateCanonicalGod(unpackCanonicalGod(godId, record.godRows[index])));
  }

  function divinityCore(record) {
    return {
      sourceArcaneGeographyDigest: record.sourceArcaneGeographyDigest,
      sourcePristineBeastEcologyDigest: record.sourcePristineBeastEcologyDigest,
      sourcePreUrbanHumanityDigest: record.sourcePreUrbanHumanityDigest,
      humanReligiousKnowledgeDigest: record.humanReligiousKnowledgeDigest,
      holySiteSupportDigest: record.holySiteSupportDigest,
      worldTheme: record.worldTheme,
      godOrder: record.godOrder,
      godRows: record.godRows,
      diagnostics: record.diagnostics
    };
  }

  function publicDirectoryCore(directory) {
    return {
      worldTheme: directory.worldTheme,
      worshipBasis: directory.worshipBasis,
      exactPowerPublic: directory.exactPowerPublic,
      originPolicy: directory.originPolicy,
      knowledgePolicy: directory.knowledgePolicy,
      humanReligiousKnowledgeDigest: directory.humanReligiousKnowledgeDigest,
      godStateRows: directory.godStateRows,
      knownPracticeRows: directory.knownPracticeRows
    };
  }

  function knowledgeCore(record) {
    return {
      sourcePristineBeastEcologyDigest: record.sourcePristineBeastEcologyDigest,
      sourcePreUrbanHumanityDigest: record.sourcePreUrbanHumanityDigest,
      sourceGodRosterDigest: record.sourceGodRosterDigest,
      knownGodRows: record.knownGodRows,
      practiceEvidenceRows: record.practiceEvidenceRows,
      hiddenGodId: record.hiddenGodId,
      diagnostics: record.diagnostics
    };
  }

  function createPreCivicDivinity(worldSeed, worldTheme, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for pre-civic divinity generation.");
    if (!map?.arcaneGeography?.digest) throw new Error("Arcane geography must exist before pre-civic divinity generation.");
    StrategicBeastEcology.validatePristineBeastEcology(map);
    StrategicPreUrbanHumanity.validatePreUrbanHumanity(map);
    const publicGods = StrategicReligions.createGods(seed, worldTheme);
    const allocation = allocatePopulationBackedWorship(seed, publicGods, map);
    const gods = publicGods.map((god) => createCanonicalGod(seed, god, allocation.sourcesByGod[god.id]));
    const sourceGodRosterDigest = StrategicWorld.stableHash(gods.map((god) => [god.id, god.definitionId]));
    const knowledge = {
      sourcePristineBeastEcologyDigest: map.pristineBeastEcology.digest,
      sourcePreUrbanHumanityDigest: map.preUrbanHumanity.digest,
      sourceGodRosterDigest,
      knownGodRows: allocation.knowledgeRows,
      practiceEvidenceRows: allocation.publicPracticeRows,
      hiddenGodId: allocation.hiddenGodId,
      diagnostics: {
        authenticatedGodCount: allocation.knowledgeRows.length,
        humanUnknownGodCount: gods.length - allocation.knowledgeRows.length,
        beastOnlyUnknownGodCount: 1,
        supportedPracticeCount: allocation.publicPracticeRows.length
      }
    };
    knowledge.digest = `human-religious-knowledge-${StrategicWorld.stableHash(knowledgeCore(knowledge))}`;
    const knownGodIds = new Set(knowledge.knownGodRows.map((row) => row[0]));
    const directory = {
      worldTheme,
      worshipBasis: "intentionalFaithNotMereFactualBelief",
      exactPowerPublic: false,
      originPolicy: "hiddenUnlessDiscovered",
      knowledgePolicy: "omitUnsupportedIdentitiesAndTotals",
      humanReligiousKnowledgeDigest: knowledge.digest,
      godStateRows: gods.filter((god) => knownGodIds.has(god.id)).map(publicGodStateRow),
      knownPracticeRows: clone(knowledge.practiceEvidenceRows)
    };
    directory.digest = `public-divinity-${StrategicWorld.stableHash(publicDirectoryCore(directory))}`;
    const record = {
      sourceArcaneGeographyDigest: map.arcaneGeography.digest,
      sourcePristineBeastEcologyDigest: map.pristineBeastEcology.digest,
      sourcePreUrbanHumanityDigest: map.preUrbanHumanity.digest,
      humanReligiousKnowledgeDigest: knowledge.digest,
      holySiteSupportDigest: null,
      worldTheme,
      godOrder: gods.map((god) => god.id),
      godRows: gods.map(packCanonicalGod),
      publicDirectoryDigest: directory.digest,
      diagnostics: {
        godCount: gods.length,
        livingGodCount: gods.filter((god) => god.lifecycle.lifeState === "living").length,
        divineGodCount: gods.filter((god) => god.lifecycle.divinityState === "divine").length,
        descendedGodCount: 0,
        deadGodCount: 0,
        majorGodCount: gods.filter((god) => god.rank === "major").length,
        holySiteSupportedGodCount: 0,
        humanOriginCount: gods.filter((god) => god.stableIdentity.originKind === "human").length,
        beastOriginCount: gods.filter((god) => god.stableIdentity.originKind === "beast").length
      }
    };
    record.digest = `strategic-divinity-${StrategicWorld.stableHash({ ...divinityCore(record), publicDirectoryDigest: record.publicDirectoryDigest })}`;
    return { strategicDivinity: record, humanReligiousKnowledge: knowledge, publicDirectory: directory };
  }

  function validateCanonicalGod(god) {
    if (!god || !String(god.id || "").startsWith("god:") || !god.definitionId || !LIFE_STATES.includes(god.lifecycle?.lifeState) || !DIVINITY_STATES.includes(god.lifecycle?.divinityState) || !PUBLIC_STATUSES.includes(god.lifecycle?.publicStatus) || !DIVINE_RANKS.includes(god.rank) || !ORIGIN_KINDS.includes(god.stableIdentity?.originKind)) throw new Error("A canonical divine identity or lifecycle is invalid.");
    if (Object.hasOwn(god, "alignment") || JSON.stringify(god).includes("alignmentLabel")) throw new Error("Alignment labels cannot appear in canonical divine records.");
    if (!god.divineCore?.identityBound || !String(god.divineCore?.repeatableSignature || "").startsWith("divine-signature:") || !Number.isInteger(god.divineCore.innateCapacity) || !Number.isInteger(god.divineCore.receivingCapacity)) throw new Error("A god requires an identity-bound finite divine core and repeatable signature.");
    if (!Number.isInteger(god.power?.reserve) || !Number.isInteger(god.power?.reserveCapacity) || god.power.reserve < 0 || god.power.reserve > god.power.reserveCapacity || god.power.worshipIncome !== calculateWorshipIncome(god.worshipSources, god.divineCore.receivingCapacity)) throw new Error("A god's finite power reserve or worship income is invalid.");
    if (!god.expenditures || Object.values(god.expenditures).some((value) => !Number.isInteger(value) || value < 0)) throw new Error("Divine expenditures must be finite non-negative integers.");
    if (god.lifecycle.lifeState === "dead" && (god.lifecycle.divinityState !== "none" || god.power.reserve !== 0) || god.lifecycle.divinityState === "descended" && !god.descendedMortalPower?.remainsExtraordinary) throw new Error("Death, descent, and retained mortal power are inconsistent.");
    if (god.rank !== rankForSustainablePower(god.divineCore.innateCapacity + god.power.worshipIncome, god.rank)) throw new Error("Mutable divine rank does not satisfy its hysteresis thresholds.");
    return god;
  }

  function validatePreCivicDivinity(map, record = map?.strategicDivinity, directory = map?.publicDivinityDirectory) {
    const knowledge = map?.humanReligiousKnowledge;
    if (!record || !directory || !knowledge || !map?.arcaneGeography?.digest || record.sourceArcaneGeographyDigest !== map.arcaneGeography.digest || record.sourcePristineBeastEcologyDigest !== map.pristineBeastEcology?.digest || record.sourcePreUrbanHumanityDigest !== map.preUrbanHumanity?.digest || record.humanReligiousKnowledgeDigest !== knowledge.digest || directory.humanReligiousKnowledgeDigest !== knowledge.digest || record.publicDirectoryDigest !== directory.digest || record.worldTheme !== directory.worldTheme) throw new Error("Pre-civic divinity records are incomplete or do not match their population-backed source world.");
    if (!Array.isArray(record.godOrder) || record.godOrder.length < 6 || new Set(record.godOrder).size !== record.godOrder.length || !Array.isArray(record.godRows) || record.godRows.length !== record.godOrder.length) throw new Error("The canonical god roster is incomplete or unstable.");
    const gods = canonicalGods(record);
    const humanGroups = StrategicPreUrbanHumanity.expandPopulationGroups(map);
    const pristine = StrategicBeastEcology.expandPristineBeastEcology(map);
    const populations = new Map([
      ...humanGroups.map((group) => [group.id, { kind: "human", units: group.population }]),
      ...pristine.populations.map((population) => [population.id, { kind: "beast", units: population.devotionalUnitCount, speciesId: population.speciesId }])
    ]);
    const assigned = new Map();
    for (const god of gods) {
      if (!god.worshipSources.some((source) => source.followerUnits > 0 && source.devotionPermille > 0)) throw new Error("Every initially active god requires deliberate population-backed worship.");
      for (const source of god.worshipSources) {
        const population = populations.get(source.sourcePopulationId);
        if (!population || population.kind !== source.kind || source.sourcePopulationUnits !== population.units) throw new Error("A worship cohort does not match its saved source population.");
        if (source.kind === "beast") {
          const definition = StrategicBeastEcology.BEAST_SPECIES.find((entry) => entry.id === population.speciesId);
          if (!definition || !beastPracticeAllowed(definition, source.practiceId)) throw new Error("A beast worship practice exceeds its species' cognition or social behavior.");
        }
        assigned.set(source.sourcePopulationId, (assigned.get(source.sourcePopulationId) || 0) + source.followerUnits);
      }
    }
    if ([...assigned].some(([populationId, units]) => units > populations.get(populationId).units)) throw new Error("Worship cohorts exceed their source population.");
    if (knowledge.sourcePristineBeastEcologyDigest !== map.pristineBeastEcology.digest || knowledge.sourcePreUrbanHumanityDigest !== map.preUrbanHumanity.digest || knowledge.sourceGodRosterDigest !== StrategicWorld.stableHash(gods.map((god) => [god.id, god.definitionId])) || knowledge.digest !== `human-religious-knowledge-${StrategicWorld.stableHash(knowledgeCore(knowledge))}`) throw new Error("Human religious knowledge does not match canonical populations and gods.");
    const knownGodIds = new Set((knowledge.knownGodRows || []).map((row) => row[0]));
    if (!Array.isArray(knowledge.knownGodRows) || new Set(knowledge.knownGodRows.map((row) => row[0])).size !== knowledge.knownGodRows.length || knowledge.knownGodRows.some((row) => !record.godOrder.includes(row[0]) || !KNOWLEDGE_EVIDENCE[row[1]] || !populations.has(row[2]) || populations.get(row[2]).kind !== "human") || !record.godOrder.includes(knowledge.hiddenGodId) || knownGodIds.has(knowledge.hiddenGodId)) throw new Error("Human religious identity evidence is invalid.");
    const hiddenGod = gods.find((god) => god.id === knowledge.hiddenGodId);
    if (!hiddenGod || hiddenGod.worshipSources.some((source) => source.kind !== "beast") || gods.filter((god) => !knownGodIds.has(god.id)).length !== 1) throw new Error("A sufficiently populated world requires exactly one initially human-unknown beast-only god.");
    const godById = new Map(gods.map((god) => [god.id, god]));
    const practiceEvidenceSupported = (row) => {
      const god = godById.get(row[0]);
      const kind = WORSHIP_SOURCE_KINDS[row[1]];
      const evidence = KNOWLEDGE_EVIDENCE[row[4]];
      if (!god || !knownGodIds.has(god.id) || !kind || ![...HUMAN_PRACTICES, ...BEAST_PRACTICES].includes(row[2]) || (kind === "human" ? evidence !== "directHumanWorship" || row[3] !== "human" : evidence !== "verifiedBeastPracticeReport")) return false;
      return god.worshipSources.some((source) => source.kind === kind && source.practiceId === row[2] && (kind === "human" || populations.get(source.sourcePopulationId)?.speciesId === row[3]));
    };
    if (!Array.isArray(knowledge.practiceEvidenceRows) || knowledge.practiceEvidenceRows.some((row) => !practiceEvidenceSupported(row))) throw new Error("Supported public religious-practice evidence is invalid.");
    const knownBeastOnlyGods = gods.filter((god) => knownGodIds.has(god.id) && god.worshipSources.every((source) => source.kind === "beast"));
    if (!knownBeastOnlyGods.some((god) => knowledge.knownGodRows.some((row) => row[0] === god.id && ["authenticatedReply", "manifestation"].includes(KNOWLEDGE_EVIDENCE[row[1]])) && knowledge.practiceEvidenceRows.some((row) => row[0] === god.id && WORSHIP_SOURCE_KINDS[row[1]] === "beast"))) throw new Error("At least one beast-only god must be human-known through authenticated contact and supported practice evidence.");
    const expectedGodRows = gods.filter((god) => knownGodIds.has(god.id)).map(publicGodStateRow);
    if (!Array.isArray(directory.godStateRows) || directory.worshipBasis !== "intentionalFaithNotMereFactualBelief" || directory.exactPowerPublic !== false || directory.originPolicy !== "hiddenUnlessDiscovered" || directory.knowledgePolicy !== "omitUnsupportedIdentitiesAndTotals" || JSON.stringify(directory.godStateRows) !== JSON.stringify(expectedGodRows) || JSON.stringify(directory.knownPracticeRows) !== JSON.stringify(knowledge.practiceEvidenceRows) || JSON.stringify(directory).match(/reserveCapacity|privateObjective|mortalIdentityId|sourcePopulationId|followerUnits|hiddenGodId|Unknown Monster/i)) throw new Error("The public divinity projection is invalid or leaks hidden state or unsupported identities.");
    const diagnostics = record.diagnostics;
    if (!diagnostics || diagnostics.godCount !== gods.length || diagnostics.livingGodCount !== gods.filter((god) => god.lifecycle.lifeState === "living").length || diagnostics.divineGodCount !== gods.filter((god) => god.lifecycle.divinityState === "divine").length || diagnostics.majorGodCount !== gods.filter((god) => god.rank === "major").length || diagnostics.holySiteSupportedGodCount !== gods.filter((god) => god.worshipSources.some((source) => source.holySiteSupportPermille > 0)).length) throw new Error("Divinity diagnostics do not match canonical facts.");
    if (!knowledge.diagnostics || knowledge.diagnostics.authenticatedGodCount !== knownGodIds.size || knowledge.diagnostics.humanUnknownGodCount !== gods.length - knownGodIds.size || knowledge.diagnostics.beastOnlyUnknownGodCount !== 1 || knowledge.diagnostics.supportedPracticeCount !== knowledge.practiceEvidenceRows.length) throw new Error("Human religious knowledge diagnostics do not match canonical facts.");
    if (directory.digest !== `public-divinity-${StrategicWorld.stableHash(publicDirectoryCore(directory))}` || record.digest !== `strategic-divinity-${StrategicWorld.stableHash({ ...divinityCore(record), publicDirectoryDigest: record.publicDirectoryDigest })}`) throw new Error("Divinity records do not match their digests.");
    return { strategicDivinity: clone(record), publicDirectory: clone(directory) };
  }

  function attachPreCivicDivinity(worldSeed, worldTheme, map) {
    const next = StrategicWorld.validateStrategicMap(map);
    const generated = createPreCivicDivinity(worldSeed, worldTheme, next);
    next.strategicDivinity = generated.strategicDivinity;
    next.humanReligiousKnowledge = generated.humanReligiousKnowledge;
    next.publicDivinityDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function applyHolySiteSupport(map, supportByGod) {
    const next = StrategicWorld.validateStrategicMap(map);
    const { strategicDivinity, publicDirectory } = validatePreCivicDivinity(next);
    if (!supportByGod || typeof supportByGod !== "object" || Array.isArray(supportByGod)) throw new Error("Holy-site support requires one bounded value per canonical god.");
    const gods = canonicalGods(strategicDivinity);
    const normalizedSupport = {};
    for (const god of gods) {
      const support = clampInteger(supportByGod[god.id], 0, 1000);
      normalizedSupport[god.id] = support;
      god.worshipSources = god.worshipSources.map((source, ordinal) => ({
        ...source,
        holySiteSupportPermille: Math.max(0, support - ordinal * 35)
      }));
      god.power.worshipIncome = calculateWorshipIncome(god.worshipSources, god.divineCore.receivingCapacity);
      god.rank = rankForSustainablePower(god.divineCore.innateCapacity + god.power.worshipIncome, god.rank);
    }
    const directory = clone(publicDirectory);
    const knownGodIds = new Set(next.humanReligiousKnowledge.knownGodRows.map((row) => row[0]));
    directory.godStateRows = gods.filter((god) => knownGodIds.has(god.id)).map(publicGodStateRow);
    delete directory.digest;
    directory.digest = `public-divinity-${StrategicWorld.stableHash(publicDirectoryCore(directory))}`;
    const record = clone(strategicDivinity);
    record.holySiteSupportDigest = `holy-site-support-${StrategicWorld.stableHash(normalizedSupport)}`;
    record.godRows = gods.map(packCanonicalGod);
    record.publicDirectoryDigest = directory.digest;
    record.diagnostics.majorGodCount = gods.filter((god) => god.rank === "major").length;
    record.diagnostics.holySiteSupportedGodCount = gods.filter((god) => god.worshipSources.some((source) => source.holySiteSupportPermille > 0)).length;
    delete record.digest;
    record.digest = `strategic-divinity-${StrategicWorld.stableHash({ ...divinityCore(record), publicDirectoryDigest: record.publicDirectoryDigest })}`;
    next.strategicDivinity = record;
    next.publicDivinityDirectory = directory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function totalExpenditure(expenditures, includeExistence = true) {
    return Object.entries(expenditures || {}).reduce((total, [key, value]) => total + (key === "existence" && !includeExistence ? 0 : clampInteger(value, 0, 1000000)), 0);
  }

  function forceDivineDescent(candidate, options = {}) {
    const god = clone(validateCanonicalGod(clone(candidate)));
    if (god.lifecycle.lifeState === "dead") throw new Error("Permanent divine death cannot be converted into descent.");
    if (god.lifecycle.divinityState !== "divine") throw new Error("Only a living divine being can be forced into descent.");
    const releasedPower = god.power.reserve;
    god.lifecycle.divinityState = "descended";
    god.lifecycle.publicStatus = options.publiclyObserved ? "fallen" : "silent";
    god.divineCore.state = "dormant";
    god.power.reserve = 0;
    god.descendedMortalPower.condition = "activeFormerGod";
    return { god, releasedPower, lifePreserved: true, identityPreserved: true };
  }

  function advanceDivineCycle(candidate, options = {}) {
    const god = clone(validateCanonicalGod(clone(candidate)));
    if (god.lifecycle.lifeState === "dead") throw new Error("Permanent divine death cannot be advanced back into life or divinity.");
    const sources = clone(options.worshipSources || god.worshipSources);
    const expenditures = { ...god.expenditures, ...(options.expenditures || {}) };
    sources.forEach(validateWorshipSource);
    const income = calculateWorshipIncome(sources, god.divineCore.receivingCapacity);
    const hasIntentionalWorship = sources.some((source) => source.followerUnits > 0 && source.devotionPermille > 0);
    god.worshipSources = sources;
    god.expenditures = expenditures;
    god.power.worshipIncome = income;
    god.rank = rankForSustainablePower(god.divineCore.innateCapacity + income, god.rank);
    if (god.lifecycle.divinityState === "divine") {
      const expense = totalExpenditure(expenditures, true);
      god.power.reserve = clampInteger(god.power.reserve + income - expense, 0, god.power.reserveCapacity);
      if (!hasIntentionalWorship || god.power.reserve === 0 && income < expenditures.existence) {
        return forceDivineDescent(god, options).god;
      } else if (god.power.reserve < god.power.reserveCapacity * 0.35) {
        god.lifecycle.publicStatus = "diminished";
      }
    }
    return god;
  }

  function restoreDescendedDivinity(candidate, rite = {}) {
    const god = clone(validateCanonicalGod(clone(candidate)));
    if (god.lifecycle.lifeState === "dead") throw new Error("Permanent divine death cannot be reversed by worship or reascension.");
    if (god.lifecycle.divinityState !== "descended") throw new Error("Only a living descended god can reascend through this operation.");
    const sources = clone(rite.worshipSources || god.worshipSources);
    const income = calculateWorshipIncome(sources, god.divineCore.receivingCapacity);
    if (!rite.catalyst || !rite.identityStable || !rite.coreReconstructed || income < god.expenditures.existence * 2) throw new Error("Reascension requires a catalyst, stable identity, reconstructed divine core, and sustainable deliberate worship.");
    god.worshipSources = sources;
    god.power.worshipIncome = income;
    god.power.reserve = Math.min(god.power.reserveCapacity, Math.max(god.expenditures.existence * 3, Math.floor(income / 2)));
    god.divineCore.state = "stable";
    god.lifecycle.divinityState = "divine";
    god.lifecycle.publicStatus = rite.publiclyObserved ? "active" : "missing";
    god.descendedMortalPower.condition = "dormantWhileDivine";
    god.rank = rankForSustainablePower(god.divineCore.innateCapacity + income, god.rank);
    return god;
  }

  function ascendMortal(candidate, rite = {}) {
    if (!candidate?.id || !ORIGIN_KINDS.includes(candidate.originKind) || !candidate.stableIdentity || !candidate.transcendentPower || !candidate.soulStable || !candidate.survivesTransformation || !rite.catalyst || !rite.viableDivineCore || !rite.repeatableSignature || !Array.isArray(rite.worshipSources) || calculateWorshipIncome(rite.worshipSources, rite.receivingCapacity) <= 0) throw new Error("Ascension requires a stable mortal identity, transcendent power, soul stability, survival, a catalyst, a viable core, deliberate worship, and a repeatable signature.");
    const id = `god:ascended:${StrategicWorld.stableHash(`${candidate.id}:${rite.repeatableSignature}`)}`;
    const receivingCapacity = clampInteger(rite.receivingCapacity, 1, 1000000);
    const income = calculateWorshipIncome(rite.worshipSources, receivingCapacity);
    const ascended = {
      id,
      definitionId: "ascended.dynamic",
      stableIdentity: { mortalIdentityId: candidate.id, originKind: candidate.originKind, originPubliclyKnown: Boolean(rite.originPubliclyKnown), identityContinuity: "continuousThroughAscension" },
      domains: [...(rite.domains || [])],
      objectives: [...(rite.objectives || [])],
      divineCore: { state: "stable", innateCapacity: clampInteger(candidate.transcendentPower, 1, 1000000), receivingCapacity, repeatableSignature: rite.repeatableSignature, identityBound: true },
      power: { reserve: Math.min(clampInteger(rite.reserveCapacity, 1, 1000000), Math.max(1, Math.floor(income / 2))), reserveCapacity: clampInteger(rite.reserveCapacity, 1, 1000000), worshipIncome: income },
      worshipSources: clone(rite.worshipSources),
      expenditures: { existence: clampInteger(rite.existenceCost, 1, 1000000), communication: 0, miracles: 0, avatars: 0, protection: 0, cityInvestment: 0, combat: 0 },
      rank: "minor",
      rankThresholds: { riseToMajor: 760, fallToMinor: 620 },
      urbanInterest: rite.urbanInterest || "indifferent",
      investmentWillingness: rite.investmentWillingness || "none",
      privateObjective: rite.privateObjective || "accumulatePower",
      lifecycle: { lifeState: "living", divinityState: "divine", publicStatus: rite.publiclyObserved ? "active" : "missing", deathPermanent: true, canReascendAfterDescent: true },
      descendedMortalPower: { condition: "dormantWhileDivine", remainsExtraordinary: true, retainedSources: ["transcendentBody", "mortalSkills", "divineKnowledge", "permanentAscensionChanges"] }
    };
    ascended.rank = rankForSustainablePower(ascended.divineCore.innateCapacity + ascended.power.worshipIncome, "minor");
    return clone(validateCanonicalGod(ascended));
  }

  function resolveDivineCombat(attacker, defender, context = {}) {
    validateCanonicalGod(attacker);
    validateCanonicalGod(defender);
    if (attacker.lifecycle.lifeState === "dead" || defender.lifecycle.lifeState === "dead") throw new Error("Dead beings cannot initiate or defend divine combat.");
    const score = (combatant, opponent, side) => {
      const committedReserve = Math.min(combatant.power.reserve, clampInteger(context[`${side}CommittedPower`] ?? combatant.power.reserve, 0, combatant.power.reserveCapacity));
      const domainAffinity = combatant.domains.filter((domain) => (context.environmentDomains || []).includes(domain)).length * 90;
      const opposedDomains = combatant.domains.filter((domain) => opponent.domains.includes(domain)).length * 25;
      return combatant.divineCore.innateCapacity + committedReserve + domainAffinity + opposedDomains
        + clampInteger(context[`${side}HolySitePower`], 0, 1000000)
        + clampInteger(context[`${side}AllyPower`], 0, 1000000)
        + clampInteger(context[`${side}Preparation`], 0, 1000000)
        + clampInteger(context[`${side}Surprise`], 0, 1000000)
        - clampInteger(context[`${side}ManifestationCost`], 0, 1000000);
    };
    const attackerScore = score(attacker, defender, "attacker");
    const defenderScore = score(defender, attacker, "defender");
    const tieBreaksForAttacker = seededNumber(context.seed || `${attacker.id}:${defender.id}`, "combat-tie") >= 0.5;
    const attackerWins = attackerScore === defenderScore ? tieBreaksForAttacker : attackerScore > defenderScore;
    return {
      winnerId: attackerWins ? attacker.id : defender.id,
      loserId: attackerWins ? defender.id : attacker.id,
      attackerScore,
      defenderScore,
      margin: Math.abs(attackerScore - defenderScore),
      outcomeOptions: ["retreat", "forcedDescent", "death"],
      deathAutomatic: false
    };
  }

  function resolveDivineDeath(victimCandidate, victorCandidate = null, options = {}) {
    const victim = clone(validateCanonicalGod(clone(victimCandidate)));
    if (victim.lifecycle.lifeState === "dead") throw new Error("Divine death is permanent and cannot occur twice.");
    const available = victim.power.reserve;
    const capturePermille = clampInteger(options.capturePermille ?? 250, 0, 650);
    const capturedPower = victorCandidate ? Math.floor(available * capturePermille / 1000) : 0;
    const remainsPower = Math.floor((available - capturedPower) * 0.4);
    const dissipatedPower = available - capturedPower - remainsPower;
    victim.lifecycle.lifeState = "dead";
    victim.lifecycle.divinityState = "none";
    victim.lifecycle.publicStatus = options.publiclyConfirmed ? "confirmedDead" : "missing";
    victim.divineCore.state = "destroyed";
    victim.power.reserve = 0;
    const victor = victorCandidate ? clone(validateCanonicalGod(clone(victorCandidate))) : null;
    if (victor) victor.power.reserve = Math.min(victor.power.reserveCapacity, victor.power.reserve + capturedPower);
    return {
      victim,
      victor,
      remains: { formerGodId: victim.id, identityPreserved: true, power: remainsPower, kinds: ["divineRemains", "relicPotential", "siteResidue"] },
      capturedPower,
      dissipatedPower,
      identityTransferred: false,
      religionTransferred: false
    };
  }

  function privateDivineStateFor(map, godId) {
    const record = map?.strategicDivinity;
    const index = record?.godOrder?.indexOf(godId) ?? -1;
    const god = index >= 0 ? unpackCanonicalGod(godId, record.godRows[index]) : null;
    return god ? clone(god) : null;
  }

  function publicDivinityDirectory(map) {
    const directory = map?.publicDivinityDirectory;
    if (!directory) return null;
    return {
      worldTheme: directory.worldTheme,
      worshipBasis: directory.worshipBasis,
      exactPowerPublic: directory.exactPowerPublic,
      originPolicy: directory.originPolicy,
      knowledgePolicy: directory.knowledgePolicy,
      godStates: directory.godStateRows.map(publicGodStateFromRow),
      knownPractices: directory.knownPracticeRows.map((row) => ({ godId: row[0], sourceKind: WORSHIP_SOURCE_KINDS[row[1]], practiceId: row[2], subjectId: row[3], evidence: KNOWLEDGE_EVIDENCE[row[4]], exactFollowerCountPublic: false, sourcePopulationIdentityPublic: false })),
      digest: directory.digest
    };
  }

  function auditPreCivicDivinity(map) {
    const { strategicDivinity, publicDirectory } = validatePreCivicDivinity(map);
    const gods = canonicalGods(strategicDivinity);
    return {
      valid: true,
      independentOfCities: !strategicDivinity.sourceCityDigest,
      allInitiallyLivingAndDivine: gods.every((god) => god.lifecycle.lifeState === "living" && god.lifecycle.divinityState === "divine"),
      worshipRequiresIntentionalFaith: gods.every((god) => god.worshipSources.every((source) => source.beliefOnlyPopulation >= 0) && god.power.worshipIncome === calculateWorshipIncome(god.worshipSources, god.divineCore.receivingCapacity)),
      everyCohortPopulationBacked: gods.every((god) => god.worshipSources.every((source) => source.sourcePopulationId && source.followerUnits <= source.sourcePopulationUnits)),
      humanDirectoryOmitsUnsupportedGods: publicDirectory.godStateRows.length < gods.length && !publicDirectory.godStateRows.some((row) => row[0] === map.humanReligiousKnowledge.hiddenGodId),
      beastOnlyUnknownGodPreserved: gods.find((god) => god.id === map.humanReligiousKnowledge.hiddenGodId)?.worshipSources.every((source) => source.kind === "beast") === true,
      publicPracticesHideExactAllocations: !JSON.stringify(publicDirectory).match(/sourcePopulationId|followerUnits|sourcePopulationUnits/),
      exactPowerHiddenFromPublic: !JSON.stringify(publicDirectory).includes("reserve") && !JSON.stringify(publicDirectory).includes("receivingCapacity"),
      originsHiddenFromPublic: publicDirectory.originPolicy === "hiddenUnlessDiscovered",
      alignmentAbsent: !JSON.stringify(strategicDivinity).toLowerCase().includes("alignment"),
      diagnostics: clone(strategicDivinity.diagnostics)
    };
  }

  return Object.freeze({
    LIFE_STATES,
    DIVINITY_STATES,
    PUBLIC_STATUSES,
    DIVINE_RANKS,
    ORIGIN_KINDS,
    WORSHIP_SOURCE_KINDS,
    HUMAN_PRACTICES,
    BEAST_PRACTICES,
    KNOWLEDGE_EVIDENCE,
    POWER_CONDITIONS,
    worshipPowerFromSource,
    calculateWorshipIncome,
    rankForSustainablePower,
    createPreCivicDivinity,
    validatePreCivicDivinity,
    attachPreCivicDivinity,
    applyHolySiteSupport,
    forceDivineDescent,
    advanceDivineCycle,
    restoreDescendedDivinity,
    ascendMortal,
    resolveDivineCombat,
    resolveDivineDeath,
    privateDivineStateFor,
    publicDivinityDirectory,
    auditPreCivicDivinity
  });
});
