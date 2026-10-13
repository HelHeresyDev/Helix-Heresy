(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HelixToolkitServicing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const WORK = 3600, GAIN = 25, PART_PRICE = 5, LABOR_PRICE = 10, PRICE = 15;
  const copy = x => JSON.parse(JSON.stringify(x));
  const able = m => m?.actor.status === 'alive' && Number.isFinite(m.actor.health) && m.actor.health >= 50
    && m.actor.qualification === 'roadVehicleMaintenance' && Number.isFinite(m.actor.fatigue)
    && m.actor.fatigue >= 0 && m.actor.fatigue < 80 && Number.isFinite(m.workSeconds) && m.workSeconds > 0;
  function quote(s, support, c, at) {
    const m = support?.passengerMaintenance, supplier = support?.supplier;
    if (!s || !m || !supplier || !c.local || !c.atStand || !c.sameBody || !c.alive || !c.capable || !c.free || c.busy || !c.sourceCurrent
      || !['home', 'foreign'].includes(s.phase) || s.booking || s.rest || m.source.cityId !== s.location
      || !able(m) || m.actor.location !== 'workshop' || m.actor.positionKm !== 0 || m.actor.carriedParts !== 0
      || m.job || m.recovery || m.toolkitService || support.workshop || supplier.repairAt || supplier.shipment
      || supplier.passengerService || supplier.mechanicService || supplier.maintenanceReservedBy
      || !Number.isInteger(support.parts) || support.parts < 1 || !Number.isFinite(support.money) || !Number.isFinite(support.revenue)
      || !m.toolkit?.id || !Number.isFinite(m.toolkit.condition) || m.toolkit.condition < 0 || m.toolkit.condition >= 100
      || m.workSeconds < WORK || m.actor.fatigue + WORK / 600 >= 80) return null;
    return { cityId: s.location, branchId: m.source.branchId, mechanicId: m.actor.id, toolkitId: m.toolkit.id,
      vehicleId: s.vehicle.id, bodyEpoch: c.bodyEpoch, distanceKm: c.distanceKm, condition: m.toolkit.condition,
      gain: Math.min(GAIN, 100 - m.toolkit.condition), parts: 1, workSeconds: WORK,
      partPrice: PART_PRICE, laborPrice: LABOR_PRICE, total: PRICE, quotedAt: at, expiresAt: at + 60 };
  }
  function publish(o, at, message) {
    o.message = message;
    o.reports.push({ id: o.id, at, cityId: o.quote.cityId, bodyEpoch: o.quote.bodyEpoch,
      toolkitId: o.quote.toolkitId, message, completed: Boolean(o.receipt), cancelled: o.cancelled, refund: o.refund });
  }
  function request(s, support, c, expected, wallet, at) {
    if (!expected || !Number.isFinite(expected.quotedAt) || expected.quotedAt > at || at >= expected.expiresAt
      || !Number.isFinite(wallet.money)) return false;
    const q = quote(s, support, c, expected.quotedAt);
    if (!q || JSON.stringify(q) !== JSON.stringify(expected) || wallet.money < q.total) return false;
    const m = support.passengerMaintenance, id = `${m.actor.id}:toolkit-service:${++m.serial}`;
    wallet.money -= PRICE; support.parts--;
    const o = m.toolkitService = { id, quote: copy(q), progress: 0, partsUsed: 0, laborPaidCents: 0,
      escrowCents: PRICE * 100, expectedCondition: q.condition, lastAt: at, ready: true, cancelled: false, receipt: null, refund: 0,
      cargo: { id: `${id}:part`, sourceCityId: q.cityId, source: 'Original city depot maintenance stock',
        custody: 'workshop', quantity: 1, unitMassKg: 2, unitVolumeL: 1 }, reports: [] };
    support.supplier.maintenanceReservedBy = id;
    publish(o, at, 'Original depot part reserved at the workshop for the returned original toolkit. Payment alone repairs nothing.'); return true;
  }
  function sourceReason(support, c, o) {
    const m = support.passengerMaintenance, q = o.quote, g = o.cargo;
    if (!c.sourceCurrent || c.bodyEpoch !== q.bodyEpoch || m.source.cityId !== q.cityId || m.source.branchId !== q.branchId
      || m.actor.id !== q.mechanicId || m.toolkit?.id !== q.toolkitId || m.actor.location !== 'workshop'
      || m.actor.positionKm !== 0 || m.actor.carriedParts !== 0 || m.job || m.recovery || support.workshop
      || support.supplier.maintenanceReservedBy !== o.id || support.supplier.passengerService || support.supplier.mechanicService
      || support.supplier.repairAt || !Number.isInteger(support.parts) || support.parts < 0
      || !Number.isFinite(support.money) || !Number.isFinite(support.revenue)) return 'Original mechanic, toolkit, city or shared workshop unavailable.';
    if (g.id !== `${o.id}:part` || g.sourceCityId !== q.cityId || g.source !== 'Original city depot maintenance stock'
      || g.custody !== 'workshop' || g.unitMassKg !== 2 || g.unitVolumeL !== 1 || !Number.isInteger(g.quantity) || g.quantity < 0
      || g.quantity + o.partsUsed !== 1) return 'Original reserved workshop part or custody changed.';
    if (!Number.isFinite(m.toolkit.condition) || Math.abs(m.toolkit.condition - o.expectedCondition) > .000001)
      return 'Original toolkit condition changed beyond authorized servicing.';
    return '';
  }
  function finish(support, o, at) {
    const m = support.passengerMaintenance;
    delete support.supplier.maintenanceReservedBy;
    publish(o, at, o.cancelled ? 'Toolkit servicing canceled: actual improvements, consumed part and earned labor remain spent; unused workshop stock and unearned payment returned once.'
      : 'Original toolkit servicing completed: actual condition improved once. No duty recovery, healing, replacement tools or vehicle repairs.');
    (m.toolkitServiceHistory ||= []).push(copy(o)); m.toolkitService = null;
  }
  function cancel(support, c, wallet, at) {
    const o = support?.passengerMaintenance?.toolkitService;
    if (!o || o.cancelled || o.receipt || !c.alive || !c.sameBody || c.bodyEpoch !== o.quote.bodyEpoch
      || sourceReason(support, c, o) || !Number.isFinite(wallet.money)) return false;
    // The unused part is already physically at its original workshop, not on a road.
    o.cancelled = true; o.lastAt = at; support.parts += o.cargo.quantity; o.cargo.returned = o.cargo.quantity; o.cargo.quantity = 0;
    o.refund = o.escrowCents / 100; wallet.money += o.refund; o.escrowCents = 0;
    finish(support, o, at); return true;
  }
  function advance(support, c, at) {
    const m = support?.passengerMaintenance, o = m?.toolkitService;
    if (!o || !c.alive) return false;
    const dt = Math.max(0, at - o.lastAt); o.lastAt = Math.max(at, o.lastAt); if (!dt) return false;
    const reason = sourceReason(support, c, o);
    if (reason || !able(m)) { o.ready = false; o.message = reason || 'Original mechanic capability or finite duty unavailable; saved work remains.'; return true; }
    if (!o.ready) { o.ready = true; return true; }
    const seconds = Math.max(0, Math.min(dt, WORK - o.progress, m.workSeconds, (80 - m.actor.fatigue) * 600));
    if (!seconds) return false;
    if (!o.partsUsed) { o.partsUsed = 1; o.cargo.quantity = 0; o.escrowCents -= PART_PRICE * 100; support.money += PART_PRICE; support.revenue += PART_PRICE; }
    m.workSeconds -= seconds; m.actor.fatigue = Math.min(80, m.actor.fatigue + seconds / 600);
    o.progress += seconds; o.expectedCondition = Math.min(100, o.quote.condition + o.quote.gain * o.progress / WORK);
    m.toolkit.condition = o.expectedCondition;
    const earned = Math.floor(LABOR_PRICE * 100 * o.progress / WORK), paid = earned - o.laborPaidCents;
    o.laborPaidCents = earned; o.escrowCents -= paid; support.money += paid / 100; support.revenue += paid / 100;
    if (o.progress >= WORK) {
      o.receipt = { id: o.id, at, cityId: o.quote.cityId, mechanicId: m.actor.id, toolkitId: m.toolkit.id,
        bodyEpoch: o.quote.bodyEpoch, workSeconds: WORK, partsUsed: 1, restoredCondition: o.quote.gain, total: PRICE };
      finish(support, o, at);
    }
    return true;
  }
  function observe(m, c) {
    const o = m?.toolkitService || m?.toolkitServiceHistory?.at(-1);
    if (!o || !c.local || !c.atStand || !c.sameBody || !c.alive || !c.sourceCurrent || c.bodyEpoch !== o.quote.bodyEpoch)
      return m?.toolkitServiceObservation || null;
    m.toolkitServiceObservation = copy(o.reports.at(-1)); return m.toolkitServiceObservation;
  }
  function nextEvent(support, c, at) {
    const m = support?.passengerMaintenance, o = m?.toolkitService;
    if (!o || !c.alive || !c.local || sourceReason(support, c, o) || !able(m)) return null;
    return { time: at + (o.ready ? Math.max(1, Math.min(WORK - o.progress, m.workSeconds, (80 - m.actor.fatigue) * 600)) : 1),
      label: 'Original toolkit servicing checkpoint', type: 'travel' };
  }
  return { WORK, GAIN, PART_PRICE, LABOR_PRICE, PRICE, quote, request, cancel, advance, observe, nextEvent };
});
