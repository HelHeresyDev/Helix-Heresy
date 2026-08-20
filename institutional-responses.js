(function attachHelixInstitutionalResponses(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixInstitutionalResponses = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixInstitutionalResponses() {
  "use strict";

  const VERSION = 1;
  const HOUR = 3600;
  const DAY = 24 * HOUR;
  const DEMAND_STATUSES = Object.freeze(["pending", "preparing", "resolved", "missed", "superseded"]);
  const RESPONSE_STATUSES = Object.freeze(["preparing", "submitted", "missed", "canceled"]);
  const ACTION_STATUSES = Object.freeze(["active", "completed", "paid", "complied", "expired", "overdue", "issued", "executed"]);

  const CLAIM_DEFS = Object.freeze({
    documentedCompliance: {
      id: "documentedCompliance", label: "Provide a documented lawful explanation",
      description: "Assert that retained company records explain the reported condition."
    },
    correctiveDisclosure: {
      id: "correctiveDisclosure", label: "Acknowledge the condition and document correction",
      description: "Acknowledge a problem while citing completed or ongoing corrective work."
    },
    limitedDisclosure: {
      id: "limitedDisclosure", label: "Provide limited information",
      description: "Answer only part of the demand without making a broader admission."
    },
    denyResponsibility: {
      id: "denyResponsibility", label: "Deny responsibility",
      description: "State that the company is not responsible for the reported condition."
    },
    refuse: {
      id: "refuse", label: "Refuse to answer",
      description: "Submit a formal refusal without supporting records."
    }
  });

  const DEMAND_FAMILY_DEFS = Object.freeze({
    companyRecords: {
      id: "companyRecords", label: "Required company records",
      question: "Explain the company's registration, declared activity, and missing or inconsistent operating records.",
      supportTags: ["records", "identity", "registration", "filing", "correction"]
    },
    hazardousDischarge: {
      id: "hazardousDischarge", label: "Reported site discharge",
      question: "Explain the reported exterior chemical or airborne discharge associated with this site.",
      supportTags: ["waste", "disposal", "manifest", "diagnostic", "maintenance", "siteConditions"]
    },
    wasteHandling: {
      id: "wasteHandling", label: "Biological-material handling",
      question: "Explain the provenance, containment, and disposition of reported biological material near the site.",
      supportTags: ["waste", "disposal", "manifest", "provenance", "correction"]
    },
    siteConditions: {
      id: "siteConditions", label: "Public-facing site conditions",
      question: "Explain the reported condition and the company's safety, maintenance, and access response.",
      supportTags: ["siteConditions", "maintenance", "access", "correction", "diagnostic"]
    },
    inventoryProvenance: {
      id: "inventoryProvenance", label: "Inventory and shipment provenance",
      question: "Explain the origin, records, and lawful purpose of the reported commercial activity.",
      supportTags: ["inventory", "provenance", "purchase", "sale", "records"]
    }
  });

  const ACTION_DEFS = Object.freeze({
    acceptance: { id: "acceptance", label: "Response accepted" },
    clarification: { id: "clarification", label: "Clarification demanded" },
    surveillance: { id: "surveillance", label: "Increased surveillance" },
    correctiveOrder: { id: "correctiveOrder", label: "Mandatory corrective order" },
    fine: { id: "fine", label: "Administrative fine" },
    operatingRestriction: { id: "operatingRestriction", label: "Operating restriction" },
    followUpInspection: { id: "followUpInspection", label: "Follow-up inspection ordered" },
    warrant: { id: "warrant", label: "Warrant issued" }
  });

  function cleanId(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "");
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function uniqueIds(candidate) {
    return [...new Set((Array.isArray(candidate) ? candidate : []).map(cleanId).filter(Boolean))];
  }

  function uniqueText(candidate) {
    return [...new Set((Array.isArray(candidate) ? candidate : []).map((value) => String(value || "").trim()).filter(Boolean))];
  }

  function unitRoll(seed) {
    const text = String(seed || "institutional-response");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash += hash << 13; hash ^= hash >>> 7;
    hash += hash << 3; hash ^= hash >>> 17; hash += hash << 5;
    return (hash >>> 0) / 4294967296;
  }

  function normalizeCitation(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
      id: cleanId(source.id) || `citation-${index + 1}`,
      sourceKind: cleanId(source.sourceKind) || "record",
      sourceId: cleanId(source.sourceId),
      label: String(source.label || "Supporting record").trim(),
      at: Math.max(0, finite(source.at)),
      tags: uniqueText(source.tags),
      externalCopy: Boolean(source.externalCopy)
    };
  }

  function normalizeEvaluation(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    return {
      at: Math.max(0, finite(candidate.at)),
      outcome: ["accepted", "provisional", "insufficient", "contradicted", "refused", "missed"].includes(candidate.outcome)
        ? candidate.outcome : "insufficient",
      completeness: ["complete", "partial", "none"].includes(candidate.completeness) ? candidate.completeness : "none",
      supportBand: ["none", "limited", "substantial"].includes(candidate.supportBand) ? candidate.supportBand : "none",
      contradictionBand: ["none", "possible", "material", "severe"].includes(candidate.contradictionBand) ? candidate.contradictionBand : "none",
      publicReasons: uniqueText(candidate.publicReasons),
      authorityEvidenceIds: uniqueIds(candidate.authorityEvidenceIds),
      priorResponseIds: uniqueIds(candidate.priorResponseIds),
      severity: clamp(Math.floor(finite(candidate.severity)), 0, 10),
      actionId: cleanId(candidate.actionId)
    };
  }

  function normalizeDemand(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const createdAt = Math.max(0, finite(source.createdAt));
    const family = DEMAND_FAMILY_DEFS[source.family] || DEMAND_FAMILY_DEFS.siteConditions;
    return {
      id: cleanId(source.id) || `institution-demand-${index + 1}`,
      caseId: cleanId(source.caseId), docket: String(source.docket || "CASE-0000").trim(),
      institutionId: cleanId(source.institutionId), family: family.id,
      label: String(source.label || family.label).trim(), question: String(source.question || family.question).trim(),
      supportTags: uniqueText(source.supportTags?.length ? source.supportTags : family.supportTags),
      createdAt, dueAt: Math.max(createdAt, finite(source.dueAt, createdAt + 2 * DAY)),
      status: DEMAND_STATUSES.includes(source.status) ? source.status : "pending",
      responseId: cleanId(source.responseId), priorResponseIds: uniqueIds(source.priorResponseIds),
      disclosedEvidenceIds: uniqueIds(source.disclosedEvidenceIds),
      sequence: Math.max(1, Math.floor(finite(source.sequence, 1))),
      resolvedAt: source.resolvedAt == null ? null : Math.max(createdAt, finite(source.resolvedAt, createdAt)),
      history: (Array.isArray(source.history) ? source.history : []).map((entry) => ({
        at: Math.max(createdAt, finite(entry?.at, createdAt)),
        action: cleanId(entry?.action) || "created", summary: String(entry?.summary || "Demand recorded.").trim()
      })).sort((left, right) => left.at - right.at)
    };
  }

  function normalizeResponse(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const createdAt = Math.max(0, finite(source.createdAt));
    const claimId = CLAIM_DEFS[source.claimId] ? source.claimId : source.claimId === "noResponse" ? "noResponse" : "limitedDisclosure";
    return {
      id: cleanId(source.id) || `institution-response-${index + 1}`,
      demandId: cleanId(source.demandId), caseId: cleanId(source.caseId),
      claimId, status: RESPONSE_STATUSES.includes(source.status) ? source.status : "preparing",
      citations: (Array.isArray(source.citations) ? source.citations : []).map(normalizeCitation),
      playerNote: String(source.playerNote || "").slice(0, 1200),
      createdAt, submittedAt: source.submittedAt == null ? null : Math.max(createdAt, finite(source.submittedAt, createdAt)),
      taskId: cleanId(source.taskId), evaluation: normalizeEvaluation(source.evaluation),
      immutable: Boolean(source.immutable)
    };
  }

  function normalizeAction(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const createdAt = Math.max(0, finite(source.createdAt));
    const definition = ACTION_DEFS[source.kind] || ACTION_DEFS.clarification;
    return {
      id: cleanId(source.id) || `institution-action-${index + 1}`,
      caseId: cleanId(source.caseId), demandId: cleanId(source.demandId), responseId: cleanId(source.responseId),
      institutionId: cleanId(source.institutionId), kind: definition.id,
      label: String(source.label || definition.label).trim(), publicReason: String(source.publicReason || "Institutional review completed.").trim(),
      createdAt, effectiveAt: Math.max(createdAt, finite(source.effectiveAt, createdAt)),
      dueAt: source.dueAt == null ? null : Math.max(createdAt, finite(source.dueAt, createdAt)),
      status: ACTION_STATUSES.includes(source.status) ? source.status : definition.id === "warrant" ? "issued" : "active",
      amount: Math.max(0, Math.round(finite(source.amount))), restrictionId: cleanId(source.restrictionId),
      visitTypeId: cleanId(source.visitTypeId), executionId: cleanId(source.executionId),
      resolvedAt: source.resolvedAt == null ? null : Math.max(createdAt, finite(source.resolvedAt, createdAt)),
      history: (Array.isArray(source.history) ? source.history : []).map((entry) => ({
        at: Math.max(createdAt, finite(entry?.at, createdAt)), action: cleanId(entry?.action) || "created",
        summary: String(entry?.summary || "Institutional action recorded.").trim()
      })).sort((left, right) => left.at - right.at)
    };
  }

  function defaultState() {
    return {
      version: VERSION, demands: [], responses: [], actions: [],
      nextDemandNumber: 1, nextResponseNumber: 1, nextActionNumber: 1
    };
  }

  function nextNumber(records, prefix, candidate) {
    return Math.max(Math.floor(finite(candidate, 1)), records.reduce((max, record) => {
      const match = String(record.id || "").match(new RegExp(`${prefix}(\\d+)$`));
      return Math.max(max, match ? Number(match[1]) + 1 : 1);
    }, 1));
  }

  function normalizeState(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const demands = (Array.isArray(source.demands) ? source.demands : []).map(normalizeDemand);
    const responses = (Array.isArray(source.responses) ? source.responses : []).map(normalizeResponse);
    const actions = (Array.isArray(source.actions) ? source.actions : []).map(normalizeAction);
    return {
      version: VERSION, demands, responses, actions,
      nextDemandNumber: nextNumber(demands, "institution-demand-", source.nextDemandNumber),
      nextResponseNumber: nextNumber(responses, "institution-response-", source.nextResponseNumber),
      nextActionNumber: nextNumber(actions, "institution-action-", source.nextActionNumber)
    };
  }

  function familyForCase(authorityCase) {
    return {
      "reporting-noncompliance": "companyRecords",
      "site-discharge": "hazardousDischarge",
      "improper-biological-disposal": "wasteHandling",
      "unsafe-public-conditions": "siteConditions",
      "off-books-commerce": "inventoryProvenance"
    }[authorityCase?.theoryId] || "siteConditions";
  }

  function responseWindow(authorityCase, seed, sequence) {
    const base = authorityCase?.institutionId === "commercial-registry" ? 48
      : authorityCase?.institutionId === "law-enforcement" ? 24 : 36;
    return Math.floor((base + unitRoll(`${seed}:${authorityCase?.id}:${sequence}:response-window`) * 12) * HOUR);
  }

  function createDemandInState(state, authorityCase, context = {}) {
    if (!authorityCase?.id) return null;
    const family = DEMAND_FAMILY_DEFS[context.family || familyForCase(authorityCase)] || DEMAND_FAMILY_DEFS.siteConditions;
    const sequence = Math.max(1, Math.floor(finite(context.sequence,
      state.demands.filter((entry) => entry.caseId === authorityCase.id).length + 1)));
    const clock = Math.max(0, finite(context.clock));
    const id = `institution-demand-${state.nextDemandNumber++}`;
    const demand = normalizeDemand({
      id, caseId: authorityCase.id, docket: authorityCase.docket, institutionId: authorityCase.institutionId,
      family: family.id, label: sequence > 1 ? `Follow-up: ${family.label}` : family.label,
      question: context.question || family.question, supportTags: family.supportTags,
      createdAt: clock, dueAt: context.dueAt ?? clock + responseWindow(authorityCase, context.seed, sequence),
      status: "pending", sequence, priorResponseIds: context.priorResponseIds,
      disclosedEvidenceIds: authorityCase.disclosure?.knownEvidenceLinkIds,
      history: [{ at: clock, action: "created", summary: `${authorityCase.docket} issued a formal response demand.` }]
    }, state.demands.length);
    state.demands.push(demand);
    return demand;
  }

  function createDemand(candidate, authorityCase, context = {}) {
    const state = normalizeState(candidate);
    const demand = createDemandInState(state, authorityCase, context);
    return { state, demand };
  }

  function prepareResponse(candidate, options = {}) {
    const state = normalizeState(candidate);
    const clock = Math.max(0, finite(options.clock));
    const demand = state.demands.find((entry) => entry.id === cleanId(options.demandId));
    if (!demand || !["pending", "preparing"].includes(demand.status)) return { state, response: null, reason: "The response demand is no longer open." };
    if (clock >= demand.dueAt) return { state, response: null, reason: "The response deadline has passed." };
    const claim = CLAIM_DEFS[options.claimId];
    if (!claim) return { state, response: null, reason: "Choose a structured response claim." };
    const existing = state.responses.find((entry) => entry.id === demand.responseId && entry.status === "preparing");
    if (existing) return { state, response: existing, reason: "A response packet is already being prepared." };
    const catalog = (Array.isArray(options.citations) ? options.citations : []).map(normalizeCitation);
    const requested = new Set(uniqueIds(options.citationIds));
    const citations = catalog.filter((entry) => requested.has(entry.id));
    const response = normalizeResponse({
      id: `institution-response-${state.nextResponseNumber++}`, demandId: demand.id, caseId: demand.caseId,
      claimId: claim.id, status: "preparing", citations, playerNote: options.playerNote,
      createdAt: clock, immutable: false
    }, state.responses.length);
    state.responses.push(response);
    demand.status = "preparing";
    demand.responseId = response.id;
    demand.history.push({ at: clock, action: "preparing", summary: `${claim.label} packet preparation began.` });
    return { state, response, reason: "" };
  }

  function setResponseTask(candidate, responseId, taskId) {
    const state = normalizeState(candidate);
    const response = state.responses.find((entry) => entry.id === cleanId(responseId));
    if (response && response.status === "preparing") response.taskId = cleanId(taskId);
    return state;
  }

  function cancelPreparation(candidate, responseId, clock = 0) {
    const state = normalizeState(candidate);
    const response = state.responses.find((entry) => entry.id === cleanId(responseId));
    if (!response || response.status !== "preparing") return state;
    response.status = "canceled";
    response.taskId = "";
    const demand = state.demands.find((entry) => entry.id === response.demandId);
    if (demand && demand.responseId === response.id && demand.dueAt > clock) {
      demand.status = "pending";
      demand.responseId = "";
      demand.history.push({ at: Math.max(0, finite(clock)), action: "preparationCanceled", summary: "Response preparation was canceled before submission." });
    }
    return state;
  }

  function caseStrengthRank(authorityCase) {
    return { preliminary: 0, supported: 1, corroborated: 2, compelling: 3 }[authorityCase?.strength?.bandId] || 0;
  }

  function citationSupport(demand, response) {
    const support = new Set(demand.supportTags);
    return response.citations.filter((citation) => citation.tags.some((tag) => support.has(tag))).length;
  }

  function evidenceContradictionWeight(authorityCase, response) {
    if (response.claimId !== "denyResponsibility") return 0;
    return (authorityCase?.authorityEvidence || []).reduce((total, evidence) => {
      const reliability = { weak: 1, credible: 2, strong: 3 }[evidence.reliability] || 1;
      const specificity = { generic: 0, siteLinked: 1, identityLinked: 2 }[evidence.specificity] || 0;
      return total + reliability + specificity + clamp(Math.floor(finite(evidence.significanceRank)), 0, 4);
    }, 0);
  }

  function priorContradictions(state, response) {
    const prior = state.responses.filter((entry) => entry.caseId === response.caseId && entry.id !== response.id
      && ["submitted", "missed"].includes(entry.status) && entry.evaluation);
    const ids = [];
    for (const entry of prior) {
      const incompatible = (response.claimId === "denyResponsibility" && entry.claimId === "correctiveDisclosure")
        || (response.claimId === "correctiveDisclosure" && entry.claimId === "denyResponsibility");
      if (incompatible) ids.push(entry.id);
    }
    return ids;
  }

  function outcomeFor(demand, response, authorityCase, missed) {
    const supportCount = citationSupport(demand, response);
    const contradictionWeight = evidenceContradictionWeight(authorityCase, response);
    if (missed || response.claimId === "noResponse") return { outcome: "missed", completeness: "none", supportCount, contradictionWeight, base: 5 };
    if (response.claimId === "refuse") return { outcome: "refused", completeness: "none", supportCount, contradictionWeight, base: 4 };
    if (response.claimId === "limitedDisclosure") return { outcome: "insufficient", completeness: "partial", supportCount, contradictionWeight, base: 3 };
    if (response.claimId === "denyResponsibility") {
      return contradictionWeight > 0
        ? { outcome: "contradicted", completeness: "complete", supportCount, contradictionWeight, base: 5 }
        : { outcome: "provisional", completeness: "complete", supportCount, contradictionWeight, base: 1 };
    }
    if (response.claimId === "correctiveDisclosure") {
      return supportCount > 0
        ? { outcome: "accepted", completeness: "complete", supportCount, contradictionWeight, base: 0 }
        : { outcome: "provisional", completeness: "complete", supportCount, contradictionWeight, base: 2 };
    }
    if (supportCount >= 2) return { outcome: "accepted", completeness: "complete", supportCount, contradictionWeight, base: 0 };
    if (supportCount === 1) return { outcome: "provisional", completeness: "complete", supportCount, contradictionWeight, base: 1 };
    return { outcome: "insufficient", completeness: "complete", supportCount, contradictionWeight, base: 3 };
  }

  function actionKindForSeverity(severity, outcome) {
    if (outcome === "accepted") return "acceptance";
    if (severity <= 1) return "clarification";
    if (severity === 2) return "surveillance";
    if (severity === 3) return "correctiveOrder";
    if (severity === 4) return "fine";
    if (severity === 5) return "operatingRestriction";
    if (severity === 6) return "followUpInspection";
    return "warrant";
  }

  function evaluationReasons(result, priorIds) {
    const reasons = [];
    if (result.completeness === "none") reasons.push("No substantive answer was received.");
    else if (result.completeness === "partial") reasons.push("The response did not answer the complete demand.");
    if (result.supportCount >= 2) reasons.push("Several cited records materially support the response.");
    else if (result.supportCount === 1) reasons.push("One cited record offers limited support.");
    else if (result.completeness !== "none") reasons.push("No cited record materially supports the selected explanation.");
    if (result.contradictionWeight >= 8) reasons.push("Known institutional information severely contradicts the denial.");
    else if (result.contradictionWeight > 0) reasons.push("Known institutional information conflicts with the denial.");
    if (priorIds.length) reasons.push("The response conflicts with a prior submitted statement.");
    return reasons;
  }

  function createActionInState(state, demand, response, authorityCase, evaluation, clock) {
    const kind = actionKindForSeverity(evaluation.severity, evaluation.outcome);
    const definition = ACTION_DEFS[kind];
    const id = `institution-action-${state.nextActionNumber++}`;
    const active = !["acceptance", "warrant"].includes(kind);
    const dueAt = kind === "fine" || kind === "correctiveOrder" ? clock + 3 * DAY
      : kind === "followUpInspection" ? clock + 2 * DAY
        : kind === "surveillance" || kind === "operatingRestriction" ? clock + 7 * DAY : null;
    const action = normalizeAction({
      id, caseId: demand.caseId, demandId: demand.id, responseId: response.id,
      institutionId: demand.institutionId, kind, label: definition.label,
      publicReason: evaluation.publicReasons.join(" ") || "The institution completed its review.",
      createdAt: clock, effectiveAt: clock, dueAt,
      status: kind === "acceptance" ? "completed" : kind === "warrant" ? "issued" : active ? "active" : "completed",
      amount: kind === "fine" ? 100 + evaluation.severity * 50 : 0,
      restrictionId: kind === "operatingRestriction" ? "noFullOperation" : "",
      visitTypeId: kind === "followUpInspection"
        ? authorityCase?.institutionId === "commercial-registry" ? "registryAuditor" : "environmentalInspector"
        : "",
      history: [{ at: clock, action: kind === "warrant" ? "issued" : "created", summary: `${definition.label}: ${evaluation.publicReasons.join(" ")}` }]
    }, state.actions.length);
    state.actions.push(action);
    evaluation.actionId = action.id;
    return action;
  }

  function createEscalatedActionInState(state, source, kind, clock) {
    if (state.actions.some((entry) => entry.caseId === source.caseId && entry.kind === kind
      && entry.createdAt >= source.createdAt && ["active", "issued"].includes(entry.status))) return null;
    const definition = ACTION_DEFS[kind];
    const action = normalizeAction({
      id: `institution-action-${state.nextActionNumber++}`,
      caseId: source.caseId, demandId: source.demandId, responseId: source.responseId,
      institutionId: source.institutionId, kind, label: definition.label,
      publicReason: `${source.label} was not resolved by its deadline.`, createdAt: clock, effectiveAt: clock,
      dueAt: kind === "followUpInspection" ? clock + 2 * DAY : kind === "operatingRestriction" ? clock + 7 * DAY : null,
      status: kind === "warrant" ? "issued" : "active",
      restrictionId: kind === "operatingRestriction" ? "noFullOperation" : "",
      visitTypeId: kind === "followUpInspection"
        ? source.institutionId === "commercial-registry" ? "registryAuditor" : "environmentalInspector"
        : "",
      history: [{ at: clock, action: "escalated", summary: `${definition.label} followed unresolved ${source.label.toLowerCase()}.` }]
    }, state.actions.length);
    state.actions.push(action);
    source.history.push({ at: clock, action: "escalated", summary: `Unresolved action escalated to ${definition.label.toLowerCase()}.` });
    return action;
  }

  function evaluateResponseInState(state, response, demand, authorityCase, clock, missed = false) {
    if (response.evaluation) return state.actions.find((entry) => entry.id === response.evaluation.actionId) || null;
    const result = outcomeFor(demand, response, authorityCase, missed);
    const priorIds = priorContradictions(state, response);
    const strength = caseStrengthRank(authorityCase);
    const severity = result.outcome === "accepted" ? 0
      : clamp(result.base + Math.max(0, strength - 1) + Math.min(2, priorIds.length), 0, 10);
    const contradictionBand = result.contradictionWeight >= 8 || priorIds.length ? "severe"
      : result.contradictionWeight >= 4 ? "material" : result.contradictionWeight > 0 ? "possible" : "none";
    const authorityEvidenceIds = uniqueIds((authorityCase?.authorityEvidence || []).map((entry) => entry.id));
    response.evaluation = normalizeEvaluation({
      at: clock, outcome: result.outcome, completeness: result.completeness,
      supportBand: result.supportCount >= 2 ? "substantial" : result.supportCount === 1 ? "limited" : "none",
      contradictionBand, publicReasons: evaluationReasons(result, priorIds), authorityEvidenceIds,
      priorResponseIds: priorIds, severity
    });
    response.status = missed ? "missed" : "submitted";
    response.submittedAt = missed ? null : clock;
    response.immutable = true;
    response.taskId = "";
    demand.status = missed ? "missed" : "resolved";
    demand.resolvedAt = clock;
    demand.history.push({ at: clock, action: missed ? "missed" : "submitted", summary: missed ? "The response deadline passed without submission." : "The response packet was submitted and became immutable." });
    if (response.evaluation.outcome === "accepted") {
      for (const priorAction of state.actions) {
        if (priorAction.caseId !== demand.caseId || !["clarification", "correctiveOrder"].includes(priorAction.kind)
          || priorAction.status !== "active") continue;
        priorAction.status = "complied";
        priorAction.resolvedAt = clock;
        priorAction.history.push({ at: clock, action: "complied", summary: "A later supported response satisfied this requirement." });
      }
    }
    return createActionInState(state, demand, response, authorityCase, response.evaluation, clock);
  }

  function submitResponse(candidate, responseId, context = {}) {
    const state = normalizeState(candidate);
    const clock = Math.max(0, finite(context.clock));
    const response = state.responses.find((entry) => entry.id === cleanId(responseId));
    const demand = response && state.demands.find((entry) => entry.id === response.demandId);
    if (!response || !demand || response.status !== "preparing") return { state, response: null, action: null, reason: "The response packet is no longer awaiting submission." };
    const authorityCase = (Array.isArray(context.cases) ? context.cases : []).find((entry) => entry.id === response.caseId);
    if (!authorityCase) return { state, response: null, action: null, reason: "The linked authority case no longer exists." };
    const missed = clock > demand.dueAt;
    const action = evaluateResponseInState(state, response, demand, authorityCase, clock, missed);
    return { state, response, action, reason: missed ? "The packet was completed after the response deadline." : "" };
  }

  function createMissedResponse(state, demand, authorityCase, clock) {
    const response = normalizeResponse({
      id: `institution-response-${state.nextResponseNumber++}`, demandId: demand.id, caseId: demand.caseId,
      claimId: "noResponse", status: "missed", citations: [], createdAt: demand.createdAt, immutable: true
    }, state.responses.length);
    state.responses.push(response);
    demand.responseId = response.id;
    const action = evaluateResponseInState(state, response, demand, authorityCase, clock, true);
    return { response, action };
  }

  function maybeCreateFollowUp(state, authorityCase, context, createdDemandIds) {
    const caseDemands = state.demands.filter((entry) => entry.caseId === authorityCase.id).sort((left, right) => left.sequence - right.sequence);
    const latest = caseDemands.at(-1);
    if (!latest || ["pending", "preparing"].includes(latest.status)) return;
    const response = state.responses.find((entry) => entry.id === latest.responseId);
    const action = response?.evaluation && state.actions.find((entry) => entry.id === response.evaluation.actionId);
    const currentEvidenceIds = uniqueIds((authorityCase.authorityEvidence || []).map((entry) => entry.id));
    const evaluatedEvidence = new Set(response?.evaluation?.authorityEvidenceIds || []);
    const newEvidence = currentEvidenceIds.some((id) => !evaluatedEvidence.has(id));
    const clarification = ["clarification", "correctiveOrder"].includes(action?.kind);
    if (!newEvidence && !clarification) return;
    if (caseDemands.length >= 4) return;
    const demand = createDemandInState(state, authorityCase, {
      clock: context.clock, seed: context.seed, sequence: latest.sequence + 1,
      priorResponseIds: response ? [response.id] : [],
      question: newEvidence
        ? "New institutional information requires clarification of the prior response and its supporting records."
        : "Provide the clarification or corrective documentation required by the prior review."
    });
    if (demand) createdDemandIds.push(demand.id);
  }

  function update(candidate, context = {}) {
    const state = normalizeState(candidate);
    const clock = Math.max(0, finite(context.clock));
    const cases = Array.isArray(context.cases) ? context.cases : [];
    const createdDemandIds = [];
    const evaluatedResponseIds = [];
    const createdActionIds = [];
    const missedTaskIds = [];

    for (const authorityCase of cases) {
      if (authorityCase?.disclosure?.state !== "disclosed" || ["closed", "referred"].includes(authorityCase.status)) continue;
      const existing = state.demands.filter((entry) => entry.caseId === authorityCase.id);
      if (!existing.length) {
        const demand = createDemandInState(state, authorityCase, { clock, seed: context.seed });
        if (demand) createdDemandIds.push(demand.id);
      }
    }

    for (const demand of state.demands) {
      if (!["pending", "preparing"].includes(demand.status) || demand.dueAt > clock) continue;
      const authorityCase = cases.find((entry) => entry.id === demand.caseId);
      if (!authorityCase) continue;
      const prepared = state.responses.find((entry) => entry.id === demand.responseId && entry.status === "preparing");
      if (prepared?.taskId) missedTaskIds.push(prepared.taskId);
      const result = prepared
        ? { response: prepared, action: evaluateResponseInState(state, prepared, demand, authorityCase, clock, true) }
        : createMissedResponse(state, demand, authorityCase, clock);
      evaluatedResponseIds.push(result.response.id);
      if (result.action) createdActionIds.push(result.action.id);
    }

    for (const authorityCase of cases) {
      if (authorityCase?.disclosure?.state === "disclosed") maybeCreateFollowUp(state, authorityCase, { clock, seed: context.seed }, createdDemandIds);
    }

    for (const action of [...state.actions]) {
      if (action.status !== "active" || action.dueAt == null || action.dueAt > clock) continue;
      if (action.kind === "surveillance") {
        action.status = "expired";
        action.resolvedAt = clock;
        action.history.push({ at: clock, action: "expired", summary: `${action.label} reached its scheduled review date.` });
      } else if (["fine", "correctiveOrder"].includes(action.kind)) {
        action.status = "overdue";
        action.resolvedAt = clock;
        const escalated = createEscalatedActionInState(state, action,
          action.kind === "fine" ? "operatingRestriction" : "followUpInspection", clock);
        if (escalated) createdActionIds.push(escalated.id);
      }
    }

    return { state, createdDemandIds, evaluatedResponseIds, createdActionIds, missedTaskIds: uniqueIds(missedTaskIds) };
  }

  function resolveAction(candidate, actionId, clock = 0, resolution = "complied") {
    const state = normalizeState(candidate);
    const action = state.actions.find((entry) => entry.id === cleanId(actionId));
    if (!action || !["active", "issued"].includes(action.status)) return { state, action: null, reason: "The institutional action cannot be resolved this way." };
    const status = resolution === "paid" ? "paid" : "complied";
    action.status = status;
    action.resolvedAt = Math.max(0, finite(clock));
    action.history.push({ at: action.resolvedAt, action: status, summary: `${action.label} marked ${status}.` });
    return { state, action, reason: "" };
  }

  function activeRestrictions(candidate) {
    return normalizeState(candidate).actions.filter((entry) => entry.kind === "operatingRestriction" && entry.status === "active");
  }

  function actionPressure(candidate) {
    const weights = { clarification: 2, surveillance: 5, correctiveOrder: 4, fine: 5, operatingRestriction: 8, followUpInspection: 7, warrant: 14 };
    return clamp(normalizeState(candidate).actions.reduce((total, action) => {
      return total + (["active", "issued"].includes(action.status) ? weights[action.kind] || 0 : 0);
    }, 0), 0, 40);
  }

  function nextEvent(candidate, clock = 0) {
    const state = normalizeState(candidate);
    const now = Math.max(0, finite(clock));
    const events = [
      ...state.demands.filter((entry) => ["pending", "preparing"].includes(entry.status) && entry.dueAt >= now)
        .map((entry) => ({ time: entry.dueAt, type: "institutionDemand", id: entry.id, label: `${entry.docket} response deadline` })),
      ...state.actions.filter((entry) => entry.status === "active" && entry.dueAt != null && entry.dueAt >= now)
        .map((entry) => ({ time: entry.dueAt, type: "institutionAction", id: entry.id, label: `${entry.label} review` }))
    ];
    return events.sort((left, right) => left.time - right.time || left.id.localeCompare(right.id))[0] || null;
  }

  return {
    VERSION, HOUR, DAY, DEMAND_STATUSES, RESPONSE_STATUSES, ACTION_STATUSES,
    CLAIM_DEFS, DEMAND_FAMILY_DEFS, ACTION_DEFS,
    cleanId, unitRoll, normalizeCitation, normalizeDemand, normalizeResponse, normalizeAction,
    defaultState, normalizeState, familyForCase, createDemand, prepareResponse, setResponseTask,
    cancelPreparation, submitResponse, update, resolveAction, activeRestrictions, actionPressure, nextEvent
  };
}));
