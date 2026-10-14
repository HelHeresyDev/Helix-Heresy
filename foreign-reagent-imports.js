(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixForeignReagentImports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const units = n => Number.isInteger(n) && n >= 0;
  function delivered(r) {
    const p = r?.receipt, q = r?.foreignTerms;
    return Boolean(r?.status === 'received' && r.good === 'assayReagent' && r.quantity === 2
      && Number.isFinite(r.paidAt) && Number.isFinite(r.receivedAt) && p && p.at === r.receivedAt && p.at >= r.paidAt
      && p.quantity === r.quantity && p.stackId && p.shipmentId && p.shipmentId === r.shipmentId
      && q?.good === r.good && q.quantity === r.quantity && p.cityId === q.cityId
      && p.propertyId === q.propertyId && p.facilityId === q.facilityId);
  }
  function matches(r, item) {
    return Boolean(item?.id && item.section === 'resources' && item.key === 'assayReagent' && units(item.quantity)
      && item.tags?.includes('factory-reagent-allocation') && [r.id, r.receipt.cityId, r.receipt.facilityId].every(id => item.sourceLabels?.includes(id))
      && item.unitMassKg === r.receipt.unitMassKg && item.unitVolumeL === r.receipt.unitVolumeL);
  }
  function register(r, item) {
    if (!delivered(r) || r.receipt.importLots || item?.id !== r.receipt.stackId || item.quantity !== r.quantity
      || !Number.isFinite(item.unitMassKg) || item.unitMassKg <= 0 || !Number.isFinite(item.unitVolumeL) || item.unitVolumeL <= 0) return false;
    const metrics = { unitMassKg: item.unitMassKg, unitVolumeL: item.unitVolumeL };
    if (!matches({ ...r, receipt: { ...r.receipt, ...metrics } }, item)) return false;
    Object.assign(r.receipt, metrics);
    r.receipt.importLots = [{ stackId: item.id, parentStackId: null, remaining: item.quantity, unloadedAt: null }];
    return true;
  }
  function valid(r) {
    const lots = r?.receipt?.importLots;
    return delivered(r) && Number.isFinite(r.receipt.unitMassKg) && r.receipt.unitMassKg > 0
      && Number.isFinite(r.receipt.unitVolumeL) && r.receipt.unitVolumeL > 0
      && Array.isArray(lots) && lots.length > 0 && new Set(lots.map(l => l.stackId)).size === lots.length
      && lots[0].stackId === r.receipt.stackId && lots[0].parentStackId === null && lots.every((l, i) => l.stackId && units(l.remaining)
        && (!i || lots.slice(0, i).some(p => p.stackId === l.parentStackId))
        && (l.unloadedAt === null || Number.isFinite(l.unloadedAt)))
      && lots.reduce((n, l) => n + l.remaining, 0) <= r.receipt.quantity;
  }
  function split(r, source, child) {
    if (!valid(r) || !matches(r, source) || !matches(r, child) || child.quantity <= 0) return false;
    const lots = r.receipt.importLots, parent = lots.find(l => l.stackId === source.id);
    if (!parent || lots.some(l => l.stackId === child.id) || parent.remaining !== source.quantity + child.quantity) return false;
    parent.remaining = source.quantity;
    lots.push({ stackId: child.id, parentStackId: source.id, remaining: child.quantity, unloadedAt: parent.unloadedAt });
    return true;
  }
  // Consumption/loss can only decrease recorded balances. New IDs enter this
  // ledger only through an actual registered split, never by copying labels.
  function reconcile(r, stacks) {
    if (!valid(r)) return;
    for (const lot of r.receipt.importLots) {
      const item = stacks.find(i => i.id === lot.stackId);
      lot.remaining = Math.min(lot.remaining, matches(r, item) ? item.quantity : 0);
    }
  }
  function receiptFor(r, item) {
    if (!valid(r) || !matches(r, item) || item.quantity <= 0) return null;
    const lot = r.receipt.importLots.find(l => l.stackId === item.id);
    if (!lot || lot.unloadedAt !== null || item.quantity !== lot.remaining) return null;
    return { kind: 'factoryReagent', orderId: r.id, cityId: r.receipt.cityId, facilityId: r.receipt.facilityId,
      propertyId: r.receipt.propertyId, shipmentId: r.receipt.shipmentId, sourceStackId: r.receipt.stackId,
      receivedAt: r.receipt.at, deliveredQuantity: r.receipt.quantity };
  }
  function unload(r, item, now) {
    if (!Number.isFinite(now) || now < r?.receipt?.at || !receiptFor(r, item)) return false;
    r.receipt.importLots.find(l => l.stackId === item.id).unloadedAt = now;
    return true;
  }
  function allocations(context) {
    const result = [];
    for (const g of context?.penalFlights?.assistance?.cityApproach?.gates || []) {
      const w = g.foreignWorkspace, s = w?.commission;
      for (const r of [...(s?.reservationHistory || []), ...(s?.service?.reservation ? [s.service.reservation] : [])])
        if (delivered(r) && r.receipt.cityId === g.cityId && r.receipt.propertyId === w.property.id) result.push(r);
    }
    return result;
  }
  return { delivered, register, split, reconcile, receiptFor, unload, allocations };
});
