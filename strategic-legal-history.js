(function initStrategicLegalHistory(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const strategicCityGovernments = typeof module === "object" && module.exports ? require("./strategic-city-governments") : root?.HelixStrategicCityGovernments;
  const strategicCityLaws = typeof module === "object" && module.exports ? require("./strategic-city-laws") : root?.HelixStrategicCityLaws;
  const strategicCrisisHistory = typeof module === "object" && module.exports ? require("./strategic-crisis-history") : root?.HelixStrategicCrisisHistory;
  const strategicPoliticalHistory = typeof module === "object" && module.exports ? require("./strategic-political-history") : root?.HelixStrategicPoliticalHistory;
  const strategicCivicHistory = typeof module === "object" && module.exports ? require("./strategic-civic-history") : root?.HelixStrategicCivicHistory;
  const api = factory(strategicWorld, strategicCityGovernments, strategicCityLaws, strategicCrisisHistory, strategicPoliticalHistory, strategicCivicHistory);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicLegalHistory = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicLegalHistoryApi(StrategicWorld, StrategicCityGovernments, StrategicCityLaws, StrategicCrisisHistory, StrategicPoliticalHistory, StrategicCivicHistory) {
  "use strict";

  if (!StrategicWorld || !StrategicCityGovernments || !StrategicCityLaws || !StrategicCrisisHistory || !StrategicPoliticalHistory || !StrategicCivicHistory) throw new Error("World, government, city-law, crisis, political, and civic-history modules must load before strategic-legal-history.js");

  const AMENDMENT_KINDS = Object.freeze(["offenseStatusAmendment", "procedureAmendment", "sentencingPolicyAmendment"]);
  const DIRECTIVE_KINDS = Object.freeze(["curfew", "checkpointControl", "movementRestriction", "rationingOrder", "emergencySeizure", "weaponsControl"]);
  const PROCEDURE_FIELDS = Object.freeze({
    counselRule: Object.freeze(["guaranteedAtFirstAppearance", "guaranteedBeforeTrial", "availableForSeriousCharges"]),
    discoveryRule: Object.freeze(["openFile", "materialEvidence", "chargeSpecific"]),
    pretrialReleaseRule: Object.freeze(["presumptionOfRelease", "riskBased", "securityFirst"])
  });
  const AMENDABLE_OFFENSES = Object.freeze(["geneticEngineering", "artificialCreatureCreation", "animancy", "prohibitedMagic", "corporateLicensing"]);
  const STATUS_LADDER = StrategicCityLaws.LEGAL_STATUSES;

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function seededNumber(seed, channel) { return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff; }
  function pick(values, seed, channel) { return values[Math.floor(seededNumber(seed, channel) * values.length) % values.length]; }
  function coreWithoutDigest(value) { const core = clone(value); delete core.digest; return core; }

  function validateSources(map) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCityGovernments.validateCityGovernments(strategicMap);
    StrategicCityLaws.validateCityLegalCodes(strategicMap);
    StrategicCrisisHistory.validateStrategicCrisisHistory(strategicMap);
    StrategicPoliticalHistory.validateStrategicPoliticalHistory(strategicMap);
    StrategicCivicHistory.validateStrategicCivicHistory(strategicMap);
    return strategicMap;
  }

  function sourceMaps(map) {
    const governments = map.cityGovernments.governments;
    return {
      cityById: new Map(map.humanGeography.cities.map((city) => [city.id, city])),
      polityByCityId: new Map(map.cityPolities.polities.map((polity) => [polity.cityId, polity])),
      governmentByCityId: new Map(governments.map((government) => [government.cityId, government])),
      institutionById: new Map(governments.flatMap((government) => government.institutions.map((institution) => [institution.id, institution]))),
      civicEventById: new Map(map.strategicCivicHistory.eventRows.map((event) => [event.id, event])),
      crisisEventById: new Map(map.strategicCrisisHistory.eventRows.map((event) => [event.id, event])),
      politicalEventById: new Map(map.strategicPoliticalHistory.eventRows.map((event) => [event.id, event])),
      actorIds: new Set(map.strategicPoliticalHistory.actorRows.map((actor) => actor.id))
    };
  }

  function authorizationExceptions(offenseId, status) {
    if (status === "prohibited") return offenseId === "animancy" ? ["No ordinary license; only an expressly published medical or religious exception can apply."] : [];
    if (status === "restricted") return ["Only a named chartered institution or expressly approved emergency may authorize this conduct."];
    if (status === "licensed") return ["A valid activity-specific license and its recorded conditions are required."];
    if (status === "tolerated") return ["Ordinary conduct is not prosecuted by status alone, but harm and separate offenses remain actionable."];
    return ["No activity-specific authorization is required; generally applicable safety and harm laws still apply."];
  }

  function sentencingFor(definition, status, policy) {
    const severityIndex = StrategicCityLaws.SEVERITY_GRADES.indexOf(definition.baseSeverity);
    const statusScale = status === "prohibited" ? 1 : (status === "restricted" ? 0.72 : (status === "licensed" ? 0.5 : 0.25));
    const baseMaximum = [6, 18, 48, 96, 120][Math.max(0, severityIndex)] || 24;
    const maximumMonths = definition.ordinarySanctions.includes("finitePrison") ? Math.min(policy.finitePrisonMaximumMonths, Math.max(1, Math.round(baseMaximum * statusScale))) : 0;
    const capitalEligible = definition.capitalGradeTriggers.length > 0 && (policy.penalFlight.available || policy.publicExecution.available);
    return {
      severityGrades: [definition.baseSeverity, ...(definition.aggravatingFactors.length ? [severityIndex >= 3 ? "capital" : StrategicCityLaws.SEVERITY_GRADES[Math.min(3, severityIndex + 1)]] : [])],
      ordinarySanctions: definition.ordinarySanctions.filter((sanction) => policy.availableSanctions.includes(sanction)),
      finitePrisonRangeMonths: maximumMonths ? { minimum: Math.min(3, maximumMonths), maximum: maximumMonths } : null,
      penalLegionEligible: policy.penalLegion.available && severityIndex >= 2,
      capitalEligibility: capitalEligible ? {
        requiresProvenTrigger: true,
        triggers: [...definition.capitalGradeTriggers],
        withoutPublicEnemy: policy.penalFlight.available ? "penalFlight" : "unavailable",
        withPublicEnemy: policy.publicExecution.available ? "publicBeheading" : (policy.penalFlight.available ? "penalFlight" : "unavailable")
      } : null
    };
  }

  function applyAmendmentsToCode(baseCode, amendments) {
    const code = clone(baseCode);
    for (const amendment of [...amendments].sort((left, right) => left.year - right.year || left.id.localeCompare(right.id))) {
      const change = amendment.change;
      if (amendment.kind === "offenseStatusAmendment") {
        const rule = code.offenseRules.find((entry) => entry.offenseId === change.offenseId);
        if (rule) rule.legalStatus = change.resultingValue;
      } else if (amendment.kind === "procedureAmendment") code.procedure[change.field] = change.resultingValue;
      else if (amendment.kind === "sentencingPolicyAmendment") code.punishmentPolicy.finitePrisonMaximumMonths = change.resultingValue;
    }
    for (const rule of code.offenseRules) {
      const definition = StrategicCityLaws.OFFENSE_CATALOG.find((entry) => entry.id === rule.offenseId);
      rule.authorizationExceptions = authorizationExceptions(rule.offenseId, rule.legalStatus);
      rule.sentencing = sentencingFor(definition, rule.legalStatus, code.punishmentPolicy);
    }
    code.legalHistory = {
      foundingCodeId: baseCode.id,
      amendmentCount: amendments.length,
      lastAmendmentYear: amendments.length ? Math.max(...amendments.map((entry) => entry.year)) : null,
      proofStandardUnchanged: true,
      prospectiveAmendmentsOnly: true
    };
    return code;
  }

  function compactCurrentCode(code) {
    return {
      cityId: code.city.id,
      legalStatuses: Object.fromEntries(code.offenseRules.map((rule) => [rule.offenseId, rule.legalStatus])),
      procedure: {
        criminalProofStandard: code.procedure.criminalProofStandard,
        chargeElementsMustBeProvenSeparately: code.procedure.chargeElementsMustBeProvenSeparately,
        counselRule: code.procedure.counselRule,
        discoveryRule: code.procedure.discoveryRule,
        pretrialReleaseRule: code.procedure.pretrialReleaseRule
      },
      punishment: {
        finitePrisonMaximumMonths: code.punishmentPolicy.finitePrisonMaximumMonths,
        lifeImprisonmentAvailable: code.punishmentPolicy.lifeImprisonmentAvailable,
        publicEnemySeparateFindingRequired: code.punishmentPolicy.publicEnemyDesignation.separateFindingRequired,
        penalFlightAutomaticDeath: code.punishmentPolicy.penalFlight.automaticDeath
      },
      amendmentCount: code.legalHistory.amendmentCount,
      lastAmendmentYear: code.legalHistory.lastAmendmentYear
    };
  }

  function shiftedValue(values, current, direction) {
    const index = Math.max(0, values.indexOf(current));
    const nextIndex = Math.max(0, Math.min(values.length - 1, index + direction));
    if (nextIndex !== index) return values[nextIndex];
    return values[Math.max(0, Math.min(values.length - 1, index - direction))];
  }

  function amendmentAccount(cityName, kind, change, authorityName) {
    if (kind === "offenseStatusAmendment") return `${cityName} enacted a prospective amendment changing ${change.offenseLabel} from ${change.previousValue} to ${change.resultingValue} through ${authorityName}.`;
    if (kind === "procedureAmendment") return `${cityName} enacted a prospective criminal-procedure amendment changing ${change.field} from ${change.previousValue} to ${change.resultingValue} through ${authorityName}.`;
    return `${cityName} changed its finite prison maximum from ${change.previousValue / 12} to ${change.resultingValue / 12} years through ${authorityName}; life imprisonment remained unavailable.`;
  }

  function createStrategicLegalHistory(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for legal history.");
    const strategicMap = validateSources(map);
    if (strategicMap.strategicLegalHistory || strategicMap.publicLegalHistoryDirectory) throw new Error("Strategic legal history already exists on this world.");
    const source = sourceMaps(strategicMap);
    const horizon = strategicMap.strategicCivicHistory.historicalHorizonYear;
    const baselineCodes = StrategicCityLaws.publicCityLawDirectory(strategicMap);
    const workingCodes = new Map(baselineCodes.map((code) => [code.city.id, clone(code)]));
    const amendmentRows = [];
    let amendmentOrdinal = 1;

    const amendmentSources = strategicMap.strategicCivicHistory.eventRows
      .filter((event) => ["emergencyReform", "successionReorganization", "appointmentReorganization"].includes(event.kind))
      .sort((left, right) => left.year - right.year || left.id.localeCompare(right.id));

    for (const civicEvent of amendmentSources) {
      if (seededNumber(seed, `retain-amendment:${civicEvent.id}`) >= (civicEvent.kind === "appointmentReorganization" ? 0.82 : 0.64)) continue;
      const government = source.governmentByCityId.get(civicEvent.cityId);
      const city = source.cityById.get(civicEvent.cityId);
      const code = workingCodes.get(civicEvent.cityId);
      if (!government || !city || !code) continue;
      const enactmentInstitutionId = government.roleAssignments.centralAdministration;
      const reviewInstitutionId = government.roleAssignments.civicReview;
      const enactmentInstitution = source.institutionById.get(enactmentInstitutionId);
      const mode = Math.floor(seededNumber(seed, `amendment-kind:${civicEvent.id}`) * 3);
      let kind;
      let change;
      if (mode === 0) {
        kind = "offenseStatusAmendment";
        const offenseId = pick(AMENDABLE_OFFENSES, seed, `amended-offense:${civicEvent.id}`);
        const rule = code.offenseRules.find((entry) => entry.offenseId === offenseId);
        const direction = civicEvent.kind === "emergencyReform" ? -1 : (seededNumber(seed, `status-direction:${civicEvent.id}`) < 0.5 ? -1 : 1);
        const allowed = offenseId === "animancy" ? STATUS_LADDER.slice(0, 2) : STATUS_LADDER;
        const resultingValue = shiftedValue(allowed, rule.legalStatus, direction);
        change = { offenseId, offenseLabel: rule.label, previousValue: rule.legalStatus, resultingValue, resultingAuthorizationExceptions: authorizationExceptions(offenseId, resultingValue) };
        rule.legalStatus = resultingValue;
      } else if (mode === 1) {
        kind = "procedureAmendment";
        const field = pick(Object.keys(PROCEDURE_FIELDS), seed, `procedure-field:${civicEvent.id}`);
        const current = code.procedure[field];
        const direction = civicEvent.kind === "emergencyReform" ? -1 : (seededNumber(seed, `procedure-direction:${civicEvent.id}`) < 0.5 ? -1 : 1);
        const resultingValue = shiftedValue(PROCEDURE_FIELDS[field], current, direction);
        change = { field, previousValue: current, resultingValue };
        code.procedure[field] = resultingValue;
      } else {
        kind = "sentencingPolicyAmendment";
        const previousValue = code.punishmentPolicy.finitePrisonMaximumMonths;
        const direction = civicEvent.kind === "emergencyReform" ? -12 : (seededNumber(seed, `sentence-direction:${civicEvent.id}`) < 0.5 ? -12 : 12);
        let resultingValue = Math.max(36, Math.min(120, previousValue + direction));
        if (resultingValue === previousValue) resultingValue = previousValue === 36 ? 48 : previousValue - 12;
        change = { field: "finitePrisonMaximumMonths", previousValue, resultingValue };
        code.punishmentPolicy.finitePrisonMaximumMonths = resultingValue;
      }
      const id = `legal-amendment:${String(amendmentOrdinal).padStart(3, "0")}`;
      amendmentOrdinal += 1;
      amendmentRows.push({
        id,
        year: civicEvent.year,
        effectiveYear: civicEvent.year,
        kind,
        cityId: civicEvent.cityId,
        sourceLayer: "civicHistory",
        sourceEventId: civicEvent.id,
        enactedByInstitutionId: enactmentInstitutionId,
        reviewedByInstitutionId: reviewInstitutionId,
        nominalAuthorityActorIds: clone(civicEvent.participantActorIds || []),
        formalLocalProcessCompleted: true,
        prospectiveOnly: true,
        retroactiveGuiltPermitted: false,
        proofStandardChanged: false,
        offenseElementsChanged: false,
        change,
        cause: `civicHistory:${civicEvent.kind}`,
        hiddenSponsorPolityId: civicEvent.exactFactors?.captureState === "foreignSponsorControl" ? civicEvent.exactFactors.actualControllerPolityId : null,
        publicAccount: amendmentAccount(city.name, kind, change, enactmentInstitution.publicName),
        discoverableHooks: [...new Set([civicEvent.id, `institution-record:${enactmentInstitutionId}`, `institution-record:${reviewInstitutionId}`, ...(civicEvent.discoverableHooks || [])])]
      });
    }

    const directiveRows = [];
    let directiveOrdinal = 1;
    function addDirective({ year, expiresYear, kind, cityId, sourceLayer, sourceEvent, issuerPolityId, institutionRole, authorityBasis }) {
      const government = source.governmentByCityId.get(cityId);
      const city = source.cityById.get(cityId);
      if (!government || !city) return;
      const issuedThroughInstitutionId = government.roleAssignments[institutionRole];
      const institution = source.institutionById.get(issuedThroughInstitutionId);
      const id = `legal-directive:${String(directiveOrdinal).padStart(3, "0")}`;
      directiveOrdinal += 1;
      const status = year <= horizon && horizon < expiresYear ? "active" : "expired";
      directiveRows.push({
        id,
        year,
        expiresYear,
        status,
        kind,
        cityId,
        sourceLayer,
        sourceEventId: sourceEvent.id,
        issuerPolityId,
        issuedThroughInstitutionId,
        authorityBasis,
        scope: kind === "curfew" ? "nightMovementWithinControlledApproaches" : (kind === "checkpointControl" ? "identityAndCargoChecksAtControlledFacilities" : (kind === "rationingOrder" ? "essentialSupplyDistribution" : (kind === "emergencySeizure" ? "recordedTemporaryUseOfEssentialAssets" : (kind === "weaponsControl" ? "weaponsWithinControlledApproaches" : "movementWithinControlledApproaches")))),
        recognizedAsLocalCriminalLaw: false,
        changesOffenseElements: false,
        independentConvictionAuthority: false,
        guiltInferencePermitted: false,
        permanentWithoutReenactment: false,
        localConvictionRequiresPublishedOffenseAndProof: true,
        publicAccount: `${city.name} published a temporary ${kind.replace(/([a-z])([A-Z])/g, "$1 $2")} directive through ${institution.publicName}, effective in controlled facilities and approaches until year ${expiresYear}. It did not amend the city's criminal code.`,
        discoverableHooks: [...new Set([sourceEvent.id, `institution-record:${issuedThroughInstitutionId}`, ...(sourceEvent.discoverableHooks || [])])]
      });
    }

    for (const event of strategicMap.strategicCrisisHistory.eventRows) {
      if (!event.threatenedCityIds?.length || seededNumber(seed, `crisis-directive:${event.id}`) >= 0.58) continue;
      for (const cityId of event.threatenedCityIds) {
        const kind = pick(["curfew", "movementRestriction", "rationingOrder", "emergencySeizure"], seed, `crisis-directive-kind:${event.id}:${cityId}`);
        addDirective({ year: event.year, expiresYear: event.year + 1, kind, cityId, sourceLayer: "crisisHistory", sourceEvent: event, issuerPolityId: source.polityByCityId.get(cityId)?.id, institutionRole: "emergencyManagement", authorityBasis: "publishedCharterEmergencyPower" });
      }
    }

    const politicalEvents = strategicMap.strategicPoliticalHistory.eventRows;
    const currentControlByCityId = new Map(strategicMap.strategicPoliticalHistory.currentControlRows.map((row) => [row.cityId, row]));
    const occupations = politicalEvents.filter((event) => event.kind === "intercityCampaign" && event.outcome === "occupationEstablished");
    for (const event of occupations) {
      const cityId = event.location?.cityId;
      if (!cityId) continue;
      const laterChange = politicalEvents.find((candidate) => candidate.year > event.year && candidate.location?.cityId === cityId && (candidate.kind === "subjectRevolt" || candidate.kind === "claimantDisplacement" || candidate.kind === "intercityCampaign"));
      const laterOccupation = occupations.filter((candidate) => candidate.location?.cityId === cityId && (candidate.year > event.year || candidate.year === event.year && candidate.id > event.id)).sort((left, right) => left.year - right.year || left.id.localeCompare(right.id))[0];
      const isLatestOccupation = !laterOccupation;
      const remainsOccupied = isLatestOccupation && currentControlByCityId.get(cityId)?.controlStatus === "occupied";
      const expiresYear = remainsOccupied ? horizon + 1 : Math.max(event.year + 1, Math.min(event.year + 4, laterChange?.year || event.year + 4));
      const issuerPolityId = event.stateDelta?.effectiveControllerPolityId || currentControlByCityId.get(cityId)?.effectiveControllerPolityId;
      addDirective({ year: event.year, expiresYear, kind: "checkpointControl", cityId, sourceLayer: "politicalHistory", sourceEvent: event, issuerPolityId, institutionRole: "civilWatch", authorityBasis: "overtOccupationDirection" });
      addDirective({ year: event.year, expiresYear, kind: pick(["curfew", "movementRestriction", "weaponsControl"], seed, `occupation-directive-kind:${event.id}`), cityId, sourceLayer: "politicalHistory", sourceEvent: event, issuerPolityId, institutionRole: "centralAdministration", authorityBasis: "overtOccupationDirection" });
    }

    amendmentRows.sort((left, right) => left.year - right.year || left.id.localeCompare(right.id));
    directiveRows.sort((left, right) => left.year - right.year || left.id.localeCompare(right.id));
    const currentCodeRows = baselineCodes.map((baseCode) => compactCurrentCode(applyAmendmentsToCode(baseCode, amendmentRows.filter((entry) => entry.cityId === baseCode.city.id))));
    const record = {
      historicalHorizonYear: horizon,
      sourceCityLegalCodesDigest: strategicMap.cityLegalCodes.digest,
      sourceCityGovernmentsDigest: strategicMap.cityGovernments.digest,
      sourceCrisisHistoryDigest: strategicMap.strategicCrisisHistory.digest,
      sourcePoliticalHistoryDigest: strategicMap.strategicPoliticalHistory.digest,
      sourceCivicHistoryDigest: strategicMap.strategicCivicHistory.digest,
      offenseCatalogDigest: StrategicWorld.stableHash(StrategicCityLaws.OFFENSE_CATALOG),
      amendmentRows,
      directiveRows,
      currentCodeRows,
      principles: {
        foundingCodeImmutable: true,
        amendmentsProspectiveOnly: true,
        proofStandardCannotBeLowered: true,
        offenseElementsImmutable: true,
        directivesAreNotCriminalLaw: true,
        temporaryDirectivesExpire: true,
        puppetAmendmentsRequireFormalLocalProcess: true
      },
      diagnostics: {
        cityCount: baselineCodes.length,
        amendmentCount: amendmentRows.length,
        offenseStatusAmendmentCount: amendmentRows.filter((entry) => entry.kind === "offenseStatusAmendment").length,
        procedureAmendmentCount: amendmentRows.filter((entry) => entry.kind === "procedureAmendment").length,
        sentencingPolicyAmendmentCount: amendmentRows.filter((entry) => entry.kind === "sentencingPolicyAmendment").length,
        directiveCount: directiveRows.length,
        activeDirectiveCount: directiveRows.filter((entry) => entry.status === "active").length,
        occupationDirectiveCount: directiveRows.filter((entry) => entry.authorityBasis === "overtOccupationDirection").length
      }
    };
    record.digest = `strategic-legal-history-${StrategicWorld.stableHash(coreWithoutDigest(record))}`;

    const publicDirectory = {
      sourceLegalHistoryDigest: record.digest,
      historicalHorizonYear: horizon,
      knowledgePolicy: "recognizedLawAndOvertDirectivesWithCovertSponsorsRedacted",
      amendmentChronology: amendmentRows.map((entry) => ({ id: entry.id, year: entry.year, effectiveYear: entry.effectiveYear, kind: entry.kind, cityId: entry.cityId, enactedByInstitutionId: entry.enactedByInstitutionId, reviewedByInstitutionId: entry.reviewedByInstitutionId, formalLocalProcessCompleted: entry.formalLocalProcessCompleted, prospectiveOnly: entry.prospectiveOnly, change: clone(entry.change), account: entry.publicAccount })),
      directiveChronology: directiveRows.map((entry) => ({ id: entry.id, year: entry.year, expiresYear: entry.expiresYear, status: entry.status, kind: entry.kind, cityId: entry.cityId, issuerPolityId: entry.issuerPolityId, issuedThroughInstitutionId: entry.issuedThroughInstitutionId, authorityBasis: entry.authorityBasis, scope: entry.scope, recognizedAsLocalCriminalLaw: false, independentConvictionAuthority: false, account: entry.publicAccount })),
      activeDirectives: directiveRows.filter((entry) => entry.status === "active").map((entry) => entry.id),
      currentCodeRows: clone(currentCodeRows),
      principles: clone(record.principles)
    };
    publicDirectory.digest = `public-legal-history-${StrategicWorld.stableHash(coreWithoutDigest(publicDirectory))}`;
    return { strategicLegalHistory: record, publicDirectory };
  }

  function validateStrategicLegalHistory(map, record = map?.strategicLegalHistory, directory = map?.publicLegalHistoryDirectory) {
    const strategicMap = validateSources(map);
    const source = sourceMaps(strategicMap);
    if (!record || !directory || record.sourceCityLegalCodesDigest !== strategicMap.cityLegalCodes.digest || record.sourceCityGovernmentsDigest !== strategicMap.cityGovernments.digest || record.sourceCrisisHistoryDigest !== strategicMap.strategicCrisisHistory.digest || record.sourcePoliticalHistoryDigest !== strategicMap.strategicPoliticalHistory.digest || record.sourceCivicHistoryDigest !== strategicMap.strategicCivicHistory.digest || record.offenseCatalogDigest !== StrategicWorld.stableHash(StrategicCityLaws.OFFENSE_CATALOG)) throw new Error("Strategic legal history does not match its source law, government, or historical records.");
    const baseCodes = StrategicCityLaws.publicCityLawDirectory(strategicMap);
    const validationCodes = new Map(baseCodes.map((code) => [code.city.id, clone(code)]));
    const offenseById = new Map(StrategicCityLaws.OFFENSE_CATALOG.map((entry) => [entry.id, entry]));
    const amendmentIds = new Set();
    for (const [index, entry] of record.amendmentRows.entries()) {
      const government = source.governmentByCityId.get(entry.cityId);
      const sourceEvent = source.civicEventById.get(entry.sourceEventId);
      if (amendmentIds.has(entry.id) || !AMENDMENT_KINDS.includes(entry.kind) || !sourceEvent || sourceEvent.cityId !== entry.cityId || !government || entry.year !== sourceEvent.year || entry.effectiveYear !== entry.year || (index && entry.year < record.amendmentRows[index - 1].year) || entry.enactedByInstitutionId !== government.roleAssignments.centralAdministration || entry.reviewedByInstitutionId !== government.roleAssignments.civicReview || !entry.formalLocalProcessCompleted || !entry.prospectiveOnly || entry.retroactiveGuiltPermitted || entry.proofStandardChanged || entry.offenseElementsChanged) throw new Error("A legal amendment lacks a valid saved cause, local enactment, review, chronology, or prospective effect.");
      if (entry.nominalAuthorityActorIds.some((id) => !source.actorIds.has(id))) throw new Error("A legal amendment names an unknown historical actor.");
      if (entry.kind === "offenseStatusAmendment" && (!offenseById.has(entry.change.offenseId) || !STATUS_LADDER.includes(entry.change.previousValue) || !STATUS_LADDER.includes(entry.change.resultingValue) || entry.change.previousValue === entry.change.resultingValue || entry.change.offenseId === "animancy" && !["prohibited", "restricted"].includes(entry.change.resultingValue))) throw new Error("An offense-status amendment violates the static offense catalog or animancy boundary.");
      if (entry.kind === "procedureAmendment" && (!PROCEDURE_FIELDS[entry.change.field]?.includes(entry.change.previousValue) || !PROCEDURE_FIELDS[entry.change.field]?.includes(entry.change.resultingValue) || entry.change.previousValue === entry.change.resultingValue)) throw new Error("A procedure amendment changes an unsupported field or invariant.");
      if (entry.kind === "sentencingPolicyAmendment" && (entry.change.field !== "finitePrisonMaximumMonths" || entry.change.resultingValue < 36 || entry.change.resultingValue > 120 || entry.change.resultingValue === entry.change.previousValue)) throw new Error("A sentencing amendment violates the finite prison range.");
      const validationCode = validationCodes.get(entry.cityId);
      if (entry.kind === "offenseStatusAmendment") {
        const rule = validationCode.offenseRules.find((candidate) => candidate.offenseId === entry.change.offenseId);
        if (rule.legalStatus !== entry.change.previousValue || JSON.stringify(entry.change.resultingAuthorizationExceptions) !== JSON.stringify(authorizationExceptions(entry.change.offenseId, entry.change.resultingValue))) throw new Error("An offense-status amendment does not follow the previously recognized code.");
        rule.legalStatus = entry.change.resultingValue;
      } else if (entry.kind === "procedureAmendment") {
        if (validationCode.procedure[entry.change.field] !== entry.change.previousValue) throw new Error("A procedure amendment does not follow the previously recognized procedure.");
        validationCode.procedure[entry.change.field] = entry.change.resultingValue;
      } else {
        if (validationCode.punishmentPolicy.finitePrisonMaximumMonths !== entry.change.previousValue) throw new Error("A sentencing amendment does not follow the previously recognized punishment policy.");
        validationCode.punishmentPolicy.finitePrisonMaximumMonths = entry.change.resultingValue;
      }
      amendmentIds.add(entry.id);
    }
    const directiveIds = new Set();
    for (const [index, entry] of record.directiveRows.entries()) {
      const sourceEvent = entry.sourceLayer === "crisisHistory" ? source.crisisEventById.get(entry.sourceEventId) : source.politicalEventById.get(entry.sourceEventId);
      const government = source.governmentByCityId.get(entry.cityId);
      const expectedStatus = entry.year <= record.historicalHorizonYear && record.historicalHorizonYear < entry.expiresYear ? "active" : "expired";
      if (directiveIds.has(entry.id) || !DIRECTIVE_KINDS.includes(entry.kind) || !sourceEvent || !government || !government.institutions.some((institution) => institution.id === entry.issuedThroughInstitutionId) || !Number.isInteger(entry.year) || !Number.isInteger(entry.expiresYear) || entry.expiresYear <= entry.year || (index && entry.year < record.directiveRows[index - 1].year) || entry.status !== expectedStatus || entry.recognizedAsLocalCriminalLaw || entry.changesOffenseElements || entry.independentConvictionAuthority || entry.guiltInferencePermitted || entry.permanentWithoutReenactment || !entry.localConvictionRequiresPublishedOffenseAndProof) throw new Error("A temporary legal directive violates its source, scope, expiration, or criminal-law boundary.");
      directiveIds.add(entry.id);
    }
    const resolved = baseCodes.map((code) => applyAmendmentsToCode(code, record.amendmentRows.filter((entry) => entry.cityId === code.city.id)));
    if (resolved.some((code) => code.procedure.criminalProofStandard !== "beyondReasonableDoubt" || !code.procedure.chargeElementsMustBeProvenSeparately || code.punishmentPolicy.lifeImprisonmentAvailable || code.punishmentPolicy.finitePrisonMaximumMonths < 36 || code.punishmentPolicy.finitePrisonMaximumMonths > 120 || code.punishmentPolicy.penalFlight.automaticDeath || !code.punishmentPolicy.publicEnemyDesignation.separateFindingRequired || !["prohibited", "restricted"].includes(code.offenseRules.find((rule) => rule.offenseId === "animancy").legalStatus))) throw new Error("Playable-year law violates an immutable procedural, punishment, or animancy constraint.");
    if (JSON.stringify(record.currentCodeRows) !== JSON.stringify(resolved.map(compactCurrentCode))) throw new Error("Saved playable-year legal facts do not match the enacted amendment chronology.");
    const publicJson = JSON.stringify(directory);
    if (/hiddenSponsorPolityId|discoverableHooks|nominalAuthorityActorIds|retroactiveGuiltPermitted|proofStandardChanged|offenseElementsChanged/.test(publicJson)) throw new Error("The public legal-history directory leaks hidden sponsorship or canonical factors.");
    if (directory.sourceLegalHistoryDigest !== record.digest || directory.knowledgePolicy !== "recognizedLawAndOvertDirectivesWithCovertSponsorsRedacted" || directory.amendmentChronology.length !== record.amendmentRows.length || directory.directiveChronology.length !== record.directiveRows.length || JSON.stringify(directory.currentCodeRows) !== JSON.stringify(record.currentCodeRows) || directory.activeDirectives.some((id) => !record.directiveRows.some((entry) => entry.id === id && entry.status === "active"))) throw new Error("The public legal-history directory is incomplete or inconsistent.");
    if (record.digest !== `strategic-legal-history-${StrategicWorld.stableHash(coreWithoutDigest(record))}` || directory.digest !== `public-legal-history-${StrategicWorld.stableHash(coreWithoutDigest(directory))}`) throw new Error("Strategic legal history does not match its digest.");
    const diagnostics = record.diagnostics;
    if (!diagnostics || diagnostics.cityCount !== baseCodes.length || diagnostics.amendmentCount !== record.amendmentRows.length || diagnostics.directiveCount !== record.directiveRows.length || diagnostics.activeDirectiveCount !== record.directiveRows.filter((entry) => entry.status === "active").length) throw new Error("Legal-history diagnostics do not match saved facts.");
    return { strategicLegalHistory: clone(record), publicDirectory: clone(directory) };
  }

  function attachStrategicLegalHistory(worldSeed, map) {
    const next = clone(map);
    const generated = createStrategicLegalHistory(worldSeed, next);
    next.strategicLegalHistory = generated.strategicLegalHistory;
    next.publicLegalHistoryDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function currentRecognizedCityCode(map, cityId) {
    if (!map?.strategicLegalHistory) return StrategicCityLaws.publicCityLawDirectory(map).find((code) => code.city.id === cityId) || null;
    const base = StrategicCityLaws.publicCityLawDirectory(map).find((code) => code.city.id === cityId);
    return base ? applyAmendmentsToCode(base, map.strategicLegalHistory.amendmentRows.filter((entry) => entry.cityId === cityId)) : null;
  }

  function currentRecognizedCityCodes(map) {
    if (!map?.strategicLegalHistory) return StrategicCityLaws.publicCityLawDirectory(map);
    return StrategicCityLaws.publicCityLawDirectory(map).map((base) => applyAmendmentsToCode(base, map.strategicLegalHistory.amendmentRows.filter((entry) => entry.cityId === base.city.id)));
  }

  function currentRecognizedRuleFor(map, cityId, offenseOrRuntimeChargeId) {
    const offenseId = StrategicCityLaws.RUNTIME_CHARGE_TO_OFFENSE[offenseOrRuntimeChargeId] || offenseOrRuntimeChargeId;
    return clone(currentRecognizedCityCode(map, cityId)?.offenseRules.find((rule) => rule.offenseId === offenseId) || null);
  }

  function publicLegalHistory(map) {
    if (!map?.publicLegalHistoryDirectory) return null;
    const result = clone(map.publicLegalHistoryDirectory);
    const source = sourceMaps(map);
    const polityById = new Map(map.cityPolities.polities.map((polity) => [polity.id, polity]));
    const expand = (entry) => ({ ...entry, city: clone(source.cityById.get(entry.cityId)), enactedByInstitution: clone(source.institutionById.get(entry.enactedByInstitutionId)), reviewedByInstitution: clone(source.institutionById.get(entry.reviewedByInstitutionId)), issuedThroughInstitution: clone(source.institutionById.get(entry.issuedThroughInstitutionId)), issuerPolity: clone(polityById.get(entry.issuerPolityId)) });
    result.amendmentChronology = result.amendmentChronology.map(expand);
    result.directiveChronology = result.directiveChronology.map(expand);
    result.activeDirectives = result.directiveChronology.filter((entry) => entry.status === "active");
    return result;
  }

  function currentCityLegalHistory(map, cityId) {
    const history = publicLegalHistory(map);
    if (!history) return null;
    return { cityId, amendments: history.amendmentChronology.filter((entry) => entry.cityId === cityId), directives: history.directiveChronology.filter((entry) => entry.cityId === cityId), activeDirectives: history.activeDirectives.filter((entry) => entry.cityId === cityId), currentCode: currentRecognizedCityCode(map, cityId) };
  }

  function auditStrategicLegalHistory(map) {
    const { strategicLegalHistory: record, publicDirectory } = validateStrategicLegalHistory(map);
    const codes = currentRecognizedCityCodes(map);
    return {
      valid: true,
      foundingCodesImmutable: record.sourceCityLegalCodesDigest === map.cityLegalCodes.digest,
      everyAmendmentCausallySourced: record.amendmentRows.every((entry) => entry.sourceEventId && entry.formalLocalProcessCompleted),
      amendmentsProspectiveOnly: record.amendmentRows.every((entry) => entry.prospectiveOnly && !entry.retroactiveGuiltPermitted),
      offenseCatalogImmutable: record.amendmentRows.every((entry) => !entry.offenseElementsChanged) && record.offenseCatalogDigest === StrategicWorld.stableHash(StrategicCityLaws.OFFENSE_CATALOG),
      proofStandardPreserved: codes.every((code) => code.procedure.criminalProofStandard === "beyondReasonableDoubt" && code.procedure.chargeElementsMustBeProvenSeparately),
      punishmentInvariantsPreserved: codes.every((code) => !code.punishmentPolicy.lifeImprisonmentAvailable && code.punishmentPolicy.finitePrisonMaximumMonths >= 36 && code.punishmentPolicy.finitePrisonMaximumMonths <= 120 && !code.punishmentPolicy.penalFlight.automaticDeath && code.punishmentPolicy.publicEnemyDesignation.separateFindingRequired),
      directivesRemainSeparateAndTemporary: record.directiveRows.every((entry) => !entry.recognizedAsLocalCriminalLaw && !entry.independentConvictionAuthority && !entry.permanentWithoutReenactment && entry.expiresYear > entry.year),
      publicHistoryHidesCovertSponsors: !JSON.stringify(publicDirectory).match(/hiddenSponsorPolityId|discoverableHooks|nominalAuthorityActorIds/),
      diagnostics: clone(record.diagnostics)
    };
  }

  return Object.freeze({ AMENDMENT_KINDS, DIRECTIVE_KINDS, createStrategicLegalHistory, validateStrategicLegalHistory, attachStrategicLegalHistory, currentRecognizedCityCode, currentRecognizedCityCodes, currentRecognizedRuleFor, publicLegalHistory, currentCityLegalHistory, auditStrategicLegalHistory });
});
