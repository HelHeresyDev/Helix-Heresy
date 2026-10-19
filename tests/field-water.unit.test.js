const { test } = require('node:test');
const assert = require('node:assert/strict');
const Water = require('../field-water');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const s = Water.create(), node = { id: 'pool', litres: 35, quality: 'filterable' };
  s.sites.local = { worldId: 'world', nodes: [node] };
  Water.install(s, { worldId: 'world', siteId: 'local' }, 'plant', 0);
  return { s, node };
}
function intake(f) {
  assert(Water.inspect(f.node, 0)); assert(Water.collect(f.s, f.node, 'can', 1)); assert(Water.load(f.s, 'can', 2));
}
test('geography supports deterministic finite water, not guaranteed potable water or a source everywhere', () => {
  const c = { worldId: 'world', siteId: 'local', seed: 'water', truth: { potentialPermille: { freshWater: 1000 }, surfaceAccessibilityPermille: 1000 } };
  const b = { worldId: 'world', placeId: 'local', cells: [{ x: 1, y: 2, z: 0 }, { x: 2, y: 2, z: 0 }] };
  const a = Water.site(c, b, 'wild', () => true); assert.equal(a.nodes.length, 1);
  assert.deepEqual(Water.site(c, b, 'wild', () => true), a);
  assert.equal(Water.site({ ...c, truth: {} }, b, 'wild', () => true).nodes.length, 0);
  let checks = 0;
  Water.site(c, b, 'wild', () => { checks++; return true; }); assert.equal(checks, 1);
  Water.site({ ...c, truth: {} }, b, 'wild', () => { throw Error('Unsupported geography must not scan physical geometry'); });
  assert.equal(Water.site(c, b, 'wild', () => false).nodes.length, 0);
  assert.equal(Water.site({ ...c, worldId: 'other' }, b, 'wild', () => true), null);
  const qualities = new Set(Array.from({ length: 50 }, (_, seed) => Water.site({ ...c, seed }, b, 'wild', () => true).nodes[0].quality));
  assert.deepEqual([...qualities].sort(), ['chemical', 'filterable', 'magical']);
});
test('original inspected source, finite volume and empty original can are required', () => {
  const f = fixture(); assert.equal(Water.collect(f.s, f.node, 'can', 1), false);
  Water.inspect(f.node, 0);
  for (const quality of ['chemical', 'magical']) assert.equal(Water.collect(f.s, { ...f.node, quality }, 'can', 1), false);
  assert(Water.collect(f.s, f.node, 'can', 1)); assert.equal(f.node.litres, 30);
  assert.equal(Water.collect(f.s, f.node, 'can', 1), false);
  const saved = copy(f.s); assert.equal(saved.sites.local.nodes[0].litres, 30); assert.equal(saved.vessels.can.litres, 5);
  saved.plant.worldId = 'other'; assert.equal(Water.load(saved, 'can', 2), false);
  assert(Water.load(f.s, 'can', 2)); assert.equal(Water.vessel(f.s, 'can').litres, 0);
  f.node.litres = 4; assert.equal(Water.collect(f.s, f.node, 'can', 3), false);
});
test('empty installation, actual cartridge and exact 5-to-4-plus-1 batch conserve finite water', () => {
  const f = fixture(), p = f.s.plant;
  assert.equal(p.cleanL + p.rejectL + p.rawL, 0); assert.equal(p.filter, null);
  assert.equal(Water.install(f.s, { worldId: 'world', siteId: 'other' }, 'duplicate', 1), false);
  intake(f); assert(Water.treatmentReason(f.s)); assert(Water.loadFilter(f.s, 'original-cartridge', 3));
  assert(Water.beginBatch(f.s)); assert(Water.creditBatch(f.s, .4)); assert.equal(p.filter.remaining, 23);
  assert.equal(Water.finishBatch(f.s, 4), false); assert.equal(Water.loadFilter(f.s, 'replacement', 4), false);
  const saved = copy(f.s); assert(Water.creditBatch(saved, 1)); assert(Water.finishBatch(saved, 900));
  assert.deepEqual([saved.plant.rawL, saved.plant.cleanL, saved.plant.rejectL, saved.plant.filter.remaining], [0, 4, 1, 20]);
  assert.equal(Water.finishBatch(saved, 901), false); assert.equal(saved.history.filter(h => h.kind === 'treated').length, 1);
  assert(Water.drink(saved, 920, 'scientist')); assert.equal(saved.plant.cleanL, 3);
  assert(Water.drain(saved, 'can', 980)); assert.equal(saved.plant.rejectL, 0);
  assert.deepEqual(Water.vessel(saved, 'can'), { litres: 1, kind: 'reject', sourceId: 'plant' });
  assert.equal(Water.load(saved, 'can', 981), false); assert.equal(Water.collect(saved, saved.sites.local.nodes[0], 'can', 981), false);
});
test('full tanks, exhausted or changed filters block production without invented output', () => {
  const f = fixture(); Water.loadFilter(f.s, 'filter', 0); intake(f); const p = f.s.plant;
  p.cleanL = 17; assert.equal(Water.beginBatch(f.s), false); p.cleanL = 0;
  p.rejectL = 5; assert.equal(Water.beginBatch(f.s), false); p.rejectL = 0;
  p.filter.remaining = 4; assert.equal(Water.beginBatch(f.s), false); p.filter.remaining = 25;
  assert(Water.beginBatch(f.s)); Water.creditBatch(f.s, .5); const snapshot = copy(p);
  assert.equal(Water.creditBatch(f.s, .1), false); assert.deepEqual(p, snapshot);
  p.filter.id = 'substitute'; assert.equal(Water.creditBatch(f.s, 1), false);
  assert.equal(Water.finishBatch(f.s, 900), false); assert.equal(p.cleanL, 0);
  p.filter.id = p.batch.filterId; assert(Water.creditBatch(f.s, 1));
  p.filter.id = 'substitute'; assert.equal(Water.finishBatch(f.s, 900), false); assert.equal(p.cleanL, 0);
});
test('recurring consumption exhausts one cartridge and retains all reject; replacement grants no water', () => {
  const f = fixture(); Water.loadFilter(f.s, 'first', 0);
  for (let n = 0; n < 5; n++) {
    intake(f); assert(Water.beginBatch(f.s)); assert(Water.creditBatch(f.s, 1)); assert(Water.finishBatch(f.s, n + 1));
    assert(Water.drink(f.s, n + 2, 'resident'));
  }
  assert.deepEqual([f.node.litres, f.s.plant.cleanL, f.s.plant.rejectL, f.s.plant.filter.remaining], [10, 15, 5, 0]);
  intake(f); assert.equal(Water.beginBatch(f.s), false);
  const removed = Water.loadFilter(f.s, 'second', 50); assert.equal(removed.old.stackId, 'first'); assert.equal(removed.old.remaining, 0);
  assert.equal(f.s.plant.cleanL, 15); assert.equal(Water.beginBatch(f.s), false);
  assert(Water.drain(f.s, 'can', 51)); assert.equal(Water.vessel(f.s, 'can').litres, 5);
  assert(Water.beginBatch(f.s)); assert(Water.creditBatch(f.s, 1)); assert(Water.finishBatch(f.s, 60));
  assert.deepEqual([f.s.plant.cleanL, f.s.plant.rejectL, Water.vessel(f.s, 'can').litres], [19, 1, 5]);
  Water.observe(f.s, 'plant', { cleanL: 19 }, 60); Water.drink(f.s, 61, 'resident');
  assert.deepEqual(f.s.reports.plant, { at: 60, cleanL: 19 });
});
test('attendance, interruptions, death and serialization never backfill; partial original effort resumes once', () => {
  const s = Water.create(); let j = Water.job(s, 'treat', 'original', 900, 0);
  assert.equal(Water.advance(s, j, 100, true), 0); assert.equal(Water.advance(s, j, 200, true), 100);
  assert.equal(Water.advance(s, j, 300, false), 0); assert.equal(Water.advance(s, j, 900, true), 0);
  assert.equal(Water.advance(s, j, 950, true, false), 0);
  j = Water.job(s, 'treat', 'original', 900, 1000); assert.equal(j.required, 800);
  Water.advance(s, j, 1010, true); Water.advance(s, j, 1110, true);
  const saved = copy({ s, j }); Water.advance(s, j, 1810, true); Water.advance(saved.s, saved.j, 1210, true); Water.advance(saved.s, saved.j, 1810, true);
  assert.deepEqual(saved, { s, j }); assert(Water.finish(s, j)); assert.equal(Water.finish(s, j), false);
  assert.equal(Water.job(s, 'treat', 'different', 900, 2000).from, 0);
});
