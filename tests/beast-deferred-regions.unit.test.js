const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), W = require('../background-wildlife');
const { source: foodSource } = require('./helpers/regional-foodweb-source');
const clone = v => JSON.parse(JSON.stringify(v)), binding = { worldId: 'world', runId: 'deferred' };
function deferredSource(source, ids) {
  const originals = new Map(source.regions.map(r => [r.id, clone(r)])), cold = new Set(ids);
  const loader = { header(id) { return Object.assign(Object.create(originals.get(id)), { id, deferred: true }); },
    load(ids) { return ids.map(id => clone(originals.get(id))); } };
  const result = { ...clone(source), nativeEncounters: true,
    regions: source.regions.map(r => cold.has(r.id) ? loader.header(r.id) : clone(r)) };
  Object.defineProperty(result, '_deferredLoader', { value: loader });
  return result;
}
function sources() {
  const eager = foodSource([]), r = eager.regions[0]; r.id = 'unvisited'; r.edges = [];
  r.renewalPerDay = { forageKg: 100, organicKg: 100, waterL: 100 };
  W.apply(eager, { allocations: [{ regionId: r.id, pools: [{ id: 'original-herd', guild: 'smallAnimals',
    foodKey: 'forageKg', areaHa: 100, habitatDepthM: 0, capacityCount: 150, originalCount: 100, originalMassKg: 200 }] }] });
  const original = clone(eager), byId = new Map(original.regions.map(r => [r.id, r]));
  const loader = { header(id) { return Object.assign(Object.create(byId.get(id)), { id, deferred: true }); },
    load(ids) { return ids.map(id => clone(byId.get(id))); } };
  const deferred = { ...clone(original), nativeEncounters: true, regions: original.regions.map(r => loader.header(r.id)) };
  Object.defineProperty(deferred, '_deferredLoader', { value: loader });
  return { eager, deferred, loader };
}
test('unvisited habitat executes its original elapsed wildlife history before a monthly-boundary read', () => {
  const { eager, deferred } = sources(), a = P.create(eager, binding), b = P.create(deferred, binding), until = 32 * P.DAY;
  P.advance(a, until, true, true); P.advance(b, until);
  assert.equal(b.regions[0].deferred, true); assert.equal(Object.hasOwn(b.regions[0], 'wildlife'), false);
  assert.ok(JSON.stringify(b).length < JSON.stringify(a).length);
  assert.equal(P.settleRegions(b, until, ['unvisited']), true);
  assert.equal(b.regions[0].deferred, undefined);
  assert.deepEqual(b.regions[0], a.regions[0]); assert.deepEqual(b.rates.unvisited, a.rates.unvisited);
  assert.ok(P.normalize(b, binding));
  const before = clone(b.regions[0]); P.settleRegions(b, until, ['unvisited']); assert.deepEqual(b.regions[0], before);
});
test('bounded event batches and mid-batch saves preserve the direct elapsed result', () => {
  const { deferred } = sources(), a = P.create(deferred, binding);
  const { deferred: second } = sources(), b = P.create(second, binding), until = 32 * P.DAY;
  P.advance(a, until);
  let chunks = 0;
  while (!P.advanceBudget(b, until, 1)) {
    assert.ok(P.normalize(b, binding), `partial chunk ${chunks}`);
    assert.ok(b.clock <= until); if (++chunks > 200) throw Error('Unbounded calendar work');
  }
  assert.ok(chunks > 1); assert.deepEqual(clone(b), clone(a));
  P.settleRegions(a, until, ['unvisited']); P.settleRegions(b, until, ['unvisited']);
  assert.deepEqual(b.regions[0], a.regions[0]);
});
test('deferred source recipes are required on restore and partial elapsed reads do not refill resources', () => {
  const { deferred, loader, eager } = sources(), a = P.create(eager, binding), b = P.create(deferred, binding);
  P.advance(b, P.DAY / 3); const saved = clone(b);
  assert.equal(P.normalize(saved, binding), null);
  const restored = P.normalize(saved, binding, loader); assert.ok(restored);
  P.settleRegions(restored, P.DAY / 3, ['unvisited']); P.advance(a, P.DAY / 3, true, true);
  assert.deepEqual(restored.regions[0], a.regions[0]);
  assert.equal(P.removeStock(restored, 'unvisited', 'waterL', 20, P.DAY / 3, 'actual-drinking'), true);
  const water = restored.regions[0].stocks.waterL;
  P.settleRegions(restored, P.DAY / 3, ['unvisited']); assert.equal(restored.regions[0].stocks.waterL, water);
});
test('an instinctive migrant enters the same elapsed habitat without advance destination knowledge', () => {
  const source = foodSource([['gravebloom-elk', 0, 1]]), cold = clone(source.regions[0]);
  cold.id = 'destination'; cold.stocks.forageKg = 0; cold.renewalPerDay = { forageKg: 100 };
  source.regions.push(cold);
  source.regions[0].edges = [{ id: cold.id, distanceKm: 2, traversable: true }];
  source.groups[0].instinct = { mode: 'instinctive', route: [cold.id] };
  const eager = P.create(source, binding), lazy = P.create(deferredSource(source, [cold.id]), binding);
  assert.deepEqual(lazy.groups[0].intention, eager.groups[0].intention);
  assert.deepEqual(lazy.groups[0].knowledge, []);
  assert.equal(lazy.regions[1].deferred, true);
  const depart = eager.groups[0].intention.departAt;
  P.advance(eager, depart); P.advance(lazy, depart);
  const arrival = eager.groups[0].transit.edgeArriveAt;
  P.advance(eager, arrival); P.advance(lazy, arrival);
  P.settleRegions(eager, arrival, source.regions.map(r => r.id));
  P.settleRegions(lazy, arrival, source.regions.map(r => r.id));
  assert.equal(lazy.groups[0].regionId, cold.id);
  assert.deepEqual(lazy.groups[0], eager.groups[0]);
  assert.deepEqual(lazy.regions, eager.regions);
  assert.ok(lazy.groups[0].knowledge.every(k => k.source === 'personalArrival' && k.at === arrival));
  assert.ok(P.normalize(lazy, binding));
});
test('a cold hydraulic component catches up together without touching an unrelated region', () => {
  const source = require('./helpers/regional-work-source').source('buildDam'); source.groups = [];
  const unrelated = clone(source.regions[1]); unrelated.id = 'unrelated'; unrelated.edges = [];
  source.regions.push(unrelated);
  const eager = P.create(source, binding), lazy = P.create(deferredSource(source, source.regions.map(r => r.id)), binding);
  const untouched = JSON.stringify(lazy.regions[2]), until = 32 * P.DAY;
  P.advance(eager, until, true, true); P.advance(lazy, until);
  P.settleRegions(lazy, until, ['downstream']);
  assert.deepEqual(lazy.regions.slice(0, 2), eager.regions.slice(0, 2));
  assert.ok(lazy.regions[1].receipts.waterL > 0);
  assert.equal(lazy.regionClocks.workface.appliedAt, until);
  assert.equal(lazy.regionClocks.downstream.appliedAt, until);
  assert.equal(JSON.stringify(lazy.regions[2]), untouched);
  assert.ok(P.normalize(lazy, binding));
});
