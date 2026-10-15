const { test, expect } = require('@playwright/test');
const Haul = require('../foreign-escort-hauling');
const Escorts = require('../expedition-escorts');
const copy = x => JSON.parse(JSON.stringify(x));
const cell = (x, y = 1) => ({ x, y, z: 21 });
function fixture() {
  const source = { cityId: 'b', populationId: 'people:b', branchId: 'chapter:b', networkId: 'military:b', allocationId: 'escort:b', restrictions: [], prohibitions: [] };
  const s = { source, actor: { id: 'escort:b', status: 'alive', health: 100, needs: { exertion: 0 }, roomId: 'wild', mapCell: cell(1), order: 'follow' },
    contract: { ...Escorts.start(1, 0, 4), bodyEpoch: 1, visitId: 'visit', tripId: 'trip' } };
  const c = { source, alive: true, capable: true, originalBody: true, custody: false, local: true, originalTrip: true,
    bodyEpoch: 1, visitId: 'visit', tripId: 'trip', near: true, busy: false, escortIncapacitated: false,
    site: { worldId: 'world', siteId: 'station', roomId: 'wild' }, dropCell: cell(9), dropLegal: true,
    carryOk: true, routeOk: true, itemVisible: true, threatened: false };
  const item = { id: 'source', key: 'stoneBlocks', section: 'resources', quantity: 2, unitMassKg: 8, unitVolumeL: 5,
    roomId: 'wild', cell: cell(3), carriedBy: '', reservedTaskId: '', sourceLabels: ['original'], tags: [] };
  const f = { s, c, item, stacks: [item], now: 0, blocked: false, capacity: true, deposited: 0 };
  f.reserve = (i, id) => {
    const slice = i.quantity > 1 ? { ...copy(i), id: 'slice', quantity: 1 } : i;
    if (slice !== i) { i.quantity--; f.stacks.push(slice); } slice.reservedTaskId = id; return slice;
  };
  f.hooks = { item: id => f.stacks.find(i => i.id === id), capacity: () => f.capacity,
    adjacent: goal => Math.abs(s.actor.mapCell.x - goal.x) <= 1,
    move: goal => { if (f.blocked) return false; s.actor.mapCell.x += Math.sign(goal.x - s.actor.mapCell.x); return true; },
    pickup: j => { f.stacks.find(i => i.id === j.stackId).carriedBy = s.actor.id; return true; },
    deposit: j => { const i = f.stacks.find(i => i.id === j.stackId); i.carriedBy = ''; i.cell = copy(j.drop); i.reservedTaskId = ''; f.deposited++; return true; },
    release: (j, canDrop) => { const i = f.stacks.find(i => i.id === j.stackId); if (!i || i.reservedTaskId !== j.id) return;
      if (canDrop && i.carriedBy === s.actor.id) { i.carriedBy = ''; i.cell = copy(s.actor.mapCell); } i.reservedTaskId = ''; } };
  expect(Haul.mark(s, c, 0)).toBe(true); return f;
}
function start(f) {
  const q = Haul.review(f.s, f.c, f.item, f.now); expect(q).toBeTruthy();
  expect(Haul.accept(f.s, f.c, f.item, q, f.now, f.reserve)).toBe(true); return f.s.hauling.job;
}
function tick(f, n = 1, context = f.c) { for (let k = 0; k < n; k++) Haul.advance(f.s, context, f.hooks, ++f.now); }
test('protection alone supplies no hauling permission; exact offer reserves only one actual unit without new wages', () => {
  const f = fixture(); expect(Haul.accept(f.s, f.c, f.item, null, 0, f.reserve)).toBe(false);
  const contract = copy(f.s.contract), j = start(f);
  expect(f.s.contract).toEqual(contract); expect(f.s.actor.order).toBe('haul');
  expect(f.item.quantity).toBe(1); expect(f.item.reservedTaskId).toBe(''); expect(f.stacks.find(i => i.id === j.stackId)).toMatchObject({ quantity: 1, reservedTaskId: j.id, carriedBy: '' });
  expect(Haul.review(f.s, f.c, f.item, 1)).toBeNull(); expect(f.stacks.reduce((n, i) => n + i.quantity, 0)).toBe(2);
});
test('review requires actual original active local contract, personal contact, known drop, capacity and permitted route', () => {
  for (const wrong of [{ alive: false }, { capable: false }, { originalBody: false }, { custody: true }, { local: false }, { originalTrip: false },
    { near: false }, { busy: true }, { escortIncapacitated: true }, { care: true }, { drag: true }, { otherWork: true }, { threatened: true },
    { itemVisible: false }, { carryOk: false }, { routeOk: false }, { dropLegal: false }, { site: null }, { source: null }]) {
    const f = fixture(); expect(Haul.review(f.s, { ...f.c, ...wrong }, f.item, 1), JSON.stringify(wrong)).toBeNull();
  }
  const f = fixture(); f.s.contract.status = 'returning'; expect(Haul.review(f.s, f.c, f.item, 1)).toBeNull();
  f.s.contract.status = 'active'; f.s.actor.health = 20; expect(Haul.review(f.s, f.c, f.item, 1)).toBeNull();
});
test('goods must be ordinary owned loose permitted materials, never hazardous, stored, carried or reserved property', () => {
  const f = fixture();
  for (const wrong of [{ cityOwnerId: 'city' }, { civicCustody: 'clerk' }, { carriedBy: 'scientist' }, { reservedTaskId: 'other' },
    { fixtureId: 'crate' }, { containerId: 'bottle' }, { key: 'metalParts' }, { key: 'fallenTrunk' }, { quantity: 0 },
    { tags: ['contaminated'] }, { chemicalBatch: {} }, { biology: {} }, { contents: [{ key: 'toxin' }] }])
    expect(Haul.review(f.s, f.c, { ...f.item, ...wrong }, 1)).toBeNull();
  for (const key of Haul.GOODS) expect(Haul.eligible({ ...f.item, key })).toBe(true);
});
test('changed or expired exact terms cannot silently accept or split a lot', () => {
  const f = fixture(), q = Haul.review(f.s, f.c, f.item, 0);
  for (const wrong of [{ bodyEpoch: 2 }, { visitId: 'new' }, { tripId: 'new' }, { near: false }, { carryOk: false }, { routeOk: false }])
    expect(Haul.accept(f.s, { ...f.c, ...wrong }, f.item, q, 1, f.reserve)).toBe(false);
  expect(Haul.accept(f.s, f.c, f.item, { ...q, hourly: 0 }, 1, f.reserve)).toBe(false);
  expect(Haul.accept(f.s, f.c, f.item, q, 60, f.reserve)).toBe(false);
  f.item.quantity++; expect(Haul.accept(f.s, f.c, f.item, q, 1, f.reserve)).toBe(false);
  expect(f.stacks).toHaveLength(1);
});
test('published refusal is stable and revised policies invalidate unsigned consent', () => {
  const f = fixture(), q = Haul.review(f.s, f.c, f.item, 0);
  f.c.source = { ...f.c.source, restrictions: [{ id: 'scope', forbidsHauling: true, text: 'No hauling under this chapter charter.' }] };
  expect(Haul.accept(f.s, f.c, f.item, q, 1, f.reserve)).toBe(false);
  for (const at of [2, 30, 100]) expect(Haul.review(f.s, f.c, f.item, at)).toBeNull();
  expect(f.s.hauling.reply.reason).toContain('No hauling'); expect(f.item.quantity).toBe(2);
});
test('physical pickup, load, travel and unload precede one delivery; no repeat or phantom receipt', () => {
  const f = fixture(), j = start(f); tick(f, 1); expect(f.deposited).toBe(0);
  tick(f, 13); expect(f.stacks.find(i => i.id === j.stackId).carriedBy).toBe(f.s.actor.id);
  tick(f, 50); expect(j.status).toBe('delivered'); expect(f.deposited).toBe(1); expect(f.s.actor.order).toBe('hold');
  expect(f.stacks.find(i => i.id === j.stackId)).toMatchObject({ carriedBy: '', cell: f.c.dropCell, quantity: 1, reservedTaskId: '' });
  tick(f, 100); expect(f.deposited).toBe(1); expect(f.s.hauling.history).toHaveLength(1); expect(f.item.quantity).toBe(1);
});
test('blocked routes and interrupted handoff attendance never backfill, refund effort or move goods', () => {
  const f = fixture(), j = start(f); f.blocked = true;
  Haul.advance(f.s, f.c, f.hooks, f.now = 10000); expect(j.progress).toBe(0); expect(j.reason).toContain('blocked');
  expect(f.s.actor.mapCell).toEqual(cell(1)); f.blocked = false; tick(f, 5);
  const before = j.progress; f.capacity = false; Haul.advance(f.s, f.c, f.hooks, f.now += 10000); expect(j.progress).toBe(before);
  f.capacity = true; tick(f); expect(j.progress).toBe(before); expect(f.deposited).toBe(0);
});
test('saved exact job, physical slice, positions and handoff progress resume once without duplicate cargo', () => {
  const f = fixture(), j = start(f); tick(f, 6);
  f.s.hauling = copy(f.s.hauling); f.stacks = copy(f.stacks);
  expect(f.s.hauling.job.progress).toBe(j.progress); expect(f.stacks.find(i => i.id === j.stackId).reservedTaskId).toBe(j.id);
  tick(f, 60); expect(f.s.hauling.job.status).toBe('delivered'); expect(f.deposited).toBe(1);
  expect(f.stacks.reduce((n, i) => n + i.quantity, 0)).toBe(2);
});
test('cancellation before pickup releases the original slice; cancellation while carrying drops at the actual worker', () => {
  const f = fixture(), j = start(f);
  expect(Haul.stop(f.s, f.hooks, 1)).toBe(true); expect(Haul.stop(f.s, f.hooks, 2)).toBe(false);
  expect(f.stacks.find(i => i.id === j.stackId)).toMatchObject({ cell: f.item.cell, carriedBy: '', reservedTaskId: '' });
  const g = fixture(), k = start(g); tick(g, 14); const position = copy(g.s.actor.mapCell);
  expect(Haul.stop(g.s, g.hooks, g.now)).toBe(true);
  expect(g.stacks.find(i => i.id === k.stackId)).toMatchObject({ cell: position, carriedBy: '', reservedTaskId: '' }); expect(g.deposited).toBe(0);
});
test('danger, withdrawal, incapacity, changed original identity or missing supplies cannot complete the old assignment', () => {
  for (const wrong of [{ threatened: true }, { bodyEpoch: 2 }, { visitId: 'other' }, { tripId: 'other' }, { custody: true },
    { local: false }, { source: null }, { capable: false }, { escortIncapacitated: true }]) {
    const f = fixture(), j = start(f); tick(f, 14); tick(f, 1, { ...f.c, ...wrong });
    expect(j.status, JSON.stringify(wrong)).toBe('interrupted'); expect(f.deposited).toBe(0);
    const i = f.stacks.find(i => i.id === j.stackId); expect(i.reservedTaskId).toBe('');
    expect(i.carriedBy).toBe(wrong.escortIncapacitated ? f.s.actor.id : '');
  }
  const f = fixture(), j = start(f); f.stacks = f.stacks.filter(i => i.id !== j.stackId); tick(f);
  expect(j.status).toBe('interrupted'); expect(f.deposited).toBe(0); expect(f.stacks).toHaveLength(1);
});
test('scientist death freezes private work; away public records contain no live progress, cargo location or completion', () => {
  const f = fixture(); start(f); const before = copy(f.s);
  tick(f, 1, { ...f.c, alive: false }); expect(f.s).toEqual(before);
  const issued = Haul.publicView(f.s); tick(f, 80);
  expect(Haul.publicView(f.s)).toEqual(issued); expect(f.s.hauling.job.status).toBe('delivered');
  expect(Haul.receive(f.s, { ...f.c, near: false }, f.now)).toBe(false);
  expect(Haul.receive(f.s, f.c, f.now)).toBe(true); expect(Haul.publicView(f.s).received.status).toBe('delivered');
  const reported = Haul.publicView(f.s); f.s.actor.mapCell.x = 100; expect(Haul.publicView(f.s)).toEqual(reported);
});
test('a replacement person cannot use the original engagement to accept labor or narrate its private reports', () => {
  const f = fixture(); f.s.actor.id = 'replacement';
  expect(Haul.review(f.s, f.c, f.item, 0)).toBeNull();
  f.s.actor.id = f.s.source.allocationId; start(f); tick(f, 80); f.s.actor.id = 'replacement';
  expect(Haul.receive(f.s, f.c, f.now)).toBe(false); expect(Haul.publicView(f.s).received).toBeNull();
});
