const { test, expect } = require('@playwright/test');
const N = require('../negotiated-release');
const Market = require('../intercity-smuggling');
const Living = require('../living-smuggling');
const { robberyFixture } = require('./helpers/corridor-robbery-fixture');
function fixture(options) {
  const f = robberyFixture(options);
  N.bind(f.state, { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, 0);
  f.until('holding'); f.step(2);
  expect(f.sh.negotiatedRelease?.offer).toBeTruthy();
  f.payer = { money: 1000 };
  f.act = action => N.act(f.state, f.sh.id, action, f.sh.negotiatedRelease.offer.id, f.payer, f.now());
  return f;
}
test('funded release is separate from actual custody, side-trail travel and depot arrival', () => {
  const f = fixture(), n = f.sh.negotiatedRelease, cargo = JSON.stringify(f.sh.manifest), fuel = f.op.fuelKm;
  expect(f.act('proof')).toBe(true); expect(n.proof.scope).toContain('Not freedom');
  expect(f.act('proof')).toBe(false);
  expect(f.act('accept')).toBe(true);
  expect(f.payer.money).toBe(680); expect(f.group.receivingAccount.balance).toBe(300);
  expect(f.sh.phase).toBe('captured'); expect(n.releasedAt).toBeUndefined();
  expect(f.act('accept')).toBe(false);
  f.step(70);
  expect(n.releasedAt).toBeDefined(); expect(f.sh.phase).toBe('stranded');
  expect(f.op.controllerId).toBeFalsy(); expect(f.sh.offRoadKm).toBeGreaterThan(0);
  f.step(1000);
  expect(f.sh.phase).toBe('returned'); expect(f.sh.custodian).toBe('covert-depot:a');
  expect(f.sh.receiptAt).toBeNull(); expect(f.sh.saleFailedAt).not.toBeNull();
  expect(JSON.stringify(f.sh.manifest)).toBe(cargo); expect(f.op.fuelKm).toBeLessThan(fuel);
  expect(n.arrivalReported).toBe(true); expect(Market.settle(f.state, f.sh.id, f.now())).toBe(0);
});
test('save/load preserves payment, spent resources and delayed release without duplication', () => {
  const f = fixture(); expect(f.act('accept')).toBe(true); f.step(25);
  const saved = JSON.parse(JSON.stringify({ state: f.state, payer: f.payer }));
  const sh = saved.state.shipments[0], op = saved.state.operators.find(o => o.id === sh.operatorId);
  expect(N.act(saved.state, sh.id, 'accept', sh.negotiatedRelease.offer.id, saved.payer, f.now())).toBe(false);
  f.step(1000); Market.advance(saved.state, f.now(), [f.route]);
  expect(sh.phase).toBe(f.sh.phase); expect(op.fuelKm).toBeCloseTo(f.op.fuelKm, 8);
  expect(saved.payer.money).toBe(680); expect(saved.state.paymentProviders[0].voluntaryTransfers).toHaveLength(1);
});
for (const obstacle of ['radio', 'contacts', 'relay', 'provider', 'funds', 'cargo', 'terms', 'deadline']) {
  test('payment refuses changed or unavailable ' + obstacle, () => {
    const f = fixture(), n = f.sh.negotiatedRelease;
    if (obstacle === 'radio') f.safety.radio.connected = false;
    if (obstacle === 'contacts') f.safety.radio.contacts = [];
    if (obstacle === 'relay') f.state.releaseRelays[0].workSeconds = 0;
    if (obstacle === 'provider') f.state.paymentProviders[0].channelPowered = false;
    if (obstacle === 'funds') f.payer.money = 1;
    if (obstacle === 'cargo') f.sh.manifest.entries = [];
    if (obstacle === 'terms') n.offer.amount = 1;
    if (obstacle === 'deadline') f.step(7200);
    const money = f.payer.money;
    expect(f.act('accept')).toBe(false); expect(f.payer.money).toBe(money);
    expect(f.group.receivingAccount.balance).toBe(0);
  });
}
test('no known contact or working communicator means no relayed demand', () => {
  for (const disconnected of [false, true]) {
    const f = robberyFixture();
    if (disconnected) { N.bind(f.state, { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, 0); f.safety.radio.connected = false; }
    f.until('holding'); f.step(100);
    expect(f.sh.negotiatedRelease).toBeUndefined();
  }
});
test('declining neither releases nor charges and cannot be reversed against the same offer', () => {
  const f = fixture(); expect(f.act('decline')).toBe(true); expect(f.act('accept')).toBe(false);
  f.step(100); expect(f.sh.phase).toBe('captured'); expect(f.payer.money).toBe(1000);
});
test('saved refusal to honor a paid demand does not refund or reveal private intent', () => {
  const f = fixture(); f.group.releasePreferences.honor = false;
  expect(f.act('accept')).toBe(true); f.step(400);
  expect(f.sh.phase).toBe('captured'); expect(f.payer.money).toBe(680);
  expect(f.sh.negotiatedRelease.releasedAt).toBeUndefined();
  expect(JSON.stringify(f.sh.negotiatedRelease.messages)).not.toMatch(/betray|honor|refus/);
});
for (const obstacle of ['driver', 'vehicle', 'fuel', 'trail']) {
  test('physical release cannot supply missing return capability: ' + obstacle, () => {
    const f = fixture(); expect(f.act('accept')).toBe(true);
    if (obstacle === 'driver') f.op.crew[0].health = 30;
    if (obstacle === 'vehicle') f.op.condition = 40;
    if (obstacle === 'fuel') f.op.fuelKm = 0;
    if (obstacle === 'trail') f.group.refuge.trailOpen = false;
    f.step(500);
    expect(f.sh.negotiatedRelease.releasedAt).toBeDefined(); expect(f.sh.phase).toBe('stranded');
    expect(f.sh.offRoadKm).toBeCloseTo(.5, 10); expect(f.op.assignment).toBeTruthy();
  });
}
test('proof requires a conscious original captive; offline release never fabricates a message', () => {
  const f = fixture(); f.op.crew[0].health = 20;
  expect(f.act('proof')).toBe(false); f.op.crew[0].health = 100;
  expect(f.act('accept')).toBe(true);
  const count = f.sh.corridorReports.length; f.safety.radio.connected = false;
  f.step(1000); expect(f.sh.phase).toBe('returned'); expect(f.sh.corridorReports).toHaveLength(count);
});
test('living cargo consumes care through captivity and return, with a separate actual handoff', () => {
  const f = fixture({ living: true }), food = f.sh.living.foodLeft;
  expect(f.act('accept')).toBe(true); f.step(2200);
  expect(f.sh.phase).toBe('returnWaiting'); expect(f.sh.living.foodLeft).toBeLessThan(food);
  expect(f.sh.receiptAt).toBeNull(); expect(f.sh.saleFailedAt).not.toBeNull();
  expect(f.sh.manifest.entries.find(e => e.creature).creature.id).toBe('specimen');
  expect(Living.receive(f.state, f.sh.id, f.now()).id).toBe('specimen');
  expect(Living.receive(f.state, f.sh.id, f.now())).toBeNull();
});
test('small steps and a clock jump produce the same dated release and arrival reports', () => {
  for (const living of [false, true]) {
    const a = fixture({ living }), b = fixture({ living });
    expect(a.act('accept')).toBe(true); expect(b.act('accept')).toBe(true);
    a.step(2200); for (let i = 0; i < 2200; i++) b.step();
    expect(a.sh.negotiatedRelease).toEqual(b.sh.negotiatedRelease);
    expect(a.sh.corridorReports).toEqual(b.sh.corridorReports);
    expect(a.sh.phase).toBe(b.sh.phase); expect(a.op.fuelKm).toBeCloseTo(b.op.fuelKm, 8);
  }
});
test('changed custody after payment blocks release without automatic reimbursement', () => {
  const f = fixture(); expect(f.act('accept')).toBe(true);
  f.sh.manifest.entries = []; f.step(100);
  expect(f.sh.phase).toBe('captured'); expect(f.sh.negotiatedRelease.releasedAt).toBeUndefined();
  expect(f.payer.money).toBe(680);
});
test('relay resources are finite, survive rebinding, and are not replenished', () => {
  const f = fixture(), relay = f.state.releaseRelays[0], energy = relay.energy;
  expect(f.act('proof')).toBe(true); expect(relay.energy).toBe(energy - 1);
  relay.energy = 0;
  N.bind(f.state, { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] }, f.now());
  expect(relay.energy).toBe(0); expect(f.act('accept')).toBe(false);
});
