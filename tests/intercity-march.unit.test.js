const { test } = require('node:test');
const assert = require('node:assert/strict');
const March = require('../intercity-march');
const Walk = require('../overland-expedition');
const Survival = require('../wilderness-survival');
const Passenger = require('../intercity-passenger');
const binding = { worldId: 'world', runId: 'run' }, copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const network = { destinations: [{ id: 'city:b', cityId: 'b', kind: 'fortifiedCity', known: true, label: 'Birch' }],
    routes: [{ id: 'ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2, cellPath: ['a-cell', 'b-cell'] }] };
  const carrier = Passenger.create({ cityId: 'a', assetId: 'original-population', currentPopulation: 100, services: { transport: 'functional' } },
    [{ network: { category: 'transport' }, standing: 'licensed', branch: { id: 'driver-branch', publicName: 'Original Transport', capacityBand: 'functional' } }], 0);
  const s = March.create(binding), wallet = { money: 1000 }, q = Passenger.quote(carrier, network, 'city:b');
  Passenger.book(carrier, q, { kg: 0, l: 0 }, wallet, 0, 1); Passenger.board(carrier, 0, [], 'test');
  return { s, network, carrier };
}
function learned() {
  const f = fixture(); Passenger.advance(f.carrier, f.network, 1800); assert.equal(March.learn(f.s, f.carrier, 1800), true);
  f.plan = March.plans(f.s, f.network, 'a')[0]; return f;
}
function launch(f) { return March.begin(f.s, f.plan, 'reconnoitre', { roomId: 'municipal', cell: { x: 10, y: 10, z: 6 } }, { walk: null, approach: null }, 1800, 1); }
const context = { alive: true, capable: true, atRoad: true, bodyEpoch: 1, routeOpen: true, speedKph: 4,
  weather: { temperatureC: 18, precipitationMm: 0 }, health: 100, playableStops: true,
  arrivalReasons: { ground: 'Exterior staging; no admission' } };
test('a listing, booking or partial occupied journey supplies no learned marching itinerary', () => {
  const f = fixture(), before = copy(f.s);
  assert.deepEqual(March.plans(f.s, f.network, 'a'), []); assert.equal(March.learn(f.s, f.carrier, 0), false);
  Passenger.advance(f.carrier, f.network, 10); assert.equal(March.learn(f.s, f.carrier, 10), false); assert.deepEqual(f.s, before);
});
test('an actual completed passenger journey teaches only that direct corridor, once', () => {
  const f = learned(), before = copy(f.carrier);
  assert.equal(March.learn(f.s, f.carrier, 1800), false); assert.equal(f.s.routes.length, 1);
  assert.equal(f.plan.distanceKm, 2); assert.equal(f.plan.sourceAt, f.carrier.trip.arrivedAt);
  assert.equal(f.plan.groundId, 'city:b:exterior'); assert.match(f.plan.source, /not a released map/);
  assert.deepEqual(f.carrier, before); assert.deepEqual(March.plans(f.s, f.network, 'c'), []);
});
test('missing receipt, future or altered completion does not supply itinerary knowledge', () => {
  for (const change of ['receipt', 'future', 'destination', 'distance']) {
    const f = learned(); f.s.routes = [];
    if (change === 'receipt') f.carrier.receipts = [];
    if (change === 'future') f.carrier.trip.arrivedAt = 9999;
    if (change === 'destination') f.carrier.receipts[0].destination = 'other';
    if (change === 'distance') f.carrier.trip.km = 0;
    assert.equal(March.learn(f.s, f.carrier, 1800), false, change);
  }
});
test('closed, changed, unsupported, unknown and non-neighbor routes do not inherit an old usable plan', () => {
  for (const change of ['closed', 'distance', 'support', 'unknown', 'endpoints']) {
    const f = learned();
    if (change === 'closed') f.network.routes[0].continuity = 'closed';
    if (change === 'distance') f.network.routes[0].distanceKm++;
    if (change === 'support') f.network.routes[0].supportCapable = false;
    if (change === 'unknown') f.network.destinations[0].known = false;
    if (change === 'endpoints') f.network.routes[0].endpointCityIds = ['b', 'c'];
    assert.deepEqual(March.plans(f.s, f.network, 'a'), [], change);
  }
});
test('march uses the measured walking/survival model, never passenger speed or another vehicle', () => {
  const f = learned(), carrier = copy(f.carrier), walk = launch(f);
  assert.equal(March.active(f.s), true); assert.equal(launch(f), null);
  const r = Walk.advance(walk, Survival.defaultState(1800), 2100, context);
  assert.ok(r.state.trip.positionKm > 0 && r.state.trip.positionKm < .34); assert.ok(r.needs.thirst > 0);
  assert.deepEqual(f.carrier, carrier); assert.equal(r.arrived, false);
});
test('exterior endpoint is actual persistent stopped ground, not admission or a political result', () => {
  const f = learned(), r = Walk.advance(launch(f), Survival.defaultState(1800), 5000, context), w = r.state;
  assert.equal(r.arrived, false); assert.equal(w.trip.status, 'stopped'); assert.equal(w.trip.positionKm, 2); assert.deepEqual(w.history, []);
  assert.equal(March.stage(f.s, w, null, 5000), false);
  assert.equal(March.stage(f.s, w, { id: 'staging', routeId: w.route.id, positionKm: 1 }, 5000), false);
  assert.equal(March.stage(f.s, w, { id: 'staging', routeId: w.route.id, positionKm: 2 }, 5000), true);
  const saved = March.normalize(copy(f.s)); assert.equal(saved.operation.stagingSiteId, 'staging');
  assert.equal(March.stage(saved, w, { id: 'staging', routeId: w.route.id, positionKm: 2 }, 6000), true);
  assert.equal(saved.operation.stagedAt, 5000); assert.equal(saved.history.length, 0);
});
test('partial retreat walks the actual distance back, restores local approach, records once', () => {
  const f = learned(), out = Walk.advance(launch(f), Survival.defaultState(1800), 2100, context);
  const back = Walk.control(Walk.control(out.state, 'reverse', 2100), 'resume', 2100);
  const r = Walk.advance(back, out.needs, 4000, context);
  assert.equal(r.arrived, true); assert.ok(Math.abs(r.state.trip.walkedKm - 2 * out.state.trip.positionKm) < 1e-9);
  assert.deepEqual(March.finish(f.s, r.state, 4000), { walk: null, approach: null });
  assert.equal(f.s.history[0].stagedAt, null); assert.equal(March.active(f.s), false);
  assert.equal(March.finish(f.s, r.state, 4000), null); assert.equal(f.s.history.length, 1);
});
test('stopped rest, closure and incapacity preserve position while real needs continue', () => {
  for (const c of [{ routeOpen: false }, { capable: false }]) {
    const f = learned(), walk = launch(f), r = Walk.advance(walk, Survival.defaultState(1800), 1900, { ...context, ...c });
    assert.equal(r.state.trip.positionKm, 0); assert.equal(r.state.trip.status, 'stopped'); assert.ok(r.needs.thirst > 0);
    assert.equal(f.s.history.length, 0);
  }
});
test('JSON reload and elapsed-time chunking preserve walking and survival exactly', () => {
  const f = learned(), w = launch(f), n = Survival.defaultState(1800), whole = Walk.advance(w, n, 2500, context);
  let r = { state: w, needs: n };
  for (let at = 1810; at <= 2500; at += 10) r = Walk.advance(Walk.normalize(copy(r.state)), copy(r.needs), at, context);
  assert.deepEqual(r, whole); assert.deepEqual(March.normalize(copy(f.s)), f.s);
});
test('death freezes movement and a replacement body cannot inherit the expedition', () => {
  const f = learned(), w = launch(f), n = Survival.defaultState(1800);
  assert.deepEqual(Walk.advance(w, n, 1900, { ...context, alive: false }).state, w);
  const changed = Walk.advance(w, n, 1900, { ...context, bodyEpoch: 2 });
  assert.equal(changed.state.trip.status, 'interrupted'); assert.equal(changed.state.trip.positionKm, 0);
  assert.equal(March.stage(f.s, changed.state, { id: 'fake', routeId: w.route.id, positionKm: 2 }, 1900), false);
});
test('copied run import rebinds both active and suspended local walking; fresh worlds inherit nothing', () => {
  const f = learned(); launch(f);
  const local = Walk.begin(null, { ...f.plan, id: 'local-approach', distanceKm: .2, legs: [{ distanceKm: .2, factor: 1 }] }, binding, 'home', 0, 1);
  f.s.operation.prior.walk = Walk.advance(local, Survival.defaultState(), 1000, { ...context, arrivalReasons: {} }).state;
  const to = { worldId: 'copy-world', runId: 'copy-run' }, saved = copy(f.s);
  const rebound = March.rebind(f.s, binding, to);
  assert.equal(rebound.worldId, to.worldId); assert.equal(rebound.operation.walk.runId, to.runId); assert.deepEqual(f.s, saved);
  assert.equal(rebound.operation.prior.walk.runId, to.runId);
  assert.equal(March.rebind(f.s, { ...binding, runId: 'other' }, to), null);
  assert.equal(March.create(to).operation, null); assert.deepEqual(March.create(to).routes, []);
});
test('malformed sources and another run cannot silently replace a saved original expedition', () => {
  const f = learned(); launch(f);
  for (const change of ['binding', 'origin', 'plan', 'prior', 'source']) {
    const bad = copy(f.s);
    if (change === 'binding') bad.operation.walk.runId = 'other-run';
    if (change === 'origin') bad.operation.origin.cell.z = null;
    if (change === 'plan') bad.operation.plan.id = 'other-route';
    if (change === 'prior') bad.operation.prior = null;
    if (change === 'source') bad.routes[0].distanceKm = -1;
    assert.equal(March.normalize(bad), null, change);
  }
});
test('supported body replacement archives the lost march once, preserves its distance and permits a fresh expedition', () => {
  const f = learned(); const w = launch(f);
  f.s.operation.walk = Walk.advance(w, Survival.defaultState(1800), 2100, context).state;
  const distance = f.s.operation.walk.trip.positionKm;
  assert.deepEqual(March.bodyEnded(f.s, 2100), { walk: null, approach: null });
  assert.equal(f.s.operation.phase, 'bodyLost'); assert.equal(f.s.operation.walk.trip.positionKm, distance);
  assert.equal(f.s.operation.walk.trip.status, 'interrupted'); assert.equal(f.s.history[0].returnedAt, null);
  assert.equal(March.active(f.s), false); assert.equal(March.bodyEnded(f.s, 2101), null); assert.equal(f.s.history.length, 1);
  const saved = March.normalize(copy(f.s)); assert.deepEqual(saved, f.s);
  const next = March.begin(saved, f.plan, 'reconnoitre', { roomId: 'municipal', cell: { x: 10, y: 10, z: 6 } },
    { walk: null, approach: null }, 2200, 2);
  assert.equal(next.trip.bodyEpoch, 2); assert.equal(next.trip.positionKm, 0); assert.equal(saved.history.length, 1);
});
