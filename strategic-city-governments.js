(function initStrategicCityGovernments(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports
    ? require("./strategic-world")
    : root?.HelixStrategicWorld;
  const cityPolities = typeof module === "object" && module.exports
    ? require("./strategic-city-polities")
    : root?.HelixStrategicCityPolities;
  const beastEcology = typeof module === "object" && module.exports
    ? require("./strategic-beast-ecology")
    : root?.HelixStrategicBeastEcology;
  const api = factory(strategicWorld, cityPolities, beastEcology);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicCityGovernments = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicCityGovernmentsApi(StrategicWorld, StrategicCityPolities, StrategicBeastEcology) {
  "use strict";

  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before strategic-city-governments.js");
  if (!StrategicCityPolities) throw new Error("HelixStrategicCityPolities must load before strategic-city-governments.js");
  if (!StrategicBeastEcology) throw new Error("HelixStrategicBeastEcology must load before strategic-city-governments.js");

  const CIVIC_ROLES = Object.freeze([
    "centralAdministration",
    "civicReview",
    "judiciary",
    "publicProsecution",
    "civilWatch",
    "temporaryJailAuthority",
    "longTermCorrectionsAuthority",
    "militaryDefenseCommand",
    "emergencyManagement",
    "publicWorksAndProvisioning"
  ]);
  const AUTHORITY_RELATIONS = Object.freeze(["appoints", "funds", "commands", "audits", "reviews", "mayOverrule"]);
  const CAPACITY_BANDS = Object.freeze(["fragile", "strained", "functional", "strong", "exceptional"]);
  const INDEPENDENCE_BANDS = Object.freeze(["subordinate", "constrained", "balanced", "insulated"]);
  const RISK_BANDS = Object.freeze(["low", "moderate", "high", "severe"]);
  const JURISDICTION_SCOPE = Object.freeze({
    core: "exclusiveCityJurisdiction",
    approaches: "exclusiveCityJurisdiction",
    corridors: "facilityConvoyOrAgreementOnly",
    wilderness: "none",
    internet: "localEffectsAndInfrastructureOnly",
    extraterritorialEnforcement: "explicitAgreementOrCaseRequestOnly"
  });
  const ROLE_DEFINITIONS = Object.freeze({
    centralAdministration: { name: "Civic Administration", kind: "administration", branches: ["registry", "treasury", "public-records"], mandate: "Administer the charter, city records, revenue, and routine civic coordination." },
    civicReview: { name: "Charter Council", kind: "review", branches: ["charter-audit", "appointments-review"], mandate: "Audit public authority and review acts that exceed ordinary charter powers." },
    judiciary: { name: "Civic Court", kind: "court", branches: ["criminal-bench", "civil-bench", "charter-bench"], mandate: "Hear cases under this city's own law and review exercises of coercive power." },
    publicProsecution: { name: "Public Prosecution Office", kind: "prosecution", branches: ["charging", "warrants", "appeals"], mandate: "Bring public cases, request warrants, and disclose the legal basis for charges." },
    civilWatch: { name: "Civil Watch", kind: "lawEnforcement", branches: ["patrol", "investigation", "warrant-service"], mandate: "Protect the fortified city, investigate local offenses, and execute lawful orders." },
    temporaryJailAuthority: { name: "Jail Authority", kind: "temporaryDetention", branches: ["booking", "temporary-holding", "court-transport"], mandate: "Operate short-term custody before and during trial, distinct from sentence administration." },
    longTermCorrectionsAuthority: { name: "Corrections Authority", kind: "longTermPunishment", branches: ["prison-administration", "sentence-discipline", "release-review"], mandate: "Administer post-conviction prison sentences and other long-term punishments." },
    militaryDefenseCommand: { name: "Defense Command", kind: "militaryDefense", branches: ["walls-and-wards", "aerial-defense", "wilderness-response"], mandate: "Defend the city and its approaches against beasts and organized attack." },
    emergencyManagement: { name: "Emergency Directorate", kind: "emergencyManagement", branches: ["warning-center", "evacuation-coordination", "disaster-response"], mandate: "Receive warnings, coordinate shelter or evacuation, and maintain emergency continuity." },
    publicWorksAndProvisioning: { name: "Public Works Directorate", kind: "publicWorks", branches: ["utilities", "protected-provisioning", "corridor-service"], mandate: "Maintain essential infrastructure, protected supplies, and city-controlled approaches." }
  });

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function seededNumber(seed, channel) {
    return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff;
  }

  function slug(value) {
    return String(value).replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  }

  function readable(value) {
    return String(value).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase());
  }

  function scoreBand(score) {
    if (score >= 4.25) return "exceptional";
    if (score >= 3.25) return "strong";
    if (score >= 2.2) return "functional";
    if (score >= 1.2) return "strained";
    return "fragile";
  }

  function capacityFor(seed, city, polity, roles, warningCount) {
    const infrastructure = ({ limited: 0.7, adequate: 1.7, strong: 2.8, formidable: 3.8 })[city.infrastructurePotentialBand] ?? 1;
    const isolation = ({ connected: 0.45, remote: -0.15, extreme: -0.55 })[city.isolationBand] ?? 0;
    const pressureRoles = new Set(["civilWatch", "militaryDefenseCommand", "emergencyManagement", "publicWorksAndProvisioning"]);
    const pressure = roles.some((role) => pressureRoles.has(role)) ? Math.min(0.75, warningCount * 0.18) : 0;
    const priorityText = polity.civicPriorities.join(" ").toLowerCase();
    const emphasis = roles.some((role) => priorityText.includes(slug(role).split("-")[0])) ? 0.35 : 0;
    const variance = seededNumber(seed, `${city.id}:${roles.join("+")}:capacity`) * 1.25 - 0.55;
    return {
      capacityBand: scoreBand(infrastructure + isolation + pressure + emphasis + variance),
      causalFactors: [
        `infrastructurePotential:${city.infrastructurePotentialBand}`,
        `isolation:${city.isolationBand}`,
        `publicWaveWarningCount:${warningCount}`,
        `civicPriorityAlignment:${emphasis ? "present" : "none"}`
      ]
    };
  }

  function independenceFor(seed, polity, roles) {
    const reviewOrCourt = roles.some((role) => role === "civicReview" || role === "judiciary");
    const collective = polity.authority.kind === "collective";
    const score = (reviewOrCourt ? 1 : 0) + (collective ? 1 : 0) + seededNumber(seed, `${polity.id}:${roles.join("+")}:independence`) * 2;
    return INDEPENDENCE_BANDS[Math.min(INDEPENDENCE_BANDS.length - 1, Math.floor(score))];
  }

  function legitimacyBasis(polity) {
    if (polity.authority.kind === "collective") return `The charter recognizes ${polity.authority.name} through ${polity.governingForm}.`;
    return `The charter recognizes ${polity.authority.title} ${polity.authority.name} through ${polity.governingForm}.`;
  }

  function decisionRule(polity) {
    if (polity.authority.kind === "collective") return "The sovereign authority acts by recorded internal resolution; delegated offices act within published mandates.";
    return "The sovereign authority may issue recorded directives; delegated offices act within published mandates and review limits.";
  }

  function groupingFor(seed, polity) {
    const form = polity.governingForm.toLowerCase();
    const priorities = polity.civicPriorities.join(" ").toLowerCase();
    const collective = polity.authority.kind === "collective";
    const militarized = /military|fortress|emergency/.test(form) || /defense|weapon|fortress|monster/.test(priorities);
    const combinedJustice = /tribunal/.test(form) || (!collective && seededNumber(seed, `${polity.id}:combined-justice`) < 0.55);
    const combinedServices = /emergency/.test(form) || polity.logisticalDependencies.some((value) => /water|agriculture|energy/.test(value)) || seededNumber(seed, `${polity.id}:combined-services`) < 0.42;
    const groups = [
      ["centralAdministration"],
      ["civicReview"],
      ...(combinedJustice ? [["judiciary", "publicProsecution"]] : [["judiciary"], ["publicProsecution"]]),
      ...(militarized ? [["civilWatch", "militaryDefenseCommand"]] : [["civilWatch"], ["militaryDefenseCommand"]]),
      ["temporaryJailAuthority"],
      ["longTermCorrectionsAuthority"],
      ...(combinedServices ? [["emergencyManagement", "publicWorksAndProvisioning"]] : [["emergencyManagement"], ["publicWorksAndProvisioning"]])
    ];
    return groups;
  }

  function institutionFor(seed, city, polity, roles, warningCount, ordinal) {
    const primary = ROLE_DEFINITIONS[roles[0]];
    const combined = roles.length > 1;
    const name = combined
      ? `${city.name} ${roles.includes("judiciary") ? "Civic Tribunal" : roles.includes("militaryDefenseCommand") ? "Unified Defense Command" : roles.includes("emergencyManagement") ? "Continuity Works Directorate" : "Civic Administration"}`
      : `${city.name} ${primary.name}`;
    const capacity = capacityFor(seed, city, polity, roles, warningCount);
    const institutionId = `city-institution:${ordinal}:${slug(roles.join("-"))}`;
    return {
      id: institutionId,
      publicName: name,
      kind: combined ? "combinedCivicInstitution" : primary.kind,
      roles: [...roles],
      responsibilities: roles.map((role) => ROLE_DEFINITIONS[role].mandate),
      branches: roles.flatMap((role) => ROLE_DEFINITIONS[role].branches.map((branch) => ({
        id: `${institutionId}:branch:${slug(role)}:${branch}`,
        role,
        title: readable(branch)
      }))),
      appointmentMethod: roles.includes("civicReview") && polity.authority.kind === "collective" ? "charterDefinedSelection" : "appointmentBySovereignAuthority",
      fundingInstitutionId: roles.includes("centralAdministration") ? institutionId : `city-institution:${ordinal}:central-administration`,
      commandAuthorityId: polity.authority.id,
      ...capacity,
      independenceBand: independenceFor(seed, polity, roles),
      publicMandate: roles.map((role) => ROLE_DEFINITIONS[role].mandate).join(" "),
      currentOfficeholderId: null,
      officeholderMaterialization: "lazyWhenNeeded"
    };
  }

  function governmentFor(worldSeed, map, city, polity) {
    const ordinal = city.id.slice(5);
    const publicAtlas = map.publicBeastAtlas;
    const assessment = publicAtlas.cityAttackAssessments.find((entry) => entry.cityId === city.id);
    const warnings = publicAtlas.waveWarnings.filter((entry) => entry.threatenedCityIds.includes(city.id));
    const sharedThreats = publicAtlas.sharedThreatReports.filter((entry) => entry.cityIds.includes(city.id));
    const groups = groupingFor(worldSeed, polity);
    const institutions = groups.map((roles) => institutionFor(worldSeed, city, polity, roles, warnings.length, ordinal));
    const roleAssignments = Object.fromEntries(CIVIC_ROLES.map((role) => [role, institutions.find((institution) => institution.roles.includes(role)).id]));
    const adminId = roleAssignments.centralAdministration;
    const reviewId = roleAssignments.civicReview;
    const edges = [];
    let edgeIndex = 1;
    function edge(fromId, toId, relation) {
      edges.push({ id: `authority-edge:${ordinal}:${String(edgeIndex).padStart(2, "0")}`, fromId, toId, relation });
      edgeIndex += 1;
    }
    for (const institution of institutions) {
      edge(polity.authority.id, institution.id, "appoints");
      if (institution.id !== adminId) edge(adminId, institution.id, "funds");
      if (["civilWatch", "militaryDefenseCommand", "emergencyManagement"].some((role) => institution.roles.includes(role))) edge(polity.authority.id, institution.id, "commands");
      if (institution.id !== reviewId) edge(reviewId, institution.id, "audits");
    }
    if (roleAssignments.judiciary !== roleAssignments.publicProsecution) edge(roleAssignments.judiciary, roleAssignments.publicProsecution, "reviews");
    edge(reviewId, polity.authority.id, "reviews");
    edge(polity.authority.id, roleAssignments.emergencyManagement, "mayOverrule");
    const riskIndex = (channel) => Math.min(3, Math.floor(seededNumber(worldSeed, `${city.id}:${channel}`) * 4));
    return {
      id: `city-government:${ordinal}`,
      cityId: city.id,
      polityId: polity.id,
      authorityId: polity.authority.id,
      sovereigntyScope: "cityOnly",
      superiorGovernmentId: null,
      stateMembership: null,
      charter: {
        id: `city-charter:${ordinal}`,
        legitimacyBasis: legitimacyBasis(polity),
        decisionRule: decisionRule(polity),
        successionPrinciple: polity.successionPrinciple,
        continuityProcedure: "The charter preserves institutions and delegates temporary authority until the succession rule resolves sovereign continuity.",
        emergencyPowers: {
          declarationAuthorityId: polity.authority.id,
          triggers: ["credibleBeastWaveWarning", "breachOfFortifiedApproach", "essentialInfrastructureFailure"],
          reviewInstitutionId: reviewId,
          boundedPowers: ["mobilizeDefenses", "directEmergencyEvacuation", "requisitionEssentialLocalSupplies"],
          expiresWithoutRenewal: true
        },
        jurisdictionClaim: clone(JURISDICTION_SCOPE)
      },
      institutions,
      roleAssignments,
      authorityGraph: edges,
      threatReadiness: {
        attackAssessmentId: assessment.id,
        waveWarningIds: warnings.map((entry) => entry.id),
        sharedThreatReportIds: sharedThreats.map((entry) => entry.id),
        responsibleInstitutionIds: [...new Set([roleAssignments.civilWatch, roleAssignments.militaryDefenseCommand, roleAssignments.emergencyManagement, roleAssignments.publicWorksAndProvisioning])],
        coalitionStatus: "none"
      },
      hiddenOperationalRisks: {
        institutionalCapture: RISK_BANDS[riskIndex("institutional-capture")],
        coercionAbuse: RISK_BANDS[riskIndex("coercion-abuse")],
        successionDisruption: RISK_BANDS[riskIndex("succession-disruption")],
        causalFactors: [`authorityKind:${polity.authority.kind}`, `isolation:${city.isolationBand}`, `logisticalDependencies:${polity.logisticalDependencies.join(",")}`]
      }
    };
  }

  function publicEntry(government, city, polity) {
    return {
      id: government.id,
      city: { id: city.id, name: city.name, cellId: city.cellId },
      polity: { id: polity.id, name: polity.name, sovereignty: polity.sovereignty },
      authority: clone(polity.authority),
      sovereigntyScope: government.sovereigntyScope,
      superiorGovernmentId: government.superiorGovernmentId,
      stateMembership: government.stateMembership,
      charter: clone(government.charter),
      institutions: government.institutions.map((institution) => ({
        id: institution.id,
        publicName: institution.publicName,
        kind: institution.kind,
        roles: [...institution.roles],
        responsibilities: [...institution.responsibilities],
        branches: clone(institution.branches),
        appointmentMethod: institution.appointmentMethod,
        capacityBand: institution.capacityBand,
        independenceBand: institution.independenceBand,
        publicMandate: institution.publicMandate,
        causalFactors: [...institution.causalFactors]
      })),
      roleAssignments: clone(government.roleAssignments),
      authorityGraph: clone(government.authorityGraph),
      threatReadiness: clone(government.threatReadiness)
    };
  }

  function governmentCore(record) {
    return {
      sourceCityPolitiesDigest: record.sourceCityPolitiesDigest,
      sourceBeastEcologyDigest: record.sourceBeastEcologyDigest,
      governments: record.governments,
      diagnostics: record.diagnostics
    };
  }

  function createCityGovernments(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for city-government generation.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCityPolities.validateCityPolities(strategicMap);
    StrategicBeastEcology.validateBeastEcology(strategicMap);
    const governments = strategicMap.humanGeography.cities.map((city) => governmentFor(
      seed,
      strategicMap,
      city,
      strategicMap.cityPolities.polities.find((entry) => entry.cityId === city.id)
    ));
    const record = {
      sourceCityPolitiesDigest: strategicMap.cityPolities.digest,
      sourceBeastEcologyDigest: strategicMap.beastEcology.digest,
      governments,
      diagnostics: {
        governmentCount: governments.length,
        institutionCount: governments.reduce((total, entry) => total + entry.institutions.length, 0),
        distinctJailAndPrisonCount: governments.filter((entry) => entry.roleAssignments.temporaryJailAuthority !== entry.roleAssignments.longTermCorrectionsAuthority).length,
        independentCityCount: governments.filter((entry) => entry.sovereigntyScope === "cityOnly" && entry.superiorGovernmentId === null && entry.stateMembership === null).length,
        lazyOfficeholderCount: governments.flatMap((entry) => entry.institutions).filter((entry) => entry.officeholderMaterialization === "lazyWhenNeeded").length
      }
    };
    record.digest = `city-governments-${StrategicWorld.stableHash(governmentCore(record))}`;
    const publicDirectory = {
      sourceGovernmentDigest: record.digest,
      entries: governments.map((government) => {
        const city = strategicMap.humanGeography.cities.find((entry) => entry.id === government.cityId);
        const polity = strategicMap.cityPolities.polities.find((entry) => entry.id === government.polityId);
        return publicEntry(government, city, polity);
      })
    };
    publicDirectory.digest = `public-city-governments-${StrategicWorld.stableHash(publicDirectory)}`;
    return { cityGovernments: record, publicDirectory };
  }

  function validateCityGovernments(map, record = map?.cityGovernments, publicDirectory = map?.publicCityGovernmentDirectory) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCityPolities.validateCityPolities(strategicMap);
    StrategicBeastEcology.validateBeastEcology(strategicMap);
    if (!record || !publicDirectory || record.sourceCityPolitiesDigest !== strategicMap.cityPolities.digest || record.sourceBeastEcologyDigest !== strategicMap.beastEcology.digest || !Array.isArray(record.governments) || record.governments.length !== strategicMap.humanGeography.cities.length) throw new Error("City-government records are incomplete or do not match their source world.");
    const publicById = new Map(publicDirectory.entries?.map((entry) => [entry.id, entry]) || []);
    if (publicDirectory.sourceGovernmentDigest !== record.digest || publicById.size !== record.governments.length) throw new Error("Public city-government directory is incomplete.");
    for (const government of record.governments) {
      const ordinal = String(government.cityId || "").slice(5);
      const polity = strategicMap.cityPolities.polities.find((entry) => entry.cityId === government.cityId);
      const institutionIds = new Set(government.institutions?.map((entry) => entry.id) || []);
      const jailId = government.roleAssignments?.temporaryJailAuthority;
      const prisonId = government.roleAssignments?.longTermCorrectionsAuthority;
      if (!polity || government.id !== `city-government:${ordinal}` || government.polityId !== polity.id || government.authorityId !== polity.authority.id || government.sovereigntyScope !== "cityOnly" || government.superiorGovernmentId !== null || government.stateMembership !== null) throw new Error("Every city government must be an independent city-only government.");
      if (JSON.stringify(government.charter?.jurisdictionClaim) !== JSON.stringify(JURISDICTION_SCOPE) || government.charter?.emergencyPowers?.expiresWithoutRenewal !== true || !institutionIds.has(government.charter?.emergencyPowers?.reviewInstitutionId)) throw new Error(`${government.id} has an invalid bounded charter.`);
      if (government.institutions.length < 7 || government.institutions.length > 10 || institutionIds.size !== government.institutions.length || CIVIC_ROLES.some((role) => !institutionIds.has(government.roleAssignments?.[role])) || !jailId || jailId === prisonId) throw new Error(`${government.id} does not cover its essential, distinct civic responsibilities.`);
      const assignedRoles = government.institutions.flatMap((institution) => institution.roles);
      if (assignedRoles.length !== CIVIC_ROLES.length || new Set(assignedRoles).size !== CIVIC_ROLES.length || CIVIC_ROLES.some((role) => assignedRoles.filter((candidate) => candidate === role).length !== 1)) throw new Error(`${government.id} must assign every civic role exactly once.`);
      for (const institution of government.institutions) {
        if (!institution.roles.length || institution.roles.some((role) => !CIVIC_ROLES.includes(role)) || !institutionIds.has(institution.fundingInstitutionId) || institution.commandAuthorityId !== polity.authority.id || !CAPACITY_BANDS.includes(institution.capacityBand) || !INDEPENDENCE_BANDS.includes(institution.independenceBand) || institution.currentOfficeholderId !== null || institution.officeholderMaterialization !== "lazyWhenNeeded") throw new Error(`${institution.id} has invalid institutional facts.`);
      }
      const nodes = new Set([polity.authority.id, ...institutionIds]);
      if (!government.authorityGraph?.length || government.authorityGraph.some((edge) => !nodes.has(edge.fromId) || !nodes.has(edge.toId) || !AUTHORITY_RELATIONS.includes(edge.relation))) throw new Error(`${government.id} has an invalid authority graph.`);
      if (government.threatReadiness?.coalitionStatus !== "none" || !strategicMap.publicBeastAtlas.cityAttackAssessments.some((entry) => entry.id === government.threatReadiness?.attackAssessmentId)) throw new Error(`${government.id} has invalid public threat readiness.`);
      if (![government.hiddenOperationalRisks?.institutionalCapture, government.hiddenOperationalRisks?.coercionAbuse, government.hiddenOperationalRisks?.successionDisruption].every((band) => RISK_BANDS.includes(band))) throw new Error(`${government.id} has invalid hidden operational risks.`);
      const publicEntryRecord = publicById.get(government.id);
      if (!publicEntryRecord || Object.hasOwn(publicEntryRecord, "hiddenOperationalRisks") || JSON.stringify(publicEntryRecord) !== JSON.stringify(publicEntry(government, strategicMap.humanGeography.cities.find((entry) => entry.id === government.cityId), polity))) throw new Error(`${government.id} public projection is invalid or leaks hidden risks.`);
    }
    if (record.digest !== `city-governments-${StrategicWorld.stableHash(governmentCore(record))}`) throw new Error("City-government data does not match its digest.");
    const publicCore = clone(publicDirectory);
    delete publicCore.digest;
    if (publicDirectory.digest !== `public-city-governments-${StrategicWorld.stableHash(publicCore)}`) throw new Error("Public city-government directory does not match its digest.");
    return { cityGovernments: clone(record), publicDirectory: clone(publicDirectory) };
  }

  function attachCityGovernments(worldSeed, map) {
    const next = StrategicWorld.validateStrategicMap(map);
    const generated = createCityGovernments(worldSeed, next);
    next.cityGovernments = generated.cityGovernments;
    next.publicCityGovernmentDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function publicCityGovernmentDirectory(map) {
    if (!map?.publicCityGovernmentDirectory) return [];
    return clone(map.publicCityGovernmentDirectory.entries);
  }

  function cellPublicCityGovernmentSnapshot(map, index) {
    if (!map?.publicCityGovernmentDirectory || !Number.isInteger(index) || index < 0 || index >= map.topology.cellCount) return null;
    const cellId = StrategicWorld.cellId(index);
    const entry = map.publicCityGovernmentDirectory.entries.find((candidate) => candidate.city.cellId === cellId);
    return entry ? clone(entry) : null;
  }

  function auditCityGovernments(map) {
    const { cityGovernments, publicDirectory } = validateCityGovernments(map);
    return {
      valid: true,
      governmentCount: cityGovernments.governments.length,
      oneGovernmentPerCity: cityGovernments.governments.length === map.humanGeography.cities.length,
      everyGovernmentCityOnly: cityGovernments.governments.every((entry) => entry.sovereigntyScope === "cityOnly" && entry.superiorGovernmentId === null && entry.stateMembership === null),
      everyEssentialRoleCovered: cityGovernments.governments.every((entry) => CIVIC_ROLES.every((role) => entry.roleAssignments[role])),
      jailAndPrisonAlwaysDistinct: cityGovernments.governments.every((entry) => entry.roleAssignments.temporaryJailAuthority !== entry.roleAssignments.longTermCorrectionsAuthority),
      publicDirectoryHidesOperationalRisks: publicDirectory.entries.every((entry) => !Object.hasOwn(entry, "hiddenOperationalRisks")),
      publicDirectoryHidesOfficeholders: publicDirectory.entries.flatMap((entry) => entry.institutions).every((entry) => !Object.hasOwn(entry, "currentOfficeholderId")),
      allOfficeholdersLazy: cityGovernments.governments.flatMap((entry) => entry.institutions).every((entry) => entry.currentOfficeholderId === null && entry.officeholderMaterialization === "lazyWhenNeeded"),
      emergencyPowersExpireWithoutRenewal: cityGovernments.governments.every((entry) => entry.charter.emergencyPowers.expiresWithoutRenewal),
      authorityRelationKinds: [...new Set(cityGovernments.governments.flatMap((entry) => entry.authorityGraph.map((edge) => edge.relation)))].sort()
    };
  }

  return Object.freeze({
    CIVIC_ROLES,
    AUTHORITY_RELATIONS,
    CAPACITY_BANDS,
    INDEPENDENCE_BANDS,
    RISK_BANDS,
    JURISDICTION_SCOPE,
    createCityGovernments,
    validateCityGovernments,
    attachCityGovernments,
    publicCityGovernmentDirectory,
    cellPublicCityGovernmentSnapshot,
    auditCityGovernments,
    clone
  });
});
