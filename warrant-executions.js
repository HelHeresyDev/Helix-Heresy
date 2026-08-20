(function attachHelixWarrantExecutions(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixWarrantExecutions = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixWarrantExecutions() {
  "use strict";

  const VERSION = 1;
  const HOUR = 3600;
  const STATUSES = Object.freeze(["issued", "scheduled", "active", "completed", "obstructed", "deferred"]);
  const TARGET_STATUSES = Object.freeze(["pending", "searched", "denied", "inaccessible"]);
  const SEIZURE_STATUSES = Object.freeze(["located", "carried", "externalized"]);

  const SCOPE_TEMPLATES = Object.freeze({
    registryRecords: Object.freeze({
      id: "registryRecords", label: "Commercial records search and seizure",
      supported: true, visitTypeId: "registryWarrantOfficer", entryPointId: "publicEntrance",
      purpose: "Search the declared company records repository and seize responsive physical packets.",
      targets: Object.freeze([
        Object.freeze({
          id: "company-records", roomId: "surfaceStaffOperations", fixtureId: "starter-surface-records-cabinet",
          label: "Company Records Cabinet", method: "warrantRecordsSearch",
          subjectCategories: Object.freeze(["companyRecords"]), maxSubjects: 8
        })
      ])
    }),
    environmentalSearch: Object.freeze({
      id: "environmentalSearch", label: "Environmental search and sampling",
      supported: true, visitTypeId: "environmentalWarrantOfficer", entryPointId: "publicEntrance",
      purpose: "Search declared processing and waste areas and take bounded physical samples or responsive records.",
      targets: Object.freeze([
        Object.freeze({
          id: "process-sample", roomId: "surfaceFacility", label: "Process Hall sampling area",
          method: "warrantSampling", subjectCategories: Object.freeze(["hazardousMaterial", "chemicalProduct"]), maxSubjects: 1
        }),
        Object.freeze({
          id: "hazard-sample", roomId: "surfaceHazardousStorage", label: "Hazardous Storage sampling area",
          method: "warrantSampling", subjectCategories: Object.freeze(["hazardousMaterial", "wasteMaterial"]), maxSubjects: 1
        }),
        Object.freeze({
          id: "waste-records", roomId: "surfaceLoadingBay", label: "Loading Bay waste and transfer records",
          method: "warrantWasteSearch", subjectCategories: Object.freeze(["disposalManifest", "wasteMaterial"]), maxSubjects: 2
        })
      ])
    }),
    deferredRaid: Object.freeze({
      id: "deferredRaid", label: "Law-enforcement warrant",
      supported: false, visitTypeId: "", entryPointId: "publicEntrance",
      purpose: "Await the separate forced-entry and raid implementation.", targets: Object.freeze([])
    })
  });

  function cleanId(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "");
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function uniqueIds(values) {
    return [...new Set((Array.isArray(values) ? values : []).map(cleanId).filter(Boolean))];
  }

  function uniqueText(values) {
    return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
  }

  function unitRoll(seed) {
    const text = String(seed || "warrant-execution");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash += hash << 13; hash ^= hash >>> 7;
    hash += hash << 3; hash ^= hash >>> 17; hash += hash << 5;
    return (hash >>> 0) / 4294967296;
  }

  function templateFor(action, demand) {
    if (action?.institutionId === "law-enforcement") return SCOPE_TEMPLATES.deferredRaid;
    if (action?.institutionId === "commercial-registry") return SCOPE_TEMPLATES.registryRecords;
    if (action?.institutionId === "environmental-health") return SCOPE_TEMPLATES.environmentalSearch;
    if (["hazardousDischarge", "wasteHandling", "siteConditions"].includes(demand?.family)) return SCOPE_TEMPLATES.environmentalSearch;
    return SCOPE_TEMPLATES.deferredRaid;
  }

  function normalizeTarget(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
      id: cleanId(source.id) || `scope-target-${index + 1}`,
      roomId: cleanId(source.roomId), fixtureId: cleanId(source.fixtureId),
      label: String(source.label || "Authorized search target").trim(),
      method: cleanId(source.method) || "warrantSearch",
      subjectCategories: uniqueText(source.subjectCategories),
      maxSubjects: Math.max(0, Math.floor(finite(source.maxSubjects, 1))),
      status: TARGET_STATUSES.includes(source.status) ? source.status : "pending",
      searchedAt: source.searchedAt == null ? null : Math.max(0, finite(source.searchedAt)),
      observedSubjectIds: uniqueIds(source.observedSubjectIds),
      seizedSubjectIds: uniqueIds(source.seizedSubjectIds),
      reason: String(source.reason || "").trim()
    };
  }

  function normalizeScope(candidate, template = SCOPE_TEMPLATES.deferredRaid) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const targets = (Array.isArray(source.targets) && source.targets.length ? source.targets : template.targets).map(normalizeTarget);
    return {
      id: cleanId(source.id) || template.id,
      label: String(source.label || template.label).trim(),
      purpose: String(source.purpose || template.purpose).trim(),
      supported: source.supported == null ? Boolean(template.supported) : Boolean(source.supported),
      visitTypeId: cleanId(source.visitTypeId) || template.visitTypeId,
      entryPointId: cleanId(source.entryPointId) || template.entryPointId,
      authorizedRoomIds: uniqueIds(source.authorizedRoomIds?.length ? source.authorizedRoomIds : targets.map((target) => target.roomId)),
      authorizedFixtureIds: uniqueIds(source.authorizedFixtureIds?.length ? source.authorizedFixtureIds : targets.map((target) => target.fixtureId)),
      subjectCategories: uniqueText(source.subjectCategories?.length ? source.subjectCategories : targets.flatMap((target) => target.subjectCategories)),
      namedActorIds: uniqueIds(source.namedActorIds), targets
    };
  }

  function normalizeCustodyEntry(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
      at: Math.max(0, finite(source.at)), action: cleanId(source.action) || "located",
      actorId: cleanId(source.actorId), roomId: cleanId(source.roomId),
      accessPointId: cleanId(source.accessPointId), details: String(source.details || "").trim()
    };
  }

  function normalizeSeizure(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
      id: cleanId(source.id) || `warrant-seizure-${index + 1}`,
      targetId: cleanId(source.targetId), sourceSubjectId: cleanId(source.sourceSubjectId),
      subjectKind: cleanId(source.subjectKind) || "physicalStack", subjectId: cleanId(source.subjectId),
      label: String(source.label || "Seized subject").trim(), quantity: Math.max(0, finite(source.quantity, 1)),
      status: SEIZURE_STATUSES.includes(source.status) ? source.status : "located",
      locatedAt: Math.max(0, finite(source.locatedAt)),
      externalizedAt: source.externalizedAt == null ? null : Math.max(0, finite(source.externalizedAt)),
      custody: (Array.isArray(source.custody) ? source.custody : []).map(normalizeCustodyEntry)
    };
  }

  function normalizeReturn(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    return {
      completedAt: Math.max(0, finite(candidate.completedAt)), outcome: candidate.outcome === "obstructed" ? "obstructed" : "completed",
      searchedTargetIds: uniqueIds(candidate.searchedTargetIds), deniedTargetIds: uniqueIds(candidate.deniedTargetIds),
      inaccessibleTargetIds: uniqueIds(candidate.inaccessibleTargetIds), seizedSubjectIds: uniqueIds(candidate.seizedSubjectIds),
      obstructionIds: uniqueIds(candidate.obstructionIds), summary: String(candidate.summary || "Warrant return filed.").trim(),
      immutable: candidate.immutable !== false
    };
  }

  function normalizeExecution(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const template = SCOPE_TEMPLATES[source.scope?.id] || SCOPE_TEMPLATES.deferredRaid;
    const issuedAt = Math.max(0, finite(source.issuedAt));
    const status = STATUSES.includes(source.status) ? source.status : template.supported ? "issued" : "deferred";
    return {
      id: cleanId(source.id) || `warrant-execution-${index + 1}`,
      actionId: cleanId(source.actionId), caseId: cleanId(source.caseId), demandId: cleanId(source.demandId),
      institutionId: cleanId(source.institutionId), docket: String(source.docket || "CASE-0000").trim(),
      issuedAt, status, scope: normalizeScope(source.scope, template),
      arrivalAt: source.arrivalAt == null ? null : Math.max(issuedAt, finite(source.arrivalAt, issuedAt)),
      arrivalWindowEnd: source.arrivalWindowEnd == null ? null : Math.max(issuedAt, finite(source.arrivalWindowEnd, issuedAt)),
      visitId: cleanId(source.visitId), actorId: cleanId(source.actorId),
      startedAt: source.startedAt == null ? null : Math.max(issuedAt, finite(source.startedAt, issuedAt)),
      completedAt: source.completedAt == null ? null : Math.max(issuedAt, finite(source.completedAt, issuedAt)),
      seizures: (Array.isArray(source.seizures) ? source.seizures : []).map(normalizeSeizure),
      obstructionIds: uniqueIds(source.obstructionIds), warrantReturn: normalizeReturn(source.warrantReturn),
      history: (Array.isArray(source.history) ? source.history : []).map((entry) => ({
        at: Math.max(issuedAt, finite(entry?.at, issuedAt)), action: cleanId(entry?.action) || "issued",
        summary: String(entry?.summary || "Warrant execution updated.").trim()
      })).sort((left, right) => left.at - right.at)
    };
  }

  function defaultState() {
    return { version: VERSION, executions: [], nextExecutionNumber: 1, nextSeizureNumber: 1 };
  }

  function nextNumber(records, prefix, fallback) {
    return records.reduce((maximum, record) => {
      const match = String(record.id || "").match(new RegExp(`${prefix}(\\d+)$`));
      return Math.max(maximum, match ? Number(match[1]) + 1 : 1);
    }, Math.max(1, Math.floor(finite(fallback, 1))));
  }

  function normalizeState(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const executions = (Array.isArray(source.executions) ? source.executions : []).map(normalizeExecution);
    const seizures = executions.flatMap((execution) => execution.seizures);
    return {
      version: VERSION, executions,
      nextExecutionNumber: nextNumber(executions, "warrant-execution-", source.nextExecutionNumber),
      nextSeizureNumber: nextNumber(seizures, "warrant-seizure-", source.nextSeizureNumber)
    };
  }

  function issue(candidate, action, demand, context = {}) {
    const state = normalizeState(candidate);
    const existing = state.executions.find((execution) => execution.actionId === cleanId(action?.id));
    if (existing) return { state, execution: existing, created: false };
    if (!action?.id || action.kind !== "warrant") return { state, execution: null, created: false };
    const template = templateFor(action, demand);
    const issuedAt = Math.max(0, finite(action.createdAt, context.clock));
    const arrivalDelay = Math.floor((1 + unitRoll(`${context.seed}:${action.id}:arrival`) * 3) * HOUR);
    const arrivalAt = template.supported ? issuedAt + arrivalDelay : null;
    const id = `warrant-execution-${state.nextExecutionNumber++}`;
    const execution = normalizeExecution({
      id, actionId: action.id, caseId: action.caseId, demandId: action.demandId,
      institutionId: action.institutionId, docket: demand?.docket,
      issuedAt, status: template.supported ? "scheduled" : "deferred", scope: template,
      arrivalAt, arrivalWindowEnd: arrivalAt == null ? null : arrivalAt + HOUR,
      history: [{
        at: issuedAt, action: template.supported ? "scheduled" : "deferred",
        summary: template.supported
          ? `${template.label} issued with a short physical service window.`
          : "Physical law-enforcement execution is deferred to the forced-entry and raid system."
      }]
    }, state.executions.length);
    state.executions.push(execution);
    return { state, execution, created: true };
  }

  function linkVisit(candidate, executionId, visitId, actorId, clock = 0) {
    const state = normalizeState(candidate);
    const execution = state.executions.find((entry) => entry.id === cleanId(executionId));
    if (!execution || !["scheduled", "issued"].includes(execution.status)) return { state, execution: null };
    execution.visitId = cleanId(visitId);
    execution.actorId = cleanId(actorId);
    execution.history.push({ at: Math.max(execution.issuedAt, finite(clock)), action: "visitLinked", summary: "A physical enforcement actor was assigned to execute the warrant." });
    return { state, execution };
  }

  function activate(candidate, executionId, actorId, clock = 0) {
    const state = normalizeState(candidate);
    const execution = state.executions.find((entry) => entry.id === cleanId(executionId));
    if (!execution || !["scheduled", "issued", "active"].includes(execution.status)) return { state, execution: null };
    execution.status = "active";
    execution.actorId = cleanId(actorId) || execution.actorId;
    execution.startedAt ??= Math.max(execution.issuedAt, finite(clock));
    if (!execution.history.some((entry) => entry.action === "served")) {
      execution.history.push({ at: execution.startedAt, action: "served", summary: "The warrant was physically presented at the lawful entrance." });
    }
    return { state, execution };
  }

  function recordSearch(candidate, executionId, targetId, result = {}) {
    const state = normalizeState(candidate);
    const execution = state.executions.find((entry) => entry.id === cleanId(executionId));
    const target = execution?.scope.targets.find((entry) => entry.id === cleanId(targetId));
    if (!execution || !target || target.status !== "pending") return { state, execution, target, changed: false };
    target.status = result.status === "denied" ? "denied" : result.status === "inaccessible" ? "inaccessible" : "searched";
    target.searchedAt = Math.max(execution.issuedAt, finite(result.clock));
    target.observedSubjectIds = uniqueIds(result.observedSubjectIds);
    target.reason = String(result.reason || "").trim();
    execution.history.push({
      at: target.searchedAt, action: target.status,
      summary: target.status === "searched" ? `${target.label} was physically searched within warrant scope.` : `${target.label} was not searched: ${target.reason || target.status}.`
    });
    return { state, execution, target, changed: true };
  }

  function recordSeizure(candidate, executionId, targetId, options = {}) {
    const state = normalizeState(candidate);
    const execution = state.executions.find((entry) => entry.id === cleanId(executionId));
    const target = execution?.scope.targets.find((entry) => entry.id === cleanId(targetId));
    const subjectId = cleanId(options.subjectId);
    if (!execution || !target || !subjectId) return { state, execution, seizure: null, created: false };
    const existing = execution.seizures.find((entry) => entry.subjectId === subjectId);
    if (existing) return { state, execution, seizure: existing, created: false };
    const clock = Math.max(execution.issuedAt, finite(options.clock));
    const seizure = normalizeSeizure({
      id: `warrant-seizure-${state.nextSeizureNumber++}`, targetId: target.id,
      sourceSubjectId: options.sourceSubjectId || subjectId, subjectKind: options.subjectKind || "physicalStack",
      subjectId, label: options.label, quantity: options.quantity, status: "carried", locatedAt: clock,
      custody: [
        { at: clock, action: "located", actorId: execution.actorId, roomId: target.roomId, details: `Located during ${target.label}.` },
        { at: clock, action: "carried", actorId: execution.actorId, roomId: target.roomId, details: "Taken into physical enforcement custody." }
      ]
    }, execution.seizures.length);
    execution.seizures.push(seizure);
    target.seizedSubjectIds = uniqueIds([...target.seizedSubjectIds, subjectId]);
    execution.history.push({ at: clock, action: "seized", summary: `${seizure.label} entered physical enforcement custody.` });
    return { state, execution, seizure, created: true };
  }

  function externalizeSeizure(candidate, executionId, subjectId, options = {}) {
    const state = normalizeState(candidate);
    const execution = state.executions.find((entry) => entry.id === cleanId(executionId));
    const seizure = execution?.seizures.find((entry) => entry.subjectId === cleanId(subjectId));
    if (!execution || !seizure || seizure.status === "externalized") return { state, execution, seizure, changed: false };
    const clock = Math.max(execution.issuedAt, finite(options.clock));
    seizure.status = "externalized";
    seizure.externalizedAt = clock;
    seizure.custody.push({
      at: clock, action: "externalized", actorId: execution.actorId,
      roomId: cleanId(options.roomId), accessPointId: cleanId(options.accessPointId),
      details: String(options.details || "Removed from the site under warrant custody.").trim()
    });
    return { state, execution, seizure, changed: true };
  }

  function recordObstruction(candidate, executionId, obstructionId, targetId, clock = 0) {
    const state = normalizeState(candidate);
    const execution = state.executions.find((entry) => entry.id === cleanId(executionId));
    if (!execution) return { state, execution: null, changed: false };
    const id = cleanId(obstructionId);
    const before = execution.obstructionIds.length;
    execution.obstructionIds = uniqueIds([...execution.obstructionIds, id]);
    const target = execution.scope.targets.find((entry) => entry.id === cleanId(targetId));
    if (target && target.status === "pending") {
      target.status = "denied";
      target.searchedAt = Math.max(execution.issuedAt, finite(clock));
      target.reason = "Access denied";
    }
    if (execution.obstructionIds.length !== before) {
      execution.history.push({ at: Math.max(execution.issuedAt, finite(clock)), action: "obstructed", summary: `${target?.label || "Warrant scope"} access was denied.` });
    }
    return { state, execution, changed: execution.obstructionIds.length !== before };
  }

  function complete(candidate, executionId, clock = 0) {
    const state = normalizeState(candidate);
    const execution = state.executions.find((entry) => entry.id === cleanId(executionId));
    if (!execution || execution.warrantReturn) return { state, execution, changed: false };
    const completedAt = Math.max(execution.issuedAt, finite(clock));
    const searchedTargetIds = execution.scope.targets.filter((target) => target.status === "searched").map((target) => target.id);
    const deniedTargetIds = execution.scope.targets.filter((target) => target.status === "denied").map((target) => target.id);
    const inaccessibleTargetIds = execution.scope.targets.filter((target) => target.status === "inaccessible").map((target) => target.id);
    const seizedSubjectIds = execution.seizures.filter((seizure) => seizure.status === "externalized").map((seizure) => seizure.subjectId);
    const obstructed = execution.obstructionIds.length > 0 || deniedTargetIds.length > 0;
    execution.status = obstructed ? "obstructed" : "completed";
    execution.completedAt = completedAt;
    execution.warrantReturn = normalizeReturn({
      completedAt, outcome: execution.status, searchedTargetIds, deniedTargetIds, inaccessibleTargetIds,
      seizedSubjectIds, obstructionIds: execution.obstructionIds,
      summary: obstructed
        ? `Warrant return: ${searchedTargetIds.length} scope target(s) searched, ${seizedSubjectIds.length} subject(s) seized, and ${deniedTargetIds.length} target(s) denied.`
        : `Warrant return: ${searchedTargetIds.length} scope target(s) searched and ${seizedSubjectIds.length} subject(s) seized.`,
      immutable: true
    });
    execution.history.push({ at: completedAt, action: "returnFiled", summary: execution.warrantReturn.summary });
    return { state, execution, changed: true };
  }

  function executionByAction(candidate, actionId) {
    return normalizeState(candidate).executions.find((execution) => execution.actionId === cleanId(actionId)) || null;
  }

  function nextEvent(candidate, clock = 0) {
    const now = Math.max(0, finite(clock));
    return normalizeState(candidate).executions
      .filter((execution) => execution.status === "scheduled" && execution.arrivalAt != null && execution.arrivalAt >= now)
      .sort((left, right) => left.arrivalAt - right.arrivalAt || left.id.localeCompare(right.id))[0] || null;
  }

  return {
    VERSION, HOUR, STATUSES, TARGET_STATUSES, SEIZURE_STATUSES, SCOPE_TEMPLATES,
    cleanId, unitRoll, templateFor, normalizeTarget, normalizeScope, normalizeSeizure, normalizeExecution,
    defaultState, normalizeState, issue, linkVisit, activate, recordSearch, recordSeizure,
    externalizeSeizure, recordObstruction, complete, executionByAction, nextEvent
  };
}));
