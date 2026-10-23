(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./local-market-production') : root.HelixLocalMarketProduction,
    node ? require('./city-defense') : root.HelixCityDefense);
  if (node) module.exports = api;
  if (root) root.HelixIntercityCompact = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Production, Defense) {
  'use strict';
  const DAY = 86400, CURE = 21600, WORK = 120, FREIGHT = 8;
  const copy = x => JSON.parse(JSON.stringify(x));
  // Shared finite-obligation consumer: no reputation or domination score.
  function installmentState(cycles, at, cure = CURE) {
    const pending = cycles.find(r => r.fulfilledAt == null);
    return !pending ? 'completed' : at >= pending.dueAt + cure ? 'breached' : at >= pending.dueAt ? 'cure' : 'active';
  }
  const able = a => a?.status === 'alive' && a.health >= 50 && (a.fatigue || 0) < 80;
  const SCOPE = 'Two finite installments: three personally owned metal parts prepared into one city-owned ward-maintenance fitting, for one city-procured assay reagent each. Named municipal depot only; no map, residence, general trading, immunity, religious assent, political submission or domination. The scientist opposes the gods and promises no worship.';
  function sourceFromWorld(map, g, homeId) {
    const defense = Defense.sourceFromWorld(map, g?.cityId), b = g?.foreignCivic?.bargain;
    const polity = map?.cityPolities?.polities?.find(p => p.cityId === g?.cityId);
    const political = map?.strategicPoliticalHistory?.currentControlRows?.find(p => p.cityId === g?.cityId);
    const route = map?.routeGraph?.routes?.find(r => r.endpointIds?.includes(homeId) && r.endpointIds.includes(g?.cityId));
    if (!homeId || homeId === g?.cityId || !defense || !b || !route || defense.condition > 80
      || polity?.authority?.id !== b.source.authority.id || political?.controlStatus !== 'sovereign'
      || political.recognizedAuthorityId !== b.source.authority.id
      || b.source.defenseId !== defense.institutionId || b.source.charterId !== defense.charterId) return null;
    return { cityId: g.cityId, homeId, charterId: defense.charterId, populationSourceId: defense.populationSourceId,
      authorityId: b.source.authority.id, institutionId: defense.institutionId, depotId: b.depot.id, routeId: route.id,
      originalCondition: defense.condition, requiredParts: b.depot.required,
      provenance: 'Existing worn fortifications and original unfilled municipal ward-maintenance requisition, not a new disaster or replacement installation.' };
  }
  function validSource(s) {
    return Boolean(s && ['cityId', 'homeId', 'charterId', 'populationSourceId', 'authorityId', 'institutionId', 'depotId', 'routeId'].every(k => typeof s[k] === 'string' && s[k])
      && s.cityId !== s.homeId && Number.isFinite(s.originalCondition) && s.originalCondition > 0 && s.originalCondition <= 80 && s.requiredParts === 6);
  }
  function create(source, g, run, at) {
    const b = g?.foreignCivic?.bargain;
    if (!validSource(source) || !run?.worldId || !run.runId || !b || source.cityId !== g.cityId
      || source.charterId !== b.source.charterId || source.authorityId !== b.source.authority.id
      || source.depotId !== b.depot.id || source.institutionId !== b.source.defenseId) return null;
    return { id: `${g.id}:supply-access-compact`, ...copy(run), source: copy(source), allocatedAt: at, lastAt: at,
      representativeId: b.representative.id, defenderId: b.defender.id, clerkId: g.clerk.id,
      status: 'unnegotiated', offer: null, terms: null, job: null, cycles: [], serial: 0,
      cityStock: 0, cityRetained: 0, freightEscrow: 0, procurement: null, preparedFittings: 0,
      history: [], report: null, message: '', refusal: null };
  }
  function normalize(s) { return validSource(s?.source) && s.runId && s.worldId && Array.isArray(s.cycles)
    && Array.isArray(s.history) && Number.isFinite(s.cityStock) && s.cityStock >= 0 ? copy(s) : null; }
  function note(s, at, kind, text) {
    s.message = text; s.history.push({ id: `${s.id}:record:${++s.serial}`, at, kind, text }); s.history = s.history.slice(-60);
  }
  function current(s, g, c) {
    const b = g?.foreignCivic?.bargain, a = c.source;
    return Boolean(s && a && c.authorityCurrent && c.worldId === s.worldId && c.runId === s.runId
      && ['cityId', 'homeId', 'charterId', 'authorityId', 'populationSourceId', 'depotId', 'institutionId', 'routeId'].every(k => a[k] === s.source[k])
      && b?.representative.id === s.representativeId && b.defender.id === s.defenderId && g.clerk.id === s.clerkId
      && b.source.authority.id === s.source.authorityId && b.source.charterId === s.source.charterId);
  }
  function contact(s, g, c, own = false, retrieval = false) {
    const b = g?.foreignCivic?.bargain;
    return Boolean(s && c.alive && c.capable && c.originalBody && c.local && c.atDesk && c.lineOfSight && c.clerkPresent
      && !c.custodyActive && !c.otherBusy && (!c.bans?.length || retrieval) && c.participantsPresent
      && [g.clerk, b?.representative, b?.defender].every(able)
      && !b.job && !g.foreignCivic.accessJob && (!g.receptionAssignment || own && g.receptionAssignment === s.job?.id)
      && (!b.representative.assignment || own && b.representative.assignment === s.job?.id)
      && (!b.defender.assignment || own && b.defender.assignment === s.job?.id));
  }
  function stock(p, s = null) {
    return p?.workshops?.find(w => w.id === 'assayReagent' && (!s?.procurement || w.facilityId === s.procurement.facilityId));
  }
  function offerReason(s, g, market, c, own = false) {
    const b = g?.foreignCivic?.bargain, p = market?.production, w = stock(p), f = p?.facilities?.find(f => f.id === w?.facilityId);
    if (!current(s, g, c) || !contact(s, g, c, own) || c.bodyEpoch == null || !c.visitorPermit) return 'Attend the original authorized representative with lawful visitor access and an authenticated private principal.';
    if (s.terms || b.depot.stock > 0 || b.depot.compactCommitted || b.depot.compactReservedBy
      || b.audience || b.terms || b.copies.length) return 'This original finite maintenance requisition is already allocated; it cannot fund both bargains.';
    if (!c.routeOpen) return 'No usable licensed direct-neighbor connection supports the proposed exchange.';
    if (!Number.isFinite(market?.listings?.metalParts?.supply) || market.listings.metalParts.supply < 0)
      return 'The city has no supported current local parts account; missing alternatives are not a shortage.';
    if ((market?.listings?.metalParts?.supply || 0) >= 6 || p?.workshops?.some(w => w.id === 'metalParts' && w.stock >= 6))
      return 'The city has an adequate local parts alternative and declines this external compact.';
    if (market?.id !== s.source.cityId || p?.cityId !== market.id || !w || !Number.isFinite(w.stock) || w.stock < 4 || !f || f.kind !== 'chemicalWorks'
      || ![f.condition, f.labour, f.utilities].every(Number.isFinite) || f.condition < 50 || f.labour <= 0 || f.utilities <= 0
      || !f.routeOpen || !f.expertise?.includes('chemicalProcessing'))
      return 'No consenting operational chemical works can spare two actual reagent units while retaining two.';
    if (!Number.isInteger(c.reagentAsk) || c.reagentAsk <= 0 || !Number.isInteger(c.partsAsk) || c.partsAsk <= 0
      || c.reagentAsk > c.partsAsk * 3) return 'The proposed commodity ratio is not acceptable to the city at these actual prices.';
    if (!Production.serviceTruck(p) || !Number.isFinite(market.treasury) || market.treasury < c.reagentAsk * 2 + FREIGHT * 2)
      return 'The original treasury or finite local freight cannot fund this compact.';
    return '';
  }
  function begin(s, g, c, kind, seconds, at, extra = {}) {
    if (!contact(s, g, c, false, ['collect', 'report', 'terminate'].includes(kind)) || s.job) return false;
    if (![g.receptionWorkSeconds, g.powerSeconds, g.foreignCivic.bargain.representative.workSeconds,
      g.foreignCivic.bargain.defender.workSeconds].every(n => Number.isFinite(n) && n >= seconds)) return false;
    const id = `${s.id}:work:${++s.serial}`;
    s.job = { id, kind, seconds, progress: 0, lastAt: at, bodyEpoch: c.bodyEpoch, wasReady: true, ...copy(extra) };
    g.receptionAssignment = id; g.foreignCivic.bargain.representative.assignment = id; g.foreignCivic.bargain.defender.assignment = id;
    return true;
  }
  function release(s, g, stacks = []) {
    if (!s.job) return;
    for (const a of [g.foreignCivic.bargain.representative, g.foreignCivic.bargain.defender]) if (a.assignment === s.job.id) a.assignment = null;
    if (g.receptionAssignment === s.job.id) g.receptionAssignment = null;
    for (const i of stacks) if (i.reservedTaskId === s.job.id) i.reservedTaskId = '';
    s.job = null;
  }
  function propose(s, g, market, c, at) {
    const reason = offerReason(s, g, market, c);
    if (reason) { if (s && contact(s, g, c)) { s.refusal = { at, reason }; note(s, at, 'refusal', reason); } return false; }
    const w = stock(market.production);
    return begin(s, g, c, 'negotiate', WORK, at, { quote: { cityId: s.source.cityId, authorityId: s.source.authorityId,
      authorityName: g.foreignCivic.bargain.source.authority.name || s.source.authorityId, charterId: s.source.charterId,
      representativeName: g.foreignCivic.bargain.representative.name, representativeId: s.representativeId, principal: 'scientist-private', bodyEpoch: c.bodyEpoch,
      facilityId: w.facilityId, purchasePrice: c.reagentAsk, freightPerInstallment: FREIGHT, installments: 2,
      input: 'metalParts', inputQuantity: 3, output: 'assayReagent', outputQuantity: 1,
      duration: DAY * 3, interval: DAY, cureSeconds: CURE, sourceId: s.source.depotId, scope: SCOPE } });
  }
  function sign(s, g, market, c, expected, at) {
    if (offerReason(s, g, market, c) || !s.offer || JSON.stringify(s.offer) !== JSON.stringify(expected)
      || at >= s.offer.expiresAt || s.offer.bodyEpoch !== c.bodyEpoch || s.offer.purchasePrice !== c.reagentAsk) return false;
    const w = stock(market.production);
    if (w.facilityId !== s.offer.facilityId || !begin(s, g, c, 'sign', 60, at, { quote: s.offer })) return false;
    // Purchase is committed only after actual attended signature completes.
    return true;
  }
  const ownedParts = (i, reservation = '') => i?.key === 'metalParts' && i.section === 'resources' && Number.isInteger(i.quantity) && i.quantity >= 3
    && i.carriedBy === 'scientist' && (!i.reservedTaskId || i.reservedTaskId === reservation) && !i.cityOwnerId && !i.civicCustody && !i.containerId
    && !i.carryTaskId && !i.toolInstanceId && !i.chemicalBatch && !i.biology && !i.contents?.length
    && !i.tags?.some(t => /contaminated|stolen/i.test(t));
  function supply(s, g, c, stacks, at) {
    const cycle = s.cycles.find(r => !r.fulfilledAt);
    if (!current(s, g, c) || !['active', 'cure'].includes(s.status) || !cycle || c.bodyEpoch !== s.terms.bodyEpoch
      || at >= cycle.dueAt + CURE || at >= s.terms.endsAt) return false;
    const item = stacks.find(i => ownedParts(i)); if (!item) return false;
    if (!begin(s, g, c, 'supply', WORK, at, { cycleId: cycle.id, stackId: item.id, originalQuantity: item.quantity })) return false;
    item.reservedTaskId = s.job.id; return true;
  }
  function end(s, g, market, at, status, text) {
    if (!s.terms || ['completed', 'terminated', 'expired', 'breached'].includes(s.status)) return false;
    s.status = status; s.endedAt = at;
    s.cityRetained += s.cityStock; s.cityStock = 0;
    const owed = s.cycles.filter(r => r.fulfilledAt != null && !r.shipmentId).length * FREIGHT;
    const refund = Math.max(0, s.freightEscrow - owed); s.freightEscrow -= refund; market.treasury += refund;
    if (g.foreignCivic.bargain.depot.compactReservedBy === s.id) delete g.foreignCivic.bargain.depot.compactReservedBy;
    note(s, at, status, text); return true;
  }
  function dispatch(s, market, at) {
    for (const r of s.cycles.filter(r => r.fulfilledAt != null && !r.shipmentId)) {
      if (s.freightEscrow < FREIGHT) continue;
      const sh = Production.bookServiceCargo(market.production, s.procurement.facilityId, 'assayReagent', 1, at,
        { cityId: s.source.cityId, propertyId: s.source.depotId, endsAt: Number.MAX_SAFE_INTEGER, closed: false });
      if (!sh) continue;
      sh.compactCycleId = r.id; sh.compactId = s.id; r.shipmentId = sh.id;
      s.freightEscrow -= FREIGHT; market.production.finance.transportEarned = (market.production.finance.transportEarned || 0) + FREIGHT;
      note(s, at, 'dispatch', 'One earned original reagent unit dispatched by the existing finite producer truck to the named municipal depot.');
    }
  }
  function receive(s, g, c, at) {
    if (!contact(s, g, c, false, true)) return false;
    s.report = { at, cityId: s.source.cityId, sourceId: s.id, status: s.status, terms: copy(s.terms),
      refusal: copy(s.refusal), history: copy(s.history), cycles: s.cycles.map(r => ({ id: r.id, dueAt: r.dueAt,
        fulfilledAt: r.fulfilledAt, receivedAt: r.receivedAt || null, stackId: r.stackId || null, collectedAt: r.collectedAt || null })), scope: SCOPE };
    return true;
  }
  function advance(s, g, market, context, to, hooks = {}) {
    if (!s || !market || !Number.isFinite(to) || to < s.lastAt) return false;
    if (market.id !== s.source.cityId || market.production?.cityId !== s.source.cityId) return false;
    const c = context();
    if (!c.alive || c.worldId !== s.worldId || c.runId !== s.runId) return false;
    const from = s.lastAt; s.lastAt = to;
    const stacks = hooks.stacks?.() || [], j = s.job;
    if (j) {
      const item = stacks.find(i => i.id === j.stackId), cycle = s.cycles.find(r => r.id === j.cycleId);
      const reason = !contact(s, g, c, true, ['collect', 'report', 'terminate'].includes(j.kind))
        || ['negotiate', 'sign', 'supply'].includes(j.kind) && !current(s, g, c) || j.bodyEpoch !== c.bodyEpoch
        || j.kind === 'supply' && (!ownedParts(item, j.id) || item.quantity !== j.originalQuantity || item.carriedBy !== 'scientist'
          || item.reservedTaskId !== j.id || item.cityOwnerId || item.civicCustody || !cycle || to >= cycle.dueAt + CURE);
      const dt = Math.max(0, to - j.lastAt); j.lastAt = to;
      if (reason) { release(s, g, stacks); note(s, to, 'interrupted', 'Attendance or original custody changed; no uninstalled parts consumed and no spent work refunded.'); }
      else {
        const b = g.foreignCivic.bargain, work = Math.min(dt, j.seconds - j.progress, g.receptionWorkSeconds, g.powerSeconds,
          b.representative.workSeconds, b.defender.workSeconds);
        j.progress += work; g.receptionWorkSeconds -= work; g.powerSeconds -= work;
        b.representative.workSeconds -= work; b.defender.workSeconds -= work;
        if (j.progress + 1e-7 >= j.seconds) {
          const at = to - dt + work;
          if (j.kind === 'negotiate') {
            s.offer = { ...copy(j.quote), issuedAt: at, expiresAt: at + 3600 };
            note(s, at, 'offer', 'Exact finite supply-and-access terms received. No goods, city funds or transport have moved.');
          } else if (j.kind === 'sign') {
            // Recheck original resources and alternatives at commitment, without
            // treating this job's own queue reservation as a different official.
            const w = stock(market.production), cost = j.quote.purchasePrice * 2;
            if (at < j.quote.expiresAt && !offerReason(s, g, market, c, true) && c.reagentAsk === j.quote.purchasePrice
              && w?.facilityId === j.quote.facilityId) {
              w.stock -= 2; market.treasury -= cost + FREIGHT * 2;
              market.production.finance.money += cost; market.production.finance.earned += cost;
              market.production.finance.ledger.push({ at, kind: 'municipalCompactPurchase', amount: cost, cargo: 'assayReagent', quantity: 2 });
              s.procurement = { at, facilityId: w.facilityId, quantity: 2, cost, cityOwnerId: g.cityId };
              s.cityStock = 2; s.freightEscrow = FREIGHT * 2;
              s.terms = { ...copy(j.quote), signedAt: at, endsAt: at + DAY * 3 };
              s.cycles = [1, 2].map(n => ({ id: `${s.id}:installment:${n}`, dueAt: at + n * DAY, fulfilledAt: null, shipmentId: null }));
              b.depot.compactCommitted = true; b.depot.compactReservedBy = s.id; s.status = 'active';
              note(s, at, 'signed', 'City bought two actual factory units and prepaid both freight legs. Named-depot access is conditional; no political submission.');
            } else note(s, at, 'refusal', 'Actual offer resources or current alternatives changed; no funds, goods or access transferred.');
          } else if (j.kind === 'supply') {
            item.quantity -= 3; if (item.knownQuantity != null) item.knownQuantity = Math.min(item.knownQuantity, item.quantity);
            s.preparedFittings++; b.depot.compactConsumed = (b.depot.compactConsumed || 0) + 3;
            cycle.fulfilledAt = at; cycle.inputStackId = item.id; cycle.inputQuantity = 3; cycle.titleOwner = 'scientist'; s.cityStock--;
            note(s, at, 'performance', 'Three exact carried metal parts consumed during attended preparation of one original city-owned ward-maintenance fitting. One reserved reagent unit is now owed, not yet delivered.');
          } else if (j.kind === 'collect' && cycle && hooks.collect?.(cycle)) {
            cycle.collectedAt = at;
            note(s, at, 'collection', 'Collected the exact original earned reagent at the depot. Retrieval survives compact expiry; no replacement lot or onward transport supplied.');
          }
          release(s, g, stacks);
        }
      }
    }
    if (s.terms && ['active', 'cure'].includes(s.status)) {
      const pending = s.cycles.find(r => r.fulfilledAt == null);
      if (!current(s, g, c)) end(s, g, market, to, 'terminated', 'Original sovereign authority no longer supports new compact access. Earned cargo and ownership remain.');
      else if (!pending) end(s, g, market, to, 'completed', 'Both maintenance installments performed. Earned freight, collection and historical receipts remain; no continuing allegiance.');
      else if (installmentState(s.cycles, to) === 'breached') end(s, g, market, pending.dueAt + CURE, 'breached',
        c.routeOpen ? 'An installment remained unfulfilled after its disclosed six-hour remedy window; future access ended. Cause and deliberate refusal are not inferred.'
          : 'Material route obstruction outlasted the remedy window; future access ended without a finding of deliberate refusal.');
      else if (to >= pending.dueAt) { if (s.status !== 'cure') note(s, pending.dueAt, 'remedy', 'Outstanding installment: six-hour remedy window. Physical obstruction is distinct from a declared refusal; no guilt is inferred.'); s.status = 'cure'; }
      else s.status = 'active';
    }
    if (s.terms) dispatch(s, market, to);
    for (const r of s.cycles.filter(r => r.shipmentId && !r.stackId)) {
      if (c.depotAvailable === false) continue;
      const receipt = market.production.serviceDepot?.[r.shipmentId];
      if (!receipt || receipt.compactCycleId !== r.id || receipt.compactId !== s.id || receipt.cargo !== 'assayReagent'
        || receipt.quantity !== 1 || receipt.destination?.propertyId !== s.source.depotId || receipt.destination.cityId !== s.source.cityId) continue;
      const item = hooks.stage?.(r, receipt); if (!item) continue;
      r.stackId = item.id; r.receivedAt = receipt.deliveredAt; delete market.production.serviceDepot[r.shipmentId];
      r.unitMassKg = item.unitMassKg; r.unitVolumeL = item.unitVolumeL;
      note(s, receipt.deliveredAt, 'depotReceipt', 'Original paid reagent physically arrived at the named depot; it remains collectible property, not remote inventory.');
    }
    return to !== from || Boolean(j);
  }
  function terminate(s, g, market, c, at) {
    if (!contact(s, g, c, false, true) || c.bodyEpoch !== s.terms?.bodyEpoch || s.job) return false;
    return end(s, g, market, at, 'terminated', 'Private principal explicitly ended future installments. Earned goods, spent supplies and existing freight remain; no confiscation or criminal verdict.');
  }
  function collect(s, g, c, cycleId, at) {
    const r = s.cycles.find(r => r.id === cycleId);
    if (!contact(s, g, c, false, true) || c.bodyEpoch !== s.terms?.bodyEpoch || !r?.stackId || r.collectedAt != null) return false;
    return begin(s, g, c, 'collect', 30, at, { cycleId });
  }
  function inputReceipt(s, item) {
    const r = s?.cycles?.find(r => r.stackId === item?.id && r.collectedAt != null && r.receivedAt != null);
    if (!r || item.section !== 'resources' || item.key !== 'assayReagent' || item.quantity !== 1
      || !item.sourceLabels?.includes(s.id) || !item.sourceLabels.includes(r.id) || !item.sourceLabels.includes(s.source.cityId)
      || !(r.unitMassKg > 0) || !(r.unitVolumeL > 0) || item.unitMassKg !== r.unitMassKg || item.unitVolumeL !== r.unitVolumeL) return null;
    return { kind: 'compactReagent', orderId: r.id, cityId: s.source.cityId, facilityId: s.procurement.facilityId,
      shipmentId: r.shipmentId, receivedAt: r.collectedAt };
  }
  return { DAY, CURE, WORK, FREIGHT, SCOPE, installmentState, validSource, sourceFromWorld, create, normalize, current, contact, offerReason, propose,
    sign, supply, advance, terminate, collect, receive, release, inputReceipt };
});
