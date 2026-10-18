const { test, expect } = require('@playwright/test');
const Walk = require('../overland-expedition');
const Survival = require('../wilderness-survival');
const Discovery = require('../local-discovery');
const copy = x => JSON.parse(JSON.stringify(x));
const home = { id: 'home', label: 'Laboratory', known: true, cityId: 'a', localDistanceKm: 1, routeContinuity: 'localApproach' };
const ground = { id: 'survey:a', label: 'Known municipal ground', known: true, cityId: 'a', localDistanceKm: 2, routeContinuity: 'municipal' };
const binding = { worldId: 'world', runId: 'run' };
const route = () => Walk.routePlan(home, ground, Discovery.create(ground, 0));
const start = (endpoint = 'home', r = route()) => Walk.begin(null, r, binding, endpoint, 0, 1);
const context = { alive: true, capable: true, atRoad: true, bodyEpoch: 1, routeOpen: true, speedKph: 4, health: 100,
  weather: { temperatureC: 18, precipitationMm: 0 }, carriedRadioIds: [] };
const advance = (s, n, at, c = {}) => Walk.advance(s, n, at, { ...context, ...c });
test('route uses received local directions and actual approach distances, never a city listing or hex-centroid distance', () => {
  const k = Discovery.create(ground, 0), before = copy(k), r = route();
  expect(r.distanceKm).toBe(3); expect(r.legs.map(l => l.factor)).toEqual([1.05, 1]); expect(r.sourceAt).toBe(0); expect(k).toEqual(before);
  expect(Walk.routePlan(home, ground, { ...k, records: k.records.filter(r => r.kind === 'publicRecord') })).toBeNull();
  for (const changed of [{ known: false }, { cityId: 'hidden' }, { routeContinuity: 'none' }, { localDistanceKm: NaN }]) expect(Walk.routePlan({ ...home, ...changed }, ground, k)).toBeNull();
});
test('distance, elapsed walking and body needs are identical through chunking and real JSON save normalization', () => {
  const s = start(), n = Survival.defaultState(0), before = copy(s);
  const whole = advance(s, n, 1800);
  let partial = { state: s, needs: n };
  for (let at = 13; at < 1800; at += 13) partial = advance(Walk.normalize(copy(partial.state)), copy(partial.needs), at);
  partial = advance(partial.state, partial.needs, 1800);
  expect(partial).toEqual(whole); expect(s).toEqual(before); expect(whole.state.trip.walkedKm).toBeCloseTo(whole.state.trip.positionKm, 10);
  expect(whole.needs.exertion).toBeGreaterThan(0); expect(whole.needs.thirst).toBeGreaterThan(0);
});
test('slower loaded/injured pace and poor terrain spend actual extra time, not a fixed arrival timer', () => {
  const s = start(), n = Survival.defaultState(), ordinary = advance(s, n, 600), impaired = advance(s, n, 600, { speedKph: 2 });
  expect(impaired.state.trip.positionKm).toBeLessThan(ordinary.state.trip.positionKm);
  expect(impaired.state.trip.walkingSeconds).toBe(ordinary.state.trip.walkingSeconds);
  const r = route(); r.legs[0].factor = 2;
  expect(advance(start('home', r), n, 600).state.trip.positionKm).toBeLessThan(ordinary.state.trip.positionKm);
});
test('stopping, long saved rest and resuming conserve position without backfill or free shelter', () => {
  const moving = advance(start(), Survival.defaultState(), 600), stopped = Walk.control(moving.state, 'stop', 600);
  const rested = advance(stopped, moving.needs, 1200, { resting: true, busy: true });
  expect(rested.state.trip.positionKm).toBe(moving.state.trip.positionKm); expect(rested.state.trip.walkedKm).toBe(moving.state.trip.walkedKm);
  expect(rested.needs.exertion).toBeLessThan(moving.needs.exertion); expect(rested.needs.thirst).toBeGreaterThan(moving.needs.thirst);
  const resumed = advance(Walk.control(rested.state, 'resume', 1200), rested.needs, 1201);
  expect(resumed.state.trip.positionKm - rested.state.trip.positionKm).toBeLessThan(.002);
  expect(Walk.control(rested.state, 'resume', 1000)).toEqual(rested.state);
});
test('partial reversal walks only the actual travelled distance back and records one physical arrival', () => {
  const out = advance(start(), Survival.defaultState(), 600), reverse = Walk.control(out.state, 'reverse', 600);
  expect(reverse.trip.status).toBe('stopped'); expect(reverse.trip.positionKm).toBe(out.state.trip.positionKm);
  const back = advance(Walk.control(reverse, 'resume', 600), out.needs, 5000);
  expect(back.arrived).toBe(true); expect(back.state.trip.positionKm).toBe(0);
  expect(back.state.trip.walkedKm).toBeCloseTo(out.state.trip.walkedKm * 2, 9);
  expect(back.state.history).toHaveLength(1); expect(back.state.history[0].endpoint).toBe('home');
  expect(advance(back.state, back.needs, 9000).state).toEqual(back.state);
});
test('outbound and physical return preserve route length and both terrain segments without duplicated receipts', () => {
  const out = advance(start(), Survival.defaultState(), 10000); expect(out.arrived).toBe(true);
  expect(out.state.trip.positionKm).toBe(3); expect(out.state.trip.walkedKm).toBeCloseTo(3, 10);
  const back = Walk.begin(out.state, route(), binding, 'ground', out.state.trip.lastAt, 1);
  const returned = advance(back, out.needs, 20000); expect(returned.arrived).toBe(true);
  expect(returned.state.trip.walkedKm).toBeCloseTo(3, 10); expect(returned.state.history.map(h => h.endpoint)).toEqual(['ground', 'home']);
});
test('incapacity, work and actual route closure hold distance while time and needs continue, never teleporting or declaring defeat', () => {
  for (const c of [{ capable: false }, { busy: true }, { routeOpen: false }]) {
    const held = advance(start(), Survival.defaultState(), 600, c);
    expect(held.state.trip.positionKm).toBe(0); expect(held.state.trip.reason).not.toBe(''); expect(held.needs.thirst).toBeGreaterThan(0);
    expect(held.state.trip.status).toBe('walking'); expect(held.arrived).toBe(false);
    const resumed = advance(held.state, held.needs, 601); expect(resumed.state.trip.positionKm).toBeLessThan(.002);
  }
});
test('arrival at an obstructed or unauthorized original endpoint stops there; clearing it does not grant an automatic arrival', () => {
  const r = advance(start(), Survival.defaultState(), 10000, { arrivalReasons: { ground: 'Original gate closed' } });
  expect(r.arrived).toBe(false); expect(r.state.trip).toMatchObject({ status: 'stopped', positionKm: 3, reason: 'Original gate closed' });
  expect(r.state.history).toEqual([]);
  const held = advance(r.state, r.needs, 11000);
  expect(held.arrived).toBe(false); expect(held.state.trip.reason).toBe('Original gate closed');
  const permitted = advance(Walk.control(r.state, 'resume', 11000), r.needs, 11001);
  expect(permitted.arrived).toBe(true); expect(permitted.state.history).toHaveLength(1);
});
test('survival is causal and fatal needs stop progress at the real death point without an abstract expedition outcome', () => {
  const n = Survival.defaultState(); n.thirst = 99;
  const r = advance(start(), n, 10000, { health: 1 });
  expect(r.damage).toBe(1); expect(r.state.trip.status).toBe('stopped'); expect(r.state.trip.positionKm).toBeLessThan(3);
  expect(r.arrived).toBe(false); expect(r.state.trip.lastAt).toBeLessThan(10000);
});
test('death freezes the run; a different body interrupts rather than inheriting the old walk', () => {
  const a = advance(start(), Survival.defaultState(), 30);
  expect(advance(a.state, a.needs, 1000, { alive: false }).state).toEqual(a.state);
  expect(advance(a.state, a.needs, 1000, { bodyEpoch: 2 }).state.trip.status).toBe('interrupted');
  expect(advance(a.state, a.needs, 1000, { atRoad: false }).state.trip.status).toBe('interrupted');
  expect(Walk.control(a.state, 'reverse', 30, false)).toEqual(a.state);
  expect(Walk.begin(a.state, route(), binding, 'home', 30, 1)).toBeNull();
});
test('only validated continued imports rebind their copied route/history; a fresh run has no inherited expedition', () => {
  const a = start(), before = copy(a), to = { worldId: 'copy-world', runId: 'copy-run' };
  expect(Walk.rebind(a, binding, to)).toMatchObject(to); expect(a).toEqual(before);
  expect(Walk.rebind(a, { ...binding, runId: 'other' }, to)).toEqual(a);
  expect(Walk.begin(a, route(), { ...binding, runId: 'other' }, 'home', 0, 1)).toBeNull();
  expect(Walk.begin(null, route(), { ...binding, runId: 'other' }, 'home', 0, 1).history).toEqual([]);
  expect(Walk.normalize({ ...a, secret: 'SECRET' })).toEqual(a); expect(Walk.normalize(null)).toBeNull();
});
