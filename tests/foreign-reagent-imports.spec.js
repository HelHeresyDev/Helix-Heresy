const { test, expect } = require('@playwright/test');
const Imports = require('../foreign-reagent-imports');
const Supplies = require('../foreign-supplies');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const r = { id: 'allocation:b:1', status: 'received', good: 'assayReagent', quantity: 2, paidAt: 100, receivedAt: 200, shipmentId: 'truck:b:1',
    foreignTerms: { cityId: 'b', propertyId: 'workspace:b', facilityId: 'works:b', good: 'assayReagent', quantity: 2 },
    receipt: { at: 200, stackId: 'original', quantity: 2, cityId: 'b', propertyId: 'workspace:b', facilityId: 'works:b', shipmentId: 'truck:b:1' } };
  const item = { id: 'original', section: 'resources', key: 'assayReagent', quantity: 2, unitMassKg: 1, unitVolumeL: .5,
    tags: ['factory-reagent-allocation'], sourceLabels: ['b', 'works:b', r.id], carriedBy: 'scientist' };
  return { r, item };
}
test('factory imports require actual paid delivery and preserve immutable receipt identity and dimensions', () => {
  for (const change of [r => r.status = 'held', r => r.status = 'purchased', r => r.paidAt = null, r => r.receivedAt = null,
    r => r.receipt = null, r => r.receipt.shipmentId = 'other', r => r.foreignTerms.cityId = 'a', r => r.foreignTerms.propertyId = 'other',
    r => r.foreignTerms.facilityId = 'other', r => r.receipt.quantity = 3, r => r.receipt.at = 99]) {
    const f = fixture(); change(f.r); expect(Imports.register(f.r, f.item)).toBe(false); expect(Imports.receiptFor(f.r, f.item)).toBeNull();
  }
  const f = fixture(); expect(Imports.register(f.r, f.item)).toBe(true);
  expect(Imports.receiptFor(f.r, f.item)).toMatchObject({ kind: 'factoryReagent', orderId: f.r.id, sourceStackId: 'original', deliveredQuantity: 2, receivedAt: 200 });
  expect(Imports.register(f.r, f.item)).toBe(false);
  for (const patch of [{ id: 'label-copy' }, { quantity: 3 }, { sourceLabels: [] }, { unitMassKg: 2 }, { unitVolumeL: 1 }, { key: 'metalParts' }])
    expect(Imports.receiptFor(f.r, { ...f.item, ...patch })).toBeNull();
});
test('factory receipt creation fails without changing the record for invalid physical originals', () => {
  for (const patch of [{ id: 'other' }, { quantity: 1 }, { tags: [] }, { sourceLabels: [] }, { unitMassKg: NaN }, { unitVolumeL: 0 }]) {
    const f = fixture(), before = copy(f.r); expect(Imports.register(f.r, { ...f.item, ...patch })).toBe(false); expect(f.r).toEqual(before);
  }
});
test('actual splits transfer finite balances; copied labels, overdraw and duplicate child IDs cannot manufacture lineage', () => {
  const f = fixture(); Imports.register(f.r, f.item);
  const source = { ...f.item, quantity: 1, carriedBy: '' }, child = { ...f.item, id: 'carried', quantity: 1 };
  expect(Imports.receiptFor(f.r, child)).toBeNull();
  expect(Imports.split(f.r, source, { ...child, quantity: 2 })).toBe(false);
  expect(Imports.split(f.r, source, child)).toBe(true); expect(Imports.split(f.r, source, child)).toBe(false);
  expect(f.r.receipt.importLots.map(l => l.remaining)).toEqual([1, 1]);
  expect(Imports.receiptFor(f.r, child)).not.toBeNull(); expect(Imports.receiptFor(f.r, { ...child, quantity: 2 })).toBeNull();
  const saved = copy(f.r); expect(Imports.receiptFor(saved, child)).toEqual(Imports.receiptFor(f.r, child));
});
test('foreign assay portion consumption and total loss reduce recorded balances permanently without replacing stock', () => {
  const f = fixture(); Imports.register(f.r, f.item);
  f.item.quantity = 1; const portion = { ...f.item, id: 'assay-portion' };
  expect(Imports.split(f.r, f.item, portion)).toBe(true);
  Imports.reconcile(f.r, [f.item]); expect(f.r.receipt.importLots.map(l => l.remaining)).toEqual([1, 0]);
  expect(Imports.receiptFor(f.r, f.item)).not.toBeNull(); expect(Imports.receiptFor(f.r, portion)).toBeNull();
  Imports.reconcile(f.r, [{ ...f.item, quantity: 2 }]); expect(Imports.receiptFor(f.r, { ...f.item, quantity: 2 })).toBeNull();
  Imports.reconcile(f.r, []); Imports.reconcile(f.r, [f.item]); expect(Imports.receiptFor(f.r, f.item)).toBeNull();
  expect(f.r.receipt.quantity).toBe(2);
});
test('home receipt is once-only and survives repacking, splitting and save/load without crediting another delivery', () => {
  const f = fixture(); Imports.register(f.r, f.item);
  expect(Imports.unload(f.r, f.item, 199)).toBe(false); expect(Imports.unload(f.r, f.item, 300)).toBe(true);
  f.r = copy(f.r); expect(Imports.unload(f.r, f.item, 301)).toBe(false); expect(Imports.receiptFor(f.r, f.item)).toBeNull();
  f.item.quantity = 1; const child = { ...f.item, id: 'repacked' };
  expect(Imports.split(f.r, f.item, child)).toBe(true); expect(Imports.receiptFor(f.r, child)).toBeNull();
  expect(f.r.receipt.importLots.every(l => l.unloadedAt === 300)).toBe(true);
});
test('archived original allocations remain importable without live foreign access or a replacement customer', () => {
  const f = fixture(); Imports.register(f.r, f.item);
  const state = { penalFlights: { assistance: { cityApproach: { gates: [{ cityId: 'b', foreignWorkspace: {
    property: { id: 'workspace:b' }, lease: { status: 'ended' }, commission: { reservationHistory: [copy(f.r)], service: { reservation: { status: 'held' } } } } }] } } } };
  const allocations = Imports.allocations(state); expect(allocations).toHaveLength(1); expect(Imports.receiptFor(allocations[0], f.item)).not.toBeNull();
  state.penalFlights.assistance.cityApproach.gates[0].cityId = 'a'; expect(Imports.allocations(state)).toHaveLength(0);
});
test('factory provenance uses ordinary living attendance, owned cargo, finite home space and reservations', () => {
  const f = fixture(); Imports.register(f.r, f.item); const c = { atLab: true, alive: true, capable: true, free: true, sameBody: true, busy: false,
    accessible: true, receipt: Imports.receiptFor(f.r, f.item), remaining: { massKg: 2, volumeL: 1 } };
  expect(Supplies.unloadPlan(f.item, c).ok).toBe(true);
  for (const patch of [{ atLab: false }, { alive: false }, { capable: false }, { free: false }, { sameBody: false }, { busy: true }, { accessible: false },
    { receipt: null }, { remaining: { massKg: 1, volumeL: 1 } }, { remaining: { massKg: 2, volumeL: .5 } }]) expect(Supplies.unloadPlan(f.item, { ...c, ...patch }).ok).toBe(false);
  for (const patch of [{ cityOwnerId: 'b' }, { civicCustody: {} }, { reservedTaskId: 'other' }, { carriedBy: '' }])
    expect(Supplies.unloadPlan({ ...f.item, ...patch }, c).ok).toBe(false);
  expect(Supplies.unloadPlan({ ...f.item, reservedTaskId: 'own' }, c, 'own').ok).toBe(true);
});
