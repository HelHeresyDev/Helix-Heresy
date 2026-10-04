const { test, expect } = require('@playwright/test');
const Review = require('../cargo-judgment-review');
const Referrals = require('../cargo-criminal-referrals');
const { sentencingFixture } = require('./helpers/cargo-sentencing-fixture');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const f = sentencingFixture(); f.untilSentence('sentence');
  let at = f.sentencingClock();
  const step = (seconds = 60) => { at += seconds; Review.advance(f.state, f.gate, at, Referrals.findings); };
  const until = phase => { for (let n = 0; n < 1600 && f.d.judgmentReview?.phase !== phase; n++) step(); expect(f.d.judgmentReview?.phase).toBe(phase); };
  return { ...f, step, untilReview: until, clock: () => at };
}
test('independent mandatory review preserves records, uses fresh authority and never executes punishment', () => {
  const f = fixture(), original = copy(f.d.sentencing), judgment = copy(f.d.trial.judgment), money = f.buyer.money;
  f.person.courtPreferences.shareNotices = true; f.untilReview('preparation'); const v = f.d.judgmentReview, o = f.gate.cargoCourt.reviewOffice;
  expect(v.mandates[0].scope).toContain('This judgment review only'); expect(v.reviewerId).not.toBe(judgment.judgeId);
  f.step(86399); expect(v.phase).toBe('preparation'); f.step(1); expect(v.phase).toBe('hearing');
  const work = o.workSeconds; f.untilReview('decided');
  expect(o.workSeconds).toBe(work - 1800); expect(v.decision.outcome).toBe('affirmed');
  expect(v.decision).toMatchObject({ enforcementAuthorized: false, custodyAuthorized: false, financialCollectionAuthorized: false });
  expect(v.stayActive).toBe(false); expect(v.disposition).toBe('finalAwaitingSeparateEnforcement');
  expect(f.d.sentencing).toEqual(original); expect(f.d.trial.judgment).toEqual(judgment);
  expect(f.buyer.money).toBe(money); expect(f.person.locationId).toBe('b'); expect(f.person.assignment).toBeNull();
  expect(f.buyer.buyerService.judgmentReviewNotices).toHaveLength(2); expect(v.decision.submissions).toHaveLength(7);
});
test('missing or conflicted reviewer, incomplete records and unavailable resources keep indefinite stay', () => {
  for (const defect of ['sameJudge', 'sameProsecutor', 'formerCounsel', 'foreign', 'missing', 'dead', 'away', 'power', 'evidence', 'archive', 'registry', 'lawRole']) {
    const f = fixture(), o = f.gate.cargoCourt.reviewOffice;
    if (defect === 'sameJudge') o.reviewer.id = f.d.trial.judgment.judgeId;
    if (defect === 'sameProsecutor') o.reviewer.id = f.gate.chargingOffice.prosecutor.id;
    if (defect === 'formerCounsel') { o.reviewer.id = f.gate.cargoCourt.counsel.id; f.gate.cargoCourt.counsel.id = 'replacement-counsel'; }
    if (defect === 'foreign') o.cityId = 'foreign';
    if (defect === 'missing') delete f.gate.cargoCourt.reviewOffice;
    if (defect === 'dead') o.reviewer.status = 'dead';
    if (defect === 'away') o.reviewer.locationId = 'away';
    if (defect === 'power') o.power = 0;
    if (defect === 'evidence') f.r.investigation.corrections.push({ id: 'unassessed' });
    if (defect === 'archive') delete f.d.trial.disclosures[0].sources;
    if (defect === 'registry') delete f.gate.authorizations;
    if (defect === 'lawRole') o.reviewer.role = 'prosecutor';
    for (let n = 0; n < 15; n++) f.step(86400);
    expect(f.d.judgmentReview.decision, defect).toBeUndefined(); expect(f.d.judgmentReview.stayActive).toBe(true);
  }
});
test('no inferred representation or notice, and revoked review mandates cannot reuse sentencing authority', () => {
  for (const defect of ['notice', 'identity', 'counsel', 'mandate', 'none', 'attend']) {
    const f = fixture();
    if (defect === 'notice') f.person.judgmentReviewPreferences.acceptNotice = false;
    if (defect === 'identity') f.state.identityOffices[0].records[0].status = 'revoked';
    if (['notice', 'identity'].includes(defect)) { f.untilReview('notice'); f.step(1e7); }
    else {
      f.untilReview('preparation');
      if (defect === 'counsel') f.gate.cargoCourt.reviewOffice.counsel.locationId = 'away';
      if (defect === 'mandate') f.d.judgmentReview.mandates[0].status = 'revoked';
      if (defect === 'none') f.person.judgmentReviewPreferences.representation = 'none';
      if (defect === 'attend') f.person.judgmentReviewPreferences.attend = false;
      f.step(86400);
    }
    expect(f.d.judgmentReview.decision).toBeUndefined(); expect(f.d.judgmentReview.stayActive).toBe(true);
  }
});
test('new relevant-time permission restarts notice and leads only to a linked retrial handoff', () => {
  const f = fixture(); f.buyer.buyerService.power += 2; // Finite supply for an extra notice/session.
  f.untilReview('hearing'); f.step(); f.step(300);
  const old = copy(f.d.judgmentReview.disclosures[0]), conviction = copy(f.d.trial.judgment);
  f.gate.authorizations.push({ id: 'new-permission', cityId: 'b', productId: f.e.productId, validFrom: 0, expiresAt: 5000 });
  f.step(); expect(f.d.judgmentReview.phase).toBe('scheduling'); expect(f.person.assignment).toBeNull();
  f.untilReview('preparation'); expect(f.d.judgmentReview.disclosures[0]).toEqual(old);
  f.step(86399); expect(f.d.judgmentReview.decision).toBeUndefined(); f.untilReview('decided');
  expect(f.d.judgmentReview.decision.outcome).toBe('retrialRequired'); expect(f.d.judgmentReview.stayActive).toBe(true);
  expect(f.d.judgmentReview.handoff.kind).toBe('separateRetrial'); expect(f.d.trial.judgment).toEqual(conviction);
});
test('supported adverse changes cannot increase penalty; correction is linked, not an overwrite', () => {
  for (const amount of [500, 20]) {
    const f = fixture(); f.d.sentencing.sentence.sanction.credits = amount;
    const original = copy(f.d.sentencing.sentence); f.untilReview('decided');
    expect(f.d.sentencing.sentence).toEqual(original);
    expect(f.d.judgmentReview.decision.outcome).toBe(amount === 500 ? 'sentenceCorrected' : 'sentenceVacated');
    expect(f.d.judgmentReview.decision.sanction).toEqual(amount === 500 ? { kind: 'fine', credits: 120 } : null);
  }
});
test('original proof insufficiency vacates conviction without retrying it or inventing new evidence', () => {
  const f = fixture(); f.d.trial.disclosures[0].sources.assays[0].report.result = 'targetNotDetected';
  const judgment = copy(f.d.trial.judgment); f.untilReview('decided');
  expect(f.d.judgmentReview.decision.outcome).toBe('convictionVacated'); expect(f.d.judgmentReview.handoff).toBeUndefined();
  expect(f.d.judgmentReview.stayActive).toBe(true); expect(f.d.trial.judgment).toEqual(judgment);
});
test('normal criminal-process advance consumes the completed sentence and runs independent review', () => {
  const f = fixture(); let at = f.clock();
  for (let n = 0; n < 1600 && f.d.judgmentReview?.phase !== 'decided'; n++) { at += 60; Referrals.advance(f.state, at); }
  expect(f.d.judgmentReview.decision.outcome).toBe('affirmed');
});
test('new assessed exculpatory material is disclosed and cannot silently change the old conviction', () => {
  const f = fixture(), old = copy(f.d.trial.judgment); f.untilReview('preparation'); f.buyer.buyerService.power += 2;
  f.r.investigation.corrections.push({ id: 'correction' }); f.step(); expect(f.d.judgmentReview.phase).toBe('paused');
  f.r.investigation.assessments.push({ ...copy(f.a), correctionFindings: [{ sourceId: 'disclosure', correctionId: 'correction', finding: 'contested acknowledgment' }] });
  f.r.investigation.assessedSignature = '1:0:1'; f.untilReview('decided');
  expect(f.d.judgmentReview.decision.outcome).toBe('retrialRequired'); expect(f.d.trial.judgment).toEqual(old);
  expect(f.d.judgmentReview.disclosures.at(-1).input.current.assessment.correctionFindings).toHaveLength(1);
});
test('self representation and silence retain mandatory checks and do not leak private proceedings', () => {
  const f = fixture(); f.person.judgmentReviewPreferences.representation = 'self'; f.person.judgmentReviewPreferences.challenges = [];
  f.untilReview('decided'); expect(f.d.judgmentReview.decision.outcome).toBe('affirmed');
  expect(f.d.judgmentReview.decision.submissions).toEqual([]); expect(f.d.judgmentReview.mandates).toEqual([]);
  expect(f.buyer.buyerService.judgmentReviewNotices).toBeUndefined();
});
test('outage consumes no retrospective work and requires fresh notice after interrupted hearing', () => {
  const f = fixture(); f.untilReview('hearing'); f.step(); f.step(300);
  const o = f.gate.cargoCourt.reviewOffice, work = o.workSeconds; o.channelPowered = false; f.step(86400);
  expect(f.person.assignment).toBeNull(); expect(o.job).toBeNull(); expect(o.workSeconds).toBe(work);
  o.channelPowered = true; f.step(86400); expect(f.d.judgmentReview.progress).toBe(0);
  f.untilReview('preparation'); expect(f.d.judgmentReview.disclosures).toHaveLength(2);
});
test('save/load retains partial review deterministically and a final decision never silently rerolls', () => {
  const f = fixture(); f.untilReview('hearing'); f.step(); f.step(420); const saved = copy(f.state);
  for (let n = 0; n < 25; n++) { f.step(); Review.advance(saved, saved.checkpoints[0], f.clock(), Referrals.findings); }
  expect(saved).toEqual(f.state); expect(f.d.judgmentReview.phase).toBe('decided');
  const review = copy(f.d.judgmentReview); f.step(1e7); expect(f.d.judgmentReview).toEqual(review);
});
