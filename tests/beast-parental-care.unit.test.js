const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), Care = require('../beast-parental-care'), F = require('../beast-regional-foodweb'), D = require('../creature-biology');
const { familySource: source } = require('./helpers/beast-care-sources');
const DAY = P.DAY, binding = { worldId: 'parental-care', runId: 'original' }, copy = x => JSON.parse(JSON.stringify(x));
const approx = (a, b) => assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function fixture(options) { const s = P.create(source(options), binding); for (const g of s.groups) for (const c of g.cohorts) c.deathThreshold = 1e12; return s; }
const valid = s => assert.ok(P.normalize(s, { ...binding, runId: s.runId }), `invalid care at ${s.clock / DAY}`);
function untilCare(s) {
  for (let i = 0; i < 2000 && s.clock < 5 * DAY; i++) { P.advance(s, s.nextEventAt, true, true); if (s.groups[0].cohorts.some(c => c.caregiving)) return s.groups[0].cohorts.find(c => c.caregiving); }
  assert.fail('No real parental provisioning action');
}
test('family care bills actual material, effort, time and waste without creating food or granting independent hunting', () => {
  const s = fixture(), g = s.groups[0], young = g.cohorts[1], donor = untilCare(s), a = copy(donor.caregiving);
  assert.equal(young.intake.foodKg, 0); assert.equal(young.intake.waterL, 0); assert.equal(young.foraging, undefined);
  const physical = () => Object.entries(s.regions[0].stocks).filter(([k]) => k.endsWith('Kg') || k === 'waterL').reduce((v, [, x]) => v + x, 0)
    + g.cohorts.reduce((v, c) => v + c.massKg * P.count(c), 0) + Object.values(s.regions[0].outputs || {}).reduce((v, x) => v + x, 0);
  const before = physical(), food = young.stores.foodKg, effort = donor.regional.stamina;
  P.advance(s, (s.clock + a.until) / 2, true, true); assert.ok(young.stores.foodKg > food);
  assert.ok(donor.regional.stamina < effort); assert.ok(donor.parentalLedger.usedSeconds > 0);
  assert.ok(s.regions[0].outputs.provisioningWasteKg > 0); approx(physical(), before); valid(s);
  P.advance(s, 20 * DAY, true, true); assert.equal(P.count(young), 2); assert.ok(young.health > .99);
  assert.ok(young.structuralKg > D.lifecycle[young.speciesId].newbornKg * .8); valid(s);
});
test('caregiver loss stops future provisioning and orphans can genuinely starve despite a regional food inventory', () => {
  const s = fixture(), donor = untilCare(s); P.advance(s, (s.clock + donor.caregiving.until) / 2, true, true);
  const paid = donor.parentalLedger.givenFoodKg, g = s.groups[0];
  for (const [lo, hi] of copy(donor.ranges)) for (let i = lo; i < hi; i++) P.kill(s, g.id, donor.id, i, s.clock, 'actual-caregiver-loss');
  assert.equal(donor.caregiving, null); P.advance(s, 20 * DAY, true, true);
  assert.equal(donor.parentalLedger.givenFoodKg, paid); assert.equal(P.count(g.cohorts.find(c => c.id === 'actual-young')), 0);
  assert.ok(s.regions[0].stocks.meatKg > 0); valid(s);
  const losses = [...s.losses, ...s.lossBatches].filter(l => ['starvation', 'dehydration'].includes(l.cause));
  assert.ok(losses.some(l => l.context?.dependent && l.context.knownLivingCaregivers === 0
    && l.context.phase === 'stationary' && !l.context.afterPersonalArrival && l.context.careAccess.guardians === 0));
});
test('distant families, blocked paths and refusing caregivers provide no teleported care', () => {
  for (const change of [s => s.groups[0].willing = false,
    s => s.regions[0].contactBarriers = [{ minEastM: -1, maxEastM: 1, minNorthM: -100, maxNorthM: 100, bottomM: -10, topM: 10 }]]) {
    const src = source(); change(src); const s = P.create(src, binding); P.advance(s, 10 * DAY, true, true);
    assert.ok(s.groups[0].cohorts.every(c => !(c.parentalLedger?.givenFoodKg > 0))); valid(s);
  }
  const s = fixture(), g = s.groups[0]; g.cohorts[1].regionalPosition = { regionId: 'ground', eastM: 10000, northM: 0, altitudeM: 0 };
  P.removeStock(s, 'ground', 'waterL', 0, 0, 'actual-separated-family'); P.advance(s, 10 * DAY, true, true);
  assert.ok(g.cohorts.every(c => !(c.parentalLedger?.givenFoodKg > 0))); valid(s);
});
test('independent egg hatchlings, propagules and colonial fragments do not acquire fictitious parental dependence', () => {
  for (const species of ['mire-choir', 'ironroot-colossus', 'brine-cathedral', 'rivercoil']) {
    const s = fixture({ species }); assert.equal(s.groups[0].parentalCare, 'self');
    assert.equal(s.groups[0].cohorts[1].dependency, undefined); valid(s);
  }
  const s = fixture(), c = s.groups[0].cohorts[1]; assert.equal(Care.dependent(c, 0), true);
  assert.equal(Care.dependent(c, D.lifecycle[c.speciesId].independentDays * DAY), false);
});
test('partial provisioning saves, continued imports and arbitrary reads preserve exactly paid transfers and time', () => {
  const direct = fixture(), donor = untilCare(direct); P.advance(direct, (direct.clock + donor.caregiving.until) / 2, true, true);
  const savedClock = direct.clock, saved = P.normalize(copy(direct), binding); assert.ok(saved);
  const branch = P.rebind(saved, binding, { ...binding, runId: 'continued' });
  P.advance(direct, 3 * DAY, true, true);
  for (let at = branch.clock + 97; at < 3 * DAY; at += 97) P.advance(branch, at, true, true);
  P.advance(branch, 3 * DAY, true, true);
  approx(direct.groups[0].cohorts[1].massKg, branch.groups[0].cohorts[1].massKg);
  approx(direct.groups[0].cohorts[0].parentalLedger.givenFoodKg, branch.groups[0].cohorts[0].parentalLedger.givenFoodKg);
  assert.deepEqual(P.audit(direct), P.audit(branch)); assert.equal(saved.clock, savedClock); valid(direct); valid(branch);
});
test('forged caregiver identity, work budgets, cached material inputs and future transfers cannot normalize', () => {
  const s = fixture(), donor = untilCare(s); P.advance(s, (s.clock + donor.caregiving.until) / 2, true, true); valid(s);
  for (const change of [x => x.groups[0].cohorts[1].dependency.guardians.push('invented-parent'),
    x => x.groups[0].cohorts[0].parentalLedger.usedSeconds = 1e12,
    x => x.groups[0].cohorts[0].parentalLedger.givenFoodKg += 100,
    x => x.groups[0].cohorts[0].caregiving.foodPerDay = 1e12,
    x => { delete x.regions[0].careReceipts.givenFoodKg; },
    x => x.extraRates.find(r => r.kind === 'care').inputs = {}]) {
    const bad = copy(s); change(bad); assert.equal(P.normalize(bad, binding), null);
  }
});
test('a handoff interrupts the same caregiver, retains spent resources, and removes only that original member', () => {
  const s = fixture(), donor = untilCare(s); P.advance(s, (s.clock + donor.caregiving.until) / 2, true, true);
  const paid = donor.parentalLedger.givenFoodKg, n = P.count(donor);
  const detail = P.detail(s, s.groups[0].id, donor.id, donor.ranges[0][0], 'actual-local-parent', s.clock);
  assert.ok(detail); assert.equal(detail.parentalLedger.givenFoodKg, paid);
  assert.equal(P.count(donor), n - 1); assert.equal(donor.caregiving, null); valid(s);
  const before = copy(s); P.advance(s, s.clock + DAY, false, true); assert.deepEqual(copy(s), before);
});
test('cohort bounds conservatively contain ordinal grids and maternal layouts without iterating individuals', () => {
  const s = fixture({ parents: 1000000, children: 1000000 }), g = s.groups[0], r = s.regions[0];
  for (const c of g.cohorts) {
    const b = F.bounds(g, r, c); for (const ordinal of [0, 1, 999, P.count(c) - 1]) {
      const p = F.position(g, r, c, ordinal);
      for (const k of ['eastM', 'northM', 'altitudeM']) assert.ok(p[k] >= b.min[k] && p[k] <= b.max[k]);
    }
  }
  P.advance(s, DAY, true, true); assert.ok(s.work.cohortIntervals < 1000); valid(s);
});
test('tiny original colony broods receive real handling time and new larvae are assigned actual workers, not their queen', () => {
  const src = source({ species: 'ember-ant', parents: 200, children: 40 });
  const g = src.groups[0]; g.cohorts[0].role = 'worker';
  for (const c of g.cohorts) c.colonyId = 'actual-colony';
  const s = P.create(src, binding); for (const c of s.groups[0].cohorts) c.deathThreshold = 1e12;
  const donor = untilCare(s); assert.ok(donor.caregiving.until - donor.caregiving.startedAt >= 59.99);
  P.advance(s, 5 * DAY, true, true); assert.ok(Care.summary(s).givenWaterL > 0);
  assert.equal(P.count(s.groups[0].cohorts.find(c => c.id === 'actual-young')), 40); valid(s);
  const child = { speciesId: g.speciesId, colonyId: 'actual-colony', bornAt: s.clock, ranges: [[0, 1]] };
  Care.attach(s.groups[0], child, s.clock, ['imaginary-queen', 'imaginary-male']);
  assert.deepEqual(child.dependency.guardians, ['original-0']);
});
test('incapacity and sleep interrupt future care without refunding already supplied material', () => {
  for (const change of [s => s.groups[0].cohorts[0].regional.parts.head = 0,
    s => s.groups[0].activityState = { sleeping: true, dreamConsent: false }]) {
    const s = fixture(), donor = untilCare(s); P.advance(s, (s.clock + donor.caregiving.until) / 2, true, true);
    const paid = Care.summary(s).givenFoodKg; change(s);
    P.removeStock(s, 'ground', 'waterL', 0, s.clock, 'actual-care-interruption');
    assert.equal(donor.caregiving, null); P.advance(s, s.clock + DAY, true, true);
    assert.equal(Care.summary(s).givenFoodKg, paid); valid(s);
  }
});
test('a predator with healthy fat reserves hunts for its real dependent family instead of waiting for its own starvation', () => {
  const src = require('./helpers/sustenance-source').source({ members: 2, cohorts: 1, count: 1000000 });
  src.spatialContinuity = true;
  const g = src.groups[0]; g.parentalCare = 'family'; g.cohorts[0].role = 'female';
  g.cohorts.push({ id: 'dependent-cubs', speciesId: g.speciesId, count: 2, massKg: 1.5, ageDays: 0, role: 'juvenile' });
  const s = P.create(src, binding), parent = s.groups[0].cohorts[0], cubs = s.groups[0].cohorts[1];
  for (const c of s.groups[0].cohorts) c.deathThreshold = 1e12;
  assert.ok(parent.stores.fatKg >= parent.massKg * .05); assert.ok(parent.provisioningDemandKgDay > 0);
  P.advance(s, 2 * DAY, true, true);
  assert.ok(Care.summary(s).givenFoodKg > 0); assert.ok(cubs.health > .99); assert.equal(P.count(cubs), 2); valid(s);
});
test('repeated real hunts yield to dependent care instead of occupying every feeding opportunity', () => {
  const src = require('./helpers/sustenance-source').source({ members: 5, cohorts: 2, count: 100000 });
  src.spatialContinuity = true; const g = src.groups[0]; g.parentalCare = 'family';
  g.cohorts[0].role = 'female';
  g.cohorts.push({ id: 'nearby-cub', speciesId: g.speciesId, count: 1, massKg: 1.5, ageDays: 0, role: 'juvenile' });
  const s = P.create(src, binding), cub = s.groups[0].cohorts[2];
  for (const c of s.groups[0].cohorts) c.deathThreshold = 1e12;
  P.advance(s, 10 * DAY, true, true);
  assert.ok(Care.summary(s).givenFoodKg > 0); assert.ok(Care.summary(s).givenWaterL > 0);
  assert.equal(P.count(cub), 1); assert.ok(cub.health > .99);
  assert.ok(s.regions[0].foraging.receipts.searches > 10);
  assert.ok(s.groups[0].cohorts.some(c => c.parentalLedger?.usedSeconds > 0)); valid(s);
});
test('private care circumstances distinguish separation, refusal and missing material without deciding that a death was justified', () => {
  const s = fixture(), g = s.groups[0], donor = untilCare(s), child = g.cohorts[1];
  P.advance(s, donor.caregiving.until, true, true);
  const before = JSON.stringify(s), read = () => Care.situation(s, g, child, s.clock, F.bounds, F.careCapable);
  assert.ok(read().local > 0); assert.ok(read().availableFoodKg > 0); assert.equal(JSON.stringify(s), before);
  child.regionalPosition = { regionId: g.regionId, eastM: 10000, northM: 0, altitudeM: 0 };
  assert.ok(read().guardians > 0); assert.equal(read().local, 0);
  g.willing = false; assert.equal(read().willing, false);
  delete child.regionalPosition; s.regions[0].stocks.meatKg = 0;
  for (const c of g.cohorts) c.stores.foodKg = 0;
  assert.ok(read().local > 0); assert.equal(read().availableFoodKg, 0);
});
