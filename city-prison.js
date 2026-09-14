(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCityPrison = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const able = a => a?.status === 'alive' && a.health >= 50;
  const copy = a => JSON.parse(JSON.stringify(a));
  function custody(p) { return Boolean(p?.collectedAt != null && !p.completedAt && !p.releasedAt && p.phase !== 'deceased'); }
  function stage(p, phase, now, duration = 0) { p.phase = phase; p.lastAt = now; p.nextAt = now + duration; p.delay = ''; p.history.push({ at: now, phase }); }
  function authorize(s, c, r, f, now, execution) {
    if (s.phase !== 'readyForPhysicalTransfer' || s.prison || now >= s.plan.expiresAt || !f.channel || !able(f.judge) || f.judge.id !== c.trial.judgment.judgeId || f.judge.institutionId !== f.judiciaryId || execution.legalReason(s, c, f) || execution.resourceReason(s, r, s.plan) || s.review.key !== execution.reviewKey(c, f)) return false;
    s.custodyAuthority = { id: `${s.plan.id}:commitment`, cityId: s.cityId, personId: s.personId, sentenceId: s.sentenceId, facilityId: r.facility.id, judgeId: f.judge.id, issuedAt: now, status: 'issued', scope: 'Consensual collection and finite local prison custody; not an automatic arrest warrant', suppressorAuthorized: true };
    return true;
  }
  function collect(s, c, r, f, now, execution) {
    const a = s.custodyAuthority;
    if (!a || a.status !== 'issued' || a.personId !== s.personId || a.sentenceId !== s.sentenceId || a.cityId !== s.cityId || a.facilityId !== r.facility.id || s.phase !== 'readyForPhysicalTransfer' || !f.atCheckpoint || !f.channel || now >= s.plan.expiresAt || execution.legalReason(s, c, f) || execution.resourceReason(s, r, s.plan) || s.review.key !== execution.reviewKey(c, f)) return false;
    a.status = 'served'; a.servedAt = now; s.phase = 'physicalCustody'; s.nextAt = null;
    s.plan.status = 'inUse'; s.plan.executionStartedAt = now;
    const p = s.prison = { id: `${s.plan.id}:prison`, cityId: s.cityId, institutionId: r.institutionId, facilityId: r.facility.id, bedId: s.plan.bedId, vehicleId: r.vehicle.id, crewIds: r.crew.map(a => a.id), phase: 'processing', collectedAt: now, admittedAt: null, releasedAt: null, completedAt: null, lastAt: now, nextAt: now + 120, termEndsAt: now + s.ledger.remainingSeconds, transportCreditSeconds: 0, history: [], propertyIds: [], suppressorId: null, suppressionActive: false, assignment: 'infrastructureSorting', priority: 'assignment', workSeconds: 0, medicalSeconds: 0, communications: [], repairKits: 1, repairAt: null, reviewAt: now + 14400, reviews: [], supplies: { meals: 1080, water: 1440 }, serviceSeconds: 0, delay: '' };
    p.history.push({ at: now, phase: 'processing', reason: 'The identified commitment was served and the scientist explicitly surrendered; actual detention credit begins.' });
    return true;
  }
  function travelReason(p, r) {
    return !r.route.open || r.route.condition < 50 ? 'The local road is blocked.' : r.vehicle.condition < 50 ? 'The actual van is disabled; its occupants remain at the saved road position.' : r.crew.some(a => !able(a)) ? 'The named driver or escort is unable to continue.' : r.vehicle.fuelKm <= 0 ? 'The van has exhausted its physical fuel.' : '';
  }
  function depart(p, s, r, now, returning = false) {
    if (travelReason(p, r)) return false;
    const returnDistance = p.admittedAt == null && p.releaseOriginPhase === 'travelling' ? p.distanceTravelledKm : r.route.distanceKm;
    p.distanceTravelledKm = 0; p.tripDistanceKm = returning ? returnDistance : r.route.distanceKm; r.vehicle.occupants = ['scientist', ...p.crewIds];
    if (!returning) s.plan.departureAt = now;
    stage(p, returning ? 'returning' : 'travelling', now, 1); return true;
  }
  function admit(p, s, c, r, now) {
    const bed = r.facility.beds.find(b => b.id === p.bedId);
    if (p.phase !== 'intake' || p.admittedAt != null || !bed || bed.occupiedBy || bed.reservedBy !== s.plan.id || r.facility.status !== 'open') return false;
    p.admittedAt = now; s.plan.admissionAt = now; p.transportCreditSeconds = Math.min(s.ledger.remainingSeconds, now - p.collectedAt);
    if (p.transferReview?.status === 'pending') p.transferReview.status = 'closedByPhysicalAdmission';
    s.ledger.transportCustodyCreditSeconds = p.transportCreditSeconds; s.ledger.creditAppliedAt = now; s.ledger.admissionRequired = false;
    s.ledger.remainingSeconds = Math.max(0, s.ledger.termSeconds - s.ledger.recognizedCustodyCreditSeconds - p.transportCreditSeconds);
    bed.occupiedBy = 'scientist'; bed.occupiedStayId = p.id; bed.reservedBy = null; r.vehicle.occupants = []; r.vehicle.locationId = r.facility.id; r.crew.forEach(a => a.locationId = r.facility.id);
    c.trial.sentence.executionStartedAt = now; c.trial.sentence.status = 'active'; stage(p, 'imprisoned', now, 60); return true;
  }
  function finishTerm(p, s, c, now) {
    if (p.releasedAt != null) return false;
    p.releaseOriginPhase = p.phase; p.releasedAt = Math.min(now, p.termEndsAt); p.suppressionActive = false; s.custodyAuthority.status = 'expired';
    s.ledger.remainingSeconds = 0; s.ledger.creditAppliedAt ??= p.releasedAt;
    if (p.admittedAt == null) { p.transportCreditSeconds = Math.min(s.ledger.termSeconds - s.ledger.recognizedCustodyCreditSeconds, p.releasedAt - p.collectedAt); s.ledger.transportCustodyCreditSeconds = p.transportCreditSeconds; }
    c.trial.sentence.status = 'completed'; c.trial.phase = 'completed'; stage(p, 'releaseDue', now, 1); return true;
  }
  function requestReview(p, s, c, r, now) {
    if (p.admittedAt != null || p.releasedAt != null || p.transferReview || !['loading', 'travelling', 'intake'].includes(p.phase)) return false;
    const bed = r.facility.beds.find(b => b.id === p.bedId), reason = travelReason(p, r) || (r.facility.status !== 'open' || !bed || bed.occupiedBy || bed.reservedBy !== s.plan.id ? 'The promised prison admission is unavailable.' : '');
    if (!reason) return false;
    p.transferReview = { requestedAt: now, reason, progress: 0, lastAt: now, status: 'pending' }; return true;
  }
  function tick(p, s, c, r, now, f = null) {
    const elapsed = Math.max(0, now - p.lastAt); p.lastAt = now;
    if (p.phase === 'deceased' || p.completedAt != null) return false;
    if (p.admittedAt != null) { p.serviceSeconds = Math.max(0, Math.min(now, p.termEndsAt) - p.admittedAt); s.ledger.prisonServedSeconds = p.serviceSeconds; s.ledger.remainingSeconds = Math.max(0, p.termEndsAt - now); }
    if (p.releasedAt == null && now >= p.termEndsAt) return finishTerm(p, s, c, now);
    const review = p.transferReview;
    if (review?.status === 'pending') {
      const dt = Math.max(0, now - review.lastAt); review.lastAt = now;
      const available = f?.channel && able(f.judge) && f.judge.id === s.custodyAuthority.judgeId && f.judge.institutionId === f.judiciaryId && f.cityId === p.cityId;
      if (!available) review.paused = true;
      else if (review.paused) review.paused = false;
      else review.progress += dt;
      if (review.progress >= 900) {
        review.status = 'decided'; review.decidedAt = now; review.judgeId = f.judge.id; review.result = 'interimReleaseAndReturn';
        p.interimRelease = true; p.releaseOriginPhase = p.phase; p.releasedAt = now; p.suppressionActive = false; p.transportCreditSeconds = now - p.collectedAt;
        c.trial.sentence.custodyCreditSeconds += p.transportCreditSeconds;
        s.ledger.recognizedCustodyCreditSeconds = c.trial.sentence.custodyCreditSeconds; s.ledger.remainingSeconds = Math.max(0, s.ledger.termSeconds - s.ledger.recognizedCustodyCreditSeconds); s.ledger.transportCustodyCreditSeconds = p.transportCreditSeconds;
        s.custodyAuthority.status = 'withdrawn'; stage(p, 'releaseDue', now, 1); return true;
      }
    }
    let repairedNow = false;
    if (p.repairAt != null) {
      if (!able(r.crew[0])) p.repairAt += elapsed;
      else if (now >= p.repairAt) { r.vehicle.condition = Math.max(70, r.vehicle.condition); p.repairAt = null; repairedNow = true; p.history.push({ at: now, phase: 'roadRepairCompleted' }); }
    }
    if (now >= p.reviewAt && p.releasedAt == null && p.phase !== 'imprisoned') { p.reviews.push({ at: now, reason: p.delay || 'Actual collection detention remains under finite commitment; no temporary-jail conversion is authorized.' }); p.reviewAt = now + 14400; }
    if (['travelling', 'returning'].includes(p.phase)) {
      const reason = travelReason(p, r); p.delay = reason; p.nextAt = now + 60;
      if (reason || repairedNow) return false;
      const distance = Math.min(p.tripDistanceKm - p.distanceTravelledKm, elapsed * 24 / 3600, r.vehicle.fuelKm);
      p.distanceTravelledKm += distance; r.vehicle.fuelKm -= distance; r.vehicle.reservedFuelKm = Math.max(0, r.vehicle.reservedFuelKm - distance);
      r.vehicle.locationId = `route:${r.route.id}:${p.phase}:${p.distanceTravelledKm.toFixed(3)}`;
      if (p.distanceTravelledKm >= p.tripDistanceKm) { stage(p, p.phase === 'returning' ? 'checkpointArrival' : 'intake', now, 120); return true; }
    }
    return false;
  }
  function repair(p, r, now) {
    if (!['travelling', 'returning', 'releaseDue'].includes(p.phase) || r.vehicle.condition >= 50 || !able(r.crew[0]) || !p.repairKits || p.repairAt != null) return false;
    p.repairKits--; p.repairAt = now + 900; return true;
  }
  function complete(p, s, r, now) {
    if (p.phase !== 'checkpointArrival' || p.releasedAt == null || p.completedAt != null) return false;
    const bed = r.facility.beds.find(b => b.id === p.bedId); if (bed?.occupiedBy === 'scientist' && bed.occupiedStayId === p.id) { bed.occupiedBy = null; bed.occupiedStayId = null; }
    if (bed?.reservedBy === s.plan.id) bed.reservedBy = null;
    if (r.vehicle.reservedBy === s.plan.id) { r.vehicle.reservedBy = null; r.vehicle.reservedFuelKm = 0; r.vehicle.occupants = []; r.vehicle.locationId = r.route.originId; }
    r.crew.forEach(a => { if (a.reservedBy === s.plan.id) { a.reservedBy = null; a.locationId = r.route.originId; } });
    s.plan.status = p.interimRelease ? 'returnedAfterReview' : 'completed'; s.plan.completedAt = now; s.plans.push(copy(s.plan)); p.completedAt = now; stage(p, 'discharged', now); p.nextAt = null;
    if (p.interimRelease) { s.phase = 'postponed'; s.reviewAt = now + 14400; s.reviewDue = false; s.nextAt = s.reviewAt; s.interim = 'releasedPendingLocalExecutionReview'; s.delay = 'Local judicial review ended the failed transfer. Actual detention was credited once; the unserved sentence remains outstanding.'; }
    else s.phase = 'completed';
    return true;
  }
  return { custody, stage, authorize, collect, depart, admit, finishTerm, tick, requestReview, repair, complete, travelReason };
});
