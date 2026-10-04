const { test, expect } = require('@playwright/test');
const { threatFixture } = require('./helpers/cargo-threat-fixture');
const Custody = require('../cargo-custody');
const Referrals = require('../cargo-criminal-referrals');
const Appearance = require('../cargo-appearance');
const copy = x => JSON.parse(JSON.stringify(x));
test('physical close threat has distinct prospective review, peaceful custody, credit receipt and release', () => {
  const f = threatFixture(); f.person.courtPreferences.shareNotices = true;
  f.until('threatEncounter'); const j = f.job(), o = f.office();
  expect(j.order).toBeUndefined(); expect(f.person.custody).toBeUndefined();
  expect(o.officers.every(x => x.locationId === f.buyer.buyerService.premises.id)).toBe(true);
  const resources = f.person.provisions; f.until('authorization');
  expect(f.person.provisions).toBeLessThan(resources); expect(j.encounter.movedMeters).toBe(2);
  expect(j.submission).toMatchObject({ personId: f.person.id, targetId: o.officers[0].id, witnessId: o.officers[1].id,
    distanceMeters: 1, means: 'observedFunctionalUnarmedStrike' });
  expect(JSON.stringify(j.submission)).not.toContain('threatPreferences');
  f.until('execution'); expect(j.order.lawId).toBe(o.threatPolicy.id); expect(j.order.lawId).not.toBe(o.policy.id);
  expect(j.decisions[0].ground).toBe('immediateThreat'); expect(j.decisions[0].sources).toEqual([f.d.appearance.id, j.submission.id]);
  f.until('escort'); expect(f.person.custody).toMatchObject({ active: true, suppressionActive: true });
  f.until('review'); expect(o.jail.stays[0].detaineeId).toBe(f.person.id); expect(f.state.jailCustody).toBeUndefined();
  f.until('closed'); expect(f.person.custody.active).toBe(false); expect(f.person.locationId).toBe('b');
  expect(o.custodyReceipts).toHaveLength(1); expect(o.custodyReceipts[0].endedAt).toBe(j.releasedAt);
  expect(j.personReturnedAt).toBeGreaterThan(j.releasedAt); expect(f.d.trial).toBeUndefined();
  expect(f.buyer.buyerService.appearanceNotices.some(x => x.text.includes('immediate-threat review'))).toBe(true);
});
test('arguments, refusals, silence, requests for help and unsupported threats do not authorize custody', () => {
  for (const response of ['argue', 'refuse', 'silent', 'explain', 'threaten']) {
    const f = threatFixture(response);
    if (response === 'threaten') f.person.physicalCapabilities.unarmedStrike = false;
    f.until('closed'); expect(f.job().order, response).toBeUndefined(); expect(f.person.custody).toBeUndefined();
    expect(f.job().decisions[0].status).toBe('insufficientGrounds');
  }
});
test('blocked visibility, barriers, unavailable movement and contrary explanations defeat immediacy', () => {
  for (const defect of ['visibility', 'barrier', 'provisions', 'explanation']) {
    const f = threatFixture();
    if (defect === 'visibility') f.buyer.buyerService.premises.encounter.visible = false;
    if (defect === 'barrier') f.buyer.buyerService.premises.encounter.barrier = true;
    if (defect === 'provisions') f.person.provisions = 0;
    if (defect === 'explanation') f.person.threatPreferences.explanation = 'I was warning you about someone behind you.';
    f.until('authorization'); f.step(); f.step();
    expect(f.job().decisions[0].status, defect).toBe('insufficientGrounds'); expect(f.job().order).toBeUndefined();
  }
});
test('retraction and disengagement are observed updates and prevent execution without punishment', () => {
  for (const reaction of ['retract', 'disengage', 'explain']) {
    const f = threatFixture(); f.until('execution'); f.person.threatPreferences.reaction = reaction;
    f.step(); expect(f.job().phase).toBe('releaseReturn'); expect(f.job().encounter.updates).toHaveLength(1);
    expect(f.job().arrestedAt).toBeUndefined(); f.until('closed'); expect(f.person.custody).toBeUndefined();
  }
});
test('retained source, actual movement, distinct witness and prospectively published threat policy are mandatory', () => {
  for (const defect of ['copy', 'withdrawn', 'policy', 'witness', 'movement', 'duplicate']) {
    const f = threatFixture(); f.until('authorization'); const j = f.job(), o = f.office();
    if (defect === 'copy') j.submission.targetId = 'someone-else';
    if (defect === 'withdrawn') o.witnessRecords[0].status = 'withdrawn';
    if (defect === 'policy') o.threatPolicy.publishedAt = f.now() + 1;
    if (defect === 'witness') f.gate.cargoCourt.judge.id = j.submission.witnessId;
    if (defect === 'movement') j.encounter.movedMeters = 0;
    if (defect === 'duplicate') o.witnessRecords.push(copy(o.witnessRecords[0]));
    f.until('closed'); expect(j.arrestedAt, defect).toBeUndefined(); expect(j.decisions[0].status).toBe('insufficientGrounds');
  }
});
test('stale encounters and unavailable judge cannot be revived into late arrests', () => {
  const f = threatFixture(); f.until('authorization'); const work = f.gate.cargoCourt.workSeconds;
  f.gate.cargoCourt.channelPowered = false; f.step(301);
  expect(f.job().phase).toBe('releaseReturn'); expect(f.gate.cargoCourt.workSeconds).toBe(work);
  f.gate.cargoCourt.channelPowered = true; f.until('closed'); expect(f.job().order).toBeUndefined();
});
test('execution rechecks identity, current threat, local law, cell and peaceful surrender', () => {
  for (const defect of ['identity', 'absent', 'private', 'cell', 'refusal', 'law', 'foreign', 'expired', 'decision']) {
    const f = threatFixture(); f.until('execution'); const j = f.job();
    if (defect === 'identity') f.state.identityOffices[0].records[0].status = 'revoked';
    if (defect === 'absent') f.person.locationId = 'unknown';
    if (defect === 'private') f.buyer.buyerService.premises.publicAccess = false;
    if (defect === 'cell') f.office().cell.occupant = 'another-person';
    if (defect === 'refusal') f.person.custodyPreferences.peacefulSurrender = false;
    if (defect === 'law') j.order.lawId = f.office().policy.id;
    if (defect === 'foreign') j.order.cityId = 'foreign';
    if (defect === 'expired') j.order.executeBy = f.now();
    if (defect === 'decision') j.order.decisionId = 'missing';
    f.step(); expect(j.arrestedAt, defect).toBeUndefined(); expect(f.person.custody).toBeUndefined();
    f.step(301); expect(j.arrestedAt).toBeUndefined();
    if (defect === 'cell') expect(f.office().cell.occupant).toBe('another-person');
  }
});
test('offline six-hour release and evidence withdrawal operate during real threat custody', () => {
  for (const reason of ['offline', 'withdrawn']) {
    const f = threatFixture(); f.until('review');
    if (reason === 'offline') { f.office().channelPowered = false; f.step(f.job().releaseBy - f.now() + 1); }
    else { f.office().witnessRecords[0].status = 'withdrawn'; f.step(); }
    expect(f.person.custody.active).toBe(false); expect(f.person.custody.suppressionActive).toBe(false);
    expect(f.office().cell.locked).toBe(false); expect(f.office().custodyReceipts).toHaveLength(1);
    if (reason === 'offline') expect(f.job().releasedAt).toBe(f.job().releaseBy);
  }
});
test('save/load preserves exact encounter movement, testimony, jail booking and release without private notices', () => {
  const f = threatFixture(); f.until('threatEncounter'); f.step(1); f.step(1);
  const restored = copy(f.state), g = restored.checkpoints[0];
  for (let n = 0; n < 150; n++) {
    f.step(); Appearance.advance(restored, g, f.now(), Referrals.findings); Custody.advance(restored, g, f.now(), Referrals.findings);
  }
  expect(restored).toEqual(f.state); expect(f.job().phase).toBe('closed'); expect(f.office().jail.stays).toHaveLength(1);
  expect(f.buyer.buyerService.appearanceNotices).toBeUndefined();
});
test('threat detention is accepted by the existing exact-once sentence credit adapter', () => {
  const f = threatFixture(); f.until('closed');
  const { commitmentFixture } = require('./helpers/cargo-commitment-fixture');
  const Commitment = require('../cargo-commitment');
  const sentenced = commitmentFixture(); expect(sentenced.d.id).toBe(f.d.id);
  sentenced.d.custodyCase = copy(f.job()); sentenced.gate.custodyOffice = copy(f.office());
  const basis = Commitment.basis(sentenced.gate, sentenced.d);
  const credit = Commitment.credit(sentenced.gate, sentenced.d, basis, Math.max(f.now(), sentenced.commitmentClock()));
  expect(credit.seconds).toBe(f.job().releasedAt - f.job().arrestedAt); expect(credit.receipts).toHaveLength(1);
  expect(credit.seconds).toBeLessThan(f.job().personReturnedAt - f.job().arrestedAt);
});
test('unobserved reactions are not invented witness statements and missing witnesses defeat execution', () => {
  const f = threatFixture(); f.until('execution'); f.office().officers[1].locationId = 'elsewhere';
  f.person.threatPreferences.reaction = 'retract'; f.step();
  expect(f.job().encounter.updates).toEqual([]); expect(f.job().arrestedAt).toBeUndefined();
});
test('a free person already at the desk is not kept unavailable by the officers blocked return road', () => {
  const f = threatFixture('argue'); f.until('authorization'); f.person.provisions = 0;
  f.buyer.buyerService.premises.route.open = false;
  f.until('releaseReturn'); f.step();
  expect(f.person.assignment).toBeNull(); expect(f.person.locationId).toBe('b'); expect(f.person.custody).toBeUndefined();
  expect(f.office().officers.every(x => x.locationId === f.buyer.buyerService.premises.id)).toBe(true);
});
