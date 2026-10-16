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
test('delegated construction uses the actual authorized worker and their exact carried tools, never scientist impersonation', () => {
  const f = fixture(); f.c.actorId = 'builder:b'; f.c.employmentAuthorized = true;
  assert.equal(Station.plan(f.saved, f.part.id, f.c, f.tools, f.inputs), null);
  for (const t of f.tools) { t.tool.carriedBy = 'builder:b'; t.stack.carriedBy = 'builder:b'; }
  const j = begin(f); assert.equal(j.actorId, 'builder:b');
  assert.match(Station.reason(f.saved, j, { ...f.c, actorId: 'scientist' }, f.tools, f.stacks), /original working person/);
  assert.match(Station.reason(f.saved, j, { ...f.c, employmentAuthorized: false }, f.tools, f.stacks), /explicit current/);
  assert.equal(Station.plan(f.saved, f.part.id, f.c, f.tools, f.inputs, 'repair'), null);
});
test('delegated receipts and cancellation effort remain private until a dated physical inspection', () => {
  const f = fixture(); f.c.actorId = 'builder:b'; f.c.employmentAuthorized = true;
  for (const t of f.tools) { t.tool.carriedBy = 'builder:b'; t.stack.carriedBy = 'builder:b'; }
  const j = begin(f); Station.advance(f.saved, j, f.c, f.tools, f.stacks, 1); Station.advance(f.saved, j, f.c, f.tools, f.stacks, 101);
  assert(Station.finish(f.saved, j, f.c, f.tools, f.stacks, 101, 'real-wall'));
  assert(!Station.publicView(f.saved).history.some(r => r.physicalId === 'real-wall'));
  assert(!Station.publicView(f.saved).receipts.some(r => r.physicalId === 'real-wall'));
  Station.observe(f.saved, 101, { parts: {} }); assert(!Station.publicView(f.saved).history.some(r => r.physicalId === 'real-wall'));
  Station.observe(f.saved, 101, { parts: { [f.part.id]: { at: 101 } } }); assert(Station.publicView(f.saved).history.some(r => r.physicalId === 'real-wall'));
  assert(Station.publicView(f.saved).receipts.some(r => r.physicalId === 'real-wall'));
});
test('older personally known installation manifests remain visible even without duplicate history rows', () => {
  const f = fixture(); f.saved.site.parts[f.part.id] = { partId: f.part.id, physicalId: 'old-known-wall', at: 1 };
  assert.equal(Station.publicView(f.saved).receipts[0].physicalId, 'old-known-wall');
});
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

