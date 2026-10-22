const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../component-expedition');
const A = require('../city-approach');
const C = require('../castaway-assistance');
const copy = x => JSON.parse(JSON.stringify(x));
function network() {
  return { destinations: ['a', 'b', 'c'].map((id, i) => ({ id: `city:${id}`, cityId: id, kind: 'fortifiedCity', label: id,
    cellId: `cell-${i}`, supportComponentId: id === 'a' ? 'one' : 'two', known: true, jurisdiction: { kind: 'city' } })), routes: [] };
}
function fixture() {
  const state = A.create(), p = C.service({ id: 'contact' }, { id: 'pad' }, 'Original Pilot', 0);
  Object.assign(p, { dutySeconds: 28800, provisionsSeconds: 43200, radioSeconds: 14400 });
  const g = A.gate({ id: 'gate', cityId: 'b', institutionId: 'office', createdAt: 0, capacityBand: 'functional',
    clerk: { id: 'clerk', health: 100, status: 'alive', mapCell: {} }, guard: { id: 'guard', health: 100, status: 'alive', mapCell: {} } });
  g.receptionWorkSeconds = 120;
  const t = A.request(state, g.id, p.id, [{ id: 'scientist' }], 200, 0);
  const c = { worldId: 'w', runId: 'r', bodyEpoch: 0, alive: true, capable: true, free: true, atOrigin: true,
    pilotPresent: true, authorityCurrent: true, sourceCurrent: true, channel: true, emptyDepartureClear: true };
  assert.equal(E.attach(t, g, p, E.source(network(), 'a', 'b'), c, { siteId: 'pad', roomId: 'origin', cell: { x: 1, y: 1, z: 1 } }, 0), true);
  g.receptionAssignment = t.id;
  return { state, t, g, p, c };
}
function offer(f) {
  E.advance(f.t, f.g, f.p, f.c, 120);
  assert.equal(f.t.component.reportProgress, 120);
  assert.equal(E.offer(f.t, f.g, f.p, f.c, 120), true);
  E.releaseReport(f.t, f.g);
}
function land(f) {
  offer(f); assert.equal(A.accept(f.t, f.g, f.p, 5000, 120), true); E.accepted(f.t, 120);
  f.t.departedAt = 450; f.t.boardedIds = ['scientist']; f.p.aircraft.fuelKm -= 200;
  A.stage(f.t, 'checkpoint', 4000, null, 'Physical fixture arrival');
  f.t.component.lastAt = 4000; E.arrived(f.t, 4000); f.p.pilot.location = 'cityCheckpoint';
  f.c.atOrigin = false; f.c.pilotPresent = false; f.c.local = true; f.c.localPilot = true;
}
test('only known genuinely disconnected city sites qualify, even when labels lie', () => {
  const n = network(); assert.ok(E.source(n, 'a', 'b')); assert.equal(E.source(n, 'b', 'c'), null);
  n.destinations[1].known = false; assert.equal(E.source(n, 'a', 'b'), null); n.destinations[1].known = true;
  n.routes.push({ endpointCityIds: ['a', 'c'], supportCapable: true, continuity: 'open' }, { endpointCityIds: ['c', 'b'], supportCapable: true, continuity: 'open' });
  assert.equal(E.source(n, 'a', 'b'), null); n.routes[0].continuity = 'closed'; assert.ok(E.source(n, 'a', 'b'));
});
test('original shared reception work conserves exact finite minutes across coarse and chunked reports', () => {
  const f = fixture(), chunk = copy(f); E.advance(f.t, f.g, f.p, f.c, 120);
  for (let at = 1; at <= 120; at++) E.advance(chunk.t, chunk.g, chunk.p, chunk.c, at);
  assert.equal(f.t.component.reportProgress, 120); assert.equal(f.g.receptionWorkSeconds, 0);
  assert.equal(chunk.p.dutySeconds, f.p.dutySeconds); assert.equal(chunk.g.receptionWorkSeconds, 0);
  assert.equal(E.offer(f.t, f.g, f.p, f.c, 120), true); // Already consumed work is not required twice.
  E.releaseReport(f.t, f.g); assert.equal(f.g.receptionAssignment, null);
});
test('blocked channel/staff cannot mint a report; deadline closes finite request', () => {
  const f = fixture(); f.c.channel = false;
  E.advance(f.t, f.g, f.p, f.c, 120); assert.equal(f.t.component.reportProgress, 0);
  E.advance(f.t, f.g, f.p, f.c, 3600); assert.equal(f.t.status, 'failed'); assert.equal(f.g.receptionAssignment, null);
});
test('actual range, reserve, original reservation, duty, provisions, condition and weather bound offers', () => {
  for (const mutate of [f => { f.p.aircraft.rangeKm = 199; }, f => { f.p.aircraft.fuelKm = 449; },
    f => { f.p.aircraft.reservedBy = 'rescue'; }, f => { f.p.dutySeconds = 5000; }, f => { f.p.provisionsSeconds = 5000; },
    f => { f.p.aircraft.condition = 52; }, f => { f.c.weatherReason = 'storm'; }, f => { f.g.guard.health = 10; },
    f => { f.c.authorityCurrent = false; }]) {
    const f = fixture(); E.advance(f.t, f.g, f.p, f.c, 120); mutate(f);
    assert.equal(E.offer(f.t, f.g, f.p, f.c, 120), false);
  }
});
test('stale complete return allowance cannot be accepted and prelaunch failure refunds once', () => {
  const f = fixture(); offer(f); assert.equal(E.acceptReason(f.t, f.g, f.p, f.c, 120), '');
  f.p.dutySeconds = 7000; assert.match(E.acceptReason(f.t, f.g, f.p, f.c, 120), /allowance/);
  f.p.dutySeconds = 28000; assert.equal(A.accept(f.t, f.g, f.p, 5000, 120), true); E.accepted(f.t, 120);
  const fee = f.t.payment.amount;
  assert.equal(E.advance(f.t, f.g, f.p, f.c, 1920).refund, fee);
  assert.equal(E.advance(f.t, f.g, f.p, f.c, 1921).refund, 0); assert.equal(f.p.aircraft.reservedBy, null);
  assert.ok(f.p.dutySeconds < 28000);
});
test('same original aircraft cannot be booked simultaneously for rescue, or evade finite duty through that consumer', () => {
  const f = fixture(); offer(f); assert.equal(A.accept(f.t, f.g, f.p, 5000, 120), true);
  const contact = { id: 'contact', trust: 60 }, message = { distanceKm: 200 };
  assert.match(C.reason(contact, f.p, 200, 120, message), /reserved/);
  f.p.aircraft.reservedBy = null; f.p.dutySeconds = 1;
  assert.match(C.reason(contact, f.p, 200, 120, message), /duty/);
  assert.equal(C.accept(C.create(), { status: 'offered', offer: { expiresAt: 1000, seats: 2, fee: 10, flightSeconds: 3429 } }, f.p, 120, 'cash', 100, ['scientist']), false);
});
test('boarding delay cannot launch an unsupported promised return, and another body cannot take its reservation', () => {
  const f = fixture(); offer(f); A.accept(f.t, f.g, f.p, 5000, 120); E.accepted(f.t, 120);
  f.p.aircraft.reservedBy = null; assert.match(E.dispatchReason(f.t, f.g, f.p, f.c, 420), /booking/); f.p.aircraft.reservedBy = f.t.id;
  f.p.dutySeconds = 2 * f.t.offer.flightSeconds + f.t.offer.waitSeconds + 119;
  assert.match(E.dispatchReason(f.t, f.g, f.p, f.c, 420), /delay/);
  assert.match(E.returnReason(f.t, f.p, { ...f.c, bodyEpoch: 1 }, 420), /original/);
});
test('return window sends same empty aircraft home without moving scientist or inventing admission', () => {
  const f = fixture(); land(f); const deadline = f.t.component.returnDeadline;
  E.advance(f.t, f.g, f.p, f.c, deadline);
  assert.equal(f.t.status, 'departingEmpty'); assert.equal(f.p.pilot.location, 'cityReturningEmpty');
  assert.equal(f.p.aircraft.fuelKm, 1200); assert.deepEqual(f.t.returningIds, []); assert.deepEqual(f.t.decisions, []);
  assert.match(E.returnReason(f.t, f.p, f.c, deadline), /window/);
});
test('weather or lost original capacity strands living actors without replacement or repeated history', () => {
  const f = fixture(); land(f); f.c.returnWeatherReason = 'storm';
  E.advance(f.t, f.g, f.p, f.c, f.t.component.returnDeadline);
  assert.equal(f.t.status, 'stranded'); const n = f.t.history.length, fuel = f.p.aircraft.fuelKm;
  E.advance(f.t, f.g, f.p, f.c, f.t.component.returnDeadline + 1);
  assert.equal(f.t.history.length, n); assert.equal(f.p.aircraft.fuelKm, fuel); assert.equal(f.c.alive, true);
  f.c.returnWeatherReason = ''; E.advance(f.t, f.g, f.p, f.c, f.t.component.returnDeadline + 2);
  assert.equal(f.t.status, 'departingEmpty');
});
test('body death freezes resources, and lost original identities fail without transporting replacement bodies', () => {
  const f = fixture(); land(f); f.c.alive = false; const before = copy(f);
  E.advance(f.t, f.g, f.p, f.c, 99999); assert.deepEqual(f, before);
  f.c.alive = true; f.p.pilot.id = 'replacement'; E.advance(f.t, f.g, f.p, f.c, 4001);
  assert.equal(f.t.status, 'flightInterrupted'); assert.equal(f.t.payment.refunded, false);
});
test('run rebinding preserves original resources and dated local knowledge hides remote return completion', () => {
  const f = fixture(); land(f); E.receive(f.t, f.c, 4000);
  const saved = copy(f), rebound = E.rebind(saved.t.component, { worldId: 'w', runId: 'r' }, { worldId: 'w', runId: 'imported' });
  assert.equal(rebound.runId, 'imported'); assert.equal(rebound.pilotId, f.p.pilot.id);
  assert.equal(E.rebind(saved.t.component, { worldId: 'wrong', runId: 'r' }, {}), null);
  A.stage(f.t, 'settled', 8000, null, 'Private remote return');
  assert.equal(E.receive(f.t, f.c, 8000), false); assert.deepEqual(E.publicView(f.t), E.publicView(saved.t));
  assert.equal(E.current(f.t, f.g, f.p, { ...f.c, runId: 'new-run' }), false);
  A.stage(f.t, 'flightInterrupted', 8001, null, 'Unseen remote landing storm'); f.c.localPilot = false;
  assert.equal(E.receive(f.t, f.c, 8001), false); assert.deepEqual(E.publicView(f.t), E.publicView(saved.t));
});
