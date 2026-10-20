const { test } = require('node:test');
const assert = require('node:assert/strict');
const Comms = require('../caretaker-communications');
const Resident = require('../resident-caretaker');
const Survival = require('../wilderness-survival');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const f = { s: { actor: { id: 'original', health: 100, status: 'alive', needs: Survival.defaultState(0), money: 40 }, dutySeconds: 28800,
    resident: { id: 'original-residence', actorId: 'original', recognizedBodyEpoch: 0, phase: 'resident', arrivedAt: 0,
      endsAt: 259200, lastAt: 0, earned: 0, restSeconds: 0, deployed: true, service: null, log: [], plan: { home: 0, sleep: 2 } } },
    c: { alive: true, personal: true, authorized: true, willing: true, bodyEpoch: 0, free: true, capable: true, busy: false,
      available: true, network: true, sender: { stackId: 'tx', held: true, powered: true, charge: 14400 },
      receiver: { stackId: 'rx', held: true, powered: true, charge: 14400 } }, now: 0, withdrawals: 0, reports: 0 };
  f.h = { withdraw: at => { f.withdrawals++; return Resident.withdraw(f.s, at, 'Authenticated remote request'); },
    report: at => { f.reports++; return { observedAt: at, phase: f.s.resident.phase, supplies: copy(f.s.resident.communications.observations) }; } };
  assert(Comms.pair(f.s, f.c, 0)); return f;
}
function tick(f, n = 1) { for (let i = 0; i < n; i++) Comms.advance(f.s, f.c, f.h, ++f.now); }
test('personal consent binds original people, agreement, body and two distinct physical devices without money or duty reset', () => {
  const f = fixture(), before = copy(f.s);
  for (const patch of [{ personal: false }, { authorized: false }, { willing: false }, { alive: false }, { bodyEpoch: -1 }, { receiver: { stackId: 'tx', held: true } }])
    assert.equal(Comms.pair(f.s, { ...f.c, ...patch }, 1), false);
  f.s.actor.id = 'replacement'; assert.equal(Comms.pair(f.s, f.c, 1), false); f.s.actor.id = 'original';
  assert.deepEqual(f.s, before); assert.equal(f.s.dutySeconds, 28800); assert.equal(f.s.actor.money, 40);
});
test('request, upload, delivery, handling, reply transmission and receipt are causally distinct once-only events', () => {
  const f = fixture(); const q = Comms.enqueue(f.s, f.c, 'report', 0); assert(q);
  assert.equal(Comms.enqueue(f.s, f.c, 'report', 0), false); assert.equal(Comms.enqueue(f.s, f.c, 'purchase', 0), false);
  const m = f.s.resident.communications.messages[0];
  tick(f); assert.equal(m.sentAt, 1); assert.equal(m.deliveredAt, null);
  tick(f); assert.equal(m.deliveredAt, 2); assert.equal(m.handledAt, null);
  tick(f); assert.equal(m.handledAt, 3); assert.equal(f.reports, 1); assert.equal(m.replySentAt, null);
  tick(f); assert.equal(m.replySentAt, 4); assert.equal(m.receivedAt, null);
  tick(f, 20); assert.equal(m.receivedAt, 5); assert.equal(f.reports, 1); assert.equal(f.s.resident.communications.received.length, 1);
});
test('receiver power loss after upload and sender power loss before the reply reveal no private progress', () => {
  const f = fixture(); Comms.enqueue(f.s, f.c, 'report', 0); tick(f);
  f.c.receiver.powered = false; const before = Comms.publicView(f.s, f.now); tick(f, 20);
  assert.deepEqual(Comms.publicView(f.s, f.now), before); assert.equal(f.reports, 0);
  f.c.receiver.powered = true; tick(f); f.c.sender.powered = false; tick(f, 10);
  assert.equal(f.reports, 1); assert.equal(f.s.resident.communications.received.length, 0);
  assert.equal(Comms.publicView(f.s, f.now).issued[0].status, 'Uploaded; awaiting reply');
  f.c.sender.powered = true; tick(f); assert.equal(f.s.resident.communications.received.length, 1);
});
test('network outage and off-duty or occupied worker delay handling without fake acknowledgments or free work', () => {
  const f = fixture(); f.c.network = false; Comms.enqueue(f.s, f.c, 'report', 0); tick(f, 100);
  assert.equal(f.s.resident.communications.messages[0].sentAt, null);
  f.c.network = true; f.c.available = false; tick(f, 10); assert.equal(f.reports, 0);
  f.c.available = true; tick(f, 3); assert.equal(f.reports, 1); assert.equal(f.s.resident.communications.received.length, 1);
});
test('expired instructions never withdraw; uploaded expiry remains unknown until an actual receiver reply', () => {
  const f = fixture(); Comms.enqueue(f.s, f.c, 'withdraw', 0); tick(f); f.c.receiver.charge = 0;
  f.now = Comms.TTL; tick(f); assert.equal(f.withdrawals, 0);
  assert.match(Comms.publicView(f.s, f.now).issued[0].status, /outcome unknown/);
  f.c.receiver.charge = 10; tick(f, 4); assert.equal(f.withdrawals, 0);
  assert.equal(f.s.resident.communications.received[0].outcome, 'expired');
  const unsent = fixture(); unsent.c.sender.powered = false; Comms.enqueue(unsent.s, unsent.c, 'withdraw', 0);
  unsent.now = Comms.TTL; tick(unsent, 10); assert.equal(unsent.withdrawals, 0);
  assert.match(Comms.publicView(unsent.s, unsent.now).issued[0].status, /before upload/);
});
test('refusal, substituted recipient and changed recognition cannot turn a device into authority', () => {
  for (const change of [f => f.c.willing = false, f => f.s.actor.id = 'substitute', f => f.s.resident.recognizedBodyEpoch = 1]) {
    const f = fixture(); Comms.enqueue(f.s, f.c, 'withdraw', 0); tick(f, 2); change(f); tick(f, 3);
    assert.equal(f.withdrawals, 0); assert.equal(f.s.resident.communications.received[0].outcome, 'refused');
    assert.equal(f.s.resident.communications.received[0].account, null);
  }
  const f = fixture(); f.c.bodyEpoch = 1; assert.equal(Comms.enqueue(f.s, f.c, 'report', 0), false);
  f.c.bodyEpoch = 0; f.c.sender.held = false; assert.equal(Comms.enqueue(f.s, f.c, 'report', 0), false);
});
test('re-pairing revokes outstanding original instructions, preserves dated receipts and never inherits old authorization', () => {
  const f = fixture(); Comms.enqueue(f.s, f.c, 'report', 0); tick(f, 5);
  const receipt = copy(f.s.resident.communications.received[0]); Comms.enqueue(f.s, f.c, 'withdraw', f.now); tick(f);
  const old = f.s.resident.communications.link.id; f.c.receiver.stackId = 'new-receiver';
  assert(Comms.pair(f.s, f.c, f.now)); assert.notEqual(f.s.resident.communications.link.id, old);
  tick(f, 20); assert.equal(f.withdrawals, 0); assert.deepEqual(f.s.resident.communications.received[0], receipt);
});
test('real serialization preserves in-flight phases and old observation dates; reconnection does not create fresh evidence', () => {
  const f = fixture(); f.s.resident.communications.observations.supplies = { observedAt: 0, trailMeal: 2 };
  Comms.enqueue(f.s, f.c, 'report', 0); tick(f, 2); f.s = copy(f.s); tick(f, 3);
  const received = copy(Comms.publicView(f.s, f.now).received); tick(f, 50);
  assert.deepEqual(Comms.publicView(f.s, f.now).received, received);
  assert.equal(received[0].account.supplies.supplies.observedAt, 0);
});
test('irreversible death freezes the complete message lifecycle, including replies', () => {
  const f = fixture(); Comms.enqueue(f.s, f.c, 'withdraw', 0); tick(f, 2); const before = copy(f.s);
  f.c.alive = false; tick(f, 100); assert.deepEqual(f.s, before); assert.equal(f.withdrawals, 0);
});
test('physical battery replacement preserves partial attendance across reload and never credits absence or the first return interval', () => {
  let w = { lastAt: 0, progress: 0, required: 30, attended: false };
  Comms.attendBattery(w, 1, true); Comms.attendBattery(w, 16, true); assert.equal(w.progress, 15);
  w = copy(w); Comms.attendBattery(w, 100, false); assert.equal(w.progress, 15);
  Comms.attendBattery(w, 101, true); assert.equal(w.progress, 15);
  assert(Comms.attendBattery(w, 116, true)); assert.equal(w.progress, 30);
  assert.equal(Comms.attendBattery(w, 115, true), false); assert.equal(w.progress, 30);
});
test('accepted remote withdrawal invokes existing physical return, retains wages and settles only through original rules', () => {
  const f = fixture(); Comms.enqueue(f.s, f.c, 'withdraw', 0); tick(f, 5);
  assert.equal(f.withdrawals, 1); assert.equal(f.s.resident.phase, 'returning'); assert.equal(f.s.resident.settledAt, undefined);
  let position = 2;
  const h = { alive: true, carried: () => ({ id: 'own-stock' }), available: () => true,
    context: () => ({ atHome: position === 0, atSleep: position === 2, sleepUsable: true, sheltered: true, supported: true, fuelUsable: true, fuel: 1, enabled: true }),
    move: () => { position--; return true; } };
  Resident.advance(f.s, 10, h); assert.equal(position, 0); assert.equal(f.s.resident.phase, 'awaitingSettlement');
  assert(f.s.dutySeconds < 28800); assert.equal(f.s.resident.settledAt, undefined); tick(f, 10); assert.equal(f.withdrawals, 1);
});
