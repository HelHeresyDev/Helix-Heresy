const { test, expect } = require('@playwright/test');
const Timber = require('../fallen-timber');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture(action = 'cut') {
  const context = { worldId: 'world', siteId: 'woodland', strategicCellId: 'cell', seed: 'timber', truth: {
    potentialPermille: { timberFiber: 1000 }, surfaceAccessibilityPermille: 1000 } };
  const baseline = { worldId: 'world', placeId: 'woodland', bounds: { x: 1, y: 1 }, cells:
    Array.from({ length: 30 }, (_, n) => ({ x: 1 + n % 6, y: 1 + Math.floor(n / 6), z: 6 })) };
  const site = Timber.create(context, baseline, 'field', () => true), node = site.nodes[0];
  const stacks = site.nodes.map((n, i) => {
    n.stackId = `trunk-${i}`; n.inspected = { at: 0, workable: true };
    return { id: n.stackId, key: 'fallenTrunk', section: 'resources', quantity: 1, unitMassKg: n.remaining * 11,
      unitVolumeL: n.remaining * 26, roomId: 'field', cell: copy(n.cell), reservedTaskId: Timber.sourceClaim(n) };
  });
  const input = { id: 'log', key: 'fieldLog', section: 'resources', quantity: 1, unitMassKg: 11, unitVolumeL: 26,
    roomId: 'field', cell: { x: 3, y: 3, z: 6 }, sourceLabels: ['original-trunk'], materialComposition: { primary: 'wood' }, reservedTaskId: '' };
  stacks.push(input);
  const tools = [{ key: 'handSaw', tool: { id: 'saw', current: 40, carriedBy: 'scientist', reservedTaskId: '' },
    stack: { id: 'saw-stack', quantity: 1, key: 'handSaw', toolInstanceId: 'saw', carriedBy: 'scientist', reservedTaskId: '' } }];
  const c = { wilderness: true, controlled: false, worldId: 'world', siteId: 'woodland', roomId: 'field', bodyEpoch: 1,
    visitId: 'visit', tripId: 'trip', alive: true, capable: true, free: true, groundPresent: true, inputAccessible: true,
    busy: false, reachable: true, visible: true, threatened: false, workCell: { x: 3, y: 3, z: 6 }, cell: { x: 3, y: 3, z: 6 },
    atHead: true, seconds: 100, staminaCost: 6, stamina: 80 };
  return { context, baseline, site, node, stacks, tools, c, input, action };
}
function start(f, action = f.action) {
  const p = Timber.plan(f.site, action === 'saw' ? null : f.node, action, f.c, f.tools, f.stacks, action === 'saw' ? f.input : null);
  expect(p).toBeTruthy(); return Timber.begin(p, 'task-1', 0, f.tools, f.stacks);
}
function work(f, j, now = 101) {
  Timber.advance(f.site, j, f.c, f.tools, f.stacks, 1);
  Timber.advance(f.site, j, f.c, f.tools, f.stacks, now);
}
function output(action) { return action === 'cut' ? [{ id: 'new-log', key: 'fieldLog', quantity: 1 }]
  : action === 'saw' ? [{ id: 'lumber', key: 'lumber', quantity: 2 }, { id: 'offcuts', key: 'woodDebris', quantity: 1 }] : []; }

