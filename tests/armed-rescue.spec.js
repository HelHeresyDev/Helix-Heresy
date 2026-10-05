const { test, expect } = require('@playwright/test');
const Rescue = require('../armed-rescue');
const Negotiation = require('../negotiated-release');
const Robbery = require('../corridor-robbery');
const Assistance = require('../roadside-assistance');
const Market = require('../intercity-smuggling');
const Living = require('../living-smuggling');
const { robberyFixture } = require('./helpers/corridor-robbery-fixture');
function fixture(options = {}) {
  const f = robberyFixture(options);
  Negotiation.bind(f.state, { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, 0);
  f.until('holding'); f.step(2);
  f.team = f.state.armedRescue; f.payer = { money: 3000 };
  f.book = () => {
    const q = Rescue.quote(f.state, f.sh.id, f.route, f.now()); expect(q).toBeTruthy();
    expect(q.report.source).toContain('captor claim');
    expect(Rescue.accept(f.state, f.sh.id, q.id, f.payer, f.route, f.now())).toBe(true); return q;
  };
  return f;
}
test('persistent specialists reserve a paid attempt and refund only before departure', () => {
  const f = fixture(), q = f.book();
  expect(f.team.crew).toHaveLength(3); expect(f.team).not.toBe(f.state.roadsideAssistance);
  expect(f.payer.money).toBe(3000 - q.fee); expect(f.team.money).toBe(800);
  expect(Rescue.cancel(f.state, f.sh.id, f.payer, f.now())).toBe(true); expect(f.payer.money).toBe(3000);
  f.book(); f.step(2); expect(f.team.money).toBe(800 + q.fee);
  expect(Rescue.cancel(f.state, f.sh.id, f.payer, f.now())).toBe(false);
  delete f.state.armedRescue;
  Rescue.provision(f.state, { id: 'broker', homeCityId: 'a', serviceCityIds: ['a'] }, f.now());
  expect(f.state.armedRescue).toBeUndefined();
});
test('local surrender, physical disarming, release and escorted return preserve the original cargo', () => {
  const f = fixture(), manifest = JSON.stringify(f.sh.manifest); f.book();
  f.step(60); expect(f.sh.phase).toBe('captured'); expect(f.sh.rescue.releasedAt).toBeUndefined();
  f.step(3000);
  expect(f.sh.rescue.phase).toBe('complete'); expect(f.sh.phase).toBe('returned');
  expect(f.group.groundWeapons).toHaveLength(3); expect(f.group.members.every(p => p.weapon === null && p.surrendered)).toBe(true);
  expect(f.sh.rescue.shots).toHaveLength(0); expect(f.op.controllerId).toBeUndefined();
  expect(JSON.stringify(f.sh.manifest)).toBe(manifest); expect(f.sh.receiptAt).toBeNull();
  expect(f.sh.saleFailedAt).not.toBeNull(); expect(Market.settle(f.state, f.sh.id, f.now())).toBe(0);
  expect(f.team.assignment).toBeNull(); expect(f.team.fuelKm).toBeLessThan(240);
});
test('walking people leave in the extraction vehicle while a broken van stays at its actual refuge', () => {
  const f = fixture(); f.op.condition = 20; f.book(); f.step(3000);
  expect(f.sh.rescue.phase).toBe('complete'); expect(f.sh.phase).toBe('stranded');
  expect(f.sh.offRoadKm).toBeCloseTo(.5); expect(f.op.condition).toBe(20);
  expect(f.op.crew[0].locationId).toBe('a:extraction-depot');
  expect(f.sh.manifest.entries[0].stack.id).toBe('original-lot');
});
test('incapacitated captives are freed but not magically loaded or healed', () => {
  const f = fixture(); f.op.crew[0].health = 20; f.book(); f.step(3000);
  expect(f.sh.rescue.phase).toBe('complete'); expect(f.sh.rescue.passengers).toHaveLength(0);
  expect(f.sh.phase).toBe('stranded'); expect(f.op.crew[0].health).toBe(20);
  expect(f.op.crew[0].capture.active).toBe(false); expect(f.op.crew[0].locationId).toBeUndefined();
});
test('resistance consumes ammunition and causes physical wounds with an independent withdrawal decision', () => {
  const f = fixture(); f.group.rescueResponse = 'resist';
  f.team.crew[0].health = 55; f.team.crew[0].protection = 0;
  f.book(); f.step(3000);
  expect(f.sh.rescue.shots.length).toBeGreaterThan(0);
  expect(f.team.crew.reduce((n, p) => n + p.weapon.ammunition, 0)).toBeLessThan(36);
  expect(f.team.crew.some(p => p.health < 100 || p.protection < 40)).toBe(true);
  expect(f.sh.rescue.messages.some(m => m.text.includes('withdrawing'))).toBe(true);
  expect(f.team.crew.every(p => p.weapon.ammunition >= 0)).toBe(true);
  expect(f.sh.rescue.releasedAt).toBeUndefined();
});
test('missing observation and changed rendezvous never track the hidden convoy', () => {
  const f = fixture(); f.book(); f.sh.positionKm += 3; f.group.members.forEach(p => { p.positionKm += 3; });
  f.step(3000); expect(f.sh.rescue.phase).toBe('complete'); expect(f.sh.rescue.releasedAt).toBeUndefined();
  expect(f.sh.rescue.messages.some(m => m.text.includes('no accessible convoy'))).toBe(true);
});
test('offline communications suppress new reports without freezing extraction or backfilling on reconnection', () => {
  const f = fixture(); f.book(); f.step(2); const count = f.sh.rescue.messages.length;
  f.team.channelPowered = false; f.step(3000);
  expect(f.sh.rescue.phase).toBe('complete'); expect(f.sh.rescue.messages).toHaveLength(count);
  f.team.channelPowered = true; f.step(); expect(f.sh.rescue.messages).toHaveLength(count);
});
test('save/load and one-second steps preserve physical rescue, payments, equipment and reports', () => {
  const a = fixture(), b = fixture(); a.book(); b.book(); a.step(200);
  const saved = JSON.parse(JSON.stringify(a.state)); a.step(2800);
  Market.advance(saved, a.now(), [a.route]);
  for (let i = 0; i < 3000; i++) b.step();
  expect(saved.shipments[0].rescue).toEqual(a.sh.rescue);
  expect(a.sh.rescue).toEqual(b.sh.rescue); expect(saved.armedRescue).toEqual(a.team);
});
test('living care continues during the operation and the original handler must complete the local handoff', () => {
  const f = fixture({ living: true }), food = f.sh.living.foodLeft; f.book(); f.step(5000);
  expect(f.sh.rescue.phase).toBe('complete'); expect(f.sh.phase).toBe('returnWaiting');
  expect(f.sh.living.foodLeft).toBeLessThan(food); expect(f.sh.receiptAt).toBeNull();
  expect(Living.receive(f.state, f.sh.id, f.now()).id).toBe('specimen');
});
test('recapture requires actual approach and uninterrupted restraint of people still at the van', () => {
  const f = fixture(); f.op.condition = 20;
  f.sh.rescue = { departedAt: f.now() };
  Robbery.release(f.group, f.sh, f.op, f.now(), 'armedRescue');
  f.step(59); expect(f.sh.phase).toBe('stranded');
  f.step(20); expect(f.sh.phase).toBe('stranded');
  f.step(20); expect(f.sh.phase).toBe('captured');
  expect(f.sh.robberyHistory).toHaveLength(1); expect(f.op.crew[0].capture.active).toBe(true);
  const guard = f.group.members.find(p => p.id === f.sh.robbery.guardId); guard.health = 0; guard.status = 'dead';
  f.step(2); expect(f.sh.phase).toBe('stranded');
});
test('disarmed captors and people already elsewhere cannot be recaptured by toggling old flags', () => {
  for (const absent of [false, true]) {
    const f = fixture(); f.op.condition = 20; f.sh.rescue = { departedAt: f.now() };
    Robbery.release(f.group, f.sh, f.op, f.now(), 'armedRescue');
    if (absent) f.op.crew[0].locationId = 'a:extraction-depot';
    else f.group.members.forEach(p => { p.weapon.ammunition = 0; });
    f.step(300); expect(f.sh.phase).toBe('stranded'); expect(f.op.crew[0].capture.active).toBe(false);
  }
});
test('later towing does not teleport previously extracted people back from the depot', () => {
  const f = fixture(); f.op.condition = 20; f.book(); f.step(1400);
  expect(f.sh.rescue.phase).toBe('complete');
  const q = Assistance.quote(f.state, f.sh.id, f.route, { ok: true, cityId: 'a', distanceKm: 8 }, f.now());
  expect(q).toBeTruthy(); expect(Assistance.accept(f.state, f.sh.id, q.id, f.payer, f.route, f.now())).toBe(true);
  f.step(3000); expect(f.sh.phase).toBe('returned'); expect(f.op.crew[0].locationId).toBe('a:extraction-depot');
});
for (const blocker of ['funds', 'ammo', 'crew', 'willingness', 'radio', 'fuel', 'expired']) {
  test('offer confirmation rechecks ' + blocker + ' without charging or replacing assets', () => {
    const f = fixture(), q = Rescue.quote(f.state, f.sh.id, f.route, f.now());
    if (blocker === 'funds') f.payer.money = 0;
    if (blocker === 'ammo') f.team.crew[0].weapon.ammunition = 0;
    if (blocker === 'crew') f.team.crew[0].health = 20;
    if (blocker === 'willingness') f.team.willing = false;
    if (blocker === 'radio') f.team.channelPowered = false;
    if (blocker === 'fuel') f.team.fuelKm = 0;
    const money = f.payer.money;
    expect(Rescue.accept(f.state, f.sh.id, q.id, f.payer, f.route, f.now() + (blocker === 'expired' ? 3600 : 0))).toBe(false);
    expect(f.payer.money).toBe(money); expect(f.team.assignment).toBeNull();
  });
}
test('barriers prevent firing and bodily access rather than granting an automatic victory', () => {
  const f = fixture(); f.book(); f.group.barrier = true; f.step(3000);
  expect(f.sh.rescue.shots).toHaveLength(0); expect(f.sh.rescue.releasedAt).toBeUndefined();
  expect(f.sh.rescue.phase).toBe('complete');
});
test('boarding capacity leaves additional real survivors at the scene', () => {
  const f = fixture(); f.op.condition = 20;
  for (let n = 1; n <= 2; n++) f.op.crew.push({ ...JSON.parse(JSON.stringify(f.op.crew[0])), id: 'extra:' + n });
  f.book(); f.step(3000);
  expect(f.sh.rescue.passengers).toHaveLength(2);
  expect(f.op.crew.filter(p => p.locationId === 'a:extraction-depot')).toHaveLength(2);
  expect(f.op.crew[2].locationId).toBeUndefined(); expect(f.sh.phase).toBe('stranded');
});
test('losing the approach interrupts recapture rather than banking restraint progress', () => {
  const f = fixture(); f.op.condition = 20; f.sh.rescue = { departedAt: f.now() };
  Robbery.release(f.group, f.sh, f.op, f.now(), 'armedRescue');
  f.step(75); expect(f.sh.robbery.recaptureProgress).toBeGreaterThan(0);
  f.group.barrier = true; f.step(2); expect(f.sh.robbery.recaptureProgress).toBe(0);
  f.group.barrier = false; f.step(20); expect(f.sh.phase).toBe('stranded');
  f.step(15); expect(f.sh.phase).toBe('captured');
});
test('fleeing captors can physically return for an incapacitated survivor left behind', () => {
  const f = fixture(); f.group.rescueResponse = 'flee'; f.op.crew[0].health = 20;
  f.book(); f.step(3000);
  expect(f.sh.rescue.phase).toBe('complete'); expect(f.sh.phase).toBe('captured');
  expect(f.sh.robberyHistory.length).toBeGreaterThan(0); expect(f.op.crew[0].health).toBe(20);
});
test('a disabled extraction vehicle does not freeze a nearby firefight', () => {
  const f = fixture(); f.group.rescueResponse = 'resist'; f.book();
  for (let i = 0; i < 1000 && f.sh.rescue.phase !== 'engage'; i++) f.step();
  expect(f.sh.rescue.phase).toBe('engage');
  const shots = f.sh.rescue.shots.length; f.team.condition = 20;
  f.step(60); expect(f.sh.rescue.shots.length).toBeGreaterThan(shots);
  expect(f.sh.rescue.phase).not.toBe('complete');
});
