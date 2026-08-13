(function attachHelixInvestigativeEvidence(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixInvestigativeEvidence = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixInvestigativeEvidence() {
  "use strict";

  const VERSION = 1;
  const CATEGORIES = Object.freeze(["biological", "chemical", "documentary", "commercial"]);
  const LIFECYCLES = Object.freeze(["present", "contained", "transformed", "externalized", "exhausted", "lost"]);
  const SIGNIFICANCE = Object.freeze(["trace", "minor", "material", "serious", "critical"]);
  const PERSISTENCE = Object.freeze(["transient", "durable", "subject", "permanent"]);

  function cleanId(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "");
  }

  function finiteTime(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : fallback;
  }

  function cleanIds(candidate) {
    return [...new Set((Array.isArray(candidate) ? candidate : []).map(cleanId).filter(Boolean))];
  }

  function normalizeLocus(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const cell = source.cell && Number.isFinite(Number(source.cell.x)) && Number.isFinite(Number(source.cell.y))
      ? { x: Math.floor(Number(source.cell.x)), y: Math.floor(Number(source.cell.y)), z: Math.floor(Number(source.cell.z) || 0) }
      : null;
    return {
      kind: cleanId(source.kind) || (cell ? "mapCell" : "site"),
      roomId: cleanId(source.roomId), cell,
      fixtureId: cleanId(source.fixtureId), containerId: cleanId(source.containerId),
      accessPointId: cleanId(source.accessPointId), label: String(source.label || "").trim()
    };
  }

  function normalizeRecord(candidate, index = 0) {
    if (!candidate || typeof candidate !== "object") return null;
    const createdAt = finiteTime(candidate.createdAt, 0);
    const persistenceKind = PERSISTENCE.includes(candidate.persistence?.kind) ? candidate.persistence.kind : "durable";
    const category = CATEGORIES.includes(candidate.category) ? candidate.category : "documentary";
    const lifecycle = LIFECYCLES.includes(candidate.lifecycle) ? candidate.lifecycle : "present";
    const significance = SIGNIFICANCE.includes(candidate.significance) ? candidate.significance : "minor";
    const refs = candidate.refs && typeof candidate.refs === "object" ? candidate.refs : {};
    return {
      id: cleanId(candidate.id) || `site-evidence-${index + 1}`,
      type: cleanId(candidate.type) || "siteTrace", category,
      label: String(candidate.label || "Site trace").trim(),
      createdAt, updatedAt: finiteTime(candidate.updatedAt, createdAt),
      origin: {
        kind: cleanId(candidate.origin?.kind) || "event",
        id: cleanId(candidate.origin?.id),
        label: String(candidate.origin?.label || "").trim()
      },
      subject: {
        kind: cleanId(candidate.subject?.kind),
        id: cleanId(candidate.subject?.id)
      },
      locus: normalizeLocus(candidate.locus),
      refs: {
        stackIds: cleanIds(refs.stackIds), batchIds: cleanIds(refs.batchIds),
        slimeIds: cleanIds(refs.slimeIds), corpseIds: cleanIds(refs.corpseIds),
        contractIds: cleanIds(refs.contractIds), companyRecordIds: cleanIds(refs.companyRecordIds),
        varianceIds: cleanIds(refs.varianceIds), fixtureIds: cleanIds(refs.fixtureIds),
        predecessorEvidenceIds: cleanIds(refs.predecessorEvidenceIds), successorEvidenceIds: cleanIds(refs.successorEvidenceIds)
      },
      traits: [...new Set((Array.isArray(candidate.traits) ? candidate.traits : []).map((value) => String(value || "").trim()).filter(Boolean))],
      magnitude: {
        band: ["trace", "small", "moderate", "large", "extensive"].includes(candidate.magnitude?.band) ? candidate.magnitude.band : "trace",
        amount: Math.max(0, Number(candidate.magnitude?.amount) || 0),
        unit: String(candidate.magnitude?.unit || "").trim()
      },
      discoverability: {
        level: ["obvious", "ordinary", "subtle", "concealed"].includes(candidate.discoverability?.level) ? candidate.discoverability.level : "ordinary",
        methods: [...new Set((Array.isArray(candidate.discoverability?.methods) ? candidate.discoverability.methods : []).map(cleanId).filter(Boolean))]
      },
      significance,
      integrity: Math.max(0, Math.min(100, Number(candidate.integrity ?? 100) || 0)),
      persistence: {
        kind: persistenceKind,
        decaySeconds: Math.max(0, Number(candidate.persistence?.decaySeconds) || 0)
      },
      knowledge: {
        state: ["unknown", "known", "stale"].includes(candidate.knowledge?.state) ? candidate.knowledge.state : "unknown",
        learnedAt: candidate.knowledge?.learnedAt == null ? null : finiteTime(candidate.knowledge.learnedAt, createdAt),
        source: cleanId(candidate.knowledge?.source),
        sourceIdentityKnown: Boolean(candidate.knowledge?.sourceIdentityKnown)
      },
      lifecycle,
      coalesceKey: String(candidate.coalesceKey || "").trim(),
      provenance: (Array.isArray(candidate.provenance) ? candidate.provenance : []).map((entry) => ({
        at: finiteTime(entry?.at, createdAt), action: cleanId(entry?.action) || "created",
        actorId: cleanId(entry?.actorId), from: normalizeLocus(entry?.from), to: normalizeLocus(entry?.to),
        details: String(entry?.details || "").trim()
      })).sort((a, b) => a.at - b.at)
    };
  }

  function defaultState() {
    return { version: VERSION, records: [], nextEvidenceNumber: 1 };
  }

  function normalizeState(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const records = (Array.isArray(source.records) ? source.records : []).map(normalizeRecord).filter(Boolean);
    const nextFromIds = records.reduce((max, record) => {
      const match = record.id.match(/(\d+)$/);
      return Math.max(max, match ? Number(match[1]) + 1 : 1);
    }, 1);
    return {
      version: VERSION,
      records,
      nextEvidenceNumber: Math.max(nextFromIds, Math.floor(Number(source.nextEvidenceNumber) || 1))
    };
  }

  function integrityAt(record, clock, subjectExists = true) {
    const normalized = normalizeRecord(record);
    if (!normalized) return 0;
    if (normalized.persistence.kind === "permanent") return normalized.integrity;
    if (normalized.persistence.kind === "subject") return subjectExists ? normalized.integrity : 0;
    const decaySeconds = normalized.persistence.decaySeconds;
    if (!decaySeconds) return normalized.integrity;
    const elapsed = Math.max(0, finiteTime(clock, normalized.updatedAt) - normalized.updatedAt);
    return Math.max(0, normalized.integrity * (1 - elapsed / decaySeconds));
  }

  function significanceRank(value) {
    return Math.max(0, SIGNIFICANCE.indexOf(value));
  }

  return { VERSION, CATEGORIES, LIFECYCLES, SIGNIFICANCE, PERSISTENCE, cleanId, normalizeLocus, normalizeRecord, defaultState, normalizeState, integrityAt, significanceRank };
}));
