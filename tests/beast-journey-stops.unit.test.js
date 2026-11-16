const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), F = require('../beast-regional-foodweb'), J = require('../beast-seasonal-journeys');
const W = require('../background-wildlife'), Foraging = require('../beast-foraging');
const { travelSource: source } = require('./helpers/beast-care-sources');
const DAY = P.DAY, HOUR = 3600, binding = { worldId: 'journey-stops', runId: 'original' }, copy = x => JSON.parse(JSON.stringify(x));
function fixture(src = source()) {
  const s = P.create(src, binding), g = s.groups[0], c = g.cohorts[0];
  const spent = c.stores.fatKg - 2; c.stores.fatKg = 2; c.massKg -= spent;
  c.deathThreshold = 1e12; c.regional.stamina = 300;
  s.regions[0].outputs ||= {}; s.regions[0].outputs.metabolicWasteKg = spent;
  g.intention = { destination: 'away', chosenAt: 0, departAt: 10 };
  P.removeStock(s, g.regionId, 'waterL', 0, 0, 'prepared-real-journey'); P.advance(s, 10, true, true); return s;
}
const valid = s => assert.ok(P.normalize(s, binding), `invalid at ${s.clock / DAY}`);
test('a hungry traveller stops at its actual route position and buys no movement while stopped', () => {
  const s = fixture(), g = s.groups[0], originalArrival = g.transit.edgeArriveAt;
  P.advance(s, g.transit.nextStopCheckAt, true, true);
  assert.equal(g.transit.stop.reason, 'hunger'); assert.equal(g.transit.stop.position.eastM, 6250);
  const before = F.transitPosition(g, s.clock), pausedAt = s.clock;
  assert.equal(F.position(g, s.regions[0], g.cohorts[0], 0).eastM, 6250);
  P.advance(s, s.clock + 100, true, true); assert.deepEqual(F.transitPosition(g, s.clock), before);
  assert.equal(g.travelCare.usedSeconds, 100); valid(s);
  const end = g.transit.stop.until; P.advance(s, end, true, true);
  assert.equal(g.transit.stop, undefined); assert.equal(g.transit.edgeArriveAt, originalArrival + end - pausedAt);
  assert.ok(W.summary(s).consumedKg > 0); assert.ok(Foraging.summary(s).eatenKg > 0);
  assert.ok(g.cohorts[0].stores.foodKg > 0); valid(s);
});
test('stops preserve their partial work, counters, original path and late arrival through save/rebind', () => {
  const direct = fixture(), g = direct.groups[0]; P.advance(direct, g.transit.nextStopCheckAt + 100, true, true);
  const saved = P.normalize(copy(direct), binding); assert.ok(saved);
  const branch = P.rebind(saved, binding, { ...binding, runId: 'continued' });
  P.advance(direct, 6 * DAY, true, true); P.advance(branch, 6 * DAY, true, true);
  assert.deepEqual(P.audit(direct), P.audit(branch)); assert.deepEqual(W.summary(direct), W.summary(branch));
  assert.deepEqual(direct.groups, branch.groups); assert.equal(saved.clock, DAY / 4 + 110);
  const arrival = direct.events.find(e => e.kind === 'arrival'); assert.ok(arrival.at > 4 * DAY + 10);
  assert.ok(direct.events.some(e => e.kind === 'journeyStopped')); valid(direct);
});
test('private destination food cannot change an origin-side stop, path or timing', () => {
  const a = source(), b = copy(a); b.regions[1].wildlife.pools = [];
  b.regions[1].stocks.forageKg = 0; b.regions[1].stocks.waterL = 0;
  const x = fixture(a), y = fixture(b); P.advance(x, DAY, true, true); P.advance(y, DAY, true, true);
  assert.deepEqual(x.groups[0], y.groups[0]); assert.deepEqual(x.regions[0], y.regions[0]); valid(x); valid(y);
});
test('unknown geometry, absent prey and refusal cannot produce a route meal or an invented feeding site', () => {
  for (const change of [s => { delete s.regions[0].edges[0].routeFrames; }, s => { s.regions[0].wildlife.pools = []; },
    s => { s.groups[0].willing = false; }]) {
    const src = source(); change(src); const s = fixture(src);
    P.advance(s, DAY, true, true); assert.equal(W.summary(s).consumedKg, 0); valid(s);
    if (!src.regions[0].edges[0].routeFrames) assert.ok(!s.groups[0].transit?.stop);
  }
});
test('tampered pause positions, future work and altered route geometry cannot normalize', () => {
  const s = fixture(), g = s.groups[0]; P.advance(s, g.transit.nextStopCheckAt + 100, true, true); valid(s);
  for (const change of [t => t.stop.position.eastM = 0, t => t.stop.startedAt = s.clock + 1,
    t => t.stop.until += DAY, t => t.pausedSeconds.beforeCross = DAY,
    t => t.spatial.routeFrames.exit.eastM = -t.spatial.routeFrames.exit.eastM]) {
    const bad = copy(s); change(bad.groups[0].transit); assert.equal(P.normalize(bad, binding), null);
  }
  const bad = copy(s); bad.groups[0].travelCare.usedSeconds = bad.groups[0].travelCare.limitSeconds + 1;
  assert.equal(P.normalize(bad, binding), null);
});
test('winged travel cannot receive floating rest over open sea, while actual aquatic and buoyant bodies can rest', () => {
  const s = fixture(), r = s.regions[0]; Object.assign(r, { kind: 'waterColumn', floor: false, depthM: 100 });
  r.stocks.seawaterL = r.areaHa * 10000 * 1000 * 100;
  for (const [speciesId, expected] of [['beast:glasswing-roc', false], ['beast:reef-wyrm', true], ['beast:carrion-lantern', true]])
    assert.equal(Foraging.canRest({ speciesId, massKg: require('../creature-biology').lifecycle[speciesId].adultKg }, { transit: { stop: {} } }, r), expected);
  assert.equal(J.moving({ transit: {} }), true); assert.equal(J.moving({ transit: { stop: {} } }), false);
});
test('a dependent traveller triggers care stops despite ample regional water that it cannot drink independently', () => {
  const src = require('./helpers/beast-care-sources').familySource({ species: 'thunderback-grazer', parents: 2, children: 1 });
  src.groups[0].cohorts[1].massKg = 200; src.groups[0].cohorts[1].ageDays = 20;
  const r = src.regions[0], to = copy(r); to.id = 'away'; src.regions.push(to);
  const edge = source().regions[0].edges[0]; r.edges = [copy(edge)]; to.edges = [];
  const s = P.create(src, binding), g = s.groups[0], child = g.cohorts[1];
  for (const c of g.cohorts) { c.deathThreshold = 1e12; c.regional.stamina = 300; }
  // Food reserves are sufficient here: the reason to stop is the actual young
  // body's unavailable direct-water intake, not a regional water shortage.
  child.massKg += 50; child.stores.foodKg = 50;
  P.removeStock(s, 'ground', 'forageKg', 50, 0, 'prepared-carried-ration-partition');
  g.intention = { destination: 'away', chosenAt: 0, departAt: 10 };
  P.removeStock(s, 'ground', 'waterL', 0, 0, 'actual-family-route'); P.advance(s, 10, true, true);
  P.advance(s, g.transit.nextStopCheckAt, true, true);
  assert.equal(s.rates.ground.supply.waterL, 1); assert.equal(child.intake.waterL, 0);
  assert.equal(g.transit.stop.reason, 'thirst'); valid(s);
});
function familyJourney(children = 1) {
  const src = require('./helpers/beast-care-sources').familySource({ species: 'thunderback-grazer', parents: 2, children });
  src.groups[0].cohorts[1].massKg = 200; src.groups[0].cohorts[1].ageDays = 20;
  const r = src.regions[0], to = copy(r); to.id = 'away'; src.regions.push(to);
  r.edges = [copy(source().regions[0].edges[0])]; to.edges = [];
  const s = P.create(src, binding), g = s.groups[0];
  for (const c of g.cohorts) { c.deathThreshold = 1e12; c.regional.stamina = 300; }
  return { s, g };
}
test('the original family journey is paced by its smaller member and reviews reserves before a fixed adult-sized interval', () => {
  const { s, g } = familyJourney(); g.intention = { destination: 'away', chosenAt: 0, departAt: 10 };
  P.removeStock(s, 'ground', 'waterL', 0, 0, 'actual-family-route'); P.advance(s, 10, true, true);
  const adultPace = require('../creature-biology').lifecycle[g.speciesId].travelKmDay;
  assert.ok(g.transit.spatial.speedKmDay < adultPace / 2);
  assert.ok(g.transit.nextStopCheckAt - s.clock < DAY / 4);
  const saved = P.normalize(copy(s), binding); assert.ok(saved);
  P.advance(s, g.transit.nextStopCheckAt, true, true); P.advance(saved, saved.groups[0].transit.nextStopCheckAt, true, true);
  assert.deepEqual(s.groups, saved.groups); valid(s);
  const bad = copy(saved); bad.groups[0].transit.spatial.speedKmDay = adultPace;
  assert.equal(P.normalize(bad, binding), null);
});
test('a chosen departure waits for already-started care without cancelling it or choosing a different destination', () => {
  const { s, g } = familyJourney();
  for (let i = 0; i < 1000 && !g.cohorts.some(c => c.caregiving); i++) P.advance(s, s.nextEventAt, true, true);
  const donor = g.cohorts.find(c => c.caregiving); assert.ok(donor);
  const until = donor.caregiving.until, at = s.clock;
  g.intention = { destination: 'away', chosenAt: at, departAt: at + 1 };
  P.removeStock(s, 'ground', 'waterL', 0, at, 'actual-departure'); P.advance(s, at + 1, true, true);
  assert.equal(g.transit, null); assert.equal(g.intention.destination, 'away'); assert.equal(g.intention.chosenAt, at);
  assert.equal(g.intention.departAt, until); assert.ok(donor.caregiving); valid(s);
  P.advance(s, until, true, true); assert.ok(g.transit); assert.ok(donor.parentalLedger.usedSeconds > 0); valid(s);
});
test('an essential unfinished local feeding extends the same stop using only its remaining time and material budgets', () => {
  const { s, g } = familyJourney(10); g.intention = { destination: 'away', chosenAt: 0, departAt: 10 };
  P.removeStock(s, 'ground', 'waterL', 0, 0, 'actual-family-route'); P.advance(s, 10, true, true);
  const at = s.clock, pos = F.transitPosition(g, at).position, arrival = g.transit.edgeArriveAt;
  const child = g.cohorts[1], removed = child.stores.waterL * P.count(child);
  child.massKg -= child.stores.waterL; child.stores.waterL = 0;
  s.regions[0].outputs ||= {}; s.regions[0].outputs.preparedWaterRemovalKg = removed;
  assert.ok(J.pause(g, at, pos, at + 60, 'thirst'));
  P.removeStock(s, 'ground', 'waterL', 0, at, 'actual-short-stop'); P.advance(s, at + 60, true, true);
  assert.ok(g.transit.stop); assert.ok(g.transit.stop.until > at + 60);
  assert.equal(g.transit.stop.startedAt, at); assert.deepEqual(g.transit.stop.position, pos); valid(s);
  for (let i = 0; i < 20 && g.transit.stop; i++) P.advance(s, g.transit.stop.until, true, true);
  assert.equal(g.transit.stop, undefined);
  assert.equal(g.transit.edgeArriveAt, arrival + s.clock - at);
  assert.ok(g.travelCare.usedSeconds > 60); assert.ok(g.travelCare.usedSeconds <= g.travelCare.limitSeconds);
  assert.ok(require('../beast-parental-care').summary(s).givenWaterL > 0); valid(s);
});
test('exhausted non-foraging guardians earn actual supplied rest while stopped instead of having their rest clock erased', () => {
  const { s, g } = familyJourney(); for (const c of g.cohorts) c.regional.stamina = 0;
  g.intention = { destination: 'away', chosenAt: 0, departAt: 10 };
  P.removeStock(s, 'ground', 'waterL', 0, 0, 'actual-exhausted-family-route'); P.advance(s, 10, true, true);
  P.advance(s, g.transit.nextStopCheckAt, true, true); assert.ok(g.transit.stop);
  const stoppedAt = s.clock; assert.equal(g.cohorts[0].regional.stamina, 0);
  P.advance(s, g.transit.stop.until, true, true);
  assert.ok(g.cohorts[0].regional.stamina > 0);
  assert.ok(require('../beast-parental-care').summary(s).givenWaterL > 0);
  assert.ok(g.travelCare.usedSeconds > 0 && g.travelCare.usedSeconds <= s.clock - stoppedAt);
  assert.ok(g.cohorts[1].health > .99); valid(s);
});
