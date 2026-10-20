const { test } = require('node:test');
const assert = require('node:assert/strict');
const Supply = require('../field-supply-leg');
const Porter = require('../field-porter');
const copy = x => JSON.parse(JSON.stringify(x));
const cell = x => ({ x, y: 0, z: 0 });
function fixture() {
  const stock = ['trailMeal', 'fuelReagent', 'fieldWaterFilter'].map((key, n) => ({ id: `stock-${n}`, key, section: key === 'fuelReagent' ? 'resources' : 'inventory',
    quantity: n ? 1 : 3, unitMassKg: 1, unitVolumeL: 1, fixtureId: 'source', roomId: 'wild', cell: cell(1), sourceLabels: ['finite owned original lot'] }));
  const source = { fixtureId: 'source', roomId: 'wild', fixtureCell: cell(1), port: cell(2), stock: copy(stock) };
  const destination = { fixtureId: 'target', roomId: 'wild', fixtureCell: cell(7), port: cell(6) };
  const s = { actor: { id: 'original-porter', mapCell: cell(0) }, contract: { id: 'original-shift', startedAt: 0, earned: 0 }, next: 1 };
  const c = { allowed: true, actorId: s.actor.id, contractId: s.contract.id, bodyEpoch: 0, visitId: 'visit', tripId: 'trip', source, destination,
    route: Array.from({ length: 7 }, (_, n) => cell(n)), returnCell: cell(0), originals: true, sourceOpen: true, routeOk: true,
    remaining: { massKg: 10, volumeL: 10 }, destinationCapacity: { massKg: 10, volumeL: 10 }, budgetSeconds: 7200, minimumSeconds: 160 };
  const f = { s, c, stock, now: 0, serial: 0, flags: {}, moves: 0 };
  f.h = { item: id => f.stock.find(i => i.id === id),
    reserve: (i, claim) => { const r = i.quantity > 1 ? { ...copy(i), id: `slice-${++f.serial}`, quantity: 1 } : i;
      if (r !== i) { i.quantity--; f.stock.push(r); } r.reservedTaskId = claim; return r; },
    release: (id, claim) => { const i = f.stock.find(i => i.id === id); if (i?.reservedTaskId === claim) i.reservedTaskId = ''; },
    original: m => !f.flags.replaced || m.fixtureId !== 'target', open: m => !f.flags.closed || m.fixtureId !== f.flags.closed,
    at: c => s.actor.mapCell.x === c.x,
    move: c => { if (f.flags.blocked) return false; s.actor.mapCell.x += Math.sign(c.x - s.actor.mapCell.x); f.moves++; return true; },
    capacity: () => !f.flags.full,
    pickup: (r, j) => { const i = f.h.item(r.stackId); i.carriedBy = s.actor.id; i.fixtureId = ''; return i.reservedTaskId === j.id; },
    deposit: (r, j) => { const i = f.h.item(r.stackId); i.carriedBy = ''; i.fixtureId = j.destination.fixtureId; i.cell = copy(j.destination.fixtureCell); i.reservedTaskId = ''; return true; } };
  return f;
}
function order(f) {
  for (const id of ['stock-0', 'stock-0', 'stock-1', 'stock-2']) assert(Supply.append(f.s, f.c, id, f.now));
  assert(Supply.accept(f.s, f.c, copy(f.s.supplyPreview), f.now, f.h)); return f.s.supplyLeg;
}
function tick(f, seconds = 1, context = {}) { for (let i = 0; i < seconds; i++) Supply.advance(f.s, { alive: true, ...context }, f.h, ++f.now); }
test('one exact whole load reserves disjoint original portions without spending new wages or resetting the shift', () => {
  const f = fixture(), j = order(f);
  assert.equal(new Set(j.rows.map(r => r.stackId)).size, 4); assert.equal(f.stock.find(i => i.id === 'stock-0').quantity, 1);
  assert.equal(f.s.contract.startedAt, 0); assert.equal(f.s.contract.earned, 0); assert.equal(f.s.supplyPreview, null);
  assert(j.rows.every(r => f.h.item(r.stackId).fixtureId === 'source' && f.h.item(r.stackId).reservedTaskId === j.id));
  tick(f, 150); assert.equal(j.status, 'completed'); assert.equal(f.s.actor.mapCell.x, 0);
  assert(j.rows.every(r => r.phase === 'delivered' && f.h.item(r.stackId).fixtureId === 'target'));
  assert(j.deliveredAt < j.returnedAt); tick(f, 50); assert.equal(j.returnedAt, j.endedAt ?? j.returnedAt);
  assert.equal(f.stock.reduce((n, i) => n + i.quantity, 0), 5);
});
test('no forged terms, stale stock, hostile ownership, oversized load or insufficient round-trip budget is accepted', () => {
  for (const change of [c => c.remaining.massKg = 3, c => c.remaining.volumeL = 3, c => c.destinationCapacity.volumeL = 3,
    c => c.destinationCapacity.massKg = 3, c => c.budgetSeconds = 1, c => c.originals = false, c => c.routeOk = false, c => c.sourceOpen = false]) {
    const f = fixture(); for (const id of ['stock-0', 'stock-0', 'stock-1', 'stock-2']) Supply.append(f.s, f.c, id, 0);
    change(f.c); assert.equal(Supply.accept(f.s, f.c, copy(f.s.supplyPreview), 0, f.h), false);
    assert(f.stock.every(i => !i.reservedTaskId));
  }
  const f = fixture(); Supply.append(f.s, f.c, 'stock-0', 0);
  assert.equal(Supply.accept(f.s, f.c, {}, 0, f.h), false);
  f.stock[0].quantity--; assert.equal(Supply.accept(f.s, f.c, copy(f.s.supplyPreview), 0, f.h), false);
  for (const patch of [{ key: 'stoneBlocks' }, { cityOwnerId: 'city' }, { tags: ['toxic'] }, { contents: [{}] }, { biology: {} }])
    assert.equal(Supply.eligible({ ...f.stock[0], ...patch }), false);
});
test('blocked routes, closed or full original crates and care preserve attendance honestly across serialization', () => {
  const f = fixture(), j = order(f); tick(f, 7); assert(j.progress > 0); const before = j.progress;
  f.flags.closed = 'source'; tick(f, 40); assert.equal(j.progress, before); f.flags.closed = '';
  tick(f); assert.equal(j.progress, before); tick(f); assert.equal(j.progress, before + 1);
  const saved = copy({ j, stock: f.stock, cell: f.s.actor.mapCell });
  Object.assign(j, copy(saved.j)); f.stock = copy(saved.stock); f.s.actor.mapCell = copy(saved.cell);
  tick(f, 50); assert.equal(j.phase, 'unload');
  f.flags.full = true; const loaded = j.rows.filter(r => r.phase === 'carried').length; tick(f, 25);
  assert.equal(j.rows.filter(r => r.phase === 'carried').length, loaded);
  f.flags.full = false; tick(f, 150); assert.equal(j.status, 'completed');
});
test('cancellation and replacement release only unfinished claims and never drop carried goods or erase delivered receipts', () => {
  const f = fixture(), j = order(f); tick(f, 60); assert(j.rows.some(r => r.phase === 'carried'));
  const carried = j.rows.filter(r => r.phase === 'carried').map(r => r.stackId);
  assert(Supply.stop(f.s, f.h, f.now, 'Personally cancelled.')); assert.equal(Supply.stop(f.s, f.h, f.now, 'again'), false);
  assert(carried.every(id => f.h.item(id).carriedBy === f.s.actor.id && !f.h.item(id).reservedTaskId));
  const other = fixture(), k = order(other); tick(other, 60); other.flags.replaced = true; tick(other);
  assert.equal(k.status, 'interrupted'); assert(k.rows.filter(r => r.phase === 'carried').every(r => other.h.item(r.stackId).carriedBy === other.s.actor.id));
});
test('self-care and blocked walking cannot backfill loading, while a consumed deposit does not invalidate the return', () => {
  const f = fixture(), j = order(f); tick(f, 7); const progress = j.progress;
  tick(f, 40, { care: true }); assert.equal(j.progress, progress);
  tick(f); assert.equal(j.progress, progress); tick(f); assert.equal(j.progress, progress + 1);
  while (j.phase === 'load' && f.now < 150) tick(f);
  f.flags.blocked = true; const position = copy(f.s.actor.mapCell); tick(f, 30);
  assert.deepEqual(f.s.actor.mapCell, position); assert(j.rows.every(r => r.phase === 'carried'));
  f.flags.blocked = false;
  while (!j.rows.some(r => r.phase === 'delivered') && f.now < 250) tick(f);
  const delivered = j.rows.find(r => r.phase === 'delivered'); assert(delivered);
  f.stock = f.stock.filter(i => i.id !== delivered.stackId); // Real local consumption.
  tick(f, 100); assert.equal(j.status, 'completed'); assert.equal(f.s.actor.mapCell.x, 0);
});
test('lost exact cargo cannot fetch surplus; death freezes work and dated report copies never become telemetry', () => {
  const f = fixture(), j = order(f); const snapshot = copy(j); tick(f, 50, { alive: false }); assert.deepEqual(j, snapshot);
  const report = copy(j); f.h.item(j.rows[3].stackId).reservedTaskId = 'someone-else'; tick(f);
  assert.equal(j.status, 'interrupted'); assert.equal(report.status, 'working'); assert.equal(f.stock[0].quantity, 1);
});
test('failed reservation releases only acquired claims, conserving stock and leaving no accepted shipment', () => {
  const f = fixture(); for (const id of ['stock-0', 'stock-0', 'stock-1']) assert(Supply.append(f.s, f.c, id, 0));
  const reserve = f.h.reserve; let count = 0; f.h.reserve = (i, id) => ++count === 3 ? null : reserve(i, id);
  assert.equal(Supply.accept(f.s, f.c, copy(f.s.supplyPreview), 0, f.h), false);
  assert.equal(f.s.supplyLeg, undefined); assert(f.stock.every(i => !i.reservedTaskId));
  assert.equal(f.stock.reduce((n, i) => n + i.quantity, 0), 5);
  f.s.supplyPreview = {}; assert.equal(Porter.append(f.s, {}, null, 0), false); assert.equal(Porter.assign(f.s, {}, null, 0, reserve), false);
});
test('active supply work excludes ordinary hauling orders and uses the existing porter stop/return integration', () => {
  const f = fixture(); order(f);
  f.s.phase = 'onSite'; let stopped = false;
  const h = { stopSupply: () => { stopped = Supply.stop(f.s, f.h, 1, 'withdraw'); return stopped; } };
  assert(Porter.stopJob(f.s, h, 1, 'withdraw')); assert(stopped); assert.equal(f.s.supplyLeg.status, 'interrupted');
});
test('existing employment meters a cancelled supply trip, physically returns the same person and settles once without dropping cargo', () => {
  const f = fixture(), j = order(f), s = f.s;
  const source = { cityId: 'city', populationId: 'people', branchId: 'depot', networkId: 'network', allocationId: s.actor.id, restrictions: [] };
  Object.assign(s, { source, phase: 'onSite', lastAt: 0, dutySeconds: 28800, job: null, history: [], layout: { meeting: cell(-2), groundRoomId: 'ground' } });
  Object.assign(s.actor, { status: 'alive', health: 100, roomId: 'wild', needs: { hunger: 0, thirst: 0, exertion: 0, exposure: 0 } });
  Object.assign(s.contract, { actorId: s.actor.id, bodyEpoch: 0, visitId: 'visit', tripId: 'trip', reserve: 24, hiredAt: 0,
    site: { worldId: 'world' }, drop: cell(0), meeting: cell(-2), policy: '[[],null]', refund: null });
  const c = { alive: true, capable: true, originalBody: true, originalTrip: true, near: true, source,
    bodyEpoch: 0, visitId: 'visit', tripId: 'trip', site: { worldId: 'world' }, drop: cell(0), dropLegal: true };
  const h = { ...f.h, adjacent: goal => s.actor.mapCell.x === goal.x,
    move: goal => { const result = f.h.move(goal); s.actor.roomId = s.actor.mapCell.x < 0 ? 'ground' : 'wild'; return result; },
    stopSupply: (now, reason) => { const stopped = Supply.stop(s, f.h, now, reason); if (stopped) s.phase = 'returning'; return stopped; },
    supplyLeg: (now, c) => Supply.advance(s, c, f.h, now) };
  assert.equal(Porter.canOrder(s, c, 0), false);
  while (!j.rows.some(r => r.phase === 'carried') && f.now < 50) Porter.advance(s, c, h, ++f.now);
  const carried = j.rows.filter(r => r.phase === 'carried').map(r => r.stackId); assert(carried.length);
  Porter.withdraw(s, h, f.now, 'Personal cancellation.');
  assert.equal(s.phase, 'returning'); assert.equal(j.status, 'interrupted');
  assert(carried.every(id => f.h.item(id).carriedBy === s.actor.id && !f.h.item(id).reservedTaskId));
  for (let n = 0; n < 30 && s.phase !== 'awaitingSettlement'; n++) Porter.advance(s, c, h, ++f.now);
  assert.equal(s.phase, 'awaitingSettlement'); assert.equal(s.actor.mapCell.x, -2); assert(s.dutySeconds < 28800); assert(s.contract.earned > 0);
  const wallet = { money: 36 }; assert(Porter.settle(s, { ...c, atGround: true }, wallet, f.now));
  const saved = wallet.money; assert.equal(Porter.settle(s, { ...c, atGround: true }, wallet, f.now), false); assert.equal(wallet.money, saved);
  assert(carried.every(id => f.h.item(id).carriedBy === s.actor.id)); assert.equal(s.contract.startedAt, 0);
});
