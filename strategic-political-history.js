(function initStrategicPoliticalHistory(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const strategicCityPolities = typeof module === "object" && module.exports ? require("./strategic-city-polities") : root?.HelixStrategicCityPolities;
  const strategicCityExpansion = typeof module === "object" && module.exports ? require("./strategic-city-expansion") : root?.HelixStrategicCityExpansion;
  const strategicCapabilityHistory = typeof module === "object" && module.exports ? require("./strategic-capability-history") : root?.HelixStrategicCapabilityHistory;
  const strategicCityGovernments = typeof module === "object" && module.exports ? require("./strategic-city-governments") : root?.HelixStrategicCityGovernments;
  const strategicNonStateNetworks = typeof module === "object" && module.exports ? require("./strategic-non-state-networks") : root?.HelixStrategicNonStateNetworks;
  const strategicCrisisHistory = typeof module === "object" && module.exports ? require("./strategic-crisis-history") : root?.HelixStrategicCrisisHistory;
  const api = factory(strategicWorld, strategicCityPolities, strategicCityExpansion, strategicCapabilityHistory, strategicCityGovernments, strategicNonStateNetworks, strategicCrisisHistory);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicPoliticalHistory = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicPoliticalHistoryApi(StrategicWorld, StrategicCityPolities, StrategicCityExpansion, StrategicCapabilityHistory, StrategicCityGovernments, StrategicNonStateNetworks, StrategicCrisisHistory) {
  "use strict";

  if (!StrategicWorld || !StrategicCityPolities || !StrategicCityExpansion || !StrategicCapabilityHistory || !StrategicCityGovernments || !StrategicNonStateNetworks || !StrategicCrisisHistory) throw new Error("World, polity, expansion, capability, government, network, and crisis modules must load before strategic-political-history.js");

  const EVENT_KINDS = Object.freeze(["sovereignFoundation", "authorityAccession", "intercityCampaign", "subjectRevolt", "claimantDisplacement"]);
  const CAMPAIGN_OUTCOMES = Object.freeze(["campaignRepelled", "tributeImposed", "puppetInstalled", "occupationEstablished"]);
  const CONTROL_STATUSES = Object.freeze(["sovereign", "tributary", "puppet", "occupied", "displacedClaim"]);
  const CONTRIBUTION_KINDS = Object.freeze(["groundForces", "supplies", "fortificationWards", "flyingMountPatrols", "poweredAircraft", "mechanizedFrames", "relayIntelligence"]);
  const CAPABILITY_CONTRIBUTIONS = Object.freeze({ fortifiedCivicWorks: "fortificationWards", flyingMountInfrastructure: "flyingMountPatrols", poweredAircraft: "poweredAircraft", mechanizedFrames: "mechanizedFrames", regionalDataRelays: "relayIntelligence" });
  const CAPABILITY_POWER = Object.freeze({ fortifiedCivicWorks: 34, standardManaPower: 12, flyingMountInfrastructure: 20, poweredAircraft: 28, mechanizedFrames: 42, regionalDataRelays: 14 });
  const CAPACITY_POWER = Object.freeze({ fragile: 8, strained: 16, functional: 27, strong: 39, exceptional: 54 });
  const ACTOR_NAMES = Object.freeze(["Aderyn", "Bastel", "Cerys", "Damar", "Eris", "Ferren", "Galen", "Hessa", "Iven", "Jora", "Kael", "Liora", "Marek", "Neris", "Orin", "Pella", "Quill", "Rysa", "Soren", "Tavia"]);
  const ACTOR_EPITHETS = Object.freeze(["Ashward", "Brightwire", "Coldforge", "Duskwing", "Emberglass", "Farwatch", "Gateborn", "Hexward", "Ironveil", "Jadebolt", "Keystone", "Longsignal"]);

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function seededNumber(seed, channel) { return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff; }
  function integerBetween(seed, channel, minimum, maximum) { return minimum + Math.floor(seededNumber(seed, channel) * (maximum - minimum + 1)); }
  function pick(values, seed, channel) { return values[Math.floor(seededNumber(seed, channel) * values.length) % values.length]; }
  function coreWithoutDigest(value) { const core = clone(value); delete core.digest; return core; }
  function readable(value) { return String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()); }
  function generatedActorName(seed, channel) { return `${pick(ACTOR_NAMES, seed, `${channel}:given`)} ${pick(ACTOR_EPITHETS, seed, `${channel}:epithet`)}`; }

  function validateSources(map) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCityPolities.validateCityPolities(strategicMap);
    StrategicCityExpansion.validateCityExpansionHistory(strategicMap);
    StrategicCapabilityHistory.validateStrategicCapabilityHistory(strategicMap);
    StrategicCityGovernments.validateCityGovernments(strategicMap);
    StrategicNonStateNetworks.validateStrategicNonStateNetworks(strategicMap);
    StrategicCrisisHistory.validateStrategicCrisisHistory(strategicMap);
    return strategicMap;
  }

  function sources(map) {
    const cities = StrategicCityExpansion.allCitySeeds(map);
    return {
      cities,
      cityById: new Map(cities.map((city) => [city.cityId, city])),
      polityByCityId: new Map(map.cityPolities.polities.map((polity) => [polity.cityId, polity])),
      governmentByCityId: new Map(map.cityGovernments.governments.map((government) => [government.cityId, government])),
      routeById: new Map(map.routeGraph.routes.map((route) => [route.id, route])),
      corridorById: new Map(map.cityExpansionHistory.corridorRows.map((corridor) => [corridor.id, corridor])),
      routeConditionById: new Map(map.strategicCrisisHistory.routeConditionRows.map((row) => [row.corridorId, row]))
    };
  }

  function routeStateAtYear(source, routeId, year) {
    const condition = source.routeConditionById.get(routeId);
    if (!condition || condition.lastChangeYear === null || year < condition.lastChangeYear) return "operational";
    return condition.state;
  }

  function destroyedAt(map, cityId) {
    const events = map.strategicCrisisHistory.eventRows.filter((event) => event.stateDelta.infrastructureDeltas.some((delta) => delta.kind === "sovereignCity" && delta.assetId === cityId && delta.resultingState === "destroyed"));
    return events.length ? events[0] : null;
  }

  function authorityActors(source, horizon) {
    const actorRows = [];
    const authorityHistoryRows = [];
    for (const city of source.cities) {
      const polity = source.polityByCityId.get(city.cityId);
      const founders = city.founderRows.map((founder, index) => ({
        id: founder.id,
        kind: "individual",
        name: founder.name,
        title: index ? "Founding Power" : "Founding Sovereign",
        cityId: city.cityId,
        role: index ? "cofounder" : "foundingSovereign",
        exceptionalCapabilities: clone(founder.exceptionalCapabilities || []),
        persistsToPlayableYear: false
      }));
      actorRows.push(...founders);
      const currentActor = {
        id: polity.authority.id,
        kind: polity.authority.kind,
        name: polity.authority.name,
        title: polity.authority.title,
        cityId: city.cityId,
        role: "playableYearSovereignAuthority",
        exceptionalCapabilities: [],
        persistsToPlayableYear: true,
        membershipSimulation: polity.authority.kind === "collective" ? "abstractInstitutionalContinuity" : null
      };
      if (!actorRows.some((actor) => actor.id === currentActor.id)) actorRows.push(currentActor);
      const span = Math.max(0, horizon - city.foundingYear);
      const routineSuccessions = Math.max(0, Math.floor(span / 52) - 1);
      const accessionYear = Math.max(city.foundingYear + 1, horizon - Math.max(7, Math.min(46, Math.floor(span * 0.08))));
      authorityHistoryRows.push({
        cityId: city.cityId,
        polityId: polity.id,
        foundingAuthorityActorId: founders[0].id,
        currentAuthorityActorId: currentActor.id,
        currentAccessionYear: accessionYear,
        routineSuccessionCount: routineSuccessions,
        continuityModel: polity.authority.kind === "collective" ? "stableCollectiveIdentityWithAbstractMembership" : "summarizedIndividualSuccessions",
        implicitFounderLongevity: false
      });
    }
    return { actorRows, authorityHistoryRows };
  }

  function militaryPower(map, source, cityId) {
    const profile = StrategicCapabilityHistory.cityCapabilityProfile(map, cityId);
    const capabilities = profile?.deployedCapabilityIds || [];
    const government = source.governmentByCityId.get(cityId);
    const defense = government?.institutions.find((institution) => institution.roles.includes("militaryDefenseCommand"));
    const city = source.cityById.get(cityId);
    return 75 + (city?.founderRows.length || 1) * 11 + (CAPACITY_POWER[defense?.capacityBand] || 15) + capabilities.reduce((sum, id) => sum + (CAPABILITY_POWER[id] || 0), 0);
  }

  function campaignOpportunities(seed, map, source) {
    const horizon = map.cityExpansionHistory.historicalHorizonYear;
    const opportunities = [];
    for (const corridor of map.cityExpansionHistory.corridorRows) {
      const [leftId, rightId] = corridor.endpointCityIds;
      const polities = corridor.endpointCityIds.map((cityId) => source.polityByCityId.get(cityId));
      const relation = map.cityPolities.relations.find((entry) => entry.cityPolityIds.length === 2 && polities.every((polity) => entry.cityPolityIds.includes(polity.id)));
      const hostility = ({ hostile: 1, rival: 0.82, wary: 0.48, pragmatic: 0.22, cordial: 0.1 })[relation?.posture] || 0.35;
      const foundingHostility = ["openlyHostile", "hostileSeparation"].includes(corridor.relationshipAtConstruction) ? 0.22 : 0;
      const retain = seededNumber(seed, `campaign-retain:${corridor.id}`);
      if (retain > Math.min(0.93, hostility + foundingHostility)) continue;
      const earliest = Math.max(corridor.constructionYear + 3, Math.floor(horizon * 0.35));
      if (earliest >= horizon - 2) continue;
      const year = integerBetween(seed, `campaign-year:${corridor.id}`, earliest, horizon - 2);
      if (destroyedAt(map, leftId)?.year <= year || destroyedAt(map, rightId)?.year <= year) continue;
      if (routeStateAtYear(source, corridor.id, year) === "severed") continue;
      const reverse = seededNumber(seed, `campaign-direction:${corridor.id}`) < 0.5;
      opportunities.push({ corridor, relation, year, attackerCityId: reverse ? rightId : leftId, defenderCityId: reverse ? leftId : rightId, priority: hostility * 100 + (1 - retain) * 35 });
    }
    const maximum = Math.min(14, Math.max(5, Math.ceil(source.cities.length * 0.42)));
    return opportunities.sort((a, b) => b.priority - a.priority || a.corridor.id.localeCompare(b.corridor.id)).slice(0, maximum).sort((a, b) => a.year - b.year || a.corridor.id.localeCompare(b.corridor.id));
  }

  function contributionsFor(map, cityId, points) {
    const capabilities = StrategicCapabilityHistory.cityCapabilityProfile(map, cityId)?.deployedCapabilityIds || [];
    const rows = [{ kind: "groundForces", capabilityId: null, commitmentBand: points > 215 ? "major" : "limited" }, { kind: "supplies", capabilityId: null, commitmentBand: "sustained" }];
    for (const capabilityId of capabilities) if (CAPABILITY_CONTRIBUTIONS[capabilityId]) rows.push({ kind: CAPABILITY_CONTRIBUTIONS[capabilityId], capabilityId, commitmentBand: "specialist" });
    return rows;
  }

  function warCompactFor(seed, map, source, eventId, opportunity, attackerPower) {
    if (seededNumber(seed, `war-compact:${eventId}`) > 0.75) return null;
    const candidates = map.cityExpansionHistory.corridorRows.filter((corridor) => corridor.id !== opportunity.corridor.id && corridor.endpointCityIds.includes(opportunity.attackerCityId) && !corridor.endpointCityIds.includes(opportunity.defenderCityId) && corridor.constructionYear <= opportunity.year && routeStateAtYear(source, corridor.id, opportunity.year) !== "severed");
    if (!candidates.length) return null;
    const supportRoute = pick(candidates, seed, `war-compact-route:${eventId}`);
    const supporterCityId = supportRoute.endpointCityIds.find((id) => id !== opportunity.attackerCityId);
    const memberCityIds = [opportunity.attackerCityId, supporterCityId];
    const leadPolityId = source.polityByCityId.get(opportunity.attackerCityId).id;
    return {
      id: `war-compact:${eventId.split(":").at(-1)}`,
      eventId,
      formationYear: opportunity.year,
      dissolutionYear: Math.min(map.cityExpansionHistory.historicalHorizonYear, opportunity.year + 1),
      leadPolityId,
      memberPolityIds: memberCityIds.map((id) => source.polityByCityId.get(id).id),
      finiteGoal: "compelDefinedCampaignOutcome",
      physicallySupportingCorridorIds: [opportunity.corridor.id, supportRoute.id],
      contributionRows: memberCityIds.map((cityId) => ({ cityId, contributions: contributionsFor(map, cityId, cityId === opportunity.attackerCityId ? attackerPower : militaryPower(map, source, cityId)) })),
      dissolutionReason: "campaignEnded",
      permanentAlliance: false,
      createsSovereignty: false,
      standingForceAfterDissolution: false
    };
  }

  function mercenaryContractFor(seed, map, eventId, attackerCityId) {
    if (seededNumber(seed, `mercenary:${eventId}`) > 0.28) return null;
    const directory = StrategicNonStateNetworks.publicNonStateNetworkDirectory(map);
    const branch = directory.branches.find((entry) => entry.cityId === attackerCityId && directory.networks.find((network) => network.id === entry.networkId)?.category === "military");
    if (!branch) return null;
    return { networkId: branch.networkId, branchId: branch.id, contractScope: "campaignLogisticsAndBoundedForce", sovereignAuthority: false, occupationAuthority: false };
  }

  function publicOutcome(outcome) {
    return ({ campaignRepelled: "was repelled", tributeImposed: "imposed a finite tribute obligation", puppetInstalled: "covertly subordinated the publicly local authority", occupationEstablished: "established a military occupation", sovereigntyRestored: "restored local sovereign control", revoltSuppressed: "suppressed a subject revolt" })[outcome] || readable(outcome).toLowerCase();
  }

  function createStrategicPoliticalHistory(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for strategic political history.");
    const strategicMap = validateSources(map);
    if (strategicMap.strategicPoliticalHistory || strategicMap.publicPoliticalHistoryDirectory) throw new Error("Strategic political history already exists on this world.");
    const source = sources(strategicMap);
    const horizon = strategicMap.cityExpansionHistory.historicalHorizonYear;
    const { actorRows, authorityHistoryRows } = authorityActors(source, horizon);
    const eventRows = [];
    const warCompactRows = [];
    const controlByCityId = new Map(source.cities.map((city) => {
      const polity = source.polityByCityId.get(city.cityId);
      return [city.cityId, { cityId: city.cityId, sovereignPolityId: polity.id, recognizedAuthorityId: polity.authority.id, effectiveControllerPolityId: polity.id, controlStatus: "sovereign", tributeToPolityId: null, covertPuppetSponsorPolityId: null, occupationStartYear: null, claimantAuthorityId: null, cityIdentityPreserved: true, physicalJurisdictionExists: true, annexed: false }];
    }));

    for (const history of authorityHistoryRows) {
      const city = source.cityById.get(history.cityId);
      const founder = actorRows.find((actor) => actor.id === history.foundingAuthorityActorId);
      const current = actorRows.find((actor) => actor.id === history.currentAuthorityActorId);
      eventRows.push({ id: `political-event:foundation:${history.cityId.slice(5)}`, kind: "sovereignFoundation", year: city.foundingYear, location: { cityId: city.cityId, cellId: city.cellId, corridorId: null }, participantActorIds: city.founderRows.map((row) => row.id), participantPolityIds: [history.polityId], prerequisites: ["fortifiedCityFoundationSucceeded"], cause: city.foundationCause, exactFactors: { foundingPopulation: city.foundingPopulation, founderCapabilities: city.founderRows.flatMap((row) => row.exceptionalCapabilities) }, outcome: "independentCityFounded", stateDelta: { sovereignPolityCreated: history.polityId, cityIdentityPreserved: true, createsState: false, annexation: false }, discoverableHooks: ["foundingCharter", "foundationAccounts"], publicAccount: `${founder.name} and the founding powers established ${city.cityName} as an independent fortified city.` });
      if (history.currentAccessionYear > city.foundingYear) eventRows.push({ id: `political-event:accession:${history.cityId.slice(5)}`, kind: "authorityAccession", year: history.currentAccessionYear, location: { cityId: city.cityId, cellId: city.cellId, corridorId: null }, participantActorIds: [current.id], participantPolityIds: [history.polityId], prerequisites: ["charterContinuity", "priorAuthorityEnded"], cause: "citySuccessionPrinciple", exactFactors: { routineSuccessionsSummarized: history.routineSuccessionCount, successionPrinciple: source.polityByCityId.get(city.cityId).successionPrinciple }, outcome: "currentAuthorityAcceded", stateDelta: { recognizedAuthorityId: current.id, sovereignPolityId: history.polityId, createsState: false, annexation: false }, discoverableHooks: ["accessionRecord", "charterArchive"], publicAccount: `${current.title} ${current.name} became the recognized sovereign authority of ${city.cityName}; ${history.routineSuccessionCount} routine transitions are summarized in its surviving civic record.` });
    }

    let campaignOrdinal = 1;
    for (const opportunity of campaignOpportunities(seed, strategicMap, source)) {
      const eventId = `political-event:campaign:${String(campaignOrdinal).padStart(3, "0")}`;
      campaignOrdinal += 1;
      const attackerPolity = source.polityByCityId.get(opportunity.attackerCityId);
      const defenderPolity = source.polityByCityId.get(opportunity.defenderCityId);
      const attackerPower = militaryPower(strategicMap, source, opportunity.attackerCityId) + integerBetween(seed, `attack-roll:${eventId}`, -35, 75);
      const defenderPower = militaryPower(strategicMap, source, opportunity.defenderCityId) + integerBetween(seed, `defense-roll:${eventId}`, -20, 65);
      const compact = warCompactFor(seed, strategicMap, source, eventId, opportunity, attackerPower);
      if (compact) warCompactRows.push(compact);
      const compactSupport = compact ? 38 : 0;
      const mercenaryContract = mercenaryContractFor(seed, strategicMap, eventId, opportunity.attackerCityId);
      const mercenarySupport = mercenaryContract ? 22 : 0;
      const margin = attackerPower + compactSupport + mercenarySupport - defenderPower;
      const defenderControl = controlByCityId.get(opportunity.defenderCityId);
      const attackerForeignHoldings = [...controlByCityId.values()].filter((row) => row.effectiveControllerPolityId === attackerPolity.id && row.sovereignPolityId !== attackerPolity.id && ["occupied", "puppet"].includes(row.controlStatus)).length;
      let outcome = margin < -25 ? "campaignRepelled" : margin < 15 ? "tributeImposed" : margin < 45 ? "puppetInstalled" : "occupationEstablished";
      if (attackerForeignHoldings >= 2 && ["puppetInstalled", "occupationEstablished"].includes(outcome)) outcome = "tributeImposed";
      let occupationCommander = null;
      if (outcome === "tributeImposed") {
        defenderControl.controlStatus = "tributary";
        defenderControl.tributeToPolityId = attackerPolity.id;
      } else if (outcome === "puppetInstalled") {
        defenderControl.controlStatus = "puppet";
        defenderControl.effectiveControllerPolityId = attackerPolity.id;
        defenderControl.covertPuppetSponsorPolityId = attackerPolity.id;
      } else if (outcome === "occupationEstablished") {
        occupationCommander = { id: `political-actor:occupation:${String(campaignOrdinal - 1).padStart(3, "0")}`, kind: "individual", name: generatedActorName(seed, `occupation-commander:${eventId}`), title: "Occupation Commander", cityId: opportunity.defenderCityId, role: "occupationCommander", exceptionalCapabilities: [], persistsToPlayableYear: false };
        actorRows.push(occupationCommander);
        defenderControl.controlStatus = "occupied";
        defenderControl.effectiveControllerPolityId = attackerPolity.id;
        defenderControl.occupationStartYear = opportunity.year;
        defenderControl.claimantAuthorityId = defenderPolity.authority.id;
      }
      eventRows.push({
        id: eventId,
        kind: "intercityCampaign",
        year: opportunity.year,
        location: { cityId: opportunity.defenderCityId, cellId: source.cityById.get(opportunity.defenderCityId).cellId, corridorId: opportunity.corridor.id },
        participantActorIds: [attackerPolity.authority.id, defenderPolity.authority.id, ...(occupationCommander ? [occupationCommander.id] : [])],
        participantPolityIds: [attackerPolity.id, defenderPolity.id],
        prerequisites: ["bothCitiesFounded", "physicallyFeasibleApproach", `corridorState:${routeStateAtYear(source, opportunity.corridor.id, opportunity.year)}`],
        cause: opportunity.relation?.grievances?.[0] || opportunity.relation?.posture || opportunity.corridor.relationshipAtConstruction,
        exactFactors: { attackerPower, defenderPower, compactSupport, mercenarySupport, margin, posture: opportunity.relation?.posture || "unrecorded" },
        outcome,
        physicalFeasibility: { mode: "survivingIntercityCorridor", corridorId: opportunity.corridor.id, corridorState: routeStateAtYear(source, opportunity.corridor.id, opportunity.year), exactCellPath: clone(opportunity.corridor.cellPath) },
        warCompactId: compact?.id || null,
        mercenaryContract,
        stateDelta: { targetCityId: opportunity.defenderCityId, sovereignPolityId: defenderPolity.id, effectiveControllerPolityId: defenderControl.effectiveControllerPolityId, controlStatus: defenderControl.controlStatus, tributeToPolityId: defenderControl.tributeToPolityId, occupationStartYear: defenderControl.occupationStartYear, cityIdentityPreserved: true, createsState: false, createsPermanentAlliance: false, annexation: false },
        discoverableHooks: ["campaignDispatches", "corridorStrongholdAccounts", mercenaryContract ? "mercenaryContractLedger" : "veteranTestimony"],
        publicAccount: `${attackerPolity.name}'s campaign against ${defenderPolity.name} ${publicOutcome(outcome)}. Neither city's sovereign identity was annexed.`
      });

      if (outcome !== "campaignRepelled" && opportunity.year + 8 < horizon && seededNumber(seed, `revolt:${eventId}`) < 0.4) {
        const revoltYear = Math.min(horizon - 1, opportunity.year + integerBetween(seed, `revolt-year:${eventId}`, 5, 24));
        const revoltPower = defenderPower + integerBetween(seed, `revolt-force:${eventId}`, -15, 65);
        const suppressPower = Math.floor(attackerPower * 0.72) + integerBetween(seed, `revolt-suppress:${eventId}`, -25, 45);
        const revoltOutcome = revoltPower >= suppressPower + 15 ? "sovereigntyRestored" : "revoltSuppressed";
        const rebelLeader = { id: `political-actor:revolt:${String(campaignOrdinal - 1).padStart(3, "0")}`, kind: "individual", name: generatedActorName(seed, `rebel-leader:${eventId}`), title: "Revolt Leader", cityId: opportunity.defenderCityId, role: "rebelLeader", exceptionalCapabilities: [], persistsToPlayableYear: false };
        actorRows.push(rebelLeader);
        if (revoltOutcome === "sovereigntyRestored") Object.assign(defenderControl, { controlStatus: "sovereign", effectiveControllerPolityId: defenderPolity.id, tributeToPolityId: null, covertPuppetSponsorPolityId: null, occupationStartYear: null, claimantAuthorityId: null });
        eventRows.push({ id: `political-event:revolt:${String(campaignOrdinal - 1).padStart(3, "0")}`, kind: "subjectRevolt", year: revoltYear, location: { cityId: opportunity.defenderCityId, cellId: source.cityById.get(opportunity.defenderCityId).cellId, corridorId: opportunity.corridor.id }, participantActorIds: [rebelLeader.id, defenderPolity.authority.id, attackerPolity.authority.id], participantPolityIds: [defenderPolity.id, attackerPolity.id], prerequisites: [`priorCampaign:${eventId}`, `subjectStatus:${outcome}`], cause: "resistanceToForeignControlOrObligation", exactFactors: { revoltPower, suppressPower, margin: revoltPower - suppressPower }, outcome: revoltOutcome, physicalFeasibility: { mode: "localUrbanRevolt", corridorId: opportunity.corridor.id, corridorState: routeStateAtYear(source, opportunity.corridor.id, revoltYear), exactCellPath: [source.cityById.get(opportunity.defenderCityId).cellId] }, stateDelta: { targetCityId: opportunity.defenderCityId, sovereignPolityId: defenderPolity.id, effectiveControllerPolityId: defenderControl.effectiveControllerPolityId, controlStatus: defenderControl.controlStatus, tributeToPolityId: defenderControl.tributeToPolityId, cityIdentityPreserved: true, createsState: false, createsPermanentAlliance: false, annexation: false }, discoverableHooks: ["rebelProclamations", "occupationRecords", "memorialSites"], publicAccount: `${rebelLeader.name} led resistance in ${defenderPolity.name}, which ${publicOutcome(revoltOutcome)} against ${attackerPolity.name}.` });
      }
    }

    for (const city of source.cities) {
      const destruction = destroyedAt(strategicMap, city.cityId);
      if (!destruction) continue;
      const polity = source.polityByCityId.get(city.cityId);
      const control = controlByCityId.get(city.cityId);
      const formerControlStatus = control.controlStatus;
      Object.assign(control, { controlStatus: "displacedClaim", effectiveControllerPolityId: null, physicalJurisdictionExists: false, tributeToPolityId: null, covertPuppetSponsorPolityId: null, occupationStartYear: null, claimantAuthorityId: polity.authority.id });
      eventRows.push({ id: `political-event:displacement:${city.cityId.slice(5)}`, kind: "claimantDisplacement", year: destruction.year, location: { cityId: city.cityId, cellId: city.cellId, corridorId: null }, participantActorIds: [polity.authority.id], participantPolityIds: [polity.id], prerequisites: [`crisisEvent:${destruction.id}`, "cityPhysicallyDestroyed"], cause: "ecologicalCityDestruction", exactFactors: { sourceCrisisEventId: destruction.id, formerControlStatus }, outcome: "charterSurvivesWithoutJurisdiction", stateDelta: { sovereignPolityId: polity.id, effectiveControllerPolityId: null, controlStatus: "displacedClaim", physicalJurisdictionExists: false, cityIdentityPreserved: true, createsState: false, annexation: false }, discoverableHooks: ["survivingCharter", "displacedClaimantBroadcast"], publicAccount: `${polity.name}'s physical jurisdiction was destroyed, but its charter and claimant identity survived.` });
    }

    eventRows.sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
    const currentControlRows = [...controlByCityId.values()].sort((a, b) => a.cityId.localeCompare(b.cityId));
    const publicChronology = eventRows.map((event) => ({ id: event.id, kind: event.kind, year: event.year, location: clone(event.location), participantPolityIds: clone(event.participantPolityIds), outcome: event.outcome, publicAccount: event.publicAccount, supportedPhysicalBasis: event.physicalFeasibility ? { mode: event.physicalFeasibility.mode, corridorId: event.physicalFeasibility.corridorId, corridorState: event.physicalFeasibility.corridorState } : null, discoverableHooks: clone(event.discoverableHooks), exactForceComparisonPublic: false }));
    const publicControlRows = currentControlRows.map((row) => ({ cityId: row.cityId, sovereignPolityId: row.sovereignPolityId, recognizedAuthorityId: row.recognizedAuthorityId, publicControlStatus: row.controlStatus === "puppet" ? "sovereign" : row.controlStatus, publiclyNamedControllerPolityId: row.controlStatus === "occupied" ? row.effectiveControllerPolityId : row.sovereignPolityId, tributeToPolityId: row.tributeToPolityId, physicalJurisdictionExists: row.physicalJurisdictionExists, cityIdentityPreserved: true, covertControlMayExist: true }));
    const publicDirectory = {
      historicalHorizonYear: horizon,
      knowledgePolicy: "supportedPoliticalChronologyWithCovertControlRedacted",
      chronology: publicChronology,
      currentAuthorityRows: authorityHistoryRows.map((row) => ({ cityId: row.cityId, polityId: row.polityId, authorityId: row.currentAuthorityActorId, accessionYear: row.currentAccessionYear, continuityModel: row.continuityModel, routineSuccessionsSummarized: row.routineSuccessionCount })),
      currentControlRows: publicControlRows,
      warCompactRows: warCompactRows.map((row) => ({ id: row.id, eventId: row.eventId, formationYear: row.formationYear, dissolutionYear: row.dissolutionYear, leadPolityId: row.leadPolityId, memberPolityIds: clone(row.memberPolityIds), finiteGoal: row.finiteGoal, dissolutionReason: row.dissolutionReason, permanentAlliance: false, createsSovereignty: false })),
      principles: { everyCityIdentityRemainsSovereign: true, conquestNeverCreatesStates: true, tributeIsNotSovereignty: true, physicalConnectivityIsNotAllegiance: true, compactsAreTemporary: true, exactForceAndCovertControlRemainHidden: true }
    };
    publicDirectory.digest = `public-political-history-${StrategicWorld.stableHash(coreWithoutDigest(publicDirectory))}`;
    const record = {
      historicalHorizonYear: horizon,
      sourceCityPolitiesDigest: strategicMap.cityPolities.digest,
      sourceCityExpansionDigest: strategicMap.cityExpansionHistory.digest,
      sourceCapabilityHistoryDigest: strategicMap.strategicCapabilityHistory.digest,
      sourceCityGovernmentsDigest: strategicMap.cityGovernments.digest,
      sourceNonStateNetworksDigest: strategicMap.strategicNonStateNetworks.digest,
      sourceCrisisHistoryDigest: strategicMap.strategicCrisisHistory.digest,
      publicDirectoryDigest: publicDirectory.digest,
      actorRows,
      authorityHistoryRows,
      eventRows,
      warCompactRows,
      currentControlRows,
      diagnostics: {
        namedActorCount: actorRows.length,
        retainedEventCount: eventRows.length,
        campaignCount: eventRows.filter((event) => event.kind === "intercityCampaign").length,
        revoltCount: eventRows.filter((event) => event.kind === "subjectRevolt").length,
        temporaryWarCompactCount: warCompactRows.length,
        occupiedCityCount: currentControlRows.filter((row) => row.controlStatus === "occupied").length,
        tributaryCityCount: currentControlRows.filter((row) => row.controlStatus === "tributary").length,
        covertPuppetCityCount: currentControlRows.filter((row) => row.controlStatus === "puppet").length,
        displacedClaimCount: currentControlRows.filter((row) => row.controlStatus === "displacedClaim").length,
        maximumForeignHoldings: Math.max(0, ...strategicMap.cityPolities.polities.map((polity) => currentControlRows.filter((row) => row.sovereignPolityId !== polity.id && row.effectiveControllerPolityId === polity.id && ["occupied", "puppet"].includes(row.controlStatus)).length))
      }
    };
    record.digest = `strategic-political-history-${StrategicWorld.stableHash(coreWithoutDigest(record))}`;
    return { strategicPoliticalHistory: record, publicDirectory };
  }

  function validateStrategicPoliticalHistory(map, record = map?.strategicPoliticalHistory, directory = map?.publicPoliticalHistoryDirectory) {
    const strategicMap = validateSources(map);
    if (!record || !directory || record.sourceCityPolitiesDigest !== strategicMap.cityPolities.digest || record.sourceCityExpansionDigest !== strategicMap.cityExpansionHistory.digest || record.sourceCapabilityHistoryDigest !== strategicMap.strategicCapabilityHistory.digest || record.sourceCityGovernmentsDigest !== strategicMap.cityGovernments.digest || record.sourceNonStateNetworksDigest !== strategicMap.strategicNonStateNetworks.digest || record.sourceCrisisHistoryDigest !== strategicMap.strategicCrisisHistory.digest || record.publicDirectoryDigest !== directory.digest) throw new Error("Strategic political history is incomplete or does not match its causal sources.");
    const source = sources(strategicMap);
    const polityIds = new Set(strategicMap.cityPolities.polities.map((polity) => polity.id));
    const actorIds = new Set(record.actorRows.map((actor) => actor.id));
    if (actorIds.size !== record.actorRows.length || record.actorRows.some((actor) => !source.cityById.has(actor.cityId) || !String(actor.name || "").trim())) throw new Error("Political-history actor identities are invalid.");
    if (record.authorityHistoryRows.length !== source.cities.length || record.authorityHistoryRows.some((row) => !actorIds.has(row.foundingAuthorityActorId) || !actorIds.has(row.currentAuthorityActorId) || row.implicitFounderLongevity || source.polityByCityId.get(row.cityId)?.authority.id !== row.currentAuthorityActorId)) throw new Error("Every city requires a causal authority chronology ending in its playable-year authority.");
    const eventIds = new Set();
    for (let index = 0; index < record.eventRows.length; index += 1) {
      const event = record.eventRows[index];
      if (eventIds.has(event.id) || !EVENT_KINDS.includes(event.kind) || !Number.isInteger(event.year) || event.year < 0 || event.year > record.historicalHorizonYear || (index && event.year < record.eventRows[index - 1].year) || !event.location?.cityId || !source.cityById.has(event.location.cityId) || !event.prerequisites?.length || !event.cause || !event.exactFactors || !event.stateDelta || event.stateDelta.createsState || event.stateDelta.annexation || event.participantActorIds.some((id) => !actorIds.has(id)) || event.participantPolityIds.some((id) => !polityIds.has(id))) throw new Error("A retained political event lacks stable actors, chronology, cause, or bounded consequences.");
      if (event.kind === "intercityCampaign" && (!CAMPAIGN_OUTCOMES.includes(event.outcome) || !event.physicalFeasibility?.corridorId || event.physicalFeasibility.corridorState === "severed" || !source.routeById.has(event.physicalFeasibility.corridorId) || !event.physicalFeasibility.exactCellPath?.length)) throw new Error("An intercity campaign is not physically feasible through saved geography.");
      eventIds.add(event.id);
    }
    if (record.currentControlRows.length !== source.cities.length || record.currentControlRows.some((row) => !source.cityById.has(row.cityId) || !polityIds.has(row.sovereignPolityId) || !CONTROL_STATUSES.includes(row.controlStatus) || !row.cityIdentityPreserved || row.annexed || (row.physicalJurisdictionExists && !row.effectiveControllerPolityId) || (row.effectiveControllerPolityId && !polityIds.has(row.effectiveControllerPolityId)))) throw new Error("Playable-year political control violates city sovereignty or identity.");
    if (record.diagnostics.maximumForeignHoldings > 2) throw new Error("A city cannot sustain an unbounded foreign empire.");
    for (const compact of record.warCompactRows) {
      if (!eventIds.has(compact.eventId) || compact.memberPolityIds.length < 2 || compact.memberPolityIds.some((id) => !polityIds.has(id)) || compact.dissolutionYear < compact.formationYear || compact.permanentAlliance || compact.createsSovereignty || compact.standingForceAfterDissolution) throw new Error("War compacts must be temporary, finite, and non-sovereign.");
      for (const member of compact.contributionRows) for (const contribution of member.contributions) if (!CONTRIBUTION_KINDS.includes(contribution.kind) || (contribution.capabilityId && !StrategicCapabilityHistory.cityHasCapability(strategicMap, member.cityId, contribution.capabilityId))) throw new Error("A war compact claims an unsupported contribution.");
    }
    const publicJson = JSON.stringify(directory);
    if (/exactFactors|attackerPower|defenderPower|revoltPower|suppressPower|margin|exactCellPath|covertPuppetSponsorPolityId|mercenarySupport/.test(publicJson)) throw new Error("Public political history leaks exact force comparisons, routes, or covert control.");
    if (directory.knowledgePolicy !== "supportedPoliticalChronologyWithCovertControlRedacted" || !directory.principles?.conquestNeverCreatesStates || directory.currentControlRows.some((row) => row.publicControlStatus === "puppet" || !row.cityIdentityPreserved)) throw new Error("The public political directory violates sovereignty or secrecy boundaries.");
    if (directory.digest !== `public-political-history-${StrategicWorld.stableHash(coreWithoutDigest(directory))}` || record.digest !== `strategic-political-history-${StrategicWorld.stableHash(coreWithoutDigest(record))}`) throw new Error("Strategic political history does not match its digest.");
    const diagnostics = record.diagnostics;
    if (diagnostics.namedActorCount !== record.actorRows.length || diagnostics.retainedEventCount !== record.eventRows.length || diagnostics.campaignCount !== record.eventRows.filter((event) => event.kind === "intercityCampaign").length || diagnostics.temporaryWarCompactCount !== record.warCompactRows.length) throw new Error("Political-history diagnostics do not match saved facts.");
    return { strategicPoliticalHistory: clone(record), publicDirectory: clone(directory) };
  }

  function attachStrategicPoliticalHistory(worldSeed, map) {
    const next = clone(map);
    const generated = createStrategicPoliticalHistory(worldSeed, next);
    next.strategicPoliticalHistory = generated.strategicPoliticalHistory;
    next.publicPoliticalHistoryDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function publicPoliticalHistory(map) {
    if (!map?.publicPoliticalHistoryDirectory) return null;
    const directory = clone(map.publicPoliticalHistoryDirectory);
    const polityById = new Map(map.cityPolities.polities.map((polity) => [polity.id, polity]));
    const cityById = new Map(StrategicCityExpansion.allCitySeeds(map).map((city) => [city.cityId, { id: city.cityId, name: city.cityName, cellId: city.cellId }]));
    directory.currentAuthorityRows = directory.currentAuthorityRows.map((row) => ({ ...row, city: clone(cityById.get(row.cityId)), polity: clone(polityById.get(row.polityId)), authority: clone(polityById.get(row.polityId)?.authority) }));
    directory.currentControlRows = directory.currentControlRows.map((row) => ({ ...row, city: clone(cityById.get(row.cityId)), sovereignPolity: clone(polityById.get(row.sovereignPolityId)), publiclyNamedController: clone(polityById.get(row.publiclyNamedControllerPolityId)) }));
    directory.chronology = directory.chronology.map((event) => ({ ...event, city: clone(cityById.get(event.location.cityId)), participantPolities: event.participantPolityIds.map((id) => clone(polityById.get(id))) }));
    return directory;
  }

  function auditStrategicPoliticalHistory(map) {
    const { strategicPoliticalHistory: record, publicDirectory } = validateStrategicPoliticalHistory(map);
    return {
      valid: true,
      sourceHistoryImmutable: record.sourceCityExpansionDigest === map.cityExpansionHistory.digest && record.sourceCrisisHistoryDigest === map.strategicCrisisHistory.digest,
      currentAuthoritiesPreserved: record.authorityHistoryRows.every((row) => map.cityPolities.polities.find((polity) => polity.cityId === row.cityId)?.authority.id === row.currentAuthorityActorId),
      noImplicitImmortality: record.authorityHistoryRows.every((row) => !row.implicitFounderLongevity),
      campaignsPhysicallyFeasible: record.eventRows.filter((event) => event.kind === "intercityCampaign").every((event) => event.physicalFeasibility?.corridorState !== "severed" && event.physicalFeasibility?.exactCellPath.length),
      conquestNeverCreatesStates: record.eventRows.every((event) => !event.stateDelta.createsState && !event.stateDelta.annexation) && record.currentControlRows.every((row) => row.cityIdentityPreserved && !row.annexed),
      compactsTemporaryAndNonSovereign: record.warCompactRows.every((row) => row.dissolutionYear >= row.formationYear && !row.permanentAlliance && !row.createsSovereignty && !row.standingForceAfterDissolution),
      foreignHoldingsBounded: record.diagnostics.maximumForeignHoldings <= 2,
      publicHistoryHidesExactForceAndCovertControl: !JSON.stringify(publicDirectory).match(/exactFactors|attackerPower|defenderPower|revoltPower|suppressPower|margin|exactCellPath|covertPuppetSponsorPolityId|mercenarySupport/),
      diagnostics: clone(record.diagnostics)
    };
  }

  return Object.freeze({ EVENT_KINDS, CAMPAIGN_OUTCOMES, CONTROL_STATUSES, CONTRIBUTION_KINDS, createStrategicPoliticalHistory, validateStrategicPoliticalHistory, attachStrategicPoliticalHistory, publicPoliticalHistory, auditStrategicPoliticalHistory });
});
