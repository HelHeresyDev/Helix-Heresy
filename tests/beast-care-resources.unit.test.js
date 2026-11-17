const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), Care = require('../beast-parental-care'), F = require('../beast-regional-foodweb');
const { familySource } = require('./helpers/beast-care-sources');
const binding = { worldId: 'care-resources', runId: 'original' }, copy = x => JSON.parse(JSON.stringify(x));
const approx = (a, b) => assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function fixture() {
  const s = P.create(familySource(), binding);
  for (const c of s.groups[0].cohorts) c.deathThreshold = 1e12;
  for (let i = 0; i < 2000; i++) {
    P.advance(s, s.nextEventAt, true, true);
    const donor = s.groups[0].cohorts.find(c => c.caregiving);
    if (donor) return { s, g: s.groups[0], donor, child: s.groups[0].cohorts[1], r: s.regions[0] };
  }
  assert.fail('No actual care action');
}
function valid(s) { assert.ok(P.normalize(copy(s), binding), `Invalid care at ${s.clock}`); }
function spend(s, c, key) {
  const amount = c.stores[key]; c.stores[key] = 0; c.massKg -= amount;
  const out = s.regions[0].outputs ||= {};
  out.metabolicWasteKg = (out.metabolicWasteKg || 0) + amount * P.count(c);
}
function rates(s) { return Object.fromEntries(s.extraRates.filter(q => q.kind === 'care').map(q => [q.resource, q])); }
function rebuild(s) { P.removeStock(s, 'ground', 'waterL', 0, s.clock, 'actual-care-state-change'); }

test('losing either real resource stops only its own transfer, with one maintenance and effort bill', () => {
  for (const missing of ['foodKg', 'waterL']) {
    const { s, g, donor, r } = fixture(), a = copy(donor.caregiving), stockKey = g.resources[missing] || missing;
    P.removeStock(s, r.id, stockKey, r.stocks[stockKey], s.clock, 'actual-supply-loss');
    const q = rates(s), other = missing === 'foodKg' ? 'waterL' : 'foodKg';
    assert.equal(q[missing].factor, 0); assert.equal(q[other].factor, 1);
    assert.ok(donor.caregiving); assert.equal(q.foodKg.inputs.waterL, undefined); assert.equal(q.waterL.inputs.meatKg, undefined);
    const before = Care.summary(s), at = s.clock, stamina = donor.regional.stamina;
    const donorNeeds = copy(donor.needs); valid(s);
    P.advance(s, at + 20, true, true);
    const after = Care.summary(s);
    approx(after.foodInputKg - before.foodInputKg, missing === 'foodKg' ? 0 : a.foodPerDay * 20 / P.DAY);
    approx(after.waterInputL - before.waterInputL, missing === 'waterL' ? 0 : a.waterPerDay * 20 / P.DAY);
    approx(after.memberSeconds - before.memberSeconds, P.count(donor) * 20);
    approx(stamina - donor.regional.stamina, 2);
    for (const key of ['foodKg', 'waterL']) assert.ok(Math.abs(donor.needs[key] - donorNeeds[key]) < .001,
      'only actual metabolized mass changes the shared maintenance bill, not the number of material requests'); valid(s);
  }
});

test('scarce renewable food receives a fractional funding factor without throttling available water', () => {
  const { s, donor, r } = fixture();
  r.renewalPerDay.meatKg = donor.needs.foodKg + donor.caregiving.foodPerDay / 4;
  P.removeStock(s, r.id, 'meatKg', r.stocks.meatKg, s.clock, 'finite-food-renewal');
  assert.ok(rates(s).foodKg.factor > 0 && rates(s).foodKg.factor < 1);
  assert.equal(rates(s).waterL.factor, 1); valid(s);
});

test('a hungry but capable caregiver can start and deliver water, without earning unfed rest or rescue food', () => {
  const { s, g, donor, child, r } = fixture(); Care.cancelAffected(g, donor, s.clock);
  spend(s, donor, 'foodKg'); spend(s, donor, 'fatKg'); spend(s, child, 'waterL');
  donor.regional.stamina = 20;
  P.removeStock(s, r.id, 'meatKg', r.stocks.meatKg, s.clock, 'no-family-food');
  Care.start(s, s.clock, F.bounds, F.restore, F.careCapable); rebuild(s);
  assert.ok(donor.caregiving); assert.equal(donor.caregiving.foodPerDay, 0);
  const before = Care.summary(s), stamina = donor.regional.stamina, health = donor.health;
  P.advance(s, s.clock + 20, true, true);
  assert.ok(Care.summary(s).givenWaterL > before.givenWaterL);
  assert.equal(Care.summary(s).givenFoodKg, before.givenFoodKg);
  assert.equal(donor.stores.foodKg + donor.stores.fatKg, 0);
  approx(donor.regional.stamina, stamina - 2); assert.ok(donor.health < health); valid(s);
});

test('declining health interrupts water care at actual incapacity rather than waiting for death', () => {
  const { s, donor, r } = fixture();
  spend(s, donor, 'foodKg'); spend(s, donor, 'fatKg'); donor.health = .30001;
  P.removeStock(s, r.id, 'meatKg', r.stocks.meatKg, s.clock, 'starving-caregiver');
  const a = copy(donor.caregiving), before = Care.summary(s), at = s.clock;
  assert.ok(s.nextEventAt < a.until);
  P.advance(s, at + 20, true, true);
  assert.equal(donor.caregiving, null); assert.ok(donor.health > 0);
  const seconds = (Care.summary(s).memberSeconds - before.memberSeconds) / P.count(donor);
  approx(seconds, .00001 / .1 * P.DAY); assert.ok(seconds < 20);
  approx(Care.summary(s).waterInputL - before.waterInputL, a.waterPerDay * seconds / P.DAY); valid(s);
});

