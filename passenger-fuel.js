(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HelixPassengerFuel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CAP = 2400, HANDLING = 20, RATE = .05, TRANSFER = 120;
  const copy = x => JSON.parse(JSON.stringify(x));
  const able = v => v && Number.isFinite(v.fuelKm) && v.fuelKm >= 0 && Number.isFinite(v.condition) && v.condition >= 50
    && v.driver?.status === 'alive' && Number.isFinite(v.driver.health) && v.driver.health >= 50 && Number.isFinite(v.driver.fatigue) && v.driver.fatigue < 80;
  const active = supplier => supplier?.passengerService || null;
  function quote(s, supplier, c, amount, at) {
    if (!s || !supplier || !c.local || !c.atStand || !c.sameBody || !c.alive || !c.capable || !c.free || c.busy
      || !c.sourceCurrent || !['home', 'foreign'].includes(s.phase) || s.booking || s.rest || active(supplier)
      || supplier.shipment || supplier.repairAt || supplier.maintenanceReservedBy || supplier.vehicle.location !== 'supplier' || !supplier.routeOpen
      || !able(supplier.vehicle) || s.driver.health < 50 || ![100, 200, 400].includes(amount)
      || !Number.isFinite(s.vehicle.fuelKm) || s.vehicle.fuelKm < 0 || s.vehicle.fuelKm + amount > CAP
      || !Number.isFinite(supplier.fuelStockKm) || supplier.fuelStockKm < amount
      || !Number.isFinite(c.distanceKm) || c.distanceKm <= 0) return null;
    const km = c.distanceKm * 2, v = supplier.vehicle;
    if (v.fuelKm < km || v.condition - km * .02 < 50 || v.driver.fatigue + km * .04 >= 80) return null;
    return { cityId: s.location, branchId: s.source.branchId, vehicleId: s.vehicle.id, driverId: s.driver.id,
      supplierVehicleId: v.id, supplierDriverId: v.driver.id, bodyEpoch: c.bodyEpoch,
      stand: copy(c.stand), distanceKm: c.distanceKm, amount, handling: HANDLING, rate: RATE,
      total: HANDLING + amount * RATE, seconds: Math.ceil(km / 30 * 3600) + TRANSFER,
      quotedAt: at, expiresAt: at + 60, tankFuelKm: s.vehicle.fuelKm };
  }
  function request(s, supplier, c, expected, wallet, support, at) {
    if (!expected || !Number.isFinite(expected.quotedAt) || at >= expected.expiresAt || expected.quotedAt > at || !Number.isFinite(wallet.money)) return false;
    const q = quote(s, supplier, c, expected.amount, expected.quotedAt);
    if (!q || JSON.stringify(q) !== JSON.stringify(expected) || wallet.money < q.total) return false;
    const id = `${supplier.vehicle.id}:passenger-fuel:${supplier.nextNumber++}`;
    wallet.money -= q.total; supplier.fuelStockKm -= q.amount;
    support.money += q.handling; support.revenue += q.handling;
    supplier.passengerService = { id, quote: copy(q), phase: 'outbound', positionKm: 0, cargoKm: q.amount,
      progress: 0, lastAt: at, attendedAt: null, movementReady: true, transferReady: false,
      escrow: q.amount * RATE, cancelled: false, refund: 0, receipt: null, message: 'Original supplier truck dispatched with reserved fuel.' };
    supplier.vehicle.location = `passenger fuel road:${id}:0km`; return true;
  }
  function cancel(supplier, c, at) {
    const o = active(supplier);
    if (!o || o.receipt || o.cancelled || !c.alive || o.quote.bodyEpoch !== c.bodyEpoch) return false;
    o.cancelled = true; o.phase = 'returning'; o.lastAt = at; o.attendedAt = null;
    o.movementReady = true; o.message = 'Canceled: original fuel remains on the truck until physical return; handling is spent.';
    return true;
  }
  function transferReason(s, supplier, c, o) {
    const q = o.quote;
    if (!c.local || !c.atStand || !c.sameBody || !c.capable || !c.free || c.busy || !c.sourceCurrent
      || c.bodyEpoch !== q.bodyEpoch || !s || s.vehicle.id !== q.vehicleId || s.driver.id !== q.driverId
      || s.source.branchId !== q.branchId || s.location !== q.cityId || JSON.stringify(c.stand) !== JSON.stringify(q.stand)
      || !['home', 'foreign'].includes(s.phase) || s.booking || s.rest || s.driver.health < 50)
      return 'Actual original-body attendance at the selected original vehicle and published stand is required.';
    if (!Number.isFinite(s.vehicle.fuelKm) || s.vehicle.fuelKm < 0 || s.vehicle.fuelKm + o.cargoKm > CAP)
      return 'The exact fuel allocation no longer fits the original tank; cancel for physical return.';
    return '';
  }
  function advance(s, supplier, c, wallet, support, at) {
    const o = active(supplier); if (!o || !c.alive) return false;
    let dt = Math.max(0, at - o.lastAt); o.lastAt = at; if (!dt) return false;
    const v = supplier.vehicle, q = o.quote;
    const movement = c.sourceCurrent && supplier.routeOpen && able(v) && v.id === q.supplierVehicleId && v.driver.id === q.supplierDriverId;
    if (!movement) { o.movementReady = false; o.transferReady = false; o.attendedAt = null;
      o.message = 'Original supplier, local route or finite truck capability unavailable; cargo stays in custody.'; return true; }
    if (['outbound', 'returning'].includes(o.phase)) {
      if (!o.movementReady) { o.movementReady = true; return true; }
      const remaining = o.phase === 'outbound' ? q.distanceKm - o.positionKm : o.positionKm;
      const km = Math.max(0, Math.min(remaining, dt / 120, v.fuelKm, (v.condition - 50) / .02, (80 - v.driver.fatigue) / .04));
      v.fuelKm = Math.max(0, v.fuelKm - km); v.condition = Math.max(50, v.condition - km * .02); v.driver.fatigue += km * .04;
      o.positionKm += o.phase === 'outbound' ? km : -km;
      v.location = `passenger fuel road:${o.id}:${o.positionKm.toFixed(4)}km`;
      if (km + .000001 < remaining) { o.message = km ? 'Original fuel truck traveling on the saved local service road.' : 'Truck reserves exhausted; no replacement or emergency fuel.'; return true; }
      if (o.phase === 'outbound') {
        o.positionKm = q.distanceKm; o.phase = 'transfer'; o.attendedAt = null; o.transferReady = false;
        v.location = `passenger stand:${q.vehicleId}`; o.message = 'Truck arrived: two minutes of original attended transfer still required.';
      } else {
        o.positionKm = 0; v.location = 'supplier'; supplier.passengerReturnedAt = at; supplier.fuelStockKm += o.cargoKm;
        o.refund = o.escrow; wallet.money += o.refund; o.escrow = 0; o.cargoKm = 0; o.phase = 'returned';
        (supplier.passengerHistory ||= []).push(copy(o)); supplier.passengerService = null;
      }
      return true;
    }
    const reason = transferReason(s, supplier, c, o);
    if (reason) { o.message = reason; o.transferReady = false; o.attendedAt = null; return true; }
    if (!o.transferReady) { o.transferReady = true; o.attendedAt = at; return true; }
    const work = Math.max(0, Math.min(dt, TRANSFER - o.progress, (80 - v.driver.fatigue) * 600));
    o.progress += work; v.driver.fatigue = Math.min(80, v.driver.fatigue + work / 600); o.message = 'Actual attended transfer in progress.';
    if (o.progress >= TRANSFER) {
      s.vehicle.fuelKm += o.cargoKm;
      o.receipt = { id: o.id, at, amount: o.cargoKm, cityId: q.cityId, vehicleId: q.vehicleId,
        driverId: q.driverId, supplierVehicleId: q.supplierVehicleId, supplierDriverId: q.supplierDriverId, bodyEpoch: q.bodyEpoch, total: q.total };
      (s.fuelReceipts ||= []).push(copy(o.receipt));
      support.money += o.escrow; support.revenue += o.escrow; o.escrow = 0; o.cargoKm = 0;
      o.phase = 'returning'; o.movementReady = true; o.attendedAt = null;
      o.message = 'Fuel physically transferred once; original supplier truck still returning. No repair or duty recovery.';
    }
    return true;
  }
  function nextEvent(s, supplier, c, at) {
    const o = active(supplier);
    if (!o || !c.alive || !c.local || o.quote.bodyEpoch !== c.bodyEpoch || !c.sourceCurrent || !supplier.routeOpen || !able(supplier.vehicle)) return null;
    if (['outbound', 'returning'].includes(o.phase)) {
      const km = o.phase === 'outbound' ? o.quote.distanceKm - o.positionKm : o.positionKm;
      if (supplier.vehicle.fuelKm < km || supplier.vehicle.condition - km * .02 < 50 || supplier.vehicle.driver.fatigue + km * .04 >= 80) return null;
      return { time: at + (o.movementReady ? Math.max(1, Math.ceil(km * 120)) : 1), label: 'Original passenger fuel-truck service checkpoint', type: 'travel' };
    }
    return transferReason(s, supplier, c, o) ? null : { time: at + (o.transferReady ? Math.max(1, TRANSFER - o.progress) : 1), label: 'Attended passenger refuelling checkpoint', type: 'travel' };
  }
  return { CAP, HANDLING, RATE, TRANSFER, active, quote, request, cancel, advance, transferReason, nextEvent };
});
