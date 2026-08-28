(function initStrategicCityExpansion(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const resourcePotential = typeof module === "object" && module.exports ? require("./strategic-resource-potential") : root?.HelixStrategicResourcePotential;
  const humanGeography = typeof module === "object" && module.exports ? require("./strategic-human-geography") : root?.HelixStrategicHumanGeography;
  const preUrbanHumanity = typeof module === "object" && module.exports ? require("./strategic-pre-urban-humanity") : root?.HelixStrategicPreUrbanHumanity;
  const religions = typeof module === "object" && module.exports ? require("./strategic-religions") : root?.HelixStrategicReligions;
  const civilizationOrigins = typeof module === "object" && module.exports ? require("./strategic-civilization-origins") : root?.HelixStrategicCivilizationOrigins;
  const api = factory(strategicWorld, resourcePotential, humanGeography, preUrbanHumanity, religions, civilizationOrigins);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicCityExpansion = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicCityExpansionApi(StrategicWorld, StrategicResourcePotential, StrategicHumanGeography, StrategicPreUrbanHumanity, StrategicReligions, StrategicCivilizationOrigins) {
  "use strict";

  if (!StrategicWorld || !StrategicResourcePotential || !StrategicHumanGeography || !StrategicPreUrbanHumanity || !StrategicReligions || !StrategicCivilizationOrigins) throw new Error("City-expansion dependencies must load before strategic-city-expansion.js");

  const FOUNDATION_CAUSES = Object.freeze(["resourceExtraction", "agriculturalExpansion", "crowdingRelief", "strategicReach", "exile", "politicalEscape", "secession", "militaryDefeat", "factionalHostility"]);
  const FOUNDATION_RELATIONSHIPS = Object.freeze(["cooperative", "wary", "adversarial", "openlyHostile"]);
  const CANONICAL_MOTIVES = Object.freeze(["secureScarceSupply", "relievePopulationPressure", "removePoliticalRival", "escapeReligiousRule", "controlFrontier", "surviveDefeat", "denyRivalRoute", "buildIndependentPowerBase"]);
  const FOUNDER_CAPABILITIES = Object.freeze(["wardEngineering", "battlefieldProtection", "constructionSorcery", "logisticalCommand", "healingArts", "earthShaping", "beastDefense", "resourceEngineering", "aerialReconnaissance", "politicalOrganization"]);
  const FOUNDER_AFFILIATIONS = Object.freeze(["chosenRepresentative", "divinelyInvestedChampion", "godAffiliatedHero", "selfPoweredIndependent"]);
  const CIVIC_RELATIONS = Object.freeze(["sovereignIsFoundingPower", "foundingPowerSupportsSovereign", "foundingCircleSharesAuthority"]);
  const STRONGHOLD_ADMINISTRATIONS = Object.freeze(["jointCommandCouncil", "locallyElectedServiceCouncil", "appointedCompactAdministrator", "rotatingSponsorCommand", "dividedSponsorFacilities", "neutralCompactAdministration"]);
  const SERVICE_MODES = Object.freeze(["groundConvoy", "aircraft", "flyingMounts", "mixedFleet"]);
  const FAILURE_CAUSES = Object.freeze(["beastAttrition", "materialShortfall", "founderDeath", "politicalSabotage", "routeCollapse", "settlerWithdrawal"]);
  const FAILURE_CONSEQUENCES = Object.freeze(["abandonedRoadworks", "unfinishedFortifications", "displacedSettlers", "contestedClaim", "massGrave", "brokenWardLine"]);
  const SUPPORT_MAXIMUM_LEG_KM = 420;
  const MINIMUM_CITY_SPACING_KM = 340;
  const MAXIMUM_EXPANSION_DISTANCE_KM = 1500;
  const MATERIAL_REQUIREMENTS = StrategicCivilizationOrigins.MATERIAL_REQUIREMENTS;
  const RESOURCE_FAMILIES = StrategicResourcePotential.RESOURCE_FAMILIES;
  const FAMILY_BY_ID = new Map(RESOURCE_FAMILIES.map((family) => [family.id, family]));
  const FOUNDER_NAME_OPENINGS = Object.freeze(["Ari", "Bren", "Cai", "Dara", "Eris", "Fenn", "Galen", "Hale", "Ilya", "Joren", "Kara", "Lio", "Mera", "Nessa", "Oren", "Perrin", "Rhea", "Sera", "Toren", "Vey"]);
  const FOUNDER_NAME_ENDINGS = Object.freeze(["a", "an", "as", "en", "eth", "ia", "in", "is", "on", "or", "ra", "ren", "us", "yn"]);

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
    const resourceRows = RESOURCE_FAMILIES.map((family) => [family.id, maximum(family.id)]);
    return {
      index,
      materialRows,
      resourceRows,
      viable: materialRows.every((row) => row[1] >= row[2]),
      suitability: StrategicHumanGeography.citySuitabilityPermille(map, index, worldSeed)
    };
  }

  function expansionTarget(map, horizonYear, originRows) {
    const originRegions = new Set(originRows.map((attempt) => map.surface.regionByCell[StrategicWorld.cellIndex(attempt.siteCellId)]));
    const reachableLandCells = [...originRegions].reduce((total, regionIndex) => total + (map.surface.regions[regionIndex]?.cellCount || 0), 0);
    const landTarget = Math.max(originRows.length, Math.round(reachableLandCells / 105));
    const elapsed = Math.max(0, horizonYear - map.civilizationOrigins.eraEndYear);
    const timeTarget = originRows.length + Math.floor(elapsed / 58);
    const minimum = Math.max(originRows.length, Math.min(18, landTarget));
    return clamp(Math.max(minimum, Math.min(landTarget, timeTarget)), originRows.length, 38);
  }

  function colonistCapacity(map, city, foundingPopulation, foundingYear, horizonYear) {
    const index = StrategicWorld.cellIndex(city.cellId);
    const local = localLandIndices(map, index);
    const food = Math.max(...local.map((cellIndex) => map.resourcePotential.potentialPermille.biologicalProductivity[cellIndex]));
    const water = Math.max(...local.map((cellIndex) => map.resourcePotential.potentialPermille.freshWater[cellIndex]));
    const elapsed = Math.max(0, horizonYear - foundingYear);
    return Math.round(foundingPopulation * 1.25 + elapsed * 13 + (food + water) * 2.2);
  }

  function generatedFounderName(seed, ordinal, founderOrdinal, usedNames) {
    const channel = `expansion-founder:${ordinal}:${founderOrdinal}`;
    const base = `${pick(FOUNDER_NAME_OPENINGS, seed, `${channel}:opening`)}${pick(FOUNDER_NAME_ENDINGS, seed, `${channel}:ending`)}`;
    let name = base;
    let suffix = 2;
    while (usedNames.has(name)) { name = `${base} ${suffix}`; suffix += 1; }
    usedNames.add(name);
    return name;
  }

  function foundingRelationship(cause) {
    if (["secession", "factionalHostility"].includes(cause)) return "openlyHostile";
    if (["exile", "militaryDefeat", "politicalEscape"].includes(cause)) return "adversarial";
    if (["crowdingRelief", "strategicReach"].includes(cause)) return "wary";
    return "cooperative";
  }

  function populationBand(population) {
    if (population < 1000) return "smallExpedition";
    if (population < 1800) return "modestFoundingPopulation";
    if (population < 2800) return "substantialFoundingPopulation";
    return "massFoundingPopulation";
  }

  function materialBand(value, minimum) {
    const ratio = value / Math.max(1, minimum);
    return ratio >= 2.2 ? "abundant" : (ratio >= 1.45 ? "strong" : (ratio >= 1 ? "adequate" : "insufficient"));
  }

  function pathLengthKm(map, path) {
    let total = 0;
    for (let index = 1; index < path.length; index += 1) total += StrategicWorld.greatCircleDistanceKm(map, path[index - 1], path[index]);
    return Math.round(total);
  }

  function candidateSites(seed, map, cityRows, occupiedIndices, desiredResourceId, independentRefuge) {
    const originRegions = new Set(cityRows.map((city) => map.surface.regionByCell[StrategicWorld.cellIndex(city.cellId)]));
    const candidates = [];
    for (let index = 0; index < map.topology.cellCount; index += 1) {
      if (map.surface.classes[index] !== "L" || !originRegions.has(map.surface.regionByCell[index])) continue;
      const spacing = Math.min(...occupiedIndices.map((other) => StrategicWorld.greatCircleDistanceKm(map, index, other)));
      if (spacing < (independentRefuge ? MINIMUM_CITY_SPACING_KM * 1.4 : MINIMUM_CITY_SPACING_KM)) continue;
      const facts = siteFacts(map, index, seed);
      if (!facts.viable) continue;
      const resourceValue = facts.resourceRows.find((row) => row[0] === desiredResourceId)?.[1] || 0;
      candidates.push({ ...facts, resourceValue, spacing });
    }
    return candidates.sort((left, right) => (right.suitability + right.resourceValue * 0.42) - (left.suitability + left.resourceValue * 0.42) || left.index - right.index);
  }

  function chooseExpansion(seed, map, cityRows, occupiedIndices, remainingColonistCapacity, desiredResourceId, independentRefuge, requiredParentId = null) {
    const sites = candidateSites(seed, map, cityRows, occupiedIndices, desiredResourceId, independentRefuge);
    let best = null;
    for (const site of sites.slice(0, 240)) {
      const siteRegion = map.surface.regionByCell[site.index];
      for (const parent of cityRows) {
        if (requiredParentId && parent.id !== requiredParentId) continue;
        if (parent.independentRefuge) continue;
        if ((remainingColonistCapacity.get(parent.id) || 0) < 800) continue;
        const parentIndex = StrategicWorld.cellIndex(parent.cellId);
        if (map.surface.regionByCell[parentIndex] !== siteRegion) continue;
        const distance = StrategicWorld.greatCircleDistanceKm(map, parentIndex, site.index);
        const maximumDistance = independentRefuge ? MAXIMUM_EXPANSION_DISTANCE_KM * 1.45 : MAXIMUM_EXPANSION_DISTANCE_KM;
        if (distance < MINIMUM_CITY_SPACING_KM * 0.8 || distance > maximumDistance) continue;
        const score = site.suitability + site.resourceValue * 0.46 - Math.abs(distance - (independentRefuge ? 1250 : 780)) * 0.13 + Math.min(350, remainingColonistCapacity.get(parent.id) / 30);
        if (!best || score > best.score || (score === best.score && `${parent.id}:${site.index}` < `${best.parent.id}:${best.site.index}`)) best = { parent, site, score };
      }
    }
    if (!best) return null;
    if (independentRefuge) return { ...best, path: null };
    const path = StrategicHumanGeography.leastCostLandPath(map, StrategicWorld.cellIndex(best.parent.cellId), best.site.index, new Set());
    return path ? { ...best, path } : null;
  }

  function strongholdCellsForPath(map, path, cityCells) {
    const cells = [];
    let previousStop = 0;
    let cursor = 1;
    let legLengthKm = 0;
    while (cursor < path.length) {
      const segmentKm = StrategicWorld.greatCircleDistanceKm(map, path[cursor - 1], path[cursor]);
      if (legLengthKm + segmentKm <= SUPPORT_MAXIMUM_LEG_KM) { legLengthKm += segmentKm; cursor += 1; continue; }
      let stop = cursor - 1;
      while (stop > previousStop && cityCells.has(path[stop])) stop -= 1;
      if (stop === previousStop) throw new Error("A historical support route has no viable stronghold site within the maximum support leg.");
      cells.push(path[stop]);
      previousStop = stop;
      cursor = stop + 1;
      legLengthKm = 0;
    }
    return cells;
  }

  function createStrongholdRows(seed, map, corridors, cityRows, horizonYear) {
    const cityCells = new Set(cityRows.map((city) => StrategicWorld.cellIndex(city.cellId)));
    return corridors.flatMap((corridor) => strongholdCellsForPath(map, corridor.cellPath.map(StrategicWorld.cellIndex), cityCells).map((cellIndex, ordinal) => {
      const leftShare = pick([35, 40, 45, 50], seed, `stronghold-share:${corridor.id}:${ordinal}`);
      return {
        id: `joint-stronghold:${corridor.id.slice("corridor:".length)}:${ordinal + 1}`,
        corridorId: corridor.id,
        ordinal,
        foundingYear: Math.min(horizonYear, corridor.constructionYear + 1),
        cellId: StrategicWorld.cellId(cellIndex),
        sponsorCityIds: clone(corridor.endpointCityIds),
        sponsorContributionRows: [[corridor.endpointCityIds[0], leftShare, leftShare], [corridor.endpointCityIds[1], 100 - leftShare, 100 - leftShare]],
        administration: corridor.administration,
        populationCapacity: pick([800, 1800, 4000, 8000], seed, `stronghold-capacity:${corridor.id}:${ordinal}`),
        serviceMode: pick(SERVICE_MODES, seed, `stronghold-service:${corridor.id}:${ordinal}`)
      };
    }));
  }

  function connectedComponents(cityIds, corridors) {
    const adjacency = new Map(cityIds.map((id) => [id, new Set()]));
    for (const corridor of corridors) {
      const [left, right] = corridor.endpointCityIds;
      adjacency.get(left)?.add(right);
      adjacency.get(right)?.add(left);
    }
    const seen = new Set();
    const components = [];
    for (const start of [...cityIds].sort()) {
      if (seen.has(start)) continue;
      const queue = [start];
      const members = [];
      seen.add(start);
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor];
        members.push(current);
        for (const neighbor of adjacency.get(current) || []) if (!seen.has(neighbor)) { seen.add(neighbor); queue.push(neighbor); }
      }
      components.push(members.sort());
    }
    return components;
  }

  function createBridgeCorridors(seed, map, cityRows, corridors, refugeCityIds, horizonYear) {
    const existingPairs = new Set(corridors.map((corridor) => corridor.endpointCityIds.join("|")));
    const maximumBridges = Math.max(0, map.civilizationOrigins.diagnostics.successfulOriginCityCount - 1);
    let created = 0;
    while (created < maximumBridges) {
      const components = connectedComponents(cityRows.map((city) => city.id), corridors);
      const componentByCity = new Map(components.flatMap((component, componentIndex) => component.map((cityId) => [cityId, componentIndex])));
      const candidates = [];
      for (let leftIndex = 0; leftIndex < cityRows.length; leftIndex += 1) {
        const left = cityRows[leftIndex];
        if (refugeCityIds.has(left.id)) continue;
        for (let rightIndex = leftIndex + 1; rightIndex < cityRows.length; rightIndex += 1) {
          const right = cityRows[rightIndex];
          if (refugeCityIds.has(right.id) || componentByCity.get(left.id) === componentByCity.get(right.id)) continue;
          if (map.surface.regionByCell[StrategicWorld.cellIndex(left.cellId)] !== map.surface.regionByCell[StrategicWorld.cellIndex(right.cellId)]) continue;
          const endpointCityIds = [left.id, right.id].sort();
          if (existingPairs.has(endpointCityIds.join("|"))) continue;
          const distance = StrategicWorld.greatCircleDistanceKm(map, StrategicWorld.cellIndex(left.cellId), StrategicWorld.cellIndex(right.cellId));
          if (distance > 980) continue;
          candidates.push({ left, right, endpointCityIds, distance });
        }
      }
      candidates.sort((left, right) => left.distance - right.distance || left.endpointCityIds.join("|").localeCompare(right.endpointCityIds.join("|")));
      const candidate = candidates.find((entry, index) => seededNumber(seed, `bridge-willingness:${created}:${entry.endpointCityIds.join(":")}:${index}`) >= 0.32);
      if (!candidate) break;
      const path = StrategicHumanGeography.leastCostLandPath(map, StrategicWorld.cellIndex(candidate.left.cellId), StrategicWorld.cellIndex(candidate.right.cellId), new Set(corridors.flatMap((corridor) => corridor.cellPath.map(StrategicWorld.cellIndex))));
      if (!path) break;
      const latestFoundation = Math.max(candidate.left.foundingYear, candidate.right.foundingYear);
      const constructionYear = Math.min(horizonYear, latestFoundation + integerBetween(seed, `bridge-year:${created}`, 8, 42));
      if (constructionYear <= latestFoundation) break;
      const id = `corridor:${candidate.endpointCityIds.map((cityId) => cityId.slice(5)).join("-")}`;
      corridors.push({
        id,
        corridorClass: "componentBridge",
        endpointCityIds: candidate.endpointCityIds,
        cellPath: path.path.map(StrategicWorld.cellId),
        constructionYear,
        constructionPurpose: "bridgeSupportComponents",
        relationshipAtConstruction: pick(FOUNDATION_RELATIONSHIPS, seed, `bridge-relationship:${id}`),
        administration: pick(STRONGHOLD_ADMINISTRATIONS.slice(3), seed, `bridge-administration:${id}`),
        materialBasis: "verifiedStoneMetalTimberAndProvisioning",
        lengthKm: pathLengthKm(map, path.path),
        relativeConstructionCost: Math.round(path.cost * 100)
      });
      existingPairs.add(candidate.endpointCityIds.join("|"));
      created += 1;
    }
  }

  function publicFoundation(foundation, context) {
    const parent = context.cityById.get(foundation.parentCityId);
    const family = FAMILY_BY_ID.get(foundation.resourcePurposeId);
    return {
      id: foundation.id,
      kind: "cityFoundation",
      year: foundation.foundingYear,
      city: { id: foundation.cityId, name: foundation.cityName, cellId: foundation.siteCellId },
      parentCity: { id: parent.id, name: parent.name },
      originLineageCityId: foundation.originLineageCityId,
      cause: foundation.foundationCause,
      relationshipAtFoundation: foundation.relationshipAtFoundation,
      independentRefuge: foundation.independentRefuge,
      foundingPopulationBand: populationBand(foundation.foundingPopulation),
      contributingPeoples: foundation.localPeopleIds.map((peopleId) => context.peopleById.get(peopleId)).filter(Boolean).map((people) => ({ id: people.id, name: people.name })),
      founders: foundation.founderRows.map((founder) => ({ id: founder.id, name: founder.name, peopleId: founder.peopleId, affiliation: founder.affiliation, civicRelation: founder.civicRelation, exceptionalCapabilities: clone(founder.exceptionalCapabilities) })),
      patron: foundation.patronGodId ? clone(context.godById.get(foundation.patronGodId)) : null,
      resourcePurpose: { id: family.id, label: family.label },
      materialBasis: foundation.materialRows.map((row) => ({ resourceId: row[0], sufficiency: materialBand(row[1], row[2]) })),
      supportAtFoundation: foundation.independentRefuge ? "intentionalIsolation" : "parentCorridorConstructed",
      publicExplanation: foundation.publicExplanation
    };
  }

  function publicCorridor(corridor, strongholdRows, cityById) {
    return {
      id: `history:${corridor.id}`,
      kind: corridor.corridorClass === "componentBridge" ? "supportComponentBridge" : "supportCorridor",
      year: corridor.constructionYear,
      corridorId: corridor.id,
      endpointCities: corridor.endpointCityIds.map((cityId) => ({ id: cityId, name: cityById.get(cityId).name })),
      constructionPurpose: corridor.constructionPurpose,
      relationshipAtConstruction: corridor.relationshipAtConstruction,
      administration: corridor.administration,
      strongholdCount: strongholdRows.filter((stronghold) => stronghold.corridorId === corridor.id).length,
      lengthKm: corridor.lengthKm,
      publicExplanation: corridor.corridorClass === "componentBridge"
        ? "The corridor joined previously separate physical support components without joining their governments, religions, diplomacy, or founding lineages."
        : "The parent and daughter cities accepted joint practical responsibility for a route despite remaining sovereign and potentially hostile."
    };
  }

  function publicFailure(failure, cityById) {
    const sponsor = cityById.get(failure.sponsorCityId);
    return {
      id: failure.id,
      kind: "failedExpansion",
      year: failure.year,
      sponsorCity: { id: sponsor.id, name: sponsor.name },
      siteCellId: failure.siteCellId,
      retainedConsequence: clone(failure.retainedConsequence),
      publicExplanation: `The frontier project failed, leaving ${failure.retainedConsequence.kind.replace(/([a-z])([A-Z])/g, "$1 $2")} as the surviving explanation for a missing connection or settlement.`
    };
  }

  function expansionCore(record) {
    return {
      sourceCivilizationOriginsDigest: record.sourceCivilizationOriginsDigest,
      sourceResourcePotentialDigest: record.sourceResourcePotentialDigest,
      sourcePreUrbanHumanityDigest: record.sourcePreUrbanHumanityDigest,
      historicalHorizonYear: record.historicalHorizonYear,
      foundationRows: record.foundationRows,
      corridorRows: record.corridorRows,
      strongholdRows: record.strongholdRows,
      failedProjectRows: record.failedProjectRows,
      currentSupportComponents: record.currentSupportComponents,
      publicDirectoryDigest: record.publicDirectoryDigest,
      diagnostics: record.diagnostics
    };
  }

  function publicCore(directory) {
    return {
      historicalHorizonYear: directory.historicalHorizonYear,
      chronology: directory.chronology,
      currentSupportComponents: directory.currentSupportComponents
    };
  }

  function createCityExpansionHistory(worldSeed, map, options = {}) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for city-expansion history.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCivilizationOrigins.validateCivilizationOrigins(strategicMap);
    if (strategicMap.humanGeography) throw new Error("City-expansion history must be generated before playable-year human geography.");
    const horizonYear = Math.max(strategicMap.civilizationOrigins.eraEndYear + 120, Math.floor(Number(options.historicalHorizonYear) || 900));
    const originAttempts = strategicMap.civilizationOrigins.attemptRows.filter((attempt) => attempt.outcome === "enduringCity");
    const targetCityCount = Math.min(expansionTarget(strategicMap, horizonYear, originAttempts), originAttempts.length + Math.floor(Math.max(0, horizonYear - strategicMap.civilizationOrigins.eraEndYear - 2) / 2));
    const originByCityId = new Map(originAttempts.map((attempt) => [attempt.cityId, attempt]));
    const cityRows = originAttempts.map((attempt) => ({ id: attempt.cityId, name: attempt.cityName, cellId: attempt.siteCellId, foundingYear: attempt.year, foundingPopulation: attempt.initialPopulation, originLineageCityId: attempt.cityId, independentRefuge: false }));
    const occupiedIndices = cityRows.map((city) => StrategicWorld.cellIndex(city.cellId));
    const usedCityNames = new Set(cityRows.map((city) => city.name));
    const usedFounderNames = new Set(originAttempts.flatMap((attempt) => attempt.founderRows.map((founder) => founder.name)));
    const remainingColonistCapacity = new Map(cityRows.map((city) => [city.id, colonistCapacity(strategicMap, city, city.foundingPopulation, city.foundingYear, horizonYear)]));
    const resourceCounts = new Map(RESOURCE_FAMILIES.map((family) => [family.id, 0]));
    originAttempts.forEach((attempt) => resourceCounts.set(attempt.resourcePurposeId, (resourceCounts.get(attempt.resourcePurposeId) || 0) + 1));
    const people = StrategicPreUrbanHumanity.publicPreUrbanOverview(strategicMap).peoples;
    const groups = StrategicPreUrbanHumanity.expandPopulationGroups(strategicMap);
    const gods = StrategicReligions.createGods(seed, strategicMap.strategicDivinity.worldTheme);
    const foundationRows = [];
    const corridorRows = [];
    const refugePlanned = seededNumber(seed, "independent-refuge-world") < 0.16 && targetCityCount > originAttempts.length + 5;
    const refugeOrdinal = refugePlanned ? Math.floor((targetCityCount - originAttempts.length) * 0.62) : -1;
    const expansionCount = targetCityCount - originAttempts.length;
    for (let expansionOrdinal = 0; expansionOrdinal < expansionCount; expansionOrdinal += 1) {
      const ordinal = foundationRows.length;
      const independentRefuge = expansionOrdinal === refugeOrdinal;
      const desiredFamily = [...RESOURCE_FAMILIES].sort((left, right) => (resourceCounts.get(left.id) || 0) - (resourceCounts.get(right.id) || 0) || seededNumber(seed, `family-order:${ordinal}:${left.id}`) - seededNumber(seed, `family-order:${ordinal}:${right.id}`))[0];
      const requiredParentId = expansionOrdinal < originAttempts.length ? originAttempts[expansionOrdinal].cityId : null;
      const selected = chooseExpansion(seed, strategicMap, cityRows, occupiedIndices, remainingColonistCapacity, desiredFamily.id, independentRefuge, requiredParentId)
        || chooseExpansion(seed, strategicMap, cityRows, occupiedIndices, remainingColonistCapacity, desiredFamily.id, independentRefuge);
      if (!selected) break;
      const parentOriginLineage = selected.parent.originLineageCityId;
      let cause = independentRefuge ? "politicalEscape" : pick(FOUNDATION_CAUSES, seed, `foundation-cause:${ordinal}`);
      if (desiredFamily.id === "biologicalProductivity" && seededNumber(seed, `agricultural-cause:${ordinal}`) > 0.35) cause = "agriculturalExpansion";
      if (!independentRefuge && ordinal < RESOURCE_FAMILIES.length / 2) cause = "resourceExtraction";
      const relationship = independentRefuge ? "openlyHostile" : foundingRelationship(cause);
      const maximumContribution = remainingColonistCapacity.get(selected.parent.id);
      const foundingPopulation = Math.min(maximumContribution, integerBetween(seed, `founding-population:${ordinal}`, independentRefuge ? 700 : 1100, independentRefuge ? 1550 : 3400));
      if (foundingPopulation < 700) break;
      remainingColonistCapacity.set(selected.parent.id, maximumContribution - foundingPopulation);
      const cityId = `city:${String(selected.site.index).padStart(5, "0")}`;
      const cityName = StrategicHumanGeography.generatedCityName(seed, selected.site.index, usedCityNames);
      const proposedFoundingYear = strategicMap.civilizationOrigins.eraEndYear + Math.max(1, Math.round((expansionOrdinal + 1) * (horizonYear - strategicMap.civilizationOrigins.eraEndYear - 10) / Math.max(1, expansionCount + 1))) + integerBetween(seed, `foundation-year-jitter:${ordinal}`, -7, 7);
      const foundingYear = Math.min(horizonYear - 2, Math.max((foundationRows.at(-1)?.foundingYear || strategicMap.civilizationOrigins.eraEndYear) + 2, proposedFoundingYear));
      const localGroups = groups.filter((group) => group.rangeCellIds.includes(StrategicWorld.cellId(selected.site.index))).sort((left, right) => right.population - left.population || left.id.localeCompare(right.id));
      const localPeopleIds = [...new Set(localGroups.slice(0, 2).map((group) => group.peopleId))];
      const parentOrigin = originByCityId.get(parentOriginLineage);
      const parentPatronId = parentOrigin?.patronGodId || null;
      const patronGodId = independentRefuge ? null : (seededNumber(seed, `retain-parent-patron:${ordinal}`) < 0.72 ? parentPatronId : pick(gods, seed, `founding-patron:${ordinal}`).id);
      const founderCount = independentRefuge ? 1 : (seededNumber(seed, `founder-circle:${ordinal}`) < 0.24 ? 2 + Math.floor(seededNumber(seed, `founder-circle-count:${ordinal}`) * 2) : 1);
      const affiliation = independentRefuge ? "selfPoweredIndependent" : pick(FOUNDER_AFFILIATIONS.slice(0, 3), seed, `founder-affiliation:${ordinal}`);
      const civicRelation = pick(CIVIC_RELATIONS, seed, `civic-relation:${ordinal}`);
      const founderRows = Array.from({ length: founderCount }, (_, founderOrdinal) => {
        const peopleId = localPeopleIds[founderOrdinal % Math.max(1, localPeopleIds.length)] || parentOrigin?.founderRows[0]?.peopleId || people[0].id;
        return {
          id: `expansion-founder:${String(ordinal + 1).padStart(2, "0")}:${founderOrdinal + 1}`,
          name: generatedFounderName(seed, ordinal, founderOrdinal, usedFounderNames),
          peopleId,
          affiliation,
          civicRelation,
          exceptionalCapabilities: [pick(FOUNDER_CAPABILITIES, seed, `founder-capability:${ordinal}:${founderOrdinal}:0`), pick(FOUNDER_CAPABILITIES, seed, `founder-capability:${ordinal}:${founderOrdinal}:1`)].filter((value, index, values) => values.indexOf(value) === index)
        };
      });
      const foundation = {
        id: `city-foundation:${String(ordinal + 1).padStart(2, "0")}`,
        foundingYear,
        cityId,
        cityName,
        siteCellId: StrategicWorld.cellId(selected.site.index),
        parentCityId: selected.parent.id,
        originLineageCityId: parentOriginLineage,
        independentRefuge,
        foundationCause: cause,
        relationshipAtFoundation: relationship,
        resourcePurposeId: desiredFamily.id,
        foundingPopulation,
        populationSourceRows: [[selected.parent.id, foundingPopulation]],
        localPeopleIds,
        founderRows,
        patronGodId,
        foundingAffiliation: affiliation,
        civicRelation,
        materialRows: selected.site.materialRows,
        canonicalMotive: independentRefuge ? "escapeReligiousRule" : pick(CANONICAL_MOTIVES, seed, `canonical-motive:${ordinal}`),
        publicExplanation: independentRefuge
          ? "The founders publicly declared that distance from gods, inherited obligations, and city politics justified the danger of deliberate isolation."
          : `${cityName} was founded as a sovereign city for ${cause.replace(/([a-z])([A-Z])/g, "$1 $2")}; its lineage created no right of rule for ${selected.parent.name}.`
      };
      foundationRows.push(foundation);
      resourceCounts.set(desiredFamily.id, (resourceCounts.get(desiredFamily.id) || 0) + 1);
      const city = { id: cityId, name: cityName, cellId: foundation.siteCellId, foundingYear, foundingPopulation, originLineageCityId: parentOriginLineage, independentRefuge };
      cityRows.push(city);
      occupiedIndices.push(selected.site.index);
      remainingColonistCapacity.set(cityId, colonistCapacity(strategicMap, city, foundingPopulation, foundingYear, horizonYear));
      if (!independentRefuge) {
        const endpointCityIds = [selected.parent.id, cityId].sort();
        const corridorId = `corridor:${endpointCityIds.map((id) => id.slice(5)).join("-")}`;
        corridorRows.push({
          id: corridorId,
          corridorClass: "lineageSupport",
          endpointCityIds,
          cellPath: selected.path.path.map(StrategicWorld.cellId),
          constructionYear: Math.min(horizonYear, foundingYear + 1),
          constructionPurpose: "supportNewSovereignCity",
          relationshipAtConstruction: relationship,
          administration: relationship === "openlyHostile" ? pick(STRONGHOLD_ADMINISTRATIONS.slice(3), seed, `corridor-administration:${ordinal}`) : pick(STRONGHOLD_ADMINISTRATIONS.slice(0, 4), seed, `corridor-administration:${ordinal}`),
          materialBasis: "verifiedStoneMetalTimberAndProvisioning",
          lengthKm: pathLengthKm(strategicMap, selected.path.path),
          relativeConstructionCost: Math.round(selected.path.cost * 100)
        });
      }
    }
    const refugeCityIds = new Set(foundationRows.filter((foundation) => foundation.independentRefuge).map((foundation) => foundation.cityId));
    createBridgeCorridors(seed, strategicMap, cityRows, corridorRows, refugeCityIds, horizonYear);
    corridorRows.sort((left, right) => left.constructionYear - right.constructionYear || left.id.localeCompare(right.id));
    const strongholdRows = createStrongholdRows(seed, strategicMap, corridorRows, cityRows, horizonYear);
    const failedProjectCount = foundationRows.length >= 8 ? 1 + Math.floor(seededNumber(seed, "failed-project-count") * 2) : 0;
    const unusedCandidates = candidateSites(seed, strategicMap, cityRows, occupiedIndices, pick(RESOURCE_FAMILIES, seed, "failure-resource").id, false);
    const failedProjectRows = unusedCandidates.slice(0, failedProjectCount).map((site, ordinal) => {
      const sponsor = cityRows[Math.floor(seededNumber(seed, `failure-sponsor:${ordinal}`) * cityRows.length) % cityRows.length];
      const consequence = pick(FAILURE_CONSEQUENCES, seed, `failure-consequence:${ordinal}`);
      return {
        id: `failed-expansion:${String(ordinal + 1).padStart(2, "0")}`,
        year: Math.min(horizonYear, Math.max(sponsor.foundingYear + 3, strategicMap.civilizationOrigins.eraEndYear + integerBetween(seed, `failure-year:${ordinal}`, 40, Math.max(41, horizonYear - strategicMap.civilizationOrigins.eraEndYear)))),
        sponsorCityId: sponsor.id,
        siteCellId: StrategicWorld.cellId(site.index),
        failureCause: pick(FAILURE_CAUSES, seed, `failure-cause:${ordinal}`),
        canonicalMotive: pick(CANONICAL_MOTIVES, seed, `failure-motive:${ordinal}`),
        retainedConsequence: { kind: consequence, name: `${sponsor.name} ${consequence.replace(/([a-z])([A-Z])/g, "$1 $2")}`, cellId: StrategicWorld.cellId(site.index) }
      };
    }).sort((left, right) => left.year - right.year || left.id.localeCompare(right.id));
    const components = connectedComponents(cityRows.map((city) => city.id), corridorRows).map((cityIds) => {
      const corridorIds = corridorRows.filter((corridor) => corridor.endpointCityIds.some((cityId) => cityIds.includes(cityId))).map((corridor) => corridor.id);
      const originLineageCityIds = [...new Set(cityIds.map((cityId) => cityRows.find((city) => city.id === cityId).originLineageCityId))].sort();
      return { id: `support-component:${StrategicWorld.stableHash(cityIds)}`, cityIds, corridorIds, originLineageCityIds };
    }).sort((left, right) => left.id.localeCompare(right.id));
    const cityById = new Map(cityRows.map((city) => [city.id, city]));
    const peopleById = new Map(people.map((person) => [person.id, person]));
    const godById = new Map(gods.map((god) => [god.id, { id: god.id, name: god.name }]));
    const publicFoundationRows = foundationRows.map((foundation) => publicFoundation(foundation, { cityById, peopleById, godById }));
    const publicCorridorRows = corridorRows.map((corridor) => publicCorridor(corridor, strongholdRows, cityById));
    const publicFailureRows = failedProjectRows.map((failure) => publicFailure(failure, cityById));
    const publicDirectory = {
      historicalHorizonYear: horizonYear,
      chronology: [...publicFoundationRows, ...publicCorridorRows, ...publicFailureRows].sort((left, right) => left.year - right.year || left.id.localeCompare(right.id)),
      currentSupportComponents: components.map((component) => ({ id: component.id, cityIds: clone(component.cityIds), originLineageCityIds: clone(component.originLineageCityIds), physicallyConnected: true, politicalUnity: false }))
    };
    publicDirectory.digest = `public-city-expansion-${StrategicWorld.stableHash(publicCore(publicDirectory))}`;
    const record = {
      sourceCivilizationOriginsDigest: strategicMap.civilizationOrigins.digest,
      sourceResourcePotentialDigest: strategicMap.resourcePotential.digest,
      sourcePreUrbanHumanityDigest: strategicMap.preUrbanHumanity.digest,
      historicalHorizonYear: horizonYear,
      foundationRows,
      corridorRows,
      strongholdRows,
      failedProjectRows,
      currentSupportComponents: components,
      publicDirectoryDigest: publicDirectory.digest,
      diagnostics: {
        originCityCount: originAttempts.length,
        laterCityCount: foundationRows.length,
        totalCityCount: cityRows.length,
        independentRefugeCount: refugeCityIds.size,
        lineageCorridorCount: corridorRows.filter((corridor) => corridor.corridorClass === "lineageSupport").length,
        bridgeCorridorCount: corridorRows.filter((corridor) => corridor.corridorClass === "componentBridge").length,
        jointStrongholdCount: strongholdRows.length,
        retainedFailedProjectCount: failedProjectRows.length,
        currentSupportComponentCount: components.length,
        representedPrimaryResourceFamilyCount: new Set([...originAttempts.map((attempt) => attempt.resourcePurposeId), ...foundationRows.map((foundation) => foundation.resourcePurposeId)]).size
      }
    };
    record.digest = `city-expansion-${StrategicWorld.stableHash(expansionCore(record))}`;
    return { cityExpansionHistory: record, publicDirectory };
  }

  function allCitySeeds(map) {
    if (!map?.civilizationOrigins) return [];
    const origins = map.civilizationOrigins.attemptRows.filter((attempt) => attempt.outcome === "enduringCity").map((attempt) => ({
      cityId: attempt.cityId, cityName: attempt.cityName, cellId: attempt.siteCellId, foundingYear: attempt.year,
      foundingPopulation: attempt.initialPopulation, parentCityId: null, originLineageCityId: attempt.cityId,
      independentRefuge: false, foundationCause: "divineOrigin", relationshipAtFoundation: null,
      resourcePurposeId: attempt.resourcePurposeId, founderRows: clone(attempt.founderRows), patronGodId: attempt.patronGodId,
      foundingAffiliation: attempt.foundingAffiliation, civicRelation: attempt.civicRelation
    }));
    const later = (map.cityExpansionHistory?.foundationRows || []).map((foundation) => ({
      cityId: foundation.cityId, cityName: foundation.cityName, cellId: foundation.siteCellId, foundingYear: foundation.foundingYear,
      foundingPopulation: foundation.foundingPopulation, parentCityId: foundation.parentCityId, originLineageCityId: foundation.originLineageCityId,
      independentRefuge: foundation.independentRefuge, foundationCause: foundation.foundationCause,
      relationshipAtFoundation: foundation.relationshipAtFoundation, resourcePurposeId: foundation.resourcePurposeId,
      founderRows: clone(foundation.founderRows), patronGodId: foundation.patronGodId,
      foundingAffiliation: foundation.foundingAffiliation, civicRelation: foundation.civicRelation
    }));
    return [...origins, ...later].sort((left, right) => left.foundingYear - right.foundingYear || left.cityId.localeCompare(right.cityId));
  }

  function corridorSeeds(map) { return clone(map?.cityExpansionHistory?.corridorRows || []); }
  function strongholdSeeds(map) { return clone(map?.cityExpansionHistory?.strongholdRows || []); }
  function publicCityExpansion(map) { return map?.publicCityExpansionDirectory ? clone(map.publicCityExpansionDirectory) : null; }

  function validateCityExpansionHistory(map, record = map?.cityExpansionHistory, directory = map?.publicCityExpansionDirectory) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCivilizationOrigins.validateCivilizationOrigins(strategicMap);
    if (!record || !directory || record.sourceCivilizationOriginsDigest !== strategicMap.civilizationOrigins.digest || record.sourceResourcePotentialDigest !== strategicMap.resourcePotential.digest || record.sourcePreUrbanHumanityDigest !== strategicMap.preUrbanHumanity.digest || record.publicDirectoryDigest !== directory.digest) throw new Error("City-expansion history is incomplete or source-inconsistent.");
    const origins = strategicMap.civilizationOrigins.attemptRows.filter((attempt) => attempt.outcome === "enduringCity");
    const cityById = new Map(origins.map((attempt) => [attempt.cityId, { id: attempt.cityId, name: attempt.cityName, cellId: attempt.siteCellId, foundingYear: attempt.year, originLineageCityId: attempt.cityId, independentRefuge: false }]));
    const cityIds = new Set(cityById.keys());
    const cityCells = new Set(origins.map((attempt) => attempt.siteCellId));
    const founderIds = new Set(origins.flatMap((attempt) => attempt.founderRows.map((founder) => founder.id)));
    const allocatedByParent = new Map();
    for (const [foundationOrdinal, foundation] of record.foundationRows.entries()) {
      const parent = cityById.get(foundation.parentCityId);
      if (!parent || foundation.foundingYear <= parent.foundingYear || foundation.foundingYear >= record.historicalHorizonYear || (foundationOrdinal > 0 && foundation.foundingYear <= record.foundationRows[foundationOrdinal - 1].foundingYear) || cityIds.has(foundation.cityId) || cityCells.has(foundation.siteCellId) || foundation.cityId !== `city:${String(StrategicWorld.cellIndex(foundation.siteCellId)).padStart(5, "0")}`) throw new Error("A later city has invalid parentage, chronology, identity, or site.");
      const index = StrategicWorld.cellIndex(foundation.siteCellId);
      if (strategicMap.surface.classes[index] !== "L" || map.surface.regionByCell[index] !== map.surface.regionByCell[StrategicWorld.cellIndex(parent.cellId)] || !FOUNDATION_CAUSES.includes(foundation.foundationCause) || !FOUNDATION_RELATIONSHIPS.includes(foundation.relationshipAtFoundation) || !FAMILY_BY_ID.has(foundation.resourcePurposeId) || !CANONICAL_MOTIVES.includes(foundation.canonicalMotive)) throw new Error("A later city lacks a valid physical cause, relationship, purpose, or motive.");
      const physical = siteFacts(strategicMap, index, "");
      if (!physical.viable || JSON.stringify(physical.materialRows) !== JSON.stringify(foundation.materialRows) || !Number.isInteger(foundation.foundingPopulation) || foundation.foundingPopulation < 700 || JSON.stringify(foundation.populationSourceRows) !== JSON.stringify([[foundation.parentCityId, foundation.foundingPopulation]])) throw new Error("A later city lacks viable saved materials or population allocation.");
      if (!Array.isArray(foundation.founderRows) || foundation.founderRows.length < 1 || foundation.founderRows.length > 3 || foundation.founderRows.some((founder) => founderIds.has(founder.id) || !founder.name || !FOUNDER_AFFILIATIONS.includes(founder.affiliation) || !CIVIC_RELATIONS.includes(founder.civicRelation) || !founder.exceptionalCapabilities?.length || founder.exceptionalCapabilities.some((capability) => !FOUNDER_CAPABILITIES.includes(capability)))) throw new Error("Every later city requires one to three unique exceptional founders.");
      foundation.founderRows.forEach((founder) => founderIds.add(founder.id));
      if (foundation.independentRefuge ? (foundation.patronGodId !== null || foundation.foundingAffiliation !== "selfPoweredIndependent" || foundation.relationshipAtFoundation !== "openlyHostile") : (!foundation.patronGodId || foundation.foundingAffiliation === "selfPoweredIndependent")) throw new Error("Independent refuge and ordinary divine-affiliation rules are inconsistent.");
      if (foundation.originLineageCityId !== parent.originLineageCityId) throw new Error("A daughter city's demographic lineage must follow its primary parent without implying allegiance.");
      allocatedByParent.set(parent.id, (allocatedByParent.get(parent.id) || 0) + foundation.foundingPopulation);
      cityIds.add(foundation.cityId);
      cityCells.add(foundation.siteCellId);
      cityById.set(foundation.cityId, { id: foundation.cityId, name: foundation.cityName, cellId: foundation.siteCellId, foundingYear: foundation.foundingYear, originLineageCityId: foundation.originLineageCityId, independentRefuge: foundation.independentRefuge, foundingPopulation: foundation.foundingPopulation });
    }
    if (cityIds.size > 38) throw new Error("City-expansion history exceeds its bounded world-scale city count.");
    for (const [parentId, allocation] of allocatedByParent) {
      const parent = cityById.get(parentId);
      const origin = origins.find((attempt) => attempt.cityId === parentId);
      const foundingPopulation = origin?.initialPopulation || parent.foundingPopulation;
      if (allocation > colonistCapacity(strategicMap, parent, foundingPopulation, parent.foundingYear, record.historicalHorizonYear)) throw new Error("A parent city contributes more founding population than its compact growth ledger permits.");
    }
    const routeIds = new Set();
    for (const corridor of record.corridorRows) {
      const normalized = StrategicWorld.validateRouteRecord(strategicMap, { id: corridor.id, kind: "strategicIntercityCorridor", endpointIds: corridor.endpointCityIds, cellPath: corridor.cellPath });
      const firstEndpointCell = cityById.get(corridor.endpointCityIds[0]).cellId;
      if (routeIds.has(corridor.id) || !["lineageSupport", "componentBridge"].includes(corridor.corridorClass) || corridor.endpointCityIds.length !== 2 || corridor.endpointCityIds.some((cityId) => !cityIds.has(cityId)) || corridor.constructionYear <= Math.max(...corridor.endpointCityIds.map((cityId) => cityById.get(cityId).foundingYear)) || corridor.constructionYear > record.historicalHorizonYear || (normalized.cellPath[0] !== firstEndpointCell && normalized.cellPath.at(-1) !== firstEndpointCell) || !FOUNDATION_RELATIONSHIPS.includes(corridor.relationshipAtConstruction) || !STRONGHOLD_ADMINISTRATIONS.includes(corridor.administration)) throw new Error("A historical corridor has invalid endpoints, chronology, path, relationship, or administration.");
      if (corridor.corridorClass === "componentBridge" && new Set(corridor.endpointCityIds.map((cityId) => cityById.get(cityId).originLineageCityId)).size < 2) throw new Error("A component bridge must connect distinct founding lineages rather than relabel an internal route.");
      routeIds.add(corridor.id);
    }
    for (const foundation of record.foundationRows) {
      const corridors = record.corridorRows.filter((corridor) => corridor.endpointCityIds.includes(foundation.cityId));
      if (foundation.independentRefuge ? corridors.length > 0 : !corridors.some((corridor) => corridor.corridorClass === "lineageSupport" && corridor.endpointCityIds.includes(foundation.parentCityId))) throw new Error("A normal daughter city requires its parent support corridor while an intentional refuge rejects all corridors.");
    }
    const strongholdIds = new Set();
    for (const stronghold of record.strongholdRows) {
      const corridor = record.corridorRows.find((entry) => entry.id === stronghold.corridorId);
      if (!corridor || strongholdIds.has(stronghold.id) || !corridor.cellPath.includes(stronghold.cellId) || stronghold.foundingYear < corridor.constructionYear || stronghold.foundingYear > record.historicalHorizonYear || JSON.stringify(stronghold.sponsorCityIds) !== JSON.stringify(corridor.endpointCityIds) || stronghold.sponsorContributionRows.length !== 2 || stronghold.sponsorContributionRows.reduce((total, row) => total + row[1], 0) !== 100 || stronghold.sponsorContributionRows.reduce((total, row) => total + row[2], 0) !== 100 || !STRONGHOLD_ADMINISTRATIONS.includes(stronghold.administration) || !SERVICE_MODES.includes(stronghold.serviceMode)) throw new Error("A route stronghold is not causally tied to a corridor and two complete sponsor obligations.");
      strongholdIds.add(stronghold.id);
    }
    const cityCellIndices = new Set([...cityCells].map(StrategicWorld.cellIndex));
    for (const corridor of record.corridorRows) {
      const expectedCells = strongholdCellsForPath(strategicMap, corridor.cellPath.map(StrategicWorld.cellIndex), cityCellIndices).map(StrategicWorld.cellId);
      const actualCells = record.strongholdRows.filter((stronghold) => stronghold.corridorId === corridor.id).sort((left, right) => left.ordinal - right.ordinal).map((stronghold) => stronghold.cellId);
      if (JSON.stringify(actualCells) !== JSON.stringify(expectedCells)) throw new Error(`${corridor.id} does not have exactly the strongholds required by the maximum support-leg rule.`);
    }
    if (record.failedProjectRows.some((failure) => !cityIds.has(failure.sponsorCityId) || !FAILURE_CAUSES.includes(failure.failureCause) || !CANONICAL_MOTIVES.includes(failure.canonicalMotive) || !FAILURE_CONSEQUENCES.includes(failure.retainedConsequence?.kind) || failure.retainedConsequence.cellId !== failure.siteCellId)) throw new Error("A retained failed expansion lacks a cause, sponsor, or physical consequence.");
    const expectedComponents = connectedComponents([...cityIds], record.corridorRows);
    if (record.currentSupportComponents.length !== expectedComponents.length || record.currentSupportComponents.some((component) => {
      const expectedCityIds = expectedComponents.find((cityList) => JSON.stringify(cityList) === JSON.stringify(component.cityIds));
      const expectedCorridorIds = record.corridorRows.filter((corridor) => corridor.endpointCityIds.every((cityId) => component.cityIds.includes(cityId))).map((corridor) => corridor.id);
      const expectedLineages = [...new Set(component.cityIds.map((cityId) => cityById.get(cityId).originLineageCityId))].sort();
      return !expectedCityIds || component.id !== `support-component:${StrategicWorld.stableHash(component.cityIds)}` || JSON.stringify(component.corridorIds) !== JSON.stringify(expectedCorridorIds) || JSON.stringify(component.originLineageCityIds) !== JSON.stringify(expectedLineages);
    })) throw new Error("Current physical support components do not match the historical corridor graph.");
    const publicById = new Map(directory.chronology.map((event) => [event.id, event]));
    if (publicById.size !== record.foundationRows.length + record.corridorRows.length + record.failedProjectRows.length) throw new Error("The public city-expansion chronology has missing or duplicate events.");
    for (const foundation of record.foundationRows) {
      const event = publicById.get(foundation.id);
      if (!event || event.kind !== "cityFoundation" || event.year !== foundation.foundingYear || event.city?.id !== foundation.cityId || event.city?.name !== foundation.cityName || event.city?.cellId !== foundation.siteCellId || event.parentCity?.id !== foundation.parentCityId || event.originLineageCityId !== foundation.originLineageCityId || event.cause !== foundation.foundationCause || event.relationshipAtFoundation !== foundation.relationshipAtFoundation || event.independentRefuge !== foundation.independentRefuge || event.foundingPopulationBand !== populationBand(foundation.foundingPopulation) || event.patron?.id !== (foundation.patronGodId || undefined) || event.resourcePurpose?.id !== foundation.resourcePurposeId || JSON.stringify(event.materialBasis) !== JSON.stringify(foundation.materialRows.map((row) => ({ resourceId: row[0], sufficiency: materialBand(row[1], row[2]) }))) || event.supportAtFoundation !== (foundation.independentRefuge ? "intentionalIsolation" : "parentCorridorConstructed") || JSON.stringify(event.founders.map((founder) => [founder.id, founder.name, founder.peopleId, founder.affiliation, founder.civicRelation, founder.exceptionalCapabilities])) !== JSON.stringify(foundation.founderRows.map((founder) => [founder.id, founder.name, founder.peopleId, founder.affiliation, founder.civicRelation, founder.exceptionalCapabilities]))) throw new Error(`${foundation.id} has an inconsistent public foundation account.`);
    }
    for (const corridor of record.corridorRows) {
      const event = publicById.get(`history:${corridor.id}`);
      if (!event || event.kind !== (corridor.corridorClass === "componentBridge" ? "supportComponentBridge" : "supportCorridor") || event.year !== corridor.constructionYear || event.corridorId !== corridor.id || JSON.stringify(event.endpointCities.map((city) => city.id)) !== JSON.stringify(corridor.endpointCityIds) || event.constructionPurpose !== corridor.constructionPurpose || event.relationshipAtConstruction !== corridor.relationshipAtConstruction || event.administration !== corridor.administration || event.strongholdCount !== record.strongholdRows.filter((stronghold) => stronghold.corridorId === corridor.id).length || event.lengthKm !== corridor.lengthKm) throw new Error(`${corridor.id} has an inconsistent public construction account.`);
    }
    for (const failure of record.failedProjectRows) {
      const event = publicById.get(failure.id);
      if (!event || event.kind !== "failedExpansion" || event.year !== failure.year || event.sponsorCity?.id !== failure.sponsorCityId || event.siteCellId !== failure.siteCellId || JSON.stringify(event.retainedConsequence) !== JSON.stringify(failure.retainedConsequence)) throw new Error(`${failure.id} has an inconsistent public retained consequence.`);
    }
    const expectedPublicComponents = record.currentSupportComponents.map((component) => ({ id: component.id, cityIds: clone(component.cityIds), originLineageCityIds: clone(component.originLineageCityIds), physicallyConnected: true, politicalUnity: false }));
    if (directory.historicalHorizonYear !== record.historicalHorizonYear || JSON.stringify(directory.currentSupportComponents) !== JSON.stringify(expectedPublicComponents) || directory.digest !== `public-city-expansion-${StrategicWorld.stableHash(publicCore(directory))}` || JSON.stringify(directory).match(/canonicalMotive|"foundingPopulation":|populationSourceRows|materialRows|failureCause|relativeConstructionCost/)) throw new Error("The public city-expansion directory is inconsistent or leaks canonical history.");
    const diagnostics = record.diagnostics;
    if (!diagnostics || diagnostics.originCityCount !== origins.length || diagnostics.laterCityCount !== record.foundationRows.length || diagnostics.totalCityCount !== cityIds.size || diagnostics.independentRefugeCount !== record.foundationRows.filter((foundation) => foundation.independentRefuge).length || diagnostics.lineageCorridorCount !== record.corridorRows.filter((corridor) => corridor.corridorClass === "lineageSupport").length || diagnostics.bridgeCorridorCount !== record.corridorRows.filter((corridor) => corridor.corridorClass === "componentBridge").length || diagnostics.jointStrongholdCount !== record.strongholdRows.length || diagnostics.retainedFailedProjectCount !== record.failedProjectRows.length || diagnostics.currentSupportComponentCount !== record.currentSupportComponents.length) throw new Error("City-expansion diagnostics do not match canonical history.");
    if (record.digest !== `city-expansion-${StrategicWorld.stableHash(expansionCore(record))}`) throw new Error("City-expansion history does not match its digest.");
    return { cityExpansionHistory: clone(record), publicDirectory: clone(directory) };
  }

  function attachCityExpansionHistory(worldSeed, map, options = {}) {
    const next = StrategicWorld.validateStrategicMap(map);
    const generated = createCityExpansionHistory(worldSeed, next, options);
    next.cityExpansionHistory = generated.cityExpansionHistory;
    next.publicCityExpansionDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function auditCityExpansionHistory(map) {
    const { cityExpansionHistory, publicDirectory } = validateCityExpansionHistory(map);
    const citySeeds = allCitySeeds(map);
    const refugeIds = new Set(cityExpansionHistory.foundationRows.filter((foundation) => foundation.independentRefuge).map((foundation) => foundation.cityId));
    return {
      valid: true,
      everyLaterCityHasCausalParent: cityExpansionHistory.foundationRows.every((foundation) => Boolean(foundation.parentCityId && foundation.originLineageCityId)),
      parentageNeverImpliesAllegiance: cityExpansionHistory.foundationRows.every((foundation) => FOUNDATION_RELATIONSHIPS.includes(foundation.relationshipAtFoundation)),
      everyOrdinaryCityPhysicallySupported: cityExpansionHistory.foundationRows.filter((foundation) => !foundation.independentRefuge).every((foundation) => cityExpansionHistory.corridorRows.some((corridor) => corridor.endpointCityIds.includes(foundation.cityId) && corridor.endpointCityIds.includes(foundation.parentCityId))),
      refugesIntentionallyDisconnected: [...refugeIds].every((cityId) => cityExpansionHistory.corridorRows.every((corridor) => !corridor.endpointCityIds.includes(cityId))),
      strongholdsJointlyResponsible: cityExpansionHistory.strongholdRows.every((stronghold) => stronghold.sponsorCityIds.length === 2 && stronghold.sponsorContributionRows.reduce((total, row) => total + row[1], 0) === 100 && stronghold.sponsorContributionRows.reduce((total, row) => total + row[2], 0) === 100),
      bridgesDoNotMergeLineages: cityExpansionHistory.corridorRows.filter((corridor) => corridor.corridorClass === "componentBridge").every((corridor) => new Set(corridor.endpointCityIds.map((cityId) => citySeeds.find((city) => city.cityId === cityId).originLineageCityId)).size > 1),
      failedProjectsRetainedOnlyWithConsequences: cityExpansionHistory.failedProjectRows.every((failure) => Boolean(failure.retainedConsequence)),
      publicHistoryHidesCanonicalTruth: !JSON.stringify(publicDirectory).match(/canonicalMotive|"foundingPopulation":|populationSourceRows|materialRows|failureCause|relativeConstructionCost/),
      diagnostics: clone(cityExpansionHistory.diagnostics)
    };
  }

  return Object.freeze({
    FOUNDATION_CAUSES, FOUNDATION_RELATIONSHIPS, CANONICAL_MOTIVES, FOUNDER_CAPABILITIES,
    FOUNDER_AFFILIATIONS, CIVIC_RELATIONS, STRONGHOLD_ADMINISTRATIONS, SERVICE_MODES,
    FAILURE_CAUSES, FAILURE_CONSEQUENCES, SUPPORT_MAXIMUM_LEG_KM, MINIMUM_CITY_SPACING_KM,
    MAXIMUM_EXPANSION_DISTANCE_KM, createCityExpansionHistory, validateCityExpansionHistory,
    attachCityExpansionHistory, allCitySeeds, corridorSeeds, strongholdSeeds, publicCityExpansion,
    auditCityExpansionHistory
  });
});
