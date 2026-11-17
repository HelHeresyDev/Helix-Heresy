const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), F = require('../beast-regional-foodweb'), W = require('../background-wildlife');
const { windSource } = require('./helpers/wind-source');
const binding = { worldId: 'wind-world', runId: 'original' }, copy = x => JSON.parse(JSON.stringify(x));
function fixture(options) {
  const s = P.create(windSource(options), binding), g = s.groups[0];
  for (const group of s.groups) for (const c of group.cohorts) { c.deathThreshold = 1e12; c.regional.stamina = 300; }
  for (const c of g.cohorts) { const spent = c.stores.fatKg - 1; c.stores.fatKg = 1; c.massKg -= spent;
    s.regions[0].outputs ||= {}; s.regions[0].outputs.preparedMetabolicWasteKg = (s.regions[0].outputs.preparedMetabolicWasteKg || 0) + spent * P.count(c); }
  const prey = s.groups[1]; P.kill(s, prey.id, prey.cohorts[0].id, 0, 0, 'actual-original-death'); return s;
}
const valid = s => assert.ok(P.normalize(s, binding), `invalid at ${s.clock}`);
test('actual wind carries a scavenger into contact with one finite original corpse, with paid holding and ingestion', () => {
  const s = fixture(), c = s.groups[0].cohorts[0]; P.advance(s, 400, true, true);
  assert.ok(c.stores.foodKg > 0); assert.ok(c.regional.energy.lightKg > 0);
  assert.ok(Math.abs(c.regionalPosition.eastM - 100) <= .5); assert.ok(c.windDrift.hold);
  assert.ok(s.regions[0].foraging.receipts.eatenKg > 0); assert.equal(P.audit(s)['actual-prey-population'].dead, 1); valid(s);
});
test('away wind cannot steer to food, and a gust too strong to hold a corpse cannot fund remote feeding', () => {
  for (const wind of [{ x: -.5, y: 0 }, { x: 20, y: 0 }]) {
    const s = fixture({ wind }), c = s.groups[0].cohorts[0]; P.advance(s, 1000, true, true);
    assert.equal(c.stores.foodKg, 0); assert.ok(Math.abs(c.regionalPosition.eastM - Math.sign(wind.x) * 500) < 1e-5);
    assert.ok(!c.windDrift.hold); valid(s);
  }
});
test('known calm and unknown wind retain different records without granting transport', () => {
  for (const [wind, known] of [[null, false], [{ x: 0, y: 0 }, true]]) {
    const s = fixture({ wind }); P.advance(s, 1000, true, true);
    const c = s.groups[0].cohorts[0]; assert.equal(c.windDrift.known, known); assert.equal(c.regionalPosition.eastM, 0);
    assert.equal(c.stores.foodKg, 0); valid(s);
  }
});
test('partial wind motion and corpse custody survive saves and continued branches without rerolling or refilling', () => {
  const s = fixture(); P.advance(s, 150, true, true); valid(s);
  const saved = P.normalize(copy(s), binding), branch = P.rebind(saved, binding, { ...binding, runId: 'continued' });
  P.advance(s, 1000, true, true); P.advance(branch, 1000, true, true);
  assert.deepEqual(s.groups, branch.groups); assert.deepEqual(s.regions, branch.regions); assert.deepEqual(P.audit(s), P.audit(branch));
  valid(s); assert.ok(P.normalize(branch));
});
test('a damaged bladder stops advection without healing the original body or granting a directed departure', () => {
  const s = fixture(), g = s.groups[0], c = g.cohorts[0];
  c.regional.parts.bladder = 0; P.removeStock(s, g.regionId, 'waterL', 0, 0, 'actual-buoyancy-loss');
  P.advance(s, 1000, true, true); assert.equal(c.regionalPosition.eastM, 0); assert.equal(c.regional.parts.bladder, 0);
  assert.equal(g.transit, null); assert.equal(g.intention, null); valid(s);
});
test('crossings split existing cohorts without duplicating originals, positions, meal claims or asynchronous clocks', () => {
  const src = windSource({ members: 2, cohorts: 2, preyX: 10000 }), r = src.regions[0], other = copy(r);
  other.id = 'downwind'; other.edges = []; other.wildlife.pools.forEach(p => p.id += ':other'); src.regions.push(other);
  r.edges.push({ id: other.id, distanceKm: .2, traversable: true, windBoundary: { normal: { x: 1, y: 0 }, offsetM: 100,
    exit: { eastM: 100, northM: 0 }, entry: { eastM: -100, northM: 0 } } });
  const s = P.create(src, binding), split = P.normalize(copy(s), binding);
  P.advance(s, 1000, true, true);
  for (let t = 50; t <= 1000; t += 50) P.advance(split, t, true, true);
  const flocks = s.groups.filter(g => g.windDriven);
  assert.equal(flocks.length, 2); assert.equal(new Set(s.groups.map(g => g.id)).size, s.groups.length);
  assert.equal(flocks.reduce((n, g) => n + g.cohorts.reduce((m, c) => m + P.count(c), 0), 0), 2);
  assert.ok(flocks.every(g => g.regionId === other.id));
  assert.deepEqual(P.audit(s), P.audit(split));
  const round = x => JSON.parse(JSON.stringify(x, (key, value) => typeof value === 'number' ? Number(value.toPrecision(10)) : value));
  assert.deepEqual(round(s.groups), round(split.groups)); valid(s); valid(split);
});
test('wind, boundary planes, layout and held effort cannot be forged on import', () => {
  const s = fixture(); P.advance(s, 400, true, true); valid(s);
  for (const mutate of [x => x.groups[0].cohorts[0].windDrift.layout.columns = 0,
    x => x.groups[0].cohorts[0].windDrift.hold.effortRate = 0,
    x => x.groups[0].cohorts[0].windDrift.velocity.x = -.5,
    x => x.regions[0].wind.x = 'east', x => x.groups[0].windDriven = 'yes',
    x => x.groups[0].intention = { destination: 'ground', departAt: 1000, chosenAt: 0 }]) {
    const bad = copy(s); mutate(bad); assert.equal(P.normalize(bad), null);
  }
  const src = windSource(); src.regions[0].edges.push({ id: 'ground', distanceKm: 1, traversable: true,
    windBoundary: { normal: { x: 2, y: 0 }, offsetM: 100, exit: { eastM: 100, northM: 0 }, entry: { eastM: 0, northM: 0 } } });
  assert.throws(() => P.create(src, binding), /airflow/);
  const drift = fixture(); P.advance(drift, 100, true, true);
  const c = drift.groups[0].cohorts[0], d = c.windDrift;
  d.velocity = { x: 0, y: 0 }; c.regionalPosition = copy(d.anchor);
  d.signature = JSON.stringify([d.flow, d.velocity, 'ground', undefined]);
  assert.equal(P.normalize(drift), null, 'intact buoyancy cannot opt out of known wind');
});
test('detail releases the finite meal at the actual drift position, retains injuries and freezes after death', () => {
  const s = fixture(); P.advance(s, 400, true, true);
  const g = s.groups[0], c = g.cohorts[0], r = s.regions[0], pos = F.position(g, r, c, c.ranges[0][0]);
  c.regional.parts.membrane = 90;
  const food = c.stores.foodKg, light = c.regional.energy.lightKg, mass = c.massKg;
  const ctx = F.context(r, s.plans.at(-1).season);
  const actor = P.claimLocal(s, g.id, c.id, c.ranges[0][0], 'original-drifter', s.clock, { ...ctx,
    originalPosition: () => ({ regionId: r.id, cell: { x: Math.round(pos.eastM), y: Math.round(pos.northM), z: 6 }, altitudeM: pos.altitudeM }),
    originalReserves: () => ({ mana: c.regional.mana, stamina: c.regional.stamina, energy: copy(c.regional.energy) }) });
  assert.ok(actor); assert.equal(actor.life.stores.foodKg, food); assert.equal(actor.life.energy.lightKg, light);
  assert.equal(actor.bodyPhysics.massKg, mass); assert.equal(actor.bodyPhysics.parts.membrane, 90);
  assert.equal(Object.keys(r.foraging.meals).length, 0); assert.equal(P.audit(s)[g.populationId].detailed, 1); valid(s);
  const frozen = copy(s); P.advance(s, s.clock + P.DAY, false, true); assert.deepEqual(copy(s), frozen);
});
test('changed actual wind breaks a paid hold and releases tissue instead of feeding remotely', () => {
  const s = fixture(); P.advance(s, 400, true, true);
  const c = s.groups[0].cohorts[0], r = s.regions[0], eaten = r.foraging.receipts.eatenKg;
  assert.ok(c.windDrift.hold);
  r.wind = { x: 20, y: 0 }; P.removeStock(s, r.id, 'waterL', 0, s.clock, 'actual-gust');
  P.advance(s, 450, true, true);
  assert.ok(!c.windDrift.hold); assert.ok(c.regionalPosition.eastM > 120);
  assert.ok(r.foraging.receipts.eatenKg - eaten < .02);
  assert.equal(c.foraging.mealIds.length, 0); valid(s);
});
test('one million drifting originals keep their formation and use cohort-sized work', () => {
  const small = fixture({ members: 10 }), large = fixture({ members: 1000000 });
  const g = large.groups[0], c = g.cohorts[0], r = large.regions[0];
  const before = F.position(g, r, c, 999999), first = F.position(g, r, c, 0);
  P.advance(small, 100, true, true); P.advance(large, 100, true, true);
  const after = F.position(g, r, c, 999999), movedFirst = F.position(g, r, c, 0);
  assert.equal(after.eastM - before.eastM, 50); assert.equal(movedFirst.eastM - first.eastM, 50);
  assert.equal(after.northM - movedFirst.northM, before.northM - first.northM);
  const bounds = F.bounds(g, r, c);
  assert.ok(bounds.max.eastM >= after.eastM && bounds.max.northM >= after.northM);
  assert.ok(bounds.min.eastM <= movedFirst.eastM && bounds.min.northM <= movedFirst.northM);
  assert.ok(large.work.cohortIntervals <= small.work.cohortIntervals + 4);
  assert.equal(P.audit(large)[g.populationId].background, 1000000); valid(large);
});
test('large anonymous carcasses remain a finite field, not an anchoring body or hunt permission', () => {
  const src = windSource({ wind: { x: 0, y: 0 }, preyX: 10000 }), r = src.regions[0];
  delete r.wildlife; // Replace the helper's empty, zero-mass original definition before creating the account.
  W.apply(src, { allocations: [{ regionId: r.id, pools: [{ id: 'large-original-herd', guild: 'smallAnimals', sizeClass: 'large',
    foodKey: 'forageKg', areaHa: 10, habitatDepthM: 0, originalCount: 100000, originalMassKg: 10000000, capacityCount: 100000,
    spatial: { eastM: 0, northM: 0, radiusM: Math.sqrt(100000 / Math.PI), depthTopM: 0 } }] }] });
  const s = P.create(src, binding), g = s.groups[0], c = g.cohorts[0], region = s.regions[0];
  c.deathThreshold = 1e12; P.advance(s, P.DAY, true, true);
  for (let i = 0; i < 100 && c.foraging.phase !== 'eating'; i++) P.advance(s, s.nextEventAt, true, true);
  assert.equal(c.foraging.phase, 'eating'); assert.ok(c.foraging.mealIds.length); assert.ok(!c.windDrift.hold);
  const bad = copy(s); Object.values(bad.regions[0].foraging.meals)[0].field.radiusM *= 10; assert.equal(P.normalize(bad), null);
  const at = s.clock; region.wind = { x: .5, y: 0 }; P.removeStock(s, region.id, 'waterL', 0, at, 'actual-field-wind');
  P.advance(s, at + 600, true, true);
  assert.ok(c.regionalPosition.eastM > 1); assert.ok(!c.windDrift.hold);
  assert.ok(region.foraging.receipts.approachSeconds > 0, 'returning toward sensed tissue costs propulsion, not an imaginary field anchor');
  assert.equal(region.wildlife.pools[0].huntedCount, 0); assert.ok(region.wildlife.pools[0].deadCount > 0); valid(s);
});
test('opposing airflows meet at a saved front instead of oscillating across a border in microscopic steps', () => {
  const src = windSource({ preyX: 10000, members: 2 }), r = src.regions[0], other = copy(r);
  other.id = 'opposing-air'; other.wind = { x: -.5, y: 0 }; other.edges = [];
  other.wildlife.pools.forEach(p => p.id += ':opposing'); src.regions.push(other);
  r.edges.push({ id: other.id, distanceKm: .2, traversable: true, windBoundary: { normal: { x: 1, y: 0 }, offsetM: 100,
    exit: { eastM: 100, northM: 0 }, entry: { eastM: -100, northM: 0 } } });
  const s = P.create(src, binding); P.advance(s, 500, true, true);
  const c = s.groups[0].cohorts[0]; assert.equal(c.regionalPosition.eastM, 100); assert.ok(c.windDrift.front);
  assert.equal(s.groups[0].regionId, r.id); assert.ok(s.work.boundaries < 100); valid(s);
  const saved = P.normalize(s, binding); P.advance(saved, 1000, true, true); valid(saved);
  const group = saved.groups[0], original = group.cohorts[0];
  P.kill(saved, group.id, original.id, 0, saved.clock, 'actual-first-ordinal-loss');
  P.advance(saved, 1100, true, true); assert.ok(original.windDrift.front); assert.ok(saved.work.boundaries < 200); valid(saved);
  const bad = copy(saved); bad.groups[0].cohorts[0].windDrift.front.thereFlow.x = .5; assert.equal(P.normalize(bad), null);
  saved.regions[1].wind = { x: .5, y: 0 };
  P.removeStock(saved, other.id, 'waterL', 0, saved.clock, 'actual-wind-change');
  P.advance(saved, 1500, true, true); assert.equal(saved.groups[0].regionId, other.id); valid(saved);
});
test('a saved airflow front retains its actual historical formation extent after the final member dies', () => {
  const src = windSource({ preyX: 10000, members: 4, cohorts: 1 }), r = src.regions[0], other = copy(r);
  other.id = 'opposing-air'; other.wind = { x: -.5, y: 0 }; other.edges = [];
  other.wildlife.pools.forEach(p => p.id += ':opposing'); src.regions.push(other);
  r.edges.push({ id: other.id, distanceKm: .2, traversable: true, windBoundary: { normal: { x: 1, y: 0 }, offsetM: 100,
    exit: { eastM: 100, northM: 0 }, entry: { eastM: -100, northM: 0 } } });
  src.groups[0].home.eastKm = .096;
  const s = P.create(src, binding), g = s.groups[0], c = g.cohorts[0];
  assert.ok(c.windDrift.front); assert.equal(c.windDrift.layout.lastOrdinal, 3);
  for (let ordinal = 3; ordinal >= 0; ordinal--) {
    P.kill(s, g.id, c.id, ordinal, 10, 'actual-member-death'); valid(s);
  }
  const history = copy(c.windDrift); P.advance(s, 80 * P.DAY, true, true);
  assert.deepEqual(c.windDrift, history); valid(s);
  const forged = copy(s); forged.groups[0].cohorts[0].windDrift.layout.lastOrdinal = 4;
  assert.equal(P.normalize(forged), null);
});
