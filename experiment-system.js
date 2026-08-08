(function attachHelixExperimentSystem(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixExperimentSystem = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixExperimentSystem() {
  "use strict";

  const VERSION = 1;
  const STATUSES = Object.freeze(["draft", "running", "concluding", "completed", "abandoned"]);
  const VARIABLE_TYPES = Object.freeze([
    Object.freeze({ id: "genome", label: "Genome bases" }),
    Object.freeze({ id: "treatment", label: "Treatment or procedure" }),
    Object.freeze({ id: "environment", label: "Environment" }),
    Object.freeze({ id: "feeding", label: "Feeding" }),
    Object.freeze({ id: "other", label: "Other intervention" })
  ]);
  const VARIABLE_TYPE_BY_ID = Object.freeze(Object.fromEntries(VARIABLE_TYPES.map((entry) => [entry.id, entry])));
  const TEMPLATES = Object.freeze([
    Object.freeze({ id: "custom", label: "Custom hypothesis", hypothesis: "", variableType: "other" }),
    Object.freeze({ id: "genome", label: "Genome variant comparison", hypothesis: "Changing the selected genome bases changes an observable trait.", variableType: "genome" }),
    Object.freeze({ id: "environment", label: "Environmental response", hypothesis: "Changing the local environment changes the subject's observable condition.", variableType: "environment" }),
    Object.freeze({ id: "feeding", label: "Feeding response", hypothesis: "Changing the feeding treatment changes the subject's observable condition.", variableType: "feeding" })
  ]);
  const CONCLUSION_IDS = Object.freeze(["supports", "contradicts", "inconclusive"]);

  function cleanId(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "");
  }
  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, finite(value, min)));
  }
  function clone(value, fallback = null) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_error) { return fallback; }
  }
  function normalizeSubject(candidate, index = 0) {
    const kind = candidate?.kind === "plannedGenome" ? "plannedGenome" : "slime";
    const role = candidate?.role === "control" ? "control" : "experimental";
    const subjectId = cleanId(candidate?.subjectId);
    const genome = String(candidate?.genome || "").replace(/[^ACGT]/gi, "").toUpperCase();
    if (kind === "slime" && !subjectId) return null;
    if (kind === "plannedGenome" && !genome) return null;
    return {
      slotId: cleanId(candidate?.slotId) || `${role}-${index + 1}`,
      role, kind, subjectId,
      label: String(candidate?.label || (kind === "plannedGenome" ? `Planned genome ${index + 1}` : subjectId)).trim(),
      genome,
      synthesizedSlimeId: cleanId(candidate?.synthesizedSlimeId)
    };
  }
  function normalizeSnapshot(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    return clone(candidate, null);
  }
  function normalizeComparison(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    return {
      generatedAt: Math.max(0, finite(candidate.generatedAt, 0)),
      confidenceScore: clamp(candidate.confidenceScore, 0, 100),
      confidenceLabel: String(candidate.confidenceLabel || confidenceBand(candidate.confidenceScore).label),
      referenceLabel: String(candidate.referenceLabel || "Reference subject"),
      genomeDifferences: (Array.isArray(candidate.genomeDifferences) ? candidate.genomeDifferences : []).map(String).slice(0, 100),
      observedDifferences: (Array.isArray(candidate.observedDifferences) ? candidate.observedDifferences : []).map(String).slice(0, 100),
      conditionChanges: (Array.isArray(candidate.conditionChanges) ? candidate.conditionChanges : []).map(String).slice(0, 100),
      confounders: (Array.isArray(candidate.confounders) ? candidate.confounders : []).map(String).slice(0, 40),
      evidenceSourceKeys: (Array.isArray(candidate.evidenceSourceKeys) ? candidate.evidenceSourceKeys : []).map(String).filter(Boolean).slice(0, 100),
      summary: String(candidate.summary || "").trim()
    };
  }
  function normalizeExperiment(candidate, index = 0) {
    const id = cleanId(candidate?.id) || `experiment-${index + 1}`;
    const status = STATUSES.includes(candidate?.status) ? candidate.status : "draft";
    const subjects = (Array.isArray(candidate?.subjects) ? candidate.subjects : [])
      .map(normalizeSubject).filter(Boolean).slice(0, 4);
    const control = subjects.find((subject) => subject.role === "control") || null;
    const experimental = subjects.filter((subject) => subject.role === "experimental").slice(0, 3);
    return {
      id,
      title: String(candidate?.title || `Experiment ${index + 1}`).trim() || `Experiment ${index + 1}`,
      hypothesis: String(candidate?.hypothesis || "").trim(),
      variableType: VARIABLE_TYPE_BY_ID[candidate?.variableType] ? candidate.variableType : "other",
      status,
      formalControl: Boolean(candidate?.formalControl && control),
      subjects: [...(control ? [control] : []), ...experimental],
      baselineSnapshots: Object.fromEntries(Object.entries(candidate?.baselineSnapshots || {}).map(([key, value]) => [cleanId(key), normalizeSnapshot(value)]).filter(([key, value]) => key && value)),
      finalSnapshots: Object.fromEntries(Object.entries(candidate?.finalSnapshots || {}).map(([key, value]) => [cleanId(key), normalizeSnapshot(value)]).filter(([key, value]) => key && value)),
      interventionLog: (Array.isArray(candidate?.interventionLog) ? candidate.interventionLog : []).map((entry) => ({
        at: Math.max(0, finite(entry?.at, 0)),
        kind: cleanId(entry?.kind) || "note",
        summary: String(entry?.summary || "").trim()
      })).filter((entry) => entry.summary).slice(-100),
      comparison: normalizeComparison(candidate?.comparison),
      conclusion: CONCLUSION_IDS.includes(candidate?.conclusion) ? candidate.conclusion : "",
      conclusionTaskId: cleanId(candidate?.conclusionTaskId),
      createdAt: Math.max(0, finite(candidate?.createdAt, 0)),
      startedAt: candidate?.startedAt == null ? null : Math.max(0, finite(candidate.startedAt, 0)),
      completedAt: candidate?.completedAt == null ? null : Math.max(0, finite(candidate.completedAt, 0)),
      abandonedAt: candidate?.abandonedAt == null ? null : Math.max(0, finite(candidate.abandonedAt, 0))
    };
  }
  function defaultState() {
    return { version: VERSION, experiments: [], nextExperimentNumber: 1 };
  }
  function normalizeState(candidate) {
    const experiments = (Array.isArray(candidate?.experiments) ? candidate.experiments : [])
      .map(normalizeExperiment).filter(Boolean).slice(-100);
    return {
      version: VERSION,
      experiments,
      nextExperimentNumber: Math.max(1, Math.floor(finite(candidate?.nextExperimentNumber, 1)), experiments.reduce((max, entry) => Math.max(max, Number(entry.id.match(/([0-9]+)$/)?.[1]) || 0), 0) + 1)
    };
  }
  function confidenceBand(value) {
    const score = clamp(value, 0, 100);
    if (score >= 80) return { id: "strong", label: "Strong" };
    if (score >= 60) return { id: "suggestive", label: "Suggestive" };
    if (score >= 40) return { id: "limited", label: "Limited" };
    return { id: "inconclusive", label: "Inconclusive" };
  }
  function differingGenomePositions(left, right) {
    const a = String(left || "");
    const b = String(right || "");
    const differences = [];
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      if (a[index] !== b[index]) differences.push({ position: index + 1, reference: a[index] || "-", subject: b[index] || "-" });
    }
    return differences;
  }
  function confidenceScore(options = {}) {
    let score = options.formalControl ? 32 : 12;
    score += Math.min(18, Math.max(0, Number(options.experimentalCount) || 0) * 6);
    score += Math.min(30, clamp(options.evidenceCoverage, 0, 1) * 30);
    score += Math.min(15, clamp(options.meanEvidenceConfidence, 0, 1) * 15);
    score -= Math.min(35, Math.max(0, Number(options.confounderCount) || 0) * 7);
    if (options.missingBaseline) score -= 12;
    return clamp(score, 0, 100);
  }
  function conclusionLabel(value) {
    return { supports: "Supports", contradicts: "Contradicts", inconclusive: "Inconclusive" }[value] || "Unconcluded";
  }

  return {
    VERSION, STATUSES, VARIABLE_TYPES, VARIABLE_TYPE_BY_ID, TEMPLATES, CONCLUSION_IDS,
    cleanId, clone, normalizeSubject, normalizeSnapshot, normalizeComparison,
    normalizeExperiment, defaultState, normalizeState, confidenceBand,
    differingGenomePositions, confidenceScore, conclusionLabel
  };
}));
