(function attachHelixScientistDeath(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixScientistDeath = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixScientistDeath() {
  "use strict";

  const VERSION = 1;
  function finite(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
  function cleanId(value) { return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, ""); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function cleanCell(value) { return value && Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.y)) ? { x: Math.round(Number(value.x)), y: Math.round(Number(value.y)), z: Math.round(Number(value.z) || 0) } : null; }
  function normalizeContingency(value, index = 0) {
    const source = value && typeof value === "object" ? value : {};
    return { id: cleanId(source.id) || `resurrection-contingency-${index + 1}`, kind: cleanId(source.kind) || "soulAnchor", label: String(source.label || "Resurrection contingency").trim(), status: ["incomplete", "ready", "spent", "destroyed"].includes(source.status) ? source.status : "incomplete", completedAt: source.completedAt == null ? null : Math.max(0, finite(source.completedAt)), siteId: cleanId(source.siteId), siteIntact: source.siteIntact !== false, utilitiesOnline: source.utilitiesOnline !== false, preparedBodyId: cleanId(source.preparedBodyId), memoryTier: cleanId(source.memoryTier) || "imperfect" };
  }
  function normalizeRecord(value, index = 0) {
    const source = value && typeof value === "object" ? value : {}; const diedAt = Math.max(0, finite(source.diedAt));
    return { id: cleanId(source.id) || `scientist-death-${index + 1}`, subjectId: "scientist", diedAt, causeKind: cleanId(source.causeKind) || "physicalInjury", causeLabel: String(source.causeLabel || "Fatal physical injury").trim(), location: { roomId: cleanId(source.location?.roomId), mapCell: cleanCell(source.location?.mapCell) }, physiology: { healthAtDeath: Math.max(0, finite(source.physiology?.healthAtDeath)), consciousness: cleanId(source.physiology?.consciousness) || "absent", circulation: cleanId(source.physiology?.circulation) || "stopped", brainContinuity: source.physiology?.brainContinuity !== false, headAttached: source.physiology?.headAttached !== false, lethal: source.physiology?.lethal !== false }, injuryIds: (source.injuryIds || []).map(cleanId).filter(Boolean), body: { status: "corpse", custodyKind: cleanId(source.body?.custodyKind) || "locationAuthority", custodian: String(source.body?.custodian || "Local authority").trim(), roomId: cleanId(source.body?.roomId) || cleanId(source.location?.roomId), partIds: (source.body?.partIds || ["scientist-remains"]).map(cleanId).filter(Boolean) }, legal: { caseId: cleanId(source.legal?.caseId), stayId: cleanId(source.legal?.stayId), executionId: cleanId(source.legal?.executionId) }, resurrection: { status: source.resurrection?.status === "pending" ? "pending" : "unavailable", contingencyIds: (source.resurrection?.contingencyIds || []).map(cleanId).filter(Boolean) }, terminal: Boolean(source.terminal), summary: String(source.summary || "The scientist physically died.").trim() };
  }
  function defaultState() { return { version: VERSION, records: [], contingencies: [], nextRecordNumber: 1, nextContingencyNumber: 1 }; }
  function normalizeState(value) { const source = value && typeof value === "object" ? value : {}; const records = (Array.isArray(source.records) ? source.records : []).map(normalizeRecord); const contingencies = (Array.isArray(source.contingencies) ? source.contingencies : []).map(normalizeContingency); return { version: VERSION, records, contingencies, nextRecordNumber: Math.max(1, Math.floor(finite(source.nextRecordNumber, records.length + 1))), nextContingencyNumber: Math.max(1, Math.floor(finite(source.nextContingencyNumber, contingencies.length + 1))) }; }
  function readyContingencies(state) { return state.contingencies.filter((entry) => entry.status === "ready" && entry.completedAt != null && entry.siteIntact && entry.utilitiesOnline && entry.preparedBodyId); }
  function addContingency(value, options = {}, clock = 0) { const state = normalizeState(value); const contingency = normalizeContingency({ ...options, id: options.id || `resurrection-contingency-${state.nextContingencyNumber++}`, status: options.status || "ready", completedAt: options.completedAt ?? clock }); state.contingencies.push(contingency); return { state, contingency, changed: true }; }
  function recordDeath(value, options = {}, clock = 0) {
    const state = normalizeState(value); const existing = state.records.at(-1); if (existing?.subjectId === "scientist" && existing.diedAt === Math.max(0, finite(clock))) return { state, record: existing, created: false, terminal: existing.terminal, resurrectionPending: existing.resurrection.status === "pending" };
    const physiology = { healthAtDeath: Math.max(0, finite(options.physiology?.healthAtDeath)), consciousness: options.physiology?.consciousness || "absent", circulation: options.physiology?.circulation || "stopped", brainContinuity: options.physiology?.brainContinuity !== false, headAttached: options.physiology?.headAttached !== false, lethal: options.physiology?.lethal !== false };
    if (!physiology.lethal) return { state, record: null, created: false, terminal: false, resurrectionPending: false };
    const matches = readyContingencies(state); const pending = matches.length > 0; const separated = physiology.headAttached === false;
    const record = normalizeRecord({ id: `scientist-death-${state.nextRecordNumber++}`, diedAt: clock, causeKind: options.causeKind, causeLabel: options.causeLabel, location: options.location, physiology, injuryIds: options.injuryIds, body: { ...options.body, partIds: options.body?.partIds || (separated ? ["scientist-head-remains", "scientist-body-remains"] : ["scientist-remains"]) }, legal: options.legal, resurrection: { status: pending ? "pending" : "unavailable", contingencyIds: matches.map((entry) => entry.id) }, terminal: !pending, summary: options.summary });
    state.records.push(record); return { state, record, created: true, terminal: record.terminal, resurrectionPending: pending };
  }
  function latestRecord(value) { return normalizeState(value).records.at(-1) || null; }

  return { VERSION, defaultState, normalizeState, addContingency, recordDeath, latestRecord };
}));
