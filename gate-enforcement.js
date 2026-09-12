(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixGateEnforcement = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const clone = x => JSON.parse(JSON.stringify(x));
  function create() { return { warnings: [], cases: [], nextCase: 1, response: null, reviews: [], nextReview: 1, previousCell: null, intent: null, corrections: [] }; }
  function applicable(b, cityId, personId = "scientist") {
    return b?.personId === personId && b.status === "active" && (b.cityId === cityId || (b.recognizedBy || []).some(r => r.cityId === cityId && r.localOrderId && r.institutionId && r.status === "active"));
  }
  function warn(s, facts, now) {
    if (!facts.observed || !facts.identified || !facts.orderId) return null;
    const old = s.warnings.find(w => w.orderId === facts.orderId && w.personId === facts.personId);
    if (old) return old;
    const warning = { ...clone(facts), at: now, scope: "No entry beyond the permitted checkpoint under the active exclusion order." };
    s.warnings.push(warning); return warning;
  }
  function observe(s, facts, now) {
    if (!facts.crossed || !facts.observed || !facts.identified || !facts.knowing || !facts.prohibited || !facts.localLaw || !applicable(facts.restriction, facts.cityId, facts.personId)) return null;
    if (!s.warnings.some(w => w.orderId === facts.restriction.orderId && w.personId === facts.personId && w.at <= now)) return null;
    if (s.cases.some(c => c.crossingId === facts.crossingId)) return null;
    const c = { id: `${facts.cityId}:gate-case-${s.nextCase++}`, docket: `Gate ${facts.cityId} / ${s.nextCase - 1}`, cityId: facts.cityId, personId: facts.personId,
      typeId: "warrantObstruction", status: "referred", crossingId: facts.crossingId, occurredAt: now, sourceOrderId: facts.restriction.orderId,
      evidence: clone(facts), custodyOrder: null, nextAt: now + 300, judgment: null, reason: "Witnessed alleged obstruction of a notified lawful exclusion order. A local judicial officer must review the evidence before arrest." };
    s.cases.push(c); return c;
  }
  function authorize(c, official, facts, now) {
    if (c.status !== "referred" || now < c.nextAt) return false;
    if (!facts.channel || !official?.institutionId || official.status !== "alive" || official.health < 50) return false;
    if (!facts.sourceIdentityMatches || !facts.validAtCrossing || !c.evidence.localLaw) { c.status = "unsupported"; c.reason = "The local judicial review found no sufficient lawful basis for this custody request."; c.nextAt = null; return true; }
    c.custodyOrder = { id: `${c.id}:local-custody`, cityId: c.cityId, personId: c.personId, institutionId: official.institutionId, issuedById: official.id,
      issuedAt: now, status: "active", scope: "Identified scientist at this city's receiving checkpoint and annex; temporary jail pending local proceedings only." };
    c.status = "awaitingService"; c.nextAt = null; c.reason = "A receiving-city judicial custody order was issued on the saved witnessed evidence. No conviction or sentence has been imposed."; return true;
  }
  function reviewKey(facts) { return JSON.stringify(facts); }
  function requestReview(s, facts, now, official) {
    const key = reviewKey(facts);
    if (s.reviews.some(r => r.status === "pending" || r.key === key && r.status === "complete")) return null;
    const r = { id: `gate-review-${s.nextReview++}`, key, facts: clone(facts), officialId: official.id, requestedAt: now, dueAt: now + 900, status: "pending", result: null };
    s.reviews.push(r); return r;
  }
  function decideReview(r, facts, now) {
    if (r.status !== "pending" || now < r.dueAt || !facts.channel) return false;
    if (!facts.identityVerified || !facts.sourceAvailable) r.result = { kind: "pendingDocumentation", reason: "Identity or source documentation is still unavailable. No relief or guilt is invented." };
    else if (facts.wrongIdentity) r.result = { kind: "corrected", reason: "The source restriction concerns a different person. Its attribution to this applicant is corrected, not pardoned." };
    else if (!facts.restrictionApplies) r.result = { kind: "corrected", reason: "No active banishment under this city's own authority applies. The admission desk must reassess using current records." };
    else if (facts.permitCoversAnnex) r.result = { kind: "scopeConfirmed", reason: "The accepted temporary visitor-annex exception applies within its purpose and deadline. It does not lift the wider ban or resolve independent custody." };
    else if (facts.permitCoversCheckpoint) r.result = { kind: "scopeConfirmed", reason: "The checkpoint-and-return permit remains valid, but does not authorize entry beyond the gate. The wider banishment remains in force." };
    else r.result = { kind: "upheld", reason: "The record applies and no relevant exception is established. Discretionary relief requires a separate petition." };
    r.key = reviewKey(facts); r.facts = clone(facts); r.status = "complete"; r.decidedAt = now; return true;
  }
  function custodyActive(s) { return ["restraining", "escort", "booking", "escortCell", "jailed", "releaseEscort", "releaseCheckpoint"].includes(s?.response?.stage); }
  return { create, applicable, warn, observe, authorize, reviewKey, requestReview, decideReview, custodyActive };
});
