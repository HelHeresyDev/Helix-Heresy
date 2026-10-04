const { test, expect } = require('@playwright/test');
const { interferenceFixture } = require('./helpers/cargo-interference-fixture');
const Custody = require('../cargo-custody');
const Referrals = require('../cargo-criminal-referrals');
const Appearance = require('../cargo-appearance');
const copy = x => JSON.parse(JSON.stringify(x));
test('known firsthand witness, actual repeated requests, separate review and peaceful custody complete with release', () => {
  const f = interferenceFixture(); f.person.courtPreferences.shareNotices = true;
  f.until('interferenceEncounter'); const j = f.job(), o = f.office(), original = copy(o.encounterAccounts[0]);
  expect(j.interference.account.observation).toEqual(j.attempts.at(-1));
  expect(o.officers.every(x => x.locationId === f.buyer.buyerService.premises.id)).toBe(true);
  const work = o.officers[0].workSeconds;
  f.step(); expect(j.interference.statements).toHaveLength(1); expect(j.submission).toBeUndefined();
  f.until('authorization'); expect(j.submission.statements).toHaveLength(2); expect(o.officers[0].workSeconds).toBe(work - 60);
  expect(Custody.grounds(f.gate, f.d, j, Referrals.findings)).toBe(true);
  expect(JSON.stringify(j.submission)).not.toContain('continuePressing'); expect(f.person.custody).toBeUndefined();
  f.until('execution'); expect(j.order.lawId).toBe(o.interferencePolicy.id); expect(j.order.ground).toBe('witnessInterference');
  expect(j.order.lawId).not.toBe(o.threatPolicy.id); expect(j.order.lawId).not.toBe(o.policy.id);
  expect(j.decisions[0].accountSources).toEqual([original.account.id]);
  f.until('review'); expect(o.jail.stays[0].detaineeId).toBe(f.person.id); expect(j.defendantPacket.report.account).toEqual(original.account);
  f.until('closed'); expect(f.person.custody.active).toBe(false); expect(f.person.locationId).toBe('b');
  expect(o.encounterAccounts[0]).toEqual(original); expect(o.custodyReceipts).toHaveLength(1); expect(f.d.trial).toBeUndefined();
  expect(f.state.jailCustody).toBeUndefined(); expect(f.buyer.buyerService.appearanceNotices.some(n => n.text.includes('Witness-interference'))).toBe(true);
});
test('witness amendments preserve original observations and do not establish guilt on their own', () => {
  const f = interferenceFixture(); f.until('interferenceEncounter'); const o = f.office(), original = copy(o.encounterAccounts[0]);
  o.officers[0].interferencePreferences.response = 'mislead'; f.person.interferencePreferences.continuePressing = false;
  f.until('authorization'); expect(o.accountAmendments).toHaveLength(1); expect(o.accountAmendments[0].originalId).toBe(original.account.id);
  expect(o.encounterAccounts[0]).toEqual(original); expect(f.job().submission.amendment).toEqual(o.accountAmendments[0]);
  f.until('closed'); expect(f.job().order).toBeUndefined(); expect(f.job().decisions[0].status).toBe('insufficientGrounds');
  expect(o.accountAmendments[0].statement).toContain('did not find'); expect(f.d.trial).toBeUndefined();
});
test('correction, disagreement, refusal, silence, and an isolated improper approach do not authorize custody', () => {
  for (const request of ['correct', 'disagree', 'refuse', 'silent', 'falseAccount']) {
    const f = interferenceFixture(request); if (request === 'falseAccount') f.person.interferencePreferences.continuePressing = false;
    f.until('closed'); expect(f.job().order, request).toBeUndefined(); expect(f.person.custody).toBeUndefined();
  }
});
test('witness can independently refuse, report, clarify, disengage or give an amended account', () => {
  for (const response of ['refuse', 'report', 'clarify', 'disengage', 'mislead']) {
    const f = interferenceFixture('suppress'); f.until('interferenceEncounter'); f.office().officers[0].interferencePreferences.response = response;
    f.until('authorization'); expect(f.job().submission.reply.speakerId).toBe(f.office().officers[0].id);
    if (['clarify', 'disengage'].includes(response)) { f.until('closed'); expect(f.job().order).toBeUndefined(); }
    else { f.until('execution'); expect(f.job().order.ground).toBe('witnessInterference'); }
  }
});
test('stopping, explanation or loss of contact ends current risk before execution', () => {
  for (const defect of ['stop', 'explain', 'witness', 'disengage', 'absent', 'barrier']) {
    const f = interferenceFixture(); f.until('execution');
    if (['stop', 'explain'].includes(defect)) f.person.interferencePreferences.reaction = defect;
    if (defect === 'witness') f.office().officers[0].locationId = 'elsewhere';
    if (defect === 'disengage') f.office().officers[0].interferencePreferences.reaction = 'disengage';
    if (defect === 'absent') f.person.locationId = 'elsewhere';
    if (defect === 'barrier') f.buyer.buyerService.premises.encounter.barrier = true;
    f.step(); expect(f.job().arrestedAt, defect).toBeUndefined(); expect(f.job().phase).toBe('releaseReturn');
  }
});
test('original sources, prior policy, exact witness and unchanged copies are required', () => {
  for (const defect of ['account', 'copy', 'withdrawn', 'retrospective', 'judge', 'observation', 'duplicate']) {
    const f = interferenceFixture(); f.until('authorization'); const o = f.office(), j = f.job();
    if (defect === 'account') o.encounterAccounts[0].account.statement = 'Changed';
    if (defect === 'copy') j.submission.statements[0].statement = 'Changed';
    if (defect === 'withdrawn') o.encounterAccounts[0].status = 'withdrawn';
    if (defect === 'retrospective') o.interferencePolicy.publishedAt = f.now();
    if (defect === 'judge') f.gate.cargoCourt.judge.id = j.interference.targetId;
    if (defect === 'observation') j.attempts.at(-1).outcome = 'noVerifiedPerson';
    if (defect === 'duplicate') o.witnessRecords.push(copy(o.witnessRecords[0]));
    f.until('closed'); expect(j.order, defect).toBeUndefined(); expect(j.decisions[0].status).toBe('insufficientGrounds');
  }
});
test('expired encounters and interrupted observation cannot manufacture current risk', () => {
  const f = interferenceFixture(); f.until('authorization'); f.gate.cargoCourt.channelPowered = false;
  f.step(301); expect(f.job().phase).toBe('releaseReturn'); expect(f.job().order).toBeUndefined();
  const delayed = interferenceFixture(); delayed.until('interferenceEncounter'); delayed.step(121);
  expect(delayed.job().submission.statements).toHaveLength(0); delayed.until('closed'); expect(delayed.job().order).toBeUndefined();
});
test('current identity, distinct law, local authority, safe cell and peaceful surrender remain mandatory', () => {
  for (const defect of ['identity', 'law', 'decision', 'foreign', 'cell', 'surrender']) {
    const f = interferenceFixture(); f.until('execution');
    if (defect === 'identity') f.state.identityOffices[0].records[0].status = 'revoked';
    if (defect === 'law') f.job().order.lawId = f.office().threatPolicy.id;
    if (defect === 'decision') f.job().order.decisionId = 'missing';
    if (defect === 'foreign') f.job().order.cityId = 'foreign';
    if (defect === 'cell') f.office().cell.occupant = 'another-person';
    if (defect === 'surrender') f.person.custodyPreferences.peacefulSurrender = false;
    f.step(); f.step(301); expect(f.job().arrestedAt, defect).toBeUndefined();
  }
});
test('offline deadline and withdrawn evidence release actual custody and retain only served time', () => {
  for (const defect of ['offline', 'source']) {
    const f = interferenceFixture(); f.until('review');
    if (defect === 'offline') { f.office().channelPowered = false; f.step(f.job().releaseBy - f.now() + 1); }
    else { f.office().encounterAccounts[0].status = 'withdrawn'; f.step(); }
    expect(f.person.custody.active).toBe(false); expect(f.person.custody.suppressionActive).toBe(false);
    expect(f.office().cell.locked).toBe(false); expect(f.office().custodyReceipts).toHaveLength(1);
    expect(f.office().custodyReceipts[0].endedAt).toBe(f.job().releasedAt);
  }
});
test('save/load preserves partial speech, original and amended accounts, custody and release', () => {
  const f = interferenceFixture(); f.until('interferenceEncounter'); f.office().officers[0].interferencePreferences.response = 'mislead'; f.step(15);
  const saved = copy(f.state), gate = saved.checkpoints[0];
  for (let n = 0; n < 300; n++) {
    f.step(); Appearance.advance(saved, gate, f.now(), Referrals.findings); Custody.advance(saved, gate, f.now(), Referrals.findings);
  }
  expect(saved).toEqual(f.state); expect(f.job().phase).toBe('closed'); expect(f.office().accountAmendments).toHaveLength(1);
  expect(f.office().jail.stays).toHaveLength(1); expect(f.buyer.buyerService.appearanceNotices).toBeUndefined();
});
test('actual interference custody supplies exact sentence credit without including free return', () => {
  const f = interferenceFixture(); f.until('closed');
  const { commitmentFixture } = require('./helpers/cargo-commitment-fixture');
  const Commitment = require('../cargo-commitment');
  const sentenced = commitmentFixture(); expect(sentenced.d.id).toBe(f.d.id);
  sentenced.d.custodyCase = copy(f.job()); sentenced.gate.custodyOffice = copy(f.office());
  const credit = Commitment.credit(sentenced.gate, sentenced.d, Commitment.basis(sentenced.gate, sentenced.d), Math.max(f.now(), sentenced.commitmentClock()));
  expect(credit.receipts).toHaveLength(1); expect(credit.seconds).toBe(f.job().releasedAt - f.job().arrestedAt);
  expect(credit.seconds).toBeLessThan(f.job().personReturnedAt - f.job().arrestedAt);
});
test('an absent observer supplies no invented retraction and altered amendments fail review', () => {
  const f = interferenceFixture(); f.until('execution'); f.office().officers[1].locationId = 'elsewhere';
  f.person.interferencePreferences.reaction = 'stop'; f.step();
  expect(f.job().interference.updates).toEqual([]); expect(f.job().arrestedAt).toBeUndefined();
  const altered = interferenceFixture(); altered.until('interferenceEncounter');
  altered.office().officers[0].interferencePreferences.response = 'mislead'; altered.until('authorization');
  altered.office().accountAmendments[0].statement = 'Changed'; altered.until('closed'); expect(altered.job().order).toBeUndefined();
});
