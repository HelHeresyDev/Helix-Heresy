(function attachHelixExternalDetection(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixExternalDetection = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixExternalDetection() {
  "use strict";

  const VERSION = 1;
  const RELIABILITY = Object.freeze(["weak", "credible", "strong"]);
  const SPECIFICITY = Object.freeze(["generic", "siteLinked", "identityLinked"]);
  const KNOWLEDGE = Object.freeze(["hidden", "inferred", "known"]);
  const INSTITUTIONS = Object.freeze([
    { id: "environmental-health", label: "Environmental and Public Health" },
    { id: "commercial-registry", label: "Commercial Registry" },
    { id: "law-enforcement", label: "Law Enforcement" }
  ]);
  const SOURCES = Object.freeze([
    { id: "environmental-monitor", label: "Environmental monitoring", kind: "automated", institutionId: "environmental-health" },
    { id: "nearby-observer", label: "Nearby observer", kind: "witness", institutionId: "environmental-health" },
    { id: "public-visitor", label: "Public visitor", kind: "witness", institutionId: "environmental-health" },
    { id: "filing-system", label: "Automated filing system", kind: "automated", institutionId: "commercial-registry" },
    { id: "market-intermediary", label: "Market intermediary", kind: "intermediary", institutionId: "law-enforcement" },
    { id: "criminal-informant", label: "Criminal-network informant", kind: "informant", institutionId: "law-enforcement" }
  ]);
  const MEMORY_DECAY_SECONDS = 90 * 86400;

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

  function unitRoll(seed) {
    const text = String(seed || "external-detection");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash += hash << 13; hash ^= hash >>> 7;
    hash += hash << 3; hash ^= hash >>> 17; hash += hash << 5;
    return (hash >>> 0) / 4294967296;
  }

  function normalizeSource(candidate, index = 0) {
    const fallback = SOURCES[index] || SOURCES[0];
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
      id: cleanId(source.id) || fallback.id,
      label: String(source.label || fallback.label).trim(),
      kind: cleanId(source.kind) || fallback.kind,
      institutionId: cleanId(source.institutionId) || fallback.institutionId,
      active: source.active !== false
    };
  }

  function normalizeExposure(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const opportunityAt = Math.max(0, finite(source.opportunityAt));
    const observed = Boolean(source.observed);
    return {
      id: cleanId(source.id) || `external-exposure-${index + 1}`,
      opportunityKey: String(source.opportunityKey || "").trim(),
      evidenceId: cleanId(source.evidenceId), sourceId: cleanId(source.sourceId),
      institutionId: cleanId(source.institutionId), channel: cleanId(source.channel) || "external",
      opportunityAt, status: observed ? (source.reportId ? "reported" : "observed") : "missed",
      observed, detectionChance: clamp(finite(source.detectionChance), 0, 1), detectionRoll: clamp(finite(source.detectionRoll), 0, 1),
      willReport: observed && Boolean(source.willReport), reportChance: clamp(finite(source.reportChance), 0, 1), reportRoll: clamp(finite(source.reportRoll), 0, 1),
      reportDueAt: source.reportDueAt == null ? null : Math.max(opportunityAt, finite(source.reportDueAt, opportunityAt)),
      reportId: cleanId(source.reportId), reliability: RELIABILITY.includes(source.reliability) ? source.reliability : "credible",
      specificity: SPECIFICITY.includes(source.specificity) ? source.specificity : "generic",
      knowledge: KNOWLEDGE.includes(source.knowledge) ? source.knowledge : "hidden",
      summary: String(source.summary || "External signal").trim(), significanceRank: clamp(Math.floor(finite(source.significanceRank, 1)), 0, 4)
    };
  }

  function normalizeReport(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
      id: cleanId(source.id) || `witness-report-${index + 1}`,
      exposureId: cleanId(source.exposureId), evidenceId: cleanId(source.evidenceId), sourceId: cleanId(source.sourceId),
      institutionId: cleanId(source.institutionId), reportedAt: Math.max(0, finite(source.reportedAt)), status: source.status === "resolved" ? "resolved" : "active",
      reliability: RELIABILITY.includes(source.reliability) ? source.reliability : "credible",
      specificity: SPECIFICITY.includes(source.specificity) ? source.specificity : "generic",
      knowledge: KNOWLEDGE.includes(source.knowledge) ? source.knowledge : "hidden",
      summary: String(source.summary || "A report described an external signal.").trim(), significanceRank: clamp(Math.floor(finite(source.significanceRank, 1)), 0, 4)
    };
  }

  function normalizeCorrelation(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
      id: cleanId(source.id) || `signal-correlation-${index + 1}`,
      institutionId: cleanId(source.institutionId), reportIds: [...new Set((Array.isArray(source.reportIds) ? source.reportIds : []).map(cleanId).filter(Boolean))],
      createdAt: Math.max(0, finite(source.createdAt)), status: source.status === "resolved" ? "resolved" : "active",
      knowledge: KNOWLEDGE.includes(source.knowledge) ? source.knowledge : "hidden",
      summary: String(source.summary || "Compatible reports were correlated.").trim()
    };
  }

  function normalizeMemory(candidate, index = 0) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return {
      id: cleanId(source.id) || `institutional-memory-${index + 1}`,
      institutionId: cleanId(source.institutionId), originId: cleanId(source.originId),
      createdAt: Math.max(0, finite(source.createdAt)), strength: clamp(finite(source.strength), 0, 30),
      decaySeconds: Math.max(1, finite(source.decaySeconds, MEMORY_DECAY_SECONDS)), legacy: Boolean(source.legacy)
    };
  }

  function defaultState() {
    return {
      version: VERSION, sources: SOURCES.map((source, index) => normalizeSource(source, index)),
      exposures: [], reports: [], correlations: [], memory: [],
      nextExposureNumber: 1, nextReportNumber: 1, nextCorrelationNumber: 1, nextMemoryNumber: 1
    };
  }

  function normalizeState(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const defaults = defaultState();
    const providedSources = (Array.isArray(source.sources) ? source.sources : []).map(normalizeSource);
    const byId = new Map(providedSources.map((entry) => [entry.id, entry]));
    const sources = defaults.sources.map((entry) => byId.get(entry.id) || entry);
    for (const entry of providedSources) if (!sources.some((candidateSource) => candidateSource.id === entry.id)) sources.push(entry);
    const exposures = (Array.isArray(source.exposures) ? source.exposures : []).map(normalizeExposure);
    const reports = (Array.isArray(source.reports) ? source.reports : []).map(normalizeReport);
    const correlations = (Array.isArray(source.correlations) ? source.correlations : []).map(normalizeCorrelation);
    const memory = (Array.isArray(source.memory) ? source.memory : []).map(normalizeMemory);
    const nextNumber = (records, prefix, candidateNumber) => Math.max(Math.floor(finite(candidateNumber, 1)), records.reduce((max, record) => {
      const match = record.id.match(new RegExp(`${prefix}(\\d+)$`));
      return Math.max(max, match ? Number(match[1]) + 1 : 1);
    }, 1));
    return {
      version: VERSION, sources, exposures, reports, correlations, memory,
      nextExposureNumber: nextNumber(exposures, "external-exposure-", source.nextExposureNumber),
      nextReportNumber: nextNumber(reports, "witness-report-", source.nextReportNumber),
      nextCorrelationNumber: nextNumber(correlations, "signal-correlation-", source.nextCorrelationNumber),
      nextMemoryNumber: nextNumber(memory, "institutional-memory-", source.nextMemoryNumber)
    };
  }

  function createOpportunity(candidate, options = {}) {
    const state = normalizeState(candidate);
    const source = state.sources.find((entry) => entry.id === cleanId(options.sourceId)) || state.sources[0];
    const opportunityKey = String(options.opportunityKey || "").trim();
    const duplicate = opportunityKey && state.exposures.find((entry) => entry.opportunityKey === opportunityKey);
    if (duplicate) return { state, exposure: duplicate, created: false };
    const id = `external-exposure-${state.nextExposureNumber++}`;
    const detectionChance = clamp(finite(options.detectionChance, 0), 0, 1);
    const detectionRoll = unitRoll(`${options.seed || "site"}:${opportunityKey || id}:detect`);
    const observed = options.observed == null ? detectionRoll < detectionChance : Boolean(options.observed);
    const reportChance = clamp(finite(options.reportChance, source.kind === "automated" ? 1 : 0.65), 0, 1);
    const reportRoll = unitRoll(`${options.seed || "site"}:${opportunityKey || id}:report`);
    const willReport = observed && (options.willReport == null ? reportRoll < reportChance : Boolean(options.willReport));
    const opportunityAt = Math.max(0, finite(options.opportunityAt));
    const delaySeconds = source.kind === "automated" ? 0 : Math.max(0, finite(options.reportDelaySeconds, Math.floor(unitRoll(`${options.seed || "site"}:${opportunityKey || id}:delay`) * 43200)));
    const exposure = normalizeExposure({
      id, opportunityKey, evidenceId: options.evidenceId, sourceId: source.id, institutionId: options.institutionId || source.institutionId,
      channel: options.channel, opportunityAt, observed, detectionChance, detectionRoll, willReport, reportChance, reportRoll,
      reportDueAt: willReport ? opportunityAt + delaySeconds : null, reliability: options.reliability,
      specificity: options.specificity, knowledge: options.knowledge, summary: options.summary, significanceRank: options.significanceRank
    }, state.exposures.length);
    state.exposures.push(exposure);
    return { state, exposure, created: true };
  }

  function reportStrength(report) {
    const reliability = { weak: 3, credible: 6, strong: 9 }[report.reliability] || 3;
    const specificity = { generic: 0, siteLinked: 3, identityLinked: 6 }[report.specificity] || 0;
    return reliability + specificity + clamp(report.significanceRank, 0, 4) * 2;
  }

  function correlateReport(state, report, clock) {
    const compatible = state.reports.filter((entry) => entry.id !== report.id && entry.status === "active"
      && entry.institutionId === report.institutionId && entry.evidenceId !== report.evidenceId);
    if (!compatible.length) return null;
    const prior = compatible.sort((a, b) => b.reportedAt - a.reportedAt)[0];
    const reportIds = [prior.id, report.id].sort();
    const duplicate = state.correlations.find((entry) => reportIds.every((id) => entry.reportIds.includes(id)));
    if (duplicate) return null;
    const correlation = normalizeCorrelation({
      id: `signal-correlation-${state.nextCorrelationNumber++}`, institutionId: report.institutionId,
      reportIds, createdAt: clock, knowledge: report.knowledge === "known" && prior.knowledge === "known" ? "known" : "hidden",
      summary: "Separate compatible signals were linked by the receiving institution."
    }, state.correlations.length);
    state.correlations.push(correlation);
    state.memory.push(normalizeMemory({
      id: `institutional-memory-${state.nextMemoryNumber++}`, institutionId: correlation.institutionId,
      originId: correlation.id, createdAt: clock, strength: 5, decaySeconds: MEMORY_DECAY_SECONDS
    }, state.memory.length));
    return correlation;
  }

  function processDue(candidate, clock) {
    const state = normalizeState(candidate);
    const now = Math.max(0, finite(clock));
    const createdReports = [];
    const createdCorrelations = [];
    for (const exposure of state.exposures) {
      if (!exposure.observed || !exposure.willReport || exposure.reportId || exposure.reportDueAt == null || exposure.reportDueAt > now) continue;
      const report = normalizeReport({
        id: `witness-report-${state.nextReportNumber++}`, exposureId: exposure.id, evidenceId: exposure.evidenceId,
        sourceId: exposure.sourceId, institutionId: exposure.institutionId, reportedAt: exposure.reportDueAt,
        reliability: exposure.reliability, specificity: exposure.specificity, knowledge: exposure.knowledge,
        summary: exposure.summary, significanceRank: exposure.significanceRank
      }, state.reports.length);
      state.reports.push(report);
      exposure.reportId = report.id;
      exposure.status = "reported";
      state.memory.push(normalizeMemory({
        id: `institutional-memory-${state.nextMemoryNumber++}`, institutionId: report.institutionId,
        originId: report.id, createdAt: report.reportedAt, strength: Math.max(2, Math.round(reportStrength(report) * 0.45)), decaySeconds: MEMORY_DECAY_SECONDS
      }, state.memory.length));
      createdReports.push(report);
      const correlation = correlateReport(state, report, report.reportedAt);
      if (correlation) createdCorrelations.push(correlation);
    }
    return { state, createdReports, createdCorrelations };
  }

  function memoryStrengthAt(memory, clock) {
    const age = Math.max(0, finite(clock) - memory.createdAt);
    return memory.strength * Math.max(0, 1 - age / memory.decaySeconds);
  }

  function attentionScore(candidate, clock, options = {}) {
    const state = normalizeState(candidate);
    const filterEvidence = Object.prototype.hasOwnProperty.call(options, "activeEvidenceIds");
    const activeEvidenceIds = options.activeEvidenceIds instanceof Set ? options.activeEvidenceIds : new Set(options.activeEvidenceIds || []);
    let score = 0;
    for (const exposure of state.exposures) {
      if (!exposure.observed || exposure.reportId) continue;
      if (filterEvidence && exposure.evidenceId && !activeEvidenceIds.has(exposure.evidenceId)) continue;
      score += 1 + exposure.significanceRank;
    }
    for (const report of state.reports) {
      if (report.status !== "active") continue;
      const evidenceFactor = filterEvidence && report.evidenceId && !activeEvidenceIds.has(report.evidenceId) ? 0.35 : 1;
      score += reportStrength(report) * evidenceFactor;
    }
    score += state.correlations.filter((entry) => entry.status === "active").length * 6;
    score += state.memory.reduce((total, entry) => total + memoryStrengthAt(entry, clock), 0);
    score += Math.max(0, finite(options.casePressure));
    return clamp(Math.round(score), 0, 100);
  }

  function visibleSignals(candidate) {
    const state = normalizeState(candidate);
    return {
      exposures: state.exposures.filter((entry) => entry.observed && entry.knowledge !== "hidden"),
      reports: state.reports.filter((entry) => entry.knowledge !== "hidden"),
      correlations: state.correlations.filter((entry) => entry.knowledge !== "hidden")
    };
  }

  function addLegacyMemory(candidate, strength, clock) {
    const state = normalizeState(candidate);
    const value = clamp(finite(strength), 0, 30);
    if (!value || state.memory.some((entry) => entry.legacy)) return state;
    state.memory.push(normalizeMemory({
      id: `institutional-memory-${state.nextMemoryNumber++}`, institutionId: "legacy",
      originId: "legacy-suspicion", createdAt: Math.max(0, finite(clock)), strength: value,
      decaySeconds: MEMORY_DECAY_SECONDS, legacy: true
    }, state.memory.length));
    return state;
  }

  return {
    VERSION, RELIABILITY, SPECIFICITY, KNOWLEDGE, INSTITUTIONS, SOURCES, MEMORY_DECAY_SECONDS,
    cleanId, unitRoll, defaultState, normalizeState, normalizeExposure, normalizeReport, normalizeCorrelation,
    createOpportunity, processDue, reportStrength, memoryStrengthAt, attentionScore, visibleSignals, addLegacyMemory
  };
}));
