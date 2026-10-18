const { test, expect } = require('@playwright/test');
const Stops = require('../roadside-stops');
const Walk = require('../overland-expedition');
const Survival = require('../wilderness-survival');
const binding = { worldId: 'world', runId: 'run' }, weather = { temperatureC: -8, precipitationMm: 1200 };
const ensure = (s = null, p = .123456789, at = 20, z = 22) => Stops.ensure(s, binding, 'route', p, at, z, weather);
const route = { id: 'route', homeId: 'home', groundId: 'ground', sourceId: 'received', sourceAt: 0,
  legs: [{ distanceKm: 1, factor: 1 }, { distanceKm: 1, factor: 1.25 }], distanceKm: 2 };
const context = { alive: true, capable: true, atRoad: true, bodyEpoch: 1, routeOpen: true, speedKph: 4, health: 100,
  playableStops: true, weather, stopPositions: [.25, .75] };
test('stopping-site identity binds actual route distance, never trip/count/time; saved ground and shelter persist', () => {
  const a = ensure(), baseline = JSON.stringify(a.site.baseline), before = JSON.stringify(a.state);
  a.site.shelter = { stackId: 'original-kit', cell: a.site.entry, deployedAt: 21 };
  const b = ensure(Stops.normalize(JSON.parse(JSON.stringify(a.state))), a.site.positionKm, 2000, 90);
  expect(b.site.id).toBe(a.site.id); expect(b.site.entry.z).toBe(22); expect(JSON.stringify(b.site.baseline)).toBe(baseline);
  expect(b.site.shelter.stackId).toBe('original-kit'); expect(b.site.visits).toBe(2); expect(b.state.sites).toHaveLength(1);
  const c = ensure(b.state, .123556789, 2001, 23);
  expect(c.site.id).not.toBe(a.site.id); expect(c.site.shelter).toBeNull(); expect(c.state.sites).toHaveLength(2);
  expect(JSON.stringify(ensure().state)).toBe(before);
});
test('bounded baseline supplies only deterministic ground, no shelter, goods, reserves or protection', () => {
  const s = ensure().site; expect(s.baseline).toHaveLength(120); expect(s.entry).toEqual({ x: 10, y: 10, z: 22 });
  expect(s.shelter).toBeNull(); expect(s.goods).toBeUndefined(); expect(s.safe).toBeUndefined(); expect(s.reserves).toBeUndefined();
  expect(ensure().site.baseline).toEqual(s.baseline);
  expect(Stops.normalize({ ...ensure().state, hidden: 'SECRET' }).hidden).toBeUndefined();
});
test('normalization rejects missing/duplicate geometry instead of rerolling it and imports rebind only the continued copy', () => {
  const a = ensure().state, before = JSON.stringify(a), to = { worldId: 'copy-world', runId: 'copy-run' };
  expect(Stops.normalize({ ...a, sites: [{ ...a.sites[0], baseline: [] }] }).sites).toEqual([]);
  expect(Stops.normalize({ ...a, sites: [a.sites[0], a.sites[0]] }).sites).toHaveLength(1);
  expect(Stops.rebind(a, binding, to)).toMatchObject(to); expect(JSON.stringify(a)).toBe(before);
  expect(Stops.rebind(a, { ...binding, runId: 'other' }, to)).toEqual(a);
  expect(Stops.ensure(a, { ...binding, runId: 'other' }, 'route', .1, 1, 22, weather)).toBeNull();
  expect(ensure(null).site.shelter).toBeNull(); expect(Stops.normalize(null)).toBeNull();
});
test('walking stops at the exact previously reached site from either direction, without spending the remaining skip', () => {
  for (const endpoint of ['home', 'ground']) {
    const a = Walk.begin(null, route, binding, endpoint, 0, 1);
    const b = Walk.advance(a, Survival.defaultState(), 10000, context);
    expect(b.arrived).toBe(false); expect(b.state.trip.status).toBe('stopped');
    expect(b.state.trip.positionKm).toBe(endpoint === 'home' ? .25 : .75); expect(b.state.trip.lastAt).toBeLessThan(10000);
    const again = Walk.advance(Walk.control(b.state, 'resume', b.state.trip.lastAt), b.needs, 20000, context);
    expect(again.state.trip.positionKm).toBe(endpoint === 'home' ? .75 : .25);
  }
});
test('site interception and survival costs are chunk/save independent', () => {
  const a = Walk.begin(null, route, binding, 'home', 0, 1), n = Survival.defaultState();
  const whole = Walk.advance(a, n, 10000, context);
  let part = { state: a, needs: n };
  for (let at = 11; at <= 10000 && part.state.trip.status === 'walking'; at += 11)
    part = Walk.advance(Walk.normalize(JSON.parse(JSON.stringify(part.state))), part.needs, at, context);
  expect(part.state).toEqual(whole.state); expect(part.needs).toEqual(whole.needs);
});
test('concrete route loss or incapacity stops at the original position; time/needs continue stopped without backfill', () => {
  for (const condition of [{ capable: false }, { routeOpen: false }]) {
    const a = Walk.begin(null, route, binding, 'home', 0, 1);
    const b = Walk.advance(a, Survival.defaultState(), 600, { ...context, ...condition });
    expect(b.state.trip).toMatchObject({ status: 'stopped', positionKm: 0 }); expect(b.state.trip.reason).not.toBe('');
    const held = Walk.advance(b.state, b.needs, 3600, { ...context, ...condition });
    expect(held.state.trip.positionKm).toBe(0); expect(held.state.trip.lastAt).toBe(3600); expect(held.needs.thirst).toBeGreaterThan(b.needs.thirst);
    expect(Walk.advance(held.state, held.needs, 7200, context).state.trip.positionKm).toBe(0);
  }
});
test('original shelter mitigates stopped exposure/rest, never walking; death freezes original state', () => {
  const a = Walk.control(Walk.begin(null, route, binding, 'home', 0, 1), 'stop', 0);
  const n = { ...Survival.defaultState(), exertion: 50 };
  const bare = Walk.advance(a, n, 3600, { ...context, resting: true, busy: true });
  const covered = Walk.advance(a, n, 3600, { ...context, resting: true, busy: true, sheltered: true });
  expect(covered.needs.exposure).toBeLessThan(bare.needs.exposure); expect(covered.needs.exertion).toBeLessThan(bare.needs.exertion);
  const walking = Walk.control(a, 'resume', 0);
  expect(Walk.advance(walking, n, 60, { ...context, sheltered: true })).toEqual(Walk.advance(walking, n, 60, context));
  expect(Walk.advance(a, n, 3600, { ...context, alive: false }).state).toEqual(a);
});
