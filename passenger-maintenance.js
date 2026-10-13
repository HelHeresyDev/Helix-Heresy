(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HelixPassengerMaintenance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const WORK = 7200, PARTS = 2, GAIN = 25, PRICE = 40, CALLOUT = 20;
  const copy = x => JSON.parse(JSON.stringify(x));
  const able = m => m?.actor.status === 'alive' && Number.isFinite(m.actor.health) && m.actor.health >= 50
    && Number.isFinite(m.actor.fatigue) && m.actor.fatigue >= 0 && m.actor.fatigue < 80
    && Number.isFinite(m.workSeconds) && m.workSeconds > 0;
  function create(city, standings, at) {
    const entry = standings?.find(e => e.network?.category === 'transport' && e.branch && e.branch.cityId === city?.cityId
      && ['licensed', 'chartered', 'recognized'].includes(e.standing) && ['functional', 'strong', 'regionalHub'].includes(e.branch.capacityBand)
      && e.branch.publicPhysicalPresence !== false && !['ruined', 'destroyed'].includes(e.branch.physicalCondition)
      && (!e.branch.operationalStatus || e.branch.operationalStatus === 'active'));
    if (!entry || !Number.isFinite(city.currentPopulation) || city.currentPopulation < 3 || city.physicalCondition === 'ruined'
      || ['abandoned', 'destroyed'].includes(city.habitationStatus) || !['functional', 'strong'].includes(city.services?.transport)) return null;
    return { source: { cityId: city.cityId, branchId: entry.branch.id, populationId: city.assetId || city.cityId, people: 1 },
      actor: { id: `${entry.branch.id}:callout-mechanic`, name: `${entry.branch.publicName} callout mechanic`, status: 'alive', health: 100,
        fatigue: 0, qualification: 'roadVehicleMaintenance', location: 'workshop', positionKm: 0, carriedParts: 0, capacityKg: 16, capacityL: 16 },
      toolkit: { id: `${entry.branch.id}:mechanic-toolkit`, condition: 100, massKg: 6, volumeL: 6 },
      workSeconds: 8 * 3600, serial: 0, job: null, history: [], observation: null, createdAt: at };
  }
  function quote(s, support, c, at) {
    const m = support?.passengerMaintenance, supplier = support?.supplier;
    if (!s || !m || !supplier || !c.local || !c.atStand || !c.sameBody || !c.alive || !c.capable || !c.free || c.busy || !c.sourceCurrent
      || !['home', 'foreign'].includes(s.phase) || s.booking || s.rest || s.driver.health < 50 || m.source.cityId !== s.location
      || m.job || m.recovery || support.workshop || supplier.repairAt || supplier.maintenanceReservedBy || supplier.passengerService || supplier.mechanicService
      || !supplier.routeOpen || !able(m) || m.actor.qualification !== 'roadVehicleMaintenance' || m.actor.location !== 'workshop'
      || !Number.isInteger(support.parts) || support.parts < PARTS || !Number.isFinite(s.vehicle.condition) || s.vehicle.condition <= 0 || s.vehicle.condition >= 100
      || !Number.isFinite(c.distanceKm) || c.distanceKm <= 0) return null;
    const seconds = c.distanceKm * 2 * 900 + WORK;
    if (m.workSeconds < seconds || m.actor.fatigue + seconds / 600 >= 80 || !Number.isFinite(m.toolkit.condition) || m.toolkit.condition < WORK * .001
      || m.actor.capacityKg < m.toolkit.massKg + PARTS * 2 || m.actor.capacityL < m.toolkit.volumeL + PARTS) return null;
    return { cityId: s.location, branchId: s.source.branchId, vehicleId: s.vehicle.id, driverId: s.driver.id,
      mechanicId: m.actor.id, toolkitId: m.toolkit.id, mechanicBranchId: m.source.branchId, bodyEpoch: c.bodyEpoch, stand: copy(c.stand),
      distanceKm: c.distanceKm, condition: s.vehicle.condition, gain: Math.min(GAIN, 100 - s.vehicle.condition), parts: PARTS,
      workSeconds: WORK, seconds, total: PRICE, callout: CALLOUT, partsPrice: 10, laborPrice: 10, quotedAt: at, expiresAt: at + 60 };
  }
  function request(s, support, c, expected, wallet, at) {
    if (!expected || !Number.isFinite(expected.quotedAt) || expected.quotedAt > at || at >= expected.expiresAt || !Number.isFinite(wallet.money)) return false;
    const q = quote(s, support, c, expected.quotedAt);
    if (!q || JSON.stringify(q) !== JSON.stringify(expected) || wallet.money < q.total) return false;
    const m = support.passengerMaintenance, id = `${m.actor.id}:repair:${++m.serial}`;
    wallet.money -= q.total; support.parts -= PARTS; support.money += CALLOUT; support.revenue += CALLOUT;
    m.job = { id, quote: copy(q), phase: 'outward', progress: 0, partsUsed: 0, laborPaidCents: 0, escrowCents: 2000,
      lastAt: at, ready: true, cancelled: false, expectedCondition: q.condition, receipt: null, refund: 0,
      cargo: { id: `${id}:parts`, source: 'Original city depot maintenance stock', quantity: PARTS, unitMassKg: 2, unitVolumeL: 1 },
      message: 'Original mechanic departed carrying two reserved depot parts and the original toolkit.' };
    m.actor.carriedParts = PARTS; m.actor.positionKm = 0; m.actor.location = `maintenance road:${id}:0km`;
    support.supplier.maintenanceReservedBy = id; return true;
  }
  function cancel(support, c, at) {
    const m = support?.passengerMaintenance, o = m?.job;
    if (!o || o.cancelled || o.receipt || !c.alive || !c.sameBody || c.bodyEpoch !== o.quote.bodyEpoch) return false;
    o.cancelled = true; o.phase = 'returning'; o.lastAt = at; o.ready = true;
    o.message = 'Canceled: actual improvements and spent costs remain; unused parts and escrow await physical return.'; return true;
  }
  function workReason(s, support, c, o) {
    const m = support.passengerMaintenance, q = o.quote;
    if (!c.sourceCurrent || c.bodyEpoch !== q.bodyEpoch || !s || s.location !== q.cityId || s.source.branchId !== q.branchId || s.vehicle.id !== q.vehicleId
      || s.driver.id !== q.driverId || !['home', 'foreign'].includes(s.phase) || s.booking || s.rest || JSON.stringify(c.stand) !== JSON.stringify(q.stand)
      || support.workshop || support.supplier.maintenanceReservedBy !== o.id || m.actor.id !== q.mechanicId || m.toolkit.id !== q.toolkitId
      || m.actor.location !== `passenger stand:${q.vehicleId}` || m.actor.carriedParts !== o.cargo.quantity)
      return 'Original parked vehicle, mechanic, toolkit, reserved cargo or workshop availability changed.';
    if (Math.abs(s.vehicle.condition - o.expectedCondition) > .000001 || s.vehicle.condition <= 0)
      return 'Vehicle condition changed beyond the authorized repair; cancel and inspect new terms.';
    return '';
  }
  function advance(s, support, c, wallet, at) {
    const m = support?.passengerMaintenance, o = m?.job;
    if (!o || !c.alive) return false;
    const dt = Math.max(0, at - o.lastAt); o.lastAt = at; if (!dt) return false;
    const q = o.quote;
    if (!c.sourceCurrent || !support.supplier.routeOpen || !able(m) || m.actor.id !== q.mechanicId || m.toolkit.id !== q.toolkitId
      || m.actor.qualification !== 'roadVehicleMaintenance' || support.supplier.maintenanceReservedBy !== o.id
      || o.cargo.id !== `${o.id}:parts` || o.cargo.unitMassKg !== 2 || o.cargo.unitVolumeL !== 1
      || !Number.isInteger(o.cargo.quantity) || o.cargo.quantity < 0 || o.cargo.quantity + o.partsUsed !== PARTS
      || m.actor.carriedParts !== o.cargo.quantity || m.actor.capacityKg < m.toolkit.massKg + o.cargo.quantity * 2
      || m.actor.capacityL < m.toolkit.volumeL + o.cargo.quantity) {
      o.ready = false; o.message = 'Original mechanic, tools, finite duty or local road unavailable; cargo stays in physical custody.'; return true;
    }
    if (o.phase === 'repairing' && workReason(s, support, c, o)) {
      o.ready = false; o.message = workReason(s, support, c, o); return true;
    }
    if (o.phase === 'repairing' && (!Number.isFinite(m.toolkit.condition) || m.toolkit.condition <= 0)) {
      o.ready = false; o.message = 'Original toolkit exhausted; no repair tools are replenished.'; return true;
    }
    if (!o.ready) { o.ready = true; return true; }
    if (['outward', 'returning'].includes(o.phase)) {
      const remaining = o.phase === 'outward' ? q.distanceKm - m.actor.positionKm : m.actor.positionKm;
      const seconds = Math.max(0, Math.min(dt, remaining * 900, m.workSeconds, (80 - m.actor.fatigue) * 600));
      m.workSeconds -= seconds; m.actor.fatigue = Math.min(80, m.actor.fatigue + seconds / 600);
      m.actor.positionKm += (o.phase === 'outward' ? 1 : -1) * seconds / 900;
      m.actor.location = `maintenance road:${o.id}:${m.actor.positionKm.toFixed(4)}km`;
      if (seconds + .000001 < remaining * 900) { o.message = 'Original mechanic walking the saved local road with actual cargo.'; return true; }
      if (o.phase === 'outward') {
        m.actor.positionKm = q.distanceKm; m.actor.location = `passenger stand:${q.vehicleId}`; o.phase = 'repairing'; o.ready = false;
        o.message = 'Mechanic physically arrived; two hours of actual work remain. Authorization permits work during scientist absence.';
      } else {
        m.actor.positionKm = 0; m.actor.location = 'workshop'; support.parts += o.cargo.quantity;
        o.refund = o.escrowCents / 100; wallet.money += o.refund; o.escrowCents = 0; o.cargo.quantity = 0; m.actor.carriedParts = 0;
        o.phase = 'returned'; delete support.supplier.maintenanceReservedBy;
        m.history.push(copy(o)); m.job = null;
      }
      return true;
    }
    const seconds = Math.max(0, Math.min(dt, WORK - o.progress, m.workSeconds, (80 - m.actor.fatigue) * 600, m.toolkit.condition / .001));
    if (!seconds) return false;
    const neededParts = o.progress + seconds > WORK / 2 ? 2 : 1;
    if (o.cargo.quantity < neededParts - o.partsUsed) { o.ready = false; o.message = 'Original reserved parts missing; no replacement stock is created.'; return true; }
    while (o.partsUsed < neededParts) {
      if (o.cargo.quantity <= 0) { o.ready = false; o.message = 'Original reserved part is missing; no replacement stock is created.'; return true; }
      o.partsUsed++; o.cargo.quantity--; m.actor.carriedParts--; o.escrowCents -= 500; support.money += 5; support.revenue += 5;
    }
    m.workSeconds -= seconds; m.actor.fatigue = Math.min(80, m.actor.fatigue + seconds / 600); m.toolkit.condition = Math.max(0, m.toolkit.condition - seconds * .001);
    o.progress += seconds; o.expectedCondition = Math.min(100, q.condition + q.gain * o.progress / WORK); s.vehicle.condition = o.expectedCondition;
    const earned = Math.floor(1000 * o.progress / WORK), paid = earned - o.laborPaidCents;
    o.laborPaidCents = earned; o.escrowCents -= paid; support.money += paid / 100; support.revenue += paid / 100;
    o.message = 'Authorized physical repair progressing; received reports remain dated during absence.';
    if (o.progress >= WORK) {
      o.receipt = { id: o.id, at, cityId: q.cityId, vehicleId: q.vehicleId, mechanicId: q.mechanicId, toolkitId: q.toolkitId,
        bodyEpoch: q.bodyEpoch, workSeconds: WORK, partsUsed: o.partsUsed, restoredCondition: q.gain, total: PRICE };
      (s.maintenanceReceipts ||= []).push(copy(o.receipt)); o.phase = 'returning'; o.ready = true;
      o.message = 'Actual repairs complete once; original mechanic must still walk back before workshop reuse.';
    }
    return true;
  }
  function nextEvent(s, support, c, at) {
    const m = support?.passengerMaintenance, o = m?.job;
    if (!o || !c.alive || !c.local || !c.sourceCurrent || c.bodyEpoch !== o.quote.bodyEpoch || !able(m) || !support.supplier.routeOpen) return null;
    if (o.phase === 'repairing' && workReason(s, support, c, o)) return null;
    if (o.phase === 'repairing' && (!Number.isFinite(m.toolkit.condition) || m.toolkit.condition <= 0)) return null;
    const seconds = o.phase === 'repairing' ? Math.min(WORK - o.progress, m.toolkit.condition / .001)
      : (o.phase === 'outward' ? o.quote.distanceKm - m.actor.positionKm : m.actor.positionKm) * 900;
    return { time: at + (o.ready ? Math.max(1, Math.min(seconds, m.workSeconds, (80 - m.actor.fatigue) * 600)) : 1), label: 'Original passenger-maintenance service checkpoint', type: 'travel' };
  }
  function observe(m, c, at) {
    if (!m || !c.local || !c.alive || !c.sameBody || !c.atStand) return m?.observation || null;
    const o = m.job;
    if (o && (o.quote.bodyEpoch !== c.bodyEpoch || m.actor.location !== `passenger stand:${o.quote.vehicleId}`
      && !(o.phase === 'outward' && m.actor.positionKm === 0 && o.progress === 0))) return m.observation;
    m.observation = { at, mechanicName: m.actor.name,
      job: o && { id: o.id, vehicleId: o.quote.vehicleId, bodyEpoch: o.quote.bodyEpoch, phase: o.phase, progress: o.progress,
        message: o.message, cancelled: o.cancelled, completed: Boolean(o.receipt) },
      returned: m.history.length ? { id: m.history.at(-1).id, at: m.history.at(-1).lastAt, refund: m.history.at(-1).refund } : null };
    return m.observation;
  }
  return { WORK, PARTS, GAIN, PRICE, CALLOUT, create, quote, request, cancel, advance, workReason, nextEvent, observe };
});
