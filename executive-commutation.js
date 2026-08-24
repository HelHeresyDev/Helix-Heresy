(function attachHelixExecutiveCommutation(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixExecutiveCommutation = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixExecutiveCommutation() {
  "use strict";

  const VERSION = 1;
  const HOUR = 3600;
  const DAY = 24 * HOUR;
  const ADVISORY_DELAY = 2 * DAY;
  const EXECUTIVE_DECISION_DELAY = DAY;
  const APPROVAL_THRESHOLD = 60;
  const MAXIMUM_FINITE_MONTHS = 120;
  const RATIONALES = Object.freeze([
    { id: "publicBenefit", label: "Public Benefit from Legitimate Work", description: "Emphasize verifiable lawful chemistry, filed records, and the public value of continued life." },
    { id: "institutionalCooperation", label: "Demonstrated Institutional Cooperation", description: "Emphasize accepted responses, compliance, paid obligations, and orderly custody conduct." },
    { id: "correctionalPracticality", label: "Bounded Sentence and Administrative Finality", description: "Request the jurisdiction's finite maximum as a definite, administrable alternative to execution." }
  ]);
  const GIVEN = Object.freeze(["Asha", "Cal", "Dane", "Ivo", "Jori", "Mara", "Miko", "Nia", "Oren", "Rian", "Sera", "Tamsin", "Vela"]);
  const FAMILY = Object.freeze(["Aster", "Dunn", "Kade", "Keene", "Morrow", "Pike", "Rusk", "Sloane", "Thorne", "Vale", "Voss", "Ward"]);

  function finite(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
  function round(value) { return Math.round(finite(value) * 100) / 100; }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, finite(value))); }
  function cleanId(value) { return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, ""); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function unique(values) { return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))]; }
  function hash(seed) { let value = 2166136261; for (const character of String(seed || "commutation")) { value ^= character.charCodeAt(0); value = Math.imul(value, 16777619); } return value >>> 0; }
  function actorName(seed, index) { return `${GIVEN[hash(`${seed}:${index}:given`) % GIVEN.length]} ${FAMILY[hash(`${seed}:${index}:family`) % FAMILY.length]}`; }
  function normalizeDecision(value) { return { required: Boolean(value?.required), kind: cleanId(value?.kind), reason: String(value?.reason || "").trim(), raisedAt: value?.raisedAt == null ? null : Math.max(0, finite(value.raisedAt)) }; }
  function normalizeHistory(value) { return (Array.isArray(value) ? value : []).map((entry) => ({ at: Math.max(0, finite(entry?.at)), action: cleanId(entry?.action) || "updated", summary: String(entry?.summary || "Executive commutation updated.").trim() })).sort((left, right) => left.at - right.at); }
  function normalizeOfficial(value, role) { return { id: cleanId(value?.id), name: String(value?.name || role).trim(), role, institutionalPriority: clamp(value?.institutionalPriority ?? 60, 20, 95) }; }

  function normalizeFactor(value) {
    return { id: cleanId(value?.id), label: String(value?.label || "Factor").trim(), score: round(value?.score), reason: String(value?.reason || "Saved submission factor.").trim() };
  }
  function normalizeFrozen(value) {
    if (!value || typeof value !== "object") return null;
    return {
      rationaleId: RATIONALES.some((entry) => entry.id === value.rationaleId) ? value.rationaleId : RATIONALES[0].id,
      targetKind: "maximumFinitePrison", targetMonths: MAXIMUM_FINITE_MONTHS,
      counselName: String(value.counselName || "Capital executive counsel").trim(), counselSkill: clamp(value.counselSkill, 0, 100), legalPreparationDays: Math.max(0, finite(value.legalPreparationDays)),
      companyName: String(value.companyName || "No registered company").trim(), companyCredibility: clamp(value.companyCredibility, 0, 100), lawfulActivityCount: Math.max(0, Math.floor(finite(value.lawfulActivityCount))), filedPeriodCount: Math.max(0, Math.floor(finite(value.filedPeriodCount))),
      acceptedResponseCount: Math.max(0, Math.floor(finite(value.acceptedResponseCount))), adverseActionCount: Math.max(0, Math.floor(finite(value.adverseActionCount))), unpaidPenaltyCount: Math.max(0, Math.floor(finite(value.unpaidPenaltyCount))), complianceScore: clamp(value.complianceScore, 0, 100),
      custodyStanding: clamp(value.custodyStanding, 0, 100), custodyIncidentCount: Math.max(0, Math.floor(finite(value.custodyIncidentCount))), capitalCustodySeconds: Math.max(0, finite(value.capitalCustodySeconds)), offenseExposure: Math.max(0, finite(value.offenseExposure)),
      capitalCaseId: cleanId(value.capitalCaseId), capitalOrderId: cleanId(value.capitalOrderId), counselSessionId: cleanId(value.counselSessionId), frozenAt: Math.max(0, finite(value.frozenAt))
    };
  }
  function normalizeInstrument(value) {
    if (!value || typeof value !== "object") return null;
    return {
      id: cleanId(value.id), kind: "executiveCommutation", issuedAt: Math.max(0, finite(value.issuedAt)), issuedById: cleanId(value.issuedById), issuedByName: String(value.issuedByName || "State Executive").trim(),
      preservesConviction: true, preservesOriginalSentenceRecord: true, replacementKind: "maximumFinitePrison", replacementMonths: MAXIMUM_FINITE_MONTHS, serviceCreditSeconds: Math.max(0, finite(value.serviceCreditSeconds)),
      status: ["transferRequired", "inTransit", "completed", "superseded"].includes(value.status) ? value.status : "transferRequired", convertedCaseId: cleanId(value.convertedCaseId), prisonStayId: cleanId(value.prisonStayId), reasons: unique(value.reasons)
    };
  }
  function normalizeRecord(value, index = 0) {
    const source = value && typeof value === "object" ? value : {}; const openedAt = Math.max(0, finite(source.openedAt));
    return {
      id: cleanId(source.id) || `commutation-record-${index + 1}`, stayId: cleanId(source.stayId), predecessorCaseId: cleanId(source.predecessorCaseId), originalOrderId: cleanId(source.originalOrderId), docket: String(source.docket || "Capital commutation").trim(), openedAt,
      office: { id: cleanId(source.office?.id) || `executive-office-${index + 1}`, label: String(source.office?.label || "State Executive Office").trim(), executive: normalizeOfficial(source.office?.executive, "stateExecutive"), advisors: (Array.isArray(source.office?.advisors) ? source.office.advisors : []).map((entry, advisorIndex) => normalizeOfficial(entry, advisorIndex === 0 ? "executiveLegalAdvisor" : "correctionalPolicyAdvisor")) },
      status: ["available", "filed", "recommended", "granted", "denied", "moot"].includes(source.status) ? source.status : "available",
      petition: { filedAt: source.petition?.filedAt == null ? null : Math.max(openedAt, finite(source.petition.filedAt)), advisoryAt: source.petition?.advisoryAt == null ? null : Math.max(openedAt, finite(source.petition.advisoryAt)), decisionAt: source.petition?.decisionAt == null ? null : Math.max(openedAt, finite(source.petition.decisionAt)), frozen: normalizeFrozen(source.petition?.frozen), factors: (Array.isArray(source.petition?.factors) ? source.petition.factors : []).map(normalizeFactor), score: round(source.petition?.score), threshold: APPROVAL_THRESHOLD },
      advisory: source.advisory && typeof source.advisory === "object" ? { status: ["recommendGrant", "recommendDeny"].includes(source.advisory.status) ? source.advisory.status : "recommendDeny", enteredAt: Math.max(openedAt, finite(source.advisory.enteredAt)), summary: String(source.advisory.summary || "The advisory council entered its recommendation.").trim(), reasons: unique(source.advisory.reasons) } : null,
      outcome: source.outcome && typeof source.outcome === "object" ? { kind: source.outcome.kind === "granted" ? "granted" : "denied", decidedAt: Math.max(openedAt, finite(source.outcome.decidedAt)), summary: String(source.outcome.summary || "The executive entered a written decision.").trim(), reasons: unique(source.outcome.reasons) } : null,
      execution: { stayed: Boolean(source.execution?.stayed), stayedAt: source.execution?.stayedAt == null ? null : Math.max(openedAt, finite(source.execution.stayedAt)), stayKind: cleanId(source.execution?.stayKind), liftedAt: source.execution?.liftedAt == null ? null : Math.max(openedAt, finite(source.execution.liftedAt)), cancelledAt: source.execution?.cancelledAt == null ? null : Math.max(openedAt, finite(source.execution.cancelledAt)) },
      renewal: { ordinaryPetitionUsed: Boolean(source.renewal?.ordinaryPetitionUsed), status: cleanId(source.renewal?.status) || "ordinaryAvailable", qualifyingChangeKinds: unique(source.renewal?.qualifyingChangeKinds || ["newInstitutionalSponsor", "majorPublicPressureChange", "extraordinaryPublicService", "newExecutiveAdministration"]) },
      instrument: normalizeInstrument(source.instrument), decision: normalizeDecision(source.decision), history: normalizeHistory(source.history)
    };
  }

  function defaultState() { return { version: VERSION, records: [], nextRecordNumber: 1, nextInstrumentNumber: 1 }; }
  function normalizeState(value) { const source = value && typeof value === "object" ? value : {}; const records = (Array.isArray(source.records) ? source.records : []).map(normalizeRecord); return { version: VERSION, records, nextRecordNumber: Math.max(1, Math.floor(finite(source.nextRecordNumber, records.length + 1))), nextInstrumentNumber: Math.max(1, Math.floor(finite(source.nextInstrumentNumber, 1))) }; }
  function recordForStay(value, stayId) { return normalizeState(value).records.find((record) => record.stayId === cleanId(stayId)) || null; }

  function open(value, options = {}) {
    const state = normalizeState(value); const stayId = cleanId(options.stayId); const existing = state.records.find((record) => record.stayId === stayId); if (existing) return { state, record: existing, created: false };
    const id = `commutation-record-${state.nextRecordNumber++}`; const seed = `${options.seed || "world"}:${id}`; const openedAt = Math.max(0, finite(options.clock));
    const record = normalizeRecord({ id, stayId, predecessorCaseId: options.caseRecord?.id, originalOrderId: options.caseRecord?.sentencing?.order?.id, docket: options.caseRecord?.docket, openedAt, office: { id: `${id}-office`, label: "State Executive Office", executive: { id: `${id}-executive`, name: actorName(seed, 0), institutionalPriority: 62 + hash(`${seed}:executive`) % 18 }, advisors: [{ id: `${id}-advisor-1`, name: actorName(seed, 1), institutionalPriority: 55 + hash(`${seed}:legal`) % 25 }, { id: `${id}-advisor-2`, name: actorName(seed, 2), institutionalPriority: 55 + hash(`${seed}:corrections`) % 25 }] }, history: [{ at: openedAt, action: "executiveOfficeAssigned", summary: "A named executive authority and advisory council were saved for any ordinary capital commutation petition." }] });
    state.records.push(record); return { state, record, created: true };
  }

  function availability(record, context = {}) {
    if (!record || record.status !== "available" || record.renewal.ordinaryPetitionUsed) return { available: false, reasons: ["The ordinary executive petition has already been used or is no longer available."] };
    const reasons = []; if (!context.automaticReviewResolved) reasons.push("Automatic capital review must produce its written decision first."); if (!context.counselSessionId) reasons.push("A completed privileged capital-counsel session is required before filing.");
    return { available: reasons.length === 0, reasons };
  }

  function scoreSubmission(frozen) {
    const rationale = RATIONALES.find((entry) => entry.id === frozen.rationaleId) || RATIONALES[0]; const factors = [];
    factors.push({ id: "companyCredibility", label: "Verified company credibility", score: clamp(frozen.companyCredibility * 0.3, 0, 30), reason: `${frozen.companyName} had frozen cover credibility ${round(frozen.companyCredibility)}.` });
    if (rationale.id === "publicBenefit") factors.push({ id: "rationale", label: rationale.label, score: clamp(frozen.lawfulActivityCount * 2 + frozen.filedPeriodCount * 3, 0, 24), reason: `${frozen.lawfulActivityCount} recent lawful record(s) and ${frozen.filedPeriodCount} filed period(s) supported the public-benefit submission.` });
    if (rationale.id === "institutionalCooperation") factors.push({ id: "rationale", label: rationale.label, score: clamp(frozen.acceptedResponseCount * 6 + frozen.complianceScore * 0.18, 0, 24), reason: `${frozen.acceptedResponseCount} accepted response(s) and frozen compliance ${round(frozen.complianceScore)} supported cooperation.` });
    if (rationale.id === "correctionalPracticality") factors.push({ id: "rationale", label: rationale.label, score: 20, reason: "The requested replacement is the disclosed ten-year finite maximum, not indefinite confinement or release." });
    factors.push({ id: "counsel", label: "Executive counsel presentation", score: clamp(frozen.counselSkill * 0.1, 0, 10), reason: `${frozen.counselName} had frozen procedural skill ${round(frozen.counselSkill)}.` });
    factors.push({ id: "preparation", label: "Capital legal preparation", score: clamp(frozen.legalPreparationDays * 2, 0, 10), reason: `${round(frozen.legalPreparationDays)} day(s) of capital legal preparation were frozen.` });
    factors.push({ id: "custody", label: "Capital-custody conduct", score: clamp(frozen.custodyStanding * 0.08 - frozen.custodyIncidentCount * 4, -12, 8), reason: `Custody standing was ${round(frozen.custodyStanding)} with ${frozen.custodyIncidentCount} saved incident(s).` });
    factors.push({ id: "penalties", label: "Unresolved institutional obligations", score: -clamp(frozen.unpaidPenaltyCount * 8 + frozen.adverseActionCount * 4, 0, 28), reason: `${frozen.unpaidPenaltyCount} unpaid penalty record(s) and ${frozen.adverseActionCount} adverse institutional action(s) remained frozen.` });
    factors.push({ id: "offense", label: "Capital offense severity", score: -clamp((frozen.offenseExposure - 28) * 1.1, 0, 22), reason: `The preserved capital judgment had net exposure ${round(frozen.offenseExposure)}; commutation does not relitigate it.` });
    return { factors: factors.map(normalizeFactor), score: round(factors.reduce((total, factor) => total + factor.score, 0)), threshold: APPROVAL_THRESHOLD };
  }

  function filePetition(value, recordId, options = {}, clock = 0) {
    const state = normalizeState(value); const record = state.records.find((entry) => entry.id === cleanId(recordId)); const at = Math.max(0, finite(clock)); const allowed = availability(record, options);
    if (!allowed.available || !RATIONALES.some((entry) => entry.id === options.rationaleId)) return { state, record, changed: false, reason: allowed.reasons[0] || "A recognized primary rationale is required." };
    const frozen = normalizeFrozen({ ...options.inputs, rationaleId: options.rationaleId, targetKind: "maximumFinitePrison", targetMonths: MAXIMUM_FINITE_MONTHS, counselSessionId: options.counselSessionId, frozenAt: at }); const scoring = scoreSubmission(frozen);
    record.status = "filed"; record.petition = { filedAt: at, advisoryAt: at + ADVISORY_DELAY, decisionAt: at + ADVISORY_DELAY + EXECUTIVE_DECISION_DELAY, frozen, factors: scoring.factors, score: scoring.score, threshold: APPROVAL_THRESHOLD }; record.execution = { stayed: true, stayedAt: at, stayKind: "acceptedExecutivePetition", liftedAt: null, cancelledAt: null }; record.renewal.ordinaryPetitionUsed = true; record.renewal.status = "pending"; record.decision = { required: true, kind: "commutationPetitionAccepted", reason: `The State Executive Office accepted the one ordinary petition and administratively stayed execution. Advisory recommendation is due at ${record.petition.advisoryAt}.`, raisedAt: at }; record.history.push({ at, action: "commutationPetitionFiled", summary: `${RATIONALES.find((entry) => entry.id === frozen.rationaleId).label} and the ten-year maximum replacement were frozen at ${round(scoring.score)}/${APPROVAL_THRESHOLD}.` });
    return { state, record, changed: true };
  }
  function clearDecision(value, recordId) { const state = normalizeState(value); const record = state.records.find((entry) => entry.id === cleanId(recordId)); if (!record?.decision.required) return { state, record, changed: false }; record.decision = normalizeDecision({}); return { state, record, changed: true }; }
  function markInstrument(value, recordId, options = {}, clock = 0) { const state = normalizeState(value); const record = state.records.find((entry) => entry.id === cleanId(recordId)); if (!record?.instrument) return { state, record, changed: false }; if (options.status) record.instrument.status = ["transferRequired", "inTransit", "completed", "superseded"].includes(options.status) ? options.status : record.instrument.status; if (options.convertedCaseId) record.instrument.convertedCaseId = cleanId(options.convertedCaseId); if (options.prisonStayId) record.instrument.prisonStayId = cleanId(options.prisonStayId); if (options.serviceCreditSeconds != null) record.instrument.serviceCreditSeconds = Math.max(record.instrument.serviceCreditSeconds, finite(options.serviceCreditSeconds)); record.history.push({ at: Math.max(record.openedAt, finite(clock)), action: "commutationInstrument", summary: String(options.summary || `Executive instrument is now ${record.instrument.status}.`).trim() }); return { state, record, changed: true }; }
  function markMoot(value, recordId, summary = "Judicial relief made the political petition moot.", clock = 0) { const state = normalizeState(value); const record = state.records.find((entry) => entry.id === cleanId(recordId)); if (!record || ["moot", "denied"].includes(record.status) || record.instrument?.status === "completed") return { state, record, changed: false }; const at = Math.max(record.openedAt, finite(clock)); record.status = "moot"; if (record.execution.stayed) record.execution.liftedAt = at; record.execution.stayed = false; if (record.instrument) record.instrument.status = "superseded"; record.renewal.status = "judicialReliefSuperseded"; record.decision = { required: true, kind: "commutationMoot", reason: String(summary).trim(), raisedAt: at }; record.history.push({ at, action: "commutationMoot", summary: record.decision.reason }); return { state, record, changed: true }; }

  function advance(value, clock = 0) {
    const state = normalizeState(value); const at = Math.max(0, finite(clock)); const events = [];
    for (const record of state.records) {
      if (record.status === "filed" && at >= record.petition.advisoryAt) { const recommendGrant = record.petition.score >= APPROVAL_THRESHOLD; record.status = "recommended"; record.advisory = { status: recommendGrant ? "recommendGrant" : "recommendDeny", enteredAt: record.petition.advisoryAt, summary: recommendGrant ? "The executive advisory council recommended granting the frozen ten-year conversion." : "The executive advisory council recommended denying the frozen petition.", reasons: [...record.petition.factors.map((factor) => `${factor.label}: ${round(factor.score)} — ${factor.reason}`), `${round(record.petition.score)} ${recommendGrant ? "met" : "did not meet"} the disclosed ${APPROVAL_THRESHOLD}-point threshold.`] }; record.decision = { required: true, kind: "commutationRecommendation", reason: record.advisory.summary, raisedAt: record.advisory.enteredAt }; record.history.push({ at: record.advisory.enteredAt, action: "advisoryRecommendation", summary: record.advisory.summary }); events.push(record.decision.kind); }
      if (record.status === "recommended" && at >= record.petition.decisionAt) { const granted = record.petition.score >= APPROVAL_THRESHOLD; record.status = granted ? "granted" : "denied"; record.outcome = { kind: granted ? "granted" : "denied", decidedAt: record.petition.decisionAt, summary: granted ? `${record.office.executive.name} commuted the death sentence to the jurisdiction's ten-year finite maximum.` : `${record.office.executive.name} denied the ordinary commutation petition.`, reasons: [...record.advisory.reasons, granted ? "The conviction and original capital sentence record remain preserved; only the punishment is converted." : "A renewed petition requires a genuinely material political change."] }; record.execution.stayed = false; if (granted) { record.execution.cancelledAt = record.outcome.decidedAt; record.renewal.status = "granted"; record.instrument = normalizeInstrument({ id: `executive-instrument-${state.nextInstrumentNumber++}`, issuedAt: record.outcome.decidedAt, issuedById: record.office.executive.id, issuedByName: record.office.executive.name, serviceCreditSeconds: record.petition.frozen.capitalCustodySeconds, reasons: record.outcome.reasons }); } else { record.execution.liftedAt = record.outcome.decidedAt; record.renewal.status = "materialChangeRequired"; } record.decision = { required: true, kind: granted ? "commutationGranted" : "commutationDenied", reason: record.outcome.summary, raisedAt: record.outcome.decidedAt }; record.history.push({ at: record.outcome.decidedAt, action: record.decision.kind, summary: record.outcome.summary }); events.push(record.decision.kind); }
    }
    return { state, events, changed: events.length > 0 };
  }
  function nextEvent(value, clock = 0) { const at = finite(clock); const events = []; for (const record of normalizeState(value).records.filter((entry) => !entry.decision.required)) { if (record.status === "filed") events.push({ at: record.petition.advisoryAt, kind: "commutationRecommendation", recordId: record.id, label: `${record.docket} executive advisory recommendation` }); if (record.status === "recommended") events.push({ at: record.petition.decisionAt, kind: "commutationDecision", recordId: record.id, label: `${record.docket} executive commutation decision` }); } return events.filter((event) => event.at >= at).sort((left, right) => left.at - right.at || left.kind.localeCompare(right.kind))[0] || null; }

  return Object.freeze({ VERSION, HOUR, DAY, ADVISORY_DELAY, EXECUTIVE_DECISION_DELAY, APPROVAL_THRESHOLD, MAXIMUM_FINITE_MONTHS, RATIONALES, defaultState, normalizeState, recordForStay, open, availability, scoreSubmission, filePetition, clearDecision, markInstrument, markMoot, advance, nextEvent });
}));
