const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), F = require('../beast-foraging'), W = require('../background-wildlife'), D = require('../creature-biology');
const { source } = require('./helpers/sustenance-source');
const DAY = P.DAY, HOUR = 3600, binding = { worldId: 'foraging-world', runId: 'run' }, copy = x => JSON.parse(JSON.stringify(x));
const approx = (a, b, eps = 1e-7) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function fixture(options) { const s = P.create(source(options), binding); for (const g of s.groups) for (const c of g.cohorts) c.deathThreshold = 1e12; return s; }
function until(s, phase, maximumDays = 20) {
  for (let i = 0; i < 20000 && s.nextEventAt < maximumDays * DAY; i++) {
    P.advance(s, s.nextEventAt, true, true);
    const c = s.groups[0].cohorts.find(c => c.foraging?.phase === phase);
    if (c) return c;
  }
  assert.fail(`No actual ${phase} phase before day ${maximumDays}`);
}
function valid(s) { assert.ok(P.normalize(s), `invalid at ${s.clock / DAY}`); }
test('all eligible land cohorts sustain a full seasonal cycle on finite prey without generic meat income', () => {
  const s = fixture(); P.advance(s, 120 * DAY, true, true);
  assert.equal(P.audit(s)['population-0'].background, 6);
  assert.ok(s.groups[0].cohorts.every(c => c.health > .99));
  assert.ok(s.groups[0].cohorts.every(c => c.foraging.serial > 1));
  assert.equal(s.regions[0].stocks.meatKg, 0);
  assert.ok(F.summary(s).eatenKg > 6 * D.lifecycle['beast:rimefang-pack'].foodKgDay * 100);
  assert.ok(W.summary(s).hunted > 0); assert.ok(W.summary(s).born > 0);
  assert.ok(!s.losses.some(l => ['starvation', 'dehydration'].includes(l.cause))); valid(s);
});
test('a large marine predator pays for sufficient actual fish and eating time through all seasons', () => {
  const s = fixture({ guild: 'fish', count: 2000000, species: 'reef-wyrm', members: 1, cohorts: 1 });
  P.advance(s, 120 * DAY, true, true);
  assert.equal(P.audit(s)['population-0'].background, 1); assert.ok(s.groups[0].cohorts[0].health > .99);
  assert.ok(F.summary(s).eatenKg > D.lifecycle['beast:reef-wyrm'].foodKgDay * 100); valid(s);
});
test('independent juveniles grow only from caught, ingested surplus rather than receiving adult mass from age', () => {
  const s = fixture({ members: 1, cohorts: 1, juvenile: true }), c = s.groups[0].cohorts[0], before = c.structuralKg;
  P.advance(s, 120 * DAY, true, true);
  assert.ok(c.health > .99); assert.ok(c.structuralKg > before);
  assert.ok(s.regions[0].outputs.growthWasteKg > 0); assert.equal(s.regions[0].stocks.meatKg, 0);
  assert.ok(c.structuralKg < D.lifecycle[c.speciesId].adultKg * .8); valid(s);
});
test('caught surplus cannot bypass a different missing maintenance resource to fund growth', () => {
  const s = fixture({ members: 1, cohorts: 1, juvenile: true }), c = until(s, 'eating');
  for (let i = 0; i < 500 && (c.contactBusyUntil || c.stores.foodKg <= 8); i++) P.advance(s, s.nextEventAt, true, true);
  assert.ok(c.stores.foodKg > 8 && !c.contactBusyUntil);
  const r = s.regions[0], before = c.structuralKg;
  P.removeStock(s, r.id, 'waterL', r.stocks.waterL, s.clock, 'actual-water-loss');
  const growth = s.extraRates.find(q => q.storeFunded); assert.ok(growth); assert.equal(growth.factor, 0);
  P.advance(s, s.clock + HOUR, true, true); approx(c.structuralKg, before); valid(s);
});
test('search effort, handling and ingestion are earned over time; a catch grants a claim, not an instant stomach refill', () => {
  const s = fixture({ members: 1, cohorts: 1 }), c = until(s, 'search'), q = copy(c.foraging.action), before = F.summary(s);
  P.advance(s, s.clock + 100, true, true); assert.ok(F.summary(s).searchSeconds > before.searchSeconds);
  assert.equal(F.summary(s).eatenKg, 0); valid(s);
  P.advance(s, q.dueAt, true, true); assert.equal(c.foraging.phase, 'handling'); assert.equal(F.summary(s).eatenKg, 0);
  assert.equal(c.regional.mana, 0, 'earlier unfed rest cannot be paid by a later catch');
  const mealIds = [...c.foraging.mealIds]; assert.ok(mealIds.length > 0); valid(s);
  P.advance(s, c.foraging.nextAt, true, true); assert.equal(c.foraging.phase, 'eating');
  const at = s.clock; P.advance(s, at + 120, true, true);
  const eaten = F.summary(s).eatenKg; assert.ok(eaten > 0); assert.ok(eaten <= D.lifecycle[c.speciesId].foodKgDay * 120 / 600 + 1e-6);
  assert.equal(c.regional.mana, 0, 'eating time is not simultaneously resting time');
  const once = copy(s); P.advance(s, s.clock, true, true); assert.deepEqual(copy(s), once); valid(s);
});
test('the same corpse tissue cannot be claimed or eaten by two owners', () => {
  const s = fixture({ members: 2, cohorts: 2 }), first = until(s, 'handling'), r = s.regions[0];
  const meal = r.foraging.meals[first.foraging.mealIds[0]], source = r.wildlife.pools[0].carcass;
  const free = source.edibleKg - source.reservedKg;
  const other = s.groups[0].cohorts.find(c => c !== first);
  const id = F.claim(r, s.groups[0], other, 'wildlife', meal.sourceId, source.edibleKg * 2, s.clock, meal.position);
  if (id) approx(r.foraging.meals[id].kg, free);
  assert.ok(source.reservedKg <= source.edibleKg + 1e-8);
  F.cancel(r, other, s.clock); P.removeStock(s, r.id, 'waterL', 0, s.clock, 'other-owner-released'); valid(s);
});
test('depleted habitat, missing position, refusal and real obstacles can cause starvation without successful meals', () => {
  for (const change of [src => { src.regions[0].wildlife.pools = []; }, src => delete src.groups[0].home,
    src => src.groups[0].willing = false, src => src.regions[0].contactBarriers = [{ minEastM: -100, maxEastM: 100, minNorthM: -100, maxNorthM: 100, bottomM: -100, topM: 100 }]]) {
    const src = source({ members: 1, cohorts: 1 }); change(src); const s = P.create(src, binding);
    P.advance(s, 40 * DAY, true, true);
    assert.equal(F.summary(s).eatenKg, 0); assert.equal(P.audit(s)['population-0'].background, 0); valid(s);
  }
});
test('monthly activity ceilings and scarce effort limit a futile search instead of producing an endless busy loop', () => {
  const s = fixture({ members: 1, cohorts: 1, count: 1, areaHa: 1e7 }), c = s.groups[0].cohorts[0];
  P.advance(s, 20 * DAY, true, true);
  assert.ok(c.foraging.plan.used.search <= c.foraging.plan.limits.search + 1e-8);
  assert.ok(c.foraging.plan.used.search + c.foraging.plan.used.eating + c.foraging.plan.used.handling <= c.foraging.plan.limits.active + 1e-8);
  assert.ok(s.work.boundaries < 2000); assert.ok(c.regional.stamina >= 0 && c.regional.stamina <= 300); valid(s);
  // Isolate the planner's already-spent handling allowance: it may not start
  // another capture whose handling time would have to be free.
  const capped = fixture({ members: 1, cohorts: 1 }), g = capped.groups[0], body = g.cohorts[0];
  body.stores.fatKg = 0; body.foraging.nextAt = capped.clock;
  body.foraging.plan.used.handling = body.foraging.plan.limits.handling;
  F.step(capped, capped.regions[0], g, body, capped.clock, { usable: true, capture: () => assert.fail('spent handling budget') });
  assert.equal(body.foraging.nextAt, body.foraging.plan.end); assert.equal(body.foraging.action, null);
});
test('search work scales with cohorts rather than expanding a million hunters into individual planners', () => {
  const samples = [];
  for (const members of [12, 1200000]) {
    const s = fixture({ members, cohorts: 2, count: 1000, areaHa: 1e9 }); P.advance(s, 5 * DAY, true, true);
    assert.ok(F.summary(s).searchSeconds > 0); assert.equal(s.groups[0].cohorts.length, 2); valid(s);
    samples.push(s.work.cohortIntervals);
  }
  assert.ok(samples[1] < samples[0] * 2);
});
test('reserve depletion during a search does not complete or reroll a microscopic catch', () => {
  const s = fixture({ members: 1, cohorts: 1 }), c = s.groups[0].cohorts[0];
  c.massKg -= c.stores.fatKg; c.stores.fatKg = .001; c.massKg += .001;
  c.regional.stamina = 300;
  P.removeStock(s, 'ground', 'waterL', 0, 0, 'original-low-reserves');
  const q = copy(until(s, 'search').foraging.action);
  P.advance(s, q.startedAt + 100, true, true);
  assert.equal(c.foraging.phase, 'search'); assert.equal(c.foraging.nextAt, q.dueAt);
  assert.equal(W.summary(s).hunted, 0); assert.equal(F.summary(s).searches, 0);
  P.advance(s, q.dueAt + 3600, true, true);
  assert.ok(s.work.boundaries < 100); valid(s);
});
test('an actual nearby original beast corpse supports a long gradual meal and retains its freezing interval', () => {
  const src = source({ members: 1, cohorts: 1 }); src.regions[0].wildlife.pools = [];
  const prey = require('./helpers/regional-foodweb-source').source([['reef-wyrm', 0, 1]]).groups[0];
  prey.id = 'original-prey'; prey.populationId = 'prey-population'; prey.cohorts[0].id = 'original-prey-body'; src.groups.push(prey);
  const s = P.create(src, binding), g = s.groups[0], c = g.cohorts[0]; c.deathThreshold = 1e12;
  assert.ok(P.kill(s, prey.id, prey.cohorts[0].id, 0, 0, 'prepared-original-death'));
  const remains = Object.values(s.regions[0].remainsBatches)[0]; remains.frozenUntil = 2 * DAY;
  until(s, 'eating'); const start = s.clock, initial = remains.edibleKg;
  assert.ok(c.foraging.nextAt - start > 300);
  P.advance(s, start + 100, true, true);
  assert.ok(remains.consumedKg > 0 && remains.consumedKg < D.lifecycle[c.speciesId].foodKgDay);
  approx(initial - remains.edibleKg, remains.consumedKg); assert.equal(remains.decomposedKg, 0); valid(s);
  P.advance(s, 3 * DAY, true, true); assert.ok(remains.decomposedKg > 0);
  approx(remains.initialEdibleKg, remains.edibleKg + remains.consumedKg + remains.decomposedKg); valid(s);
});
test('a non-foraging omnivore does not gain an instant full-stomach meal from a managed region', () => {
  const src = source({ species: 'mirror-ape', members: 1, cohorts: 1 }); src.regions[0].wildlife.pools = [];
  const prey = require('./helpers/regional-foodweb-source').source([['reef-wyrm', 0, 1]]).groups[0];
  prey.id = 'original-prey'; prey.populationId = 'prey-population'; prey.cohorts[0].id = 'original-prey-body'; src.groups.push(prey);
  const s = P.create(src, binding), c = s.groups[0].cohorts[0]; c.deathThreshold = 1e12;
  c.regional.stamina = 300;
  c.massKg -= c.stores.fatKg; c.stores.fatKg = 0;
  P.kill(s, prey.id, prey.cohorts[0].id, 0, 0, 'prepared-original-death');
  P.advance(s, DAY, true, true);
  const eaten = s.foodWeb.receipts.consumedKg;
  assert.ok(eaten > 0); assert.ok(eaten <= D.lifecycle[c.speciesId].foodKgDay / 2 + 1e-8);
  assert.equal(c.foraging, undefined); valid(s);
});
test('partial search and meal clocks survive normalization and continued imports without prepaid future food', () => {
  for (const phase of ['search', 'eating']) {
    const s = fixture({ members: 1, cohorts: 1 }), c = until(s, phase);
    P.advance(s, Math.min(c.foraging.nextAt - 1, s.clock + 100), true, true); valid(s);
    const saved = P.normalize(copy(s), binding), before = copy(saved);
    const branch = P.rebind(saved, binding, { ...binding, runId: 'continued' });
    P.advance(s, 30 * DAY, true, true); P.advance(branch, 30 * DAY, true, true);
    assert.deepEqual(P.audit(s), P.audit(branch)); approx(F.summary(s).eatenKg, F.summary(branch).eatenKg);
    assert.deepEqual(copy(saved), before); valid(branch);
  }
});
test('arbitrary read partitions do not reroll encounters or fund a different feeding history', () => {
  const direct = fixture({ members: 1, cohorts: 1 }), src = source({ members: 1, cohorts: 1 });
  const split = P.create(src, binding); split.groups[0].cohorts[0].deathThreshold = 1e12;
  P.advance(direct, 30 * DAY, true, true);
  for (let i = 1; i <= 720; i++) P.advance(split, i * HOUR, true, true);
  assert.deepEqual(P.audit(direct), P.audit(split)); assert.equal(W.summary(direct).hunted, W.summary(split).hunted);
  approx(F.summary(direct).eatenKg, F.summary(split).eatenKg); approx(direct.groups[0].cohorts[0].massKg, split.groups[0].cohorts[0].massKg);
  valid(direct); valid(split);
});
test('handoff and irreversible death retain consumed food and spent effort without duplicating the held meal', () => {
  const s = fixture({ members: 1, cohorts: 1 }), c = until(s, 'eating'); P.advance(s, s.clock + 120, true, true);
  const eaten = F.summary(s).eatenKg, stamina = c.regional.stamina, id = c.foraging.mealIds[0], meal = s.regions[0].foraging.meals[id];
  assert.ok(P.detail(s, s.groups[0].id, c.id, c.ranges[0][0], 'actual-original-body', s.clock));
  assert.equal(s.regions[0].foraging.meals[id], undefined); assert.equal(F.summary(s).eatenKg, eaten); assert.ok(c.regional.stamina <= stamina);
  assert.ok(meal.kg > 0); const frozen = copy(s); P.advance(s, 120 * DAY, false, true); assert.deepEqual(copy(s), frozen); valid(s);
});
test('departure releases an unfinished meal at its source; transit and arrival do not copy custody', () => {
  const src = source({ members: 1, cohorts: 1 }), other = copy(src.regions[0]);
  other.id = 'destination'; other.wildlife.pools.forEach(p => p.id += ':destination'); src.regions.push(other);
  src.regions[0].edges.push({ id: other.id, distanceKm: 1, traversable: true });
  const s = P.create(src, binding), g = s.groups[0]; g.cohorts[0].deathThreshold = 1e12;
  const c = until(s, 'eating'), r = s.regions[0], mealId = c.foraging.mealIds[0], eaten = F.summary(s).eatenKg;
  g.intention = { destination: other.id, chosenAt: s.clock, departAt: s.clock + 100 };
  P.removeStock(s, r.id, 'waterL', 0, s.clock, 'actual-prepared-departure');
  P.advance(s, g.intention.departAt, true, true);
  assert.ok(g.transit); assert.equal(r.foraging.meals[mealId], undefined); assert.equal(c.foraging.action, null);
  assert.ok(F.summary(s).eatenKg > eaten); const paid = F.summary(s).eatenKg;
  valid(s); const saved = P.normalize(copy(s), binding), arrival = g.transit.edgeArriveAt;
  P.advance(saved, arrival, true, true); assert.equal(saved.groups[0].regionId, other.id);
  approx(F.summary(saved).eatenKg, paid); assert.equal(Object.keys(saved.regions[0].foraging.meals).length, 0); valid(saved);
});
test('forged meal claims, action clocks and activity budgets cannot normalize', () => {
  const s = fixture({ members: 1, cohorts: 1 }), c = until(s, 'eating'); P.advance(s, s.clock + 100, true, true); valid(s);
  for (const change of [x => x.groups[0].cohorts[0].foraging.plan.used.eating = 1e12,
    x => x.groups[0].cohorts[0].foraging.nextAt++, x => x.groups[0].cohorts[0].foraging.mealIds.push('invented'),
    x => Object.values(x.regions[0].foraging.meals)[0].kg *= 2,
    x => x.regions[0].wildlife.pools[0].carcass.reservedKg = 1e12,
    x => x.groups[0].cohorts[0].foraging.action.intakePerDay *= 2,
    x => delete x.groups[0].cohorts[0].foraging.plan.used.rest,
    x => x.groups[0].cohorts[0].foraging.plan.limits.active *= 2]) {
    const bad = copy(s); change(bad); assert.equal(P.normalize(bad), null);
  }
  const search = fixture({ members: 1, cohorts: 1 }); until(search, 'search');
  for (const change of [x => x.groups[0].cohorts[0].foraging.action.earnedSeconds = 1e9,
    x => x.groups[0].cohorts[0].foraging.action.cycleActive = 0,
    x => x.groups[0].cohorts[0].foraging.action.guilds.push('invented')]) {
    const bad = copy(search); change(bad); assert.equal(P.normalize(bad), null);
  }
});
