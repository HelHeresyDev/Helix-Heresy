const { test, expect } = require('@playwright/test');
const { prisonFixture } = require('./helpers/cargo-prison-fixture');
const Commitment = require('../cargo-commitment');
const Prison = require('../cargo-prison');
const Referrals = require('../cargo-criminal-referrals');
const copy = x => JSON.parse(JSON.stringify(x));
test('peaceful physical pickup, admission, finite service, release and voluntary return use actual actors and resources', () => {
  const f = prisonFixture(), s = f.d.commitment, r = f.gate.cargoCorrections;
  const originals = copy({ trial: f.d.trial, sentencing: f.d.sentencing, review: f.d.judgmentReview });
  f.person.courtPreferences.shareNotices = true;
  f.untilPrison('pickup'); const e = s.execution;
  expect(e.order.personId).toBe(f.person.id); expect(f.person.custody).toBeUndefined();
  expect(r.vehicle.occupants).toEqual(r.crew.map(x => x.id)); expect(r.vehicle.fuelKm).toBe(40);
  f.untilPrison('surrender'); expect(r.vehicle.fuelKm).toBeCloseTo(34); expect(f.person.locationId).toBe('b');
  f.untilPrison('transfer'); expect(f.person.locationId).toBe(r.vehicle.id); expect(f.person.custody.suppressionActive).toBe(true);
  expect(s.ledger.transportServedSeconds).toBe(0); expect(s.ledger.creditAppliedAt).toBe(e.surrenderedAt);
  f.untilPrison('imprisoned'); expect(r.vehicle.fuelKm).toBeCloseTo(28);
  expect(r.vehicle.reservedBy).toBeNull(); expect(r.crew.every(x => x.locationId === r.facility.id)).toBe(true);
  expect(r.facility.beds.find(x => x.custodyId === e.id).occupiedBy).toBe(f.person.id);
  expect(f.person.locationId).toBe(r.facility.id); expect(e.admittedAt).toBeGreaterThan(e.surrenderedAt);
  const care = r.care.rationSeconds; f.stepPrison(86400);
  expect(s.ledger.prisonServedSeconds).toBe(86400); expect(r.care.rationSeconds).toBe(care - 86400);
  f.stepPrison(e.termEndsAt - f.prisonClock() + 1000);
  expect(e.release.at).toBe(e.termEndsAt); expect(e.release.reason).toBe('Finite sentence completed.');
  expect(s.ledger.remainingSeconds).toBe(0); expect(e.receipt.transportSeconds + e.receipt.prisonSeconds).toBe(60 * 86400);
  expect(f.person.custody.active).toBe(false); expect(f.person.custody.suppressionActive).toBe(false);
  expect(r.suppressors.every(x => !x.active)).toBe(true); expect(f.person.locationId).toBe(r.facility.id);
  const ledger = copy(s.ledger); f.untilPrison('closed');
  expect(f.person.locationId).toBe('b'); expect(f.person.assignment).toBeNull(); expect(r.vehicle.fuelKm).toBeCloseTo(16);
  expect(r.vehicle.locationId).toBe(r.facility.id); expect(s.phase).toBe('complete'); expect(s.ledger).toEqual(ledger);
  expect({ trial: f.d.trial, sentencing: f.d.sentencing, review: f.d.judgmentReview }).toEqual(originals);
  expect(f.buyer.buyerService.prisonNotices.map(x => x.text).join(' ')).toContain('Free voluntary return completed');
});
test('missing suppressor, failed fail-open inspection, care, judge or execution work cannot authorize pickup', () => {
  for (const defect of ['device', 'failOpen', 'lock', 'care', 'judge', 'work', 'ledger']) {
    const f = prisonFixture(), r = f.gate.cargoCorrections;
    if (defect === 'device') r.suppressors.length = 0;
    if (defect === 'failOpen') r.suppressors.forEach(x => { x.failOpen = false; });
    if (defect === 'lock') r.facility.beds.forEach(x => { x.failOpen = false; });
    if (defect === 'care') r.care.rationSeconds = 0;
    if (defect === 'judge') f.gate.cargoCourt.judge.locationId = 'away';
    if (defect === 'work') f.gate.cargoCourt.workSeconds = 0;
    if (defect === 'ledger') f.d.commitment.ledger.remainingSeconds += 100;
    f.stepPrison(); f.stepPrison(3600);
    expect(f.d.commitment.execution.order, defect).toBeUndefined(); expect(f.person.custody).toBeUndefined();
    expect(r.vehicle.fuelKm).toBe(40); expect(r.vehicle.reservedBy).toBeNull();
  }
});
test('identity, peaceful surrender, local authority, actual named escort and public pickup are rechecked at the van', () => {
  for (const defect of ['identity', 'refusal', 'foreign', 'stay', 'escort', 'private', 'absent']) {
    const f = prisonFixture(); f.untilPrison('surrender');
    if (defect === 'identity') f.person.civicDocument.number = 'other';
    if (defect === 'refusal') f.person.prisonPreferences.peacefulSurrender = false;
    if (defect === 'foreign') f.gate.correctionsAuthority.cityId = 'other';
    if (defect === 'stay') f.d.judgmentReview.stayActive = true;
    if (defect === 'escort') f.gate.cargoCorrections.crew[1].id = 'replacement';
    if (defect === 'private') f.buyer.buyerService.premises.publicAccess = false;
    if (defect === 'absent') f.person.locationId = 'elsewhere';
    f.stepPrison(); expect(f.person.custody, defect).toBeUndefined();
    expect(f.d.commitment.execution.surrenderedAt).toBeUndefined(); expect(f.d.commitment.ledger.transportServedSeconds).toBe(0);
    expect(f.d.custodyCase).toBeUndefined();
  }
});
test('broken transport still earns custody credit and the offline six-hour deadline releases at the actual road position', () => {
  const f = prisonFixture(); f.untilPrison('transfer'); f.stepPrison(); f.stepPrison();
  const s = f.d.commitment, e = s.execution, r = f.gate.cargoCorrections, position = copy(r.vehicle.road);
  expect(r.vehicle.locationId).toContain(':road'); r.vehicle.condition = 0;
  r.channelPowered = false; f.gate.cargoCourt.channelPowered = false;
  f.stepPrison(Prison.TRANSFER_LIMIT + 1000);
  expect(e.release.at).toBe(e.transferReleaseBy); expect(e.receipt.transportSeconds).toBe(Prison.TRANSFER_LIMIT);
  expect(s.ledger.remainingSeconds).toBe(60 * 86400 - Prison.TRANSFER_LIMIT); expect(r.vehicle.road).toEqual(position);
  expect(f.person.locationId).toBe(position.id); expect(f.person.custody.active).toBe(false); expect(r.suppressors.some(x => x.active)).toBe(false);
  const ledger = copy(s.ledger); f.stepPrison(86400); expect(s.ledger).toEqual(ledger); expect(f.person.custody.active).toBe(false);
});
test('failed identity, bed or intake cannot admit and never substitutes temporary jail', () => {
  for (const defect of ['bed', 'intake', 'identity', 'institution', 'kind']) {
    const f = prisonFixture(); f.untilPrison('transfer'); const r = f.gate.cargoCorrections;
    if (defect === 'bed') r.facility.beds.find(x => x.reservedBy).occupiedBy = 'unrelated-person';
    if (defect === 'intake') r.intake.acceptsPlacements = false;
    if (defect === 'identity') f.state.identityOffices[0].channelPowered = false;
    if (defect === 'institution') r.facility.institutionId = 'other';
    if (defect === 'kind') r.facility.kind = 'jail';
    for (let n = 0; n < 40; n++) f.stepPrison();
    expect(f.d.commitment.execution.admittedAt, defect).toBeUndefined();
    f.stepPrison(Prison.TRANSFER_LIMIT); expect(f.person.custody.active).toBe(false);
    if (defect === 'bed') expect(r.facility.beds.some(x => x.occupiedBy === 'unrelated-person')).toBe(true);
    expect(f.d.commitment.execution.receipt.prisonSeconds).toBe(0);
  }
});
test('finite care depletion releases at exhaustion, retains remaining sentence and never regenerates resources', () => {
  const f = prisonFixture(); f.untilPrison('imprisoned'); const r = f.gate.cargoCorrections, e = f.d.commitment.execution;
  r.care.rationSeconds = 600; const start = f.prisonClock(); f.stepPrison(3600);
  expect(e.release.at).toBe(start + 600); expect(e.receipt.prisonSeconds).toBe(600);
  expect(e.release.reason).toContain('care'); expect(r.care.rationSeconds).toBe(0);
  expect(f.person.custody.active).toBe(false); expect(f.d.commitment.ledger.remainingSeconds).toBeGreaterThan(0);
  Commitment.provision(f.gate, f.prisonClock()); expect(r.care.rationSeconds).toBe(0);
});
test('authority loss releases immediately and sentence expiry works without internet, staff or return fuel', () => {
  for (const defect of ['authority', 'expiry']) {
    const f = prisonFixture(); f.untilPrison('imprisoned'); const r = f.gate.cargoCorrections, e = f.d.commitment.execution;
    r.channelPowered = false; r.power = 0; f.gate.cargoCourt.channelPowered = false; r.vehicle.fuelKm = 0;
    f.person.prisonPreferences.acceptReturnRide = false;
    if (defect === 'authority') f.gate.correctionsAuthority.active = false;
    f.stepPrison(defect === 'expiry' ? e.termEndsAt - f.prisonClock() + 10 : 60);
    expect(e.release.reason).toContain(defect === 'expiry' ? 'completed' : 'authority');
    expect(f.person.locationId).toBe(r.facility.id); expect(f.person.assignment).toBeNull();
    expect(f.person.custody.suppressionActive).toBe(false); expect(r.facility.beds.some(x => x.custodyId === e.id)).toBe(false);
    f.stepPrison(); expect(e.phase).toBe('closed'); expect(f.person.locationId).toBe(r.facility.id);
  }
});
test('return transport cannot take another plan assets or confine the released person', () => {
  const f = prisonFixture(); f.untilPrison('imprisoned'); const r = f.gate.cargoCorrections, e = f.d.commitment.execution;
  r.vehicle.reservedBy = 'other'; r.crew.forEach(x => { x.reservedBy = 'other'; });
  f.stepPrison(e.termEndsAt - f.prisonClock()); f.stepPrison(3600);
  expect(e.phase).toBe('released'); expect(f.person.assignment).toBeNull(); expect(f.person.custody.active).toBe(false);
  expect(r.vehicle.reservedBy).toBe('other'); expect(r.crew.every(x => x.reservedBy === 'other')).toBe(true);
  f.person.prisonPreferences.acceptReturnRide = false; f.stepPrison(); expect(e.phase).toBe('closed'); expect(r.vehicle.reservedBy).toBe('other');
});
test('failed transfer can return freely and renew only through fresh notice, cooperation and a unique plan', () => {
  const f = prisonFixture(); f.untilPrison('transfer'); const r = f.gate.cargoCorrections, s = f.d.commitment;
  r.intake.acceptsPlacements = false;
  f.stepPrison(Prison.TRANSFER_LIMIT + 1); const first = copy(s.execution); expect(first.release).toBeTruthy();
  r.intake.acceptsPlacements = true; f.untilPrison('closed');
  const ledger = copy(s.ledger), count = s.notices.length;
  f.stepPrison(1000); expect(s.plans).toHaveLength(1); expect(s.ledger).toEqual(ledger);
  f.person.commitmentPreferences.renewalRequestedAt = f.prisonClock() + 1;
  // Renewals need finite actual fuel, not manufactured replenishment.
  expect(r.vehicle.fuelKm).toBeGreaterThanOrEqual(12);
  for (let n = 0; n < 100 && s.executions.length < 2; n++) f.stepPrison();
  expect(s.plans).toHaveLength(2); expect(s.plans[1].id).not.toBe(s.plans[0].id); expect(s.notices).toHaveLength(count + 1);
  f.untilPrison('transfer'); expect(s.execution.termEndsAt - s.execution.surrenderedAt).toBe(ledger.remainingSeconds);
  expect(s.ledger.creditAppliedAt).toBe(first.surrenderedAt); expect(s.ledger.transportServedSeconds).toBe(ledger.transportServedSeconds);
  expect(s.executions[0].receipt).toEqual(first.receipt);
});
test('changed declined response requires a fresh notice and response, not a reused consent', () => {
  const { commitmentFixture } = require('./helpers/cargo-commitment-fixture');
  const f = commitmentFixture(); f.person.commitmentPreferences.response = 'defer'; f.untilCommitment('declined');
  const first = copy(f.d.commitment.notices[0]); f.person.commitmentPreferences.response = 'cooperate'; f.stepCommitment();
  expect(f.d.commitment.phase).toBe('response'); expect(f.d.commitment.notices).toHaveLength(2);
  expect(f.d.commitment.notices[1].id).not.toBe(first.id); expect(f.d.commitment.responses).toHaveLength(1);
  f.untilCommitment('reserved'); expect(f.d.commitment.responses[1].noticeId).toBe(f.d.commitment.notices[1].id);
});
test('partial transport, imprisonment and release round trip through JSON without repeating fuel or service', () => {
  const f = prisonFixture(); f.untilPrison('transfer'); f.stepPrison(); f.stepPrison();
  const saved = copy(f.state), gate = saved.checkpoints[0];
  const step = seconds => {
    f.stepPrison(seconds); Commitment.advance(saved, gate, f.prisonClock()); Prison.advance(saved, gate, f.prisonClock());
    expect(saved).toEqual(f.state);
  };
  for (let n = 0; n < 30; n++) step(60);
  expect(f.d.commitment.execution.phase).toBe('imprisoned'); step(86400);
  step(f.d.commitment.execution.termEndsAt - f.prisonClock() + 100);
  for (let n = 0; n < 45; n++) step(60);
  expect(f.d.commitment.execution.phase).toBe('closed');
  const original = copy(f.state); Prison.advance(f.state, f.gate, f.prisonClock() - 1000); expect(f.state).toEqual(original);
});
test('normal process loop reaches real prison and preserves unshared private custody records', () => {
  const f = prisonFixture(); let at = f.prisonClock();
  for (let n = 0; n < 100 && f.d.commitment.execution?.phase !== 'imprisoned'; n++) { at += 60; Referrals.advance(f.state, at); }
  expect(f.d.commitment.execution.phase).toBe('imprisoned'); expect(f.buyer.buyerService.prisonNotices).toBeUndefined();
  expect(f.person.custody.active).toBe(true);
});
test('actual pretrial custody credit is consumed once at surrender and never counted as new prison service', () => {
  const { fixture } = require('./helpers/cargo-appearance-fixture');
  const Custody = require('../cargo-custody');
  const held = fixture(); held.person.courtPreferences.attend = false; held.person.custodyPreferences.followup = 'evade';
  held.until('awaitingAttendance'); held.advance(86401);
  for (let n = 0; n < 2000 && held.d.custodyCase?.phase !== 'closed'; n++) {
    held.advance(); Custody.advance(held.state, held.gate, held.now(), Referrals.findings);
  }
  expect(held.d.custodyCase.phase).toBe('closed');
  const { commitmentFixture } = require('./helpers/cargo-commitment-fixture');
  const f = commitmentFixture(); f.d.custodyCase = copy(held.d.custodyCase); f.gate.custodyOffice = copy(held.gate.custodyOffice);
  f.untilCommitment('reserved'); let at = f.commitmentClock();
  for (let n = 0; n < 100 && f.d.commitment.execution?.phase !== 'imprisoned'; n++) {
    at += 60; Commitment.advance(f.state, f.gate, at); Prison.advance(f.state, f.gate, at);
  }
  const s = f.d.commitment, e = s.execution; expect(e.phase).toBe('imprisoned');
  expect(s.ledger.recognizedCustodySeconds).toBe(held.d.custodyCase.releasedAt - held.d.custodyCase.arrestedAt);
  const claim = f.gate.cargoCorrections.creditClaims[0]; expect(claim.status).toBe('consumed'); expect(claim.appliedAt).toBe(e.surrenderedAt);
  at = e.termEndsAt + 100; Commitment.advance(f.state, f.gate, at); Prison.advance(f.state, f.gate, at);
  expect(s.ledger.remainingSeconds).toBe(0);
  expect(e.receipt.transportSeconds + e.receipt.prisonSeconds + s.ledger.recognizedCustodySeconds).toBe(60 * 86400);
  const saved = copy(f.state); Prison.advance(f.state, f.gate, at); // Release does not consume credit again.
  expect(f.gate.cargoCorrections.creditClaims).toEqual(saved.checkpoints[0].cargoCorrections.creditClaims);
});
test('paused travel and authorization do not perform retrospective work when a resource returns', () => {
  const f = prisonFixture(); f.stepPrison(); f.stepPrison(60); const c = f.gate.cargoCourt, r = f.gate.cargoCorrections;
  c.channelPowered = false; const work = c.workSeconds; f.stepPrison(600); expect(c.workSeconds).toBe(work);
  c.channelPowered = true; f.stepPrison(600); expect(c.workSeconds).toBe(work); f.untilPrison('pickup');
  f.stepPrison(); r.route.open = false; const fuel = r.vehicle.fuelKm; f.stepPrison(600); expect(r.vehicle.fuelKm).toBe(fuel);
  r.route.open = true; f.stepPrison(600); expect(r.vehicle.fuelKm).toBe(fuel); f.stepPrison(60); expect(r.vehicle.fuelKm).toBeLessThan(fuel);
});
test('admission saves a finite individual care allocation and service stops exactly at its limit', () => {
  const f = prisonFixture(); f.untilPrison('intake'); const r = f.gate.cargoCorrections;
  r.care.rationSeconds = 600; f.untilPrison('imprisoned'); const e = f.d.commitment.execution;
  expect(e.careBudgetSeconds).toBe(600);
  // Independent newly delivered stock does not silently enlarge a prior allocation.
  r.care.rationSeconds += 600; f.stepPrison(1200);
  expect(e.release.at).toBe(e.admittedAt + 600); expect(e.receipt.prisonSeconds).toBe(600); expect(r.care.rationSeconds).toBe(600);
  expect(f.person.custody.active).toBe(false);
});
test('a released passenger can withdraw return consent without remaining confined or being teleported', () => {
  const f = prisonFixture(); f.untilPrison('imprisoned'); const e = f.d.commitment.execution;
  f.stepPrison(e.termEndsAt - f.prisonClock()); f.untilPrison('returnPerson'); f.stepPrison(); f.stepPrison();
  const position = f.gate.cargoCorrections.vehicle.locationId, ledger = copy(f.d.commitment.ledger);
  expect(position).toContain(':road'); f.person.prisonPreferences.acceptReturnRide = false; f.stepPrison();
  expect(f.person.locationId).toBe(position); expect(f.person.assignment).toBeNull(); expect(f.person.custody.active).toBe(false);
  f.untilPrison('closed'); expect(f.person.locationId).toBe(position); expect(f.d.commitment.ledger).toEqual(ledger);
  expect(f.gate.cargoCorrections.vehicle.locationId).toBe(f.gate.cargoCorrections.facility.id);
});
test('intake respects shared staff reservations and can finish with exactly its remaining work', () => {
  const f = prisonFixture(); f.untilPrison('intake'); const r = f.gate.cargoCorrections, e = f.d.commitment.execution;
  r.intake.workSeconds = 60; r.job = 'unrelated-placement'; f.stepPrison(30);
  expect(e.phase).toBe('intake'); expect(r.intake.workSeconds).toBe(60); expect(r.job).toBe('unrelated-placement');
  r.job = null; f.stepPrison(30); expect(r.intake.workSeconds).toBe(60);
  expect(r.intake.job).toBe(e.id);
  expect(Commitment.resourceReason(f.gate, f.buyer, f.d.commitment, f.d.commitment.plans[0])).toContain('intake staff unavailable');
  f.stepPrison(30); expect(r.intake.workSeconds).toBe(30); f.stepPrison(30);
  expect(e.phase).toBe('imprisoned'); expect(r.intake.workSeconds).toBe(0); expect(r.intake.job).toBeNull();
});