test('saved geography produces deterministic finite fallen sources, not guaranteed timber or survey stock', () => {
  const f = fixture(); expect(Timber.create(f.context, f.baseline, 'field', () => true).nodes).toHaveLength(3);
  const a = Timber.create(f.context, f.baseline, 'field', () => true), b = Timber.create(f.context, f.baseline, 'field', () => true);
  expect(a).toEqual(b); expect(a.nodes.every(n => n.remaining >= 1 && n.remaining <= 3)).toBe(true);
  expect(Timber.create({ ...f.context, truth: { ...f.context.truth, potentialPermille: { timberFiber: 0 } } }, f.baseline, 'field', () => true).nodes).toEqual([]);
  expect(Timber.create(f.context, f.baseline, 'field', () => false).nodes).toEqual([]);
  expect(Timber.create({ ...f.context, worldId: 'elsewhere' }, f.baseline, 'field', () => true)).toBeNull();
  expect(Timber.publicView({ ...a, nodes: a.nodes.map(n => ({ ...n, inspected: null })) }).observations).toEqual([]);
});
test('inspection needs original physical source and grants evidence but no output or replenishment', () => {
  const f = fixture('inspect'); f.node.inspected = null;
  expect(Timber.plan(f.site, f.node, 'cut', f.c, f.tools, f.stacks)).toBeNull();
  const j = start(f); work(f, j);
  const n = f.node.remaining;
  expect(Timber.finish(f.site, j, f.c, f.tools, f.stacks, 101)).toBeTruthy();
  expect(f.node.remaining).toBe(n); expect(f.node.inspected).toEqual({ at: 101, workable: true });
  expect(f.tools[0].tool.current).toBe(40); expect(j.receipt.outputs).toEqual([]);
  expect(Timber.plan(f.site, f.node, 'inspect', f.c, f.tools, f.stacks)).toBeNull();
});
test('controlled land, missing sources, unsupported ground, threats, incapacity and missing exact saw reject starting', () => {
  const f = fixture();
  for (const wrong of [{ wilderness: false }, { controlled: true }, { groundPresent: false }, { free: false }, { alive: false },
    { capable: false }, { visible: false }, { reachable: false }, { busy: true }, { threatened: true }, { stamina: 0 }, { roomId: 'other' }])
    expect(Timber.plan(f.site, f.node, 'cut', { ...f.c, ...wrong }, f.tools, f.stacks)).toBeNull();
  expect(Timber.plan(f.site, f.node, 'cut', f.c, [], f.stacks)).toBeNull();
  f.tools[0].tool.current = 3; expect(Timber.plan(f.site, f.node, 'cut', f.c, f.tools, f.stacks)).toBeNull();
  f.tools[0].tool.current = 40; f.stacks[0].cell.x++;
  expect(Timber.plan(f.site, f.node, 'cut', f.c, f.tools, f.stacks)).toBeNull();
});
for (const action of ['cut', 'saw']) test(`${action}: pauses without backfill and cannot inherit across bodies or trips`, () => {
  const f = fixture(action), j = start(f); work(f, j, 26); expect(j.progress).toBe(25);
  for (const wrong of [{ cell: { x: 90, y: 1, z: 6 } }, { atHead: false }, { threatened: true }, { free: false }, { alive: false },
    { capable: false }, { groundPresent: false }, { bodyEpoch: 2 }, { visitId: 'other' }, { tripId: 'other' }, { worldId: 'other' }, { siteId: 'other' }]) {
    Timber.advance(f.site, j, { ...f.c, ...wrong }, f.tools, f.stacks, j.lastAt + 1000);
    Timber.advance(f.site, j, f.c, f.tools, f.stacks, j.lastAt + 1); expect(j.progress).toBe(25);
  }
  expect(Timber.finish(f.site, j, f.c, f.tools, f.stacks, j.lastAt, output(action))).toBeNull();
});
for (const action of ['cut', 'saw']) test(`${action}: exact claims and progress survive save; finite completion consumes once and releases claims`, () => {
  let f = fixture(action), j = start(f); const remaining = f.node.remaining;
  work(f, j, 51); expect(j.progress).toBe(50); expect(f.tools[0].tool.current).toBe(40 - Timber.WEAR[action] / 2);
  ({ f, j } = copy({ f, j })); f.node = f.site.nodes[0]; f.input = f.stacks.find(s => s.id === 'log');
  expect(Timber.reason(f.site, j, f.c, f.tools, f.stacks)).toBe('');
  Timber.advance(f.site, j, f.c, f.tools, f.stacks, 101);
  expect(Timber.finish(f.site, j, f.c, f.tools, f.stacks, 101, output(action))).toBeTruthy();
  expect(f.tools[0].tool.current).toBe(40 - Timber.WEAR[action]);
  expect(f.tools[0].tool.reservedTaskId).toBe(''); expect(f.tools[0].stack.reservedTaskId).toBe('');
  if (action === 'cut') expect(f.node.remaining).toBe(remaining - 1);
  else { expect(f.input.quantity).toBe(0); expect(f.input.reservedTaskId).toBe(''); }
  expect(Timber.finish(f.site, j, f.c, f.tools, f.stacks, 200, output(action))).toBeNull(); expect(f.site.receipts).toHaveLength(1);
});
for (const action of ['cut', 'saw']) test(`${action}: cancellation retains physical partial work and spent wear but creates no goods`, () => {
  const f = fixture(action), j = start(f); work(f, j, 51);
  const worn = f.tools[0].tool.current, remaining = f.node.remaining;
  expect(Timber.cancel(j, f.tools, f.stacks, 51)).toBe(true); expect(Timber.cancel(j, f.tools, f.stacks, 52)).toBe(false);
  expect(f.site.receipts).toEqual([]); expect(f.input.quantity).toBe(1); expect(f.node.remaining).toBe(remaining);
  expect(f.tools[0].tool.current).toBe(worn); expect(f.tools[0].tool.reservedTaskId).toBe('');
  const resumed = start(f); expect(resumed.required).toBe(50); expect(resumed.wear).toBe(Timber.WEAR[action] / 2);
  work(f, resumed, 51); expect(Timber.finish(f.site, resumed, f.c, f.tools, f.stacks, 51, output(action))).toBeTruthy();
});
test('sawing requires one actual owned staged log, exact dimensions and its original claim throughout', () => {
  const f = fixture('saw');
  for (const wrong of [{ quantity: 2 }, { unitMassKg: 1 }, { carriedBy: 'scientist' }, { cityOwnerId: 'city' },
    { civicCustody: 'custodian' }, { fixtureId: 'crate' }, { reservedTaskId: 'other' }, { roomId: 'other' }, { key: 'lumber' }])
    expect(Timber.plan(f.site, null, 'saw', f.c, f.tools, f.stacks, { ...f.input, ...wrong })).toBeNull();
  const j = start(f); work(f, j, 51); f.input.sourceLabels.push('changed');
  expect(Timber.reason(f.site, j, f.c, f.tools, f.stacks)).toContain('exact original staged log');
  Timber.advance(f.site, j, f.c, f.tools, f.stacks, 1000); expect(j.progress).toBe(50);
  expect(Timber.finish(f.site, j, f.c, f.tools, f.stacks, 1000, output('saw'))).toBeNull();
  Timber.cancel(j, f.tools, f.stacks, 1000); const p = start(f); expect(p.required).toBe(100);
});
test('finite sources remain exhausted and missing originals are never replenished', () => {
  const f = fixture(); f.node.remaining = 1; f.stacks[0].unitMassKg = 11; f.stacks[0].unitVolumeL = 26;
  const j = start(f); work(f, j); Timber.finish(f.site, j, f.c, f.tools, f.stacks, 101, output('cut'));
  expect(f.node.remaining).toBe(0); expect(f.stacks[0].quantity).toBe(0);
  expect(Timber.plan(f.site, f.node, 'cut', f.c, f.tools, f.stacks)).toBeNull();
  expect(Timber.publicView(copy(f.site)).observations[0].summary).toContain('exhausted');
});
test('no outputs without final attendance and all physical outputs; final strokes can exhaust the exact saw', () => {
  const f = fixture('saw'); f.tools[0].tool.current = 8; const j = start(f); work(f, j, 100000);
  expect(f.tools[0].tool.current).toBe(0);
  expect(Timber.finish(f.site, j, f.c, f.tools, f.stacks, 100000, [{ id: 'only', key: 'lumber', quantity: 2 }])).toBeNull();
  expect(f.input.quantity).toBe(1);
  expect(Timber.finish(f.site, j, { ...f.c, atHead: false }, f.tools, f.stacks, 100000, output('saw'))).toBeNull();
  expect(Timber.finish(f.site, j, f.c, f.tools, f.stacks, 100000, output('saw'))).toBeTruthy();
  const g = fixture('saw'), k = start(g); g.tools[0].tool.current = 1;
  work(g, k, 100000); expect(k.progress).toBe(0); expect(g.tools[0].tool.current).toBe(1);
});

