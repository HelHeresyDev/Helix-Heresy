(function attachHelixJailCustody(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixJailCustody = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixJailCustody() {
  "use strict";

  const VERSION = 1;
  const HOUR = 3600;
  const STATUSES = Object.freeze(["active", "escaped", "released", "transferred"]);
  const OBSERVATIONS = Object.freeze([
    { id: "cellDoorProcedure", label: "Cell-door procedure", alert: 2 },
    { id: "suppressionCollar", label: "Suppressor collar", alert: 3 },
    { id: "surveillanceCoverage", label: "Surveillance coverage", alert: 4 },
    { id: "officerRoutine", label: "Officer routine", alert: 2 },
    { id: "networkControls", label: "Network controls", alert: 4 }
  ]);
  const CHANNELS = Object.freeze([
    { id: "companyPortal", label: "Company portal", delayHours: 4, monitored: true, legal: true },
    { id: "legalCounsel", label: "Legal counsel", delayHours: 2, monitored: false, legal: true },
    { id: "publicNetwork", label: "Public network", delayHours: 5, monitored: true, legal: true },
    { id: "codedContact", label: "Coded outside contact", delayHours: 8, monitored: true, legal: false }
  ]);
  const ROUTINE = Object.freeze([
    { id: "officerRound", label: "Officer round", offsetHours: 1, durationHours: 1 },
    { id: "meal", label: "Meal service", offsetHours: 3, durationHours: 1 },
    { id: "exercise", label: "Exercise period", offsetHours: 6, durationHours: 1 },
    { id: "communications", label: "Monitored communications", offsetHours: 9, durationHours: 2 },
    { id: "headcount", label: "Headcount", offsetHours: 13, durationHours: 1 },
    { id: "rest", label: "Locked-cell rest", offsetHours: 17, durationHours: 7 }
  ]);
  const GIVEN_NAMES = Object.freeze(["Mara", "Ivo", "Nia", "Dane", "Sera", "Oren", "Tamsin", "Cal"]);
  const SURNAMES = Object.freeze(["Vale", "Morrow", "Kade", "Dunn", "Rusk", "Sloane", "Voss", "Keene"]);

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function cleanId(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "");
  }

  function hash(seed) {
    const text = String(seed || "jail-custody");
    let value = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      value ^= text.charCodeAt(index);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function cleanCell(candidate, fallback = null) {
    if (!candidate || !Number.isFinite(Number(candidate.x)) || !Number.isFinite(Number(candidate.y))) return fallback;
    return { x: Math.round(Number(candidate.x)), y: Math.round(Number(candidate.y)), z: Math.round(Number(candidate.z) || 0) };
  }

  function normalizeHistory(candidate) {
    return (Array.isArray(candidate) ? candidate : []).map((entry) => ({
      at: Math.max(0, finite(entry?.at)), action: cleanId(entry?.action) || "updated",
      summary: String(entry?.summary || "Custody state updated.").trim()
    })).sort((left, right) => left.at - right.at);
  }

  function normalizeActor(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
      id: cleanId(source.id) || `jail-actor-${index + 1}`,
      name: String(source.name || `Custody Officer ${index + 1}`).trim(),
      role: source.role === "supervisor" ? "supervisor" : "custodyOfficer",
      shift: ["day", "swing", "night"].includes(source.shift) ? source.shift : "day",
      present: source.present !== false,
      roomId: cleanId(source.roomId) || "municipalHoldingGuardStation",
      mapCell: cleanCell(source.mapCell, { x: 22 + index, y: 7, z: 3 }),
      targetCell: cleanCell(source.targetCell),
      movementAccumulator: Math.max(0, finite(source.movementAccumulator)),
      inventory: source.inventory && typeof source.inventory === "object" ? source.inventory : null
    };
  }

  function normalizeRequest(candidate, index = 0) {
    const channel = CHANNELS.find((entry) => entry.id === candidate?.channelId) || CHANNELS[0];
    const requestedAt = Math.max(0, finite(candidate?.requestedAt));
    return {
      id: cleanId(candidate?.id) || `jail-request-${index + 1}`,
      channelId: channel.id, recipient: String(candidate?.recipient || channel.label).trim(),
      requestedAt, readyAt: Math.max(requestedAt, finite(candidate?.readyAt, requestedAt + channel.delayHours * HOUR)),
      status: ["pending", "ready", "completed", "denied"].includes(candidate?.status) ? candidate.status : "pending",
      completedAt: candidate?.completedAt == null ? null : Math.max(requestedAt, finite(candidate.completedAt)),
      risk: Math.max(0, Math.min(100, finite(candidate?.risk, channel.legal ? 0 : 25)))
    };
  }

  function routineAt(bookedAt, clock) {
    const elapsedHours = Math.max(0, clock - bookedAt) / HOUR;
    const dayHour = elapsedHours % 24;
    const current = ROUTINE.find((entry) => dayHour >= entry.offsetHours && dayHour < entry.offsetHours + entry.durationHours) || { id: "cellTime", label: "Locked-cell time", offsetHours: dayHour, durationHours: 1 };
    const cycleStart = clock - dayHour * HOUR;
    const next = ROUTINE.map((entry) => ({ ...entry, at: cycleStart + entry.offsetHours * HOUR }))
      .filter((entry) => entry.at > clock).sort((left, right) => left.at - right.at)[0]
      || { ...ROUTINE[0], at: cycleStart + (24 + ROUTINE[0].offsetHours) * HOUR };
    return { currentKind: current.id, currentLabel: current.label, nextEventAt: next.at, nextEventKind: next.id, nextEventLabel: next.label };
  }

  function normalizeStay(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const bookedAt = Math.max(0, finite(source.bookedAt));
    const observations = [...new Set((Array.isArray(source.knowledge?.securityObservations) ? source.knowledge.securityObservations : []).map(cleanId))]
      .filter((id) => OBSERVATIONS.some((entry) => entry.id === id));
    return {
      id: cleanId(source.id) || `jail-stay-${index + 1}`,
      raidId: cleanId(source.raidId), docket: String(source.docket || "Pretrial custody").trim(), detaineeId: "scientist",
      status: STATUSES.includes(source.status) ? source.status : "active", bookedAt,
      facility: {
        id: cleanId(source.facility?.id) || "municipal-holding", label: String(source.facility?.label || "Municipal Holding Facility").trim(),
        kind: "jail", cityLabel: String(source.facility?.cityLabel || "the local fortified city").trim(),
        roomIds: Array.isArray(source.facility?.roomIds) ? source.facility.roomIds.map(cleanId).filter(Boolean) : []
      },
      transport: {
        id: cleanId(source.transport?.id) || `custody-transport-${index + 1}`,
        label: String(source.transport?.label || "Armored custody van").trim(), vehicleClass: "armored custody vehicle",
        departedAt: Math.max(0, finite(source.transport?.departedAt, bookedAt - 900)), arrivedAt: Math.max(0, finite(source.transport?.arrivedAt, bookedAt)),
        crewNames: Array.isArray(source.transport?.crewNames) ? source.transport.crewNames.map(String) : []
      },
      actors: (Array.isArray(source.actors) ? source.actors : []).map(normalizeActor),
      suppressor: {
        id: cleanId(source.suppressor?.id) || `suppressor-collar-${index + 1}`, kind: "magicSuppressingCollar", label: "Warded magic-suppressing collar",
        status: ["locked", "disabled", "removed"].includes(source.suppressor?.status) ? source.suppressor.status : "locked",
        suppressionActive: source.suppressor?.suppressionActive !== false,
        condition: Math.max(0, Math.min(100, finite(source.suppressor?.condition, 100))),
        physicalStackId: cleanId(source.suppressor?.physicalStackId), toolInstanceId: cleanId(source.suppressor?.toolInstanceId),
        appliedAt: Math.max(0, finite(source.suppressor?.appliedAt, bookedAt)),
        removedAt: source.suppressor?.removedAt == null ? null : Math.max(0, finite(source.suppressor.removedAt))
      },
      routine: { ...routineAt(bookedAt, finite(source.routine?.updatedAt, bookedAt)), updatedAt: Math.max(bookedAt, finite(source.routine?.updatedAt, bookedAt)) },
      communications: {
        requests: (Array.isArray(source.communications?.requests) ? source.communications.requests : []).map(normalizeRequest),
        sessions: (Array.isArray(source.communications?.sessions) ? source.communications.sessions : []).map((session, sessionIndex) => ({
          id: cleanId(session?.id) || `jail-session-${sessionIndex + 1}`, requestId: cleanId(session?.requestId), channelId: cleanId(session?.channelId),
          startedAt: Math.max(0, finite(session?.startedAt)), endedAt: session?.endedAt == null ? null : Math.max(0, finite(session.endedAt)),
          monitored: Boolean(session?.monitored), summary: String(session?.summary || "").trim()
        }))
      },
      knowledge: {
        labSnapshotAt: Math.max(0, finite(source.knowledge?.labSnapshotAt, bookedAt)),
        labSnapshot: source.knowledge?.labSnapshot && typeof source.knowledge.labSnapshot === "object" ? { ...source.knowledge.labSnapshot } : {},
        reports: Array.isArray(source.knowledge?.reports) ? source.knowledge.reports.map((report) => ({ ...report })) : [],
        securityObservations: observations,
        facilityAlert: Math.max(0, Math.min(100, finite(source.knowledge?.facilityAlert)))
      },
      history: normalizeHistory(source.history)
    };
  }

  function defaultState() {
    return { version: VERSION, stays: [], nextStayNumber: 1, nextRequestNumber: 1, nextSessionNumber: 1 };
  }

  function normalizeState(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const stays = (Array.isArray(source.stays) ? source.stays : []).map(normalizeStay);
    return {
      version: VERSION, stays,
      nextStayNumber: Math.max(1, Math.floor(finite(source.nextStayNumber, stays.length + 1))),
      nextRequestNumber: Math.max(1, Math.floor(finite(source.nextRequestNumber, 1))),
      nextSessionNumber: Math.max(1, Math.floor(finite(source.nextSessionNumber, 1)))
    };
  }

  function activeStay(candidate) {
    return normalizeState(candidate).stays.find((stay) => stay.status === "active") || null;
  }

  function book(candidate, options = {}) {
    const state = normalizeState(candidate);
    const raidId = cleanId(options.raidId);
    const existing = state.stays.find((stay) => stay.raidId && stay.raidId === raidId);
    if (existing) return { state, stay: existing, created: false };
    const bookedAt = Math.max(0, finite(options.clock));
    const id = `jail-stay-${state.nextStayNumber++}`;
    const actorNames = [0, 1, 2].map((index) => `${GIVEN_NAMES[hash(`${options.seed}:${id}:${index}:given`) % GIVEN_NAMES.length]} ${SURNAMES[hash(`${options.seed}:${id}:${index}:surname`) % SURNAMES.length]}`);
    const stay = normalizeStay({
      id, raidId, docket: options.docket, bookedAt,
      facility: { id: options.facilityId, label: options.facilityLabel, roomIds: options.roomIds },
      transport: { id: `${id}-transport`, departedAt: Math.max(0, bookedAt - 900), arrivedAt: bookedAt, crewNames: actorNames.slice(0, 2) },
      actors: actorNames.map((name, index) => ({ id: `${id}-officer-${index + 1}`, name, role: index === 0 ? "supervisor" : "custodyOfficer", shift: ["day", "swing", "night"][index], mapCell: { x: 22 + index, y: 7, z: 3 } })),
      suppressor: { id: `${id}-collar`, appliedAt: bookedAt },
      knowledge: { labSnapshotAt: bookedAt, labSnapshot: options.labSnapshot },
      history: [
        { at: Math.max(0, bookedAt - 900), action: "transported", summary: "An armored custody vehicle transported the scientist from the laboratory to jail." },
        { at: bookedAt, action: "booked", summary: "The scientist was booked into temporary pretrial jail; death remained the only game-over condition." },
        { at: bookedAt, action: "suppressorApplied", summary: "Staff locked a warded collar around the scientist's neck, completely suppressing deliberate magic use." }
      ]
    });
    state.stays.push(stay);
    return { state, stay, created: true };
  }

  function advance(candidate, clock = 0) {
    const state = normalizeState(candidate);
    const stay = state.stays.find((entry) => entry.status === "active");
    if (!stay) return { state, stay: null, changed: false };
    const at = Math.max(stay.bookedAt, finite(clock));
    const previousKind = stay.routine.currentKind;
    stay.routine = { ...routineAt(stay.bookedAt, at), updatedAt: at };
    let changed = previousKind !== stay.routine.currentKind;
    if (changed) stay.history.push({ at, action: stay.routine.currentKind, summary: `${stay.routine.currentLabel} began according to the saved jail routine.` });
    for (const request of stay.communications.requests) {
      if (request.status === "pending" && request.readyAt <= at) { request.status = "ready"; changed = true; }
    }
    return { state, stay, changed };
  }

  function requestCommunication(candidate, stayId, channelId, recipient, clock = 0) {
    const state = normalizeState(candidate);
    const stay = state.stays.find((entry) => entry.id === cleanId(stayId) && entry.status === "active");
    const channel = CHANNELS.find((entry) => entry.id === cleanId(channelId));
    if (!stay || !channel) return { state, stay, request: null, changed: false };
    const existing = stay.communications.requests.find((request) => request.channelId === channel.id && ["pending", "ready"].includes(request.status));
    if (existing) return { state, stay, request: existing, changed: false };
    const requestedAt = Math.max(stay.bookedAt, finite(clock));
    const request = normalizeRequest({ id: `jail-request-${state.nextRequestNumber++}`, channelId: channel.id, recipient, requestedAt, readyAt: requestedAt + channel.delayHours * HOUR, risk: channel.legal ? 0 : 25 }, stay.communications.requests.length);
    stay.communications.requests.push(request);
    stay.history.push({ at: requestedAt, action: "communicationRequested", summary: `${channel.label} access was requested; jail scheduling and monitoring rules apply.` });
    return { state, stay, request, changed: true };
  }

  function completeCommunication(candidate, stayId, requestId, options = {}) {
    const state = normalizeState(candidate);
    const stay = state.stays.find((entry) => entry.id === cleanId(stayId) && entry.status === "active");
    const request = stay?.communications.requests.find((entry) => entry.id === cleanId(requestId));
    const channel = CHANNELS.find((entry) => entry.id === request?.channelId);
    if (!stay || !request || !channel || request.status !== "ready") return { state, stay, session: null, changed: false };
    const clock = Math.max(request.readyAt, finite(options.clock));
    request.status = "completed"; request.completedAt = clock;
    const session = { id: `jail-session-${state.nextSessionNumber++}`, requestId: request.id, channelId: channel.id, startedAt: clock, endedAt: clock + 1800, monitored: channel.monitored, summary: String(options.summary || `${channel.label} session completed under jail access controls.`) };
    stay.communications.sessions.push(session);
    if (options.report && typeof options.report === "object") stay.knowledge.reports.push({ ...options.report, channelId: channel.id, deliveredAt: clock });
    if (!channel.legal) stay.knowledge.facilityAlert = Math.min(100, stay.knowledge.facilityAlert + 15);
    stay.history.push({ at: clock, action: "communicationCompleted", summary: session.summary });
    return { state, stay, session, changed: true };
  }

  function observeSecurity(candidate, stayId, observationId, clock = 0) {
    const state = normalizeState(candidate);
    const stay = state.stays.find((entry) => entry.id === cleanId(stayId) && entry.status === "active");
    const observation = OBSERVATIONS.find((entry) => entry.id === cleanId(observationId));
    if (!stay || !observation || stay.knowledge.securityObservations.includes(observation.id)) return { state, stay, observation, changed: false };
    stay.knowledge.securityObservations.push(observation.id);
    stay.knowledge.facilityAlert = Math.min(100, stay.knowledge.facilityAlert + observation.alert);
    stay.history.push({ at: Math.max(stay.bookedAt, finite(clock)), action: "securityObserved", summary: `${observation.label} was recorded as a distinct, non-repeatable observation.` });
    return { state, stay, observation, changed: true };
  }

  function disableSuppressor(candidate, stayId, clock = 0, reason = "Disabled during escape") {
    const state = normalizeState(candidate);
    const stay = state.stays.find((entry) => entry.id === cleanId(stayId));
    if (!stay || !stay.suppressor.suppressionActive) return { state, stay, changed: false };
    stay.suppressor.status = "disabled"; stay.suppressor.suppressionActive = false; stay.suppressor.condition = 0; stay.suppressor.removedAt = Math.max(stay.bookedAt, finite(clock));
    stay.history.push({ at: stay.suppressor.removedAt, action: "suppressorDisabled", summary: String(reason) });
    return { state, stay, changed: true };
  }

  function escape(candidate, stayId, clock = 0, options = {}) {
    let state = normalizeState(candidate);
    let stay = state.stays.find((entry) => entry.id === cleanId(stayId));
    if (!stay || stay.status !== "active" || (!options.completedPlanId && stay.knowledge.securityObservations.length < OBSERVATIONS.length)) return { state, stay, changed: false };
    ({ state, stay } = disableSuppressor(state, stay.id, clock, options.reason || "The scientist physically disabled and removed the warded collar during the completed escape plan."));
    stay.status = "escaped";
    stay.history.push({ at: Math.max(stay.bookedAt, finite(clock)), action: "escaped", summary: options.summary || `The scientist completed escape plan ${cleanId(options.completedPlanId) || "provisional"}; the run continued under fugitive pressure.` });
    return { state, stay, changed: true };
  }

  function resecure(candidate, stayId, clock = 0, options = {}) {
    const state = normalizeState(candidate); const stay = state.stays.find((entry) => entry.id === cleanId(stayId));
    if (!stay || stay.status !== "active") return { state, stay, changed: false };
    const at = Math.max(stay.bookedAt, finite(clock));
    stay.suppressor = {
      id: cleanId(options.suppressorId) || `${stay.id}-replacement-suppressor`, kind: "magicSuppressingCollar", label: "Warded magic-suppressing collar",
      status: "locked", suppressionActive: true, condition: 100, physicalStackId: "", toolInstanceId: "", appliedAt: at, removedAt: null
    };
    stay.knowledge.facilityAlert = Math.min(100, stay.knowledge.facilityAlert + Math.max(0, finite(options.alertGain, 25)));
    for (const request of stay.communications.requests) if (["pending", "ready"].includes(request.status) && request.channelId !== "legalCounsel") request.status = "denied";
    stay.history.push({ at, action: "escapeRecaptured", summary: String(options.summary || "Officers recaptured the scientist, confiscated the escape equipment, restricted nonlegal communications, and fitted a replacement suppressor.").trim() });
    return { state, stay, changed: true };
  }

  function release(candidate, stayId, clock = 0, summary = "The court authorized release from temporary pretrial jail.") {
    const state = normalizeState(candidate);
    const stay = state.stays.find((entry) => entry.id === cleanId(stayId));
    if (!stay || stay.status !== "active") return { state, stay, changed: false };
    const at = Math.max(stay.bookedAt, finite(clock));
    stay.status = "released";
    stay.suppressor.status = "removed";
    stay.suppressor.suppressionActive = false;
    stay.suppressor.removedAt = at;
    stay.history.push({ at, action: "released", summary: String(summary).trim() });
    return { state, stay, changed: true };
  }

  function remand(candidate, stayId, clock = 0, options = {}) {
    const state = normalizeState(candidate); const stay = state.stays.find((entry) => entry.id === cleanId(stayId));
    if (!stay || !["released", "transferred"].includes(stay.status)) return { state, stay, changed: false };
    const at = Math.max(stay.bookedAt, finite(clock)); stay.status = "active";
    stay.transport = { id: cleanId(options.transportId) || `${stay.id}-sentencing-remand`, label: "Armored court remand vehicle", vehicleClass: "armored custody vehicle", departedAt: Math.max(stay.bookedAt, at - 1800), arrivedAt: at, crewNames: Array.isArray(options.crewNames) ? options.crewNames.map(String) : [] };
    stay.suppressor = { id: cleanId(options.suppressorId) || `${stay.id}-sentencing-collar`, kind: "magicSuppressingCollar", label: "Warded magic-suppressing collar", status: "locked", suppressionActive: true, condition: 100, physicalStackId: "", toolInstanceId: "", appliedAt: at, removedAt: null };
    stay.routine = { ...routineAt(at, at), updatedAt: at }; stay.history.push({ at, action: options.action === "appellateRemand" ? "appellateRemand" : "sentencingRemand", summary: String(options.summary || "A court custody vehicle returned the convicted scientist to temporary jail for the saved commitment-transfer window.").trim() });
    return { state, stay, changed: true };
  }

  function nextEvent(candidate, clock = 0) {
    const stay = activeStay(candidate);
    if (!stay) return null;
    const pending = stay.communications.requests.filter((request) => request.status === "pending").sort((left, right) => left.readyAt - right.readyAt)[0];
    const routine = routineAt(stay.bookedAt, Math.max(stay.bookedAt, finite(clock)));
    const at = Math.min(pending?.readyAt ?? Infinity, routine.nextEventAt);
    return { at, kind: pending && pending.readyAt === at ? "communicationReady" : routine.nextEventKind, label: pending && pending.readyAt === at ? `${CHANNELS.find((entry) => entry.id === pending.channelId)?.label} ready` : routine.nextEventLabel };
  }

  return Object.freeze({ VERSION, OBSERVATIONS, CHANNELS, ROUTINE, defaultState, normalizeState, activeStay, book, advance, requestCommunication, completeCommunication, observeSecurity, disableSuppressor, escape, resecure, release, remand, nextEvent });
}));
