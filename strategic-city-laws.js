(function initStrategicCityLaws(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports
    ? require("./strategic-world")
    : root?.HelixStrategicWorld;
  const cityGovernments = typeof module === "object" && module.exports
    ? require("./strategic-city-governments")
    : root?.HelixStrategicCityGovernments;
  const api = factory(strategicWorld, cityGovernments);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicCityLaws = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicCityLawsApi(StrategicWorld, StrategicCityGovernments) {
  "use strict";

  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before strategic-city-laws.js");
  if (!StrategicCityGovernments) throw new Error("HelixStrategicCityGovernments must load before strategic-city-laws.js");

  const LEGAL_STATUSES = Object.freeze(["prohibited", "restricted", "licensed", "tolerated", "unregulated"]);
  const CULPABILITY_STANDARDS = Object.freeze(["intentional", "knowing", "reckless", "negligent", "strictLiability"]);
  const SEVERITY_GRADES = Object.freeze(["minor", "material", "serious", "critical", "capital"]);
  const PUBLIC_ATTITUDES = Object.freeze(["strongSupport", "support", "divided", "resented", "opposed"]);
  const ENFORCEMENT_PRIORITIES = Object.freeze(["low", "standard", "elevated", "critical"]);
  const RESOURCE_ALLOCATIONS = Object.freeze(["scarce", "limited", "routine", "concentrated"]);
  const DISCOVERY_RULES = Object.freeze(["openFile", "materialEvidence", "chargeSpecific"]);
  const COUNSEL_RULES = Object.freeze(["guaranteedAtFirstAppearance", "guaranteedBeforeTrial", "availableForSeriousCharges"]);
  const PRETRIAL_RELEASE_RULES = Object.freeze(["presumptionOfRelease", "riskBased", "securityFirst"]);
  const SANCTIONS = Object.freeze(["fine", "restitution", "forfeiture", "supervision", "licenseRestriction", "banishment", "finitePrison", "penalLegion", "penalFlight", "publicExecution"]);
  const RUNTIME_CHARGE_TO_OFFENSE = Object.freeze({
    prohibitedResearch: "geneticEngineering",
    prohibitedAnimancy: "animancy",
    contrabandCommerce: "contrabandCommerce",
    hazardousBiologicalConduct: "hazardousBiologicalConduct",
    warrantObstruction: "warrantObstruction",
    violentResistance: "violentResistance",
    escapeCustody: "custodyEscape",
    attemptedEscape: "custodyEscape",
    failureToAppear: "failureToAppear",
    falseStatement: "falseStatement"
  });

  function offense(definition) {
    return Object.freeze({
      ...definition,
      elements: Object.freeze(definition.elements.map((entry) => Object.freeze({ ...entry }))),
      defenses: Object.freeze([...definition.defenses]),
      aggravatingFactors: Object.freeze([...definition.aggravatingFactors]),
      ordinarySanctions: Object.freeze([...definition.ordinarySanctions]),
      capitalGradeTriggers: Object.freeze([...(definition.capitalGradeTriggers || [])])
    });
  }

  const OFFENSE_CATALOG = Object.freeze([
    offense({ id: "unlawfulViolence", family: "personalSecurity", label: "Unlawful Violence", policyKind: "prohibited", culpability: "intentional", baseSeverity: "serious", elements: [{ id: "violentAct", kind: "conduct", label: "The accused used or credibly threatened unlawful force." }, { id: "unlawfulness", kind: "circumstance", label: "The force lacked lawful authority, defense, or necessity." }, { id: "intent", kind: "culpability", label: "The accused acted intentionally." }], defenses: ["defenseOfSelfOrOthers", "lawfulAuthority", "necessity"], aggravatingFactors: ["weaponUse", "seriousInjury", "vulnerableVictim"], ordinarySanctions: ["fine", "restitution", "supervision", "finitePrison"] }),
    offense({ id: "homicide", family: "personalSecurity", label: "Unlawful Killing", policyKind: "prohibited", culpability: "knowing", baseSeverity: "critical", elements: [{ id: "death", kind: "result", label: "A person died." }, { id: "causation", kind: "conduct", label: "The accused caused the death." }, { id: "culpability", kind: "culpability", label: "The accused acted knowingly or with extreme reckless disregard." }], defenses: ["defenseOfSelfOrOthers", "lawfulCombat", "necessity"], aggravatingFactors: ["multipleDeaths", "premeditation", "soulDestruction"], ordinarySanctions: ["restitution", "finitePrison", "banishment"], capitalGradeTriggers: ["multipleDeaths", "premeditation", "soulDestruction"] }),
    offense({ id: "abductionAndConfinement", family: "personalSecurity", label: "Abduction and Unlawful Confinement", policyKind: "prohibited", culpability: "intentional", baseSeverity: "serious", elements: [{ id: "restraint", kind: "conduct", label: "The accused moved or confined another person." }, { id: "lackOfAuthority", kind: "circumstance", label: "The restraint lacked consent or lawful authority." }, { id: "intent", kind: "culpability", label: "The accused intended the restraint." }], defenses: ["consent", "lawfulCustody", "emergencyProtection"], aggravatingFactors: ["extendedConfinement", "ransom", "bodilyHarm"], ordinarySanctions: ["restitution", "supervision", "finitePrison"] }),
    offense({ id: "propertyOffenses", family: "propertyAndCommerce", label: "Theft and Property Damage", policyKind: "prohibited", culpability: "knowing", baseSeverity: "material", elements: [{ id: "takingOrDamage", kind: "conduct", label: "The accused took, retained, or damaged property." }, { id: "propertyInterest", kind: "circumstance", label: "Another person or institution held the protected interest." }, { id: "knowledge", kind: "culpability", label: "The accused knew the conduct lacked authorization." }], defenses: ["ownership", "consent", "necessity"], aggravatingFactors: ["essentialSupplies", "largeLoss", "repeatConduct"], ordinarySanctions: ["fine", "restitution", "forfeiture", "supervision", "finitePrison"] }),
    offense({ id: "fraudAndCorruption", family: "propertyAndCommerce", label: "Fraud and Corruption", policyKind: "prohibited", culpability: "knowing", baseSeverity: "serious", elements: [{ id: "deceptionOrImproperBenefit", kind: "conduct", label: "The accused used material deception or exchanged an improper benefit." }, { id: "publicOrPrivateReliance", kind: "result", label: "The conduct distorted a protected decision or transaction." }, { id: "knowledge", kind: "culpability", label: "The accused acted knowingly." }], defenses: ["truthfulDisclosure", "lawfulGift", "lackOfMateriality"], aggravatingFactors: ["publicOffice", "emergencySupplies", "systemicScheme"], ordinarySanctions: ["fine", "restitution", "forfeiture", "licenseRestriction", "finitePrison"] }),
    offense({ id: "criticalInfrastructureSabotage", family: "civicSurvival", label: "Critical Infrastructure Sabotage", policyKind: "prohibited", culpability: "knowing", baseSeverity: "critical", elements: [{ id: "interference", kind: "conduct", label: "The accused damaged or disabled protected infrastructure." }, { id: "criticalSystem", kind: "circumstance", label: "The target supported walls, wards, utilities, transport, shelter, or evacuation." }, { id: "knowledge", kind: "culpability", label: "The accused knew the system's protected function." }], defenses: ["authorizedMaintenance", "necessity", "reasonableEmergencyAction"], aggravatingFactors: ["cityBreach", "massCasualtyRisk", "beastIncursion"], ordinarySanctions: ["restitution", "forfeiture", "finitePrison", "banishment"], capitalGradeTriggers: ["cityBreach", "massCasualties", "deliberateBeastIncursion"] }),
    offense({ id: "emergencyInterference", family: "civicSurvival", label: "Emergency and Evacuation Interference", policyKind: "prohibited", culpability: "knowing", baseSeverity: "serious", elements: [{ id: "interference", kind: "conduct", label: "The accused obstructed a declared emergency or evacuation operation." }, { id: "validOperation", kind: "circumstance", label: "The operation was lawfully declared and within charter powers." }, { id: "knowledge", kind: "culpability", label: "The accused had notice of the operation." }], defenses: ["invalidEmergencyOrder", "necessity", "lackOfNotice"], aggravatingFactors: ["evacuationFailure", "resourceDiversion", "casualties"], ordinarySanctions: ["fine", "restitution", "supervision", "finitePrison"] }),
    offense({ id: "contrabandCommerce", family: "propertyAndCommerce", label: "Contraband Commerce", policyKind: "prohibited", culpability: "knowing", baseSeverity: "serious", elements: [{ id: "transaction", kind: "conduct", label: "A transfer, sale, purchase, or delivery occurred." }, { id: "contraband", kind: "circumstance", label: "The subject was prohibited under a published city rule." }, { id: "knowledge", kind: "culpability", label: "The accused knew or deliberately ignored its status." }], defenses: ["lawfulLicense", "lackOfKnowledge", "authorizedEvidenceTransfer"], aggravatingFactors: ["organizedMarket", "dangerousGoods", "officialCorruption"], ordinarySanctions: ["fine", "forfeiture", "licenseRestriction", "finitePrison"] }),
    offense({ id: "corporateLicensing", family: "propertyAndCommerce", label: "Corporate and Professional Licensing", policyKind: "commercial", culpability: "strictLiability", baseSeverity: "minor", elements: [{ id: "regulatedActivity", kind: "conduct", label: "The accused conducted an activity covered by a published license rule." }, { id: "missingOrInvalidLicense", kind: "circumstance", label: "No applicable valid license covered the activity." }], defenses: ["validLicense", "officialError", "activityOutsideScope"], aggravatingFactors: ["repeatViolation", "concealedOwnership", "publicHazard"], ordinarySanctions: ["fine", "restitution", "licenseRestriction", "supervision"] }),
    offense({ id: "hazardousBiologicalConduct", family: "scienceAndMagic", label: "Hazardous Biological Conduct", policyKind: "prohibited", culpability: "reckless", baseSeverity: "serious", elements: [{ id: "biologicalConduct", kind: "conduct", label: "The accused handled, confined, altered, or released biological material." }, { id: "substantialHazard", kind: "circumstance", label: "The conduct created a substantial unlawful hazard." }, { id: "recklessness", kind: "culpability", label: "The accused knew of or recklessly disregarded the hazard." }], defenses: ["lawfulLicense", "necessity", "reasonableContainmentResponse"], aggravatingFactors: ["escapedCreature", "contamination", "massExposure"], ordinarySanctions: ["fine", "restitution", "forfeiture", "licenseRestriction", "finitePrison"] }),
    offense({ id: "geneticEngineering", family: "scienceAndMagic", label: "Genetic Engineering", policyKind: "genetic", culpability: "knowing", baseSeverity: "serious", elements: [{ id: "geneticAlteration", kind: "conduct", label: "The accused deliberately altered or directed the alteration of a living genome." }, { id: "regulatedSubject", kind: "circumstance", label: "The work fell within the city's published prohibition or license boundary." }, { id: "knowledge", kind: "culpability", label: "The accused knew the nature of the work and its authorization status." }], defenses: ["lawfulLicense", "approvedMedicalException", "lackOfControl"], aggravatingFactors: ["humanSubject", "weaponization", "concealedCreatureProduction"], ordinarySanctions: ["fine", "forfeiture", "licenseRestriction", "finitePrison"] }),
    offense({ id: "artificialCreatureCreation", family: "scienceAndMagic", label: "Artificial Creature Creation", policyKind: "artificialLife", culpability: "knowing", baseSeverity: "serious", elements: [{ id: "creationOrDirection", kind: "conduct", label: "The accused created or directed the creation of an artificial living creature." }, { id: "regulatedCreation", kind: "circumstance", label: "The creation lacked the authorization required by city law." }, { id: "knowledge", kind: "culpability", label: "The accused acted knowingly." }], defenses: ["lawfulLicense", "nonlivingConstruct", "lackOfControl"], aggravatingFactors: ["sapientCreation", "weaponization", "containmentFailure"], ordinarySanctions: ["fine", "forfeiture", "licenseRestriction", "finitePrison"] }),
    offense({ id: "animancy", family: "scienceAndMagic", label: "Animancy and Soul Interference", policyKind: "animancy", culpability: "knowing", baseSeverity: "critical", elements: [{ id: "animanticPractice", kind: "conduct", label: "The accused manipulated, transferred, bound, damaged, or destroyed a soul." }, { id: "prohibitedInterference", kind: "circumstance", label: "The practice exceeded any narrow institutional exception." }, { id: "knowledge", kind: "culpability", label: "The accused knowingly performed or controlled the practice." }], defenses: ["approvedMedicalException", "approvedReligiousException", "lackOfSoulInterference"], aggravatingFactors: ["soulDestruction", "coercedTransfer", "massPractice"], ordinarySanctions: ["forfeiture", "finitePrison", "banishment"], capitalGradeTriggers: ["soulDestruction", "coercedMassTransfer"] }),
    offense({ id: "prohibitedMagic", family: "scienceAndMagic", label: "Prohibited or Unlicensed Magic", policyKind: "magic", culpability: "knowing", baseSeverity: "material", elements: [{ id: "magicalAct", kind: "conduct", label: "The accused performed or controlled regulated magic." }, { id: "regulatedContext", kind: "circumstance", label: "The act was prohibited or required authorization in that context." }, { id: "knowledge", kind: "culpability", label: "The accused knew the relevant circumstances." }], defenses: ["lawfulLicense", "necessity", "involuntaryManifestation"], aggravatingFactors: ["publicEndangerment", "nullInterference", "infrastructureDamage"], ordinarySanctions: ["fine", "supervision", "licenseRestriction", "finitePrison"] }),
    offense({ id: "warrantObstruction", family: "justiceSystem", label: "Obstruction of Lawful Process", policyKind: "prohibited", culpability: "knowing", baseSeverity: "serious", elements: [{ id: "obstructiveAct", kind: "conduct", label: "The accused materially impeded a warrant or lawful order." }, { id: "lawfulProcess", kind: "circumstance", label: "The process was valid and remained within its scope." }, { id: "knowledge", kind: "culpability", label: "The accused knew of the process." }], defenses: ["invalidOrder", "outsideWarrantScope", "lackOfNotice"], aggravatingFactors: ["evidenceDestruction", "organizedResistance", "officialInjury"], ordinarySanctions: ["fine", "supervision", "finitePrison"] }),
    offense({ id: "violentResistance", family: "justiceSystem", label: "Violent Resistance to Custody", policyKind: "prohibited", culpability: "intentional", baseSeverity: "critical", elements: [{ id: "violentAct", kind: "conduct", label: "The accused used or threatened violence during arrest or custody." }, { id: "lawfulDuty", kind: "circumstance", label: "The target was performing lawful duty." }, { id: "intent", kind: "culpability", label: "The accused intentionally resisted through violence." }], defenses: ["unlawfulForce", "defenseOfSelfOrOthers", "mistakenIdentity"], aggravatingFactors: ["seriousOfficialInjury", "lethalWeapon", "coordinatedAttack"], ordinarySanctions: ["restitution", "supervision", "finitePrison"] }),
    offense({ id: "custodyEscape", family: "justiceSystem", label: "Escape or Attempted Escape from Custody", policyKind: "prohibited", culpability: "intentional", baseSeverity: "serious", elements: [{ id: "departureOrStep", kind: "conduct", label: "The accused left custody or took a substantial physical step toward escape." }, { id: "lawfulCustody", kind: "circumstance", label: "The custody was imposed through lawful process." }, { id: "intent", kind: "culpability", label: "The accused intended to escape." }], defenses: ["unlawfulCustody", "immediateNecessity", "lackOfIntent"], aggravatingFactors: ["violence", "outsideConspiracy", "repeatEscape"], ordinarySanctions: ["supervision", "finitePrison"] }),
    offense({ id: "failureToAppear", family: "justiceSystem", label: "Failure to Appear", policyKind: "prohibited", culpability: "knowing", baseSeverity: "material", elements: [{ id: "requiredAppearance", kind: "circumstance", label: "A lawful court appearance was required." }, { id: "notice", kind: "culpability", label: "The accused received adequate notice." }, { id: "nonappearance", kind: "conduct", label: "The accused did not appear." }], defenses: ["lackOfNotice", "physicalImpossibility", "necessity"], aggravatingFactors: ["fugitiveConduct", "repeatNonappearance", "witnessInterference"], ordinarySanctions: ["fine", "supervision", "finitePrison"] }),
    offense({ id: "evidenceTampering", family: "justiceSystem", label: "Evidence Tampering", policyKind: "prohibited", culpability: "knowing", baseSeverity: "serious", elements: [{ id: "alterationOrDestruction", kind: "conduct", label: "The accused altered, concealed, destroyed, or fabricated evidence." }, { id: "officialMatter", kind: "circumstance", label: "The evidence related to a known or foreseeable official matter." }, { id: "intent", kind: "culpability", label: "The accused intended to impair its use or create a false record." }], defenses: ["ordinaryDisposition", "lackOfNotice", "lawfulPrivilege"], aggravatingFactors: ["caseDispositiveEvidence", "officialParticipation", "repeatConduct"], ordinarySanctions: ["fine", "forfeiture", "supervision", "finitePrison"] }),
    offense({ id: "falseStatement", family: "justiceSystem", label: "Material False Statement", policyKind: "prohibited", culpability: "knowing", baseSeverity: "material", elements: [{ id: "statement", kind: "conduct", label: "The accused made the charged statement in an official matter." }, { id: "materialFalsity", kind: "circumstance", label: "The statement was false and material." }, { id: "knowledge", kind: "culpability", label: "The accused knew it was false." }], defenses: ["literalTruth", "lackOfMateriality", "mistake"], aggravatingFactors: ["swornTestimony", "concealedDanger", "repeatConduct"], ordinarySanctions: ["fine", "supervision", "finitePrison"] }),
    offense({ id: "aidingBeastAttack", family: "civicSurvival", label: "Aiding an Attack on the City", policyKind: "prohibited", culpability: "knowing", baseSeverity: "critical", elements: [{ id: "assistance", kind: "conduct", label: "The accused materially assisted a beast incursion or organized attack." }, { id: "cityThreat", kind: "circumstance", label: "The assistance exposed the city, its approaches, or an evacuation to attack." }, { id: "knowledge", kind: "culpability", label: "The accused knew the assistance would create that threat." }], defenses: ["lackOfKnowledge", "coercion", "authorizedDefenseOperation"], aggravatingFactors: ["cityBreach", "massCasualties", "evacuationFailure"], ordinarySanctions: ["forfeiture", "finitePrison", "banishment"], capitalGradeTriggers: ["cityBreach", "massCasualties", "deliberateEvacuationFailure"] })
  ]);
  const OFFENSE_BY_ID = new Map(OFFENSE_CATALOG.map((entry) => [entry.id, entry]));

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function seededNumber(seed, channel) {
    return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff;
  }

  function rankValues(values, seed, channel) {
    return [...values].sort((left, right) => seededNumber(seed, `${channel}:${left.id}`) - seededNumber(seed, `${channel}:${right.id}`) || left.id.localeCompare(right.id));
  }

  function quotaStatuses(governments, seed, offenseId, quotas) {
    const ranked = rankValues(governments, seed, `legal-status:${offenseId}`);
    const result = new Map();
    let cursor = 0;
    for (let quotaIndex = 0; quotaIndex < quotas.length; quotaIndex += 1) {
      const [status, fraction] = quotas[quotaIndex];
      const remaining = ranked.length - cursor;
      const count = fraction === 1 ? remaining : Math.min(remaining, quotaIndex === 0 ? Math.ceil(ranked.length * fraction) : Math.floor(ranked.length * fraction));
      for (const government of ranked.slice(cursor, cursor + count)) result.set(government.cityId, status);
      cursor += count;
    }
    for (const government of ranked.slice(cursor)) result.set(government.cityId, quotas.at(-1)[0]);
    return result;
  }

  function legalStatusAssignments(governments, seed) {
    return {
      genetic: quotaStatuses(governments, seed, "geneticEngineering", [["prohibited", 0.65], ["restricted", 0.25], ["licensed", 0.07], ["tolerated", 1]]),
      artificialLife: quotaStatuses(governments, seed, "artificialCreatureCreation", [["prohibited", 0.6], ["restricted", 0.3], ["licensed", 0.07], ["tolerated", 1]]),
      animancy: quotaStatuses(governments, seed, "animancy", [["prohibited", 0.8], ["restricted", 1]]),
      magic: quotaStatuses(governments, seed, "prohibitedMagic", [["prohibited", 0.2], ["restricted", 0.42], ["licensed", 0.3], ["tolerated", 1]]),
      commercial: quotaStatuses(governments, seed, "corporateLicensing", [["restricted", 0.35], ["licensed", 0.55], ["tolerated", 0.08], ["unregulated", 1]])
    };
  }

  function statusFor(definition, cityId, assignments) {
    if (definition.policyKind === "prohibited") return "prohibited";
    return assignments[definition.policyKind]?.get(cityId) || "prohibited";
  }

  function institutionFor(government, role) {
    return government.institutions.find((entry) => entry.id === government.roleAssignments[role]);
  }

  function prisonMaximumMonths(government, seed) {
    const capacity = institutionFor(government, "longTermCorrectionsAuthority")?.capacityBand;
    const base = ({ fragile: 36, strained: 48, functional: 72, strong: 96, exceptional: 120 })[capacity] || 60;
    const adjustment = Math.floor(seededNumber(seed, `${government.cityId}:prison-maximum`) * 3) * 12 - 12;
    return Math.max(36, Math.min(120, base + adjustment));
  }

  function punishmentPolicy(government, seed) {
    const ordinal = government.cityId.slice(5);
    const prisonMaximum = prisonMaximumMonths(government, seed);
    const penalLegionAvailable = seededNumber(seed, `${government.cityId}:penal-legion`) < 0.66;
    const penalFlightAvailable = seededNumber(seed, `${government.cityId}:penal-flight`) < 0.52;
    const publicExecutionAvailable = seededNumber(seed, `${government.cityId}:public-execution`) < 0.48;
    return {
      id: `city-punishment-policy:${ordinal}`,
      finitePrisonMaximumMonths: prisonMaximum,
      lifeImprisonmentAvailable: false,
      protectedSpaceRule: "Custody beyond the finite maximum must convert to another authorized sentence or end; it cannot become indefinite imprisonment.",
      availableSanctions: ["fine", "restitution", "forfeiture", "supervision", "licenseRestriction", "banishment", "finitePrison", ...(penalLegionAvailable ? ["penalLegion"] : []), ...(penalFlightAvailable ? ["penalFlight"] : []), ...(publicExecutionAvailable ? ["publicExecution"] : [])],
      penalLegion: { available: penalLegionAvailable, requiresMilitaryCommitment: true, lawfulReturnPossible: true },
      penalFlight: { available: penalFlightAvailable, eligibility: "capitalSentenceWithoutPublicEnemyDesignation", method: "wildernessReleaseByPenalGlider", automaticDeath: false },
      publicExecution: { available: publicExecutionAvailable, eligibility: "capitalSentenceWithPublicEnemyDesignation", method: publicExecutionAvailable ? "publicBeheading" : null },
      publicEnemyDesignation: {
        separateFindingRequired: true,
        authorityInstitutionId: government.roleAssignments.judiciary,
        reviewInstitutionId: government.roleAssignments.civicReview,
        requiredGrounds: ["codeDefinedCapitalTrigger", "provenAggravatingFacts", "publicThreatFinding"],
        sovereignFiatSufficient: false
      }
    };
  }

  function procedureFor(government, seed) {
    const court = institutionFor(government, "judiciary");
    const courtIndex = StrategicCityGovernments.INDEPENDENCE_BANDS.indexOf(court.independenceBand);
    const capacityIndex = StrategicCityGovernments.CAPACITY_BANDS.indexOf(court.capacityBand);
    const pick = (values, channel) => values[Math.floor(seededNumber(seed, `${government.cityId}:${channel}`) * values.length) % values.length];
    const counselOptions = courtIndex >= 2 ? COUNSEL_RULES.slice(0, 2) : COUNSEL_RULES.slice(1);
    const releaseOptions = capacityIndex >= 2 ? PRETRIAL_RELEASE_RULES.slice(0, 2) : PRETRIAL_RELEASE_RULES.slice(1);
    return {
      id: `city-criminal-procedure:${government.cityId.slice(5)}`,
      criminalProofStandard: "beyondReasonableDoubt",
      chargeElementsMustBeProvenSeparately: true,
      warrantRule: "preActionJudicialWarrant",
      emergencyException: { available: true, triggerMustMatchCharter: true, writtenRecordRequired: true, postActionReviewInstitutionId: government.roleAssignments.civicReview },
      counselRule: pick(counselOptions, "counsel-rule"),
      discoveryRule: pick(DISCOVERY_RULES, "discovery-rule"),
      pretrialReleaseRule: pick(releaseOptions, "pretrial-release-rule"),
      institutions: {
        courtId: government.roleAssignments.judiciary,
        prosecutionId: government.roleAssignments.publicProsecution,
        enforcementId: government.roleAssignments.civilWatch,
        temporaryJailId: government.roleAssignments.temporaryJailAuthority,
        correctionsId: government.roleAssignments.longTermCorrectionsAuthority
      }
    };
  }

  function publicAttitude(definition, status, polity, seed) {
    const priorities = polity.civicPriorities.join(" ").toLowerCase();
    const aligned = (definition.family === "civicSurvival" && /defen|fort|safety|survival|order/.test(priorities))
      || (definition.family === "scienceAndMagic" && /research|innovation|magic|knowledge|experiment/.test(priorities))
      || (definition.family === "propertyAndCommerce" && /trade|commerce|industry|prosper|guild/.test(priorities));
    let index = status === "prohibited" ? 1 : (status === "restricted" || status === "licensed" ? 2 : 3);
    if (aligned && definition.family === "scienceAndMagic") index += 1;
    else if (aligned) index -= 1;
    index += seededNumber(seed, `${polity.cityId}:${definition.id}:public-attitude`) < 0.28 ? 1 : 0;
    return PUBLIC_ATTITUDES[Math.max(0, Math.min(PUBLIC_ATTITUDES.length - 1, index))];
  }

  function exceptionsFor(definition, status) {
    if (status === "prohibited") return definition.id === "animancy" ? ["No ordinary license; only an expressly published medical or religious exception can apply."] : [];
    if (status === "restricted") return ["Only a named chartered institution or expressly approved emergency may authorize this conduct."];
    if (status === "licensed") return ["A valid activity-specific license and its recorded conditions are required."];
    if (status === "tolerated") return ["Ordinary conduct is not prosecuted by status alone, but harm and separate offenses remain actionable."];
    return ["No activity-specific authorization is required; generally applicable safety and harm laws still apply."];
  }

  function sentencingFor(definition, status, policy) {
    const severityIndex = SEVERITY_GRADES.indexOf(definition.baseSeverity);
    const statusScale = status === "prohibited" ? 1 : (status === "restricted" ? 0.72 : (status === "licensed" ? 0.5 : 0.25));
    const baseMaximum = [6, 18, 48, 96, 120][Math.max(0, severityIndex)] || 24;
    const maximumMonths = definition.ordinarySanctions.includes("finitePrison") ? Math.min(policy.finitePrisonMaximumMonths, Math.max(1, Math.round(baseMaximum * statusScale))) : 0;
    const capitalEligible = definition.capitalGradeTriggers.length > 0 && (policy.penalFlight.available || policy.publicExecution.available);
    return {
      severityGrades: [definition.baseSeverity, ...(definition.aggravatingFactors.length ? [severityIndex >= 3 ? "capital" : SEVERITY_GRADES[Math.min(3, severityIndex + 1)]] : [])],
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

  function offenseRule(definition, city, polity, government, status, policy, seed) {
    return {
      id: `city-law:${city.id.slice(5)}:${definition.id}`,
      offenseId: definition.id,
      legalStatus: status,
      authorizationExceptions: exceptionsFor(definition, status),
      publicAttitude: publicAttitude(definition, status, polity, seed),
      sentencing: sentencingFor(definition, status, policy),
      responsibleInstitutionIds: [government.roleAssignments.publicProsecution, government.roleAssignments.judiciary, government.roleAssignments.civilWatch]
    };
  }

  function hiddenDirective(definition, rule, city, polity, government, seed) {
    const pressure = government.threatReadiness.waveWarningIds.length;
    const dependencies = polity.logisticalDependencies.join(" ").toLowerCase();
    let priorityIndex = Math.floor(seededNumber(seed, `${city.id}:${definition.id}:enforcement-priority`) * 3);
    if (definition.family === "civicSurvival" && pressure) priorityIndex += 1;
    if (definition.id === "criticalInfrastructureSabotage" && /water|energy|agriculture/.test(dependencies)) priorityIndex += 1;
    if (definition.id === "animancy") priorityIndex += 1;
    const priority = ENFORCEMENT_PRIORITIES[Math.min(3, priorityIndex)];
    return {
      offenseId: definition.id,
      priority,
      resourceAllocation: RESOURCE_ALLOCATIONS[Math.min(3, Math.max(0, priorityIndex + (seededNumber(seed, `${city.id}:${definition.id}:resources`) < 0.45 ? -1 : 0)))],
      chargingDiscretion: rule.legalStatus === "prohibited" ? "chargeWhenElementsSupported" : "verifyAuthorizationBeforeCharge",
      toleratedDeviation: rule.legalStatus === "tolerated" ? "nonharmfulStatusViolation" : "none",
      causalFactors: [`publicLegalStatus:${rule.legalStatus}`, `publicAttitude:${rule.publicAttitude}`, `waveWarningCount:${pressure}`, `institutionalCapacity:${institutionFor(government, "publicProsecution").capacityBand}`],
      guiltInferencePermitted: false
    };
  }

  const STATUS_CODES = Object.freeze({ prohibited: "p", restricted: "r", licensed: "l", tolerated: "t", unregulated: "u" });
  const STATUS_BY_CODE = Object.freeze(Object.fromEntries(Object.entries(STATUS_CODES).map(([key, value]) => [value, key])));
  const ATTITUDE_CODES = Object.freeze({ strongSupport: "S", support: "s", divided: "d", resented: "r", opposed: "o" });
  const ATTITUDE_BY_CODE = Object.freeze(Object.fromEntries(Object.entries(ATTITUDE_CODES).map(([key, value]) => [value, key])));
  const PRIORITY_CODES = Object.freeze({ low: "0", standard: "1", elevated: "2", critical: "3" });
  const PRIORITY_BY_CODE = Object.freeze(Object.fromEntries(Object.entries(PRIORITY_CODES).map(([key, value]) => [value, key])));
  const RESOURCE_CODES = Object.freeze({ scarce: "0", limited: "1", routine: "2", concentrated: "3" });
  const RESOURCE_BY_CODE = Object.freeze(Object.fromEntries(Object.entries(RESOURCE_CODES).map(([key, value]) => [value, key])));

  function procedureProfile(procedure) {
    return { counselRule: procedure.counselRule, discoveryRule: procedure.discoveryRule, pretrialReleaseRule: procedure.pretrialReleaseRule };
  }

  function punishmentProfile(policy) {
    return {
      finitePrisonMaximumMonths: policy.finitePrisonMaximumMonths,
      penalLegionAvailable: policy.penalLegion.available,
      penalFlightAvailable: policy.penalFlight.available,
      publicExecutionAvailable: policy.publicExecution.available
    };
  }

  function expandProcedure(profile, government) {
    return {
      id: `city-criminal-procedure:${government.cityId.slice(5)}`,
      criminalProofStandard: "beyondReasonableDoubt",
      chargeElementsMustBeProvenSeparately: true,
      warrantRule: "preActionJudicialWarrant",
      emergencyException: { available: true, triggerMustMatchCharter: true, writtenRecordRequired: true, postActionReviewInstitutionId: government.roleAssignments.civicReview },
      counselRule: profile.counselRule,
      discoveryRule: profile.discoveryRule,
      pretrialReleaseRule: profile.pretrialReleaseRule,
      institutions: {
        courtId: government.roleAssignments.judiciary,
        prosecutionId: government.roleAssignments.publicProsecution,
        enforcementId: government.roleAssignments.civilWatch,
        temporaryJailId: government.roleAssignments.temporaryJailAuthority,
        correctionsId: government.roleAssignments.longTermCorrectionsAuthority
      }
    };
  }

  function expandPunishmentPolicy(profile, government) {
    const ordinal = government.cityId.slice(5);
    const availableSanctions = ["fine", "restitution", "forfeiture", "supervision", "licenseRestriction", "banishment", "finitePrison", ...(profile.penalLegionAvailable ? ["penalLegion"] : []), ...(profile.penalFlightAvailable ? ["penalFlight"] : []), ...(profile.publicExecutionAvailable ? ["publicExecution"] : [])];
    return {
      id: `city-punishment-policy:${ordinal}`,
      finitePrisonMaximumMonths: profile.finitePrisonMaximumMonths,
      lifeImprisonmentAvailable: false,
      protectedSpaceRule: "Custody beyond the finite maximum must convert to another authorized sentence or end; it cannot become indefinite imprisonment.",
      availableSanctions,
      penalLegion: { available: profile.penalLegionAvailable, requiresMilitaryCommitment: true, lawfulReturnPossible: true },
      penalFlight: { available: profile.penalFlightAvailable, eligibility: "capitalSentenceWithoutPublicEnemyDesignation", method: "wildernessReleaseByPenalGlider", automaticDeath: false },
      publicExecution: { available: profile.publicExecutionAvailable, eligibility: "capitalSentenceWithPublicEnemyDesignation", method: profile.publicExecutionAvailable ? "publicBeheading" : null },
      publicEnemyDesignation: {
        separateFindingRequired: true,
        authorityInstitutionId: government.roleAssignments.judiciary,
        reviewInstitutionId: government.roleAssignments.civicReview,
        requiredGrounds: ["codeDefinedCapitalTrigger", "provenAggravatingFacts", "publicThreatFinding"],
        sovereignFiatSufficient: false
      }
    };
  }

  function compactPublicEntry(code) {
    return {
      id: code.id,
      cityId: code.cityId,
      polityId: code.polityId,
      governmentId: code.governmentId,
      procedureProfile: procedureProfile(code.procedure),
      punishmentProfile: punishmentProfile(code.punishmentPolicy),
      legalStatusCodes: code.offenseRules.map((rule) => STATUS_CODES[rule.legalStatus]).join(""),
      publicAttitudeCodes: code.offenseRules.map((rule) => ATTITUDE_CODES[rule.publicAttitude]).join("")
    };
  }

  function compactHiddenCode(code) {
    return {
      id: `city-enforcement-code:${code.cityId.slice(5)}`,
      cityId: code.cityId,
      enforcementPriorityCodes: code.hiddenEnforcement.map((entry) => PRIORITY_CODES[entry.priority]).join(""),
      resourceAllocationCodes: code.hiddenEnforcement.map((entry) => RESOURCE_CODES[entry.resourceAllocation]).join("")
    };
  }

  function expandPublicEntry(map, entry) {
    const city = map.humanGeography.cities.find((candidate) => candidate.id === entry.cityId);
    const polity = map.cityPolities.polities.find((candidate) => candidate.id === entry.polityId);
    const government = map.cityGovernments.governments.find((candidate) => candidate.id === entry.governmentId);
    if (!city || !polity || !government) return null;
    const policy = expandPunishmentPolicy(entry.punishmentProfile, government);
    const offenseRules = OFFENSE_CATALOG.map((definition, index) => {
      const legalStatus = STATUS_BY_CODE[entry.legalStatusCodes[index]];
      return {
        id: `city-law:${city.id.slice(5)}:${definition.id}`,
        offenseId: definition.id,
        family: definition.family,
        label: definition.label,
        legalStatus,
        elements: clone(definition.elements),
        culpability: definition.culpability,
        defenses: [...definition.defenses],
        authorizationExceptions: exceptionsFor(definition, legalStatus),
        aggravatingFactors: [...definition.aggravatingFactors],
        publicAttitude: ATTITUDE_BY_CODE[entry.publicAttitudeCodes[index]],
        sentencing: sentencingFor(definition, legalStatus, policy),
        responsibleInstitutionIds: [government.roleAssignments.publicProsecution, government.roleAssignments.judiciary, government.roleAssignments.civilWatch]
      };
    });
    return {
      id: entry.id,
      city: { id: city.id, name: city.name, cellId: city.cellId },
      polity: { id: polity.id, name: polity.name },
      governmentId: government.id,
      jurisdictionClaim: clone(government.charter.jurisdictionClaim),
      procedure: expandProcedure(entry.procedureProfile, government),
      punishmentPolicy: policy,
      offenseRules,
      runtimeChargeMappings: clone(RUNTIME_CHARGE_TO_OFFENSE)
    };
  }

  function hiddenEnforcementFor(map, cityId) {
    const compact = map?.cityLegalCodes?.codes.find((entry) => entry.cityId === cityId);
    const publicEntry = map?.publicCityLawDirectory?.entries.find((entry) => entry.cityId === cityId);
    const code = publicEntry ? expandPublicEntry(map, publicEntry) : null;
    const government = map?.cityGovernments?.governments.find((entry) => entry.cityId === cityId);
    const polity = map?.cityPolities?.polities.find((entry) => entry.cityId === cityId);
    if (!compact || !code || !government || !polity) return [];
    const pressure = government.threatReadiness.waveWarningIds.length;
    return OFFENSE_CATALOG.map((definition, index) => ({
      offenseId: definition.id,
      priority: PRIORITY_BY_CODE[compact.enforcementPriorityCodes[index]],
      resourceAllocation: RESOURCE_BY_CODE[compact.resourceAllocationCodes[index]],
      chargingDiscretion: code.offenseRules[index].legalStatus === "prohibited" ? "chargeWhenElementsSupported" : "verifyAuthorizationBeforeCharge",
      toleratedDeviation: code.offenseRules[index].legalStatus === "tolerated" ? "nonharmfulStatusViolation" : "none",
      causalFactors: [`publicLegalStatus:${code.offenseRules[index].legalStatus}`, `publicAttitude:${code.offenseRules[index].publicAttitude}`, `waveWarningCount:${pressure}`, `institutionalCapacity:${institutionFor(government, "publicProsecution").capacityBand}`],
      guiltInferencePermitted: false
    }));
  }

  function legalCodesCore(record) {
    return { sourceCityGovernmentsDigest: record.sourceCityGovernmentsDigest, offenseCatalogDigest: record.offenseCatalogDigest, codes: record.codes, diagnostics: record.diagnostics };
  }

  function createCityLegalCodes(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for city-law generation.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCityGovernments.validateCityGovernments(strategicMap);
    const governments = strategicMap.cityGovernments.governments;
    const assignments = legalStatusAssignments(governments, seed);
    const expandedCodes = governments.map((government) => {
      const city = strategicMap.humanGeography.cities.find((entry) => entry.id === government.cityId);
      const polity = strategicMap.cityPolities.polities.find((entry) => entry.id === government.polityId);
      const policy = punishmentPolicy(government, seed);
      const offenseRules = OFFENSE_CATALOG.map((definition) => offenseRule(definition, city, polity, government, statusFor(definition, city.id, assignments), policy, seed));
      return {
        id: `city-legal-code:${city.id.slice(5)}`, cityId: city.id, polityId: polity.id, governmentId: government.id,
        procedure: procedureFor(government, seed), punishmentPolicy: policy, offenseRules,
        hiddenEnforcement: OFFENSE_CATALOG.map((definition, index) => hiddenDirective(definition, offenseRules[index], city, polity, government, seed))
      };
    });
    const record = {
      sourceCityGovernmentsDigest: strategicMap.cityGovernments.digest,
      offenseCatalogDigest: StrategicWorld.stableHash(OFFENSE_CATALOG),
      codes: expandedCodes.map(compactHiddenCode),
      diagnostics: {
        codeCount: expandedCodes.length,
        offenseRuleCount: expandedCodes.length * OFFENSE_CATALOG.length,
        geneticEngineeringProhibitedCount: expandedCodes.filter((code) => code.offenseRules.find((rule) => rule.offenseId === "geneticEngineering").legalStatus === "prohibited").length,
        animancyProhibitedCount: expandedCodes.filter((code) => code.offenseRules.find((rule) => rule.offenseId === "animancy").legalStatus === "prohibited").length,
        lifeImprisonmentCityCount: 0,
        penalLegionCityCount: expandedCodes.filter((code) => code.punishmentPolicy.penalLegion.available).length,
        penalFlightCityCount: expandedCodes.filter((code) => code.punishmentPolicy.penalFlight.available).length,
        publicExecutionCityCount: expandedCodes.filter((code) => code.punishmentPolicy.publicExecution.available).length
      }
    };
    record.digest = `city-legal-codes-${StrategicWorld.stableHash(legalCodesCore(record))}`;
    const publicDirectory = {
      sourceLegalCodesDigest: record.digest,
      offenseCatalog: clone(OFFENSE_CATALOG),
      entries: expandedCodes.map(compactPublicEntry)
    };
    publicDirectory.digest = `public-city-laws-${StrategicWorld.stableHash(publicDirectory)}`;
    return { cityLegalCodes: record, publicDirectory };
  }

  function validateCityLegalCodes(map, record = map?.cityLegalCodes, publicDirectory = map?.publicCityLawDirectory) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCityGovernments.validateCityGovernments(strategicMap);
    if (!record || !publicDirectory || record.sourceCityGovernmentsDigest !== strategicMap.cityGovernments.digest || record.offenseCatalogDigest !== StrategicWorld.stableHash(OFFENSE_CATALOG) || !Array.isArray(record.codes) || record.codes.length !== strategicMap.cityGovernments.governments.length || new Set(record.codes.map((code) => code.cityId)).size !== record.codes.length || JSON.stringify(publicDirectory.offenseCatalog) !== JSON.stringify(OFFENSE_CATALOG)) throw new Error("City legal codes are incomplete or do not match their source governments and offense catalog.");
    const publicByCityId = new Map((publicDirectory.entries || []).map((entry) => [entry.cityId, entry]));
    if (publicDirectory.sourceLegalCodesDigest !== record.digest || publicByCityId.size !== record.codes.length) throw new Error("The public city-law directory is incomplete.");
    const expandedCodes = [];
    for (const compact of record.codes) {
      const government = strategicMap.cityGovernments.governments.find((entry) => entry.cityId === compact.cityId);
      const entry = publicByCityId.get(compact.cityId);
      const code = entry ? expandPublicEntry(strategicMap, entry) : null;
      if (!government || !entry || !code || compact.id !== `city-enforcement-code:${compact.cityId.slice(5)}` || code.id !== `city-legal-code:${compact.cityId.slice(5)}` || entry.governmentId !== government.id || entry.polityId !== government.polityId) throw new Error("Every legal code must belong to exactly one independent city government.");
      if (compact.enforcementPriorityCodes.length !== OFFENSE_CATALOG.length || /[^0123]/.test(compact.enforcementPriorityCodes) || compact.resourceAllocationCodes.length !== OFFENSE_CATALOG.length || /[^0123]/.test(compact.resourceAllocationCodes) || entry.legalStatusCodes.length !== OFFENSE_CATALOG.length || /[^prltu]/.test(entry.legalStatusCodes) || entry.publicAttitudeCodes.length !== OFFENSE_CATALOG.length || /[^Ssdro]/.test(entry.publicAttitudeCodes)) throw new Error(`${code.id} has invalid compact policy encoding.`);
      if (!entry.punishmentProfile || !Number.isInteger(entry.punishmentProfile.finitePrisonMaximumMonths) || typeof entry.punishmentProfile.penalLegionAvailable !== "boolean" || typeof entry.punishmentProfile.penalFlightAvailable !== "boolean" || typeof entry.punishmentProfile.publicExecutionAvailable !== "boolean") throw new Error(`${code.id} has invalid punishment policy.`);
      if (code.procedure.criminalProofStandard !== "beyondReasonableDoubt" || !DISCOVERY_RULES.includes(code.procedure.discoveryRule) || !COUNSEL_RULES.includes(code.procedure.counselRule) || !PRETRIAL_RELEASE_RULES.includes(code.procedure.pretrialReleaseRule) || Object.values(code.procedure.institutions).some((id) => !government.institutions.some((institution) => institution.id === id))) throw new Error(`${code.id} has invalid criminal procedure.`);
      const policy = code.punishmentPolicy;
      if (!Number.isInteger(policy.finitePrisonMaximumMonths) || policy.finitePrisonMaximumMonths < 36 || policy.finitePrisonMaximumMonths > 120 || policy.lifeImprisonmentAvailable !== false || policy.publicExecution.method && policy.publicExecution.method !== "publicBeheading" || policy.penalFlight.automaticDeath !== false || policy.publicEnemyDesignation.separateFindingRequired !== true || policy.publicEnemyDesignation.sovereignFiatSufficient !== false || policy.availableSanctions.some((sanction) => !SANCTIONS.includes(sanction))) throw new Error(`${code.id} has invalid punishment policy.`);
      if (code.offenseRules.length !== OFFENSE_CATALOG.length || code.offenseRules.some((rule, index) => rule.offenseId !== OFFENSE_CATALOG[index].id || !LEGAL_STATUSES.includes(rule.legalStatus) || !CULPABILITY_STANDARDS.includes(rule.culpability) || !PUBLIC_ATTITUDES.includes(rule.publicAttitude) || rule.sentencing.finitePrisonRangeMonths?.maximum > policy.finitePrisonMaximumMonths)) throw new Error(`${code.id} does not cover the complete semantic offense catalog.`);
      if (!["prohibited", "restricted"].includes(code.offenseRules.find((rule) => rule.offenseId === "animancy").legalStatus)) throw new Error("Animancy cannot be ordinary lawful commerce.");
      const hidden = hiddenEnforcementFor(strategicMap, compact.cityId);
      if (hidden.length !== OFFENSE_CATALOG.length || hidden.some((directive) => !ENFORCEMENT_PRIORITIES.includes(directive.priority) || !RESOURCE_ALLOCATIONS.includes(directive.resourceAllocation) || directive.guiltInferencePermitted !== false)) throw new Error(`${code.id} has invalid hidden enforcement policy.`);
      if (Object.hasOwn(entry, "hiddenEnforcement")) throw new Error(`${code.id} public projection leaks enforcement policy.`);
      expandedCodes.push(code);
    }
    const geneticCount = expandedCodes.filter((code) => code.offenseRules.find((rule) => rule.offenseId === "geneticEngineering").legalStatus === "prohibited").length;
    const animancyCount = expandedCodes.filter((code) => code.offenseRules.find((rule) => rule.offenseId === "animancy").legalStatus === "prohibited").length;
    const penalLegionCount = expandedCodes.filter((code) => code.punishmentPolicy.penalLegion.available).length;
    const penalFlightCount = expandedCodes.filter((code) => code.punishmentPolicy.penalFlight.available).length;
    const publicExecutionCount = expandedCodes.filter((code) => code.punishmentPolicy.publicExecution.available).length;
    if (geneticCount <= expandedCodes.length / 2 || animancyCount <= expandedCodes.length / 2 || record.diagnostics?.codeCount !== expandedCodes.length || record.diagnostics.offenseRuleCount !== expandedCodes.length * OFFENSE_CATALOG.length || record.diagnostics.geneticEngineeringProhibitedCount !== geneticCount || record.diagnostics.animancyProhibitedCount !== animancyCount || record.diagnostics.lifeImprisonmentCityCount !== 0 || record.diagnostics.penalLegionCityCount !== penalLegionCount || record.diagnostics.penalFlightCityCount !== penalFlightCount || record.diagnostics.publicExecutionCityCount !== publicExecutionCount) throw new Error("City-law worldbuilding constraints are not satisfied.");
    if (record.digest !== `city-legal-codes-${StrategicWorld.stableHash(legalCodesCore(record))}`) throw new Error("City legal codes do not match their digest.");
    const publicCore = clone(publicDirectory);
    delete publicCore.digest;
    if (publicDirectory.digest !== `public-city-laws-${StrategicWorld.stableHash(publicCore)}`) throw new Error("Public city-law directory does not match its digest.");
    return { cityLegalCodes: clone(record), publicDirectory: clone(publicDirectory) };
  }

  function attachCityLegalCodes(worldSeed, map) {
    const next = StrategicWorld.validateStrategicMap(map);
    const generated = createCityLegalCodes(worldSeed, next);
    next.cityLegalCodes = generated.cityLegalCodes;
    next.publicCityLawDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function publicCityLawDirectory(map) {
    return map?.publicCityLawDirectory ? map.publicCityLawDirectory.entries.map((entry) => expandPublicEntry(map, entry)).filter(Boolean) : [];
  }

  function cellPublicCityLawSnapshot(map, index) {
    if (!map?.publicCityLawDirectory || !Number.isInteger(index) || index < 0 || index >= map.topology.cellCount) return null;
    const cellId = StrategicWorld.cellId(index);
    const city = map.humanGeography.cities.find((entry) => entry.cellId === cellId);
    const entry = city ? map.publicCityLawDirectory.entries.find((candidate) => candidate.cityId === city.id) : null;
    return entry ? expandPublicEntry(map, entry) : null;
  }

  function publicRuleFor(map, cityId, offenseOrRuntimeChargeId) {
    const offenseId = RUNTIME_CHARGE_TO_OFFENSE[offenseOrRuntimeChargeId] || offenseOrRuntimeChargeId;
    const code = publicCityLawDirectory(map).find((entry) => entry.city.id === cityId);
    return clone(code?.offenseRules.find((entry) => entry.offenseId === offenseId) || null);
  }

  function auditCityLegalCodes(map) {
    const { cityLegalCodes, publicDirectory } = validateCityLegalCodes(map);
    const codes = publicCityLawDirectory(map);
    return {
      valid: true,
      codeCount: codes.length,
      oneCodePerCity: codes.length === map.humanGeography.cities.length,
      everyCodeCoversCatalog: codes.every((code) => code.offenseRules.length === OFFENSE_CATALOG.length),
      majorityProhibitGeneticEngineering: cityLegalCodes.diagnostics.geneticEngineeringProhibitedCount > codes.length / 2,
      animancyNeverOrdinaryCommerce: codes.every((code) => ["prohibited", "restricted"].includes(code.offenseRules.find((rule) => rule.offenseId === "animancy").legalStatus)),
      noLifeImprisonment: codes.every((code) => code.punishmentPolicy.lifeImprisonmentAvailable === false && code.punishmentPolicy.finitePrisonMaximumMonths <= 120),
      publicEnemyRequiresSeparateFinding: codes.every((code) => code.punishmentPolicy.publicEnemyDesignation.separateFindingRequired && !code.punishmentPolicy.publicEnemyDesignation.sovereignFiatSufficient),
      penalFlightIsNonterminalRelease: codes.every((code) => !code.punishmentPolicy.penalFlight.available || code.punishmentPolicy.penalFlight.automaticDeath === false),
      publicDirectoryHidesEnforcementPolicy: publicDirectory.entries.every((entry) => !Object.hasOwn(entry, "hiddenEnforcement")),
      hiddenPolicyCannotInferGuilt: cityLegalCodes.codes.flatMap((code) => hiddenEnforcementFor(map, code.cityId)).every((entry) => entry.guiltInferencePermitted === false),
      runtimeChargeMappingCount: Object.keys(RUNTIME_CHARGE_TO_OFFENSE).length
    };
  }

  return Object.freeze({
    LEGAL_STATUSES,
    CULPABILITY_STANDARDS,
    SEVERITY_GRADES,
    PUBLIC_ATTITUDES,
    ENFORCEMENT_PRIORITIES,
    RESOURCE_ALLOCATIONS,
    SANCTIONS,
    RUNTIME_CHARGE_TO_OFFENSE,
    OFFENSE_CATALOG,
    createCityLegalCodes,
    validateCityLegalCodes,
    attachCityLegalCodes,
    publicCityLawDirectory,
    cellPublicCityLawSnapshot,
    publicRuleFor,
    hiddenEnforcementFor,
    auditCityLegalCodes,
    clone
  });
});
