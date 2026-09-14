(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixCitySentenceExecution = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const MONTH = 30 * 86400, REVIEW_SECONDS = 900;
  const clone = value => JSON.parse(JSON.stringify(value));
  const able = actor => actor?.id && actor.status === "alive" && actor.health >= 50;
  function eligible(c) { return c?.status === "resolved" && c.trial?.judgment?.verdict === "guilty" && c.trial.sentence?.status === "awaitingTransferProceeding" && ["finitePrison", "judicialReferral"].includes(c.trial.sentence.kind); }
  function open(c, now) {
    if (!eligible(c) || c.execution) return null;
    return c.execution = { id: `${c.id}:execution`, cityId: c.cityId, personId: c.personId, sentenceId: c.trial.sentence.id, phase: "unreviewed", nextAt: null, reviewAt: null, review: null,
      progress: 0, lastAt: now, delay: "", ledger: null, plan: null, plans: [], nextPlan: 1, notice: null, notices: [], interim: "releasedPendingLocalExecutionReview", custodyAuthority: null, history: [] };
  }
  function reviewKey(c, f) { return JSON.stringify({ sentence: c.trial?.sentence, judgment: c.trial?.judgment, cityId: f.cityId, personId: f.personId, identityVerified: f.identityVerified, sourcePersonId: f.sourcePersonId, localCustodySeconds: f.localCustodySeconds, correctionsId: f.correctionsId, judiciaryId: f.judiciaryId }); }
  function legalReason(s, c, f) {
    const sentence = c.trial?.sentence, judgment = c.trial?.judgment, rule = c.trial?.packet?.evidence?.localLaw?.rule, range = rule?.sentencing?.finitePrisonRangeMonths;
    if (c.cityId !== s.cityId || f.cityId !== s.cityId || sentence?.cityId !== s.cityId || judgment?.cityId !== s.cityId || judgment?.caseId !== c.id || c.personId !== s.personId || f.personId !== s.personId || !f.identityVerified || f.sourcePersonId !== s.personId) return "Identity, source attribution or receiving-city jurisdiction needs judicial correction before execution.";
    if (!f.correctionsId || f.correctionsId === f.jailId || !f.judiciaryId || judgment?.judgeId !== sentence?.issuedById || judgment?.verdict !== "guilty" || c.judgment?.id !== judgment.id || sentence?.judgmentId !== judgment.id || sentence?.id !== s.sentenceId || c.status !== "resolved") return "A matching final local judgment, sentence and distinct prison authority are required.";
    if (sentence.kind !== "finitePrison") return "This is a judicial referral, not an executable prison term. Return it for local sentence review without inventing punishment.";
    if (sentence.status !== "awaitingTransferProceeding" || sentence.executionStartedAt != null) return "The saved sentence is no longer an unexecuted local handoff.";
    if (rule?.offenseId !== "warrantObstruction" || !rule?.sentencing?.ordinarySanctions?.includes("finitePrison") || !Number.isInteger(sentence.months) || sentence.months <= 0 || sentence.months > 120 || !range || sentence.months < range.minimum || sentence.months > range.maximum) return "The recorded finite term is not supported by the published local sentencing range.";
    if (!Number.isFinite(sentence.custodyCreditSeconds) || sentence.custodyCreditSeconds < 0 || !Number.isFinite(f.localCustodySeconds) || sentence.custodyCreditSeconds > f.localCustodySeconds) return "The ordered custody credit needs its supporting local custody record; free waiting time is not prison service.";
    return "";
  }
  function reviewAvailable(s, c, f) { return f.channel && able(f.judge) && f.judge.id === c.trial?.judgment?.judgeId && f.judge.institutionId === f.judiciaryId; }
  function requestReview(s, c, f, now) {
    if (!["unreviewed", "postponed", "reviewRequired"].includes(s.phase)) return false;
    if (s.review && s.review.key === reviewKey(c, f) && now < (s.reviewAt ?? Infinity)) return false;
    s.phase = "reviewing"; s.progress = 0; s.lastAt = now; s.nextAt = now + REVIEW_SECONDS; s.delay = ""; s.reviewDue = false; return true;
  }
  function advanceReview(s, c, f, now) {
    if (s.phase !== "reviewing") return false;
    const elapsed = Math.max(0, now - s.lastAt); s.lastAt = now;
    if (!reviewAvailable(s, c, f)) { s.delay = "The named local judge or powered records channel is unavailable; review work is paused."; s.nextAt = now + 60; return false; }
    if (s.delay) { s.delay = ""; s.nextAt = now + REVIEW_SECONDS - s.progress; return false; }
    s.progress += elapsed;
    if (s.progress < REVIEW_SECONDS) { s.nextAt = now + REVIEW_SECONDS - s.progress; return false; }
    const reason = legalReason(s, c, f);
    s.review = { id: `${s.id}:review-${s.history.length + 1}`, at: now, judgeId: f.judge.id, judiciaryId: f.judiciaryId, correctionsId: f.correctionsId, key: reviewKey(c, f), result: reason ? "referred" : "verified", reason: reason || "The final local finite sentence and documented custody credit are verified. This review grants no new custody authority." };
    s.history.push(clone(s.review)); s.nextAt = null; s.delay = reason;
    if (reason) { s.phase = "reviewRequired"; s.reviewAt = now + 14400; s.nextAt = s.reviewAt; return true; }
    const sentence = c.trial.sentence, total = sentence.months * MONTH, credit = Math.min(total, sentence.custodyCreditSeconds);
    s.ledger = { termSeconds: total, recognizedCustodyCreditSeconds: credit, custodySourceIds: clone(f.custodySourceIds || []), creditAppliedAt: null, prisonServedSeconds: 0, remainingSeconds: total - credit, admissionRequired: true };
    s.phase = "readyToPlan"; s.reviewAt = null;
    if (!s.ledger.remainingSeconds) { s.phase = "satisfiedByCredit"; s.ledger.creditAppliedAt = now; s.ledger.admissionRequired = false; sentence.status = "completed"; c.trial.phase = "completed"; s.history.push({ at: now, action: "creditSatisfiedSentence", reason: "The documented local custody credit satisfies the finite term once; no pointless transfer or additional detention is authorized." }); }
    return true;
  }
  function resourceReason(s, resources, ownPlan = null) {
    if (!resources || resources.cityId !== s.cityId || resources.institutionId !== s.review?.correctionsId) return "The receiving city's identified corrections authority has no registered transfer resources.";
    const { facility, vehicle, crew, route, dispatcher } = resources;
    if (!able(dispatcher) || dispatcher.institutionId !== resources.institutionId) return "The named corrections dispatcher is unavailable.";
    if (!facility || facility.cityId !== s.cityId || facility.institutionId !== resources.institutionId || facility.status !== "open") return "The named local prison is unavailable; no foreign or original-city fallback is authorized.";
    const bed = ownPlan ? facility.beds.find(b => b.id === ownPlan.bedId && b.reservedBy === ownPlan.id && !b.occupiedBy) : facility.beds.find(b => !b.occupiedBy && !b.reservedBy);
    if (!bed) return "No actual unoccupied, unreserved prison bed is available.";
    if (!route?.id || route.cityId !== s.cityId || route.destinationId !== facility.id || !route.open || route.condition < 50 || !(route.distanceKm > 0)) return "The registered local correctional route is unavailable.";
    if (!vehicle || vehicle.cityId !== s.cityId || vehicle.institutionId !== resources.institutionId || vehicle.condition < 50 || vehicle.seats < 3 || vehicle.locationId !== route.originId || vehicle.fuelKm < route.distanceKm * 2 || vehicle.reservedBy && vehicle.reservedBy !== ownPlan?.id) return "The named transfer vehicle lacks readiness, location, seats, fuel or an exclusive reservation.";
    if (!Array.isArray(crew) || crew.length !== 2 || new Set(crew.map(a => a.id)).size !== 2 || !crew.some(a => a.role === "driver") || !crew.some(a => a.role === "escort") || crew.some(a => !able(a) || a.institutionId !== resources.institutionId || a.locationId !== route.originId || a.reservedBy && a.reservedBy !== ownPlan?.id)) return "The named driver and escort must both be alive, able, locally available and unreserved.";
    if (ownPlan && (vehicle.id !== ownPlan.vehicleId || vehicle.reservedBy !== ownPlan.id || vehicle.reservedFuelKm !== ownPlan.fuelKm || ownPlan.routeId !== route.id || ownPlan.fuelKm !== route.distanceKm * 2 || ownPlan.facilityId !== facility.id || crew.some(a => a.reservedBy !== ownPlan.id || !ownPlan.crewIds.includes(a.id)))) return "The saved transfer reservation no longer matches its exact assets.";
    return "";
  }
  function reserve(s, c, resources, f, now) {
    if (s.phase !== "readyToPlan" || !f.channel || legalReason(s, c, f) || s.review.key !== reviewKey(c, f) || resourceReason(s, resources)) return false;
    const bed = resources.facility.beds.find(b => !b.occupiedBy && !b.reservedBy), id = `${s.id}:plan-${s.nextPlan++}`;
    s.plan = { id, cityId: s.cityId, sentenceId: s.sentenceId, reviewId: s.review.id, reservedAt: now, expiresAt: now + 3600, status: "reserved", facilityId: resources.facility.id, institutionId: resources.institutionId,
      bedId: bed.id, vehicleId: resources.vehicle.id, crewIds: resources.crew.map(a => a.id), routeId: resources.route.id, route: clone(resources.route), fuelKm: resources.route.distanceKm * 2, executionStartedAt: null, departureAt: null, admissionAt: null };
    bed.reservedBy = id; resources.vehicle.reservedBy = id; resources.vehicle.reservedFuelKm = s.plan.fuelKm; resources.crew.forEach(a => { a.reservedBy = id; });
    s.phase = "reserved"; s.nextAt = s.plan.expiresAt; s.delay = ""; s.history.push({ at: now, action: "resourcesReserved", reason: "One exact bed, vehicle, driver, escort and round-trip fuel allocation are exclusively held. No fuel is consumed and no prisoner is admitted by reserving." }); return true;
  }
  function releaseResources(s, resources, reason, now) {
    const p = s.plan; if (!p || p.status !== "reserved") return false;
    if (resources) {
      for (const bed of resources.facility?.beds || []) if (bed.reservedBy === p.id) bed.reservedBy = null;
      if (resources.vehicle?.reservedBy === p.id) { resources.vehicle.reservedBy = null; resources.vehicle.reservedFuelKm = 0; }
      for (const actor of resources.crew || []) if (actor.reservedBy === p.id) actor.reservedBy = null;
    }
    p.status = "released"; p.releasedAt = now; p.releaseReason = reason; s.plans.push(clone(p)); return true;
  }
  function postpone(s, resources, reason, now) {
    releaseResources(s, resources, reason, now);
    if (s.custodyAuthority?.status === 'issued') s.custodyAuthority.status = 'withdrawn';
    if (s.notice) { s.notice.status = "postponed"; const i = s.notices.findIndex(n => n.id === s.notice.id); if (i >= 0) s.notices[i] = clone(s.notice); }
    s.interim = "releasedPendingLocalExecutionReview";
    s.phase = "postponed"; s.reviewAt = now + 14400; s.reviewDue = false; s.nextAt = s.reviewAt; s.delay = `${reason} Interim release continues; no arrest, evasion finding, new charge or sentence service is inferred.`;
    s.history.push({ at: now, action: "postponed", reason: s.delay }); return true;
  }
  function serve(s, c, resources, f, now) {
    if (s.phase !== "reserved" || !f.channel || !f.atCheckpoint || !able(f.clerk) || now >= s.plan.expiresAt || resourceReason(s, resources, s.plan) || legalReason(s, c, f) || s.review.key !== reviewKey(c, f)) return false;
    s.notice = { id: `${s.id}:notice-${s.notices.length + 1}`, servedAt: now, servedById: f.clerk.id, reviewId: s.review.id, sentenceId: s.sentenceId, planId: s.plan.id, cityId: s.cityId, personId: s.personId,
      reportingRoomId: f.checkpointRoomId, reportAt: now + 7200, reportBy: now + 10800, status: "served", scope: "checkpointReportingAndEgressOnly", custodyAuthorized: false, physicalTransferImplemented: true };
    s.notices.push(clone(s.notice)); s.plan.expiresAt = s.notice.reportBy; s.phase = "noticeServed"; s.nextAt = s.notice.reportAt; s.interim = "releasedPendingNotifiedCollection";
    s.history.push({ at: now, action: "noticeServed", reason: "Report to the named checkpoint after two hours, within a one-hour window. Reporting alone grants no custody; a separate judicial commitment and explicit collection are required." }); return true;
  }
  function report(s, c, resources, f, now) {
    if (s.phase !== "noticeServed" || !f.channel || !f.atCheckpoint || !able(f.clerk) || now < s.notice.reportAt || now >= s.notice.reportBy || resourceReason(s, resources, s.plan) || legalReason(s, c, f) || s.review.key !== reviewKey(c, f)) return false;
    s.notice.status = "reported"; s.notice.reportedAt = now; s.notice.witnessId = f.clerk.id; s.notices[s.notices.findIndex(n => n.id === s.notice.id)] = clone(s.notice); s.phase = "readyForPhysicalTransfer"; s.nextAt = s.plan.expiresAt;
    s.history.push({ at: now, action: "readinessReported", reason: "Physical reporting at the checkpoint was witnessed. The reservation is ready for separately authorized physical collection; no restraint, boarding, prison admission or sentence start has occurred." }); return true;
  }
  function tick(s, c, resources, f, now) {
    if (s.phase === "reviewing") {
      const changed = advanceReview(s, c, f, now);
      if (s.phase === "readyToPlan" && resourceReason(s, resources)) return postpone(s, resources, resourceReason(s, resources), now);
      return changed;
    }
    if (s.phase === "readyToPlan") {
      const reason = legalReason(s, c, f) || (s.review.key !== reviewKey(c, f) ? "Material sentence records changed after review." : "") || resourceReason(s, resources);
      if (reason) return postpone(s, resources, reason, now);
    }
    if (["reserved", "noticeServed", "readyForPhysicalTransfer"].includes(s.phase)) {
      const reason = legalReason(s, c, f) || (s.review.key !== reviewKey(c, f) ? "The material sentence or custody-credit record changed and needs new judicial review." : "") || resourceReason(s, resources, s.plan);
      if (reason) return postpone(s, resources, reason, now);
      if (now >= s.plan.expiresAt) return postpone(s, resources, s.phase === "reserved" ? "The unused reservation expired before notice service." : s.phase === "readyForPhysicalTransfer" ? "No physical dispatch occurred before the reservation expired; timely reporting is preserved." : "Reporting was not completed within the notice window; its cause needs review, not an automatic evasion finding.", now);
      if (s.phase === "noticeServed" && now >= s.notice.reportAt) s.nextAt = s.notice.reportBy;
    }
    if (["postponed", "reviewRequired"].includes(s.phase) && s.reviewAt != null && now >= s.reviewAt && !s.reviewDue) { s.reviewDue = true; s.nextAt = null; s.history.push({ at: now, action: "reviewDue", reason: "Local execution review is due; no indefinite custody or automatic escalation follows the delay." }); return true; }
    return false;
  }
  return { MONTH, REVIEW_SECONDS, eligible, open, reviewKey, legalReason, requestReview, advanceReview, resourceReason, reserve, releaseResources, postpone, serve, report, tick };
});
