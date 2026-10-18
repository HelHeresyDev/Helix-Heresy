const { test, expect } = require('@playwright/test');
const E = require('../field-evacuation');
const F = require('../field-charter');
const C = require('../municipal-clinic');
const S = require('../wilderness-survival');
const booking = { id: 'original-assignment', escortId: 'original-escort', bodyEpoch: 2, aidPlan: 'accepted', manifest: [] };
const context = { alive: true, original: true, patientAlive: true, helperCapable: true, willing: true, capacity: true, threatened: false,
  injuryId: 'original-wound', supplyId: 'original-bandage', stretcherId: 'brought-stretcher' };
function fixture(patient = 'scientist') {
  const e = E.start(booking, patient, 0), receipts = [], hooks = { adjacent: () => true, approach: () => true,
    stabilize: () => { receipts.push('bandage'); return true; }, atVan: () => true, drag: () => true,
    load: () => { receipts.push('loaded'); return true; }, unload: () => { receipts.push('unloaded'); return true; },
    atReceiving: () => true, handover: () => { receipts.push('clinic'); return true; } };
  return { e, receipts, hooks, c: { ...context } };
}
test('original one-casualty identity, carried loads and purchased stretcher have bounded physical definitions', () => {
  expect(E.start(booking, 'replacement', 0)).toBeNull(); expect(E.start({}, 'scientist', 0)).toBeNull();
  const { e } = fixture(); expect(E.valid(e, booking)).toBe(true);
  expect(E.valid({ ...e, helperId: 'new-driver' }, booking)).toBe(false);
  expect(E.valid(e, { ...booking, bodyEpoch: 3 })).toBe(false);
  expect(E.capacity(80, 20, 30, 7)).toBe(true); expect(E.capacity(150, 20, 30, 7)).toBe(false);
  expect(E.capacity(NaN, 0, 0)).toBe(false);
  expect(S.ITEMS.find(i => i.key === 'foldingStretcher')).toMatchObject({ initial: 0, massKg: 7, price: 140 });
});
test('attended aid consumes one real supply only on completion, no catch-up after threat or changed supply', () => {
  const { e, c, hooks, receipts } = fixture(); E.advance(e, c, hooks, 0); E.advance(e, c, hooks, 1);
  expect(e.work.dueAt).toBe(46); E.advance(e, { ...c, threatened: true }, hooks, 20);
  E.advance(e, c, hooks, 1000); expect(e.work.dueAt).toBe(1045); expect(receipts).toEqual([]);
  E.advance(e, { ...c, supplyId: 'other-bandage' }, hooks, 1045); expect(e.work.dueAt).toBe(1090);
  E.advance(e, { ...c, supplyId: 'other-bandage' }, hooks, 1090); expect(receipts).toEqual(['bandage']);
});
test('missing supplies, missing stretcher, capacity, refusal and obstruction cannot fabricate recovery', () => {
  for (const block of [{ helperCapable: false }, { willing: false }, { capacity: false }, { threatened: true }]) {
    const { e, c, hooks, receipts } = fixture(); E.advance(e, { ...c, ...block }, hooks, 100); expect(receipts).toEqual([]); expect(e.work).toBeNull();
  }
  const { e, c, hooks, receipts } = fixture(); e.phase = 'aid'; E.advance(e, { ...c, supplyId: null }, hooks, 100);
  expect(e.reason).toContain('missing'); expect(receipts).toEqual([]);
  e.phase = 'load'; E.advance(e, { ...c, stretcherId: null }, hooks, 101); expect(e.work).toBeNull();
  e.phase = 'drag'; hooks.atVan = () => false; hooks.drag = () => false; E.advance(e, c, hooks, 102);
  expect(e.reason).toContain('blocked'); expect(receipts).toEqual([]);
});
test('saved partial loading and unloading use original equipment and occupied clinic retains waiting casualty', () => {
  let { e, c, hooks, receipts } = fixture('original-escort'); e.phase = 'load'; E.advance(e, c, hooks, 0);
  e = JSON.parse(JSON.stringify(e)); E.advance(e, c, hooks, 29); expect(receipts).toEqual([]);
  E.advance(e, c, hooks, 30); expect(e.phase).toBe('transport'); expect(e.secured).toBe(true); expect(receipts).toEqual(['loaded']);
  e.phase = 'unload'; E.advance(e, c, hooks, 31); E.advance(e, c, hooks, 61); expect(e.phase).toBe('receiving');
  hooks.handover = () => false; E.advance(e, c, hooks, 62); expect(e.phase).toBe('receiving'); expect(e.reason).toContain('occupied');
  hooks.handover = () => { receipts.push('clinic'); return true; }; E.advance(e, c, hooks, 63); E.advance(e, c, hooks, 1000);
  expect(receipts).toEqual(['loaded', 'unloaded', 'clinic']); expect(e.phase).toBe('handedOver');
});
test('only correctly secured original casualty can bypass return incapacity, never outward movement or driver failure', () => {
  const { e } = fixture(); Object.assign(e, { phase: 'transport', secured: true, stretcherId: 'original' });
  const s = { booking, evacuation: e, phase: 'onsite', boarded: ['scientist', booking.escortId], driver: { status: 'alive', health: 100, fatigue: 0 },
    vehicle: { condition: 100, fuelKm: 100, passengerSeats: 2, cargoKg: 80, cargoL: 160 }, dutySeconds: 100, provisionsSeconds: 100 };
  const c = { alive: true, originalBody: true, capable: false, escortCapable: true, routeOpen: true, helperCapable: true,
    assistedPassengerId: 'scientist', manifest: [] };
  expect(F.launchReason(s, c, 1, true)).toBe(''); expect(F.launchReason(s, c, 1, false)).not.toBe('');
  s.boarded = ['scientist']; expect(F.launchReason(s, c, 1, true)).not.toBe(''); s.boarded.push(booking.escortId);
  expect(F.launchReason(s, { ...c, helperCapable: false }, 1, true)).not.toBe('');
  s.driver.health = 5; expect(F.launchReason(s, c, 1, true)).toContain('driver');
  s.driver.health = 100; e.secured = false; expect(F.launchReason(s, c, 1, true)).not.toBe('');
});
test('prepaid clinic care cannot acquire emergency debt or unlimited wallet authority', () => {
  const stay = C.admit(1, 0, false); stay.patientId = 'original-escort'; stay.escrow = E.CARE_BUDGET;
  for (let i = 0; i < 9; i++) expect(C.charge(stay, 20, true)).toBe(0);
  expect(C.charge(stay, 1, true)).toBeNull(); expect(stay.emergencySpent).toBe(0);
  expect(C.close(stay, 'discharged', 100)).toBe(0);
});
test('secured inbound movement retains incapacity and consumes real reserves; helper loss stops at the last position', () => {
  const { e } = fixture(); Object.assign(e, { phase: 'transport', secured: true, stretcherId: 'original' });
  const s = { booking: { ...booking, distanceKm: 1 }, evacuation: e, phase: 'inbound', positionKm: .5, lastAt: 0,
    boarded: ['scientist', booking.escortId], driver: { status: 'alive', health: 100, fatigue: 0 },
    vehicle: { condition: 100, fuelKm: 100, passengerSeats: 2 }, dutySeconds: 100, provisionsSeconds: 100 };
  const c = { alive: true, originalBody: true, capable: false, escortCapable: true, routeOpen: true,
    helperCapable: true, assistedPassengerId: 'scientist' };
  F.advance(s, 2, c); expect(s.phase).toBe('inbound'); expect(s.positionKm).toBeCloseTo(.51);
  expect(s.vehicle.fuelKm).toBeCloseTo(99.99); expect(s.dutySeconds).toBe(98);
  const position = s.positionKm; F.advance(s, 3, { ...c, helperCapable: false });
  expect(s.phase).toBe('stranded'); expect(s.positionKm).toBe(position); expect(s.boarded).toHaveLength(2);
});
test('continued import preserves the copied casualty and escrow only under validated original binding', () => {
  const { e } = fixture();
  const s = { worldId: 'world', runId: 'run', id: 'original-van-allocation', source: { institutionId: 'works' },
    booking: { ...booking, distanceKm: 1, routeId: 'original-route' }, evacuation: e, careEscrow: 180,
    phase: 'onsite', positionKm: .5, lastAt: 0, boarded: [], history: [], driver: { id: 'original-driver' },
    vehicle: { id: 'original-van', condition: 100, fuelKm: 100 }, dutySeconds: 100, provisionsSeconds: 100 };
  const copied = F.rebind(s, { worldId: 'world', runId: 'run' }, { worldId: 'world', runId: 'continued' });
  expect(copied.runId).toBe('continued'); expect(copied.evacuation).toEqual(e); expect(copied.careEscrow).toBe(180);
  expect(s.runId).toBe('run'); expect(F.normalize({ ...s, careEscrow: 181 })).toBeNull();
  expect(F.normalize({ ...s, evacuation: { ...e, helperId: 'replacement' } })).toBeNull();
});
test('death freezes evacuation; lost original people end rather than resurrect or retrieve remains', () => {
  const { e, c, hooks, receipts } = fixture(); const before = JSON.stringify(e);
  E.advance(e, { ...c, alive: false }, hooks, 10000); expect(JSON.stringify(e)).toBe(before);
  E.advance(e, { ...c, patientAlive: false }, hooks, 1); expect(e.phase).toBe('ended'); expect(receipts).toEqual([]);
});
