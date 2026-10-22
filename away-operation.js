(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./intercity-trade') : root.HelixIntercityTrade);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixAwayOperation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Market) {
  'use strict';
  const DAY = 86400, DUTY = 14400;
  const GOODS = Object.freeze({ drinkingWater: 6, trailMeal: 3 });
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 75;
  const LIMITS = 'One locally supplied refuge; its regional address grants no additional command authority. Separate explicitly committed allowance; original local commercial provider, producer truck and driver, finite stock and inspected ground route. Noncombat provisions delivery only; no visitor-permit delegation, free staff, replenishment, health, maps, sovereignty or resurrection. Reports are dated. Loss or isolation never ends a living run.';
  function create(plan, binding, at) {
    if (!plan?.siteId || !plan.cityId || !plan.cacheId || !plan.route?.length || !binding?.worldId || !binding.runId || !Number.isFinite(at)) return null;
    return { id: `${plan.siteId}:local-operation`, ...copy(binding), plan: copy(plan), balance: 0, deposited: 0, spent: 0, refunded: 0,
      quote: null, mission: null, previous: [], serial: 0, lastAt: at, suppliedAt: null, consumed: [],
      continuityFrom: null, auditLastAt: at, viableAt: null, currentReady: false, reason: '', report: null, history: [] };
  }
  function normalize(s) { return s?.id && s.worldId && s.runId && s.plan?.cacheId && Array.isArray(s.plan.route) && Number.isFinite(s.balance)
    && s.balance >= 0 && Number.isFinite(s.lastAt) && Array.isArray(s.consumed) ? copy(s) : null; }
  function rebind(s, from, to) { s = normalize(s); if (!s || s.worldId !== from.worldId || s.runId !== from.runId) return null;
    if (s.plan.worldId === from.worldId) s.plan.worldId = to.worldId;
    if (s.plan.residentPlan?.worldId === from.worldId) s.plan.residentPlan.worldId = to.worldId;
    return { ...s, ...copy(to) }; }
  function bound(s, c) { return Boolean(s && c.worldId === s.worldId && c.runId === s.runId && c.planCurrent && c.sourceCurrent
    && (!s.supplierId || s.supplierId === c.supplierId && s.branchId === c.branchId)); }
  function truck(s, market) { return market?.production?.trucks.find(t => t.id === s.mission?.truckId); }
  const ongoing = m => m && !['returned', 'stranded'].includes(m.phase);
  function quote(s, market, c, at) {
    if (!bound(s, c) || !c.alive || !c.capable || !c.free || !c.atProvider || !c.providerReady || !c.routeOpen || !c.walkable
      || ongoing(s.mission) || s.mission?.phase === 'stranded' || s.mission?.retainedCargo || !Number.isFinite(c.distanceKm) || c.distanceKm <= 0 || c.distanceKm > 10
      || market?.id !== s.plan.cityId || market.production?.cityId !== s.plan.cityId || c.threatened
      || s.bodyEpoch !== c.bodyEpoch || !c.residentReady || !c.storageOpen || !c.routeKnown || !Number.isFinite(at)) return null;
    const rows = Object.entries({ ...GOODS, drinkingWater: GOODS.drinkingWater + 1, trailMeal: GOODS.trailMeal + 1 }).map(([key, quantity]) => {
      const def = c.definitions.find(d => d.id === key), listing = market?.listings?.[key], metrics = c.metrics[key];
      const reserve = Math.ceil((market?.profile?.listings?.[key]?.targetSupply || 0) * (market?.reserveFraction ?? .6));
      if (!def || !listing || listing.supply - quantity < reserve || !Number.isFinite(listing.demand) || !metrics?.massKg || !metrics.volumeL) return null;
      return { key, quantity, cargoQuantity: GOODS[key], unitPrice: Math.ceil(Market.quote(def, listing).ask), ...copy(metrics) };
    });
    if (rows.some(r => !r || !Number.isFinite(r.unitPrice))) return null;
    const mass = rows.reduce((n, r) => n + r.quantity * r.massKg, 0), volume = rows.reduce((n, r) => n + r.quantity * r.volumeL, 0);
    if (mass > 18 || volume > 24 || mass > c.storageRemaining.massKg || volume > c.storageRemaining.volumeL) return null;
    const seconds = Math.ceil(c.distanceKm / 30 * 7200 + s.plan.route.length * 8 + 360);
    const t = market?.production?.trucks.find(t => !t.shipment && !t.repairAt && able(t.driver) && t.capacity >= rows.reduce((n, r) => n + r.quantity, 0)
      && t.condition - c.distanceKm * .04 >= 50 && t.fuelKm >= c.distanceKm * 2 && (t.driver.fatigue || 0) + c.distanceKm * .08 + s.plan.route.length * .04 < 75
      && (t.driver.localProvisionDuty ?? DUTY) >= seconds && !t.driver.mapCell);
    if (!t || seconds > DUTY) return null;
    const freight = Math.ceil(10 + c.distanceKm * 2 + seconds / 3600 * 12), goodsCost = rows.reduce((n, r) => n + r.quantity * r.unitPrice, 0);
    return s.quote = { at, expiresAt: at + 120, bodyEpoch: c.bodyEpoch, supplierId: c.supplierId, branchId: c.branchId,
      truckId: t.id, driverId: t.driver.id, cityId: s.plan.cityId, plan: copy(s.plan), distanceKm: c.distanceKm,
      rows, freight, goodsCost, total: freight + goodsCost, seconds, scope: LIMITS };
  }
  function accept(s, market, c, expected, deposit, wallet, at) {
    const old = copy(s?.quote);
    if (!old || !same(old, expected) || at < old.at || at >= old.expiresAt || c.bodyEpoch !== old.bodyEpoch || !Number.isInteger(deposit)
      || deposit < 0 || deposit > 10000 || !Number.isFinite(wallet?.money) || wallet.money < deposit || s.balance + deposit < old.total) return false;
    const fresh = quote(s, market, c, old.at);
    if (!same(fresh, old)) return false;
    const p = market.production, t = p.trucks.find(t => t.id === old.truckId), id = `${s.id}:consignment-${++s.serial}`;
    wallet.money -= deposit; s.deposited += deposit; s.balance += deposit - old.total; s.spent += old.total;
    s.supplierId = c.supplierId; s.branchId = c.branchId;
    p.finance.exchangeMoney += old.goodsCost; p.finance.money += old.freight; p.finance.earned += old.freight;
    p.finance.ledger.push({ at, kind: 'localRefugeFreight', amount: old.freight, missionId: id });
    for (const r of old.rows) market.listings[r.key].supply -= r.quantity;
    t.fuelKm -= old.distanceKm * 2; t.shipment = id; t.driver.localProvisionDuty ??= DUTY;
    p.shipments.push({ id, externallyManaged: 'awayOperation', truckId: t.id, cargo: 'localRefugeProvisions', quantity: old.rows.reduce((n, r) => n + r.quantity, 0), returned: false, delivered: false, returnAt: null });
    if (s.mission) s.previous.push(copy(s.mission));
    s.mission = { id, truckId: t.id, driverId: t.driver.id, supplierId: old.supplierId, branchId: old.branchId,
      phase: 'outbound', distanceKm: old.distanceKm, positionKm: 0, travelledKm: 0, reservedFuelKm: old.distanceKm * 2,
      cargo: copy(old.rows), acceptedAt: at, deadline: at + old.seconds + 3600, lastAt: at, progress: 0,
      deliveredAt: null, returnedAt: null, wasReady: true, reason: 'Original local truck departed with paid allocated goods; no home stores or funds were drawn.' };
    s.quote = null; s.bodyEpoch = c.bodyEpoch; s.history.push({ at, kind: 'committed', deposit, cost: old.total, missionId: id }); return true;
  }
  function advance(s, market, c, at, h) {
    if (!s || !c.alive || at < s.lastAt) return false;
    const dt = at - s.lastAt; s.lastAt = at;
    const m = s.mission, t = truck(s, market);
    if (!m || ['returned', 'stranded'].includes(m.phase)) return false;
    if (!t || t.driver.id !== m.driverId || t.shipment !== m.id) { m.phase = 'stranded'; m.reason = 'Original allocated person or truck unavailable. Nothing is replaced or teleported.'; return true; }
    const d = t.driver, sh = market.production.shipments.find(r => r.id === m.id);
    d.localProvisionDuty = Math.max(0, (d.localProvisionDuty ?? DUTY) - dt);
    if (!able(d) || c.driverIncapacitated || t.condition < 50 || d.localProvisionDuty <= 0) {
      m.phase = 'stranded'; m.reason = 'Original driver or vehicle cannot continue. Living actors and purchased goods remain at their actual positions; there is no replacement or refund of earned purchases.'; return true;
    }
    if ((!bound(s, c) || !c.residentReady || !c.groundSafe || at >= m.deadline) && !['returnWalk', 'returning'].includes(m.phase)) {
      m.phase = d.mapCell ? 'returnWalk' : 'returning'; m.progress = 0;
      m.reason = 'Original scope, safe residence or delivery window ended. Undelivered property remains with the original carrier during physical withdrawal.';
    }
    const roadReady = c.routeOpen && c.worldId === s.worldId && c.runId === s.runId;
    if (['outbound', 'returning'].includes(m.phase)) {
      if (roadReady && m.wasReady) {
        const km = Math.min(m.phase === 'outbound' ? m.distanceKm - m.positionKm : m.positionKm, dt * 30 / 3600);
        m.positionKm += m.phase === 'outbound' ? km : -km; m.travelledKm += km; t.condition -= km * .02; d.fatigue = (d.fatigue || 0) + km * .04;
      }
      m.wasReady = roadReady;
      if (m.phase === 'outbound' && m.positionKm >= m.distanceKm - 1e-8 && h.arrive(d, t, m)) { m.phase = 'unload'; m.progress = 0; }
      else if (m.phase === 'returning' && m.positionKm <= 1e-8) {
        m.phase = 'returned'; m.returnedAt = at; m.retainedCargo = m.deliveredAt == null;
        // An undelivered load still occupies its original vehicle. Ordinary
        // production cannot reuse that capacity before a real handback.
        t.shipment = m.retainedCargo ? m.id : null; t.fuelKm += Math.max(0, m.reservedFuelKm - m.travelledKm);
        d.mapCell = null; d.roomId = null; t.mapCell = null; t.roomId = null;
        if (sh) { sh.returned = true; sh.returnAt = at; }
      }
    } else if (m.phase === 'unload') {
      if (!c.atTruck || !c.groundSafe || !c.walkable) m.progress = 0;
      else if (dt > 0) m.progress += Math.min(1, dt);
      if (m.progress >= 60 && h.loadPack(d, m)) { m.phase = 'walk'; m.progress = 0; }
    } else if (m.phase === 'walk') {
      if (c.groundSafe && c.walkable && dt > 0) {
        if (c.atCrate) { m.phase = 'deposit'; m.progress = 0; }
        else h.move(d, s.plan.port, at);
      }
    } else if (m.phase === 'deposit') {
      if (!c.atCrate || !c.storageOpen || !c.groundSafe) m.progress = 0;
      else if (dt > 0) m.progress += Math.min(1, dt);
      if (m.progress >= 60 && h.deposit(d, m)) {
        m.deliveredAt = at; s.suppliedAt ??= at; if (sh) sh.delivered = true;
        m.phase = 'returnWalk'; m.progress = 0;
      }
    } else if (m.phase === 'returnWalk') {
      if (c.atTruck) { if (h.board(d, m)) { d.mapCell = null; d.roomId = null; m.phase = 'returning'; m.wasReady = roadReady; } }
      else if (c.walkable && dt > 0) h.move(d, s.plan.route[0], at);
    }
    return true;
  }
  function audit(s, c, at) {
    if (!s || !c.alive || !Number.isFinite(at)) return;
    if (at - s.auditLastAt > 60) s.continuityFrom = null; // Unknown skipped support is never a free day.
    s.auditLastAt = at;
    const ready = bound(s, c) && c.residentReady && c.supported && c.provisionsAvailable && c.heatAvailable && !c.threatened;
    s.currentReady = ready; s.reason = ready ? 'Original resident, finite local supplies and intact shelter support current operation; this is not permanent self-sufficiency.'
      : 'Actual local staffing, provisions, shelter, heat, access or safety does not support continued operation.';
    if (!ready || !c.scientistAway || s.suppliedAt == null) s.continuityFrom = null;
    else {
      s.continuityFrom ??= at;
      if (at - s.continuityFrom >= DAY && s.consumed.length) s.viableAt ??= at;
    }
  }
  function recordConsumption(s, actorId, key, at) {
    if (s && actorId === s.plan.residentActorId && Object.hasOwn(GOODS, key) && Number.isFinite(at)
      && s.suppliedAt != null && at >= s.suppliedAt) s.consumed.push({ actorId, key, at });
  }
  function receive(s, c, at) {
    if (!s || !c.alive || !c.capable || !(c.personalInspection || c.atProvider && c.providerReady)) return false;
    s.report = { at, siteId: s.plan.siteId, cityId: s.plan.cityId, label: s.plan.label, ready: c.personalInspection ? s.currentReady : null,
      viableAt: c.personalInspection ? s.viableAt : null, reason: c.personalInspection ? s.reason : 'Personally received local provider ledger. Remote resident condition remains unverified.',
      allowance: c.atProvider ? { deposited: s.deposited, spent: s.spent, balance: s.balance, refunded: s.refunded } : null,
      delivery: c.personalInspection ? { suppliedAt: s.suppliedAt } : c.atProvider && s.mission?.phase === 'returned' ? { returnedAt: s.mission.returnedAt, deliveredAt: s.mission.deliveredAt } : null, limits: LIMITS };
    return true;
  }
  function refund(s, c, wallet, at) {
    if (!bound(s, c) || !c.alive || !c.capable || !c.free || !c.atProvider || !c.providerReady || ongoing(s.mission)
      || s.mission?.phase === 'stranded' || s.bodyEpoch !== c.bodyEpoch || !s.balance) return false;
    wallet.money += s.balance; s.refunded += s.balance; s.balance = 0; s.history.push({ at, kind: 'personalSettlement' }); return true;
  }
  return { DAY, DUTY, GOODS, LIMITS, create, normalize, rebind, bound, truck, ongoing, quote, accept, advance, audit, recordConsumption, receive, refund, publicView: s => copy(s?.report) };
});
