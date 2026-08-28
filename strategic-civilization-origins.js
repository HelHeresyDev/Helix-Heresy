(function initStrategicCivilizationOrigins(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const resourcePotential = typeof module === "object" && module.exports ? require("./strategic-resource-potential") : root?.HelixStrategicResourcePotential;
  const humanGeography = typeof module === "object" && module.exports ? require("./strategic-human-geography") : root?.HelixStrategicHumanGeography;
  const preUrbanHumanity = typeof module === "object" && module.exports ? require("./strategic-pre-urban-humanity") : root?.HelixStrategicPreUrbanHumanity;
  const divinity = typeof module === "object" && module.exports ? require("./strategic-divinity") : root?.HelixStrategicDivinity;
  const faiths = typeof module === "object" && module.exports ? require("./strategic-faiths") : root?.HelixStrategicFaiths;
  const religions = typeof module === "object" && module.exports ? require("./strategic-religions") : root?.HelixStrategicReligions;
  const api = factory(strategicWorld, resourcePotential, humanGeography, preUrbanHumanity, divinity, faiths, religions);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicCivilizationOrigins = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicCivilizationOriginsApi(StrategicWorld, StrategicResourcePotential, StrategicHumanGeography, StrategicPreUrbanHumanity, StrategicDivinity, StrategicFaiths, StrategicReligions) {
  "use strict";

  if (!StrategicWorld || !StrategicResourcePotential || !StrategicHumanGeography || !StrategicPreUrbanHumanity || !StrategicDivinity || !StrategicFaiths || !StrategicReligions) throw new Error("Civilization-origin dependencies must load before strategic-civilization-origins.js");

  const ORIGIN_OUTCOMES = Object.freeze(["enduringCity", "retainedFailure"]);
  const CANONICAL_MOTIVES = Object.freeze(["protectFollowers", "secureResource", "organizeWorship", "competitiveEmulation", "denyRivalInfluence", "proveUrbanDoctrine", "expandDomainWork"]);
  const DIVINE_ASSISTANCE = Object.freeze(["constructionWards", "beastSuppression", "engineeringInstruction", "coordinatedLabor", "weatherShelter", "healingAndSanitation", "earthShaping", "authenticatedPlanning"]);
  const FAILURE_CONSEQUENCES = Object.freeze(["abandonedFortifications", "displacedFounders", "scarredHolyGround", "divineBattleDamage", "unfinishedWardComplex"]);
  const FAILURE_CAUSES = Object.freeze(["beastAssault", "founderCasualties", "divineInterference", "wardCascade", "populationWithdrawal", "constructionDisaster"]);
  const FOUNDER_CAPABILITIES = Object.freeze(["wardEngineering", "battlefieldProtection", "constructionSorcery", "logisticalCommand", "healingArts", "earthShaping", "beastDefense", "resourceEngineering"]);
  const FOUNDER_AFFILIATIONS = Object.freeze(["chosenRepresentative", "divinelyInvestedChampion", "godAffiliatedHero"]);
  const CIVIC_RELATIONS = Object.freeze(["sovereignIsFoundingPower", "foundingPowerSupportsSovereign", "foundingCircleSharesAuthority"]);
  const MATERIAL_REQUIREMENTS = Object.freeze([
    Object.freeze({ id: "freshWater", minimum: 330 }),
    Object.freeze({ id: "biologicalProductivity", minimum: 290 }),
    Object.freeze({ id: "constructionStone", minimum: 270 }),
    Object.freeze({ id: "timberFiber", minimum: 120 }),
    Object.freeze({ id: "ferrousOre", minimum: 100 })
  ]);
  const PURPOSE_FAMILIES = Object.freeze(StrategicResourcePotential.RESOURCE_FAMILIES.filter((family) => !["freshWater", "biologicalProductivity"].includes(family.id)));
  const NAME_OPENINGS = Object.freeze(["Ari", "Bel", "Cor", "Dae", "Eli", "Fara", "Galen", "Hes", "Ily", "Jora", "Kael", "Lys", "Mara", "Neris", "Orin", "Pella", "Rhea", "Soren", "Tavi", "Vela"]);
  const NAME_ENDINGS = Object.freeze(["a", "an", "as", "en", "eth", "ia", "in", "is", "on", "or", "ra", "ren", "us", "yn"]);

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
  function seededNumber(seed, channel) { return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff; }
  function integerBetween(seed, channel, minimum, maximum) { return minimum + Math.floor(seededNumber(seed, channel) * (maximum - minimum + 1)); }
  function pick(values, seed, channel) { return values[Math.floor(seededNumber(seed, channel) * values.length) % values.length]; }

  function localLandIndices(map, originIndex, maximumDistance = 2) {
    const topology = StrategicWorld.topologyForMap(map);
    const queue = [{ index: originIndex, distance: 0 }];
    const seen = new Set([originIndex]);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      if (current.distance >= maximumDistance) continue;
      for (const neighbor of topology.neighbors[current.index]) {
        if (seen.has(neighbor) || map.surface.classes[neighbor] !== "L") continue;
        seen.add(neighbor);
        queue.push({ index: neighbor, distance: current.distance + 1 });
      }
    }
    return [...seen];
  }

  function siteFacts(map, index, worldSeed) {
    const local = localLandIndices(map, index);
    const maximum = (familyId) => Math.max(...local.map((cellIndex) => map.resourcePotential.potentialPermille[familyId][cellIndex]));
    const materialRows = MATERIAL_REQUIREMENTS.map((requirement) => [requirement.id, maximum(requirement.id), requirement.minimum]);
    const purpose = PURPOSE_FAMILIES.map((family) => ({ family, value: maximum(family.id) }))
      .sort((left, right) => right.value - left.value || left.family.id.localeCompare(right.family.id))[0];
    const materialFloor = Math.min(...materialRows.map((row) => row[1] - row[2]));
    return {
      index,
      purposeId: purpose.family.id,
      purposeValue: purpose.value,
      materialRows,
      viable: materialFloor >= 0,
      score: StrategicHumanGeography.citySuitabilityPermille(map, index, worldSeed) * 0.72 + purpose.value * 0.2 + clamp(materialFloor + 300, 0, 600) * 0.08
    };
  }

  function urbanInterestScore(value) { return ({ opposed: 0, indifferent: 1, conditional: 2, interested: 3, committed: 4 })[value] ?? 0; }
  function investmentScore(value) { return ({ none: 0, limited: 1, measured: 2, substantial: 3 })[value] ?? 0; }

  function qualifiedGodRows(worldSeed, map, groupsById) {
    const publicGodById = new Map(StrategicReligions.createGods(worldSeed, map.strategicDivinity.worldTheme).map((god) => [god.id, god]));
    return map.strategicDivinity.godOrder.flatMap((godId) => {
      const state = StrategicDivinity.privateDivineStateFor(map, godId);
      const humanSources = state.worshipSources.filter((source) => source.kind === "human" && groupsById.has(source.sourcePopulationId));
      if (!humanSources.length) return [];
      const organization = Math.max(...humanSources.map((source) => source.organizationPermille));
      const followers = humanSources.reduce((total, source) => total + source.followerUnits, 0);
      const interest = urbanInterestScore(state.urbanInterest);
      const investment = investmentScore(state.investmentWillingness);
      const score = interest * 520 + investment * 430 + organization * 0.7 + Math.min(900, followers) * 0.35 + state.power.reserve * 0.22 + seededNumber(worldSeed, `origin-god:${godId}`) * 260;
      return [{ god: publicGodById.get(godId), state, humanSources, interest, investment, score }];
    }).filter((entry) => entry.god).sort((left, right) => right.score - left.score || left.god.id.localeCompare(right.god.id));
  }

  function candidateSites(worldSeed, map, godRow, groupsById, remainingPopulation, occupiedIndices, minimumSpacingKm, requireViable) {
    const groupIds = godRow.humanSources.map((source) => source.sourcePopulationId);
    const candidates = new Map();
    for (const groupId of groupIds) {
      const group = groupsById.get(groupId);
      if (!group || (remainingPopulation.get(groupId) || 0) < 300) continue;
      for (const cellId of group.rangeCellIds) {
        const index = StrategicWorld.cellIndex(cellId);
        const region = map.surface.regions[map.surface.regionByCell[index]];
        if (!region || region.surfaceClass !== "land" || region.cellCount < 12) continue;
        if (occupiedIndices.some((otherIndex) => StrategicWorld.greatCircleDistanceKm(map, index, otherIndex) < minimumSpacingKm)) continue;
        if (!candidates.has(index)) candidates.set(index, siteFacts(map, index, worldSeed));
      }
    }
    return [...candidates.values()].map((site) => ({
      ...site,
      availablePopulation: [...groupsById.values()].filter((group) => group.rangeCellIds.includes(StrategicWorld.cellId(site.index))).reduce((total, group) => total + (remainingPopulation.get(group.id) || 0), 0)
    })).filter((site) => (!requireViable || site.viable) && site.availablePopulation >= (requireViable ? 800 : 300))
      .sort((left, right) => right.score - left.score || left.index - right.index);
  }

  function generatedFounderName(worldSeed, attemptOrdinal, founderOrdinal, usedNames) {
    const channel = `origin-founder-name:${attemptOrdinal}:${founderOrdinal}`;
    const base = `${pick(NAME_OPENINGS, worldSeed, `${channel}:opening`)}${pick(NAME_ENDINGS, worldSeed, `${channel}:ending`)}`;
    let name = base;
    let suffix = 2;
    while (usedNames.has(name)) { name = `${base} ${suffix}`; suffix += 1; }
    usedNames.add(name);
    return name;
  }

  function allocateFoundingPopulation(seed, outcome, godRow, site, groupsById, remainingPopulation) {
    const patronGroupIds = new Set(godRow.humanSources.map((source) => source.sourcePopulationId));
    const eligible = [...groupsById.values()]
      .filter((group) => group.rangeCellIds.includes(StrategicWorld.cellId(site.index)) && (remainingPopulation.get(group.id) || 0) > 0)
      .sort((left, right) => Number(patronGroupIds.has(right.id)) - Number(patronGroupIds.has(left.id)) || (remainingPopulation.get(right.id) || 0) - (remainingPopulation.get(left.id) || 0) || left.id.localeCompare(right.id));
    const available = eligible.reduce((total, group) => total + remainingPopulation.get(group.id), 0);
    const desired = outcome === "enduringCity" ? integerBetween(seed, "founding-population", 1800, 5200) : integerBetween(seed, "founding-population", 600, 2200);
    let needed = Math.min(available, desired);
    const rows = [];
    for (const group of eligible.slice(0, 3)) {
      if (needed <= 0) break;
      const allocation = Math.min(remainingPopulation.get(group.id), needed);
      if (allocation > 0) {
        rows.push([group.id, allocation]);
        remainingPopulation.set(group.id, remainingPopulation.get(group.id) - allocation);
        needed -= allocation;
      }
    }
    return rows;
  }

  function populationBand(population) {
    if (population < 1000) return "expedition";
    if (population < 2500) return "smallFoundingPopulation";
    if (population < 4500) return "substantialFoundingPopulation";
    return "massFoundingPopulation";
  }

  function materialBand(value, minimum) {
    const ratio = value / Math.max(1, minimum);
    return ratio >= 2.2 ? "abundant" : (ratio >= 1.45 ? "strong" : (ratio >= 1 ? "adequate" : "insufficient"));
  }

  function createAttempt(worldSeed, map, godRow, ordinal, year, outcome, site, groupsById, remainingPopulation, usedFounderNames, usedCityNames) {
    const seed = `${worldSeed}:civilization-origin:${ordinal}`;
    const sourcePopulationRows = allocateFoundingPopulation(seed, outcome, godRow, site, groupsById, remainingPopulation);
    const initialPopulation = sourcePopulationRows.reduce((total, row) => total + row[1], 0);
    const founderCount = 1 + Math.floor(seededNumber(seed, "founder-count") * 3);
    const primaryGroup = groupsById.get(sourcePopulationRows[0]?.[0] || godRow.humanSources[0].sourcePopulationId);
    const founderAffiliation = pick(FOUNDER_AFFILIATIONS, seed, "founder-affiliation");
    const civicRelation = pick(CIVIC_RELATIONS, seed, "civic-relation");
    const founderRows = Array.from({ length: founderCount }, (_, founderOrdinal) => ({
      id: `origin-founder:${String(ordinal + 1).padStart(2, "0")}:${founderOrdinal + 1}`,
      name: generatedFounderName(worldSeed, ordinal, founderOrdinal, usedFounderNames),
      sourcePopulationId: primaryGroup.id,
      peopleId: primaryGroup.peopleId,
      affiliation: founderAffiliation,
      civicRelation,
      exceptionalCapabilities: [
        pick(FOUNDER_CAPABILITIES, seed, `founder-capability:${founderOrdinal}:0`),
        pick(FOUNDER_CAPABILITIES, seed, `founder-capability:${founderOrdinal}:1`)
      ].filter((value, index, values) => values.indexOf(value) === index)
    }));
    const assistance = [
      pick(DIVINE_ASSISTANCE, seed, "assistance:0"),
      pick(DIVINE_ASSISTANCE, seed, "assistance:1")
    ].filter((value, index, values) => values.indexOf(value) === index);
    const divinePowerSpent = Math.min(godRow.state.power.reserve, integerBetween(seed, "divine-power-spent", outcome === "enduringCity" ? 90 : 45, outcome === "enduringCity" ? 260 : 170));
    const cityId = outcome === "enduringCity" ? `city:${String(site.index).padStart(5, "0")}` : null;
    const cityName = StrategicHumanGeography.generatedCityName(worldSeed, site.index, usedCityNames);
    return {
      id: `origin-event:${String(ordinal + 1).padStart(2, "0")}`,
      year,
      outcome,
      cityId,
      cityName,
      siteCellId: StrategicWorld.cellId(site.index),
      initialSupportComponentId: outcome === "enduringCity" ? `origin-component:${String(ordinal + 1).padStart(2, "0")}` : null,
      patronGodId: godRow.god.id,
      sourcePopulationRows,
      initialPopulation,
      founderRows,
      foundingAffiliation: founderAffiliation,
      civicRelation,
      resourcePurposeId: site.purposeId,
      materialRows: site.materialRows,
      divineAssistance: assistance,
      divinePowerSpent,
      endingDivineReserve: godRow.state.power.reserve - divinePowerSpent,
      canonicalMotive: ordinal === 0 ? pick(["protectFollowers", "secureResource", "organizeWorship"], seed, "motive") : pick(CANONICAL_MOTIVES.slice(3), seed, "motive"),
      commitmentChange: ordinal > 0 && godRow.investment === 0 ? "rivalryProvokedInvestment" : null,
      failureCause: outcome === "retainedFailure" ? pick(FAILURE_CAUSES, seed, "failure-cause") : null,
      retainedConsequence: outcome === "retainedFailure" ? { kind: pick(FAILURE_CONSEQUENCES, seed, "failure-consequence"), name: `${cityName} Remnant`, cellId: StrategicWorld.cellId(site.index) } : null
    };
  }

  function publicEvent(attempt, context) {
    const family = StrategicResourcePotential.RESOURCE_BY_ID[attempt.resourcePurposeId];
    const patron = context.godById.get(attempt.patronGodId);
    const peoples = [...new Set(attempt.sourcePopulationRows.map((row) => context.groupsById.get(row[0])?.peopleId))].map((peopleId) => context.peopleById.get(peopleId)).filter(Boolean);
    const first = attempt.year === 0;
    const explanation = attempt.outcome === "enduringCity"
      ? (first
        ? "The first enduring walls proved that concentrated labor, defended infrastructure, and organized worship could survive the beast-dominated world."
        : `${patron.name}'s followers publicly described the foundation as practical emulation of the first city's demonstrated success.`)
      : `The project failed, but its ${attempt.retainedConsequence.kind.replace(/([a-z])([A-Z])/g, "$1 $2")} remains part of the historical and physical record.`;
    return {
      id: attempt.id,
      year: attempt.year,
      outcome: attempt.outcome,
      cityId: attempt.cityId,
      cityName: attempt.cityName,
      siteCellId: attempt.siteCellId,
      patron: { id: patron.id, name: patron.name },
      founders: attempt.founderRows.map((founder) => ({ id: founder.id, name: founder.name, peopleId: founder.peopleId, affiliation: founder.affiliation, civicRelation: founder.civicRelation, exceptionalCapabilities: clone(founder.exceptionalCapabilities) })),
      contributingPeoples: peoples.map((people) => ({ id: people.id, name: people.name })),
      foundingPopulationBand: populationBand(attempt.initialPopulation),
      resourcePurpose: { id: family.id, label: family.label },
      materialBasis: attempt.materialRows.map((row) => ({ resourceId: row[0], sufficiency: materialBand(row[1], row[2]) })),
      observedDivineAssistance: clone(attempt.divineAssistance),
      publicExplanation: explanation,
      retainedConsequence: clone(attempt.retainedConsequence)
    };
  }

  function originsCore(record) {
    return {
      sourceResourcePotentialDigest: record.sourceResourcePotentialDigest,
      sourcePreUrbanHumanityDigest: record.sourcePreUrbanHumanityDigest,
      sourceDivinityDigest: record.sourceDivinityDigest,
      sourcePreCivicFaithDigest: record.sourcePreCivicFaithDigest,
      firstCityId: record.firstCityId,
      eraEndYear: record.eraEndYear,
      rivalryTrigger: record.rivalryTrigger,
      firstEraInfrastructure: record.firstEraInfrastructure,
      attemptRows: record.attemptRows,
      publicDirectoryDigest: record.publicDirectoryDigest,
      diagnostics: record.diagnostics
    };
  }

  function publicCore(directory) {
    return {
      eraName: directory.eraName,
      firstCityId: directory.firstCityId,
      eraEndYear: directory.eraEndYear,
      rivalryTrigger: directory.rivalryTrigger,
      infrastructureState: directory.infrastructureState,
      chronology: directory.chronology
    };
  }

  function publicContext(worldSeed, map) {
    const groups = StrategicPreUrbanHumanity.expandPopulationGroups(map);
    const preUrbanOverview = StrategicPreUrbanHumanity.publicPreUrbanOverview(map);
    return {
      groupsById: new Map(groups.map((group) => [group.id, group])),
      peopleById: new Map(preUrbanOverview.peoples.map((people) => [people.id, people])),
      godById: new Map(StrategicReligions.createGods(worldSeed, map.strategicDivinity.worldTheme).map((god) => [god.id, god]))
    };
  }

  function buildPublicDirectory(worldSeed, map, record) {
    const context = publicContext(worldSeed, map);
    const directory = {
      eraName: "First Era",
      firstCityId: record.firstCityId,
      eraEndYear: record.eraEndYear,
      rivalryTrigger: "observedUrbanSurvivalAndConcentratedWorshipEfficiency",
      infrastructureState: "independentOriginComponentsWithoutIntercityCorridorsOrStrongholds",
      chronology: record.attemptRows.map((attempt) => publicEvent(attempt, context))
    };
    directory.digest = `public-civilization-origins-${StrategicWorld.stableHash(publicCore(directory))}`;
    return directory;
  }

  function createCivilizationOrigins(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for civilization origins.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicResourcePotential.validateStrategicResources(strategicMap);
    StrategicPreUrbanHumanity.validatePreUrbanHumanity(strategicMap);
    StrategicDivinity.validatePreCivicDivinity(strategicMap);
    StrategicFaiths.validatePreCivicFaiths(strategicMap);
    if (strategicMap.humanGeography) throw new Error("Civilization origins must be generated before fortified-city geography.");
    const groups = StrategicPreUrbanHumanity.expandPopulationGroups(strategicMap);
    const groupsById = new Map(groups.map((group) => [group.id, group]));
    const remainingPopulation = new Map(groups.map((group) => [group.id, group.population]));
    const humanConnectedGods = qualifiedGodRows(seed, strategicMap, groupsById);
    const qualified = humanConnectedGods.filter((entry) => entry.interest >= 2 && entry.investment >= 1 && entry.state.power.reserve >= 180);
    const provokable = humanConnectedGods.filter((entry) => entry.interest >= 1 && entry.state.power.reserve >= 180);
    if (!qualified.length || provokable.length < 2) throw new Error("The first city requires one committed patron and at least one human-connected rival capable of responding to its success.");
    const eligible = [qualified[0], ...provokable.filter((entry) => entry.god.id !== qualified[0].god.id)];
    const rivalLimit = Math.max(1, Math.floor((eligible.length - 1) / 2));
    const successfulRivals = Math.min(3, rivalLimit, Math.max(1, Math.floor((eligible.length - 1) / 3)));
    const failedRivals = Math.min(2, rivalLimit - successfulRivals, eligible.length - 1 - successfulRivals);
    const plannedOutcomes = ["enduringCity", ...Array(successfulRivals).fill("enduringCity"), ...Array(failedRivals).fill("retainedFailure")];
    const occupiedIndices = [];
    const usedFounderNames = new Set();
    const usedCityNames = new Set();
    const usedPatronIds = new Set();
    const attempts = [];
    for (const outcome of plannedOutcomes) {
      const ordinal = attempts.length;
      const minimumSpacingKm = outcome === "enduringCity" ? 620 : 380;
      const patronCandidates = eligible.filter((entry) => !usedPatronIds.has(entry.god.id));
      let godRow = null;
      let sites = [];
      for (const spacingKm of [minimumSpacingKm, 260]) {
        for (const candidate of patronCandidates) {
          const candidateSitesForGod = candidateSites(seed, strategicMap, candidate, groupsById, remainingPopulation, occupiedIndices, spacingKm, outcome === "enduringCity");
          if (!candidateSitesForGod.length) continue;
          godRow = candidate;
          sites = candidateSitesForGod;
          break;
        }
        if (godRow) break;
      }
      if (!godRow || !sites.length) {
        if (outcome === "retainedFailure") continue;
        throw new Error("No qualified population-backed divine patron retains a viable foundation site.");
      }
      const site = sites[0];
      const year = ordinal === 0 ? 0 : Math.min(120, 8 + ordinal * 19 + integerBetween(seed, `origin-year:${ordinal}`, 0, 17));
      const attempt = createAttempt(seed, strategicMap, godRow, ordinal, year, outcome, site, groupsById, remainingPopulation, usedFounderNames, usedCityNames);
      if (outcome === "enduringCity" && (attempt.initialPopulation < 800 || attempt.materialRows.some((row) => row[1] < row[2]))) throw new Error(`The enduring origin at ${attempt.siteCellId} lacks its required people or materials.`);
      attempts.push(attempt);
      usedPatronIds.add(godRow.god.id);
      occupiedIndices.push(site.index);
    }
    const record = {
      sourceResourcePotentialDigest: strategicMap.resourcePotential.digest,
      sourcePreUrbanHumanityDigest: strategicMap.preUrbanHumanity.digest,
      sourceDivinityDigest: strategicMap.strategicDivinity.digest,
      sourcePreCivicFaithDigest: strategicMap.preCivicFaiths.digest,
      firstCityId: attempts[0].cityId,
      eraEndYear: Math.max(...attempts.map((attempt) => attempt.year)),
      rivalryTrigger: "firstCityDemonstratedConcentratedWorshipEfficiency",
      firstEraInfrastructure: "noIntercityCorridorsOrStrongholds",
      attemptRows: attempts,
      publicDirectoryDigest: null,
      diagnostics: {
        attemptCount: attempts.length,
        successfulOriginCityCount: attempts.filter((attempt) => attempt.outcome === "enduringCity").length,
        retainedFailureCount: attempts.filter((attempt) => attempt.outcome === "retainedFailure").length,
        patronCount: new Set(attempts.map((attempt) => attempt.patronGodId)).size,
        allocatedFoundingPopulation: attempts.reduce((total, attempt) => total + attempt.initialPopulation, 0),
        initialSupportComponentCount: attempts.filter((attempt) => attempt.initialSupportComponentId).length
      }
    };
    const directory = buildPublicDirectory(seed, strategicMap, record);
    record.publicDirectoryDigest = directory.digest;
    record.digest = `civilization-origins-${StrategicWorld.stableHash(originsCore(record))}`;
    return { civilizationOrigins: record, publicDirectory: directory };
  }

  function validateCivilizationOrigins(map, record = map?.civilizationOrigins, directory = map?.publicCivilizationOrigins) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    if (!record || !directory || record.sourceResourcePotentialDigest !== strategicMap.resourcePotential?.digest || record.sourcePreUrbanHumanityDigest !== strategicMap.preUrbanHumanity?.digest || record.sourceDivinityDigest !== strategicMap.strategicDivinity?.digest || record.sourcePreCivicFaithDigest !== strategicMap.preCivicFaiths?.digest || record.publicDirectoryDigest !== directory.digest) throw new Error("Civilization origins are incomplete or source-inconsistent.");
    const groups = StrategicPreUrbanHumanity.expandPopulationGroups(strategicMap);
    const groupsById = new Map(groups.map((group) => [group.id, group]));
    const allocated = new Map();
    const patronIds = new Set();
    const siteIds = new Set();
    const successful = [];
    if (!Array.isArray(record.attemptRows) || record.attemptRows.length < 2 || record.attemptRows.length > 6 || record.attemptRows.length >= strategicMap.strategicDivinity.godOrder.length || record.attemptRows[0]?.year !== 0 || record.attemptRows[0]?.outcome !== "enduringCity" || record.firstCityId !== record.attemptRows[0].cityId || record.rivalryTrigger !== "firstCityDemonstratedConcentratedWorshipEfficiency" || record.firstEraInfrastructure !== "noIntercityCorridorsOrStrongholds") throw new Error("The First Era requires one Year 0 city, an explicit rivalry trigger, and bounded later origin attempts without intercity infrastructure.");
    for (const [ordinal, attempt] of record.attemptRows.entries()) {
      if (attempt.id !== `origin-event:${String(ordinal + 1).padStart(2, "0")}` || !ORIGIN_OUTCOMES.includes(attempt.outcome) || patronIds.has(attempt.patronGodId) || !CANONICAL_MOTIVES.includes(attempt.canonicalMotive) || attempt.year < 0 || attempt.year > 120 || (ordinal > 0 && attempt.year <= record.attemptRows[ordinal - 1].year)) throw new Error("A civilization-origin event has invalid chronology, outcome, patron, or motive.");
      patronIds.add(attempt.patronGodId);
      const god = StrategicDivinity.privateDivineStateFor(strategicMap, attempt.patronGodId);
      if (god.urbanInterest === "opposed" || (god.investmentWillingness === "none" && (ordinal === 0 || attempt.commitmentChange !== "rivalryProvokedInvestment")) || (god.investmentWillingness !== "none" && attempt.commitmentChange)) throw new Error("An origin patron must have meaningful urban interest and either prior investment willingness or a saved rivalry-provoked commitment rather than power alone.");
      const humanSourceIds = new Set(god.worshipSources.filter((source) => source.kind === "human").map((source) => source.sourcePopulationId));
      if (!Array.isArray(attempt.sourcePopulationRows) || !attempt.sourcePopulationRows.length || new Set(attempt.sourcePopulationRows.map((row) => row[0])).size !== attempt.sourcePopulationRows.length || !attempt.sourcePopulationRows.some((row) => humanSourceIds.has(row[0])) || attempt.sourcePopulationRows.reduce((total, row) => total + row[1], 0) !== attempt.initialPopulation) throw new Error("An origin attempt lacks population from its patron's real human worship cohorts.");
      for (const row of attempt.sourcePopulationRows) {
        const group = groupsById.get(row[0]);
        if (!group || !Number.isInteger(row[1]) || row[1] < 1 || !group.rangeCellIds.includes(attempt.siteCellId)) throw new Error("An origin population allocation is not physically tied to its saved pre-urban group.");
        allocated.set(row[0], (allocated.get(row[0]) || 0) + row[1]);
      }
      const allocatedGroupIds = new Set(attempt.sourcePopulationRows.map((row) => row[0]));
      if (!Array.isArray(attempt.founderRows) || attempt.founderRows.length < 1 || attempt.founderRows.length > 3 || attempt.founderRows.some((founder) => !allocatedGroupIds.has(founder.sourcePopulationId) || !FOUNDER_AFFILIATIONS.includes(founder.affiliation) || !CIVIC_RELATIONS.includes(founder.civicRelation) || !founder.exceptionalCapabilities?.length || founder.exceptionalCapabilities.some((capability) => !FOUNDER_CAPABILITIES.includes(capability)))) throw new Error("An origin requires one to three exceptional population-backed founders.");
      if (!Array.isArray(attempt.materialRows) || attempt.materialRows.length !== MATERIAL_REQUIREMENTS.length || attempt.materialRows.some((row, index) => row[0] !== MATERIAL_REQUIREMENTS[index].id || !Number.isInteger(row[1]) || row[2] !== MATERIAL_REQUIREMENTS[index].minimum) || !StrategicResourcePotential.RESOURCE_BY_ID[attempt.resourcePurposeId] || !Array.isArray(attempt.divineAssistance) || attempt.divineAssistance.some((entry) => !DIVINE_ASSISTANCE.includes(entry)) || !Number.isInteger(attempt.divinePowerSpent) || attempt.divinePowerSpent < 1 || attempt.divinePowerSpent > god.power.reserve || attempt.endingDivineReserve !== god.power.reserve - attempt.divinePowerSpent) throw new Error("An origin attempt has invalid finite material or divine contributions.");
      const cellIndex = StrategicWorld.cellIndex(attempt.siteCellId);
      if (cellIndex < 0 || strategicMap.surface.classes[cellIndex] !== "L" || siteIds.has(attempt.siteCellId)) throw new Error("An origin attempt must occupy a unique real land site.");
      siteIds.add(attempt.siteCellId);
      const physicalSite = siteFacts(strategicMap, cellIndex, "");
      if (JSON.stringify(attempt.materialRows) !== JSON.stringify(physicalSite.materialRows) || attempt.resourcePurposeId !== physicalSite.purposeId) throw new Error("An origin attempt's material basis or resource purpose does not match its physical site.");
      if (attempt.outcome === "enduringCity") {
        if (attempt.cityId !== `city:${String(cellIndex).padStart(5, "0")}` || !attempt.initialSupportComponentId || attempt.initialPopulation < 800 || attempt.materialRows.some((row) => row[1] < row[2]) || attempt.retainedConsequence) throw new Error("An enduring origin city lacks its canonical site, component, population, or physical requirements.");
        successful.push(attempt);
      } else if (attempt.cityId || attempt.initialSupportComponentId || !FAILURE_CAUSES.includes(attempt.failureCause) || !attempt.retainedConsequence || !FAILURE_CONSEQUENCES.includes(attempt.retainedConsequence.kind) || attempt.retainedConsequence.cellId !== attempt.siteCellId) throw new Error("A failed origin attempt must record a cause and leave a retained physical or historical consequence.");
    }
    if ([...allocated].some(([groupId, population]) => population > groupsById.get(groupId).population)) throw new Error("Origin attempts allocate more people than their pre-urban populations contain.");
    if (new Set(successful.map((attempt) => attempt.cityId)).size !== successful.length || new Set(successful.map((attempt) => attempt.initialSupportComponentId)).size !== successful.length || record.eraEndYear !== record.attemptRows.at(-1).year) throw new Error("Origin cities require distinct sites, initial support components, and a bounded era end.");
    if (directory.eraName !== "First Era" || directory.firstCityId !== record.firstCityId || directory.eraEndYear !== record.eraEndYear || directory.rivalryTrigger !== "observedUrbanSurvivalAndConcentratedWorshipEfficiency" || directory.infrastructureState !== "independentOriginComponentsWithoutIntercityCorridorsOrStrongholds" || !Array.isArray(directory.chronology) || directory.chronology.length !== record.attemptRows.length || directory.chronology.some((event, index) => {
      const attempt = record.attemptRows[index];
      const peopleIds = [...new Set(attempt.sourcePopulationRows.map((row) => groupsById.get(row[0]).peopleId))];
      return event.id !== attempt.id || event.year !== attempt.year || event.outcome !== attempt.outcome || event.cityId !== attempt.cityId || event.cityName !== attempt.cityName || event.siteCellId !== attempt.siteCellId || event.patron?.id !== attempt.patronGodId || event.resourcePurpose?.id !== attempt.resourcePurposeId || event.foundingPopulationBand !== populationBand(attempt.initialPopulation) || JSON.stringify(event.materialBasis) !== JSON.stringify(attempt.materialRows.map((row) => ({ resourceId: row[0], sufficiency: materialBand(row[1], row[2]) }))) || JSON.stringify(event.observedDivineAssistance) !== JSON.stringify(attempt.divineAssistance) || JSON.stringify(event.retainedConsequence) !== JSON.stringify(attempt.retainedConsequence) || JSON.stringify(event.contributingPeoples.map((people) => people.id)) !== JSON.stringify(peopleIds) || !String(event.publicExplanation || "").trim() || JSON.stringify(event.founders.map((founder) => [founder.id, founder.name, founder.peopleId, founder.affiliation, founder.civicRelation, founder.exceptionalCapabilities])) !== JSON.stringify(attempt.founderRows.map((founder) => [founder.id, founder.name, founder.peopleId, founder.affiliation, founder.civicRelation, founder.exceptionalCapabilities]));
    }) || directory.digest !== `public-civilization-origins-${StrategicWorld.stableHash(publicCore(directory))}` || JSON.stringify(directory).match(/canonicalMotive|divinePowerSpent|endingDivineReserve|sourcePopulationId|sourcePopulationRows|initialPopulation|materialRows/)) throw new Error("The public origins chronology is inconsistent or leaks canonical motives, exact populations, materials, or divine power.");
    const diagnostics = record.diagnostics;
    if (!diagnostics || diagnostics.attemptCount !== record.attemptRows.length || diagnostics.successfulOriginCityCount !== successful.length || diagnostics.retainedFailureCount !== record.attemptRows.length - successful.length || diagnostics.patronCount !== patronIds.size || diagnostics.allocatedFoundingPopulation !== record.attemptRows.reduce((total, attempt) => total + attempt.initialPopulation, 0) || diagnostics.initialSupportComponentCount !== successful.length) throw new Error("Civilization-origin diagnostics do not match canonical history.");
    if (record.digest !== `civilization-origins-${StrategicWorld.stableHash(originsCore(record))}`) throw new Error("Civilization origins do not match their digest.");
    return { civilizationOrigins: clone(record), publicDirectory: clone(directory) };
  }

  function attachCivilizationOrigins(worldSeed, map) {
    const next = StrategicWorld.validateStrategicMap(map);
    const generated = createCivilizationOrigins(worldSeed, next);
    next.civilizationOrigins = generated.civilizationOrigins;
    next.publicCivilizationOrigins = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function originCitySeeds(map) {
    if (!map?.civilizationOrigins) return [];
    return map.civilizationOrigins.attemptRows.filter((attempt) => attempt.outcome === "enduringCity").map((attempt) => ({
      cityId: attempt.cityId,
      cityName: attempt.cityName,
      cellId: attempt.siteCellId,
      foundingYear: attempt.year,
      patronGodId: attempt.patronGodId,
      resourcePurposeId: attempt.resourcePurposeId,
      founderCount: attempt.founderRows.length,
      foundingAffiliation: attempt.foundingAffiliation,
      civicRelation: attempt.civicRelation,
      initialSupportComponentId: attempt.initialSupportComponentId
    }));
  }

  function publicCivilizationOrigins(map) {
    return map?.publicCivilizationOrigins ? clone(map.publicCivilizationOrigins) : null;
  }

  function auditCivilizationOrigins(map) {
    const { civilizationOrigins, publicDirectory } = validateCivilizationOrigins(map);
    const successes = civilizationOrigins.attemptRows.filter((attempt) => attempt.outcome === "enduringCity");
    return {
      valid: true,
      firstCityFoundedAtYearZero: civilizationOrigins.attemptRows[0].year === 0 && civilizationOrigins.firstCityId === successes[0].cityId,
      everyOriginPopulationBacked: civilizationOrigins.attemptRows.every((attempt) => attempt.sourcePopulationRows.length > 0),
      everySuccessfulOriginMateriallyViable: successes.every((attempt) => attempt.materialRows.every((row) => row[1] >= row[2])),
      divineAidFiniteAndMaterialLaborRequired: civilizationOrigins.attemptRows.every((attempt) => attempt.divinePowerSpent > 0 && attempt.initialPopulation > 0 && attempt.materialRows.length > 0),
      qualifiedMinorityAttempts: civilizationOrigins.attemptRows.length < map.strategicDivinity.godOrder.length,
      originCitiesInitiallyDisconnected: new Set(successes.map((attempt) => attempt.initialSupportComponentId)).size === successes.length && civilizationOrigins.firstEraInfrastructure === "noIntercityCorridorsOrStrongholds",
      failedAttemptsRetainedOnlyWithConsequences: civilizationOrigins.attemptRows.filter((attempt) => attempt.outcome === "retainedFailure").every((attempt) => Boolean(attempt.retainedConsequence)),
      publicChronologyHidesPrivateTruth: !JSON.stringify(publicDirectory).match(/canonicalMotive|divinePowerSpent|endingDivineReserve|sourcePopulationId|initialPopulation|materialRows/),
      diagnostics: clone(civilizationOrigins.diagnostics)
    };
  }

  return Object.freeze({
    ORIGIN_OUTCOMES, CANONICAL_MOTIVES, DIVINE_ASSISTANCE, FAILURE_CONSEQUENCES, FAILURE_CAUSES, FOUNDER_CAPABILITIES,
    FOUNDER_AFFILIATIONS, CIVIC_RELATIONS, MATERIAL_REQUIREMENTS, createCivilizationOrigins,
    validateCivilizationOrigins, attachCivilizationOrigins, originCitySeeds, publicCivilizationOrigins,
    auditCivilizationOrigins
  });
});
