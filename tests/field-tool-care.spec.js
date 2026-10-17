const { test, expect } = require('@playwright/test');
const Care = require('../field-tool-care');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture(action = 'repair', key = 'handSaw') {
  const cell = { x: 4, y: 5, z: 0 }, tool = { id: 'original-tool', max: 350, current: 100, carriedBy: 'scientist', roomId: 'wild', reservedTaskId: '' };
  const stack = { id: 'original-stack', key, toolInstanceId: tool.id, quantity: 1, roomId: 'wild', cell, carriedBy: 'scientist', unitMassKg: 2, unitVolumeL: 3, sourceLabels: ['original'] };
  const part = { id: 'carried-part', section: 'resources', key: 'metalParts', quantity: 1, roomId: 'wild', cell, carriedBy: 'scientist', unitMassKg: 1, unitVolumeL: 1 };
  const c = { cell, roomId: 'wild', worldId: 'world', siteId: 'site', bodyEpoch: 0, visitId: 'visit', tripId: 'trip', alive: true, capable: true,
    free: true, busy: false, supported: true, threatened: false, atHead: true, seconds: action === 'maintain' ? 20 : 40, staminaCost: action === 'maintain' ? 2 : 4, stamina: 100 };
  return { action, tool, stack, part, c, now: 0 };
}
const plan = f => Care.plan(f.action, f.tool, f.stack, f.part, f.c);
function begin(f) { const p = plan(f); expect(p).toBeTruthy(); if (p.part) f.part.reservedTaskId = 'task-1';
  f.j = Care.begin(p, 'task-1', f.now, f.tool, f.stack, f.part); expect(f.j).toBeTruthy(); return f.j; }
