(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixBanishmentRelief = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERIFY_SECONDS = 900, DECISION_SECONDS = 1800, VISIT_SECONDS = 7200, OFFER_SECONDS = 21600, WARNING_SECONDS = 900;
  const clone = value => JSON.parse(JSON.stringify(value));
  function create(authority = null) { return { authority, petitions: [], nextPetition: 1, receipts: [], sponsorship: null }; }
  function key(kind, facts) { return JSON.stringify({ kind, ...facts }); }
  function request(s, kind, facts, now) {
    if (!["temporary", "permanent"].includes(kind) || !facts.orderId || !facts.restrictionApplies) return null;
    const signature = key(kind, facts);
    if (s.petitions.some(p => ["verifying", "deciding", "offered"].includes(p.status) || p.key === signature)) return null;
    const p = { id: `relief:${facts.cityId}:${s.nextPetition++}`, personId: facts.personId, cityId: facts.cityId, orderId: facts.orderId, localOrderId: facts.localOrderId || null,
      requestedKind: kind, requestedAt: now, key: signature, facts: clone(facts), status: "verifying", nextAt: now + VERIFY_SECONDS, result: null, grant: null,
      history: [{ at: now, action: "submitted", reason: "Physical petition received. No stay, admission, pardon or release is implied." }] };
    s.petitions.push(p); return p;
  }
  function authorityValid(authority, facts) {
    return Boolean(authority?.id && authority.name && authority.charterId && authority.role === "sovereign" && authority.cityId === facts.cityId && authority.status === "available");
  }
  function evaluate(kind, f) {
    if (!f.identityVerified || !f.sourceAvailable) return { kind: "missingEvidence", reason: "Verified identity or source-order records are missing. Supply new documentation; no relief or guilt is invented." };
    if (!f.restrictionApplies || f.sourcePersonId !== f.personId) return { kind: "applicabilityReview", reason: "The restriction may not apply to this person. Use applicability correction, not a discretionary pardon." };
    const services = (f.services || []).filter(r => r.verified && r.cityId === f.cityId && r.personId === f.personId && r.witnessId && r.needId);
    const medical = f.medical?.verified && f.medical.personId === f.personId && f.medical.needed && f.medical.issuerId;
    const sponsored = f.sponsor?.verified && f.sponsor.cityId === f.cityId && f.sponsor.personId === f.personId && services.some(r => r.id === f.sponsor.serviceId);
    if (!medical && !services.length) return { kind: "refused", reason: "No documented medical necessity or verified assistance to this city supports an exception. Cash and unsupported claims do not substitute for grounds." };
    if (kind === "permanent" && sponsored && new Set(services.map(r => r.needId)).size >= 2 && f.longStanding && f.fullReviewCapacity && !f.pendingLocalCase) {
      return { kind: "approved", reliefKind: "permanent", scope: "localBanishmentOnly", purpose: "Documented sustained civic cooperation with local institutional endorsement", reason: "The city authorizes lifting its own restriction after a long-standing ban, independently recorded service episodes and local endorsement. The original judgment and other cities' orders remain unchanged." };
    }
    return { kind: kind === "permanent" ? "counteroffer" : "approved", reliefKind: "temporary", scope: "visitorAnnexOnly", duration: VISIT_SECONDS,
      purpose: medical ? "Limited sheltered recovery" : "Limited civic-service visit", reason: kind === "permanent" ? "The evidence supports only a bounded visit. Permanent relief requires a thirty-day standing ban, two distinct verified service episodes, institutional sponsorship, full review capacity and resolution of any separate local case; an allegation is not a conviction." : "A limited visitor-annex exception is authorized on verified grounds. It does not lift the wider ban or resolve custody. No treatment, supplies or onward city access is promised." };
  }
  function advance(p, facts, officials, now) {
    if (!["verifying", "deciding"].includes(p.status) || now < p.nextAt) return false;
    if (!officials.channel || !officials.reviewer?.id || !officials.reviewer.institutionId || officials.reviewer.status !== "alive" || officials.reviewer.health < 50 || !authorityValid(officials.authority, facts)) return false;
    if (p.status === "deciding" && p.key !== key(p.requestedKind, facts)) {
      p.status = "verifying"; p.nextAt = now + VERIFY_SECONDS; p.key = key(p.requestedKind, facts); p.facts = clone(facts);
      p.history.push({ at: now, action: "reverification", reason: "Material records changed before decision; verify them again rather than use stale evidence." }); return true;
    }
    p.facts = clone(facts); p.key = key(p.requestedKind, facts);
    if (p.status === "verifying") {
      p.verifiedBy = officials.reviewer.id; p.verifiedAt = now; p.status = "deciding"; p.nextAt = now + DECISION_SECONDS;
      p.history.push({ at: now, action: "verified", reason: "The local judiciary checked scope and the available records; the sovereign authority must decide relief." }); return true;
    }
    p.result = { ...evaluate(p.requestedKind, facts), decidedAt: now, decidedBy: clone(officials.authority) };
    p.status = p.result.reliefKind ? "offered" : "complete"; p.nextAt = p.status === "offered" ? now + OFFER_SECONDS : null;
    p.history.push({ at: now, action: "decision", reason: p.result.reason }); return true;
  }
  function accept(p, facts, authority, now) {
    if (p?.status !== "offered" || now >= p.nextAt || !authorityValid(authority, facts) || authority.id !== p.result.decidedBy.id || p.key !== key(p.requestedKind, facts)) return false;
    p.status = "active"; p.acceptedAt = now; p.nextAt = null;
    p.grant = { id: `${p.id}:instrument`, cityId: p.cityId, personId: p.personId, orderId: p.orderId, localOrderId: p.localOrderId,
      kind: p.result.reliefKind, scope: p.result.scope, purpose: p.result.purpose, authorityId: authority.id, effectiveAt: now,
      expiresAt: p.result.reliefKind === "temporary" ? now + p.result.duration : null };
    p.history.push({ at: now, action: "accepted", reason: "Conditions accepted. Admission must be reassessed and any passage must occur physically; independent custody remains in force." }); return true;
  }
  function decline(p, now) { if (p?.status !== "offered") return false; p.status = "declined"; p.nextAt = null; p.history.push({ at: now, action: "declined", reason: "The offered exception was declined; no relief took effect." }); return true; }
  function grantFor(s, cityId, personId, orderId, localOrderId, now, permanentOnly = false) {
    return s?.petitions.find(p => p.status === "active" && p.grant && p.cityId === cityId && p.personId === personId && p.orderId === orderId && (p.localOrderId || null) === (localOrderId || null)
      && (!permanentOnly || p.grant.kind === "permanent") && p.grant.effectiveAt <= now && (p.grant.expiresAt == null || now < p.grant.expiresAt))?.grant || null;
  }
  function localOrders(b, cityId) {
    if (!b || b.status !== "active") return [];
    return b.cityId === cityId ? [null] : [...new Set((b.recognizedBy || []).filter(r => r?.cityId === cityId && r.status === "active" && r.institutionId && r.localOrderId).map(r => r.localOrderId))];
  }
  function grantForBanishment(s, b, cityId, now, permanentOnly = false) {
    const grants = localOrders(b, cityId).map(localId => grantFor(s, cityId, b.personId, b.orderId, localId, now, permanentOnly));
    if (!grants.length || grants.some(g => !g)) return null;
    return grants.sort((a, b) => (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity))[0];
  }
  function tick(s, now) {
    const events = [];
    for (const p of s.petitions) {
      if (p.status === "offered" && now >= p.nextAt) { p.status = "offerExpired"; p.nextAt = null; events.push({ id: p.id, reason: "The unaccepted relief offer expired. No exception took effect." }); }
      if (p.status !== "active" || p.grant.expiresAt == null) continue;
      if (now >= p.grant.expiresAt) { p.status = "expired"; events.push({ id: p.id, reason: "Temporary permission expired; admission is reassessed. The earlier authorized visit remains lawful. Return physically to the permitted checkpoint unless another permission applies; no automatic arrest or new allegation occurs." }); }
      else if (!p.warnedAt && now >= p.grant.expiresAt - WARNING_SECONDS) { p.warnedAt = now; events.push({ id: p.id, reason: "Temporary permission ends in fifteen minutes. Start the physical return to the permitted checkpoint; custody, if any, is a separate obligation." }); }
    }
    return events;
  }
  function nextEvent(s, now, available = true) {
    const times = (s?.petitions || []).flatMap(p => p.nextAt != null ? [Math.max(now + (available || p.status === "offered" ? 1 : 60), p.nextAt)] : p.status === "active" && p.grant?.expiresAt != null ? [Math.max(now + 1, p.warnedAt ? p.grant.expiresAt : p.grant.expiresAt - WARNING_SECONDS)] : []);
    return times.length ? Math.min(...times) : null;
  }
  return { VERIFY_SECONDS, DECISION_SECONDS, VISIT_SECONDS, OFFER_SECONDS, WARNING_SECONDS, create, key, request, authorityValid, evaluate, advance, accept, decline, grantFor, localOrders, grantForBanishment, tick, nextEvent };
});
