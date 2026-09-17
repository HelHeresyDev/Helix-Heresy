const { test, expect } = require('@playwright/test');
const Rescue = require('../city-prison-rescue');
const Escape = require('../city-prison-escape');
const Prison = require('../city-prison');
function fixture() {
  const contact = { id: 'smuggler', name: 'Mara', trust: 70, reliability: 0.9, discoveredAt: 0, unavailableUntil: 0 };
  const provider = Rescue.service(contact, 'a', 'Irena');
  const p = { id: 'prison', phase: 'escapeAttempt', admittedAt: 0, collectedAt: 0, termEndsAt: 200000, lastAt: 0, history: [] };
  const r = Rescue.request(p, contact, provider, { sessionId: 'message-1', monitored: true }, 'a', 0, 0.2);
  return { contact, provider, p, r };
}
const ready = { escaped: true, mobile: true, adjacent: true, busy: false, detected: false, cargoKg: 5, cargoL: 10 };
function dispatch(f) {
  expect(Rescue.accept(f.r, f.provider, f.contact, 'a', 1, 1000)).toBe(true);
  Rescue.tick(f.r, f.provider, 85920); expect(f.r.status).toBe('outbound');
  Rescue.tick(f.r, f.provider, 86400); expect(f.r.status).toBe('waiting');
}
test('local resources, known willing contact, funds and finite reservations gate acceptance', () => {
  const f = fixture();
  expect(Rescue.reason(f.contact, f.provider, 'foreign', 1)).toContain('local');
  expect(Rescue.accept(f.r, f.provider, f.contact, 'a', 1, 749)).toBe(false);
  f.provider.driver.health = 0; expect(Rescue.accept(f.r, f.provider, f.contact, 'a', 1, 1000)).toBe(false);
  f.provider.driver.health = 100; f.provider.vehicle.fuelKm = 7; expect(Rescue.accept(f.r, f.provider, f.contact, 'a', 1, 1000)).toBe(false);
  f.provider.vehicle.fuelKm = 40; expect(Rescue.accept(f.r, f.provider, f.contact, 'a', 1, 1000)).toBe(true);
  expect(Rescue.accept(f.r, f.provider, f.contact, 'a', 2, 1000)).toBe(false);
  expect(f.provider.vehicle.reservedBy).toBe(f.r.id);
});
test('saved refusal and disclosure cannot be rerolled within the same communication', () => {
  const f = fixture(); f.p.rescueRequests = [];
  const r = Rescue.request(f.p, f.contact, f.provider, { sessionId: 'one' }, 'a', 0, 0.98);
  expect(r.status).toBe('refused'); expect(r.disclosed).toBe(true);
  const saved = JSON.parse(JSON.stringify(f.p));
  expect(Rescue.request(saved, f.contact, f.provider, { sessionId: 'one' }, 'a', 1, 0)).toBeNull();
  expect(saved.rescueRequests[0]).toEqual(r);
});
test('walking and cargo restrictions, interruption, saved travel and exact frozen sentence survive extraction', () => {
  const f = fixture(); dispatch(f);
  for (const bad of [{ mobile: false }, { adjacent: false }, { escaped: false }, { detected: true }, { cargoKg: 41 }, { cargoL: 61 }]) expect(Rescue.board(f.r, f.provider, { ...ready, ...bad }, 86400)).toBe(false);
  expect(Rescue.board(f.r, f.provider, ready, 86400)).toBe(true);
  Rescue.tick(f.r, f.provider, 86410, { ...ready, adjacent: false }); expect(f.r.status).toBe('waiting'); expect(f.r.occupied).toBe(false);
  expect(Rescue.board(f.r, f.provider, ready, 86410)).toBe(true);
  Rescue.tick(f.r, f.provider, 86440, ready); expect(f.r.status).toBe('returning');
  expect(f.provider.vehicle.occupants).toEqual([f.provider.driver.id, 'scientist']);
  const s = { ledger: {} }; Escape.escape(f.p, s, 86400, { mobile: true, outside: true, controlled: false });
  const saved = JSON.parse(JSON.stringify({ ...f, s }));
  Rescue.tick(saved.r, saved.provider, 86680, ready); expect(saved.r.distanceTravelledKm).toBe(2);
  Rescue.tick(saved.r, saved.provider, 86920, ready); expect(saved.r.status).toBe('complete');
  expect(saved.provider.vehicle.fuelKm).toBe(32); expect(saved.provider.vehicle.reservedBy).toBeNull();
  expect(saved.provider.vehicle.occupants).toEqual([]); expect(saved.r.occupied).toBe(false);
  Prison.tick(saved.p, saved.s, {}, {}, 300000); expect(saved.s.ledger.remainingSeconds).toBe(113600); expect(saved.p.phase).toBe('escaped');
});
test('expiry or asset failure before launch refunds once and never replenishes equipment', () => {
  for (const released of [true, false]) {
    const f = fixture(); Rescue.accept(f.r, f.provider, f.contact, 'a', 1, 1000);
    if (!released) f.provider.vehicle.condition = 0;
    Rescue.tick(f.r, f.provider, 2, { released }); expect(f.r.status).toBe('cancelled');
    expect(Rescue.refund(f.r)).toBe(750); expect(Rescue.refund(f.r)).toBe(0);
    expect(f.provider.vehicle.fuelKm).toBe(40); expect(f.provider.vehicle.condition).toBe(released ? 100 : 0);
  }
});
test('missed pickup or observed detection withdraws the same driver without refunding launched travel', () => {
  for (const detected of [true, false]) {
    const f = fixture(); dispatch(f); Rescue.tick(f.r, f.provider, detected ? 86401 : f.r.closesAt, { detected });
    expect(f.r.status).toBe('withdrawing'); expect(Rescue.refund(f.r)).toBe(0);
    const saved = JSON.parse(JSON.stringify(f)); Rescue.tick(saved.r, saved.provider, saved.r.lastAt + 480);
    expect(saved.r.status).toBe('withdrawn'); expect(saved.r.occupied).toBe(false);
    expect(saved.provider.driver.id).toBe(f.provider.driver.id); expect(saved.provider.vehicle.fuelKm).toBe(32);
  }
});
test('breakdown retains occupied vehicle and exact road position until the same assets can continue', () => {
  const f = fixture(); dispatch(f); Rescue.board(f.r, f.provider, ready, 86400); Rescue.tick(f.r, f.provider, 86430, ready);
  Rescue.tick(f.r, f.provider, 86550, ready); f.provider.vehicle.condition = 0;
  Rescue.tick(f.r, f.provider, 86650, ready); expect(f.r.status).toBe('stranded'); expect(f.r.distanceTravelledKm).toBe(3); expect(f.r.occupied).toBe(true);
  const fuel = f.provider.vehicle.fuelKm; Rescue.tick(f.r, f.provider, 90000, ready); expect(f.provider.vehicle.fuelKm).toBe(fuel);
  f.provider.vehicle.condition = 100; Rescue.tick(f.r, f.provider, 90001, ready); Rescue.tick(f.r, f.provider, 90361, ready); expect(f.r.status).toBe('complete');
});
test('release after departure returns empty without repeated cancellation or refund', () => {
  const f = fixture(); dispatch(f);
  Rescue.tick(f.r, f.provider, 86401, { released: true }); expect(f.r.status).toBe('withdrawing');
  const notices = f.r.noticeSerial;
  Rescue.tick(f.r, f.provider, 86402, { released: true }); expect(f.r.noticeSerial).toBe(notices);
  Rescue.tick(f.r, f.provider, 86900, { released: true }); expect(f.r.status).toBe('withdrawn'); expect(Rescue.refund(f.r)).toBe(0);
});
test('revoked receiving permission cannot unload a fugitive or conjure another site', () => {
  const f = fixture(); dispatch(f); Rescue.board(f.r, f.provider, ready, 86400); Rescue.tick(f.r, f.provider, 86430, ready);
  f.provider.destination.permission = false; Rescue.tick(f.r, f.provider, 86910, ready);
  expect(f.r.status).toBe('stranded'); expect(f.r.occupied).toBe(true); expect(f.provider.vehicle.reservedBy).toBe(f.r.id);
  Rescue.tick(f.r, f.provider, 88000, ready); expect(f.r.status).toBe('stranded');
  f.provider.destination.permission = true; Rescue.tick(f.r, f.provider, 88001, ready); Rescue.tick(f.r, f.provider, 88002, ready);
  expect(f.r.status).toBe('complete'); expect(f.provider.vehicle.fuelKm).toBe(32);
});