function tick(f, n = 1) { for (let k = 0; k < n; k++) Care.advance(f.j, f.tool, f.stack, f.part, f.c, ++f.now); }
const finish = f => Care.finish(f.j, f.tool, f.stack, f.part, f.c, f.now);
test('all three exact carried hand tools reuse bounded maintenance and repair effects', () => {
  for (const key of Care.KEYS) for (const action of ['maintain', 'repair']) {
    const f = fixture(action, key), j = begin(f); expect(j.target).toBe(action === 'maintain' ? 315 : 258);
    expect(f.part.quantity).toBe(1); tick(f, f.c.seconds + 1); expect(f.tool.current).toBe(j.target);
    const r = finish(f); expect(r).toMatchObject({ before: 100, after: j.target, toolId: f.tool.id, stackId: f.stack.id });
    expect(f.part.quantity).toBe(action === 'maintain' ? 1 : 0); expect(f.tool.reservedTaskId).toBe(''); expect(f.stack.reservedTaskId).toBe('');
    expect(finish(f)).toBeNull();
  }
});
test('care refuses remote stored foreign-owned substituted reserved or unsupported tools and absent physical supplies', () => {
  for (const wrong of [{ carriedBy: '' }, { cityOwnerId: 'city' }, { civicCustody: 'city' }, { fixtureId: 'crate' }, { containerId: 'bag' },
    { quantity: 2 }, { toolInstanceId: 'other' }, { key: 'miningPick' }, { reservedTaskId: 'other' }, { tags: ['toxic'] }, { roomId: 'remote' }, { cell: { x: 99, y: 99, z: 0 } }]) {
    const f = fixture(); Object.assign(f.stack, wrong); expect(plan(f), JSON.stringify(wrong)).toBeNull();
  }
  for (const wrong of [{ carriedBy: '' }, { reservedTaskId: 'other' }, { current: -1 }, { max: Infinity }, { current: NaN }, { roomId: 'other' }]) {
    const f = fixture(); Object.assign(f.tool, wrong); expect(plan(f)).toBeNull();
  }
  for (const wrong of [{ alive: false }, { capable: false }, { free: false }, { busy: true }, { supported: false }, { threatened: true },
    { stamina: 3 }, { bodyEpoch: -1 }, { seconds: NaN }, { staminaCost: NaN }, { worldId: '' }]) {
    const f = fixture(); Object.assign(f.c, wrong); expect(plan(f), JSON.stringify(wrong)).toBeNull();
  }
  for (const wrong of [{ carriedBy: '' }, { roomId: 'home' }, { fixtureId: 'crate' }, { cityOwnerId: 'city' }, { reservedTaskId: 'other' }, { quantity: 0 }, { key: 'lumber' }]) {
    const f = fixture(); Object.assign(f.part, wrong); expect(plan(f)).toBeNull();
  }
});
test('zero-condition surviving tools are repairable but cannot be maintained and neither operation exceeds its cap', () => {
  const f = fixture(); f.tool.current = 0; expect(plan(f)).toBeTruthy(); f.action = 'maintain'; expect(plan(f)).toBeNull();
  f.tool.current = 315; expect(plan(f)).toBeNull(); f.action = 'repair'; expect(plan(f).target).toBe(350);
  f.tool.current = 350; expect(plan(f)).toBeNull(); expect(Care.plan('repair', null, f.stack, f.part, f.c)).toBeNull();
});
test('acceptance binds original condition and exclusive exact tool and component claims', () => {
  const f = fixture(), p = plan(f); expect(Care.begin(p, 'task-1', 0, f.tool, f.stack, f.part)).toBeNull();
  f.part.reservedTaskId = 'task-1'; f.tool.current--; expect(Care.begin(p, 'task-1', 0, f.tool, f.stack, f.part)).toBeNull();
  f.tool.current++; expect(Care.begin(p, 'task-1', NaN, f.tool, f.stack, f.part)).toBeNull();
});
test('only attended intervals consume the one part and progressively improve the original tool', () => {
  const f = fixture(); begin(f); tick(f); expect(f.j.progress).toBe(0); expect(f.part.quantity).toBe(1);
  tick(f, 10); expect(f.j.progress).toBe(10); expect(f.tool.current).toBe(139); expect(f.part.quantity).toBe(0);
  expect(finish(f)).toBeNull(); tick(f, 30); expect(finish(f)).toBeTruthy();
});
test('unsupported ground threats incapacity absence or a different queue head cannot backfill work after interruption', () => {
  for (const wrong of [{ supported: false }, { threatened: true }, { capable: false }, { free: false }, { atHead: false }, { cell: { x: 5, y: 5, z: 0 } }]) {
    const f = fixture(); begin(f); tick(f, 4); const before = copy(f.tool), c = copy(f.c), progress = f.j.progress;
    Object.assign(f.c, wrong); tick(f, 100); expect(f.j.progress).toBe(progress); expect(f.tool).toEqual(before);
    f.c = c; tick(f); expect(f.j.progress).toBe(progress); tick(f); expect(f.j.progress).toBe(progress + 1);
  }
});
test('changed identities visits custody provenance tools or claims cannot finish old work', () => {
  for (const which of ['bodyEpoch', 'worldId', 'siteId', 'roomId', 'visitId', 'tripId']) {
    const f = fixture(); begin(f); tick(f, 5); f.c[which] = 'other'; tick(f, 60); expect(finish(f)).toBeNull(); expect(f.j.progress).toBe(4);
  }
  for (const which of ['tool', 'stack', 'part']) {
    const f = fixture(); begin(f); f[which].id = 'replacement'; tick(f, 60); expect(f.j.progress).toBe(0); expect(finish(f)).toBeNull();
  }
  const f = fixture(); begin(f); tick(f, 4); f.tool.current--; tick(f, 50); expect(finish(f)).toBeNull(); expect(f.j.progress).toBe(3);
});
test('saved partial work preserves costs and claims without duplicated consumption or improvements', () => {
  const f = fixture(); begin(f); tick(f, 8); Object.assign(f, copy(f)); const value = f.tool.current;
  expect(f.part.quantity).toBe(0); tick(f); expect(f.tool.current).toBeGreaterThan(value); tick(f, 40);
  expect(finish(f)).toBeTruthy(); expect(f.tool.current).toBe(258); expect(f.part.quantity).toBe(0); expect(finish(f)).toBeNull();
});
test('cancellation releases only original claims, retains physical improvements and never refunds consumed components', () => {
  for (const started of [false, true]) {
    const f = fixture(); begin(f); if (started) tick(f, 8); const current = f.tool.current;
    expect(Care.cancel(f.j, f.tool, f.stack, f.part, f.now)).toBe(true); expect(f.tool.current).toBe(current);
    expect(f.part.quantity).toBe(started ? 0 : 1); expect(f.tool.reservedTaskId).toBe(''); expect(f.stack.reservedTaskId).toBe('');
    expect(f.part.reservedTaskId).toBe(''); expect(Care.cancel(f.j, f.tool, f.stack, f.part, f.now)).toBe(false);
    tick(f, 100); expect(f.tool.current).toBe(current); expect(finish(f)).toBeNull();
  }
});
test('scientist death freezes work and nonfinite or backward clocks do not manufacture progress', () => {
  const f = fixture(); begin(f); tick(f, 5); const before = copy(f); f.c.alive = false; tick(f, 100);
  expect(f.j).toEqual(before.j); expect(f.tool).toEqual(before.tool);
  f.c.alive = true; for (const t of [NaN, -1]) expect(Care.advance(f.j, f.tool, f.stack, f.part, f.c, t)).toBe(false);
});
