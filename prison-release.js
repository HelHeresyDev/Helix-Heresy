(function attachHelixPrisonRelease(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixPrisonRelease = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixPrisonRelease() {
  "use strict";

  const VERSION = 1;
  const HOUR = 3600;
  const DAY = 24 * HOUR;
  const REVIEW_ARGUMENTS = Object.freeze([
    { id: "rehabilitation", label: "Demonstrated Rehabilitation", description: "Emphasize program participation, work, and improved institutional standing." },
    { id: "exceptionalConduct", label: "Exceptional Conduct", description: "Emphasize a clean disciplinary record and sustained compliance." },
    { id: "verifiedReleasePlan", label: "Verified Outside Plan", description: "Emphasize stable housing, work, sponsorship, and supervision arrangements." },
    { id: "capacityPressure", label: "Capacity and Proportionality", description: "Emphasize institutional overcrowding after sufficient sentence service." }
  ]);
  const GIVEN_NAMES = Object.freeze(["Alia", "Bren", "Cato", "Dessa", "Emil", "Fara", "Galen", "Hana", "Isen", "Jessa"]);
  const SURNAMES = Object.freeze(["Arden", "Bex", "Corvin", "Dale", "Eris", "Fenn", "Grove", "Hale", "Ives", "Juno"]);

  function finite(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
  function cleanId(value) { return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, ""); }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, finite(value))); }
  function round(value) { return Math.round(finite(value) * 100) / 100; }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function hash(seed) { let value = 2166136261; for (const character of String(seed || "release")) { value ^= character.charCodeAt(0); value = Math.imul(value, 16777619); } return value >>> 0; }
  function panelName(seed, index) { return `${GIVEN_NAMES[hash(`${seed}:${index}:given`) % GIVEN_NAMES.length]} ${SURNAMES[hash(`${seed}:${index}:surname`) % SURNAMES.length]}`; }
  function history(candidate) { return (Array.isArray(candidate) ? candidate : []).map((entry) => ({ at: Math.max(0, finite(entry?.at)), action: cleanId(entry?.action) || "updated", summary: String(entry?.summary || "Release record updated.").trim() })).sort((a, b) => a.at - b.at); }

  function eligibilityDelay(months) {
    const termDays = Math.max(30, Math.floor(finite(months, 1) * 30));
    return Math.max(30, Math.min(180, Math.ceil(termDays * 0.2))) * DAY;
  }

  function normalizePanel(candidate, seed = "panel") {
    const members = (Array.isArray(candidate?.members) ? candidate.members : [0, 1, 2].map((index) => ({ id: `${seed}-member-${index + 1}`, name: panelName(seed, index), role: ["reviewChair", "programRepresentative", "publicSafetyRepresentative"][index] }))).map((member, index) => ({ id: cleanId(member?.id) || `${seed}-member-${index + 1}`, name: String(member?.name || panelName(seed, index)).trim(), role: cleanId(member?.role) || "reviewMember" }));
    return { id: cleanId(candidate?.id) || `${seed}-panel`, label: String(candidate?.label || "Correctional Release Review Panel").trim(), members, threshold: Math.max(50, Math.min(85, finite(candidate?.threshold, 64 + hash(`${seed}:threshold`) % 7))) };
  }

  function normalizeInputs(candidate) {
    return {
      sentenceMonths: Math.max(1, Math.min(120, Math.floor(finite(candidate?.sentenceMonths, 1)))), sentenceSeconds: Math.max(DAY, finite(candidate?.sentenceSeconds, DAY)), servedSeconds: Math.max(0, finite(candidate?.servedSeconds)),
      standing: clamp(candidate?.standing, 0, 100), participation: clamp(candidate?.participation, 0, 100), assignmentDays: Math.max(0, Math.floor(finite(candidate?.assignmentDays))), incidentCount: Math.max(0, Math.floor(finite(candidate?.incidentCount))), warningCount: Math.max(0, Math.floor(finite(candidate?.warningCount))),
      cooperativeRelationships: Math.max(0, Math.floor(finite(candidate?.cooperativeRelationships))), trustedRelationships: Math.max(0, Math.floor(finite(candidate?.trustedRelationships))), counselName: String(candidate?.counselName || "Standby release counsel").trim(), counselSkill: clamp(candidate?.counselSkill, 0, 100), counselPreparation: clamp(candidate?.counselPreparation, 0, 100),
      sponsorLabel: String(candidate?.sponsorLabel || "No verified outside sponsor").trim(), sponsorStrength: clamp(candidate?.sponsorStrength, 0, 100), sponsorVerified: Boolean(candidate?.sponsorVerified), facilityPopulation: Math.max(1, Math.floor(finite(candidate?.facilityPopulation, 1))), facilityCapacity: Math.max(1, Math.floor(finite(candidate?.facilityCapacity, 1))), magicSuppressionRequired: Boolean(candidate?.magicSuppressionRequired)
    };
  }

  function factor(id, label, score, reason) { return { id, label, score: round(score), reason: String(reason).trim() }; }

  function assess(record, argumentId, inputCandidate) {
    const inputs = normalizeInputs(inputCandidate); const argument = REVIEW_ARGUMENTS.find((entry) => entry.id === argumentId) || REVIEW_ARGUMENTS[0];
    const servedFraction = clamp(inputs.servedSeconds / inputs.sentenceSeconds, 0, 1); const overcrowding = Math.max(0, inputs.facilityPopulation / inputs.facilityCapacity - 1);
    const factors = [
      factor("standing", "Institutional standing", inputs.standing * 0.25, `${round(inputs.standing)} standing from the saved discipline record.`),
      factor("participation", "Work and program participation", inputs.participation * 0.15, `${round(inputs.participation)} participation with ${inputs.assignmentDays} completed assignment day(s).`),
      factor("service", "Sustained sentence service", Math.min(10, inputs.assignmentDays / Math.max(1, (record.eligibility.eligibleAt - record.openedAt) / DAY) * 10), `${inputs.assignmentDays} routine day(s) completed before review.`),
      factor("discipline", "Disciplinary record", Math.max(-8, 10 - inputs.incidentCount * 5 - inputs.warningCount * 1.5), `${inputs.incidentCount} incident(s) and ${inputs.warningCount} warning(s) remain in the immutable prison record.`),
      factor("timeServed", "Proportion served", Math.min(10, servedFraction * 20), `${round(servedFraction * 100)}% of the finite term has been served.`),
      factor("relationships", "Institutional relationships", Math.min(6, inputs.cooperativeRelationships + inputs.trustedRelationships * 2), `${inputs.cooperativeRelationships} cooperative and ${inputs.trustedRelationships} trusted prisoner relationship(s).`),
      factor("capacity", "Institutional capacity pressure", Math.min(8, overcrowding * 40), `${inputs.facilityPopulation}/${inputs.facilityCapacity} strategic institutional population.`),
      factor("counsel", "Release presentation", inputs.counselSkill * 0.05 + inputs.counselPreparation * 0.03, `${inputs.counselName}: skill ${round(inputs.counselSkill)}, preparation ${round(inputs.counselPreparation)}.`),
      factor("sponsor", "Verified outside plan", inputs.sponsorVerified ? inputs.sponsorStrength * 0.08 : 0, `${inputs.sponsorLabel}: ${inputs.sponsorVerified ? "verified" : "not verified"}, strength ${round(inputs.sponsorStrength)}.`),
      factor("severity", "Sentence severity", -Math.min(12, inputs.sentenceMonths / 10), `${inputs.sentenceMonths}-month original sentence remains a proportionality constraint.`)
    ];
    let argumentScore = 0; let argumentReason = "The selected argument has limited support in the frozen record.";
    if (argument.id === "rehabilitation") { argumentScore = Math.min(10, (inputs.standing + inputs.participation) / 20); argumentReason = "Standing and participation support the rehabilitation argument."; }
    else if (argument.id === "exceptionalConduct") { argumentScore = Math.max(0, 10 - inputs.incidentCount * 4 - inputs.warningCount); argumentReason = "The exact warning and incident record controls the exceptional-conduct argument."; }
    else if (argument.id === "verifiedReleasePlan") { argumentScore = inputs.sponsorVerified ? inputs.sponsorStrength * 0.1 : 0; argumentReason = "The outside sponsor was evaluated from the saved company and counsel record."; }
    else if (argument.id === "capacityPressure") { argumentScore = Math.min(10, overcrowding * 50 + servedFraction * 10); argumentReason = "Overcrowding and the proportion already served support the capacity argument."; }
    factors.push(factor("argument", argument.label, argumentScore, argumentReason));
    const total = round(factors.reduce((sum, entry) => sum + entry.score, 0)); const approved = total >= record.panel.threshold;
    return { argumentId: argument.id, inputs, factors, total, threshold: record.panel.threshold, approved, summary: approved ? `${record.panel.label} approved supervised release at ${total} against a ${record.panel.threshold} threshold.` : `${record.panel.label} denied release at ${total} against a ${record.panel.threshold} threshold.` };
  }

  function normalizeApplication(candidate, index = 0) {
    const filedAt = Math.max(0, finite(candidate?.filedAt)); const frozen = candidate?.frozen && typeof candidate.frozen === "object" ? clone(candidate.frozen) : null;
    return { id: cleanId(candidate?.id) || `release-application-${index + 1}`, argumentId: REVIEW_ARGUMENTS.some((entry) => entry.id === candidate?.argumentId) ? candidate.argumentId : "rehabilitation", filedAt, hearingAt: Math.max(filedAt, finite(candidate?.hearingAt, filedAt + 2 * HOUR)), resolvedAt: candidate?.resolvedAt == null ? null : Math.max(filedAt, finite(candidate.resolvedAt)), status: ["filed", "approved", "denied"].includes(candidate?.status) ? candidate.status : "filed", frozen, decision: candidate?.decision && typeof candidate.decision === "object" ? clone(candidate.decision) : null };
  }

  function normalizeRecord(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {}; const openedAt = Math.max(0, finite(source.openedAt)); const sentenceMonths = Math.max(1, Math.min(120, Math.floor(finite(source.sentenceMonths, 1)))); const seed = cleanId(source.id) || `prison-release-${index + 1}`;
    return {
      id: seed, stayId: cleanId(source.stayId), caseId: cleanId(source.caseId), orderId: cleanId(source.orderId), docket: String(source.docket || "Finite prison release").trim(), openedAt, sentenceMonths, sentenceReleaseAt: Math.max(openedAt + DAY, finite(source.sentenceReleaseAt, openedAt + sentenceMonths * 30 * DAY)),
      eligibility: { eligibleAt: Math.max(openedAt, finite(source.eligibility?.eligibleAt, openedAt + eligibilityDelay(sentenceMonths))), nextReviewAt: Math.max(openedAt, finite(source.eligibility?.nextReviewAt, source.eligibility?.eligibleAt || openedAt + eligibilityDelay(sentenceMonths))), notifiedAt: source.eligibility?.notifiedAt == null ? null : Math.max(openedAt, finite(source.eligibility.notifiedAt)), formula: "max(30 days, min(180 days, 20% of sentence))" },
      panel: normalizePanel(source.panel, seed), applications: (Array.isArray(source.applications) ? source.applications : []).map(normalizeApplication), authorization: source.authorization && typeof source.authorization === "object" ? { kind: cleanId(source.authorization.kind), authorizedAt: Math.max(openedAt, finite(source.authorization.authorizedAt)), effectiveAt: Math.max(openedAt, finite(source.authorization.effectiveAt)), applicationId: cleanId(source.authorization.applicationId), remainingSentenceSeconds: Math.max(0, finite(source.authorization.remainingSentenceSeconds)), conditions: Array.isArray(source.authorization.conditions) ? source.authorization.conditions.map((entry) => ({ id: cleanId(entry?.id), kind: cleanId(entry?.kind), label: String(entry?.label || "Release condition").trim(), physicallyEnforced: Boolean(entry?.physicallyEnforced) })) : [] } : null,
      discharge: { status: ["none", "queued", "inTransit", "completed"].includes(source.discharge?.status) ? source.discharge.status : "none", queuedAt: source.discharge?.queuedAt == null ? null : Math.max(openedAt, finite(source.discharge.queuedAt)), departedAt: source.discharge?.departedAt == null ? null : Math.max(openedAt, finite(source.discharge.departedAt)), completedAt: source.discharge?.completedAt == null ? null : Math.max(openedAt, finite(source.discharge.completedAt)), destinationAccessPointId: cleanId(source.discharge?.destinationAccessPointId) || "publicEntrance", destinationRoomId: cleanId(source.discharge?.destinationRoomId) || "surfaceReception", transport: source.discharge?.transport && typeof source.discharge.transport === "object" ? clone(source.discharge.transport) : null, wagesPaid: Math.max(0, Math.floor(finite(source.discharge?.wagesPaid))), returnedPropertyLabels: Array.isArray(source.discharge?.returnedPropertyLabels) ? source.discharge.returnedPropertyLabels.map(String) : [] }, history: history(source.history)
    };
  }

  function defaultState() { return { version: VERSION, records: [], nextRecordNumber: 1, nextApplicationNumber: 1 }; }
  function normalizeState(candidate) { const source = candidate && typeof candidate === "object" ? candidate : {}; const records = (Array.isArray(source.records) ? source.records : []).map(normalizeRecord); return { version: VERSION, records, nextRecordNumber: Math.max(1, Math.floor(finite(source.nextRecordNumber, records.length + 1))), nextApplicationNumber: Math.max(1, Math.floor(finite(source.nextApplicationNumber, 1))) }; }
  function recordForStay(candidate, stayId) { return normalizeState(candidate).records.find((entry) => entry.stayId === cleanId(stayId)) || null; }

  function open(candidate, stay, clock = 0) {
    const state = normalizeState(candidate); const existing = state.records.find((entry) => entry.stayId === cleanId(stay?.id)); if (existing) return { state, record: existing, created: false };
    if (!stay?.id) return { state, record: null, created: false };
    const openedAt = Math.max(0, finite(clock, stay.committedAt)); const id = `prison-release-${state.nextRecordNumber++}`;
    const record = normalizeRecord({ id, stayId: stay.id, caseId: stay.caseId, orderId: stay.orderId, docket: stay.docket, openedAt, sentenceMonths: stay.sentence?.months, sentenceReleaseAt: stay.sentence?.releaseAt, panel: normalizePanel(null, `${id}:${stay.facility?.id || "facility"}`), history: [{ at: openedAt, action: "releaseRecordOpened", summary: "The finite sentence received an exact completion boundary and a future correctional-review eligibility date." }] });
    state.records.push(record); return { state, record, created: true };
  }

  function advance(candidate, stayId, clock = 0) {
    const state = normalizeState(candidate); const record = state.records.find((entry) => entry.stayId === cleanId(stayId)); const at = Math.max(0, finite(clock));
    if (!record) return { state, record, changed: false, event: null };
    if (!record.authorization && record.eligibility.notifiedAt == null && at >= record.eligibility.nextReviewAt) { record.eligibility.notifiedAt = at; const event = { kind: "reviewEligible", at: record.eligibility.nextReviewAt, label: "Correctional release review eligible" }; record.history.push({ at, action: "reviewEligible", summary: `${record.docket} became eligible for a frozen correctional release review.` }); return { state, record, changed: true, event }; }
    return { state, record, changed: false, event: null };
  }

  function fileReview(candidate, recordId, argumentId, inputs, clock = 0) {
    const state = normalizeState(candidate); const record = state.records.find((entry) => entry.id === cleanId(recordId)); const at = Math.max(0, finite(clock));
    if (!record || record.authorization || at < record.eligibility.nextReviewAt || record.applications.some((entry) => entry.status === "filed")) return { state, record, application: null, changed: false, reason: "Release review is not currently available." };
    const frozen = assess(record, argumentId, inputs); const application = normalizeApplication({ id: `release-application-${state.nextApplicationNumber++}`, argumentId: frozen.argumentId, filedAt: at, hearingAt: at + 2 * HOUR, status: "filed", frozen, decision: { approved: frozen.approved, total: frozen.total, threshold: frozen.threshold, summary: frozen.summary } });
    record.applications.push(application); record.history.push({ at, action: "releaseReviewFiled", summary: `${REVIEW_ARGUMENTS.find((entry) => entry.id === application.argumentId).label} filed with frozen prison, counsel, sponsor, and capacity inputs.` }); return { state, record, application, changed: true };
  }

  function resolveReview(candidate, recordId, applicationId, clock = 0) {
    const state = normalizeState(candidate); const record = state.records.find((entry) => entry.id === cleanId(recordId)); const application = record?.applications.find((entry) => entry.id === cleanId(applicationId)); const at = Math.max(0, finite(clock));
    if (!record || !application || application.status !== "filed" || at < application.hearingAt) return { state, record, application, changed: false };
    application.resolvedAt = at; application.status = application.decision.approved ? "approved" : "denied";
    if (application.status === "approved") {
      const remaining = Math.max(0, record.sentenceReleaseAt - at); const conditions = [{ id: `${record.id}-reporting`, kind: "supervisionReporting", label: "Report for correctional supervision", physicallyEnforced: false }, { id: `${record.id}-research-restriction`, kind: "prohibitedResearchRestriction", label: "Do not conduct prohibited research or contraband commerce", physicallyEnforced: false }, { id: `${record.id}-inspection`, kind: "complianceInspection", label: "Submit to lawful compliance inspections", physicallyEnforced: false }];
      if (application.frozen.inputs.magicSuppressionRequired) conditions.push({ id: `${record.id}-magic-suppression`, kind: "courtMagicSuppression", label: "Wear a supervised-release magic suppressor", physicallyEnforced: true });
      record.authorization = { kind: "earnedSupervisedRelease", authorizedAt: at, effectiveAt: at, applicationId: application.id, remainingSentenceSeconds: remaining, conditions };
      record.history.push({ at, action: "releaseApproved", summary: `${application.decision.summary} The remaining custodial term converts to supervised release.` });
    } else {
      const shortfall = application.decision.threshold - application.decision.total; const cooldownDays = shortfall <= 5 ? 30 : shortfall <= 15 ? 60 : 90; record.eligibility.nextReviewAt = at + cooldownDays * DAY; record.eligibility.notifiedAt = null;
      record.history.push({ at, action: "releaseDenied", summary: `${application.decision.summary} A new review may be filed in ${cooldownDays} day(s).` });
    }
    return { state, record, application, changed: true };
  }

  function authorizeCompletion(candidate, recordId, clock = 0) {
    const state = normalizeState(candidate); const record = state.records.find((entry) => entry.id === cleanId(recordId)); const at = Math.max(0, finite(clock));
    if (!record || record.authorization) return { state, record, changed: false };
    record.authorization = { kind: "sentenceCompletion", authorizedAt: at, effectiveAt: at, applicationId: "", remainingSentenceSeconds: 0, conditions: [] }; record.history.push({ at, action: "sentenceCompleted", summary: "The finite sentence completed by its exact court-ordered boundary; discharge is mandatory and nondiscretionary." }); return { state, record, changed: true };
  }

  function queueDischarge(candidate, recordId, clock = 0) { const state = normalizeState(candidate); const record = state.records.find((entry) => entry.id === cleanId(recordId)); if (!record?.authorization || record.discharge.status !== "none") return { state, record, changed: false }; record.discharge.status = "queued"; record.discharge.queuedAt = Math.max(0, finite(clock)); record.history.push({ at: record.discharge.queuedAt, action: "dischargeQueued", summary: "Prison staff queued physical intake discharge and armored reentry transport." }); return { state, record, changed: true }; }
  function beginDischarge(candidate, recordId, clock = 0) { const state = normalizeState(candidate); const record = state.records.find((entry) => entry.id === cleanId(recordId)); if (!record || record.discharge.status !== "queued") return { state, record, changed: false }; record.discharge.status = "inTransit"; record.discharge.departedAt = Math.max(0, finite(clock)); return { state, record, changed: true }; }
  function completeDischarge(candidate, recordId, options = {}, clock = 0) { const state = normalizeState(candidate); const record = state.records.find((entry) => entry.id === cleanId(recordId)); if (!record || !["queued", "inTransit"].includes(record.discharge.status)) return { state, record, changed: false }; const at = Math.max(0, finite(clock)); record.discharge.status = "completed"; record.discharge.completedAt = at; record.discharge.transport = clone(options.transport); record.discharge.wagesPaid = Math.max(0, Math.floor(finite(options.wagesPaid))); record.discharge.returnedPropertyLabels = Array.isArray(options.returnedPropertyLabels) ? options.returnedPropertyLabels.map(String) : []; record.history.push({ at, action: "discharged", summary: `${record.docket}: physical discharge completed to ${record.discharge.destinationAccessPointId}; ${record.discharge.wagesPaid} prison credit(s) were paid out.` }); return { state, record, changed: true }; }

  function nextMilestone(candidate, stayId, clock = 0) {
    const record = recordForStay(candidate, stayId); const at = Math.max(0, finite(clock)); if (!record || record.discharge.status === "completed") return null;
    const filed = record.applications.find((entry) => entry.status === "filed" && entry.hearingAt >= at); if (filed) return { at: filed.hearingAt, kind: "releaseReview", recordId: record.id, applicationId: filed.id, label: "Correctional release review" };
    if (record.authorization) return { at: Math.max(at, record.authorization.effectiveAt), kind: "discharge", recordId: record.id, label: "Prison discharge" };
    const reviewAt = Math.max(record.eligibility.nextReviewAt, at); const releaseAt = Math.max(record.sentenceReleaseAt, at); return reviewAt <= releaseAt ? { at: reviewAt, kind: "reviewEligibility", recordId: record.id, label: "Correctional release review eligibility" } : { at: releaseAt, kind: "sentenceCompletion", recordId: record.id, label: "Finite sentence completion" };
  }

  return Object.freeze({ VERSION, HOUR, DAY, REVIEW_ARGUMENTS, defaultState, normalizeState, normalizeRecord, normalizeInputs, eligibilityDelay, assess, recordForStay, open, advance, fileReview, resolveReview, authorizeCompletion, queueDischarge, beginDischarge, completeDischarge, nextMilestone });
}));
