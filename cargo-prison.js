(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./cargo-commitment') : root.HelixCargoCommitment,
    typeof module === 'object' && module.exports ? require('./cargo-trial') : root.HelixCargoTrial);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixCargoPrison = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Commitment, Trial) {
  'use strict';
  const TRANSFER_LIMIT = 21600, DAY = 86400;
  const copy = x => JSON.parse(JSON.stringify(x)), same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = p => p?.status === 'alive' && p.health >= 50 && (p.fatigue || 0) < 80;
  function tell(b, p, s, e, at, text) {
    if (e.events.at(-1)?.text === text) return;
    e.events.push({ at, text });
    if (p?.courtPreferences?.shareNotices && b?.buyerService.channelPowered && b.buyerService.credentialActive)
      (b.buyerService.prisonNotices ||= []).push({ at, commitmentId: s.id, text,
        scope: 'Dated receiver-consented custody notice; no live tracking or control of another person.' });
  }
  function authority(g, d, s) {
    const a = g.correctionsAuthority, r = g.cargoCorrections;
    return same(Commitment.basis(g, d), s.basis) && a?.active && a.role === 'longTermCorrectionsAuthority'
      && a.cityId === s.basis.cityId && a.institutionId === r?.institutionId && a.jailInstitutionId
      && a.jailInstitutionId !== a.institutionId && r.active && r.cityId === g.cityId;
  }
  function careReady(r) {
    return r.facility?.kind === 'prison' && r.facility.status === 'open' && r.facility.cityId === r.cityId
      && r.facility.institutionId === r.institutionId && able(r.care) && r.care.role === 'care'
      && r.care.institutionId === r.institutionId && r.care.locationId === r.facility.id && !r.care.assignment
      && r.care.workSeconds > 0 && r.care.rationSeconds > 0;
  }
  function careCapacity(g) {
    // Existing residents own their remaining care allocation. A second intake
    // cannot promise those same supplies or finite staff-hours again.
    const reserved = g.cargoCourt.dockets.reduce((total, d) => {
      const e = d.commitment?.execution;
      return total + (e?.admittedAt != null && !e.release ? Math.max(0, e.careBudgetSeconds - e.prisonSeconds) : 0);
    }, 0);
    return Math.max(0, Math.min(g.cargoCorrections.care.rationSeconds, g.cargoCorrections.care.workSeconds * DAY / 600) - reserved);
  }
  function ledgerSupported(s, at) {
    const l = s.ledger, prior = s.reviews.at(-1)?.custody;
    if (!l || l.termSeconds !== s.basis.months * 30 * DAY || l.recognizedCustodySeconds !== Math.min(l.termSeconds, prior?.seconds)
      || !same(l.sourceIds, prior.receipts.map(x => x.id))) return false;
    let transport = 0, prison = 0, endedAt = Math.max(0, ...prior.receipts.map(x => x.endedAt));
    const ids = new Set();
    for (const execution of s.executions || []) {
      if (execution.id === s.execution?.id || execution.surrenderedAt == null) continue;
      const receipt = execution.receipt;
      if (!receipt || ids.has(receipt.id) || receipt.id !== `${execution.id}:service` || receipt.commitmentId !== s.id
        || receipt.personId !== s.basis.personId || receipt.cityId !== s.basis.cityId || receipt.orderId !== execution.order?.id
        || receipt.startedAt !== execution.surrenderedAt || receipt.endedAt !== execution.release?.at || receipt.startedAt < endedAt
        || receipt.endedAt > at || receipt.transportSeconds !== execution.transportSeconds || receipt.prisonSeconds !== execution.prisonSeconds
        || !Number.isFinite(receipt.transportSeconds) || receipt.transportSeconds < 0 || !Number.isFinite(receipt.prisonSeconds) || receipt.prisonSeconds < 0
        || Math.abs(receipt.endedAt - receipt.startedAt - receipt.transportSeconds - receipt.prisonSeconds) > 1e-6) return false;
      ids.add(receipt.id); endedAt = receipt.endedAt; transport += receipt.transportSeconds; prison += receipt.prisonSeconds;
    }
    return Math.abs(l.transportServedSeconds - transport) < 1e-6 && Math.abs(l.prisonServedSeconds - prison) < 1e-6
      && Math.abs(l.remainingSeconds - Math.max(0, l.termSeconds - l.recognizedCustodySeconds - transport - prison)) < 1e-6;
  }
  function freeJudge(g, e, at) {
    if (g.cargoCourt.trialJob === e.id) { g.cargoCourt.trialJob = null; g.cargoCourt.lastAt = at; g.cargoCourt.wasReady = false; }
  }
  function unlockAssets(r, plan, e, transport = true) {
    if (r.intake.job === e.id) r.intake.job = null;
    for (const bed of r.facility.beds) {
      if (bed.reservedBy === plan.id) bed.reservedBy = null;
      if (bed.custodyId === e.id) { bed.occupiedBy = null; bed.custodyId = null; bed.locked = false; }
    }
    if (transport) for (const a of [r.vehicle, ...r.crew]) if (a.reservedBy === plan.id) {
      a.reservedBy = null; if (a === r.vehicle) a.reservedFuelKm = 0;
    }
  }
  function availableNotice(b, p, at, text) {
    if (p.courtPreferences?.shareAvailability && b.buyerService.channelPowered && b.buyerService.credentialActive)
      (b.buyerService.availabilityNotices ||= []).push({ at, text });
  }
  function close(g, s, e, plan, at) {
    unlockAssets(g.cargoCorrections, plan, e); freeJudge(g, e, at);
    e.phase = 'closed'; e.closedAt = at; plan.status = 'released'; plan.releasedAt = at;
    plan.releaseReason = e.release?.reason || e.abortReason;
    s.phase = s.ledger.remainingSeconds <= 0 ? 'complete' : 'postponed'; s.lastAt = at;
    s.custodyAuthorized = false; s.executionAuthorized = false;
  }
  function release(g, b, p, s, e, plan, at, reason) {
    if (e.release) return;
    const r = g.cargoCorrections, v = r.vehicle, bracelet = r.suppressors.find(x => x.id === e.suppressorId);
    const locationId = p.locationId === v.id ? v.locationId : p.locationId;
    e.release = { at, reason, locationId, remainingSeconds: s.ledger.remainingSeconds };
    e.receipt = { id: `${e.id}:service`, commitmentId: s.id, personId: p.id, cityId: g.cityId,
      orderId: e.order.id, startedAt: e.surrenderedAt, endedAt: at,
      transportSeconds: e.transportSeconds, prisonSeconds: e.prisonSeconds };
    if (p.custody?.caseId === e.id) { p.custody.active = false; p.custody.suppressionActive = false; p.custody.releasedAt = at; }
    if (p.assignment === e.id) p.assignment = null;
    p.locationId = locationId;
    if (bracelet?.reservedBy === plan.id) {
      bracelet.active = false; bracelet.wearerId = null; bracelet.reservedBy = null;
      bracelet.locationId = locationId === v.locationId && v.reservedBy === plan.id ? v.id : locationId;
    }
    if (v.occupants) v.occupants = v.occupants.filter(id => id !== p.id);
    unlockAssets(r, plan, e, false);
    e.phase = 'released'; e.wasReady = false; s.interim = 'freeAwaitingReturn';
    s.custodyAuthorized = false; s.executionAuthorized = false;
    tell(b, p, s, e, at, `Custody and magic suppression ended: ${reason} Physical return is separate; no detention while waiting for a ride.`);
    availableNotice(b, p, at, 'Representative released from custody; physical return to the receiving desk is not yet confirmed.');
  }
  // Road positions are distances from the prison along this local, saved route.
  // No actor moves unless seated in the actual reserved van with its actual crew.
  function boardCrew(r, plan) {
    r.vehicle.occupants = r.crew.map(p => p.id);
    for (const p of r.crew) p.locationId = r.vehicle.id;
    r.vehicle.road = { id: `${plan.id}:road`, kmFromPrison: 0, totalKm: plan.route.distanceKm + plan.pickupRoute.distanceKm };
  }
  function travel(r, b, p, e, plan, dt, destination, passenger) {
    const v = r.vehicle, road = v.road, distance = plan.route.distanceKm + plan.pickupRoute.distanceKm;
    const target = destination === 'prison' ? 0 : distance;
    const routeMatches = r.route.id === plan.route.id && r.route.cityId === plan.route.cityId
      && r.route.originId === plan.route.originId && r.route.destinationId === plan.route.destinationId
      && r.route.distanceKm === plan.route.distanceKm && r.route.speedKmPerHour === plan.route.speedKmPerHour
      && b.buyerService.premises.route.id === plan.pickupRoute.id && b.buyerService.premises.route.distanceKm === plan.pickupRoute.distanceKm;
    const ready = routeMatches && r.route.open && r.route.condition >= 50 && b.buyerService.premises.route.open
      && v.id === plan.vehicleId && v.reservedBy === plan.id && v.condition >= 50 && v.seats >= (passenger ? 3 : 2)
      && road?.id === `${plan.id}:road` && Number.isFinite(road.kmFromPrison) && (v.fuelKm > 0 || road.kmFromPrison === target)
      && r.crew.length === 2 && r.crew.every(a => plan.crewIds.includes(a.id) && able(a) && !a.assignment
        && a.institutionId === plan.institutionId && a.reservedBy === plan.id && a.locationId === v.id
        && v.occupants?.includes(a.id) && a.workSeconds > 0)
      && r.crew.some(a => a.role === 'driver') && r.crew.some(a => a.role === 'escort')
      && (!passenger || (v.occupants?.includes(p.id) && p.locationId === v.id));
    if (!ready) { e.wasReady = false; return false; }
    const seconds = e.wasReady ? Math.min(dt, ...r.crew.map(a => a.workSeconds)) : 0;
    e.wasReady = true;
    const km = Math.min(Math.abs(target - road.kmFromPrison), v.fuelKm, seconds * plan.route.speedKmPerHour / 3600);
    const work = km * 3600 / plan.route.speedKmPerHour;
    road.kmFromPrison += Math.sign(target - road.kmFromPrison) * km; v.fuelKm -= km;
    r.crew.forEach(a => { a.workSeconds -= work; });
    const arrived = Math.abs(road.kmFromPrison - target) < 1e-8;
    if (km > 0 || arrived) v.locationId = arrived ? (destination === 'prison' ? plan.facilityId : plan.reportingLocationId) : road.id;
    return arrived;
  }
  function park(r, plan) {
    for (const device of r.suppressors) if (!device.active && device.locationId === r.vehicle.id) device.locationId = r.vehicle.locationId;
    for (const a of r.crew) if (a.reservedBy === plan.id && a.locationId === r.vehicle.id) a.locationId = r.vehicle.locationId;
    r.vehicle.occupants = (r.vehicle.occupants || []).filter(id => !plan.crewIds.includes(id));
    for (const a of [r.vehicle, ...r.crew]) if (a.reservedBy === plan.id) { a.reservedBy = null; if (a === r.vehicle) a.reservedFuelKm = 0; }
  }
  function advance(state, g, at) {
    if (!g.cargoCorrections || !Number.isFinite(at)) return;
    const r = g.cargoCorrections, c = g.cargoCourt;
    for (const d of c.dockets) {
      const s = d.commitment;
      if (!s) continue;
      let e = s.execution;
      const plan = e && e.phase !== 'closed' ? s.plans.find(x => x.id === e.planId) : s.plans.at(-1);
      const b = state.buyers.find(x => x.cityId === g.cityId && x.buyerService?.premises?.id === s.basis.address.siteId);
      const p = b?.buyerService.representatives.find(x => x.id === s.basis.personId);
      if (!p || !plan) continue;
      if (!e || (e.phase === 'closed' && e.planId !== plan.id)) {
        if (s.phase !== 'reserved' || plan.status !== 'reserved' || at >= plan.expiresAt) continue;
        e = s.execution = { id: `${plan.id}:execution`, planId: plan.id, phase: 'authorization', lastAt: at,
          events: [], progress: 0, wasReady: false, transportSeconds: 0, prisonSeconds: 0 };
        (s.executions ||= []).push(e);
      }
      // JSON reload does not retain object aliases between execution and history.
      const sync = () => { s.executions[s.executions.findIndex(x => x.id === e.id)] = copy(e); };
      if (at < e.lastAt || e.phase === 'closed') continue;
      const previousAt = e.lastAt, dt = at - previousAt; e.lastAt = at;
      const bracelet = r.suppressors.find(x => x.id === e.suppressorId);
      const lawful = authority(g, d, s) && same(Commitment.credit(g, d, s.basis, at), s.reviews.at(-1).custody);
      const abort = reason => {
        e.abortReason = reason; e.phase = r.vehicle.reservedBy === plan.id && r.vehicle.road?.id === `${plan.id}:road` ? 'returnCrew' : 'closed'; e.wasReady = false;
        s.executionAuthorized = false;
        freeJudge(g, e, at); unlockAssets(r, plan, e, false);
        if (bracelet?.reservedBy === plan.id) { bracelet.reservedBy = null; bracelet.locationId = r.vehicle.id; }
        tell(b, p, s, e, at, `${reason} No surrender, custody credit or adverse finding. Crew must physically return.`);
        if (e.phase === 'closed') close(g, s, e, plan, at);
      };
      if (e.surrenderedAt != null && !e.release) {
        // Absolute release clocks run before all powered work. Closed intervals are
        // never replayed; free waiting and free return cannot advance this ledger.
        let end = Math.min(at, e.termEndsAt, e.admittedAt == null ? e.transferReleaseBy : Infinity);
        if (e.admittedAt != null) {
          end = Math.min(end, previousAt + Math.max(0, e.careBudgetSeconds - e.prisonSeconds),
            previousAt + Math.max(0, r.care.rationSeconds), previousAt + Math.max(0, r.care.workSeconds) * DAY / 600);
        }
        const elapsed = Math.max(0, end - previousAt);
        if (e.admittedAt == null) {
          e.transportSeconds += elapsed; s.ledger.transportServedSeconds += elapsed;
          if (e.phase === 'transfer' && travel(r, b, p, e, plan, elapsed, 'prison', true)) { e.phase = 'intake'; e.wasReady = false; }
        } else {
          e.prisonSeconds += elapsed; s.ledger.prisonServedSeconds += elapsed;
          r.care.rationSeconds = Math.max(0, r.care.rationSeconds - elapsed);
          r.care.workSeconds = Math.max(0, r.care.workSeconds - elapsed * 600 / DAY);
        }
        s.ledger.remainingSeconds = Math.max(0, s.ledger.termSeconds - s.ledger.recognizedCustodySeconds - s.ledger.transportServedSeconds - s.ledger.prisonServedSeconds);
        let reason = end >= e.termEndsAt ? 'Finite sentence completed.' : e.admittedAt == null && end >= e.transferReleaseBy ? 'Six-hour transfer safeguard expired before lawful admission.' : '';
        if (!lawful) reason ||= 'Current sentence or local custody authority unavailable; interim release pending fresh review.';
        if (!bracelet?.failOpen || !bracelet.active || bracelet.condition < 50 || bracelet.wearerId !== p.id
          || bracelet.locationId !== p.id || p.custody?.caseId !== e.id)
          reason ||= 'Custody equipment or exact person custody record unavailable; safety release.';
        if (e.admittedAt != null && (!careReady(r) || e.prisonSeconds >= e.careBudgetSeconds || p.locationId !== plan.facilityId
          || !r.facility.beds.some(x => x.id === plan.bedId && x.occupiedBy === p.id && x.custodyId === e.id && x.failOpen && x.condition >= 50)))
          reason ||= 'Prison care, staff or accommodation interrupted; interim release, not sentence forgiveness.';
        if (reason) { release(g, b, p, s, e, plan, end, reason); sync(); continue; }
      }
      if (['authorization', 'pickup', 'surrender'].includes(e.phase)
        && (!lawful || at >= plan.expiresAt || p.commitmentPreferences?.response !== 'cooperate' || p.prisonPreferences?.peacefulSurrender !== true)) {
        abort('Pickup authority, voluntary cooperation or appointment expired.'); sync(); continue;
      }
      if (e.phase === 'authorization') {
        const device = r.suppressors.find(x => x.failOpen && x.condition >= 50 && !x.active && !x.wearerId && !x.reservedBy && x.locationId === plan.facilityId);
        const ready = !Commitment.resourceReason(g, b, s, plan) && careReady(r) && careCapacity(g) > 0 && device && ledgerSupported(s, at)
          && r.facility.beds.some(x => x.id === plan.bedId && x.failOpen && x.condition >= 50)
          && c.channelPowered && c.power >= 1
          && able(c.judge) && c.judge.locationId === c.id && !c.job && !c.appearanceJob && !c.custodyJob
          && (!c.trialJob || c.trialJob === e.id) && c.workSeconds > 0
          && r.crew[1].workSeconds >= plan.fuelKm * 3600 / plan.route.speedKmPerHour + 60
          && !p.assignment && !p.custody?.active && p.locationId === g.cityId && Trial.identified(state, p, s.basis.document, at);
        if (!ready) { e.wasReady = false; freeJudge(g, e, at); sync(); continue; }
        const key = JSON.stringify({ judgeId: c.judge.id, plan, deviceId: device.id, ledger: s.ledger });
        if (e.authorizationKey !== key) { e.authorizationKey = key; e.progress = 0; e.wasReady = false; }
        c.trialJob = e.id;
        const work = e.wasReady ? Math.min(dt, 120 - e.progress, c.workSeconds) : 0;
        e.wasReady = true; e.progress += work; c.workSeconds -= work;
        if (e.progress >= 120) {
          e.order = { id: `${e.id}:order`, at, judgeId: c.judge.id, personId: p.id, institutionId: r.institutionId,
            reviewDecisionId: s.basis.reviewDecisionId, planId: plan.id, expiresAt: plan.expiresAt,
            remainingSeconds: s.ledger.remainingSeconds, ledger: copy(s.ledger),
            suppressionAuthorized: true, scope: 'Peaceful local surrender only; six-hour transfer limit; release at term or loss of authority.' };
          c.power--; r.power--; r.crew[1].workSeconds -= 60; freeJudge(g, e, at);
          e.suppressorId = device.id; device.reservedBy = plan.id; device.locationId = r.vehicle.id;
          e.inspection = { at, inspectorId: r.crew[1].id, suppressorId: device.id, failOpen: true };
          boardCrew(r, plan); e.phase = 'pickup'; e.wasReady = false; s.executionAuthorized = true;
          tell(b, p, s, e, at, 'Separate local order issued for peaceful surrender. Named crew dispatched; the defendant is still free.');
        }
      } else if (e.phase === 'pickup') {
        if (travel(r, b, p, e, plan, dt, 'desk', false)) { e.phase = 'surrender'; e.wasReady = false; }
      } else if (e.phase === 'surrender') {
        const bed = r.facility.beds.find(x => x.id === plan.bedId);
        const ready = p.locationId === g.cityId && !p.assignment && !p.custody?.active && (p.availableAt || 0) <= at
          && b.buyerService.locationId === g.cityId && b.buyerService.premises.publicAccess
          && Trial.identified(state, p, s.basis.document, at) && r.vehicle.locationId === plan.reportingLocationId
          && r.vehicle.reservedBy === plan.id && r.vehicle.condition >= 50 && r.vehicle.seats >= 3
          && r.crew.length === 2 && r.crew.every(a => plan.crewIds.includes(a.id) && able(a) && !a.assignment
            && a.institutionId === plan.institutionId && a.reservedBy === plan.id && a.locationId === r.vehicle.id && r.vehicle.occupants.includes(a.id))
          && bed?.reservedBy === plan.id && !bed.occupiedBy && bed.failOpen && bed.condition >= 50
          && bracelet?.reservedBy === plan.id && bracelet.failOpen && bracelet.condition >= 50
          && careReady(r) && careCapacity(g) > 0 && ledgerSupported(s, at) && same(s.ledger, e.order.ledger) && s.ledger.remainingSeconds > 0;
        if (!ready) { abort('Actual person, verified identity, public pickup or safe receiving capacity unavailable.'); sync(); continue; }
        e.surrenderedAt = at; e.termEndsAt = at + s.ledger.remainingSeconds; e.transferReleaseBy = at + TRANSFER_LIMIT;
        e.order.executedAt = at; s.ledger.creditAppliedAt ??= at;
        r.creditClaims.filter(x => x.commitmentId === s.id).forEach(x => { x.status = 'consumed'; x.appliedAt ??= at; });
        p.assignment = e.id; p.locationId = r.vehicle.id; r.vehicle.occupants.push(p.id);
        p.custody = { caseId: e.id, orderId: e.order.id, active: true, startedAt: at, releaseBy: Math.min(e.termEndsAt, e.transferReleaseBy),
          collarId: bracelet.id, suppressionActive: true };
        bracelet.active = true; bracelet.wearerId = p.id; bracelet.locationId = p.id; bracelet.releaseBy = p.custody.releaseBy;
        e.phase = 'transfer'; e.wasReady = false; s.interim = 'lawfulTransferCustody'; s.custodyAuthorized = true;
        tell(b, p, s, e, at, 'Actual peaceful surrender verified. Transfer custody and magic suppression begin now; transport delays count toward the finite sentence.');
        availableNotice(b, p, at, 'Representative reported unavailable after actual surrender to local corrections.');
      } else if (e.phase === 'intake') {
        const bed = r.facility.beds.find(x => x.id === plan.bedId);
        const ready = lawful && Trial.identified(state, p, s.basis.document, at) && p.locationId === r.vehicle.id
          && r.vehicle.locationId === plan.facilityId && r.vehicle.occupants.includes(p.id)
          && bed?.reservedBy === plan.id && !bed.occupiedBy && bed.failOpen && bed.condition >= 50 && r.facility.id === plan.facilityId
          && r.facility.institutionId === plan.institutionId && careReady(r) && careCapacity(g) > 0 && able(r.intake) && !r.intake.assignment
          && r.intake.id === plan.intakeId && r.intake.institutionId === plan.institutionId && r.intake.acceptsPlacements
          && r.intake.locationId === plan.facilityId && (r.intake.workSeconds > 0 || e.intakeProgress >= 60)
          && !r.job && (!r.intake.job || r.intake.job === e.id) && r.channelPowered && r.power >= 1;
        if (ready) r.intake.job = e.id;
        else if (r.intake.job === e.id) r.intake.job = null;
        const work = ready && e.wasReady ? Math.min(dt, 60 - (e.intakeProgress || 0), r.intake.workSeconds) : 0;
        e.wasReady = Boolean(ready); e.intakeProgress = (e.intakeProgress || 0) + work; r.intake.workSeconds -= work;
        if (ready && e.intakeProgress >= 60) {
          r.power--; r.intake.job = null; bed.occupiedBy = p.id; bed.custodyId = e.id; bed.reservedBy = null;
          bed.locked = true; bed.releaseBy = e.termEndsAt;
          p.locationId = plan.facilityId; r.vehicle.occupants = r.vehicle.occupants.filter(id => id !== p.id);
          e.careBudgetSeconds = Math.min(s.ledger.remainingSeconds, careCapacity(g));
          e.admittedAt = at; e.phase = 'imprisoned'; p.custody.releaseBy = e.termEndsAt; bracelet.releaseBy = e.termEndsAt;
          park(r, plan); s.interim = 'finitePrisonService';
          tell(b, p, s, e, at, 'Physically admitted to the reserved prison bed. Finite service and care recorded; prior custody credit is not applied again.');
        } else tell(b, p, s, e, at, ready
          ? 'Physical intake checks in progress. Transfer custody counts toward the sentence; the six-hour release safeguard is unchanged.'
          : 'Prison admission unavailable. Transfer time continues to count; the six-hour release safeguard is unchanged.');
      } else if (e.phase === 'released') {
        if (p.prisonPreferences?.acceptReturnRide !== true || p.status !== 'alive') {
          e.phase = r.vehicle.reservedBy === plan.id ? 'returnCrew' : 'closed';
          if (e.phase === 'closed') close(g, s, e, plan, at);
        } else {
          const v = r.vehicle;
          if (!v.reservedBy && p.locationId === plan.facilityId && v.locationId === plan.facilityId
            && v.id === plan.vehicleId && v.condition >= 50 && v.seats >= 3 && v.fuelKm >= plan.fuelKm
            && r.crew.every(a => able(a) && !a.assignment && !a.reservedBy && a.locationId === plan.facilityId
              && plan.crewIds.includes(a.id) && a.workSeconds >= plan.fuelKm * 3600 / plan.route.speedKmPerHour)) {
            v.reservedBy = plan.id; r.crew.forEach(a => { a.reservedBy = plan.id; }); boardCrew(r, plan);
          }
          if (v.reservedBy === plan.id && p.locationId === v.locationId && !p.assignment) {
            v.occupants.push(p.id); p.locationId = v.id; p.assignment = `${e.id}:ride`; e.phase = 'returnPerson'; e.wasReady = false;
          }
        }
      } else if (e.phase === 'returnPerson') {
        if (p.prisonPreferences?.acceptReturnRide !== true) {
          p.locationId = r.vehicle.locationId; if (p.assignment === `${e.id}:ride`) p.assignment = null;
          r.vehicle.occupants = r.vehicle.occupants.filter(id => id !== p.id); e.phase = 'returnCrew'; e.wasReady = false;
        } else if (travel(r, b, p, e, plan, dt, 'desk', true)) {
          p.locationId = g.cityId; p.assignment = null; p.availableAt = at; e.returnedAt = at;
          r.vehicle.occupants = r.vehicle.occupants.filter(id => id !== p.id); e.phase = 'returnCrew'; e.wasReady = false;
          tell(b, p, s, e, at, 'Free voluntary return completed at the receiving desk. Return travel supplies no sentence credit.');
          availableNotice(b, p, at, 'Representative physically returned to the receiving desk after release.');
        }
      } else if (e.phase === 'returnCrew') {
        if (travel(r, b, p, e, plan, dt, 'prison', false)) { park(r, plan); close(g, s, e, plan, at); }
      }
      sync();
    }
  }
  return { advance, TRANSFER_LIMIT };
});
