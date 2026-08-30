(function initStrategicCivicHistory(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const strategicCityGovernments = typeof module === "object" && module.exports ? require("./strategic-city-governments") : root?.HelixStrategicCityGovernments;
  const strategicCrisisHistory = typeof module === "object" && module.exports ? require("./strategic-crisis-history") : root?.HelixStrategicCrisisHistory;
  const strategicPoliticalHistory = typeof module === "object" && module.exports ? require("./strategic-political-history") : root?.HelixStrategicPoliticalHistory;
  const api = factory(strategicWorld, strategicCityGovernments, strategicCrisisHistory, strategicPoliticalHistory);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicCivicHistory = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicCivicHistoryApi(StrategicWorld, StrategicCityGovernments, StrategicCrisisHistory, StrategicPoliticalHistory) {
  "use strict";

  if (!StrategicWorld || !StrategicCityGovernments || !StrategicCrisisHistory || !StrategicPoliticalHistory) throw new Error("World, government, crisis-history, and political-history modules must load before strategic-civic-history.js");

  const EVENT_KINDS = Object.freeze(["crisisInstitutionalDamage", "emergencyReform", "successionReorganization", "tributeAusterity", "occupationAdministration", "appointmentReorganization", "revoltDisruption", "charterRestoration", "institutionalDisplacement"]);
  const OPERATIONAL_STATUSES = Object.freeze(["operational", "strained", "disrupted", "displaced"]);
  const ACTUAL_CONTROL_STATUSES = Object.freeze(["localCharter", "overtOccupation", "capturedAppointments", "displacedCharter"]);
  const PUBLIC_CONTROL_STATUSES = Object.freeze(["localCharter", "overtOccupation", "displacedCharter"]);
  const CAPACITY_BANDS = StrategicCityGovernments.CAPACITY_BANDS;
  const INDEPENDENCE_BANDS = StrategicCityGovernments.INDEPENDENCE_BANDS;
  const SECURITY_ROLES = Object.freeze(["civilWatch", "militaryDefenseCommand", "emergencyManagement"]);
  const CONTINUITY_ROLES = Object.freeze(["centralAdministration", "civicReview"]);
  const CRISIS_ROLES = Object.freeze(["militaryDefenseCommand", "emergencyManagement", "publicWorksAndProvisioning"]);
  const OCCUPATION_ROLES = Object.freeze(["centralAdministration", "civilWatch", "militaryDefenseCommand", "emergencyManagement"]);
  const CAPTURE_ROLES = Object.freeze(["centralAdministration", "civicReview", "civilWatch"]);

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function seededNumber(seed, channel) { return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff; }
  function coreWithoutDigest(value) { const core = clone(value); delete core.digest; return core; }
  function shiftBand(bands, value, delta) { return bands[Math.max(0, Math.min(bands.length - 1, bands.indexOf(value) + delta))]; }
  function publicOperationalStatus(capacityBand, explicitStatus) {
    if (["displaced", "disrupted"].includes(explicitStatus)) return explicitStatus;
    return ["fragile", "strained"].includes(capacityBand) ? "strained" : "operational";
  }

  function validateSources(map) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCityGovernments.validateCityGovernments(strategicMap);
    StrategicCrisisHistory.validateStrategicCrisisHistory(strategicMap);
    StrategicPoliticalHistory.validateStrategicPoliticalHistory(strategicMap);
    return strategicMap;
  }

  function sourceMaps(map) {
    const governments = map.cityGovernments.governments;
    return {
      governmentByCityId: new Map(governments.map((government) => [government.cityId, government])),
      institutionById: new Map(governments.flatMap((government) => government.institutions.map((institution) => [institution.id, institution]))),
      polityByCityId: new Map(map.cityPolities.polities.map((polity) => [polity.cityId, polity])),
      cityById: new Map(map.humanGeography.cities.map((city) => [city.id, city])),
      crisisEventById: new Map(map.strategicCrisisHistory.eventRows.map((event) => [event.id, event])),
      politicalEventById: new Map(map.strategicPoliticalHistory.eventRows.map((event) => [event.id, event])),
      politicalActorIds: new Set(map.strategicPoliticalHistory.actorRows.map((actor) => actor.id)),
      politicalActorById: new Map(map.strategicPoliticalHistory.actorRows.map((actor) => [actor.id, actor]))
    };
  }

  function institutionsForRoles(government, roles) {
    const roleSet = new Set(roles);
    return government.institutions.filter((institution) => institution.roles.some((role) => roleSet.has(role)));
  }

  function baselineRows(map) {
    return map.cityGovernments.governments.flatMap((government) => government.institutions.map((institution) => ({
      cityId: government.cityId,
      polityId: government.polityId,
      institutionId: institution.id,
      roles: clone(institution.roles),
      baselineCapacityBand: institution.capacityBand,
      baselineIndependenceBand: institution.independenceBand,
      charterCommandAuthorityId: institution.commandAuthorityId,
      charterIdentityPreserved: true
    }))).sort((left, right) => left.institutionId.localeCompare(right.institutionId));
  }

  function initialCurrentRows(rows) {
    return new Map(rows.map((row) => [row.institutionId, {
      cityId: row.cityId,
      polityId: row.polityId,
      institutionId: row.institutionId,
      roles: clone(row.roles),
      currentCapacityBand: row.baselineCapacityBand,
      currentIndependenceBand: row.baselineIndependenceBand,
      operationalStatus: publicOperationalStatus(row.baselineCapacityBand, "operational"),
      actualControlStatus: "localCharter",
      actualControllerPolityId: row.polityId,
      captureState: "none",
      lastEventId: null,
      charterIdentityPreserved: true,
      jurisdictionCreated: false
    }]));
  }

  function eventAccount(kind, cityName, sourceEvent, institutions, publicControlStatus) {
    const names = institutions.map((institution) => institution.publicName).join(", ");
    if (kind === "crisisInstitutionalDamage") return `${cityName} recorded lasting operational strain in ${names} after ${sourceEvent.publicAccount || sourceEvent.publicOutcome || "a major ecological crisis"}.`;
    if (kind === "emergencyReform") return `${cityName} reorganized ${names} after a successfully contained ecological emergency.`;
    if (kind === "successionReorganization") return `${cityName} recorded a chartered reorganization of ${names} following the sovereign succession.`;
    if (kind === "tributeAusterity") return `${cityName} reduced the operating margin of ${names} while meeting a publicly recorded tribute obligation.`;
    if (kind === "occupationAdministration") return `${cityName} placed ${names} under overt occupation direction without dissolving its local charter or courts.`;
    if (kind === "appointmentReorganization") return `${cityName} formally retained local institutions while recording new appointments and internal reporting lines.`;
    if (kind === "revoltDisruption") return `${cityName} reported disruption in ${names} during organized resistance to foreign control.`;
    if (kind === "charterRestoration") return `${cityName} restored local charter command over ${names}; damaged capacity did not automatically recover.`;
    if (kind === "institutionalDisplacement") return `${cityName}'s civic institutions survive as displaced charter offices and archives without physical jurisdiction.`;
    return `${cityName} recorded an institutional change affecting ${names} under ${publicControlStatus}.`;
  }

  function createStrategicCivicHistory(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for civic institutional history.");
    const strategicMap = validateSources(map);
    if (strategicMap.strategicCivicHistory || strategicMap.publicCivicHistoryDirectory) throw new Error("Strategic civic history already exists on this world.");
    const source = sourceMaps(strategicMap);
    const baselines = baselineRows(strategicMap);
    const currentById = initialCurrentRows(baselines);
    const eventRows = [];
    let ordinal = 1;

    function applyEpisode({ year, kind, cityId, sourceLayer, sourceEvent, roles, capacityShift = 0, independenceShift = 0, operationalStatus = null, controlStatus = null, controllerPolityId = undefined, captureState = null, actorIds = [], publicKind = kind, publicControlStatus = "localCharter", discoverableHooks = [] }) {
      const government = source.governmentByCityId.get(cityId);
      if (!government) return null;
      const institutions = roles === "all" ? government.institutions : institutionsForRoles(government, roles);
      if (!institutions.length) return null;
      const eventId = `civic-history:${String(ordinal).padStart(3, "0")}`;
      ordinal += 1;
      const stateDeltas = institutions.map((institution) => {
        const row = currentById.get(institution.id);
        const previous = clone(row);
        row.currentCapacityBand = shiftBand(CAPACITY_BANDS, row.currentCapacityBand, capacityShift);
        row.currentIndependenceBand = shiftBand(INDEPENDENCE_BANDS, row.currentIndependenceBand, independenceShift);
        if (operationalStatus) row.operationalStatus = operationalStatus;
        else row.operationalStatus = publicOperationalStatus(row.currentCapacityBand, row.operationalStatus);
        if (controlStatus) row.actualControlStatus = controlStatus;
        if (controllerPolityId !== undefined) row.actualControllerPolityId = controllerPolityId;
        if (captureState) row.captureState = captureState;
        row.lastEventId = eventId;
        return {
          institutionId: institution.id,
          previousCapacityBand: previous.currentCapacityBand,
          resultingCapacityBand: row.currentCapacityBand,
          previousIndependenceBand: previous.currentIndependenceBand,
          resultingIndependenceBand: row.currentIndependenceBand,
          previousOperationalStatus: previous.operationalStatus,
          resultingOperationalStatus: row.operationalStatus,
          previousActualControlStatus: previous.actualControlStatus,
          resultingActualControlStatus: row.actualControlStatus,
          resultingControllerPolityId: row.actualControllerPolityId,
          charterIdentityPreserved: true,
          jurisdictionCreated: false
        };
      });
      const city = source.cityById.get(cityId);
      const publicAccount = eventAccount(publicKind, city.name, sourceEvent, institutions, publicControlStatus);
      const event = {
        id: eventId,
        year,
        kind,
        cityId,
        locationCellId: city.cellId,
        sourceLayer,
        sourceEventId: sourceEvent.id,
        participantActorIds: clone(actorIds),
        affectedInstitutionIds: institutions.map((institution) => institution.id),
        prerequisites: [sourceEvent.id, ...institutions.map((institution) => `charteredInstitution:${institution.id}`)],
        cause: `${sourceLayer}:${sourceEvent.kind}:${sourceEvent.outcome || "retainedEvent"}`,
        exactFactors: { capacityShift, independenceShift, actualControlStatus: controlStatus, actualControllerPolityId: controllerPolityId, captureState, sourceOutcome: sourceEvent.outcome || null },
        stateDeltas,
        charterIdentityPreserved: true,
        createsSovereignty: false,
        createsJurisdiction: false,
        publicProjection: { kind: publicKind, controlStatus: publicControlStatus, account: publicAccount },
        discoverableHooks: [...new Set([...discoverableHooks, ...institutions.map((institution) => `institution-record:${institution.id}`)])]
      };
      eventRows.push(event);
      return event;
    }

    const sourceEvents = [
      ...strategicMap.strategicCrisisHistory.eventRows.map((event) => ({ layer: "crisisHistory", event })),
      ...strategicMap.strategicPoliticalHistory.eventRows.filter((event) => ["authorityAccession", "intercityCampaign", "subjectRevolt", "claimantDisplacement"].includes(event.kind)).map((event) => ({ layer: "politicalHistory", event }))
    ].sort((left, right) => left.event.year - right.event.year || left.layer.localeCompare(right.layer) || left.event.id.localeCompare(right.event.id));

    for (const item of sourceEvents) {
      const event = item.event;
      if (item.layer === "crisisHistory") {
        for (const cityId of event.threatenedCityIds) {
          const cityDestroyed = event.stateDelta.infrastructureDeltas.some((delta) => delta.kind === "sovereignCity" && delta.assetId === cityId && delta.resultingState === "destroyed");
          const cityDamaged = event.stateDelta.infrastructureDeltas.some((delta) => delta.kind === "sovereignCity" && delta.assetId === cityId && ["damaged", "destroyed"].includes(delta.resultingState));
          if (cityDestroyed) {
            applyEpisode({ year: event.year, kind: "institutionalDisplacement", cityId, sourceLayer: item.layer, sourceEvent: event, roles: "all", capacityShift: -4, independenceShift: -3, operationalStatus: "displaced", controlStatus: "displacedCharter", controllerPolityId: null, discoverableHooks: event.discoverableHooks });
          } else if (["cityBreach", "infrastructureBreach", "costlySurvival"].includes(event.outcome)) {
            const shift = event.outcome === "cityBreach" ? -2 : -1;
            applyEpisode({ year: event.year, kind: "crisisInstitutionalDamage", cityId, sourceLayer: item.layer, sourceEvent: event, roles: cityDamaged ? [...CRISIS_ROLES, "civilWatch"] : CRISIS_ROLES, capacityShift: shift, operationalStatus: event.outcome === "cityBreach" ? "disrupted" : "strained", discoverableHooks: event.discoverableHooks });
          } else if (["repelled", "diverted"].includes(event.outcome) && seededNumber(seed, `emergency-reform:${event.id}:${cityId}`) < 0.48) {
            applyEpisode({ year: Math.min(strategicMap.cityExpansionHistory.historicalHorizonYear, event.year + 1), kind: "emergencyReform", cityId, sourceLayer: item.layer, sourceEvent: event, roles: CRISIS_ROLES, capacityShift: 1, discoverableHooks: [event.id] });
          }
        }
        continue;
      }

      const cityId = event.location.cityId;
      if (event.kind === "authorityAccession" && seededNumber(seed, `succession-reorganization:${event.id}`) < 0.45) {
        const independenceShift = seededNumber(seed, `succession-independence:${event.id}`) < 0.52 ? 1 : -1;
        applyEpisode({ year: event.year, kind: "successionReorganization", cityId, sourceLayer: item.layer, sourceEvent: event, roles: CONTINUITY_ROLES, capacityShift: independenceShift > 0 ? 1 : 0, independenceShift, actorIds: event.participantActorIds, discoverableHooks: event.discoverableHooks });
      } else if (event.kind === "intercityCampaign") {
        if (event.outcome === "tributeImposed") {
          applyEpisode({ year: event.year, kind: "tributeAusterity", cityId, sourceLayer: item.layer, sourceEvent: event, roles: ["centralAdministration", "publicWorksAndProvisioning"], capacityShift: -1, actorIds: event.participantActorIds, discoverableHooks: event.discoverableHooks });
        } else if (event.outcome === "occupationEstablished") {
          const controllerPolityId = event.stateDelta.effectiveControllerPolityId;
          applyEpisode({ year: event.year, kind: "occupationAdministration", cityId, sourceLayer: item.layer, sourceEvent: event, roles: OCCUPATION_ROLES, capacityShift: -1, independenceShift: -2, operationalStatus: "strained", controlStatus: "overtOccupation", controllerPolityId, actorIds: event.participantActorIds, publicControlStatus: "overtOccupation", discoverableHooks: event.discoverableHooks });
        } else if (event.outcome === "puppetInstalled") {
          applyEpisode({ year: event.year, kind: "appointmentReorganization", cityId, sourceLayer: item.layer, sourceEvent: event, roles: CAPTURE_ROLES, independenceShift: -2, controlStatus: "capturedAppointments", controllerPolityId: event.stateDelta.effectiveControllerPolityId, captureState: "foreignSponsorControl", actorIds: event.participantActorIds, publicKind: "appointmentReorganization", publicControlStatus: "localCharter", discoverableHooks: event.discoverableHooks });
        } else if (event.outcome === "campaignRepelled" && seededNumber(seed, `defense-reform:${event.id}`) < 0.42) {
          applyEpisode({ year: Math.min(strategicMap.cityExpansionHistory.historicalHorizonYear, event.year + 1), kind: "emergencyReform", cityId, sourceLayer: item.layer, sourceEvent: event, roles: SECURITY_ROLES, capacityShift: 1, actorIds: event.participantActorIds, discoverableHooks: event.discoverableHooks });
        }
      } else if (event.kind === "subjectRevolt") {
        applyEpisode({ year: event.year, kind: "revoltDisruption", cityId, sourceLayer: item.layer, sourceEvent: event, roles: SECURITY_ROLES, capacityShift: -1, operationalStatus: "disrupted", actorIds: event.participantActorIds, discoverableHooks: event.discoverableHooks });
        if (event.outcome === "sovereigntyRestored") applyEpisode({ year: Math.min(strategicMap.cityExpansionHistory.historicalHorizonYear, event.year + 1), kind: "charterRestoration", cityId, sourceLayer: item.layer, sourceEvent: event, roles: "all", controlStatus: "localCharter", controllerPolityId: source.polityByCityId.get(cityId).id, captureState: "none", actorIds: event.participantActorIds, discoverableHooks: event.discoverableHooks });
      } else if (event.kind === "claimantDisplacement" && ![...currentById.values()].filter((row) => row.cityId === cityId).every((row) => row.operationalStatus === "displaced")) {
        applyEpisode({ year: event.year, kind: "institutionalDisplacement", cityId, sourceLayer: item.layer, sourceEvent: event, roles: "all", capacityShift: -4, independenceShift: -3, operationalStatus: "displaced", controlStatus: "displacedCharter", controllerPolityId: null, actorIds: event.participantActorIds, discoverableHooks: event.discoverableHooks });
      }
    }

    for (const control of strategicMap.strategicPoliticalHistory.currentControlRows) {
      const government = source.governmentByCityId.get(control.cityId);
      if (control.controlStatus === "occupied") for (const institution of institutionsForRoles(government, OCCUPATION_ROLES)) {
        const row = currentById.get(institution.id);
        row.actualControlStatus = "overtOccupation";
        row.actualControllerPolityId = control.effectiveControllerPolityId;
      }
      if (control.controlStatus === "puppet") for (const institution of institutionsForRoles(government, CAPTURE_ROLES)) {
        const row = currentById.get(institution.id);
        row.actualControlStatus = "capturedAppointments";
        row.actualControllerPolityId = control.effectiveControllerPolityId;
        row.captureState = "foreignSponsorControl";
      }
      if (control.controlStatus === "displacedClaim") for (const institution of government.institutions) {
        const row = currentById.get(institution.id);
        Object.assign(row, { operationalStatus: "displaced", actualControlStatus: "displacedCharter", actualControllerPolityId: null });
      }
    }

    eventRows.sort((left, right) => left.year - right.year || left.id.localeCompare(right.id));
    const currentInstitutionRows = [...currentById.values()].sort((left, right) => left.institutionId.localeCompare(right.institutionId));
    const publicCurrentRows = currentInstitutionRows.map((row) => {
      const institution = source.institutionById.get(row.institutionId);
      const concealed = row.actualControlStatus === "capturedAppointments";
      return {
        cityId: row.cityId,
        polityId: row.polityId,
        institutionId: row.institutionId,
        publicName: institution.publicName,
        roles: clone(row.roles),
        capacityBand: row.currentCapacityBand,
        independenceBand: concealed ? baselines.find((baseline) => baseline.institutionId === row.institutionId).baselineIndependenceBand : row.currentIndependenceBand,
        operationalStatus: row.operationalStatus,
        publicControlStatus: concealed ? "localCharter" : row.actualControlStatus,
        publiclyNamedControllerPolityId: row.actualControlStatus === "overtOccupation" ? row.actualControllerPolityId : row.polityId,
        charterIdentityPreserved: true,
        jurisdictionCreated: false
      };
    });
    const publicChronology = eventRows.map((event) => ({
      id: event.id,
      year: event.year,
      kind: event.publicProjection.kind,
      cityId: event.cityId,
      locationCellId: event.locationCellId,
      sourceLayer: event.sourceLayer,
      sourceEventId: event.sourceEventId,
      participantActorIds: event.kind === "appointmentReorganization" ? event.participantActorIds.filter((actorId) => source.politicalActorById.get(actorId)?.cityId === event.cityId) : clone(event.participantActorIds),
      affectedInstitutionIds: clone(event.affectedInstitutionIds),
      reportedControlStatus: event.publicProjection.controlStatus,
      account: event.publicProjection.account,
      discoverableHooks: clone(event.discoverableHooks),
      exactOperationalFactorsPublic: false
    }));
    const publicDirectory = {
      historicalHorizonYear: strategicMap.cityExpansionHistory.historicalHorizonYear,
      knowledgePolicy: "overtInstitutionalHistoryWithCaptureAndExactCapacityFactorsRedacted",
      chronology: publicChronology,
      currentInstitutionRows: publicCurrentRows,
      principles: { charterIdentitySurvivesControlChanges: true, occupationIsInstitutionSpecific: true, jailAndPrisonRemainDistinct: true, tributeCreatesNoAuthority: true, restorationDoesNotRepairCapacity: true, publicRecordsDoNotInferHiddenCapture: true }
    };
    publicDirectory.digest = `public-civic-history-${StrategicWorld.stableHash(coreWithoutDigest(publicDirectory))}`;
    const record = {
      historicalHorizonYear: strategicMap.cityExpansionHistory.historicalHorizonYear,
      sourceCityGovernmentsDigest: strategicMap.cityGovernments.digest,
      sourceCrisisHistoryDigest: strategicMap.strategicCrisisHistory.digest,
      sourcePoliticalHistoryDigest: strategicMap.strategicPoliticalHistory.digest,
      publicDirectoryDigest: publicDirectory.digest,
      baselineInstitutionRows: baselines,
      eventRows,
      currentInstitutionRows,
      diagnostics: {
        cityCount: strategicMap.cityGovernments.governments.length,
        institutionCount: currentInstitutionRows.length,
        retainedEventCount: eventRows.length,
        affectedCityCount: new Set(eventRows.map((event) => event.cityId)).size,
        strainedOrDisruptedCount: currentInstitutionRows.filter((row) => ["strained", "disrupted"].includes(row.operationalStatus)).length,
        overtOccupationInstitutionCount: currentInstitutionRows.filter((row) => row.actualControlStatus === "overtOccupation").length,
        capturedInstitutionCount: currentInstitutionRows.filter((row) => row.actualControlStatus === "capturedAppointments").length,
        displacedInstitutionCount: currentInstitutionRows.filter((row) => row.operationalStatus === "displaced").length,
        distinctJailAndPrisonCityCount: strategicMap.cityGovernments.governments.filter((government) => government.roleAssignments.temporaryJailAuthority !== government.roleAssignments.longTermCorrectionsAuthority).length,
        reusedPoliticalActorCount: new Set(eventRows.flatMap((event) => event.participantActorIds)).size
      }
    };
    record.digest = `strategic-civic-history-${StrategicWorld.stableHash(coreWithoutDigest(record))}`;
    return { strategicCivicHistory: record, publicDirectory };
  }

  function validateStrategicCivicHistory(map, record = map?.strategicCivicHistory, directory = map?.publicCivicHistoryDirectory) {
    const strategicMap = validateSources(map);
    if (!record || !directory || record.sourceCityGovernmentsDigest !== strategicMap.cityGovernments.digest || record.sourceCrisisHistoryDigest !== strategicMap.strategicCrisisHistory.digest || record.sourcePoliticalHistoryDigest !== strategicMap.strategicPoliticalHistory.digest || record.publicDirectoryDigest !== directory.digest) throw new Error("Strategic civic history is incomplete or does not match its causal sources.");
    const source = sourceMaps(strategicMap);
    const expectedInstitutionIds = new Set(source.institutionById.keys());
    if (record.baselineInstitutionRows.length !== expectedInstitutionIds.size || record.currentInstitutionRows.length !== expectedInstitutionIds.size || new Set(record.currentInstitutionRows.map((row) => row.institutionId)).size !== expectedInstitutionIds.size) throw new Error("Civic history must preserve every chartered institution exactly once.");
    for (const row of record.currentInstitutionRows) {
      const baseline = record.baselineInstitutionRows.find((entry) => entry.institutionId === row.institutionId);
      if (!baseline || !CAPACITY_BANDS.includes(row.currentCapacityBand) || !INDEPENDENCE_BANDS.includes(row.currentIndependenceBand) || !OPERATIONAL_STATUSES.includes(row.operationalStatus) || !ACTUAL_CONTROL_STATUSES.includes(row.actualControlStatus) || !row.charterIdentityPreserved || row.jurisdictionCreated || (row.actualControllerPolityId && !strategicMap.cityPolities.polities.some((polity) => polity.id === row.actualControllerPolityId))) throw new Error("A playable-year civic institution has invalid capacity, control, or charter continuity.");
    }
    const sourceEventIds = new Set([...source.crisisEventById.keys(), ...source.politicalEventById.keys()]);
    const eventIds = new Set();
    for (let index = 0; index < record.eventRows.length; index += 1) {
      const event = record.eventRows[index];
      if (eventIds.has(event.id) || !EVENT_KINDS.includes(event.kind) || !sourceEventIds.has(event.sourceEventId) || !source.cityById.has(event.cityId) || !Number.isInteger(event.year) || event.year < 0 || event.year > record.historicalHorizonYear || (index && event.year < record.eventRows[index - 1].year) || !event.affectedInstitutionIds.length || event.affectedInstitutionIds.some((id) => !expectedInstitutionIds.has(id)) || !event.prerequisites.length || !event.cause || !event.exactFactors || !event.stateDeltas.length || !event.charterIdentityPreserved || event.createsSovereignty || event.createsJurisdiction || event.participantActorIds.some((id) => !source.politicalActorIds.has(id))) throw new Error("A retained civic event lacks a valid source, chronology, institution, actor, or bounded consequence.");
      eventIds.add(event.id);
    }
    for (const government of strategicMap.cityGovernments.governments) {
      if (government.roleAssignments.temporaryJailAuthority === government.roleAssignments.longTermCorrectionsAuthority || !record.currentInstitutionRows.some((row) => row.institutionId === government.roleAssignments.temporaryJailAuthority) || !record.currentInstitutionRows.some((row) => row.institutionId === government.roleAssignments.longTermCorrectionsAuthority)) throw new Error("Civic history merged or lost the distinct jail and prison authorities.");
    }
    const publicJson = JSON.stringify(directory);
    if (/exactFactors|actualControlStatus|actualControllerPolityId|captureState|foreignSponsorControl|institutionalCapture|capacityShift|independenceShift/.test(publicJson)) throw new Error("Public civic history leaks exact operational factors or hidden institutional control.");
    if (directory.knowledgePolicy !== "overtInstitutionalHistoryWithCaptureAndExactCapacityFactorsRedacted" || !directory.principles?.jailAndPrisonRemainDistinct || directory.currentInstitutionRows.length !== expectedInstitutionIds.size || directory.currentInstitutionRows.some((row) => !PUBLIC_CONTROL_STATUSES.includes(row.publicControlStatus) || !row.charterIdentityPreserved || row.jurisdictionCreated) || directory.chronology.filter((event) => event.kind === "appointmentReorganization").some((event) => event.participantActorIds.some((actorId) => source.politicalActorById.get(actorId)?.cityId !== event.cityId))) throw new Error("The public civic directory violates charter, jurisdiction, or knowledge boundaries.");
    if (directory.digest !== `public-civic-history-${StrategicWorld.stableHash(coreWithoutDigest(directory))}` || record.digest !== `strategic-civic-history-${StrategicWorld.stableHash(coreWithoutDigest(record))}`) throw new Error("Strategic civic history does not match its digest.");
    const diagnostics = record.diagnostics;
    if (!diagnostics || diagnostics.institutionCount !== record.currentInstitutionRows.length || diagnostics.retainedEventCount !== record.eventRows.length || diagnostics.cityCount !== strategicMap.cityGovernments.governments.length || diagnostics.distinctJailAndPrisonCityCount !== strategicMap.cityGovernments.governments.length) throw new Error("Civic-history diagnostics do not match saved facts.");
    return { strategicCivicHistory: clone(record), publicDirectory: clone(directory) };
  }

  function attachStrategicCivicHistory(worldSeed, map) {
    const next = clone(map);
    const generated = createStrategicCivicHistory(worldSeed, next);
    next.strategicCivicHistory = generated.strategicCivicHistory;
    next.publicCivicHistoryDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function publicCivicInstitutionalHistory(map) {
    if (!map?.publicCivicHistoryDirectory) return null;
    const directory = clone(map.publicCivicHistoryDirectory);
    const cityById = new Map(map.humanGeography.cities.map((city) => [city.id, city]));
    const polityById = new Map(map.cityPolities.polities.map((polity) => [polity.id, polity]));
    directory.currentInstitutionRows = directory.currentInstitutionRows.map((row) => ({ ...row, city: clone(cityById.get(row.cityId)), polity: clone(polityById.get(row.polityId)), publiclyNamedController: clone(polityById.get(row.publiclyNamedControllerPolityId)) }));
    directory.chronology = directory.chronology.map((event) => ({ ...event, city: clone(cityById.get(event.cityId)) }));
    return directory;
  }

  function currentCityInstitutionalProfile(map, cityId) {
    const directory = publicCivicInstitutionalHistory(map);
    if (!directory) return null;
    return { cityId, institutions: directory.currentInstitutionRows.filter((row) => row.cityId === cityId), events: directory.chronology.filter((event) => event.cityId === cityId) };
  }

  function currentInstitutionForRole(map, cityId, role) {
    return currentCityInstitutionalProfile(map, cityId)?.institutions.find((institution) => institution.roles.includes(role)) || null;
  }

  function auditStrategicCivicHistory(map) {
    const { strategicCivicHistory: record, publicDirectory } = validateStrategicCivicHistory(map);
    return {
      valid: true,
      baselineGovernmentsImmutable: record.sourceCityGovernmentsDigest === map.cityGovernments.digest,
      everyEventCausallySourced: record.eventRows.every((event) => event.sourceEventId && event.prerequisites.includes(event.sourceEventId) && event.stateDeltas.length),
      everyInstitutionPreserved: record.currentInstitutionRows.length === map.cityGovernments.governments.flatMap((government) => government.institutions).length && record.currentInstitutionRows.every((row) => row.charterIdentityPreserved && !row.jurisdictionCreated),
      jailAndPrisonRemainDistinct: record.diagnostics.distinctJailAndPrisonCityCount === record.diagnostics.cityCount,
      occupationIsInstitutionSpecific: map.strategicPoliticalHistory.currentControlRows.filter((row) => row.controlStatus === "occupied").every((control) => {
        const cityRows = record.currentInstitutionRows.filter((row) => row.cityId === control.cityId);
        return cityRows.some((row) => row.actualControlStatus === "overtOccupation") && cityRows.some((row) => row.actualControlStatus === "localCharter");
      }),
      tributeCreatesNoAuthority: map.strategicPoliticalHistory.currentControlRows.filter((row) => row.controlStatus === "tributary").every((control) => record.currentInstitutionRows.filter((row) => row.cityId === control.cityId).every((row) => row.actualControllerPolityId === row.polityId)),
      publicHistoryHidesCaptureAndExactFactors: !JSON.stringify(publicDirectory).match(/exactFactors|actualControlStatus|actualControllerPolityId|captureState|foreignSponsorControl|institutionalCapture|capacityShift|independenceShift/),
      diagnostics: clone(record.diagnostics)
    };
  }

  return Object.freeze({ EVENT_KINDS, OPERATIONAL_STATUSES, ACTUAL_CONTROL_STATUSES, PUBLIC_CONTROL_STATUSES, createStrategicCivicHistory, validateStrategicCivicHistory, attachStrategicCivicHistory, publicCivicInstitutionalHistory, currentCityInstitutionalProfile, currentInstitutionForRole, auditStrategicCivicHistory });
});
