const { test, expect } = require('@playwright/test');
const Gate = require('../gate-enforcement');
const Jail = require('../jail-custody');
const ban = { personId: 'scientist', cityId: 'a', orderId: 'completed-flight', status: 'active', recognizedBy: [] };
const official = { id: 'local-judge', institutionId: 'judiciary-a', health: 100, status: 'alive' };
const facts = () => ({ crossed: true, observed: true, identified: true, knowing: true, prohibited: true, cityId: 'a', personId: 'scientist', crossingId: 'cross-1', localLaw: { id: 'obstruction-a' }, restriction: structuredClone(ban) });
function witnessed(f = facts()) {
  const s = Gate.create(); Gate.warn(s, { observed: true, identified: true, orderId: ban.orderId, personId: 'scientist' }, 0);
  return { s, c: Gate.observe(s, f, 10) };
}
test('gate allegation requires actual witnessed identified notified locally prohibited crossing', () => {
  for (const key of ['crossed', 'observed', 'identified', 'knowing', 'prohibited', 'localLaw', 'restriction']) expect(witnessed({ ...facts(), [key]: false }).c, key).toBeNull();
  expect(Gate.observe(Gate.create(), facts(), 10)).toBeNull();
  const { s, c } = witnessed(); expect(c.status).toBe('referred'); expect(c.custodyOrder).toBeNull(); expect(c.judgment).toBeNull();
  expect(Gate.observe(s, facts(), 11)).toBeNull(); expect(s.cases).toHaveLength(1);
  expect(witnessed({ ...facts(), restriction: { ...ban, status: 'suspended' } }).c).toBeNull();
  expect(witnessed({ ...facts(), restriction: { ...ban, cityId: 'foreign', recognizedBy: ['a'] } }).c).toBeNull();
  expect(Gate.applicable({ ...ban, cityId: 'foreign', recognizedBy: [{ cityId: 'a', localOrderId: 'local', institutionId: 'judge', status: 'active' }] }, 'a')).toBe(true);
});
test('gate custody needs delayed local judicial authorization, a live official, records and power', () => {
  const { c } = witnessed(), proof = { channel: true, sourceIdentityMatches: true, validAtCrossing: true };
  expect(Gate.authorize(c, official, proof, 309)).toBe(false);
  expect(Gate.authorize(c, official, { ...proof, channel: false }, 310)).toBe(false);
  expect(Gate.authorize(c, { ...official, health: 0 }, proof, 310)).toBe(false);
  expect(c.custodyOrder).toBeNull(); expect(Gate.authorize(c, official, proof, 310)).toBe(true);
  expect(c.custodyOrder.cityId).toBe('a'); expect(c.status).toBe('awaitingService'); expect(c.judgment).toBeNull();
  const bad = witnessed().c; Gate.authorize(bad, official, { ...proof, sourceIdentityMatches: false }, 310);
  expect(bad.status).toBe('unsupported'); expect(bad.custodyOrder).toBeNull(); expect(ban.status).toBe('active');
});
test('applicability review corrects actual errors without pardons or unchanged-fact rerolls', () => {
  const f = { cityId: 'a', personId: 'scientist', identityVerified: true, sourceAvailable: true, wrongIdentity: false, restrictionApplies: true, permitCoversCheckpoint: true, channel: true };
  for (const [change, kind] of [[{}, 'scopeConfirmed'], [{ permitCoversAnnex: true }, 'scopeConfirmed'], [{ wrongIdentity: true }, 'corrected'], [{ restrictionApplies: false }, 'corrected'], [{ sourceAvailable: false }, 'pendingDocumentation'], [{ permitCoversCheckpoint: false }, 'upheld']]) {
    const s = Gate.create(), actual = { ...f, ...change }, r = Gate.requestReview(s, f, 0, official);
    expect(Gate.decideReview(r, actual, 899)).toBe(false); expect(Gate.decideReview(r, { ...actual, channel: false }, 900)).toBe(false);
    expect(Gate.decideReview(r, actual, 900)).toBe(true); expect(r.result.kind).toBe(kind);
    expect(Gate.requestReview(s, actual, 901, official)).toBeNull(); expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  }
});
test('local foot-escort jail state preserves receiving city and never fabricates a lab van journey', () => {
  const s = Jail.normalizeState({ stays: [{ id: 'local-jail', raidId: 'local-case', bookedAt: 100, status: 'active', facility: { id: 'receiving-cell', cityId: 'receiving-city', roomIds: ['receiving-cell'] }, transport: { mode: 'foot', departedAt: 80, arrivedAt: 100, crewNames: ['Jon Vale'] }, actors: [{ id: 'jon', name: 'Jon Vale', roomId: 'receiving-cell', mapCell: { x: 28, y: 7, z: 16 } }], history: [{ at: 100, action: 'localBooking', summary: 'On-foot receiving-city escort.' }] }] });
  expect(s.stays[0].facility.cityId).toBe('receiving-city'); expect(s.stays[0].transport.mode).toBe('foot'); expect(s.stays[0].transport.vehicleClass).toBe('none');
  expect(s.stays[0].actors).toHaveLength(1); expect(Jail.normalizeState(JSON.parse(JSON.stringify(s)))).toEqual(s);
});
