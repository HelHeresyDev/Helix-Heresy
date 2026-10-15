const { test, expect } = require('@playwright/test');
const Stone = require('../surface-stone');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const cell = { x: 27, y: 13, z: 23 }, workCell = { x: 26, y: 13, z: 23 };
  const context = { worldId: 'world', siteId: 'wild', strategicCellId: 'cell', seed: 'stone', truth: {
    potentialPermille: { constructionStone: 1000 }, typicalDepth: { constructionStone: 'exposed' }, surfaceAccessibilityPermille: 1000 } };
  const baseline = { worldId: 'world', placeId: 'wild', rocks: [cell] };
  const site = Stone.create(context, baseline), node = site.nodes[0];
  const c = { wilderness: true, controlled: false, worldId: 'world', siteId: 'wild', roomId: 'forest', cell: workCell,
    bodyEpoch: 1, visitId: 'visit', tripId: 'trip', alive: true, capable: true, free: true, busy: false,
    reachable: true, visible: true, workCell, seconds: 100, staminaCost: 8, stamina: 80, atHead: true, threatened: false };
  const tools = Object.keys(Stone.WEAR).map(key => ({ key, tool: { id: `tool-${key}`, current: 50, carriedBy: 'scientist', reservedTaskId: '' },
    stack: { id: `stack-${key}`, key, toolInstanceId: `tool-${key}`, quantity: 1, carriedBy: 'scientist', reservedTaskId: '' } }));
  return { context, baseline, site, node, c, tools };
}
function start(f, action = 'recover') {
  if (action === 'recover') f.node.inspected = { at: 0, workable: true, bodyEpoch: 1 };
  return Stone.begin(Stone.plan(f.site, f.node, action, f.c, f.tools), 'task-1', 0, f.tools);
}
test('finite stone uses actual world/site/exposed geography and no survey or reload roll', () => {
  const f = fixture(), before = copy(f);
  expect(f.node.remaining).toBeGreaterThan(0);
  expect(Stone.create(f.context, f.baseline)).toEqual(f.site); expect(copy(f)).toEqual(before);
  expect(Stone.create(f.context, { ...f.baseline, worldId: 'other' })).toBeNull();
  expect(Stone.create(f.context, { ...f.baseline, placeId: 'elsewhere' })).toBeNull();
  for (const truth of [null, { ...f.context.truth, typicalDepth: { constructionStone: 'deep' } },
    { ...f.context.truth, potentialPermille: {} }, { ...f.context.truth, surfaceAccessibilityPermille: 0 }]) {
    const s = Stone.create({ ...f.context, truth }, f.baseline);
    expect(s === null || s.nodes.every(n => n.remaining === 0)).toBe(true);
  }
  expect(Stone.create(f.context, { ...f.baseline, rocks: [] }).nodes).toEqual([]);
});
test('knowledge exposes inspected local evidence only, never hidden units, potential or exact reserves', () => {
  const f = fixture(); expect(Stone.publicView(f.site).observations).toEqual([]);
  const j = start(f, 'inspect'); Stone.advance(f.site, j, f.c, f.tools, 1); Stone.advance(f.site, j, f.c, f.tools, 101);
  expect(Stone.finish(f.site, j, f.c, f.tools, 101)).toMatchObject({ action: 'inspect', quantity: 0 });
  const view = Stone.publicView(f.site); expect(view.observations[0].inspected.workable).toBe(true);
  expect(JSON.stringify(view)).not.toMatch(/"(remaining|potentialPermille|seed|typicalDepth)":/);
  expect(Stone.publicView(copy(f.site))).toEqual(view);
  expect(Stone.plan(f.site, f.node, 'inspect', f.c, f.tools)).toBeNull();
});
test('controlled municipal sampling and unsupported personal work grant no extraction', () => {
  const f = fixture(); f.node.inspected = { workable: true };
  for (const wrong of [{ controlled: true }, { wilderness: false }, { alive: false }, { capable: false }, { free: false },
    { busy: true }, { reachable: false }, { visible: false }, { siteId: 'home' }, { worldId: 'other' }, { stamina: 0 }])
    expect(Stone.plan(f.site, f.node, 'recover', { ...f.c, ...wrong }, f.tools)).toBeNull();
  expect(Stone.plan(f.site, { ...f.node }, 'recover', f.c, f.tools)).toBeNull();
  f.node.inspected = null; expect(Stone.plan(f.site, f.node, 'recover', f.c, f.tools)).toBeNull();
});
test('original usable carried hammer and chisel are mandatory, no remote or replacement equipment', () => {
  const f = fixture(); f.node.inspected = { workable: true };
  for (const field of ['missing', 'broken', 'remote', 'reserved', 'wrongStack', 'noStack']) {
    const tools = copy(f.tools);
    if (field === 'missing') tools.pop();
    if (field === 'broken') tools[0].tool.current = 3;
    if (field === 'remote') tools[0].tool.carriedBy = '';
    if (field === 'reserved') tools[0].stack.reservedTaskId = 'other';
    if (field === 'wrongStack') tools[0].stack.toolInstanceId = 'replacement';
    if (field === 'noStack') tools[0].stack = null;
    expect(Stone.plan(f.site, f.node, 'recover', f.c, tools)).toBeNull();
  }
});
test('travel, absence, threats and incompatible work pause without backfill or deadline completion', () => {
  const f = fixture(), j = start(f), original = f.node.remaining;
  Stone.advance(f.site, j, { ...f.c, cell: { x: 20, y: 12, z: 23 } }, f.tools, 1000);
  expect(j.progress).toBe(0); expect(Stone.finish(f.site, j, f.c, f.tools, 1000, 'output')).toBeNull();
  Stone.advance(f.site, j, f.c, f.tools, 1001); Stone.advance(f.site, j, f.c, f.tools, 1026); expect(j.progress).toBe(25);
  for (const wrong of [{ atHead: false }, { threatened: true }, { free: false }, { capable: false }, { siteId: 'elsewhere' },
    { tripId: 'other' }, { visitId: 'other' }, { bodyEpoch: 2 }, { roomId: 'home' }, { alive: false }]) {
    const before = j.progress;
    Stone.advance(f.site, j, { ...f.c, ...wrong }, f.tools, j.lastAt + 10000);
    Stone.advance(f.site, j, f.c, f.tools, j.lastAt + 1); expect(j.progress).toBe(before);
  }
  expect(f.node.remaining).toBe(original);
});
test('actual partial work wears tools, real save retains claims, completion depletes once and releases exact originals', () => {
  let f = fixture(), j = start(f); const original = f.node.remaining;
  Stone.advance(f.site, j, f.c, f.tools, 1); Stone.advance(f.site, j, f.c, f.tools, 51);
  expect(j.progress).toBe(50); expect(f.tools.map(t => t.tool.current)).toEqual([48, 47]);
  ({ f, j } = copy({ f, j })); f.node = f.site.nodes[0];
  expect(Stone.reason(f.site, j, f.c, f.tools)).toBe(''); Stone.advance(f.site, j, f.c, f.tools, 101);
  expect(Stone.finish(f.site, j, f.c, f.tools, 101, 'block-1')).toMatchObject({ outputId: 'block-1', quantity: 1 });
  expect(f.node.remaining).toBe(original - 1); expect(f.tools.map(t => t.tool.current)).toEqual([46, 44]);
  expect(f.tools.every(t => !t.tool.reservedTaskId && !t.stack.reservedTaskId)).toBe(true);
  expect(Stone.finish(f.site, j, f.c, f.tools, 500, 'block-2')).toBeNull(); expect(f.node.receipts).toHaveLength(1);
});
test('cancellation retains spent wear, consumes no stone and releases both claims without output', () => {
  const f = fixture(), j = start(f), initial = f.node.remaining;
  Stone.advance(f.site, j, f.c, f.tools, 1); Stone.advance(f.site, j, f.c, f.tools, 51);
  expect(Stone.cancel(j, f.tools, 51)).toBe(true); expect(Stone.cancel(j, f.tools, 52)).toBe(false);
  expect(f.tools.map(t => t.tool.current)).toEqual([48, 47]); expect(f.node.remaining).toBe(initial);
  expect(Stone.finish(f.site, j, f.c, f.tools, 200, 'never')).toBeNull(); expect(f.node.receipts).toEqual([]);
  expect(f.tools.every(t => !t.tool.reservedTaskId && !t.stack.reservedTaskId)).toBe(true);
});
test('final supported strokes may exhaust exact tools but coarse steps cannot exceed their budget', () => {
  const f = fixture(); f.tools.forEach(t => t.tool.current = Stone.WEAR[t.key]); const j = start(f);
  Stone.advance(f.site, j, f.c, f.tools, 1); Stone.advance(f.site, j, f.c, f.tools, 100000);
  expect(j.progress).toBe(100); expect(f.tools.map(t => t.tool.current)).toEqual([0, 0]);
  expect(Stone.finish(f.site, j, f.c, f.tools, 100000, 'final')).toBeTruthy();
  const g = fixture(), job = start(g); g.tools[0].tool.current = 1;
  Stone.advance(g.site, job, g.c, g.tools, 100000); expect(job.progress).toBe(0);
});
test('depleted and unsuitable faces cannot replenish on repeat inspection or permit renewal', () => {
  const f = fixture(); f.node.remaining = 0;
  const j = start(f, 'inspect'); Stone.advance(f.site, j, f.c, f.tools, 1); Stone.advance(f.site, j, f.c, f.tools, 101);
  Stone.finish(f.site, j, f.c, f.tools, 101); expect(f.node.inspected.workable).toBe(false);
  expect(Stone.plan(f.site, f.node, 'recover', f.c, f.tools)).toBeNull();
  expect(copy(f.site).nodes[0].remaining).toBe(0);
});
