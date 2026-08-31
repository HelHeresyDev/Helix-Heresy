(function initStrategicNonStateNetworkHistory(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const strategicNetworks = typeof module === "object" && module.exports ? require("./strategic-non-state-networks") : root?.HelixStrategicNonStateNetworks;
  const strategicCapabilities = typeof module === "object" && module.exports ? require("./strategic-capability-history") : root?.HelixStrategicCapabilityHistory;
  const strategicExpansion = typeof module === "object" && module.exports ? require("./strategic-city-expansion") : root?.HelixStrategicCityExpansion;
  const api = factory(strategicWorld, strategicNetworks, strategicCapabilities, strategicExpansion);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicNonStateNetworkHistory = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicNonStateNetworkHistoryApi(StrategicWorld, StrategicNetworks, StrategicCapabilities, StrategicExpansion) {
  "use strict";

  if (!StrategicWorld || !StrategicNetworks || !StrategicCapabilities || !StrategicExpansion) throw new Error("Strategic world, network, capability, and expansion modules must load before strategic-non-state-network-history.js");

  const NETWORK_LIFECYCLES = Object.freeze(["active", "diminished", "dormant", "defunct"]);
  const BRANCH_CONDITIONS = Object.freeze(["intact", "worn", "damaged", "destroyed"]);
  const BRANCH_STATUSES = Object.freeze(["active", "reduced", "relocated", "consolidated", "dormant", "defunct"]);
  const COVERT_STATUSES = Object.freeze(["active", "dormant", "destroyed", "defunct"]);
  const AFFILIATE_STATUSES = Object.freeze(["active", "separated", "defunct"]);
  const EVENT_KINDS = Object.freeze(["networkFounded", "advancedServiceActivated", "branchDamaged", "branchRelocated", "branchConsolidated", "branchLost", "standingChanged", "capacityChanged", "religiousCollaboration", "religiousConflict", "affiliateExposed", "misconductExposed", "institutionalCollapse"]);
  const CAPACITY_BANDS = Object.freeze(["nominal", "limited", "functional", "strong", "regionalHub"]);
  const RELIABILITY_BANDS = Object.freeze(["unreliable", "intermittent", "scheduled", "dependable"]);
  const INTEGRITY_BANDS = StrategicNetworks.CAPABILITY_BANDS;
  const CORE_CAPABILITIES = Object.freeze({
    commercial: Object.freeze(["industrialFabrication", "regionalDataRelays"]),
    research: Object.freeze(["industrialFabrication", "regionalDataRelays"]),
    military: Object.freeze(["fortifiedCivicWorks", "flyingMountInfrastructure"]),
    transport: Object.freeze(["flyingMountInfrastructure", "regionalDataRelays"]),
    media: Object.freeze(["holographicSystems", "globalDataProtocols"]),
    blackMarket: Object.freeze(["industrialFabrication", "regionalDataRelays"]),
    standards: Object.freeze(["industrialFabrication", "globalDataProtocols"])
  });
  const MISCONDUCT_KINDS = Object.freeze(["misappropriatedAssets", "fabricatedServiceClaims", "undisclosedConflicts", "dangerousProtocolEvasion", "coerciveContracting", "concealedServiceFailure"]);

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function seededNumber(seed, channel) { return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff; }
  function integerBetween(seed, channel, minimum, maximum) { return minimum >= maximum ? minimum : minimum + Math.floor(seededNumber(seed, channel) * (maximum - minimum + 1)); }
  function pick(values, seed, channel) { return values[Math.floor(seededNumber(seed, channel) * values.length) % values.length]; }
  function shiftBand(values, value, delta) { return values[Math.max(0, Math.min(values.length - 1, values.indexOf(value) + delta))]; }
  function coreWithoutDigest(value) { const core = clone(value); delete core.digest; return core; }

  function validateSources(map) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicNetworks.validateStrategicNonStateNetworks(strategicMap);
    StrategicCapabilities.validateStrategicCapabilityHistory(strategicMap);
    if (!strategicMap.strategicCrisisHistory || !strategicMap.strategicPoliticalHistory || !strategicMap.strategicCivicHistory || !strategicMap.strategicPlayableSettlementState || !strategicMap.strategicReligiousInstitutionHistory) throw new Error("Network history requires crisis, political, civic, playable-settlement, and religious-institution history.");
    return strategicMap;
  }

  function publicAccount(kind, subject, cityName, detail) {
    const place = cityName ? ` in ${cityName}` : "";
    const accounts = {
      networkFounded: `${subject} entered the retained intercity record${place} once its core services and communications were supportable.`,
      advancedServiceActivated: `${subject} publicly activated ${detail}${place} after the required infrastructure became available.`,
      branchDamaged: `${subject}${place} reported damaged premises and reduced local service after a retained crisis.`,
      branchRelocated: `${subject} evacuated personnel and essential records from ${detail} through a physically supported transfer.`,
      branchConsolidated: `${subject} consolidated a displaced operation into an existing host-city branch${place}.`,
      branchLost: `${subject}${place} lost its functioning public premises.`,
      standingChanged: `${subject}${place} received a revised city standing through a published local decision.`,
      capacityChanged: `${subject}${place} reported a consequential change in local service capacity.`,
      religiousCollaboration: `${subject}${place} entered a publicly acknowledged, locally bounded collaboration with a religious institution.`,
      religiousConflict: `${subject}${place} entered a documented institutional conflict with a religious institution.`,
      affiliateExposed: `${subject}${place} became publicly connected to a previously opaque affiliate after supported records were disclosed.`,
      misconductExposed: `${subject}${place} became the subject of a supported institutional-misconduct finding.`,
      institutionalCollapse: `${subject} ceased viable operations after a retained institutional collapse; its historical record remains available.`
    };
    return accounts[kind] || `${subject}${place} changed through retained history.`;
  }

  function createStrategicNonStateNetworkHistory(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for non-state network history.");
    const strategicMap = validateSources(map);
    const horizon = strategicMap.cityExpansionHistory.historicalHorizonYear;
    const baseline = StrategicNetworks.publicNonStateNetworkDirectory(strategicMap);
    const cities = StrategicExpansion.allCitySeeds(strategicMap);
    const cityById = new Map(cities.map((city) => [city.cityId, city]));
    const cityName = (cityId) => cityById.get(cityId)?.cityName || cityId;
    const capabilityById = new Map(strategicMap.strategicCapabilityHistory.milestoneRows.map((row) => [row.capabilityId, row]));
    const networkById = new Map(baseline.networks.map((network) => [network.id, network]));
    const originalStandingByKey = new Map();
    baseline.networks.forEach((network) => baseline.cityOrder.forEach((cityId) => {
      const profile = StrategicNetworks.cityNetworkProfile(strategicMap, cityId);
      originalStandingByKey.set(`${cityId}|${network.id}`, profile.standings.find((entry) => entry.network.id === network.id).standing);
    }));

    const networkRows = baseline.networks.map((network) => {
      const capabilities = CORE_CAPABILITIES[network.category];
      const prerequisiteYear = Math.max(...capabilities.map((id) => capabilityById.get(id).standardizationYear));
      const originYear = cityById.get(network.originCity.id)?.foundingYear || 0;
      const foundingYear = Math.min(horizon, Math.max(originYear, prerequisiteYear) + integerBetween(seed, `network-founding-delay:${network.id}`, 0, 6));
      const hidden = StrategicNetworks.hiddenNetworkStateFor(strategicMap, network.id);
      return {
        id: `network-history:${network.id}`, networkId: network.id, name: network.name, category: network.category,
        originCityId: network.originCity.id, foundingYear, coreCapabilityIds: clone(capabilities),
        lifecycleStatus: "active", publicLifecycleStatus: "active", actualCapacityBand: hidden.actualCapacityBand,
        integrityBand: hidden.institutionalIntegrityBand, privatePriority: hidden.privatePriority,
        organizationalContinuity: true, sovereignAuthority: false, automaticEnforcementAuthority: false,
        guaranteesLongRangeMaterialSupport: false, sourceDefinitionId: network.themeContent.definitionId
      };
    });
    const historyByNetworkId = new Map(networkRows.map((row) => [row.networkId, row]));

    const branchRows = baseline.branches.map((branch) => {
      const city = cityById.get(branch.cityId);
      const network = historyByNetworkId.get(branch.networkId);
      const foundingYear = Math.min(horizon, Math.max(network.foundingYear, city?.foundingYear || 0) + integerBetween(seed, `branch-founding:${branch.id}`, 0, 12));
      return {
        id: branch.id, networkId: branch.networkId, originalCityId: branch.cityId, currentCityId: branch.cityId,
        foundingYear, foundingCause: "foundingBaselineExpansion", sourceBaselineBranchId: branch.id,
        publicName: branch.publicName, organizationForm: branch.organizationForm,
        originalStanding: branch.standing, currentStanding: branch.standing,
        originalCapacityBand: branch.capacityBand, currentCapacityBand: branch.capacityBand,
        originalServiceReliability: branch.serviceReliability, currentServiceReliability: branch.serviceReliability,
        physicalCondition: "intact", operationalStatus: "active", publicPhysicalPresence: true,
        consolidatedIntoBranchId: null, mergedLineageBranchIds: [], integrityBand: historyByNetworkId.get(branch.networkId).integrityBand,
        sovereignAuthority: false, enforcementAuthority: false, longRangeDeliveryGuaranteed: false,
        physicalScope: "thisCityAndContractedLocalAssetsOnly"
      };
    });
    const branchById = new Map(branchRows.map((branch) => [branch.id, branch]));

    const covertRows = [];
    for (const network of baseline.networks) {
      const history = historyByNetworkId.get(network.id);
      const hidden = StrategicNetworks.hiddenNetworkStateFor(strategicMap, network.id);
      hidden.covertCells.forEach((cell, ordinal) => {
        const city = cityById.get(cell.cityId);
        covertRows.push({
          id: `network-covert-history:${network.id}:${String(ordinal + 1).padStart(2, "0")}`, networkId: network.id,
          cityId: cell.cityId, kind: cell.kind, foundingYear: Math.min(horizon, Math.max(history.foundingYear, city?.foundingYear || 0) + integerBetween(seed, `covert-founding:${network.id}:${cell.cityId}`, 1, 18)),
          status: "active", publiclyConfirmed: false, publicSuspicion: "none", integrityBand: history.integrityBand
        });
      });
    }

    const affiliateRows = baseline.affiliates.map((affiliate) => {
      const ownerId = affiliate.disclosedParentNetworkId || baseline.networks.find((network) => affiliate.registeredName.startsWith(network.name.split(" ").slice(0, 2).join(" ")))?.id || null;
      const network = historyByNetworkId.get(ownerId) || networkRows[Math.floor(seededNumber(seed, `affiliate-owner:${affiliate.id}`) * networkRows.length) % networkRows.length];
      const city = cityById.get(affiliate.registrationCityId);
      return {
        id: affiliate.id, registeredName: affiliate.registeredName, registrationCityId: affiliate.registrationCityId,
        declaredActivity: affiliate.declaredActivity, formationYear: Math.min(horizon, Math.max(network.foundingYear, city?.foundingYear || 0) + integerBetween(seed, `affiliate-founding:${affiliate.id}`, 1, 20)),
        lifecycleStatus: "active", ownershipDisclosure: affiliate.ownershipDisclosure,
        disclosedParentNetworkId: affiliate.disclosedParentNetworkId, actualParentNetworkId: network.networkId,
        hiddenPurpose: strategicMap.strategicNonStateNetworks.hiddenAffiliatePurposeCodes[baseline.affiliates.indexOf(affiliate)],
        playerOrOriginalScientistOwned: false
      };
    });

    const relationshipRows = baseline.relationships.map((relationship) => ({
      id: relationship.id, networkIds: clone(relationship.networkIds), relation: relationship.relation,
      establishedYear: Math.min(horizon, Math.max(...relationship.networkIds.map((id) => historyByNetworkId.get(id).foundingYear)) + integerBetween(seed, `relation-founding:${relationship.id}`, 1, 14)),
      currentStatus: "active", createsSovereignty: false, guaranteesMaterialSupport: false
    }));

    const eventRows = [];
    function addEvent(details) {
      const event = {
        id: `network-history-event:${String(eventRows.length + 1).padStart(4, "0")}`, kind: details.kind, year: details.year,
        networkIds: clone(details.networkIds || []), branchIds: clone(details.branchIds || []), affiliateIds: clone(details.affiliateIds || []),
        cityId: details.cityId || null, cellId: details.cityId ? cityById.get(details.cityId)?.cellId || null : null,
        sourceLayer: details.sourceLayer, sourceEventId: details.sourceEventId || null, prerequisites: clone(details.prerequisites || []),
        cause: details.cause, exactFactors: clone(details.exactFactors || {}), stateDeltas: clone(details.stateDeltas || []),
        publiclyKnown: Boolean(details.publiclyKnown), publicConfidence: details.publicConfidence || "confirmed",
        publicEvidence: clone(details.publicEvidence || []), publicAccount: details.publicAccount || ""
      };
      eventRows.push(event);
      return event;
    }

    for (const network of networkRows) addEvent({
      kind: "networkFounded", year: network.foundingYear, networkIds: [network.networkId], cityId: network.originCityId,
      sourceLayer: "capabilityHistory", prerequisites: network.coreCapabilityIds.map((id) => `capability:${id}:${capabilityById.get(id).standardizationYear}`).concat(`cityFounded:${network.originCityId}`),
      cause: "coreCapabilitiesAndOriginInstitutionAvailable", exactFactors: { coreCapabilityIds: clone(network.coreCapabilityIds), originCityId: network.originCityId },
      stateDeltas: [{ networkId: network.networkId, lifecycleStatus: "active" }], publiclyKnown: true,
      publicEvidence: ["networkCharter", "datedServiceRecords"], publicAccount: publicAccount("networkFounded", network.name, cityName(network.originCityId))
    });

    for (const network of networkRows.filter((row) => networkById.get(row.networkId).orbitalRoles.length)) {
      const capabilityId = network.category === "transport" ? "rocketSpaceflight" : "orbitalArcaneRelayMesh";
      const year = Math.max(network.foundingYear, capabilityById.get(capabilityId).standardizationYear);
      addEvent({ kind: "advancedServiceActivated", year, networkIds: [network.networkId], cityId: network.originCityId,
        sourceLayer: "capabilityHistory", prerequisites: [`networkFounded:${network.networkId}`, `capability:${capabilityId}:${year}`], cause: "advancedInfrastructureAvailable",
        exactFactors: { capabilityId, orbitalRoles: clone(networkById.get(network.networkId).orbitalRoles) }, stateDeltas: [{ networkId: network.networkId, activatedService: capabilityId }],
        publiclyKnown: true, publicEvidence: ["serviceRegistry", "infrastructureCommissioningRecord"], publicAccount: publicAccount("advancedServiceActivated", network.name, cityName(network.originCityId), networkById.get(network.networkId).orbitalRoles.join(", ")) });
    }

    function branchesAt(cityId, year) { return branchRows.filter((branch) => branch.currentCityId === cityId && branch.foundingYear <= year && !["defunct", "consolidated"].includes(branch.operationalStatus)); }
    function relocationHost(originCityId, year) {
      const movementAvailable = ["flyingMountInfrastructure", "poweredAircraft"].some((id) => capabilityById.get(id).standardizationYear <= year);
      if (!movementAvailable) return null;
      const displacement = strategicMap.strategicPlayableSettlementState.displacementRows.find((row) => row.originAssetId === originCityId && strategicMap.strategicCrisisHistory.eventRows.find((event) => event.id === row.sourceEventId)?.year === year);
      return displacement?.admissions?.find((entry) => entry.admittedPopulation > 0 && cityById.get(entry.cityId)?.foundingYear <= year)?.cityId || null;
    }

    const actions = [];
    for (const event of strategicMap.strategicCrisisHistory.eventRows) {
      const cityDelta = event.stateDelta.infrastructureDeltas.find((delta) => delta.kind === "sovereignCity");
      if (cityDelta) actions.push({ kind: "crisis", year: event.year, priority: 0, event, cityId: cityDelta.assetId, resultingState: cityDelta.resultingState });
    }
    for (const event of strategicMap.strategicPoliticalHistory.eventRows.filter((entry) => ["intercityCampaign", "subjectRevolt"].includes(entry.kind))) actions.push({ kind: "political", year: event.year, priority: 1, event, cityId: event.location.cityId });
    for (const event of strategicMap.strategicCivicHistory.eventRows) actions.push({ kind: "civic", year: event.year, priority: 2, event, cityId: event.cityId });
    for (const event of strategicMap.strategicReligiousInstitutionHistory.eventRows.filter((entry) => entry.publiclyKnown && ["branchReestablished", "divineCensure", "misconduct", "standingChanged"].includes(entry.kind))) actions.push({ kind: "religious", year: event.year, priority: 3, event, cityId: event.cityId });
    for (const network of networkRows.filter((row) => INTEGRITY_BANDS.indexOf(row.integrityBand) <= 1)) actions.push({ kind: "misconduct", year: integerBetween(seed, `network-misconduct-year:${network.networkId}`, Math.min(horizon, network.foundingYear + 1), horizon), priority: 4, networkId: network.networkId });
    actions.sort((left, right) => left.year - right.year || left.priority - right.priority || String(left.event?.id || left.networkId).localeCompare(String(right.event?.id || right.networkId)));

    for (const action of actions) {
      if (action.kind === "crisis") {
        const affected = branchesAt(action.cityId, action.year);
        if (!affected.length || !["damaged", "destroyed"].includes(action.resultingState)) continue;
        const hostId = action.resultingState === "destroyed" ? relocationHost(action.cityId, action.year) : null;
        for (const branch of affected) {
          if (action.resultingState === "damaged") {
            branch.physicalCondition = "damaged"; branch.operationalStatus = "reduced";
            branch.currentCapacityBand = shiftBand(CAPACITY_BANDS, branch.currentCapacityBand, -1);
            branch.currentServiceReliability = shiftBand(RELIABILITY_BANDS, branch.currentServiceReliability, -1);
            addEvent({ kind: "branchDamaged", year: action.year, networkIds: [branch.networkId], branchIds: [branch.id], cityId: action.cityId,
              sourceLayer: "crisisHistory", sourceEventId: action.event.id, prerequisites: [action.event.id, "physicalLocalPremises"], cause: action.event.kind,
              exactFactors: { resultingInfrastructureState: action.resultingState }, stateDeltas: [{ branchId: branch.id, physicalCondition: branch.physicalCondition, operationalStatus: branch.operationalStatus }],
              publiclyKnown: true, publicEvidence: ["visiblePremisesDamage", "serviceNotice"], publicAccount: publicAccount("branchDamaged", branch.publicName, cityName(action.cityId)) });
          } else if (hostId) {
            const destination = branchRows.find((candidate) => candidate.networkId === branch.networkId && candidate.currentCityId === hostId && candidate.id !== branch.id && !["defunct", "consolidated"].includes(candidate.operationalStatus));
            branch.physicalCondition = "destroyed"; branch.currentStanding = null;
            if (destination) {
              branch.operationalStatus = "consolidated"; branch.publicPhysicalPresence = false; branch.consolidatedIntoBranchId = destination.id;
              destination.mergedLineageBranchIds.push(branch.id); destination.currentCapacityBand = shiftBand(CAPACITY_BANDS, destination.currentCapacityBand, 1);
              addEvent({ kind: "branchConsolidated", year: action.year, networkIds: [branch.networkId], branchIds: [branch.id, destination.id], cityId: hostId,
                sourceLayer: "crisisHistory", sourceEventId: action.event.id, prerequisites: [action.event.id, `displacementAdmission:${hostId}`, "contemporaryTransportCapability", `existingHostBranch:${destination.id}`], cause: "crisisEvacuationAndHostBranchMerger",
                exactFactors: { originCityId: action.cityId, hostCityId: hostId }, stateDeltas: [{ branchId: branch.id, operationalStatus: "consolidated" }, { branchId: destination.id, mergedLineageBranchId: branch.id }],
                publiclyKnown: true, publicEvidence: ["evacuationManifest", "hostBranchRegistry"], publicAccount: publicAccount("branchConsolidated", branch.publicName, cityName(hostId)) });
            } else {
              branch.currentCityId = hostId; branch.operationalStatus = "relocated"; branch.publicPhysicalPresence = true;
              addEvent({ kind: "branchRelocated", year: action.year, networkIds: [branch.networkId], branchIds: [branch.id], cityId: hostId,
                sourceLayer: "crisisHistory", sourceEventId: action.event.id, prerequisites: [action.event.id, `displacementAdmission:${hostId}`, "contemporaryTransportCapability"], cause: "crisisEvacuation",
                exactFactors: { originCityId: action.cityId, hostCityId: hostId }, stateDeltas: [{ branchId: branch.id, currentCityId: hostId, operationalStatus: "relocated", originalPremises: "destroyed" }],
                publiclyKnown: true, publicEvidence: ["evacuationManifest", "temporaryPremisesNotice"], publicAccount: publicAccount("branchRelocated", branch.publicName, cityName(hostId), cityName(action.cityId)) });
            }
          } else {
            branch.physicalCondition = "destroyed"; branch.operationalStatus = "defunct"; branch.currentStanding = null; branch.publicPhysicalPresence = false;
            addEvent({ kind: "branchLost", year: action.year, networkIds: [branch.networkId], branchIds: [branch.id], cityId: action.cityId,
              sourceLayer: "crisisHistory", sourceEventId: action.event.id, prerequisites: [action.event.id, "noFeasibleRecordedEvacuation"], cause: action.event.kind,
              exactFactors: { resultingInfrastructureState: action.resultingState, relocationHostId: null }, stateDeltas: [{ branchId: branch.id, physicalCondition: "destroyed", operationalStatus: "defunct" }],
              publiclyKnown: true, publicEvidence: ["destroyedPremises", "cessationNotice"], publicAccount: publicAccount("branchLost", branch.publicName, cityName(action.cityId)) });
          }
        }
        for (const cell of covertRows.filter((row) => row.cityId === action.cityId && row.foundingYear <= action.year)) cell.status = action.resultingState === "destroyed" ? "destroyed" : "dormant";
      } else if (action.kind === "political") {
        const affected = branchesAt(action.cityId, action.year);
        if (!affected.length) continue;
        if (action.event.kind === "intercityCampaign" && action.event.stateDelta.controlStatus === "occupied") {
          const branch = [...affected].sort((left, right) => seededNumber(seed, `occupation-network:${action.event.id}:${left.id}`) - seededNumber(seed, `occupation-network:${action.event.id}:${right.id}`))[0];
          const favorable = ["commercial", "military", "transport"].includes(historyByNetworkId.get(branch.networkId).category);
          branch.currentStanding = favorable ? "licensed" : "restricted";
          addEvent({ kind: "standingChanged", year: action.year, networkIds: [branch.networkId], branchIds: [branch.id], cityId: action.cityId,
            sourceLayer: "politicalHistory", sourceEventId: action.event.id, prerequisites: [action.event.id, "overtOccupationAdministration"], cause: favorable ? "occupationSponsorship" : "occupationRestriction",
            exactFactors: { controllerPolityId: action.event.stateDelta.effectiveControllerPolityId, favorable }, stateDeltas: [{ branchId: branch.id, currentStanding: branch.currentStanding }],
            publiclyKnown: true, publicEvidence: ["occupationRegistry", "publishedStanding"], publicAccount: publicAccount("standingChanged", branch.publicName, cityName(action.cityId)) });
        } else if (action.event.kind === "subjectRevolt" && action.event.outcome === "sovereigntyRestored") {
          const changed = affected.filter((branch) => branch.currentStanding !== originalStandingByKey.get(`${branch.originalCityId}|${branch.networkId}`));
          changed.forEach((branch) => { branch.currentStanding = originalStandingByKey.get(`${branch.originalCityId}|${branch.networkId}`); });
          if (!changed.length) continue;
          addEvent({ kind: "standingChanged", year: action.year, networkIds: [...new Set(changed.map((branch) => branch.networkId))], branchIds: changed.map((branch) => branch.id), cityId: action.cityId,
            sourceLayer: "politicalHistory", sourceEventId: action.event.id, prerequisites: [action.event.id, "sovereigntyRestored"], cause: "postOccupationNetworkReview",
            exactFactors: { restoredLocalStandingBaselines: true }, stateDeltas: changed.map((branch) => ({ branchId: branch.id, currentStanding: branch.currentStanding })), publiclyKnown: true,
            publicEvidence: ["restoredCityRegistry"], publicAccount: publicAccount("standingChanged", `${changed.length} local network branches`, cityName(action.cityId)) });
        }
      } else if (action.kind === "civic") {
        const affected = branchesAt(action.cityId, action.year);
        const adverse = ["crisisInstitutionalDamage", "tributeAusterity", "occupationAdministration", "revoltDisruption", "institutionalDisplacement"].includes(action.event.kind);
        const restorative = ["emergencyReform", "charterRestoration"].includes(action.event.kind);
        const delta = adverse ? -1 : restorative ? 1 : 0;
        if (!affected.length || !delta) continue;
        affected.forEach((branch) => {
          branch.currentCapacityBand = shiftBand(CAPACITY_BANDS, branch.currentCapacityBand, delta);
          branch.currentServiceReliability = shiftBand(RELIABILITY_BANDS, branch.currentServiceReliability, delta);
          if (delta < 0 && branch.operationalStatus === "active") branch.operationalStatus = "reduced";
        });
        addEvent({ kind: "capacityChanged", year: action.year, networkIds: [...new Set(affected.map((branch) => branch.networkId))], branchIds: affected.map((branch) => branch.id), cityId: action.cityId,
          sourceLayer: "civicHistory", sourceEventId: action.event.id, prerequisites: [action.event.id, "dependenceOnLocalCivicServices"], cause: action.event.kind,
          exactFactors: { capacityShift: delta, affectedCivicInstitutionIds: action.event.affectedInstitutionIds }, stateDeltas: affected.map((branch) => ({ branchId: branch.id, currentCapacityBand: branch.currentCapacityBand, currentServiceReliability: branch.currentServiceReliability })),
          publiclyKnown: true, publicEvidence: ["publicServiceRecord", "branchServiceNotice"], publicAccount: publicAccount("capacityChanged", `${affected.length} local network branches`, cityName(action.cityId)) });
      } else if (action.kind === "religious") {
        const candidates = branchesAt(action.cityId, action.year);
        if (!candidates.length) continue;
        const branch = [...candidates].sort((left, right) => seededNumber(seed, `religious-network:${action.event.id}:${left.id}`) - seededNumber(seed, `religious-network:${action.event.id}:${right.id}`))[0];
        const conflict = ["divineCensure", "misconduct", "standingChanged"].includes(action.event.kind) && ["media", "blackMarket", "standards"].includes(historyByNetworkId.get(branch.networkId).category);
        addEvent({ kind: conflict ? "religiousConflict" : "religiousCollaboration", year: action.year, networkIds: [branch.networkId], branchIds: [branch.id], cityId: action.cityId,
          sourceLayer: "religiousInstitutionHistory", sourceEventId: action.event.id, prerequisites: [action.event.id, `colocatedNetworkBranch:${branch.id}`], cause: conflict ? "documentedInstitutionalDispute" : "sharedLocalServiceNeed",
          exactFactors: { religiousBranchIds: clone(action.event.branchIds), relationshipDoesNotModifyReligiousHistory: true }, stateDeltas: [{ branchId: branch.id, religiousRelationship: conflict ? "conflict" : "collaboration" }],
          publiclyKnown: true, publicEvidence: ["jointOrOpposedPublicStatement", "localInstitutionalRecord"], publicAccount: publicAccount(conflict ? "religiousConflict" : "religiousCollaboration", branch.publicName, cityName(action.cityId)) });
      } else if (action.kind === "misconduct") {
        const network = historyByNetworkId.get(action.networkId);
        if (!network || network.foundingYear > action.year) continue;
        const exposed = seededNumber(seed, `network-misconduct-exposed:${network.networkId}`) < 0.55;
        network.integrityBand = INTEGRITY_BANDS[0];
        const misconduct = pick(MISCONDUCT_KINDS, seed, `network-misconduct-kind:${network.networkId}`);
        addEvent({ kind: "misconductExposed", year: action.year, networkIds: [network.networkId], sourceLayer: "institutionalIntegrity",
          prerequisites: [`networkFounded:${network.networkId}`, "institutionalOpportunity"], cause: misconduct,
          exactFactors: { concealedBeforeExposure: true, exposureRoll: seededNumber(seed, `network-misconduct-exposed:${network.networkId}`) }, stateDeltas: [{ networkId: network.networkId, integrityBand: network.integrityBand }],
          publiclyKnown: exposed, publicConfidence: exposed ? "supported" : "unknown", publicEvidence: exposed ? ["auditedRecords", "corroboratedTestimony"] : [],
          publicAccount: exposed ? publicAccount("misconductExposed", network.name, null) : "" });
        const collapse = seededNumber(seed, `network-collapse:${network.networkId}`) < 0.2;
        if (collapse && action.year < horizon) {
          const branches = branchRows.filter((branch) => branch.networkId === network.networkId && !["defunct", "consolidated"].includes(branch.operationalStatus));
          const cells = covertRows.filter((cell) => cell.networkId === network.networkId && !["destroyed", "defunct"].includes(cell.status));
          branches.forEach((branch) => { branch.operationalStatus = "defunct"; branch.publicPhysicalPresence = false; branch.currentStanding = null; });
          cells.forEach((cell) => { cell.status = "defunct"; });
          network.lifecycleStatus = "defunct"; network.publicLifecycleStatus = exposed ? "defunct" : "dormant"; network.organizationalContinuity = false;
          addEvent({ kind: "institutionalCollapse", year: action.year + 1, networkIds: [network.networkId], branchIds: branches.map((branch) => branch.id), sourceLayer: "networkHistory", sourceEventId: eventRows[eventRows.length - 1].id,
            prerequisites: [eventRows[eventRows.length - 1].id, "noViableOrganizationalContinuity"], cause: "integrityFailureAndServiceCollapse",
            exactFactors: { covertCellsLost: cells.length, publicBranchesLost: branches.length }, stateDeltas: [{ networkId: network.networkId, lifecycleStatus: "defunct", organizationalContinuity: false }],
            publiclyKnown: exposed, publicConfidence: exposed ? "confirmed" : "uncertain", publicEvidence: exposed ? ["closureNotices", "failedAuthenticationRecords"] : [], publicAccount: exposed ? publicAccount("institutionalCollapse", network.name) : "" });
        }
      }
    }

    for (const affiliate of affiliateRows.filter((row) => row.ownershipDisclosure === "opaqueBeneficialOwnership")) {
      if (seededNumber(seed, `affiliate-exposure:${affiliate.id}`) >= 0.34) continue;
      const year = integerBetween(seed, `affiliate-exposure-year:${affiliate.id}`, affiliate.formationYear, horizon);
      affiliate.ownershipDisclosure = "disclosedSubsidiary"; affiliate.disclosedParentNetworkId = affiliate.actualParentNetworkId;
      addEvent({ kind: "affiliateExposed", year, networkIds: [affiliate.actualParentNetworkId], affiliateIds: [affiliate.id], cityId: affiliate.registrationCityId,
        sourceLayer: "networkHistory", prerequisites: [`affiliateFormed:${affiliate.id}`, "supportedOwnershipRecords"], cause: "beneficialOwnershipDisclosure",
        exactFactors: { previousDisclosure: "opaqueBeneficialOwnership" }, stateDeltas: [{ affiliateId: affiliate.id, disclosedParentNetworkId: affiliate.actualParentNetworkId }],
        publiclyKnown: true, publicEvidence: ["registrationRecords", "auditedPayments"], publicAccount: publicAccount("affiliateExposed", affiliate.registeredName, cityName(affiliate.registrationCityId)) });
    }

    for (const network of networkRows.filter((row) => row.lifecycleStatus !== "defunct")) {
      const publicBranches = branchRows.filter((branch) => branch.networkId === network.networkId && branch.publicPhysicalPresence && !["defunct", "consolidated"].includes(branch.operationalStatus));
      const covertCells = covertRows.filter((cell) => cell.networkId === network.networkId && ["active", "dormant"].includes(cell.status));
      if (publicBranches.length) {
        network.lifecycleStatus = publicBranches.some((branch) => branch.operationalStatus === "active") ? "active" : "diminished";
        network.publicLifecycleStatus = network.lifecycleStatus;
      } else if (covertCells.length || network.integrityBand !== INTEGRITY_BANDS[0]) {
        network.lifecycleStatus = covertCells.length ? "active" : "dormant";
        network.publicLifecycleStatus = "dormant";
        network.organizationalContinuity = true;
      } else {
        network.lifecycleStatus = "defunct"; network.publicLifecycleStatus = "defunct"; network.organizationalContinuity = false;
      }
    }

    eventRows.sort((left, right) => left.year - right.year || left.id.localeCompare(right.id));
    const survivingCityIds = new Set(strategicMap.strategicPlayableSettlementState.cityRows.filter((row) => row.physicalJurisdictionExists).map((row) => row.cityId));
    for (const branch of branchRows.filter((row) => !survivingCityIds.has(row.originalCityId))) branch.currentStanding = null;
    const publicNetworkRows = networkRows.map((row) => {
      const source = networkById.get(row.networkId);
      return { id: row.networkId, name: row.name, category: row.category, publicPurpose: source.publicPurpose, originCityId: row.originCityId, foundingYear: row.foundingYear, coreCapabilityIds: clone(row.coreCapabilityIds), lifecycleStatus: row.publicLifecycleStatus, publicReputation: source.publicReputation, advertisedCapabilities: clone(source.advertisedCapabilities), roles: clone(source.roles), priorities: clone(source.priorities), prohibitions: clone(source.prohibitions), orbitalRoles: clone(source.orbitalRoles), internetReach: source.internetReach, sovereignAuthority: false, automaticEnforcementAuthority: false, guaranteesLongRangeMaterialSupport: false };
    });
    const publicBranchRows = branchRows.map((row) => ({ id: row.id, networkId: row.networkId, originalCityId: row.originalCityId, currentCityId: row.currentCityId, foundingYear: row.foundingYear, publicName: row.publicName, organizationForm: row.organizationForm, currentStanding: row.currentStanding, capacityBand: row.currentCapacityBand, serviceReliability: row.currentServiceReliability, physicalCondition: row.physicalCondition, operationalStatus: row.operationalStatus, publicPhysicalPresence: row.publicPhysicalPresence, consolidatedIntoBranchId: row.consolidatedIntoBranchId, mergedLineageBranchIds: clone(row.mergedLineageBranchIds), sovereignAuthority: false, enforcementAuthority: false, longRangeDeliveryGuaranteed: false, physicalScope: row.physicalScope }));
    const cityStandingRows = [...survivingCityIds].map((cityId) => ({
      cityId, physicalJurisdictionExists: true,
      standings: baseline.networks.map((network) => {
        const branch = publicBranchRows.find((row) => row.originalCityId === cityId && row.networkId === network.id && row.currentCityId === cityId && row.publicPhysicalPresence);
        return { networkId: network.id, standing: branch?.currentStanding || originalStandingByKey.get(`${cityId}|${network.id}`), branchId: branch?.id || null };
      }),
      hostedRelocatedBranchIds: publicBranchRows.filter((row) => row.currentCityId === cityId && row.originalCityId !== cityId && row.publicPhysicalPresence).map((row) => row.id)
    })).sort((left, right) => left.cityId.localeCompare(right.cityId));
    const publicAffiliateRows = affiliateRows.map((row) => ({ id: row.id, registeredName: row.registeredName, registrationCityId: row.registrationCityId, declaredActivity: row.declaredActivity, formationYear: row.formationYear, lifecycleStatus: row.lifecycleStatus, ownershipDisclosure: row.ownershipDisclosure, disclosedParentNetworkId: row.disclosedParentNetworkId, playerOrOriginalScientistOwned: false }));
    const publicEvents = eventRows.filter((event) => event.publiclyKnown).map((event) => ({ id: event.id, kind: event.kind, year: event.year, networkIds: clone(event.networkIds), branchIds: clone(event.branchIds), affiliateIds: clone(event.affiliateIds), cityId: event.cityId, cellId: event.cellId, sourceLayer: event.sourceLayer, confidence: event.publicConfidence, evidence: clone(event.publicEvidence), account: event.publicAccount }));
    const cellFeatures = [];
    for (const cityId of survivingCityIds) {
      const city = cityById.get(cityId);
      const local = publicBranchRows.filter((branch) => branch.currentCityId === cityId && branch.publicPhysicalPresence);
      if (!local.length) continue;
      const orbital = local.some((branch) => ["launchOffice", "orbitalRelayGateway"].includes(branch.organizationForm) && networkById.get(branch.networkId).orbitalRoles.length);
      cellFeatures.push(`${StrategicWorld.cellIndex(city.cellId).toString(36)}:${orbital ? "o" : local.length >= 10 ? "d" : "b"}`);
    }
    const publicDirectory = {
      historicalHorizonYear: horizon, networkRows: publicNetworkRows, currentBranchRows: publicBranchRows, cityStandingRows,
      affiliateRows: publicAffiliateRows, relationshipRows: relationshipRows.map((row) => clone(row)), chronology: publicEvents,
      cellFeatures: cellFeatures.sort((left, right) => parseInt(left, 36) - parseInt(right, 36)),
      principles: { networksCreateNoSovereignty: true, internetCreatesNoMaterialSupport: true, relocationRequiresPhysicalTransport: true, proscriptionDoesNotProveCovertPresence: true, priorHistoryNotRecalculated: true }
    };
    publicDirectory.digest = `public-non-state-network-history-${StrategicWorld.stableHash(coreWithoutDigest(publicDirectory))}`;
    const record = {
      historicalHorizonYear: horizon, sourceNonStateNetworksDigest: strategicMap.strategicNonStateNetworks.digest,
      sourceCapabilityHistoryDigest: strategicMap.strategicCapabilityHistory.digest, sourceCrisisHistoryDigest: strategicMap.strategicCrisisHistory.digest,
      sourcePoliticalHistoryDigest: strategicMap.strategicPoliticalHistory.digest, sourceCivicHistoryDigest: strategicMap.strategicCivicHistory.digest,
      sourcePlayableSettlementStateDigest: strategicMap.strategicPlayableSettlementState.digest, sourceReligiousInstitutionHistoryDigest: strategicMap.strategicReligiousInstitutionHistory.digest,
      publicDirectoryDigest: publicDirectory.digest, networkRows, branchRows, covertRows, affiliateRows, relationshipRows, eventRows,
      diagnostics: {
        networkCount: networkRows.length, activeNetworkCount: networkRows.filter((row) => row.lifecycleStatus === "active").length,
        diminishedNetworkCount: networkRows.filter((row) => row.lifecycleStatus === "diminished").length, dormantNetworkCount: networkRows.filter((row) => row.lifecycleStatus === "dormant").length,
        defunctNetworkCount: networkRows.filter((row) => row.lifecycleStatus === "defunct").length, publicBranchCount: branchRows.length,
        viablePublicBranchCount: branchRows.filter((row) => row.publicPhysicalPresence).length, covertCellCount: covertRows.length,
        affiliateCount: affiliateRows.length, retainedEventCount: eventRows.length, publicEventCount: publicEvents.length,
        relocatedOrConsolidatedCount: branchRows.filter((row) => ["relocated", "consolidated"].includes(row.operationalStatus)).length
      }
    };
    record.digest = `strategic-non-state-network-history-${StrategicWorld.stableHash(coreWithoutDigest(record))}`;
    return { strategicNonStateNetworkHistory: record, publicDirectory };
  }

  function validateStrategicNonStateNetworkHistory(map, record = map?.strategicNonStateNetworkHistory, directory = map?.publicNonStateNetworkHistoryDirectory) {
    const strategicMap = validateSources(map);
    if (!record || !directory || record.sourceNonStateNetworksDigest !== strategicMap.strategicNonStateNetworks.digest || record.sourceCapabilityHistoryDigest !== strategicMap.strategicCapabilityHistory.digest || record.sourceCrisisHistoryDigest !== strategicMap.strategicCrisisHistory.digest || record.sourcePoliticalHistoryDigest !== strategicMap.strategicPoliticalHistory.digest || record.sourceCivicHistoryDigest !== strategicMap.strategicCivicHistory.digest || record.sourcePlayableSettlementStateDigest !== strategicMap.strategicPlayableSettlementState.digest || record.sourceReligiousInstitutionHistoryDigest !== strategicMap.strategicReligiousInstitutionHistory.digest || record.publicDirectoryDigest !== directory.digest) throw new Error("Non-state network history is incomplete or source-inconsistent.");
    const cityYears = new Map(StrategicExpansion.allCitySeeds(strategicMap).map((city) => [city.cityId, city.foundingYear]));
    const capabilityYears = new Map(strategicMap.strategicCapabilityHistory.milestoneRows.map((row) => [row.capabilityId, row.standardizationYear]));
    if (record.networkRows.length !== strategicMap.strategicNonStateNetworks.diagnostics.networkCount || new Set(record.networkRows.map((row) => row.networkId)).size !== record.networkRows.length || record.networkRows.some((row) => !NETWORK_LIFECYCLES.includes(row.lifecycleStatus) || row.foundingYear < cityYears.get(row.originCityId) || row.coreCapabilityIds.some((id) => row.foundingYear < capabilityYears.get(id)) || row.sovereignAuthority || row.automaticEnforcementAuthority || row.guaranteesLongRangeMaterialSupport)) throw new Error("Network lifecycle, founding chronology, capability prerequisites, or authority is invalid.");
    if (new Set(record.branchRows.map((row) => row.id)).size !== record.branchRows.length || record.branchRows.some((row) => !BRANCH_CONDITIONS.includes(row.physicalCondition) || !BRANCH_STATUSES.includes(row.operationalStatus) || row.foundingYear < cityYears.get(row.originalCityId) || row.foundingYear < record.networkRows.find((network) => network.networkId === row.networkId).foundingYear || row.sovereignAuthority || row.enforcementAuthority || row.longRangeDeliveryGuaranteed)) throw new Error("A network branch has invalid identity, chronology, condition, or authority.");
    if (record.covertRows.some((row) => !COVERT_STATUSES.includes(row.status) || row.foundingYear < cityYears.get(row.cityId) || !record.networkRows.some((network) => network.networkId === row.networkId))) throw new Error("A covert network cell has invalid chronology or state.");
    if (record.affiliateRows.some((row) => !AFFILIATE_STATUSES.includes(row.lifecycleStatus) || row.playerOrOriginalScientistOwned || !record.networkRows.some((network) => network.networkId === row.actualParentNetworkId))) throw new Error("An affiliate has invalid ownership or lifecycle state.");
    const externalIds = new Set([...strategicMap.strategicCrisisHistory.eventRows, ...strategicMap.strategicPoliticalHistory.eventRows, ...strategicMap.strategicCivicHistory.eventRows, ...strategicMap.strategicReligiousInstitutionHistory.eventRows].map((event) => event.id));
    const internalIds = new Set(record.eventRows.map((event) => event.id));
    if (record.eventRows.some((event, index) => !EVENT_KINDS.includes(event.kind) || !Number.isInteger(event.year) || event.year < 0 || event.year > record.historicalHorizonYear || (index && event.year < record.eventRows[index - 1].year) || !event.networkIds.length || event.networkIds.some((id) => !record.networkRows.some((row) => row.networkId === id)) || !event.prerequisites.length || !event.cause || !event.stateDeltas.length || (event.sourceEventId && !externalIds.has(event.sourceEventId) && !internalIds.has(event.sourceEventId)))) throw new Error("A network-history event lacks valid chronology, participants, source, prerequisites, cause, or consequence.");
    const ruinedIds = new Set(strategicMap.strategicPlayableSettlementState.cityRows.filter((row) => !row.physicalJurisdictionExists).map((row) => row.cityId));
    if (directory.cityStandingRows.some((row) => ruinedIds.has(row.cityId) || !row.physicalJurisdictionExists || row.standings.length !== record.networkRows.length) || record.branchRows.filter((row) => ruinedIds.has(row.originalCityId)).some((row) => row.currentStanding !== null)) throw new Error("Destroyed cities retain network standing or the current city directory is incomplete.");
    if (directory.currentBranchRows.some((row) => row.sovereignAuthority || row.enforcementAuthority || row.longRangeDeliveryGuaranteed) || directory.relationshipRows.some((row) => row.createsSovereignty || row.guaranteesMaterialSupport)) throw new Error("Public network history grants invalid authority or material guarantees.");
    const publicJson = JSON.stringify(directory);
    if (/covertRows|actualCapacityBand|integrityBand|privatePriority|actualParentNetworkId|hiddenPurpose|exactFactors|sourceEventId|exposureRoll/.test(publicJson) || !directory.principles?.proscriptionDoesNotProveCovertPresence || !directory.principles?.priorHistoryNotRecalculated) throw new Error("Public network history leaks covert cells, hidden capacity, integrity, ownership, priorities, or exact causality.");
    if (directory.cellFeatures.some((entry) => !/^[0-9a-z]+:[bdo]$/.test(entry) || parseInt(entry, 36) >= strategicMap.topology.cellCount)) throw new Error("The current network-history globe projection is invalid.");
    if (directory.digest !== `public-non-state-network-history-${StrategicWorld.stableHash(coreWithoutDigest(directory))}` || record.digest !== `strategic-non-state-network-history-${StrategicWorld.stableHash(coreWithoutDigest(record))}`) throw new Error("Network history does not match its digest.");
    if (record.diagnostics.networkCount !== record.networkRows.length || record.diagnostics.publicBranchCount !== record.branchRows.length || record.diagnostics.covertCellCount !== record.covertRows.length || record.diagnostics.retainedEventCount !== record.eventRows.length || record.diagnostics.publicEventCount !== directory.chronology.length) throw new Error("Network-history diagnostics do not match saved facts.");
    return { strategicNonStateNetworkHistory: clone(record), publicDirectory: clone(directory) };
  }

  function attachStrategicNonStateNetworkHistory(worldSeed, map) {
    const next = validateSources(map);
    const generated = createStrategicNonStateNetworkHistory(worldSeed, next);
    next.strategicNonStateNetworkHistory = generated.strategicNonStateNetworkHistory;
    next.publicNonStateNetworkHistoryDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function publicNonStateNetworkHistory(map) {
    if (!map?.publicNonStateNetworkHistoryDirectory) return null;
    const directory = clone(map.publicNonStateNetworkHistoryDirectory);
    const cities = new Map(map.humanGeography.cities.map((city) => [city.id, city]));
    const networks = new Map(directory.networkRows.map((network) => [network.id, network]));
    const branches = new Map(directory.currentBranchRows.map((branch) => [branch.id, branch]));
    directory.networkRows = directory.networkRows.map((network) => ({ ...network, originCity: clone(cities.get(network.originCityId)) }));
    directory.currentBranchRows = directory.currentBranchRows.map((branch) => ({ ...branch, network: clone(networks.get(branch.networkId)), originalCity: clone(cities.get(branch.originalCityId)), currentCity: clone(cities.get(branch.currentCityId)) }));
    directory.cityStandingRows = directory.cityStandingRows.map((row) => ({ ...row, city: clone(cities.get(row.cityId)), standings: row.standings.map((entry) => ({ ...entry, network: clone(networks.get(entry.networkId)), branch: clone(branches.get(entry.branchId)) })) }));
    directory.affiliateRows = directory.affiliateRows.map((affiliate) => ({ ...affiliate, registrationCity: clone(cities.get(affiliate.registrationCityId)), disclosedParentNetwork: clone(networks.get(affiliate.disclosedParentNetworkId)) }));
    return directory;
  }

  function cityCurrentNetworkProfile(map, cityId) {
    return publicNonStateNetworkHistory(map)?.cityStandingRows.find((row) => row.cityId === cityId) || null;
  }

  function cellPublicNetworkHistorySnapshot(map, index) {
    const directory = publicNonStateNetworkHistory(map);
    if (!directory || !Number.isInteger(index) || index < 0 || index >= map.topology.cellCount) return null;
    const cellId = StrategicWorld.cellId(index);
    const city = map.humanGeography.cities.find((entry) => entry.cellId === cellId);
    const code = map.publicNonStateNetworkHistoryDirectory.cellFeatures.find((entry) => parseInt(entry, 36) === index)?.split(":")[1];
    return { cellId, publicClass: ({ b: "publicNetworkBranches", d: "denseInstitutionalHub", o: "orbitalLaunchOrRelayHub" })[code] || "noMajorPublicNetworkHub", cityProfile: city ? directory.cityStandingRows.find((row) => row.cityId === city.id) || null : null, branches: directory.currentBranchRows.filter((branch) => branch.currentCityId === city?.id && branch.publicPhysicalPresence), chronology: directory.chronology.filter((event) => event.cellId === cellId) };
  }

  function auditStrategicNonStateNetworkHistory(map) {
    const { strategicNonStateNetworkHistory: record, publicDirectory } = validateStrategicNonStateNetworkHistory(map);
    return {
      valid: true,
      everyNetworkFoundedAfterCityAndCapabilities: record.networkRows.every((row) => row.foundingYear >= StrategicExpansion.allCitySeeds(map).find((city) => city.cityId === row.originCityId).foundingYear && row.coreCapabilityIds.every((id) => row.foundingYear >= map.strategicCapabilityHistory.milestoneRows.find((milestone) => milestone.capabilityId === id).standardizationYear)),
      everyRetainedChangeCausallySourced: record.eventRows.every((event) => event.prerequisites.length && event.cause && event.stateDeltas.length),
      relocationRequiresPhysicalTransport: record.eventRows.filter((event) => ["branchRelocated", "branchConsolidated"].includes(event.kind)).every((event) => event.prerequisites.includes("contemporaryTransportCapability")),
      destroyedCitiesHaveNoStanding: record.branchRows.filter((branch) => !map.strategicPlayableSettlementState.cityRows.find((city) => city.cityId === branch.originalCityId).physicalJurisdictionExists).every((branch) => branch.currentStanding === null),
      lifecycleAllowsDormancyAndDefunction: record.networkRows.every((row) => NETWORK_LIFECYCLES.includes(row.lifecycleStatus)),
      networksRemainNonSovereign: record.networkRows.every((row) => !row.sovereignAuthority && !row.automaticEnforcementAuthority && !row.guaranteesLongRangeMaterialSupport),
      publicHistoryHidesCovertCapacityIntegrityAndOwnership: !JSON.stringify(publicDirectory).match(/covertRows|actualCapacityBand|integrityBand|privatePriority|actualParentNetworkId|hiddenPurpose|exactFactors|sourceEventId|exposureRoll/),
      priorHistoryNotRecalculated: publicDirectory.principles.priorHistoryNotRecalculated,
      diagnostics: clone(record.diagnostics)
    };
  }

  return Object.freeze({
    NETWORK_LIFECYCLES, BRANCH_CONDITIONS, BRANCH_STATUSES, COVERT_STATUSES, AFFILIATE_STATUSES, EVENT_KINDS, CORE_CAPABILITIES,
    createStrategicNonStateNetworkHistory, validateStrategicNonStateNetworkHistory, attachStrategicNonStateNetworkHistory,
    publicNonStateNetworkHistory, cityCurrentNetworkProfile, cellPublicNetworkHistorySnapshot, auditStrategicNonStateNetworkHistory
  });
});
