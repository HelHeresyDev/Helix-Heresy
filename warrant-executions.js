(function attachHelixWarrantExecutions(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixWarrantExecutions = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixWarrantExecutions() {
  "use strict";

  const VERSION = 2;
  const HOUR = 3600;
  const STATUSES = Object.freeze(["issued", "scheduled", "active", "completed", "obstructed", "deferred"]);
  const TARGET_STATUSES = Object.freeze(["pending", "searched", "denied", "inaccessible"]);
  const SEIZURE_STATUSES = Object.freeze(["located", "carried", "externalized"]);
  const FORCED_ENTRY_STATUSES = Object.freeze(["scheduled", "active", "withdrawing", "completed", "withdrawn"]);
  const FORCED_TARGET_STATUSES = Object.freeze(["pending", "searched", "inaccessible"]);
  const BARRIER_STATUSES = Object.freeze(["authorized", "breaching", "breached", "complied"]);

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

  function normalizeForcedTarget(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
      targetId: cleanId(source.targetId) || `forced-target-${index + 1}`,
      status: FORCED_TARGET_STATUSES.includes(source.status) ? source.status : "pending",
      authorizedAt: Math.max(0, finite(source.authorizedAt)),
      searchedAt: source.searchedAt == null ? null : Math.max(0, finite(source.searchedAt)),
      observedSubjectIds: uniqueIds(source.observedSubjectIds),
      lateComplianceAt: source.lateComplianceAt == null ? null : Math.max(0, finite(source.lateComplianceAt)),
      reason: String(source.reason || "").trim()
    };
  }

  function normalizeBarrier(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const cell = source.cell && Number.isFinite(Number(source.cell.x)) && Number.isFinite(Number(source.cell.y))
      ? { x: Math.round(Number(source.cell.x)), y: Math.round(Number(source.cell.y)), z: Math.round(Number(source.cell.z) || 0) }
      : null;
    return {
      id: cleanId(source.id) || `forced-barrier-${index + 1}`,
      targetId: cleanId(source.targetId), kind: ["door", "fixture", "constructedWall"].includes(source.kind) ? source.kind : "door",
      barrierId: cleanId(source.barrierId), cell,
      label: String(source.label || "Authorized barrier").trim(),
      status: BARRIER_STATUSES.includes(source.status) ? source.status : "authorized",
      authorizedAt: Math.max(0, finite(source.authorizedAt)),
      workStartedAt: source.workStartedAt == null ? null : Math.max(0, finite(source.workStartedAt)),
      completedAt: source.completedAt == null ? null : Math.max(0, finite(source.completedAt)),
      startingCondition: Math.max(0, finite(source.startingCondition, 100)),
      currentCondition: Math.max(0, finite(source.currentCondition, source.startingCondition ?? 100)),
      damageApplied: Math.max(0, finite(source.damageApplied)),
      justification: String(source.justification || "Barrier blocks an authorized warrant target.").trim(),
      lateComplianceAt: source.lateComplianceAt == null ? null : Math.max(0, finite(source.lateComplianceAt))
    };
  }

  function normalizeExpansion(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const sourceCell = source.sourceCell && Number.isFinite(Number(source.sourceCell.x)) && Number.isFinite(Number(source.sourceCell.y))
      ? { x: Math.round(Number(source.sourceCell.x)), y: Math.round(Number(source.sourceCell.y)), z: Math.round(Number(source.sourceCell.z) || 0) }
      : null;
    return {
      id: cleanId(source.id) || `warrant-expansion-${index + 1}`,
      targetId: cleanId(source.targetId) || `expanded-target-${index + 1}`,
      evidenceId: cleanId(source.evidenceId), observationId: cleanId(source.observationId),
      roomId: cleanId(source.roomId), fixtureId: cleanId(source.fixtureId), sourceCell,
      label: String(source.label || "Expanded physical search target").trim(),
      method: cleanId(source.method) || "warrantExpandedSearch",
      subjectCategories: uniqueText(source.subjectCategories), maxSubjects: Math.max(1, Math.floor(finite(source.maxSubjects, 1))),
      seizedSubjectIds: uniqueIds(source.seizedSubjectIds), authorizedAt: Math.max(0, finite(source.authorizedAt)),
      reason: String(source.reason || "A physically perceived observation justified narrow expanded scope.").trim()
    };
  }

  function normalizeSupplementalReturn(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    return {
      completedAt: Math.max(0, finite(candidate.completedAt)),
      outcome: candidate.outcome === "withdrawn" ? "withdrawn" : "completed",
      searchedTargetIds: uniqueIds(candidate.searchedTargetIds), inaccessibleTargetIds: uniqueIds(candidate.inaccessibleTargetIds),
      breachedBarrierIds: uniqueIds(candidate.breachedBarrierIds), compliedBarrierIds: uniqueIds(candidate.compliedBarrierIds),
      expansionIds: uniqueIds(candidate.expansionIds), seizedSubjectIds: uniqueIds(candidate.seizedSubjectIds),
      violenceIds: uniqueIds(candidate.violenceIds), summary: String(candidate.summary || "Supplemental forced-entry return filed.").trim(),
      immutable: candidate.immutable !== false
    };
  }

  function normalizeForcedEntry(candidate, issuedAt = 0) {
    if (!candidate || typeof candidate !== "object") return null;
    const authorizedAt = Math.max(issuedAt, finite(candidate.authorizedAt, issuedAt));
    const status = FORCED_ENTRY_STATUSES.includes(candidate.status) ? candidate.status : "scheduled";
    return {
      status, authorizedAt,
      arrivalAt: Math.max(authorizedAt, finite(candidate.arrivalAt, authorizedAt)),
      arrivalWindowEnd: Math.max(authorizedAt, finite(candidate.arrivalWindowEnd, candidate.arrivalAt ?? authorizedAt)),
      visitId: cleanId(candidate.visitId), leadActorId: cleanId(candidate.leadActorId), breachActorId: cleanId(candidate.breachActorId),
      targets: (Array.isArray(candidate.targets) ? candidate.targets : []).map(normalizeForcedTarget),
      barriers: (Array.isArray(candidate.barriers) ? candidate.barriers : []).map(normalizeBarrier),
      expansions: (Array.isArray(candidate.expansions) ? candidate.expansions : []).map(normalizeExpansion),
      violenceIds: uniqueIds(candidate.violenceIds), withdrawalReason: String(candidate.withdrawalReason || "").trim(),
      completedAt: candidate.completedAt == null ? null : Math.max(authorizedAt, finite(candidate.completedAt)),
      supplementalReturn: normalizeSupplementalReturn(candidate.supplementalReturn)
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
      raidId: cleanId(source.raidId),
      startedAt: source.startedAt == null ? null : Math.max(issuedAt, finite(source.startedAt, issuedAt)),
      completedAt: source.completedAt == null ? null : Math.max(issuedAt, finite(source.completedAt, issuedAt)),
      seizures: (Array.isArray(source.seizures) ? source.seizures : []).map(normalizeSeizure),
      obstructionIds: uniqueIds(source.obstructionIds), warrantReturn: normalizeReturn(source.warrantReturn),
      forcedEntry: normalizeForcedEntry(source.forcedEntry, issuedAt),
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
    const target = execution?.scope.targets.find((entry) => entry.id === cleanId(targetId))
      || execution?.forcedEntry?.expansions.find((entry) => entry.targetId === cleanId(targetId));
    const subjectId = cleanId(options.subjectId);
    if (!execution || !target || !subjectId) return { state, execution, seizure: null, created: false };
    const existing = execution.seizures.find((entry) => entry.subjectId === subjectId);
    if (existing) return { state, execution, seizure: existing, created: false };
    const clock = Math.max(execution.issuedAt, finite(options.clock));
    const custodyActorId = cleanId(options.actorId) || execution.forcedEntry?.leadActorId || execution.actorId;
    const seizure = normalizeSeizure({
      id: `warrant-seizure-${state.nextSeizureNumber++}`, targetId: target.id,
      sourceSubjectId: options.sourceSubjectId || subjectId, subjectKind: options.subjectKind || "physicalStack",
      subjectId, label: options.label, quantity: options.quantity, status: "carried", locatedAt: clock,
      custody: [
        { at: clock, action: "located", actorId: custodyActorId, roomId: target.roomId, details: `Located during ${target.label}.` },
        { at: clock, action: "carried", actorId: custodyActorId, roomId: target.roomId, details: "Taken into physical enforcement custody." }
      ]
    }, execution.seizures.length);
    execution.seizures.push(seizure);
    target.seizedSubjectIds = uniqueIds([...target.seizedSubjectIds, subjectId]);
    execution.history.push({ at: clock, action: "seized", summary: `${seizure.label} entered physical enforcement custody.` });
    return { state, execution, seizure, created: true };
  }

  function authorizeForcedEntry(candidate, executionId, context = {}) {
    const state = normalizeState(candidate);
    const execution = state.executions.find((entry) => entry.id === cleanId(executionId));
    if (!execution || execution.forcedEntry || execution.status !== "obstructed" || !execution.scope.supported || !execution.warrantReturn) {
      return { state, execution, forcedEntry: execution?.forcedEntry || null, created: false };
    }
    const targetIds = uniqueIds([
      ...execution.warrantReturn.deniedTargetIds,
      ...execution.warrantReturn.inaccessibleTargetIds
    ]).filter((targetId) => execution.scope.targets.some((target) => target.id === targetId));
    if (!targetIds.length) return { state, execution, forcedEntry: null, created: false };
    const authorizedAt = Math.max(execution.completedAt || execution.issuedAt, finite(context.clock, execution.completedAt || execution.issuedAt));
    const arrivalDelay = Math.floor((2 + unitRoll(`${context.seed}:${execution.id}:forced-entry`) * 4) * HOUR);
    const arrivalAt = authorizedAt + arrivalDelay;
    execution.forcedEntry = normalizeForcedEntry({
      status: "scheduled", authorizedAt, arrivalAt, arrivalWindowEnd: arrivalAt + HOUR,
      targets: targetIds.map((targetId) => ({ targetId, status: "pending", authorizedAt }))
    }, execution.issuedAt);
    execution.history.push({
      at: authorizedAt, action: "forcedEntryAuthorized",
      summary: `A two-person enforcement return was authorized for ${targetIds.length} obstructed target(s); unrelated scope remains excluded.`
    });
    return { state, execution, forcedEntry: execution.forcedEntry, created: true };
  }

  function linkForcedEntryVisit(candidate, executionId, visitId, leadActorId, breachActorId, clock = 0) {
    const state = normalizeState(candidate);
    const execution = state.executions.find((entry) => entry.id === cleanId(executionId));
    const forcedEntry = execution?.forcedEntry;
    if (!execution || !forcedEntry || forcedEntry.status !== "scheduled") return { state, execution, forcedEntry: forcedEntry || null, changed: false };
    forcedEntry.visitId = cleanId(visitId);
    forcedEntry.leadActorId = cleanId(leadActorId);
    forcedEntry.breachActorId = cleanId(breachActorId);
    execution.history.push({ at: Math.max(forcedEntry.authorizedAt, finite(clock)), action: "forcedEntryVisitLinked", summary: "A warrant officer and breach officer were assigned to the supplemental execution." });
    return { state, execution, forcedEntry, changed: true };
  }

  function activateForcedEntry(candidate, executionId, leadActorId, breachActorId, clock = 0) {
    const state = normalizeState(candidate);
    const execution = state.executions.find((entry) => entry.id === cleanId(executionId));
    const forcedEntry = execution?.forcedEntry;
    if (!execution || !forcedEntry || !["scheduled", "active"].includes(forcedEntry.status)) return { state, execution, forcedEntry: forcedEntry || null, changed: false };
    const changed = forcedEntry.status !== "active";
    forcedEntry.status = "active";
    forcedEntry.leadActorId = cleanId(leadActorId) || forcedEntry.leadActorId;
    forcedEntry.breachActorId = cleanId(breachActorId) || forcedEntry.breachActorId;
    if (changed) execution.history.push({ at: Math.max(forcedEntry.authorizedAt, finite(clock)), action: "forcedEntryStarted", summary: "The physical two-person forced-entry execution began at the lawful entrance." });
    return { state, execution, forcedEntry, changed };
  }

  function forcedTarget(forcedEntry, targetId) {
    return forcedEntry?.targets.find((entry) => entry.targetId === cleanId(targetId)) || null;
  }

  function authorizeBarrier(candidate, executionId, options = {}) {
    const state = normalizeState(candidate);
    const execution = state.executions.find((entry) => entry.id === cleanId(executionId));
    const forcedEntry = execution?.forcedEntry;
    const targetId = cleanId(options.targetId);
    if (!execution || !forcedEntry || !forcedTarget(forcedEntry, targetId) || !["active", "scheduled"].includes(forcedEntry.status)) {
      return { state, execution, barrier: null, created: false };
    }
    const barrierId = cleanId(options.barrierId);
    const existing = forcedEntry.barriers.find((entry) => entry.targetId === targetId && entry.kind === options.kind && entry.barrierId === barrierId);
    if (existing) return { state, execution, barrier: existing, created: false };
    const clock = Math.max(forcedEntry.authorizedAt, finite(options.clock));
    const barrier = normalizeBarrier({
      id: `forced-barrier-${forcedEntry.barriers.length + 1}`, targetId, kind: options.kind, barrierId,
      cell: options.cell, label: options.label, status: "authorized", authorizedAt: clock,
      startingCondition: options.condition, currentCondition: options.condition,
      justification: options.justification || `This barrier physically blocks authorized target ${targetId}.`
    }, forcedEntry.barriers.length);
    forcedEntry.barriers.push(barrier);
    execution.history.push({ at: clock, action: "barrierAuthorized", summary: `${barrier.label} was specifically authorized for breach because it blocks an approved target.` });
    return { state, execution, barrier, created: true };
  }

  function recordBreachProgress(candidate, executionId, barrierRecordId, options = {}) {
    const state = normalizeState(candidate);
    const execution = state.executions.find((entry) => entry.id === cleanId(executionId));
    const forcedEntry = execution?.forcedEntry;
    const barrier = forcedEntry?.barriers.find((entry) => entry.id === cleanId(barrierRecordId));
    if (!execution || !forcedEntry || !barrier || ["breached", "complied"].includes(barrier.status)) return { state, execution, barrier, changed: false };
    const clock = Math.max(forcedEntry.authorizedAt, finite(options.clock));
    barrier.status = options.breached ? "breached" : "breaching";
    barrier.workStartedAt ??= clock;
    barrier.currentCondition = Math.max(0, finite(options.currentCondition, barrier.currentCondition));
    barrier.damageApplied = Math.max(barrier.damageApplied, Math.max(0, barrier.startingCondition - barrier.currentCondition));
    if (options.breached) barrier.completedAt = clock;
    if (options.breached) execution.history.push({ at: clock, action: "barrierBreached", summary: `${barrier.label} was physically breached after ${barrier.damageApplied} condition damage.` });
    return { state, execution, barrier, changed: true };
  }

  function recordLateCompliance(candidate, executionId, targetId, barrierRecordId, clock = 0) {
    const state = normalizeState(candidate);
    const execution = state.executions.find((entry) => entry.id === cleanId(executionId));
    const forcedEntry = execution?.forcedEntry;
    const target = forcedTarget(forcedEntry, targetId);
    if (!execution || !forcedEntry || !target) return { state, execution, barrier: null, changed: false };
    const at = Math.max(forcedEntry.authorizedAt, finite(clock));
    const barrier = forcedEntry.barriers.find((entry) => entry.id === cleanId(barrierRecordId)) || null;
    target.lateComplianceAt ??= at;
    if (barrier && !["breached", "complied"].includes(barrier.status)) {
      barrier.status = "complied";
      barrier.lateComplianceAt = at;
      barrier.completedAt = at;
    }
    execution.history.push({ at, action: "lateCompliance", summary: `${barrier?.label || targetId} access was provided before destructive work completed; prior obstruction and existing damage remain recorded.` });
    return { state, execution, barrier, changed: true };
  }

  function recordForcedSearch(candidate, executionId, targetId, result = {}) {
    const state = normalizeState(candidate);
    const execution = state.executions.find((entry) => entry.id === cleanId(executionId));
    const target = forcedTarget(execution?.forcedEntry, targetId);
    if (!execution || !target || target.status !== "pending") return { state, execution, target, changed: false };
    target.status = result.status === "inaccessible" ? "inaccessible" : "searched";
    target.searchedAt = Math.max(execution.forcedEntry.authorizedAt, finite(result.clock));
    target.observedSubjectIds = uniqueIds(result.observedSubjectIds);
    target.reason = String(result.reason || "").trim();
    execution.history.push({ at: target.searchedAt, action: target.status === "searched" ? "forcedSearch" : "forcedInaccessible", summary: target.status === "searched" ? `${target.targetId} was physically searched under the supplemental authority.` : `${target.targetId} remained inaccessible: ${target.reason || "physical access failed"}.` });
    return { state, execution, target, changed: true };
  }

  function authorizeExpansion(candidate, executionId, options = {}) {
    const state = normalizeState(candidate);
    const execution = state.executions.find((entry) => entry.id === cleanId(executionId));
    const forcedEntry = execution?.forcedEntry;
    const evidenceId = cleanId(options.evidenceId);
    if (!execution || !forcedEntry || forcedEntry.status !== "active" || !evidenceId || !options.roomId || !options.reason) {
      return { state, execution, expansion: null, created: false };
    }
    const existing = forcedEntry.expansions.find((entry) => entry.evidenceId === evidenceId);
    if (existing) return { state, execution, expansion: existing, created: false };
    const clock = Math.max(forcedEntry.authorizedAt, finite(options.clock));
    const expansion = normalizeExpansion({
      id: `warrant-expansion-${forcedEntry.expansions.length + 1}`,
      targetId: `expanded-target-${forcedEntry.expansions.length + 1}`,
      evidenceId, observationId: options.observationId, roomId: options.roomId, fixtureId: options.fixtureId,
      sourceCell: options.sourceCell, label: options.label, method: options.method,
      subjectCategories: options.subjectCategories, maxSubjects: options.maxSubjects, authorizedAt: clock, reason: options.reason
    }, forcedEntry.expansions.length);
    forcedEntry.expansions.push(expansion);
    forcedEntry.targets.push(normalizeForcedTarget({ targetId: expansion.targetId, status: "pending", authorizedAt: clock }, forcedEntry.targets.length));
    execution.history.push({ at: clock, action: "scopeExpanded", summary: `${expansion.label} was narrowly authorized from physically perceived evidence ${evidenceId}: ${expansion.reason}` });
    return { state, execution, expansion, created: true };
  }

  function recordViolentObstruction(candidate, executionId, violenceId, reason, clock = 0) {
    const state = normalizeState(candidate);
    const execution = state.executions.find((entry) => entry.id === cleanId(executionId));
    const forcedEntry = execution?.forcedEntry;
    if (!execution || !forcedEntry || !["active", "withdrawing"].includes(forcedEntry.status)) return { state, execution, forcedEntry, changed: false };
    const id = cleanId(violenceId);
    const before = forcedEntry.violenceIds.length;
    forcedEntry.violenceIds = uniqueIds([...forcedEntry.violenceIds, id]);
    forcedEntry.status = "withdrawing";
    forcedEntry.withdrawalReason = String(reason || "Violent resistance forced the team to withdraw.").trim();
    if (forcedEntry.violenceIds.length !== before) execution.history.push({ at: Math.max(forcedEntry.authorizedAt, finite(clock)), action: "violentObstruction", summary: forcedEntry.withdrawalReason });
    return { state, execution, forcedEntry, changed: forcedEntry.violenceIds.length !== before };
  }

  function completeForcedEntry(candidate, executionId, clock = 0) {
    const state = normalizeState(candidate);
    const execution = state.executions.find((entry) => entry.id === cleanId(executionId));
    const forcedEntry = execution?.forcedEntry;
    if (!execution || !forcedEntry || forcedEntry.supplementalReturn) return { state, execution, forcedEntry, changed: false };
    const completedAt = Math.max(forcedEntry.authorizedAt, finite(clock));
    const withdrawn = forcedEntry.status === "withdrawing" || forcedEntry.violenceIds.length > 0;
    const searchedTargetIds = forcedEntry.targets.filter((target) => target.status === "searched").map((target) => target.targetId);
    const inaccessibleTargetIds = forcedEntry.targets.filter((target) => target.status === "inaccessible" || target.status === "pending").map((target) => target.targetId);
    const breachedBarrierIds = forcedEntry.barriers.filter((barrier) => barrier.status === "breached").map((barrier) => barrier.id);
    const compliedBarrierIds = forcedEntry.barriers.filter((barrier) => barrier.status === "complied").map((barrier) => barrier.id);
    const seizedSubjectIds = execution.seizures.filter((seizure) => seizure.status === "externalized" && seizure.externalizedAt >= forcedEntry.authorizedAt).map((seizure) => seizure.subjectId);
    forcedEntry.status = withdrawn ? "withdrawn" : "completed";
    forcedEntry.completedAt = completedAt;
    forcedEntry.supplementalReturn = normalizeSupplementalReturn({
      completedAt, outcome: forcedEntry.status, searchedTargetIds, inaccessibleTargetIds,
      breachedBarrierIds, compliedBarrierIds, expansionIds: forcedEntry.expansions.map((entry) => entry.id),
      seizedSubjectIds, violenceIds: forcedEntry.violenceIds,
      summary: withdrawn
        ? `Supplemental return: enforcement withdrew after violent obstruction; ${searchedTargetIds.length} target(s) searched and ${seizedSubjectIds.length} subject(s) seized.`
        : `Supplemental return: ${searchedTargetIds.length} target(s) searched, ${breachedBarrierIds.length} barrier(s) breached, ${compliedBarrierIds.length} resolved by late compliance, and ${seizedSubjectIds.length} subject(s) seized.`,
      immutable: true
    });
    if (!withdrawn) execution.status = "completed";
    execution.history.push({ at: completedAt, action: "supplementalReturnFiled", summary: forcedEntry.supplementalReturn.summary });
    return { state, execution, forcedEntry, changed: true };
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
      at: clock, action: "externalized", actorId: cleanId(options.actorId) || execution.forcedEntry?.leadActorId || execution.actorId,
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

  function nextForcedEntryEvent(candidate, clock = 0) {
    const now = Math.max(0, finite(clock));
    return normalizeState(candidate).executions
      .filter((execution) => execution.forcedEntry?.status === "scheduled" && execution.forcedEntry.arrivalAt >= now)
      .sort((left, right) => left.forcedEntry.arrivalAt - right.forcedEntry.arrivalAt || left.id.localeCompare(right.id))[0] || null;
  }

  return {
    VERSION, HOUR, STATUSES, TARGET_STATUSES, SEIZURE_STATUSES, FORCED_ENTRY_STATUSES, FORCED_TARGET_STATUSES, BARRIER_STATUSES, SCOPE_TEMPLATES,
    cleanId, unitRoll, templateFor, normalizeTarget, normalizeScope, normalizeSeizure, normalizeExecution,
    defaultState, normalizeState, issue, linkVisit, activate, recordSearch, recordSeizure,
    externalizeSeizure, recordObstruction, complete, authorizeForcedEntry, linkForcedEntryVisit,
    activateForcedEntry, authorizeBarrier, recordBreachProgress, recordLateCompliance, recordForcedSearch,
    authorizeExpansion, recordViolentObstruction, completeForcedEntry, executionByAction, nextEvent, nextForcedEntryEvent
  };
}));
