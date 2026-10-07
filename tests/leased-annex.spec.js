const { test, expect } = require('@playwright/test');
const Annex = require('../leased-annex');
const route = { ok: true, municipal: true, cityId: 'a', distanceKm: 1 };
const create = () => Annex.create('lease-test', { id: 'a', name: 'Aster' }, route);
function lease(s, now = 0) {
  const wallet = { money: 1000 }, quote = Annex.request(s, route, now);
  expect(Annex.sign(s, route, quote, wallet, now, 'Test tenant').ok).toBe(true);
  return wallet;
}
test('property exists only on supported local routes and names and terms are stable', () => {
  const s = create(); expect(s).toEqual(create());
  expect(s.property.landlord.name).toBeTruthy(); expect(s.property.fixtureIds).toEqual([Annex.BENCH]);
  for (const theme of ['madcap', 'grim', 'unbound']) expect(Annex.create('lease-test', { id: 'a', name: 'Aster' }, route, 0, theme).property.definitionId).toBe('localAssayAnnex');
  for (const change of [{ ok: false }, { municipal: false }, { cityId: '' }, { distanceKm: 6 }])
    expect(Annex.create('seed', { id: 'a' }, { ...route, ...change })).toBeNull();
  const q = Annex.request(s, route, 10);
  expect(q).toMatchObject({ rent: 225, deposit: 150, total: 375, days: 3 });
  expect(q.purpose).toContain('nonliving'); expect(q.privacy).toContain('local law'); expect(q.utilities).toContain('No electricity');
});
test('exact lease agreement is atomic, expired or changed quotes cannot charge, prepaid renewal never duplicates deposit', () => {
  const s = create(), w = { money: 374 }, q = Annex.request(s, route, 0);
  expect(Annex.sign(s, route, q, w, 0, 'Tenant').ok).toBe(false); expect(w.money).toBe(374); expect(s.lease).toBeNull();
  w.money = 1000;
  expect(Annex.sign(s, route, { ...q, total: 0 }, w, 0, 'Tenant').ok).toBe(false);
  expect(Annex.sign(s, route, q, w, 300, 'Tenant').ok).toBe(false);
  expect(Annex.sign(s, { ...route, ok: false }, q, w, 0, 'Tenant').ok).toBe(false);
  expect(Annex.sign(s, route, q, w, 299, 'Tenant').ok).toBe(true); expect(w.money).toBe(625);
  expect(Annex.sign(s, route, q, w, 299, 'Tenant').ok).toBe(false);
  const renewal = Annex.request(s, route, 500);
  expect(renewal.deposit).toBe(0);
  Annex.sign(s, route, renewal, w, 500, 'Tenant');
  expect(s.lease.endsAt).toBe(6 * Annex.DAY); expect(s.lease.depositHeld).toBe(150);
  expect(w.money + s.property.landlord.rentReceived + s.lease.depositHeld).toBe(1000);
});
test('expiry is finite and dated, retains property and observations, with no automatic debt or renewal', () => {
  const s = create(), w = lease(s); s.observation = { at: 1, goods: [{ id: 'real-reagent' }] };
  const before = JSON.stringify(s.property);
  expect(Annex.usable(s, 3 * Annex.DAY - 1)).toBe(true);
  expect(Annex.usable(s, 3 * Annex.DAY)).toBe(false);
  Annex.advance(s, route, 10 * Annex.DAY, { capable: true });
  expect(s.lease.status).toBe('expired'); expect(w.money).toBe(625);
  expect(JSON.stringify(s.property)).toBe(before); expect(s.observation.goods[0].id).toBe('real-reagent');
  expect(s.history.at(-1).at).toBe(3 * Annex.DAY);
  const q = Annex.request(s, route, 10 * Annex.DAY);
  Annex.sign(s, route, q, w, 10 * Annex.DAY, 'Tenant');
  expect(s.lease.endsAt).toBe(13 * Annex.DAY); expect(s.lease.depositHeld).toBe(150);
});
test('walking preserves exact progress across holds, incapacity, pause, reversal and serialization', () => {
  let s = create(); lease(s);
  expect(Annex.startTrip(s, route, 'outbound', 0, { capable: true, busy: false }).ok).toBe(true);
  const ctx = { capable: true, speedKph: 3.6 };
  Annex.advance(s, route, 500, ctx); expect(s.trip.positionKm).toBe(.5);
  Annex.advance(s, { ...route, ok: false }, 1000, ctx); expect(s.trip.positionKm).toBe(.5);
  expect(s.trip.reason).toContain('interrupted');
  Annex.advance(s, route, 1500, { ...ctx, capable: false }); expect(s.trip.positionKm).toBe(.5);
  Annex.control(s, 'pause', 1500); Annex.advance(s, route, 2000, ctx); expect(s.trip.positionKm).toBe(.5);
  s = Annex.normalize(JSON.parse(JSON.stringify(s))); Annex.control(s, 'resume', 2000); Annex.control(s, 'turn', 2000);
  Annex.advance(s, route, 2499, ctx); expect(s.trip).toBeTruthy();
  expect(Annex.advance(s, route, 2500, ctx).destination).toBe('home'); expect(s.trip).toBeNull();
  expect(Annex.startTrip(s, route, 'outbound', 3000, { capable: false }).ok).toBe(false);
});
test('handback requires personal empty premises, settles actual bench damage once, retains prepaid rent and never deletes goods', () => {
  const s = create(), w = lease(s);
  const c = { atProperty: true, empty: false, busy: false, benchCondition: 70 };
  expect(Annex.handBack(s, c, w, 100).ok).toBe(false);
  expect(Annex.handBack(s, { ...c, empty: true, atProperty: false }, w, 100).ok).toBe(false);
  expect(Annex.handBack(s, { ...c, empty: true, busy: true }, w, 100).ok).toBe(false);
  expect(Annex.handBack(s, { ...c, empty: true }, w, 100)).toMatchObject({ ok: true, damage: 45, refund: 105 });
  expect(w.money + s.property.landlord.rentReceived + s.property.landlord.damageReceived).toBe(1000);
  expect(Annex.handBack(s, { ...c, empty: true }, w, 101).ok).toBe(false);
  expect(Annex.request(s, route, 102).ok).toBe(false);
});
test('irreversible death freezes lease and journey without deleting preserved assets', () => {
  const s = create(); lease(s); Annex.startTrip(s, route, 'outbound', 0, { capable: true });
  const before = JSON.stringify(s);
  expect(Annex.advance(s, route, 4 * Annex.DAY, { dead: true, capable: true, speedKph: 100 })).toEqual({ changed: false });
  expect(JSON.stringify(s)).toBe(before);
});
test('an inaccessible receiving site holds the actual terminal road position instead of teleporting into destroyed or locked premises', () => {
  const s = create(); lease(s); Annex.startTrip(s, route, 'inbound', 0, { capable: true });
  const ctx = { capable: true, speedKph: 3.6, arrivalReasons: { home: 'Physical entrance locked or destroyed.' } };
  expect(Annex.advance(s, route, 2000, ctx).destination).toBeUndefined();
  expect(s.trip).toMatchObject({ positionKm: 0, reason: 'Physical entrance locked or destroyed.' });
  const saved = Annex.normalize(s); Annex.control(saved, 'turn', 2000);
  expect(Annex.advance(saved, route, 3500, { capable: true, speedKph: 3.6 }).destination).toBe('annex');
});
