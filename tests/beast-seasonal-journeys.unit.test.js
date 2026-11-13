const test = require('node:test');
const assert = require('node:assert/strict');
const J = require('../beast-seasonal-journeys'), P = require('../beast-populations'), D = require('../creature-biology');
const clone = x => JSON.parse(JSON.stringify(x)), DAY = J.DAY;
const binding = { worldId: 'world', runId: 'run' }, speciesId = 'beast:gravebloom-elk', profile = D.lifecycle[speciesId];
const approx = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
function fixture(edgeDays = .1) {
  const ids = ['home', 'waypoint', 'away'];
  return { id: 'original-seasonal-source', calendar: { epochAt: 0, monthDays: [2, 3, 2, 3] },
    regions: ids.map((id, i) => ({ id, areaHa: 100,
      stocks: { foodKg: 10000, waterL: 10000, mineralsKg: 10000 },
      capacity: { foodKg: 10000, waterL: 10000, mineralsKg: 10000 }, renewalPerDay: {},
      edges: ids.filter((_, j) => Math.abs(i - j) === 1).map(id => ({ id, distanceKm: profile.travelKmDay * edgeDays, traversable: true })) })),
    groups: [{ id: 'original-herd', speciesId, populationId: 'original-population', regionId: 'home', knowledge: [],
      cohorts: [{ id: 'original-adults', speciesId, count: 1, massKg: profile.adultKg, ageDays: profile.fertileDays }],
      instinct: { mode: 'instinctive', seasonal: { outboundRoute: ids,
        phases: { outboundPhase: 'thaw', residencePhase: 'highSun', returnPhase: 'stormturn', homePhase: 'deepCold' } } } }] };
}
const group = s => s.groups[0];
const replay = (s, until) => J.trace(group(s), s.regions, s.calendar, until, profile.travelKmDay);
test('named seasonal windows use actual variable calendar months and continue through every original waypoint', () => {
  const original = fixture(), before = clone(original), trace = replay(original, 10 * DAY);
  assert.deepEqual(original, before);
  const departures = trace.events.filter(e => e.kind === 'departure'), arrivals = trace.events.filter(e => e.kind === 'arrival');
  assert.deepEqual(departures.map(e => e.destination), ['waypoint', 'away', 'waypoint', 'home']);
  approx(departures[1].at - arrivals[0].at, 1e-6);
  assert.ok(departures[0].at > 0 && departures[0].at < 2 * DAY);
  assert.ok(departures[2].at > 5 * DAY && departures[2].at < 7 * DAY);
  assert.equal(trace.regionId, 'home');
  assert.ok(trace.events.filter(e => e.kind === 'seasonalLegArrived').every(e => !e.late));
  const second = clone(original); group(second).id = 'other-original-herd';
  assert.notEqual(replay(second, DAY).events.find(e => e.kind === 'departure')?.at,
    trace.events.find(e => e.kind === 'departure').at);
});
test('the population consumer uses the shared replay, travel effort and actual midpoint residence', () => {
  const original = fixture(), trace = replay(original, 2 * DAY), s = P.create(original, binding);
  const first = trace.events.find(e => e.kind === 'departure');
  P.advance(s, first.at + .075 * DAY, true, true);
  assert.equal(J.location(group(s)), 'waypoint'); assert.equal(group(s).regionId, 'home');
  assert.equal(group(s).transit.edgeIndex, 1);
  approx(10000 - s.regions[0].stocks.foodKg, profile.foodKgDay * (first.at / DAY + .05 * profile.travelMultiplier));
  approx(10000 - s.regions[1].stocks.waterL, profile.waterLDay * .025 * profile.travelMultiplier);
  P.advance(s, 2 * DAY, true, true);
  assert.equal(group(s).regionId, 'away');
  assert.deepEqual(s.events.filter(e => e.kind === 'arrival').map(e => [e.regionId, e.at]),
    trace.events.filter(e => e.kind === 'arrival').map(e => [e.regionId, e.at]));
});
test('long journeys retain their original edge while return windows queue, with concrete late arrival', () => {
  const original = fixture(3), trace = replay(original, 15 * DAY);
  assert.ok(trace.events.some(e => e.kind === 'seasonalWindowQueued' && e.leg === 'return'));
  const outbound = trace.events.find(e => e.kind === 'seasonalLegArrived' && e.leg === 'outbound');
  assert.ok(outbound.late && outbound.at > 6 * DAY);
  assert.deepEqual(trace.events.filter(e => e.kind === 'departure').slice(0, 4).map(e => e.destination), ['waypoint', 'away', 'waypoint', 'home']);
  const s = P.create(original, binding); P.advance(s, 5 * DAY, true, true);
  assert.equal(group(s).seasonal.pending.leg, 'return'); assert.equal(group(s).seasonal.active.leg, 'outbound');
  assert.ok(group(s).transit); assert.ok(P.normalize(s, binding));
});
test('private destination failures cannot alter a traditional itinerary; actual arrival discovers the shortage', () => {
  const original = fixture(), poor = clone(original);
  for (const r of poor.regions.slice(1)) r.stocks = { foodKg: 0, waterL: 0, mineralsKg: 0 };
  assert.deepEqual(replay(original, 2 * DAY), replay(poor, 2 * DAY));
  const s = P.create(poor, binding), savedRoute = clone(group(s).instinct), originalWater = group(s).cohorts[0].stores.waterL;
  P.advance(s, 2 * DAY, true, true);
  assert.deepEqual(group(s).instinct, savedRoute);
  assert.ok(s.events.some(e => e.kind === 'observedShortage' && e.regionId === 'away'));
  assert.ok(group(s).cohorts[0].stores.waterL < originalWater, 'actual scarcity spends the original body reserve first');
  assert.ok(s.events.some(e => e.kind === 'arrival' && e.regionId === 'away'));
});
test('physical obstruction and wrong origins block without teleporting or inventing an approach', () => {
  const original = fixture(); original.regions[0].edges[0].traversable = false;
  let trace = replay(original, 4 * DAY);
  assert.equal(trace.regionId, 'home'); assert.ok(trace.events.some(e => e.kind === 'seasonalBlocked'));
  const misplaced = fixture(); group(misplaced).regionId = 'waypoint';
  trace = replay(misplaced, 4 * DAY);
  assert.equal(trace.regionId, 'waypoint'); assert.ok(!trace.events.some(e => e.kind === 'departure'));
  assert.match(trace.events.find(e => e.kind === 'seasonalBlocked').reason, /origin/);
});
test('queued return, half-edge residence and paid stocks survive normalization and chunked advancement', () => {
  const original = fixture(3), whole = P.create(original, binding); P.advance(whole, 14 * DAY, true, true);
  let split = P.create(original, binding);
  for (let i = 1; i <= 56; i++) {
    P.advance(split, i * DAY / 4, true, true);
    split = P.normalize(clone(split), binding); assert.ok(split, `valid at quarter-day ${i}`);
  }
  assert.deepEqual(group(split).seasonal, group(whole).seasonal);
  assert.deepEqual(group(split).transit, group(whole).transit);
  assert.deepEqual(P.audit(split), P.audit(whole));
  for (let i = 0; i < 3; i++) for (const key of ['foodKg', 'waterL', 'mineralsKg']) approx(split.regions[i].stocks[key], whole.regions[i].stocks[key]);
  const corrupt = clone(split); group(corrupt).seasonal.active.path.reverse();
  assert.equal(P.normalize(corrupt, binding), null);
  const wrongEdge = clone(split); group(wrongEdge).transit.path.reverse();
  assert.equal(P.normalize(wrongEdge, binding), null);
  const before = clone(split); P.advance(split, 20 * DAY, false, true); assert.deepEqual(split, before);
});
test('real seasonal renewal changes only at actual month boundaries, not all year at the first phase rate', () => {
  const original = fixture(); original.groups = [];
  for (const r of original.regions) {
    r.stocks.foodKg = 0;
    r.seasons = [2, 7, 0, 1].map(foodKg => ({ renewal: { foodKg } }));
    r.renewalPerDay = { foodKg: 999 };
  }
  const s = P.create(original, binding); P.advance(s, 2 * DAY, true, true); approx(s.regions[0].stocks.foodKg, 4);
  P.advance(s, 5 * DAY, true, true); approx(s.regions[0].stocks.foodKg, 25);
  P.advance(s, 7 * DAY, true, true); approx(s.regions[0].stocks.foodKg, 25);
  P.advance(s, 10 * DAY, true, true); approx(s.regions[0].stocks.foodKg, 28);
});
test('soulless/no-will groups do not initiate seasonal travel, and mid-month starts cannot backdate departure', () => {
  const original = fixture(); group(original).will = false;
  assert.equal(replay(original, 10 * DAY).events.length, 0);
  const s = P.create(original, binding); assert.equal(group(s).intention, null);
  const late = P.create(fixture(), binding, 1.99 * DAY);
  assert.ok(group(late).intention.departAt > late.clock);
  P.advance(late, 2.5 * DAY, true, true); assert.equal(group(late).regionId, 'away');
});
