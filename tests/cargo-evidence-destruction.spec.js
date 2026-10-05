const { test, expect } = require('@playwright/test');
const { destructionFixture } = require('./helpers/cargo-destruction-fixture');
const Buyer = require('../buyer-corroboration');
const Custody = require('../cargo-custody');
const Appearance = require('../cargo-appearance');
const Referrals = require('../cargo-criminal-referrals');
const copy = x => JSON.parse(JSON.stringify(x));
test('witnessed knowing ongoing attempt receives separate review, actual peaceful custody and release', () => {
  const f = destructionFixture(); f.person.courtPreferences.shareNotices = true;
  f.until('destructionEncounter'); const original = copy(f.record.document);
  f.until('authorization'); expect(f.job().submission.notice.stackId).toBe('lot');
  expect(JSON.stringify(f.job().submission)).not.toContain('Private formulation');
  expect(Custody.grounds(f.gate, f.d, f.job(), Referrals.findings)).toBe(true);
  f.until('execution'); expect(f.job().order.lawId).toBe(f.office().destructionPolicy.id);
  f.until('review'); expect(f.job().arrestedAt).toBeDefined(); expect(f.record.document).toEqual(original);
  expect(f.terminal.job).toBeNull(); expect(f.job().destruction.outcome).toBe('peacefulSurrender');
  f.until('closed'); expect(f.office().custodyReceipts).toHaveLength(1); expect(f.person.custody.active).toBe(false);
  expect(f.state.jailCustody).toBeUndefined(); expect(f.d.trial).toBeUndefined();
  expect(f.buyer.buyerService.appearanceNotices.some(n => n.text.includes('evidence-destruction'))).toBe(true);
});
test('completed deletion removes only local payload, cannot justify custody, and cannot recreate an original', () => {
  const f = destructionFixture(); f.until('authorization'); f.gate.cargoCourt.channelPowered = false;
  const external = copy(f.sh.buyerDocuments), energy = f.terminal.energySeconds;
  f.step(180); expect(f.record.document).toBeNull(); expect(f.record.status).toBe('deleted');
  expect(f.terminal.energySeconds).toBeLessThan(energy); expect(f.terminal.job).toBeNull();
  expect(f.sh.buyerDocuments).toEqual(external); expect(JSON.stringify(f.record)).not.toContain('Private formulation');
  f.gate.cargoCourt.channelPowered = true; f.until('closed'); expect(f.job().arrestedAt).toBeUndefined();
  Buyer.record(f.buyer, f.sh, 'orderAcknowledged', f.now()); expect(f.buyer.buyerService.records).toHaveLength(1);
  expect(f.record.document).toBeNull();
});
test('deleted contents are unavailable to comparison or prepared requests; original witness retains only limited memory', () => {
  const f = destructionFixture(); const s = f.buyer.buyerService; s.policy = 'cooperate';
  const submission = { id: 'disclosure', document: Buyer.preview(f.sh) }, i = { submissions: [submission] };
  const ctx = Buyer.prepare([f.buyer], i, submission, 'buyerRecords', f.now());
  f.until('authorization'); f.gate.cargoCourt.channelPowered = false; f.step(180); f.until('closed');
  Buyer.complete(i, submission, 'buyerRecords', ctx, f.now()); expect(i.buyerResponses[0].comparisons[0].result).toBe('unavailable');
  const memory = Buyer.prepare([f.buyer], i, submission, 'buyerInterview', f.now());
  Buyer.complete(i, submission, 'buyerInterview', memory, f.now());
  expect(i.buyerResponses[1].recordIds).toEqual([]); expect(i.buyerResponses[1].recollections).toHaveLength(1);
  expect(JSON.stringify(i.buyerResponses[1])).not.toContain('Private formulation');
  expect(Buyer.findings(i, 'b')[1].events[0].memoryOnly).toBe(true);
  s.representatives[0].id = 'replacement'; expect(Buyer.prepare([f.buyer], i, submission, 'buyerInterview', f.now())).toBeNull();
});
test('preservation, correction, abandonment and specifically permitted disposal are not obstruction', () => {
  for (const action of ['preserve', 'correct', 'abandon', 'dispose']) {
    const f = destructionFixture(action);
    if (action === 'dispose') f.terminal.disposalPermissions.push({ ownerId: f.buyer.id, personId: f.person.id, recordId: f.record.document.id, grantedAt: f.now() });
    f.until('closed'); expect(f.job().arrestedAt, action).toBeUndefined(); expect(f.terminal.job).toBeNull();
    expect(f.record.status).toBe(action === 'dispose' ? 'deleted' : 'retained');
    expect(f.terminal.correctionRequests.length).toBe(action === 'correct' ? 1 : 0);
  }
});
test('no custody from hidden actions, absent relevance, silence or unresolved innocent explanation', () => {
  for (const defect of ['hidden', 'relevance', 'acknowledgment', 'explanation']) {
    const f = destructionFixture();
    if (defect === 'hidden') f.terminal.publicDisplay = false;
    if (defect === 'relevance') f.record.document.items[0].stackId = 'other';
    if (defect === 'acknowledgment') f.person.recordPreferences.acknowledgeRelevance = false;
    if (defect === 'explanation') f.person.recordPreferences.explanation = 'This is a duplicate scheduled for routine removal.';
    f.until('closed'); expect(f.job().arrestedAt, defect).toBeUndefined(); expect(f.record.status).toBe('deleted');
    if (defect === 'hidden') { expect(f.job().submission.observations).toEqual([]); expect(f.job().submission.notice).toBeNull(); }
  }
});
test('technical access, actual ownership, finite resources and an existing record are necessary', () => {
  for (const defect of ['record', 'owner', 'permission', 'power', 'work', 'job']) {
    const f = destructionFixture();
    if (defect === 'record') f.person.recordPreferences.recordId = 'invented';
    if (defect === 'owner') f.terminal.ownerId = 'someone-else';
    if (defect === 'permission') f.terminal.permissions = [];
    if (defect === 'power') f.terminal.powered = false;
    if (defect === 'work') f.terminal.workSeconds = 0;
    if (defect === 'job') f.terminal.job = 'other-operation';
    f.until('closed'); expect(f.record.status, defect).toBe('retained'); expect(f.job().arrestedAt).toBeUndefined();
    if (defect === 'job') expect(f.terminal.job).toBe('other-operation');
  }
});
test('stopping, lost access, outage or completed deletion defeats execution without catch-up work', () => {
  for (const defect of ['stop', 'explain', 'permission', 'power', 'hidden', 'completed']) {
    const f = destructionFixture(); f.until('execution');
    if (['stop', 'explain'].includes(defect)) f.person.recordPreferences.reaction = defect;
    if (defect === 'permission') f.terminal.permissions = [];
    if (defect === 'power') f.terminal.powered = false;
    if (defect === 'hidden') f.terminal.publicDisplay = false;
    f.step(defect === 'completed' ? 180 : 30); expect(f.job().arrestedAt, defect).toBeUndefined();
    f.terminal.powered = true; f.until('closed'); expect(f.terminal.job).toBeNull();
    expect(f.record.status).toBe(defect === 'completed' ? 'deleted' : 'retained');
  }
});
test('prospective procedure, independent judge and intact matched reports are required', () => {
  for (const defect of ['policy', 'withdrawn', 'copy', 'duplicate', 'judge']) {
    const f = destructionFixture(); f.until('authorization'); const j = f.job(), o = f.office();
    if (defect === 'policy') o.destructionPolicy.publishedAt = f.now();
    if (defect === 'withdrawn') o.witnessRecords[0].status = 'withdrawn';
    if (defect === 'copy') j.submission.statement = 'invented';
    if (defect === 'duplicate') o.witnessRecords.push(copy(o.witnessRecords[0]));
    if (defect === 'judge') f.gate.cargoCourt.judge.id = j.submission.observerId;
    expect(Custody.grounds(f.gate, f.d, j, Referrals.findings), defect).toBe(false);
    f.until('closed'); expect(j.arrestedAt).toBeUndefined();
  }
});
test('save/load during an operation produces identical custody and source state', () => {
  const f = destructionFixture(); f.until('authorization'); const saved = copy(f.state), gate = saved.checkpoints[0];
  for (let n = 0; n < 200; n++) {
    f.step(); Appearance.advance(saved, gate, f.now(), Referrals.findings); Custody.advance(saved, gate, f.now(), Referrals.findings);
  }
  expect(saved).toEqual(f.state);
});
test('physical six-hour release still operates without power or judicial contact', () => {
  const f = destructionFixture(); f.until('review'); f.gate.cargoCourt.channelPowered = false; f.office().power = 0;
  f.step(21601); expect(f.person.custody.active).toBe(false); expect(f.office().cell.locked).toBe(false);
  expect(f.job().releasedAt).toBe(f.job().releaseBy); expect(f.office().custodyReceipts[0].endedAt).toBe(f.job().releaseBy);
});
test('actual destruction-attempt custody earns only its once-recorded detention interval', () => {
  const f = destructionFixture(); f.until('closed');
  const { commitmentFixture } = require('./helpers/cargo-commitment-fixture');
  const Commitment = require('../cargo-commitment');
  const sentenced = commitmentFixture();
  sentenced.d.custodyCase = copy(f.job()); sentenced.gate.custodyOffice = copy(f.office());
  const credit = Commitment.credit(sentenced.gate, sentenced.d, Commitment.basis(sentenced.gate, sentenced.d), Math.max(f.now(), sentenced.commitmentClock()));
  expect(credit.receipts).toHaveLength(1); expect(credit.seconds).toBe(f.job().releasedAt - f.job().arrestedAt);
  expect(credit.seconds).toBeLessThan(f.job().personReturnedAt - f.job().arrestedAt);
});
