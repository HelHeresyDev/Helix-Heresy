(function attachHelixPrisonCustody(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixPrisonCustody = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixPrisonCustody() {
  "use strict";

  const VERSION = 1;
  const HOUR = 3600;
  const DAY = 24 * HOUR;
  const MONTH = 30 * DAY;
  const STATUSES = Object.freeze(["active", "releaseDue", "released", "escaped", "transferred", "deceased"]);
  const ROUTINE = Object.freeze([
    { id: "lockup", label: "Night lockup", startHour: 0, endHour: 6, roomId: "statePrisonHousing" },
    { id: "breakfast", label: "Breakfast and count", startHour: 6, endHour: 7, roomId: "statePrisonDayroom" },
    { id: "morningAssignment", label: "Morning work or program", startHour: 7, endHour: 12, roomId: "statePrisonWorkshop" },
    { id: "midday", label: "Meal and dayroom", startHour: 12, endHour: 14, roomId: "statePrisonDayroom" },
    { id: "afternoonAssignment", label: "Afternoon work or program", startHour: 14, endHour: 17, roomId: "statePrisonWorkshop" },
    { id: "personalPeriod", label: "Exercise, clinic, or communications", startHour: 17, endHour: 19, roomId: "statePrisonExercise" },
    { id: "evening", label: "Evening meal and association", startHour: 19, endHour: 21, roomId: "statePrisonDayroom" },
    { id: "lockup", label: "Evening lockup", startHour: 21, endHour: 24, roomId: "statePrisonHousing" }
  ]);
  const ASSIGNMENTS = Object.freeze([
    { id: "infrastructureSorting", label: "Infrastructure Materials Sorting", kind: "work", roomId: "statePrisonWorkshop", wagePerDay: 12, skillId: "materialsScience", standingPerDay: 1 },
    { id: "recordsProgram", label: "Technical Records Program", kind: "program", roomId: "statePrisonProgram", wagePerDay: 4, skillId: "analysis", standingPerDay: 2 },
    { id: "sanitationDetail", label: "Housing Sanitation Detail", kind: "work", roomId: "statePrisonHousing", wagePerDay: 8, skillId: "medicine", standingPerDay: 1 },
    { id: "recovery", label: "Medical Recovery Assignment", kind: "recovery", roomId: "statePrisonClinic", wagePerDay: 0, skillId: "medicine", standingPerDay: 0 }
  ]);
  const PRIORITIES = Object.freeze([
    { id: "assignment", label: "Work or program compliance" },
    { id: "exercise", label: "Exercise and recovery" },
    { id: "social", label: "Prisoner relationships" },
    { id: "communication", label: "Outside communication" },
    { id: "refusal", label: "Refuse assigned routine" }
  ]);
  const CHANNELS = Object.freeze([
    { id: "companyPortal", label: "Company portal", delayHours: 24, monitored: true, legal: true },
    { id: "legalCounsel", label: "Legal counsel", delayHours: 12, monitored: false, legal: true },
    { id: "publicNetwork", label: "Public network", delayHours: 18, monitored: true, legal: true },
    { id: "codedContact", label: "Coded outside contact", delayHours: 36, monitored: true, legal: false }
  ]);
  const RELATIONSHIP_BANDS = Object.freeze([
    { id: "hostile", label: "Hostile", maximum: -26 },
    { id: "wary", label: "Wary", maximum: -6 },
    { id: "neutral", label: "Neutral", maximum: 19 },
    { id: "cooperative", label: "Cooperative", maximum: 49 },
    { id: "trusted", label: "Trusted", maximum: Infinity }
  ]);
  const GIVEN_NAMES = Object.freeze(["Mara", "Ivo", "Nia", "Dane", "Sera", "Oren", "Tamsin", "Cal", "Jori", "Vela", "Rian", "Miko", "Asha", "Perrin"]);
  const SURNAMES = Object.freeze(["Vale", "Morrow", "Kade", "Dunn", "Rusk", "Sloane", "Voss", "Keene", "Ward", "Thorne", "Pike", "Aster"]);
  const AFFILIATIONS = Object.freeze(["Unaffiliated", "Dock Mutual", "Ash Street Crew", "Civic Labor Bloc", "Northwall Families", "Glasshouse Circle"]);
  const FACILITY_PREFIXES = Object.freeze(["Northwall", "Ironwood", "High Rampart", "Cinder Gate", "Stonebridge", "Grey Bastion"]);

  function finite(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
  function cleanId(value) { return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, ""); }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, finite(value))); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function hash(seed) { let value = 2166136261; for (const character of String(seed || "prison")) { value ^= character.charCodeAt(0); value = Math.imul(value, 16777619); } return value >>> 0; }
  function cleanCell(candidate, fallback = null) { return candidate && Number.isFinite(Number(candidate.x)) && Number.isFinite(Number(candidate.y)) ? { x: Math.round(Number(candidate.x)), y: Math.round(Number(candidate.y)), z: Math.round(Number(candidate.z) || 0) } : fallback; }
  function relationshipBand(score) { return RELATIONSHIP_BANDS.find((band) => finite(score) <= band.maximum) || RELATIONSHIP_BANDS.at(-1); }
  function actorName(seed, index) { return `${GIVEN_NAMES[hash(`${seed}:${index}:given`) % GIVEN_NAMES.length]} ${SURNAMES[hash(`${seed}:${index}:surname`) % SURNAMES.length]}`; }

  function routineAt(committedAt, clock, assignmentId = "infrastructureSorting", priorityId = "assignment", discipline = {}) {
    const elapsed = Math.max(0, finite(clock) - finite(committedAt));
    const hour = (elapsed % DAY) / HOUR;
    const base = ROUTINE.find((entry) => hour >= entry.startHour && hour < entry.endHour) || ROUTINE[0];
    let roomId = base.roomId;
    if (["morningAssignment", "afternoonAssignment"].includes(base.id)) roomId = (ASSIGNMENTS.find((entry) => entry.id === assignmentId) || ASSIGNMENTS[0]).roomId;
    if (base.id === "personalPeriod") roomId = priorityId === "communication" ? "statePrisonCommunications" : priorityId === "exercise" ? "statePrisonExercise" : priorityId === "social" ? "statePrisonDayroom" : "statePrisonClinic";
    if (discipline.segregatedUntil > clock) roomId = "statePrisonSegregation";
    const cycleStart = clock - hour * HOUR;
    const later = ROUTINE.map((entry) => ({ ...entry, at: cycleStart + entry.startHour * HOUR })).filter((entry) => entry.at > clock).sort((a, b) => a.at - b.at)[0];
    const next = later || { ...ROUTINE[0], at: cycleStart + DAY };
    return { currentKind: base.id, currentLabel: base.label, currentRoomId: roomId, nextEventAt: next.at, nextEventKind: next.id, nextEventLabel: next.label, updatedAt: clock };
  }

  function normalizeActor(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return { id: cleanId(source.id) || `prison-actor-${index + 1}`, name: String(source.name || `Prison Actor ${index + 1}`).trim(), role: cleanId(source.role) || "prisoner", affiliation: String(source.affiliation || "Unaffiliated").trim(), shift: ["day", "swing", "night", "resident"].includes(source.shift) ? source.shift : source.role === "prisoner" ? "resident" : "day", present: source.present !== false, roomId: cleanId(source.roomId) || "statePrisonHousing", mapCell: cleanCell(source.mapCell, { x: 6 + index, y: 14, z: 5 }), targetCell: cleanCell(source.targetCell), inventory: source.inventory && typeof source.inventory === "object" ? source.inventory : null };
  }
  function normalizeRelationship(candidate, index = 0) {
    const score = clamp(candidate?.score, -100, 100);
    return { actorId: cleanId(candidate?.actorId) || `prison-actor-${index + 1}`, score, band: relationshipBand(score).id, lastChangedAt: Math.max(0, finite(candidate?.lastChangedAt)), history: (Array.isArray(candidate?.history) ? candidate.history : []).map((entry) => ({ at: Math.max(0, finite(entry?.at)), delta: finite(entry?.delta), reason: String(entry?.reason || "Relationship changed.").trim() })) };
  }
  function normalizeRequest(candidate, index = 0) {
    const channel = CHANNELS.find((entry) => entry.id === candidate?.channelId) || CHANNELS[0]; const requestedAt = Math.max(0, finite(candidate?.requestedAt));
    return { id: cleanId(candidate?.id) || `prison-request-${index + 1}`, channelId: channel.id, recipient: String(candidate?.recipient || channel.label).trim(), requestedAt, readyAt: Math.max(requestedAt, finite(candidate?.readyAt, requestedAt + channel.delayHours * HOUR)), status: ["pending", "ready", "completed", "denied"].includes(candidate?.status) ? candidate.status : "pending", completedAt: candidate?.completedAt == null ? null : Math.max(requestedAt, finite(candidate.completedAt)), risk: clamp(candidate?.risk, 0, 100) };
  }
  function normalizeHistory(candidate) { return (Array.isArray(candidate) ? candidate : []).map((entry) => ({ at: Math.max(0, finite(entry?.at)), action: cleanId(entry?.action) || "updated", summary: String(entry?.summary || "Prison state updated.").trim() })).sort((a, b) => a.at - b.at); }

  function normalizeStay(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {}; const committedAt = Math.max(0, finite(source.committedAt)); const months = Math.max(1, Math.min(120, Math.floor(finite(source.sentence?.months, 3)))); const releaseAt = Math.max(committedAt + MONTH, finite(source.sentence?.releaseAt, committedAt + months * MONTH));
    const assignmentId = ASSIGNMENTS.some((entry) => entry.id === source.plan?.assignmentId) ? source.plan.assignmentId : "infrastructureSorting"; const priorityId = PRIORITIES.some((entry) => entry.id === source.plan?.priorityId) ? source.plan.priorityId : "assignment";
    const stay = {
      id: cleanId(source.id) || `prison-stay-${index + 1}`, caseId: cleanId(source.caseId), orderId: cleanId(source.orderId), jailStayId: cleanId(source.jailStayId), docket: String(source.docket || "Finite prison commitment").trim(), detaineeId: "scientist", status: STATUSES.includes(source.status) ? source.status : "active", committedAt, lastAdvancedAt: Math.max(committedAt, finite(source.lastAdvancedAt, committedAt)),
      facility: { id: cleanId(source.facility?.id) || "state-prison", label: String(source.facility?.label || "State Correctional Center").trim(), kind: "prison", cityLabel: String(source.facility?.cityLabel || "the fortified city").trim(), capacity: Math.max(1, Math.floor(finite(source.facility?.capacity, 9))), occupied: Math.max(1, Math.floor(finite(source.facility?.occupied, 9))), strategicCapacity: Math.max(1, Math.floor(finite(source.facility?.strategicCapacity, 240))), strategicPopulation: Math.max(1, Math.floor(finite(source.facility?.strategicPopulation, 268))), roomIds: (Array.isArray(source.facility?.roomIds) ? source.facility.roomIds : []).map(cleanId).filter(Boolean) },
      transport: { id: cleanId(source.transport?.id) || `prison-transport-${index + 1}`, label: String(source.transport?.label || "Armored prison transport").trim(), departedAt: Math.max(0, finite(source.transport?.departedAt, committedAt - HOUR)), arrivedAt: Math.max(0, finite(source.transport?.arrivedAt, committedAt)), crewNames: Array.isArray(source.transport?.crewNames) ? source.transport.crewNames.map(String) : [] },
      sentence: { months, servedSeconds: clamp(source.sentence?.servedSeconds, 0, months * MONTH), serviceCreditDays: Math.max(0, Math.floor(finite(source.sentence?.serviceCreditDays))), releaseAt, releaseDueAt: source.sentence?.releaseDueAt == null ? null : Math.max(committedAt, finite(source.sentence.releaseDueAt)), maximumMonths: 120 },
      actors: (Array.isArray(source.actors) ? source.actors : []).map(normalizeActor), relationships: (Array.isArray(source.relationships) ? source.relationships : []).map(normalizeRelationship),
      plan: { assignmentId, priorityId, savedAt: Math.max(committedAt, finite(source.plan?.savedAt, committedAt)) },
      assignment: { daysCompleted: Math.max(0, Math.floor(finite(source.assignment?.daysCompleted))), wages: Math.max(0, Math.floor(finite(source.assignment?.wages))), skillPractice: Math.max(0, finite(source.assignment?.skillPractice)), participationRecord: clamp(source.assignment?.participationRecord, 0, 100) },
      discipline: { standing: source.discipline?.standing == null ? 50 : clamp(source.discipline.standing, 0, 100), warnings: Math.max(0, Math.floor(finite(source.discipline?.warnings))), privilegeRestrictionUntil: Math.max(0, finite(source.discipline?.privilegeRestrictionUntil)), segregatedUntil: Math.max(0, finite(source.discipline?.segregatedUntil)), incidents: (Array.isArray(source.discipline?.incidents) ? source.discipline.incidents : []).map((entry) => ({ at: Math.max(0, finite(entry?.at)), kind: cleanId(entry?.kind), response: cleanId(entry?.response), summary: String(entry?.summary || "Disciplinary incident.").trim() })) },
      communications: { requests: (Array.isArray(source.communications?.requests) ? source.communications.requests : []).map(normalizeRequest), sessions: (Array.isArray(source.communications?.sessions) ? source.communications.sessions : []).map((entry, sessionIndex) => ({ id: cleanId(entry?.id) || `prison-session-${sessionIndex + 1}`, requestId: cleanId(entry?.requestId), channelId: cleanId(entry?.channelId), startedAt: Math.max(0, finite(entry?.startedAt)), endedAt: entry?.endedAt == null ? null : Math.max(0, finite(entry.endedAt)), monitored: Boolean(entry?.monitored), summary: String(entry?.summary || "").trim() })) },
      property: { prisonWages: Math.max(0, Math.floor(finite(source.property?.prisonWages))), storedItemLabels: Array.isArray(source.property?.storedItemLabels) ? source.property.storedItemLabels.map(String) : [], contrabandItemLabels: Array.isArray(source.property?.contrabandItemLabels) ? source.property.contrabandItemLabels.map(String) : [] },
      suppressor: { id: cleanId(source.suppressor?.id) || `prison-collar-${index + 1}`, kind: "magicSuppressingCollar", label: "Warded prison magic-suppressing collar", status: ["locked", "disabled", "removed"].includes(source.suppressor?.status) ? source.suppressor.status : "locked", suppressionActive: source.suppressor?.suppressionActive !== false, condition: clamp(source.suppressor?.condition || 100, 0, 100), toolInstanceId: cleanId(source.suppressor?.toolInstanceId), physicalStackId: cleanId(source.suppressor?.physicalStackId), appliedAt: Math.max(committedAt, finite(source.suppressor?.appliedAt, committedAt)) },
      knowledge: { labSnapshotAt: Math.max(committedAt, finite(source.knowledge?.labSnapshotAt, committedAt)), labSnapshot: source.knowledge?.labSnapshot && typeof source.knowledge.labSnapshot === "object" ? clone(source.knowledge.labSnapshot) : {}, reports: Array.isArray(source.knowledge?.reports) ? clone(source.knowledge.reports) : [] },
      decision: { required: Boolean(source.decision?.required), kind: cleanId(source.decision?.kind), reason: String(source.decision?.reason || "").trim(), raisedAt: source.decision?.raisedAt == null ? null : Math.max(committedAt, finite(source.decision.raisedAt)) }, history: normalizeHistory(source.history)
    };
    stay.routine = routineAt(committedAt, stay.lastAdvancedAt, assignmentId, priorityId, stay.discipline);
    return stay;
  }

  function defaultState() { return { version: VERSION, stays: [], nextStayNumber: 1, nextRequestNumber: 1, nextSessionNumber: 1 }; }
  function normalizeState(candidate) { const source = candidate && typeof candidate === "object" ? candidate : {}; const stays = (Array.isArray(source.stays) ? source.stays : []).map(normalizeStay); return { version: VERSION, stays, nextStayNumber: Math.max(1, Math.floor(finite(source.nextStayNumber, stays.length + 1))), nextRequestNumber: Math.max(1, Math.floor(finite(source.nextRequestNumber, 1))), nextSessionNumber: Math.max(1, Math.floor(finite(source.nextSessionNumber, 1))) }; }
  function activeStay(candidate) { return normalizeState(candidate).stays.find((stay) => stay.status === "active") || null; }

  function commit(candidate, options = {}) {
    const state = normalizeState(candidate); const orderId = cleanId(options.orderId); const existing = state.stays.find((stay) => orderId && stay.orderId === orderId); if (existing) return { state, stay: existing, created: false };
    const committedAt = Math.max(0, finite(options.clock)); const id = `prison-stay-${state.nextStayNumber++}`; const seed = `${options.seed || "world"}:${id}`;
    const actors = [];
    for (let index = 0; index < 8; index += 1) actors.push({ id: `${id}-prisoner-${index + 1}`, name: actorName(seed, index), role: "prisoner", affiliation: AFFILIATIONS[hash(`${seed}:${index}:affiliation`) % AFFILIATIONS.length], shift: "resident", roomId: index < 4 ? "statePrisonHousing" : "statePrisonSecondDorm", mapCell: { x: 4 + index % 4, y: index < 4 ? 14 : 24, z: 5 } });
    const staffRoles = ["shiftSupervisor", "custodyOfficer", "custodyOfficer", "medicalOfficer", "programSupervisor"];
    for (let index = 0; index < staffRoles.length; index += 1) actors.push({ id: `${id}-staff-${index + 1}`, name: actorName(seed, index + 8), role: staffRoles[index], affiliation: "State Corrections Service", shift: index === 2 ? "swing" : "day", roomId: index === 3 ? "statePrisonClinic" : index === 4 ? "statePrisonProgram" : "statePrisonControl", mapCell: { x: 14 + index, y: index < 3 ? 6 : 24, z: 5 } });
    const facilityLabel = `${FACILITY_PREFIXES[hash(`${seed}:facility`) % FACILITY_PREFIXES.length]} Correctional Center`;
    const relationships = actors.filter((actor) => actor.role === "prisoner").map((actor, index) => ({ actorId: actor.id, score: (hash(`${seed}:${index}:relation`) % 21) - 10, lastChangedAt: committedAt, history: [{ at: committedAt, delta: 0, reason: "First impressions formed during intake and housing assignment." }] }));
    const stay = normalizeStay({ id, caseId: options.caseId, orderId, jailStayId: options.jailStayId, docket: options.docket, committedAt, facility: { id: `${id}-facility`, label: facilityLabel, roomIds: options.roomIds, capacity: 9, occupied: 9, strategicCapacity: 240, strategicPopulation: 268 }, transport: { id: `${id}-transport`, departedAt: Math.max(0, committedAt - HOUR), arrivedAt: committedAt, crewNames: actors.slice(8, 10).map((actor) => actor.name) }, sentence: { months: Math.min(120, Math.max(1, finite(options.incarcerationMonths, 3))), releaseAt: committedAt + Math.min(120, Math.max(1, finite(options.incarcerationMonths, 3))) * MONTH }, actors, relationships, suppressor: { id: `${id}-collar`, appliedAt: committedAt }, knowledge: { labSnapshotAt: committedAt, labSnapshot: options.labSnapshot }, history: [{ at: committedAt - HOUR, action: "jailTransfer", summary: "An armored transport removed the scientist from temporary jail after the court commitment became effective." }, { at: committedAt, action: "prisonIntake", summary: `The scientist entered ${facilityLabel}, a crowded finite-sentence prison; death remained the only game-over condition.` }, { at: committedAt, action: "suppressorApplied", summary: "Prison staff locked a warded collar backed by facility suppression wards." }] });
    state.stays.push(stay); return { state, stay, created: true };
  }

  function setPlan(candidate, stayId, options = {}, clock = 0) { const state = normalizeState(candidate); const stay = state.stays.find((entry) => entry.id === cleanId(stayId) && entry.status === "active"); if (!stay) return { state, stay, changed: false }; const assignmentId = ASSIGNMENTS.some((entry) => entry.id === options.assignmentId) ? options.assignmentId : stay.plan.assignmentId; const priorityId = PRIORITIES.some((entry) => entry.id === options.priorityId) ? options.priorityId : stay.plan.priorityId; const changed = assignmentId !== stay.plan.assignmentId || priorityId !== stay.plan.priorityId; stay.plan = { assignmentId, priorityId, savedAt: Math.max(stay.committedAt, finite(clock)) }; if (changed) stay.history.push({ at: stay.plan.savedAt, action: "routinePlan", summary: `${ASSIGNMENTS.find((entry) => entry.id === assignmentId).label} selected with ${PRIORITIES.find((entry) => entry.id === priorityId).label.toLowerCase()} priority.` }); return { state, stay, changed }; }
  function interact(candidate, stayId, actorId, kind = "conversation", clock = 0) { const state = normalizeState(candidate); const stay = state.stays.find((entry) => entry.id === cleanId(stayId) && entry.status === "active"); const actor = stay?.actors.find((entry) => entry.id === cleanId(actorId)); const relationship = stay?.relationships.find((entry) => entry.actorId === actor?.id); if (!stay || !actor || !relationship) return { state, stay, actor, relationship, changed: false }; const deltas = { conversation: 2, favor: 5, refusal: -4, intimidation: -8 }; const delta = deltas[kind] ?? 1; relationship.score = clamp(relationship.score + delta, -100, 100); relationship.band = relationshipBand(relationship.score).id; relationship.lastChangedAt = Math.max(stay.committedAt, finite(clock)); relationship.history.push({ at: relationship.lastChangedAt, delta, reason: `${actor.name}: ${kind} changed the relationship by ${delta}.` }); stay.history.push({ at: relationship.lastChangedAt, action: "prisonInteraction", summary: `${actor.name}: ${kind}; relationship is now ${relationshipBand(relationship.score).label.toLowerCase()}.` }); return { state, stay, actor, relationship, changed: true };
  }
  function recordViolation(candidate, stayId, kind, clock = 0) { const state = normalizeState(candidate); const stay = state.stays.find((entry) => entry.id === cleanId(stayId) && entry.status === "active"); if (!stay) return { state, stay, changed: false }; const severity = { refusal: 1, contraband: 2, violence: 3 }[kind] || 1; stay.discipline.standing = clamp(stay.discipline.standing - severity * 8, 0, 100); let response = "warning"; if (severity === 2 || stay.discipline.warnings >= 1) { response = "privilegeRestriction"; stay.discipline.privilegeRestrictionUntil = Math.max(stay.discipline.privilegeRestrictionUntil, clock + severity * DAY); } if (severity === 3 || stay.discipline.warnings >= 2) { response = "segregation"; stay.discipline.segregatedUntil = Math.max(stay.discipline.segregatedUntil, clock + severity * DAY); } stay.discipline.warnings += 1; const summary = `${kind} produced ${response}; standing is ${Math.round(stay.discipline.standing)}.`; stay.discipline.incidents.push({ at: clock, kind, response, summary }); stay.history.push({ at: clock, action: "discipline", summary }); stay.decision = { required: true, kind: "discipline", reason: summary, raisedAt: clock }; return { state, stay, response, changed: true }; }
  function clearDecision(candidate, stayId) { const state = normalizeState(candidate); const stay = state.stays.find((entry) => entry.id === cleanId(stayId)); if (!stay?.decision.required) return { state, stay, changed: false }; stay.decision = { required: false, kind: "", reason: "", raisedAt: null }; return { state, stay, changed: true }; }

  function requestCommunication(candidate, stayId, channelId, recipient, clock = 0) { const state = normalizeState(candidate); const stay = state.stays.find((entry) => entry.id === cleanId(stayId) && entry.status === "active"); const channel = CHANNELS.find((entry) => entry.id === cleanId(channelId)); if (!stay || !channel || stay.discipline.privilegeRestrictionUntil > clock) return { state, stay, request: null, changed: false }; const existing = stay.communications.requests.find((entry) => entry.channelId === channel.id && ["pending", "ready"].includes(entry.status)); if (existing) return { state, stay, request: existing, changed: false }; const request = normalizeRequest({ id: `prison-request-${state.nextRequestNumber++}`, channelId: channel.id, recipient, requestedAt: clock, readyAt: clock + channel.delayHours * HOUR, risk: channel.legal ? 0 : 35 }); stay.communications.requests.push(request); stay.history.push({ at: clock, action: "communicationRequested", summary: `${channel.label} access requested through prison scheduling.` }); return { state, stay, request, changed: true }; }
  function completeCommunication(candidate, stayId, requestId, clock = 0, report = {}) { const state = normalizeState(candidate); const stay = state.stays.find((entry) => entry.id === cleanId(stayId) && entry.status === "active"); const request = stay?.communications.requests.find((entry) => entry.id === cleanId(requestId)); const channel = CHANNELS.find((entry) => entry.id === request?.channelId); if (!stay || !request || request.status !== "ready" || !channel) return { state, stay, session: null, changed: false }; request.status = "completed"; request.completedAt = clock; const session = { id: `prison-session-${state.nextSessionNumber++}`, requestId: request.id, channelId: channel.id, startedAt: clock, endedAt: clock, monitored: channel.monitored, summary: `${channel.label} session completed${channel.monitored ? " under monitoring" : " as privileged legal communication"}.` }; stay.communications.sessions.push(session); if (report && typeof report === "object" && Object.keys(report).length) { stay.knowledge.labSnapshotAt = clock; stay.knowledge.labSnapshot = clone(report); stay.knowledge.reports.push({ ...clone(report), deliveredAt: clock, channelId: channel.id }); } stay.history.push({ at: clock, action: "communicationCompleted", summary: session.summary }); return { state, stay, session, changed: true }; }

  function advance(candidate, clock = 0) { const state = normalizeState(candidate); const stay = state.stays.find((entry) => entry.status === "active"); if (!stay) return { state, stay: null, changed: false, stopReason: "" }; const at = Math.max(stay.lastAdvancedAt, finite(clock)); const previousDay = Math.floor((stay.lastAdvancedAt - stay.committedAt) / DAY); const currentDay = Math.floor((at - stay.committedAt) / DAY); let changed = false; for (let day = previousDay + 1; day <= currentDay; day += 1) { const assignment = ASSIGNMENTS.find((entry) => entry.id === stay.plan.assignmentId) || ASSIGNMENTS[0]; if (stay.plan.priorityId === "refusal") { stay.discipline.standing = clamp(stay.discipline.standing - 3, 0, 100); stay.history.push({ at: stay.committedAt + day * DAY, action: "assignmentRefused", summary: `${assignment.label} was refused; discipline may follow.` }); stay.decision = { required: true, kind: "routineRefusal", reason: "Choose whether to comply with the assignment or accept discipline.", raisedAt: stay.committedAt + day * DAY }; } else { stay.assignment.daysCompleted += 1; stay.assignment.wages += assignment.wagePerDay; stay.assignment.skillPractice += assignment.kind === "recovery" ? 0.25 : 1; stay.assignment.participationRecord = clamp(stay.assignment.participationRecord + assignment.standingPerDay, 0, 100); stay.property.prisonWages += assignment.wagePerDay; stay.discipline.standing = clamp(stay.discipline.standing + assignment.standingPerDay, 0, 100); stay.history.push({ at: stay.committedAt + day * DAY, action: "dailyAssignment", summary: `${assignment.label} completed; ${assignment.wagePerDay} prison credits earned.` }); } changed = true; }
    for (const request of stay.communications.requests) if (request.status === "pending" && request.readyAt <= at) { request.status = "ready"; stay.decision = { required: true, kind: "communicationReady", reason: `${CHANNELS.find((entry) => entry.id === request.channelId)?.label || "Communication"} access is ready.`, raisedAt: request.readyAt }; changed = true; }
    stay.sentence.servedSeconds = clamp(at - stay.committedAt, 0, stay.sentence.months * MONTH); stay.lastAdvancedAt = at; const previousKind = stay.routine.currentKind; stay.routine = routineAt(stay.committedAt, at, stay.plan.assignmentId, stay.plan.priorityId, stay.discipline); if (stay.routine.currentKind !== previousKind) changed = true;
    if (at >= stay.sentence.releaseAt) { stay.status = "releaseDue"; stay.sentence.releaseDueAt = stay.sentence.releaseAt; stay.decision = { required: true, kind: "releaseDue", reason: "The finite sentence is complete; physical discharge processing is required.", raisedAt: stay.sentence.releaseAt }; stay.history.push({ at: stay.sentence.releaseAt, action: "releaseDue", summary: "The finite sentence ended. The scientist remains alive in physical custody pending discharge processing." }); changed = true; }
    return { state, stay, changed, stopReason: stay.decision.required ? stay.decision.kind : "" };
  }

  function nextEvent(candidate, clock = 0) { const stay = activeStay(candidate); if (!stay) return null; const events = [{ at: stay.routine.nextEventAt, kind: "routine", stayId: stay.id, label: stay.routine.nextEventLabel }, { at: stay.sentence.releaseAt, kind: "releaseDue", stayId: stay.id, label: "Finite sentence release boundary" }, ...stay.communications.requests.filter((entry) => entry.status === "pending").map((entry) => ({ at: entry.readyAt, kind: "communicationReady", stayId: stay.id, requestId: entry.id, label: `${CHANNELS.find((channel) => channel.id === entry.channelId)?.label || "Communication"} access` }))].filter((entry) => entry.at >= clock); return events.sort((a, b) => a.at - b.at || a.kind.localeCompare(b.kind))[0] || null; }

  return Object.freeze({ VERSION, HOUR, DAY, MONTH, STATUSES, ROUTINE, ASSIGNMENTS, PRIORITIES, CHANNELS, RELATIONSHIP_BANDS, defaultState, normalizeState, normalizeStay, activeStay, routineAt, relationshipBand, commit, setPlan, interact, recordViolation, clearDecision, requestCommunication, completeCommunication, advance, nextEvent });
}));
