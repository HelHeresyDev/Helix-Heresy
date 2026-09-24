const { test, expect } = require('@playwright/test');
const Recovery = require('../cargo-recovery');
const Local = require('../local-covert-market');
const route = { ok: true, cityId: 'a', distanceKm: 8 };
function fixture(raw = false) {
  const local = Local.create('a'), contact = { id: 'broker', name: 'Sera', homeCityId: 'a', serviceCityIds: ['a'] };
  Local.bind(local, contact, 0);
  const manifest = raw ? { commodityKind: 'rawByproduct', material: 'slime', amount: 7, entries: [{ kind: 'rawByproduct', itemKey: 'jar', amount: 7, sourceReceptacleId: 'original', contents: [{ kind: 'byproduct', label: 'slime', amount: 7, sourceSlimeId: 'moss' }] }] }
    : { commodityKind: 'manufactured', material: 'Primer', amount: 2, entries: [{ kind: 'chemicalBatch', sourceStackId: 'batch-stack', amount: 2, stack: { id: 'batch-stack', section: 'chemicalBatches', key: 'primer', quantity: 2, chemicalBatch: { id: 'batch-1', purity: 94 }, craftsmanship: 78 } }] };
  const sh = { id: 'shipment', brokerId: contact.id, owner: 'player', receiptAt: null, saleFailedAt: 10, phase: 'returned', custodian: 'covert-depot:a', manifest, cargo: { massKg: 7, volumeL: 7 }, playerEscrow: 0 };
  const wallet = { money: 100 }, q = Recovery.quote(local, sh, contact, route, 0);
  const context = { scientistPresent: true, roomId: 'exit', cell: { x: 1, y: 1, z: 0 }, capacities: { jar: 5 } };
  return { local, contact, sh, wallet, q, context };
}
function booked(raw = false) { const f = fixture(raw); f.job = Recovery.book(f.local, f.sh, f.contact, route, f.q, f.wallet, 0).job; return f; }
test('recovery quotes enforce ownership, locality, cargo kind and actual courier resources', () => {
  for (const bad of ['owner', 'custody', 'living', 'busy', 'fuel', 'capacity']) {
    const f = fixture();
    if (bad === 'owner') f.sh.owner = 'buyer'; if (bad === 'custody') f.sh.custodian = 'foreign-gate'; if (bad === 'living') f.sh.living = {};
    if (bad === 'busy') f.local.couriers[0].assignment = 'other'; if (bad === 'fuel') f.local.couriers[0].fuelKm = 0;
    if (bad === 'capacity') f.sh.cargo.volumeL = 999;
    expect(Recovery.quote(f.local, f.sh, f.contact, route, 0).ok, bad).toBe(false);
  }
});
test('confirmation rechecks quote, funds and exact manifest without partial payment or reservations', () => {
  const f = fixture(); f.wallet.money = 0;
  expect(Recovery.book(f.local, f.sh, f.contact, route, f.q, f.wallet, 0).ok).toBe(false);
  f.wallet.money = 100; f.sh.manifest.entries[0].amount++;
  expect(Recovery.book(f.local, f.sh, f.contact, route, f.q, f.wallet, 0).ok).toBe(false);
  expect(f.local.collections).toHaveLength(0); expect(f.wallet.money).toBe(100);
});
test('paid recovery moves one authoritative manifest, cannot cancel as an empty pickup, and waits through route holds', () => {
  const f = booked(); expect(f.sh.manifest).toBeNull(); expect(f.job.manifest.entries).toHaveLength(1);
  expect(f.wallet.money).toBe(100 - f.q.fee); expect(f.local.couriers[0].money).toBe(500 + f.q.fee);
  expect(Local.cancel(f.local, f.job.obligationId, 0)).toBe(false);
  expect(Recovery.book(f.local, f.sh, f.contact, route, f.q, f.wallet, 0).ok).toBe(false);
  Local.advance(f.local, 3600, { ...route, ok: false }); expect(f.job.positionKm).toBe(0);
  Local.advance(f.local, 4800, route); expect(f.job.phase).toBe('waiting');
});
test('physical receipt preserves batch metadata and partial-stack identity without reviving the sale; reload and return are single-use', () => {
  const f = booked(), inventory = [{ id: 'batch-stack', quantity: 3, roomId: 'lab' }];
  expect(Recovery.receive(f.local, f.sh, inventory, f.context, 0).ok).toBe(false);
  Local.advance(f.local, 1200, route);
  expect(Recovery.receive(f.local, f.sh, inventory, { ...f.context, scientistPresent: false }, 1200).ok).toBe(false);
  const saved = JSON.parse(JSON.stringify({ local: f.local, sh: f.sh, inventory }));
  expect(Recovery.receive(f.local, f.sh, inventory, f.context, 1200).ok).toBe(true);
  Recovery.receive(saved.local, saved.sh, saved.inventory, f.context, 1200); expect(saved.inventory).toEqual(inventory);
  expect(inventory[0].quantity).toBe(3); expect(inventory[1]).toMatchObject({ roomId: 'exit', quantity: 2, chemicalBatch: { id: 'batch-1', purity: 94 }, craftsmanship: 78 });
  expect(inventory[1].id).not.toBe('batch-stack'); expect(f.sh.saleFailedAt).toBe(10); expect(f.sh.receiptAt).toBeNull();
  expect(Recovery.receive(f.local, f.sh, inventory, f.context, 1200).ok).toBe(false);
  expect(f.local.couriers[0].assignment).toBe(f.job.id); Local.advance(f.local, 2400, route);
  expect(f.local.couriers[0].assignment).toBeNull(); expect(f.local.couriers[0].fuelKm).toBe(144); expect(f.job.manifest).toBeNull();
});
test('raw cargo requires compatible empty receptacles at the exit and commits the whole manifest atomically', () => {
  const f = booked(true); Local.advance(f.local, 1200, route);
  const inventory = [{ id: 'jars', section: 'inventory', key: 'jar', roomId: 'exit', quantity: 1, knownQuantity: 1, contents: [] }];
  const before = JSON.stringify(inventory);
  expect(Recovery.receive(f.local, f.sh, inventory, f.context, 1200).ok).toBe(false); expect(JSON.stringify(inventory)).toBe(before);
  inventory[0].quantity = inventory[0].knownQuantity = 2;
  expect(Recovery.receive(f.local, f.sh, inventory, f.context, 1200).ok).toBe(true);
  expect(inventory.flatMap(s => s.contents).reduce((n, c) => n + c.amount, 0)).toBe(7);
  expect(inventory.every(s => s.contents[0].sourceSlimeId === 'moss')).toBe(true); expect(f.job.manifest).toBeNull();
});
test('expired quotes and changed routes cannot charge or teleport the returned lot', () => {
  const f = fixture();
  expect(Recovery.book(f.local, f.sh, f.contact, route, f.q, f.wallet, 3601).ok).toBe(false);
  expect(f.wallet.money).toBe(100); expect(f.local.couriers[0].assignment).toBeNull();
  const b = booked(); Local.advance(b.local, 1200, { ...route, distanceKm: 16 });
  expect(b.job.positionKm).toBe(0); expect(b.job.manifest).toBeTruthy();
});
test('raw packing uses total compatible capacity while retaining distinct sources and refusing remote or reserved jars', () => {
  const f = fixture(true);
  f.sh.manifest.entries[0].contents = [{ kind: 'byproduct', amount: 3, source: 'one' }, { kind: 'byproduct', amount: 4, source: 'two' }];
  const q = Recovery.quote(f.local, f.sh, f.contact, route, 0);
  Recovery.book(f.local, f.sh, f.contact, route, q, f.wallet, 0); Local.advance(f.local, 1200, route);
  const jars = [{ id: 'jars', section: 'inventory', key: 'jar', roomId: 'lab', quantity: 2, knownQuantity: 2, contents: [] }];
  expect(Recovery.receive(f.local, f.sh, jars, f.context, 1200).ok).toBe(false);
  jars[0].roomId = 'exit'; jars[0].reservedTaskId = 'haul';
  expect(Recovery.receive(f.local, f.sh, jars, f.context, 1200).ok).toBe(false);
  jars[0].reservedTaskId = '';
  expect(Recovery.receive(f.local, f.sh, jars, f.context, 1200).ok).toBe(true);
  expect(jars).toHaveLength(2);
  const contents = jars.flatMap(s => s.contents);
  expect(contents.filter(c => c.source === 'one').reduce((n, c) => n + c.amount, 0)).toBe(3);
  expect(contents.filter(c => c.source === 'two').reduce((n, c) => n + c.amount, 0)).toBe(4);
});
