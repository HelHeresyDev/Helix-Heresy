(function initStrategicCityRecognition(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports
    ? require("./strategic-world")
    : root?.HelixStrategicWorld;
  const cityPolities = typeof module === "object" && module.exports
    ? require("./strategic-city-polities")
    : root?.HelixStrategicCityPolities;
  const cityGovernments = typeof module === "object" && module.exports
    ? require("./strategic-city-governments")
    : root?.HelixStrategicCityGovernments;
  const cityLaws = typeof module === "object" && module.exports
    ? require("./strategic-city-laws")
    : root?.HelixStrategicCityLaws;
  const api = factory(strategicWorld, cityPolities, cityGovernments, cityLaws);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicCityRecognition = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicCityRecognitionApi(StrategicWorld, StrategicCityPolities, StrategicCityGovernments, StrategicCityLaws) {
  "use strict";

  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before strategic-city-recognition.js");
  if (!StrategicCityPolities) throw new Error("HelixStrategicCityPolities must load before strategic-city-recognition.js");
  if (!StrategicCityGovernments) throw new Error("HelixStrategicCityGovernments must load before strategic-city-recognition.js");
  if (!StrategicCityLaws) throw new Error("HelixStrategicCityLaws must load before strategic-city-recognition.js");

  const PROFILE_CODE_LENGTH = 10;
  const SELF_PROFILE_CODE = "----------";
  const SELF_HIDDEN_CODE = "--";
  const AGREEMENT_TYPES = Object.freeze({ "0": "none", "1": "limited", "2": "broad" });
  const RECORD_RECOGNITION = Object.freeze({ a: "automatic", v: "verified", c: "caseReview", r: "refused" });
  const JUDGMENT_RECOGNITION = Object.freeze({ s: "recognizedAfterCertification", c: "caseReview", r: "refused" });
  const EVIDENCE_SHARING = Object.freeze({ s: "standingChannel", c: "caseReview", r: "refused" });
  const WARRANT_NOTICE = Object.freeze({ n: "noticeAcceptedForLocalReview", c: "caseReview", r: "refused" });
  const EXTRADITION_REVIEW = Object.freeze({ s: "standingReview", c: "caseSpecificReview", r: "ordinarilyRefused" });
  const TRANSIT_CUSTODY = Object.freeze({ s: "standingPermission", c: "caseSpecificPermission", r: "ordinarilyRefused" });
  const ASYLUM_REVIEW = Object.freeze({ d: "definedGroundsReview", e: "exceptionalReview", n: "notOffered" });
  const PUNISHMENT_ASSURANCE = Object.freeze({ r: "requiredForDisallowedOutcome", c: "reviewedCaseByCase", n: "noAdditionalAssurance" });
  const RESPONSE_TIMING = Object.freeze({ P: "prompt", O: "ordinary", S: "slow", B: "obstructive" });
  const DISCRETIONARY_POSTURE = Object.freeze({ s: "supportive", n: "neutral", r: "reluctant" });
  const CRIMINALIZED_STATUSES = Object.freeze(["prohibited", "restricted", "licensed"]);
  const ASYLUM_GROUNDS = Object.freeze(["crediblePoliticalRetaliation", "systemicDueProcessFailure", "persecutionOfProtectedStatus", "punishmentAssuranceFailure"]);

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function seededNumber(seed, channel) {
    return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff;
  }

  function recognitionCore(record) {
    return {
      sourceCityPolitiesDigest: record.sourceCityPolitiesDigest,
      sourceCityGovernmentsDigest: record.sourceCityGovernmentsDigest,
      sourceCityLegalCodesDigest: record.sourceCityLegalCodesDigest,
      cityOrder: record.cityOrder,
      hiddenRows: record.hiddenRows,
      diagnostics: record.diagnostics
    };
  }

  function relationFor(map, requestingCityId, receivingCityId) {
    const polityIds = [requestingCityId, receivingCityId]
      .map((cityId) => map.cityPolities.polities.find((polity) => polity.cityId === cityId)?.id)
      .filter(Boolean);
    return map.cityPolities.relations.find((relation) => polityIds.length === 2 && polityIds.every((id) => relation.cityPolityIds.includes(id))) || null;
  }

  function directRouteFor(map, leftCityId, rightCityId) {
    return map.routeGraph.routes.find((route) => route.endpointIds.includes(leftCityId) && route.endpointIds.includes(rightCityId)) || null;
  }

  function cityRoutePath(map, startCityId, goalCityId) {
    if (startCityId === goalCityId) return [startCityId];
    const neighbors = new Map(map.humanGeography.cities.map((city) => [city.id, []]));
    for (const route of map.routeGraph.routes) {
      const [left, right] = route.endpointIds;
      neighbors.get(left)?.push(right);
      neighbors.get(right)?.push(left);
    }
    const queue = [[startCityId]];
    const visited = new Set([startCityId]);
    while (queue.length) {
      const path = queue.shift();
      for (const next of neighbors.get(path[path.length - 1]) || []) {
        if (visited.has(next)) continue;
        const candidate = [...path, next];
        if (next === goalCityId) return candidate;
        visited.add(next);
        queue.push(candidate);
      }
    }
    return [];
  }

  function standingAgreementType(seed, relation, requestingCityId, receivingCityId) {
    const chance = relation
      ? ({ cordial: 0.74, pragmatic: 0.55, wary: 0.28, rival: 0.09, hostile: 0.02 }[relation.posture] || 0.08)
      : 0.018;
    if (seededNumber(seed, `recognition-agreement:${requestingCityId}:${receivingCityId}`) >= chance) return "0";
    const broadChance = relation && ["cordial", "pragmatic"].includes(relation.posture) ? 0.34 : 0.08;
    return seededNumber(seed, `recognition-agreement-scope:${requestingCityId}:${receivingCityId}`) < broadChance ? "2" : "1";
  }

  function profileCodeFor(seed, map, requestingCityId, receivingCityId, punishmentByCityId) {
    const relation = relationFor(map, requestingCityId, receivingCityId);
    const agreement = standingAgreementType(seed, relation, requestingCityId, receivingCityId);
    const broad = agreement === "2";
    const limited = agreement === "1";
    const hostile = relation?.posture === "hostile";
    const rival = relation?.posture === "rival";
    const random = (channel) => seededNumber(seed, `${channel}:${requestingCityId}:${receivingCityId}`);
    const identity = broad ? "a" : (limited || !hostile || random("identity") < 0.78 ? "v" : (random("identity-review") < 0.7 ? "c" : "r"));
    const corporate = broad && random("corporate-auto") < 0.62 ? "a" : (agreement !== "0" ? "v" : (hostile && random("corporate-hostile") < 0.65 ? "r" : "c"));
    const judgment = agreement !== "0" && !hostile ? "s" : (hostile || rival && random("judgment-rival") < 0.42 ? "r" : "c");
    const evidence = agreement !== "0" && !hostile ? "s" : (hostile && random("evidence-hostile") < 0.78 ? "r" : "c");
    const warrant = agreement !== "0" && !hostile ? "n" : (hostile && random("warrant-hostile") < 0.76 ? "r" : "c");
    const extradition = agreement !== "0" && !hostile && random("extradition-standing") < (broad ? 0.8 : 0.42)
      ? "s"
      : (hostile || rival && random("extradition-rival") < 0.58 ? "r" : "c");
    const directRoute = Boolean(directRouteFor(map, requestingCityId, receivingCityId));
    const transit = directRoute && agreement !== "0" && !hostile
      ? "s"
      : (hostile || !cityRoutePath(map, requestingCityId, receivingCityId).length ? "r" : "c");
    const receivingPolicy = punishmentByCityId.get(receivingCityId);
    const requestingPolicy = punishmentByCityId.get(requestingCityId);
    const asylumRoll = seededNumber(seed, `asylum-policy:${receivingCityId}`);
    const asylum = asylumRoll < 0.54 ? "d" : (asylumRoll < 0.88 ? "e" : "n");
    const disallowedCapitalDifference = Boolean(
      requestingPolicy?.publicExecution.available && !receivingPolicy?.publicExecution.available
      || requestingPolicy?.penalFlight.available && !receivingPolicy?.penalFlight.available
    );
    const assurance = disallowedCapitalDifference ? "r" : (random("punishment-assurance") < 0.58 ? "c" : "n");
    return `${agreement}${identity}${corporate}${judgment}${evidence}${warrant}${extradition}${transit}${asylum}${assurance}`;
  }

  function hiddenCodeFor(seed, map, requestingCityId, receivingCityId) {
    const relation = relationFor(map, requestingCityId, receivingCityId);
    const roll = seededNumber(seed, `recognition-response:${requestingCityId}:${receivingCityId}`);
    const posture = relation?.posture || "uncommitted";
    const timing = ["cordial", "pragmatic"].includes(posture)
      ? (roll < 0.55 ? "P" : "O")
      : (posture === "wary" || posture === "uncommitted" ? (roll < 0.65 ? "O" : "S") : (roll < 0.58 ? "S" : "B"));
    const discretion = ["cordial", "pragmatic"].includes(posture) ? "s" : (["rival", "hostile"].includes(posture) ? "r" : "n");
    return `${timing}${discretion}`;
  }

  function decodeProfile(map, requestingIndex, receivingIndex) {
    const directory = map?.publicCrossCityRecognitionDirectory;
    if (!directory || requestingIndex === receivingIndex || requestingIndex < 0 || receivingIndex < 0) return null;
    const code = directory.profileRows[requestingIndex]?.slice(receivingIndex * PROFILE_CODE_LENGTH, (receivingIndex + 1) * PROFILE_CODE_LENGTH);
    if (!code || code === SELF_PROFILE_CODE || code.length !== PROFILE_CODE_LENGTH) return null;
    const requestingCityId = directory.cityOrder[requestingIndex];
    const receivingCityId = directory.cityOrder[receivingIndex];
    const requestingCity = map.humanGeography.cities.find((city) => city.id === requestingCityId);
    const receivingCity = map.humanGeography.cities.find((city) => city.id === receivingCityId);
    const requestingPolity = map.cityPolities.polities.find((polity) => polity.cityId === requestingCityId);
    const receivingPolity = map.cityPolities.polities.find((polity) => polity.cityId === receivingCityId);
    const requestingGovernment = map.cityGovernments.governments.find((government) => government.cityId === requestingCityId);
    const receivingGovernment = map.cityGovernments.governments.find((government) => government.cityId === receivingCityId);
    const relation = relationFor(map, requestingCityId, receivingCityId);
    const routePath = cityRoutePath(map, receivingCityId, requestingCityId);
    const directRoute = directRouteFor(map, requestingCityId, receivingCityId);
    const scopes = [];
    if (code[1] === "a" || code[1] === "v") scopes.push("identityAndCivilRecords");
    if (code[2] === "a" || code[2] === "v") scopes.push("corporateAndProfessionalStanding");
    if (code[3] === "s") scopes.push("propertyAndCommercialJudgments");
    if (code[4] === "s") scopes.push("evidenceSharing");
    if (code[5] === "n") scopes.push("warrantNotices");
    if (code[6] === "s") scopes.push("extraditionReview");
    if (code[7] === "s") scopes.push("transitCustody");
    const refusalReasons = ["identityNotVerified", "doubleCriminalityMissing", "evidenceInsufficient", "proceduralIncompatibility", "unacceptablePunishmentWithoutBindingAssurance", "localProceedingsTakePriority", "protectedAsylumGround", "safePhysicalTransferUnavailable"];
    if (["rival", "hostile"].includes(relation?.posture)) refusalReasons.push("hostileIntercityRelations");
    return {
      id: `cross-city-recognition:${requestingCityId.slice(5)}:${receivingCityId.slice(5)}`,
      requestingCity: { id: requestingCity.id, name: requestingCity.name, polityId: requestingPolity.id },
      receivingCity: { id: receivingCity.id, name: receivingCity.name, polityId: receivingPolity.id },
      direction: "requestingCityAsksReceivingCity",
      relationship: relation ? { id: relation.id, basis: relation.basis, posture: relation.posture, cooperationReadiness: relation.cooperationReadiness } : { id: null, basis: "ordinaryInternetContact", posture: "uncommitted", cooperationReadiness: "caseSpecific" },
      standingAgreement: { type: AGREEMENT_TYPES[code[0]], exists: code[0] !== "0", scopes },
      recognition: {
        identityAndCivilRecords: RECORD_RECOGNITION[code[1]],
        corporateAndProfessionalStanding: RECORD_RECOGNITION[code[2]],
        propertyAndCommercialJudgments: JUDGMENT_RECOGNITION[code[3]],
        evidenceSharing: EVIDENCE_SHARING[code[4]],
        warrantNotices: WARRANT_NOTICE[code[5]]
      },
      extradition: {
        reviewAccess: EXTRADITION_REVIEW[code[6]],
        foreignWarrantSelfExecuting: false,
        receivingCityMustIssueLocalCustodyOrder: true,
        localJudicialInstitutionId: receivingGovernment.roleAssignments.judiciary,
        localEnforcementInstitutionId: receivingGovernment.roleAssignments.civilWatch,
        doubleCriminality: { required: true, comparison: "conductUnderSharedSemanticOffenseElements" },
        evidentiaryGateway: "certifiedFinalConvictionOrSupportedReasonableGrounds",
        convictionStillRequiresRecognition: true,
        guiltDeterminationAtRecognitionStage: false,
        punishmentAssurance: PUNISHMENT_ASSURANCE[code[9]],
        asylumReview: ASYLUM_REVIEW[code[8]],
        asylumGrounds: code[8] === "n" ? [] : [...ASYLUM_GROUNDS],
        politicalOffenseAutomaticExemption: false,
        deportationCountsAsExtradition: false,
        refusalReasons
      },
      transitCustody: {
        permission: TRANSIT_CUSTODY[code[7]],
        everyIntermediateCityMustConsent: true,
        transferMustUseControlledFacilityOrConvoy: true,
        internetNoticeCreatesPhysicalAuthority: false,
        wildernessHasOrdinarySovereignJurisdiction: false,
        routeClass: directRoute ? "directIntercityCorridor" : (routePath.length ? "multiCityTransitRequired" : "noKnownSupportedRoute"),
        routeCityIds: routePath,
        receivingCustodyInstitutionId: receivingGovernment.roleAssignments.temporaryJailAuthority,
        requestingCustodyInstitutionId: requestingGovernment.roleAssignments.temporaryJailAuthority
      },
      diplomaticConsequences: {
        compliantCooperation: ["recognitionReliabilityImproved", "futureCaseReviewFrictionReduced"],
        lawfulRefusal: ["requestingCityMayProtest", "receivingCityRetainsSovereignDiscretion"],
        unlawfulForeignSeizure: ["sovereigntyViolation", "custodyChallenge", "relationshipDeterioration"],
        transferBreach: ["custodyResponsibilityDispute", "transitPermissionReview"],
        createsSuperiorAuthorityOrPermanentAlliance: false
      }
    };
  }

  function createCrossCityRecognition(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for cross-city recognition generation.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCityPolities.validateCityPolities(strategicMap);
    StrategicCityGovernments.validateCityGovernments(strategicMap);
    StrategicCityLaws.validateCityLegalCodes(strategicMap);
    const cityOrder = strategicMap.humanGeography.cities.map((city) => city.id).sort();
    const punishmentByCityId = new Map(StrategicCityLaws.publicCityLawDirectory(strategicMap).map((code) => [code.city.id, code.punishmentPolicy]));
    const profileRows = cityOrder.map((requestingCityId) => cityOrder.map((receivingCityId) => requestingCityId === receivingCityId ? SELF_PROFILE_CODE : profileCodeFor(seed, strategicMap, requestingCityId, receivingCityId, punishmentByCityId)).join(""));
    const hiddenRows = cityOrder.map((requestingCityId) => cityOrder.map((receivingCityId) => requestingCityId === receivingCityId ? SELF_HIDDEN_CODE : hiddenCodeFor(seed, strategicMap, requestingCityId, receivingCityId)).join(""));
    const profileCodes = profileRows.flatMap((row, requestingIndex) => cityOrder.map((_, receivingIndex) => row.slice(receivingIndex * PROFILE_CODE_LENGTH, (receivingIndex + 1) * PROFILE_CODE_LENGTH)).filter((code) => code !== SELF_PROFILE_CODE));
    const record = {
      sourceCityPolitiesDigest: strategicMap.cityPolities.digest,
      sourceCityGovernmentsDigest: strategicMap.cityGovernments.digest,
      sourceCityLegalCodesDigest: strategicMap.cityLegalCodes.digest,
      cityOrder,
      hiddenRows,
      diagnostics: {
        directedPairCount: cityOrder.length * (cityOrder.length - 1),
        standingAgreementCount: profileCodes.filter((code) => code[0] !== "0").length,
        standingExtraditionReviewCount: profileCodes.filter((code) => code[6] === "s").length,
        ordinarilyRefusedExtraditionCount: profileCodes.filter((code) => code[6] === "r").length,
        directTransitPermissionCount: profileCodes.filter((code) => code[7] === "s").length
      }
    };
    record.digest = `cross-city-recognition-${StrategicWorld.stableHash(recognitionCore(record))}`;
    const publicDirectory = { sourceRecognitionDigest: record.digest, cityOrder: [...cityOrder], profileRows };
    publicDirectory.digest = `public-cross-city-recognition-${StrategicWorld.stableHash(publicDirectory)}`;
    return { crossCityRecognition: record, publicDirectory };
  }

  function publicProfileFor(map, requestingCityId, receivingCityId) {
    const directory = map?.publicCrossCityRecognitionDirectory;
    if (!directory) return null;
    return decodeProfile(map, directory.cityOrder.indexOf(requestingCityId), directory.cityOrder.indexOf(receivingCityId));
  }

  function publicProfilesFrom(map, requestingCityId) {
    const directory = map?.publicCrossCityRecognitionDirectory;
    if (!directory) return [];
    return directory.cityOrder.filter((cityId) => cityId !== requestingCityId).map((receivingCityId) => publicProfileFor(map, requestingCityId, receivingCityId)).filter(Boolean);
  }

  function hiddenCooperationFor(map, requestingCityId, receivingCityId) {
    const record = map?.crossCityRecognition;
    if (!record) return null;
    const requestingIndex = record.cityOrder.indexOf(requestingCityId);
    const receivingIndex = record.cityOrder.indexOf(receivingCityId);
    if (requestingIndex < 0 || receivingIndex < 0 || requestingIndex === receivingIndex) return null;
    const code = record.hiddenRows[requestingIndex].slice(receivingIndex * 2, receivingIndex * 2 + 2);
    return {
      requestingCityId,
      receivingCityId,
      expectedResponseTiming: RESPONSE_TIMING[code[0]],
      discretionaryCooperationPosture: DISCRETIONARY_POSTURE[code[1]],
      mayAlterPublishedLaw: false,
      mayLowerEvidenceRequirements: false,
      guiltInferencePermitted: false
    };
  }

  function offenseRuleFor(map, cityId, offenseId) {
    return StrategicCityLaws.publicRuleFor(map, cityId, offenseId);
  }

  function doubleCriminalityFor(map, requestingCityId, receivingCityId, offenseId) {
    const requestingRule = offenseRuleFor(map, requestingCityId, offenseId);
    const receivingRule = offenseRuleFor(map, receivingCityId, offenseId);
    return {
      offenseId,
      sharedSemanticElements: Boolean(requestingRule && receivingRule),
      requestingLegalStatus: requestingRule?.legalStatus || null,
      receivingLegalStatus: receivingRule?.legalStatus || null,
      satisfiedForUnauthorizedConduct: Boolean(requestingRule && receivingRule && CRIMINALIZED_STATUSES.includes(requestingRule.legalStatus) && CRIMINALIZED_STATUSES.includes(receivingRule.legalStatus))
    };
  }

  function evaluateExtraditionRequest(map, request = {}) {
    const profile = publicProfileFor(map, request.requestingCityId, request.receivingCityId);
    if (!profile) throw new Error("A valid directional city pair is required for extradition evaluation.");
    const blockers = [];
    const reviewFactors = [];
    const deferrals = [];
    const doubleCriminality = doubleCriminalityFor(map, request.requestingCityId, request.receivingCityId, request.offenseId);
    if (profile.extradition.reviewAccess === "ordinarilyRefused") blockers.push("noOrdinaryExtraditionAccess");
    if (request.identityVerified !== true) blockers.push("identityNotVerified");
    if (!doubleCriminality.satisfiedForUnauthorizedConduct) blockers.push("doubleCriminalityMissing");
    if (request.finalConviction !== true && request.evidenceSupportsReasonableGrounds !== true) blockers.push("evidenceInsufficient");
    if (request.finalConviction === true) reviewFactors.push("foreignConvictionRequiresRecognition");
    if (request.localChargesPending === true) deferrals.push("receivingCityProceedingsTakePriority");
    const requestedOutcome = String(request.requestedOutcome || "");
    if (requestedOutcome === "lifeImprisonment") blockers.push("lifeImprisonmentUnavailable");
    const receivingLaw = StrategicCityLaws.publicCityLawDirectory(map).find((code) => code.city.id === request.receivingCityId)?.punishmentPolicy;
    if (requestedOutcome === "publicExecution" && !receivingLaw?.publicExecution.available && request.bindingAlternativeSentenceAssurance !== true) blockers.push("publicExecutionAssuranceRequired");
    if (requestedOutcome === "penalFlight" && !receivingLaw?.penalFlight.available && request.bindingAlternativeSentenceAssurance !== true) blockers.push("penalFlightAssuranceRequired");
    if (request.assertedAsylumGround && profile.extradition.asylumGrounds.includes(request.assertedAsylumGround)) reviewFactors.push("protectedAsylumClaimRequiresJudicialReview");
    if (profile.transitCustody.routeClass === "noKnownSupportedRoute" || request.transferRouteConfirmed !== true) blockers.push("safePhysicalTransferUnavailable");
    if (profile.transitCustody.routeClass === "multiCityTransitRequired" && request.intermediateTransitPermissionsConfirmed !== true) blockers.push("intermediateTransitPermissionsMissing");
    const disposition = blockers.length ? "notEligibleForLocalCustodyOrder" : (deferrals.length ? "deferredBeforeLocalReview" : "eligibleForLocalJudicialReview");
    return {
      disposition,
      profileId: profile.id,
      blockers,
      deferrals,
      reviewFactors,
      doubleCriminality,
      localCustodyOrderStillRequired: true,
      foreignWarrantExecutedDirectly: false,
      guiltDetermination: "none",
      diplomaticConsequenceClass: blockers.length ? "documentedRefusalOrDispute" : (deferrals.length ? "lawfulDeferral" : "cooperationOpportunity")
    };
  }

  function validateCrossCityRecognition(map, record = map?.crossCityRecognition, publicDirectory = map?.publicCrossCityRecognitionDirectory) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCityPolities.validateCityPolities(strategicMap);
    StrategicCityGovernments.validateCityGovernments(strategicMap);
    StrategicCityLaws.validateCityLegalCodes(strategicMap);
    const expectedOrder = strategicMap.humanGeography.cities.map((city) => city.id).sort();
    const count = expectedOrder.length;
    if (!record || !publicDirectory || record.sourceCityPolitiesDigest !== strategicMap.cityPolities.digest || record.sourceCityGovernmentsDigest !== strategicMap.cityGovernments.digest || record.sourceCityLegalCodesDigest !== strategicMap.cityLegalCodes.digest || JSON.stringify(record.cityOrder) !== JSON.stringify(expectedOrder) || JSON.stringify(publicDirectory.cityOrder) !== JSON.stringify(expectedOrder) || !Array.isArray(record.hiddenRows) || !Array.isArray(publicDirectory.profileRows) || record.hiddenRows.length !== count || publicDirectory.profileRows.length !== count) throw new Error("Cross-city recognition records are incomplete or do not match their source cities.");
    if (Object.hasOwn(publicDirectory, "hiddenRows") || JSON.stringify(publicDirectory).includes("discretionaryCooperationPosture")) throw new Error("Public cross-city recognition leaks hidden cooperation policy.");
    let agreements = 0;
    let standingExtradition = 0;
    let refusedExtradition = 0;
    let standingTransit = 0;
    for (let requestingIndex = 0; requestingIndex < count; requestingIndex += 1) {
      const publicRow = publicDirectory.profileRows[requestingIndex];
      const hiddenRow = record.hiddenRows[requestingIndex];
      if (typeof publicRow !== "string" || publicRow.length !== count * PROFILE_CODE_LENGTH || typeof hiddenRow !== "string" || hiddenRow.length !== count * 2) throw new Error("Cross-city recognition matrix dimensions are invalid.");
      for (let receivingIndex = 0; receivingIndex < count; receivingIndex += 1) {
        const publicCode = publicRow.slice(receivingIndex * PROFILE_CODE_LENGTH, (receivingIndex + 1) * PROFILE_CODE_LENGTH);
        const hiddenCode = hiddenRow.slice(receivingIndex * 2, receivingIndex * 2 + 2);
        if (requestingIndex === receivingIndex) {
          if (publicCode !== SELF_PROFILE_CODE || hiddenCode !== SELF_HIDDEN_CODE) throw new Error("Cross-city recognition cannot create foreign rules for a city recognizing itself.");
          continue;
        }
        if (!/^[012][avcr][avcr][scr][scr][ncr][scr][scr][den][rcn]$/.test(publicCode) || !/^[POSB][snr]$/.test(hiddenCode)) throw new Error("Cross-city recognition contains an invalid compact policy code.");
        const profile = decodeProfile(strategicMap, requestingIndex, receivingIndex);
        if (!profile || profile.extradition.foreignWarrantSelfExecuting || !profile.extradition.receivingCityMustIssueLocalCustodyOrder || !profile.extradition.doubleCriminality.required || profile.extradition.guiltDeterminationAtRecognitionStage || profile.transitCustody.wildernessHasOrdinarySovereignJurisdiction || profile.extradition.deportationCountsAsExtradition || profile.diplomaticConsequences.createsSuperiorAuthorityOrPermanentAlliance) throw new Error("Cross-city recognition violates jurisdiction or due-process guardrails.");
        const hidden = hiddenCooperationFor(strategicMap, record.cityOrder[requestingIndex], record.cityOrder[receivingIndex]);
        if (!hidden || hidden.mayAlterPublishedLaw || hidden.mayLowerEvidenceRequirements || hidden.guiltInferencePermitted) throw new Error("Hidden cooperation policy cannot alter law, evidence, or guilt.");
        if (publicCode[0] !== "0") agreements += 1;
        if (publicCode[6] === "s") standingExtradition += 1;
        if (publicCode[6] === "r") refusedExtradition += 1;
        if (publicCode[7] === "s") standingTransit += 1;
      }
    }
    const directedPairs = count * (count - 1);
    if (!record.diagnostics || record.diagnostics.directedPairCount !== directedPairs || record.diagnostics.standingAgreementCount !== agreements || record.diagnostics.standingExtraditionReviewCount !== standingExtradition || record.diagnostics.ordinarilyRefusedExtraditionCount !== refusedExtradition || record.diagnostics.directTransitPermissionCount !== standingTransit || agreements <= 0 || agreements >= directedPairs / 4) throw new Error("Cross-city agreements must remain sparse and diagnostics must match the saved matrix.");
    if (publicDirectory.sourceRecognitionDigest !== record.digest || record.digest !== `cross-city-recognition-${StrategicWorld.stableHash(recognitionCore(record))}`) throw new Error("Cross-city recognition does not match its digest.");
    const publicCore = clone(publicDirectory);
    delete publicCore.digest;
    if (publicDirectory.digest !== `public-cross-city-recognition-${StrategicWorld.stableHash(publicCore)}`) throw new Error("Public cross-city recognition does not match its digest.");
    return { crossCityRecognition: clone(record), publicDirectory: clone(publicDirectory) };
  }

  function attachCrossCityRecognition(worldSeed, map) {
    const next = StrategicWorld.validateStrategicMap(map);
    const generated = createCrossCityRecognition(worldSeed, next);
    next.crossCityRecognition = generated.crossCityRecognition;
    next.publicCrossCityRecognitionDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function auditCrossCityRecognition(map) {
    const { crossCityRecognition, publicDirectory } = validateCrossCityRecognition(map);
    const profiles = publicDirectory.cityOrder.flatMap((requestingCityId) => publicProfilesFrom(map, requestingCityId));
    const reverseDifference = profiles.some((profile) => {
      const reverse = publicProfileFor(map, profile.receivingCity.id, profile.requestingCity.id);
      return reverse && JSON.stringify(profile.recognition) !== JSON.stringify(reverse.recognition);
    });
    return {
      valid: true,
      directedPairCount: profiles.length,
      everyOrderedCityPairCovered: profiles.length === publicDirectory.cityOrder.length * (publicDirectory.cityOrder.length - 1),
      recognitionIsDirectional: reverseDifference,
      standingAgreementsAreSparse: crossCityRecognition.diagnostics.standingAgreementCount < profiles.length / 4,
      foreignWarrantsNeverSelfExecute: profiles.every((profile) => !profile.extradition.foreignWarrantSelfExecuting),
      localCustodyOrderAlwaysRequired: profiles.every((profile) => profile.extradition.receivingCityMustIssueLocalCustodyOrder),
      doubleCriminalityAlwaysRequired: profiles.every((profile) => profile.extradition.doubleCriminality.required),
      deportationAlwaysDistinct: profiles.every((profile) => !profile.extradition.deportationCountsAsExtradition),
      wildernessNeverOrdinaryJurisdiction: profiles.every((profile) => !profile.transitCustody.wildernessHasOrdinarySovereignJurisdiction),
      publicDirectoryHidesDiscretion: !Object.hasOwn(publicDirectory, "hiddenRows") && !JSON.stringify(publicDirectory).includes("discretionaryCooperationPosture"),
      hiddenPolicyCannotAlterDueProcess: publicDirectory.cityOrder.every((requestingCityId) => publicDirectory.cityOrder.filter((receivingCityId) => receivingCityId !== requestingCityId).every((receivingCityId) => {
        const hidden = hiddenCooperationFor(map, requestingCityId, receivingCityId);
        return hidden && !hidden.mayAlterPublishedLaw && !hidden.mayLowerEvidenceRequirements && !hidden.guiltInferencePermitted;
      }))
    };
  }

  return Object.freeze({
    PROFILE_CODE_LENGTH,
    ASYLUM_GROUNDS,
    CRIMINALIZED_STATUSES,
    createCrossCityRecognition,
    validateCrossCityRecognition,
    attachCrossCityRecognition,
    publicProfileFor,
    publicProfilesFrom,
    hiddenCooperationFor,
    doubleCriminalityFor,
    evaluateExtraditionRequest,
    auditCrossCityRecognition
  });
});
