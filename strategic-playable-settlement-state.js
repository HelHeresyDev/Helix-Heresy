(function initStrategicPlayableSettlementState(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const strategicCityExpansion = typeof module === "object" && module.exports ? require("./strategic-city-expansion") : root?.HelixStrategicCityExpansion;
  const strategicSettlements = typeof module === "object" && module.exports ? require("./strategic-settlements") : root?.HelixStrategicSettlements;
  const strategicCapabilityHistory = typeof module === "object" && module.exports ? require("./strategic-capability-history") : root?.HelixStrategicCapabilityHistory;
  const strategicCrisisHistory = typeof module === "object" && module.exports ? require("./strategic-crisis-history") : root?.HelixStrategicCrisisHistory;
  const strategicPoliticalHistory = typeof module === "object" && module.exports ? require("./strategic-political-history") : root?.HelixStrategicPoliticalHistory;
  const strategicCivicHistory = typeof module === "object" && module.exports ? require("./strategic-civic-history") : root?.HelixStrategicCivicHistory;
  const api = factory(strategicWorld, strategicCityExpansion, strategicSettlements, strategicCapabilityHistory, strategicCrisisHistory, strategicPoliticalHistory, strategicCivicHistory);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicPlayableSettlementState = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicPlayableSettlementStateApi(StrategicWorld, StrategicCityExpansion, StrategicSettlements, StrategicCapabilityHistory, StrategicCrisisHistory, StrategicPoliticalHistory, StrategicCivicHistory) {
  "use strict";

  if (!StrategicWorld || !StrategicCityExpansion || !StrategicSettlements || !StrategicCapabilityHistory || !StrategicCrisisHistory || !StrategicPoliticalHistory || !StrategicCivicHistory) throw new Error("Settlement-state dependencies must load before strategic-playable-settlement-state.js");

  const PHYSICAL_CONDITIONS = Object.freeze(["intact", "worn", "damaged", "ruined"]);
  const HABITATION_STATUSES = Object.freeze(["inhabited", "reduced", "evacuated", "abandoned", "destroyed"]);
  const SERVICE_CONDITIONS = Object.freeze(["failed", "fragile", "strained", "functional", "strong"]);
  const ROUTE_CONTINUITY = Object.freeze(["operational", "degraded", "intermittent", "closed"]);
  const POPULATION_BANDS = Object.freeze(["trace", "small", "modest", "substantial", "large", "immense"]);
  const CROWDING_BANDS = Object.freeze(["underfilled", "stable", "crowded", "severelyCrowded", "overflow"]);
  const OBSERVATION_CONFIDENCE = Object.freeze(["uncertain", "fragmentary", "credible", "wellDocumented"]);
  const RECOVERY_KINDS = Object.freeze(["cityRepair", "strongholdRepair", "strongholdReconstruction", "satelliteRepair", "satelliteReoccupation", "corridorRepair"]);
  const CAPACITY_BANDS = Object.freeze(["fragile", "strained", "functional", "strong", "exceptional"]);

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
  function coreWithoutDigest(value) { const core = clone(value); delete core.digest; return core; }
  function seededNumber(seed, channel) { return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff; }
  function bandIndex(values, value) { return Math.max(0, values.indexOf(value)); }
  function readable(value) { return String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase(); }

  function validateSources(map) {
    StrategicCivicHistory.validateStrategicCivicHistory(map);
    StrategicSettlements.validateStrategicSettlements(map);
    return map;
  }

  function infrastructureStateById(map) {
    const rows = new Map();
    for (const event of map.strategicCrisisHistory.eventRows) for (const delta of event.stateDelta.infrastructureDeltas) {
      rows.set(delta.assetId, { state: delta.resultingState, year: event.year, causeEventId: event.id, kind: delta.kind });
    }
    return rows;
  }

  function institutionForRole(map, cityId, role) {
    const government = map.cityGovernments.governments.find((entry) => entry.cityId === cityId);
    const institutionId = government?.roleAssignments?.[role];
    return map.strategicCivicHistory.currentInstitutionRows.find((entry) => entry.institutionId === institutionId) || null;
  }

  function capacityIndex(map, cityId, role) {
    return bandIndex(CAPACITY_BANDS, institutionForRole(map, cityId, role)?.currentCapacityBand || "fragile");
  }

  function satelliteFoundingYear(seed, horizon, satellite, settlements, citySeedById) {
    const parentCity = citySeedById.get(satellite.parentId);
    const parentStronghold = settlements.strongholds.find((entry) => entry.id === satellite.parentId);
    const parentYear = parentCity?.foundingYear ?? parentStronghold?.foundingYear ?? 0;
    return Math.min(horizon, parentYear + 2 + Math.floor(seededNumber(seed, `satellite-founding:${satellite.id}`) * 9));
  }

  function cityCapacity(seed, foundation, citySeed, horizon) {
    const age = Math.max(0, horizon - citySeed.foundingYear);
    const arable = Math.max(0, StrategicSettlements.ARABLE_BANDS.indexOf(foundation.arableLandBand));
    const purposeFactor = foundation.foundingPurpose === "independentRefuge" ? 0.72 : 1;
    const variation = 0.9 + seededNumber(seed, `city-capacity:${citySeed.cityId}`) * 0.3;
    return Math.max(citySeed.foundingPopulation, Math.round(citySeed.foundingPopulation * (4.2 + Math.min(8, age / 55) + arable * 0.85) * purposeFactor * variation));
  }

  function targetPopulation(seed, id, foundingPopulation, capacity, foundingYear, horizon) {
    const age = Math.max(0, horizon - foundingYear);
    const occupancy = clamp(0.52 + age / 900 + seededNumber(seed, `occupancy:${id}`) * 0.28, 0.48, 0.96);
    return Math.max(0, Math.min(capacity, Math.round(Math.max(foundingPopulation, capacity * occupancy))));
  }

  function populationBand(population) {
    if (population < 100) return "trace";
    if (population < 750) return "small";
    if (population < 3000) return "modest";
    if (population < 12000) return "substantial";
    if (population < 50000) return "large";
    return "immense";
  }

  function crowdingBand(population, capacity) {
    const ratio = capacity > 0 ? population / capacity : 0;
    if (ratio < 0.55) return "underfilled";
    if (ratio < 0.82) return "stable";
    if (ratio < 1) return "crowded";
    if (ratio < 1.15) return "severelyCrowded";
    return "overflow";
  }

  function publicPopulationRange(population) {
    if (population <= 0) return { minimum: 0, maximum: 0 };
    const magnitude = Math.max(10, 10 ** Math.max(1, Math.floor(Math.log10(population)) - 1));
    return { minimum: Math.max(1, Math.floor(population * 0.84 / magnitude) * magnitude), maximum: Math.ceil(population * 1.18 / magnitude) * magnitude };
  }

  function serviceBand(index) { return SERVICE_CONDITIONS[clamp(index, 0, SERVICE_CONDITIONS.length - 1)]; }

  function cityServices(map, cityId, condition, gatewayState) {
    if (condition === "ruined") return { fortifications: "failed", utilities: "failed", provisioning: "failed", transport: "failed", communications: "failed" };
    const penalty = condition === "damaged" ? 2 : condition === "worn" ? 1 : 0;
    const defense = capacityIndex(map, cityId, "militaryDefenseCommand");
    const works = capacityIndex(map, cityId, "publicWorksAndProvisioning");
    const emergency = capacityIndex(map, cityId, "emergencyManagement");
    const communicationPenalty = gatewayState === "offline" ? 4 : gatewayState === "degraded" ? 2 : 0;
    return {
      fortifications: serviceBand(defense - penalty),
      utilities: serviceBand(works - penalty),
      provisioning: serviceBand(Math.floor((works + emergency) / 2) - penalty),
      transport: serviceBand(Math.floor((works + emergency) / 2) - penalty),
      communications: serviceBand(Math.max(0, works - penalty - communicationPenalty))
    };
  }

  function habitationFor(condition, population, capacity) {
    if (condition === "ruined") return population > 0 ? "reduced" : "destroyed";
    if (population <= 0) return "abandoned";
    if (population < Math.max(25, capacity * 0.35)) return "reduced";
    return "inhabited";
  }

  function baseLedger(foundingPopulation, target, departures) {
    return { foundingPopulation, ordinaryNaturalChange: target + departures - foundingPopulation, arrivals: 0, departures, crisisFatalities: 0, currentPopulation: target };
  }

  function assertLedger(ledger) {
    return ledger.foundingPopulation + ledger.ordinaryNaturalChange + ledger.arrivals - ledger.departures - ledger.crisisFatalities === ledger.currentPopulation;
  }

  function publicAccount(kind, name, resultingCondition) {
    if (kind === "cityRepair") return `${name} restored major civic infrastructure after recorded crisis damage; some wear remains.`;
    if (kind === "strongholdRepair") return `${name}'s two sponsors restored essential route-support service after recorded damage.`;
    if (kind === "strongholdReconstruction") return `${name}'s sponsors reconstructed the destroyed support position without granting it sovereignty.`;
    if (kind === "satelliteRepair") return `${name} restored essential local service after recorded damage.`;
    if (kind === "satelliteReoccupation") return `${name} regained a reduced resident presence after an earlier evacuation or abandonment.`;
    return `${name} returned to ${readable(resultingCondition)} service after a recorded repair effort.`;
  }

  function connectedComponents(cityRows, routeRows) {
    const active = cityRows.filter((row) => row.physicalCondition !== "ruined" && row.currentPopulation > 0).map((row) => row.cityId).sort();
    const neighbors = new Map(active.map((id) => [id, []]));
    for (const route of routeRows) {
      if (route.continuity === "closed" || route.endpointCityIds.some((id) => !neighbors.has(id))) continue;
      neighbors.get(route.endpointCityIds[0]).push(route.endpointCityIds[1]);
      neighbors.get(route.endpointCityIds[1]).push(route.endpointCityIds[0]);
    }
    const seen = new Set();
    const components = [];
    for (const cityId of active) {
      if (seen.has(cityId)) continue;
      const queue = [cityId]; seen.add(cityId);
      for (let cursor = 0; cursor < queue.length; cursor += 1) for (const neighbor of neighbors.get(queue[cursor])) if (!seen.has(neighbor)) { seen.add(neighbor); queue.push(neighbor); }
      const cityIds = queue.sort();
      const corridorIds = routeRows.filter((route) => route.continuity !== "closed" && route.endpointCityIds.every((id) => cityIds.includes(id))).map((route) => route.corridorId).sort();
      components.push({ id: `playable-support-component:${StrategicWorld.stableHash(cityIds)}`, cityIds, corridorIds, physicallyConnected: true, politicalUnity: false });
    }
    return components.sort((left, right) => left.cityIds[0].localeCompare(right.cityIds[0]));
  }

  function createStrategicPlayableSettlementState(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for playable-year settlement state.");
    const strategicMap = validateSources(map);
    if (strategicMap.strategicPlayableSettlementState || strategicMap.publicPlayableSettlementDirectory) throw new Error("Playable-year settlement state already exists on this world.");
    const horizon = strategicMap.cityExpansionHistory.historicalHorizonYear;
    const settlements = StrategicSettlements.publicSettlementDirectory(strategicMap);
    const citySeeds = StrategicCityExpansion.allCitySeeds(strategicMap);
    const citySeedById = new Map(citySeeds.map((entry) => [entry.cityId, entry]));
    const infrastructureById = infrastructureStateById(strategicMap);
    const routeCrisisById = new Map(strategicMap.strategicCrisisHistory.routeConditionRows.map((entry) => [entry.corridorId, entry]));
    const gatewayByCityId = new Map(strategicMap.strategicCrisisHistory.localGatewayConditionRows.map((entry) => [entry.cityId, entry]));
    const controlByCityId = new Map(strategicMap.strategicPoliticalHistory.currentControlRows.map((entry) => [entry.cityId, entry]));
    const strongholdById = new Map(settlements.strongholds.map((entry) => [entry.id, entry]));
    const recoveryRows = [];
    const departureByAssetId = new Map();

    function addDeparture(assetId, count) { departureByAssetId.set(assetId, (departureByAssetId.get(assetId) || 0) + Math.max(0, Math.round(count))); }
    for (const child of citySeeds.filter((entry) => entry.parentCityId)) addDeparture(child.parentCityId, child.foundingPopulation);
    for (const stronghold of settlements.strongholds) for (const contribution of stronghold.sponsorContributions) addDeparture(contribution.cityId, stronghold.initialPopulation * contribution.staffingPercent / 100);
    for (const satellite of settlements.satellites) addDeparture(satellite.parentId, satellite.initialPopulation);

    function recover(kind, assetId, name, source, resultingCondition, prerequisites) {
      const row = { id: `settlement-recovery:${String(recoveryRows.length + 1).padStart(3, "0")}`, kind, year: Math.min(horizon, source.year + Math.max(2, kind.includes("Reconstruction") ? 20 : 8)), assetId, sourceEventId: source.causeEventId, prerequisites: [source.causeEventId, ...prerequisites], resultingCondition, exactFactors: { elapsedYears: horizon - source.year, prerequisitesSatisfied: true }, discoverableHooks: [`asset-record:${assetId}`, `repair-ledger:${assetId}`], publicAccount: publicAccount(kind, name, resultingCondition) };
      recoveryRows.push(row);
      return row;
    }

    const cityRows = settlements.foundations.map((foundation) => {
      const citySeed = citySeedById.get(foundation.city.id);
      const source = infrastructureById.get(citySeed.cityId);
      let physicalCondition = source?.state === "destroyed" ? "ruined" : source?.state === "damaged" ? "damaged" : "intact";
      const works = capacityIndex(strategicMap, citySeed.cityId, "publicWorksAndProvisioning");
      if (physicalCondition === "damaged" && horizon - source.year >= 12 && works >= 2) {
        physicalCondition = "worn";
        recover("cityRepair", citySeed.cityId, citySeed.cityName, source, physicalCondition, [`publicWorksCapacity:${CAPACITY_BANDS[works]}`]);
      }
      const protectedCapacity = cityCapacity(seed, foundation, citySeed, horizon);
      const target = targetPopulation(seed, citySeed.cityId, citySeed.foundingPopulation, protectedCapacity, citySeed.foundingYear, horizon);
      const populationLedger = baseLedger(citySeed.foundingPopulation, target, departureByAssetId.get(citySeed.cityId) || 0);
      if (physicalCondition === "ruined") {
        populationLedger.crisisFatalities = Math.round(populationLedger.currentPopulation * 0.28);
        populationLedger.departures += populationLedger.currentPopulation - populationLedger.crisisFatalities;
        populationLedger.currentPopulation = 0;
      } else if (["damaged", "worn"].includes(physicalCondition) && source) {
        const fatalities = Math.round(populationLedger.currentPopulation * (physicalCondition === "damaged" ? 0.055 : 0.025));
        populationLedger.crisisFatalities += fatalities;
        populationLedger.currentPopulation -= fatalities;
      }
      const gateway = gatewayByCityId.get(citySeed.cityId);
      const services = cityServices(strategicMap, citySeed.cityId, physicalCondition, gateway?.state || "online");
      const control = controlByCityId.get(citySeed.cityId);
      return {
        assetId: citySeed.cityId, kind: "sovereignCity", cityId: citySeed.cityId, name: citySeed.cityName, cellId: citySeed.cellId,
        foundingYear: citySeed.foundingYear, physicalCondition, habitationStatus: habitationFor(physicalCondition, populationLedger.currentPopulation, protectedCapacity),
        protectedCapacity, currentPopulation: populationLedger.currentPopulation, populationLedger, services,
        currentControlStatus: control?.controlStatus || "sovereign", physicalJurisdictionExists: physicalCondition !== "ruined" && Boolean(control?.physicalJurisdictionExists ?? true),
        lastCauseEventId: source?.causeEventId || null, exactFactors: { publicWorksCapacityIndex: works, gatewayState: gateway?.state || "online", foundingPurpose: foundation.foundingPurpose }
      };
    });
    const cityById = new Map(cityRows.map((row) => [row.cityId, row]));

    const strongholdRows = settlements.strongholds.map((stronghold) => {
      const source = infrastructureById.get(stronghold.id);
      const sponsorRows = stronghold.sponsorCityIds.map((id) => cityById.get(id));
      const sponsorWorks = stronghold.sponsorCityIds.map((id) => capacityIndex(strategicMap, id, "publicWorksAndProvisioning"));
      let physicalCondition = source?.state === "destroyed" ? "ruined" : source?.state === "damaged" ? "damaged" : "intact";
      let reconstruction = null;
      if (physicalCondition === "ruined" && source && horizon - source.year >= 25 && sponsorRows.every((row) => row?.physicalCondition !== "ruined") && sponsorWorks.every((value) => value >= 3)) {
        physicalCondition = "worn";
        reconstruction = recover("strongholdReconstruction", stronghold.id, stronghold.name, source, physicalCondition, stronghold.sponsorCityIds.map((id, index) => `sponsor:${id}:${CAPACITY_BANDS[sponsorWorks[index]]}`));
      } else if (physicalCondition === "damaged" && source && horizon - source.year >= 10 && sponsorRows.every((row) => row?.physicalCondition !== "ruined") && sponsorWorks.some((value) => value >= 2)) {
        physicalCondition = "worn";
        recover("strongholdRepair", stronghold.id, stronghold.name, source, physicalCondition, stronghold.sponsorCityIds.map((id) => `sponsor:${id}`));
      }
      const protectedCapacity = stronghold.populationCapacity;
      const target = targetPopulation(seed, stronghold.id, stronghold.initialPopulation, protectedCapacity, stronghold.foundingYear || 0, horizon);
      const populationLedger = baseLedger(stronghold.initialPopulation, target, departureByAssetId.get(stronghold.id) || 0);
      if (source?.state === "destroyed") {
        const prior = populationLedger.currentPopulation;
        populationLedger.crisisFatalities = Math.round(prior * 0.24);
        populationLedger.departures += prior - populationLedger.crisisFatalities;
        populationLedger.currentPopulation = 0;
        if (reconstruction) {
          const arrivals = Math.round(protectedCapacity * 0.22);
          populationLedger.arrivals += arrivals;
          populationLedger.currentPopulation = arrivals;
        }
      } else if (source?.state === "damaged") {
        const fatalities = Math.round(populationLedger.currentPopulation * 0.045);
        populationLedger.crisisFatalities += fatalities;
        populationLedger.currentPopulation -= fatalities;
      }
      const serviceIndex = physicalCondition === "ruined" ? 0 : physicalCondition === "damaged" ? 1 : Math.max(1, Math.floor((sponsorWorks[0] + sponsorWorks[1]) / 2));
      return {
        assetId: stronghold.id, kind: "jointRouteStronghold", strongholdId: stronghold.id, name: stronghold.name, cellId: stronghold.cellId, corridorId: stronghold.corridorId,
        sponsorCityIds: clone(stronghold.sponsorCityIds), foundingYear: stronghold.foundingYear, physicalCondition,
        habitationStatus: habitationFor(physicalCondition, populationLedger.currentPopulation, protectedCapacity), protectedCapacity, currentPopulation: populationLedger.currentPopulation, populationLedger,
        services: { fortifications: serviceBand(serviceIndex), utilities: serviceBand(serviceIndex), provisioning: serviceBand(serviceIndex), transport: serviceBand(serviceIndex), communications: serviceBand(serviceIndex) },
        jointlyDependent: true, independentlySovereign: false, lastCauseEventId: source?.causeEventId || null,
        exactFactors: { sponsorPublicWorksCapacityIndices: sponsorWorks, sponsorSurvival: sponsorRows.map((row) => row?.physicalCondition !== "ruined") }
      };
    });
    const currentStrongholdById = new Map(strongholdRows.map((row) => [row.strongholdId, row]));

    const satelliteRows = settlements.satellites.map((satellite) => {
      const foundingYear = satelliteFoundingYear(seed, horizon, satellite, settlements, citySeedById);
      const source = infrastructureById.get(satellite.id);
      const sponsorCityIds = satellite.ultimateSponsorCityIds;
      const sponsorRows = sponsorCityIds.map((id) => cityById.get(id));
      const sponsorWorks = sponsorCityIds.map((id) => capacityIndex(strategicMap, id, "publicWorksAndProvisioning"));
      const parentOperational = satellite.parentKind === "sovereignResourceAnchorCity" ? cityById.get(satellite.parentId)?.physicalCondition !== "ruined" : currentStrongholdById.get(satellite.parentId)?.physicalCondition !== "ruined";
      let physicalCondition = source?.state === "destroyed" ? "ruined" : source?.state === "abandoned" ? "damaged" : source?.state === "damaged" ? "damaged" : "intact";
      let reoccupied = false;
      if (source?.state === "abandoned" && horizon - source.year >= 12 && parentOperational && sponsorWorks.some((value) => value >= 2)) {
        physicalCondition = "worn"; reoccupied = true;
        recover("satelliteReoccupation", satellite.id, satellite.name, source, physicalCondition, [`parentOperational:${satellite.parentId}`]);
      } else if (source?.state === "damaged" && horizon - source.year >= 8 && parentOperational) {
        physicalCondition = "worn";
        recover("satelliteRepair", satellite.id, satellite.name, source, physicalCondition, [`parentOperational:${satellite.parentId}`]);
      }
      const protectedCapacity = satellite.populationCapacity;
      const target = targetPopulation(seed, satellite.id, satellite.initialPopulation, protectedCapacity, foundingYear, horizon);
      const populationLedger = baseLedger(satellite.initialPopulation, target, 0);
      if (source?.state === "destroyed") {
        const prior = populationLedger.currentPopulation;
        populationLedger.crisisFatalities = Math.round(prior * 0.3);
        populationLedger.departures += prior - populationLedger.crisisFatalities;
        populationLedger.currentPopulation = 0;
      } else if (source?.state === "abandoned") {
        const prior = populationLedger.currentPopulation;
        populationLedger.crisisFatalities = Math.round(prior * 0.04);
        const retained = reoccupied ? Math.round(protectedCapacity * 0.2) : 0;
        populationLedger.departures += prior - populationLedger.crisisFatalities - retained;
        populationLedger.currentPopulation = retained;
      } else if (source?.state === "damaged") {
        const fatalities = Math.round(populationLedger.currentPopulation * 0.05);
        populationLedger.crisisFatalities += fatalities;
        populationLedger.currentPopulation -= fatalities;
      }
      const serviceIndex = physicalCondition === "ruined" ? 0 : physicalCondition === "damaged" ? 1 : Math.max(1, Math.max(...sponsorWorks));
      return {
        assetId: satellite.id, kind: "dependentSatellite", satelliteId: satellite.id, name: satellite.name, cellId: satellite.cellId,
        parentId: satellite.parentId, sponsorCityIds: clone(sponsorCityIds), function: satellite.function, foundingYear, physicalCondition,
        habitationStatus: habitationFor(physicalCondition, populationLedger.currentPopulation, protectedCapacity), protectedCapacity, currentPopulation: populationLedger.currentPopulation, populationLedger,
        services: { fortifications: serviceBand(serviceIndex - 1), utilities: serviceBand(serviceIndex), provisioning: serviceBand(serviceIndex), transport: serviceBand(parentOperational ? serviceIndex : 0), communications: serviceBand(serviceIndex) },
        localRouteUsable: parentOperational && physicalCondition !== "ruined", evacuationPlanGuaranteedSuccess: false, lastCauseEventId: source?.causeEventId || null,
        exactFactors: { sponsorPublicWorksCapacityIndices: sponsorWorks, parentOperational, advertisedReadiness: satellite.evacuation.advertisedReadiness }
      };
    });

    const displacementRows = [];
    const assetRows = [...cityRows, ...strongholdRows, ...satelliteRows];
    for (const origin of assetRows.filter((row) => row.populationLedger.departures > (departureByAssetId.get(row.assetId) || 0) && row.lastCauseEventId)) {
      const crisisDepartures = origin.populationLedger.departures - (departureByAssetId.get(origin.assetId) || 0);
      const candidates = (origin.sponsorCityIds || cityRows.filter((row) => row.cityId !== origin.cityId).map((row) => row.cityId)).map((id) => cityById.get(id)).filter((row) => row && row.physicalCondition !== "ruined");
      let remaining = crisisDepartures;
      const admissions = [];
      for (const destination of candidates) {
        const headroom = Math.max(0, Math.round(destination.protectedCapacity * 1.12) - destination.currentPopulation);
        const admitted = Math.min(remaining, headroom, Math.round(crisisDepartures * 0.68));
        if (admitted <= 0) continue;
        destination.populationLedger.arrivals += admitted; destination.populationLedger.currentPopulation += admitted; destination.currentPopulation += admitted;
        admissions.push({ cityId: destination.cityId, admittedPopulation: admitted }); remaining -= admitted;
        if (remaining <= 0) break;
      }
      displacementRows.push({ id: `settlement-displacement:${String(displacementRows.length + 1).padStart(3, "0")}`, sourceEventId: origin.lastCauseEventId, originAssetId: origin.assetId, displacedPopulation: crisisDepartures, admissions, unresolvedDisplacedPopulation: remaining, individualSimulationDeferred: true, cityGateAdmissionGuaranteed: false });
    }

    for (const row of assetRows) {
      row.habitationStatus = habitationFor(row.physicalCondition, row.currentPopulation, row.protectedCapacity);
      if (!assertLedger(row.populationLedger)) throw new Error(`${row.assetId} has an unbalanced population ledger.`);
    }

    const routeRows = settlements.supportRoutes.map((supportRoute) => {
      const route = strategicMap.routeGraph.routes.find((entry) => entry.id === supportRoute.corridorId);
      const crisis = routeCrisisById.get(route.id);
      const endpoints = route.endpointIds.map((id) => cityById.get(id));
      const requiredStrongholds = strongholdRows.filter((entry) => entry.corridorId === route.id);
      const sponsorWorks = route.endpointIds.map((id) => capacityIndex(strategicMap, id, "publicWorksAndProvisioning"));
      let repaired = false;
      let physicalState = crisis?.state || "operational";
      if (physicalState === "severed" && horizon - (crisis?.lastChangeYear || horizon) >= 20 && endpoints.every((row) => row?.physicalCondition !== "ruined") && sponsorWorks.every((value) => value >= 3) && requiredStrongholds.every((row) => row.physicalCondition !== "ruined")) {
        physicalState = "damaged"; repaired = true;
        recover("corridorRepair", route.id, route.id, { year: crisis.lastChangeYear, causeEventId: crisis.causeEventId }, "degraded", route.endpointIds.map((id) => `sponsor:${id}`));
      } else if (physicalState === "damaged" && horizon - (crisis?.lastChangeYear || horizon) >= 10 && endpoints.every((row) => row?.physicalCondition !== "ruined") && sponsorWorks.some((value) => value >= 2)) {
        physicalState = "operational"; repaired = true;
        recover("corridorRepair", route.id, route.id, { year: crisis.lastChangeYear, causeEventId: crisis.causeEventId }, "operational", route.endpointIds.map((id) => `sponsor:${id}`));
      }
      const ruinedStrongholds = requiredStrongholds.filter((row) => row.physicalCondition === "ruined");
      const damagedStrongholds = requiredStrongholds.filter((row) => ["damaged", "worn"].includes(row.physicalCondition) || row.habitationStatus !== "inhabited");
      let continuity = "operational";
      if (endpoints.some((row) => !row || row.physicalCondition === "ruined") || physicalState === "severed" || ruinedStrongholds.length) continuity = "closed";
      else if (physicalState === "damaged" || damagedStrongholds.length > Math.max(1, requiredStrongholds.length / 2)) continuity = "intermittent";
      else if (damagedStrongholds.length || endpoints.some((row) => row.physicalCondition !== "intact")) continuity = "degraded";
      return {
        corridorId: route.id, endpointCityIds: clone(route.endpointIds), requiredStrongholdIds: requiredStrongholds.map((row) => row.strongholdId),
        physicalState, continuity, repairedAfterCrisis: repaired, supportCapable: continuity !== "closed", createsState: false, createsAlliance: false,
        lastCauseEventId: crisis?.causeEventId || null, exactFactors: { sponsorPublicWorksCapacityIndices: sponsorWorks, ruinedStrongholdIds: ruinedStrongholds.map((row) => row.strongholdId), damagedStrongholdIds: damagedStrongholds.map((row) => row.strongholdId) }
      };
    });
    const currentSupportComponents = connectedComponents(cityRows, routeRows);
    if (!cityRows.some((row) => row.physicalCondition !== "ruined" && row.currentPopulation > 0)) throw new Error("World history left no viable inhabited fortified core.");

    const publicAsset = (row, confidence) => ({
      assetId: row.assetId, kind: row.kind, name: row.name, cellId: row.cellId, cityId: row.cityId || undefined, strongholdId: row.strongholdId || undefined, satelliteId: row.satelliteId || undefined,
      parentId: row.parentId || undefined, sponsorCityIds: clone(row.sponsorCityIds), function: row.function, foundingYear: row.foundingYear,
      physicalCondition: row.physicalCondition, habitationStatus: row.habitationStatus, populationBand: populationBand(row.currentPopulation), populationRange: publicPopulationRange(row.currentPopulation),
      crowdingBand: crowdingBand(row.currentPopulation, row.protectedCapacity), services: clone(row.services), observationConfidence: confidence,
      physicalJurisdictionExists: row.kind === "sovereignCity" ? row.physicalJurisdictionExists : undefined,
      independentlySovereign: row.kind === "jointRouteStronghold" ? false : undefined, exactPopulationPublic: false, exactCapacityPublic: false
    });
    const publicDirectory = {
      playableYear: horizon,
      knowledgePolicy: "observableSettlementAndRouteStateWithExactPopulationReadinessAndLossesRedacted",
      cityRows: cityRows.map((row) => publicAsset(row, "wellDocumented")),
      strongholdRows: strongholdRows.map((row) => publicAsset(row, row.physicalCondition === "ruined" ? "credible" : "wellDocumented")),
      satelliteRows: satelliteRows.map((row) => publicAsset(row, ["ruined", "damaged"].includes(row.physicalCondition) ? "fragmentary" : "credible")),
      routeRows: routeRows.map((row) => ({ corridorId: row.corridorId, endpointCityIds: clone(row.endpointCityIds), continuity: row.continuity, reportedPhysicalState: row.physicalState, repairedAfterCrisis: row.repairedAfterCrisis, supportCapable: row.supportCapable, createsState: false, createsAlliance: false, observationConfidence: row.continuity === "closed" ? "credible" : "wellDocumented" })),
      currentSupportComponents: clone(currentSupportComponents),
      recoveryChronology: recoveryRows.map((row) => ({ id: row.id, kind: row.kind, year: row.year, assetId: row.assetId, resultingCondition: row.resultingCondition, account: row.publicAccount, discoverableHooks: clone(row.discoverableHooks) })),
      displacementSummaries: displacementRows.map((row) => ({ id: row.id, originAssetId: row.originAssetId, reportedOutcome: row.unresolvedDisplacedPopulation ? "partialAdmissionAndContinuingDisplacement" : "admittedAcrossNamedDestinations", destinationCityIds: row.admissions.map((entry) => entry.cityId), exactPopulationPublic: false, cityGateAdmissionWasGuaranteed: false })),
      principles: { foundingAndCrisisRecordsRemainHistorical: true, currentComponentsAreAuthoritative: true, connectivityCreatesNoPoliticalUnity: true, noNewCitiesOrCorridorsInvented: true, destroyedCitiesRemainRuins: true, exactPopulationRedacted: true, individualSimulationDeferred: true }
    };
    publicDirectory.digest = `public-playable-settlement-state-${StrategicWorld.stableHash(coreWithoutDigest(publicDirectory))}`;
    const record = {
      playableYear: horizon,
      sourceCityExpansionDigest: strategicMap.cityExpansionHistory.digest,
      sourceSettlementDigest: strategicMap.strategicSettlements.digest,
      sourceCapabilityHistoryDigest: strategicMap.strategicCapabilityHistory.digest,
      sourceCrisisHistoryDigest: strategicMap.strategicCrisisHistory.digest,
      sourcePoliticalHistoryDigest: strategicMap.strategicPoliticalHistory.digest,
      sourceCivicHistoryDigest: strategicMap.strategicCivicHistory.digest,
      publicDirectoryDigest: publicDirectory.digest,
      cityRows, strongholdRows, satelliteRows, routeRows, currentSupportComponents, recoveryRows, displacementRows,
      diagnostics: {
        cityCount: cityRows.length, viableCityCount: cityRows.filter((row) => row.physicalCondition !== "ruined" && row.currentPopulation > 0).length,
        ruinedCityCount: cityRows.filter((row) => row.physicalCondition === "ruined").length, strongholdCount: strongholdRows.length, satelliteCount: satelliteRows.length,
        closedRouteCount: routeRows.filter((row) => row.continuity === "closed").length, supportComponentCount: currentSupportComponents.length,
        recoveryEventCount: recoveryRows.length, displacementCount: displacementRows.length, totalCurrentSettlementPopulation: assetRows.reduce((sum, row) => sum + row.currentPopulation, 0)
      }
    };
    record.digest = `strategic-playable-settlement-state-${StrategicWorld.stableHash(coreWithoutDigest(record))}`;
    return { strategicPlayableSettlementState: record, publicDirectory };
  }

  function validateStrategicPlayableSettlementState(map, record = map?.strategicPlayableSettlementState, directory = map?.publicPlayableSettlementDirectory) {
    const strategicMap = validateSources(map);
    if (!record || !directory || record.sourceCityExpansionDigest !== strategicMap.cityExpansionHistory.digest || record.sourceSettlementDigest !== strategicMap.strategicSettlements.digest || record.sourceCapabilityHistoryDigest !== strategicMap.strategicCapabilityHistory.digest || record.sourceCrisisHistoryDigest !== strategicMap.strategicCrisisHistory.digest || record.sourcePoliticalHistoryDigest !== strategicMap.strategicPoliticalHistory.digest || record.sourceCivicHistoryDigest !== strategicMap.strategicCivicHistory.digest || record.publicDirectoryDigest !== directory.digest) throw new Error("Playable settlement state is incomplete or source-inconsistent.");
    const settlements = StrategicSettlements.publicSettlementDirectory(strategicMap);
    if (record.cityRows.length !== settlements.foundations.length || record.strongholdRows.length !== settlements.strongholds.length || record.satelliteRows.length !== settlements.satellites.length || record.routeRows.length !== strategicMap.routeGraph.routes.length) throw new Error("Playable settlement state does not cover every constructed asset and route.");
    const allRows = [...record.cityRows, ...record.strongholdRows, ...record.satelliteRows];
    if (new Set(allRows.map((row) => row.assetId)).size !== allRows.length || allRows.some((row) => !PHYSICAL_CONDITIONS.includes(row.physicalCondition) || !HABITATION_STATUSES.includes(row.habitationStatus) || !Number.isInteger(row.currentPopulation) || row.currentPopulation < 0 || !Number.isInteger(row.protectedCapacity) || row.protectedCapacity < 1 || row.currentPopulation !== row.populationLedger.currentPopulation || !assertLedger(row.populationLedger) || Object.values(row.services).some((value) => !SERVICE_CONDITIONS.includes(value)))) throw new Error("A playable settlement asset has invalid condition, services, or population accounting.");
    if (record.routeRows.some((row) => !ROUTE_CONTINUITY.includes(row.continuity) || row.endpointCityIds.length !== 2 || row.createsState || row.createsAlliance || row.supportCapable !== (row.continuity !== "closed"))) throw new Error("A playable route has invalid continuity or political effects.");
    const expectedComponents = connectedComponents(record.cityRows, record.routeRows);
    if (JSON.stringify(expectedComponents) !== JSON.stringify(record.currentSupportComponents) || record.currentSupportComponents.some((row) => row.politicalUnity)) throw new Error("Playable support components do not match usable current routes.");
    const sourceEventIds = new Set(strategicMap.strategicCrisisHistory.eventRows.map((event) => event.id));
    if (record.recoveryRows.some((row) => !RECOVERY_KINDS.includes(row.kind) || !sourceEventIds.has(row.sourceEventId) || !row.prerequisites.includes(row.sourceEventId) || !row.exactFactors || !row.publicAccount) || record.displacementRows.some((row) => !sourceEventIds.has(row.sourceEventId) || row.displacedPopulation < row.unresolvedDisplacedPopulation || row.cityGateAdmissionGuaranteed || !row.individualSimulationDeferred)) throw new Error("Settlement recovery or displacement lacks a causal source or bounded consequence.");
    if (!record.cityRows.some((row) => row.physicalCondition !== "ruined" && row.currentPopulation > 0) || record.cityRows.some((row) => row.physicalCondition === "ruined" && row.physicalJurisdictionExists)) throw new Error("Playable settlement state lacks a viable city or grants jurisdiction to ruins.");
    const publicJson = JSON.stringify(directory);
    if (/populationLedger|protectedCapacity|currentPopulation|exactFactors|crisisFatalities|unresolvedDisplacedPopulation|admittedPopulation|sponsorPublicWorksCapacityIndices/.test(publicJson) || !directory.principles?.destroyedCitiesRemainRuins || !directory.principles?.currentComponentsAreAuthoritative) throw new Error("Public playable settlement state leaks exact population, losses, readiness, or repair calculations.");
    if (directory.cityRows.some((row) => !POPULATION_BANDS.includes(row.populationBand) || !CROWDING_BANDS.includes(row.crowdingBand) || !OBSERVATION_CONFIDENCE.includes(row.observationConfidence)) || directory.routeRows.some((row) => !ROUTE_CONTINUITY.includes(row.continuity))) throw new Error("Public playable settlement bands are invalid.");
    if (directory.digest !== `public-playable-settlement-state-${StrategicWorld.stableHash(coreWithoutDigest(directory))}` || record.digest !== `strategic-playable-settlement-state-${StrategicWorld.stableHash(coreWithoutDigest(record))}`) throw new Error("Playable settlement state does not match its digest.");
    const diagnostics = record.diagnostics;
    if (!diagnostics || diagnostics.cityCount !== record.cityRows.length || diagnostics.viableCityCount !== record.cityRows.filter((row) => row.physicalCondition !== "ruined" && row.currentPopulation > 0).length || diagnostics.supportComponentCount !== record.currentSupportComponents.length || diagnostics.totalCurrentSettlementPopulation !== allRows.reduce((sum, row) => sum + row.currentPopulation, 0)) throw new Error("Playable settlement diagnostics do not match saved facts.");
    return { strategicPlayableSettlementState: clone(record), publicDirectory: clone(directory) };
  }

  function attachStrategicPlayableSettlementState(worldSeed, map) {
    const next = validateSources(map);
    const generated = createStrategicPlayableSettlementState(worldSeed, next);
    next.strategicPlayableSettlementState = generated.strategicPlayableSettlementState;
    next.publicPlayableSettlementDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function publicPlayableSettlementDirectory(map) {
    if (!map?.publicPlayableSettlementDirectory) return null;
    const directory = clone(map.publicPlayableSettlementDirectory);
    const cityById = new Map(map.humanGeography.cities.map((city) => [city.id, city]));
    directory.cityRows = directory.cityRows.map((row) => ({ ...row, city: clone(cityById.get(row.cityId)) }));
    directory.routeRows = directory.routeRows.map((row) => ({ ...row, endpointCities: row.endpointCityIds.map((id) => clone(cityById.get(id))) }));
    return directory;
  }

  function currentSettlementForAsset(map, assetId) {
    const directory = publicPlayableSettlementDirectory(map);
    if (!directory) return null;
    return [...directory.cityRows, ...directory.strongholdRows, ...directory.satelliteRows].find((row) => row.assetId === assetId) || null;
  }

  function cellPublicPlayableSettlementSnapshot(map, index) {
    const directory = publicPlayableSettlementDirectory(map);
    if (!directory || !Number.isInteger(index) || index < 0 || index >= map.topology.cellCount) return null;
    const cellId = StrategicWorld.cellId(index);
    return { cellId, settlement: [...directory.cityRows, ...directory.strongholdRows, ...directory.satelliteRows].find((row) => row.cellId === cellId) || null };
  }

  function auditStrategicPlayableSettlementState(map) {
    const { strategicPlayableSettlementState: record, publicDirectory } = validateStrategicPlayableSettlementState(map);
    return {
      valid: true,
      everyConstructedAssetResolvedOnce: new Set([...record.cityRows, ...record.strongholdRows, ...record.satelliteRows].map((row) => row.assetId)).size === record.cityRows.length + record.strongholdRows.length + record.satelliteRows.length,
      everyPopulationLedgerBalanced: [...record.cityRows, ...record.strongholdRows, ...record.satelliteRows].every((row) => assertLedger(row.populationLedger)),
      destroyedCitiesRemainRuinsWithoutJurisdiction: record.cityRows.filter((row) => row.physicalCondition === "ruined").every((row) => !row.physicalJurisdictionExists),
      currentComponentsFollowUsableRoutes: JSON.stringify(record.currentSupportComponents) === JSON.stringify(connectedComponents(record.cityRows, record.routeRows)),
      connectivityCreatesNoPoliticalUnity: record.currentSupportComponents.every((row) => !row.politicalUnity),
      atLeastOneViableRunStartRegion: record.diagnostics.viableCityCount >= 1,
      recoveryIsCausallySourced: record.recoveryRows.every((row) => row.sourceEventId && row.prerequisites.includes(row.sourceEventId)),
      publicDirectoryHidesExactPopulationAndLosses: !JSON.stringify(publicDirectory).match(/populationLedger|protectedCapacity|currentPopulation|exactFactors|crisisFatalities|unresolvedDisplacedPopulation|admittedPopulation/),
      diagnostics: clone(record.diagnostics)
    };
  }

  return Object.freeze({
    PHYSICAL_CONDITIONS, HABITATION_STATUSES, SERVICE_CONDITIONS, ROUTE_CONTINUITY, POPULATION_BANDS, CROWDING_BANDS, OBSERVATION_CONFIDENCE, RECOVERY_KINDS,
    createStrategicPlayableSettlementState, validateStrategicPlayableSettlementState, attachStrategicPlayableSettlementState,
    publicPlayableSettlementDirectory, currentSettlementForAsset, cellPublicPlayableSettlementSnapshot, auditStrategicPlayableSettlementState
  });
});
