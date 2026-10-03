const { test, expect } = require('@playwright/test');
const Trial = require('../cargo-trial');
const Referrals = require('../cargo-criminal-referrals');
const Charging = require('../cargo-charging');
const Court = require('../cargo-judicial-review');
const Buyer = require('../buyer-corroboration');
const { fixture } = require('./helpers/cargo-appearance-fixture');
const copy = x => JSON.parse(JSON.stringify(x));
const { trialFixture } = require('./helpers/cargo-trial-fixture');
test('fresh notice, preparation, real participants, element findings and nonpunitive sentencing handoff', () => {
  const f = trialFixture(); f.person.courtPreferences.shareNotices = true; const funds = f.buyer.money;
  f.untilTrial('preparation'); const t = f.d.trial, disclosure = copy(t.disclosures[0]);
  expect(t.scheduledBy).toBe(f.gate.cargoCourt.judge.id); expect(disclosure.receivedAt).toBeGreaterThan(f.d.appearance.returnedAt);
  f.step(86399); expect(t.phase).toBe('preparation'); expect(t.judgment).toBeUndefined();
  f.step(1); expect(t.phase).toBe('hearing'); expect(Buyer.canReceive(f.buyer)).toBe(false);
  expect(t.mandate.personId).toBe(f.person.id); expect(t.sessions[0].participantIds).toHaveLength(6);
  const before = f.state.operators[0].carrierService.workSeconds;
  f.untilTrial('judgment');
  expect(t.judgment.outcome).toBe('convicted'); expect(t.judgment.elements.every(e => e.established)).toBe(true);
  expect(t.challenges).toHaveLength(5); expect(t.disclosures[0]).toEqual(disclosure);
  expect(f.state.operators[0].carrierService.workSeconds).toBe(before - 1800);
  expect(t.sentencingHandoff).toMatchObject({ personId: f.person.id, punishmentAuthorized: false, custodyAuthorized: false });
  expect(f.person.locationId).toBe('b'); expect(f.person.assignment).toBeNull(); expect(Buyer.canReceive(f.buyer)).toBe(true);
  expect(f.d.custodyCase).toBeUndefined(); expect(f.buyer.money).toBe(funds);
  expect(f.buyer.buyerService.trialNotices.at(-1).text).toContain('convicted');
});
test('no automatic trial before completed return, and no remote service to an absent or unwilling defendant', () => {
  for (const defect of ['unfinished', 'absent', 'declinesNotice', 'credential']) {
    const f = trialFixture();
    if (defect === 'unfinished') f.d.appearance.phase = 'returning';
    if (defect === 'absent') f.person.locationId = 'foreign';
    if (defect === 'declinesNotice') f.person.trialPreferences.acceptNotice = false;
    if (defect === 'credential') f.buyer.buyerService.credentialActive = false;
    for (let i = 0; i < 30; i++) f.step(3600);
    expect(f.d.trial?.disclosures || []).toHaveLength(0); expect(f.d.trial?.judgment).toBeUndefined();
    expect(f.d.handoff.custodyAuthorized).toBe(false);
  }
});
test('absent, unwilling, exhausted or busy source witnesses cause adjournment, never testimony', () => {
  for (const defect of ['carrierAway', 'witnessDead', 'refusal', 'confidentiality', 'noArchive', 'examinerBusy', 'examinerAway', 'examinerWrong', 'sourceWork']) {
    const f = trialFixture(), op = f.state.operators[0], lab = f.gate.examinationLab;
    if (defect === 'carrierAway') op.location = 'foreign';
    if (defect === 'witnessDead') op.crew[0].health = 0;
    if (defect === 'refusal') op.carrierService.trialConsent = false;
    if (defect === 'confidentiality') op.carrierService.records = [{ document: { kind: 'buyerHandoff' } }];
    if (defect === 'noArchive') lab.records = [];
    if (defect === 'examinerBusy') lab.assignment = 'other-assay';
    if (defect === 'examinerAway') lab.examiner.locationId = 'elsewhere';
    if (defect === 'examinerWrong') lab.examiner.id = 'replacement';
    if (defect === 'sourceWork') op.carrierService.workSeconds = 1799;
    f.step(); expect(f.d.trial.phase, defect).toBe('adjourned'); f.step(86400);
    expect(f.d.trial.judgment).toBeUndefined(); expect(f.person.assignment).toBeNull();
  }
});
test('source discrepancy yields acquittal after a completed trial, not a reweighted charging score', () => {
  const f = trialFixture();
  f.state.operators[0].carrierService.recipientRecords.find(x => x.document.kind === 'recipientHandoff').document.accepted = false;
  f.untilTrial('judgment'); const t = f.d.trial;
  expect(t.judgment.outcome).toBe('acquitted'); expect(t.sentencingHandoff).toBeUndefined();
  expect(t.judgment.elements.find(e => e.id === 'transaction').established).toBe(false);
  expect(t.challenges.find(c => c.kind === 'transaction').result).toBe('sustained');
  expect(f.d.proposals[0].count.status).toBe('proposed');
});
test('authorization doubt and assay provenance defects cannot become supported convictions', () => {
  for (const defect of ['missingRegistry', 'permit', 'assayMismatch', 'identityMismatch', 'knowledgeMismatch']) {
    const f = trialFixture();
    if (defect === 'missingRegistry') delete f.gate.authorizations;
    if (defect === 'permit') f.gate.authorizations.push({ id: 'permit', cityId: 'b', productId: f.e.productId, validFrom: 0, expiresAt: 999999 });
    if (defect === 'assayMismatch') f.gate.examinationLab.records[0].report.result = 'targetNotDetected';
    if (defect === 'identityMismatch') f.state.operators[0].carrierService.recipientRecords[0].document.result = 'unresolved';
    if (defect === 'knowledgeMismatch') f.state.operators[0].carrierService.recipientRecords[1].document.acknowledgmentWitnessed = false;
    f.untilTrial('judgment'); expect(f.d.trial.judgment.outcome, defect).toBe('acquitted');
  }
});
test('new source material restarts exact disclosure and preparation without altering the old copy', () => {
  const f = trialFixture(); f.untilTrial('hearing'); const old = copy(f.d.trial.disclosures[0]);
  f.step(); f.step(300); expect(f.d.trial.progress).toBeGreaterThan(0);
  f.gate.examinationLab.records[0].report.quality.skill = 30;
  f.step(); expect(f.d.trial.phase).toBe('scheduling'); expect(f.person.assignment).toBeNull();
  f.untilTrial('preparation'); expect(f.d.trial.disclosures).toHaveLength(2);
  expect(f.d.trial.disclosures[0]).toEqual(old);
  expect(f.d.trial.disclosures[1].prepareUntil).toBe(f.d.trial.disclosures[1].receivedAt + 86400);
  f.step(86399); expect(f.d.trial.judgment).toBeUndefined();
});
test('new investigation material cannot use a stale proposal for a verdict', () => {
  const f = trialFixture(); f.untilTrial('hearing'); f.r.investigation.corrections.push({ id: 'new-correction' });
  f.step(3600); expect(f.d.trial.phase).toBe('adjourned'); expect(f.d.trial.judgment).toBeUndefined();
  expect(f.person.assignment).toBeNull();
});
test('NPC attendance and representation are independent; silence does not convict', () => {
  for (const defect of ['decline', 'noRepresentation', 'counselAbsent', 'judgeAbsent', 'prosecutorAbsent', 'sameActor']) {
    const f = trialFixture(); f.untilTrial('preparation');
    if (defect === 'decline') f.person.trialPreferences.attend = false;
    if (defect === 'noRepresentation') f.person.trialPreferences.representation = 'none';
    if (defect === 'counselAbsent') f.gate.cargoCourt.counsel.locationId = 'elsewhere';
    if (defect === 'judgeAbsent') f.gate.cargoCourt.judge.locationId = 'elsewhere';
    if (defect === 'prosecutorAbsent') f.gate.chargingOffice.prosecutor.locationId = 'elsewhere';
    if (defect === 'sameActor') f.gate.chargingOffice.prosecutor.id = f.gate.cargoCourt.judge.id;
    f.step(86400); expect(f.d.trial.phase, defect).toBe('adjourned'); expect(f.d.trial.judgment).toBeUndefined();
  }
  const f = trialFixture(); f.person.trialPreferences.representation = 'self'; f.person.trialPreferences.challenges = [];
  f.untilTrial('judgment'); expect(f.d.trial.mandate).toBeNull(); expect(f.d.trial.challenges).toHaveLength(0);
  expect(f.d.trial.judgment.elements).toHaveLength(5);
});
test('court outage releases actors and consumes only work actually done; resumed time is not retroactive', () => {
  const f = trialFixture(); f.untilTrial('hearing'); f.step(); f.step(300);
  const work = f.state.operators[0].carrierService.workSeconds; expect(work).toBe(9700);
  f.gate.cargoCourt.channelPowered = false; f.step(5000);
  expect(f.d.trial.phase).toBe('adjourned'); expect(f.person.assignment).toBeNull();
  expect(f.gate.examinationLab.trialJob).toBeNull(); expect(f.state.operators[0].crew[0].assignment).toBeNull();
  expect(f.state.operators[0].carrierService.workSeconds).toBe(work);
  f.gate.cargoCourt.channelPowered = true; f.step(5000); expect(f.d.trial.progress).toBe(0);
});
test('withdrawn count is dismissed with separate judge work, not acquitted or punished', () => {
  const f = trialFixture(); f.untilTrial('preparation'); f.d.status = 'withdrawn'; f.d.handoff = null;
  f.untilTrial('judgment'); expect(f.d.trial.judgment.outcome).toBe('dismissed'); expect(f.d.trial.sentencingHandoff).toBeUndefined();
});
test('shared court workers cannot process another job during the hearing', () => {
  const f = trialFixture(); f.untilTrial('hearing');
  const courtWork = f.gate.cargoCourt.workSeconds, prosecutionWork = f.gate.chargingOffice.workSeconds;
  Charging.advance(f.gate, f.clock() + 300, Referrals.findings); Court.advance(f.gate, f.clock() + 300, Referrals.findings);
  expect(f.gate.cargoCourt.workSeconds).toBe(courtWork); expect(f.gate.chargingOffice.workSeconds).toBe(prosecutionWork);
});
test('save/load preserves live hearing locks, exact disclosure and a single final judgment', () => {
  const f = trialFixture(); f.untilTrial('hearing'); f.step(); f.step(420);
  const restored = copy(f.state), gate = restored.checkpoints[0];
  for (let i = 0; i < 35; i++) { f.step(); Trial.advance(restored, gate, f.clock(), Referrals.findings); }
  expect(restored).toEqual(f.state); expect(f.d.trial.phase).toBe('judgment');
  const before = copy(f.state); f.step(86400); expect(f.state).toEqual(before);
  expect(f.buyer.buyerService.trialNotices).toBeUndefined();
});
test('completed NPC custody review leads to a separate trial only after physical release and return', () => {
  const f = fixture({ trialSources: true }), Custody = require('../cargo-custody');
  f.person.courtPreferences.attend = false; f.person.custodyPreferences.followup = 'evade';
  f.until('awaitingAttendance'); f.advance(86401);
  for (let n = 0; n < 300 && f.d.custodyCase?.phase !== 'closed'; n++) {
    f.advance(); Custody.advance(f.state, f.gate, f.now(), Referrals.findings);
  }
  expect(f.d.custodyCase.phase).toBe('closed'); const custody = copy(f.d.custodyCase);
  const trial = trialFixture(f); trial.untilTrial('judgment');
  expect(f.d.trial.disclosures[0].receivedAt).toBeGreaterThan(custody.personReturnedAt);
  expect(f.d.custodyCase).toEqual(custody); expect(f.d.trial.judgment.personId).toBe(f.person.id);
});
