(function attachHelixEvidenceHandling(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixEvidenceHandling = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createHelixEvidenceHandling() {
  "use strict";

  const VERSION = 1;
  const ACTIONS = Object.freeze(["clean", "collect", "secure", "conceal", "relabel", "treat", "dispose", "amend", "destroy"]);
  const STATUSES = Object.freeze(["queued", "active", "completed", "failed", "canceled"]);
  const RISK_BANDS = Object.freeze([
    { id: "routine", label: "Routine", min: 0 },
    { id: "delicate", label: "Delicate", min: 3 },
    { id: "hazardous", label: "Hazardous", min: 6 },
    { id: "severe", label: "Severe", min: 10 }
  ]);
  const OUTCOMES = Object.freeze(["controlled", "partial", "careless"]);

  function cleanId(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "");
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function cleanIds(candidate) {
    return [...new Set((Array.isArray(candidate) ? candidate : []).map(cleanId).filter(Boolean))];
  }

  function hash32(value) {
    let hash = 2166136261;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededUnit(seed) {
    return hash32(seed) / 4294967296;
  }

  function assessRisk(candidate = {}) {
    const action = ACTIONS.includes(candidate.action) ? candidate.action : "collect";
    const reasons = [];
    let score = 0;
    const add = (amount, reason) => {
      score += amount;
      reasons.push(reason);
    };
    const hazardTags = new Set((candidate.hazardTags || []).map((tag) => String(tag || "").toLowerCase()));
    if (["hazardous", "toxic", "corrosive", "infectious", "volatile", "contraband"].some((tag) => hazardTags.has(tag))) add(3, "hazardous or sensitive subject");
    if (hazardTags.has("chemical") || hazardTags.has("biological")) add(1, "trace-bearing material");
    if (["conceal", "relabel", "destroy"].includes(action)) add(2, "deliberate alteration");
    if (action === "dispose") add(1, "external custody transfer");
    if (candidate.publicRoute) add(2, "route crosses public-facing space");
    if (candidate.toolsSuitable === false) add(3, "unsuitable or missing tool");
    if (candidate.ppeRequired && !candidate.ppePresent) add(2, "required protective equipment absent");
    if (candidate.compatible === false) add(3, "incompatible vessel or process");
    if (finite(candidate.toolCondition, 100) < 40) add(2, "poor tool condition");
    if (finite(candidate.workstationCondition, 100) < 45) add(2, "poor workstation condition");
    if (finite(candidate.light, 100) < 30) add(1, "poor illumination");
    if (finite(candidate.contamination, 0) > 50) add(2, "contaminated work area");
    if (finite(candidate.integrity, 100) < 35) add(1, "fragile or degraded subject");
    const band = [...RISK_BANDS].reverse().find((entry) => score >= entry.min) || RISK_BANDS[0];
    return { score, bandId: band.id, label: band.label, reasons: reasons.length ? reasons : ["compatible routine handling"] };
  }

  function frozenOutcome(seed, risk) {
    const roll = seededUnit(seed);
    const score = Math.max(0, finite(risk?.score, 0));
    const carelessThreshold = Math.min(0.55, score * 0.035);
    const partialThreshold = Math.min(0.82, carelessThreshold + 0.08 + score * 0.025);
    const id = roll < carelessThreshold ? "careless" : roll < partialThreshold ? "partial" : "controlled";
    return { id, rollKey: hash32(seed).toString(16).padStart(8, "0") };
  }

  function normalizeOrder(candidate, index = 0) {
    if (!candidate || typeof candidate !== "object") return null;
    const action = ACTIONS.includes(candidate.action) ? candidate.action : "collect";
    const risk = assessRisk({ action, ...(candidate.riskContext || {}), ...(candidate.risk || {}) });
    const seed = String(candidate.outcomeSeed || `handling-order-${index + 1}`);
    const frozen = OUTCOMES.includes(candidate.outcome?.id) ? candidate.outcome : frozenOutcome(seed, risk);
    return {
      id: cleanId(candidate.id) || `handling-order-${index + 1}`,
      taskId: cleanId(candidate.taskId), action,
      status: STATUSES.includes(candidate.status) ? candidate.status : "queued",
      subject: { kind: cleanId(candidate.subject?.kind) || "physicalStack", id: cleanId(candidate.subject?.id) },
      evidenceIds: cleanIds(candidate.evidenceIds),
      predecessorEvidenceIds: cleanIds(candidate.predecessorEvidenceIds),
      successorEvidenceIds: cleanIds(candidate.successorEvidenceIds),
      method: String(candidate.method || action), destination: String(candidate.destination || ""),
      toolIds: cleanIds(candidate.toolIds), receptacleIds: cleanIds(candidate.receptacleIds), workstationId: cleanId(candidate.workstationId),
      route: (Array.isArray(candidate.route) ? candidate.route : []).map((entry) => ({
        x: Math.floor(finite(entry?.x)), y: Math.floor(finite(entry?.y)), z: Math.floor(finite(entry?.z))
      })),
      companyRecordIds: cleanIds(candidate.companyRecordIds),
      outcomeSeed: seed,
      risk: { score: Math.max(0, finite(candidate.risk?.score, risk.score)), bandId: String(candidate.risk?.bandId || risk.bandId), label: String(candidate.risk?.label || risk.label), reasons: [...new Set(candidate.risk?.reasons || risk.reasons)] },
      outcome: { id: frozen.id, rollKey: String(frozen.rollKey || hash32(seed).toString(16).padStart(8, "0")) },
      createdAt: Math.max(0, finite(candidate.createdAt)), startedAt: candidate.startedAt == null ? null : Math.max(0, finite(candidate.startedAt)),
      completedAt: candidate.completedAt == null ? null : Math.max(0, finite(candidate.completedAt)),
      interruption: String(candidate.interruption || ""), failure: String(candidate.failure || ""),
      details: String(candidate.details || "")
    };
  }

  function normalizePacket(candidate, index = 0) {
    if (!candidate || typeof candidate !== "object") return null;
    return {
      id: cleanId(candidate.id) || `records-packet-${index + 1}`,
      periodId: cleanId(candidate.periodId), stackId: cleanId(candidate.stackId),
      status: ["local", "filed", "destroyed", "seized"].includes(candidate.status) ? candidate.status : "local",
      amendmentRecordIds: cleanIds(candidate.amendmentRecordIds),
      createdAt: Math.max(0, finite(candidate.createdAt)), destroyedAt: candidate.destroyedAt == null ? null : Math.max(0, finite(candidate.destroyedAt)),
      seizedAt: candidate.seizedAt == null ? null : Math.max(0, finite(candidate.seizedAt))
    };
  }

  function normalizeManifest(candidate, index = 0) {
    if (!candidate || typeof candidate !== "object") return null;
    return {
      id: cleanId(candidate.id) || `disposal-manifest-${index + 1}`,
      orderId: cleanId(candidate.orderId), subjectId: cleanId(candidate.subjectId), stackId: cleanId(candidate.stackId),
      companyRecordId: cleanId(candidate.companyRecordId), service: String(candidate.service || "Licensed hazardous-material carrier"),
      fee: Math.max(0, Math.round(finite(candidate.fee))), transferredAt: Math.max(0, finite(candidate.transferredAt)),
      classification: String(candidate.classification || "classified waste")
    };
  }

  function defaultState() {
    return { version: VERSION, orders: [], packets: [], manifests: [], nextOrderNumber: 1, nextPacketNumber: 1, nextManifestNumber: 1 };
  }

  function normalizeState(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const orders = (Array.isArray(source.orders) ? source.orders : []).map(normalizeOrder).filter(Boolean);
    const packets = (Array.isArray(source.packets) ? source.packets : []).map(normalizePacket).filter(Boolean);
    const manifests = (Array.isArray(source.manifests) ? source.manifests : []).map(normalizeManifest).filter(Boolean);
    const next = (entries, fallback) => entries.reduce((maximum, entry) => Math.max(maximum, Number(entry.id.match(/(\d+)$/)?.[1] || 0) + 1), fallback);
    return {
      version: VERSION, orders, packets, manifests,
      nextOrderNumber: Math.max(Math.floor(finite(source.nextOrderNumber, 1)), next(orders, 1)),
      nextPacketNumber: Math.max(Math.floor(finite(source.nextPacketNumber, 1)), next(packets, 1)),
      nextManifestNumber: Math.max(Math.floor(finite(source.nextManifestNumber, 1)), next(manifests, 1))
    };
  }

  function createOrder(state, candidate) {
    const target = normalizeState(state);
    const subjectId = cleanId(candidate?.subject?.id);
    if (!subjectId) return { state: target, order: null, reason: "A physical or documentary subject is required." };
    const duplicate = target.orders.find((order) => order.subject.id === subjectId && ["queued", "active"].includes(order.status));
    if (duplicate) return { state: target, order: duplicate, reason: "Handling is already pending for this subject." };
    const id = `handling-order-${target.nextOrderNumber++}`;
    const risk = assessRisk(candidate.riskContext || { action: candidate.action });
    const outcomeSeed = String(candidate.outcomeSeed || `${candidate.seed || "site"}:${id}:${subjectId}:${candidate.action}`);
    const order = normalizeOrder({ ...candidate, id, risk, outcomeSeed, outcome: frozenOutcome(outcomeSeed, risk) }, target.orders.length);
    target.orders.push(order);
    return { state: target, order, reason: "" };
  }

  function deriveCustody(candidate = {}) {
    if (candidate.lifecycle === "externalized") return { id: "externalized", label: "Externalized", description: "Transferred beyond site custody; external records or custody may persist." };
    if (candidate.lifecycle === "transformed") return { id: "transformed", label: "Transformed", description: "The original subject became traceable successor material." };
    if (candidate.concealed) return { id: "concealed", label: "Concealed", description: "Obscured behind a physical or documentary barrier; not universally invisible." };
    if (candidate.accessState === "locked" || finite(candidate.security) >= 3) return { id: "secured", label: "Secured", description: "Protected by a real lock or restricted physical boundary." };
    if (candidate.contained || ["closed"].includes(candidate.accessState)) return { id: "contained", label: "Contained", description: "Inside a closed vessel or fixture that blocks casual observation." };
    return { id: "exposed", label: "Exposed", description: "Available to ordinary observation at its current locus." };
  }

  return {
    VERSION, ACTIONS, STATUSES, RISK_BANDS, OUTCOMES,
    hash32, seededUnit, assessRisk, frozenOutcome, normalizeOrder, normalizePacket, normalizeManifest,
    defaultState, normalizeState, createOrder, deriveCustody
  };
}));
