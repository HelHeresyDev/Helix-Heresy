(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./intercity-trade') : root.HelixIntercityTrade);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixForeignSupplies = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Market) {
  'use strict';
  const GOODS = ['drinkingWater', 'fieldRation'], MAX = 6, HANDOFF = 30, COLLECTION = 60, FEE = 4;
  const copy = v => JSON.parse(JSON.stringify(v));
  const SALE_TERMS = { good: 'metalParts', maxQuantity: MAX, handlingFee: FEE, receivingMassKg: 48, receivingVolumeL: 24 };
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
      workSeconds: 14400, powerSeconds: 1800, provisionsSeconds: 28800, lastAt: at, serial: 0, orders: [], knowledge: null, message: '',
      salesTerms: copy(SALE_TERMS), bidHistory: [] };
  }
  function ownedMetalParts(item) {
    return Boolean(item?.id && item.section === 'resources' && item.key === 'metalParts'
      && Number.isInteger(item.quantity) && item.quantity > 0 && !item.cityOwnerId && !item.civicCustody
      && !item.carryTaskId && !item.toolInstanceId && !item.chemicalBatch && !item.contents?.length && !item.biology);
  }
  function saleLot(item) { return ownedMetalParts(item) && item.carriedBy === 'scientist' && !item.reservedTaskId; }
  function saleQuote(s, market, def, item, quantity, c, at) {
    const n = Number(quantity), listing = market?.listings?.[def?.id];
    if (!s?.salesTerms || s.salesTerms.good !== def?.id || market?.id !== s.cityId || !listing || !def.sellable || !saleLot(item)
      || active(s) || !c.alive || !c.capable || !c.atCounter || !c.contact || !c.permit || !c.providerCurrent || c.busy
      || !able(s.actor) || s.powerSeconds < 1 || !Number.isInteger(n) || n < 1 || n > MAX || n > item.quantity
      || !Number.isFinite(c.saleRouteSeconds) || c.saleRouteSeconds <= 0 || !Number.isFinite(listing.supply) || listing.supply < 0
      || !Number.isFinite(listing.demand) || listing.demand <= 0) return null;
    const massKg = item.unitMassKg * n, volumeL = item.unitVolumeL * n;
    const seconds = c.saleRouteSeconds + COLLECTION + HANDOFF * n * 2;
    const unitPrice = Math.max(1, Math.floor(Market.quote(def, listing).bid)), gross = unitPrice * n;
    if (!Number.isFinite(massKg) || !Number.isFinite(volumeL) || massKg <= 0 || volumeL <= 0
      || massKg > c.supplierRemaining.massKg || volumeL > c.supplierRemaining.volumeL
      || massKg > c.receivingRemaining?.massKg || volumeL > c.receivingRemaining?.volumeL
      || !Number.isFinite(c.receivingRemaining?.massKg) || !Number.isFinite(c.receivingRemaining?.volumeL)
      || !Number.isFinite(gross) || !Number.isFinite(market.treasury) || market.treasury < gross || gross <= FEE
      || c.permit.expiresAt - at <= seconds || s.workSeconds < seconds || s.provisionsSeconds < seconds) return null;
    return { cityId: s.cityId, providerId: s.actor.id, branchId: s.source.branchId, good: def.id, label: def.label,
      stackId: item.id, stackQuantity: item.quantity, quantity: n, unitPrice, gross, handlingFee: FEE, net: gross - FEE,
      massKg, volumeL, seconds, stock: listing.supply, demand: listing.demand, bodyEpoch: c.bodyEpoch, visitId: c.visitId,
      permitId: c.permit.id, quotedAt: at, expiresAt: at + 60 };
  }
  function sell(s, market, def, item, expected, c, at, hooks) {
    if (!expected || at >= expected.expiresAt || !Number.isFinite(expected.quotedAt) || expected.quotedAt > at) return false;
    const q = saleQuote(s, market, def, item, expected.quantity, c, expected.quotedAt);
    if (!q || JSON.stringify(q) !== JSON.stringify(expected) || c.permit.expiresAt - at <= q.seconds) return false;
    const id = `${s.actor.id}:sale:${s.serial + 1}`, stackId = hooks.reserveSale(id, q);
    if (!stackId) return false;
    market.treasury -= q.gross; s.serial++; s.powerSeconds--; s.lastAt = at;
    s.orders.push({ id, kind: 'sale', quote: copy(q), stackId, bodyEpoch: c.bodyEpoch, visitId: c.visitId, actorId: s.actor.id,
      createdAt: at, status: 'accepting', target: 'hall', handed: 0, delivered: 0, progress: 0, receipts: [], lots: [],
      escrow: q.gross, feeRemaining: FEE, delay: '' });
    s.message = 'Exact carried goods and buyer funds reserved. Unhanded goods remain yours; payment follows actual store receipt, not booking.';
    return true;
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
    if (!o || o.target === 'outer' || o.kind === 'sale' && o.handed === o.quote.quantity || !c.alive || !c.capable || c.busy || !c.atOuter || o.bodyEpoch !== c.bodyEpoch || o.visitId !== c.visitId) return false;
    o.target = 'outer'; if (o.collected) o.progress = 0; o.delay = ''; s.lastAt = c.at;
    s.message = o.kind === 'sale' ? 'Remaining sale handoffs requested at the outer stand; store receipt and payment remain separate.'
      : 'Collection requested at the outer stand. The same supplier must physically bring the remaining paid goods.'; return true;
  }
  function advance(s, c, at, hooks) {
    if (!s || !c.alive || at <= s.lastAt) return false;
    const from = s.lastAt; s.lastAt = at;
    const suppliedUntil = from + s.provisionsSeconds;
    s.provisionsSeconds = Math.max(0, s.provisionsSeconds - (at - from));
    const o = active(s); if (!o) return false;
    if (o.bodyEpoch !== c.bodyEpoch || o.visitId !== c.visitId && !(o.kind === 'sale' && o.handed === o.quote.quantity)) {
      o.status = 'bodyLost'; o.delay = 'The original body or visit ended. No new body inherits this unfinished handoff.'; return true;
    }
    if (o.kind === 'sale') return advanceSale(s, o, c, from, Math.min(at, suppliedUntil), hooks);
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
  function advanceSale(s, o, c, from, until, hooks) {
    const receiving = o.handed === o.quote.quantity;
    const attended = c.capable && c.local && !c.busy && (o.target === 'outer' ? c.atOuter : c.atCounter && c.permit?.id === o.quote.permitId);
    if (!c.providerCurrent || !able(s.actor) || s.workSeconds <= 0 || until <= from || (!receiving && !attended)) {
      o.ready = false; o.delay = !receiving && !c.permit && o.target === 'hall'
        ? 'Visitor permission expired; walk out and request outer-stand sale handoffs.' : 'Original service, attendance or finite supplier reserves unavailable.'; return false;
    }
    if (o.ready === false) { o.ready = true; o.delay = ''; return true; }
    if (!receiving && o.target === 'hall') until = Math.min(until, c.permit.expiresAt);
    let changed = false;
    for (let t = from + 1; t <= until && s.workSeconds >= 1 && able(s.actor); t++) {
      if (o.delivered === o.quote.quantity) {
        const movement = hooks.move(o, 'hall');
        if (movement.blocked) { o.ready = false; o.delay = movement.blocked; break; }
        s.workSeconds--; s.actor.fatigue = Math.min(100, s.actor.fatigue + 1 / 600); changed = true;
        if (movement.done) { o.status = 'received'; o.completedAt = t; s.message = 'All sold goods physically received into the local exchange. Net proceeds settled once; the original attendant returned to the counter. No transport replenishment or wider rights follow.'; break; }
        continue;
      }
      if (!hooks.saleCustody(o)) { o.ready = false; o.delay = 'The exact original sale lot or buyer custody is unavailable.'; break; }
      const storing = o.handed === o.quote.quantity, movement = hooks.move(o, storing ? 'store' : o.target);
      if (movement.blocked) { o.ready = false; o.delay = movement.blocked; break; }
      s.workSeconds--; s.actor.fatigue = Math.min(100, s.actor.fatigue + 1 / 600); changed = true;
      if (!movement.done) continue;
      o.progress++; o.delay = '';
      if (!storing && o.progress >= HANDOFF) {
        const id = hooks.takeSale(o);
        if (!id) { o.ready = false; o.delay = 'Actual contact, ownership or supplier pack capacity prevents sale handoff.'; break; }
        o.lots.push(id); o.handed++; o.progress = 0;
        if (o.handed === o.quote.quantity) { o.status = 'storing'; o.walkSeconds = 0; }
      } else if (storing && o.progress >= (o.storePrepared ? HANDOFF : COLLECTION)) {
        if (!o.storePrepared) { o.storePrepared = true; o.progress = 0; continue; }
        const fee = Math.min(o.feeRemaining, o.quote.unitPrice), net = o.quote.unitPrice - fee;
        const receipt = hooks.storeSale(o, t, net);
        if (!receipt) { o.ready = false; o.delay = 'Original receiving capacity, buyer store or exact cargo unavailable.'; break; }
        o.escrow -= o.quote.unitPrice; o.feeRemaining -= fee; s.handlingRevenue = (s.handlingRevenue || 0) + fee;
        o.delivered++; o.receipts.push({ at: t, stackId: receipt, good: o.quote.good, quantity: 1, gross: o.quote.unitPrice, handlingFee: fee, net }); o.progress = 0;
        if (o.delivered === o.quote.quantity) { o.status = 'returning'; o.settledAt = t; o.walkSeconds = 0; }
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
      orders: s.orders.filter(o => o.bodyEpoch === c.bodyEpoch && o.visitId === c.visitId).map(o => ({ id: o.id, kind: o.kind || 'purchase', quote: copy(o.quote),
        status: o.status, target: o.target, handed: o.handed, delivered: o.delivered, delay: o.delay, receipts: copy(o.receipts) })) };
    const def = defs.find(d => d.id === s.salesTerms?.good), listing = market?.listings?.[def?.id];
    if (def && listing && c.atCounter && c.permit && c.providerCurrent && s.workSeconds > 0 && s.powerSeconds >= 1 && s.provisionsSeconds > 0) {
      const bid = Math.max(1, Math.floor(Market.quote(def, listing).bid)); s.bidHistory ||= [];
      const last = s.bidHistory.at(-1);
      if (last && at === last.at) last.bid = bid;
      if (!last || at > last.at && (bid !== last.bid || at - last.at >= 60)) s.bidHistory.push({ at, bid });
      s.bidHistory = s.bidHistory.slice(-60);
      s.knowledge.sale = { good: def.id, label: def.label, bid, terms: copy(s.salesTerms), history: copy(s.bidHistory) };
    } else if (s.salesTerms && s.bidHistory?.length) {
      s.knowledge.sale = { good: s.salesTerms.good, label: 'Metal Parts', bid: s.bidHistory.at(-1).bid, terms: copy(s.salesTerms), history: copy(s.bidHistory) };
    }
    return s.knowledge;
  }
  return { GOODS, MAX, HANDOFF, COLLECTION, FEE, SALE_TERMS, create, quote, buy, ownedMetalParts, saleLot, saleQuote, sell, outer, advance, observe, active };
});
