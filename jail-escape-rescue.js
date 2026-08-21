(function attachHelixJailEscapeRescue(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixJailEscapeRescue = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixJailEscapeRescue() {
  "use strict";

  const VERSION = 1;
  const HOUR = 3600;
  const OBSERVATION_IDS = Object.freeze(["cellDoorProcedure", "suppressionCollar", "surveillanceCoverage", "officerRoutine", "networkControls"]);
  const ROUTE_DEFS = Object.freeze([
    {
      id: "selfTransferBay", label: "Self-Engineered Transfer-Bay Escape", kind: "self",
      requiredObservationIds: ["cellDoorProcedure", "suppressionCollar", "officerRoutine"],
      helpfulObservationIds: ["surveillanceCoverage", "networkControls"], baseRisk: 48,
      description: "Disable the collar, bypass the cell, cross the staffed corridor, and reach the vehicle-transfer exit."
    },
    {
      id: "covertExtraction", label: "Covert Outside Extraction", kind: "contact",
      requiredObservationIds: ["suppressionCollar", "officerRoutine"],
      helpfulObservationIds: ["cellDoorProcedure", "surveillanceCoverage", "networkControls"], baseRisk: 36,
      description: "Meet a named extractor using forged service credentials at the vehicle-transfer bay."
    }
  ]);
  const STAGE_DEFS = Object.freeze({
    selfTransferBay: [
      { id: "disableCollar", label: "Disable the suppressor collar", roomId: "municipalHoldingCell", observationId: "suppressionCollar", durationMinutes: 25 },
      { id: "bypassCell", label: "Bypass the cell-door procedure", roomId: "municipalHoldingCorridor", observationId: "cellDoorProcedure", durationMinutes: 20 },
      { id: "crossSecureCorridor", label: "Cross the secure corridor", roomId: "municipalHoldingGuardStation", observationId: "surveillanceCoverage", durationMinutes: 20 },
      { id: "reachTransferBay", label: "Reach the vehicle-transfer exit", roomId: "municipalHoldingProcessing", observationId: "officerRoutine", durationMinutes: 15 }
    ],
    covertExtraction: [
      { id: "receiveBypassTool", label: "Recover the staged bypass tool", roomId: "municipalHoldingCell", observationId: "networkControls", durationMinutes: 15 },
      { id: "disableCollar", label: "Disable the suppressor collar", roomId: "municipalHoldingCell", observationId: "suppressionCollar", durationMinutes: 20 },
      { id: "bypassCell", label: "Leave the cell during the forged service window", roomId: "municipalHoldingCorridor", observationId: "cellDoorProcedure", durationMinutes: 15 },
      { id: "meetExtractor", label: "Reach the named extractor", roomId: "municipalHoldingProcessing", observationId: "officerRoutine", durationMinutes: 20 }
    ]
  });
  const EXTRACTOR_GIVEN = Object.freeze(["Kestrel", "Mira", "Orrin", "Sable", "Venn", "Cora", "Rook", "Talin"]);
  const EXTRACTOR_SURNAMES = Object.freeze(["Dusk", "Latch", "Morrow", "Gale", "Kade", "Voss", "Pike", "Vale"]);

  function finite(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
  function cleanId(value) { return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, ""); }
  function uniqueIds(candidate) { return [...new Set((Array.isArray(candidate) ? candidate : []).map(cleanId).filter(Boolean))]; }
  function hash(seed) { let value = 2166136261; for (const char of String(seed || "escape")) { value ^= char.charCodeAt(0); value = Math.imul(value, 16777619); } return value >>> 0; }
  function unit(seed) { return hash(seed) / 4294967295; }
  function riskBand(value) { return value >= 75 ? "critical" : value >= 55 ? "high" : value >= 30 ? "moderate" : "low"; }
  function normalizeHistory(candidate) {
    return (Array.isArray(candidate) ? candidate : []).map((entry) => ({ at: Math.max(0, finite(entry?.at)), action: cleanId(entry?.action) || "updated", summary: String(entry?.summary || "Escape state updated.").trim() })).sort((a, b) => a.at - b.at);
  }
  function normalizeContact(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    return {
      id: cleanId(candidate.id), name: String(candidate.name || "Unknown contact").trim(), archetype: cleanId(candidate.archetype),
      archetypeLabel: String(candidate.archetypeLabel || "Outside contact").trim(), trust: Math.max(0, Math.min(100, finite(candidate.trust))),
      reliability: Math.max(0, Math.min(1, finite(candidate.reliability, 0.5))), riskProfile: ["cautious", "steady", "reckless"].includes(candidate.riskProfile) ? candidate.riskProfile : "steady"
    };
  }
  function contactCapabilities(contact) {
    const archetype = contact?.archetype || "";
    return {
      infiltration: archetype === "industrialSmuggler" ? 82 : archetype === "nobleRetainer" ? 70 : archetype === "occultFactor" ? 61 : 48,
      transport: archetype === "industrialSmuggler" ? 86 : archetype === "nobleRetainer" ? 76 : archetype === "graveBroker" ? 65 : 50,
      safehouse: archetype === "nobleRetainer" ? 82 : archetype === "graveBroker" ? 72 : archetype === "industrialSmuggler" ? 66 : 54
    };
  }
  function willingness(contact, options = {}) {
    if (!contact?.id) return { accepted: false, score: 0, threshold: 70, reasons: ["No persistent contact was designated."] };
    const capabilities = contactCapabilities(contact);
    const risk = contact.riskProfile === "reckless" ? 13 : contact.riskProfile === "cautious" ? -8 : 3;
    const advance = options.improvised ? -14 : 12;
    const payment = Math.min(18, Math.max(0, finite(options.payment)) / 100);
    const alert = Math.max(0, finite(options.facilityAlert)) / 5;
    const score = contact.trust * 1.4 + contact.reliability * 30 + capabilities.infiltration / 8 + capabilities.transport / 10 + risk + advance + payment - alert;
    const threshold = options.improvised ? 66 : 58;
    return {
      accepted: score >= threshold, score, threshold, capabilities,
      reasons: [
        `Trust ${Math.round(contact.trust)}, reliability ${Math.round(contact.reliability * 100)}%, and ${contact.riskProfile} risk tolerance were saved.`,
        `Infiltration ${capabilities.infiltration}, transport ${capabilities.transport}, safehouse ${capabilities.safehouse}.`,
        `${options.improvised ? "Improvised contact" : "Advance contingency"}, payment ${Math.round(Math.max(0, finite(options.payment)))}, facility alert ${Math.round(Math.max(0, finite(options.facilityAlert)))}.`
      ]
    };
  }
  function extractorFor(seed, contactId) {
    return {
      id: `escape-extractor-${cleanId(contactId) || "unknown"}`, name: `${EXTRACTOR_GIVEN[hash(`${seed}:${contactId}:given`) % EXTRACTOR_GIVEN.length]} ${EXTRACTOR_SURNAMES[hash(`${seed}:${contactId}:surname`) % EXTRACTOR_SURNAMES.length]}`,
      role: "covertExtractor", status: "assigned", roomId: "municipalHoldingProcessing", present: false,
      vehicle: { id: `extraction-vehicle-${cleanId(contactId) || "unknown"}`, label: "Disguised service van", class: "covert ground vehicle", status: "staged" }
    };
  }
  function normalizeContingency(candidate, index = 0) {
    const establishedAt = Math.max(0, finite(candidate?.establishedAt));
    return {
      id: cleanId(candidate?.id) || `escape-contingency-${index + 1}`, contact: normalizeContact(candidate?.contact), status: ["active", "activated", "spent", "canceled", "refused"].includes(candidate?.status) ? candidate.status : "active",
      establishedAt, activatedAt: candidate?.activatedAt == null ? null : Math.max(establishedAt, finite(candidate.activatedAt)), deposit: Math.max(0, Math.round(finite(candidate?.deposit))),
      destinationId: cleanId(candidate?.destinationId) || "safeRoom", decision: candidate?.decision && typeof candidate.decision === "object" ? { ...candidate.decision } : null,
      extractor: candidate?.extractor && typeof candidate.extractor === "object" ? { ...candidate.extractor, vehicle: { ...(candidate.extractor.vehicle || {}) } } : null,
      history: normalizeHistory(candidate?.history)
    };
  }
  function normalizeStage(candidate, index = 0) {
    return {
      id: cleanId(candidate?.id) || `escape-stage-${index + 1}`, label: String(candidate?.label || "Escape stage").trim(), roomId: cleanId(candidate?.roomId), observationId: cleanId(candidate?.observationId),
      durationMinutes: Math.max(1, finite(candidate?.durationMinutes, 15)), status: ["pending", "active", "completed", "failed", "skipped"].includes(candidate?.status) ? candidate.status : "pending",
      startedAt: candidate?.startedAt == null ? null : Math.max(0, finite(candidate.startedAt)), completedAt: candidate?.completedAt == null ? null : Math.max(0, finite(candidate.completedAt)),
      risk: Math.max(0, Math.min(100, finite(candidate?.risk))), riskBand: riskBand(finite(candidate?.risk)), detected: Boolean(candidate?.detected), roll: Math.max(0, Math.min(1, finite(candidate?.roll))),
      outcomeFrozen: Boolean(candidate?.outcomeFrozen), reason: String(candidate?.reason || "").trim()
    };
  }
  function normalizeAttempt(candidate, index = 0) {
    const createdAt = Math.max(0, finite(candidate?.createdAt));
    return {
      id: cleanId(candidate?.id) || `jail-escape-attempt-${index + 1}`, stayId: cleanId(candidate?.stayId), raidId: cleanId(candidate?.raidId), proceedingId: cleanId(candidate?.proceedingId),
      routeId: ROUTE_DEFS.some((route) => route.id === candidate?.routeId) ? candidate.routeId : ROUTE_DEFS[0].id,
      status: ["planned", "staged", "active", "escaped", "captured", "abandoned"].includes(candidate?.status) ? candidate.status : "planned",
      createdAt, opportunityAt: Math.max(createdAt, finite(candidate?.opportunityAt, createdAt)), startedAt: candidate?.startedAt == null ? null : Math.max(createdAt, finite(candidate.startedAt)), endedAt: candidate?.endedAt == null ? null : Math.max(createdAt, finite(candidate.endedAt)),
      observationIds: uniqueIds(candidate?.observationIds).filter((id) => OBSERVATION_IDS.includes(id)), missingRequiredIds: uniqueIds(candidate?.missingRequiredIds),
      facilityAlert: Math.max(0, Math.min(100, finite(candidate?.facilityAlert))), uncertainty: Math.max(0, Math.min(100, finite(candidate?.uncertainty))),
      risk: Math.max(0, Math.min(100, finite(candidate?.risk))), riskBand: riskBand(finite(candidate?.risk)), window: candidate?.window && typeof candidate.window === "object" ? { ...candidate.window } : null,
      contingencyId: cleanId(candidate?.contingencyId), improvised: Boolean(candidate?.improvised), contact: normalizeContact(candidate?.contact), decision: candidate?.decision && typeof candidate.decision === "object" ? { ...candidate.decision } : null,
      extractor: candidate?.extractor && typeof candidate.extractor === "object" ? { ...candidate.extractor, vehicle: { ...(candidate.extractor.vehicle || {}) } } : null,
      equipment: (Array.isArray(candidate?.equipment) ? candidate.equipment : []).map((item, itemIndex) => ({ id: cleanId(item?.id) || `escape-tool-${itemIndex + 1}`, label: String(item?.label || "Escape tool").trim(), source: String(item?.source || "improvised").trim(), status: ["planned", "staged", "carried", "used", "confiscated", "lost"].includes(item?.status) ? item.status : "planned" })),
      stages: (Array.isArray(candidate?.stages) ? candidate.stages : []).map(normalizeStage), currentStageIndex: Math.max(0, Math.floor(finite(candidate?.currentStageIndex))),
      destinationId: cleanId(candidate?.destinationId) || "serviceAlley", consequences: (Array.isArray(candidate?.consequences) ? candidate.consequences : []).map(String),
      pursuit: {
        status: ["none", "alerted", "searching", "watchingLab", "recaptureScheduled", "closed"].includes(candidate?.pursuit?.status) ? candidate.pursuit.status : "none",
        lastKnownRoomId: cleanId(candidate?.pursuit?.lastKnownRoomId), alert: Math.max(0, Math.min(100, finite(candidate?.pursuit?.alert))),
        searchBeginsAt: candidate?.pursuit?.searchBeginsAt == null ? null : Math.max(0, finite(candidate.pursuit.searchBeginsAt)), labWatch: Boolean(candidate?.pursuit?.labWatch), returnDestinationId: cleanId(candidate?.pursuit?.returnDestinationId), evidenceId: cleanId(candidate?.pursuit?.evidenceId)
      },
      history: normalizeHistory(candidate?.history)
    };
  }
  function defaultState() { return { version: VERSION, contingencies: [], attempts: [], nextContingencyNumber: 1, nextAttemptNumber: 1 }; }
  function normalizeState(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const contingencies = (Array.isArray(source.contingencies) ? source.contingencies : []).map(normalizeContingency);
    const attempts = (Array.isArray(source.attempts) ? source.attempts : []).map(normalizeAttempt);
    return { version: VERSION, contingencies, attempts, nextContingencyNumber: Math.max(1, Math.floor(finite(source.nextContingencyNumber, contingencies.length + 1))), nextAttemptNumber: Math.max(1, Math.floor(finite(source.nextAttemptNumber, attempts.length + 1))) };
  }
  function activeContingency(candidate) { return normalizeState(candidate).contingencies.find((entry) => entry.status === "active") || null; }
  function activeAttempt(candidate) { return normalizeState(candidate).attempts.find((entry) => ["planned", "staged", "active"].includes(entry.status)) || null; }

  function establishContingency(candidate, options = {}) {
    const state = normalizeState(candidate); const contact = normalizeContact(options.contact); const at = Math.max(0, finite(options.clock)); const deposit = Math.max(0, Math.round(finite(options.deposit, 1200)));
    if (activeContingency(state)) return { state, contingency: activeContingency(state), changed: false, reason: "Only one standing extraction contingency may be active." };
    const decision = willingness(contact, { payment: deposit, facilityAlert: 0, improvised: false });
    const id = `escape-contingency-${state.nextContingencyNumber++}`;
    const contingency = normalizeContingency({ id, contact, status: decision.accepted ? "active" : "refused", establishedAt: at, deposit, destinationId: "safeRoom", decision, extractor: decision.accepted ? extractorFor(options.seed, contact?.id) : null, history: [{ at, action: decision.accepted ? "established" : "refused", summary: decision.accepted ? `${contact.name} accepted a prepaid covert extraction contingency.` : `${contact?.name || "The contact"} refused the proposed extraction contingency.` }] });
    state.contingencies.push(contingency); return { state, contingency, decision, changed: true };
  }

  function plan(candidate, options = {}) {
    const state = normalizeState(candidate); const existing = activeAttempt(state); if (existing) return { state, attempt: existing, changed: false, reason: "An escape plan is already active." };
    const route = ROUTE_DEFS.find((entry) => entry.id === cleanId(options.routeId)); if (!route) return { state, attempt: null, changed: false, reason: "Unknown escape route." };
    const observations = uniqueIds(options.observationIds).filter((id) => OBSERVATION_IDS.includes(id));
    const missingRequiredIds = route.requiredObservationIds.filter((id) => !observations.includes(id)); const missingHelpful = route.helpfulObservationIds.filter((id) => !observations.includes(id));
    const contingency = route.kind === "contact" ? state.contingencies.find((entry) => entry.id === cleanId(options.contingencyId) && entry.status === "active") : null;
    const contact = route.kind === "contact" ? normalizeContact(options.contact || contingency?.contact) : null;
    const improvised = route.kind === "contact" && !contingency; const payment = Math.max(0, Math.round(finite(options.payment, improvised ? 1800 : contingency?.deposit)));
    const decision = route.kind === "contact" ? willingness(contact, { payment, facilityAlert: options.facilityAlert, improvised }) : null;
    if (route.kind === "contact" && !decision.accepted) return { state, attempt: null, decision, changed: false, reason: `${contact?.name || "The contact"} refused the extraction.` };
    const uncertainty = Math.min(100, missingRequiredIds.length * 24 + missingHelpful.length * 10 + (improvised ? 12 : 0));
    const contactReduction = route.kind === "contact" ? Math.min(22, (decision.capabilities.infiltration + decision.capabilities.transport) / 10) : 0;
    const risk = Math.max(5, Math.min(95, route.baseRisk + uncertainty + Math.max(0, finite(options.facilityAlert)) / 3 - observations.length * 4 - contactReduction));
    const at = Math.max(0, finite(options.clock)); const delay = route.kind === "contact" ? (improvised ? 10 : 4) * HOUR : 2 * HOUR;
    const id = `jail-escape-attempt-${state.nextAttemptNumber++}`; const extractor = route.kind === "contact" ? { ...(contingency?.extractor || extractorFor(options.seed, contact.id)), present: false } : null;
    const stages = STAGE_DEFS[route.id].map((stage, index) => normalizeStage({ ...stage, risk: Math.max(5, Math.min(95, risk + index * 3 + (observations.includes(stage.observationId) ? -8 : 12))), roll: unit(`${options.seed}:${id}:${stage.id}`), outcomeFrozen: true }));
    const attempt = normalizeAttempt({ id, stayId: options.stayId, raidId: options.raidId, proceedingId: options.proceedingId, routeId: route.id, status: "planned", createdAt: at, opportunityAt: at + delay, observationIds: observations, missingRequiredIds, facilityAlert: options.facilityAlert, uncertainty, risk, window: { routineId: route.kind === "self" ? "rest" : "communications", label: route.kind === "self" ? "Locked-cell rest service lull" : "Forged vehicle-service window", startAt: at + delay, endAt: at + delay + HOUR }, contingencyId: contingency?.id, improvised, contact, decision, extractor, equipment: route.kind === "self" ? [{ id: `${id}-conductive-shim`, label: "Improvised conductive latch shim", source: "meal-service fittings", status: "planned" }] : [{ id: `${id}-bypass-tool`, label: "Smuggled ward-and-lock bypass tool", source: contact.name, status: "staged" }], stages, destinationId: route.kind === "contact" ? "safeRoom" : "serviceAlley", history: [{ at, action: "planned", summary: `${route.label} planned with ${observations.length} exact security observation(s), ${missingRequiredIds.length} missing required fact(s), and ${riskBand(risk)} frozen risk.` }] });
    if (contingency) { contingency.status = "activated"; contingency.activatedAt = at; contingency.history.push({ at, action: "activated", summary: `The contingency was activated for ${attempt.id}.` }); }
    state.attempts.push(attempt); return { state, attempt, decision, changed: true };
  }

  function stageAttempt(candidate, attemptId, clock = 0) {
    const state = normalizeState(candidate); const attempt = state.attempts.find((entry) => entry.id === cleanId(attemptId));
    if (!attempt || attempt.status !== "planned" || finite(clock) < attempt.opportunityAt) return { state, attempt, changed: false, reason: !attempt ? "Unknown escape plan." : "The saved opportunity window has not opened." };
    if (finite(clock) > finite(attempt.window?.endAt, attempt.opportunityAt + HOUR)) {
      attempt.status = "abandoned"; attempt.endedAt = finite(clock); attempt.consequences = ["Opportunity window missed", ...(attempt.contact ? ["Outside extractor withdrew"] : [])];
      const contingency = state.contingencies.find((entry) => entry.id === attempt.contingencyId); if (contingency) contingency.status = "spent";
      attempt.history.push({ at: finite(clock), action: "windowMissed", summary: "The saved physical opportunity passed before execution began; no escape or teleport occurred." });
      return { state, attempt, changed: true, missed: true, reason: "The physical opportunity window was missed." };
    }
    attempt.status = "staged"; for (const item of attempt.equipment) item.status = "staged"; if (attempt.extractor) { attempt.extractor.present = true; attempt.extractor.status = "waiting"; }
    attempt.history.push({ at: finite(clock), action: "staged", summary: `${ROUTE_DEFS.find((route) => route.id === attempt.routeId).label} entered its saved opportunity window.` }); return { state, attempt, changed: true };
  }
  function beginStage(candidate, attemptId, options = {}) {
    const state = normalizeState(candidate); const attempt = state.attempts.find((entry) => entry.id === cleanId(attemptId)); const stage = attempt?.stages[attempt?.currentStageIndex || 0];
    if (!attempt || !stage || !["staged", "active"].includes(attempt.status) || stage.status !== "pending") return { state, attempt, stage, changed: false, reason: "No pending escape stage is available." };
    attempt.status = "active"; attempt.startedAt ??= Math.max(attempt.opportunityAt, finite(options.clock)); stage.status = "active"; stage.startedAt = Math.max(attempt.startedAt, finite(options.clock));
    const officerExposure = Math.max(0, finite(options.officerExposure)); const knowledgePenalty = attempt.observationIds.includes(stage.observationId) ? 0 : 0.17;
    const successThreshold = Math.max(0.08, Math.min(0.94, 1 - stage.risk / 100 - officerExposure / 100 - knowledgePenalty + Math.max(0, finite(options.skill)) / 250));
    stage.detected = stage.roll > successThreshold; stage.reason = `Frozen roll ${stage.roll.toFixed(3)} against ${(successThreshold).toFixed(3)} execution margin; officer exposure ${Math.round(officerExposure)} and ${attempt.observationIds.includes(stage.observationId) ? "known" : "unknown"} ${stage.observationId}.`;
    attempt.history.push({ at: stage.startedAt, action: "stageStarted", summary: `${stage.label} began. ${stage.reason}` }); return { state, attempt, stage, changed: true };
  }
  function completeStage(candidate, attemptId, options = {}) {
    const state = normalizeState(candidate); const attempt = state.attempts.find((entry) => entry.id === cleanId(attemptId)); const stage = attempt?.stages[attempt?.currentStageIndex || 0]; const at = Math.max(0, finite(options.clock));
    if (!attempt || !stage || attempt.status !== "active" || stage.status !== "active") return { state, attempt, stage, changed: false, reason: "No active escape stage can complete." };
    stage.completedAt = at;
    if (stage.detected) {
      stage.status = "failed"; attempt.status = "captured"; attempt.endedAt = at; attempt.facilityAlert = Math.min(100, attempt.facilityAlert + 25);
      attempt.consequences = ["Facility lockdown", "Escape equipment confiscated", "Communications restricted", "Attempt evidence recorded", ...(options.injury ? [String(options.injury)] : [])];
      for (const item of attempt.equipment) if (!["used", "lost"].includes(item.status)) item.status = "confiscated";
      if (attempt.extractor) { attempt.extractor.present = false; attempt.extractor.status = "withdrew"; }
      const contingency = state.contingencies.find((entry) => entry.id === attempt.contingencyId); if (contingency) contingency.status = "spent";
      attempt.pursuit = { status: "closed", lastKnownRoomId: stage.roomId, alert: attempt.facilityAlert, searchBeginsAt: at, labWatch: false, returnDestinationId: "" };
      attempt.history.push({ at, action: "captured", summary: `${stage.label} was detected; officers physically recaptured the scientist and imposed a lockdown.` });
      return { state, attempt, stage, escaped: false, captured: true, changed: true };
    }
    stage.status = "completed"; if (stage.id === "disableCollar") for (const item of attempt.equipment) item.status = "used";
    attempt.currentStageIndex += 1;
    if (attempt.currentStageIndex >= attempt.stages.length) {
      attempt.status = "escaped"; attempt.endedAt = at; if (attempt.extractor) { attempt.extractor.status = "departed"; attempt.extractor.present = false; }
      const contingency = state.contingencies.find((entry) => entry.id === attempt.contingencyId); if (contingency) contingency.status = "spent";
      attempt.pursuit = { status: "watchingLab", lastKnownRoomId: stage.roomId, alert: Math.min(100, attempt.facilityAlert + 40), searchBeginsAt: at + 15 * 60, labWatch: true, returnDestinationId: "" };
      attempt.history.push({ at, action: "escaped", summary: `The scientist reached ${attempt.destinationId === "safeRoom" ? "the contact's temporary safe room" : "the municipal service alley"}; the laboratory remained a watched destination.` });
      return { state, attempt, stage, escaped: true, captured: false, changed: true };
    }
    attempt.history.push({ at, action: "stageCompleted", summary: `${stage.label} completed without detection; ${attempt.stages[attempt.currentStageIndex].label} is next.` });
    return { state, attempt, stage, nextStage: attempt.stages[attempt.currentStageIndex], escaped: false, captured: false, changed: true };
  }
  function recordReturn(candidate, attemptId, destinationId, clock = 0) {
    const state = normalizeState(candidate); const attempt = state.attempts.find((entry) => entry.id === cleanId(attemptId)); const destination = ["publicEntrance", "concealedExit"].includes(destinationId) ? destinationId : "";
    if (!attempt || attempt.status !== "escaped" || !destination) return { state, attempt, changed: false, reason: "A completed escape and valid laboratory destination are required." };
    const watched = attempt.pursuit.labWatch; attempt.pursuit.returnDestinationId = destination; attempt.pursuit.status = watched ? "recaptureScheduled" : "closed";
    attempt.history.push({ at: Math.max(attempt.endedAt, finite(clock)), action: "returnedToLaboratory", summary: `The fugitive deliberately returned through ${destination === "concealedExit" ? "the Concealed Exit" : "the Public Entrance"}${watched ? "; the saved laboratory watch triggered a physical recapture operation" : ""}.` });
    return { state, attempt, recaptureRequired: watched, changed: true };
  }
  function nextEvent(candidate, clock = 0) {
    const at = finite(clock); const attempts = normalizeState(candidate).attempts;
    const events = [];
    for (const attempt of attempts) {
      if (attempt.status === "planned" && attempt.opportunityAt >= at) events.push({ at: attempt.opportunityAt, kind: "escapeOpportunity", attemptId: attempt.id, label: "Escape opportunity window" });
      if (attempt.status === "escaped" && attempt.pursuit.status === "watchingLab" && attempt.pursuit.searchBeginsAt >= at) events.push({ at: attempt.pursuit.searchBeginsAt, kind: "fugitiveSearch", attemptId: attempt.id, label: "Authority fugitive search begins" });
    }
    return events.sort((a, b) => a.at - b.at || a.attemptId.localeCompare(b.attemptId))[0] || null;
  }

  return Object.freeze({ VERSION, OBSERVATION_IDS, ROUTE_DEFS, STAGE_DEFS, defaultState, normalizeState, activeContingency, activeAttempt, contactCapabilities, willingness, establishContingency, plan, stageAttempt, beginStage, completeStage, recordReturn, nextEvent });
}));
