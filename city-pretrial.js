(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./pretrial-proceedings") : root.HelixPretrialProceedings);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixCityPretrial = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Pretrial) {
  "use strict";
  const clone = value => JSON.parse(JSON.stringify(value));
  const able = actor => Boolean(actor?.id && actor.institutionId && actor.status === "alive" && actor.health >= 50);
  const closed = c => ["unsupported", "dismissedIdentityError", "chargesDismissed", "resolved"].includes(c.status);
  function open(c, policy, officials, now) {
    return { caseId: c.id, phase: "screening", nextAt: now + 900, reviewAt: now + 4 * 3600, delay: "", packet: null, handoff: null, permit: null,
      statement: "silent", reviews: [], refundDue: 0, policy: clone(policy),
      legal: Pretrial.normalizeState({ proceedings: [{ id: `${c.id}:pretrial`, authorityCaseId: c.id, docket: c.docket, openedAt: now,
        timeline: { chargingAt: now + 900, firstAppearanceAt: now + 900, counselDeadline: now + 4 * 3600, nextHearingAt: now + 4 * 3600 },
        court: { id: policy.judiciaryId, label: "Receiving-city first-appearance court", jurisdictionId: c.cityId, judge: officials.judge, prosecutor: officials.prosecutor },
        counsel: { options: [{ id: `${c.id}:public`, kind: "public", name: officials.public.name, cost: 0, available: true },
          { id: `${c.id}:retained`, kind: "retained", name: officials.retained.name, cost: 150, available: true },
          { id: `${c.id}:self`, kind: "self", name: "The Scientist", cost: 0, available: true }] }, charges: [] }] }) };
  }
  const proceeding = s => s?.legal.proceedings[0];
  function supportReason(c, sourcePersonId) {
    const f = c.evidence, b = f?.restriction, notice = f?.notice;
    if (sourcePersonId !== c.personId) return "Source identity does not support attribution to this defendant.";
    if (!f?.crossed || !f.observed || !f.identified || !f.knowing || !f.prohibited || !f.observerId || !f.cell || !f.observerCell) return "The saved crossing, identification or witness record is insufficient.";
    if (!f.localLaw?.id || f.localLaw.typeId !== "warrantObstruction") return "No applicable published local offense supports this charge.";
    if (!b || b.personId !== c.personId || b.orderId !== c.sourceOrderId || b.status !== "active" || !(b.cityId === c.cityId || b.recognizedBy?.some(r => r.cityId === c.cityId && r.localOrderId && r.institutionId && r.status === "active"))) return "No valid local exclusion authority at the time of crossing is evidenced.";
    if (!notice || notice.personId !== c.personId || notice.orderId !== b.orderId || !notice.officerId || notice.at > c.occurredAt || !notice.observed || !notice.identified) return "Prior communicated notice is missing or does not cover this crossing.";
    if (f.permits?.annexAuthorized) return "The saved permission covered this crossing; a later change cannot criminalize it.";
    return "";
  }
  function dismiss(s, c, reason, now) {
    const p = proceeding(s); if (closed(c) && s.phase === "dismissed") return false;
    s.refundDue += p.release.escrowStatus === "held" ? p.release.bailAmount : 0;
    if (p.release.escrowStatus === "held") p.release.escrowStatus = "refunded";
    p.charges.forEach(charge => { charge.status = "dismissed"; }); p.status = "chargesDismissed";
    p.release.status = "released"; p.release.kind = "dismissal"; p.release.orderedAt = now;
    p.release.conditions.forEach(condition => { condition.status = "lifted"; });
    p.resolution = { judgmentId: "", outcomeKind: "dismissal", enteredAt: now, summary: reason, verdicts: p.charges.map(charge => ({ chargeId: charge.id, verdict: "dismissed", reason })), sentenceOrderId: "" };
    p.history.push({ at: now, action: "localDismissal", summary: reason });
    c.status = "chargesDismissed"; c.reason = reason; if (c.custodyOrder) c.custodyOrder.status = "withdrawn";
    s.phase = "dismissed"; s.nextAt = null; s.reviewAt = null; s.handoff = null; s.delay = "";
    s.permit = permit(c, now); return true;
  }
  function screen(s, c, facts, now) {
    if (s.phase !== "screening" || now < s.nextAt) return false;
    if (!facts.channel || !able(facts.prosecutor) || facts.prosecutor.institutionId !== s.policy.prosecutionId) { s.delay = "Screening awaits the named local prosecutor and powered records. No guilt or new authority is inferred."; return false; }
    const reason = supportReason(c, facts.sourcePersonId);
    s.packet = clone({ id: `${c.id}:disclosure`, cityId: c.cityId, frozenAt: now, crossingAt: c.occurredAt, evidence: c.evidence, custodyOrder: c.custodyOrder, prosecutor: facts.prosecutor.id, notice: c.evidence.notice,
      rule: c.evidence.localLaw, permits: c.evidence.permits || null, sourcePersonId: facts.sourcePersonId });
    if (reason) return dismiss(s, c, reason, now);
    const p = proceeding(s);
    p.charges = [Pretrial.normalizeProceeding({ charges: [{ id: `${c.id}:obstruction`, typeId: "warrantObstruction", label: "Obstruction of Lawful Process — Notified Gate Exclusion", status: "filed", filedAt: now,
      publicProbableCause: "Saved identified crossing after communicated notice; support for a hearing, not proof of guilt.", support: [{ id: c.crossingId, kind: "witnessStatement", sourceId: c.id, label: "Witnessed gate crossing and its contemporaneous records", reliability: "strong", disclosed: false }] }] }).charges[0]];
    p.status = "counselSelection"; p.firstAppearance.status = "ready";
    p.history.push({ at: now, action: "localScreening", summary: `${facts.prosecutor.name} filed only the supported local gate allegation.` });
    s.phase = "disclosurePending"; s.nextAt = null; s.delay = ""; return true;
  }
  function disclose(s, now) {
    if (s.phase !== "disclosurePending" || !s.packet) return false;
    const p = proceeding(s); p.discovery.status = "reviewed"; p.discovery.packetId = s.packet.id;
    p.discovery.frozenAt = s.packet.frozenAt; p.discovery.servedAt = now; p.discovery.reviewedAt = now; p.discovery.serviceRoute = "receivingCityTerminal";
    p.charges.forEach(c => c.support.forEach(item => { item.disclosed = true; }));
    p.discovery.witnesses = [{ id: s.packet.evidence.observerId, name: "Identified receiving-gate officer" }];
    s.phase = "preparing"; return true;
  }
  function counsel(s, kind, now) {
    const p = proceeding(s), option = p.counsel.options.find(o => o.kind === kind);
    if (!option || s.phase !== "preparing") return false;
    const selected = p.counsel.options.find(o => o.id === p.counsel.selectedOptionId);
    // An unpaid private retainer must not trap a defendant who cannot afford it.
    if (selected?.kind === "retained" && !p.counsel.paid && kind !== "retained") p.counsel.selectedOptionId = "";
    const result = Pretrial.selectCounsel(s.legal, p.id, option.id, now); s.legal = result.state; return result.changed;
  }
  function payCounsel(s, balance, now) {
    const p = proceeding(s), option = p.counsel.options.find(o => o.id === p.counsel.selectedOptionId);
    if (!option || option.kind !== "retained" || p.counsel.paid || balance < option.cost) return 0;
    const result = Pretrial.markCounselPaid(s.legal, p.id, now); s.legal = result.state; return result.changed ? option.cost : 0;
  }
  function conference(s, now) {
    const p = proceeding(s), option = p.counsel.options.find(o => o.id === p.counsel.selectedOptionId);
    if (!option || option.kind === "self" || !p.counsel.paid) return false;
    const result = Pretrial.recordConference(s.legal, p.id, { clock: now, channel: "privateLocalCourtLink", summary: "Completed thirty-minute privileged conference on this disclosed local case." });
    s.legal = result.state; return result.changed;
  }
  function requirement(s) {
    if (!s || !["preparing", "reviewReady"].includes(s.phase)) return "Receive and review the local disclosure packet first.";
    return Pretrial.hearingRequirements(proceeding(s));
  }
  function permit(c, now) { return { id: `${c.id}:court-permit`, cityId: c.cityId, personId: c.personId, issuedAt: now, scope: "supervisedCheckpointHearingAndEgressOnly", admission: false }; }
  function request(s, c, submission, statement, now) {
    if (requirement(s) || !["recognizance", "strictConditions", "securedBail"].includes(submission) || !["silent", "notGuilty"].includes(statement)) return false;
    s.statement = statement; s.submission = submission; s.phase = "escortPending"; s.permit = permit(c, now); s.nextAt = now + 1; return true;
  }
  function begin(s, facts, now) {
    if (s.phase !== "escortPending" || !facts.present || !facts.channel || !able(facts.judge) || !able(facts.prosecutor) || facts.judge.institutionId !== s.policy.judiciaryId || facts.prosecutor.institutionId !== s.policy.prosecutionId || !facts.counselReady) return false;
    const result = Pretrial.beginHearing(s.legal, proceeding(s).id, s.submission, now);
    if (!result.changed) return false;
    s.legal = result.state; s.phase = "hearing"; s.nextAt = now + 900; return true;
  }
  function decide(s, c, facts, now) {
    if (s.phase !== "hearing" || now < s.nextAt || !facts.present || !facts.channel || !facts.counselReady || !able(facts.judge) || !able(facts.prosecutor) || facts.judge.institutionId !== s.policy.judiciaryId || facts.prosecutor.institutionId !== s.policy.prosecutionId) return false;
    const reason = supportReason({ ...c, evidence: s.packet.evidence }, facts.sourcePersonId); if (reason) return dismiss(s, c, reason, now);
    const p = proceeding(s);
    // Only separately sourced, current conduct with explicit failed alternatives can justify detention.
    const risks = (facts.risks || []).filter(r => r.caseId === c.id && r.observerId && r.sourceId && r.at <= now && now - r.at <= 4 * 3600 && ["witnessThreat", "violentEscape"].includes(r.kind) && r.reason && r.alternativesReason);
    const detained = risks.length > 0;
    const kind = detained ? "continuedDetention" : s.submission === "securedBail" && facts.balance >= 50 ? "securedBail" : s.submission === "strictConditions" || s.policy.releaseRule === "securityFirst" ? "conditional" : "recognizance";
    const reasons = detained ? risks.map(r => `${r.reason} Less restrictive alternatives: ${r.alternativesReason} [${r.sourceId}]`) : ["No evidenced current threat or deliberate evasion establishes a need for detention. The allegation and the old sentence alone do not establish danger.", kind === "securedBail" ? "Voluntarily offered refundable security: 50 credits, with another review if unpaid." : "No cash security is required; inability to pay does not itself justify detention."];
    p.firstAppearance.status = "completed"; p.firstAppearance.completedAt = now; p.firstAppearance.decision = kind; p.firstAppearance.reasons = reasons;
    if (c.custodyOrder) Object.assign(c.custodyOrder, { reviewedAt: now, reviewedById: facts.judge.id, status: detained || kind === "securedBail" ? "active" : "releaseOrdered", reviewAt: detained || kind === "securedBail" ? now + 4 * 3600 : null, reasons: clone(reasons) });
    p.release.kind = kind; p.release.orderedAt = now; p.release.bailAmount = kind === "securedBail" ? 50 : 0;
    p.release.escrowStatus = kind === "securedBail" ? "due" : "none"; p.release.status = detained ? "none" : kind === "securedBail" ? "awaitingBail" : "released";
    p.release.conditions = detained ? [] : [{ id: `${c.id}:attendance`, kind: "appearAsOrdered", label: "Attend a separately served local trial only after a feasible route and transport have been established.", status: "active", imposedAt: now }, ...(kind === "conditional" ? [{ id: `${c.id}:checkIn`, kind: "checkpointOnly", label: "Use the permitted checkpoint and supervised court corridor; no general city admission.", status: "active", imposedAt: now }] : [])];
    p.status = detained ? "detained" : kind === "securedBail" ? "bailPending" : "released";
    s.reviews.push({ at: now, judgeId: facts.judge.id, prosecutorId: facts.prosecutor.id, kind, reasons, riskSources: clone(risks) });
    s.phase = detained ? "detained" : kind === "securedBail" ? "bailPending" : "releaseOrdered"; s.nextAt = null; s.reviewAt = detained || kind === "securedBail" ? now + 4 * 3600 : null; s.reviewDue = false;
    p.timeline.nextHearingAt = s.reviewAt;
    s.handoff = { ...Pretrial.trialHandoff(p), cityId: c.cityId, caseId: c.id, at: now, status: "awaitingSeparateLocalTrial", trialAt: null, statement: s.statement,
      evidencePacket: clone(s.packet), custodyDecision: clone(s.reviews.at(-1)), attendance: "No trial date served. Verify notice, access permission and actual transport before any future attendance finding." };
    p.trial.handoff = clone(s.handoff); c.status = "awaitingLocalTrial"; c.reason = reasons.join(" "); s.delay = ""; return true;
  }
  function bail(s, balance, now) {
    const p = proceeding(s); if (s.phase !== "bailPending" || balance < p.release.bailAmount) return 0;
    const amount = p.release.bailAmount, result = Pretrial.payBail(s.legal, p.id, now); s.legal = result.state;
    if (!result.changed) return 0;
    s.phase = "releaseOrdered"; s.reviewAt = null; proceeding(s).timeline.nextHearingAt = null; return amount;
  }
  function released(s, now, transport) {
    if (!["dismissed", "releaseOrdered"].includes(s.phase)) return false;
    const result = Pretrial.markReleased(s.legal, proceeding(s).id, transport, now); s.legal = result.state;
    proceeding(s).release.releasedAt = now;
    if (s.phase !== "dismissed") s.phase = "handedOff";
    if (s.handoff) { s.handoff.physicalRelease = clone(transport); s.handoff.custodyStatus = "released"; proceeding(s).trial.handoff = clone(s.handoff); }
    return result.changed;
  }
  function tick(s, now) {
    if (!["detained", "bailPending", "screening", "disclosurePending", "preparing"].includes(s.phase) || s.reviewDue || s.reviewAt == null || now < s.reviewAt) return false;
    if (["detained", "bailPending"].includes(s.phase)) { s.phase = "reviewReady"; proceeding(s).firstAppearance.status = "ready"; }
    s.delay = "Custody review is due. No missed appearance, forfeiture or new offense is inferred from delay or unavailable transport.";
    s.reviewDue = true; return true;
  }
  function refund(s) { const amount = s.refundDue; s.refundDue = 0; return amount; }
  return { able, closed, open, proceeding, supportReason, screen, disclose, counsel, payCounsel, conference, requirement, request, begin, decide, bail, released, dismiss, tick, refund };
});
