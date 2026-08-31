(function initStrategicEnforcementPracticeHistory(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const strategicCityLaws = typeof module === "object" && module.exports ? require("./strategic-city-laws") : root?.HelixStrategicCityLaws;
  const strategicLegalHistory = typeof module === "object" && module.exports ? require("./strategic-legal-history") : root?.HelixStrategicLegalHistory;
  const strategicPublicAttitudes = typeof module === "object" && module.exports ? require("./strategic-public-attitude-history") : root?.HelixStrategicPublicAttitudeHistory;
  const strategicCivicHistory = typeof module === "object" && module.exports ? require("./strategic-civic-history") : root?.HelixStrategicCivicHistory;
  const strategicPlayableSettlements = typeof module === "object" && module.exports ? require("./strategic-playable-settlement-state") : root?.HelixStrategicPlayableSettlementState;
  const strategicReligiousHistory = typeof module === "object" && module.exports ? require("./strategic-religious-institution-history") : root?.HelixStrategicReligiousInstitutionHistory;
  const strategicNetworkHistory = typeof module === "object" && module.exports ? require("./strategic-non-state-network-history") : root?.HelixStrategicNonStateNetworkHistory;
  const api = factory(strategicWorld, strategicCityLaws, strategicLegalHistory, strategicPublicAttitudes, strategicCivicHistory, strategicPlayableSettlements, strategicReligiousHistory, strategicNetworkHistory);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicEnforcementPracticeHistory = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicEnforcementPracticeHistoryApi(StrategicWorld, StrategicCityLaws, StrategicLegalHistory, StrategicPublicAttitudes, StrategicCivicHistory, StrategicPlayableSettlements, StrategicReligiousHistory, StrategicNetworkHistory) {
  "use strict";

  if (!StrategicWorld || !StrategicCityLaws || !StrategicLegalHistory || !StrategicPublicAttitudes || !StrategicCivicHistory || !StrategicPlayableSettlements || !StrategicReligiousHistory || !StrategicNetworkHistory) throw new Error("Law, legal, attitude, civic, settlement, religious, and network history must load before strategic-enforcement-practice-history.js");

  const PIPELINE_STAGES = Object.freeze([
    Object.freeze({ id: "reportIntake", label: "Report intake", role: "civilWatch" }),
    Object.freeze({ id: "investigation", label: "Investigation", role: "civilWatch" }),
    Object.freeze({ id: "prosecutionScreening", label: "Prosecution screening", role: "publicProsecution" }),
    Object.freeze({ id: "courtAdjudication", label: "Court adjudication", role: "judiciary" }),
    Object.freeze({ id: "temporaryJail", label: "Temporary jail", role: "temporaryJailAuthority" }),
    Object.freeze({ id: "longTermCorrections", label: "Long-term corrections", role: "longTermCorrectionsAuthority" })
  ]);
  const DECLARED_PRIORITIES = Object.freeze(["low", "standard", "elevated", "critical"]);
  const INTAKE_POSTURES = Object.freeze(["open", "screened", "authorizationFirst", "emergencyFocused", "suspended"]);
  const SELECTIVE_TOLERANCES = Object.freeze(["none", "nonharmfulStatusDeviation", "administrativeCorrectionFirst", "resourceDrivenDeferral"]);
  const INTERFERENCE_KINDS = Object.freeze(["none", "overtOccupationDirection", "capturedAppointments", "covertNetworkInfluence"]);
  const OPERATIONAL_STATES = Object.freeze(["operational", "constrained", "disrupted", "suspended"]);
  const DEMAND_BANDS = Object.freeze(["minimal", "low", "moderate", "high", "extreme"]);
  const BACKLOG_BANDS = Object.freeze(["clear", "manageable", "accumulating", "severe", "critical", "suspended"]);
  const DELAY_BANDS = Object.freeze(["prompt", "short", "moderate", "long", "severe", "suspended"]);
  const OBSERVATION_CONFIDENCE = Object.freeze(["fragmentary", "credible", "wellDocumented"]);
  const EVENT_KINDS = Object.freeze(["legalPriorityRevision", "directiveAdministrativeFocus", "institutionalInterference", "covertInterference", "religiousReferralShift"]);
  const DIRECTIVE_OFFENSES = Object.freeze({
    curfew: Object.freeze(["warrantObstruction", "violentResistance", "failureToAppear"]),
    checkpointControl: Object.freeze(["contrabandCommerce", "warrantObstruction", "evidenceTampering"]),
    movementRestriction: Object.freeze(["abductionAndConfinement", "warrantObstruction", "violentResistance"]),
    rationingOrder: Object.freeze(["fraudAndCorruption", "emergencyInterference", "propertyOffenses"]),
    emergencySeizure: Object.freeze(["propertyOffenses", "fraudAndCorruption", "emergencyInterference"]),
    weaponsControl: Object.freeze(["unlawfulViolence", "homicide", "violentResistance"])
  });
  const CAPACITY_BANDS = Object.freeze(["fragile", "strained", "functional", "strong", "exceptional"]);
  const PRESSURE_BANDS = Object.freeze(["minimal", "low", "mixed", "high", "intense"]);

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function coreWithoutDigest(value) { const core = clone(value); delete core.digest; return core; }
  function seededNumber(seed, channel) { return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff; }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
  function shift(values, value, amount) { return values[clamp(values.indexOf(value) + amount, 0, values.length - 1)]; }

  function validateSources(map) {
    if (!map?.digest || !map?.topology || !map?.humanGeography) throw new Error("Enforcement-practice history requires a finalized strategic world.");
    const strategicMap = map;
    const requiredRecords = [
      strategicMap.cityLegalCodes,
      strategicMap.strategicLegalHistory,
      strategicMap.strategicPublicAttitudeHistory,
      strategicMap.strategicCivicHistory,
      strategicMap.strategicPlayableSettlementState,
      strategicMap.strategicReligiousInstitutionHistory,
      strategicMap.strategicNonStateNetworkHistory
    ];
    const requiredDirectories = [
      strategicMap.publicCityLawDirectory,
      strategicMap.publicLegalHistoryDirectory,
      strategicMap.publicAttitudeHistoryDirectory,
      strategicMap.publicCivicHistoryDirectory,
      strategicMap.publicPlayableSettlementDirectory,
      strategicMap.publicReligiousInstitutionHistoryDirectory,
      strategicMap.publicNonStateNetworkHistoryDirectory
    ];
    if (requiredRecords.some((record) => !record?.digest) || requiredDirectories.some((directory) => !directory?.digest)) throw new Error("Enforcement-practice history requires finalized law, legal, attitude, civic, settlement, religious, and network history sources.");
    return strategicMap;
  }

  function declaredPriority(rule) {
    return ({ unregulated: "low", tolerated: "low", licensed: "standard", restricted: "elevated", prohibited: "critical" })[rule.legalStatus];
  }

  function intakePosture(rule, reportingBand, hasDirective, jurisdictionExists) {
    if (!jurisdictionExists) return "suspended";
    if (hasDirective) return "emergencyFocused";
    if (["licensed", "restricted"].includes(rule.legalStatus)) return "authorizationFirst";
    if (["minimal", "low"].includes(reportingBand)) return "screened";
    return "open";
  }

  function createStrategicEnforcementPracticeHistory(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for enforcement-practice history.");
    const strategicMap = validateSources(map);
    const horizon = strategicMap.strategicLegalHistory.historicalHorizonYear;
    const cities = strategicMap.humanGeography.cities;
    const cityById = new Map(cities.map((city) => [city.id, city]));
    const governmentByCityId = new Map(strategicMap.cityGovernments.governments.map((government) => [government.cityId, government]));
    const settlementByCityId = new Map(strategicMap.strategicPlayableSettlementState.cityRows.map((row) => [row.cityId, row]));
    const institutionById = new Map(strategicMap.strategicCivicHistory.currentInstitutionRows.map((row) => [row.institutionId, row]));
    const publicInstitutionById = new Map(strategicMap.publicCivicHistoryDirectory.currentInstitutionRows.map((row) => [row.institutionId, row]));
    const attitudeByKey = new Map(strategicMap.strategicPublicAttitudeHistory.currentProfileRows.map((row) => [`${row.cityId}|${row.offenseId}`, row]));
    const codeByCityId = new Map(StrategicLegalHistory.currentRecognizedCityCodes(strategicMap).map((code) => [code.city.id, code]));
    const activeDirectivesByCity = new Map(cities.map((city) => [city.id, strategicMap.strategicLegalHistory.directiveRows.filter((row) => row.cityId === city.id && row.status === "active")]));
    const directiveById = new Map(strategicMap.strategicLegalHistory.directiveRows.map((directive) => [directive.id, directive]));
    const hiddenByKey = new Map(cities.flatMap((city) => StrategicCityLaws.hiddenEnforcementFor(strategicMap, city.id).map((row) => [`${city.id}|${row.offenseId}`, row])));
    const offenseById = new Map(StrategicCityLaws.OFFENSE_CATALOG.map((offense) => [offense.id, offense]));
    const eventRows = [];

    function addEvent(details) {
      eventRows.push({
        id: `enforcement-practice-event:${String(eventRows.length + 1).padStart(4, "0")}`,
        kind: details.kind, year: details.year, cityId: details.cityId, offenseIds: clone(details.offenseIds || []), stageIds: clone(details.stageIds || []),
        participantInstitutionIds: clone(details.participantInstitutionIds || []), sourceLayer: details.sourceLayer, sourceEventId: details.sourceEventId,
        prerequisites: clone(details.prerequisites), cause: details.cause, exactFactors: clone(details.exactFactors || {}), stateDeltas: clone(details.stateDeltas),
        publiclyKnown: Boolean(details.publiclyKnown), publicConfidence: details.publicConfidence || "credible", publicEvidence: clone(details.publicEvidence || []),
        publicAccount: details.publicAccount || "", changesRecognizedLaw: false, changesOffenseElements: false, establishesGuilt: false,
        changesEvidenceReliability: false, convictionAuthority: false
      });
    }

    for (const amendment of strategicMap.strategicLegalHistory.amendmentRows) {
      if (!amendment.change?.offenseId) continue;
      addEvent({ kind: "legalPriorityRevision", year: amendment.year, cityId: amendment.cityId, offenseIds: [amendment.change.offenseId],
        participantInstitutionIds: [amendment.enactedByInstitutionId, amendment.reviewedByInstitutionId], sourceLayer: "legalHistory", sourceEventId: amendment.id,
        prerequisites: [amendment.id, "publishedProspectiveAmendment"], cause: amendment.kind, exactFactors: { prospectiveOnly: true },
        stateDeltas: [{ field: "declaredPriority", basis: "currentRecognizedLegalStatus" }], publiclyKnown: true, publicConfidence: "wellDocumented",
        publicEvidence: ["publishedCode", "amendmentRecord"], publicAccount: `${cityById.get(amendment.cityId)?.name || amendment.cityId} revised its published enforcement priority after a prospective code amendment.` });
    }
    for (const directive of strategicMap.strategicLegalHistory.directiveRows.filter((row) => row.status === "active")) {
      addEvent({ kind: "directiveAdministrativeFocus", year: directive.year, cityId: directive.cityId, offenseIds: clone(DIRECTIVE_OFFENSES[directive.kind] || []), stageIds: ["reportIntake", "investigation"],
        participantInstitutionIds: [directive.issuedThroughInstitutionId], sourceLayer: "legalHistory", sourceEventId: directive.id,
        prerequisites: [directive.id, "activeUnexpiredDirective"], cause: directive.kind, exactFactors: { scope: directive.scope, expiresYear: directive.expiresYear },
        stateDeltas: [{ field: "intakePosture", resultingValue: "emergencyFocused" }], publiclyKnown: true, publicConfidence: "wellDocumented",
        publicEvidence: ["publishedDirective", "expirationRecord"], publicAccount: `${cityById.get(directive.cityId)?.name || directive.cityId} is applying a temporary ${directive.kind} directive to administrative checks within its published scope; it creates no conviction authority.` });
    }

    const interferenceByCity = new Map();
    for (const city of cities) {
      const government = governmentByCityId.get(city.id);
      const justiceIds = [...new Set(PIPELINE_STAGES.map((stage) => government.roleAssignments[stage.role]))];
      const affected = justiceIds.map((id) => institutionById.get(id)).filter((row) => ["overtOccupation", "capturedAppointments"].includes(row?.actualControlStatus));
      if (!affected.length) continue;
      const kind = affected.some((row) => row.actualControlStatus === "capturedAppointments") ? "capturedAppointments" : "overtOccupationDirection";
      const sourceEvent = [...strategicMap.strategicCivicHistory.eventRows].reverse().find((event) => event.cityId === city.id && event.affectedInstitutionIds.some((id) => affected.some((row) => row.institutionId === id)));
      if (!sourceEvent) continue;
      interferenceByCity.set(city.id, { kind, institutionIds: affected.map((row) => row.institutionId), sourceEventId: sourceEvent.id });
      addEvent({ kind: "institutionalInterference", year: sourceEvent.year, cityId: city.id, offenseIds: StrategicCityLaws.OFFENSE_CATALOG.filter((offense) => seededNumber(seed, `institutional-interference:${city.id}:${offense.id}`) < 0.28).map((offense) => offense.id),
        stageIds: PIPELINE_STAGES.filter((stage) => affected.some((row) => row.institutionId === government.roleAssignments[stage.role])).map((stage) => stage.id), participantInstitutionIds: affected.map((row) => row.institutionId),
        sourceLayer: "civicHistory", sourceEventId: sourceEvent.id, prerequisites: [sourceEvent.id, "institutionActuallyDirectedOrCaptured"], cause: kind,
        exactFactors: { actualControlStatuses: affected.map((row) => row.actualControlStatus) }, stateDeltas: [{ field: "hiddenInterference", resultingValue: kind }],
        publiclyKnown: kind === "overtOccupationDirection", publicConfidence: "wellDocumented", publicEvidence: kind === "overtOccupationDirection" ? ["occupationRegistry", "publicInstitutionalRecord"] : [],
        publicAccount: kind === "overtOccupationDirection" ? `${city.name}'s visible justice throughput reflects direction of the specifically occupied institutions; unaffected institutions retain their charter authority.` : "" });
    }

    const networkById = new Map(strategicMap.strategicNonStateNetworkHistory.networkRows.map((row) => [row.networkId, row]));
    const covertByCity = new Map();
    for (const cell of strategicMap.strategicNonStateNetworkHistory.covertRows.filter((row) => row.status === "active" && networkById.get(row.networkId)?.category === "blackMarket" && ["negligible", "limited"].includes(row.integrityBand))) {
      const government = governmentByCityId.get(cell.cityId);
      if (!government) continue;
      const targets = [government.roleAssignments.civilWatch, government.roleAssignments.publicProsecution].filter((id) => ["subordinate", "constrained"].includes(institutionById.get(id)?.currentIndependenceBand));
      if (!targets.length) continue;
      covertByCity.set(cell.cityId, { kind: "covertNetworkInfluence", institutionIds: targets, sourceEventId: cell.id });
      addEvent({ kind: "covertInterference", year: cell.foundingYear, cityId: cell.cityId, offenseIds: ["contrabandCommerce", "fraudAndCorruption", "evidenceTampering"], stageIds: ["reportIntake", "investigation", "prosecutionScreening"],
        participantInstitutionIds: targets, sourceLayer: "nonStateNetworkHistory", sourceEventId: cell.id, prerequisites: [cell.id, "activeBlackMarketCell", "constrainedJusticeIndependence"], cause: "covertNetworkInfluence",
        exactFactors: { networkId: cell.networkId, cellKind: cell.kind }, stateDeltas: [{ field: "hiddenInterference", resultingValue: "covertNetworkInfluence" }], publiclyKnown: false, publicEvidence: [] });
    }

    for (const event of strategicMap.strategicReligiousInstitutionHistory.eventRows.filter((row) => row.publiclyKnown && ["misconduct", "divineCensure", "standingChanged"].includes(row.kind))) {
      addEvent({ kind: "religiousReferralShift", year: event.year, cityId: event.cityId, offenseIds: ["fraudAndCorruption", "falseStatement", "evidenceTampering"], stageIds: ["reportIntake"],
        participantInstitutionIds: [], sourceLayer: "religiousInstitutionHistory", sourceEventId: event.id, prerequisites: [event.id, "publiclySupportedInstitutionalEvent"], cause: event.kind,
        exactFactors: { branchIds: clone(event.branchIds) }, stateDeltas: [{ field: "reportAvailability", effect: "qualitativeReferralShiftOnly" }], publiclyKnown: true, publicConfidence: "credible",
        publicEvidence: clone(event.publicEvidence), publicAccount: `${cityById.get(event.cityId)?.name || event.cityId} recorded a change in institutional referrals after a supported religious-institution event; this does not establish truth, evidence reliability, or guilt.` });
    }

    eventRows.sort((left, right) => left.year - right.year || left.id.localeCompare(right.id));
    const practiceRows = [];
    for (const city of cities) {
      const settlement = settlementByCityId.get(city.id);
      const code = codeByCityId.get(city.id);
      const directives = activeDirectivesByCity.get(city.id);
      for (const rule of code.offenseRules) {
        const hidden = hiddenByKey.get(`${city.id}|${rule.offenseId}`);
        const attitude = attitudeByKey.get(`${city.id}|${rule.offenseId}`);
        const scopedDirectives = directives.filter((directive) => (DIRECTIVE_OFFENSES[directive.kind] || []).includes(rule.offenseId));
        const interference = covertByCity.get(city.id) || interferenceByCity.get(city.id) || { kind: "none", institutionIds: [], sourceEventId: null };
        const applies = interference.kind !== "none" && (interference.kind !== "covertNetworkInfluence" || ["contrabandCommerce", "fraudAndCorruption", "evidenceTampering"].includes(rule.offenseId));
        const amendment = [...strategicMap.strategicLegalHistory.amendmentRows].reverse().find((row) => row.cityId === city.id && row.change?.offenseId === rule.offenseId);
        const statusShift = amendment ? Math.sign(StrategicCityLaws.LEGAL_STATUSES.indexOf(amendment.change.previousValue) - StrategicCityLaws.LEGAL_STATUSES.indexOf(amendment.change.resultingValue)) : 0;
        let actualPriority = shift(StrategicCityLaws.ENFORCEMENT_PRIORITIES, hidden.priority, statusShift + (scopedDirectives.length ? 1 : 0) - (applies ? 1 : 0));
        const government = governmentByCityId.get(city.id);
        const prosecutionCapacity = CAPACITY_BANDS.indexOf(institutionById.get(government.roleAssignments.publicProsecution).currentCapacityBand);
        const resourceCommitment = shift(StrategicCityLaws.RESOURCE_ALLOCATIONS, hidden.resourceAllocation, prosecutionCapacity < 2 ? -1 : prosecutionCapacity > 3 ? 1 : 0);
        practiceRows.push({
          id: `enforcement-practice:${city.id.slice(5)}:${rule.offenseId}`, cityId: city.id, offenseId: rule.offenseId, currentLegalStatus: rule.legalStatus,
          declaredPriority: declaredPriority(rule), foundingActualPriority: hidden.priority, actualPriority, foundingResourceCommitment: hidden.resourceAllocation, resourceCommitment,
          reportIntake: intakePosture(rule, attitude.pressures.reportingCooperation, scopedDirectives.length > 0, settlement.physicalJurisdictionExists),
          selectiveTolerance: hidden.toleratedDeviation === "nonharmfulStatusViolation" ? "nonharmfulStatusDeviation" : (hidden.resourceAllocation === "scarce" && hidden.priority !== "critical" ? "resourceDrivenDeferral" : "none"),
          reportingCooperation: attitude.pressures.reportingCooperation, activeDirectiveIds: scopedDirectives.map((directive) => directive.id), hiddenInterference: applies ? interference.kind : "none",
          hiddenInterferenceInstitutionIds: applies ? clone(interference.institutionIds) : [], hiddenInterferenceSourceEventId: applies ? interference.sourceEventId : null,
          proofStandard: code.procedure.criminalProofStandard, chargeElementsMustBeProvenSeparately: code.procedure.chargeElementsMustBeProvenSeparately,
          reportingChangesTruthOrEvidence: false, establishesGuilt: false, directiveConvictionAuthority: false, physicalJurisdictionExists: settlement.physicalJurisdictionExists
        });
      }
    }

    const pipelineRows = [];
    for (const city of cities) {
      const settlement = settlementByCityId.get(city.id);
      const government = governmentByCityId.get(city.id);
      const code = codeByCityId.get(city.id);
      const cityProfiles = StrategicCityLaws.OFFENSE_CATALOG.map((offense) => attitudeByKey.get(`${city.id}|${offense.id}`));
      const reportingIndex = Math.round(cityProfiles.reduce((sum, row) => sum + PRESSURE_BANDS.indexOf(row.pressures.reportingCooperation), 0) / cityProfiles.length);
      const activeDirectiveCount = activeDirectivesByCity.get(city.id).length;
      const component = strategicMap.strategicPlayableSettlementState.currentSupportComponents.find((entry) => (entry.cityIds || entry.assetIds || []).includes(city.id));
      const supportSize = component?.cityIds?.length || component?.assetIds?.length || 1;
      for (const [stageIndex, stage] of PIPELINE_STAGES.entries()) {
        const institutionId = government.roleAssignments[stage.role];
        const institution = institutionById.get(institutionId);
        const publicInstitution = publicInstitutionById.get(institutionId);
        const suspended = !settlement.physicalJurisdictionExists || institution.operationalStatus === "displaced";
        const operationalState = suspended ? "suspended" : institution.operationalStatus === "disrupted" ? "disrupted" : institution.operationalStatus === "strained" || CAPACITY_BANDS.indexOf(institution.currentCapacityBand) < 2 ? "constrained" : "operational";
        const capacityIndex = CAPACITY_BANDS.indexOf(institution.currentCapacityBand);
        let workloadIndex = clamp(Math.round(Math.log10(Math.max(10, settlement.currentPopulation))) - 2 + reportingIndex + Math.min(2, activeDirectiveCount), 0, 8);
        if (stage.id === "temporaryJail") workloadIndex += ({ presumptionOfRelease: -2, conditionalRelease: -1, securedRelease: 0, detentionFavored: 1 })[code.procedure.pretrialReleaseRule] || 0;
        if (stage.id === "longTermCorrections") workloadIndex += code.offenseRules.filter((rule) => rule.sentencing.finitePrisonRangeMonths).length > StrategicCityLaws.OFFENSE_CATALOG.length / 2 ? 1 : 0;
        workloadIndex = clamp(workloadIndex, 0, 8);
        const pressure = workloadIndex - capacityIndex;
        const demandBand = DEMAND_BANDS[clamp(Math.floor(workloadIndex / 2), 0, 4)];
        const backlogBand = suspended ? "suspended" : BACKLOG_BANDS[clamp(pressure + 1, 0, 4)];
        const delayBand = suspended ? "suspended" : DELAY_BANDS[clamp(pressure + (stageIndex >= 3 ? 1 : 0), 0, 4)];
        const hidden = covertByCity.get(city.id) || interferenceByCity.get(city.id) || { kind: "none", institutionIds: [] };
        pipelineRows.push({
          id: `justice-throughput:${city.id.slice(5)}:${stage.id}`, cityId: city.id, stageId: stage.id, stageLabel: stage.label, responsibleRole: stage.role, responsibleInstitutionId: institutionId,
          operationalState, actualCapacityBand: institution.currentCapacityBand, publicCapacityBand: publicInstitution.capacityBand, demandBand, backlogBand, delayBand, exactWorkloadIndex: workloadIndex,
          facilityConstraint: suspended ? "noFunctioningLocalJurisdiction" : settlement.physicalCondition === "intact" ? "noneObserved" : `${settlement.physicalCondition}CivicFacilities`,
          routeConstraint: suspended ? "physicalJurisdictionAbsent" : supportSize > 1 ? "connectedSupportRoutes" : "localRoutesOnly",
          hiddenInterference: hidden.institutionIds.includes(institutionId) ? hidden.kind : "none", proofStandard: code.procedure.criminalProofStandard,
          caseCountGenerated: false, crimeTotalGenerated: false, convictionRateGenerated: false, individualCasesSimulated: false,
          jailAndPrisonDistinct: government.roleAssignments.temporaryJailAuthority !== government.roleAssignments.longTermCorrectionsAuthority,
          routeAccessChangesAuthority: false, reportingChangesTruthOrEvidence: false
        });
      }
    }

    const publicPracticeRows = practiceRows.map((row) => ({
      id: row.id, cityId: row.cityId, offenseId: row.offenseId, currentLegalStatus: row.currentLegalStatus, declaredPriority: row.declaredPriority, reportIntake: row.reportIntake,
      activeDirectives: row.activeDirectiveIds.map((id) => { const directive = directiveById.get(id); return { id, kind: directive.kind, scope: directive.scope, expiresYear: directive.expiresYear, convictionAuthority: false }; }),
      observationConfidence: row.activeDirectiveIds.length ? "wellDocumented" : "credible", proofStandard: row.proofStandard, chargeElementsMustBeProvenSeparately: row.chargeElementsMustBeProvenSeparately,
      reportingChangesTruthOrEvidence: false, establishesGuilt: false, directiveConvictionAuthority: false, physicalJurisdictionExists: row.physicalJurisdictionExists
    }));
    const publicPipelineRows = pipelineRows.map((row) => ({
      id: row.id, cityId: row.cityId, stageId: row.stageId, stageLabel: row.stageLabel, responsibleRole: row.responsibleRole, responsibleInstitutionId: row.responsibleInstitutionId,
      operationalState: row.operationalState, capacityBand: row.publicCapacityBand, demandBand: row.demandBand, backlogBand: row.backlogBand, delayBand: row.delayBand,
      facilityConstraint: row.facilityConstraint, routeConstraint: row.routeConstraint, observationConfidence: row.operationalState === "operational" ? "wellDocumented" : "credible",
      proofStandard: row.proofStandard, qualitativeAggregateOnly: true, exactWorkloadPublic: false, caseCountsPublished: false, convictionRatesPublished: false,
      routeAccessChangesAuthority: false, reportingChangesTruthOrEvidence: false
    }));
    const publicEvents = eventRows.filter((event) => event.publiclyKnown && event.publicEvidence.length).map((event) => ({
      id: event.id, kind: event.kind, year: event.year, cityId: event.cityId, offenseIds: clone(event.offenseIds), stageIds: clone(event.stageIds), participantInstitutionIds: clone(event.participantInstitutionIds),
      confidence: event.publicConfidence, evidence: clone(event.publicEvidence), account: event.publicAccount, changesRecognizedLaw: false, establishesGuilt: false, convictionAuthority: false
    }));
    const publicDirectory = {
      historicalHorizonYear: horizon, knowledgePolicy: "declaredPrioritiesAndObservableQualitativeThroughputWithHiddenPracticeWorkloadAndInterferenceRedacted",
      practiceRows: publicPracticeRows, pipelineRows: publicPipelineRows, chronology: publicEvents,
      principles: { aggregateQualitativeHistoryOnly: true, noCasesCrimeTotalsOrConvictionRatesGenerated: true, reportingChangesAvailabilityNotTruth: true, directivesCreateNoConvictionAuthority: true, proofBeyondReasonableDoubtPreserved: true, jailAndPrisonRemainDistinct: true, destroyedCitiesHaveNoPhysicalJurisdiction: true, occupationEffectsRemainInstitutionSpecific: true, priorHistoryNotRecalculated: true }
    };
    publicDirectory.digest = `public-enforcement-practice-history-${StrategicWorld.stableHash(coreWithoutDigest(publicDirectory))}`;
    const record = {
      historicalHorizonYear: horizon, sourceLegalHistoryDigest: strategicMap.strategicLegalHistory.digest, sourcePublicAttitudeHistoryDigest: strategicMap.strategicPublicAttitudeHistory.digest,
      sourceCivicHistoryDigest: strategicMap.strategicCivicHistory.digest, sourcePlayableSettlementStateDigest: strategicMap.strategicPlayableSettlementState.digest,
      sourceReligiousInstitutionHistoryDigest: strategicMap.strategicReligiousInstitutionHistory.digest, sourceNonStateNetworkHistoryDigest: strategicMap.strategicNonStateNetworkHistory.digest,
      offenseCatalogDigest: StrategicWorld.stableHash(StrategicCityLaws.OFFENSE_CATALOG), publicDirectoryDigest: publicDirectory.digest,
      eventRows, practiceRows, pipelineRows,
      principles: clone(publicDirectory.principles),
      diagnostics: { cityCount: cities.length, offenseCount: StrategicCityLaws.OFFENSE_CATALOG.length, practiceRowCount: practiceRows.length, pipelineStageCount: pipelineRows.length, retainedEventCount: eventRows.length, publicEventCount: publicEvents.length, suspendedStageCount: pipelineRows.filter((row) => row.operationalState === "suspended").length, interferenceEventCount: eventRows.filter((event) => ["institutionalInterference", "covertInterference"].includes(event.kind)).length }
    };
    record.digest = `strategic-enforcement-practice-history-${StrategicWorld.stableHash(coreWithoutDigest(record))}`;
    return { strategicEnforcementPracticeHistory: record, publicDirectory };
  }

  function validateStrategicEnforcementPracticeHistory(map, record = map?.strategicEnforcementPracticeHistory, directory = map?.publicEnforcementPracticeDirectory) {
    const strategicMap = validateSources(map);
    const cityCount = strategicMap.humanGeography.cities.length;
    const offenseCount = StrategicCityLaws.OFFENSE_CATALOG.length;
    if (!record || !directory || record.sourceLegalHistoryDigest !== strategicMap.strategicLegalHistory.digest || record.sourcePublicAttitudeHistoryDigest !== strategicMap.strategicPublicAttitudeHistory.digest || record.sourceCivicHistoryDigest !== strategicMap.strategicCivicHistory.digest || record.sourcePlayableSettlementStateDigest !== strategicMap.strategicPlayableSettlementState.digest || record.sourceReligiousInstitutionHistoryDigest !== strategicMap.strategicReligiousInstitutionHistory.digest || record.sourceNonStateNetworkHistoryDigest !== strategicMap.strategicNonStateNetworkHistory.digest || record.publicDirectoryDigest !== directory.digest) throw new Error("Enforcement-practice history is incomplete or source-inconsistent.");
    if (record.practiceRows.length !== cityCount * offenseCount || new Set(record.practiceRows.map((row) => `${row.cityId}|${row.offenseId}`)).size !== cityCount * offenseCount || record.practiceRows.some((row) => !DECLARED_PRIORITIES.includes(row.declaredPriority) || !StrategicCityLaws.ENFORCEMENT_PRIORITIES.includes(row.actualPriority) || !StrategicCityLaws.RESOURCE_ALLOCATIONS.includes(row.resourceCommitment) || !INTAKE_POSTURES.includes(row.reportIntake) || !SELECTIVE_TOLERANCES.includes(row.selectiveTolerance) || !INTERFERENCE_KINDS.includes(row.hiddenInterference) || row.proofStandard !== "beyondReasonableDoubt" || !row.chargeElementsMustBeProvenSeparately || row.reportingChangesTruthOrEvidence || row.establishesGuilt || row.directiveConvictionAuthority)) throw new Error("Enforcement practice must cover every city offense without weakening proof or guilt boundaries.");
    if (record.pipelineRows.length !== cityCount * PIPELINE_STAGES.length || new Set(record.pipelineRows.map((row) => `${row.cityId}|${row.stageId}`)).size !== cityCount * PIPELINE_STAGES.length || record.pipelineRows.some((row) => !OPERATIONAL_STATES.includes(row.operationalState) || !CAPACITY_BANDS.includes(row.actualCapacityBand) || !DEMAND_BANDS.includes(row.demandBand) || !BACKLOG_BANDS.includes(row.backlogBand) || !DELAY_BANDS.includes(row.delayBand) || row.caseCountGenerated || row.crimeTotalGenerated || row.convictionRateGenerated || row.individualCasesSimulated || !row.jailAndPrisonDistinct || row.routeAccessChangesAuthority || row.reportingChangesTruthOrEvidence)) throw new Error("Justice throughput must contain six qualitative, bounded stages per city.");
    for (const city of strategicMap.humanGeography.cities) {
      const government = strategicMap.cityGovernments.governments.find((entry) => entry.cityId === city.id);
      const rows = record.pipelineRows.filter((row) => row.cityId === city.id);
      if (rows.find((row) => row.stageId === "temporaryJail")?.responsibleInstitutionId === rows.find((row) => row.stageId === "longTermCorrections")?.responsibleInstitutionId || rows.some((row) => row.responsibleInstitutionId !== government.roleAssignments[PIPELINE_STAGES.find((stage) => stage.id === row.stageId).role])) throw new Error("Justice throughput merged jail with prison or assigned a stage to the wrong institution.");
      const settlement = strategicMap.strategicPlayableSettlementState.cityRows.find((row) => row.cityId === city.id);
      if (!settlement.physicalJurisdictionExists && rows.some((row) => row.operationalState !== "suspended" || row.backlogBand !== "suspended" || row.delayBand !== "suspended")) throw new Error("A destroyed city retains an operating justice pipeline.");
    }
    if (record.eventRows.some((event, index) => !EVENT_KINDS.includes(event.kind) || !Number.isInteger(event.year) || (index && event.year < record.eventRows[index - 1].year) || !event.sourceLayer || !event.sourceEventId || !event.prerequisites.length || !event.cause || !event.stateDeltas.length || event.changesRecognizedLaw || event.changesOffenseElements || event.establishesGuilt || event.changesEvidenceReliability || event.convictionAuthority)) throw new Error("An enforcement-practice event lacks causal sourcing or exceeds its authority boundary.");
    const publicJson = JSON.stringify(directory);
    if (/actualPriority|resourceCommitment|selectiveTolerance|hiddenInterference|exactWorkloadIndex|exactFactors|sourceEventId|covertInterference/.test(publicJson) || directory.practiceRows.length !== record.practiceRows.length || directory.pipelineRows.length !== record.pipelineRows.length || directory.chronology.some((event) => !event.evidence.length)) throw new Error("The public enforcement directory leaks hidden practice, workload, or unsupported allegations.");
    if (directory.digest !== `public-enforcement-practice-history-${StrategicWorld.stableHash(coreWithoutDigest(directory))}` || record.digest !== `strategic-enforcement-practice-history-${StrategicWorld.stableHash(coreWithoutDigest(record))}`) throw new Error("Enforcement-practice history does not match its digest.");
    if (record.diagnostics?.cityCount !== cityCount || record.diagnostics.offenseCount !== offenseCount || record.diagnostics.practiceRowCount !== record.practiceRows.length || record.diagnostics.pipelineStageCount !== record.pipelineRows.length || record.diagnostics.retainedEventCount !== record.eventRows.length || record.diagnostics.publicEventCount !== directory.chronology.length) throw new Error("Enforcement-practice diagnostics do not match saved facts.");
    return { strategicEnforcementPracticeHistory: clone(record), publicDirectory: clone(directory) };
  }

  function attachStrategicEnforcementPracticeHistory(worldSeed, map) {
    const next = validateSources(map);
    const generated = createStrategicEnforcementPracticeHistory(worldSeed, next);
    next.strategicEnforcementPracticeHistory = generated.strategicEnforcementPracticeHistory;
    next.publicEnforcementPracticeDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function publicEnforcementPracticeHistory(map) {
    if (!map?.publicEnforcementPracticeDirectory) return null;
    const directory = clone(map.publicEnforcementPracticeDirectory);
    const cityById = new Map(map.humanGeography.cities.map((city) => [city.id, city]));
    const offenseById = new Map(StrategicCityLaws.OFFENSE_CATALOG.map((offense) => [offense.id, offense]));
    const institutionById = new Map(map.cityGovernments.governments.flatMap((government) => government.institutions).map((institution) => [institution.id, institution]));
    directory.practiceRows = directory.practiceRows.map((row) => ({ ...row, city: clone(cityById.get(row.cityId)), offense: clone(offenseById.get(row.offenseId)) }));
    directory.pipelineRows = directory.pipelineRows.map((row) => ({ ...row, city: clone(cityById.get(row.cityId)), responsibleInstitution: clone(institutionById.get(row.responsibleInstitutionId)) }));
    directory.chronology = directory.chronology.map((event) => ({ ...event, city: clone(cityById.get(event.cityId)) }));
    return directory;
  }

  function currentCityEnforcementProfile(map, cityId) {
    const directory = publicEnforcementPracticeHistory(map);
    if (!directory) return null;
    return { cityId, practices: directory.practiceRows.filter((row) => row.cityId === cityId), pipeline: directory.pipelineRows.filter((row) => row.cityId === cityId), chronology: directory.chronology.filter((event) => event.cityId === cityId) };
  }

  function cellPublicEnforcementPracticeSnapshot(map, index) {
    if (!map?.publicEnforcementPracticeDirectory || !Number.isInteger(index) || index < 0 || index >= map.topology.cellCount) return null;
    const cellId = StrategicWorld.cellId(index);
    const city = map.humanGeography.cities.find((entry) => entry.cellId === cellId);
    return { cellId, cityProfile: city ? currentCityEnforcementProfile(map, city.id) : null };
  }

  function auditStrategicEnforcementPracticeHistory(map) {
    const { strategicEnforcementPracticeHistory: record, publicDirectory } = validateStrategicEnforcementPracticeHistory(map);
    const destroyed = new Set(map.strategicPlayableSettlementState.cityRows.filter((row) => !row.physicalJurisdictionExists).map((row) => row.cityId));
    return {
      valid: true,
      onePracticePerCityOffense: record.practiceRows.length === map.humanGeography.cities.length * StrategicCityLaws.OFFENSE_CATALOG.length,
      sixPipelineStagesPerCity: record.pipelineRows.length === map.humanGeography.cities.length * PIPELINE_STAGES.length,
      jailAndPrisonRemainDistinct: map.cityGovernments.governments.every((government) => government.roleAssignments.temporaryJailAuthority !== government.roleAssignments.longTermCorrectionsAuthority),
      destroyedCitiesHaveSuspendedPipelines: record.pipelineRows.filter((row) => destroyed.has(row.cityId)).every((row) => row.operationalState === "suspended"),
      noCasesCrimeTotalsOrConvictionRatesGenerated: record.pipelineRows.every((row) => !row.caseCountGenerated && !row.crimeTotalGenerated && !row.convictionRateGenerated && !row.individualCasesSimulated),
      proofAndGuiltBoundariesPreserved: record.practiceRows.every((row) => row.proofStandard === "beyondReasonableDoubt" && row.chargeElementsMustBeProvenSeparately && !row.establishesGuilt && !row.reportingChangesTruthOrEvidence && !row.directiveConvictionAuthority),
      interferenceAlwaysCausallySourced: record.practiceRows.filter((row) => row.hiddenInterference !== "none").every((row) => row.hiddenInterferenceSourceEventId),
      publicDirectoryHidesActualPracticeWorkloadAndInterference: !JSON.stringify(publicDirectory).match(/actualPriority|resourceCommitment|selectiveTolerance|hiddenInterference|exactWorkloadIndex|exactFactors|sourceEventId|covertInterference/),
      priorHistoryNotRecalculated: publicDirectory.principles.priorHistoryNotRecalculated,
      diagnostics: clone(record.diagnostics)
    };
  }

  return Object.freeze({
    PIPELINE_STAGES, DECLARED_PRIORITIES, INTAKE_POSTURES, SELECTIVE_TOLERANCES, INTERFERENCE_KINDS, OPERATIONAL_STATES, DEMAND_BANDS, BACKLOG_BANDS, DELAY_BANDS, OBSERVATION_CONFIDENCE, EVENT_KINDS,
    createStrategicEnforcementPracticeHistory, validateStrategicEnforcementPracticeHistory, attachStrategicEnforcementPracticeHistory,
    publicEnforcementPracticeHistory, currentCityEnforcementProfile, cellPublicEnforcementPracticeSnapshot, auditStrategicEnforcementPracticeHistory
  });
});
