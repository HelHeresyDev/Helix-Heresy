const { test } = require('node:test');
const assert = require('node:assert/strict');
const Station = require('../field-station');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const saved = Station.create(), l = Station.layout({ x: 26, y: 14, z: 23 });
  const c = { local: true, wilderness: true, alive: true, capable: true, free: true, observed: true, clear: true, busy: false,
    siteId: 'wild', worldId: 'world', roomId: 'forest', bodyEpoch: 1, visitId: 'visit', tripId: 'trip',
    geometryOkay: true, reachable: true, floorsIntact: true, wallsIntact: true, roofsIntact: true, doorPresent: true,
    materialsLocal: true, cell: l.rest, workCell: l.rest, seconds: 100, staminaCost: 1, stamina: 80, atHead: true, threatened: false };
  Station.register(saved, { siteId: 'wild', worldId: 'world', cityId: 'b', roomId: 'forest', strategicCellId: 'cell' }, l, c, 0);
  const tools = ['masonryHammer', 'stoneChisel', 'handSaw', 'foldingLadder'].map(key => ({ key,
    tool: { id: `tool-${key}`, current: 100, carriedBy: 'scientist', reservedTaskId: '' },
    stack: { id: `tool-stack-${key}`, key, quantity: 1, toolInstanceId: `tool-${key}`, carriedBy: 'scientist', reservedTaskId: '' } }));
  const part = l.parts.find(p => p.kind === 'wall');
  const inputs = [{ stackId: 'stone', key: 'stoneBlocks', quantity: 2, cell: l.rest }];
  const stacks = [{ id: 'stone', key: 'stoneBlocks', section: 'resources', quantity: 2, roomId: 'forest', cell: l.rest, reservedTaskId: '', carriedBy: '', fixtureId: '', containerId: '' }, ...tools.map(t => t.stack)];
  return { saved, l, c, tools, part, inputs, stacks };
}
function begin(f) {
  const plan = Station.plan(f.saved, f.part.id, f.c, f.tools, f.inputs); assert(plan);
  const j = Station.begin(plan, 'task-1', 0, f.tools); f.stacks[0].reservedTaskId = j.taskId; return j;
}
test('shared theme content grants no station, staff, supplies or political rights', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const s = Station.create(theme); assert.equal(s.sourceTheme, 'shared'); assert.equal(s.site, null); assert.equal(Station.publicView(s), null);
  }
});
test('home packing lists only actual owned home supplies, never parked overseas stock', () => {
  const item = { roomId: 'lab', section: 'resources', key: 'lumber', quantity: 2 };
  const rooms = ['lab', 'loading'];
  assert.equal(Station.homeSupply(item, rooms), true);
  assert.equal(Station.homeSupply({ ...item, roomId: 'loading' }, rooms), true);
  for (const wrong of [{ roomId: 'foreign-station' }, { roomId: 'municipal-reserve' }, { carriedBy: 'scientist' },
    { reservedTaskId: 'other' }, { cityOwnerId: 'city' }, { civicCustody: { institutionId: 'works' } },
    { quantity: 0 }, { section: 'specimens' }, { key: 'assayReagent' }])
    assert.equal(Station.homeSupply({ ...item, ...wrong }, rooms), false);
  assert.equal(Station.homeSupply(null, rooms), false);
});
test('compact layout has real interior, connected door/apron, crate port and finite per-piece costs', () => {
  const l = fixture().l; assert.equal(l.footprint.length, 12); assert.equal(l.walls.length, 9); assert.equal(l.floors.length, 3); assert.equal(l.roofs.length, 12);
  assert.equal(l.parts.length, 26); assert.equal(l.cache.x, l.rest.x); assert.equal(l.cache.y + 1, l.rest.y);
  assert.equal(l.rest.y + 1, l.door.y); assert.equal(l.door.y + 1, l.apron.y);
  assert(!l.walls.some(c => c.x === l.door.x && c.y === l.door.y));
  assert.deepEqual(l.parts.reduce((s, p) => { for (const [k, n] of Object.entries(p.costs)) s[k] = (s[k] || 0) + n; return s; }, {}), { stoneBlocks: 21, lumber: 16, metalParts: 1 });
  assert(l.roofs.every(c => c.z === 24)); assert(l.parts.filter(p => p.kind === 'roof').every(p => p.tools.foldingLadder));
});
test('registration needs actual clear inspected foreign wilderness, not municipal sampling permission', () => {
  const f = fixture();
  for (const bad of ['local', 'wilderness', 'alive', 'capable', 'free', 'observed', 'clear']) {
    const s = Station.create(); assert.equal(Station.register(s, f.saved.site, f.l, { ...f.c, [bad]: false }, 1), false); assert.equal(s.site, null);
  }
  assert.equal(Station.register(f.saved, f.saved.site, f.l, f.c, 1), false);
});
test('materials, physical prerequisites and exact usable owned carried tools are mandatory', () => {
  const f = fixture();
  for (const wrong of [{ floorsIntact: false }, { free: false }, { reachable: false }, { geometryOkay: false }, { busy: true }, { threatened: true }, { worldId: 'other' }, { stamina: 0 }])
    assert.equal(Station.plan(f.saved, f.part.id, { ...f.c, ...wrong }, f.tools, f.inputs), null);
  assert.equal(Station.plan(f.saved, f.part.id, f.c, f.tools, []), null);
  assert.equal(Station.plan(f.saved, f.part.id, f.c, [], f.inputs), null);
  f.tools[0].tool.current = 1; assert.equal(Station.plan(f.saved, f.part.id, f.c, f.tools, f.inputs), null);
  const roof = f.l.parts.find(p => p.kind === 'roof'); assert(Station.prerequisite(f.saved.site, roof, { ...f.c, wallsIntact: false }));
  const cache = f.l.parts.find(p => p.kind === 'cache'); assert(Station.prerequisite(f.saved.site, cache, { ...f.c, doorPresent: false }));
});
test('arrival, absence, threats, custody, competing work and changed original identity never backfill effort', () => {
  const f = fixture(), j = begin(f);
  Station.advance(f.saved, j, { ...f.c, cell: f.l.apron }, f.tools, f.stacks, 1000); assert.equal(j.progress, 0);
  Station.advance(f.saved, j, f.c, f.tools, f.stacks, 1001); Station.advance(f.saved, j, f.c, f.tools, f.stacks, 1026); assert.equal(j.progress, 25);
  for (const wrong of [{ local: false }, { alive: false }, { capable: false }, { free: false }, { siteId: 'other' }, { worldId: 'other' },
    { bodyEpoch: 2 }, { visitId: 'new' }, { tripId: 'new' }, { roomId: 'home' }, { threatened: true }, { atHead: false }, { materialsLocal: false }, { geometryOkay: false }]) {
    Station.advance(f.saved, j, { ...f.c, ...wrong }, f.tools, f.stacks, j.lastAt + 1000);
    Station.advance(f.saved, j, f.c, f.tools, f.stacks, j.lastAt + 1); assert.equal(j.progress, 25);
  }
  assert.deepEqual(f.saved.site.parts, {}); assert.equal(f.stacks[0].quantity, 2);
});
test('saved exact claims and partial effort finish once; real material consumption belongs to the physical adapter', () => {
  let f = fixture(), j = begin(f);
  Station.advance(f.saved, j, f.c, f.tools, f.stacks, 1); Station.advance(f.saved, j, f.c, f.tools, f.stacks, 51);
  assert.equal(j.progress, 50); assert.equal(f.tools[0].tool.current, 99); assert.equal(f.saved.site.effort[f.part.id], .5);
  ({ f, j } = copy({ f, j })); f.tools.forEach(t => t.stack = f.stacks.find(i => i.id === t.stack.id));
  assert.equal(Station.reason(f.saved, j, f.c, f.tools, f.stacks), '');
  Station.advance(f.saved, j, f.c, f.tools, f.stacks, 101);
  assert.equal(Station.finish(f.saved, j, f.c, f.tools, f.stacks, 101, 'actual-wall'), true);
  assert.equal(f.tools[0].tool.current, 98); assert.equal(f.saved.site.parts[f.part.id].physicalId, 'actual-wall');
  assert.equal(Station.finish(f.saved, j, f.c, f.tools, f.stacks, 102, 'duplicate'), false);
  assert(f.tools.every(t => !t.tool.reservedTaskId && !t.stack.reservedTaskId)); assert(!f.stacks[0].reservedTaskId);
});
test('cancellation releases exact unused items but retains physical work and wear for a fresh supplied attempt', () => {
  const f = fixture(), j = begin(f);
  Station.advance(f.saved, j, f.c, f.tools, f.stacks, 1); Station.advance(f.saved, j, f.c, f.tools, f.stacks, 51);
  assert.equal(Station.cancel(f.saved, j, f.tools, f.stacks, 51), true); assert.equal(Station.cancel(f.saved, j, f.tools, f.stacks, 52), false);
  assert.equal(f.saved.site.effort[f.part.id], .5); assert.equal(f.tools[0].tool.current, 99); assert.equal(f.stacks[0].quantity, 2);
  const next = Station.plan(f.saved, f.part.id, { ...f.c, seconds: 50 }, f.tools, f.inputs);
  assert.equal(next.from, .5); assert.equal(next.tools[0].wear, 1); assert.deepEqual(f.saved.site.parts, {});
});
test('moved, inflated, stolen or unavailable exact supplies/tools cannot complete a component', () => {
  for (const kind of ['quantity', 'ownership', 'moved', 'reserved', 'tool']) {
    const f = fixture(), j = begin(f);
    if (kind === 'quantity') f.stacks[0].quantity = 3;
    if (kind === 'ownership') f.stacks[0].cityOwnerId = 'city';
    if (kind === 'moved') f.stacks[0].cell = f.l.apron;
    if (kind === 'reserved') f.stacks[0].reservedTaskId = 'other';
    if (kind === 'tool') f.tools[0].tool.carriedBy = 'other';
    assert(Station.reason(f.saved, j, f.c, f.tools, f.stacks));
    Station.advance(f.saved, j, f.c, f.tools, f.stacks, 10000); assert.equal(j.progress, 0);
  }
});
test('a coarse final step may exhaust the exact hammer but cannot exceed its remaining budget', () => {
  const f = fixture(); f.tools[0].tool.current = 2;
  const j = begin(f);
  Station.advance(f.saved, j, f.c, f.tools, f.stacks, 1);
  Station.advance(f.saved, j, f.c, f.tools, f.stacks, 10001);
  assert.equal(j.progress, 100); assert.equal(f.tools[0].tool.current, 0);
  assert.equal(Station.finish(f.saved, j, f.c, f.tools, f.stacks, 10001, 'original-wall'), true);
  assert.equal(f.tools[0].tool.current, 0);
});
test('a new visit/body may supply remaining physical work but cannot inherit the old personal task', () => {
  const f = fixture(), j = begin(f);
  Station.advance(f.saved, j, f.c, f.tools, f.stacks, 1);
  Station.advance(f.saved, j, f.c, f.tools, f.stacks, 51);
  const nextContext = { ...f.c, bodyEpoch: 2, visitId: 'later-visit', tripId: 'later-trip', seconds: 50 };
  assert(Station.reason(f.saved, j, nextContext, f.tools, f.stacks));
  assert.equal(Station.finish(f.saved, j, nextContext, f.tools, f.stacks, 1000, 'unearned-wall'), false);
  Station.cancel(f.saved, j, f.tools, f.stacks, 1000);
  const next = Station.plan(f.saved, f.part.id, nextContext, f.tools, f.inputs);
  assert.equal(next.from, .5); assert.equal(next.bodyEpoch, 2); assert.equal(next.required, 50);
  assert.deepEqual(f.saved.site.parts, {}); assert.equal(f.stacks[0].quantity, 2);
});
test('away public records stay dated and contain no live actor, inventory or private world state', () => {
  const f = fixture(); Station.observe(f.saved, 10, { inventory: { at: 10, goods: [{ id: 'water', quantity: 1 }] }, parts: {} });
  f.saved.site.privateThreat = 'hidden'; const view = Station.publicView(f.saved);
  const restored = copy(f.saved); assert.deepEqual(Station.publicView(restored), view);
  view.observations.inventory.goods[0].quantity = 99; assert.equal(f.saved.observations.inventory.goods[0].quantity, 1);
  assert(!JSON.stringify(view).includes('privateThreat')); assert(!JSON.stringify(view).includes('layout'));
});
