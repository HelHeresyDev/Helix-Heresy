(function attachHelixSiteVisits(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixSiteVisits = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixSiteVisits() {
  "use strict";

  const VERSION = 1;
  const VISITOR_TYPES = Object.freeze([
    {
      id: "registryAuditor", label: "Commercial Registry auditor", actorLabel: "Registry Auditor",
      institutionId: "commercial-registry", accessPointId: "publicEntrance", inspector: true,
      mandate: "Verify the front company's registration, filed declarations, and supporting records.",
      agenda: [
        { id: "reception", roomId: "surfaceReception", label: "Public reception", method: "walkthrough", dwellSeconds: 8 },
        { id: "staff", roomId: "surfaceStaffOperations", label: "Staff Operations", method: "walkthrough", dwellSeconds: 12, requiresAccess: true },
        { id: "records", roomId: "surfaceStaffOperations", fixtureId: "starter-surface-records-cabinet", label: "Company record packet", method: "recordsReview", dwellSeconds: 45, requiresAccess: true, requiresFixtureAccess: true }
      ]
    },
    {
      id: "environmentalInspector", label: "Environmental and public-health inspector", actorLabel: "Environmental Inspector",
      institutionId: "environmental-health", accessPointId: "publicEntrance", inspector: true,
      mandate: "Inspect declared processing, hazardous storage, waste controls, and transfer records.",
      agenda: [
        { id: "reception", roomId: "surfaceReception", label: "Public reception", method: "walkthrough", dwellSeconds: 8 },
        { id: "process", roomId: "surfaceFacility", label: "Process Hall", method: "walkthrough", dwellSeconds: 18, requiresAccess: true },
        { id: "hazard", roomId: "surfaceHazardousStorage", label: "Hazardous Storage", method: "sampling", dwellSeconds: 30, requiresAccess: true },
        { id: "loading", roomId: "surfaceLoadingBay", label: "Loading Bay", method: "wasteReview", dwellSeconds: 22, requiresAccess: true }
      ]
    },
    {
      id: "wasteCarrier", label: "Licensed waste carrier", actorLabel: "Waste Carrier",
      institutionId: "environmental-health", accessPointId: "loadingBay", inspector: false,
      mandate: "Collect prepared lawful waste and reconcile the custody manifest at the Loading Bay.",
      agenda: [
        { id: "loading", roomId: "surfaceLoadingBay", label: "Loading Bay collection point", method: "custodyReview", dwellSeconds: 20 }
      ]
    },
    {
      id: "routineCourier", label: "Routine client or courier", actorLabel: "Courier",
      institutionId: "environmental-health", accessPointId: "publicEntrance", inspector: false,
      mandate: "Complete ordinary public-facing business without inspection authority.",
      agenda: [
        { id: "reception", roomId: "surfaceReception", label: "Public reception", method: "walkthrough", dwellSeconds: 12 }
      ]
    }
  ]);
  const TYPE_BY_ID = Object.freeze(Object.fromEntries(VISITOR_TYPES.map((entry) => [entry.id, entry])));
  const PHASES = Object.freeze(["scheduled", "arriving", "waiting", "inspecting", "departing", "completed"]);
  const DECISIONS = Object.freeze(["pending", "granted", "denied"]);

  function cleanId(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "");
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function cleanCell(candidate) {
    if (!candidate || !Number.isFinite(Number(candidate.x)) || !Number.isFinite(Number(candidate.y))) return null;
    return { x: Math.round(Number(candidate.x)), y: Math.round(Number(candidate.y)), z: Math.round(Number(candidate.z) || 0) };
  }

  function uniqueIds(values) {
    return [...new Set((Array.isArray(values) ? values : []).map(cleanId).filter(Boolean))];
  }

  function visitType(id) {
    return TYPE_BY_ID[cleanId(id)] || TYPE_BY_ID.routineCourier;
  }

  function normalizeAgendaItem(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
      id: cleanId(source.id) || `agenda-${index + 1}`,
      roomId: cleanId(source.roomId), fixtureId: cleanId(source.fixtureId),
      label: String(source.label || "Visit stop").trim(), method: cleanId(source.method) || "walkthrough",
      dwellSeconds: Math.max(1, finite(source.dwellSeconds, 10)), requiresAccess: Boolean(source.requiresAccess),
      requiresFixtureAccess: Boolean(source.requiresFixtureAccess), status: ["pending", "active", "completed", "skipped"].includes(source.status) ? source.status : "pending",
      startedAt: source.startedAt == null ? null : Math.max(0, finite(source.startedAt)), completedAt: source.completedAt == null ? null : Math.max(0, finite(source.completedAt)),
      dwellProgress: Math.max(0, finite(source.dwellProgress)), route: (Array.isArray(source.route) ? source.route : []).map(cleanCell).filter(Boolean),
      routeIndex: Math.max(0, Math.floor(finite(source.routeIndex))), blockReason: String(source.blockReason || "").trim()
    };
  }

  function normalizeRequest(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const decision = DECISIONS.includes(source.decision) ? source.decision : "pending";
    return {
      id: cleanId(source.id) || `access-request-${index + 1}`, targetKind: cleanId(source.targetKind) || "room",
      targetId: cleanId(source.targetId), label: String(source.label || "Requested access").trim(),
      requestedAt: Math.max(0, finite(source.requestedAt)), decision,
      decidedAt: source.decidedAt == null ? null : Math.max(0, finite(source.decidedAt)),
      mandate: source.mandate !== false, obstructionRecorded: Boolean(source.obstructionRecorded)
    };
  }

  function normalizeObservation(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
      id: cleanId(source.id) || `visit-observation-${index + 1}`, evidenceId: cleanId(source.evidenceId),
      agendaId: cleanId(source.agendaId), method: cleanId(source.method) || "walkthrough",
      firstObservedAt: Math.max(0, finite(source.firstObservedAt)), lastObservedAt: Math.max(0, finite(source.lastObservedAt)),
      progress: Math.max(0, finite(source.progress)), threshold: Math.max(0, finite(source.threshold)),
      status: source.status === "confirmed" ? "confirmed" : "examining", findingId: cleanId(source.findingId)
    };
  }

  function normalizeFinding(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
      id: cleanId(source.id) || `visit-finding-${index + 1}`, kind: cleanId(source.kind) || "physicalEvidence",
      evidenceId: cleanId(source.evidenceId), agendaId: cleanId(source.agendaId),
      label: String(source.label || "Inspection finding").trim(), summary: String(source.summary || "A visitor confirmed a local condition.").trim(),
      discoveredAt: Math.max(0, finite(source.discoveredAt)), reliability: ["weak", "credible", "strong"].includes(source.reliability) ? source.reliability : "strong",
      reportId: cleanId(source.reportId), disclosed: source.disclosed !== false
    };
  }

  function normalizeVisit(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const type = visitType(source.typeId);
    const phase = PHASES.includes(source.phase) ? source.phase : "scheduled";
    const agendaSource = Array.isArray(source.agenda) && source.agenda.length ? source.agenda : type.agenda;
    return {
      id: cleanId(source.id) || `site-visit-${index + 1}`, typeId: type.id, visitorLabel: String(source.visitorLabel || type.actorLabel).trim(),
      institutionId: cleanId(source.institutionId) || type.institutionId, inspector: source.inspector == null ? type.inspector : Boolean(source.inspector),
      mandate: String(source.mandate || type.mandate).trim(), accessPointId: cleanId(source.accessPointId) || type.accessPointId,
      noticeAt: Math.max(0, finite(source.noticeAt)), arrivalWindow: {
        start: Math.max(0, finite(source.arrivalWindow?.start, source.arrivalAt)),
        end: Math.max(0, finite(source.arrivalWindow?.end, finite(source.arrivalWindow?.start, source.arrivalAt) + 3600))
      },
      arrivalAt: Math.max(0, finite(source.arrivalAt, source.arrivalWindow?.start)), phase,
      startedAt: source.startedAt == null ? null : Math.max(0, finite(source.startedAt)), completedAt: source.completedAt == null ? null : Math.max(0, finite(source.completedAt)),
      actor: {
        id: cleanId(source.actor?.id) || `visitor-actor-${index + 1}`, mapCell: cleanCell(source.actor?.mapCell), roomId: cleanId(source.actor?.roomId),
        present: Boolean(source.actor?.present), movementAccumulator: Math.max(0, finite(source.actor?.movementAccumulator)), facing: cleanId(source.actor?.facing) || "south"
      },
      agenda: agendaSource.map(normalizeAgendaItem), agendaIndex: Math.max(0, Math.floor(finite(source.agendaIndex))),
      requests: (Array.isArray(source.requests) ? source.requests : []).map(normalizeRequest),
      grantedRoomIds: uniqueIds(source.grantedRoomIds), grantedFixtureIds: uniqueIds(source.grantedFixtureIds),
      observations: (Array.isArray(source.observations) ? source.observations : []).map(normalizeObservation),
      findings: (Array.isArray(source.findings) ? source.findings : []).map(normalizeFinding),
      routeHistory: (Array.isArray(source.routeHistory) ? source.routeHistory : []).map((entry) => ({ at: Math.max(0, finite(entry?.at)), cell: cleanCell(entry?.cell), roomId: cleanId(entry?.roomId), agendaId: cleanId(entry?.agendaId) })).filter((entry) => entry.cell),
      obstructionIds: uniqueIds(source.obstructionIds), disclosedSummary: String(source.disclosedSummary || "").trim()
    };
  }

  function defaultState() {
    return { version: VERSION, visits: [], nextVisitNumber: 1, nextRequestNumber: 1, nextObservationNumber: 1, nextFindingNumber: 1 };
  }

  function normalizeState(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const visits = (Array.isArray(source.visits) ? source.visits : []).map(normalizeVisit);
    const nextFromIds = (records, prefix, fallback) => records.reduce((maximum, record) => {
      const match = String(record.id || "").match(new RegExp(`${prefix}(\\d+)$`));
      return Math.max(maximum, match ? Number(match[1]) + 1 : 1);
    }, Math.max(1, Math.floor(finite(fallback, 1))));
    const requests = visits.flatMap((visit) => visit.requests);
    const observations = visits.flatMap((visit) => visit.observations);
    const findings = visits.flatMap((visit) => visit.findings);
    return {
      version: VERSION, visits,
      nextVisitNumber: nextFromIds(visits, "site-visit-", source.nextVisitNumber),
      nextRequestNumber: nextFromIds(requests, "access-request-", source.nextRequestNumber),
      nextObservationNumber: nextFromIds(observations, "visit-observation-", source.nextObservationNumber),
      nextFindingNumber: nextFromIds(findings, "visit-finding-", source.nextFindingNumber)
    };
  }

  function scheduleVisit(candidate, options = {}) {
    const state = normalizeState(candidate);
    const type = visitType(options.typeId);
    const id = `site-visit-${state.nextVisitNumber++}`;
    const arrivalAt = Math.max(0, finite(options.arrivalAt));
    const noticeAt = Math.min(arrivalAt, Math.max(0, finite(options.noticeAt, arrivalAt - 86400)));
    const visit = normalizeVisit({
      id, typeId: type.id, visitorLabel: options.visitorLabel || type.actorLabel, institutionId: type.institutionId,
      inspector: type.inspector, mandate: type.mandate, accessPointId: type.accessPointId,
      noticeAt, arrivalAt, arrivalWindow: { start: arrivalAt, end: Math.max(arrivalAt, finite(options.arrivalWindowEnd, arrivalAt + 3600)) },
      actor: { id: `visitor-actor-${id}`, present: false }, agenda: type.agenda
    }, state.visits.length);
    state.visits.push(visit);
    return { state, visit };
  }

  function seedInitialSchedule(candidate, options = {}) {
    let state = normalizeState(candidate);
    if (state.visits.length || options.enabled === false) return state;
    const origin = Math.max(0, finite(options.clock));
    const schedule = [
      ["routineCourier", 8 * 3600], ["registryAuditor", 24 * 3600],
      ["wasteCarrier", 42 * 3600], ["environmentalInspector", 72 * 3600]
    ];
    for (const [typeId, delay] of schedule) {
      state = scheduleVisit(state, { typeId, arrivalAt: origin + delay, noticeAt: origin, arrivalWindowEnd: origin + delay + 3600 }).state;
    }
    return state;
  }

  function visitById(state, visitId) {
    return normalizeState(state).visits.find((visit) => visit.id === cleanId(visitId)) || null;
  }

  function ensureAccessRequest(candidate, visitId, options = {}) {
    const state = normalizeState(candidate);
    const visit = state.visits.find((entry) => entry.id === cleanId(visitId));
    if (!visit) return { state, request: null, created: false };
    const targetKind = cleanId(options.targetKind) || "room";
    const targetId = cleanId(options.targetId);
    const existing = visit.requests.find((entry) => entry.targetKind === targetKind && entry.targetId === targetId);
    if (existing) return { state, request: existing, created: false };
    const request = normalizeRequest({
      id: `access-request-${state.nextRequestNumber++}`, targetKind, targetId,
      label: options.label, requestedAt: options.requestedAt, mandate: options.mandate !== false
    }, visit.requests.length);
    visit.requests.push(request);
    visit.phase = "waiting";
    return { state, request, created: true };
  }

  function decideAccess(candidate, visitId, requestId, decision, clock) {
    const state = normalizeState(candidate);
    const visit = state.visits.find((entry) => entry.id === cleanId(visitId));
    const request = visit?.requests.find((entry) => entry.id === cleanId(requestId));
    if (!visit || !request || request.decision !== "pending" || !["granted", "denied"].includes(decision)) return { state, visit, request, changed: false };
    request.decision = decision;
    request.decidedAt = Math.max(0, finite(clock));
    if (decision === "granted") {
      const key = request.targetKind === "fixture" ? "grantedFixtureIds" : "grantedRoomIds";
      visit[key] = uniqueIds([...visit[key], request.targetId]);
      visit.phase = "inspecting";
    } else if (request.mandate) {
      const obstructionId = `obstruction:${request.id}`;
      visit.obstructionIds = uniqueIds([...visit.obstructionIds, obstructionId]);
      request.obstructionRecorded = true;
    }
    return { state, visit, request, changed: true };
  }

  function grantMandate(candidate, visitId, clock) {
    let state = normalizeState(candidate);
    const visit = state.visits.find((entry) => entry.id === cleanId(visitId));
    if (!visit) return { state, visit: null, changed: false };
    let changed = false;
    for (const item of visit.agenda.filter((entry) => entry.requiresAccess)) {
      let result = ensureAccessRequest(state, visit.id, { targetKind: "room", targetId: item.roomId, label: item.label, requestedAt: clock, mandate: true });
      state = result.state;
      result = decideAccess(state, visit.id, result.request.id, "granted", clock);
      state = result.state;
      changed = changed || result.changed;
      if (item.requiresFixtureAccess && item.fixtureId) {
        let fixtureResult = ensureAccessRequest(state, visit.id, { targetKind: "fixture", targetId: item.fixtureId, label: item.label, requestedAt: clock, mandate: true });
        state = fixtureResult.state;
        fixtureResult = decideAccess(state, visit.id, fixtureResult.request.id, "granted", clock);
        state = fixtureResult.state;
        changed = changed || fixtureResult.changed;
      }
    }
    return { state, visit: state.visits.find((entry) => entry.id === cleanId(visitId)), changed };
  }

  function recordObservation(candidate, visitId, options = {}) {
    const state = normalizeState(candidate);
    const visit = state.visits.find((entry) => entry.id === cleanId(visitId));
    if (!visit) return { state, observation: null, finding: null, confirmed: false };
    const evidenceId = cleanId(options.evidenceId);
    const agendaId = cleanId(options.agendaId);
    let observation = visit.observations.find((entry) => entry.evidenceId === evidenceId && entry.agendaId === agendaId);
    if (!observation) {
      observation = normalizeObservation({
        id: `visit-observation-${state.nextObservationNumber++}`, evidenceId, agendaId, method: options.method,
        firstObservedAt: options.clock, lastObservedAt: options.clock, threshold: options.threshold
      }, visit.observations.length);
      visit.observations.push(observation);
    }
    if (observation.status === "confirmed") return { state, observation, finding: visit.findings.find((entry) => entry.id === observation.findingId) || null, confirmed: false };
    observation.lastObservedAt = Math.max(observation.lastObservedAt, finite(options.clock));
    observation.threshold = Math.max(0, finite(options.threshold, observation.threshold));
    observation.progress += Math.max(0, finite(options.progress));
    if (observation.progress < observation.threshold) return { state, observation, finding: null, confirmed: false };
    const finding = normalizeFinding({
      id: `visit-finding-${state.nextFindingNumber++}`, kind: options.kind, evidenceId, agendaId,
      label: options.label, summary: options.summary, discoveredAt: options.clock,
      reliability: options.reliability, disclosed: options.disclosed
    }, visit.findings.length);
    visit.findings.push(finding);
    observation.status = "confirmed";
    observation.findingId = finding.id;
    return { state, observation, finding, confirmed: true };
  }

  function markComplete(candidate, visitId, clock, summary = "") {
    const state = normalizeState(candidate);
    const visit = state.visits.find((entry) => entry.id === cleanId(visitId));
    if (!visit) return { state, visit: null };
    visit.phase = "completed";
    visit.completedAt = Math.max(0, finite(clock));
    visit.actor.present = false;
    visit.disclosedSummary = String(summary || (visit.findings.length ? `${visit.findings.length} finding${visit.findings.length === 1 ? "" : "s"} recorded.` : "Visit completed without a disclosed finding.")).trim();
    return { state, visit };
  }

  function activeVisit(candidate) {
    return normalizeState(candidate).visits.find((visit) => !["scheduled", "completed"].includes(visit.phase)) || null;
  }

  function nextEvent(candidate, clock) {
    const state = normalizeState(candidate);
    return state.visits.filter((visit) => visit.phase === "scheduled" && visit.arrivalAt >= finite(clock))
      .sort((left, right) => left.arrivalAt - right.arrivalAt)[0] || null;
  }

  return {
    VERSION, VISITOR_TYPES, TYPE_BY_ID, PHASES, DECISIONS,
    cleanId, cleanCell, visitType, normalizeAgendaItem, normalizeRequest, normalizeObservation, normalizeFinding, normalizeVisit,
    defaultState, normalizeState, scheduleVisit, seedInitialSchedule, visitById, ensureAccessRequest, decideAccess, grantMandate,
    recordObservation, markComplete, activeVisit, nextEvent
  };
}));
