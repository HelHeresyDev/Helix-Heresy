(function attachHelixPretrialProceedings(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixPretrialProceedings = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixPretrialProceedings() {
  "use strict";

  const VERSION = 2;
  const HOUR = 3600;
  const STATUSES = Object.freeze(["chargingPending", "counselSelection", "firstAppearanceReady", "hearing", "detained", "bailPending", "released", "fugitive", "pleaAccepted", "trialScheduled", "chargesDismissed", "resolved"]);
  const COUNSEL_KINDS = Object.freeze(["public", "retained", "self"]);
  const SUBMISSIONS = Object.freeze([
    { id: "recognizance", label: "Request Release on Recognizance", mitigation: 5, conditions: false },
    { id: "securedBail", label: "Offer Secured Bail", mitigation: 7, conditions: true },
    { id: "strictConditions", label: "Propose Strict Conditions", mitigation: 10, conditions: true }
  ]);
  const MOTION_DEFS = Object.freeze([
    { id: "suppressEvidence", label: "Suppress Evidence", targetKind: "support", description: "Challenge warrant scope, custody, integrity, or reliability without deleting the underlying record." },
    { id: "dismissCharge", label: "Dismiss Charge", targetKind: "charge", description: "Challenge a charge that lacks sufficient admissible support." },
    { id: "compelDiscovery", label: "Compel Discovery", targetKind: "withheld", description: "Seek material details withheld from the served discovery packet." },
    { id: "reconsiderCustody", label: "Reconsider Custody", targetKind: "proceeding", description: "Seek release, lower bail, or narrower conditions after the case weakens." }
  ]);
  const CLAIM_DEFS = Object.freeze([
    { id: "mistakenAttribution", label: "Mistaken Identity or Attribution", patterns: ["identity", "attribution", "weak"], description: "Argue that the cited material does not reliably identify the scientist." },
    { id: "licensedConduct", label: "Licensed or Authorized Conduct", patterns: ["licensed", "authorized", "permit", "ordinary business"], description: "Cite records showing that the conduct or material was lawfully authorized." },
    { id: "scopeViolation", label: "Outside Lawful Warrant Scope", patterns: ["scope", "expansion", "outside warrant"], description: "Argue that the authority obtained the material outside lawful saved scope." },
    { id: "custodyUnreliable", label: "Unreliable Custody or Integrity", patterns: ["custody", "integrity", "contamination", "broken chain"], description: "Challenge whether the cited subject remained reliable after collection." },
    { id: "lawfulExplanation", label: "Lawful Innocent Explanation", patterns: ["lawful", "legal", "byproduct", "ordinary", "declared"], description: "Tie an apparently suspicious subject to accessible lawful activity." },
    { id: "necessity", label: "Necessity or Emergency", patterns: ["emergency", "necessity", "containment", "hazard response"], description: "Explain conduct as a response to a concrete emergency." },
    { id: "explicitDenial", label: "Explicit Denial", patterns: [], risky: true, description: "Deny the allegation despite the disclosed record; contradictions may create a false-statement consequence." }
  ]);
  const COUNTER_DEFS = Object.freeze([
    { id: "dropLowestCharge", label: "Demand One Additional Dismissal", difficulty: 7 },
    { id: "lenientCustody", label: "Demand a Noncustodial Recommendation", difficulty: 9 },
    { id: "noForfeiture", label: "Reject Property Forfeiture", difficulty: 5 }
  ]);
  const CHARGE_DEFS = Object.freeze({
    prohibitedResearch: { id: "prohibitedResearch", label: "Unlicensed Prohibited Research", severity: "serious", weight: 8, maximumExposure: "Substantial custodial sentence" },
    prohibitedAnimancy: { id: "prohibitedAnimancy", label: "Prohibited Animantic Practice", severity: "critical", weight: 12, maximumExposure: "Severe custodial sentence" },
    contrabandCommerce: { id: "contrabandCommerce", label: "Contraband Commerce", severity: "serious", weight: 7, maximumExposure: "Custody, forfeiture, and fines" },
    hazardousBiologicalConduct: { id: "hazardousBiologicalConduct", label: "Hazardous Biological Conduct", severity: "material", weight: 5, maximumExposure: "Regulatory and custodial penalties" },
    warrantObstruction: { id: "warrantObstruction", label: "Obstruction of Warrant Service", severity: "serious", weight: 7, maximumExposure: "Additional custodial sentence" },
    violentResistance: { id: "violentResistance", label: "Violent Resistance to Arrest", severity: "critical", weight: 14, maximumExposure: "Severe consecutive sentence" },
    escapeCustody: { id: "escapeCustody", label: "Escape from Pretrial Custody", severity: "critical", weight: 13, maximumExposure: "Additional custodial sentence" },
    failureToAppear: { id: "failureToAppear", label: "Failure to Appear", severity: "serious", weight: 8, maximumExposure: "Bench warrant and additional sentence" },
    attemptedEscape: { id: "attemptedEscape", label: "Attempted Escape from Pretrial Custody", severity: "serious", weight: 8, maximumExposure: "Additional custodial sentence" },
    falseStatement: { id: "falseStatement", label: "Material False Statement to the Court", severity: "serious", weight: 6, maximumExposure: "Additional custodial sentence and credibility consequences" }
  });
  const GIVEN_NAMES = Object.freeze(["Mara", "Ivo", "Nia", "Dane", "Sera", "Oren", "Tamsin", "Cal", "Vera", "Jules", "Anja", "Rook"]);
  const SURNAMES = Object.freeze(["Vale", "Morrow", "Kade", "Dunn", "Rusk", "Sloane", "Voss", "Keene", "Ward", "Hale", "Pike", "Quill"]);

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function cleanId(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "");
  }

  function uniqueIds(values) {
    return [...new Set((Array.isArray(values) ? values : []).map(cleanId).filter(Boolean))];
  }

  function hash(seed) {
    const text = String(seed || "pretrial-proceedings");
    let value = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      value ^= text.charCodeAt(index);
      value = Math.imul(value, 16777619);
    }
    value += value << 13; value ^= value >>> 7;
    value += value << 3; value ^= value >>> 17; value += value << 5;
    return value >>> 0;
  }

  function unitRoll(seed) {
    return hash(seed) / 4294967296;
  }

  function generatedName(seed, role) {
    return `${GIVEN_NAMES[hash(`${seed}:${role}:given`) % GIVEN_NAMES.length]} ${SURNAMES[hash(`${seed}:${role}:surname`) % SURNAMES.length]}`;
  }

  function normalizeHistory(candidate) {
    return (Array.isArray(candidate) ? candidate : []).map((entry) => ({
      at: Math.max(0, finite(entry?.at)), action: cleanId(entry?.action) || "updated",
      summary: String(entry?.summary || "Pretrial proceeding updated.").trim()
    })).sort((left, right) => left.at - right.at);
  }

  function normalizeOfficial(candidate, fallback = {}) {
    return {
      id: cleanId(candidate?.id) || cleanId(fallback.id),
      name: String(candidate?.name || fallback.name || "Court official").trim(),
      role: cleanId(candidate?.role) || cleanId(fallback.role),
      proceduralStrictness: Math.max(0, Math.min(100, finite(candidate?.proceduralStrictness, fallback.proceduralStrictness ?? 50))),
      libertyPreference: Math.max(0, Math.min(100, finite(candidate?.libertyPreference, fallback.libertyPreference ?? 50)))
    };
  }

  function normalizeSupport(candidate, index = 0) {
    return {
      id: cleanId(candidate?.id) || `charge-support-${index + 1}`,
      kind: cleanId(candidate?.kind) || "authorityEvidence", sourceId: cleanId(candidate?.sourceId),
      label: String(candidate?.label || "Authority support").trim(),
      reliability: ["weak", "credible", "strong"].includes(candidate?.reliability) ? candidate.reliability : "credible",
      significanceRank: Math.max(0, Math.min(4, Math.floor(finite(candidate?.significanceRank, 1)))),
      traits: [...new Set((Array.isArray(candidate?.traits) ? candidate.traits : []).map((entry) => String(entry || "").trim()).filter(Boolean))],
      disclosed: Boolean(candidate?.disclosed), integrity: Math.max(0, Math.min(100, finite(candidate?.integrity, 100))),
      scopeStatus: ["authorized", "expanded", "outside", "unknown"].includes(candidate?.scopeStatus) ? candidate.scopeStatus : "unknown",
      custodyIssues: [...new Set((Array.isArray(candidate?.custodyIssues) ? candidate.custodyIssues : []).map(String).filter(Boolean))],
      admissibility: candidate?.admissibility === "excluded" ? "excluded" : "admitted",
      exclusionReason: String(candidate?.exclusionReason || "").trim()
    };
  }

  function normalizeCharge(candidate, index = 0) {
    const def = CHARGE_DEFS[candidate?.typeId] || CHARGE_DEFS.prohibitedResearch;
    return {
      id: cleanId(candidate?.id) || `criminal-charge-${index + 1}`,
      typeId: def.id, label: String(candidate?.label || def.label).trim(), severity: def.severity,
      weight: Math.max(0, finite(candidate?.weight, def.weight)), maximumExposure: String(candidate?.maximumExposure || def.maximumExposure),
      status: ["proposed", "filed", "rejected", "dismissed", "resolved"].includes(candidate?.status) ? candidate.status : "proposed",
      filedAt: candidate?.filedAt == null ? null : Math.max(0, finite(candidate.filedAt)),
      publicProbableCause: String(candidate?.publicProbableCause || "The prosecution cites the linked authority record.").trim(),
      support: (Array.isArray(candidate?.support) ? candidate.support : []).map(normalizeSupport)
    };
  }

  function normalizeCounselOption(candidate, index = 0) {
    const kind = COUNSEL_KINDS.includes(candidate?.kind) ? candidate.kind : COUNSEL_KINDS[index] || "public";
    return {
      id: cleanId(candidate?.id) || `counsel-option-${kind}`,
      kind, name: String(candidate?.name || (kind === "self" ? "The Scientist" : "Defense Counsel")).trim(),
      specialties: uniqueIds(candidate?.specialties), workload: Math.max(0, Math.min(100, finite(candidate?.workload, kind === "public" ? 78 : kind === "retained" ? 36 : 100))),
      loyalty: Math.max(0, Math.min(100, finite(candidate?.loyalty, kind === "retained" ? 58 : 45))),
      proceduralSkill: Math.max(0, Math.min(100, finite(candidate?.proceduralSkill, kind === "public" ? 64 : kind === "retained" ? 76 : 20))),
      cost: Math.max(0, Math.round(finite(candidate?.cost))), available: candidate?.available !== false,
      description: String(candidate?.description || "").trim()
    };
  }

  function normalizeConference(candidate, index = 0) {
    return {
      id: cleanId(candidate?.id) || `counsel-conference-${index + 1}`,
      counselOptionId: cleanId(candidate?.counselOptionId), at: Math.max(0, finite(candidate?.at)),
      channel: cleanId(candidate?.channel) || "legalCounsel", privileged: candidate?.privileged !== false,
      summary: String(candidate?.summary || "Privileged defense conference completed.").trim()
    };
  }

  function normalizeCondition(candidate, index = 0) {
    return {
      id: cleanId(candidate?.id) || `release-condition-${index + 1}`,
      kind: cleanId(candidate?.kind) || "appearAsOrdered", label: String(candidate?.label || "Appear as ordered").trim(),
      physicallyEnforced: Boolean(candidate?.physicallyEnforced), status: ["active", "violated", "lifted"].includes(candidate?.status) ? candidate.status : "active",
      sourceChargeId: cleanId(candidate?.sourceChargeId), imposedAt: Math.max(0, finite(candidate?.imposedAt)),
      physicalStackId: cleanId(candidate?.physicalStackId), toolInstanceId: cleanId(candidate?.toolInstanceId)
    };
  }

  function normalizeDiscoveryItem(candidate, index = 0) {
    return {
      id: cleanId(candidate?.id) || `discovery-item-${index + 1}`, supportId: cleanId(candidate?.supportId), sourceId: cleanId(candidate?.sourceId),
      chargeIds: uniqueIds(candidate?.chargeIds), kind: cleanId(candidate?.kind) || "authorityEvidence",
      label: String(candidate?.label || "Disclosed prosecution material").trim(), summary: String(candidate?.summary || candidate?.label || "Disclosed prosecution material").trim(),
      reliability: ["weak", "credible", "strong"].includes(candidate?.reliability) ? candidate.reliability : "credible",
      significanceRank: Math.max(0, Math.min(4, Math.floor(finite(candidate?.significanceRank, 1)))),
      integrity: Math.max(0, Math.min(100, finite(candidate?.integrity, 100))), scopeStatus: ["authorized", "expanded", "outside", "unknown"].includes(candidate?.scopeStatus) ? candidate.scopeStatus : "unknown",
      custodyIssues: [...new Set((Array.isArray(candidate?.custodyIssues) ? candidate.custodyIssues : []).map(String).filter(Boolean))],
      traits: [...new Set((Array.isArray(candidate?.traits) ? candidate.traits : []).map(String).filter(Boolean))],
      exculpatory: Boolean(candidate?.exculpatory), admissibility: candidate?.admissibility === "excluded" ? "excluded" : "admitted",
      exclusionReason: String(candidate?.exclusionReason || "").trim()
    };
  }

  function normalizeWithheldItem(candidate, index = 0) {
    return {
      id: cleanId(candidate?.id) || `withheld-item-${index + 1}`, label: String(candidate?.label || "Withheld source detail").trim(),
      sourceDiscoveryItemId: cleanId(candidate?.sourceDiscoveryItemId), reason: String(candidate?.reason || "Active-investigation source protection").trim(),
      material: candidate?.material !== false, privileged: Boolean(candidate?.privileged), status: ["withheld", "compelled", "upheld"].includes(candidate?.status) ? candidate.status : "withheld"
    };
  }

  function normalizePreparationSession(candidate, index = 0) {
    return {
      id: cleanId(candidate?.id) || `preparation-session-${index + 1}`, kind: cleanId(candidate?.kind) || "discoveryReview",
      at: Math.max(0, finite(candidate?.at)), progress: Math.max(0, finite(candidate?.progress)), roomId: cleanId(candidate?.roomId),
      counselOptionId: cleanId(candidate?.counselOptionId), summary: String(candidate?.summary || "Case preparation completed.").trim()
    };
  }

  function normalizeMotion(candidate, index = 0) {
    return {
      id: cleanId(candidate?.id) || `pretrial-motion-${index + 1}`, typeId: cleanId(candidate?.typeId), targetId: cleanId(candidate?.targetId),
      filedAt: Math.max(0, finite(candidate?.filedAt)), resolvedAt: candidate?.resolvedAt == null ? null : Math.max(0, finite(candidate.resolvedAt)),
      status: ["filed", "granted", "denied"].includes(candidate?.status) ? candidate.status : "filed",
      score: finite(candidate?.score), oppositionScore: finite(candidate?.oppositionScore), citedItemIds: uniqueIds(candidate?.citedItemIds),
      reasons: (Array.isArray(candidate?.reasons) ? candidate.reasons : []).map(String), consequence: String(candidate?.consequence || "").trim()
    };
  }

  function normalizeClaim(candidate, index = 0) {
    return {
      id: cleanId(candidate?.id) || `defense-claim-${index + 1}`, typeId: cleanId(candidate?.typeId), filedAt: Math.max(0, finite(candidate?.filedAt)),
      citedItemIds: uniqueIds(candidate?.citedItemIds), supportScore: Math.max(0, finite(candidate?.supportScore)), contradictionScore: Math.max(0, finite(candidate?.contradictionScore)),
      credibilityDelta: finite(candidate?.credibilityDelta), status: ["supported", "weak", "contradicted"].includes(candidate?.status) ? candidate.status : "weak",
      summary: String(candidate?.summary || "Defense claim recorded.").trim()
    };
  }

  function normalizePleaOffer(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    return {
      id: cleanId(candidate.id) || "plea-offer-1", offeredAt: Math.max(0, finite(candidate.offeredAt)), expiresAt: Math.max(0, finite(candidate.expiresAt)),
      resolutionChargeIds: uniqueIds(candidate.resolutionChargeIds), dismissedChargeIds: uniqueIds(candidate.dismissedChargeIds),
      sentencingRecommendation: cleanId(candidate.sentencingRecommendation) || "custodialCap", custodyRecommendation: cleanId(candidate.custodyRecommendation) || "continueCurrent",
      forfeitureAmount: Math.max(0, Math.round(finite(candidate.forfeitureAmount))), summary: String(candidate.summary || "Prosecution plea offer").trim()
    };
  }

  function normalizeProceeding(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const openedAt = Math.max(0, finite(source.openedAt));
    const options = (Array.isArray(source.counsel?.options) ? source.counsel.options : []).map(normalizeCounselOption);
    const charges = (Array.isArray(source.charges) ? source.charges : []).map(normalizeCharge);
    const selectedOptionId = cleanId(source.counsel?.selectedOptionId);
    return {
      id: cleanId(source.id) || `pretrial-proceeding-${index + 1}`,
      raidId: cleanId(source.raidId), authorityCaseId: cleanId(source.authorityCaseId), warrantExecutionId: cleanId(source.warrantExecutionId),
      docket: String(source.docket || "CR-0000").trim(), status: STATUSES.includes(source.status) ? source.status : "chargingPending",
      openedAt, updatedAt: Math.max(openedAt, finite(source.updatedAt, openedAt)),
      court: {
        id: cleanId(source.court?.id) || "municipal-criminal-court", label: String(source.court?.label || "Municipal Criminal Court").trim(),
        jurisdictionId: cleanId(source.court?.jurisdictionId) || "local-municipality",
        judge: normalizeOfficial(source.court?.judge, { id: `pretrial-${index + 1}-judge`, name: "Magistrate", role: "judge" }),
        prosecutor: normalizeOfficial(source.court?.prosecutor, { id: `pretrial-${index + 1}-prosecutor`, name: "Prosecutor", role: "prosecutor" })
      },
      charges,
      counsel: {
        options, selectedOptionId, selectedAt: source.counsel?.selectedAt == null ? null : Math.max(openedAt, finite(source.counsel.selectedAt)),
        paid: Boolean(source.counsel?.paid), agreementAmount: Math.max(0, Math.round(finite(source.counsel?.agreementAmount))),
        conferences: (Array.isArray(source.counsel?.conferences) ? source.counsel.conferences : []).map(normalizeConference)
      },
      timeline: {
        chargingAt: Math.max(openedAt, finite(source.timeline?.chargingAt, openedAt + HOUR)),
        counselDeadline: Math.max(openedAt, finite(source.timeline?.counselDeadline, openedAt + 4 * HOUR)),
        firstAppearanceAt: Math.max(openedAt, finite(source.timeline?.firstAppearanceAt, openedAt + 8 * HOUR)),
        discoveryDueAt: source.timeline?.discoveryDueAt == null ? null : Math.max(openedAt, finite(source.timeline.discoveryDueAt)),
        nextHearingAt: source.timeline?.nextHearingAt == null ? null : Math.max(openedAt, finite(source.timeline.nextHearingAt))
      },
      firstAppearance: {
        status: ["scheduled", "ready", "inProgress", "completed", "missed"].includes(source.firstAppearance?.status) ? source.firstAppearance.status : "scheduled",
        startedAt: source.firstAppearance?.startedAt == null ? null : Math.max(openedAt, finite(source.firstAppearance.startedAt)),
        completedAt: source.firstAppearance?.completedAt == null ? null : Math.max(openedAt, finite(source.firstAppearance.completedAt)),
        submissionId: cleanId(source.firstAppearance?.submissionId), decision: cleanId(source.firstAppearance?.decision),
        riskScore: Math.max(0, finite(source.firstAppearance?.riskScore)), mitigationScore: Math.max(0, finite(source.firstAppearance?.mitigationScore)),
        discretion: Math.max(0, Math.min(1, finite(source.firstAppearance?.discretion))),
        reasons: (Array.isArray(source.firstAppearance?.reasons) ? source.firstAppearance.reasons : []).map(String),
        rejectedChargeIds: uniqueIds(source.firstAppearance?.rejectedChargeIds)
      },
      release: {
        status: ["none", "awaitingBail", "released", "revoked", "forfeited"].includes(source.release?.status) ? source.release.status : "none",
        kind: cleanId(source.release?.kind), orderedAt: source.release?.orderedAt == null ? null : Math.max(openedAt, finite(source.release.orderedAt)),
        releasedAt: source.release?.releasedAt == null ? null : Math.max(openedAt, finite(source.release.releasedAt)),
        bailAmount: Math.max(0, Math.round(finite(source.release?.bailAmount))),
        escrowStatus: ["none", "due", "held", "refunded", "forfeited"].includes(source.release?.escrowStatus) ? source.release.escrowStatus : "none",
        escrowPaidAt: source.release?.escrowPaidAt == null ? null : Math.max(openedAt, finite(source.release.escrowPaidAt)),
        conditions: (Array.isArray(source.release?.conditions) ? source.release.conditions : []).map(normalizeCondition),
        transport: source.release?.transport && typeof source.release.transport === "object" ? { ...source.release.transport } : null
      },
      fugitive: {
        active: Boolean(source.fugitive?.active), escapedAt: source.fugitive?.escapedAt == null ? null : Math.max(openedAt, finite(source.fugitive.escapedAt)),
        benchWarrantStatus: ["none", "requested", "issued", "served"].includes(source.fugitive?.benchWarrantStatus) ? source.fugitive.benchWarrantStatus : "none",
        failureToAppearAt: source.fugitive?.failureToAppearAt == null ? null : Math.max(openedAt, finite(source.fugitive.failureToAppearAt))
      },
      discovery: {
        status: ["pending", "served", "reviewed"].includes(source.discovery?.status) ? source.discovery.status : "pending",
        packetId: cleanId(source.discovery?.packetId), frozenAt: source.discovery?.frozenAt == null ? null : Math.max(openedAt, finite(source.discovery.frozenAt)),
        servedAt: source.discovery?.servedAt == null ? null : Math.max(openedAt, finite(source.discovery.servedAt)),
        reviewedAt: source.discovery?.reviewedAt == null ? null : Math.max(openedAt, finite(source.discovery.reviewedAt)),
        serviceRoute: source.discovery?.serviceRoute && typeof source.discovery.serviceRoute === "object" ? { ...source.discovery.serviceRoute } : null,
        items: (Array.isArray(source.discovery?.items) ? source.discovery.items : []).map(normalizeDiscoveryItem),
        witnesses: (Array.isArray(source.discovery?.witnesses) ? source.discovery.witnesses : []).map((entry, witnessIndex) => ({ id: cleanId(entry?.id) || `discovery-witness-${witnessIndex + 1}`, label: String(entry?.label || "Authority witness").trim(), sourceItemIds: uniqueIds(entry?.sourceItemIds), disclosed: entry?.disclosed !== false })),
        withheld: (Array.isArray(source.discovery?.withheld) ? source.discovery.withheld : []).map(normalizeWithheldItem),
        amendments: (Array.isArray(source.discovery?.amendments) ? source.discovery.amendments : []).map((entry, amendmentIndex) => ({ id: cleanId(entry?.id) || `discovery-amendment-${amendmentIndex + 1}`, at: Math.max(openedAt, finite(entry?.at)), itemIds: uniqueIds(entry?.itemIds), summary: String(entry?.summary || "Discovery amended.").trim() }))
      },
      preparation: {
        progress: Math.max(0, Math.min(100, finite(source.preparation?.progress))), credibility: Math.max(0, Math.min(100, finite(source.preparation?.credibility, 70))),
        sessions: (Array.isArray(source.preparation?.sessions) ? source.preparation.sessions : []).map(normalizePreparationSession)
      },
      motions: (Array.isArray(source.motions) ? source.motions : []).map(normalizeMotion),
      defenseClaims: (Array.isArray(source.defenseClaims) ? source.defenseClaims : []).map(normalizeClaim),
      plea: {
        status: ["none", "offered", "countered", "accepted", "rejected", "expired"].includes(source.plea?.status) ? source.plea.status : "none",
        offer: normalizePleaOffer(source.plea?.offer), counterId: cleanId(source.plea?.counterId), respondedAt: source.plea?.respondedAt == null ? null : Math.max(openedAt, finite(source.plea.respondedAt)),
        reasons: (Array.isArray(source.plea?.reasons) ? source.plea.reasons : []).map(String)
      },
      trial: {
        status: ["unscheduled", "scheduled", "pleaSentencing", "dismissed"].includes(source.trial?.status) ? source.trial.status : "unscheduled",
        scheduledAt: source.trial?.scheduledAt == null ? null : Math.max(openedAt, finite(source.trial.scheduledAt)),
        trialAt: source.trial?.trialAt == null ? null : Math.max(openedAt, finite(source.trial.trialAt)),
        appearanceRequired: source.trial?.appearanceRequired !== false,
        handoff: source.trial?.handoff && typeof source.trial.handoff === "object" ? { ...source.trial.handoff } : null
      },
      history: normalizeHistory(source.history)
    };
  }

  function defaultState() {
    return { version: VERSION, proceedings: [], nextProceedingNumber: 1, nextChargeNumber: 1, nextConferenceNumber: 1, nextMotionNumber: 1, nextClaimNumber: 1, nextPreparationNumber: 1 };
  }

  function normalizeState(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const proceedings = (Array.isArray(source.proceedings) ? source.proceedings : []).map(normalizeProceeding);
    return {
      version: VERSION, proceedings,
      nextProceedingNumber: Math.max(1, Math.floor(finite(source.nextProceedingNumber, proceedings.length + 1))),
      nextChargeNumber: Math.max(1, Math.floor(finite(source.nextChargeNumber, 1))),
      nextConferenceNumber: Math.max(1, Math.floor(finite(source.nextConferenceNumber, 1))),
      nextMotionNumber: Math.max(1, Math.floor(finite(source.nextMotionNumber, 1))),
      nextClaimNumber: Math.max(1, Math.floor(finite(source.nextClaimNumber, 1))),
      nextPreparationNumber: Math.max(1, Math.floor(finite(source.nextPreparationNumber, 1)))
    };
  }

  function counselOptions(seed, proceedingId) {
    const retainedCost = 1200 + (hash(`${seed}:${proceedingId}:retainer`) % 9) * 150;
    return [
      normalizeCounselOption({ id: `${proceedingId}-public-counsel`, kind: "public", name: generatedName(seed, `${proceedingId}:public`), specialties: ["custodyHearings", "warrantProcedure"], workload: 72 + hash(`${seed}:public:workload`) % 20, proceduralSkill: 60 + hash(`${seed}:public:skill`) % 17, loyalty: 45, cost: 0, description: "Free appointed counsel with strong routine procedure and a heavy caseload." }),
      normalizeCounselOption({ id: `${proceedingId}-retained-counsel`, kind: "retained", name: generatedName(seed, `${proceedingId}:retained`), specialties: ["prohibitedResearch", "complexEvidence", "custodyHearings"], workload: 24 + hash(`${seed}:retained:workload`) % 25, proceduralSkill: 73 + hash(`${seed}:retained:skill`) % 18, loyalty: 58, cost: retainedCost, description: "Paid specialist counsel with more preparation capacity and an explicit retainer." }),
      normalizeCounselOption({ id: `${proceedingId}-self-representation`, kind: "self", name: "The Scientist", specialties: [], workload: 100, proceduralSkill: 20, loyalty: 100, cost: 0, description: "Direct control without professional procedural expertise; standby public counsel remains available." })
    ];
  }

  function supportText(entry) {
    return `${entry.label}${entry.sourceId ? ` (${entry.sourceId})` : ""}`;
  }

  function chargesFromContext(state, proceedingId, context = {}) {
    const support = (Array.isArray(context.authoritySupport) ? context.authoritySupport : []).map(normalizeSupport);
    const traits = support.flatMap((entry) => entry.traits).join(" ").toLowerCase();
    const charges = [];
    const add = (typeId, matching, publicReason) => {
      const def = CHARGE_DEFS[typeId];
      const exact = matching.length ? matching : support;
      if (!def || charges.some((charge) => charge.typeId === typeId) || !exact.length) return;
      charges.push(normalizeCharge({
        id: `criminal-charge-${state.nextChargeNumber++}`, typeId, status: "proposed", support: exact,
        publicProbableCause: publicReason || `The prosecution cites ${exact.map(supportText).join("; ")}.`
      }, charges.length));
    };
    const matching = (patterns) => support.filter((entry) => patterns.some((pattern) => entry.traits.some((trait) => String(trait).toLowerCase().includes(pattern)) || entry.label.toLowerCase().includes(pattern)));
    add("prohibitedAnimancy", matching(["animancy", "animantic", "soul"]), "The prosecution alleges prohibited soul manipulation supported by the cited authority record.");
    add("contrabandCommerce", matching(["black market", "contraband", "off-books", "illegal commerce"]), "The prosecution alleges covert prohibited commerce supported by reported or seized transactions.");
    add("hazardousBiologicalConduct", matching(["biological", "hazard", "contamination", "discharge", "creature"]), "The prosecution alleges hazardous biological conduct supported by the cited physical or documentary record.");
    add("warrantObstruction", matching(["obstruction", "forced entry", "denied access"]), "The prosecution cites saved obstruction or forced-entry history.");
    const raidSupport = (Array.isArray(context.raidSupport) ? context.raidSupport : []).map(normalizeSupport);
    if (context.violentResistance) add("violentResistance", raidSupport.length ? raidSupport : support, "The raid record identifies an officer attack or immediate violent resistance during arrest.");
    if (!charges.length || /genetic|research|mutation|slime|specimen/.test(traits)) {
      const exact = matching(["genetic", "research", "mutation", "slime", "specimen"]);
      add("prohibitedResearch", exact.length ? exact : support, "The charging instrument cites the supported warrant allegation and its linked authority evidence for prohibited research.");
    }
    if (!charges.length) {
      const fallback = normalizeSupport({ id: `${proceedingId}-warrant-support`, kind: "warrantExecution", sourceId: context.warrantExecutionId, label: context.warrantLabel || "Supported search-and-arrest warrant", reliability: "credible", significanceRank: 2, traits: ["prohibited research allegation"] });
      charges.push(normalizeCharge({ id: `criminal-charge-${state.nextChargeNumber++}`, typeId: "prohibitedResearch", status: "proposed", support: [fallback], publicProbableCause: "The charge rests on the supported warrant allegation pending discovery of the underlying authority record." }));
    }
    return charges;
  }

  function open(candidate, context = {}) {
    const state = normalizeState(candidate);
    const raidId = cleanId(context.raidId);
    const existing = state.proceedings.find((entry) => entry.raidId === raidId);
    if (existing) return { state, proceeding: existing, created: false };
    const openedAt = Math.max(0, finite(context.clock));
    const id = `pretrial-proceeding-${state.nextProceedingNumber++}`;
    const seed = String(context.seed || "pretrial");
    const discretion = unitRoll(`${seed}:${id}:first-appearance-discretion`);
    const proceeding = normalizeProceeding({
      id, raidId, authorityCaseId: context.authorityCaseId, warrantExecutionId: context.warrantExecutionId,
      docket: context.docket || `CR-${String(state.nextProceedingNumber - 1).padStart(4, "0")}`, openedAt,
      court: {
        id: "municipal-criminal-court", label: context.courtLabel || "Municipal Criminal Court", jurisdictionId: context.jurisdictionId || "local-municipality",
        judge: { id: `${id}-judge`, name: generatedName(seed, `${id}:judge`), role: "judge", proceduralStrictness: 40 + hash(`${seed}:${id}:strict`) % 41, libertyPreference: 35 + hash(`${seed}:${id}:liberty`) % 51 },
        prosecutor: { id: `${id}-prosecutor`, name: generatedName(seed, `${id}:prosecutor`), role: "prosecutor", proceduralStrictness: 50, libertyPreference: 20 }
      },
      charges: chargesFromContext(state, id, context), counsel: { options: counselOptions(seed, id) },
      timeline: { chargingAt: openedAt + HOUR, counselDeadline: openedAt + 4 * HOUR, firstAppearanceAt: openedAt + 8 * HOUR },
      firstAppearance: { discretion },
      history: [
        { at: openedAt, action: "caseOpened", summary: "A criminal proceeding was opened from the exact arrest, warrant, and authority record; charging remained pending." },
        ...(context.voluntarySurrender ? [{ at: openedAt, action: "voluntarySurrender", summary: "The saved raid record shows that the scientist surrendered before physical restraint." }] : [])
      ]
    }, state.proceedings.length);
    state.proceedings.push(proceeding);
    return { state, proceeding, created: true };
  }

  function current(candidate) {
    return normalizeState(candidate).proceedings.find((entry) => !["resolved", "chargesDismissed"].includes(entry.status)) || null;
  }

  function fileCharges(proceeding, clock) {
    const filed = proceeding.charges.filter((charge) => charge.status === "proposed");
    for (const charge of filed) { charge.status = "filed"; charge.filedAt = clock; for (const support of charge.support) support.disclosed = false; }
    if (filed.length) proceeding.history.push({ at: clock, action: "chargesFiled", summary: `${filed.length} charge(s) were filed with stated probable cause; undisclosed support remained hidden pending discovery.` });
    if (!proceeding.fugitive.active) proceeding.status = "counselSelection";
  }

  function selectCounsel(candidate, proceedingId, optionId, clock = 0) {
    const state = normalizeState(candidate);
    const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    const option = proceeding?.counsel.options.find((entry) => entry.id === cleanId(optionId) && entry.available);
    if (!proceeding || !option || proceeding.counsel.selectedOptionId) return { state, proceeding, option, changed: false };
    const at = Math.max(proceeding.openedAt, finite(clock));
    proceeding.counsel.selectedOptionId = option.id; proceeding.counsel.selectedAt = at;
    proceeding.counsel.agreementAmount = option.cost; proceeding.counsel.paid = option.cost === 0;
    proceeding.history.push({ at, action: "counselSelected", summary: option.kind === "self" ? "The scientist invoked self-representation with standby public counsel." : `${option.name} entered an appearance as ${option.kind} defense counsel.` });
    return { state, proceeding, option, changed: true };
  }

  function markCounselPaid(candidate, proceedingId, clock = 0) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    if (!proceeding || proceeding.counsel.paid || !proceeding.counsel.selectedOptionId) return { state, proceeding, changed: false };
    proceeding.counsel.paid = true; proceeding.history.push({ at: Math.max(proceeding.openedAt, finite(clock)), action: "retainerPaid", summary: "The retained-counsel agreement was paid from an explicit lawful funding source." });
    return { state, proceeding, changed: true };
  }

  function recordConference(candidate, proceedingId, options = {}) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    if (!proceeding?.counsel.selectedOptionId || proceeding.counsel.conferences.some((entry) => entry.counselOptionId === proceeding.counsel.selectedOptionId)) return { state, proceeding, changed: false };
    const conference = normalizeConference({ id: `counsel-conference-${state.nextConferenceNumber++}`, counselOptionId: proceeding.counsel.selectedOptionId, at: options.clock, channel: options.channel, privileged: true, summary: options.summary }, proceeding.counsel.conferences.length);
    proceeding.counsel.conferences.push(conference); proceeding.history.push({ at: conference.at, action: "privilegedConference", summary: conference.summary });
    return { state, proceeding, conference, changed: true };
  }

  function hearingRequirements(proceeding) {
    if (!proceeding) return "No active criminal proceeding.";
    if (!proceeding.counsel.selectedOptionId) return "Select representation before the first appearance.";
    const selected = proceeding.counsel.options.find((entry) => entry.id === proceeding.counsel.selectedOptionId);
    if (selected?.kind === "retained" && !proceeding.counsel.paid) return "Pay the retained-counsel agreement before counsel can appear.";
    if (selected?.kind !== "self" && !proceeding.counsel.conferences.some((entry) => entry.counselOptionId === selected?.id)) return "Complete a privileged counsel conference before the hearing.";
    if (proceeding.firstAppearance.status !== "ready") return proceeding.firstAppearance.status === "scheduled" ? "The first appearance is not yet due." : "The first appearance is unavailable.";
    if (proceeding.fugitive.active) return "A fugitive defendant cannot physically appear through the jail hearing room.";
    return "";
  }

  function beginHearing(candidate, proceedingId, submissionId, clock = 0) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    const submission = SUBMISSIONS.find((entry) => entry.id === cleanId(submissionId));
    const reason = hearingRequirements(proceeding);
    if (!proceeding || !submission || reason) return { state, proceeding, submission, reason, changed: false };
    proceeding.status = "hearing"; proceeding.firstAppearance.status = "inProgress"; proceeding.firstAppearance.startedAt = Math.max(proceeding.openedAt, finite(clock)); proceeding.firstAppearance.submissionId = submission.id;
    proceeding.history.push({ at: proceeding.firstAppearance.startedAt, action: "firstAppearanceBegan", summary: `${submission.label} was presented at the physical secure court appearance.` });
    return { state, proceeding, submission, reason: "", changed: true };
  }

  function counselMitigation(proceeding) {
    const selected = proceeding.counsel.options.find((entry) => entry.id === proceeding.counsel.selectedOptionId);
    if (!selected) return 0;
    const specialty = selected.specialties.includes("custodyHearings") ? 3 : 0;
    const capacity = Math.max(0, (selected.proceduralSkill - selected.workload * 0.35) / 15);
    return specialty + capacity;
  }

  function resolveHearing(candidate, proceedingId, clock = 0) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    if (!proceeding || proceeding.firstAppearance.status !== "inProgress") return { state, proceeding, changed: false };
    const at = Math.max(proceeding.firstAppearance.startedAt, finite(clock));
    const filed = proceeding.charges.filter((charge) => charge.status === "filed");
    const rejected = filed.filter((charge) => !charge.support.length);
    for (const charge of rejected) charge.status = "rejected";
    const remaining = filed.filter((charge) => charge.status === "filed");
    const violence = remaining.some((charge) => charge.typeId === "violentResistance");
    const escape = remaining.some((charge) => charge.typeId === "escapeCustody");
    const chargeWeight = remaining.reduce((total, charge) => total + charge.weight, 0);
    const supportWeight = remaining.reduce((total, charge) => total + Math.max(0, ...charge.support.map((support) => support.significanceRank)), 0);
    const riskScore = chargeWeight + supportWeight + (violence ? 8 : 0) + (escape ? 8 : 0);
    const submission = SUBMISSIONS.find((entry) => entry.id === proceeding.firstAppearance.submissionId) || SUBMISSIONS[0];
    const surrenderMitigation = proceeding.history.some((entry) => entry.action === "voluntarySurrender") ? 3 : 0;
    const mitigation = submission.mitigation + counselMitigation(proceeding) + surrenderMitigation + proceeding.court.judge.libertyPreference / 25;
    const adjusted = riskScore - mitigation + proceeding.court.judge.proceduralStrictness / 30 + (proceeding.firstAppearance.discretion - 0.5) * 2;
    let decision = "detained";
    if (adjusted <= 7 && submission.id === "recognizance") decision = "recognizance";
    else if (adjusted <= 15) decision = "conditionalRelease";
    else if (adjusted <= 24) decision = "securedBail";
    const reasons = [
      `${remaining.length} supported filed charge(s) contributed ${Math.round(chargeWeight)} severity points.`,
      `Cited support contributed ${Math.round(supportWeight)} evidentiary-risk points.`,
      `${submission.label}, counsel capacity, and judicial liberty preference supplied ${Math.round(mitigation)} mitigation points.`,
      violence ? "Saved violent-resistance history materially increased danger findings." : "No saved violent-resistance charge increased the danger finding.",
      "The saved judicial-discretion value resolved only the narrow remaining margin."
    ];
    proceeding.firstAppearance.status = "completed"; proceeding.firstAppearance.completedAt = at; proceeding.firstAppearance.decision = decision;
    proceeding.firstAppearance.riskScore = riskScore; proceeding.firstAppearance.mitigationScore = mitigation; proceeding.firstAppearance.reasons = reasons; proceeding.firstAppearance.rejectedChargeIds = rejected.map((charge) => charge.id);
    proceeding.release.orderedAt = at; proceeding.release.kind = decision;
    const conditions = [normalizeCondition({ kind: "appearAsOrdered", label: "Appear at every scheduled court event", imposedAt: at })];
    if (["conditionalRelease", "securedBail"].includes(decision)) conditions.push(normalizeCondition({ kind: "weeklyReporting", label: "Report weekly to pretrial supervision", imposedAt: at }));
    const animancy = remaining.find((charge) => charge.typeId === "prohibitedAnimancy" && charge.support.some((support) => support.significanceRank >= 3));
    if (animancy && decision !== "detained") conditions.push(normalizeCondition({ kind: "courtMagicSuppression", label: "Wear a court-ordered magic suppressor", physicallyEnforced: true, sourceChargeId: animancy.id, imposedAt: at }));
    proceeding.release.conditions = conditions;
    if (decision === "securedBail") {
      proceeding.status = "bailPending"; proceeding.release.status = "awaitingBail"; proceeding.release.escrowStatus = "due";
      proceeding.release.bailAmount = Math.max(500, Math.ceil((riskScore * 175) / 100) * 100);
    } else if (["recognizance", "conditionalRelease"].includes(decision)) {
      proceeding.status = "released"; proceeding.release.status = "released"; proceeding.release.escrowStatus = "none"; proceeding.release.releasedAt = at;
    } else {
      proceeding.status = "detained"; proceeding.release.status = "none";
    }
    proceeding.timeline.discoveryDueAt = at + 24 * HOUR; proceeding.timeline.nextHearingAt = at + 72 * HOUR;
    proceeding.updatedAt = at; proceeding.history.push({ at, action: "firstAppearanceResolved", summary: `The court ordered ${decision}; the saved reasons identify charge, evidence, mitigation, and discretion contributions.` });
    return { state, proceeding, decision, changed: true };
  }

  function payBail(candidate, proceedingId, clock = 0) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    if (!proceeding || proceeding.release.status !== "awaitingBail" || proceeding.release.escrowStatus !== "due") return { state, proceeding, changed: false };
    const at = Math.max(proceeding.release.orderedAt, finite(clock));
    proceeding.release.status = "released"; proceeding.release.escrowStatus = "held"; proceeding.release.escrowPaidAt = at; proceeding.release.releasedAt = at; proceeding.status = "released";
    proceeding.history.push({ at, action: "bailPosted", summary: `${proceeding.release.bailAmount} entered refundable court escrow; it was not recorded as a fine.` });
    return { state, proceeding, changed: true };
  }

  function markReleased(candidate, proceedingId, transport, clock = 0) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    if (!proceeding || proceeding.release.status !== "released") return { state, proceeding, changed: false };
    proceeding.release.transport = transport && typeof transport === "object" ? { ...transport } : null;
    proceeding.updatedAt = Math.max(proceeding.openedAt, finite(clock));
    proceeding.history.push({ at: proceeding.updatedAt, action: "physicallyReleased", summary: "Jail staff removed jail custody equipment and transferred the scientist to the recorded lawful release destination." });
    return { state, proceeding, changed: true };
  }

  function addEscapeCharge(state, proceeding, clock) {
    if (proceeding.charges.some((charge) => charge.typeId === "escapeCustody")) return;
    proceeding.charges.push(normalizeCharge({ id: `criminal-charge-${state.nextChargeNumber++}`, typeId: "escapeCustody", status: "filed", filedAt: clock, publicProbableCause: "The municipal jail custody record reports a physical escape.", support: [{ id: `${proceeding.id}-escape-support`, kind: "jailCustody", sourceId: proceeding.raidId, label: "Saved municipal jail escape record", reliability: "strong", significanceRank: 4, traits: ["escaped custody"] }] }, proceeding.charges.length));
  }

  function markFugitive(candidate, proceedingId, clock = 0) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    if (!proceeding || proceeding.fugitive.active) return { state, proceeding, changed: false };
    const at = Math.max(proceeding.openedAt, finite(clock)); addEscapeCharge(state, proceeding, at);
    proceeding.fugitive.active = true; proceeding.fugitive.escapedAt = at; proceeding.fugitive.benchWarrantStatus = "issued"; proceeding.status = "fugitive";
    if (proceeding.release.escrowStatus === "held") { proceeding.release.escrowStatus = "forfeited"; proceeding.release.status = "forfeited"; }
    proceeding.history.push({ at, action: "fugitiveStatus", summary: "Escape added a separately supported charge and issued a saved bench warrant; the criminal case continued." });
    return { state, proceeding, changed: true };
  }

  function recordFailedEscape(candidate, proceedingId, options = {}) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    if (!proceeding) return { state, proceeding, charge: null, changed: false };
    const attemptId = cleanId(options.attemptId); const existing = proceeding.charges.find((charge) => charge.typeId === "attemptedEscape" && charge.support.some((support) => support.sourceId === attemptId));
    if (existing) return { state, proceeding, charge: existing, changed: false };
    const at = Math.max(proceeding.openedAt, finite(options.clock));
    const charge = normalizeCharge({ id: `criminal-charge-${state.nextChargeNumber++}`, typeId: "attemptedEscape", status: "filed", filedAt: at, publicProbableCause: "Custody officers physically interrupted a saved escape attempt inside municipal holding.", support: [{ id: `${proceeding.id}-attempted-escape-${attemptId}`, kind: "jailCustody", sourceId: attemptId, label: String(options.label || "Recorded failed jail escape attempt"), reliability: "strong", significanceRank: 3, traits: ["attempted escape", "custody officer observation"] }] }, proceeding.charges.length);
    proceeding.charges.push(charge); proceeding.history.push({ at, action: "failedEscapeCharge", summary: `${charge.label} was filed from the physically interrupted attempt ${attemptId}.` });
    return { state, proceeding, charge, changed: true };
  }

  function activeCharges(proceeding) {
    return proceeding.charges.filter((charge) => charge.status === "filed");
  }

  function admissibleSupport(charge) {
    return charge.support.filter((support) => support.admissibility !== "excluded");
  }

  function selectedCounsel(proceeding) {
    return proceeding.counsel.options.find((entry) => entry.id === proceeding.counsel.selectedOptionId) || null;
  }

  function serveDiscovery(candidate, proceedingId, options = {}) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    if (!proceeding || proceeding.discovery.status !== "pending" || !["completed", "missed"].includes(proceeding.firstAppearance.status)) return { state, proceeding, changed: false };
    const at = Math.max(proceeding.timeline.discoveryDueAt || proceeding.openedAt, finite(options.clock));
    const itemBySupportId = new Map();
    for (const charge of activeCharges(proceeding)) {
      for (const support of charge.support) {
        let item = itemBySupportId.get(support.id);
        if (!item) {
          const traitText = support.traits.join(" ").toLowerCase();
          item = normalizeDiscoveryItem({
            id: `${proceeding.id}-discovery-${support.id}`, supportId: support.id, sourceId: support.sourceId, chargeIds: [charge.id], kind: support.kind,
            label: support.label, summary: `${support.label}; ${support.reliability} reliability, significance ${support.significanceRank}.`,
            reliability: support.reliability, significanceRank: support.significanceRank, integrity: support.integrity, scopeStatus: support.scopeStatus,
            custodyIssues: support.custodyIssues, traits: support.traits,
            exculpatory: support.reliability === "weak" || /contradiction|exculpatory|licensed|authorized|lawful|innocent/.test(traitText),
            admissibility: support.admissibility, exclusionReason: support.exclusionReason
          }, itemBySupportId.size);
          itemBySupportId.set(support.id, item);
        } else item.chargeIds = uniqueIds([...item.chargeIds, charge.id]);
        support.disclosed = true;
      }
    }
    const items = [...itemBySupportId.values()];
    const witnessGroups = new Map();
    for (const item of items.filter((entry) => ["raidSeizure", "jailCustody", "courtRecord", "authorityEvidence"].includes(entry.kind))) {
      const label = item.kind === "raidSeizure" ? "Seizing raid officer" : item.kind === "jailCustody" ? "Municipal custody witness" : item.kind === "courtRecord" ? "Court records custodian" : "Authority evidence custodian";
      const group = witnessGroups.get(label) || { id: `${proceeding.id}-witness-${witnessGroups.size + 1}`, label, sourceItemIds: [], disclosed: true };
      group.sourceItemIds.push(item.id); witnessGroups.set(label, group);
    }
    const sourceProtected = items.find((item) => item.kind === "authorityEvidence");
    const withheld = sourceProtected ? [normalizeWithheldItem({
      id: `${proceeding.id}-withheld-source-metadata`, label: `Source-identifying metadata for ${sourceProtected.label}`,
      sourceDiscoveryItemId: sourceProtected.id, reason: "Active-investigation source protection", material: true, privileged: false
    })] : [];
    proceeding.discovery = {
      status: "served", packetId: `${proceeding.id}-discovery-packet-1`, frozenAt: at, servedAt: at, reviewedAt: null,
      serviceRoute: options.serviceRoute && typeof options.serviceRoute === "object" ? { ...options.serviceRoute } : {
        kind: proceeding.fugitive.active ? "counselService" : proceeding.release.status === "released" ? "secureCompanyTerminal" : "jailLegalTerminal",
        destinationRoomId: proceeding.release.status === "released" ? "surfaceStaffOperations" : "municipalHoldingLegalRoom"
      },
      items, witnesses: [...witnessGroups.values()], withheld, amendments: []
    };
    proceeding.history.push({ at, action: "discoveryServed", summary: `${items.length} exact evidence item(s), ${witnessGroups.size} witness category record(s), ${items.filter((item) => item.exculpatory).length} known exculpatory item(s), and ${withheld.length} stated withholding(s) were frozen and served.` });
    return { state, proceeding, packet: proceeding.discovery, changed: true };
  }

  function preparationGain(proceeding, kind) {
    const counsel = selectedCounsel(proceeding);
    const base = kind === "discoveryReview" ? 28 : 18;
    if (!counsel || counsel.kind === "self") return Math.max(8, base - 10);
    return Math.max(10, base + counsel.proceduralSkill / 8 - counsel.workload / 12 + (counsel.specialties.includes("complexEvidence") ? 5 : 0));
  }

  function recordPreparation(candidate, proceedingId, options = {}) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    const kind = cleanId(options.kind) || "casePreparation";
    if (!proceeding || !["served", "reviewed"].includes(proceeding.discovery.status) || proceeding.preparation.sessions.length >= 4) return { state, proceeding, changed: false, reason: proceeding?.preparation.sessions.length >= 4 ? "The four bounded preparation sessions are complete." : "Discovery has not been served." };
    if (kind === "discoveryReview" && proceeding.discovery.status === "reviewed") return { state, proceeding, changed: false, reason: "Discovery has already been reviewed." };
    const at = Math.max(proceeding.discovery.servedAt, finite(options.clock));
    const gain = preparationGain(proceeding, kind);
    const session = normalizePreparationSession({ id: `preparation-session-${state.nextPreparationNumber++}`, kind, at, progress: gain, roomId: options.roomId, counselOptionId: proceeding.counsel.selectedOptionId, summary: options.summary || (kind === "discoveryReview" ? "The scientist and counsel reviewed the frozen discovery packet." : "The defense prepared record-specific pretrial arguments.") });
    proceeding.preparation.sessions.push(session); proceeding.preparation.progress = Math.min(100, proceeding.preparation.progress + gain);
    if (kind === "discoveryReview") { proceeding.discovery.status = "reviewed"; proceeding.discovery.reviewedAt = at; }
    proceeding.history.push({ at, action: kind, summary: `${session.summary} Preparation reached ${Math.round(proceeding.preparation.progress)}%.` });
    return { state, proceeding, session, changed: true };
  }

  function preparationRequirement(proceeding) {
    if (!proceeding) return "No active criminal proceeding.";
    if (proceeding.discovery.status === "pending") return "Discovery has not been served.";
    if (proceeding.discovery.status !== "reviewed") return "Review the served discovery packet before filing.";
    if (["pleaSentencing", "dismissed", "scheduled"].includes(proceeding.trial.status)) return "Pretrial preparation has ended.";
    return "";
  }

  function syncDiscoveryAdmissibility(proceeding, support) {
    const item = proceeding.discovery.items.find((entry) => entry.supportId === support.id);
    if (item) { item.admissibility = support.admissibility; item.exclusionReason = support.exclusionReason; }
  }

  function resolveMotion(candidate, proceedingId, typeId, targetId, options = {}) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    const definition = MOTION_DEFS.find((entry) => entry.id === cleanId(typeId));
    const target = cleanId(targetId);
    const requirement = preparationRequirement(proceeding);
    if (!proceeding || !definition || requirement) return { state, proceeding, changed: false, reason: requirement || "Unknown motion." };
    if (definition.id === "reconsiderCustody" && proceeding.fugitive.active) return { state, proceeding, changed: false, reason: "A fugitive defendant cannot obtain custody reconsideration while remaining at large." };
    if (proceeding.motions.some((motion) => motion.typeId === definition.id && motion.targetId === target)) return { state, proceeding, changed: false, reason: "That record-specific motion has already been resolved." };
    const at = Math.max(proceeding.discovery.reviewedAt, finite(options.clock));
    const counsel = selectedCounsel(proceeding); const capacity = counselMitigation(proceeding) + proceeding.preparation.progress / 10;
    let granted = false; let score = capacity; let opposition = 0; let consequence = ""; const reasons = [];
    if (definition.id === "suppressEvidence") {
      const matchingSupport = proceeding.charges.flatMap((charge) => charge.support).filter((entry) => entry.id === target);
      const support = matchingSupport[0];
      if (!support || support.admissibility === "excluded") return { state, proceeding, changed: false, reason: "The selected evidence support is unavailable or already excluded." };
      score += support.scopeStatus === "outside" ? 14 : support.scopeStatus === "expanded" ? 5 : 0;
      score += support.custodyIssues.length * 4 + (100 - support.integrity) / 9 + (support.reliability === "weak" ? 4 : 0);
      opposition = support.significanceRank * 2 + (support.reliability === "strong" ? 5 : support.reliability === "credible" ? 2 : 0) + proceeding.court.judge.proceduralStrictness / 20;
      granted = score + proceeding.firstAppearance.discretion * 2 > opposition;
      reasons.push(`Scope ${support.scopeStatus}, integrity ${Math.round(support.integrity)}%, ${support.custodyIssues.length} custody issue(s), and ${support.reliability} reliability supplied the record-specific challenge.`);
      if (granted) { for (const linked of matchingSupport) { linked.admissibility = "excluded"; linked.exclusionReason = "Excluded by saved suppression ruling."; syncDiscoveryAdmissibility(proceeding, linked); } consequence = `${support.label} is inadmissible in this case but remains in physical and investigative history.`; }
      else consequence = `${support.label} remains admissible.`;
    } else if (definition.id === "dismissCharge") {
      const charge = proceeding.charges.find((entry) => entry.id === target && entry.status === "filed");
      if (!charge) return { state, proceeding, changed: false, reason: "The selected filed charge is unavailable." };
      const support = admissibleSupport(charge); opposition = support.reduce((total, entry) => total + entry.significanceRank + (entry.reliability === "strong" ? 3 : entry.reliability === "credible" ? 1 : 0), 0);
      granted = support.length === 0 || score > opposition * 1.6 + proceeding.court.judge.proceduralStrictness / 25;
      reasons.push(`${support.length} admissible support item(s) remained after prior rulings.`);
      if (granted) { charge.status = "dismissed"; consequence = `${charge.label} was dismissed without deleting its evidence history.`; }
      else consequence = `${charge.label} remains filed for trial.`;
    } else if (definition.id === "compelDiscovery") {
      const withheld = proceeding.discovery.withheld.find((entry) => entry.id === target && entry.status === "withheld");
      if (!withheld) return { state, proceeding, changed: false, reason: "The selected withholding is unavailable." };
      score += withheld.material ? 8 : 0; opposition = withheld.privileged ? 20 : 5 + proceeding.court.judge.proceduralStrictness / 30;
      granted = withheld.material && !withheld.privileged && score >= opposition;
      withheld.status = granted ? "compelled" : "upheld"; consequence = granted ? `${withheld.label} must be disclosed in an immutable discovery amendment.` : `${withheld.label} remains withheld.`;
      if (granted) proceeding.discovery.amendments.push({ id: `${proceeding.id}-discovery-amendment-${proceeding.discovery.amendments.length + 1}`, at, itemIds: [withheld.sourceDiscoveryItemId], summary: consequence });
      reasons.push(`${withheld.reason}; material ${withheld.material ? "yes" : "no"}; privileged ${withheld.privileged ? "yes" : "no"}.`);
    } else {
      const dismissed = proceeding.charges.filter((charge) => charge.status === "dismissed").length;
      const excluded = proceeding.charges.flatMap((charge) => charge.support).filter((support) => support.admissibility === "excluded").length;
      const remainingRisk = activeCharges(proceeding).reduce((total, charge) => total + charge.weight + admissibleSupport(charge).reduce((sum, support) => sum + support.significanceRank, 0), 0);
      score += dismissed * 5 + excluded * 3 + proceeding.court.judge.libertyPreference / 10; opposition = remainingRisk / 3 + proceeding.court.judge.proceduralStrictness / 20;
      granted = score > opposition;
      reasons.push(`${dismissed} dismissed charge(s), ${excluded} excluded support item(s), and ${Math.round(remainingRisk)} remaining risk were considered.`);
      if (granted) {
        if (proceeding.release.status === "awaitingBail") { proceeding.release.bailAmount = Math.max(500, Math.round(proceeding.release.bailAmount * 0.6 / 100) * 100); consequence = `Secured bail was reduced to ${proceeding.release.bailAmount}.`; }
        else if (proceeding.release.status !== "released") { proceeding.release.status = "released"; proceeding.release.kind = "conditionalRelease"; proceeding.release.releasedAt = at; proceeding.status = "released"; consequence = "Continued detention was replaced with conditional release."; }
        else { const condition = proceeding.release.conditions.find((entry) => entry.kind === "weeklyReporting" && entry.status === "active"); if (condition) condition.status = "lifted"; consequence = condition ? "Weekly reporting was lifted." : "Existing release conditions were left unchanged."; }
        const animancyFiled = activeCharges(proceeding).some((charge) => charge.typeId === "prohibitedAnimancy" && admissibleSupport(charge).some((support) => support.significanceRank >= 3));
        if (!animancyFiled) { const suppressor = proceeding.release.conditions.find((entry) => entry.kind === "courtMagicSuppression" && entry.status === "active"); if (suppressor) suppressor.status = "lifted"; }
      } else consequence = "Current custody and release conditions remain in force.";
    }
    const accessibleCitations = uniqueIds(options.citedItemIds).filter((id) => proceeding.discovery.items.some((item) => item.id === id));
    const motion = normalizeMotion({ id: `pretrial-motion-${state.nextMotionNumber++}`, typeId: definition.id, targetId: target, filedAt: at, resolvedAt: at, status: granted ? "granted" : "denied", score, oppositionScore: opposition, citedItemIds: accessibleCitations, reasons: [...reasons, `Defense score ${Math.round(score)}; opposition score ${Math.round(opposition)}; the judge's stable tendencies and saved discretion resolved the narrow margin.`], consequence });
    proceeding.motions.push(motion); proceeding.history.push({ at, action: `${definition.id}${granted ? "Granted" : "Denied"}`, summary: `${definition.label} was ${motion.status}. ${consequence}` });
    if (!activeCharges(proceeding).length) dismissAllCharges(proceeding, at);
    return { state, proceeding, motion, changed: true };
  }

  function dismissAllCharges(proceeding, at) {
    proceeding.status = "chargesDismissed"; proceeding.trial.status = "dismissed"; proceeding.trial.scheduledAt = at;
    proceeding.release.status = "released"; proceeding.release.kind = "chargesDismissed"; proceeding.release.releasedAt = at;
    if (proceeding.release.escrowStatus === "held") proceeding.release.escrowStatus = "refunded";
    else if (proceeding.release.escrowStatus === "due") proceeding.release.escrowStatus = "none";
    for (const condition of proceeding.release.conditions) if (condition.status === "active") condition.status = "lifted";
    proceeding.history.push({ at, action: "allChargesDismissed", summary: "Every filed charge was dismissed; custody authority and active release conditions ended, while the case record remained intact." });
  }

  function submitDefenseClaim(candidate, proceedingId, typeId, citedItemIds = [], clock = 0) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId)); const definition = CLAIM_DEFS.find((entry) => entry.id === cleanId(typeId));
    const requirement = preparationRequirement(proceeding);
    if (!proceeding || !definition || requirement) return { state, proceeding, changed: false, reason: requirement || "Unknown defense claim." };
    if (proceeding.defenseClaims.some((claim) => claim.typeId === definition.id)) return { state, proceeding, changed: false, reason: "That bounded defense claim has already been made." };
    const cited = uniqueIds(citedItemIds).map((id) => proceeding.discovery.items.find((item) => item.id === id)).filter(Boolean);
    const text = cited.flatMap((item) => [item.label, ...item.traits, item.scopeStatus, ...item.custodyIssues]).join(" ").toLowerCase();
    const supportScore = definition.risky ? 0 : cited.reduce((total, item) => total + item.significanceRank + (definition.patterns.some((pattern) => text.includes(pattern)) ? 3 : 0), 0);
    const strongContrary = activeCharges(proceeding).flatMap(admissibleSupport).filter((support) => support.reliability === "strong" && support.significanceRank >= 3).length;
    const contradictionScore = definition.risky ? strongContrary * 5 : cited.filter((item) => item.reliability === "strong" && !item.exculpatory).length * 2;
    const status = contradictionScore > supportScore ? "contradicted" : supportScore >= 5 ? "supported" : "weak";
    const credibilityDelta = status === "contradicted" ? -15 : status === "supported" ? 5 : -2;
    proceeding.preparation.credibility = Math.max(0, Math.min(100, proceeding.preparation.credibility + credibilityDelta));
    const at = Math.max(proceeding.discovery.reviewedAt, finite(clock));
    const claim = normalizeClaim({ id: `defense-claim-${state.nextClaimNumber++}`, typeId: definition.id, filedAt: at, citedItemIds: cited.map((item) => item.id), supportScore, contradictionScore, credibilityDelta, status, summary: `${definition.label} was recorded as ${status}; ${cited.length} accessible discovery item(s) were cited.` });
    proceeding.defenseClaims.push(claim);
    if (definition.risky && status === "contradicted") {
      const falseCharge = normalizeCharge({ id: `criminal-charge-${state.nextChargeNumber++}`, typeId: "falseStatement", status: "filed", filedAt: at, publicProbableCause: "The saved defense claim materially contradicted strong disclosed court evidence.", support: [{ id: `${proceeding.id}-false-statement-${claim.id}`, kind: "courtRecord", sourceId: claim.id, label: "Contradicted explicit defense statement", reliability: "strong", significanceRank: 3, traits: ["false statement", "court contradiction"] }] }, proceeding.charges.length);
      proceeding.charges.push(falseCharge); claim.summary += ` New charge ${falseCharge.id} was filed from the immutable contradiction.`;
    }
    proceeding.history.push({ at, action: "defenseClaim", summary: claim.summary }); return { state, proceeding, claim, changed: true };
  }

  function createPleaOffer(proceeding, clock) {
    const charges = activeCharges(proceeding); if (!charges.length || proceeding.plea.status !== "none") return false;
    const sorted = [...charges].sort((left, right) => left.weight - right.weight || left.id.localeCompare(right.id));
    const weak = sorted.filter((charge) => admissibleSupport(charge).length === 0 || admissibleSupport(charge).every((support) => support.reliability === "weak"));
    const dismissedChargeIds = weak.slice(0, 1).map((charge) => charge.id);
    const resolutionChargeIds = charges.filter((charge) => !dismissedChargeIds.includes(charge.id)).map((charge) => charge.id);
    const exposure = charges.reduce((total, charge) => total + charge.weight, 0);
    const recommendation = exposure >= 24 ? "custodialCap" : exposure >= 12 ? "shortCustodyOrPenalService" : "supervisedRelease";
    const at = Math.max(proceeding.discovery.reviewedAt, finite(clock));
    proceeding.plea.status = "offered"; proceeding.plea.offer = normalizePleaOffer({ id: `${proceeding.id}-plea-offer-1`, offeredAt: at, expiresAt: at + 72 * HOUR, resolutionChargeIds, dismissedChargeIds, sentencingRecommendation: recommendation, custodyRecommendation: proceeding.release.status === "released" ? "continueRelease" : "continueCurrent", forfeitureAmount: exposure >= 18 ? 1500 : 0, summary: `${proceeding.court.prosecutor.name} offers resolution of ${resolutionChargeIds.length} charge(s), dismissal of ${dismissedChargeIds.length}, and a ${recommendation} recommendation.` });
    proceeding.history.push({ at, action: "pleaOffered", summary: proceeding.plea.offer.summary }); return true;
  }

  function respondToPlea(candidate, proceedingId, action, counterId = "", clock = 0) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId));
    if (!proceeding || proceeding.plea.status !== "offered" || !proceeding.plea.offer) return { state, proceeding, changed: false, reason: "No active plea offer is available." };
    const at = Math.max(proceeding.plea.offer.offeredAt, finite(clock));
    if (at > proceeding.plea.offer.expiresAt) { proceeding.plea.status = "expired"; return { state, proceeding, changed: true, reason: "The plea offer expired." }; }
    if (action === "accept" && proceeding.fugitive.active) return { state, proceeding, changed: false, reason: "A negotiated plea cannot be accepted until the fugitive scientist surrenders and physically appears." };
    proceeding.plea.respondedAt = at;
    if (action === "accept") {
      for (const charge of proceeding.charges) if (proceeding.plea.offer.dismissedChargeIds.includes(charge.id) && charge.status === "filed") charge.status = "dismissed";
      proceeding.plea.status = "accepted"; proceeding.status = "pleaAccepted"; proceeding.trial.status = "pleaSentencing"; proceeding.trial.scheduledAt = at;
      proceeding.trial.handoff = trialHandoff(proceeding); proceeding.history.push({ at, action: "pleaAccepted", summary: "The binding plea was accepted and awaits the separate sentencing system." });
      return { state, proceeding, accepted: true, changed: true };
    }
    if (action === "reject") {
      proceeding.plea.status = "rejected"; proceeding.history.push({ at, action: "pleaRejected", summary: "The defense rejected the prosecution offer and preserved every contested issue for trial." });
      return { state, proceeding, accepted: false, changed: true };
    }
    const counter = COUNTER_DEFS.find((entry) => entry.id === cleanId(counterId));
    if (!counter || proceeding.plea.counterId) return { state, proceeding, changed: false, reason: "Select one unused bounded counteroffer." };
    proceeding.plea.counterId = counter.id;
    const weakness = proceeding.charges.flatMap((charge) => charge.support).filter((support) => support.admissibility === "excluded" || support.reliability === "weak").length * 2;
    const defense = weakness + counselMitigation(proceeding) + proceeding.preparation.progress / 12 + proceeding.preparation.credibility / 25;
    const prosecution = counter.difficulty + activeCharges(proceeding).reduce((total, charge) => total + admissibleSupport(charge).length, 0);
    const accepted = defense > prosecution;
    proceeding.plea.reasons = [`Defense counter score ${Math.round(defense)}; prosecution resistance ${Math.round(prosecution)}.`];
    if (accepted) {
      if (counter.id === "dropLowestCharge") { const lowest = activeCharges(proceeding).sort((a, b) => a.weight - b.weight)[0]; if (lowest) { proceeding.plea.offer.dismissedChargeIds = uniqueIds([...proceeding.plea.offer.dismissedChargeIds, lowest.id]); proceeding.plea.offer.resolutionChargeIds = proceeding.plea.offer.resolutionChargeIds.filter((id) => id !== lowest.id); } }
      if (counter.id === "lenientCustody") proceeding.plea.offer.sentencingRecommendation = "supervisedRelease";
      if (counter.id === "noForfeiture") proceeding.plea.offer.forfeitureAmount = 0;
      proceeding.plea.status = "offered"; proceeding.history.push({ at, action: "pleaCounterAccepted", summary: `${counter.label} was accepted; the revised offer still requires a separate accept action.` });
    } else { proceeding.plea.status = "rejected"; proceeding.history.push({ at, action: "pleaCounterRejected", summary: `${counter.label} was rejected and the offer closed.` }); }
    return { state, proceeding, accepted, changed: true };
  }

  function trialHandoff(proceeding) {
    return {
      remainingChargeIds: activeCharges(proceeding).map((charge) => charge.id),
      admissibleSupportIds: activeCharges(proceeding).flatMap(admissibleSupport).map((support) => support.id),
      excludedSupportIds: proceeding.charges.flatMap((charge) => charge.support).filter((support) => support.admissibility === "excluded").map((support) => support.id),
      motionIds: proceeding.motions.map((motion) => motion.id), defenseClaimIds: proceeding.defenseClaims.map((claim) => claim.id),
      witnessIds: proceeding.discovery.witnesses.map((witness) => witness.id), preparation: proceeding.preparation.progress,
      credibility: proceeding.preparation.credibility, counselOptionId: proceeding.counsel.selectedOptionId,
      custodyStatus: proceeding.fugitive.active ? "fugitive" : proceeding.release.status === "released" ? "released" : "detained",
      releaseConditionIds: proceeding.release.conditions.filter((condition) => condition.status === "active").map((condition) => condition.id),
      pleaStatus: proceeding.plea.status, discoveryPacketId: proceeding.discovery.packetId
    };
  }

  function scheduleTrial(candidate, proceedingId, clock = 0) {
    const state = normalizeState(candidate); const proceeding = state.proceedings.find((entry) => entry.id === cleanId(proceedingId)); const requirement = preparationRequirement(proceeding);
    if (!proceeding || requirement || !activeCharges(proceeding).length || proceeding.plea.status === "accepted") return { state, proceeding, changed: false, reason: requirement || "The case cannot be scheduled for trial." };
    const at = Math.max(proceeding.discovery.reviewedAt, finite(clock)); const trialAt = at + (7 + Math.min(7, activeCharges(proceeding).length)) * 24 * HOUR;
    proceeding.trial = { status: "scheduled", scheduledAt: at, trialAt, appearanceRequired: true, handoff: trialHandoff(proceeding) };
    proceeding.status = proceeding.fugitive.active ? "fugitive" : "trialScheduled";
    proceeding.history.push({ at, action: "trialScheduled", summary: `Trial was scheduled with ${activeCharges(proceeding).length} remaining charge(s), ${proceeding.trial.handoff.admissibleSupportIds.length} admissible support item(s), and an explicit physical-appearance requirement.` });
    return { state, proceeding, changed: true };
  }

  function markFailureToAppear(state, proceeding, clock) {
    if (proceeding.charges.some((charge) => charge.typeId === "failureToAppear")) return false;
    proceeding.charges.push(normalizeCharge({ id: `criminal-charge-${state.nextChargeNumber++}`, typeId: "failureToAppear", status: "filed", filedAt: clock, publicProbableCause: "The defendant did not appear at the scheduled first appearance.", support: [{ id: `${proceeding.id}-fta-support`, kind: "courtRecord", sourceId: proceeding.id, label: "Saved missed court appearance", reliability: "strong", significanceRank: 3, traits: ["failure to appear"] }] }, proceeding.charges.length));
    proceeding.fugitive.failureToAppearAt = clock; proceeding.firstAppearance.status = "missed"; proceeding.history.push({ at: clock, action: "failureToAppear", summary: "The fugitive defendant missed a required appearance; the court record added a separate charge without pretending the defendant attended." }); return true;
  }

  function advance(candidate, clock = 0) {
    const state = normalizeState(candidate); let changes = 0;
    for (const proceeding of state.proceedings.filter((entry) => entry.status !== "resolved")) {
      const at = Math.max(proceeding.openedAt, finite(clock));
      if (proceeding.charges.some((charge) => charge.status === "proposed") && at >= proceeding.timeline.chargingAt) { fileCharges(proceeding, proceeding.timeline.chargingAt); changes += 1; }
      if (!proceeding.counsel.selectedOptionId && at >= proceeding.timeline.counselDeadline) {
        const publicOption = proceeding.counsel.options.find((entry) => entry.kind === "public");
        proceeding.counsel.selectedOptionId = publicOption.id; proceeding.counsel.selectedAt = proceeding.timeline.counselDeadline; proceeding.counsel.paid = true;
        proceeding.history.push({ at: proceeding.timeline.counselDeadline, action: "publicCounselAppointed", summary: `${publicOption.name} was automatically appointed when the counsel-selection deadline expired.` }); changes += 1;
      }
      if (["counselSelection", "chargingPending", "fugitive"].includes(proceeding.status) && at >= proceeding.timeline.firstAppearanceAt && proceeding.charges.some((charge) => charge.status === "filed")) {
        proceeding.firstAppearance.status = "ready"; proceeding.status = proceeding.fugitive.active ? "fugitive" : "firstAppearanceReady"; changes += 1;
      }
      if (proceeding.fugitive.active && proceeding.firstAppearance.status === "ready" && at >= proceeding.timeline.firstAppearanceAt) changes += markFailureToAppear(state, proceeding, at) ? 1 : 0;
      if (proceeding.discovery.status === "pending" && proceeding.timeline.discoveryDueAt != null && at >= proceeding.timeline.discoveryDueAt && ["completed", "missed"].includes(proceeding.firstAppearance.status)) {
        const served = serveDiscovery(state, proceeding.id, { clock: proceeding.timeline.discoveryDueAt });
        Object.assign(state, served.state); changes += served.changed ? 1 : 0;
      }
      const currentProceeding = state.proceedings.find((entry) => entry.id === proceeding.id) || proceeding;
      if (currentProceeding.discovery.status === "reviewed" && currentProceeding.plea.status === "none" && activeCharges(currentProceeding).length) changes += createPleaOffer(currentProceeding, at) ? 1 : 0;
      if (currentProceeding.plea.status === "offered" && currentProceeding.plea.offer?.expiresAt < at) { currentProceeding.plea.status = "expired"; currentProceeding.history.push({ at: currentProceeding.plea.offer.expiresAt, action: "pleaExpired", summary: "The prosecution plea offer expired without acceptance." }); changes += 1; }
      proceeding.updatedAt = at;
    }
    return { state, changes };
  }

  function nextEvent(candidate, clock = 0) {
    const at = finite(clock); const events = [];
    for (const proceeding of normalizeState(candidate).proceedings.filter((entry) => entry.status !== "resolved")) {
      if (proceeding.status === "chargingPending" && proceeding.timeline.chargingAt >= at) events.push({ proceedingId: proceeding.id, at: proceeding.timeline.chargingAt, kind: "charging", label: "Charges filed" });
      if (!proceeding.counsel.selectedOptionId && proceeding.timeline.counselDeadline >= at) events.push({ proceedingId: proceeding.id, at: proceeding.timeline.counselDeadline, kind: "counselDeadline", label: "Counsel appointment deadline" });
      if (!["completed", "missed"].includes(proceeding.firstAppearance.status) && proceeding.timeline.firstAppearanceAt >= at) events.push({ proceedingId: proceeding.id, at: proceeding.timeline.firstAppearanceAt, kind: "firstAppearance", label: "First appearance" });
      if (proceeding.discovery.status === "pending" && proceeding.timeline.discoveryDueAt != null && proceeding.timeline.discoveryDueAt >= at) events.push({ proceedingId: proceeding.id, at: proceeding.timeline.discoveryDueAt, kind: "discovery", label: "Discovery service due" });
      if (proceeding.plea.status === "offered" && proceeding.plea.offer?.expiresAt >= at) events.push({ proceedingId: proceeding.id, at: proceeding.plea.offer.expiresAt, kind: "pleaDeadline", label: "Plea offer expires" });
      if (proceeding.trial.status === "scheduled" && proceeding.trial.trialAt >= at) events.push({ proceedingId: proceeding.id, at: proceeding.trial.trialAt, kind: "trial", label: "Criminal trial" });
    }
    return events.sort((left, right) => left.at - right.at || left.proceedingId.localeCompare(right.proceedingId))[0] || null;
  }

  return Object.freeze({
    VERSION, STATUSES, COUNSEL_KINDS, SUBMISSIONS, MOTION_DEFS, CLAIM_DEFS, COUNTER_DEFS, CHARGE_DEFS,
    defaultState, normalizeState, normalizeProceeding, open, current, selectCounsel, markCounselPaid,
    recordConference, hearingRequirements, beginHearing, resolveHearing, payBail, markReleased, markFugitive, recordFailedEscape,
    serveDiscovery, recordPreparation, preparationRequirement, resolveMotion, submitDefenseClaim, createPleaOffer, respondToPlea, scheduleTrial, trialHandoff,
    advance, nextEvent
  });
}));
