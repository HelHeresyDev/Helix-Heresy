const { test, expect } = require('@playwright/test');
const Court = require('../city-pretrial');
const Gate = require('../gate-enforcement');
function fixture() {
  const e = Gate.create(), official = (id, institutionId) => ({ id, name: id, institutionId, health: 100, status: 'alive' });
  const officials = { judge: official('Judge Vale', 'judiciary'), prosecutor: official('Prosecutor Moss', 'prosecution'), public: official('Advocate Fen', 'defense'), retained: official('Advocate Pine', 'defense') };
  Gate.warn(e, { personId: 'scientist', orderId: 'old-order', officerId: 'guard', observed: true, identified: true }, 0);
  const b = { personId: 'scientist', cityId: 'a', orderId: 'old-order', status: 'active' };
  const c = Gate.observe(e, { crossed: true, observed: true, identified: true, knowing: true, prohibited: true, personId: 'scientist', cityId: 'a', crossingId: 'crossing', observerId: 'guard', observerCell: { x: 12, y: 7, z: 16 }, cell: { x: 14, y: 7, z: 16 }, restriction: b, localLaw: { id: 'law', typeId: 'warrantObstruction' }, permits: { annexAuthorized: false } }, 10);
  Gate.authorize(c, officials.judge, { channel: true, sourceIdentityMatches: true, validAtCrossing: true }, 310);
  const s = Court.open(c, { judiciaryId: 'judiciary', prosecutionId: 'prosecution', releaseRule: 'riskBased' }, officials, 400);
  const facts = { ...officials, channel: true, sourcePersonId: 'scientist', present: true, counselReady: true, balance: 1000 };
  return { e, c, s, b, facts };
}
function prepare(f, kind = 'self') {
  expect(Court.screen(f.s, f.c, f.facts, 1300)).toBe(true);
  expect(Court.disclose(f.s, 1400)).toBe(true); expect(Court.counsel(f.s, kind, 1500)).toBe(true);
}
function hear(f, submission = 'recognizance', statement = 'silent') {
  expect(Court.request(f.s, f.c, submission, statement, 3600)).toBe(true);
  expect(Court.begin(f.s, f.facts, 3610)).toBe(true); expect(Court.decide(f.s, f.c, f.facts, 4510)).toBe(true);
}
test('local screening freezes exact evidence and never imports the completed sentence', () => {
  const f = fixture(), before = JSON.stringify(f.b);
  expect(Court.screen(f.s, f.c, { ...f.facts, prosecutor: { ...f.facts.prosecutor, institutionId: 'other' } }, 1300)).toBe(false);
  expect(Court.screen(f.s, f.c, { ...f.facts, channel: false }, 1300)).toBe(false);
  prepare(f); expect(Court.proceeding(f.s).charges.map(c => c.typeId)).toEqual(['warrantObstruction']);
  expect(Court.proceeding(f.s).timeline.chargingAt).toBe(1300);
  f.c.evidence.cell.x = 99; expect(f.s.packet.evidence.cell.x).toBe(14); expect(JSON.stringify(f.b)).toBe(before);
  expect(JSON.parse(JSON.stringify(f.s))).toEqual(f.s);
});
test('missing notice, historical permission and wrong identity dismiss without lifting banishment', () => {
  for (const change of [f => delete f.c.evidence.notice, f => f.c.evidence.permits.annexAuthorized = true, f => f.facts.sourcePersonId = 'someoneElse']) {
    const f = fixture(); change(f); expect(Court.screen(f.s, f.c, f.facts, 1300)).toBe(true);
    expect(f.s.phase).toBe('dismissed'); expect(Court.closed(f.c)).toBe(true); expect(f.b.status).toBe('active'); expect(f.c.judgment).toBeNull();
  }
  const f = fixture(); f.b.status = 'lifted'; prepare(f); hear(f); expect(f.s.phase).toBe('releaseOrdered');
});
test('silence and contesting the charge produce no false statements, convictions or invented trial dates', () => {
  for (const statement of ['silent', 'notGuilty']) {
    const f = fixture(); prepare(f); hear(f, 'recognizance', statement);
    expect(f.s.handoff.trialAt).toBeNull(); expect(f.s.handoff.statement).toBe(statement); expect(f.c.judgment).toBeNull();
    expect(Court.proceeding(f.s).charges.map(c => c.typeId)).toEqual(['warrantObstruction']); expect(Court.closed(f.c)).toBe(false);
    expect(f.s.permit.admission).toBe(false); expect(f.s.phase).toBe('releaseOrdered');
    Court.released(f.s, 4600, { mode: 'foot', destinationRoomId: 'checkpoint' }); expect(f.s.phase).toBe('handedOff');
    Court.tick(f.s, 999999); expect(Court.proceeding(f.s).fugitive.active).toBe(false);
  }
});
test('public and retained counsel require this case conference and one-time explicit fees', () => {
  for (const kind of ['public', 'retained']) {
    const f = fixture(); prepare(f, kind); expect(Court.requirement(f.s)).not.toBe('');
    if (kind === 'retained') { expect(Court.payCounsel(f.s, 149, 1550)).toBe(0); expect(Court.payCounsel(f.s, 1000, 1600)).toBe(150); expect(Court.payCounsel(f.s, 1000, 1601)).toBe(0); }
    expect(Court.conference(f.s, 3400)).toBe(true); expect(Court.conference(f.s, 3401)).toBe(false); hear(f); expect(f.s.phase).toBe('releaseOrdered');
  }
  const f = fixture(); prepare(f, 'retained'); expect(Court.payCounsel(f.s, 0, 1550)).toBe(0);
  expect(Court.counsel(f.s, 'public', 1600)).toBe(true); expect(Court.conference(f.s, 3400)).toBe(true); hear(f);
  expect(Court.proceeding(f.s).counsel.agreementAmount).toBe(0);
});
test('bail remains refundable escrow; lack of money and cancelled transport are not new crimes', () => {
  const f = fixture(); prepare(f); hear(f, 'securedBail'); expect(f.s.phase).toBe('bailPending');
  expect(Court.bail(f.s, 49, 4600)).toBe(0); expect(Court.bail(f.s, 1000, 4700)).toBe(50); expect(Court.bail(f.s, 1000, 4701)).toBe(0);
  Court.dismiss(f.s, f.c, 'Identity correction', 4800); expect(Court.refund(f.s)).toBe(50); expect(Court.refund(f.s)).toBe(0);
  const poor = fixture(); prepare(poor); poor.facts.balance = 0; hear(poor, 'securedBail'); expect(poor.s.phase).toBe('releaseOrdered');
  const unpaid = fixture(); prepare(unpaid); hear(unpaid, 'securedBail'); Court.tick(unpaid.s, unpaid.s.reviewAt); expect(unpaid.s.phase).toBe('reviewReady'); expect(Court.proceeding(unpaid.s).fugitive.active).toBe(false);
});
test('physical attendance and current evidenced risk govern hearings and repeat custody review', () => {
  const f = fixture(); prepare(f); Court.request(f.s, f.c, 'strictConditions', 'notGuilty', 3600);
  expect(Court.begin(f.s, { ...f.facts, present: false }, 3610)).toBe(false);
  expect(Court.begin(f.s, { ...f.facts, counselReady: false }, 3610)).toBe(false); Court.begin(f.s, f.facts, 3610);
  f.facts.risks = [{ caseId: f.c.id, observerId: 'guard', sourceId: 'actual-threat', at: 4000, kind: 'witnessThreat', reason: 'Observed credible threat against the witness', alternativesReason: 'A narrow access condition would not separate the threatened witness here' }];
  expect(Court.decide(f.s, f.c, { ...f.facts, judge: { ...f.facts.judge, health: 0 } }, 4510)).toBe(false);
  Court.decide(f.s, f.c, f.facts, 4510); expect(f.s.phase).toBe('detained'); expect(f.s.reviewAt).toBe(18910); expect(f.s.reviews[0].riskSources).toHaveLength(1);
  Court.tick(f.s, 18910); expect(Court.request(f.s, f.c, 'recognizance', 'silent', 18920)).toBe(true); Court.begin(f.s, f.facts, 18930); Court.decide(f.s, f.c, f.facts, 19830);
  expect(f.s.phase).toBe('releaseOrdered'); expect(f.s.reviews).toHaveLength(2);
});