function delegatedFixture() {
  const f = fixture('saw'), carrier = 'original-builder', claim = 'field-build:one';
  Object.assign(f.c, { actorId: carrier, employmentAuthorized: true, claimId: claim, commission: {
    operation: 'saw', inputId: f.input.id, partId: 'log:log', targetKey: Timber.logSignature(f.input), toolId: 'saw', toolStackId: 'saw-stack' } });
  f.input.reservedTaskId = claim;
  for (const object of [f.tools[0].tool, f.tools[0].stack]) Object.assign(object, { carriedBy: carrier, reservedTaskId: claim });
  return f;
}
function delegatedStart(f) {
  const p = Timber.plan(f.site, null, 'saw', f.c, f.tools, f.stacks, f.input); expect(p).toBeTruthy();
  return Timber.begin(p, f.c.claimId, 0, f.tools, f.stacks);
}
test('delegated processing requires separate exact authority, original carried loan and one reserved log; never extraction', () => {
  const f = delegatedFixture();
  for (const change of [{ employmentAuthorized: false }, { actorId: 'replacement' }, { claimId: 'other' },
    ...[{ operation: 'build' }, { inputId: 'other' }, { targetKey: 'stale' }, { toolId: 'other' }, { toolStackId: 'other' }]
      .map(v => ({ commission: { ...f.c.commission, ...v } }))])
    expect(Timber.plan(f.site, null, 'saw', { ...f.c, ...change }, f.tools, f.stacks, f.input)).toBeNull();
  expect(Timber.plan(f.site, f.node, 'cut', f.c, f.tools, f.stacks)).toBeNull();
  const j = delegatedStart(f); expect(j).toMatchObject({ actorId: 'original-builder', operation: 'saw', partId: 'log:log', targetKey: f.c.commission.targetKey });
  expect(Timber.reason(f.site, j, { ...f.c, actorId: 'scientist' }, f.tools, f.stacks)).toContain('original authorized worker');
});
test('delegated saved partial work pauses without backfill, finishes once with original wear and stays out of personal timber evidence', () => {
  let f = delegatedFixture(), j = delegatedStart(f); work(f, j, 51);
  ({ f, j } = copy({ f, j })); f.input = f.stacks.find(i => i.id === 'log');
  Timber.advance(f.site, j, { ...f.c, groundPresent: false }, f.tools, f.stacks, 1000);
  Timber.advance(f.site, j, f.c, f.tools, f.stacks, 1001); expect(j.progress).toBe(50);
  Timber.advance(f.site, j, f.c, f.tools, f.stacks, 1051);
  expect(Timber.finish(f.site, j, f.c, f.tools, f.stacks, 1051, output('saw'))).toBeTruthy();
  expect(f.tools[0].tool.current).toBe(32); expect(f.input.quantity).toBe(0); expect(f.site.receipts).toHaveLength(1);
  expect(Timber.publicView(f.site).receipts).toEqual([]);
  expect(Timber.finish(f.site, j, f.c, f.tools, f.stacks, 2000, output('saw'))).toBeNull();
});
test('cancelled delegated work retains log progress and spent wear for a fresh personally supplied task', () => {
  const f = delegatedFixture(), j = delegatedStart(f); work(f, j, 51);
  expect(Timber.cancel(j, f.tools, f.stacks, 51)).toBe(true); expect(f.input.quantity).toBe(1);
  f.c.actorId = 'scientist'; delete f.c.commission; delete f.c.claimId;
  for (const object of [f.tools[0].tool, f.tools[0].stack]) object.carriedBy = 'scientist';
  const resumed = start(f); expect(resumed.retained).toBe(.5); expect(resumed.wear).toBe(4);
  work(f, resumed, 51); expect(Timber.finish(f.site, resumed, f.c, f.tools, f.stacks, 51, output('saw'))).toBeTruthy();
  expect(f.tools[0].tool.current).toBe(32);
});