function damaged(kind = 'wall', condition = 20, present = true) {
  const f = fixture(); f.part = f.l.parts.find(p => p.kind === kind);
  f.saved.site.parts[f.part.id] = { at: 0, physicalId: 'original', partId: f.part.id };
  f.saved.site.effort[f.part.id] = 1;
  f.c.target = { id: 'original', present, condition: present ? condition : null, stamp: present ? 0 : null,
    original: true, visible: true, goodsRemain: false };
  return f;
}
function maintenance(f, operation = 'repair') {
  const part = Station.workPart(f.saved, f.part.id, operation);
  f.inputs = Object.entries(part.costs).map(([key, quantity], i) => ({ stackId: `input-${i}`, key, quantity, cell: f.l.rest }));
  f.stacks = [...f.inputs.map(i => ({ ...i, id: i.stackId, section: 'resources', roomId: 'forest', reservedTaskId: '', carriedBy: '' })), ...f.tools.map(t => t.stack)];
  const plan = Station.plan(f.saved, f.part.id, f.c, f.tools, f.inputs, operation); assert(plan);
  const j = Station.begin(plan, 'maintenance-1', 0, f.tools);
  f.stacks.filter(i => i.section === 'resources').forEach(i => i.reservedTaskId = j.taskId);
  return j;
}
function delegatedRepair(kind = 'wall') {
  const f = damaged(kind); f.c.actorId = 'builder:b'; f.c.employmentAuthorized = true;
  f.c.commission = { operation: 'repair', partId: f.part.id, targetKey: Station.targetKey(f.c) };
  for (const t of f.tools) { t.tool.carriedBy = f.c.actorId; t.stack.carriedBy = f.c.actorId; }
  return f;
}
test('delegated maintenance authorizes only the exact signed repair, original target and actual worker tools', () => {
  const f = delegatedRepair(), j = maintenance(f);
  for (const commission of [null, { ...f.c.commission, operation: 'build' }, { ...f.c.commission, partId: 'another' }, { ...f.c.commission, targetKey: 'changed' }])
    assert.match(Station.reason(f.saved, j, { ...f.c, commission }, f.tools, f.stacks), /exact component commission/);
  assert(Station.reason(f.saved, j, { ...f.c, employmentAuthorized: false }, f.tools, f.stacks));
  const g = delegatedRepair(), other = maintenance(g);
  Station.cancel(g.saved, other, g.tools, g.stacks, 0);
  assert.equal(Station.plan(g.saved, g.part.id, g.c, g.tools, g.inputs, 'reconstruct'), null);
  for (const t of g.tools) { t.tool.carriedBy = 'scientist'; t.stack.carriedBy = 'scientist'; }
  assert.equal(Station.plan(g.saved, g.part.id, g.c, g.tools, g.inputs, 'repair'), null);
});
test('delegated repairs preserve installation identity, exact effort and private receipts through serialization', () => {
  let f = delegatedRepair('cache'), j = maintenance(f); const original = copy(f.saved.site.parts[f.part.id]);
  Station.advance(f.saved, j, f.c, f.tools, f.stacks, 1); Station.advance(f.saved, j, f.c, f.tools, f.stacks, 51);
  ({ f, j } = copy({ f, j })); f.tools.forEach(t => t.stack = f.stacks.find(i => i.id === t.stack.id));
  assert.equal(Station.effort(f.saved, f.part.id, 'repair', f.c), .5);
  Station.advance(f.saved, j, f.c, f.tools, f.stacks, 101);
  assert(Station.finish(f.saved, j, f.c, f.tools, f.stacks, 101, 'original'));
  assert.deepEqual(f.saved.site.parts[f.part.id], original); assert.equal(f.saved.history.at(-1).actorId, 'builder:b');
  assert(!Station.publicView(f.saved).history.some(r => r.operation === 'repair'));
  Station.observe(f.saved, 101, { parts: { [f.part.id]: { at: 101 } } });
  assert(Station.publicView(f.saved).history.some(r => r.operation === 'repair'));
  assert(!Station.finish(f.saved, j, f.c, f.tools, f.stacks, 102, 'original'));
});
test('cancelled unchanged delegated repairs retain effort but a changed commissioned target discards only stale effort', () => {
  const f = delegatedRepair(), j = maintenance(f);
  Station.advance(f.saved, j, f.c, f.tools, f.stacks, 1); Station.advance(f.saved, j, f.c, f.tools, f.stacks, 51);
  Station.cancel(f.saved, j, f.tools, f.stacks, 51);
  Station.clearChangedEffort(f.saved, f.part.id, { ...f.c.target, visible: false });
  assert.equal(Station.effort(f.saved, f.part.id, 'repair', f.c), .5);
  f.saved.site.maintenanceEffort['repair:other'] = { targetKey: 'other', fraction: .7 };
  Station.clearChangedEffort(f.saved, f.part.id, { ...f.c.target, stamp: 2, visible: false });
  assert.equal(Station.effort(f.saved, f.part.id, 'repair', f.c), 0);
  assert.equal(f.saved.site.maintenanceEffort['repair:other'].fraction, .7);
});
test('repairs match primary material, retain actual roofing tools and never reuse construction effort', () => {
  for (const kind of ['floor', 'wall', 'roof', 'door', 'cache']) {
    const f = damaged(kind), p = Station.workPart(f.saved, f.part.id, 'repair');
    assert.deepEqual(p.costs, { [kind === 'floor' || kind === 'wall' ? 'stoneBlocks' : 'lumber']: 1 });
    assert.equal(p.seconds, Math.max(180, f.part.seconds / 2)); assert.deepEqual(p.tools, f.part.tools);
    const j = maintenance(f); assert.equal(j.from, 0); assert.equal(j.operation, 'repair');
  }
});
test('surviving exhausted components can be repaired; full, missing, unseen or unrelated ones cannot', () => {
  const f = damaged('roof', 0); const j = maintenance(f); assert(j);
  for (const target of [{ condition: 100 }, { present: false }, { visible: false }, { original: false }])
    assert(Station.reason(f.saved, j, { ...f.c, target: { ...f.c.target, ...target } }, f.tools, f.stacks));
  assert.equal(Station.workPart(f.saved, f.part.id, 'replaceAnything'), null);
});
test('a repair receipts the unchanged original exactly once without replacing its installation record', () => {
  const f = damaged('cache'), original = copy(f.saved.site.parts[f.part.id]), j = maintenance(f);
  Station.advance(f.saved, j, f.c, f.tools, f.stacks, 1); Station.advance(f.saved, j, f.c, f.tools, f.stacks, 101);
  assert(Station.finish(f.saved, j, f.c, f.tools, f.stacks, 101, 'original'));
  assert.deepEqual(f.saved.site.parts[f.part.id], original); assert.equal(f.saved.history.at(-1).operation, 'repair');
  assert.equal(Station.finish(f.saved, j, f.c, f.tools, f.stacks, 102, 'duplicate'), false);
});
test('maintenance cancellation and real serialization preserve partial effort and exact claims', () => {
  let f = damaged(), j = maintenance(f);
  Station.advance(f.saved, j, f.c, f.tools, f.stacks, 1); Station.advance(f.saved, j, f.c, f.tools, f.stacks, 51);
  ({ f, j } = copy({ f, j })); f.tools.forEach(t => t.stack = f.stacks.find(i => i.id === t.stack.id));
  assert.equal(Station.reason(f.saved, j, f.c, f.tools, f.stacks), '');
  assert(Station.cancel(f.saved, j, f.tools, f.stacks, 51));
  assert.equal(Station.effort(f.saved, f.part.id, 'repair', f.c), .5);
  assert.equal(f.tools[0].tool.current, 99); assert(f.stacks.every(i => !i.reservedTaskId));
  assert.equal(Station.effort(f.saved, f.part.id, 'repair', { target: { ...f.c.target, condition: 10 } }), 0);
  const next = maintenance(f); assert.equal(next.from, .5); assert.equal(next.tools[0].wear, 1);
});
test('changed target identity, damage or presence interrupts work instead of repairing its replacement', () => {
  for (const wrong of [{ id: 'replacement' }, { stamp: 999 }, { condition: 19 }, { present: false }]) {
    const f = damaged(), j = maintenance(f);
    Station.advance(f.saved, j, f.c, f.tools, f.stacks, 1);
    const c = { ...f.c, target: { ...f.c.target, ...wrong } };
    Station.advance(f.saved, j, c, f.tools, f.stacks, 10000); assert.equal(j.progress, 0);
    assert.equal(Station.finish(f.saved, j, c, f.tools, f.stacks, 10000, 'replacement'), false);
  }
});
test('maintenance cannot backfill absence, threats, custody, incapacity or a changed body/visit/trip', () => {
  for (const wrong of [{ local: false }, { alive: false }, { capable: false }, { free: false }, { threatened: true },
    { worldId: 'other' }, { roomId: 'home' }, { bodyEpoch: 2 }, { visitId: 'later' }, { tripId: 'later' }, { materialsLocal: false }, { atHead: false }]) {
    const f = damaged(), j = maintenance(f);
    Station.advance(f.saved, j, f.c, f.tools, f.stacks, 1);
    Station.advance(f.saved, j, { ...f.c, ...wrong }, f.tools, f.stacks, 10000);
    Station.advance(f.saved, j, f.c, f.tools, f.stacks, 10001); assert.equal(j.progress, 0);
  }
});
test('reconstruction needs a truly missing original, full fresh cost and actual structural support', () => {
  const f = damaged('wall', 0, false), j = maintenance(f, 'reconstruct');
  assert.deepEqual(j.inputs.map(i => [i.key, i.quantity]), [['stoneBlocks', 2]]); assert.equal(j.from, 0);
  assert(Station.reason(f.saved, j, { ...f.c, floorsIntact: false }, f.tools, f.stacks));
  assert(Station.reason(f.saved, j, { ...f.c, target: { ...f.c.target, present: true } }, f.tools, f.stacks));
  Station.advance(f.saved, j, f.c, f.tools, f.stacks, 1); Station.advance(f.saved, j, f.c, f.tools, f.stacks, 101);
  assert(Station.finish(f.saved, j, f.c, f.tools, f.stacks, 101, 'new-wall'));
  assert.equal(f.saved.site.parts[f.part.id].physicalId, 'new-wall'); assert.equal(f.saved.history.at(-1).operation, 'reconstruct');
});
test('missing-crate reconstruction refuses orphan goods while repair preserves the original loaded crate', () => {
  const f = damaged('cache', 0, false); f.c.target.goodsRemain = true;
  const p = Station.workPart(f.saved, f.part.id, 'reconstruct'); assert.deepEqual(p.costs, { lumber: 3, metalParts: 1 });
  assert.match(Station.maintenanceReason(f.saved, p, f.c, 'reconstruct'), /recover all goods/);
  f.c.target.present = true; f.c.target.condition = 0;
  assert.equal(Station.maintenanceReason(f.saved, p, f.c, 'repair'), '');
});
test('completed repair effort cannot finish on another physical object or during a new threat', () => {
  const f = damaged(), j = maintenance(f);
  Station.advance(f.saved, j, f.c, f.tools, f.stacks, 1); Station.advance(f.saved, j, f.c, f.tools, f.stacks, 101);
  assert.equal(Station.finish(f.saved, j, f.c, f.tools, f.stacks, 101, 'different-object'), false);
  assert.equal(Station.finish(f.saved, j, { ...f.c, threatened: true }, f.tools, f.stacks, 101, 'original'), false);
  assert.equal(j.status, 'working'); assert.equal(f.stacks[0].quantity, 1);
  assert(Station.finish(f.saved, j, f.c, f.tools, f.stacks, 102, 'original'));
  // Applying the physical improvement is the adapter's responsibility. Even
  // before its condition changes, a later job receives no old repair effort.
  assert.equal(Station.effort(f.saved, f.part.id, 'repair', f.c), 0);
});
test('observed intervening damage permanently invalidates old work even if condition later matches again', () => {
  const f = damaged(), j = maintenance(f);
  Station.advance(f.saved, j, f.c, f.tools, f.stacks, 1); Station.advance(f.saved, j, f.c, f.tools, f.stacks, 51);
  assert.equal(Station.effort(f.saved, f.part.id, 'repair', f.c), .5);
  const changed = { ...f.c, target: { ...f.c.target, condition: 10 } };
  Station.advance(f.saved, j, changed, f.tools, f.stacks, 52);
  assert.equal(j.invalidated, true); assert.equal(Station.effort(f.saved, f.part.id, 'repair', f.c), 0);
  Station.advance(f.saved, j, f.c, f.tools, f.stacks, 1000); assert.equal(j.progress, 50);
  assert(Station.reason(f.saved, j, f.c, f.tools, f.stacks));
  Station.cancel(f.saved, j, f.tools, f.stacks, 1000);
  const next = maintenance(f); assert.equal(next.from, 0);
});
