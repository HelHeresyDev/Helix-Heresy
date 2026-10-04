const { test, expect } = require('@playwright/test');
const Fines = require('../cargo-fine-payment');
const Referrals = require('../cargo-criminal-referrals');
const { fineFixture } = require('./helpers/cargo-fine-payment-fixture');
const copy = x => JSON.parse(JSON.stringify(x));
test('separate local authorization and notice precede explicit employer gift and one-time settlement', () => {
  const f = fineFixture(); f.person.courtPreferences.shareNotices = true;
  const sentence = copy(f.d.sentencing), review = copy(f.d.judgmentReview), trial = copy(f.d.trial);
  f.untilFine('notice'); expect(f.buyer.money).toBe(1000); expect(f.d.finePayment.receipts).toEqual([]);
  f.untilFine('funding'); expect(f.buyer.money).toBe(1000); expect(f.d.finePayment.notices[0]).toMatchObject({ totalCredits: 120, outstandingCredits: 120, dueAt: null });
  f.untilFine('payment'); expect(f.buyer.money).toBe(1000); expect(f.d.finePayment.grants[0].defendantConsent.personId).toBe(f.person.id);
  expect(f.d.finePayment.grants[0].controllerId).not.toBe(f.person.id);
  f.untilFine('satisfied'); const fine = f.d.finePayment, office = f.gate.cargoCourt.fineOffice, sponsor = f.buyer.buyerService.fineSponsor;
  expect(f.buyer.money).toBe(880); expect(office.money).toBe(120); expect(fine.receipts).toHaveLength(1);
  expect(office.receipts).toEqual(fine.receipts); expect(sponsor.receipts).toEqual(fine.receipts);
  expect(office.workSeconds).toBe(7200 - 900); expect(sponsor.workSeconds).toBe(3600 - 600);
  expect(fine.satisfaction.totalCredits).toBe(120); expect(f.d.sentencing).toEqual(sentence); expect(f.d.judgmentReview).toEqual(review); expect(f.d.trial).toEqual(trial);
  expect(f.person.locationId).toBe('b'); expect(f.d.custodyCase).toBeUndefined(); expect(f.person.debt).toBeUndefined();
  expect(f.buyer.buyerService.finePaymentNotices).toHaveLength(3);
  const before = copy(f.state); f.stepFine(1e8); expect(f.state).toEqual(before);
});
test('partial payments conserve money, retain immutable receipts and settle only after business funds exist', () => {
  const f = fineFixture({ balance: 160 }); f.untilFine('payment');
  for (let n = 0; n < 10; n++) f.stepFine();
  const first = copy(f.d.finePayment.receipts[0]); expect(first).toMatchObject({ credits: 60, remainingCredits: 60 });
  expect(f.buyer.money).toBe(100); expect(f.d.finePayment.satisfaction).toBeUndefined();
  f.stepFine(86400); expect(f.d.finePayment.receipts).toHaveLength(1); expect(f.d.custodyCase).toBeUndefined();
  f.buyer.money += 60; // Simulate actual new business revenue.
  f.untilFine('satisfied'); expect(f.d.finePayment.receipts).toHaveLength(2);
  expect(f.d.finePayment.receipts[0]).toEqual(first); expect(f.gate.cargoCourt.fineOffice.money).toBe(120); expect(f.buyer.money).toBe(100);
});
test('stayed, vacated, foreign, unreviewed, custodial and altered decisions cannot authorize fine payment', () => {
  for (const defect of ['stay', 'vacated', 'foreign', 'decision', 'amount', 'person', 'sentence', 'disposition']) {
    const f = fineFixture(); const v = f.d.judgmentReview;
    if (defect === 'stay') v.stayActive = true;
    if (defect === 'vacated') v.decision.outcome = 'convictionVacated';
    if (defect === 'foreign') v.decision.cityId = 'foreign';
    if (defect === 'decision') delete v.decision;
    if (defect === 'amount') v.decision.sanction.credits++;
    if (defect === 'person') v.decision.personId = 'someone-else';
    if (defect === 'sentence') f.d.sentencing.sentence.id = 'other';
    if (defect === 'disposition') v.disposition = 'reliefPendingSeparateProcedure';
    f.stepFine(86400); expect(f.d.finePayment, defect).toBeUndefined(); expect(f.buyer.money).toBe(1000);
  }
  const prison = fineFixture({ policy: { ordinarySanctions: ['finitePrison'], finitePrisonRangeMonths: { minimum: 2, maximum: 36 } } });
  prison.stepFine(86400); expect(prison.d.finePayment).toBeUndefined();
});
test('corrected reviewed amount controls payment without rewriting the original excessive sentence', () => {
  const f = fineFixture({ beforeReview: f => { f.d.sentencing.sentence.sanction.credits = 500; } });
  expect(f.d.judgmentReview.decision.outcome).toBe('sentenceCorrected'); f.untilFine('satisfied');
  expect(f.d.finePayment.satisfaction.totalCredits).toBe(120); expect(f.d.sentencing.sentence.sanction.credits).toBe(500);
});
test('missing official, local authority, resources and identity cannot be bypassed by waiting', () => {
  for (const defect of ['officer', 'role', 'office', 'power', 'work', 'foreign', 'identity', 'defendantAway', 'terminal']) {
    const f = fineFixture(), o = f.gate.cargoCourt.fineOffice;
    if (defect === 'officer') o.officer.locationId = 'away';
    if (defect === 'role') o.officer.role = 'collector';
    if (defect === 'office') delete f.gate.cargoCourt.fineOffice;
    if (defect === 'power') o.power = 0;
    if (defect === 'work') o.workSeconds = 0;
    if (defect === 'foreign') o.cityId = 'elsewhere';
    if (defect === 'identity') f.state.identityOffices[0].records[0].status = 'revoked';
    if (defect === 'defendantAway') f.person.locationId = 'away';
    if (defect === 'terminal') f.buyer.buyerService.channelPowered = false;
    for (let n = 0; n < 20; n++) f.stepFine(86400);
    expect(f.buyer.money, defect).toBe(1000); expect(f.d.finePayment.receipts).toEqual([]); expect(f.d.custodyCase).toBeUndefined();
  }
});
test('defendant refusal, employer refusal and unsupported business ownership never debit business or personal assets', () => {
  for (const defect of ['notice', 'disclosure', 'contribution', 'employer', 'treasurerAway', 'sameActor', 'account', 'controller', 'employment', 'foreignSponsor', 'noSponsor']) {
    const f = fineFixture(), s = f.buyer.buyerService.fineSponsor;
    f.person.money = 10000;
    if (defect === 'notice') f.person.finePaymentPreferences.acceptNotice = false;
    if (defect === 'disclosure') f.person.finePaymentPreferences.discloseToEmployer = false;
    if (defect === 'contribution') f.person.finePaymentPreferences.acceptEmployerContribution = false;
    if (defect === 'employer') s.preferences.sponsorFines = false;
    if (defect === 'treasurerAway') s.controller.locationId = 'away';
    if (defect === 'sameActor') { s.controller.id = f.person.id; s.account.controllerId = f.person.id; }
    if (defect === 'account') s.account.buyerId = 'other-business';
    if (defect === 'controller') s.account.controllerId = 'someone-else';
    if (defect === 'employment') s.employment.personId = 'someone-else';
    if (defect === 'foreignSponsor') s.cityId = 'a';
    if (defect === 'noSponsor') delete f.buyer.buyerService.fineSponsor;
    for (let n = 0; n < 50; n++) f.stepFine();
    expect(f.buyer.money, defect).toBe(1000); expect(f.person.money).toBe(10000); expect(f.d.finePayment.receipts).toEqual([]);
  }
});
test('stay, revoked consent and withdrawn mandate interrupt an in-flight payment without any debit', () => {
  for (const defect of ['stay', 'defendant', 'payer', 'mandate', 'account', 'cash']) {
    const f = fineFixture(); f.untilFine('payment'); f.stepFine(); f.stepFine(120);
    expect(f.d.finePayment.progress).toBe(120);
    if (defect === 'stay') f.d.judgmentReview.stayActive = true;
    if (defect === 'defendant') f.person.finePaymentPreferences.acceptEmployerContribution = false;
    if (defect === 'payer') f.buyer.buyerService.fineSponsor.preferences.sponsorFines = false;
    if (defect === 'mandate') f.d.finePayment.grants[0].status = 'revoked';
    if (defect === 'account') f.buyer.buyerService.fineSponsor.account.status = 'closed';
    if (defect === 'cash') f.buyer.money = 100;
    f.stepFine(10000); expect(f.buyer.money).toBe(defect === 'cash' ? 100 : 1000);
    expect(f.d.finePayment.receipts).toEqual([]); expect(f.gate.cargoCourt.fineOffice.job).toBeNull();
  }
});
test('outage spends no retroactive work and a lower live balance forces a fresh smaller transfer', () => {
  const f = fineFixture(); f.untilFine('payment'); f.stepFine(); f.stepFine(120);
  const o = f.gate.cargoCourt.fineOffice, spent = o.workSeconds; o.channelPowered = false; f.stepFine(5000);
  expect(o.workSeconds).toBe(spent); o.channelPowered = true; f.stepFine(5000); expect(o.workSeconds).toBe(spent);
  f.buyer.money = 150; f.stepFine(300); expect(f.d.finePayment.receipts).toHaveLength(0);
  f.stepFine(300); expect(f.d.finePayment.receipts[0]).toMatchObject({ credits: 50, remainingCredits: 70 }); expect(f.buyer.money).toBe(100);
});
test('sponsorship cap cannot refresh on retries or a replacement official and unpaid balance creates no prison', () => {
  const f = fineFixture(); f.buyer.buyerService.fineSponsor.preferences.maximumPerFineCredits = 50;
  f.untilFine('payment'); for (let n = 0; n < 10; n++) f.stepFine();
  expect(f.d.finePayment.receipts[0].credits).toBe(50);
  f.gate.cargoCourt.fineOffice.officer.id = 'new-officer'; f.buyer.buyerService.fineSponsor.preferences.maximumPerFineCredits = 300;
  for (let n = 0; n < 50; n++) f.stepFine();
  expect(f.d.finePayment.grants).toHaveLength(1); expect(f.buyer.money).toBe(950); expect(f.d.finePayment.satisfaction).toBeUndefined();
  expect(f.d.custodyCase).toBeUndefined(); expect(f.d.finePayment.notices.at(-1).outstandingCredits).toBe(70);
});
test('partial transfer save/load is deterministic and completed receipts cannot debit twice', () => {
  const f = fineFixture(); f.untilFine('payment'); f.stepFine(); f.stepFine(120);
  const restored = copy(f.state);
  for (let n = 0; n < 10; n++) { f.stepFine(); Fines.advance(restored, restored.checkpoints[0], f.fineClock()); }
  expect(restored).toEqual(f.state); expect(f.d.finePayment.phase).toBe('satisfied');
  const paid = copy(restored); Fines.advance(restored, restored.checkpoints[0], f.fineClock()); Fines.advance(restored, restored.checkpoints[0], f.fineClock() + 86400);
  expect(restored).toEqual(paid);
});
test('normal criminal-process advance integrates settlement and private notices remain private', () => {
  const f = fineFixture(); let at = f.fineClock();
  for (let n = 0; n < 100 && f.d.finePayment?.phase !== 'satisfied'; n++) { at += 60; Referrals.advance(f.state, at); }
  expect(f.d.finePayment.phase).toBe('satisfied'); expect(f.buyer.buyerService.finePaymentNotices).toBeUndefined();
});
test('a reviewed zero fine receives a satisfaction record without sponsorship or an invented transfer', () => {
  const f = fineFixture({ policy: { ordinarySanctions: ['fine'], fineRangeCredits: { minimum: 0, maximum: 500 } } });
  f.buyer.buyerService.fineSponsor.preferences.sponsorFines = false;
  f.person.finePaymentPreferences.acceptEmployerContribution = false;
  f.untilFine('satisfied'); expect(f.d.finePayment.receipts).toEqual([]); expect(f.d.finePayment.grants).toEqual([]);
  expect(f.buyer.money).toBe(1000); expect(f.gate.cargoCourt.fineOffice.money).toBe(0);
});
test('fractional business cash is preserved and negative or invalid spending terms cannot fund gifts', () => {
  const f = fineFixture({ balance: 150.75 }); f.untilFine('payment');
  for (let n = 0; n < 10; n++) f.stepFine();
  expect(f.d.finePayment.receipts[0].credits).toBe(50); expect(f.buyer.money).toBe(100.75);
  for (const policy of [{ reserveCredits: -1 }, { maximumPerFineCredits: 1.5 }, { maximumPerFineCredits: Infinity }]) {
    const bad = fineFixture(); Object.assign(bad.buyer.buyerService.fineSponsor.preferences, policy);
    for (let n = 0; n < 30; n++) bad.stepFine();
    expect(bad.buyer.money).toBe(1000); expect(bad.d.finePayment.grants).toEqual([]);
  }
});
