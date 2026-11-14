const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), G = require('../beast-demography'), D = require('../creature-biology');
const L = require('../creature-life'), W = require('../wilderness-beasts');
const { source, run } = require('../scripts/benchmark-beast-demography');
const clone = x => JSON.parse(JSON.stringify(x)), DAY = P.DAY, binding = { worldId: 'world', runId: 'run' };
const approx = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) <= epsilon * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const first = s => s.groups[0].cohorts[0];
const births = s => s.births.reduce((n, b) => n + b.count, 0);
function young(speciesId = 'beast:rimefang-pack') {
  const src = source(1, speciesId); delete src.groups[0].breeding;
  const c = src.groups[0].cohorts[0]; c.role = 'juvenile'; c.ageDays = 0; c.massKg = D.lifecycle[speciesId].newbornKg;
  src.regions[0].renewalPerDay = {};
  const s = P.create(src, binding); first(s).deathThreshold = 1e9; return s;
}
test('growth adds only assimilated physical surplus after maintenance, with conserved mass and waste', () => {
  const s = young(), r = s.regions[0], initialBody = first(s).massKg;
  const physical = () => r.stocks.foodKg + r.stocks.waterL + r.stocks.mineralsKg + first(s).massKg
    + Object.values(r.outputs || {}).reduce((n, kg) => n + kg, 0);
  const before = physical(); P.advance(s, 10 * DAY, true, true);
  assert.ok(first(s).massKg > initialBody); assert.ok(r.outputs.growthWasteKg > 0);
  approx(physical(), before); assert.ok(P.normalize(s));
});
test('maintenance wins competition with growth, and age alone grants neither mass nor maturity', () => {
  const s = young(), c = first(s), r = s.regions[0], mass = c.massKg;
  P.removeStock(s, r.id, 'foodKg', r.stocks.foodKg, 0, 'original-food-absent');
  r.renewalPerDay.foodKg = c.needs.foodKg;
  // Rebuild through the existing exact physical-supply interruption interface.
  P.removeStock(s, r.id, 'waterL', 0, 0, 'maintenance-only-flow');
  P.advance(s, 300 * DAY, true, true);
  approx(c.massKg, mass); assert.equal(G.mature({ ...c, bornAt: -400 * DAY }, s.clock), false);
  assert.equal(r.outputs?.growthWasteKg || 0, 0); assert.equal(births(s), 0);
});
test('energy cannot be a body-matter recipe and absent charge prevents paid electrical-body growth', () => {
  assert.equal(G.recipeValid({ excessMana: 1 }), false); assert.equal(G.recipeValid({ heatMJ: 1 }), false);
  const s = young('beast:storm-kite'), r = s.regions[0], mass = first(s).massKg;
  P.removeStock(s, r.id, 'chargeMJ', r.stocks.chargeMJ, 0, 'no-actual-weather-charge');
  P.advance(s, 20 * DAY, true, true); approx(first(s).massKg, mass);
  assert.equal(r.outputs?.growthWasteKg || 0, 0);
});
test('funded integer birth batches wait for actual incubation and retain source identities without newborn records per body', () => {
  const s = P.create(source(10000, 'beast:rimefang-pack'), binding);
  P.advance(s, 2 * DAY, true, true);
  const brood = first(s).demography.broods[0]; assert.ok(brood && brood.investedKg > 0);
  assert.equal(births(s), 0);
  P.advance(s, brood.dueAt - 1, true, true); assert.equal(births(s), 0);
  P.advance(s, brood.dueAt, true, true); assert.ok(births(s) > 0);
  assert.ok(s.groups[0].cohorts.filter(c => c.generated).every(c => Number.isSafeInteger(P.count(c)) && c.massKg === D.lifecycle[c.speciesId].newbornKg));
  assert.ok(s.births.length <= 2); assert.ok(Object.keys(s.origins).length <= 4); assert.ok(P.normalize(s));
  const audit = P.audit(s)['original-population']; assert.equal(audit.background + audit.dead + audit.detailed, 10000 + births(s));
});
test('local mate access, parental roles and real nursery capacity cannot be replaced by a population total', () => {
  for (const change of [s => s.regions[0].nurseries[0].mateAccess = false,
    s => s.groups[0].cohorts[1].count = 0, s => s.regions[0].nurseries[0].capacity = 0,
    s => delete s.groups[0].breeding, s => s.groups[0].cohorts[0].role = 'worker']) {
    const src = source(200, 'beast:rimefang-pack'); change(src);
    const s = P.create(src, binding); P.advance(s, 100 * DAY, true, true);
    assert.equal(births(s), 0); assert.ok(s.groups[0].cohorts.every(c => !c.demography?.broods.length));
  }
});
test('original dependent young occupy their recorded receiving nursery before another brood can start', () => {
  const src = source(200, 'beast:rimefang-pack'), p = D.lifecycle['beast:rimefang-pack'];
  src.regions[0].nurseries[0].capacity = 10;
  src.groups[0].cohorts.push({ id: 'original-young', speciesId: p.id, count: 10, ageDays: 0,
    massKg: p.newbornKg, role: 'juvenile', nurseryId: 'original-nursery' });
  const s = P.create(src, binding); P.advance(s, DAY, true, true);
  assert.equal(first(s).demography.broods.length, 0);
  assert.equal(s.groups[0].cohorts.find(c => c.id === 'original-young').nurseryId, 'original-nursery');
  assert.ok(P.normalize(s));
});
test('a linked nursery reads only the living same-colony furnace without copying or refilling it', () => {
  const s = P.create(source(200, 'beast:ember-ant'), binding), g = s.groups[0], r = s.regions[0];
  Object.assign(r.nurseries[0], { workSiteId: 'actual-furnace', colonyId: 'hive', furnaceKg: 999 });
  const site = { id: 'actual-furnace', colonyId: 'hive', furnaceKg: 2 };
  r.ecology = { workSites: [site] };
  assert.equal(G.site(s, g, 0).furnaceKg, 2); assert.equal(r.nurseries[0].furnaceKg, 999);
  site.furnaceKg = .5; assert.equal(G.site(s, g, 0).furnaceKg, .5);
  site.colonyId = 'another-hive'; assert.equal(G.site(s, g, 0).furnaceKg, 0);
  site.colonyId = 'hive'; site.destroyedAt = 0; assert.equal(G.site(s, g, 0).furnaceKg, 0);
});
test('attempt budgets use elapsed days over 365 rather than the supplied calendar year', () => {
  const src = source(100, 'beast:storm-kite'); src.calendar.monthDays = [1, 2, 3, 4];
  src.regions[0].nurseries[0].mateAccess = false;
  const s = P.create(src, binding); s.groups[0].cohorts.forEach(c => c.deathThreshold = 1e9);
  P.advance(s, 30 * DAY, true, true);
  approx(first(s).demography.credit, 50 * D.lifecycle['beast:storm-kite'].attempts365 * 30 / 365);
  assert.equal(births(s), 0);
});
test('killed parents and destroyed nurseries dispose only already invested material, without resource refunds', () => {
  const s = P.create(source(2000, 'beast:mire-choir'), binding); P.advance(s, 5 * DAY, true, true);
  const c = first(s), b = c.demography.broods[0], perParent = b.investedKg / G.size(b.parents), ordinal = b.parents[0][0];
  const stock = s.regions[0].stocks.foodKg;
  assert.equal(P.kill(s, 'group-0', c.id, ordinal, s.clock, 'actual-predation'), true);
  approx(s.regions[0].outputs.failedRecruitmentKg, perParent); assert.equal(s.regions[0].stocks.foodKg, stock);
  assert.equal(G.contains(b.parents, ordinal), false);
  assert.equal(P.destroyNursery(s, 'habitat', 'original-nursery', s.clock, 'original-nesting-bed-burned'), true);
  assert.ok(first(s).demography.broods.length === 0); assert.equal(P.destroyNursery(s, 'habitat', 'original-nursery', s.clock, 'duplicate'), false);
  P.advance(s, 60 * DAY, true, true); assert.equal(births(s), 0); assert.ok(P.normalize(s));
});
test('missing extra materials stalls an actual brood instead of spending maintenance reserves or granting a birth', () => {
  const s = P.create(source(1000, 'beast:storm-kite'), binding); P.advance(s, 2 * DAY, true, true);
  const b = first(s).demography.broods[0], invested = b.investedKg, r = s.regions[0];
  P.removeStock(s, r.id, 'foodKg', r.stocks.foodKg, s.clock, 'food-source-lost');
  r.renewalPerDay.foodKg = 0; P.removeStock(s, r.id, 'waterL', 0, s.clock, 'source-interrupted');
  P.advance(s, b.dueAt, true, true);
  assert.equal(births(s), 0); approx(b.investedKg, invested);
});
test('queen batches use one supplied original queen and same-colony mates, never the worker count', () => {
  const src = source(10001, 'beast:ember-ant'), p = D.lifecycle['beast:ember-ant'];
  src.groups[0].cohorts = [
    { id: 'queen', speciesId: p.id, count: 1, ageDays: p.fertileDays, massKg: p.breederKg, role: 'queen', colonyId: 'hive' },
    { id: 'males', speciesId: p.id, count: 2, ageDays: p.fertileDays, massKg: p.adultKg, role: 'male', colonyId: 'hive' },
    { id: 'workers', speciesId: p.id, count: 10000, ageDays: p.adultDays, massKg: p.adultKg, role: 'worker', colonyId: 'hive' }
  ];
  Object.assign(src.regions[0].nurseries[0], { colonyId: 'hive', furnaceKg: 5, capacity: 1000000 });
  const s = P.create(src, binding); P.advance(s, 3 * DAY, true, true);
  const broods = first(s).demography.broods;
  assert.equal(broods.length, 3); assert.ok(broods.every(b => G.size(b.parents) === 1));
  assert.ok(s.groups[0].cohorts.slice(1).every(c => !c.demography?.broods.length));
  const noHive = clone(src); noHive.regions[0].nurseries[0].furnaceKg = 0;
  const unavailable = P.create(noHive, binding); P.advance(unavailable, 20 * DAY, true, true); assert.equal(births(unavailable), 0);
});
test('fragmentation partitions parental mass, and environmental/artificial core families gain no parental recruitment', () => {
  const src = source(100, 'beast:brine-cathedral'); src.regions[0].nurseries[0].mateAccess = false;
  const s = P.create(src, binding), before = first(s).massKg;
  G.init(first(s)).credit = 1; P.advance(s, DAY, true, true);
  const b = first(s).demography.broods[0]; assert.ok(b.fragment);
  approx((before - first(s).massKg) * P.count(first(s)), b.investedKg);
  for (const speciesId of ['rootling', 'mudlet', 'homunculus', 'quartzShardling']) {
    const original = source(100, speciesId); const a = P.create(original, binding);
    P.advance(a, 60 * DAY, true, true); assert.equal(births(a), 0);
  }
});
test('reloading and arbitrary read chunking preserve paid growth, conception batches, deaths and births', () => {
  const src = source(1000), whole = P.create(src, binding); P.advance(whole, 50 * DAY, true, true);
  let split = P.create(src, binding);
  for (let at = DAY / 4; at <= 50 * DAY; at += DAY / 4) {
    P.advance(split, at, true, true); split = P.normalize(clone(split), binding); assert.ok(split, `normal at ${at}`);
  }
  assert.deepEqual(P.audit(split), P.audit(whole)); assert.deepEqual(split.births, whole.births);
  assert.equal(split.groups[0].cohorts.length, whole.groups[0].cohorts.length);
  for (const key of Object.keys(whole.regions[0].stocks)) approx(split.regions[0].stocks[key], whole.regions[0].stocks[key]);
  for (let i = 0; i < whole.groups[0].cohorts.length; i++) {
    approx(split.groups[0].cohorts[i].massKg, whole.groups[0].cohorts[i].massKg);
    approx(split.groups[0].cohorts[i].structuralKg, whole.groups[0].cohorts[i].structuralKg);
  }
});
test('large headcounts use compact natural/scarcity death intervals instead of per-animal records', () => {
  const src = source(1000000, 'beast:rimefang-pack'); delete src.groups[0].breeding;
  const s = P.create(src, binding); P.advance(s, 30 * DAY, true, true);
  assert.ok(P.audit(s)['original-population'].dead > 1000); assert.equal(s.losses.length, 0); assert.ok(s.lossBatches.length <= 2);
  for (const key of ['foodKg', 'waterL', 'mineralsKg']) {
    P.removeStock(s, 'habitat', key, s.regions[0].stocks[key], s.clock, 'all-original-supply-lost'); s.regions[0].renewalPerDay[key] = 0;
  }
  P.removeStock(s, 'habitat', 'foodKg', 0, s.clock, 'settle-source-loss');
  P.advance(s, 100 * DAY, true, true);
  assert.equal(P.audit(s)['original-population'].dead, 1000000); assert.equal(s.losses.length, 0); assert.ok(s.lossBatches.length <= 4);
  assert.ok(JSON.stringify(s).length < 30000); assert.ok(P.normalize(s));
});
test('headcount scaling stays batch-sized while additional independent groups cost additional work', () => {
  const small = run(1000, 1, 120), huge = run(1000000, 1, 120), divided = run(1000000, 5, 120);
  assert.ok(huge.cohortIntervals < small.cohortIntervals * 3);
  assert.ok(huge.serializedBytes < small.serializedBytes * 3);
  assert.ok(huge.birthRecords <= 2 && huge.deathRecords <= 4);
  assert.ok(divided.cohortIntervals > huge.cohortIntervals * 2);
});
test('detailed maternal handoff retains paid incubation and recruits each physical offspring exactly once', () => {
  const s = P.create(source(2000, 'beast:mire-choir'), binding); P.advance(s, 5 * DAY, true, true);
  const c = first(s), b = c.demography.broods[0], ordinal = b.successful[0][0], expected = G.size(b.successful) * D.lifecycle[c.speciesId].offspring;
  const due = b.dueAt, terrain = () => ({ floor: true, waterDepthM: 0, supportKg: 1e9, ceilingM: 100, oxygen: true });
  const a = P.claimLocal(s, 'group-0', c.id, ordinal, 'original-mother', s.clock, { alive: true, local: true, terrain, tileSizeM: 1,
    blocked: () => false, originalPosition: () => ({ regionId: 'habitat', cell: { x: -5, y: 0, z: 6 } }),
    originalReserves: () => ({ mana: 0, stamina: 250, energy: { heatMJ: 0, chargeMJ: 0, focus: 0, crownKg: 0, lightKg: 0 } }) });
  assert.ok(a.life.populationBroods.length); const transferred = a.life.populationBroods[0], required = transferred.requiredKg - transferred.investedKg;
  assert.ok(transferred.investedKg > 0); assert.equal(G.contains(b.parents, ordinal), false);
  assert.equal(P.removeStock(s, 'habitat', 'foodKg', required, s.clock, 'actual-carried-embryo-food'), true);
  approx(L.feed(a, 'foodKg', required), required);
  const children = [], at = s.clock;
  const notCarriedByMother = clone(a);
  L.advanceReproduction(notCarriedByMother, due, due - at, { alive: true, local: true, habitatSuitable: true, recruit: () => { throw Error('No original nursery was accessible'); } });
  assert.deepEqual(notCarriedByMother.life.populationBroods, a.life.populationBroods);
  L.advanceReproduction(a, due, due - at, { alive: true, local: true, habitatSuitable: true,
    populationNurseryAccessible: r => r.sourceNurseryId === 'original-nursery' && s.regions[0].nurseries[0].enabled !== false,
    recruit(data) {
      const child = W.actor(data.speciesId, data.id, { x: children.length, y: 1, z: 6 }, a.populationId, due, data);
      assert.equal(child.bodyPhysics.mana, 0);
      if (!P.registerLocalBirth(s, a.id, child, due)) return false;
      assert.equal(P.registerLocalBirth(s, a.id, child, due), true);
      children.push(child); return true;
    }, waste() {} });
  assert.equal(children.length, D.lifecycle[c.speciesId].offspring);
  assert.equal(births(s), expected); assert.equal(a.life.populationBroods.length, 0);
  assert.ok(P.normalize(s));
  assert.equal(P.audit(s)['original-population'].detailed, 1 + children.length);
  const continued = P.rebind(s, binding, { worldId: 'world', runId: 'continued' });
  assert.deepEqual(continued.details, s.details);
  const before = clone(s); P.advance(s, due + DAY, false, true); assert.deepEqual(s, before);
});
test('controlled cohort merging preserves counts, matter, active broods and original identity intervals', () => {
  const p = D.lifecycle['beast:rimefang-pack'], g = { cohorts: Array.from({ length: 200 }, (_, i) => ({
    id: `batch-${i}`, originId: 'one-birth-stream', speciesId: p.id, generated: true, role: 'female', colonyId: null,
    ranges: [[i * 1000, (i + 1) * 1000]], bornAt: i * 10 * DAY, massKg: p.adultKg,
    structuralKg: p.adultKg * .8, health: 1, stores: { foodKg: 0, mineralsKg: 0, fatKg: p.adultKg * .1, waterL: p.adultKg * .1 },
    deathExposure: 0, mortalityBalance: .5, aggregateMortality: true, batchHazard: 0, batchMembers: 1000,
    demography: { credit: .2, serial: 1, cooldowns: [{ until: 30000 * DAY, ranges: [[i * 1000, i * 1000 + 1]] }],
      broods: [{ id: `old-brood-${i}`, parents: [[i * 1000, i * 1000 + 1]] }] }
  })) };
  const beforeMass = g.cohorts.reduce((n, c) => n + c.massKg * P.count(c), 0);
  G.compact(g, 20000 * DAY);
  assert.ok(g.cohorts.length < 10);
  assert.equal(g.cohorts.reduce((n, c) => n + P.count(c), 0), 200000);
  approx(g.cohorts.reduce((n, c) => n + c.massKg * P.count(c), 0), beforeMass);
  assert.equal(g.cohorts.reduce((n, c) => n + c.demography.broods.length, 0), 200);
  assert.deepEqual(G.union(g.cohorts.flatMap(c => c.ranges)), [[0, 200000]]);
  assert.ok(g.cohorts.some(c => c.birthSpan && c.birthSpan[1] > c.birthSpan[0]));
});
test('corrupt brood investment, source membership and cached extra rates are rejected without reconstruction', () => {
  const s = P.create(source(2000, 'beast:mire-choir'), binding); P.advance(s, 5 * DAY, true, true);
  const overpaid = clone(s); first(overpaid).demography.broods[0].investedKg *= 1000; assert.equal(P.normalize(overpaid), null);
  const invented = clone(s); first(invented).demography.broods[0].parents = [[9999999, 10000000]]; assert.equal(P.normalize(invented), null);
  const free = clone(s); free.extraRates[0].factor = 20; assert.equal(P.normalize(free), null);
});
test('loss of a live-bearing nursery does not itself kill a living mother or delete her funded gestation', () => {
  const s = P.create(source(2000, 'beast:rimefang-pack'), binding); P.advance(s, 5 * DAY, true, true);
  const b = first(s).demography.broods[0], invested = b.investedKg;
  P.destroyNursery(s, 'habitat', 'original-nursery', s.clock, 'calving-ground-lost');
  assert.ok(first(s).demography.broods.includes(b)); assert.equal(b.investedKg, invested);
  assert.equal(s.regions[0].outputs.failedRecruitmentKg || 0, 0); assert.ok(P.count(first(s)) > 0);
});
test('known source sex/colony roles remain meaningful after detailing rather than making every body a mother', () => {
  const p = D.lifecycle['beast:mire-choir'];
  const female = W.actor(p.id, 'known-mother', { x: 0, y: 0, z: 6 }, 'pop', 0, { role: 'female', ageDays: p.fertileDays });
  const male = W.actor(p.id, 'known-mate', { x: 2, y: 0, z: 6 }, 'pop', 0, { role: 'male', ageDays: p.fertileDays });
  assert.equal(L.eligible(female), true); assert.equal(L.eligible(female, true), false);
  assert.equal(L.eligible(male), false); assert.equal(L.eligible(male, true), true);
});
test('funded live gestation follows actual travel residence rather than leaving its matter at the old nursery', () => {
  const src = source(2000, 'beast:rimefang-pack'), away = clone(src.regions[0]); away.id = 'away';
  src.regions[0].edges = [{ id: 'away', distanceKm: 1, traversable: true }];
  away.edges = [{ id: 'habitat', distanceKm: 1, traversable: true }]; src.regions.push(away);
  const s = P.create(src, binding); P.advance(s, 5 * DAY, true, true);
  const c = first(s), b = c.demography.broods[0], ordinal = b.parents[0][0];
  s.groups[0].intention = { destination: 'away', chosenAt: s.clock, departAt: s.clock + 1 };
  P.removeStock(s, 'habitat', 'foodKg', 0, s.clock, 'actual-departure-scheduled');
  P.advance(s, 5.1 * DAY, true, true);
  assert.equal(s.groups[0].regionId, 'away'); assert.equal(b.regionId, 'away');
  P.kill(s, 'group-0', c.id, ordinal, s.clock, 'actual-away-predation');
  assert.ok(s.regions[1].outputs.failedRecruitmentKg > 0);
  assert.equal(s.regions[0].outputs.failedRecruitmentKg || 0, 0); assert.ok(P.normalize(s));
});
