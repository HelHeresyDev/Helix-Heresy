(function initStrategicSettlements(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const resourcePotential = typeof module === "object" && module.exports ? require("./strategic-resource-potential") : root?.HelixStrategicResourcePotential;
  const humanGeography = typeof module === "object" && module.exports ? require("./strategic-human-geography") : root?.HelixStrategicHumanGeography;
  const cityPolities = typeof module === "object" && module.exports ? require("./strategic-city-polities") : root?.HelixStrategicCityPolities;
  const beastEcology = typeof module === "object" && module.exports ? require("./strategic-beast-ecology") : root?.HelixStrategicBeastEcology;
  const religions = typeof module === "object" && module.exports ? require("./strategic-religions") : root?.HelixStrategicReligions;
  const civilizationOrigins = typeof module === "object" && module.exports ? require("./strategic-civilization-origins") : root?.HelixStrategicCivilizationOrigins;
  const cityExpansion = typeof module === "object" && module.exports ? require("./strategic-city-expansion") : root?.HelixStrategicCityExpansion;
  const capabilityHistory = typeof module === "object" && module.exports ? require("./strategic-capability-history") : root?.HelixStrategicCapabilityHistory;
  const nonStateNetworks = typeof module === "object" && module.exports ? require("./strategic-non-state-networks") : root?.HelixStrategicNonStateNetworks;
  const api = factory(strategicWorld, resourcePotential, humanGeography, cityPolities, beastEcology, religions, civilizationOrigins, cityExpansion, capabilityHistory, nonStateNetworks);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicSettlements = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicSettlementsApi(StrategicWorld, StrategicResourcePotential, StrategicHumanGeography, StrategicCityPolities, StrategicBeastEcology, StrategicReligions, StrategicCivilizationOrigins, StrategicCityExpansion, StrategicCapabilityHistory, StrategicNonStateNetworks) {
  "use strict";

  if (!StrategicWorld || !StrategicResourcePotential || !StrategicHumanGeography || !StrategicCityPolities || !StrategicBeastEcology || !StrategicReligions || !StrategicCivilizationOrigins || !StrategicCityExpansion || !StrategicCapabilityHistory || !StrategicNonStateNetworks) throw new Error("Strategic settlement dependencies must load before strategic-settlements.js");

  const CITY_PURPOSES = Object.freeze(["resourceAnchor", "independentRefuge"]);
  const DIVINE_AFFILIATIONS = Object.freeze(["chosenRepresentative", "divinelyInvestedChampion", "godAffiliatedHero", "selfPoweredIndependent"]);
  const POWER_CIVIC_RELATIONS = Object.freeze(["sovereignIsFoundingPower", "foundingPowerSupportsSovereign", "foundingCircleSharesAuthority"]);
  const STRONGHOLD_ADMINISTRATIONS = Object.freeze(["jointCommandCouncil", "locallyElectedServiceCouncil", "appointedCompactAdministrator", "rotatingSponsorCommand", "dividedSponsorFacilities", "neutralCompactAdministration"]);
  const SATELLITE_FUNCTIONS = Object.freeze(["agriculture", "extraction", "hunting", "utilityRelay", "corridorService"]);
  const SATELLITE_FORMS = Object.freeze({ agriculture: "farmVillage", extraction: "extractionCamp", hunting: "huntingOutpost", utilityRelay: "utilityStation", corridorService: "serviceTown" });
  const SIZE_BANDS = Object.freeze(["camp", "hamlet", "village", "town"]);
  const ARABLE_BANDS = Object.freeze(["marginal", "limited", "productive", "abundant"]);
  const VEHICLE_MODES = Object.freeze(["groundConvoy", "aircraft", "flyingMounts", "mixedFleet"]);
  const STORAGE_DAYS = Object.freeze([3, 7, 14, 30]);
  const WARNING_SOURCES = Object.freeze(["orbitalArcaneAlert", "localBeastWatch", "sponsorDispatch", "mixedSensorNetwork"]);
  const READINESS_BANDS = Object.freeze(["poor", "strained", "serviceable", "ready"]);
  const SUPPORT_MAXIMUM_LEG_KM = 420;
  const REFUGE_WORLD_CHANCE = 0.14;
  const RESOURCE_FAMILIES = StrategicResourcePotential.RESOURCE_FAMILIES;
  const FAMILY_BY_ID = new Map(RESOURCE_FAMILIES.map((family) => [family.id, family]));
  const JOINT_STRONGHOLD_BASELINE = Object.freeze({
    politicalStatus: "jointDependencyOfTwoSovereignCities",
    administrativeAutonomy: "localOperationsWithinJointCompact",
    independentDiplomacy: false,
    exclusiveSponsorSovereignty: false,
    staffingAndUpkeep: "jointSponsorResponsibility",
    ordinaryLaw: "localJointStrongholdCode",
    foreignWarrantsSelfExecuting: false,
    localCustodyProcessRequired: true,
    compactEnforcement: "mutualNeedWithoutSuperiorState"
  });

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
  function seededNumber(seed, channel) { return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff; }
  function code2(value) { return Number(value).toString(36).padStart(2, "0"); }
  function code3(value) { return Number(value).toString(36).padStart(3, "0"); }
  function readableFamily(index) { return RESOURCE_FAMILIES[index] || null; }

  function localCells(map, originIndex, maximumDistance = 3) {
    const topology = StrategicWorld.topologyForMap(map);
    const records = [{ index: originIndex, distance: 0, path: [originIndex] }];
    const seen = new Set([originIndex]);
    for (let cursor = 0; cursor < records.length; cursor += 1) {
      const current = records[cursor];
      if (current.distance >= maximumDistance) continue;
      for (const neighbor of topology.neighbors[current.index]) {
        if (seen.has(neighbor) || map.surface.classes[neighbor] !== "L") continue;
        seen.add(neighbor);
        records.push({ index: neighbor, distance: current.distance + 1, path: [...current.path, neighbor] });
      }
    }
    return records;
  }

  function arablePermille(map, index) {
    const resources = map.resourcePotential.potentialPermille;
    const temperature = map.climate.temperatureTenthsC[index] / 10;
    const comfort = clamp(1000 - Math.abs(temperature - 17) * 34, 0, 1000);
    return Math.round(clamp(resources.biologicalProductivity[index] * 0.43 + resources.freshWater[index] * 0.27 + comfort * 0.17 + (1000 - map.relief.slopePermille[index] * 18) * 0.13, 0, 1000));
  }

  function arableBandIndex(value) { return value >= 760 ? 3 : value >= 590 ? 2 : value >= 410 ? 1 : 0; }

  function resourceSiteFor(map, cityIndex, familyIndex) {
    const city = map.humanGeography.cities[cityIndex];
    const family = RESOURCE_FAMILIES[familyIndex];
    return localCells(map, StrategicWorld.cellIndex(city.cellId), 3)
      .map((record) => ({ ...record, score: map.resourcePotential.potentialPermille[family.id][record.index] - record.distance * 18 + map.resourcePotential.surfaceAccessibilityPermille[record.index] * 0.08 }))
      .sort((left, right) => right.score - left.score || left.index - right.index)[0];
  }

  function refugeCityIndex(seed, map) {
    if (map.cityExpansionHistory) {
      const refuge = StrategicCityExpansion.allCitySeeds(map).find((city) => city.independentRefuge);
      return refuge ? map.humanGeography.cities.findIndex((city) => city.id === refuge.cityId) : -1;
    }
    if (seededNumber(seed, "independent-refuge-world") >= REFUGE_WORLD_CHANCE) return -1;
    const degrees = new Map(map.humanGeography.cities.map((city) => [city.id, 0]));
    for (const route of map.routeGraph.routes) route.endpointIds.forEach((id) => degrees.set(id, (degrees.get(id) || 0) + 1));
    const originCityIds = new Set(StrategicCivilizationOrigins.originCitySeeds(map).map((origin) => origin.cityId));
    const candidates = map.humanGeography.cities.map((city, cityIndex) => ({ city, cityIndex, degree: degrees.get(city.id) || 0, isolation: ["connected", "remote", "extreme"].indexOf(city.isolationBand) }))
      .filter((candidate) => !originCityIds.has(candidate.city.id))
      .filter((candidate) => candidate.degree > 1 && map.routeGraph.routes.filter((route) => route.endpointIds.includes(candidate.city.id)).every((route) => route.endpointIds.filter((id) => id !== candidate.city.id).every((id) => (degrees.get(id) || 0) > 1)))
      .sort((left, right) => right.isolation - left.isolation || seededNumber(seed, `refuge:${left.city.id}`) - seededNumber(seed, `refuge:${right.city.id}`));
    return candidates[0]?.cityIndex ?? -1;
  }

  function createFoundations(seed, map) {
    const refugeIndex = refugeCityIndex(seed, map);
    const historyByCityId = new Map(StrategicCityExpansion.allCitySeeds(map).map((history) => [history.cityId, history]));
    const counts = new Array(RESOURCE_FAMILIES.length).fill(0);
    const rows = map.humanGeography.cities.map((city, cityIndex) => {
      if (cityIndex === refugeIndex) return { purpose: 1, primary: -1, secondary: -1 };
      const history = historyByCityId.get(city.id);
      if (history) {
        const primary = RESOURCE_FAMILIES.findIndex((family) => family.id === history.resourcePurposeId);
        const secondary = RESOURCE_FAMILIES.map((family, familyIndex) => ({ familyIndex, site: resourceSiteFor(map, cityIndex, familyIndex) }))
          .filter((entry) => entry.familyIndex !== primary)
          .sort((left, right) => right.site.score - left.site.score || left.familyIndex - right.familyIndex)[0].familyIndex;
        counts[primary] += 1;
        counts[secondary] += 1;
        return { purpose: 0, primary, secondary, history };
      }
      const ranked = RESOURCE_FAMILIES.map((family, familyIndex) => ({ familyIndex, site: resourceSiteFor(map, cityIndex, familyIndex) }))
        .sort((left, right) => (right.site.score - counts[right.familyIndex] * 155) - (left.site.score - counts[left.familyIndex] * 155) || left.familyIndex - right.familyIndex);
      const primary = ranked[0].familyIndex;
      counts[primary] += 1;
      const secondary = ranked.find((entry) => entry.familyIndex !== primary && entry.site.score >= 360)?.familyIndex ?? ranked[1].familyIndex;
      counts[secondary] += 1;
      return { purpose: 0, primary, secondary };
    });
    const repairCities = new Set();
    for (let familyIndex = 0; familyIndex < RESOURCE_FAMILIES.length; familyIndex += 1) {
      if (rows.some((row) => row.primary === familyIndex || row.secondary === familyIndex)) continue;
      const repair = rows.map((row, cityIndex) => ({ row, cityIndex, site: row.purpose === 0 ? resourceSiteFor(map, cityIndex, familyIndex) : null }))
        .filter((entry) => entry.site && !repairCities.has(entry.cityIndex))
        .sort((left, right) => right.site.score - left.site.score || left.cityIndex - right.cityIndex)[0];
      if (!repair) throw new Error(`No resource-anchor city can cover ${RESOURCE_FAMILIES[familyIndex].id}.`);
      repair.row.secondary = familyIndex;
      repairCities.add(repair.cityIndex);
    }
    const supplementalEndowmentCodes = [];
    const foundationRows = rows.map((row, cityIndex) => {
      const city = map.humanGeography.cities[cityIndex];
      const arableValues = localCells(map, StrategicWorld.cellIndex(city.cellId), 3).map((entry) => arablePermille(map, entry.index)).sort((left, right) => right - left).slice(0, 12);
      const arableIndex = arableBandIndex(arableValues.reduce((total, value) => total + value, 0) / Math.max(1, arableValues.length));
      let supplementFlags = 0;
      if (row.purpose === 0 && !row.history) {
        [row.primary, row.secondary].forEach((familyIndex, position) => {
          const site = resourceSiteFor(map, cityIndex, familyIndex);
          if (site.score >= 600) return;
          supplementFlags |= position === 0 ? 1 : 2;
          const band = 2 + Math.floor(seededNumber(seed, `supplement:${city.id}:${familyIndex}`) * 2);
          supplementalEndowmentCodes.push(`${code2(cityIndex)}${familyIndex.toString(36)}${code3(site.index)}${band.toString(36)}`);
        });
      }
      const history = row.history || historyByCityId.get(city.id);
      const powerCount = history?.founderRows?.length ?? (row.purpose === 1 ? 1 : 1 + Math.floor(seededNumber(seed, `founding-power-count:${city.id}`) * 3));
      const affiliation = history ? DIVINE_AFFILIATIONS.indexOf(history.foundingAffiliation) : (row.purpose === 1 ? 3 : Math.floor(seededNumber(seed, `founding-affiliation:${city.id}`) * 3));
      const godIndex = history?.patronGodId ? map.publicReligionDirectory.gods.findIndex((god) => god.id === history.patronGodId) : -1;
      const civicRelation = history ? POWER_CIVIC_RELATIONS.indexOf(history.civicRelation) : Math.floor(seededNumber(seed, `founding-civic-relation:${city.id}`) * POWER_CIVIC_RELATIONS.length) % POWER_CIVIC_RELATIONS.length;
      if (history && (affiliation < 0 || (!history.independentRefuge && godIndex < 0) || civicRelation < 0)) throw new Error(`${city.id} cannot project its authoritative historical founder or patron into the settlement directory.`);
      return `${row.purpose.toString(36)}${row.primary < 0 ? "z" : row.primary.toString(36)}${row.secondary < 0 ? "z" : row.secondary.toString(36)}${powerCount.toString(36)}${affiliation.toString(36)}${godIndex < 0 ? "z" : godIndex.toString(36)}${civicRelation.toString(36)}${arableIndex.toString(36)}${supplementFlags.toString(36)}`;
    });
    return { foundationRows, supplementalEndowmentCodes, refugeIndex };
  }

  function corridorLength(map, routeIndex) { return map.humanGeography.corridors.find((corridor) => corridor.id === map.routeGraph.routes[routeIndex].id)?.lengthKm || 0; }

  function maximumSupportLegKm(map, route, routeStrongholds) {
    const path = route.cellPath.map(StrategicWorld.cellIndex);
    const stops = [0, path.length - 1, ...routeStrongholds.map((stronghold) => path.indexOf(StrategicWorld.cellIndex(stronghold.cellId))).filter((index) => index > 0 && index < path.length - 1)]
      .sort((left, right) => left - right);
    let maximum = 0;
    for (let stopIndex = 1; stopIndex < stops.length; stopIndex += 1) {
      let lengthKm = 0;
      for (let pathIndex = stops[stopIndex - 1] + 1; pathIndex <= stops[stopIndex]; pathIndex += 1) {
        lengthKm += StrategicWorld.greatCircleDistanceKm(map, path[pathIndex - 1], path[pathIndex]);
      }
      maximum = Math.max(maximum, lengthKm);
    }
    return Math.ceil(maximum);
  }

  function strongholdCellsForRoute(map, route, cityCells) {
    const path = route.cellPath.map(StrategicWorld.cellIndex);
    const strongholdCells = [];
    let previousStop = 0;
    let cursor = 1;
    let legLengthKm = 0;
    while (cursor < path.length) {
      const segmentKm = StrategicWorld.greatCircleDistanceKm(map, path[cursor - 1], path[cursor]);
      if (legLengthKm + segmentKm <= SUPPORT_MAXIMUM_LEG_KM) {
        legLengthKm += segmentKm;
        cursor += 1;
        continue;
      }
      let stop = cursor - 1;
      while (stop > previousStop && cityCells.has(path[stop])) stop -= 1;
      if (stop === previousStop) throw new Error(`Support route ${route.id} has no viable stronghold site within ${SUPPORT_MAXIMUM_LEG_KM} km.`);
      strongholdCells.push(path[stop]);
      previousStop = stop;
      cursor = stop + 1;
      legLengthKm = 0;
    }
    return strongholdCells;
  }

  function createStrongholdCodes(seed, map, refugeIndex) {
    if (map.cityExpansionHistory) {
      return StrategicCityExpansion.strongholdSeeds(map).map((stronghold) => {
        const routeIndex = map.routeGraph.routes.findIndex((route) => route.id === stronghold.corridorId);
        const administration = STRONGHOLD_ADMINISTRATIONS.indexOf(stronghold.administration);
        const shareBand = [35, 40, 45, 50].indexOf(stronghold.sponsorContributionRows[0][1]);
        const populationBand = [800, 1800, 4000, 8000].indexOf(stronghold.populationCapacity);
        const vehicle = VEHICLE_MODES.indexOf(stronghold.serviceMode);
        if ([routeIndex, administration, shareBand, populationBand, vehicle].some((value) => value < 0)) throw new Error(`${stronghold.id} cannot be projected into the compact stronghold directory.`);
        return `${code2(routeIndex)}${code2(stronghold.ordinal)}${code3(StrategicWorld.cellIndex(stronghold.cellId))}${administration.toString(36)}${shareBand.toString(36)}${populationBand.toString(36)}${vehicle.toString(36)}`;
      });
    }
    const refugeCityId = refugeIndex >= 0 ? map.humanGeography.cities[refugeIndex].id : null;
    const cityCells = new Set(map.humanGeography.cities.map((city) => StrategicWorld.cellIndex(city.cellId)));
    const codes = [];
    map.routeGraph.routes.forEach((route, routeIndex) => {
      if (refugeCityId && route.endpointIds.includes(refugeCityId)) return;
      const strongholdCells = strongholdCellsForRoute(map, route, cityCells);
      strongholdCells.forEach((cellIndex, ordinal) => {
        const administration = Math.floor(seededNumber(seed, `stronghold-admin:${route.id}:${ordinal}`) * STRONGHOLD_ADMINISTRATIONS.length) % STRONGHOLD_ADMINISTRATIONS.length;
        const shareBand = Math.floor(seededNumber(seed, `stronghold-share:${route.id}:${ordinal}`) * 4) % 4;
        const populationBand = clamp(1 + Math.floor(corridorLength(map, routeIndex) / 900) + Math.floor(seededNumber(seed, `stronghold-population:${route.id}:${ordinal}`) * 2), 0, 3);
        const vehicle = Math.floor(seededNumber(seed, `stronghold-vehicle:${route.id}:${ordinal}`) * VEHICLE_MODES.length) % VEHICLE_MODES.length;
        codes.push(`${code2(routeIndex)}${code2(ordinal)}${code3(cellIndex)}${administration.toString(36)}${shareBand.toString(36)}${populationBand.toString(36)}${vehicle.toString(36)}`);
      });
    });
    return codes;
  }

  function decodeStronghold(code, index, map) {
    const routeIndex = parseInt(code.slice(0, 2), 36);
    const ordinal = parseInt(code.slice(2, 4), 36);
    const cellIndex = parseInt(code.slice(4, 7), 36);
    const route = map.routeGraph.routes[routeIndex];
    const sponsors = route.endpointIds.map((id) => map.humanGeography.cities.find((city) => city.id === id));
    const shareIndex = parseInt(code[8], 36);
    const leftShare = [35, 40, 45, 50][shareIndex];
    const populationCapacity = [800, 1800, 4000, 8000][parseInt(code[9], 36)];
    const history = map.cityExpansionHistory?.strongholdRows.find((stronghold) => stronghold.corridorId === route.id && stronghold.ordinal === ordinal) || null;
    return {
      id: history?.id || `joint-stronghold:${routeIndex.toString(36)}:${ordinal.toString(36)}`,
      kind: "jointRouteStronghold",
      name: `${sponsors[0].name}–${sponsors[1].name} Stronghold ${ordinal + 1}`,
      cellId: StrategicWorld.cellId(cellIndex),
      corridorId: route.id,
      foundingYear: history?.foundingYear ?? null,
      sponsorCityIds: route.endpointIds,
      sponsorContributions: [
        { cityId: route.endpointIds[0], staffingPercent: leftShare, upkeepPercent: leftShare },
        { cityId: route.endpointIds[1], staffingPercent: 100 - leftShare, upkeepPercent: 100 - leftShare }
      ],
      administration: STRONGHOLD_ADMINISTRATIONS[parseInt(code[7], 36)],
      politicalStatus: JOINT_STRONGHOLD_BASELINE.politicalStatus,
      locallyAdministered: true,
      independentlySovereign: false,
      independentDiplomacy: false,
      populationCapacity,
      initialPopulation: Math.round(populationCapacity * (0.62 + seededNumber(map.humanGeography.digest, `stronghold-initial:${index}`) * 0.25)),
      serviceMode: VEHICLE_MODES[parseInt(code[10], 36)],
      supportMaximumLegKm: SUPPORT_MAXIMUM_LEG_KM,
      jointLegalFramework: clone(JOINT_STRONGHOLD_BASELINE),
      evacuation: { primaryDestinations: [...route.endpointIds], allocation: "capacityAndRouteConditionAtDispatch", localCustodyProcessRequired: true }
    };
  }

  function purposeScore(map, functionId, entry, familyIndex = -1) {
    if (functionId === "agriculture") return arablePermille(map, entry.index) - entry.distance * 22;
    if (functionId === "extraction") return map.resourcePotential.potentialPermille[RESOURCE_FAMILIES[familyIndex].id][entry.index] + map.resourcePotential.surfaceAccessibilityPermille[entry.index] * 0.12 - entry.distance * 15;
    if (functionId === "hunting") return map.resourcePotential.potentialPermille.biologicalProductivity[entry.index] * 0.55 + (map.publicBeastAtlas.threatClasses[entry.index] === "." ? 80 : 360) - entry.distance * 12;
    if (functionId === "utilityRelay") return map.arcaneGeography.manaConcentrationPermille[entry.index] * 0.35 + map.resourcePotential.potentialPermille.geothermalEnergy[entry.index] * 0.25 + map.resourcePotential.surfaceAccessibilityPermille[entry.index] * 0.4;
    return map.resourcePotential.surfaceAccessibilityPermille[entry.index] * 0.6 + (1000 - map.relief.slopePermille[entry.index] * 20) * 0.4;
  }

  function createSatelliteRecords(seed, map, foundationRows, strongholdCodes, supplementalEndowmentCodes) {
    const strongholds = strongholdCodes.map((code, index) => decodeStronghold(code, index, map));
    const occupied = new Set([...map.humanGeography.cities.map((city) => StrategicWorld.cellIndex(city.cellId)), ...strongholds.map((stronghold) => StrategicWorld.cellIndex(stronghold.cellId))]);
    const satelliteCodes = [];
    const satelliteRoutePaths = [];
    const supplementByCityFamily = new Map(supplementalEndowmentCodes.map((code) => [`${parseInt(code.slice(0, 2), 36)}:${parseInt(code[2], 36)}`, parseInt(code.slice(3, 6), 36)]));

    function addSatellite(parentKind, parentIndex, ordinal, originIndex, functionId, familyIndex = -1) {
      const local = localCells(map, originIndex, 3).filter((entry) => entry.distance > 0 && !occupied.has(entry.index));
      const preferredSupplement = parentKind === "c" && functionId === "extraction" ? supplementByCityFamily.get(`${parentIndex}:${familyIndex}`) : null;
      const chosen = local.sort((left, right) => {
        if (preferredSupplement !== undefined) {
          if (left.index === preferredSupplement) return -1;
          if (right.index === preferredSupplement) return 1;
        }
        return purposeScore(map, functionId, right, familyIndex) - purposeScore(map, functionId, left, familyIndex) || left.index - right.index;
      })[0];
      if (!chosen) return;
      occupied.add(chosen.index);
      const arableIndex = arableBandIndex(arablePermille(map, chosen.index));
      const sizeIndex = clamp((functionId === "agriculture" ? arableIndex : 1) + (seededNumber(seed, `satellite-size:${parentKind}:${parentIndex}:${ordinal}`) > 0.78 ? 1 : 0), 0, 3);
      const parentCityIds = parentKind === "c" ? [map.humanGeography.cities[parentIndex].id] : strongholds[parentIndex].sponsorCityIds;
      const aircraftAvailable = parentCityIds.some((cityId) => StrategicCapabilityHistory.cityHasCapability(map, cityId, "poweredAircraft"));
      const mountsAvailable = parentCityIds.some((cityId) => StrategicCapabilityHistory.cityHasCapability(map, cityId, "flyingMountInfrastructure"));
      const availableVehicles = ["groundConvoy", ...(aircraftAvailable ? ["aircraft"] : []), ...(mountsAvailable ? ["flyingMounts"] : []), ...(aircraftAvailable && mountsAvailable ? ["mixedFleet"] : [])];
      const vehicleMode = availableVehicles[Math.floor(seededNumber(seed, `satellite-vehicle:${parentKind}:${parentIndex}:${ordinal}`) * availableVehicles.length) % availableVehicles.length];
      const vehicleIndex = VEHICLE_MODES.indexOf(vehicleMode);
      const storageIndex = Math.floor(seededNumber(seed, `satellite-storage:${parentKind}:${parentIndex}:${ordinal}`) * STORAGE_DAYS.length) % STORAGE_DAYS.length;
      const populationRatioIndex = 1 + Math.floor(seededNumber(seed, `satellite-population:${parentKind}:${parentIndex}:${ordinal}`) * 3);
      const warningIndex = Math.floor(seededNumber(seed, `satellite-warning:${parentKind}:${parentIndex}:${ordinal}`) * WARNING_SOURCES.length) % WARNING_SOURCES.length;
      const readinessIndex = Math.floor(seededNumber(seed, `satellite-readiness:${parentKind}:${parentIndex}:${ordinal}`) * READINESS_BANDS.length) % READINESS_BANDS.length;
      satelliteCodes.push(`${parentKind}${code2(parentIndex)}${ordinal.toString(36)}${code3(chosen.index)}${SATELLITE_FUNCTIONS.indexOf(functionId).toString(36)}${sizeIndex.toString(36)}${arableIndex.toString(36)}${familyIndex < 0 ? "z" : familyIndex.toString(36)}${vehicleIndex.toString(36)}${storageIndex.toString(36)}${populationRatioIndex.toString(36)}${warningIndex.toString(36)}${readinessIndex.toString(36)}`);
      satelliteRoutePaths.push(chosen.path.slice().reverse().map((index) => index.toString(36)).join("."));
    }

    foundationRows.forEach((row, cityIndex) => {
      const origin = StrategicWorld.cellIndex(map.humanGeography.cities[cityIndex].cellId);
      const purpose = parseInt(row[0], 36);
      const arableIndex = parseInt(row[7], 36);
      let ordinal = 0;
      const farmCount = purpose === 1 ? Math.min(1, arableIndex) : 1 + Math.min(2, arableIndex);
      for (let count = 0; count < farmCount; count += 1) addSatellite("c", cityIndex, ordinal++, origin, "agriculture");
      if (purpose === 0) {
        addSatellite("c", cityIndex, ordinal++, origin, "extraction", parseInt(row[1], 36));
        if (row[2] !== "z" && seededNumber(seed, `secondary-extraction:${cityIndex}`) < 0.7) addSatellite("c", cityIndex, ordinal++, origin, "extraction", parseInt(row[2], 36));
      }
      if (seededNumber(seed, `hunting-satellite:${cityIndex}`) < 0.72) addSatellite("c", cityIndex, ordinal++, origin, "hunting");
      if (seededNumber(seed, `utility-satellite:${cityIndex}`) < 0.42) addSatellite("c", cityIndex, ordinal++, origin, "utilityRelay");
    });
    strongholds.forEach((stronghold, strongholdIndex) => {
      const origin = StrategicWorld.cellIndex(stronghold.cellId);
      let ordinal = 0;
      if (seededNumber(seed, `stronghold-service:${stronghold.id}`) < 0.3) addSatellite("s", strongholdIndex, ordinal++, origin, "corridorService");
      const nearbyArable = Math.max(...localCells(map, origin, 2).map((entry) => arablePermille(map, entry.index)));
      if (nearbyArable >= 600) addSatellite("s", strongholdIndex, ordinal++, origin, "agriculture");
      if (seededNumber(seed, `stronghold-hunting:${stronghold.id}`) < 0.35) addSatellite("s", strongholdIndex, ordinal++, origin, "hunting");
    });
    return { satelliteCodes, satelliteRoutePaths };
  }

  function decodeSatellite(code, index, routePath, map, strongholds) {
    const parentKind = code[0];
    const parentIndex = parseInt(code.slice(1, 3), 36);
    const ordinal = parseInt(code[3], 36);
    const cellIndex = parseInt(code.slice(4, 7), 36);
    const functionId = SATELLITE_FUNCTIONS[parseInt(code[7], 36)];
    const sizeIndex = parseInt(code[8], 36);
    const arableIndex = parseInt(code[9], 36);
    const familyIndex = code[10] === "z" ? -1 : parseInt(code[10], 36);
    const parent = parentKind === "c" ? map.humanGeography.cities[parentIndex] : strongholds[parentIndex];
    const capacity = Math.round([90, 280, 750, 1800][sizeIndex] * (functionId === "agriculture" ? 0.82 + arableIndex * 0.12 : 1));
    const populationRatio = [0.52, 0.64, 0.77, 0.89][parseInt(code[13], 36)];
    const initialPopulation = Math.round(capacity * populationRatio);
    const publicReadiness = READINESS_BANDS[parseInt(code[15], 36)];
    const fallbackCityIds = parentKind === "c" ? [parent.id] : [...parent.sponsorCityIds];
    return {
      id: `satellite:${parentKind}:${parentIndex.toString(36)}:${ordinal.toString(36)}`,
      kind: "dependentSatelliteSettlement",
      name: `${parent.name} ${SATELLITE_FORMS[functionId].replace(/([a-z])([A-Z])/g, "$1 $2")} ${ordinal + 1}`,
      cellId: StrategicWorld.cellId(cellIndex),
      parentKind: parentKind === "c" ? "sovereignResourceAnchorCity" : "jointRouteStronghold",
      parentId: parent.id,
      ultimateSponsorCityIds: fallbackCityIds,
      function: functionId,
      form: SATELLITE_FORMS[functionId],
      sizeBand: SIZE_BANDS[sizeIndex],
      populationCapacity: capacity,
      initialPopulation,
      arableLandBand: ARABLE_BANDS[arableIndex],
      exportResource: familyIndex >= 0 ? clone(readableFamily(familyIndex)) : (functionId === "agriculture" || functionId === "hunting" ? clone(FAMILY_BY_ID.get("biologicalProductivity")) : null),
      requiredImports: functionId === "agriculture" ? ["machineParts", "medicine", "defenseSupplies"] : ["food", "medicine", "defenseSupplies"],
      localRouteCellIds: routePath.split(".").map((entry) => StrategicWorld.cellId(parseInt(entry, 36))),
      logistics: { vehicleMode: VEHICLE_MODES[parseInt(code[11], 36)], storageEnduranceDays: STORAGE_DAYS[parseInt(code[12], 36)], physicalDeliveryGuaranteed: false },
      evacuation: {
        warningSource: WARNING_SOURCES[parseInt(code[14], 36)], advertisedReadiness: publicReadiness,
        primaryRefugeId: parent.id, fallbackCityIds, singleLiftCapacity: Math.round(initialPopulation * [0.38, 0.55, 0.72, 0.9][parseInt(code[15], 36)]),
        planExists: true, survivalGuaranteed: false, cityGateAccessGuaranteed: false
      }
    };
  }

  function cellFeatures(map, foundationRows, strongholdCodes, satelliteCodes) {
    const features = new Map();
    foundationRows.forEach((row, cityIndex) => features.set(StrategicWorld.cellIndex(map.humanGeography.cities[cityIndex].cellId), row[0] === "1" ? "r" : "c"));
    strongholdCodes.forEach((code) => features.set(parseInt(code.slice(4, 7), 36), "s"));
    satelliteCodes.forEach((code) => features.set(parseInt(code.slice(4, 7), 36), ({ agriculture: "a", extraction: "e", hunting: "h", utilityRelay: "u", corridorService: "t" })[SATELLITE_FUNCTIONS[parseInt(code[7], 36)]]));
    return [...features.entries()].sort((left, right) => left[0] - right[0]).map(([index, feature]) => `${index.toString(36)}:${feature}`);
  }

  function settlementsCore(record) {
    return {
      sourceResourcePotentialDigest: record.sourceResourcePotentialDigest, sourceHumanGeographyDigest: record.sourceHumanGeographyDigest,
      sourceCivilizationOriginsDigest: record.sourceCivilizationOriginsDigest,
      sourceCityExpansionDigest: record.sourceCityExpansionDigest,
      sourceCapabilityHistoryDigest: record.sourceCapabilityHistoryDigest,
      sourceCityPolitiesDigest: record.sourceCityPolitiesDigest, sourceBeastEcologyDigest: record.sourceBeastEcologyDigest,
      sourceReligionsDigest: record.sourceReligionsDigest, sourceNonStateNetworksDigest: record.sourceNonStateNetworksDigest,
      publicDirectoryDigest: record.publicDirectoryDigest, supplementalEndowmentCodes: record.supplementalEndowmentCodes,
      hiddenSatelliteReadinessCodes: record.hiddenSatelliteReadinessCodes, hiddenStrongholdTensionCodes: record.hiddenStrongholdTensionCodes,
      diagnostics: record.diagnostics
    };
  }

  function createStrategicSettlements(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for strategic settlement generation.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCapabilityHistory.validateStrategicCapabilityHistory(strategicMap);
    StrategicNonStateNetworks.validateStrategicNonStateNetworks(strategicMap);
    const { foundationRows, supplementalEndowmentCodes, refugeIndex } = createFoundations(seed, strategicMap);
    const strongholdCodes = createStrongholdCodes(seed, strategicMap, refugeIndex);
    const { satelliteCodes, satelliteRoutePaths } = createSatelliteRecords(seed, strategicMap, foundationRows, strongholdCodes, supplementalEndowmentCodes);
    const publicDirectory = {
      supportMaximumLegKm: SUPPORT_MAXIMUM_LEG_KM,
      jointStrongholdBaseline: clone(JOINT_STRONGHOLD_BASELINE),
      cityOrder: strategicMap.humanGeography.cities.map((city) => city.id),
      foundationRows, strongholdCodes, satelliteCodes, satelliteRoutePaths,
      cellFeatures: cellFeatures(strategicMap, foundationRows, strongholdCodes, satelliteCodes)
    };
    publicDirectory.digest = `public-strategic-settlements-${StrategicWorld.stableHash(publicDirectory)}`;
    const record = {
      sourceResourcePotentialDigest: strategicMap.resourcePotential.digest,
      sourceHumanGeographyDigest: strategicMap.humanGeography.digest,
      sourceCivilizationOriginsDigest: strategicMap.civilizationOrigins.digest,
      sourceCityExpansionDigest: strategicMap.cityExpansionHistory?.digest || null,
      sourceCapabilityHistoryDigest: strategicMap.strategicCapabilityHistory.digest,
      sourceCityPolitiesDigest: strategicMap.cityPolities.digest,
      sourceBeastEcologyDigest: strategicMap.beastEcology.digest,
      sourceReligionsDigest: strategicMap.strategicReligions.digest,
      sourceNonStateNetworksDigest: strategicMap.strategicNonStateNetworks.digest,
      publicDirectoryDigest: publicDirectory.digest,
      supplementalEndowmentCodes,
      hiddenSatelliteReadinessCodes: satelliteCodes.map((code, index) => `${Math.floor(seededNumber(seed, `actual-vehicle:${index}`) * 4)}${Math.floor(seededNumber(seed, `actual-storage:${index}`) * 4)}${Math.floor(seededNumber(seed, `deception:${index}`) * 3)}`).join(""),
      hiddenStrongholdTensionCodes: strongholdCodes.map((code, index) => `${Math.floor(seededNumber(seed, `sponsor-tension:${index}`) * 4)}${Math.floor(seededNumber(seed, `upkeep-deficit:${index}`) * 4)}`).join(""),
      diagnostics: {
        resourceAnchorCount: foundationRows.filter((row) => row[0] === "0").length,
        independentRefugeCount: foundationRows.filter((row) => row[0] === "1").length,
        representedExploitationFamilyCount: new Set(foundationRows.flatMap((row) => [row[1], row[2]]).filter((code) => code !== "z")).size,
        supplementalEndowmentCount: supplementalEndowmentCodes.length,
        jointRouteStrongholdCount: strongholdCodes.length,
        satelliteSettlementCount: satelliteCodes.length,
        agriculturalSatelliteCount: satelliteCodes.filter((code) => SATELLITE_FUNCTIONS[parseInt(code[7], 36)] === "agriculture").length,
        huntingOutpostCount: satelliteCodes.filter((code) => SATELLITE_FUNCTIONS[parseInt(code[7], 36)] === "hunting").length,
        originCityCount: StrategicCivilizationOrigins.originCitySeeds(strategicMap).length
      }
    };
    record.digest = `strategic-settlements-${StrategicWorld.stableHash(settlementsCore(record))}`;
    return { strategicSettlements: record, publicDirectory };
  }

  function publicSettlementDirectory(map) {
    const compact = map?.publicSettlementDirectory;
    if (!compact) return null;
    const strongholds = compact.strongholdCodes.map((code, index) => decodeStronghold(code, index, map));
    const foundations = compact.foundationRows.map((row, cityIndex) => {
      const city = map.humanGeography.cities[cityIndex];
      const polity = map.cityPolities.polities.find((entry) => entry.cityId === city.id);
      const godIndex = row[5] === "z" ? -1 : parseInt(row[5], 36);
      const originEvent = map.publicCivilizationOrigins?.chronology.find((event) => event.cityId === city.id) || null;
      const expansionEvent = map.publicCityExpansionDirectory?.chronology.find((event) => event.kind === "cityFoundation" && event.city.id === city.id) || null;
      return {
        city: clone(city), polity: clone(polity), foundingPurpose: CITY_PURPOSES[parseInt(row[0], 36)],
        primaryExploitation: row[1] === "z" ? null : clone(readableFamily(parseInt(row[1], 36))),
        secondaryExploitation: row[2] === "z" ? null : clone(readableFamily(parseInt(row[2], 36))),
        foundingPower: {
          exceptionalIndividualCount: parseInt(row[3], 36), affiliation: DIVINE_AFFILIATIONS[parseInt(row[4], 36)],
          patronGod: godIndex < 0 ? null : clone(map.publicReligionDirectory.gods[godIndex]), civicRelationship: POWER_CIVIC_RELATIONS[parseInt(row[6], 36)]
        },
        arableLandBand: ARABLE_BANDS[parseInt(row[7], 36)],
        founderEstablishedEndowment: parseInt(row[8], 36) > 0,
        politicallySovereign: true,
        supportException: row[0] === "1"
          ? "intentionalIsolationFromGodsAndPolitics"
          : (originEvent && map.routeGraph.routes.every((route) => !route.endpointIds.includes(city.id)) ? "survivingDivineOriginIsolation" : null),
        originHistory: originEvent ? {
          foundingYear: originEvent.year,
          firstCity: originEvent.cityId === map.civilizationOrigins.firstCityId,
          initialSupportComponentStatus: "independentWithoutIntercityCorridorsOrStrongholds",
          founders: clone(originEvent.founders),
          foundingPopulationBand: originEvent.foundingPopulationBand,
          observedDivineAssistance: clone(originEvent.observedDivineAssistance),
          publicExplanation: originEvent.publicExplanation
        } : null,
        foundationHistory: expansionEvent ? {
          foundingYear: expansionEvent.year,
          parentCity: clone(expansionEvent.parentCity),
          originLineageCityId: expansionEvent.originLineageCityId,
          cause: expansionEvent.cause,
          relationshipAtFoundation: expansionEvent.relationshipAtFoundation,
          independentRefuge: expansionEvent.independentRefuge,
          foundingPopulationBand: expansionEvent.foundingPopulationBand,
          founders: clone(expansionEvent.founders),
          supportAtFoundation: expansionEvent.supportAtFoundation,
          publicExplanation: expansionEvent.publicExplanation
        } : null
      };
    });
    const satellites = compact.satelliteCodes.map((code, index) => decodeSatellite(code, index, compact.satelliteRoutePaths[index], map, strongholds));
    const supportRoutes = map.routeGraph.routes.map((route, routeIndex) => {
      const routeStrongholds = strongholds.filter((stronghold) => stronghold.corridorId === route.id);
      const refugeEndpoint = foundations.some((foundation) => foundation.foundingPurpose === "independentRefuge" && route.endpointIds.includes(foundation.city.id));
      return {
        corridorId: route.id, sponsorCityIds: [...route.endpointIds], strongholdIds: routeStrongholds.map((entry) => entry.id),
        supportCapable: !refugeEndpoint, maximumLegKm: refugeEndpoint ? null : maximumSupportLegKm(map, route, routeStrongholds),
        createsPermanentAlliance: false, createsState: false
      };
    });
    return {
      supportMaximumLegKm: compact.supportMaximumLegKm, jointStrongholdBaseline: clone(compact.jointStrongholdBaseline),
      foundations, strongholds, satellites, supportRoutes, cellFeatures: [...compact.cellFeatures], digest: compact.digest
    };
  }

  function parentSettlementProfile(map, parentId) {
    const directory = publicSettlementDirectory(map);
    if (!directory) return null;
    const foundation = directory.foundations.find((entry) => entry.city.id === parentId) || null;
    const stronghold = directory.strongholds.find((entry) => entry.id === parentId) || null;
    if (!foundation && !stronghold) return null;
    return { parent: foundation || stronghold, satellites: directory.satellites.filter((entry) => entry.parentId === parentId) };
  }

  function cellPublicSettlementSnapshot(map, index) {
    const directory = publicSettlementDirectory(map);
    if (!directory || !Number.isInteger(index) || index < 0 || index >= map.topology.cellCount) return null;
    return {
      cellId: StrategicWorld.cellId(index),
      foundation: directory.foundations.find((entry) => StrategicWorld.cellIndex(entry.city.cellId) === index) || null,
      stronghold: directory.strongholds.find((entry) => StrategicWorld.cellIndex(entry.cellId) === index) || null,
      satellite: directory.satellites.find((entry) => StrategicWorld.cellIndex(entry.cellId) === index) || null,
      publicClass: ({ c: "resourceAnchorCity", r: "independentRefugeCity", s: "jointRouteStronghold", a: "agriculturalSatellite", e: "extractionSatellite", h: "huntingOutpost", u: "utilityRelay", t: "corridorServiceSatellite" })[map.publicSettlementDirectory.cellFeatures.find((entry) => parseInt(entry, 36) === index)?.split(":")[1]] || "noMajorSettlementFeature"
    };
  }

  function validateStrategicSettlements(map, record = map?.strategicSettlements, publicDirectory = map?.publicSettlementDirectory) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicNonStateNetworks.validateStrategicNonStateNetworks(strategicMap);
    StrategicCapabilityHistory.validateStrategicCapabilityHistory(strategicMap);
    if (!record || !publicDirectory || record.sourceResourcePotentialDigest !== strategicMap.resourcePotential.digest || record.sourceHumanGeographyDigest !== strategicMap.humanGeography.digest || record.sourceCivilizationOriginsDigest !== strategicMap.civilizationOrigins?.digest || record.sourceCityExpansionDigest !== (strategicMap.cityExpansionHistory?.digest || null) || record.sourceCapabilityHistoryDigest !== strategicMap.strategicCapabilityHistory.digest || record.sourceCityPolitiesDigest !== strategicMap.cityPolities.digest || record.sourceBeastEcologyDigest !== strategicMap.beastEcology.digest || record.sourceReligionsDigest !== strategicMap.strategicReligions.digest || record.sourceNonStateNetworksDigest !== strategicMap.strategicNonStateNetworks.digest || record.publicDirectoryDigest !== publicDirectory.digest) throw new Error("Strategic settlement records are incomplete or source-inconsistent.");
    if (publicDirectory.supportMaximumLegKm !== SUPPORT_MAXIMUM_LEG_KM || JSON.stringify(publicDirectory.jointStrongholdBaseline) !== JSON.stringify(JOINT_STRONGHOLD_BASELINE)) throw new Error("Settlement support or joint-governance baseline is invalid.");
    if (!Array.isArray(publicDirectory.foundationRows) || publicDirectory.foundationRows.length !== strategicMap.humanGeography.cities.length || publicDirectory.foundationRows.some((row) => !/^[01][0-9a-bz]{2}[1-3][0-3][0-9a-z][0-2][0-3][0-3]$/.test(row))) throw new Error("City foundation records are invalid.");
    const familyCodes = new Set(publicDirectory.foundationRows.flatMap((row) => [row[1], row[2]]).filter((code) => code !== "z"));
    if (familyCodes.size !== RESOURCE_FAMILIES.length || publicDirectory.foundationRows.filter((row) => row[0] === "1").length > 1) throw new Error("City foundations must cover every resource family and keep independent refuges rare.");
    if (!Array.isArray(record.supplementalEndowmentCodes) || record.supplementalEndowmentCodes.some((code) => !/^[0-9a-z]{7}$/.test(code) || parseInt(code.slice(0, 2), 36) >= publicDirectory.foundationRows.length || parseInt(code[2], 36) >= RESOURCE_FAMILIES.length || parseInt(code.slice(3, 6), 36) >= strategicMap.topology.cellCount || ![2, 3].includes(parseInt(code[6], 36)))) throw new Error("Supplemental city endowments are invalid.");
    if (!Array.isArray(publicDirectory.strongholdCodes) || publicDirectory.strongholdCodes.some((code) => !/^[0-9a-z]{11}$/.test(code) || parseInt(code.slice(0, 2), 36) >= strategicMap.routeGraph.routes.length || parseInt(code.slice(4, 7), 36) >= strategicMap.topology.cellCount || parseInt(code[7], 36) >= STRONGHOLD_ADMINISTRATIONS.length || parseInt(code[8], 36) >= 4 || parseInt(code[9], 36) >= 4 || parseInt(code[10], 36) >= VEHICLE_MODES.length)) throw new Error("Joint route strongholds are invalid.");
    const expanded = publicSettlementDirectory(strategicMap);
    for (const history of StrategicCityExpansion.allCitySeeds(strategicMap)) {
      const foundation = expanded.foundations.find((entry) => entry.city.id === history.cityId);
      const expectedPurpose = history.independentRefuge ? "independentRefuge" : "resourceAnchor";
      if (!foundation || foundation.foundingPurpose !== expectedPurpose || (!history.independentRefuge && foundation.primaryExploitation?.id !== history.resourcePurposeId) || foundation.foundingPower.exceptionalIndividualCount !== history.founderRows.length || foundation.foundingPower.affiliation !== history.foundingAffiliation || foundation.foundingPower.patronGod?.id !== (history.patronGodId || undefined) || foundation.foundingPower.civicRelationship !== history.civicRelation || (history.parentCityId ? foundation.foundationHistory?.foundingYear : foundation.originHistory?.foundingYear) !== history.foundingYear) throw new Error(`${history.cityId} does not preserve its authoritative city-foundation history.`);
    }
    for (const history of StrategicCityExpansion.strongholdSeeds(strategicMap)) {
      const stronghold = expanded.strongholds.find((entry) => entry.corridorId === history.corridorId && entry.cellId === history.cellId);
      if (!stronghold || stronghold.id !== history.id || stronghold.foundingYear !== history.foundingYear || stronghold.administration !== history.administration || stronghold.populationCapacity !== history.populationCapacity || stronghold.serviceMode !== history.serviceMode || JSON.stringify(stronghold.sponsorCityIds) !== JSON.stringify(history.sponsorCityIds)) throw new Error(`${history.id} does not preserve its authoritative stronghold history.`);
    }
    if (expanded.strongholds.some((stronghold) => stronghold.sponsorCityIds.length !== 2 || stronghold.sponsorContributions.reduce((sum, entry) => sum + entry.staffingPercent, 0) !== 100 || stronghold.sponsorContributions.reduce((sum, entry) => sum + entry.upkeepPercent, 0) !== 100 || stronghold.independentlySovereign || stronghold.independentDiplomacy)) throw new Error("Every route stronghold requires exactly two jointly responsible political sponsors.");
    if (expanded.supportRoutes.filter((route) => route.supportCapable).some((route) => route.maximumLegKm > SUPPORT_MAXIMUM_LEG_KM)) throw new Error("A normal city support route exceeds the maximum feasible leg.");
    const supportedCities = new Set(expanded.supportRoutes.filter((route) => route.supportCapable).flatMap((route) => route.sponsorCityIds));
    if (expanded.foundations.some((foundation) => !foundation.supportException && !supportedCities.has(foundation.city.id))) throw new Error("Every ordinary city without a saved support exception must have physically feasible mutual support.");
    if (!Array.isArray(publicDirectory.satelliteCodes) || publicDirectory.satelliteCodes.length !== publicDirectory.satelliteRoutePaths.length || new Set(publicDirectory.satelliteCodes.map((code) => code.slice(0, 4))).size !== publicDirectory.satelliteCodes.length || publicDirectory.satelliteCodes.some((code) => !/^[cs][0-9a-z]{2}[0-9a-z][0-9a-z]{3}[0-4][0-3][0-3][0-9a-bz][0-3][0-3][1-3][0-3][0-3]$/.test(code))) throw new Error("Satellite settlement records are invalid.");
    const topology = StrategicWorld.topologyForMap(strategicMap);
    for (const satellite of expanded.satellites) {
      const indices = satellite.localRouteCellIds.map(StrategicWorld.cellIndex);
      if (!indices.length || indices[0] !== StrategicWorld.cellIndex(satellite.cellId) || indices.some((index) => strategicMap.surface.classes[index] !== "L") || indices.slice(1).some((index, offset) => !topology.neighbors[indices[offset]].includes(index)) || satellite.populationCapacity < satellite.initialPopulation || !satellite.evacuation.planExists || satellite.evacuation.survivalGuaranteed) throw new Error(`${satellite.id} has an invalid physical route, population, or evacuation plan.`);
    }
    if (typeof record.hiddenSatelliteReadinessCodes !== "string" || record.hiddenSatelliteReadinessCodes.length !== publicDirectory.satelliteCodes.length * 3 || /[^0-3]/.test(record.hiddenSatelliteReadinessCodes) || typeof record.hiddenStrongholdTensionCodes !== "string" || record.hiddenStrongholdTensionCodes.length !== publicDirectory.strongholdCodes.length * 2 || /[^0-3]/.test(record.hiddenStrongholdTensionCodes)) throw new Error("Hidden settlement readiness state is invalid.");
    if (Object.keys(publicDirectory).some((key) => key.startsWith("hidden") || key.includes("supplementalEndowment"))) throw new Error("The public settlement directory leaks hidden operational or endowment facts.");
    if (JSON.stringify(publicDirectory.cellFeatures) !== JSON.stringify(cellFeatures(strategicMap, publicDirectory.foundationRows, publicDirectory.strongholdCodes, publicDirectory.satelliteCodes))) throw new Error("The public settlement globe projection is invalid.");
    const diagnostics = record.diagnostics;
    if (!diagnostics || diagnostics.resourceAnchorCount + diagnostics.independentRefugeCount !== publicDirectory.foundationRows.length || diagnostics.representedExploitationFamilyCount !== RESOURCE_FAMILIES.length || diagnostics.supplementalEndowmentCount !== record.supplementalEndowmentCodes.length || diagnostics.jointRouteStrongholdCount !== publicDirectory.strongholdCodes.length || diagnostics.satelliteSettlementCount !== publicDirectory.satelliteCodes.length) throw new Error("Strategic settlement diagnostics are inconsistent.");
    const publicCore = clone(publicDirectory); delete publicCore.digest;
    if (publicDirectory.digest !== `public-strategic-settlements-${StrategicWorld.stableHash(publicCore)}` || record.digest !== `strategic-settlements-${StrategicWorld.stableHash(settlementsCore(record))}`) throw new Error("Strategic settlement records do not match their digests.");
    return { strategicSettlements: clone(record), publicDirectory: clone(publicDirectory) };
  }

  function attachStrategicSettlements(worldSeed, map) {
    const next = StrategicWorld.validateStrategicMap(map);
    const generated = createStrategicSettlements(worldSeed, next);
    next.strategicSettlements = generated.strategicSettlements;
    next.publicSettlementDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function auditStrategicSettlements(map) {
    const { strategicSettlements } = validateStrategicSettlements(map);
    const directory = publicSettlementDirectory(map);
    return {
      valid: true,
      everyCityHasFoundingReason: directory.foundations.every((entry) => entry.foundingPurpose === "resourceAnchor" ? Boolean(entry.primaryExploitation) : entry.supportException === "intentionalIsolationFromGodsAndPolitics"),
      everyResourceFamilyExploited: new Set(directory.foundations.flatMap((entry) => [entry.primaryExploitation?.id, entry.secondaryExploitation?.id]).filter(Boolean)).size === RESOURCE_FAMILIES.length,
      independentRefugesRare: directory.foundations.filter((entry) => entry.foundingPurpose === "independentRefuge").length <= 1,
      powerfulFoundersExplicit: directory.foundations.every((entry) => entry.foundingPower.exceptionalIndividualCount >= 1),
      originFoundationsAuthoritative: StrategicCivilizationOrigins.originCitySeeds(map).every((origin) => directory.foundations.some((foundation) => foundation.city.id === origin.cityId && foundation.primaryExploitation?.id === origin.resourcePurposeId && foundation.foundingPower.patronGod?.id === origin.patronGodId && foundation.originHistory?.foundingYear === origin.foundingYear)),
      expansionHistoryAuthoritative: StrategicCityExpansion.allCitySeeds(map).every((history) => directory.foundations.some((foundation) => foundation.city.id === history.cityId && (history.independentRefuge || foundation.primaryExploitation?.id === history.resourcePurposeId) && foundation.foundingPower.affiliation === history.foundingAffiliation && (history.parentCityId ? foundation.foundationHistory?.foundingYear : foundation.originHistory?.foundingYear) === history.foundingYear)),
      strongholdHistoryAuthoritative: StrategicCityExpansion.strongholdSeeds(map).every((history) => directory.strongholds.some((stronghold) => stronghold.id === history.id && stronghold.corridorId === history.corridorId && stronghold.cellId === history.cellId && stronghold.foundingYear === history.foundingYear)),
      normalCitiesMutuallySupported: directory.foundations.filter((entry) => !entry.supportException).every((entry) => directory.supportRoutes.some((route) => route.supportCapable && route.sponsorCityIds.includes(entry.city.id))),
      supportLegsWithinMaximum: directory.supportRoutes.filter((route) => route.supportCapable).every((route) => route.maximumLegKm <= SUPPORT_MAXIMUM_LEG_KM),
      strongholdsJointlyResponsible: directory.strongholds.every((entry) => entry.sponsorContributions.length === 2 && !entry.independentlySovereign && !entry.independentDiplomacy),
      everySatelliteFunctionCausal: directory.satellites.every((entry) => SATELLITE_FUNCTIONS.includes(entry.function)),
      everySatelliteHasPopulationCapacity: directory.satellites.every((entry) => entry.initialPopulation > 0 && entry.initialPopulation <= entry.populationCapacity),
      everySatelliteHasEvacuationPlan: directory.satellites.every((entry) => entry.evacuation.planExists && !entry.evacuation.survivalGuaranteed),
      publicDirectoryHidesOperationalTruth: !JSON.stringify(map.publicSettlementDirectory).includes("hiddenSatellite") && !JSON.stringify(map.publicSettlementDirectory).includes("supplementalEndowment"),
      diagnostics: clone(strategicSettlements.diagnostics)
    };
  }

  return Object.freeze({
    CITY_PURPOSES, DIVINE_AFFILIATIONS, POWER_CIVIC_RELATIONS, STRONGHOLD_ADMINISTRATIONS, SATELLITE_FUNCTIONS,
    SIZE_BANDS, ARABLE_BANDS, VEHICLE_MODES, STORAGE_DAYS, WARNING_SOURCES, READINESS_BANDS, SUPPORT_MAXIMUM_LEG_KM,
    JOINT_STRONGHOLD_BASELINE, createStrategicSettlements, validateStrategicSettlements, attachStrategicSettlements,
    publicSettlementDirectory, parentSettlementProfile, cellPublicSettlementSnapshot, auditStrategicSettlements
  });
});
