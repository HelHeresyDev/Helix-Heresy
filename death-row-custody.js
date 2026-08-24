(function attachHelixDeathRowCustody(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixDeathRowCustody = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixDeathRowCustody() {
  "use strict";

  const VERSION = 1;
  const HOUR = 3600;
  const DAY = 24 * HOUR;
  const PROVISIONAL_EXECUTION_DELAY = 30 * DAY;
  const AUTOMATIC_REVIEW_DELAY = 3 * DAY;
  const MINIMUM_POST_DECISION_DELAY = 3 * DAY;
  const STATUSES = Object.freeze(["active", "executionProcessDue", "transferred", "escaped", "released", "deceased"]);
  const PRIORITIES = Object.freeze([
    { id: "legalPreparation", label: "Legal preparation", metric: "legalPreparation" },
    { id: "outsideCommunication", label: "Outside communication", metric: "outsideCommunication" },
    { id: "physicalConditioning", label: "Physical conditioning", metric: "physicalConditioning" },
    { id: "securityObservation", label: "Security observation", metric: "securityObservation" }
  ]);
  const CHANNELS = Object.freeze([
    { id: "legalCounsel", label: "Privileged legal counsel", delayHours: 6, monitored: false, privileged: true },
    { id: "approvedVisitor", label: "Approved visitor", delayHours: 18, monitored: true, privileged: false },
    { id: "companyPortal", label: "Monitored company portal", delayHours: 24, monitored: true, privileged: false },
    { id: "spiritualAdvisor", label: "Spiritual adviser", delayHours: 12, monitored: true, privileged: false }
  ]);
  const ROUTINE = Object.freeze([
    { id: "nightLockdown", label: "Night lockdown", startHour: 0, endHour: 6, roomId: "capitalCustodyCell" },
    { id: "breakfastCount", label: "In-cell breakfast and count", startHour: 6, endHour: 7, roomId: "capitalCustodyCell" },
    { id: "legalWork", label: "Scheduled legal work", startHour: 7, endHour: 11, roomId: "capitalCustodyLegalBooth" },
    { id: "exerciseHygiene", label: "Escorted exercise and hygiene", startHour: 11, endHour: 13, roomId: "capitalCustodyExercise" },
    { id: "middayLockdown", label: "In-cell meal and lockdown", startHour: 13, endHour: 15, roomId: "capitalCustodyCell" },
    { id: "focusBlock", label: "Saved custody priority block", startHour: 15, endHour: 18, roomId: "capitalCustodyLegalBooth" },
    { id: "medicalCount", label: "Medical check and evening count", startHour: 18, endHour: 19, roomId: "capitalCustodyMedical" },
    { id: "eveningLockdown", label: "In-cell evening meal and lockdown", startHour: 19, endHour: 24, roomId: "capitalCustodyCell" }
  ]);
  const GIVEN = Object.freeze(["Mara", "Ivo", "Nia", "Dane", "Sera", "Oren", "Tamsin", "Cal", "Jori", "Vela", "Rian", "Miko"]);
  const FAMILY = Object.freeze(["Vale", "Morrow", "Kade", "Dunn", "Rusk", "Sloane", "Voss", "Keene", "Ward", "Thorne"]);
  const FACILITIES = Object.freeze(["Northwall", "Cinder Gate", "Grey Bastion", "High Rampart", "Stonebridge"]);

  function finite(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
  function cleanId(value) { return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, ""); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, finite(value))); }
  function hash(seed) { let value = 2166136261; for (const character of String(seed || "capital")) { value ^= character.charCodeAt(0); value = Math.imul(value, 16777619); } return value >>> 0; }
  function actorName(seed, index) { return `${GIVEN[hash(`${seed}:${index}:given`) % GIVEN.length]} ${FAMILY[hash(`${seed}:${index}:family`) % FAMILY.length]}`; }
  function cleanCell(value, fallback = null) { return value && Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.y)) ? { x: Math.round(Number(value.x)), y: Math.round(Number(value.y)), z: Math.round(Number(value.z) || 0) } : fallback; }

  function routineAt(committedAt, clock, priorityId) {
    const elapsed = Math.max(0, finite(clock) - finite(committedAt));
    const hour = (elapsed % DAY) / HOUR;
    const base = ROUTINE.find((entry) => hour >= entry.startHour && hour < entry.endHour) || ROUTINE[0];
    let roomId = base.roomId;
    let label = base.label;
    if (base.id === "focusBlock") {
      const focus = PRIORITIES.find((entry) => entry.id === priorityId) || PRIORITIES[0];
      roomId = priorityId === "outsideCommunication" ? "capitalCustodyVisitation" : priorityId === "physicalConditioning" ? "capitalCustodyExercise" : priorityId === "securityObservation" ? "capitalCustodyCell" : "capitalCustodyLegalBooth";
      label = `${focus.label} priority block`;
    }
    const cycleStart = clock - hour * HOUR;
    const next = ROUTINE.map((entry) => ({ ...entry, at: cycleStart + entry.startHour * HOUR })).filter((entry) => entry.at > clock).sort((a, b) => a.at - b.at)[0] || { ...ROUTINE[0], at: cycleStart + DAY };
    return { currentKind: base.id, currentLabel: label, currentRoomId: roomId, nextEventAt: next.at, nextEventKind: next.id, nextEventLabel: next.label, updatedAt: clock };
  }

  function normalizeActor(value, index) {
    const source = value && typeof value === "object" ? value : {};
    return { id: cleanId(source.id) || `capital-actor-${index + 1}`, name: String(source.name || `Capital Custody Actor ${index + 1}`).trim(), role: cleanId(source.role) || "custodyOfficer", affiliation: String(source.affiliation || "State Capital Custody Service").trim(), shift: cleanId(source.shift) || "day", present: source.present !== false, roomId: cleanId(source.roomId) || "capitalCustodyControl", mapCell: cleanCell(source.mapCell, { x: 17 + index, y: 6, z: 6 }) };
  }
  function normalizeRequest(value, index) {
    const channel = CHANNELS.find((entry) => entry.id === value?.channelId) || CHANNELS[0]; const requestedAt = Math.max(0, finite(value?.requestedAt));
    return { id: cleanId(value?.id) || `capital-request-${index + 1}`, channelId: channel.id, recipient: String(value?.recipient || channel.label).trim(), requestedAt, readyAt: Math.max(requestedAt, finite(value?.readyAt, requestedAt + channel.delayHours * HOUR)), status: ["pending", "ready", "completed", "denied"].includes(value?.status) ? value.status : "pending", completedAt: value?.completedAt == null ? null : Math.max(requestedAt, finite(value.completedAt)) };
  }
  function normalizeDecision(value, committedAt) { return { required: Boolean(value?.required), kind: cleanId(value?.kind), reason: String(value?.reason || "").trim(), raisedAt: value?.raisedAt == null ? null : Math.max(committedAt, finite(value.raisedAt)) }; }
  function normalizeHistory(value) { return (Array.isArray(value) ? value : []).map((entry) => ({ at: Math.max(0, finite(entry?.at)), action: cleanId(entry?.action) || "updated", summary: String(entry?.summary || "Capital custody updated.").trim() })).sort((a, b) => a.at - b.at); }

  function normalizeStay(value, index = 0) {
    const source = value && typeof value === "object" ? value : {}; const committedAt = Math.max(0, finite(source.committedAt));
    const priorityId = PRIORITIES.some((entry) => entry.id === source.plan?.priorityId) ? source.plan.priorityId : "legalPreparation";
    const provisionalExecutionAt = Math.max(committedAt + PROVISIONAL_EXECUTION_DELAY, finite(source.calendar?.provisionalExecutionAt, committedAt + PROVISIONAL_EXECUTION_DELAY));
    const stay = {
      id: cleanId(source.id) || `capital-stay-${index + 1}`, caseId: cleanId(source.caseId), orderId: cleanId(source.orderId), jailStayId: cleanId(source.jailStayId), docket: String(source.docket || "Capital commitment").trim(), detaineeId: "scientist", status: STATUSES.includes(source.status) ? source.status : "active", committedAt, lastAdvancedAt: Math.max(committedAt, finite(source.lastAdvancedAt, committedAt)),
      facility: { id: cleanId(source.facility?.id) || "capital-custody-unit", label: String(source.facility?.label || "State Capital Custody Unit").trim(), kind: "deathRow", roomIds: (Array.isArray(source.facility?.roomIds) ? source.facility.roomIds : []).map(cleanId).filter(Boolean) },
      transport: { id: cleanId(source.transport?.id) || `capital-transport-${index + 1}`, label: String(source.transport?.label || "Armored capital-custody transport").trim(), departedAt: Math.max(0, finite(source.transport?.departedAt, committedAt - HOUR)), arrivedAt: Math.max(0, finite(source.transport?.arrivedAt, committedAt)), crewNames: Array.isArray(source.transport?.crewNames) ? source.transport.crewNames.map(String) : [] },
      actors: (Array.isArray(source.actors) ? source.actors : []).map(normalizeActor),
      plan: { priorityId, savedAt: Math.max(committedAt, finite(source.plan?.savedAt, committedAt)) },
      progress: { legalPreparation: Math.max(0, finite(source.progress?.legalPreparation)), outsideCommunication: Math.max(0, finite(source.progress?.outsideCommunication)), physicalConditioning: Math.max(0, finite(source.progress?.physicalConditioning)), securityObservation: Math.max(0, finite(source.progress?.securityObservation)), custodyDays: Math.max(0, finite(source.progress?.custodyDays)) },
      discipline: { standing: source.discipline?.standing == null ? 50 : clamp(source.discipline.standing, 0, 100), incidents: (Array.isArray(source.discipline?.incidents) ? source.discipline.incidents : []).map((entry, incidentIndex) => ({ id: cleanId(entry?.id) || `capital-incident-${incidentIndex + 1}`, at: Math.max(committedAt, finite(entry?.at)), kind: cleanId(entry?.kind) || "custodyViolation", response: cleanId(entry?.response) || "warning", summary: String(entry?.summary || "A capital-custody disciplinary incident was recorded.").trim() })) },
      calendar: { provisionalExecutionAt, executionStatus: ["provisional", "stayed", "rescheduled", "due", "cancelled"].includes(source.calendar?.executionStatus) ? source.calendar.executionStatus : "provisional", automaticReviewAt: Math.max(committedAt, finite(source.calendar?.automaticReviewAt, committedAt + AUTOMATIC_REVIEW_DELAY)), automaticReviewStatus: ["scheduled", "opened", "resolved"].includes(source.calendar?.automaticReviewStatus) ? source.calendar.automaticReviewStatus : "scheduled", finalAdverseDecisionAt: source.calendar?.finalAdverseDecisionAt == null ? null : Math.max(committedAt, finite(source.calendar.finalAdverseDecisionAt)), minimumPostDecisionDelay: MINIMUM_POST_DECISION_DELAY },
      routine: null,
      communications: { requests: (Array.isArray(source.communications?.requests) ? source.communications.requests : []).map(normalizeRequest), sessions: Array.isArray(source.communications?.sessions) ? clone(source.communications.sessions) : [] },
      suppressor: { id: cleanId(source.suppressor?.id) || `capital-collar-${index + 1}`, kind: "nullstoneCollar", label: "High-security physical nullstone collar", status: ["locked", "disabled", "removed"].includes(source.suppressor?.status) ? source.suppressor.status : "locked", suppressionActive: source.suppressor?.suppressionActive !== false, condition: clamp(source.suppressor?.condition ?? 100, 0, 100), toolInstanceId: cleanId(source.suppressor?.toolInstanceId), physicalStackId: cleanId(source.suppressor?.physicalStackId), appliedAt: Math.max(committedAt, finite(source.suppressor?.appliedAt, committedAt)) },
      knowledge: { labSnapshotAt: Math.max(committedAt, finite(source.knowledge?.labSnapshotAt, committedAt)), labSnapshot: source.knowledge?.labSnapshot && typeof source.knowledge.labSnapshot === "object" ? clone(source.knowledge.labSnapshot) : {}, reports: Array.isArray(source.knowledge?.reports) ? clone(source.knowledge.reports) : [] },
      decision: normalizeDecision(source.decision, committedAt), history: normalizeHistory(source.history)
    };
    stay.routine = routineAt(committedAt, stay.lastAdvancedAt, priorityId);
    return stay;
  }

  function defaultState() { return { version: VERSION, stays: [], nextStayNumber: 1, nextRequestNumber: 1, nextSessionNumber: 1 }; }
  function normalizeState(value) { const source = value && typeof value === "object" ? value : {}; const stays = (Array.isArray(source.stays) ? source.stays : []).map(normalizeStay); return { version: VERSION, stays, nextStayNumber: Math.max(1, Math.floor(finite(source.nextStayNumber, stays.length + 1))), nextRequestNumber: Math.max(1, Math.floor(finite(source.nextRequestNumber, 1))), nextSessionNumber: Math.max(1, Math.floor(finite(source.nextSessionNumber, 1))) }; }
  function activeStay(value) { return normalizeState(value).stays.find((stay) => ["active", "executionProcessDue"].includes(stay.status)) || null; }

  function commit(value, options = {}) {
    const state = normalizeState(value); const orderId = cleanId(options.orderId); const existing = state.stays.find((stay) => orderId && stay.orderId === orderId); if (existing) return { state, stay: existing, created: false };
    const committedAt = Math.max(0, finite(options.clock)); const id = `capital-stay-${state.nextStayNumber++}`; const seed = `${options.seed || "world"}:${id}`;
    const roles = ["capitalSupervisor", "custodyOfficer", "custodyOfficer", "medicalOfficer", "executionOfficer", "legalLiaison", "capitalCounselVisitor", "spiritualAdvisor"];
    const rooms = ["capitalCustodyControl", "capitalCustodyControl", "capitalCustodyControl", "capitalCustodyMedical", "capitalCustodyExecutionSuite", "capitalCustodyLegalBooth", "capitalCustodyLegalBooth", "capitalCustodyVisitation"];
    const cells = [{ x: 18, y: 5, z: 6 }, { x: 19, y: 5, z: 6 }, { x: 20, y: 5, z: 6 }, { x: 18, y: 23, z: 6 }, { x: 19, y: 32, z: 6 }, { x: 18, y: 14, z: 6 }, { x: 19, y: 14, z: 6 }, { x: 25, y: 14, z: 6 }];
    const actors = roles.map((role, index) => ({ id: `${id}-actor-${index + 1}`, name: role === "capitalCounselVisitor" && options.counselName ? String(options.counselName) : actorName(seed, index), role, affiliation: role === "capitalCounselVisitor" ? "Defense counsel" : role === "spiritualAdvisor" ? "Approved pastoral service" : "State Capital Custody Service", shift: index === 2 ? "night" : ["capitalCounselVisitor", "spiritualAdvisor"].includes(role) ? "scheduled" : "day", present: !["capitalCounselVisitor", "spiritualAdvisor"].includes(role), roomId: rooms[index], mapCell: cells[index] }));
    const facilityLabel = `${FACILITIES[hash(`${seed}:facility`) % FACILITIES.length]} State Capital Custody Unit`;
    const stay = normalizeStay({ id, caseId: options.caseId, orderId, jailStayId: options.jailStayId, docket: options.docket, committedAt, facility: { id: `${id}-facility`, label: facilityLabel, roomIds: options.roomIds }, transport: { id: `${id}-transport`, departedAt: Math.max(0, committedAt - HOUR), arrivedAt: committedAt, crewNames: actors.slice(0, 3).map((actor) => actor.name) }, actors, suppressor: { id: `${id}-nullstone-collar`, appliedAt: committedAt }, knowledge: { labSnapshotAt: committedAt, labSnapshot: options.labSnapshot }, history: [{ at: Math.max(0, committedAt - HOUR), action: "jailTransfer", summary: "Armored transport removed the scientist from temporary jail after the capital commitment became effective." }, { at: committedAt, action: "capitalIntake", summary: `The scientist entered ${facilityLabel}; the death sentence did not end the run.` }, { at: committedAt, action: "calendarOpened", summary: "A provisional execution date thirty days after intake and an automatic capital review were placed on the saved calendar." }, { at: committedAt, action: "nullstoneApplied", summary: "Staff fitted a physical nullstone collar backed by facility suppression wards; magic became completely unavailable." }] });
    state.stays.push(stay); return { state, stay, created: true };
  }

  function setPriority(value, stayId, priorityId, clock = 0) { const state = normalizeState(value); const stay = state.stays.find((entry) => entry.id === cleanId(stayId) && entry.status === "active"); if (!stay || !PRIORITIES.some((entry) => entry.id === priorityId)) return { state, stay, changed: false }; const changed = stay.plan.priorityId !== priorityId; stay.plan = { priorityId, savedAt: Math.max(stay.committedAt, finite(clock)) }; stay.routine = routineAt(stay.committedAt, clock, priorityId); if (changed) stay.history.push({ at: clock, action: "prioritySaved", summary: `${PRIORITIES.find((entry) => entry.id === priorityId).label} became the saved custody priority.` }); return { state, stay, changed }; }
  function clearDecision(value, stayId) { const state = normalizeState(value); const stay = state.stays.find((entry) => entry.id === cleanId(stayId)); if (!stay?.decision.required || stay.decision.kind === "executionProcessDue") return { state, stay, changed: false }; stay.decision = normalizeDecision({}, stay.committedAt); return { state, stay, changed: true }; }
  function recordDisciplinaryIncident(value, stayId, options = {}, clock = 0) { const state = normalizeState(value); const stay = state.stays.find((entry) => entry.id === cleanId(stayId) && entry.status === "active"); if (!stay) return { state, stay, incident: null, changed: false }; const severity = clamp(options.severity || 1, 1, 3); const response = severity >= 3 ? "emergencyLockdown" : severity >= 2 ? "privilegeRestriction" : "warning"; stay.discipline.standing = clamp(stay.discipline.standing - severity * 8, 0, 100); const incident = { id: `capital-incident-${stay.discipline.incidents.length + 1}`, at: Math.max(stay.committedAt, finite(clock)), kind: cleanId(options.kind) || "custodyViolation", response, summary: String(options.summary || `${response} followed a saved capital-custody violation.`).trim() }; stay.discipline.incidents.push(incident); stay.decision = { required: true, kind: "disciplinaryIncident", reason: `${incident.summary} Time compression stopped for the custody response.`, raisedAt: incident.at }; stay.history.push({ at: incident.at, action: "disciplinaryIncident", summary: `${incident.kind} produced ${response}; custody standing is ${Math.round(stay.discipline.standing)}.` }); return { state, stay, incident, changed: true }; }
  function requestCommunication(value, stayId, channelId, recipient, clock = 0) { const state = normalizeState(value); const stay = state.stays.find((entry) => entry.id === cleanId(stayId) && entry.status === "active"); const channel = CHANNELS.find((entry) => entry.id === channelId); if (!stay || !channel) return { state, stay, request: null, changed: false }; const existing = stay.communications.requests.find((entry) => entry.channelId === channelId && ["pending", "ready"].includes(entry.status)); if (existing) return { state, stay, request: existing, changed: false }; const request = normalizeRequest({ id: `capital-request-${state.nextRequestNumber++}`, channelId, recipient, requestedAt: clock, readyAt: clock + channel.delayHours * HOUR }); stay.communications.requests.push(request); stay.history.push({ at: clock, action: "communicationRequested", summary: `${channel.label} was requested through capital-custody scheduling.` }); return { state, stay, request, changed: true }; }
  function completeCommunication(value, stayId, requestId, clock = 0, report = {}) { const state = normalizeState(value); const stay = state.stays.find((entry) => entry.id === cleanId(stayId) && entry.status === "active"); const request = stay?.communications.requests.find((entry) => entry.id === cleanId(requestId)); const channel = CHANNELS.find((entry) => entry.id === request?.channelId); if (!stay || !request || request.status !== "ready" || !channel) return { state, stay, session: null, changed: false }; request.status = "completed"; request.completedAt = clock; const session = { id: `capital-session-${state.nextSessionNumber++}`, requestId: request.id, channelId: channel.id, startedAt: clock, endedAt: clock, monitored: channel.monitored, privileged: channel.privileged, summary: `${channel.label} completed${channel.privileged ? " as privileged counsel communication" : " under monitoring"}.` }; stay.communications.sessions.push(session); if (report && Object.keys(report).length) { stay.knowledge.labSnapshotAt = clock; stay.knowledge.labSnapshot = clone(report); stay.knowledge.reports.push({ ...clone(report), deliveredAt: clock, channelId: channel.id }); } stay.history.push({ at: clock, action: "communicationCompleted", summary: session.summary }); return { state, stay, session, changed: true }; }

  function advance(value, clock = 0) {
    const state = normalizeState(value); const stay = state.stays.find((entry) => ["active", "executionProcessDue"].includes(entry.status)); if (!stay) return { state, stay: null, changed: false };
    const now = Math.max(stay.lastAdvancedAt, finite(clock)); if (stay.status === "executionProcessDue") return { state, stay, changed: false };
    const elapsed = now - stay.lastAdvancedAt; const focus = PRIORITIES.find((entry) => entry.id === stay.plan.priorityId) || PRIORITIES[0];
    stay.progress[focus.metric] += elapsed / DAY; stay.progress.custodyDays += elapsed / DAY; stay.lastAdvancedAt = now; stay.routine = routineAt(stay.committedAt, now, stay.plan.priorityId);
    for (const request of stay.communications.requests) if (request.status === "pending" && request.readyAt <= now) { request.status = "ready"; if (!stay.decision.required) stay.decision = { required: true, kind: "communicationReady", reason: `${CHANNELS.find((entry) => entry.id === request.channelId)?.label || "Scheduled communication"} is ready for physical use.`, raisedAt: request.readyAt }; }
    if (stay.calendar.automaticReviewStatus === "scheduled" && stay.calendar.automaticReviewAt <= now) { stay.calendar.automaticReviewStatus = "opened"; stay.history.push({ at: stay.calendar.automaticReviewAt, action: "automaticReviewOpened", summary: "Automatic capital review opened. Its legal findings belong to the capital-appeals pass." }); if (!stay.decision.required) stay.decision = { required: true, kind: "automaticReviewOpened", reason: "Automatic capital review opened; this custody pass records the milestone without inventing an appellate outcome.", raisedAt: stay.calendar.automaticReviewAt }; }
    if (stay.calendar.executionStatus !== "stayed" && stay.calendar.executionStatus !== "cancelled" && stay.calendar.provisionalExecutionAt <= now) { stay.status = "executionProcessDue"; stay.calendar.executionStatus = "due"; stay.decision = { required: true, kind: "executionProcessDue", reason: "Execution-day custody is due. Time stops at this explicit boundary; this pass causes no injury or death.", raisedAt: stay.calendar.provisionalExecutionAt }; stay.history.push({ at: stay.calendar.provisionalExecutionAt, action: "executionProcessDue", summary: stay.decision.reason }); }
    return { state, stay, changed: elapsed > 0 };
  }

  function nextEvent(value, clock = 0) { const stay = activeStay(value); if (!stay || stay.status === "executionProcessDue" || stay.decision.required) return null; const events = [{ at: stay.routine.nextEventAt, label: stay.routine.nextEventLabel, kind: "routine" }]; if (stay.calendar.automaticReviewStatus === "scheduled") events.push({ at: stay.calendar.automaticReviewAt, label: "automatic capital review opens", kind: "automaticReview" }); if (!["stayed", "cancelled"].includes(stay.calendar.executionStatus)) events.push({ at: stay.calendar.provisionalExecutionAt, label: "execution process due", kind: "executionProcessDue" }); for (const request of stay.communications.requests.filter((entry) => entry.status === "pending")) events.push({ at: request.readyAt, label: `${CHANNELS.find((entry) => entry.id === request.channelId)?.label || "communication"} ready`, kind: "communication" }); return events.filter((entry) => entry.at >= clock).sort((a, b) => a.at - b.at || a.label.localeCompare(b.label))[0] || null; }

  return { VERSION, HOUR, DAY, PROVISIONAL_EXECUTION_DELAY, AUTOMATIC_REVIEW_DELAY, MINIMUM_POST_DECISION_DELAY, STATUSES, PRIORITIES, CHANNELS, ROUTINE, defaultState, normalizeState, activeStay, commit, setPriority, clearDecision, recordDisciplinaryIncident, requestCommunication, completeCommunication, advance, nextEvent };
}));
