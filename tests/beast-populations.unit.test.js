const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../beast-populations'), D = require('../creature-biology');
const clone = x => JSON.parse(JSON.stringify(x));
const DAY = P.DAY, binding = { worldId: 'world', runId: 'run' };
const approx = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function source(speciesId = 'beast:rimefang-pack', n = 10) {
  const p = D.lifecycle[speciesId];
  const region = id => ({ id, areaHa: 100, stocks: { foodKg: 10000, waterL: 10000, mineralsKg: 10000 },
    capacity: { foodKg: 10000, waterL: 10000, mineralsKg: 10000 }, renewalPerDay: {},
    edges: [{ id: id === 'home' ? 'away' : 'home', distanceKm: 100, traversable: true }] });
  return { id: 'original-physical-source', calendar: { epochAt: 0, monthDays: [29, 31, 28, 32] },
    regions: [region('home'), region('away')], groups: [{ id: 'original-pack', populationId: 'original-population',
      speciesId, regionId: 'home', cohorts: [{ id: 'original-adults', speciesId, count: n, ageDays: p.adultDays, massKg: p.adultKg }] }] };
}
const group = s => s.groups[0], body = s => group(s).cohorts[0];
test('calendar boundaries follow supplied variable month lengths, not a 30-day or 365-day assumption', () => {
  const calendar = source().calendar;
  assert.deepEqual(P.monthAt(calendar, 29 * DAY), { index: 1, start: 29 * DAY, end: 60 * DAY, season: 1 });
  assert.equal(P.monthAt(calendar, 120 * DAY).index, 4);
  assert.equal(P.monthAt({ ...calendar, epochAt: -DAY }, 0).start, -DAY);
  assert.throws(() => P.monthAt({ monthDays: [0], epochAt: 0 }, 0));
});
test('typed original sources reject duplicate cohorts, invalid stocks and invented calendar defaults', () => {
  const original = source(), before = clone(original); P.create(original, binding); assert.deepEqual(original, before);
  const duplicate = clone(original); duplicate.groups[0].cohorts.push(clone(duplicate.groups[0].cohorts[0]));
  assert.throws(() => P.create(duplicate, binding), /Conflicting/);
  const over = clone(original); over.regions[0].stocks.foodKg = 10001; assert.throws(() => P.create(over, binding), /capacity/);
  const fractional = clone(original); fractional.groups[0].cohorts[0].count = .5; assert.throws(() => P.create(fractional, binding));
});
test('all 36 life histories can be represented without automatic populations or invented fertility', () => {
  for (const p of Object.values(D.lifecycle)) {
    const s = P.create(source(p.id), binding);
    assert.equal(P.count(body(s)), 10); assert.equal(body(s).speciesId, p.id);
    approx(body(s).structuralKg + body(s).stores.waterL + body(s).stores.fatKg, p.adultKg);
  }
  const empty = source(); empty.groups = []; assert.deepEqual(P.create(empty, binding).groups, []);
});
test('original integer membership is conserved across detailing, duplicate claims and actual physical loss', () => {
  const s = P.create(source(), binding), at = 10;
  const original = P.detail(s, 'original-pack', 'original-adults', 3, 'actual-body', at);
  assert.equal(original.memberId, 'original-adults:3'); assert.equal(P.count(body(s)), 9);
  assert.equal(P.detail(s, 'original-pack', 'original-adults', 3, 'healthy-copy', at), null);
  assert.equal(P.detail(s, 'original-pack', 'original-adults', 4, 'actual-body', at), null);
  assert.deepEqual(P.audit(s)['original-population'], { background: 9, detailed: 1, dead: 0 });
  assert.equal(P.recordDetailedLoss(s, 'actual-body', 11, 'combat', 25), true);
  assert.equal(P.recordDetailedLoss(s, 'actual-body', 12, 'background', 25), false);
  assert.deepEqual(P.audit(s)['original-population'], { background: 9, detailed: 0, dead: 1 });
  assert.equal(s.regions[0].remains, undefined, 'detailed corpse is not copied into background edible stocks');
});
test('hazards integrate actual age bands and old-age doubling, including separate queen values', () => {
  const speciesId = 'beast:ember-ant', p = D.lifecycle[speciesId];
  const worker = P.create(source(speciesId, 1), binding).groups[0].cohorts[0]; worker.bornAt = 0;
  approx(P.hazardIntegral(worker, 0, p.adultDays * DAY), p.juvenileMortality / 1000 * p.adultDays);
  approx(P.hazardIntegral(worker, p.adultDays * DAY, p.ageingDays * DAY), p.adultMortality / 1000 * (p.ageingDays - p.adultDays));
  const queen = clone(worker); queen.role = 'queen';
  approx(P.hazardIntegral(queen, p.adultDays * DAY, (p.adultDays + 10) * DAY), p.breederMortality / 1000 * 10);
  const at = p.ageingDays * DAY;
  assert.ok(P.hazardIntegral(worker, at + p.doublingDays * DAY, at + (p.doublingDays + 1) * DAY)
    > P.hazardIntegral(worker, at, at + DAY) * 1.99);
});
test('continuous saved background deaths neither round away a small cohort nor duplicate a detailed individual', () => {
  const s = P.create(source('beast:ember-ant', 3), binding);
  P.detail(s, 'original-pack', 'original-adults', 1, 'detached-ant', 0);
  P.advance(s, 365 * DAY, true, true);
  assert.equal(P.count(body(s)), 0);
  assert.deepEqual(P.audit(s)['original-population'], { background: 0, detailed: 1, dead: 2 });
  assert.ok(s.losses.every(loss => loss.memberId !== 'original-adults:1'));
  assert.equal(Object.keys(s.regions[0].remains).length, 2);
});
test('planning is monthly and repeated reads do not award future renewal or replan', () => {
  const original = source(); original.regions[0].stocks.foodKg = 0; original.regions[0].renewalPerDay.foodKg = 100;
  const s = P.create(original, binding); assert.equal(s.regions[0].stocks.foodKg, 0);
  P.advance(s, DAY, true, true); const stock = s.regions[0].stocks.foodKg, plans = clone(s.plans);
  assert.ok(stock > 0 && stock < 100); P.advance(s, DAY, true, true);
  assert.equal(s.regions[0].stocks.foodKg, stock); assert.deepEqual(s.plans, plans);
  P.advance(s, 29 * DAY); assert.equal(s.plans.length, 2);
});
test('resource depletion is an event; actual shortages consume original body reserves and create unmet needs', () => {
  const original = source(); original.regions[0].stocks = { foodKg: 1, waterL: 1, mineralsKg: 0 };
  const s = P.create(original, binding), mass = body(s).massKg;
  P.advance(s, 10 * DAY, true, true);
  assert.equal(s.regions[0].stocks.foodKg, 0); assert.equal(s.regions[0].stocks.waterL, 0);
  assert.ok(body(s).massKg < mass); assert.ok(body(s).unmet.foodKg > 0 && body(s).unmet.waterL > 0);
  assert.equal(group(s).observedShortage, true); assert.ok(s.regions[0].outputs.metabolicWasteKg > 0);
});
test('instinctive choices do not consult hidden destination capacity and retain an unlisted traditional destination', () => {
  const policy = { mode: 'instinctive', route: ['bad-basin'], cursor: 0 };
  assert.equal(P.chooseDestination(policy, [{ id: 'good-basin', foodKg: 100000 }], 'seed'), 'bad-basin');
  const forced = { mode: 'forcedDispersal' }, choices = [{ id: 'a' }, { id: 'b' }];
  assert.equal(P.chooseDestination(forced, choices, 'one'), P.chooseDestination(forced, choices.map(o => ({ ...o, hiddenFoodKg: 100000 })), 'one'));
  assert.equal(P.chooseDestination({ mode: 'informed', at: 10 }, [{ id: 'a', learnedAt: 20 }, { id: 'b', learnedAt: 5 }], 'seed'), 'b');
});
test('groups stagger departures and charge consumption to actual route residence before arrival', () => {
  const original = source(); original.groups[0].instinct = { mode: 'instinctive', route: ['away', 'home'] };
  original.groups.push({ ...clone(original.groups[0]), id: 'second-pack', cohorts: [{ ...clone(original.groups[0].cohorts[0]), id: 'second-adults' }] });
  const s = P.create(original, binding), departure = group(s).intention.departAt;
  assert.notEqual(s.groups[1].intention.departAt, departure);
  P.advance(s, departure, true, true); assert.ok(group(s).transit); assert.equal(group(s).regionId, 'home');
  const arrival = group(s).transit.edgeArriveAt;
  P.advance(s, arrival - 1, true, true); assert.ok(group(s).transit); assert.ok(s.regions[1].outputs.metabolicWasteKg > 0);
  P.advance(s, arrival, true, true); assert.equal(group(s).regionId, 'away'); assert.equal(group(s).transit, null);
  assert.deepEqual(group(s).knowledge.at(-1), { regionId: 'away', at: arrival, source: 'personalArrival', confidence: 'localOnly' });
});
test('physical obstruction is learned on departure rather than used by an invisible destination selector', () => {
  const original = source(); original.groups[0].instinct = { mode: 'instinctive', route: ['away'] };
  original.regions[0].edges[0].traversable = false;
  const s = P.create(original, binding), departure = group(s).intention.departAt;
  assert.equal(group(s).intention.destination, 'away'); P.advance(s, departure, true, true);
  assert.equal(group(s).transit, null); assert.ok(s.events.some(e => e.kind === 'blockedDeparture'));
});
test('reloads, chunked advancement and continued import retain choices, transit, losses and paid consumption', () => {
  const original = source('beast:ember-ant', 20); original.groups[0].instinct = { mode: 'instinctive', route: ['away', 'home'] };
  const whole = P.create(original, binding); P.advance(whole, 70 * DAY, true, true);
  let split = P.create(original, binding);
  for (let at = DAY; at <= 70 * DAY; at += DAY) { P.advance(split, at, true, true); split = clone(split); }
  assert.deepEqual(split.plans, whole.plans); assert.deepEqual(P.audit(split), P.audit(whole));
  assert.deepEqual(split.groups.map(g => g.intention), whole.groups.map(g => g.intention));
  for (let index = 0; index < split.regions.length; index++) for (const key of ['foodKg', 'waterL', 'mineralsKg'])
    approx(split.regions[index].stocks[key], whole.regions[index].stocks[key]);
  const before = clone(split), imported = P.rebind(split, binding, { worldId: 'copy', runId: 'copy-run' });
  assert.equal(imported.runId, 'copy-run'); assert.deepEqual(split, before);
  P.advance(split, 90 * DAY, false, true); assert.deepEqual(split, before);
  assert.equal(P.audit(P.create(original, { ...binding, runId: 'fresh' }))['original-population'].dead, 0);
});
test('failed arrivals can trigger repeated exploration and genuine starvation within a calendar month', () => {
  const original = source(); original.groups[0].instinct = { mode: 'instinctive', route: ['away', 'home'] };
  original.calendar.monthDays = [1, 31, 28, 30];
  for (const r of original.regions) { r.stocks = { foodKg: 0, waterL: 0, mineralsKg: 0 }; r.edges[0].distanceKm = .1; }
  const s = P.create(original, binding); P.advance(s, 20 * DAY, true, true);
  assert.ok(s.events.some(e => e.kind === 'arrival' && e.regionId === 'away'));
  assert.ok(s.events.filter(e => e.kind === 'departure').length >= 2, 'an unsuitable arrival does not grant a safe replacement home');
  assert.ok(s.losses.some(l => ['starvation', 'dehydration'].includes(l.cause) && l.at < 20 * DAY));
  assert.equal(P.audit(s)['original-population'].dead, 10);
});
test('an actual stock interruption settles past consumption and changes only unperformed effects, not private migration choices', () => {
  const original = source(); original.groups[0].instinct = { mode: 'instinctive', route: ['away'] };
  const s = P.create(original, binding), choice = clone(group(s).intention), plans = clone(s.plans);
  P.advance(s, 10, true, true);
  const amount = s.regions[1].stocks.foodKg;
  assert.equal(P.removeStock(s, 'away', 'foodKg', amount, 10, 'observed-fire-physical-loss'), true);
  assert.equal(s.regions[1].stocks.foodKg, 0); assert.deepEqual(group(s).intention, choice); assert.deepEqual(s.plans, plans);
  assert.equal(P.removeStock(s, 'away', 'foodKg', 1, 10, 'cannot-spend-missing-stock'), false);
  assert.equal(P.detail(s, 'original-pack', 'original-adults', 2, 'backdated-body', 9), null);
});
test('explicit deaths debit an original exactly once and cannot later become another hazard death', () => {
  const s = P.create(source('beast:ember-ant', 3), binding);
  assert.equal(P.kill(s, 'original-pack', 'original-adults', 1, 0, 'actual-predation'), true);
  assert.equal(P.kill(s, 'original-pack', 'original-adults', 1, 0, 'duplicate-predation'), false);
  P.advance(s, 365 * DAY, true, true);
  assert.equal(s.losses.filter(l => l.memberId === 'original-adults:1').length, 1);
  assert.equal(P.audit(s)['original-population'].dead, 3);
});
test('saved-state validation preserves original clocks and rejects corruption without generating replacements', () => {
  const s = P.create(source(), binding); P.advance(s, DAY, true, true);
  P.detail(s, 'original-pack', 'original-adults', 2, 'one-original-body', DAY);
  assert.deepEqual(P.normalize(s, binding), s);
  const duplicated = clone(s); duplicated.groups[0].cohorts[0].ranges = [[0, 10]];
  assert.equal(P.normalize(duplicated, binding), null);
  const negative = clone(s); negative.regions[0].stocks.foodKg = -1; assert.equal(P.normalize(negative, binding), null);
  const refill = clone(s); refill.originalCounts['original-population']++; assert.equal(P.normalize(refill, binding), null);
  assert.equal(P.normalize(s, { worldId: 'another', runId: 'run' }), null);
});
