(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./living-smuggling') : root.HelixLivingSmuggling,
    typeof module === 'object' && module.exports ? require('./smuggling-checkpoints') : root.HelixSmugglingCheckpoints,
    typeof module === 'object' && module.exports ? require('./cargo-criminal-referrals') : root.HelixCargoCriminalReferrals,
    typeof module === 'object' && module.exports ? require('./carrier-corroboration') : root.HelixCarrierCorroboration);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixIntercitySmuggling = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Living, Checkpoints, Referrals, Carrier) {
  'use strict';
  const HOUR = 3600, copy = v => JSON.parse(JSON.stringify(v));
  const fingerprint = Checkpoints.fingerprint;
  const physical = r => r?.supportCapable && !['closed', 'none'].includes(r.continuity) && Number.isFinite(r.distanceKm) && r.distanceKm > 0;
  const connects = (o, r) => physical(r) && r.id === o.routeId && r.endpointCityIds?.length === 2 && r.endpointCityIds.includes(o.sourceId) && r.endpointCityIds.includes(o.destinationId);
  const capable = o => o.condition >= 50 && o.crew.every(c => c.status === 'alive' && c.health >= 50 && c.fatigue < 80);
  function create(homeId, at = 0) { return { homeId, lastAt: at, operators: [], buyers: [], shipments: [], quote: null, message: '', nextNumber: 1 }; }
  // A bounded scenario allocation, once per known direct corridor, sponsored by a local broker.
  // Neither lawful permits nor network membership supplies these assets.
  function discover(state, routes, destinations, broker, at) {
    if (!state.homeId || !broker || broker.homeCityId !== state.homeId || !broker.serviceCityIds?.includes(state.homeId)) return;
    for (const r of routes) {
      if (r.endpointCityIds?.length !== 2 || new Set(r.endpointCityIds).size !== 2 || !r.endpointCityIds.includes(state.homeId) || !physical(r)) continue;
      const cityId = r.endpointCityIds.find(id => id !== state.homeId);
      const city = destinations.find(d => d.kind === 'fortifiedCity' && d.cityId === cityId && d.known);
      if (!city || state.operators.some(o => o.routeId === r.id)) continue;
      const buyerId = `covert-buyer:${cityId}`;
      if (!state.buyers.some(b => b.id === buyerId)) state.buyers.push({ id: buyerId, cityId, name: `${city.label} private buyer`, money: 10000 });
      state.operators.push({ id: `smuggler:${r.id}`, routeId: r.id, sourceId: state.homeId, destinationId: cityId, buyerId,
        brokerId: broker.id, name: `${broker.name}'s corridor associate`, vehicleId: `smuggling-van:${r.id}`, capacityKg: 120, capacityL: 240,
        fuelKm: 600, provisions: 40, money: 1200, condition: 100, assignment: null, location: state.homeId, lastAt: at,
        crew: [{ id: `smuggler-driver:${r.id}`, name: `${city.label} corridor driver`, status: 'alive', health: 100, fatigue: 0 }], reason: '' });
      Carrier.provision(state.operators.at(-1), at);
    }
  }
  function trip(op, route) {
    if (!op || !connects(op, route)) return null;
    const speed = 30 / (route.continuity === 'intermittent' ? 1.55 : route.continuity === 'degraded' ? 1.25 : 1);
    const seconds = Math.ceil(route.distanceKm / speed * HOUR), hours = Math.ceil(seconds * 2 / HOUR), food = Math.ceil(hours / 8);
    if (hours > 48 || !capable(op) || op.fuelKm < route.distanceKm * 2 || op.provisions < food || op.money < hours
      || op.condition - route.distanceKm * 2 * .02 < 50 || op.crew.some(c => c.fatigue + route.distanceKm * 2 * .04 >= 80)) return null;
    return { distanceKm: route.distanceKm, seconds, hours, food };
  }
  function offer(state, operatorId, request, route, at) {
    const op = state.operators.find(o => o.id === operatorId), journey = trip(op, route);
    const refuse = reason => ({ ok: false, reason });
    if (!journey || op.assignment || op.carrierService?.assignment || op.location !== state.homeId) return refuse('No idle dedicated smuggler with a supported direct route and funded round trip.');
    const living = request?.manifest?.commodityKind === 'specimen' ? Living.plan(op, request, journey) : null;
    if (living && !living.ok) return living;
    if (!living && (!['rawByproduct', 'manufactured'].includes(request?.manifest?.commodityKind) || request.manifest.entries?.some(e => e.creature || ['creature', 'transportPod'].includes(e.kind)))) return refuse('Living cargo requires a separate containment and survival contract.');
    if (!request.manifest.entries?.length || !Number.isFinite(request.cargo?.massKg) || !Number.isFinite(request.cargo?.volumeL) || request.cargo.massKg <= 0 || request.cargo.volumeL <= 0 || request.cargo.massKg > op.capacityKg || request.cargo.volumeL > op.capacityL) return refuse('Exact nonliving cargo must fit the dedicated vehicle.');
    if (!Number.isFinite(request.localDistanceKm) || request.localDistanceKm <= 0 || !Number.isFinite(request.value) || request.value <= 0) return refuse('A local collection route and buyer valuation are required.');
    const gross = Math.floor(request.value), localFreight = Math.ceil(8 + request.localDistanceKm * .2), intercityFreight = Math.ceil(12 + journey.hours * 1.2 + journey.distanceKm * .12 + journey.food * 12);
    if (living && (request.cargo.massKg + living.kitKg > op.capacityKg || request.cargo.volumeL + living.kitL > op.capacityL)) return refuse('Specimen, pod and care kit exceed biological vehicle capacity.');
    const returnFee = living?.returnFee || 0;
    const net = gross - localFreight - intercityFreight - returnFee, buyer = state.buyers.find(b => b.id === op.buyerId);
    if (net <= 0 || buyer.money < gross) return refuse(net <= 0 ? 'Foreign proceeds do not cover both freight legs.' : 'Foreign buyer cannot fund escrow.');
    return { ok: true, operatorId, buyerId: buyer.id, buyerName: buyer.name, destinationId: buyer.cityId, routeId: op.routeId, brokerId: request.brokerId, templateId: request.templateId,
      selectedId: request.selectedId, fingerprint: fingerprint(request.manifest), cargo: copy(request.cargo), gross, localFreight, intercityFreight, net,
      material: request.manifest.material, batchRequirements: copy(request.batchRequirements || null), deliveryWindowSeconds: 72 * HOUR,
      ...journey, livingPlan: living, returnFee, localDistanceKm: request.localDistanceKm, terms: request.terms || '', at, expiresAt: at + HOUR };
  }
  function book(state, quoted, request, route, contractId, at) {
    const fresh = offer(state, quoted?.operatorId, request, route, at);
    if (!fresh.ok) return fresh;
    if (at > quoted.expiresAt || Object.keys(fresh).filter(k => !['at', 'expiresAt'].includes(k)).some(k => JSON.stringify(fresh[k]) !== JSON.stringify(quoted[k]))) return { ok: false, reason: 'Quote or exact cargo changed; review and confirm again.', revised: fresh };
    if (state.shipments.some(s => s.contractId === contractId)) return { ok: false, reason: 'Contract already booked.' };
    const op = state.operators.find(o => o.id === fresh.operatorId), buyer = state.buyers.find(b => b.id === fresh.buyerId);
    buyer.money -= fresh.gross;
    const shipment = { ...copy(fresh), id: `smuggling-${state.nextNumber++}`, contractId, sourceId: state.homeId, owner: 'player', custodian: 'laboratory',
      phase: 'awaitingCollection', bookedAt: at, deliveryDeadlineAt: at + fresh.deliveryWindowSeconds, lastAt: at, manifest: null, positionKm: 0, localEscrow: fresh.localFreight, freightEscrow: fresh.intercityFreight, playerEscrow: fresh.net,
      returnEscrow: fresh.returnFee, receiptAt: null, settledAt: null, reason: '' };
    delete shipment.ok;
    state.shipments.push(shipment); op.assignment = shipment.id; op.lastAt = at;
    if (fresh.livingPlan) Living.reserve(op, shipment, fresh.livingPlan);
    if (!shipment.living && op.carrierService) {
      shipment.carrierContact = copy(op.carrierService.contact);
      Carrier.record(op, shipment, 'transportBooked', at, op.sourceId, 'carrier booking channel', request.manifest);
    }
    return { ok: true, shipment };
  }
  function markCollected(state, id, manifest, courierId, at) {
    const s = state.shipments.find(s => s.id === id);
    if (!s || s.phase !== 'awaitingCollection' || fingerprint(manifest) !== s.fingerprint) return false;
    s.phase = 'localTransit'; s.custodian = courierId; s.collectedAt = at; s.lastAt = at; return true;
  }
  function receiveDepot(state, id, manifest, at) {
    const s = state.shipments.find(s => s.id === id);
    if (!s || s.phase !== 'localTransit' || fingerprint(manifest) !== s.fingerprint) return 0;
    s.manifest = copy(manifest); s.phase = 'depot'; s.custodian = `covert-depot:${state.homeId}`; s.depotAt = at; s.lastAt = at;
    Carrier.record(state.operators.find(o => o.id === s.operatorId), s, 'receivedAtDepot', at, s.sourceId, `covert-depot:${state.homeId}`);
    const fee = s.localEscrow; s.localEscrow = 0; return fee;
  }
  function cancel(state, id, at) {
    const s = state.shipments.find(s => s.id === id);
    if (!s || s.phase !== 'awaitingCollection') return false;
    state.buyers.find(b => b.id === s.buyerId).money += s.localEscrow + s.freightEscrow + s.playerEscrow + (s.returnEscrow || 0);
    const op = state.operators.find(o => o.id === s.operatorId), kitAway = s.living?.localJobId && !s.living.kitAtDepot;
    if (!kitAway) Living.release(op, s);
    s.localEscrow = s.freightEscrow = s.playerEscrow = s.returnEscrow = 0; s.phase = 'canceled'; s.canceledAt = at;
    if (!kitAway) op.assignment = null; return true;
  }
  function advance(state, now, routes, supplier = null) {
    for (const op of state.operators) {
      const elapsed = Math.max(0, now - op.lastAt); op.lastAt = Math.max(op.lastAt, now);
      const s = state.shipments.find(s => s.id === op.assignment);
      if (s?.living) continue;
      if (!s || ['awaitingCollection', 'localTransit', 'depot'].includes(s.phase)) {
        op.crew.forEach(c => { c.fatigue = Math.max(0, c.fatigue - elapsed / HOUR * 15); });
        if (supplier?.routeOpen) {
          const fuel = Math.max(0, Math.min(600 - op.fuelKm, supplier.fuelStockKm, op.money / .05));
          op.fuelKm += fuel; supplier.fuelStockKm -= fuel; op.money -= fuel * .05;
        }
        // No free repair, food, replacement crew, or transit resupply.
      }
      if (!s) continue;
      let cursor = s.lastAt, seconds = Math.max(0, now - s.lastAt); s.lastAt = Math.max(s.lastAt, now);
      const route = routes.find(r => r.id === op.routeId);
      if (s.phase === 'depot') {
        Checkpoints.expire(state, s, now);
        if (s.saleFailedAt != null) { s.phase = 'returned'; s.custodian = `covert-depot:${state.homeId}`; s.returnedAt = now; op.assignment = null; continue; }
        const journey = trip(op, route);
        if (!journey || route.distanceKm !== s.distanceKm) { s.reason = 'Departure held: route, crew or round-trip resources unavailable.'; continue; }
        op.money -= journey.hours; s.phase = 'outbound'; s.departedAt = now; s.custodian = op.vehicleId; s.reason = '';
        Carrier.record(op, s, 'departedDepot', now, s.sourceId, `covert-depot:${state.homeId}`); continue;
      }
      while (['outbound', 'returning', 'inspecting', 'detained'].includes(s.phase) && seconds > 0) {
        Checkpoints.expire(state, s, cursor);
        if (Checkpoints.pending(s)) {
          if (Checkpoints.tick(state, s, op, cursor)) {
            const step = Math.min(seconds, 60); op.provisions = Math.max(0, op.provisions - step / (8 * HOUR));
            seconds -= step; cursor += step; continue;
          }
        }
        if (!connects(op, route) || route.distanceKm !== s.distanceKm || !capable(op)) {
          op.provisions = Math.max(0, op.provisions - seconds / (8 * HOUR));
          s.reason = 'Transit held: route or crew unavailable; cargo, people and escrow preserved.'; break;
        }
        const speed = 30 / (route.continuity === 'intermittent' ? 1.55 : route.continuity === 'degraded' ? 1.25 : 1);
        const remaining = s.phase === 'outbound' ? s.distanceKm - s.positionKm : s.positionKm;
        const conditionRange = Math.max(0, (op.condition - 50) / .02), fatigueRange = Math.min(...op.crew.map(c => Math.max(0, (80 - c.fatigue) / .04)));
        const available = s.receiptAt === null && s.saleFailedAt == null ? Math.min(seconds, Math.max(0, s.deliveryDeadlineAt - cursor)) : seconds;
        const moved = Math.max(0, Math.min(remaining, available / HOUR * speed, op.provisions * 8 * speed, op.fuelKm, conditionRange, fatigueRange));
        const arrived = moved + 1e-8 >= remaining, usedSeconds = arrived ? remaining / speed * HOUR : available;
        op.provisions = Math.max(0, op.provisions - usedSeconds / (8 * HOUR));
        op.fuelKm -= moved; op.condition -= moved * .02; op.crew.forEach(c => { c.fatigue += moved * .04; });
        s.positionKm += s.phase === 'outbound' ? moved : -moved;
        op.location = `${s.phase}:${op.routeId}:${s.positionKm.toFixed(2)}km`;
        s.reason = !arrived && (op.fuelKm <= 0 || op.provisions <= 0 || !capable(op) || conditionRange <= moved || fatigueRange <= moved) ? 'Transit resources exhausted; no automatic rescue, cargo loss or death.' : '';
        seconds = Math.max(0, seconds - usedSeconds); cursor += usedSeconds;
        if (arrived) {
          if (s.phase === 'outbound') {
            if (Checkpoints.expire(state, s, cursor)) continue;
            Carrier.record(op, s, 'destinationArrival', cursor, s.destinationId, 'destination approach');
            if (Checkpoints.enter(state, s, op, cursor)) continue;
            s.phase = 'returning'; s.receiptAt = cursor; s.owner = s.buyerId; s.custodian = s.buyerId;
            op.money += s.freightEscrow; s.freightEscrow = 0;
            Carrier.record(op, s, 'buyerHandoff', cursor, s.destinationId, 'destination handoff');
          } else {
            s.phase = 'returned'; s.returnedAt = cursor; op.assignment = null; op.location = state.homeId;
            if (s.receiptAt === null && s.owner === 'player') s.custodian = `covert-depot:${state.homeId}`;
            Carrier.record(op, s, 'returnedToDepot', cursor, s.sourceId, `covert-depot:${state.homeId}`, s.receiptAt == null ? s.manifest : { entries: [] });
            op.crew.forEach(c => { c.fatigue = Math.max(0, c.fatigue - seconds / HOUR * 15); });
          }
        }
      }
      Checkpoints.expire(state, s, now);
      // Resolve a review due exactly at this clock boundary, without inventing further travel.
      if (Checkpoints.pending(s)) Checkpoints.tick(state, s, op, now);
    }
    Referrals.advance(state, now);
    state.lastAt = Math.max(state.lastAt, now);
  }
  function settle(state, id, at) {
    const s = state.shipments.find(s => s.id === id);
    if (!s || s.receiptAt === null || s.settledAt !== null) return 0;
    const paid = s.playerEscrow; s.playerEscrow = 0; s.settledAt = at; return paid;
  }
  return { create, discover, offer, book, markCollected, receiveDepot, cancel, advance, settle, fingerprint };
});
