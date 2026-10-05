const { test, expect } = require('@playwright/test');
const Assistance = require('../roadside-assistance');
const Road = require('../corridor-beasts');
const Market = require('../intercity-smuggling');
const Living = require('../living-smuggling');
const { beastFixture } = require('./helpers/corridor-beast-fixture');
function fixture({ living = false, patient = false, condition = 20 } = {}) {
  const f = beastFixture({ living }); f.state.corridorBeasts = [];
  f.sh.positionKm = 1; f.op.condition = condition;
  Road.report(f.sh, f.op, 0, 'Driver requests assistance at the reported position.');
  if (patient) f.op.crew[0].health = 20;
  f.local = { ok: true, cityId: 'a', distanceKm: 8 };
  f.outfit = f.state.roadsideAssistance; f.payer = { money: 2000 };
  f.quote = () => Assistance.quote(f.state, f.sh.id, f.route, f.local, 0);
  f.book = () => { const q = f.quote(); expect(q).toBeTruthy(); expect(Assistance.accept(f.state, f.sh.id, q.id, f.payer, f.route, 0)).toBe(true); return q; };
  return f;
}
test('persistent assets precede requests; reservation refunds only before departure', () => {
  const f = fixture(), a = f.outfit, q = f.book();
  expect(f.payer.money).toBe(2000 - q.fee); expect(a.money).toBe(600); expect(a.assignment).toBe(f.sh.id);
  expect(Assistance.cancel(f.state, f.sh.id, f.payer, 0)).toBe(true); expect(f.payer.money).toBe(2000);
  expect(Assistance.cancel(f.state, f.sh.id, f.payer, 0)).toBe(false);
  f.book(); f.advance(2); expect(f.sh.assistance.departedAt).toBeDefined(); expect(a.money).toBe(600 + q.fee);
  expect(Assistance.cancel(f.state, f.sh.id, f.payer, 2)).toBe(false);
  delete f.state.roadsideAssistance;
  Assistance.provision(f.state, { id: 'broker', homeCityId: 'a', serviceCityIds: ['a'] }, 3);
  expect(f.state.roadsideAssistance).toBeUndefined();
});
test('disabled original van is physically loaded and towed without replacing cargo or sale', () => {
  const f = fixture(), manifest = JSON.stringify(f.sh.manifest), q = f.book();
  f.advance(200); expect(f.sh.phase).not.toBe('returned'); expect(f.sh.positionKm).toBe(1);
  f.advance(1200);
  expect(f.sh.phase).toBe('returned'); expect(f.sh.assistance.mode).toBe('tow');
  expect(f.sh.custodian).toBe('covert-depot:a'); expect(JSON.stringify(f.sh.manifest)).toBe(manifest);
  expect(f.op.condition).toBe(20); expect(f.sh.receiptAt).toBeNull(); expect(f.sh.saleFailedAt).not.toBeNull();
  expect(f.outfit.assignment).toBeNull(); expect(f.outfit.fuelKm).toBeLessThan(300);
  expect(f.payer.money).toBe(2000 - q.fee); expect(Market.settle(f.state, f.sh.id, 1200)).toBe(0);
});
test('minor repairs and resupply spend carried stocks before original driver escorts home', () => {
  const f = fixture({ condition: 45 }); f.op.fuelKm = 0; f.op.provisions = 0;
  f.book(); f.advance(1500);
  expect(f.sh.phase).toBe('returned'); expect(f.sh.assistance.mode).toBe('escort');
  expect(f.outfit.supplies.repairParts).toBe(5); expect(f.outfit.supplies.fuelKm).toBeLessThan(80);
  expect(f.outfit.supplies.food).toBeLessThan(8); expect(f.op.condition).toBeGreaterThan(50);
});
test('incapacitated patient needs actual loading, transport and available clinic without healing', () => {
  const f = fixture({ patient: true }); f.outfit.clinic.beds = 0; f.book(); f.advance(1200);
  expect(f.sh.assistance.phase).toBe('clinic'); expect(f.op.crew[0].locationId).toBe(f.outfit.vehicleId);
  expect(f.outfit.assignment).toBe(f.sh.id); expect(f.outfit.clinic.patients).toHaveLength(0);
  f.outfit.clinic.beds = 1; f.advance(1300);
  expect(f.sh.phase).toBe('returned'); expect(f.op.crew[0].locationId).toBe(f.outfit.clinic.id);
  expect(f.op.crew[0].health).toBe(20); expect(f.outfit.clinic.patients).toHaveLength(1);
  expect(f.outfit.supplies.medicalPacks).toBe(3); expect(f.outfit.clinic.medicalPacks).toBe(7);
  f.advance(2000); expect(f.outfit.clinic.patients).toHaveLength(1);
});
test('an old reported position is not a hidden-location tracker and unsuccessful dispatch still costs money', () => {
  const f = fixture(); f.book(); f.sh.positionKm = 3; f.advance(1200);
  expect(f.sh.assistance.phase).toBe('complete'); expect(f.sh.assistance.attached).toBeUndefined();
  expect(f.sh.positionKm).toBe(3); expect(f.payer.money).toBeLessThan(2000);
  expect(f.sh.assistance.messages.at(-1).text).toContain('without recovery');
});
for (const missing of ['stretcher', 'tow', 'clinicStaff', 'crew', 'fuel', 'road']) {
  test('missing ' + missing + ' never creates resources or skips physical requirements', () => {
    const f = fixture({ patient: true }); f.book();
    if (missing === 'stretcher') f.outfit.equipment.stretcher = false;
    if (missing === 'tow') f.op.towPointIntact = false;
    if (missing === 'clinicStaff') f.outfit.clinic.attendant.health = 20;
    if (missing === 'crew') f.outfit.crew[0].health = 20;
    if (missing === 'fuel') f.outfit.fuelKm = 0;
    if (missing === 'road') f.route.continuity = 'closed';
    f.advance(1500); expect(f.sh.phase).not.toBe('returned');
    expect(f.op.crew[0].health).toBe(20); expect(f.outfit.clinic.patients).toHaveLength(0);
  });
}
test('captivity at rendezvous cannot be treated as peaceful pickup', () => {
  const f = fixture(); f.book(); f.op.controllerId = 'captor'; f.sh.phase = 'captured';
  f.advance(1200); expect(f.sh.phase).toBe('captured'); expect(f.sh.assistance.phase).toBe('complete');
  expect(f.op.controllerId).toBe('captor');
});
test('offline reports are not fabricated; communication loss does not freeze paid travel', () => {
  const f = fixture(); f.book(); f.advance(2); const count = f.sh.assistance.messages.length;
  f.outfit.channelPowered = false; f.advance(1200);
  expect(f.sh.phase).toBe('returned'); expect(f.sh.assistance.messages).toHaveLength(count);
  f.outfit.channelPowered = true; f.advance(1300); expect(f.sh.assistance.messages).toHaveLength(count);
});
test('save/load and short versus long advances retain money, custody and chronological recovery', () => {
  const a = fixture(), b = fixture(); a.book(); b.book(); a.advance(250);
  const saved = JSON.parse(JSON.stringify(a.state)); Market.advance(saved, 1200, [a.route]); a.advance(1200);
  for (let at = 1; at <= 1200; at++) b.advance(at);
  expect(saved.shipments[0].assistance).toEqual(a.sh.assistance);
  expect(a.sh.assistance).toEqual(b.sh.assistance);
  expect(saved.roadsideAssistance).toEqual(a.outfit);
});
test('living cargo keeps exact pod and finite care, waits for receiving, then helpers return empty', () => {
  const f = fixture({ living: true, patient: true }), food = f.sh.living.foodLeft;
  f.book(); f.advance(3600);
  expect(f.sh.phase).toBe('returnWaiting'); expect(f.sh.assistance.phase).toBe('handoff');
  expect(f.sh.living.foodLeft).toBeLessThan(food); expect(f.outfit.assignment).toBe(f.sh.id);
  expect(f.op.crew[0].locationId).toBe(f.outfit.clinic.id);
  expect(Living.receive(f.state, f.sh.id, 3600).id).toBe('specimen');
  f.advance(6000); expect(f.sh.phase).toBe('returned'); expect(f.outfit.assignment).toBeNull();
  expect(f.sh.receiptAt).toBeNull();
});
test('closed side trail holds helpers at the junction until actual access returns', () => {
  const f = fixture(); f.sh.offRoadKm = .5; f.sh.phase = 'stranded';
  const group = require('../corridor-robbery').createGroup(f.route, 0);
  group.visible = false; group.refuge.trailOpen = false;
  f.state.roadsideGroups = [{ routeId: f.route.id, lengthKm: 30, group }];
  Road.report(f.sh, f.op, 0, 'Driver reports the half-kilometer side trail.');
  f.book(); f.advance(600);
  expect(f.outfit.offRoadKm).toBe(0); expect(f.sh.offRoadKm).toBe(.5);
  group.refuge.trailOpen = true; f.advance(2000);
  expect(f.sh.phase).toBe('returned'); expect(f.sh.offRoadKm).toBeCloseTo(0);
});
test('a nearby armed group causes withdrawal, not a free peaceful-entry permission', () => {
  const f = fixture();
  const group = require('../corridor-robbery').createGroup(f.route, 0);
  group.members.forEach(p => { p.positionKm = .5; }); group.recoveryPassage = false;
  f.state.roadsideGroups = [{ routeId: f.route.id, lengthKm: 30, group }];
  f.book(); f.advance(1000);
  expect(f.sh.assistance.phase).toBe('complete'); expect(f.sh.assistance.attached).toBeUndefined();
  expect(f.sh.assistance.messages.some(m => m.text.includes('nearby threat'))).toBe(true);
  expect(f.sh.positionKm).toBe(1);
});
test('capacity and equipment are rechecked before loading finishes', () => {
  const f = fixture({ patient: true }); f.book(); f.advance(230);
  expect(f.sh.assistance.phase).toBe('service');
  f.outfit.supplies.medicalPacks = 0; f.advance(800);
  expect(f.sh.assistance.phase).toBe('service'); expect(f.op.crew[0].locationId).toBeUndefined();
  expect(f.outfit.supplies.medicalPacks).toBe(0);
});
test('round-trip fuel changes invalidate confirmation without taking player money', () => {
  const f = fixture(), q = f.quote(); f.outfit.fuelKm = 1;
  expect(Assistance.accept(f.state, f.sh.id, q.id, f.payer, f.route, 0)).toBe(false);
  expect(f.payer.money).toBe(2000); expect(f.outfit.assignment).toBeNull();
});
test('clinic patients cannot pilot new trips even if their health is later raised', () => {
  const f = fixture({ patient: true }); f.book(); f.advance(1200);
  f.op.condition = 100; f.op.crew[0].health = 100;
  const quote = Market.offer(f.state, f.op.id, { manifest: f.sh.manifest }, f.route, 1200);
  expect(quote.ok).toBe(false);
});
test('helpers still return when the original convoy has already reached home', () => {
  const f = fixture(); f.book(); f.sh.phase = 'returned'; f.op.assignment = null; f.sh.positionKm = 0;
  f.advance(1200);
  expect(f.sh.assistance.phase).toBe('complete'); expect(f.outfit.assignment).toBeNull();
  expect(f.sh.assistance.messages.at(-1).text).toContain('without recovery');
});
test('insufficient patient or tow capacity does not discard people or replace the vehicle', () => {
  for (const kind of ['patient', 'tow']) {
    const f = fixture({ patient: true });
    if (kind === 'patient') f.outfit.equipment.patientSpaces = 0;
    else f.outfit.equipment.towCapacityKg = 1000;
    f.book(); f.advance(1200);
    expect(f.sh.assistance.phase).toBe('complete'); expect(f.sh.positionKm).toBe(1);
    expect(f.op.crew[0].health).toBe(20); expect(f.op.condition).toBe(20);
  }
});
test('new damage during loading requires reassessment rather than stale major repairs', () => {
  const f = fixture({ condition: 45 }); f.book(); f.advance(230);
  expect(f.sh.assistance.phase).toBe('service');
  f.op.condition = 10; f.advance(1200);
  expect(f.op.condition).toBe(10); expect(f.outfit.supplies.repairParts).toBe(20);
  expect(f.sh.assistance.mode).toBe('tow');
});
test('transported patients remain physically vulnerable in the recovery truck', () => {
  const f = fixture({ patient: true }); f.book(); f.advance(360);
  expect(f.op.crew[0].locationId).toBe(f.outfit.vehicleId);
  f.outfit.crew.forEach(p => { p.status = 'dead'; p.health = 0; });
  Road.equipment(f.outfit).cabinIntegrity = 0;
  const b = Road.createActor('recovery-threat', 'beast:rimefang-pack', 'pack', f.outfit.positionKm, 360);
  b.offsetKm = 0; b.targetId = f.sh.assistance.convoy.id;
  f.state.corridorBeasts = [{ routeId: f.route.id, lengthKm: 30, actors: [b] }];
  f.advance(365);
  expect(f.op.crew[0].health).toBeLessThan(20);
});
