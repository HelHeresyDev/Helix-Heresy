const { test, expect } = require('@playwright/test');
const Relief = require('../banishment-relief');
const authority = { id: 'sovereign-a', name: 'Aster Council', charterId: 'charter-a', cityId: 'a', role: 'sovereign', status: 'available' };
const reviewer = { id: 'judge-a', institutionId: 'judiciary-a', health: 100, status: 'alive' };
const officials = { authority, reviewer, channel: true };
const service = id => ({ id, needId: `actual-need:${id}`, cityId: 'a', personId: 'scientist', witnessId: 'clerk-a', verified: true });
const facts = () => ({ cityId: 'a', personId: 'scientist', orderId: 'completed-flight', localOrderId: null, authorityId: authority.id, sourcePersonId: 'scientist', identityVerified: true, sourceAvailable: true, restrictionApplies: true,
  medical: null, services: [service('delivery-1')], sponsor: null, longStanding: false, fullReviewCapacity: true, pendingLocalCase: false });
function offered(kind = 'temporary', f = facts()) {
  const s = Relief.create(authority), p = Relief.request(s, kind, f, 0);
  Relief.advance(p, f, officials, 900); Relief.advance(p, f, officials, 2700);
  return { s, p, f };
}
test('relief requires timed judicial verification and the receiving city sovereign, not guards or cash', () => {
  const f = facts(), s = Relief.create(authority), p = Relief.request(s, 'temporary', f, 0);
  expect(Relief.advance(p, f, officials, 899)).toBe(false);
  for (const change of [{ channel: false }, { authority: { ...authority, role: 'guard' } }, { authority: { ...authority, cityId: 'foreign' } }, { authority: { ...authority, status: 'unavailable' } }, { reviewer: { ...reviewer, health: 0 } }]) expect(Relief.advance(p, f, { ...officials, ...change }, 900)).toBe(false);
  expect(p.status).toBe('verifying'); expect(Relief.advance(p, f, officials, 900)).toBe(true); expect(p.verifiedBy).toBe(reviewer.id);
  expect(Relief.advance(p, f, officials, 2699)).toBe(false); Relief.advance(p, f, officials, 2700); expect(p.status).toBe('offered'); expect(p.grant).toBeNull();
  expect(Relief.evaluate('permanent', { ...f, services: [], cash: 1e9 }).kind).toBe('refused');
  expect(Relief.evaluate('temporary', { ...f, sourceAvailable: false }).kind).toBe('missingEvidence');
  expect(Relief.evaluate('temporary', { ...f, sourcePersonId: 'someone-else' }).kind).toBe('applicabilityReview');
});
test('permanent relief requires sustained supported grounds and remains local to the exact order', () => {
  const f = { ...facts(), longStanding: true, services: [service('one'), service('two')], sponsor: { id: 'endorsement', cityId: 'a', personId: 'scientist', serviceId: 'two', verified: true } };
  const { s, p } = offered('permanent', f); expect(p.result.reliefKind).toBe('permanent');
  expect(Relief.accept(p, f, authority, 2800)).toBe(true);
  expect(Relief.grantFor(s, 'a', 'scientist', f.orderId, null, 1e9, true).kind).toBe('permanent');
  for (const args of [['foreign', 'scientist', f.orderId, null], ['a', 'companion', f.orderId, null], ['a', 'scientist', 'new-order', null], ['a', 'scientist', f.orderId, 'new-local-order']]) expect(Relief.grantFor(s, ...args, 3000)).toBeNull();
  for (const change of [{ pendingLocalCase: true }, { longStanding: false }, { sponsor: null }, { fullReviewCapacity: false }, { services: [service('one'), { ...service('two'), needId: 'actual-need:one' }] }]) expect(Relief.evaluate('permanent', { ...f, ...change }).kind).toBe('counteroffer');
  expect(Relief.tick(s, 1e9)).toEqual([]); expect(JSON.parse(JSON.stringify(s))).toEqual(s);
});
test('temporary offers require acceptance, warn once and expire prospectively without new accusations', () => {
  const { s, p, f } = offered('permanent'); expect(p.result.kind).toBe('counteroffer');
  expect(Relief.grantFor(s, 'a', 'scientist', f.orderId, null, 2750)).toBeNull();
  expect(Relief.accept(p, f, authority, 2800)).toBe(true); expect(p.grant.expiresAt).toBe(10000);
  expect(Relief.tick(s, 9099)).toHaveLength(0); expect(Relief.tick(s, 9100)).toHaveLength(1); expect(Relief.tick(s, 9101)).toHaveLength(0);
  expect(Relief.grantFor(s, 'a', 'scientist', f.orderId, null, 9999)).not.toBeNull();
  expect(Relief.grantFor(s, 'a', 'scientist', f.orderId, null, 10000)).toBeNull();
  expect(Relief.tick(s, 10000)[0].reason).toContain('no automatic arrest'); expect(p.status).toBe('expired');
  expect(Relief.request(s, 'permanent', f, 10001)).toBeNull(); expect(s).not.toHaveProperty('cases');
});
test('changed evidence is reverified; withdrawn support cannot be accepted through a stale offer', () => {
  const f = facts(), s = Relief.create(authority), p = Relief.request(s, 'temporary', f, 0);
  Relief.advance(p, f, officials, 900); const changed = { ...f, services: [] };
  expect(Relief.advance(p, changed, officials, 2700)).toBe(true); expect(p.status).toBe('verifying'); expect(p.nextAt).toBe(3600);
  Relief.advance(p, changed, officials, 3600); Relief.advance(p, changed, officials, 5400); expect(p.result.kind).toBe('refused');
  expect(Relief.request(s, 'temporary', changed, 6000)).toBeNull(); expect(Relief.request(s, 'temporary', f, 6000)).not.toBeNull();
  const offer = offered(); expect(Relief.accept(offer.p, changed, authority, 2800)).toBe(false); expect(offer.p.grant).toBeNull();
  expect(Relief.decline(offer.p, 2800)).toBe(true); expect(offer.p.status).toBe('declined');
  const expired = offered(); Relief.tick(expired.s, expired.p.nextAt); expect(expired.p.status).toBe('offerExpired'); expect(Relief.accept(expired.p, f, authority, 1e6)).toBe(false);
});
test('verified medical need supports limited relief even in separate custody, not a pardon', () => {
  const f = { ...facts(), services: [], pendingLocalCase: true, medical: { id: 'assessment', personId: 'scientist', issuerId: 'doctor', needed: true, verified: true } };
  expect(Relief.evaluate('temporary', f).purpose).toBe('Limited sheltered recovery');
  expect(Relief.evaluate('permanent', f).kind).toBe('counteroffer');
  expect(Relief.evaluate('temporary', { ...f, medical: { ...f.medical, verified: false } }).kind).toBe('refused');
});
test('relief of one recognition order cannot bypass another active local order or a foreign city', () => {
  const f = { ...facts(), localOrderId: 'local-one' }, { s, p } = offered('temporary', f);
  Relief.accept(p, f, authority, 2800);
  const b = { personId: 'scientist', cityId: 'foreign', orderId: f.orderId, status: 'active', recognizedBy: [{ cityId: 'a', localOrderId: 'local-one', institutionId: 'judge-a', status: 'active' }] };
  expect(Relief.grantForBanishment(s, b, 'a', 3000)).not.toBeNull();
  expect(Relief.grantForBanishment(s, b, 'foreign', 3000)).toBeNull();
  b.recognizedBy.push({ cityId: 'a', localOrderId: 'local-two', institutionId: 'judge-a', status: 'active' });
  expect(Relief.grantForBanishment(s, b, 'a', 3000)).toBeNull();
});
