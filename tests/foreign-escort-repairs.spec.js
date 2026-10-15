const { test, expect } = require('@playwright/test');
const Repair = require('../foreign-escort-repairs');
const Foreign = require('../foreign-expedition-escort');
const Recovery = require('../foreign-escort-recovery');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const source = { cityId: 'b', populationId: 'population:b', branchId: 'chapter:b', networkId: 'military:b',
    allocationId: 'chapter:b:professional', label: 'Birch Chapter', restrictions: [], prohibitions: [] };
  const s = Foreign.create(source, { source: { cityId: 'b', populationSourceId: 'population:b' }, roomId: 'ground', entry: { z: 21 },
    wilderness: { roomId: 'wild', gate: { x: 20, y: 12, z: 21 } } }, 'seed', 0);
  s.actor.health = 75; s.dutySeconds = 9000; s.contract = { status: 'completed', refund: 12 };
  s.restPlace = { id: 'original-shelter', actorId: s.actor.id, branchId: source.branchId };
  s.gearCondition = { baton: 0, vest: 90 };
  const tool = { id: 'hammer-instance', current: 500, max: 500, carriedBy: 'scientist', reservedTaskId: '' };
  const item = (id, section, key, owner) => ({ id, section, key, carriedBy: owner, quantity: 1, knownQuantity: 1, unitMassKg: 1, unitVolumeL: 1, reservedTaskId: '' });
  const stacks = [item('baton', 'inventory', 'escortBaton', s.actor.id), item('vest', 'inventory', 'escortVest', s.actor.id),
    { ...item('hammer', 'inventory', 'masonryHammer', 'scientist'), toolInstanceId: tool.id },
    item('part', 'resources', 'metalParts', 'scientist'), item('rubber', 'resources', 'rubber', 'scientist')];
  const c = { source, alive: true, capable: true, originalBody: true, custody: false, atGround: true, local: true, near: true,
    originalTrip: true, bodyEpoch: 1, visitId: 'visit', tripId: 'trip', declaredOpposition: true, busy: false, escortIncapacitated: false,
    placeUsable: true, atRestPlace: true, threatened: false, careActive: false, roomId: 'ground', cell: { x: 13, y: 10, z: 21 },
    seconds: Repair.SECONDS, staminaCost: 6, stamina: 100, atHead: true };
  return { s, c, stacks, tool };
}
function begin(f, id = 'baton') {
  const q = Repair.plan(f.s, f.c, f.stacks, f.tool, id, 0);
  expect(q).toBeTruthy(); expect(Repair.begin(f.s, f.c, f.stacks, f.tool, q, 'task:repair', 0)).toBe(true);
  for (const item of f.stacks) if ([id, q.toolStackId, ...q.inputs.map(i => i.stackId)].includes(item.id)) item.reservedTaskId = 'task:repair';
  f.tool.reservedTaskId = 'task:repair'; return q;
}
test('named gear permission requires original settled people, source, usable shelter, real carried hammer, components and stamina', () => {
  for (const wrong of [{ alive: false }, { capable: false }, { originalBody: false }, { custody: true }, { atGround: false }, { near: false },
    { originalTrip: false }, { busy: true }, { escortIncapacitated: true }, { source: null }, { placeUsable: false }, { atRestPlace: false },
    { threatened: true }, { careActive: true }, { stamina: 0 }, { stamina: NaN }]) {
    const f = fixture(); expect(Repair.plan(f.s, { ...f.c, ...wrong }, f.stacks, f.tool, 'baton', 0)).toBeNull();
  }
  for (const change of [f => f.s.contract.status = 'active', f => f.s.recovery = { status: 'resting' }, f => f.s.drag = {}, f => f.s.actor.care = {},
    f => f.s.restPlace.actorId = 'replacement', f => f.tool.current = 0, f => f.stacks[2].carriedBy = '', f => f.stacks[2].reservedTaskId = 'other',
    f => f.stacks[3].cityOwnerId = 'city:b', f => f.stacks[3].carriedBy = '', f => f.tool.carriedBy = '', f => f.stacks[0].cityOwnerId = 'city:b',
    f => f.stacks[0].carriedBy = 'scientist', f => f.stacks[0].quantity = 2,
    f => f.s.gearCondition.baton = 100, f => f.stacks.splice(0, 1)]) {
    const f = fixture(); change(f); expect(Repair.plan(f.s, f.c, f.stacks, f.tool, 'baton', 0)).toBeNull();
  }
});
test('actual published refusal remains stable and reviewed named-item terms cannot be swapped or underpriced', () => {
  const f = fixture(); f.c.source.restrictions = [{ id: 'oath', text: 'No divine opponents.', refusesDeclaredOpposition: true }];
  for (let n = 0; n < 3; n++) expect(Repair.plan(f.s, f.c, f.stacks, f.tool, 'baton', n)).toBeNull();
  expect(Object.keys(f.s.decisions)).toHaveLength(1);
  f.c.source = { ...f.c.source, restrictions: [] }; const q = Repair.plan(f.s, f.c, f.stacks, f.tool, 'baton', 0);
  expect(Repair.begin(f.s, f.c, f.stacks, f.tool, { ...q, gain: 100 }, 'task:repair', 0)).toBe(false);
  expect(Repair.begin(f.s, f.c, f.stacks, f.tool, { ...q, gearId: 'vest' }, 'task:repair', 0)).toBe(false);
});
test('surviving zero-condition baton gains only 25 after actual work, consuming one exact part and wearing the same tool once', () => {
  const f = fixture(), original = copy(f.s); begin(f);
  expect(Repair.finish(f.s, f.c, f.stacks, f.tool, 0)).toBe(false); expect(f.s.gearCondition.baton).toBe(0);
  Repair.advance(f.s, f.c, f.stacks, f.tool, 1800);
  expect(Repair.finish(f.s, f.c, f.stacks, f.tool, 1800)).toBe(true);
  expect(f.s.gearCondition).toEqual({ baton: 25, vest: 90 }); expect(f.tool.current).toBe(494);
  expect(f.stacks.find(i => i.id === 'part').quantity).toBe(0); expect(f.stacks.find(i => i.id === 'rubber').quantity).toBe(1);
  expect(f.stacks.every(i => !i.reservedTaskId)).toBe(true); expect(f.s.actor.health).toBe(original.actor.health);
  expect(f.s.dutySeconds).toBe(original.dutySeconds); expect(f.s.contract).toEqual(original.contract);
  const done = copy(f); expect(Repair.finish(f.s, f.c, f.stacks, f.tool, 1801)).toBe(false); expect(f).toEqual(done);
});
test('vest needs both actual components and caps restoration at 100 without repairing another item', () => {
  const f = fixture(); f.stacks[4].carriedBy = '';
  expect(Repair.plan(f.s, f.c, f.stacks, f.tool, 'vest', 0)).toBeNull(); f.stacks[4].carriedBy = 'scientist';
  begin(f, 'vest'); expect(f.s.repair.gain).toBe(10); Repair.advance(f.s, f.c, f.stacks, f.tool, 1800);
  expect(Repair.finish(f.s, f.c, f.stacks, f.tool, 1800)).toBe(true); expect(f.s.gearCondition).toEqual({ baton: 0, vest: 100 });
  expect(f.s.repair.receipt.consumed.map(i => i.key)).toEqual(['metalParts', 'rubber']);
});
test('lost support, position, capacity, original binding, attention or supplies hold partial work without backfill or replacement', () => {
  for (const wrong of [{ source: null }, { placeUsable: false }, { atRestPlace: false }, { capable: false }, { escortIncapacitated: true },
    { bodyEpoch: 2 }, { visitId: 'other' }, { tripId: 'other' }, { atHead: false }, { careActive: true }, { threatened: true },
    { cell: { x: 14, y: 10, z: 21 } }]) {
    const f = fixture(); begin(f); Repair.advance(f.s, f.c, f.stacks, f.tool, 300);
    Repair.advance(f.s, { ...f.c, ...wrong }, f.stacks, f.tool, 900); expect(f.s.repair.progressSeconds).toBe(300);
    expect(f.s.repair.status).toBe('held'); Repair.advance(f.s, f.c, f.stacks, f.tool, 1000);
    expect(f.s.repair.progressSeconds).toBe(300); Repair.advance(f.s, f.c, f.stacks, f.tool, 1300); expect(f.s.repair.progressSeconds).toBe(600);
  }
  for (const change of [f => f.stacks[0].id = 'copy', f => f.stacks[0].carriedBy = '', f => f.s.gearCondition.baton = 5,
    f => f.stacks[3].quantity = 2, f => f.stacks[3].reservedTaskId = '', f => f.stacks[3].unitMassKg = 99,
    f => f.stacks[2].toolInstanceId = 'copy', f => f.tool.id = 'copy', f => f.tool.carriedBy = 'other']) {
    const f = fixture(); begin(f); change(f); Repair.advance(f.s, f.c, f.stacks, f.tool, 1800);
    expect(f.s.repair.progressSeconds).toBe(0); expect(Repair.finish(f.s, f.c, f.stacks, f.tool, 1800)).toBe(false);
  }
});
test('real reload and caller chunks retain original gear/tool identity, wear, partial progress and once-only consumption', () => {
  const a = fixture(), b = fixture(); begin(a); begin(b);
  Repair.advance(a.s, a.c, a.stacks, a.tool, 1800); Repair.finish(a.s, a.c, a.stacks, a.tool, 1800);
  Repair.advance(b.s, b.c, b.stacks, b.tool, 600); const restored = copy(b);
  for (let at = 660; at <= 1800; at += 60) Repair.advance(restored.s, restored.c, restored.stacks, restored.tool, at);
  Repair.finish(restored.s, restored.c, restored.stacks, restored.tool, 1800); expect(restored).toEqual(a);
});
test('cancellation releases actual unused inputs and original gear but retains spent work, stamina contract and tool wear', () => {
  const f = fixture(); begin(f); Repair.advance(f.s, f.c, f.stacks, f.tool, 600);
  expect(Repair.cancel(f.s, f.stacks, f.tool, 600)).toBe(true); expect(f.s.repair.status).toBe('cancelled');
  expect(f.s.gearCondition.baton).toBe(0); expect(f.stacks.every(i => i.quantity === 1 && !i.reservedTaskId)).toBe(true);
  expect(f.tool.current).toBe(498); expect(Repair.cancel(f.s, f.stacks, f.tool, 601)).toBe(false);
});
test('unfinished repair excludes rest and paid protection; exhausted hammer cannot finish or become a replacement tool', () => {
  const f = fixture(); begin(f); expect(Foreign.review(f.s, f.c, 0)).toBeNull(); expect(Recovery.begin(f.s, f.c, f.stacks, 0)).toBe(false);
  f.tool.current = 1; Repair.advance(f.s, f.c, f.stacks, f.tool, 1800); expect(f.tool.current).toBe(0);
  expect(f.s.repair.progressSeconds).toBe(300);
  expect(Repair.finish(f.s, f.c, f.stacks, f.tool, 1800)).toBe(false); expect(f.s.gearCondition.baton).toBe(0);
});
test('scientist death freezes partial work, materials and tool wear', () => {
  const f = fixture(); begin(f); const before = copy(f);
  expect(Repair.advance(f.s, { ...f.c, alive: false }, f.stacks, f.tool, 9000)).toBe(0);
  expect(Repair.finish(f.s, { ...f.c, alive: false }, f.stacks, f.tool, 9000)).toBe(false); expect(f).toEqual(before);
});
test('the actual final supported stroke may complete while exhausting the original hammer, without replacing it', () => {
  const f = fixture(); f.tool.current = 6; begin(f);
  Repair.advance(f.s, f.c, f.stacks, f.tool, 1800); expect(f.tool.current).toBe(0);
  expect(Repair.finish(f.s, f.c, f.stacks, f.tool, 1800)).toBe(true);
  expect(f.s.gearCondition.baton).toBe(25); expect(f.tool.id).toBe('hammer-instance'); expect(f.tool.current).toBe(0);
});
