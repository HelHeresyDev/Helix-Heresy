(function initStrategicReligiousInstitutionHistory(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const strategicReligions = typeof module === "object" && module.exports ? require("./strategic-religions") : root?.HelixStrategicReligions;
  const strategicCityExpansion = typeof module === "object" && module.exports ? require("./strategic-city-expansion") : root?.HelixStrategicCityExpansion;
  const strategicDivineHistory = typeof module === "object" && module.exports ? require("./strategic-divine-history") : root?.HelixStrategicDivineHistory;
  const strategicCrisisHistory = typeof module === "object" && module.exports ? require("./strategic-crisis-history") : root?.HelixStrategicCrisisHistory;
  const strategicPoliticalHistory = typeof module === "object" && module.exports ? require("./strategic-political-history") : root?.HelixStrategicPoliticalHistory;
  const strategicCivicHistory = typeof module === "object" && module.exports ? require("./strategic-civic-history") : root?.HelixStrategicCivicHistory;
  const strategicPlayableSettlementState = typeof module === "object" && module.exports ? require("./strategic-playable-settlement-state") : root?.HelixStrategicPlayableSettlementState;
  const api = factory(strategicWorld, strategicReligions, strategicCityExpansion, strategicDivineHistory, strategicCrisisHistory, strategicPoliticalHistory, strategicCivicHistory, strategicPlayableSettlementState);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicReligiousInstitutionHistory = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicReligiousInstitutionHistoryApi(StrategicWorld, StrategicReligions, StrategicCityExpansion, StrategicDivineHistory, StrategicCrisisHistory, StrategicPoliticalHistory, StrategicCivicHistory, StrategicPlayableSettlementState) {
  "use strict";

  if (!StrategicWorld || !StrategicReligions || !StrategicCityExpansion || !StrategicDivineHistory || !StrategicCrisisHistory || !StrategicPoliticalHistory || !StrategicCivicHistory || !StrategicPlayableSettlementState) throw new Error("Religion, divine, civic, political, crisis, settlement-state, and world modules must load before strategic-religious-institution-history.js");

  const PHYSICAL_CONDITIONS = Object.freeze(["intact", "worn", "damaged", "destroyed"]);
  const OPERATIONAL_STATUSES = Object.freeze(["active", "strained", "dormant", "suppressed", "displaced", "destroyed", "reestablished", "reconciled"]);
  const INTEGRITY_BANDS = Object.freeze(["compromised", "strained", "sound", "exemplary"]);
  const DIVINE_RELATIONSHIPS = Object.freeze(["authenticated", "historicallyConfirmed", "censured", "estranged", "unconfirmedIndependent", "contestedReconciliation", "repudiated", "reconciled", "notApplicable"]);
  const EVENT_KINDS = Object.freeze(["physicalDamage", "physicalDestruction", "institutionalDisplacement", "branchReestablished", "capacityChanged", "standingChanged", "branchFounded", "misconduct", "divineCensure"]);
  const MISCONDUCT_KINDS = Object.freeze(["financialDiversion", "custodyNeglect", "coercedParticipation", "concealedAbuse", "falseMiracleClaim"]);
  const CUSTODY_STATUSES = Object.freeze(["protected", "contested", "isolated", "ruined", "unclaimed"]);
  const STANDING_CODES = Object.freeze({ established: "e", recognized: "r", tolerated: "t", restricted: "x", proscribed: "p" });
  const STANDING_BY_CODE = Object.freeze(Object.fromEntries(Object.entries(STANDING_CODES).map(([key, value]) => [value, key])));

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, Math.floor(Number(value) || 0))); }
  function seededNumber(seed, channel) { return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff; }
  function integerBetween(seed, channel, minimum, maximum) { return minimum + Math.floor(seededNumber(seed, channel) * (maximum - minimum + 1)); }
  function pick(values, seed, channel) { return values[Math.floor(seededNumber(seed, channel) * values.length) % values.length]; }
  function shiftBand(values, value, delta) { return values[clamp(values.indexOf(value) + delta, 0, values.length - 1)]; }
  function coreWithoutDigest(value) { const core = clone(value); delete core.digest; return core; }
  function readable(value) { return String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase(); }

  function validateSources(map) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicReligions.validateStrategicReligions(strategicMap);
    StrategicDivineHistory.validateStrategicDivineHistory(strategicMap);
    StrategicCrisisHistory.validateStrategicCrisisHistory(strategicMap);
    StrategicPoliticalHistory.validateStrategicPoliticalHistory(strategicMap);
    StrategicCivicHistory.validateStrategicCivicHistory(strategicMap);
    StrategicPlayableSettlementState.validateStrategicPlayableSettlementState(strategicMap);
    return strategicMap;
  }

  function publicAccount(kind, cityName, branchNames, outcome) {
    const names = branchNames.length > 2 ? `${branchNames.length} local institutions` : branchNames.join(" and ");
    if (kind === "physicalDamage") return `${names} in ${cityName} sustained publicly recorded physical damage and service loss.`;
    if (kind === "physicalDestruction") return `${names} lost their physical premises when ${cityName}'s fortified core was destroyed.`;
    if (kind === "institutionalDisplacement") return `${names} survived only as displaced institutions after losing their original premises in ${cityName}.`;
    if (kind === "branchReestablished") return `${names} reestablished physical service in ${cityName} after a recorded civic recovery.`;
    if (kind === "capacityChanged") return `${names} reported ${readable(outcome)} capacity after a documented change in local civic services.`;
    if (kind === "standingChanged") return `${cityName} publicly revised religious standing without granting any institution sovereignty.`;
    if (kind === "branchFounded") return `${names} established a local branch in ${cityName} under the city's published standing.`;
    if (kind === "misconduct") return `${names} faced supported public allegations of institutional misconduct.`;
    return `${names} received an authenticated divine censure; the branch remains distinct from the god's confirmed doctrine rather than becoming an equally confirmed faith.`;
  }

  function nearestCity(map, cellId, cities) {
    if (!cities.length) return null;
    const index = StrategicWorld.cellIndex(cellId);
    return cities.map((city) => ({ city, distance: StrategicWorld.greatCircleDistanceKm(map, index, StrategicWorld.cellIndex(city.cellId)) }))
      .sort((left, right) => left.distance - right.distance || left.city.cityId.localeCompare(right.city.cityId))[0].city;
  }

  function publicCellFeatures(map, cityStandingRows, publicBranchRows, custodyRows) {
    const features = new Map();
    for (const row of cityStandingRows) {
      const city = map.humanGeography.cities.find((entry) => entry.id === row.cityId);
      if (!city) continue;
      const established = row.standings.some((entry) => entry.standing === "established");
      const branches = publicBranchRows.some((entry) => entry.currentCityId === row.cityId && entry.publicPhysicalPresence);
      if (established || branches) features.set(StrategicWorld.cellIndex(city.cellId), established ? "e" : "c");
    }
    for (const custody of custodyRows) features.set(StrategicWorld.cellIndex(custody.cellId), "h");
    return [...features.entries()].sort((left, right) => left[0] - right[0]).map(([index, featureClass]) => `${index.toString(36)}:${featureClass}`);
  }

  function createStrategicReligiousInstitutionHistory(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for religious-institution history.");
    const strategicMap = validateSources(map);
    if (strategicMap.strategicReligiousInstitutionHistory || strategicMap.publicReligiousInstitutionHistoryDirectory) throw new Error("Religious-institution history already exists on this world.");
    const horizon = strategicMap.cityExpansionHistory.historicalHorizonYear;
    const religion = StrategicReligions.publicReligionDirectory(strategicMap);
    const cities = StrategicCityExpansion.allCitySeeds(strategicMap);
    const cityById = new Map(cities.map((city) => [city.cityId, city]));
    const settlementByCityId = new Map(strategicMap.strategicPlayableSettlementState.cityRows.map((row) => [row.cityId, row]));
    const originalTraditions = religion.traditions.map((tradition) => clone(tradition));
    const traditionById = new Map(originalTraditions.map((tradition) => [tradition.id, tradition]));
    const networkByTraditionId = new Map(religion.networks.map((network) => [network.traditionId, network]));
    const faithStateById = new Map(strategicMap.strategicDivineHistory.currentFaithRows.map((faith) => [faith.faithId, faith]));
    const godById = new Map(strategicMap.strategicDivineHistory.currentGodRows.map((god) => [god.id, god]));
    const foundationEventByCityId = new Map(strategicMap.strategicPoliticalHistory.eventRows.filter((event) => event.kind === "sovereignFoundation").map((event) => [event.location.cityId, event]));
    const initialStandingByKey = new Map();
    const standingByKey = new Map();
    for (const cityId of religion.cityOrder) for (const entry of StrategicReligions.cityReligiousStanding(strategicMap, cityId).standings) {
      const key = `${cityId}|${entry.tradition.id}`;
      initialStandingByKey.set(key, entry.standing);
      standingByKey.set(key, entry.standing);
    }

    function divineRelationship(tradition) {
      if (tradition.kind !== "confirmedDivineFaith") return "notApplicable";
      return faithStateById.get(tradition.id)?.confirmationState === "activelyConfirmed" ? "authenticated" : "historicallyConfirmed";
    }

    function branchIdentity(city, tradition, originKind) {
      return originKind === "foundingBaseline" ? `religious-branch:${String(cities.findIndex((entry) => entry.cityId === city.cityId) + 1).padStart(3, "0")}:${String(originalTraditions.findIndex((entry) => entry.id === tradition.id) + 1).padStart(2, "0")}` : `religious-institution:${StrategicWorld.stableHash(`${city.cityId}:${tradition.id}`)}`;
    }

    function createBranch(city, tradition, options = {}) {
      const baseline = options.baseline || null;
      const standing = options.standing || standingByKey.get(`${city.cityId}|${tradition.id}`) || "tolerated";
      const earliest = Math.min(horizon, Math.max(city.foundingYear, options.earliestYear ?? city.foundingYear) + (options.originKind === "foundingBaseline" ? 1 : 0));
      const latest = Math.min(horizon, earliest + 18);
      const foundingYear = options.foundingYear ?? integerBetween(seed, `religious-branch-founding:${city.cityId}:${tradition.id}`, earliest, latest);
      const organizationForm = baseline?.organizationForm || pick(StrategicReligions.BRANCH_FORMS, seed, `religious-branch-form:${city.cityId}:${tradition.id}`);
      const adherentBand = baseline?.adherentBand || (standing === "established" ? "majority" : standing === "recognized" ? "significant" : standing === "restricted" ? "trace" : "minority");
      const capacityBand = baseline?.capacityBand || (standing === "established" ? "strong" : standing === "recognized" ? "functional" : "strained");
      const roles = baseline?.roles || [...StrategicReligions.NETWORK_ROLES].map((role) => ({ role, score: seededNumber(seed, `religious-role:${city.cityId}:${tradition.id}:${role}`) })).sort((left, right) => left.score - right.score).slice(0, 5).map((entry) => entry.role);
      const baseIndex = baseline ? religion.branches.findIndex((branch) => branch.id === baseline.id) : -1;
      const integrityIndex = baseIndex >= 0 ? parseInt(strategicMap.strategicReligions.hiddenBranchIntegrityCodes[baseIndex], 10) : Math.floor(seededNumber(seed, `religious-integrity:${city.cityId}:${tradition.id}`) * INTEGRITY_BANDS.length);
      return {
        id: baseline?.id || branchIdentity(city, tradition, options.originKind || "laterInstitution"),
        originKind: options.originKind || "laterInstitution", originalCityId: city.cityId, currentCityId: city.cityId, cellId: city.cellId,
        traditionId: tradition.id, networkId: baseline?.networkId || networkByTraditionId.get(tradition.id)?.id || null,
        publicName: baseline?.publicName || `${tradition.kind === "nonTheisticMovement" ? "Forum" : "Temple"} of ${tradition.name.replace(/^The Faith of |^The /, "")} in ${city.cityName}`,
        organizationForm, roles: clone(roles), foundingYear, foundingCause: options.foundingCause || (standing === "established" ? "citySponsorship" : standing === "recognized" ? "publicRecognition" : "localOrganization"),
        foundingSourceEventId: options.sourceEventId || foundationEventByCityId.get(city.cityId)?.id || null,
        initialStanding: standing, currentStanding: standing, initialAdherentBand: adherentBand, currentAdherentBand: adherentBand,
        initialCapacityBand: capacityBand, currentCapacityBand: capacityBand, physicalCondition: "intact", operationalStatus: "active",
        divineRelationship: options.divineRelationship || divineRelationship(tradition), publicDivineRelationship: options.divineRelationship || divineRelationship(tradition),
        integrityBand: INTEGRITY_BANDS[clamp(integrityIndex, 0, INTEGRITY_BANDS.length - 1)], concealedMisconduct: false, covertPersistence: false,
        publicPhysicalPresence: true, internetContinuity: true, physicalScope: "localInstitutionAndControlledPropertyOnly", sovereignAuthority: false,
        predecessorFaithId: options.predecessorFaithId || null, historicalGodId: options.historicalGodId || null, successorResolution: options.successorResolution || null,
        exactFactors: { sourceIntegrityIndex: clamp(integrityIndex, 0, INTEGRITY_BANDS.length - 1), authoredAsAggregateInstitution: true }
      };
    }

    const branchRows = religion.branches.map((baseline) => createBranch(cityById.get(baseline.cityId), traditionById.get(baseline.traditionId), { baseline, originKind: "foundingBaseline" }));
    const branchByKey = new Map(branchRows.map((branch) => [`${branch.originalCityId}|${branch.traditionId}`, branch]));
    const successorTraditions = [];
    for (const successor of strategicMap.publicDivineHistoryDirectory.successorRows) {
      const source = strategicMap.strategicDivineHistory.eventRows.find((event) => event.stateDelta?.successorTraditionId === successor.id);
      const eligible = cities.filter((city) => city.foundingYear <= successor.createdYear && settlementByCityId.get(city.cityId)?.physicalCondition !== "ruined");
      const city = source?.cellId ? nearestCity(strategicMap, source.cellId, eligible) : eligible[0];
      if (!city) continue;
      const tradition = { id: successor.id, name: successor.name, kind: "unconfirmedSuccessorTradition", deityIds: [], predecessorFaithId: successor.predecessorFaithId, historicalGodId: successor.historicalGodId, confirmationState: "unconfirmedSuccessor", sameGodHeresyClaimsValid: false, sovereignAuthority: false, resolution: successor.resolution };
      successorTraditions.push(tradition); traditionById.set(tradition.id, tradition);
      const relationship = successor.resolution === "reconciliationContested" ? "contestedReconciliation" : successor.resolution === "repudiated" ? "repudiated" : successor.resolution === "reconciled" ? "reconciled" : "unconfirmedIndependent";
      const standing = successor.resolution === "repudiated" ? "restricted" : "tolerated";
      standingByKey.set(`${city.cityId}|${tradition.id}`, standing);
      const branch = createBranch(city, tradition, { originKind: "successorInstitution", standing, earliestYear: successor.createdYear, foundingYear: Math.min(horizon, successor.createdYear + 1), foundingCause: "divineSilenceSuccessorOrganization", sourceEventId: source?.id || null, divineRelationship: relationship, predecessorFaithId: successor.predecessorFaithId, historicalGodId: successor.historicalGodId, successorResolution: successor.resolution });
      if (relationship === "reconciled") { branch.operationalStatus = "reconciled"; branch.publicPhysicalPresence = false; }
      branchRows.push(branch); branchByKey.set(`${city.cityId}|${tradition.id}`, branch);
    }

    const eventRows = [];
    function addEvent(details) {
      const event = {
        id: `religious-institution-event:${String(eventRows.length + 1).padStart(4, "0")}`,
        kind: details.kind, year: details.year, cityId: details.cityId || null, cellId: details.cellId || null, siteId: details.siteId || null,
        branchIds: clone(details.branchIds || []), traditionIds: clone(details.traditionIds || []), sourceLayer: details.sourceLayer,
        sourceEventId: details.sourceEventId || null, prerequisites: clone(details.prerequisites || []), cause: details.cause,
        exactFactors: clone(details.exactFactors || {}), stateDeltas: clone(details.stateDeltas || []), publiclyKnown: Boolean(details.publiclyKnown),
        publicEvidence: clone(details.publicEvidence || []), publicAccount: details.publicAccount || ""
      };
      eventRows.push(event);
      return event;
    }

    const actions = [];
    for (const event of strategicMap.strategicCrisisHistory.eventRows) {
      const delta = event.stateDelta.infrastructureDeltas.find((entry) => entry.kind === "sovereignCity");
      if (delta) actions.push({ kind: "crisis", year: event.year, priority: 0, event, cityId: delta.assetId, resultingState: delta.resultingState });
    }
    for (const event of strategicMap.strategicPoliticalHistory.eventRows.filter((entry) => ["intercityCampaign", "subjectRevolt"].includes(entry.kind))) actions.push({ kind: "political", year: event.year, priority: 1, event, cityId: event.location.cityId });
    for (const event of strategicMap.strategicCivicHistory.eventRows) actions.push({ kind: "civic", year: event.year, priority: 2, event, cityId: event.cityId });
    for (const recovery of strategicMap.strategicPlayableSettlementState.recoveryRows.filter((entry) => entry.kind === "cityRepair")) actions.push({ kind: "recovery", year: recovery.year, priority: 3, event: recovery, cityId: recovery.assetId });
    for (const branch of branchRows) if (["compromised", "strained"].includes(branch.integrityBand) && (branch.integrityBand === "compromised" || seededNumber(seed, `religious-misconduct-retention:${branch.id}`) < 0.38)) {
      const earliest = Math.min(horizon, branch.foundingYear + 1);
      actions.push({ kind: "misconduct", year: integerBetween(seed, `religious-misconduct-year:${branch.id}`, earliest, horizon), priority: 4, branchId: branch.id });
    }
    actions.sort((left, right) => left.year - right.year || left.priority - right.priority || String(left.event?.id || left.branchId).localeCompare(String(right.event?.id || right.branchId)));

    function cityBranches(cityId, year) { return branchRows.filter((branch) => branch.originalCityId === cityId && branch.foundingYear <= year); }
    function displacementHost(cityId) {
      const row = strategicMap.strategicPlayableSettlementState.displacementRows.find((entry) => entry.originAssetId === cityId);
      return row?.admissions?.[0]?.cityId || null;
    }

    for (const action of actions) {
      if (action.kind === "crisis") {
        const affected = cityBranches(action.cityId, action.year);
        if (!affected.length || !["damaged", "destroyed"].includes(action.resultingState)) continue;
        const hostCityId = action.resultingState === "destroyed" ? displacementHost(action.cityId) : null;
        for (const branch of affected) {
          if (action.resultingState === "destroyed") {
            branch.physicalCondition = "destroyed"; branch.currentStanding = null; branch.currentCityId = hostCityId; branch.publicPhysicalPresence = Boolean(hostCityId);
            branch.operationalStatus = hostCityId ? "displaced" : "destroyed"; branch.currentCapacityBand = "fragile"; branch.currentAdherentBand = shiftBand(StrategicReligions.ADHERENT_BANDS, branch.currentAdherentBand, -2);
          } else {
            branch.physicalCondition = "damaged"; branch.operationalStatus = "strained"; branch.currentCapacityBand = shiftBand(StrategicReligions.CAPACITY_BANDS, branch.currentCapacityBand, -1); branch.currentAdherentBand = shiftBand(StrategicReligions.ADHERENT_BANDS, branch.currentAdherentBand, -1);
          }
        }
        const kind = action.resultingState === "destroyed" ? (hostCityId ? "institutionalDisplacement" : "physicalDestruction") : "physicalDamage";
        addEvent({ kind, year: action.year, cityId: action.cityId, cellId: cityById.get(action.cityId)?.cellId, branchIds: affected.map((branch) => branch.id), traditionIds: affected.map((branch) => branch.traditionId), sourceLayer: "crisisHistory", sourceEventId: action.event.id, prerequisites: [action.event.id, `cityInfrastructure:${action.resultingState}`], cause: action.event.kind, exactFactors: { resultingInfrastructureState: action.resultingState, displacedHostCityId: hostCityId }, stateDeltas: affected.map((branch) => ({ branchId: branch.id, physicalCondition: branch.physicalCondition, operationalStatus: branch.operationalStatus, currentCityId: branch.currentCityId })), publiclyKnown: true, publicEvidence: ["crisisChronicle", "survivingBranchRecords"], publicAccount: publicAccount(kind, cityById.get(action.cityId)?.cityName || action.cityId, affected.map((branch) => branch.publicName), branchRows[0]?.operationalStatus) });
      } else if (action.kind === "political") {
        const city = cityById.get(action.cityId);
        if (!city) continue;
        if (action.event.kind === "intercityCampaign" && action.event.stateDelta.controlStatus === "occupied") {
          const controllerPolity = strategicMap.cityPolities.polities.find((polity) => polity.id === action.event.stateDelta.effectiveControllerPolityId);
          const controllerCityId = controllerPolity?.cityId;
          const favoredTraditionId = originalTraditions.find((tradition) => standingByKey.get(`${controllerCityId}|${tradition.id}`) === "established")?.id || originalTraditions[Math.floor(seededNumber(seed, `occupation-faith:${action.event.id}`) * originalTraditions.length) % originalTraditions.length]?.id;
          if (!favoredTraditionId) continue;
          const affected = [];
          for (const tradition of originalTraditions) if (standingByKey.get(`${city.cityId}|${tradition.id}`) === "established") {
            standingByKey.set(`${city.cityId}|${tradition.id}`, "recognized");
            const branch = branchByKey.get(`${city.cityId}|${tradition.id}`); if (branch) { branch.currentStanding = "recognized"; affected.push(branch); }
          }
          standingByKey.set(`${city.cityId}|${favoredTraditionId}`, "established");
          let favored = branchByKey.get(`${city.cityId}|${favoredTraditionId}`);
          if (!favored) {
            favored = createBranch(city, traditionById.get(favoredTraditionId), { originKind: "occupationSponsoredInstitution", standing: "established", foundingYear: action.year, foundingCause: "occupationSponsorship", sourceEventId: action.event.id });
            branchRows.push(favored); branchByKey.set(`${city.cityId}|${favoredTraditionId}`, favored);
            addEvent({ kind: "branchFounded", year: action.year, cityId: city.cityId, cellId: city.cellId, branchIds: [favored.id], traditionIds: [favored.traditionId], sourceLayer: "politicalHistory", sourceEventId: action.event.id, prerequisites: [action.event.id, "physicalOccupation", "localPremises"], cause: "occupationSponsorship", exactFactors: { sponsorPolityId: action.event.stateDelta.effectiveControllerPolityId }, stateDeltas: [{ branchId: favored.id, founded: true, standing: "established" }], publiclyKnown: true, publicEvidence: ["occupationDecree", "openedPremises"], publicAccount: publicAccount("branchFounded", city.cityName, [favored.publicName], "established") });
          }
          favored.currentStanding = "established"; affected.push(favored);
          addEvent({ kind: "standingChanged", year: action.year, cityId: city.cityId, cellId: city.cellId, branchIds: affected.map((branch) => branch.id), traditionIds: affected.map((branch) => branch.traditionId), sourceLayer: "politicalHistory", sourceEventId: action.event.id, prerequisites: [action.event.id, "overtOccupationAdministration"], cause: "occupationReligiousPolicy", exactFactors: { controllerPolityId: action.event.stateDelta.effectiveControllerPolityId, favoredTraditionId }, stateDeltas: affected.map((branch) => ({ branchId: branch.id, currentStanding: branch.currentStanding })), publiclyKnown: true, publicEvidence: ["publishedStandingRegistry", "occupationDecree"], publicAccount: publicAccount("standingChanged", city.cityName, affected.map((branch) => branch.publicName), "occupation policy") });
        } else if (action.event.kind === "subjectRevolt" && action.event.outcome === "sovereigntyRestored") {
          const affected = cityBranches(city.cityId, action.year);
          for (const tradition of originalTraditions) standingByKey.set(`${city.cityId}|${tradition.id}`, initialStandingByKey.get(`${city.cityId}|${tradition.id}`));
          for (const branch of affected) branch.currentStanding = initialStandingByKey.get(`${city.cityId}|${branch.traditionId}`) || "tolerated";
          if (!affected.length) continue;
          addEvent({ kind: "standingChanged", year: action.year, cityId: city.cityId, cellId: city.cellId, branchIds: affected.map((branch) => branch.id), traditionIds: affected.map((branch) => branch.traditionId), sourceLayer: "politicalHistory", sourceEventId: action.event.id, prerequisites: [action.event.id, "sovereigntyRestored"], cause: "postOccupationStandingReview", exactFactors: { restoredFoundingPolicy: true }, stateDeltas: affected.map((branch) => ({ branchId: branch.id, currentStanding: branch.currentStanding })), publiclyKnown: true, publicEvidence: ["restoredCityRegistry"], publicAccount: publicAccount("standingChanged", city.cityName, affected.map((branch) => branch.publicName), "restored city policy") });
        }
      } else if (action.kind === "civic") {
        const affected = cityBranches(action.cityId, action.year).filter((branch) => branch.operationalStatus !== "destroyed");
        if (!affected.length) continue;
        const adverse = ["crisisInstitutionalDamage", "tributeAusterity", "occupationAdministration", "revoltDisruption", "institutionalDisplacement"].includes(action.event.kind);
        const restorative = ["emergencyReform", "charterRestoration"].includes(action.event.kind);
        const delta = adverse ? -1 : restorative ? 1 : 0;
        if (!delta) continue;
        for (const branch of affected) { branch.currentCapacityBand = shiftBand(StrategicReligions.CAPACITY_BANDS, branch.currentCapacityBand, delta); if (delta < 0 && branch.operationalStatus === "active") branch.operationalStatus = "strained"; }
        addEvent({ kind: "capacityChanged", year: action.year, cityId: action.cityId, cellId: cityById.get(action.cityId)?.cellId, branchIds: affected.map((branch) => branch.id), traditionIds: affected.map((branch) => branch.traditionId), sourceLayer: "civicHistory", sourceEventId: action.event.id, prerequisites: [action.event.id, "dependenceOnLocalCivicServices"], cause: action.event.kind, exactFactors: { capacityShift: delta, affectedCivicInstitutionIds: action.event.affectedInstitutionIds }, stateDeltas: affected.map((branch) => ({ branchId: branch.id, currentCapacityBand: branch.currentCapacityBand })), publiclyKnown: true, publicEvidence: ["branchServiceReports", "publicCivicRecord"], publicAccount: publicAccount("capacityChanged", cityById.get(action.cityId)?.cityName || action.cityId, affected.map((branch) => branch.publicName), delta < 0 ? "reduced" : "improved") });
      } else if (action.kind === "recovery") {
        const affected = cityBranches(action.cityId, action.year).filter((branch) => ["damaged", "destroyed"].includes(branch.physicalCondition) && branch.operationalStatus !== "destroyed");
        if (!affected.length) continue;
        for (const branch of affected) { branch.physicalCondition = "worn"; branch.operationalStatus = "reestablished"; branch.currentCityId = branch.originalCityId; branch.publicPhysicalPresence = true; branch.currentCapacityBand = shiftBand(StrategicReligions.CAPACITY_BANDS, branch.currentCapacityBand, 1); }
        addEvent({ kind: "branchReestablished", year: action.year, cityId: action.cityId, cellId: cityById.get(action.cityId)?.cellId, branchIds: affected.map((branch) => branch.id), traditionIds: affected.map((branch) => branch.traditionId), sourceLayer: "playableSettlementState", sourceEventId: action.event.id, prerequisites: [action.event.id, action.event.sourceEventId, "survivingLocalInstitution"], cause: "cityInfrastructureRepair", exactFactors: { sourceRecoveryKind: action.event.kind }, stateDeltas: affected.map((branch) => ({ branchId: branch.id, physicalCondition: branch.physicalCondition, operationalStatus: branch.operationalStatus })), publiclyKnown: true, publicEvidence: ["reopenedPremises", "repairLedger"], publicAccount: publicAccount("branchReestablished", cityById.get(action.cityId)?.cityName || action.cityId, affected.map((branch) => branch.publicName), "reestablished") });
      } else if (action.kind === "misconduct") {
        const branch = branchRows.find((entry) => entry.id === action.branchId);
        if (!branch || branch.foundingYear > action.year || branch.operationalStatus === "destroyed") continue;
        const misconductKind = pick(MISCONDUCT_KINDS, seed, `religious-misconduct-kind:${branch.id}`);
        const exposed = seededNumber(seed, `religious-misconduct-exposure:${branch.id}`) < 0.52;
        branch.concealedMisconduct = true; branch.integrityBand = "compromised"; if (branch.operationalStatus === "active") branch.operationalStatus = "strained";
        const misconduct = addEvent({ kind: "misconduct", year: action.year, cityId: branch.originalCityId, cellId: branch.cellId, branchIds: [branch.id], traditionIds: [branch.traditionId], sourceLayer: "institutionalIntegrity", sourceEventId: null, prerequisites: [`foundingBaselineIntegrity:${branch.exactFactors.sourceIntegrityIndex}`, "institutionalOpportunity"], cause: misconductKind, exactFactors: { misconductKind, concealedBeforeExposure: true, exposureRoll: seededNumber(seed, `religious-misconduct-exposure:${branch.id}`) }, stateDeltas: [{ branchId: branch.id, integrityBand: "compromised", operationalStatus: branch.operationalStatus }], publiclyKnown: exposed, publicEvidence: exposed ? ["supportedTestimony", "institutionalRecords"] : [], publicAccount: exposed ? publicAccount("misconduct", cityById.get(branch.originalCityId)?.cityName || branch.originalCityId, [branch.publicName], misconductKind) : "" });
        const tradition = traditionById.get(branch.traditionId);
        const god = tradition?.deityIds?.length === 1 ? godById.get(tradition.deityIds[0]) : null;
        if (god?.lifecycle.lifeState === "living" && god.lifecycle.divinityState === "divine" && action.year < horizon) {
          const publicCensure = seededNumber(seed, `religious-censure-public:${branch.id}`) < 0.7;
          branch.divineRelationship = seededNumber(seed, `religious-censure-severity:${branch.id}`) < 0.5 ? "censured" : "estranged";
          if (publicCensure) branch.publicDivineRelationship = branch.divineRelationship;
          addEvent({ kind: "divineCensure", year: Math.min(horizon, action.year + 1), cityId: branch.originalCityId, cellId: branch.cellId, branchIds: [branch.id], traditionIds: [branch.traditionId], sourceLayer: "religiousInstitutionHistory", sourceEventId: misconduct.id, prerequisites: [misconduct.id, "activeAuthenticatedDivineCorrection"], cause: "authenticatedResponseToBranchMisconduct", exactFactors: { privateOrPublicCorrection: publicCensure ? "public" : "private", confirmedFaithIdentityUnchanged: true }, stateDeltas: [{ branchId: branch.id, divineRelationship: branch.divineRelationship, createsConfirmedSuccessor: false }], publiclyKnown: publicCensure, publicEvidence: publicCensure ? ["repeatableDivineSignature", "authenticatedStatement"] : [], publicAccount: publicCensure ? publicAccount("divineCensure", cityById.get(branch.originalCityId)?.cityName || branch.originalCityId, [branch.publicName], branch.divineRelationship) : "" });
        }
      }
    }

    for (const branch of branchRows) {
      const settlement = settlementByCityId.get(branch.originalCityId);
      if (settlement?.physicalCondition === "ruined") {
        const host = branch.currentCityId && branch.currentCityId !== branch.originalCityId ? branch.currentCityId : displacementHost(branch.originalCityId);
        branch.physicalCondition = "destroyed"; branch.currentStanding = null; branch.currentCityId = host; branch.operationalStatus = host ? "displaced" : "destroyed"; branch.publicPhysicalPresence = Boolean(host);
      }
      if (branch.currentStanding === "proscribed") { branch.operationalStatus = branch.operationalStatus === "destroyed" ? "destroyed" : "suppressed"; branch.publicPhysicalPresence = false; branch.covertPersistence = seededNumber(seed, `religious-covert-persistence:${branch.id}`) < 0.54; }
      if (branch.currentCityId) branch.cellId = cityById.get(branch.currentCityId)?.cellId || branch.cellId;
    }
    eventRows.sort((left, right) => left.year - right.year || left.id.localeCompare(right.id));

    const survivingCityIds = new Set(strategicMap.strategicPlayableSettlementState.cityRows.filter((row) => row.physicalJurisdictionExists).map((row) => row.cityId));
    const allTraditions = [...originalTraditions, ...successorTraditions];
    const cityStandingRows = cities.filter((city) => survivingCityIds.has(city.cityId)).map((city) => {
      const standings = originalTraditions.map((tradition) => ({ traditionId: tradition.id, standing: standingByKey.get(`${city.cityId}|${tradition.id}`), branchId: branchByKey.get(`${city.cityId}|${tradition.id}`)?.publicPhysicalPresence ? branchByKey.get(`${city.cityId}|${tradition.id}`).id : null }));
      for (const successor of successorTraditions) {
        const branch = branchByKey.get(`${city.cityId}|${successor.id}`);
        if (branch) standings.push({ traditionId: successor.id, standing: branch.currentStanding, branchId: branch.publicPhysicalPresence ? branch.id : null });
      }
      return { cityId: city.cityId, physicalJurisdictionExists: true, standings, hostedDisplacedInstitutionIds: branchRows.filter((branch) => branch.currentCityId === city.cityId && branch.originalCityId !== city.cityId).map((branch) => branch.id) };
    });

    const publicBranchRows = branchRows.map((branch) => ({
      id: branch.id, originKind: branch.originKind, originalCityId: branch.originalCityId, currentCityId: branch.currentCityId, cellId: branch.cellId, traditionId: branch.traditionId,
      publicName: branch.publicName, organizationForm: branch.organizationForm, roles: clone(branch.roles), foundingYear: branch.foundingYear, foundingCause: branch.foundingCause,
      currentStanding: branch.currentStanding, adherentBand: branch.currentAdherentBand, capacityBand: branch.currentCapacityBand, physicalCondition: branch.physicalCondition,
      operationalStatus: branch.operationalStatus, divineRelationship: branch.publicDivineRelationship, publicPhysicalPresence: branch.publicPhysicalPresence,
      internetContinuity: branch.internetContinuity, physicalScope: branch.physicalScope, sovereignAuthority: false, predecessorFaithId: branch.predecessorFaithId,
      successorResolution: branch.successorResolution
    }));

    const publicEvents = eventRows.filter((event) => event.publiclyKnown).map((event) => ({ id: event.id, kind: event.kind, year: event.year, cityId: event.cityId, cellId: event.cellId, siteId: event.siteId, branchIds: clone(event.branchIds), traditionIds: clone(event.traditionIds), account: event.publicAccount, evidence: clone(event.publicEvidence), causeCategory: event.kind === "misconduct" ? "supportedInstitutionalMisconduct" : event.kind === "divineCensure" ? "authenticatedDivineJudgment" : event.sourceLayer }));
    const publicFaithSites = new Map((religion.holySites || []).map((site) => [site.id, site]));
    const custodyRows = strategicMap.publicDivineHistoryDirectory.siteRows.map((site) => {
      const patronGodId = site.currentControllerGodId || site.originPatronGodId;
      const faithId = originalTraditions.find((tradition) => tradition.deityIds?.[0] === patronGodId)?.id;
      const candidates = publicBranchRows.filter((branch) => branch.traditionId === faithId && branch.publicPhysicalPresence && !["censured", "estranged"].includes(branch.divineRelationship));
      const nearest = candidates.length ? candidates.map((branch) => ({ branch, distance: StrategicWorld.greatCircleDistanceKm(strategicMap, StrategicWorld.cellIndex(site.cellId), StrategicWorld.cellIndex(branch.cellId)) })).sort((left, right) => left.distance - right.distance || left.branch.id.localeCompare(right.branch.id))[0] : null;
      const custodyStatus = site.state === "dead" ? "ruined" : !nearest ? "unclaimed" : nearest.distance > 1800 ? "isolated" : site.currentControllerGodId !== site.originPatronGodId ? "contested" : "protected";
      return { siteId: site.siteId, name: site.name, cellId: site.cellId, originPatronGodId: site.originPatronGodId, currentControllerGodId: site.currentControllerGodId, custodianInstitutionId: nearest?.branch.id || null, custodyStatus, accessClass: publicFaithSites.get(site.siteId)?.accessClass || "wildernessExpedition", divineIdentityTransferred: false, religionTransferred: false, createsSovereignty: false, observationConfidence: nearest ? "credible" : "fragmentary" };
    });
    const publicDirectory = {
      historicalHorizonYear: horizon,
      knowledgePolicy: "observableInstitutionalHistoryWithIntegrityMisconductAttentionAndCovertSponsorshipRedacted",
      traditionRows: allTraditions.map((tradition) => clone(tradition)), currentBranchRows: publicBranchRows, cityStandingRows, chronology: publicEvents, holySiteCustodyRows: custodyRows,
      cellFeatures: publicCellFeatures(strategicMap, cityStandingRows, publicBranchRows, custodyRows),
      principles: { oneAggregateBranchPerCityTradition: true, activeGodPreventsConfirmedSameGodSchism: true, successorsRemainUnconfirmedUnlessReconciled: true, cityStandingIsNotDivineTruth: true, physicalCustodyDoesNotTransferDivineIdentity: true, internetDoesNotMovePeopleOrCargo: true, institutionsCreateNoSovereignty: true, divinePowerHistoryNotRecalculated: true, beastInstitutionDetailDeferred: true }
    };
    publicDirectory.digest = `public-religious-institution-history-${StrategicWorld.stableHash(coreWithoutDigest(publicDirectory))}`;
    const record = {
      historicalHorizonYear: horizon,
      sourceReligionDigest: strategicMap.strategicReligions.digest, sourceDivineHistoryDigest: strategicMap.strategicDivineHistory.digest,
      sourceCrisisHistoryDigest: strategicMap.strategicCrisisHistory.digest, sourcePoliticalHistoryDigest: strategicMap.strategicPoliticalHistory.digest,
      sourceCivicHistoryDigest: strategicMap.strategicCivicHistory.digest, sourcePlayableSettlementStateDigest: strategicMap.strategicPlayableSettlementState.digest,
      publicDirectoryDigest: publicDirectory.digest, branchRows, eventRows, holySiteCustodyRows: custodyRows,
      diagnostics: {
        branchCount: branchRows.length, foundingBaselineBranchCount: branchRows.filter((branch) => branch.originKind === "foundingBaseline").length,
        laterBranchCount: branchRows.filter((branch) => branch.originKind !== "foundingBaseline").length, successorInstitutionCount: branchRows.filter((branch) => branch.originKind === "successorInstitution").length,
        retainedEventCount: eventRows.length, publicEventCount: publicEvents.length, displacedOrDestroyedCount: branchRows.filter((branch) => ["displaced", "destroyed"].includes(branch.operationalStatus)).length,
        censuredOrEstrangedCount: branchRows.filter((branch) => ["censured", "estranged"].includes(branch.divineRelationship)).length,
        survivingCityStandingCount: cityStandingRows.length, holySiteCustodyCount: custodyRows.length
      }
    };
    record.digest = `strategic-religious-institution-history-${StrategicWorld.stableHash(coreWithoutDigest(record))}`;
    return { strategicReligiousInstitutionHistory: record, publicDirectory };
  }

  function validateStrategicReligiousInstitutionHistory(map, record = map?.strategicReligiousInstitutionHistory, directory = map?.publicReligiousInstitutionHistoryDirectory) {
    const strategicMap = validateSources(map);
    if (!record || !directory || record.sourceReligionDigest !== strategicMap.strategicReligions.digest || record.sourceDivineHistoryDigest !== strategicMap.strategicDivineHistory.digest || record.sourceCrisisHistoryDigest !== strategicMap.strategicCrisisHistory.digest || record.sourcePoliticalHistoryDigest !== strategicMap.strategicPoliticalHistory.digest || record.sourceCivicHistoryDigest !== strategicMap.strategicCivicHistory.digest || record.sourcePlayableSettlementStateDigest !== strategicMap.strategicPlayableSettlementState.digest || record.publicDirectoryDigest !== directory.digest) throw new Error("Religious-institution history is incomplete or source-inconsistent.");
    const cityById = new Map(StrategicCityExpansion.allCitySeeds(strategicMap).map((city) => [city.cityId, city]));
    const validTraditionIds = new Set(directory.traditionRows.map((tradition) => tradition.id));
    if (new Set(record.branchRows.map((branch) => branch.id)).size !== record.branchRows.length || new Set(record.branchRows.map((branch) => `${branch.originalCityId}|${branch.traditionId}`)).size !== record.branchRows.length) throw new Error("Religious institutions must have unique identities and at most one aggregate branch per city and tradition.");
    if (record.branchRows.some((branch) => !cityById.has(branch.originalCityId) || !validTraditionIds.has(branch.traditionId) || !Number.isInteger(branch.foundingYear) || branch.foundingYear < cityById.get(branch.originalCityId).foundingYear || branch.foundingYear > record.historicalHorizonYear || !PHYSICAL_CONDITIONS.includes(branch.physicalCondition) || !OPERATIONAL_STATUSES.includes(branch.operationalStatus) || !INTEGRITY_BANDS.includes(branch.integrityBand) || !StrategicReligions.ADHERENT_BANDS.includes(branch.currentAdherentBand) || !StrategicReligions.CAPACITY_BANDS.includes(branch.currentCapacityBand) || !DIVINE_RELATIONSHIPS.includes(branch.divineRelationship) || branch.sovereignAuthority || branch.physicalScope !== "localInstitutionAndControlledPropertyOnly")) throw new Error("A religious institution has invalid chronology, state, capacity, or authority.");
    const successors = directory.traditionRows.filter((tradition) => tradition.kind === "unconfirmedSuccessorTradition");
    if (successors.some((tradition) => tradition.confirmationState !== "unconfirmedSuccessor" || tradition.sameGodHeresyClaimsValid || tradition.sovereignAuthority) || record.branchRows.filter((branch) => successors.some((tradition) => tradition.id === branch.traditionId)).some((branch) => !["unconfirmedIndependent", "contestedReconciliation", "repudiated", "reconciled"].includes(branch.divineRelationship))) throw new Error("Successor institutions gained invalid divine confirmation or same-god heresy status.");
    const externalEventIds = new Set([...strategicMap.strategicDivineHistory.eventRows, ...strategicMap.strategicCrisisHistory.eventRows, ...strategicMap.strategicPoliticalHistory.eventRows, ...strategicMap.strategicCivicHistory.eventRows, ...strategicMap.strategicPlayableSettlementState.recoveryRows].map((event) => event.id));
    const internalEventIds = new Set(record.eventRows.map((event) => event.id));
    const invalidEvent = record.eventRows.find((event, index) => !EVENT_KINDS.includes(event.kind) || !Number.isInteger(event.year) || event.year < 0 || event.year > record.historicalHorizonYear || (index && event.year < record.eventRows[index - 1].year) || !event.branchIds.length || event.branchIds.some((id) => !record.branchRows.some((branch) => branch.id === id)) || !event.prerequisites.length || !event.cause || !event.exactFactors || !event.stateDeltas.length || (event.sourceEventId && !externalEventIds.has(event.sourceEventId) && !internalEventIds.has(event.sourceEventId)));
    if (invalidEvent) throw new Error(`A religious-institution event lacks a valid source, chronology, participant, cause, or bounded consequence (${invalidEvent.id}:${invalidEvent.kind}:branches=${invalidEvent.branchIds.length}:source=${invalidEvent.sourceEventId || "internal"}).`);
    if (record.holySiteCustodyRows.some((row) => !CUSTODY_STATUSES.includes(row.custodyStatus) || row.divineIdentityTransferred || row.religionTransferred || row.createsSovereignty || (row.custodianInstitutionId && !record.branchRows.some((branch) => branch.id === row.custodianInstitutionId)))) throw new Error("Holy-site custody transferred divine identity, religion, or sovereignty or names an invalid custodian.");
    if (directory.cityStandingRows.some((row) => !cityById.has(row.cityId) || !row.physicalJurisdictionExists || row.standings.filter((entry) => entry.standing === "established").length > 1 || row.standings.some((entry) => !StrategicReligions.RELIGIOUS_STANDINGS.includes(entry.standing) || !validTraditionIds.has(entry.traditionId) || (entry.branchId && !record.branchRows.some((branch) => branch.id === entry.branchId))))) throw new Error("Playable-year city religious standings are invalid or create multiple established traditions.");
    const ruinedCityIds = new Set(strategicMap.strategicPlayableSettlementState.cityRows.filter((row) => !row.physicalJurisdictionExists).map((row) => row.cityId));
    if (directory.cityStandingRows.some((row) => ruinedCityIds.has(row.cityId)) || record.branchRows.filter((branch) => ruinedCityIds.has(branch.originalCityId)).some((branch) => branch.currentStanding !== null || branch.physicalCondition !== "destroyed")) throw new Error("Destroyed cities retain religious standing or functioning original premises.");
    const publicJson = JSON.stringify(directory);
    if (/integrityBand|concealedMisconduct|covertPersistence|exactFactors|sourceEventId|privateDivine|hiddenAttention|exposureRoll|sponsorPolityId/.test(publicJson) || !directory.principles?.divinePowerHistoryNotRecalculated || !directory.principles?.institutionsCreateNoSovereignty) throw new Error("Public religious-institution history leaks hidden integrity, misconduct, sponsorship, attention, or exact causality.");
    if (directory.currentBranchRows.some((branch) => branch.sovereignAuthority) || directory.holySiteCustodyRows.some((row) => row.divineIdentityTransferred || row.religionTransferred || row.createsSovereignty)) throw new Error("The public institution directory violates authority or secrecy boundaries.");
    if (directory.cellFeatures.some((entry) => !/^[0-9a-z]+:[ech]$/.test(entry) || parseInt(entry, 36) >= strategicMap.topology.cellCount)) throw new Error("The playable-year religion globe projection is invalid.");
    if (directory.digest !== `public-religious-institution-history-${StrategicWorld.stableHash(coreWithoutDigest(directory))}` || record.digest !== `strategic-religious-institution-history-${StrategicWorld.stableHash(coreWithoutDigest(record))}`) throw new Error("Religious-institution history does not match its digest.");
    const diagnostics = record.diagnostics;
    if (!diagnostics || diagnostics.branchCount !== record.branchRows.length || diagnostics.retainedEventCount !== record.eventRows.length || diagnostics.publicEventCount !== directory.chronology.length || diagnostics.holySiteCustodyCount !== record.holySiteCustodyRows.length) throw new Error("Religious-institution diagnostics do not match saved facts.");
    return { strategicReligiousInstitutionHistory: clone(record), publicDirectory: clone(directory) };
  }

  function attachStrategicReligiousInstitutionHistory(worldSeed, map) {
    const next = validateSources(map);
    const generated = createStrategicReligiousInstitutionHistory(worldSeed, next);
    next.strategicReligiousInstitutionHistory = generated.strategicReligiousInstitutionHistory;
    next.publicReligiousInstitutionHistoryDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function publicReligiousInstitutionHistory(map) {
    if (!map?.publicReligiousInstitutionHistoryDirectory) return null;
    const directory = clone(map.publicReligiousInstitutionHistoryDirectory);
    const cities = new Map(map.humanGeography.cities.map((city) => [city.id, city]));
    const traditions = new Map(directory.traditionRows.map((tradition) => [tradition.id, tradition]));
    const branches = new Map(directory.currentBranchRows.map((branch) => [branch.id, branch]));
    directory.currentBranchRows = directory.currentBranchRows.map((branch) => ({ ...branch, originalCity: clone(cities.get(branch.originalCityId)), currentCity: clone(cities.get(branch.currentCityId)), tradition: clone(traditions.get(branch.traditionId)) }));
    directory.cityStandingRows = directory.cityStandingRows.map((row) => ({ ...row, city: clone(cities.get(row.cityId)), standings: row.standings.map((entry) => ({ ...entry, tradition: clone(traditions.get(entry.traditionId)), branch: clone(branches.get(entry.branchId)) })) }));
    directory.holySiteCustodyRows = directory.holySiteCustodyRows.map((row) => ({ ...row, custodian: clone(branches.get(row.custodianInstitutionId)) }));
    return directory;
  }

  function cityCurrentReligiousInstitutions(map, cityId) {
    const directory = publicReligiousInstitutionHistory(map);
    return directory?.cityStandingRows.find((row) => row.cityId === cityId) || null;
  }

  function cellPublicReligiousInstitutionSnapshot(map, index) {
    const directory = publicReligiousInstitutionHistory(map);
    if (!directory || !Number.isInteger(index) || index < 0 || index >= map.topology.cellCount) return null;
    const cellId = StrategicWorld.cellId(index);
    const city = map.humanGeography.cities.find((entry) => entry.cellId === cellId);
    return { cellId, publicClass: ({ c: "organizedReligiousBranches", e: "establishedFaithCity", h: "confirmedHolySite" })[map.publicReligiousInstitutionHistoryDirectory.cellFeatures.find((entry) => parseInt(entry, 36) === index)?.split(":")[1]] || "noMajorPublicReligiousFeature", cityStanding: city ? directory.cityStandingRows.find((row) => row.cityId === city.id) || null : null, branches: directory.currentBranchRows.filter((branch) => branch.cellId === cellId && branch.publicPhysicalPresence), holySites: directory.holySiteCustodyRows.filter((site) => site.cellId === cellId), chronology: directory.chronology.filter((event) => event.cellId === cellId) };
  }

  function auditStrategicReligiousInstitutionHistory(map) {
    const { strategicReligiousInstitutionHistory: record, publicDirectory } = validateStrategicReligiousInstitutionHistory(map);
    return {
      valid: true,
      oneAggregateBranchPerCityTradition: new Set(record.branchRows.map((branch) => `${branch.originalCityId}|${branch.traditionId}`)).size === record.branchRows.length,
      everyBranchFoundedAfterItsCity: record.branchRows.every((branch) => branch.foundingYear >= StrategicCityExpansion.allCitySeeds(map).find((city) => city.cityId === branch.originalCityId).foundingYear),
      everyRetainedChangeCausallySourced: record.eventRows.every((event) => event.prerequisites.length && event.cause && event.stateDeltas.length),
      activeGodCensureCreatesNoConfirmedSchism: record.branchRows.every((branch) => !["censured", "estranged"].includes(branch.divineRelationship) || !publicDirectory.traditionRows.find((tradition) => tradition.id === branch.traditionId)?.sameGodHeresyClaimsValid),
      successorsRemainUnconfirmed: publicDirectory.traditionRows.filter((tradition) => tradition.kind === "unconfirmedSuccessorTradition").every((tradition) => tradition.confirmationState === "unconfirmedSuccessor" && !tradition.sameGodHeresyClaimsValid),
      destroyedCitiesHaveNoStandingOrPremises: record.branchRows.filter((branch) => !map.strategicPlayableSettlementState.cityRows.find((city) => city.cityId === branch.originalCityId).physicalJurisdictionExists).every((branch) => branch.currentStanding === null && branch.physicalCondition === "destroyed"),
      holySiteCustodyTransfersNoIdentityOrSovereignty: record.holySiteCustodyRows.every((row) => !row.divineIdentityTransferred && !row.religionTransferred && !row.createsSovereignty),
      publicHistoryHidesIntegrityMisconductAndCovertInfluence: !JSON.stringify(publicDirectory).match(/integrityBand|concealedMisconduct|covertPersistence|exactFactors|sourceEventId|exposureRoll|sponsorPolityId/),
      divinePowerHistoryNotRecalculated: publicDirectory.principles.divinePowerHistoryNotRecalculated,
      diagnostics: clone(record.diagnostics)
    };
  }

  return Object.freeze({
    PHYSICAL_CONDITIONS, OPERATIONAL_STATUSES, INTEGRITY_BANDS, DIVINE_RELATIONSHIPS, EVENT_KINDS, MISCONDUCT_KINDS, CUSTODY_STATUSES,
    createStrategicReligiousInstitutionHistory, validateStrategicReligiousInstitutionHistory, attachStrategicReligiousInstitutionHistory,
    publicReligiousInstitutionHistory, cityCurrentReligiousInstitutions, cellPublicReligiousInstitutionSnapshot, auditStrategicReligiousInstitutionHistory
  });
});
