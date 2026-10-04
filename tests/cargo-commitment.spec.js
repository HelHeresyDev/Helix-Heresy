const { test, expect } = require('@playwright/test');
const Commitment = require('../cargo-commitment');
const Referrals = require('../cargo-criminal-referrals');
const { commitmentFixture } = require('./helpers/cargo-commitment-fixture');
const { fineFixture } = require('./helpers/cargo-fine-payment-fixture');
const copy = x => JSON.parse(JSON.stringify(x));
function attachActualCustody(f) {
  const { fixture } = require('./helpers/cargo-appearance-fixture');
  const Custody = require('../cargo-custody');
  const held = fixture(); held.person.courtPreferences.attend = false; held.person.custodyPreferences.followup = 'evade';
  held.until('awaitingAttendance'); held.advance(86401);
  for (let n = 0; n < 2000 && held.d.custodyCase?.phase !== 'closed'; n++) {
    held.advance(); Custody.advance(held.state, held.gate, held.now(), Referrals.findings);
  }
  expect(held.d.custodyCase.phase).toBe('closed');
  expect(held.d.id).toBe(f.d.id); expect(held.person.civicDocument).toEqual(f.person.civicDocument);
  f.d.custodyCase = copy(held.d.custodyCase); f.gate.custodyOffice = copy(held.gate.custodyOffice);
}
test('local judicial review, fresh notice and voluntary reply reserve actual assets without custody', () => {
  const f = commitmentFixture(); f.person.courtPreferences.shareNotices = true;
  const originals = copy({ trial: f.d.trial, sentencing: f.d.sentencing, review: f.d.judgmentReview });
  const r = f.gate.cargoCorrections, fuel = r.vehicle.fuelKm, work = f.gate.cargoCourt.workSeconds;
  f.untilCommitment('notice'); expect(f.gate.cargoCourt.workSeconds).toBe(work - 900);
  expect(f.d.commitment.ledger).toMatchObject({ termSeconds: 60 * 86400, recognizedCustodySeconds: 0, creditAppliedAt: null });
  f.untilCommitment('response'); expect(f.d.commitment.notices[0].reportingDueAt).toBeNull(); expect(f.d.commitment.plans).toEqual([]);
  f.untilCommitment('reserved'); const s = f.d.commitment, plan = s.plans[0];
  expect(plan).toMatchObject({ personId: f.person.id, custodyAuthorized: false, executionAuthorized: false, fuelKm: 12 });
  expect(r.facility.beds.find(b => b.id === plan.bedId)).toMatchObject({ occupiedBy: null, reservedBy: plan.id });
  expect(r.vehicle.reservedBy).toBe(plan.id); expect(r.crew.every(p => p.reservedBy === plan.id)).toBe(true);
  expect(r.dispatcher.workSeconds).toBe(28500); expect(r.intake.workSeconds).toBe(28500);
  expect(r.vehicle.fuelKm).toBe(fuel); expect(f.person.locationId).toBe('b'); expect(f.person.assignment).toBeNull();
  expect(f.person.custody).toBeUndefined(); expect(s.ledger.prisonServedSeconds).toBe(0);
  expect({ trial: f.d.trial, sentencing: f.d.sentencing, review: f.d.judgmentReview }).toEqual(originals);
  expect(f.buyer.buyerService.commitmentNotices).toHaveLength(3);
});
test('fine, stayed, foreign, altered and overlong prison dispositions cannot enter commitment', () => {
  const fine = fineFixture(); fine.stepFine(); Commitment.advance(fine.state, fine.gate, fine.fineClock()); expect(fine.d.commitment).toBeUndefined();
  for (const defect of ['stay', 'foreign', 'person', 'amount', 'overlong', 'vacated']) {
    const f = commitmentFixture(), v = f.d.judgmentReview;
    if (defect === 'stay') v.stayActive = true;
    if (defect === 'foreign') v.decision.cityId = 'a';
    if (defect === 'person') v.decision.personId = 'scientist';
    if (defect === 'amount') v.decision.sanction.months = 3;
    if (defect === 'overlong') { v.decision.sanction.months = 121; v.disclosures.at(-1).proposed.sanction.months = 121; }
    if (defect === 'vacated') v.decision.outcome = 'convictionVacated';
    f.stepCommitment(86400); expect(f.d.commitment, defect).toBeUndefined();
  }
});
test('decline, defer, silence and unavailable identity never become coercion or credit', () => {
  for (const response of ['decline', 'defer', 'silent', 'identity', 'notice']) {
    const f = commitmentFixture();
    if (response === 'identity') f.state.identityOffices[0].records[0].status = 'revoked';
    else if (response === 'notice') f.person.commitmentPreferences.acceptNotice = false;
    else f.person.commitmentPreferences.response = response;
    for (let n = 0; n < 25; n++) f.stepCommitment(3600);
    expect(f.d.commitment.plans).toEqual([]); expect(f.d.commitment.ledger.remainingSeconds).toBe(60 * 86400);
    expect(f.person.custody).toBeUndefined(); expect(f.person.locationId).toBe('b'); expect(f.d.custodyCase).toBeUndefined();
  }
});
test('missing corrections, shared jail authority, unavailable judge and exhausted judicial resources pause review', () => {
  for (const defect of ['missing', 'jail', 'inactive', 'judge', 'work', 'busy']) {
    const f = commitmentFixture();
    if (defect === 'missing') f.gate.correctionsAuthority = null;
    if (defect === 'jail') f.gate.correctionsAuthority.institutionId = 'temporary-jail';
    if (defect === 'inactive') f.gate.cargoCorrections.active = false;
    if (defect === 'judge') f.gate.cargoCourt.judge.locationId = 'away';
    if (defect === 'work') f.gate.cargoCourt.workSeconds = 0;
    if (defect === 'busy') f.gate.cargoCourt.trialJob = 'other-case';
    for (let n = 0; n < 10; n++) f.stepCommitment(3600);
    expect(f.d.commitment.reviews, defect).toEqual([]); expect(f.d.commitment.plans).toEqual([]);
  }
});
test('missing bed, route, receiving approval, named staff or transport cannot be replaced by a jail stay', () => {
  for (const defect of ['bed', 'road', 'pickup', 'vehicle', 'fuel', 'driver', 'intake', 'staff', 'prison', 'power']) {
    const f = commitmentFixture(), r = f.gate.cargoCorrections; f.untilCommitment('placement');
    if (defect === 'bed') r.facility.beds.forEach(b => { b.occupiedBy = 'other'; });
    if (defect === 'road') r.route.open = false;
    if (defect === 'pickup') f.buyer.buyerService.premises.route.open = false;
    if (defect === 'vehicle') r.vehicle.reservedBy = 'other';
    if (defect === 'fuel') r.vehicle.fuelKm = 0;
    if (defect === 'driver') r.crew[0].locationId = 'away';
    if (defect === 'intake') r.intake.acceptsPlacements = false;
    if (defect === 'staff') r.intake.id = r.crew[0].id;
    if (defect === 'prison') r.facility.kind = 'jail';
    if (defect === 'power') r.power = 0;
    for (let n = 0; n < 10; n++) f.stepCommitment(3600);
    expect(f.d.commitment.plans, defect).toEqual([]); expect(f.person.custody).toBeUndefined();
  }
});
test('one-hour leases expire without failing to report, holding people or endlessly rebooking', () => {
  const f = commitmentFixture(); f.untilCommitment('reserved'); const plan = f.d.commitment.plans[0];
  f.stepCommitment(3600); expect(f.d.commitment.phase).toBe('postponed'); expect(plan.status).toBe('released');
  expect(f.gate.cargoCorrections.vehicle.reservedBy).toBeNull(); expect(f.gate.cargoCorrections.crew.every(p => !p.reservedBy)).toBe(true);
  expect(f.gate.cargoCorrections.facility.beds.every(b => !b.reservedBy)).toBe(true);
  f.stepCommitment(1e7); expect(f.d.commitment.plans).toHaveLength(1); expect(f.d.commitment.ledger.remainingSeconds).toBe(60 * 86400);
  expect(f.person.custody).toBeUndefined();
});
test('a held van cannot serve another plan and expiry preserves unrelated reservations', () => {
  const f = commitmentFixture(); f.untilCommitment('reserved'); const r = f.gate.cargoCorrections, s = f.d.commitment;
  expect(Commitment.resourceReason(f.gate, f.buyer, s, s.plans[0])).toBe('');
  expect(Commitment.resourceReason(f.gate, f.buyer, { id: 'other-plan', basis: s.basis })).toContain('vehicle');
  const other = r.facility.beds.find(b => !b.occupiedBy && !b.reservedBy); other.reservedBy = 'unrelated-plan';
  f.stepCommitment(3600); expect(other.reservedBy).toBe('unrelated-plan'); expect(r.vehicle.reservedBy).toBeNull();
});
test('new stays, consent withdrawal and damaged reservations release only this case resources', () => {
  for (const defect of ['stay', 'consent', 'vehicle', 'bed', 'route']) {
    const f = commitmentFixture(); f.untilCommitment('reserved'); const r = f.gate.cargoCorrections;
    if (defect === 'stay') f.d.judgmentReview.stayActive = true;
    if (defect === 'consent') f.person.commitmentPreferences.response = 'decline';
    if (defect === 'vehicle') r.vehicle.condition = 0;
    if (defect === 'bed') r.facility.beds.find(b => b.reservedBy).occupiedBy = 'other';
    if (defect === 'route') r.route.distanceKm++;
    f.stepCommitment(); expect(f.d.commitment.phase).toBe('postponed'); expect(r.vehicle.reservedBy).toBeNull();
    expect(f.person.custody).toBeUndefined();
  }
});
test('outages consume no retrospective work and save/load preserves partial planning and reservations', () => {
  const f = commitmentFixture(); f.stepCommitment(); f.stepCommitment(120);
  const work = f.gate.cargoCourt.workSeconds; f.gate.cargoCourt.channelPowered = false; f.stepCommitment(3600);
  expect(f.gate.cargoCourt.workSeconds).toBe(work); f.gate.cargoCourt.channelPowered = true; f.stepCommitment(3600);
  expect(f.gate.cargoCourt.workSeconds).toBe(work); f.untilCommitment('placement'); f.stepCommitment(); f.stepCommitment(120);
  const saved = copy(f.state);
  for (let n = 0; n < 5; n++) { f.stepCommitment(); Commitment.advance(saved, saved.checkpoints[0], f.commitmentClock()); }
  expect(saved).toEqual(f.state); expect(f.d.commitment.phase).toBe('reserved');
  f.stepCommitment(3600); Commitment.advance(saved, saved.checkpoints[0], f.commitmentClock()); expect(saved).toEqual(f.state);
});
test('normal criminal-process loop reaches a reserved placement and does not expose private notices', () => {
  const f = commitmentFixture(); let at = f.commitmentClock();
  for (let n = 0; n < 50 && f.d.commitment?.phase !== 'reserved'; n++) { at += 60; Referrals.advance(f.state, at); }
  expect(f.d.commitment.phase).toBe('reserved'); expect(f.buyer.buyerService.commitmentNotices).toBeUndefined();
});
test('corrections allocations are lazy, persistent and never replenish exhausted or occupied assets', () => {
  const fine = fineFixture(); fine.gate.correctionsAuthority = { active: true, role: 'longTermCorrectionsAuthority', cityId: 'b', institutionId: 'corrections', jailInstitutionId: 'jail' };
  Commitment.advance(fine.state, fine.gate, fine.fineClock()); expect(fine.gate.cargoCorrections).toBeUndefined();
  const f = commitmentFixture(), r = f.gate.cargoCorrections;
  r.vehicle.fuelKm = 0; r.facility.beds.forEach(b => { b.occupiedBy = 'registered-person'; });
  Commitment.provision(f.gate, f.commitmentClock() + 1000); expect(f.gate.cargoCorrections).toBe(r);
  expect(r.vehicle.fuelKm).toBe(0); expect(r.facility.beds.every(b => b.occupiedBy)).toBe(true);
});
test('actual closed detention credits arrest-to-release exactly once, excluding free return and waiting', () => {
  const f = commitmentFixture(); attachActualCustody(f); const j = f.d.custodyCase;
  f.untilCommitment('reserved'); const ledger = copy(f.d.commitment.ledger);
  expect(ledger.recognizedCustodySeconds).toBe(j.releasedAt - j.arrestedAt);
  expect(j.personReturnedAt).toBeGreaterThan(j.releasedAt);
  expect(ledger.remainingSeconds).toBe(60 * 86400 - ledger.recognizedCustodySeconds);
  expect(ledger.creditAppliedAt).toBeNull(); expect(f.gate.cargoCorrections.creditClaims).toHaveLength(1);
  f.stepCommitment(1e6); expect(f.d.commitment.ledger).toEqual(ledger); expect(f.gate.cargoCorrections.creditClaims).toHaveLength(1);
});
test('missing, mismatched, overlapping allocation and altered credit sources require review rather than guessing', () => {
  for (const defect of ['missing', 'wrongPerson', 'wrongDocket', 'duplicate', 'time', 'allocated']) {
    const f = commitmentFixture(); attachActualCustody(f); const receipts = f.gate.custodyOffice.custodyReceipts;
    if (defect === 'missing') receipts.length = 0;
    if (defect === 'wrongPerson') receipts[0].personId = 'other';
    if (defect === 'wrongDocket') receipts[0].docketId = 'other';
    if (defect === 'duplicate') receipts.push(copy(receipts[0]));
    if (defect === 'time') receipts[0].endedAt += 600;
    if (defect === 'allocated') f.gate.cargoCorrections.creditClaims.push({ sourceId: receipts[0].id, commitmentId: 'other-sentence' });
    for (let n = 0; n < 20; n++) f.stepCommitment(3600);
    expect(f.d.commitment.reviews, defect).toEqual([]); expect(f.d.commitment.ledger).toBeUndefined();
  }
});
