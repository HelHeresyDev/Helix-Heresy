(function initStrategicCrisisHistory(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const strategicBeastEcology = typeof module === "object" && module.exports ? require("./strategic-beast-ecology") : root?.HelixStrategicBeastEcology;
  const strategicCityExpansion = typeof module === "object" && module.exports ? require("./strategic-city-expansion") : root?.HelixStrategicCityExpansion;
  const strategicCapabilityHistory = typeof module === "object" && module.exports ? require("./strategic-capability-history") : root?.HelixStrategicCapabilityHistory;
  const strategicSettlements = typeof module === "object" && module.exports ? require("./strategic-settlements") : root?.HelixStrategicSettlements;
  const strategicDivineHistory = typeof module === "object" && module.exports ? require("./strategic-divine-history") : root?.HelixStrategicDivineHistory;
  const api = factory(strategicWorld, strategicBeastEcology, strategicCityExpansion, strategicCapabilityHistory, strategicSettlements, strategicDivineHistory);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicCrisisHistory = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicCrisisHistoryApi(StrategicWorld, StrategicBeastEcology, StrategicCityExpansion, StrategicCapabilityHistory, StrategicSettlements, StrategicDivineHistory) {
  "use strict";

  if (!StrategicWorld || !StrategicBeastEcology || !StrategicCityExpansion || !StrategicCapabilityHistory || !StrategicSettlements || !StrategicDivineHistory) throw new Error("World, beast, expansion, capability, settlement, and divine-history modules must load before strategic-crisis-history.js");

  const CRISIS_KINDS = Object.freeze(["monsterWave", "ecologicalCascade"]);
  const OUTCOMES = Object.freeze(["repelled", "diverted", "costlySurvival", "infrastructureBreach", "cityBreach", "cityDestroyed"]);
  const ASSET_STATES = Object.freeze(["operational", "damaged", "destroyed", "abandoned"]);
  const ROUTE_STATES = Object.freeze(["operational", "damaged", "severed"]);
  const COMMAND_MODELS = Object.freeze(["leadCityCommand", "jointCommand", "dividedOperationalSectors"]);
  const CONTRIBUTION_KINDS = Object.freeze(["groundForces", "fortificationWards", "flyingMountPatrols", "poweredAircraft", "mechanizedFrames", "relayIntelligence", "supplies", "evacuationLift"]);
  const CAPABILITY_CONTRIBUTIONS = Object.freeze({
    fortifiedCivicWorks: "fortificationWards",
    flyingMountInfrastructure: "flyingMountPatrols",
    poweredAircraft: "poweredAircraft",
    mechanizedFrames: "mechanizedFrames",
    regionalDataRelays: "relayIntelligence"
  });
  const SEVERITY_POWER = Object.freeze({ guarded: 330, dangerous: 540, catastrophic: 780 });

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function seededNumber(seed, channel) { return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff; }
  function integerBetween(seed, channel, minimum, maximum) { return minimum + Math.floor(seededNumber(seed, channel) * (maximum - minimum + 1)); }
  function pick(values, seed, channel) { return values[Math.floor(seededNumber(seed, channel) * values.length) % values.length]; }
  function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, Math.floor(Number(value) || 0))); }
  function coreWithoutDigest(value) { const core = clone(value); delete core.digest; return core; }
  function title(value) { return String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()); }

  function validateSources(map) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicBeastEcology.validateBeastEcology(strategicMap);
    StrategicCityExpansion.validateCityExpansionHistory(strategicMap);
    StrategicCapabilityHistory.validateStrategicCapabilityHistory(strategicMap);
    StrategicSettlements.validateStrategicSettlements(strategicMap);
    StrategicDivineHistory.validateStrategicDivineHistory(strategicMap);
    return strategicMap;
  }

  function cityRows(map) { return StrategicCityExpansion.allCitySeeds(map); }
  function relationFor(map, cityIds) {
    if (cityIds.length < 2) return null;
    const polityIds = cityIds.map((cityId) => map.cityPolities.polities.find((polity) => polity.cityId === cityId)?.id).filter(Boolean).sort();
    return map.cityPolities.relations.find((relation) => relation.cityPolityIds.length === 2 && relation.cityPolityIds.every((id) => polityIds.includes(id))) || null;
  }

  function connectedComponents(cityIds, routes, destroyedCityIds = new Set(), severedRouteIds = new Set()) {
    const activeCities = cityIds.filter((id) => !destroyedCityIds.has(id)).sort();
    const neighbors = new Map(activeCities.map((id) => [id, []]));
    for (const route of routes) {
      if (severedRouteIds.has(route.id) || route.endpointIds.some((id) => destroyedCityIds.has(id))) continue;
      const [left, right] = route.endpointIds;
      if (!neighbors.has(left) || !neighbors.has(right)) continue;
      neighbors.get(left).push(right);
      neighbors.get(right).push(left);
    }
    const seen = new Set();
    const components = [];
    for (const cityId of activeCities) {
      if (seen.has(cityId)) continue;
      const queue = [cityId];
      seen.add(cityId);
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        for (const neighbor of neighbors.get(queue[cursor]) || []) if (!seen.has(neighbor)) { seen.add(neighbor); queue.push(neighbor); }
      }
      const members = queue.sort();
      components.push({
        id: `crisis-support-component:${StrategicWorld.stableHash(members)}`,
        cityIds: members,
        corridorIds: routes.filter((route) => !severedRouteIds.has(route.id) && route.endpointIds.every((id) => members.includes(id))).map((route) => route.id),
        physicallyConnected: true,
        politicalUnity: false
      });
    }
    return components.sort((left, right) => left.cityIds[0].localeCompare(right.cityIds[0]));
  }

  function profileOpportunities(seed, map) {
    const horizon = map.cityExpansionHistory.historicalHorizonYear;
    const cities = cityRows(map);
    const opportunities = [];
    for (const profile of map.beastEcology.waveProfiles) {
      const latestFoundation = Math.max(...profile.threatenedCityIds.map((id) => cities.find((city) => city.cityId === id)?.foundingYear || 0));
      const earliest = Math.max(latestFoundation + 2, Math.floor(horizon * 0.42));
      if (earliest >= horizon) continue;
      const episodeCount = profile.recurrenceBand === "seasonal" ? 2 : 1;
      for (let episode = 0; episode < episodeCount; episode += 1) {
        const retentionRoll = seededNumber(seed, `crisis-retention:${profile.id}:${episode}`);
        const retentionThreshold = profile.severityBand === "catastrophic" ? 0.86 : profile.severityBand === "dangerous" ? 0.65 : 0.42;
        if (retentionRoll > retentionThreshold) continue;
        const year = integerBetween(seed, `crisis-year:${profile.id}:${episode}`, earliest, Math.max(earliest, horizon - 1));
        opportunities.push({ profile, episode, year, priority: SEVERITY_POWER[profile.severityBand] + (1 - retentionRoll) * 190 });
      }
    }
    const maximum = Math.min(18, Math.max(6, Math.ceil(cities.length * 0.55)));
    return opportunities.sort((left, right) => right.priority - left.priority || left.profile.id.localeCompare(right.profile.id)).slice(0, maximum).sort((left, right) => left.year - right.year || left.profile.id.localeCompare(right.profile.id) || left.episode - right.episode);
  }

  function memberContributions(seed, map, cityId, eventId) {
    const deployed = StrategicCapabilityHistory.cityCapabilityProfile(map, cityId)?.deployedCapabilityIds || [];
    const kinds = ["groundForces", "supplies"];
    for (const capabilityId of deployed) if (CAPABILITY_CONTRIBUTIONS[capabilityId]) kinds.push(CAPABILITY_CONTRIBUTIONS[capabilityId]);
    if (deployed.includes("poweredAircraft") || deployed.includes("flyingMountInfrastructure")) kinds.push("evacuationLift");
    const uniqueKinds = [...new Set(kinds)];
    return uniqueKinds.map((kind) => ({
      kind,
      capabilityId: Object.keys(CAPABILITY_CONTRIBUTIONS).find((id) => CAPABILITY_CONTRIBUTIONS[id] === kind) || null,
      commitmentPoints: integerBetween(seed, `coalition-contribution:${eventId}:${cityId}:${kind}`, kind === "supplies" ? 18 : 24, kind === "mechanizedFrames" ? 105 : 78),
      physicallyDeployed: !["relayIntelligence"].includes(kind)
    }));
  }

  function coalitionFor(seed, map, profile, eventId, year) {
    if (profile.threatenedCityIds.length < 2) return { coalition: null, decision: null, supportPower: 0 };
    const relation = relationFor(map, profile.threatenedCityIds);
    const readiness = relation?.cooperationReadiness || "low";
    const warningBonus = profile.warningLeadBand === "weeks" ? 0.2 : profile.warningLeadBand === "days" ? 0.1 : 0;
    const formationThreshold = ({ high: 0.88, moderate: 0.68, low: 0.46 })[readiness] + warningBonus;
    const formed = seededNumber(seed, `coalition-formation:${eventId}`) < formationThreshold;
    if (!formed) {
      const blamedCityId = pick(profile.threatenedCityIds, seed, `coalition-refusal:${eventId}`);
      return {
        coalition: null,
        supportPower: 0,
        decision: { eventId, formed: false, consideredCityIds: clone(profile.threatenedCityIds), warningProtocol: "sharedMonsterWaveWarningProtocol", refusalCityIds: [blamedCityId], resultingGrievances: ["emergencySupportRefusal"], createsPermanentAlliance: false, createsSovereignty: false }
      };
    }
    const contributions = profile.threatenedCityIds.map((cityId) => ({ cityId, contributionRows: memberContributions(seed, map, cityId, eventId) }));
    const posture = relation?.posture || "wary";
    const disputes = [];
    if (["rival", "hostile"].includes(posture)) disputes.push("commandPrecedence", "postCrisisCostAllocation");
    else if (seededNumber(seed, `coalition-dispute:${eventId}`) < 0.38) disputes.push("supplyAccounting");
    const coalition = {
      id: `crisis-coalition:${eventId.split(":").at(-1)}`,
      eventId,
      formationYear: year,
      dissolutionYear: Math.min(map.cityExpansionHistory.historicalHorizonYear, year + 1),
      memberCityIds: clone(profile.threatenedCityIds),
      motive: "sharedImmediateEcologicalThreat",
      warningProtocol: "sharedMonsterWaveWarningProtocol",
      commandModel: pick(COMMAND_MODELS, seed, `coalition-command:${eventId}`),
      contributionRows: contributions,
      disputeRows: disputes,
      debtRows: disputes.includes("postCrisisCostAllocation") ? [{ debtorCityId: contributions[1].cityId, creditorCityId: contributions[0].cityId, basis: "unreconciledEmergencyExpenditure" }] : [],
      grievanceRows: disputes.map((basis) => ({ holderCityId: contributions[0].cityId, targetCityId: contributions[1].cityId, basis })),
      dissolutionReason: "specificCrisisEnded",
      standingForceAfterDissolution: false,
      permanentAlliance: false,
      createsSovereignty: false
    };
    const supportPower = contributions.flatMap((row) => row.contributionRows).reduce((total, contribution) => total + contribution.commitmentPoints, 0);
    return { coalition, decision: { eventId, formed: true, consideredCityIds: clone(profile.threatenedCityIds), warningProtocol: coalition.warningProtocol, refusalCityIds: [], resultingGrievances: clone(coalition.grievanceRows), createsPermanentAlliance: false, createsSovereignty: false }, supportPower };
  }

  function activeDivineSupport(map, cityIds, year) {
    const consequences = map.strategicDivineHistory.persistentConsequenceRows.filter((entry) => entry.persistsAtPlayableYear && entry.cityId && cityIds.includes(entry.cityId));
    const interventions = map.strategicDivineHistory.eventRows.filter((entry) => entry.year <= year && entry.cityId && cityIds.includes(entry.cityId) && ["divineIntervention", "divineCooperation"].includes(entry.kind));
    return clamp(consequences.length * 38 + interventions.length * 12, 0, 150);
  }

  function defenseFactors(seed, map, profile, eventId, year, coalitionSupport) {
    const cityFactors = profile.threatenedCityIds.map((cityId) => {
      const city = cityRows(map).find((entry) => entry.cityId === cityId);
      const capabilities = StrategicCapabilityHistory.cityCapabilityProfile(map, cityId)?.deployedCapabilityIds || [];
      return {
        cityId,
        fortificationPower: 390 + city.founderRows.length * 42,
        capabilityPower: capabilities.reduce((total, capabilityId) => total + ({ fortifiedCivicWorks: 75, standardManaPower: 25, poweredAircraft: 45, flyingMountInfrastructure: 35, mechanizedFrames: 80, regionalDataRelays: 20 })[capabilityId] || 0, 0),
        preparationPower: profile.warningLeadBand === "weeks" ? 85 : profile.warningLeadBand === "days" ? 48 : 12,
        localReadinessPower: integerBetween(seed, `crisis-readiness:${eventId}:${cityId}`, 25, 115)
      };
    });
    const divinePower = activeDivineSupport(map, profile.threatenedCityIds, year);
    const terrainPower = integerBetween(seed, `crisis-terrain:${eventId}`, -45, 65);
    const defensePower = cityFactors.reduce((total, row) => total + row.fortificationPower + row.capabilityPower + row.preparationPower + row.localReadinessPower, 0) + Math.floor(coalitionSupport * 0.62) + divinePower + terrainPower;
    const population = map.beastEcology.populations.find((entry) => entry.id === profile.populationId);
    const assaultPower = SEVERITY_POWER[profile.severityBand] + Math.floor((population?.populationIndex || 300) * 0.28) + integerBetween(seed, `crisis-assault:${eventId}`, -55, 115) + Math.max(0, profile.threatenedCityIds.length - 1) * 210;
    return { cityFactors, coalitionSupport, divinePower, terrainPower, assaultPower, defensePower, margin: defensePower - assaultPower };
  }

  function outcomeFor(seed, eventId, profile, margin) {
    if (margin >= 240) return "repelled";
    if (margin >= 70) return "diverted";
    if (margin >= -90) return "costlySurvival";
    if (margin >= -220) return "infrastructureBreach";
    if (profile.severityBand === "catastrophic" && margin < -360 && seededNumber(seed, `city-destruction:${eventId}`) < 0.16) return "cityDestroyed";
    return "cityBreach";
  }

  function targetAssets(map, profile, year) {
    const settlements = StrategicSettlements.publicSettlementDirectory(map);
    const strongholds = settlements.strongholds.filter((entry) => profile.threatenedCorridorIds.includes(entry.corridorId) && (entry.foundingYear === null || entry.foundingYear <= year));
    const satellites = settlements.satellites.filter((entry) => {
      const parentCityId = entry.parentKind === "city" ? entry.parentId : settlements.strongholds.find((stronghold) => stronghold.id === entry.parentId)?.sponsorCityIds.find((id) => profile.threatenedCityIds.includes(id));
      return profile.threatenedCityIds.includes(parentCityId);
    });
    return { strongholds, satellites };
  }

  function publicOutcomeText(outcome) {
    return ({ repelled: "repelled before permanent infrastructure loss", diverted: "diverted after a coordinated defense", costlySurvival: "survived with lasting losses", infrastructureBreach: "breached the outer support network", cityBreach: "breached a fortified city", cityDestroyed: "destroyed a fortified city" })[outcome];
  }

  function createStrategicCrisisHistory(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for strategic crisis history.");
    const strategicMap = validateSources(map);
    if (strategicMap.strategicCrisisHistory || strategicMap.publicCrisisHistoryDirectory) throw new Error("Strategic crisis history already exists on this world.");
    const cities = cityRows(strategicMap);
    const cityById = new Map(cities.map((city) => [city.cityId, city]));
    const speciesById = new Map(StrategicBeastEcology.BEAST_SPECIES.map((species) => [species.id, species]));
    const routeStates = new Map(strategicMap.routeGraph.routes.map((route) => [route.id, { corridorId: route.id, state: "operational", lastChangeYear: null, causeEventId: null }]));
    const assetStates = new Map();
    const gatewayStates = new Map();
    const destroyedCityIds = new Set();
    const severedRouteIds = new Set();
    const ecologyState = new Map(strategicMap.beastEcology.populations.map((population) => [population.id, { populationId: population.id, startingPopulationIndex: population.populationIndex, resultingPopulationIndex: population.populationIndex, pressureShiftCellId: null, lastCauseEventId: null }]));
    const eventRows = [];
    const coalitionRows = [];
    const responseDecisionRows = [];
    const componentSnapshots = [];
    let components = connectedComponents(cities.map((city) => city.cityId), strategicMap.routeGraph.routes);
    const initialSupportComponents = clone(components);

    for (const [ordinal, opportunity] of profileOpportunities(seed, strategicMap).entries()) {
      const { profile, year } = opportunity;
      const eventId = `strategic-crisis:${String(ordinal + 1).padStart(3, "0")}`;
      const beforeComponents = components;
      const coalitionResult = coalitionFor(seed, strategicMap, profile, eventId, year);
      if (coalitionResult.coalition) coalitionRows.push(coalitionResult.coalition);
      if (coalitionResult.decision) responseDecisionRows.push(coalitionResult.decision);
      const factors = defenseFactors(seed, strategicMap, profile, eventId, year, coalitionResult.supportPower);
      let outcome = outcomeFor(seed, eventId, profile, factors.margin);
      if (outcome === "cityDestroyed" && destroyedCityIds.size >= cities.length - 1) outcome = "cityBreach";
      const targets = targetAssets(strategicMap, profile, year);
      const infrastructureDeltas = [];
      const setAsset = (asset, kind, state) => {
        const previous = assetStates.get(asset.id)?.state || "operational";
        const ranks = { operational: 0, damaged: 1, abandoned: 2, destroyed: 3 };
        const resulting = ranks[state] > ranks[previous] ? state : previous;
        assetStates.set(asset.id, { assetId: asset.id, kind, cellId: asset.cellId, state: resulting, lastChangeYear: year, causeEventId: eventId });
        infrastructureDeltas.push({ assetId: asset.id, kind, previousState: previous, resultingState: resulting, cellId: asset.cellId });
      };
      const satellite = targets.satellites.length ? pick(targets.satellites, seed, `crisis-satellite:${eventId}`) : null;
      const stronghold = targets.strongholds.length ? pick(targets.strongholds, seed, `crisis-stronghold:${eventId}`) : null;
      if (["costlySurvival", "infrastructureBreach", "cityBreach", "cityDestroyed"].includes(outcome) && satellite) setAsset(satellite, "satellite", outcome === "costlySurvival" ? "damaged" : outcome === "infrastructureBreach" ? "abandoned" : "destroyed");
      if (["infrastructureBreach", "cityBreach", "cityDestroyed"].includes(outcome) && stronghold) setAsset(stronghold, "jointRouteStronghold", outcome === "infrastructureBreach" ? "damaged" : "destroyed");
      let route = profile.threatenedCorridorIds.length ? strategicMap.routeGraph.routes.find((entry) => entry.id === pick(profile.threatenedCorridorIds, seed, `crisis-route:${eventId}`)) : null;
      if (route && ["costlySurvival", "infrastructureBreach", "cityBreach", "cityDestroyed"].includes(outcome)) {
        const previous = routeStates.get(route.id).state;
        const sever = ["cityBreach", "cityDestroyed"].includes(outcome) || (outcome === "infrastructureBreach" && profile.severityBand === "catastrophic");
        const resulting = previous === "severed" || sever ? "severed" : "damaged";
        routeStates.set(route.id, { corridorId: route.id, state: resulting, lastChangeYear: year, causeEventId: eventId });
        if (resulting === "severed") severedRouteIds.add(route.id);
        infrastructureDeltas.push({ assetId: route.id, kind: "supportCorridor", previousState: previous, resultingState: resulting, cellId: null });
      }
      const targetCityId = pick(profile.threatenedCityIds, seed, `crisis-city-target:${eventId}`);
      if (outcome === "cityDestroyed") {
        destroyedCityIds.add(targetCityId);
        infrastructureDeltas.push({ assetId: targetCityId, kind: "sovereignCity", previousState: "operational", resultingState: "destroyed", cellId: cityById.get(targetCityId).cellId });
      } else if (["cityBreach", "infrastructureBreach"].includes(outcome)) {
        infrastructureDeltas.push({ assetId: targetCityId, kind: "sovereignCity", previousState: "operational", resultingState: "damaged", cellId: cityById.get(targetCityId).cellId });
      }
      if (["infrastructureBreach", "cityBreach", "cityDestroyed"].includes(outcome) && StrategicCapabilityHistory.cityHasCapability(strategicMap, targetCityId, "regionalDataRelays")) {
        const state = outcome === "cityDestroyed" ? "offline" : "degraded";
        gatewayStates.set(targetCityId, { cityId: targetCityId, state, localOnly: true, orbitalConstellationDestroyed: false, causeEventId: eventId, lastChangeYear: year });
      }
      components = connectedComponents(cities.map((city) => city.cityId), strategicMap.routeGraph.routes, destroyedCityIds, severedRouteIds);
      const componentChanged = JSON.stringify(beforeComponents.map((entry) => entry.cityIds)) !== JSON.stringify(components.map((entry) => entry.cityIds));
      if (componentChanged) componentSnapshots.push({ eventId, year, components: clone(components) });
      const ecology = ecologyState.get(profile.populationId);
      const populationDeltaPermille = ({ repelled: -95, diverted: -35, costlySurvival: -10, infrastructureBreach: 25, cityBreach: 55, cityDestroyed: 90 })[outcome] + integerBetween(seed, `ecology-delta:${eventId}`, -18, 18);
      ecology.resultingPopulationIndex = Math.max(1, Math.floor(ecology.resultingPopulationIndex * (1000 + populationDeltaPermille) / 1000));
      ecology.pressureShiftCellId = outcome === "diverted" ? pick(profile.cellPath, seed, `diversion-cell:${eventId}`) : profile.destinationCellId;
      ecology.lastCauseEventId = eventId;
      const population = strategicMap.beastEcology.populations.find((entry) => entry.id === profile.populationId);
      const species = speciesById.get(population.speciesId);
      const evacuation = satellite && infrastructureDeltas.some((entry) => entry.assetId === satellite.id) ? { attempted: true, originAssetId: satellite.id, destinationCityIds: clone(profile.threatenedCityIds), outcome: outcome === "costlySurvival" ? "partialEvacuation" : "displacement", individualSimulationDeferred: true } : { attempted: false };
      eventRows.push({
        id: eventId,
        year,
        kind: profile.cause === "seasonalHabitatChange" ? "monsterWave" : "ecologicalCascade",
        sourceWaveProfileId: profile.id,
        sourcePopulationId: profile.populationId,
        sourceSpeciesId: population.speciesId,
        exactCellPath: clone(profile.cellPath),
        threatenedCityIds: clone(profile.threatenedCityIds),
        threatenedCorridorIds: clone(profile.threatenedCorridorIds),
        triggerFacts: clone(profile.triggerFacts),
        actualCause: profile.cause,
        warning: { leadBand: profile.warningLeadBand, signs: clone(profile.warningSigns), protocolAvailable: profile.threatenedCityIds.length > 1 },
        prerequisites: [profile.id, profile.populationId, ...profile.triggerFacts, ...profile.threatenedCityIds.map((id) => `founded-city:${id}`)],
        coalitionId: coalitionResult.coalition?.id || null,
        exactFactors: factors,
        outcome,
        stateDelta: { infrastructureDeltas, evacuation, ecologyDelta: { populationId: profile.populationId, populationIndexDeltaPermille: populationDeltaPermille, pressureShiftCellId: ecology.pressureShiftCellId }, supportComponentChanged: componentChanged, beforeComponentCount: beforeComponents.length, afterComponentCount: components.length, createsState: false, createsPermanentAlliance: false },
        discoverableHooks: infrastructureDeltas.map((entry) => entry.assetId).concat(coalitionResult.decision?.resultingGrievances?.length ? [`coalition-record:${eventId}`] : []),
        publiclyKnown: true,
        publicCause: seededNumber(seed, `public-crisis-cause:${eventId}`) < 0.68 ? title(profile.cause) : "Cause disputed",
        publicOutcome: publicOutcomeText(outcome),
        publicAccount: `${species.name} pressure ${publicOutcomeText(outcome)}. ${infrastructureDeltas.length ? `${infrastructureDeltas.length} lasting infrastructure consequence${infrastructureDeltas.length === 1 ? " was" : "s were"} recorded.` : "Defenders reported no permanent infrastructure loss."}`
      });
    }

    const publicCoalitions = coalitionRows.map((coalition) => ({
      id: coalition.id, eventId: coalition.eventId, formationYear: coalition.formationYear, dissolutionYear: coalition.dissolutionYear,
      memberCityIds: clone(coalition.memberCityIds), motive: coalition.motive, warningProtocol: coalition.warningProtocol, commandModel: coalition.commandModel,
      advertisedContributions: coalition.contributionRows.map((row) => ({ cityId: row.cityId, kinds: row.contributionRows.map((entry) => entry.kind) })),
      disputes: clone(coalition.disputeRows), debts: clone(coalition.debtRows), grievances: clone(coalition.grievanceRows), dissolutionReason: coalition.dissolutionReason,
      permanentAlliance: false, createsSovereignty: false
    }));
    const publicEvents = eventRows.map((event) => ({
      id: event.id, year: event.year, kind: event.kind, speciesId: event.sourceSpeciesId, threatenedCityIds: clone(event.threatenedCityIds), threatenedCorridorIds: clone(event.threatenedCorridorIds),
      warningLeadBand: event.warning.leadBand, warningSigns: clone(event.warning.signs), reportedCause: event.publicCause, outcome: event.publicOutcome, account: event.publicAccount,
      coalitionId: event.coalitionId, publicInfrastructureConsequences: event.stateDelta.infrastructureDeltas.map((entry) => ({ assetId: entry.assetId, kind: entry.kind, resultingState: entry.resultingState, cellId: entry.cellId })),
      evacuation: clone(event.stateDelta.evacuation), discoverableHooks: clone(event.discoverableHooks), exactPathPublic: false, exactPopulationPublic: false, hiddenReadinessAcknowledged: true
    }));
    const publicDirectory = {
      historicalHorizonYear: strategicMap.cityExpansionHistory.historicalHorizonYear,
      knowledgePolicy: "supportedCrisisAccountsWithUncertainCausality",
      chronology: publicEvents,
      coalitionRows: publicCoalitions,
      responseDecisionRows: responseDecisionRows.map((row) => ({ ...clone(row), resultingGrievances: row.resultingGrievances.map((entry) => typeof entry === "string" ? entry : entry.basis) })),
      routeConditionRows: [...routeStates.values()].filter((entry) => entry.state !== "operational"),
      assetConditionRows: [...assetStates.values()],
      localGatewayConditionRows: [...gatewayStates.values()],
      currentSupportComponents: clone(components),
      principles: { physicalConnectivityIsNotAlliance: true, coalitionsAreEventSpecific: true, everyCityRemainsAttackable: true, orbitalInternetSurvivesRegionalCrises: true, individualCombatSimulationDeferred: true }
    };
    publicDirectory.digest = `public-crisis-history-${StrategicWorld.stableHash(coreWithoutDigest(publicDirectory))}`;
    const record = {
      historicalHorizonYear: strategicMap.cityExpansionHistory.historicalHorizonYear,
      sourcePristineEcologyDigest: strategicMap.pristineBeastEcology.digest,
      sourceBeastEcologyDigest: strategicMap.beastEcology.digest,
      sourceCityExpansionDigest: strategicMap.cityExpansionHistory.digest,
      sourceCapabilityDigest: strategicMap.strategicCapabilityHistory.digest,
      sourceSettlementDigest: strategicMap.strategicSettlements.digest,
      sourceDivineHistoryDigest: strategicMap.strategicDivineHistory.digest,
      publicDirectoryDigest: publicDirectory.digest,
      ecologyProjectionStatus: "causalCrisisProjectionSupersedesProvisionalPressureForDownstreamHistory",
      initialSupportComponents,
      eventRows,
      coalitionRows,
      responseDecisionRows,
      routeConditionRows: [...routeStates.values()],
      assetConditionRows: [...assetStates.values()],
      localGatewayConditionRows: [...gatewayStates.values()],
      supportComponentSnapshots: componentSnapshots,
      postCrisisSupportComponents: components,
      postCrisisPopulationRows: [...ecologyState.values()],
      diagnostics: {
        opportunityCount: strategicMap.beastEcology.waveProfiles.length,
        retainedEventCount: eventRows.length,
        coalitionCount: coalitionRows.length,
        failedCoalitionCount: responseDecisionRows.filter((row) => !row.formed).length,
        damagedAssetCount: [...assetStates.values()].filter((row) => row.state === "damaged").length,
        destroyedOrAbandonedAssetCount: [...assetStates.values()].filter((row) => ["destroyed", "abandoned"].includes(row.state)).length,
        severedRouteCount: severedRouteIds.size,
        destroyedCityCount: destroyedCityIds.size,
        finalSupportComponentCount: components.length,
        ecologyPopulationCount: ecologyState.size
      }
    };
    record.digest = `strategic-crisis-history-${StrategicWorld.stableHash(coreWithoutDigest(record))}`;
    return { strategicCrisisHistory: record, publicDirectory };
  }

  function validateStrategicCrisisHistory(map, record = map?.strategicCrisisHistory, directory = map?.publicCrisisHistoryDirectory) {
    const strategicMap = validateSources(map);
    if (!record || !directory || record.sourcePristineEcologyDigest !== strategicMap.pristineBeastEcology.digest || record.sourceBeastEcologyDigest !== strategicMap.beastEcology.digest || record.sourceCityExpansionDigest !== strategicMap.cityExpansionHistory.digest || record.sourceCapabilityDigest !== strategicMap.strategicCapabilityHistory.digest || record.sourceSettlementDigest !== strategicMap.strategicSettlements.digest || record.sourceDivineHistoryDigest !== strategicMap.strategicDivineHistory.digest || record.publicDirectoryDigest !== directory.digest) throw new Error("Strategic crisis history is incomplete or does not match its causal sources.");
    const cityIds = new Set(cityRows(strategicMap).map((city) => city.cityId));
    const routeIds = new Set(strategicMap.routeGraph.routes.map((route) => route.id));
    const populationIds = new Set(strategicMap.beastEcology.populations.map((population) => population.id));
    if (!Array.isArray(record.eventRows) || new Set(record.eventRows.map((event) => event.id)).size !== record.eventRows.length || record.eventRows.some((event, index) => !CRISIS_KINDS.includes(event.kind) || !OUTCOMES.includes(event.outcome) || !Number.isInteger(event.year) || event.year < 1 || event.year > record.historicalHorizonYear || index && event.year < record.eventRows[index - 1].year || !strategicMap.beastEcology.waveProfiles.some((profile) => profile.id === event.sourceWaveProfileId && profile.populationId === event.sourcePopulationId) || !populationIds.has(event.sourcePopulationId) || !event.exactCellPath?.length || !event.prerequisites?.length || !event.exactFactors || !event.stateDelta || event.stateDelta.createsState || event.stateDelta.createsPermanentAlliance || event.threatenedCityIds.some((id) => !cityIds.has(id)) || event.threatenedCorridorIds.some((id) => !routeIds.has(id)))) throw new Error("A retained crisis lacks causal sources, chronology, resolution factors, or bounded consequences.");
    if (!Array.isArray(record.coalitionRows) || record.coalitionRows.some((coalition) => !record.eventRows.some((event) => event.id === coalition.eventId && event.coalitionId === coalition.id) || coalition.memberCityIds.length < 2 || coalition.memberCityIds.some((id) => !cityIds.has(id)) || !COMMAND_MODELS.includes(coalition.commandModel) || coalition.dissolutionYear < coalition.formationYear || coalition.permanentAlliance || coalition.createsSovereignty || coalition.standingForceAfterDissolution || coalition.dissolutionReason !== "specificCrisisEnded")) throw new Error("Crisis coalitions must be temporary, event-specific, and non-sovereign.");
    for (const coalition of record.coalitionRows) for (const member of coalition.contributionRows) {
      const deployed = StrategicCapabilityHistory.cityCapabilityProfile(strategicMap, member.cityId)?.deployedCapabilityIds || [];
      if (member.contributionRows.some((entry) => !CONTRIBUTION_KINDS.includes(entry.kind) || !Number.isInteger(entry.commitmentPoints) || entry.commitmentPoints < 1 || (entry.capabilityId && (!deployed.includes(entry.capabilityId) || CAPABILITY_CONTRIBUTIONS[entry.capabilityId] !== entry.kind)))) throw new Error("A coalition claims a contribution that its member cannot physically support.");
    }
    if (!Array.isArray(record.routeConditionRows) || record.routeConditionRows.length !== strategicMap.routeGraph.routes.length || record.routeConditionRows.some((row) => !routeIds.has(row.corridorId) || !ROUTE_STATES.includes(row.state))) throw new Error("Crisis route conditions are incomplete or invalid.");
    if (!Array.isArray(record.assetConditionRows) || record.assetConditionRows.some((row) => !ASSET_STATES.includes(row.state) || !row.assetId || !row.causeEventId)) throw new Error("Crisis asset conditions are invalid.");
    const destroyedCityIds = new Set(record.eventRows.flatMap((event) => event.stateDelta.infrastructureDeltas.filter((delta) => delta.kind === "sovereignCity" && delta.resultingState === "destroyed").map((delta) => delta.assetId)));
    const severedRouteIds = new Set(record.routeConditionRows.filter((row) => row.state === "severed").map((row) => row.corridorId));
    const expectedComponents = connectedComponents([...cityIds], strategicMap.routeGraph.routes, destroyedCityIds, severedRouteIds);
    if (JSON.stringify(record.postCrisisSupportComponents) !== JSON.stringify(expectedComponents) || record.postCrisisSupportComponents.some((component) => component.politicalUnity)) throw new Error("Post-crisis support components do not match surviving physical connectivity.");
    if (!Array.isArray(record.postCrisisPopulationRows) || record.postCrisisPopulationRows.length !== populationIds.size || record.postCrisisPopulationRows.some((row) => !populationIds.has(row.populationId) || row.resultingPopulationIndex < 1)) throw new Error("Post-crisis ecological pressure does not preserve every canonical population.");
    const publicJson = JSON.stringify(directory);
    if (/sourcePopulationId|exactCellPath|exactFactors|commitmentPoints|populationIndexDeltaPermille|startingPopulationIndex|resultingPopulationIndex|localReadinessPower|assaultPower|defensePower/.test(publicJson)) throw new Error("Public crisis history leaks exact ecology, paths, readiness, or force contributions.");
    if (directory.knowledgePolicy !== "supportedCrisisAccountsWithUncertainCausality" || directory.coalitionRows.some((row) => row.permanentAlliance || row.createsSovereignty) || !directory.principles?.physicalConnectivityIsNotAlliance || !directory.principles?.orbitalInternetSurvivesRegionalCrises) throw new Error("The public crisis directory violates coalition, connectivity, or communication boundaries.");
    const diagnostics = record.diagnostics;
    if (!diagnostics || diagnostics.retainedEventCount !== record.eventRows.length || diagnostics.coalitionCount !== record.coalitionRows.length || diagnostics.severedRouteCount !== severedRouteIds.size || diagnostics.destroyedCityCount !== destroyedCityIds.size || diagnostics.finalSupportComponentCount !== record.postCrisisSupportComponents.length || diagnostics.ecologyPopulationCount !== record.postCrisisPopulationRows.length) throw new Error("Crisis-history diagnostics do not match saved facts.");
    if (directory.digest !== `public-crisis-history-${StrategicWorld.stableHash(coreWithoutDigest(directory))}` || record.digest !== `strategic-crisis-history-${StrategicWorld.stableHash(coreWithoutDigest(record))}`) throw new Error("Strategic crisis history does not match its digest.");
    return { strategicCrisisHistory: clone(record), publicDirectory: clone(directory) };
  }

  function attachStrategicCrisisHistory(worldSeed, map) {
    const next = validateSources(map);
    const generated = createStrategicCrisisHistory(worldSeed, next);
    next.strategicCrisisHistory = generated.strategicCrisisHistory;
    next.publicCrisisHistoryDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function publicCrisisHistory(map) {
    if (!map?.publicCrisisHistoryDirectory) return null;
    const directory = clone(map.publicCrisisHistoryDirectory);
    const speciesById = new Map(StrategicBeastEcology.BEAST_SPECIES.map((species) => [species.id, species]));
    const cityById = new Map(cityRows(map).map((city) => [city.cityId, { id: city.cityId, name: city.cityName, cellId: city.cellId }]));
    directory.chronology = directory.chronology.map((event) => ({ ...event, species: clone(speciesById.get(event.speciesId)), threatenedCities: event.threatenedCityIds.map((id) => clone(cityById.get(id))) }));
    return directory;
  }

  function cellPublicCrisisSnapshot(map, index) {
    if (!map?.publicCrisisHistoryDirectory || !Number.isInteger(index) || index < 0 || index >= map.topology.cellCount) return null;
    const cellId = StrategicWorld.cellId(index);
    const directory = publicCrisisHistory(map);
    return {
      cellId,
      events: directory.chronology.filter((event) => event.publicInfrastructureConsequences.some((entry) => entry.cellId === cellId) || event.threatenedCities.some((city) => city.cellId === cellId)),
      assets: directory.assetConditionRows.filter((entry) => entry.cellId === cellId)
    };
  }

  function auditStrategicCrisisHistory(map) {
    const { strategicCrisisHistory: record, publicDirectory } = validateStrategicCrisisHistory(map);
    return {
      valid: true,
      pristineEcologyImmutable: record.sourcePristineEcologyDigest === map.pristineBeastEcology.digest,
      everyEventCausalAndConsequential: record.eventRows.every((event) => event.prerequisites.length && event.exactFactors && (event.stateDelta.infrastructureDeltas.length || event.stateDelta.ecologyDelta || event.discoverableHooks.length)),
      coalitionsTemporaryAndNonSovereign: record.coalitionRows.every((row) => row.dissolutionYear >= row.formationYear && !row.permanentAlliance && !row.createsSovereignty && !row.standingForceAfterDissolution),
      contributionsCapabilityBacked: record.coalitionRows.every((coalition) => coalition.contributionRows.every((member) => member.contributionRows.every((entry) => !entry.capabilityId || StrategicCapabilityHistory.cityHasCapability(map, member.cityId, entry.capabilityId)))),
      routeSplitsArePhysicalOnly: record.postCrisisSupportComponents.every((component) => component.physicallyConnected && !component.politicalUnity),
      publicHistoryHidesExactCausality: !JSON.stringify(publicDirectory).match(/sourcePopulationId|exactCellPath|exactFactors|commitmentPoints|populationIndexDeltaPermille|startingPopulationIndex|resultingPopulationIndex|localReadinessPower|assaultPower|defensePower/),
      quietWorldsAllowed: record.eventRows.length <= Math.max(18, record.diagnostics.opportunityCount),
      diagnostics: clone(record.diagnostics)
    };
  }

  return Object.freeze({
    CRISIS_KINDS, OUTCOMES, ASSET_STATES, ROUTE_STATES, COMMAND_MODELS, CONTRIBUTION_KINDS,
    createStrategicCrisisHistory, validateStrategicCrisisHistory, attachStrategicCrisisHistory,
    publicCrisisHistory, cellPublicCrisisSnapshot, auditStrategicCrisisHistory
  });
});
