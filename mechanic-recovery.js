(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./intercity-trade') : root.HelixIntercityTrade);
  if (node) module.exports = api; else root.HelixMechanicRecovery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Market) {
  'use strict';
  const REST = 8 * 3600, HANDLING = 10, COLLECTION = 600, UNLOAD = 60;
  const GOODS = ['fieldRation', 'drinkingWater'], copy = x => JSON.parse(JSON.stringify(x));
  const healthy = m => m?.actor.status === 'alive' && Number.isFinite(m.actor.health) && m.actor.health >= 50
    && Number.isFinite(m.actor.fatigue) && m.actor.fatigue >= 0 && m.actor.qualification === 'roadVehicleMaintenance';
  const truckAble = v => v?.driver.status === 'alive' && Number.isFinite(v.driver.health) && v.driver.health >= 50
    && Number.isFinite(v.driver.fatigue) && v.driver.fatigue < 80 && Number.isFinite(v.condition) && v.condition > 50
    && Number.isFinite(v.fuelKm) && v.fuelKm > 0;
  function quote(s, support, market, defs, c, at) {
    const m = support?.passengerMaintenance, supplier = support?.supplier, v = supplier?.vehicle;
    if (!s || !m || !market || market.id !== s.location || !Number.isFinite(market.treasury) || market.treasury < 0 || m.source.cityId !== s.location || !healthy(m)
      || !Number.isFinite(m.workSeconds) || m.workSeconds < 0 || m.workSeconds >= REST && m.actor.fatigue === 0
      || m.job || m.recovery || m.toolkitService || m.actor.location !== 'workshop' || m.actor.positionKm !== 0 || m.actor.carriedParts !== 0
      || !c.local || !c.atStand || !c.sameBody || !c.alive || !c.capable || !c.free || c.busy || !c.sourceCurrent
      || !['home', 'foreign'].includes(s.phase) || s.booking || s.rest || support.workshop || supplier.repairAt || supplier.shipment
      || supplier.passengerService || supplier.mechanicService || supplier.maintenanceReservedBy || !supplier.routeOpen
      || v.location !== 'supplier' || !truckAble(v) || !Number.isFinite(c.distanceKm) || c.distanceKm <= 0) return null;
    const goods = [];
    for (const key of GOODS) {
      const def = defs.find(d => d.id === key), listing = market.listings?.[key], metrics = c.metrics?.[key];
      if (!def?.buyable || !Number.isFinite(def.basePrice) || def.basePrice <= 0 || !Number.isFinite(def.supply) || def.supply <= 0
        || !Number.isFinite(listing?.supply) || listing.supply < 2 || !Number.isFinite(listing.demand) || listing.demand <= 0
        || !Number.isFinite(metrics?.massKg) || metrics.massKg <= 0 || !Number.isFinite(metrics.volumeL) || metrics.volumeL <= 0) return null;
      goods.push({ key, quantity: 2, unitPrice: Math.ceil(Market.quote(def, listing).ask), unitMassKg: metrics.massKg,
        unitVolumeL: metrics.volumeL, stock: listing.supply, demand: listing.demand });
    }
    const massKg = goods.reduce((n, g) => n + g.quantity * g.unitMassKg, 0), volumeL = goods.reduce((n, g) => n + g.quantity * g.unitVolumeL, 0);
    // Reserve enough capability for delivery and an unused-lot cancellation return.
    const km = c.distanceKm * 4, fatigue = km * .04 + (COLLECTION + UNLOAD * 3) / 600;
    if (!Number.isFinite(v.capacityKg) || v.capacityKg < massKg || !Number.isFinite(v.capacityL) || v.capacityL < volumeL
      || v.fuelKm < km || v.condition - km * .02 <= 50 || v.driver.fatigue + fatigue >= 80) return null;
    return { cityId: s.location, branchId: m.source.branchId, mechanicId: m.actor.id, supplierVehicleId: v.id,
      supplierDriverId: v.driver.id, bodyEpoch: c.bodyEpoch, vehicleId: s.vehicle.id, distanceKm: c.distanceKm,
      goods, massKg, volumeL, handling: HANDLING, total: HANDLING + goods.reduce((n, g) => n + g.quantity * g.unitPrice, 0),
      restSeconds: REST, deliverySeconds: c.distanceKm * 240 + COLLECTION + UNLOAD,
      quotedAt: at, expiresAt: at + 60 };
  }
  function publish(o, at, message) {
    o.message = message;
    o.reports.push({ id: o.id, at, cityId: o.quote.cityId, bodyEpoch: o.quote.bodyEpoch, mechanicId: o.quote.mechanicId,
      phase: o.phase, progress: o.progress, message, cancelled: o.cancelled, completed: Boolean(o.receipt), refund: o.refund });
  }
  function request(s, support, market, defs, c, expected, wallet, at) {
    if (!expected || !Number.isFinite(expected.quotedAt) || expected.quotedAt > at || at >= expected.expiresAt || !Number.isFinite(wallet.money)) return false;
    const q = quote(s, support, market, defs, c, expected.quotedAt);
    if (!q || JSON.stringify(q) !== JSON.stringify(expected) || wallet.money < q.total) return false;
    const m = support.passengerMaintenance, supplier = support.supplier, id = `${m.actor.id}:recovery:${++m.serial}`;
    wallet.money -= q.total; support.money += HANDLING; support.revenue += HANDLING;
    for (const g of q.goods) market.listings[g.key].supply -= g.quantity;
    const o = m.recovery = { id, quote: copy(q), phase: 'outward', positionKm: 0, progress: 0, work: 0,
      cargo: q.goods.map(g => ({ ...copy(g), id: `${id}:${g.key}`, consumed: 0, custody: 'exchange' })),
      escrow: q.total - HANDLING, lastAt: at, ready: true, cancelled: false, receipt: null, refund: 0, reports: [] };
    supplier.mechanicService = id; supplier.vehicle.location = `mechanic provision road:${id}:0km`;
    publish(o, at, 'Exact food and water reserved at the original city exchange; original truck dispatched. No delivery or duty recovery yet.'); return true;
  }
  function cancel(support, c, at) {
    const o = support?.passengerMaintenance?.recovery;
    if (!o || o.cancelled || o.receipt || !c.alive || !c.sameBody || c.bodyEpoch !== o.quote.bodyEpoch) return false;
    o.cancelled = true; o.lastAt = at; o.ready = true; o.work = 0;
    o.phase = o.cargo.some(g => g.custody === 'workshop' && g.quantity) ? 'loadReturn'
      : o.cargo.some(g => g.custody === 'truck' && g.quantity) ? 'returnGoods' : 'returning';
    publish(o, at, 'Cancellation accepted; consumed provisions and handling remain spent. Unused cargo and escrow await physical return.'); return true;
  }
  function sourceReason(support, market, c, o) {
    const m = support.passengerMaintenance, supplier = support.supplier, q = o.quote;
    if (!c.sourceCurrent || c.bodyEpoch !== q.bodyEpoch || market?.id !== q.cityId || m.source.cityId !== q.cityId
      || m.source.branchId !== q.branchId || m.actor.id !== q.mechanicId || supplier.vehicle.id !== q.supplierVehicleId
      || supplier.vehicle.driver.id !== q.supplierDriverId || supplier.mechanicService !== o.id
      || supplier.distanceKm !== q.distanceKm || supplier.shipment || supplier.passengerService || supplier.repairAt || m.job || m.toolkitService
      || m.actor.location !== 'workshop' || m.actor.positionKm !== 0 || m.actor.carriedParts !== 0) return 'Original city, mechanic, truck, assignment or workshop custody unavailable.';
    for (const g of o.cargo) {
      const original = q.goods.find(e => e.key === g.key);
      if (!original || g.id !== `${o.id}:${g.key}` || g.quantity + g.consumed + (g.returned || 0) !== 2 || !Number.isInteger(g.quantity) || g.quantity < 0
        || g.unitMassKg !== original.unitMassKg || g.unitVolumeL !== original.unitVolumeL || g.unitPrice !== original.unitPrice
        || !market.listings?.[g.key] || !Number.isFinite(market.listings[g.key].supply) || market.listings[g.key].supply < 0)
        return 'Original provision manifest or exchange custody changed.';
    }
    if (!Number.isFinite(market.treasury) || market.treasury < 0) return 'Original exchange account unavailable.';
    return '';
  }
  function refund(support, market, o, wallet, at) {
    for (const g of o.cargo) { market.listings[g.key].supply += g.quantity; g.returned = g.quantity; g.quantity = 0; g.custody = 'exchange'; }
    o.refund += o.escrow; wallet.money += o.escrow; o.escrow = 0;
    publish(o, at, 'Unused original food and water physically returned to exchange custody; remaining escrow refunded once.');
  }
  function finish(support, o, at) {
    const m = support.passengerMaintenance, supplier = support.supplier;
    supplier.vehicle.location = 'supplier'; supplier.passengerReturnedAt = at; delete supplier.mechanicService;
    o.phase = o.cancelled ? 'canceled' : 'completed';
    publish(o, at, o.cancelled ? 'Original truck returned; canceled recovery is closed without restored duty or fatigue.'
      : 'Eight supplied off-duty hours completed by the same mechanic: eight duty hours restored, capped at eight; fatigue reduced by 30. No healing or toolkit repair.');
    (m.recoveryHistory ||= []).push(copy(o)); m.recovery = null;
  }
  function advance(support, market, c, wallet, at) {
    const m = support?.passengerMaintenance, o = m?.recovery;
    if (!o || !c.alive) return false;
    const dt = Math.max(0, at - o.lastAt); o.lastAt = at; if (!dt) return false;
    const reason = sourceReason(support, market, c, o), v = support.supplier.vehicle;
    const rest = o.phase === 'resting';
    if (reason || rest && (!healthy(m) || support.workshop || o.cargo.some(g => g.custody !== 'workshop'))
      || !rest && (!support.supplier.routeOpen || !truckAble(v))) {
      o.ready = false; o.message = reason || 'Original route, truck or mechanic capability unavailable; saved cargo and progress remain.'; return true;
    }
    if (!o.ready) { o.ready = true; return true; }
    if (['outward', 'inbound', 'returnGoods', 'returning'].includes(o.phase)) {
      const outward = ['outward', 'returnGoods'].includes(o.phase), remaining = outward ? o.quote.distanceKm - o.positionKm : o.positionKm;
      const mass = o.cargo.filter(g => g.custody === 'truck').reduce((n, g) => n + g.quantity * g.unitMassKg, 0);
      const volume = o.cargo.filter(g => g.custody === 'truck').reduce((n, g) => n + g.quantity * g.unitVolumeL, 0);
      if (v.capacityKg < mass || v.capacityL < volume) { o.ready = false; o.message = 'Original truck cannot carry its reserved provision cargo.'; return true; }
      const km = Math.max(0, Math.min(remaining, dt / 120, v.fuelKm, (v.condition - 50) / .02, (80 - v.driver.fatigue) / .04));
      v.fuelKm -= km; v.condition -= km * .02; v.driver.fatigue += km * .04; o.positionKm += outward ? km : -km;
      v.location = `mechanic provision road:${o.id}:${o.positionKm.toFixed(4)}km`;
      if (km + .000001 < remaining) return true;
      o.positionKm = outward ? o.quote.distanceKm : 0; o.work = 0; o.ready = false;
      if (o.phase === 'outward') { o.phase = 'collecting'; v.location = `city exchange:${o.quote.cityId}`; }
      else if (o.phase === 'returnGoods') { o.phase = 'unloadReturn'; v.location = `city exchange:${o.quote.cityId}`; }
      else if (o.phase === 'inbound') { o.phase = 'unloading'; v.location = 'supplier'; }
      else { if (o.escrow) refund(support, market, o, wallet, at); finish(support, o, at); }
      return true;
    }
    if (rest) {
      const seconds = Math.min(dt, REST - o.progress), used = o.progress + seconds > REST / 2 ? 2 : 1;
      for (const g of o.cargo) {
        const n = used - g.consumed; g.quantity -= n; g.consumed += n;
        o.escrow -= n * g.unitPrice; market.treasury += n * g.unitPrice;
      }
      o.progress += seconds;
      if (o.progress >= REST) {
        m.workSeconds = Math.min(REST, m.workSeconds + REST); m.actor.fatigue = Math.max(0, m.actor.fatigue - 30);
        o.receipt = { id: o.id, at, mechanicId: m.actor.id, bodyEpoch: o.quote.bodyEpoch, cityId: o.quote.cityId,
          suppliedSeconds: REST, dutySeconds: m.workSeconds, fatigue: m.actor.fatigue, total: o.quote.total };
        finish(support, o, at);
      }
      return true;
    }
    const target = o.phase === 'collecting' ? COLLECTION : UNLOAD;
    const seconds = Math.max(0, Math.min(dt, target - o.work, (80 - v.driver.fatigue) * 600));
    const mass = o.cargo.reduce((n, g) => n + g.quantity * g.unitMassKg, 0), volume = o.cargo.reduce((n, g) => n + g.quantity * g.unitVolumeL, 0);
    if (v.capacityKg < mass || v.capacityL < volume) { o.ready = false; return true; }
    o.work += seconds; v.driver.fatigue += seconds / 600;
    if (o.work < target) return true;
    o.work = 0; o.ready = false;
    if (o.phase === 'collecting') { o.cargo.forEach(g => { g.custody = 'truck'; }); o.phase = 'inbound'; }
    else if (o.phase === 'unloading') {
      o.cargo.forEach(g => { g.custody = 'workshop'; }); o.phase = 'resting';
      publish(o, at, 'Original truck delivered two reserved ration packs and two water units to the workshop; eight supplied off-duty hours now begin.');
    } else if (o.phase === 'loadReturn') { o.cargo.forEach(g => { g.custody = 'truck'; }); o.phase = 'returnGoods'; }
    else if (o.phase === 'unloadReturn') { refund(support, market, o, wallet, at); o.phase = 'returning'; }
    return true;
  }
  function observe(m, c) {
    const o = m?.recovery || m?.recoveryHistory?.at(-1);
    if (!o || !c.local || !c.atStand || !c.sameBody || !c.alive || c.bodyEpoch !== o.quote.bodyEpoch || !c.sourceCurrent) return m?.recoveryObservation || null;
    m.recoveryObservation = copy(o.reports.at(-1)); return m.recoveryObservation;
  }
  function nextEvent(support, market, c, at) {
    const m = support?.passengerMaintenance, o = m?.recovery;
    if (!o || !c.alive || !c.local || c.bodyEpoch !== o.quote.bodyEpoch || sourceReason(support, market, c, o)) return null;
    const rest = o.phase === 'resting', v = support.supplier.vehicle;
    if (rest ? !healthy(m) || support.workshop : !support.supplier.routeOpen || !truckAble(v)) return null;
    const travel = ['outward', 'returnGoods', 'inbound', 'returning'].includes(o.phase);
    const seconds = rest ? REST - o.progress : travel ? (['outward', 'returnGoods'].includes(o.phase) ? o.quote.distanceKm - o.positionKm : o.positionKm) * 120
      : (o.phase === 'collecting' ? COLLECTION : UNLOAD) - o.work;
    return { time: at + (o.ready ? Math.max(1, seconds) : 1), label: 'Original supplied mechanic recovery checkpoint', type: 'travel' };
  }
  return { REST, HANDLING, COLLECTION, UNLOAD, quote, request, cancel, advance, observe, nextEvent };
});
