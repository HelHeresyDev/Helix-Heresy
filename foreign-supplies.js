(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./intercity-trade') : root.HelixIntercityTrade);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixForeignSupplies = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Market) {
  'use strict';
  const GOODS = ['drinkingWater', 'fieldRation'], MAX = 6, HANDOFF = 30, COLLECTION = 60, FEE = 4;
  const copy = v => JSON.parse(JSON.stringify(v));
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  const active = s => s?.orders.find(o => !['received', 'bodyLost'].includes(o.status));
  function create(city, standings, at, location) {
    if (!city?.cityId || !Number.isFinite(city.currentPopulation)) return null;
    const entry = standings?.find(e => e.network?.category === 'commercial' && e.network.roles?.includes('procurement')
      && ['licensed', 'chartered'].includes(e.standing) && e.branch?.publicPhysicalPresence !== false
      && (e.branch?.currentCityId || e.branch?.cityId) === city?.cityId
      && ['functional', 'strong', 'regionalHub'].includes(e.branch?.capacityBand)
      && (!e.branch.operationalStatus || e.branch.operationalStatus === 'active'));
    if (!entry || city.currentPopulation < 3 || ['abandoned', 'destroyed'].includes(city.habitationStatus)
      || city.physicalCondition === 'ruined' || city.services?.provisioning === 'failed') return null;
    return { cityId: city.cityId, source: { branchId: entry.branch.id, networkId: entry.network.id, populationId: city.cityId, people: 1 },
      label: entry.branch.publicName, actor: { id: `${entry.branch.id}:visitor-supplier`, name: `${entry.branch.publicName} provision attendant`,
        actorKind: 'foreignSupplier', kind: 'visitor', health: 100, maxHealth: 100, status: 'alive', fatigue: 0,
        roomId: location.roomId, mapCell: copy(location.cell), present: true },
      workSeconds: 14400, powerSeconds: 1800, provisionsSeconds: 28800, lastAt: at, serial: 0, orders: [], knowledge: null, message: '' };
  }
  function quote(s, market, def, quantity, c, at) {
    const listing = market?.listings?.[def?.id], n = Number(quantity);
    if (!s || market?.id !== s.cityId || !GOODS.includes(def?.id) || !listing || active(s)
      || !c.alive || !c.capable || !c.atCounter || !c.permit || !c.providerCurrent || c.busy
      || !able(s.actor) || s.workSeconds <= 0 || s.powerSeconds < 1 || s.provisionsSeconds <= 0
      || !Number.isInteger(n) || n < 1 || n > MAX || Math.floor(listing.supply) < n || !c.routeSeconds) return null;
    const seconds = c.routeSeconds + COLLECTION + HANDOFF * n;
    const massKg = c.metrics.massKg * n, volumeL = c.metrics.volumeL * n;
    if (c.remaining.massKg < massKg || c.remaining.volumeL < volumeL || c.supplierRemaining.massKg < massKg
      || c.supplierRemaining.volumeL < volumeL || c.permit.expiresAt - at <= seconds || s.workSeconds < seconds || s.provisionsSeconds < seconds) return null;
    const ask = Math.ceil(Market.quote(def, listing).ask);
    return { cityId: s.cityId, providerId: s.actor.id, branchId: s.source.branchId, good: def.id, label: def.label,
      quantity: n, unitPrice: ask, handlingFee: FEE, total: Math.round((ask * n + FEE) * 100) / 100,
      massKg, volumeL, seconds, stock: listing.supply, demand: listing.demand, bodyEpoch: c.bodyEpoch, visitId: c.visitId,
      permitId: c.permit.id, quotedAt: at, expiresAt: at + 60 };
  }
  function buy(s, market, def, expected, c, wallet, at, hooks) {
    if (!expected || at >= expected.expiresAt || !Number.isFinite(expected.quotedAt) || expected.quotedAt > at) return false;
    const q = quote(s, market, def, expected.quantity, c, expected.quotedAt);
    if (!q || JSON.stringify(q) !== JSON.stringify(expected) || c.permit.expiresAt - at <= q.seconds || wallet.money < q.total) return false;
    const id = `${s.actor.id}:purchase:${s.serial + 1}`;
    const stackId = hooks.allocate(id, q); if (!stackId) return false;
    wallet.money = Math.round((wallet.money - q.total) * 100) / 100;
    const listing = market.listings[def.id]; listing.supply -= q.quantity;
    listing.demand = Math.min(1.8, listing.demand + q.quantity / Math.max(20, def.liquidity * 5));
    market.treasury = (market.treasury || 0) + q.total - FEE;
    s.handlingRevenue = (s.handlingRevenue || 0) + FEE;
    s.powerSeconds--; s.serial++; s.lastAt = at;
    s.orders.push({ id, quote: copy(q), stackId, bodyEpoch: c.bodyEpoch, visitId: c.visitId, actorId: s.actor.id,
      createdAt: at, status: 'collecting', target: 'hall', collected: false, delivered: 0, progress: 0, receipts: [], delay: '' });
    s.message = 'Paid goods are yours in local supplier custody, not yet in your backpack. No automatic refund or return transport is included.';
    return true;
  }
  function outer(s, c) {
    const o = active(s);
    if (!o || o.target === 'outer' || !c.alive || !c.capable || !c.atOuter || o.bodyEpoch !== c.bodyEpoch || o.visitId !== c.visitId) return false;
    o.target = 'outer'; if (o.collected) o.progress = 0; o.delay = ''; s.lastAt = c.at;
    s.message = 'Collection requested at the outer stand. The same supplier must physically bring the remaining paid goods.'; return true;
  }
  function advance(s, c, at, hooks) {
    if (!s || !c.alive || at <= s.lastAt) return false;
    const from = s.lastAt; s.lastAt = at;
    const suppliedUntil = from + s.provisionsSeconds;
    s.provisionsSeconds = Math.max(0, s.provisionsSeconds - (at - from));
    const o = active(s); if (!o) return false;
    if (o.bodyEpoch !== c.bodyEpoch || o.visitId !== c.visitId) {
      o.status = 'bodyLost'; o.delay = 'The original body or visit ended. No new body inherits this unfinished handoff.'; return true;
    }
    const ready = c.capable && c.local && c.providerCurrent && able(s.actor) && !c.busy
      && (o.target === 'outer' ? c.atOuter : c.atCounter && c.permit?.id === o.quote.permitId);
    if (!ready || suppliedUntil <= from || s.workSeconds <= 0) {
      o.delay = !c.permit && o.target === 'hall' ? 'Visitor permission expired; request outer-stand collection after walking out.'
        : 'Original attendance, capable supplier, lawful service or finite duty/provisions unavailable.';
      o.ready = false; return false;
    }
    // Resume prospectively, never count time spent absent or without supplies.
    if (o.ready === false) { o.ready = true; o.delay = ''; return true; }
    const until = Math.min(suppliedUntil, o.target === 'hall' ? Math.min(at, c.permit.expiresAt) : at);
    let changed = false;
    for (let t = from + 1; t <= until && s.workSeconds >= 1 && able(s.actor); t++) {
      if (!hooks.custody(o)) { o.delay = 'The actual paid lot or its original custody is unavailable.'; o.ready = false; break; }
      const movement = hooks.move(o, !o.collected ? 'store' : o.target);
      if (movement.blocked) { o.delay = movement.blocked; o.ready = false; break; }
      s.workSeconds--; s.actor.fatigue = Math.min(100, s.actor.fatigue + 1 / 600); changed = true;
      if (!movement.done) { o.delay = ''; continue; }
      o.progress++; o.delay = '';
      if (!o.collected && o.progress >= COLLECTION) {
        if (!hooks.collect(o)) { o.delay = 'Actual supplier pack capacity prevents collection.'; o.ready = false; break; }
        o.collected = true; o.status = 'delivering'; o.progress = 0;
      } else if (o.collected && o.progress >= HANDOFF) {
        const stackId = hooks.handoff(o);
        if (!stackId) { o.delay = 'Actual recipient contact or backpack capacity prevents handoff.'; o.ready = false; break; }
        o.delivered++; o.receipts.push({ at: t, stackId, good: o.quote.good, quantity: 1 }); o.progress = 0;
        if (o.delivered === o.quote.quantity) { o.status = 'received'; o.completedAt = t; s.message = 'All paid provisions physically received. Use them through ordinary personal care; transport reserves are unchanged.'; break; }
      }
    }
    return changed;
  }
  function observe(s, c, market, defs, at) {
    if (!s) return null;
    if (!c.alive || !c.capable || !c.local || !c.contact || !able(s.actor)) return s.knowledge;
    s.knowledge = { at, provider: s.label, actorId: s.actor.id, message: s.message,
      listings: GOODS.map(id => { const def = defs.find(d => d.id === id), l = market?.listings?.[id];
        return def && l ? { good: id, label: def.label, supply: Math.floor(l.supply), ask: Math.ceil(Market.quote(def, l).ask) } : null; }).filter(Boolean),
      orders: s.orders.filter(o => o.bodyEpoch === c.bodyEpoch && o.visitId === c.visitId).map(o => ({ id: o.id, quote: copy(o.quote),
        status: o.status, target: o.target, delivered: o.delivered, delay: o.delay, receipts: copy(o.receipts) })) };
    return s.knowledge;
  }
  return { GOODS, MAX, HANDOFF, COLLECTION, FEE, create, quote, buy, outer, advance, observe, active };
});
