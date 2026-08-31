(function initStrategicStartingSites(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const climateHydrologyBiomes = typeof module === "object" && module.exports ? require("./climate-hydrology-biomes") : root?.HelixClimateHydrologyBiomes;
  const strategicBeastEcology = typeof module === "object" && module.exports ? require("./strategic-beast-ecology") : root?.HelixStrategicBeastEcology;
  const strategicPlayableSettlements = typeof module === "object" && module.exports ? require("./strategic-playable-settlement-state") : root?.HelixStrategicPlayableSettlementState;
  const strategicLegalHistory = typeof module === "object" && module.exports ? require("./strategic-legal-history") : root?.HelixStrategicLegalHistory;
  const strategicEnforcement = typeof module === "object" && module.exports ? require("./strategic-enforcement-practice-history") : root?.HelixStrategicEnforcementPracticeHistory;
  const api = factory(strategicWorld, climateHydrologyBiomes, strategicBeastEcology, strategicPlayableSettlements, strategicLegalHistory, strategicEnforcement);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicStartingSites = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicStartingSitesApi(StrategicWorld, ClimateHydrologyBiomes, StrategicBeastEcology, StrategicPlayableSettlements, StrategicLegalHistory, StrategicEnforcement) {
  "use strict";

  if (!StrategicWorld || !ClimateHydrologyBiomes || !StrategicBeastEcology || !StrategicPlayableSettlements || !StrategicLegalHistory || !StrategicEnforcement) {
    throw new Error("World, environment, beast, settlement, legal, and enforcement history must load before strategic-starting-sites.js");
  }

  const SITE_COUNT = 15;
  const DISTANCE_BANDS = Object.freeze({
    cityDistrict: Object.freeze({ id: "cityDistrict", label: "Inside city walls", summary: "Excellent services and trade access; little privacy and heavy institutional exposure." }),
    protectedApproaches: Object.freeze({ id: "protectedApproaches", label: "Protected approaches", summary: "More land and cover outside the walls, with weaker services and a practical road to the city." }),
    corridorFringe: Object.freeze({ id: "corridorFringe", label: "Supported corridor fringe", summary: "Freight access near a maintained corridor, balanced against route disruption and beast pressure." }),
    remoteWilderness: Object.freeze({ id: "remoteWilderness", label: "Remote wilderness", summary: "Exceptional isolation with no dependable city services or ordinary local jurisdiction." })
  });
  const SCENARIO_PROFILES = Object.freeze({
    chemistryFront: Object.freeze({ id: "chemistryFront", blueprintId: "chemistry-front-site-v3", allowedDistanceBands: Object.freeze(["cityDistrict", "protectedApproaches", "corridorFringe"]), candidateCount: SITE_COUNT }),
    undergroundLaboratory: Object.freeze({ id: "undergroundLaboratory", blueprintId: "underground-laboratory-site-v1", allowedDistanceBands: Object.freeze(["protectedApproaches", "corridorFringe", "remoteWilderness"]), candidateCount: 12 })
  });
  const QUALITY = Object.freeze(["veryLow", "low", "moderate", "high", "veryHigh"]);

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function coreWithoutDigest(value) { const copy = clone(value); delete copy.digest; return copy; }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
  function shifted(base, delta) { return QUALITY[clamp(QUALITY.indexOf(base) + delta, 0, QUALITY.length - 1)]; }
  function hashRank(seed, value) { return parseInt(StrategicWorld.stableHash(`${seed}:${value}`), 16) >>> 0; }
  function title(value) { return String(value || "unknown").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()); }
  function direction(bearing) {
    return ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"][Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
  }
  function bearingBetween(left, right) {
    const lat1 = left.latitude * Math.PI / 180, lat2 = right.latitude * Math.PI / 180;
    const delta = (right.longitude - left.longitude) * Math.PI / 180;
    const y = Math.sin(delta) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(delta);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  function routeFor(map, corridorId) { return map.routeGraph.routes.find((route) => route.id === corridorId); }
  function publicSettlementDirectory(map) { return StrategicPlayableSettlements.publicPlayableSettlementDirectory(map); }
  function cityBaseQuality(city) {
    const services = Object.values(city.services || {});
    const available = services.filter((value) => ![false, "offline", "none", "unavailable", "collapsed"].includes(value)).length;
    return QUALITY[clamp(Math.round(available / Math.max(1, services.length) * 4), 0, 4)];
  }
  function publicLegalSummary(map, cityId) {
    const code = cityId ? StrategicLegalHistory.currentRecognizedCityCode(map, cityId) : null;
    if (!code) return { cityId: null, codeId: null, label: "No ordinary local city code", relevantRules: [], observationConfidence: "credible" };
    const wanted = new Set(["contrabandCommerce", "hazardousBiologicalConduct", "geneticEngineering", "fraudAndCorruption"]);
    return {
      cityId,
      codeId: code.id,
      label: code.name || `${code.city?.name || cityId} city code`,
      relevantRules: (code.offenseRules || []).filter((rule) => wanted.has(rule.offenseId)).map((rule) => ({ offenseId: rule.offenseId, legalStatus: rule.legalStatus })),
      observationConfidence: "wellDocumented"
    };
  }
  function publicEnforcementSummary(map, cityId) {
    const profile = cityId ? StrategicEnforcement.currentCityEnforcementProfile(map, cityId) : null;
    if (!profile) return { cityId: null, declaredPriorityBand: "none", justiceAccess: "none", observationConfidence: "credible" };
    const relevant = profile.practices.filter((row) => ["contrabandCommerce", "hazardousBiologicalConduct", "geneticEngineering", "fraudAndCorruption"].includes(row.offenseId));
    const priorities = ["low", "standard", "elevated", "critical"];
    const declaredPriorityBand = relevant.reduce((highest, row) => priorities.indexOf(row.declaredPriority) > priorities.indexOf(highest) ? row.declaredPriority : highest, "low");
    const operational = profile.pipeline.filter((row) => row.operationalState === "operational").length;
    return { cityId, declaredPriorityBand, justiceAccess: operational >= 5 ? "high" : operational >= 3 ? "moderate" : "low", observationConfidence: relevant.some((row) => row.observationConfidence === "wellDocumented") ? "wellDocumented" : "credible" };
  }
  function beastSummary(map, index) {
    const snapshot = StrategicBeastEcology.cellPublicBeastSnapshot(map, index);
    return { threatBand: snapshot?.threatBand || "unknown", migrationPressure: Boolean(snapshot?.migrationPressure), wavePressure: Boolean(snapshot?.wavePressure), reportCount: snapshot?.reports?.length || 0, observationConfidence: snapshot?.reports?.some((report) => report.confidence === "high") ? "wellDocumented" : "credible" };
  }
  function candidateName(city, band, ordinal) {
    const suffix = band === "cityDistrict" ? "Ward" : band === "protectedApproaches" ? "Approach" : band === "corridorFringe" ? "Corridor" : "Wilds";
    return `${city.name} ${suffix} Site ${ordinal + 1}`;
  }
  function makeCandidate(worldSeed, map, profile, source, ordinal) {
    const { city, index, band, route } = source;
    const cell = StrategicWorld.cellSnapshot(map, index);
    const cityIndex = StrategicWorld.cellIndex(city.cellId);
    const cityCell = StrategicWorld.cellSnapshot(map, cityIndex);
    const centerDistance = StrategicWorld.greatCircleDistanceKm(map, cityIndex, index) || 0;
    const localDistance = band === "cityDistrict" ? 1 + hashRank(worldSeed, `${profile.id}:${city.id}:${ordinal}:local`) % 8 : centerDistance;
    const bearing = band === "cityDistrict" ? hashRank(worldSeed, `${profile.id}:${city.id}:${ordinal}:bearing`) % 360 : bearingBetween(cityCell, cell);
    const publicCity = source.publicCity;
    const baseUtilities = cityBaseQuality(publicCity);
    const zoneShift = band === "cityDistrict" ? 1 : band === "protectedApproaches" ? 0 : band === "corridorFringe" ? -1 : -2;
    const crowding = publicCity.crowdingBand || "unknown";
    const landBase = band === "cityDistrict" ? (crowding === "severe" ? "veryLow" : "low") : band === "protectedApproaches" ? "high" : band === "corridorFringe" ? "moderate" : "veryHigh";
    const secrecy = band === "cityDistrict" ? "low" : band === "protectedApproaches" ? "moderate" : band === "corridorFringe" ? "high" : "veryHigh";
    const legal = publicLegalSummary(map, city.id);
    const enforcement = publicEnforcementSummary(map, city.id);
    const environment = ClimateHydrologyBiomes.cellEnvironmentSnapshot(map, index);
    const beast = beastSummary(map, index);
    const routeContinuity = route?.continuity || (band === "cityDistrict" ? "municipal" : band === "protectedApproaches" ? "localApproach" : "none");
    const id = `starting-site:${profile.id}:${band}:${cell.id}:${city.id}:${ordinal}`;
    return {
      id,
      scenarioId: profile.id,
      requiredBlueprintId: profile.blueprintId,
      name: candidateName(city, band, ordinal),
      distanceBand: band,
      distanceBandLabel: DISTANCE_BANDS[band].label,
      tradeoffSummary: DISTANCE_BANDS[band].summary,
      strategicCellId: cell.id,
      approximatePosition: { latitude: Math.round(cell.latitude * 10) / 10, longitude: Math.round(cell.longitude * 10) / 10, bearingFromNearestCityDeg: Math.round(bearing), bearingLabel: direction(bearing) },
      environment: { biome: environment?.biomeClass?.label || environment?.biomeClass?.name || String(environment?.biomeClass || "Unknown"), river: environment?.riverClass?.label || String(environment?.riverClass || "None reported"), wetland: environment?.wetlandClass?.label || String(environment?.wetlandClass || "None reported"), temperatureC: environment?.temperatureC ?? null, precipitationMm: environment?.precipitationMm ?? null },
      nearestSettlement: { assetId: publicCity.assetId, cityId: city.id, name: city.name, kind: publicCity.kind, condition: publicCity.physicalCondition, crowdingBand: publicCity.crowdingBand, observationConfidence: publicCity.observationConfidence },
      distance: { straightLineKm: Math.round(localDistance), practicalTravelKm: Math.round(Math.max(localDistance, localDistance * (band === "cityDistrict" ? 1.15 : band === "protectedApproaches" ? 1.35 : 1.6))), strategicCellCenterKm: Math.round(centerDistance) },
      access: { kind: band === "cityDistrict" ? "cityStreet" : band === "protectedApproaches" ? "protectedApproachRoad" : band === "corridorFringe" ? "supportedCorridor" : "unmaintainedWilderness", corridorId: route?.corridorId || null, routeContinuity, supportCapable: route ? Boolean(route.supportCapable) : band !== "remoteWilderness" },
      jurisdiction: { kind: band === "cityDistrict" || band === "protectedApproaches" ? "exclusiveCityJurisdiction" : band === "corridorFringe" ? "facilityConvoyOrAgreementOnly" : "none", governingCityId: band === "cityDistrict" || band === "protectedApproaches" ? city.id : null, legalReferenceCityId: city.id, automaticCorridorJurisdiction: false },
      publicLaw: legal,
      publicEnforcement: enforcement,
      publicUtilities: { availabilityBand: shifted(baseUtilities, zoneShift), cityServices: clone(publicCity.services || {}) },
      tradeoffs: { landAvailability: landBase, legalCover: legal.relevantRules.some((rule) => ["licensed", "regulated", "legal"].includes(rule.legalStatus)) ? "moderate" : "low", secrecy, authorityExposure: band === "cityDistrict" ? "veryHigh" : band === "protectedApproaches" ? "high" : band === "corridorFringe" ? "moderate" : "low", beastDanger: beast.threatBand },
      beastReports: beast,
      sourceFacts: { publicSettlementDirectoryDigest: map.publicPlayableSettlementDirectory.digest, publicLegalDirectoryDigest: map.publicLegalHistoryDirectory?.digest || map.publicCityLawDirectory?.digest || null, publicEnforcementDirectoryDigest: map.publicEnforcementPracticeDirectory.digest, publicBeastAtlasDigest: map.publicBeastAtlas.digest },
      observationConfidence: [publicCity.observationConfidence, beast.observationConfidence].includes("credible") ? "credible" : "wellDocumented",
      reusableAcrossIndependentRuns: true,
      existingLaboratoryOccupancyTracked: false
    };
  }
  function createPool(worldSeed, map, profile) {
    const directory = publicSettlementDirectory(map);
    const cityById = new Map(map.humanGeography.cities.map((city) => [city.id, city]));
    const viable = directory.cityRows.filter((row) => row.physicalCondition !== "ruined" && row.habitationStatus !== "uninhabited" && row.physicalJurisdictionExists).map((row) => ({ publicCity: row, city: cityById.get(row.cityId) })).filter((entry) => entry.city);
    const routes = directory.routeRows.filter((row) => row.continuity !== "closed" && row.supportCapable);
    const pool = [];
    for (const entry of viable) {
      if (profile.allowedDistanceBands.includes("cityDistrict")) {
        for (let ordinal = 0; ordinal < 3; ordinal += 1) pool.push(makeCandidate(worldSeed, map, profile, { ...entry, index: StrategicWorld.cellIndex(entry.city.cellId), band: "cityDistrict" }, ordinal));
      }
      const cityIndex = StrategicWorld.cellIndex(entry.city.cellId);
      if (profile.allowedDistanceBands.includes("protectedApproaches")) {
        const ring = StrategicWorld.cellRing(map, cityIndex, 1).filter((index) => map.surface.classes[index] === "L");
        ring.forEach((index, ordinal) => pool.push(makeCandidate(worldSeed, map, profile, { ...entry, index, band: "protectedApproaches" }, ordinal)));
      }
      if (profile.allowedDistanceBands.includes("remoteWilderness")) {
        const ring = StrategicWorld.cellRing(map, cityIndex, 3).filter((index) => map.surface.classes[index] === "L");
        ring.forEach((index, ordinal) => pool.push(makeCandidate(worldSeed, map, profile, { ...entry, index, band: "remoteWilderness" }, ordinal)));
      }
    }
    if (profile.allowedDistanceBands.includes("corridorFringe")) {
      for (const publicRoute of routes) {
        const route = routeFor(map, publicRoute.corridorId);
        const path = (route?.cellPath || []).filter((cellId) => map.surface.classes[StrategicWorld.cellIndex(cellId)] === "L");
        const endpointEntries = publicRoute.endpointCityIds.map((id) => viable.find((entry) => entry.city.id === id)).filter(Boolean);
        if (!path.length || !endpointEntries.length) continue;
        const picks = [Math.floor(path.length * 0.25), Math.floor(path.length * 0.5), Math.floor(path.length * 0.75)];
        picks.forEach((pathIndex, ordinal) => {
          const index = StrategicWorld.cellIndex(path[clamp(pathIndex, 0, path.length - 1)]);
          const entry = [...endpointEntries].sort((left, right) => StrategicWorld.greatCircleDistanceKm(map, StrategicWorld.cellIndex(left.city.cellId), index) - StrategicWorld.greatCircleDistanceKm(map, StrategicWorld.cellIndex(right.city.cellId), index))[0];
          pool.push(makeCandidate(worldSeed, map, profile, { ...entry, index, band: "corridorFringe", route: publicRoute }, ordinal));
        });
      }
    }
    const unique = new Map();
    for (const candidate of pool) unique.set(candidate.id, candidate);
    return [...unique.values()];
  }
  function chooseCandidates(worldSeed, pool, profile) {
    const selected = [];
    const perBand = Math.floor(profile.candidateCount / profile.allowedDistanceBands.length);
    for (const band of profile.allowedDistanceBands) {
      const candidates = pool.filter((candidate) => candidate.distanceBand === band).sort((left, right) => hashRank(worldSeed, left.id) - hashRank(worldSeed, right.id) || left.id.localeCompare(right.id));
      selected.push(...candidates.slice(0, perBand));
    }
    const chosenIds = new Set(selected.map((candidate) => candidate.id));
    const remainder = pool.filter((candidate) => !chosenIds.has(candidate.id)).sort((left, right) => hashRank(worldSeed, left.id) - hashRank(worldSeed, right.id) || left.id.localeCompare(right.id));
    selected.push(...remainder.slice(0, profile.candidateCount - selected.length));
    return selected.sort((left, right) => profile.allowedDistanceBands.indexOf(left.distanceBand) - profile.allowedDistanceBands.indexOf(right.distanceBand) || left.name.localeCompare(right.name));
  }
  function createStrategicStartingSites(worldSeed, map) {
    if (!map?.publicPlayableSettlementDirectory || !map?.publicLegalHistoryDirectory || !map?.publicEnforcementPracticeDirectory || !map?.publicBeastAtlas) throw new Error("Starting sites require playable public settlement, law, enforcement, and beast records.");
    const scenarioRows = Object.values(SCENARIO_PROFILES).map((profile) => ({ scenarioId: profile.id, requiredBlueprintId: profile.blueprintId, allowedDistanceBands: clone(profile.allowedDistanceBands), candidates: chooseCandidates(worldSeed, createPool(worldSeed, map, profile), profile) }));
    for (const row of scenarioRows) {
      if (row.candidates.length < 12 || row.candidates.some((candidate) => !row.allowedDistanceBands.includes(candidate.distanceBand))) throw new Error(`World cannot provide enough valid ${row.scenarioId} starting sites.`);
    }
    const record = { knowledgePolicy: "publicObservedStrategicTradeoffsOnly", generatedFromWorldSeed: true, runSeedsIgnored: true, oldLaboratoriesPersistInWorld: false, scenarioRows };
    record.digest = `strategic-starting-sites-${StrategicWorld.stableHash(coreWithoutDigest(record))}`;
    return record;
  }
  function validateStrategicStartingSites(map, record = map?.strategicStartingSites, directory = map?.publicStartingSiteDirectory) {
    if (!record || !directory || record.digest !== `strategic-starting-sites-${StrategicWorld.stableHash(coreWithoutDigest(record))}`) throw new Error("Starting-site catalog or digest is invalid.");
    if (JSON.stringify(record) !== JSON.stringify(directory)) throw new Error("Starting-site public directory must exactly match its public-only canonical catalog.");
    for (const row of record.scenarioRows) {
      const profile = SCENARIO_PROFILES[row.scenarioId];
      if (!profile || row.requiredBlueprintId !== profile.blueprintId || row.candidates.length < 12 || row.candidates.length > 18) throw new Error("Starting-site scenario coverage is invalid.");
      if (row.candidates.some((candidate) => candidate.scenarioId !== row.scenarioId || !row.allowedDistanceBands.includes(candidate.distanceBand) || map.surface.classes[StrategicWorld.cellIndex(candidate.strategicCellId)] !== "L")) throw new Error("A starting-site candidate is incompatible or not on land.");
    }
    const serialized = JSON.stringify(directory);
    if (/hiddenInterference|actualPriority|resourceCommitment|exactFactors|populationIndex|reportedRangeMask/.test(serialized)) throw new Error("Starting-site directory leaks hidden world facts.");
    return clone(record);
  }
  function attachStrategicStartingSites(worldSeed, map) {
    if (map?.strategicStartingSites || map?.publicStartingSiteDirectory) throw new Error("Strategic starting sites already exist on this world.");
    const next = StrategicWorld.validateStrategicMap(map);
    const record = createStrategicStartingSites(worldSeed, next);
    next.strategicStartingSites = record;
    next.publicStartingSiteDirectory = clone(record);
    return StrategicWorld.finalizeStrategicMap(next);
  }
  function scenarioStartingSites(map, scenarioId) {
    const directory = map?.publicStartingSiteDirectory;
    return clone(directory?.scenarioRows.find((row) => row.scenarioId === scenarioId)?.candidates || []);
  }
  function startingSiteCandidate(map, scenarioId, candidateId) {
    return scenarioStartingSites(map, scenarioId).find((candidate) => candidate.id === candidateId) || null;
  }
  function materializeStartingSite(world, scenario, candidate) {
    if (!world?.canonicalDigest || !scenario?.id || !candidate || candidate.scenarioId !== scenario.id || candidate.requiredBlueprintId !== scenario.blueprintId) throw new Error("Selected starting site is not compatible with this world and scenario.");
    return {
      id: `run-${candidate.id}`,
      kind: "startingSite",
      selectionStatus: "selectedAndMaterialized",
      candidateId: candidate.id,
      scenarioId: scenario.id,
      worldId: world.id,
      canonicalWorldDigest: world.canonicalDigest,
      strategicLocation: clone(candidate),
      blueprintId: scenario.blueprintId,
      blueprintVersion: scenario.blueprintVersion,
      materialization: { status: "materialized", preservesCanonicalWorld: true, exactLocalContextDeferred: true, priorRunOccupancyIgnored: true }
    };
  }

  return Object.freeze({ SITE_COUNT, DISTANCE_BANDS, SCENARIO_PROFILES, createStrategicStartingSites, validateStrategicStartingSites, attachStrategicStartingSites, scenarioStartingSites, startingSiteCandidate, materializeStartingSite, title });
});
