const { test, expect } = require('@playwright/test');
const Trial = require('../city-trial');
const Pretrial = require('../city-pretrial');
const Gate = require('../gate-enforcement');
const Laws = require('../strategic-city-laws');
function fixture(sanctions = ['fine', 'supervision', 'finitePrison']) {
  const e = Gate.create(), actor = (id, institutionId) => ({ id, name: id, institutionId, health: 100, status: 'alive' });
  const officials = { judge: actor('judge-a', 'judiciary-a'), prosecutor: actor('prosecutor-a', 'prosecution-a'), public: actor('public-a', 'defense-a'), retained: actor('retained-a', 'defense-a') };
  const ban = { orderId: 'original-flight', cityId: 'a', personId: 'scientist', status: 'active' };
  Gate.warn(e, { orderId: ban.orderId, personId: 'scientist', officerId: 'guard-a', observed: true, identified: true }, 0);
  const c = Gate.observe(e, { crossed: true, observed: true, identified: true, knowing: true, prohibited: true, observerId: 'guard-a', observerCell: { x: 12, y: 7, z: 16 }, cell: { x: 14, y: 7, z: 16 }, cityId: 'a', personId: 'scientist', crossingId: 'cross-1', restriction: ban, permits: { annexAuthorized: false },
    localLaw: { id: 'law-a', typeId: 'warrantObstruction', definition: Laws.OFFENSE_CATALOG.find(d => d.id === 'warrantObstruction'), rule: { id: 'law-a', offenseId: 'warrantObstruction', legalStatus: 'prohibited', sentencing: { ordinarySanctions: sanctions, finitePrisonRangeMonths: { minimum: 3, maximum: 12 } } } } }, 10);
  Gate.authorize(c, officials.judge, { channel: true, sourceIdentityMatches: true, validAtCrossing: true }, 310);
  const s = c.pretrial = Pretrial.open(c, { judiciaryId: 'judiciary-a', prosecutionId: 'prosecution-a', releaseRule: 'riskBased' }, officials, 400);
  const pf = { ...officials, channel: true, sourcePersonId: 'scientist', present: true, counselReady: true, balance: 1000 };
  Pretrial.screen(s, c, pf, 1300); Pretrial.disclose(s, 1400); Pretrial.counsel(s, 'self', 1500); Pretrial.request(s, c, 'securedBail', 'notGuilty', 1600); Pretrial.begin(s, pf, 1700); Pretrial.decide(s, c, pf, 2600); Pretrial.bail(s, 1000, 2700); Pretrial.released(s, 2800, { mode: 'foot' });
  const t = Trial.open(c, 3000), facts = { channel: true, localAccess: true, routeAvailable: true, officialsAvailable: true, counselAvailable: true, witnessAvailable: true, clerkId: 'clerk-a', route: { from: { x: 10, y: 7, z: 16 }, to: { x: 24, y: 12, z: 16 }, mode: 'foot' }, present: true, judgeId: 'judge-a', prosecutorId: 'prosecutor-a', witnessId: 'guard-a', sourcePersonId: 'scientist', balance: 1000, localCustodySeconds: 1200 };
  return { e, c, s, t, facts, ban };
}
function start(f) { expect(Trial.serve(f.t, f.facts, 3100)).toBe(true); expect(Trial.attend(f.t, f.facts, 10300)).toBe(true); expect(Trial.begin(f.t, f.facts, 10320)).toBe(true); }
function verdict(f) { start(f); Trial.advance(f.t, f.c, f.facts, 10920); expect(f.t.phase).toBe('defenseReady'); Trial.defense(f.t, 11000); Trial.advance(f.t, f.c, f.facts, 11600); Trial.advance(f.t, f.c, f.facts, 12500); }
test('local trial uses the published lawful-order elements, not warrant-only guesses or pretrial guilt', () => {
  const f = fixture(), before = JSON.stringify(f.ban); expect(f.t.judgment).toBeNull(); expect(f.t.packet).not.toBe(f.s.handoff.evidencePacket);
  verdict(f); expect(f.t.judgment.verdict).toBe('guilty'); expect(f.t.findings.map(e => e.id)).toEqual(['identity', 'obstructiveAct', 'lawfulProcess', 'knowledge']);
  expect(f.t.findings.every(e => e.proven && e.standard === 'beyondReasonableDoubt')).toBe(true); expect(JSON.stringify(f.ban)).toBe(before); expect(f.t.sentence).toBeNull();
  expect(JSON.parse(JSON.stringify(f.t))).toEqual(f.t);
});
test('each missing element acquits despite an arrest, filed charge, or challenge selection', () => {
  for (const change of [f => f.t.packet.evidence.identified = false, f => f.t.packet.evidence.observerCell.z = 17, f => f.t.packet.evidence.restriction.status = 'inactive', f => f.t.packet.evidence.notice.at = 50, f => f.t.packet.evidence.permits.annexAuthorized = true]) {
    const f = fixture(); change(f); Trial.challenge(f.t, 'observation', 3050); verdict(f);
    expect(f.t.judgment.verdict).toBe('notGuilty'); expect(f.c.status).toBe('resolved'); expect(f.ban.status).toBe('active'); expect(Trial.refund(f.t)).toBe(50); expect(Trial.refund(f.t)).toBe(0);
  }
  const valid = fixture(); for (const kind of Object.keys(Trial.CHALLENGES)) Trial.challenge(valid.t, kind, 3050); verdict(valid); expect(valid.t.judgment.verdict).toBe('guilty');
  expect(valid.s.legal.proceedings[0].charges.map(c => c.typeId)).toEqual(['warrantObstruction']);
});
test('actual access, preparation time and a served window are necessary; absence adjourns without forfeiture', () => {
  for (const key of ['localAccess', 'routeAvailable', 'officialsAvailable', 'counselAvailable', 'witnessAvailable', 'channel']) { const f = fixture(); expect(Trial.serve(f.t, { ...f.facts, [key]: false }, 3100)).toBe(false); expect(f.t.notice).toBeNull(); }
  const f = fixture(); Trial.serve(f.t, f.facts, 3100); expect(Trial.attend(f.t, f.facts, 10299)).toBe(false);
  expect(f.t.permit.generalAdmission).toBe(false); Trial.tick(f.t, { ...f.facts, localAccess: false }, 10300); expect(f.t.phase).toBe('adjourned'); expect(f.s.legal.proceedings[0].release.escrowStatus).toBe('held'); expect(f.s.legal.proceedings[0].fugitive.active).toBe(false);
  expect(Trial.serve(f.t, f.facts, 12000)).toBe(true); expect(f.t.notices).toHaveLength(2); Trial.tick(f.t, f.facts, 22801); expect(f.t.phase).toBe('adjourned'); expect(f.t.judgment).toBeNull();
});
test('physical hearing pauses without powered records or its identified participants and never creates free work', () => {
  const f = fixture(); Trial.serve(f.t, f.facts, 3100); Trial.attend(f.t, f.facts, 10300);
  expect(Trial.begin(f.t, { ...f.facts, present: false }, 10320)).toBe(false); expect(Trial.begin(f.t, { ...f.facts, witnessId: 'other' }, 10320)).toBe(false); Trial.begin(f.t, f.facts, 10320);
  Trial.advance(f.t, f.c, { ...f.facts, channel: false }, 20000); expect(f.t.phase).toBe('prosecution'); expect(f.t.stageSeconds).toBe(0);
  Trial.advance(f.t, f.c, f.facts, 20001); expect(f.t.stageSeconds).toBe(0); Trial.advance(f.t, f.c, f.facts, 20601); expect(f.t.phase).toBe('defenseReady');
  Trial.defense(f.t, 20700); Trial.advance(f.t, f.c, { ...f.facts, channel: false }, 20760); Trial.advance(f.t, f.c, { ...f.facts, channel: false }, 22560);
  expect(f.t.phase).toBe('adjourned'); expect(f.t.adjournments[0].reason).toContain('thirty minutes'); expect(f.t.judgment).toBeNull();
});
test('supported local fines are distinct from refunded bail, proportionate and paid only once', () => {
  const f = fixture(); verdict(f); Trial.requestSentence(f.t, 'proportionateFine', 12600); Trial.advance(f.t, f.c, f.facts, 13200);
  expect(f.t.sentence).toMatchObject({ kind: 'fine', amount: 50, paid: 0, status: 'due' }); expect(Trial.refund(f.t)).toBe(50); expect(Trial.refund(f.t)).toBe(0);
  expect(Trial.payFine(f.t, 20, 14000)).toBe(20); expect(f.t.sentence.status).toBe('due'); expect(Trial.payFine(f.t, 1000, 14001)).toBe(30); expect(Trial.payFine(f.t, 1000, 14002)).toBe(0);
  expect(f.c.status).toBe('resolved'); expect(f.c.custodyOrder.status).toBe('withdrawn'); expect(f.s.legal.proceedings[0].release.conditions.every(c => c.status === 'lifted')).toBe(true);
  const poor = fixture(); verdict(poor); poor.facts.balance = 0; Trial.requestSentence(poor.t, 'proportionateFine', 12600); Trial.advance(poor.t, poor.c, poor.facts, 13200); expect(poor.t.sentence.amount).toBe(0); expect(poor.t.sentence.status).toBe('completed');
});
test('supervision expires; a custodial-only law produces a finite separate transfer handoff, not old-prison transport', () => {
  const f = fixture(); verdict(f); Trial.requestSentence(f.t, 'supervision', 12600); Trial.advance(f.t, f.c, f.facts, 13200); expect(f.t.sentence.kind).toBe('supervision'); Trial.tick(f.t, f.facts, 99600); expect(f.t.sentence.status).toBe('completed');
  const prisoner = fixture(['finitePrison']); verdict(prisoner); Trial.requestSentence(prisoner.t, 'proportionateFine', 12600); Trial.advance(prisoner.t, prisoner.c, prisoner.facts, 13200);
  expect(prisoner.t.phase).toBe('sentenceHandoff'); expect(prisoner.t.sentence).toMatchObject({ months: 3, executionStartedAt: null, custodyCreditSeconds: 1200, cityId: 'a' }); expect(prisoner.c.custodyOrder.status).toBe('withdrawn');
});
test('prosecutor can dismiss unsupported attribution before trial without touching historical bans', () => {
  const f = fixture(); expect(Trial.dismiss(f.t, f.c, f.facts, 3100)).toBe(false); expect(Trial.dismiss(f.t, f.c, { ...f.facts, sourcePersonId: 'other' }, 3200)).toBe(true);
  expect(f.t.judgment.verdict).toBe('dismissed'); expect(f.c.status).toBe('resolved'); expect(f.ban.status).toBe('active'); expect(Trial.refund(f.t)).toBe(50); expect(Trial.dismiss(f.t, f.c, f.facts, 3300)).toBe(false);
  const corrected = fixture(); corrected.c.status = 'dismissedIdentityError'; expect(Trial.applyIdentityCorrection(corrected.t, corrected.c, 3200)).toBe(true); expect(corrected.c.status).toBe('resolved'); expect(Trial.refund(corrected.t)).toBe(50);
});