test('a newly reduced stamina budget clips both transfers at exhaustion and charges the shared effort once', () => {
  const { s, donor } = fixture(); donor.regional.stamina = 1; rebuild(s);
  const before = Care.summary(s), at = s.clock;
  approx(s.nextEventAt - at, 10); P.advance(s, at + 20, true, true);
  assert.equal(donor.caregiving, null);
  approx((Care.summary(s).memberSeconds - before.memberSeconds) / P.count(donor), 10); valid(s);
});

test('protected food reserves stop food only and budget the caregiver own inaccessible-food consumption', () => {
  const { s, g, donor } = fixture(), a = donor.caregiving;
  a.foodSource = 'stores';
  const ownRation = a.reserveKg;
  P.removeStock(s, 'ground', 'meatKg', ownRation * P.count(donor), s.clock, 'prepared-carried-ration');
  donor.stores.foodKg = ownRation; donor.massKg += ownRation;
  rebuild(s); assert.equal(rates(s).foodKg.factor, 0); assert.equal(rates(s).waterL.factor, 1);
  const before = Care.summary(s); P.advance(s, s.clock + 10, true, true);
  assert.equal(Care.summary(s).foodInputKg, before.foodInputKg);
  assert.ok(Care.summary(s).waterInputL > before.waterInputL); approx(donor.stores.foodKg, ownRation); valid(s);
  // The reserve event must include own metabolism even when gross regional
  // supply is full but this actual forager has no direct-food intake.
  donor.stores.foodKg += .01; donor.massKg += .01; donor.intake.foodKg = 0;
  const q = { ...rates(s).foodKg, g, c: donor, factor: 1 };
  const next = Care.prepare(s, [q], s.clock, Infinity, s.rates);
  approx(next - s.clock, .01 * P.count(donor) / (a.foodPerDay + donor.needs.foodKg) * P.DAY);
});

test('active care rechecks proximity, willingness, stamina and physical capability without refunding paid delivery', () => {
  for (const change of [({ child }) => { child.regionalPosition = { regionId: 'ground', eastM: 10000, northM: 0, altitudeM: 0 }; },
    ({ g }) => { g.willing = false; }, ({ donor }) => { donor.regional.stamina = 0; },
    ({ donor }) => { donor.regional.parts.head = 0; }, ({ g }) => { g.activityState = { sleeping: true, dreamConsent: false }; }]) {
    const f = fixture(); P.advance(f.s, f.s.clock + 10, true, true);
    const before = Care.summary(f.s); change(f); rebuild(f.s);
    assert.equal(f.donor.caregiving, null); assert.deepEqual(Care.summary(f.s), before); valid(f.s);
  }
});

test('partial independent funding survives saves and continued branches without duplicate resource owners', () => {
  const { s, r } = fixture(); P.removeStock(s, r.id, 'meatKg', r.stocks.meatKg, s.clock, 'food-depleted');
  P.advance(s, s.clock + 10, true, true);
  const saved = P.normalize(copy(s), binding); assert.ok(saved); assert.deepEqual(rates(saved), rates(s));
  const branch = P.rebind(saved, binding, { ...binding, runId: 'continued' });
  P.advance(s, s.clock + 15, true, true); P.advance(branch, branch.clock + 15, true, true);
  assert.deepEqual(Care.summary(s), Care.summary(branch)); assert.deepEqual(P.audit(s), P.audit(branch)); valid(s);
  for (const change of [x => { x.extraRates.find(q => q.kind === 'care').resource = 'mana'; },
    x => { x.extraRates.push(copy(x.extraRates.find(q => q.kind === 'care'))); },
    x => { x.extraRates = x.extraRates.filter(q => q.resource !== 'waterL'); },
    x => { x.extraRates.find(q => q.resource === 'waterL').inputs = {}; },
    x => { x.groups[0].cohorts[0].caregiving.independentResources = false; }]) {
    const bad = copy(s); change(bad); assert.equal(P.normalize(bad, binding), null);
  }
});

test('a legacy saved mixed action retains its paid interval and is not retroactively split or refunded', () => {
  // Produce a genuinely cached old-style action, including scheduler indexes,
  // rather than editing paid request arrays behind the scheduler's back.
  const start = Care.start; let f;
  try {
    Care.start = (...args) => {
      start(...args);
      for (const g of args[0].groups) for (const c of g.cohorts) if (c.caregiving) delete c.caregiving.independentResources;
    };
    f = fixture();
  } finally { Care.start = start; }
  const { s, donor } = f;
  const saved = P.normalize(copy(s), binding); assert.ok(saved);
  assert.equal(saved.extraRates.filter(q => q.kind === 'care').length, 1);
  assert.equal(saved.groups[0].cohorts[0].caregiving.independentResources, undefined);
  const before = Care.summary(saved), a = copy(donor.caregiving);
  P.advance(saved, saved.clock + 10, true, true);
  approx(Care.summary(saved).foodInputKg - before.foodInputKg, a.foodPerDay * 10 / P.DAY);
  approx(Care.summary(saved).waterInputL - before.waterInputL, a.waterPerDay * 10 / P.DAY); valid(saved);
  P.advance(saved, P.DAY, true, true);
  for (let i = 0; i < 2000 && !saved.groups[0].cohorts[0].caregiving; i++) P.advance(saved, saved.nextEventAt, true, true);
  assert.equal(saved.groups[0].cohorts[0].caregiving.independentResources, true); valid(saved);
});
