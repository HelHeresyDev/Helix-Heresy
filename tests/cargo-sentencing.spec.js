const { test, expect } = require('@playwright/test');
const Sentencing = require('../cargo-sentencing');
const Charging = require('../cargo-charging');
const Court = require('../cargo-judicial-review');
const Referrals = require('../cargo-criminal-referrals');
const Buyer = require('../buyer-corroboration');
const { sentencingFixture, finePolicy } = require('./helpers/cargo-sentencing-fixture');
const copy = x => JSON.parse(JSON.stringify(x));
test('separate scheduling, fresh mandate, preparation and hearing produce only a stayed sentence', () => {
  const f = sentencingFixture(), judgment = copy(f.d.trial.judgment), handoff = copy(f.d.trial.sentencingHandoff), funds = f.buyer.money;
  f.person.courtPreferences.shareNotices = true; f.untilSentence('preparation'); const s = f.d.sentencing;
  const disclosure = copy(s.disclosures[0]); expect(disclosure.receivedAt).toBeGreaterThan(judgment.at);
  expect(s.mandates[0].scope).toContain('Sentencing hearing only'); expect(s.mandates[0].at).toBeGreaterThan(f.d.trial.mandate.at);
  f.stepSentence(86399); expect(s.phase).toBe('preparation'); f.stepSentence(1); expect(s.phase).toBe('hearing');
  expect(Buyer.canReceive(f.buyer)).toBe(false); const work = f.gate.cargoCourt.workSeconds;
  f.untilSentence('sentence'); expect(f.gate.cargoCourt.workSeconds).toBe(work - 1800);
  expect(s.sentence).toMatchObject({ sanction: { kind: 'fine', credits: 120 }, status: 'stayedPendingReview', enforcementAuthorized: false,
    custodyAuthorized: false, financialCollectionAuthorized: false, review: { expiresAt: null } });
  expect(s.disclosures[0]).toEqual(disclosure); expect(f.d.trial.judgment).toEqual(judgment); expect(f.d.trial.sentencingHandoff).toEqual(handoff);
  expect(f.buyer.money).toBe(funds); expect(f.person.locationId).toBe('b'); expect(Buyer.canReceive(f.buyer)).toBe(true);
  expect(f.d.custodyCase).toBeUndefined(); expect(s.sentence.mitigation[0].finding).toContain('receiving role');
  expect(f.buyer.buyerService.sentencingNotices).toHaveLength(2);
});
test('missing fine amounts remain pending rather than substituting prison or retroactively importing a policy', () => {
  const f = sentencingFixture({ ordinarySanctions: ['fine', 'finitePrison'], finitePrisonRangeMonths: { minimum: 3, maximum: 48 } });
  f.person.courtPreferences.shareNotices = true; f.stepSentence(); expect(f.d.sentencing.phase).toBe('policyPending');
  f.gate.productScheduleCode = { sentencing: copy(finePolicy) }; f.stepSentence(86400);
  expect(f.d.sentencing.sentence).toBeUndefined(); expect(f.d.sentencing.disclosures).toHaveLength(0);
  expect(f.buyer.buyerService.sentencingNotices).toHaveLength(1);
});
test('explicit finite-prison-only policy respects its local lower bound and never books a prisoner', () => {
  const f = sentencingFixture({ ordinarySanctions: ['finitePrison'], finitePrisonRangeMonths: { minimum: 2, maximum: 36 } });
  f.untilSentence('sentence'); expect(f.d.sentencing.sentence.sanction).toEqual({ kind: 'finitePrison', months: 2 });
  expect(f.d.sentencing.sentence.custodyAuthorized).toBe(false); expect(f.person.assignment).toBeNull();
  for (const policy of [null, { ordinarySanctions: ['finitePrison'], finitePrisonRangeMonths: { minimum: 3, maximum: 121 } },
    { ordinarySanctions: ['publicExecution'] }, { ordinarySanctions: ['fine'], fineRangeCredits: { minimum: -1, maximum: 10 } }]) {
    const bad = sentencingFixture(policy); bad.stepSentence(); expect(bad.d.sentencing.phase).toBe('policyPending');
  }
});
test('acquittal, altered handoff, foreign judgment and unsupported elements cannot enter sentencing', () => {
  for (const defect of ['acquittal', 'handoff', 'foreign', 'element']) {
    const f = sentencingFixture();
    if (defect === 'acquittal') f.d.trial.judgment.outcome = 'acquitted';
    if (defect === 'handoff') f.d.trial.sentencingHandoff.personId = 'other';
    if (defect === 'foreign') f.d.trial.sentencingHandoff.cityId = 'foreign';
    if (defect === 'element') { f.d.trial.judgment.elements[0].established = false; f.d.trial.sentencingHandoff.judgment = copy(f.d.trial.judgment); }
    f.stepSentence(100000); expect(f.d.sentencing).toBeUndefined();
  }
});
test('NPC consent and current identity are required for notice; trial mandates do not appoint sentencing counsel', () => {
  for (const defect of ['declineNotice', 'absent', 'revokedIdentity', 'channel']) {
    const f = sentencingFixture();
    if (defect === 'declineNotice') f.person.sentencingPreferences.acceptNotice = false;
    if (defect === 'absent') f.person.locationId = 'foreign';
    if (defect === 'revokedIdentity') f.state.identityOffices[0].records[0].status = 'revoked';
    if (defect === 'channel') f.buyer.buyerService.channelPowered = false;
    f.untilSentence('notice'); f.stepSentence(86400); expect(f.d.sentencing.disclosures).toHaveLength(0);
  }
  const f = sentencingFixture(); f.person.sentencingPreferences.representation = 'none'; f.untilSentence('preparation');
  expect(f.d.sentencing.mandates).toHaveLength(0); f.stepSentence(86400); expect(f.d.sentencing.phase).toBe('adjourned');
});
test('absent or duplicate participants, refusal and revoked mandates adjourn without punishment', () => {
  for (const defect of ['judge', 'prosecutor', 'counsel', 'duplicate', 'refusal', 'mandate', 'work']) {
    const f = sentencingFixture(); f.untilSentence('preparation');
    if (defect === 'judge') f.gate.cargoCourt.judge.locationId = 'away';
    if (defect === 'prosecutor') f.gate.chargingOffice.prosecutor.locationId = 'away';
    if (defect === 'counsel') f.gate.cargoCourt.counsel.health = 0;
    if (defect === 'duplicate') f.gate.chargingOffice.prosecutor.id = f.gate.cargoCourt.judge.id;
    if (defect === 'refusal') f.person.sentencingPreferences.attend = false;
    if (defect === 'mandate') f.d.sentencing.mandates[0].status = 'revoked';
    if (defect === 'work') f.gate.chargingOffice.workSeconds = 1799;
    f.stepSentence(86400); expect(f.d.sentencing.phase, defect).toBe('adjourned'); expect(f.d.sentencing.sentence).toBeUndefined();
    expect(f.person.assignment).toBeNull();
  }
});
test('outage releases reservations; interrupted work stays spent and cannot progress retroactively', () => {
  const f = sentencingFixture(); f.untilSentence('hearing'); f.stepSentence(); f.stepSentence(300);
  const work = f.gate.cargoCourt.workSeconds; f.gate.cargoCourt.channelPowered = false; f.stepSentence(5000);
  expect(f.d.sentencing.phase).toBe('adjourned'); expect(f.person.assignment).toBeNull(); expect(f.gate.cargoCourt.trialJob).toBeNull();
  expect(f.gate.cargoCourt.workSeconds).toBe(work); f.gate.cargoCourt.channelPowered = true; f.stepSentence(5000);
  expect(f.d.sentencing.progress).toBe(0); f.untilSentence('preparation');
  expect(f.d.sentencing.disclosures).toHaveLength(2); expect(f.d.sentencing.disclosures[1].prepareUntil).toBe(f.sentencingClock() + 86400);
});
test('new evidence requires judgment review, never a silent reroll or a stale sentence', () => {
  const f = sentencingFixture(); f.untilSentence('hearing'); const judgment = copy(f.d.trial.judgment);
  f.r.investigation.corrections.push({ id: 'new-correction' }); f.stepSentence(1800);
  expect(f.d.sentencing.phase).toBe('reviewRequired'); expect(f.d.sentencing.sentence).toBeUndefined();
  expect(f.d.trial.judgment).toEqual(judgment); expect(f.person.assignment).toBeNull();
});
test('shared actors cannot review charges while reserved for sentencing', () => {
  const f = sentencingFixture(); f.untilSentence('hearing'); const work = f.gate.cargoCourt.workSeconds;
  Court.advance(f.gate, f.sentencingClock() + 300, Referrals.findings); Charging.advance(f.gate, f.sentencingClock() + 300, Referrals.findings);
  expect(f.gate.cargoCourt.workSeconds).toBe(work); expect(f.gate.cargoCourt.trialJob).toBe(f.d.sentencing.id);
});
test('self-representation and silence do not aggravate or expose private means', () => {
  const f = sentencingFixture(); f.person.sentencingPreferences.representation = 'self'; f.person.sentencingPreferences.requestMitigation = false;
  f.person.wealth = 999999; f.buyer.reputation = -999; f.untilSentence('sentence');
  expect(f.d.sentencing.mandates).toHaveLength(0); expect(f.d.sentencing.sentence.sanction.credits).toBe(120);
  expect(JSON.stringify(f.d.sentencing)).not.toContain('999999'); expect(f.d.sentencing.sentence.defense.request).toContain('silence adds no aggravation');
  expect(f.buyer.buyerService.sentencingNotices).toBeUndefined();
});
test('save/load preserves a partial hearing, exact disclosure and an indefinitely stayed sentence', () => {
  const f = sentencingFixture(); f.untilSentence('hearing'); f.stepSentence(); f.stepSentence(420);
  const restored = copy(f.state), g = restored.checkpoints[0];
  for (let n = 0; n < 30; n++) { f.stepSentence(); Sentencing.advance(restored, g, f.sentencingClock()); }
  expect(restored).toEqual(f.state); expect(f.d.sentencing.phase).toBe('sentence'); const before = copy(f.state);
  f.stepSentence(1e8); expect(f.state).toEqual(before);
});
test('penalty publication copies the actual local rule once and never backfills historical criminal schedules', () => {
  const g = { id: 'g', cityId: 'b', jurisdiction: 'city' }, law = { id: 'local-code', offenseId: 'contrabandCommerce', legalStatus: 'prohibited',
    elements: ['transaction', 'contraband', 'knowledge'].map(id => ({ id })), sentencing: copy(finePolicy) };
  Referrals.provision(g, law, null, 100); expect(g.criminalRule.sentencing).toEqual(finePolicy);
  law.sentencing.fineRangeCredits.minimum = 999; Referrals.provision(g, law, null, 200);
  expect(g.criminalRule.sentencing.fineRangeCredits.minimum).toBe(120); expect(g.criminalRule.publishedAt).toBe(100);
});
test('newly disclosed prior local judgment restarts preparation without unsupported aggravation', () => {
  const f = sentencingFixture(); f.untilSentence('hearing'); const original = copy(f.d.sentencing.disclosures[0]);
  const other = copy(f.d); other.id = 'prior-docket'; delete other.sentencing; other.trial.sentencingHandoff = null; other.trial.judgment.at = 4000;
  f.gate.cargoCourt.dockets.push(other); f.stepSentence(300); expect(f.d.sentencing.phase).toBe('scheduling');
  expect(f.person.assignment).toBeNull(); f.untilSentence('preparation'); expect(f.d.sentencing.disclosures[0]).toEqual(original);
  expect(f.d.sentencing.disclosures[1].priorJudgments).toHaveLength(1); f.untilSentence('sentence');
  expect(f.d.sentencing.sentence.sanction.credits).toBe(120);
});
test('pending judicial challenge blocks sentencing while preserving the conviction', () => {
  const f = sentencingFixture(); f.untilSentence('hearing'); const judgment = copy(f.d.trial.judgment);
  f.d.status = 'reviewRequired'; f.d.handoff = null; f.stepSentence(1800);
  expect(f.d.sentencing.phase).toBe('reviewRequired'); expect(f.d.sentencing.sentence).toBeUndefined(); expect(f.d.trial.judgment).toEqual(judgment);
});
