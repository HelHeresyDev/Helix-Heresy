const test = require('node:test'), assert = require('node:assert/strict');
const T = require('../carcass-tissues'), Lantern = require('../carrion-lantern-biology');
const F = require('../beast-foraging'), P = require('../beast-populations'), Foodweb = require('../beast-regional-foodweb');
const { windSource } = require('./helpers/wind-source');
const copy = x => JSON.parse(JSON.stringify(x)), DAY = 86400;
const lantern = { speciesId: Lantern.ID }, predator = { speciesId: 'beast:rimefang-pack' };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function remains(kg = 100, speciesId = 'beast:gravebloom-elk', inertKg = 0) {
  const r = { massKg: 0, edibleKg: 0, consumedKg: 0, decomposedKg: 0, lastAt: 0 };
  T.add(r, kg, speciesId, inertKg); return r;
}
test('a flesh eater leaves actual organs, fluids, hide and bones for the all-animal scavenger', () => {
  const r = remains(); near(T.take(r, predator, 1000).kg, 60);
  near(T.available(r, predator), 0); near(T.available(r, lantern), 40);
  near(r.tissues.hard.kg, 10); near(r.tissues.liver.kg, 2.5);
  const last = T.take(r, lantern, 1000); near(last.kg, 40);
  near(r.massKg, 0); near(r.consumedKg, 100); assert.ok(T.valid(r));
});
test('a declared organ specialist accepts its particular organ, not generic meat or other organs', () => {
  const r = remains(), specialist = { carrionDiet: ['liver'] };
  near(T.available(r, specialist), 2.5); near(T.take(r, specialist, 100).kg, 2.5);
  near(T.available(r, specialist), 0); near(T.take(r, specialist, 100).kg, 0);
  near(r.tissues.heart.kg, 1); near(r.tissues.flesh.kg, 60); assert.ok(T.valid(r));
});
test('wood, existing mineral stores, fungal crowns and non-biological armor do not become animal food', () => {
  const wood = remains(100, 'beast:ironroot-colossus'); near(T.take(wood, lantern, 1000).kg, 0);
  near(wood.massKg, 100); assert.ok(T.valid(wood));
  for (const species of ['quartzShardling', 'mudlet', 'rootling', 'sporecap', 'lanternWisp', 'hauntbound', 'zephyrMote', 'cinderling']) {
    const r = remains(100, species); near(T.take(r, lantern, 1000).kg, 0); assert.ok(T.valid(r));
  }
  const body = { speciesId: 'beast:burrowing-furnace', stores: { mineralsKg: 3 }, regional: { armourKg: 7 } };
  near(T.inertMatter(body), 10);
  const r = remains(100, body.speciesId, T.inertMatter(body));
  near(T.take(r, lantern, 10000).kg, 90); near(r.massKg, 10); assert.ok(T.valid(r));
  near(T.inertMatter({ speciesId: 'beast:candlecap-myriapod', life: { energy: { crownKg: .02 } } }), .02);
});
test('every typed Lantern meal conserves organic matter, water, light substrate, minerals and solid waste', () => {
  for (const key of T.animalKeys) {
    const tissue = T.nutrition(key, 2), meal = Lantern.partition(2, .2, tissue);
    near(Object.values(meal).reduce((n, kg) => n + kg, 0), 2);
    near(meal.water + meal.wasteWater, tissue.water);
    near(meal.food + meal.light, tissue.food); near(meal.minerals, tissue.minerals);
  }
  const bone = Lantern.partition(1, 100, T.nutrition('hard', 1));
  near(bone.food, .1); near(bone.water, .1); near(bone.minerals, .65);
});
test('hard remains take ten times as long to ingest and persist after faster soft-tissue decay', () => {
  const r = remains(), bones = { carrionDiet: ['hard'] };
  near(T.take(r, bones, 1).kg, .1);
  T.decay(r, 10); near(r.tissues.hard.kg, 9.9 * Math.exp(-.005 * 10));
  near(r.tissues.flesh.kg, 60 * Math.exp(-.1 * 10));
  near(r.tissues.fluids.kg, 10 * Math.exp(-.3 * 10));
  near(r.massKg + r.consumedKg + r.decomposedKg, 100); assert.ok(T.valid(r));
});
test('feeding and selective material extraction debit the same finite tissue; claims block other consumers', () => {
  const r = remains(), liver = { carrionDiet: ['liver'] };
  const claims = T.reserve(r, liver, 2); assert.deepEqual(claims, [{ tissue: 'liver', kg: 2 }]);
  near(T.take(r, liver, 100).kg, .5);
  T.decay(r, 1); near(r.tissues.liver.kg, 2, 'reserved organ is decayed only by its meal owner');
  assert.throws(() => T.debit(r, 'liver', 2));
  T.debit(r, 'liver', 1.5, .1, true); T.release(r, 'liver', .4);
  near(T.take(r, liver, 100).kg, .4); assert.ok(T.valid(r));
});
test('old partly consumed accounts retain only their disclosed remainder and cannot recreate bones', () => {
  const r = { massKg: 60, edibleKg: 20, initialEdibleKg: 60, consumedKg: 25, decomposedKg: 15, reservedKg: 0 };
  const before = copy(r); T.ensure(r); near(T.available(r, lantern), 20);
  assert.equal(r.tissues.hard, undefined); near(T.available(r, { carrionDiet: ['liver'] }), 0);
  T.take(r, lantern, 1000); near(r.massKg, 40); near(r.consumedKg, 45); assert.ok(T.valid(r));
  near(before.massKg + before.consumedKg + before.decomposedKg, r.massKg + r.consumedKg + r.decomposedKg);
});
test('a million deaths use a fixed number of tissue counters, not per-animal organ objects', () => {
  const small = remains(100), huge = remains(100 * 1000000);
  assert.equal(Object.keys(huge.tissues).length, Object.keys(small.tissues).length);
  assert.ok(JSON.stringify(huge).length < 2500); assert.ok(T.valid(huge));
});
test('typed carcass save branches are independent and malformed tissue accounts fail validation', () => {
  const r = remains(); T.take(r, predator, 10); const branch = copy(r); T.take(branch, lantern, 1000);
  near(r.consumedKg, 10); assert.ok(T.valid(r)); assert.ok(T.valid(branch));
  for (const change of [r => r.tissues.hard.kg++, r => r.tissues.liver.reservedKg = 100,
    r => r.tissues.flesh.initialKg++, r => r.inertKg = -1,
    r => { r.tissues.invented = r.tissues.legacy; delete r.tissues.legacy; }]) {
    const bad = copy(r); change(bad); assert.equal(T.valid(bad), false);
  }
});
function held() {
  const s = P.create(windSource(), { worldId: 'tissue-test', runId: 'original' });
  P.kill(s, s.groups[1].id, s.groups[1].cohorts[0].id, 0, 0, 'real-death');
  P.advance(s, 400, true, true); assert.ok(P.normalize(s)); return s;
}
test('a real feeding hold owns decaying structural tissue that other mouths cannot consume', () => {
  const s = held(), r = s.regions[0], c = s.groups[0].cohorts[0];
  const meal = r.foraging.meals[c.windDrift.hold.mealId], body = r.remainsBatches[meal.sourceId];
  assert.ok(meal.anchors.length); assert.ok(meal.anchors.every(a => a.decomposedKg > 0));
  near(T.take(body, { carrionDiet: ['hard', 'tough'] }, 1e6).kg, 0);
  for (const change of [x => x.regions[0].foraging.meals[meal.id].tissue = 'liver',
    x => x.regions[0].foraging.meals[meal.id].anchors[0].kg++,
    x => delete x.groups[0].cohorts[0].foraging.action.waterFraction]) {
    const bad = copy(s); change(bad); assert.equal(P.normalize(bad), null);
  }
  F.cancel(r, c, s.clock); assert.ok(T.available(body, { carrionDiet: ['hard'] }) > 0);
});
test('an untyped regional save continues its earned meal without reconstructing hard remains', () => {
  const binding = { worldId: 'old-tissues', runId: 'original' }, s = P.create(windSource(), binding);
  P.kill(s, s.groups[1].id, s.groups[1].cohorts[0].id, 0, 0, 'old-death');
  const row = Object.values(s.regions[0].remainsBatches)[0];
  delete row.tissues; delete row.inertKg; row.edibleKg = row.initialEdibleKg = row.massKg * .6;
  assert.ok(P.normalize(s)); P.advance(s, 400, true, true); assert.ok(P.normalize(s));
  const meal = Object.values(s.regions[0].foraging.meals)[0];
  // Older scheduled meals did not yet carry class/fraction metadata.
  delete meal.tissue; delete s.groups[0].cohorts[0].foraging.action.foodFraction;
  delete s.groups[0].cohorts[0].foraging.action.waterFraction;
  const resumed = P.normalize(s), branch = P.rebind(resumed, binding, { ...binding, runId: 'continued' });
  assert.ok(resumed); P.advance(resumed, 1000, true, true); P.advance(branch, 1000, true, true);
  assert.deepEqual(resumed.regions, branch.regions); assert.ok(P.normalize(resumed));
  const kept = Object.values(resumed.regions[0].remainsBatches)[0];
  assert.equal(kept.tissues.hard, undefined); near(kept.initialEdibleKg, 210); near(kept.inertKg, 140);
});
test('frozen typed claims and their anchors resume decomposition only after thaw, with partition-independent receipts', () => {
  const s = held(), r = s.regions[0], meal = Object.values(r.foraging.meals)[0], body = r.remainsBatches[meal.sourceId];
  body.frozenUntil = DAY; const original = copy(body), part = copy(s);
  F.decay(s, r, DAY); Foodweb.decay(s, r, body, DAY);
  near(body.decomposedKg, original.decomposedKg);
  F.decay(s, r, 2 * DAY); Foodweb.decay(s, r, body, 2 * DAY);
  const pr = part.regions[0], pb = pr.remainsBatches[meal.sourceId];
  for (const at of [DAY / 2, DAY, DAY * 1.25, DAY * 1.75, 2 * DAY]) {
    F.decay(part, pr, at); Foodweb.decay(part, pr, pb, at);
  }
  near(pb.massKg, body.massKg); near(pb.decomposedKg, body.decomposedKg);
  near(body.massKg + body.consumedKg + body.decomposedKg, 350); assert.ok(T.valid(body));
});
