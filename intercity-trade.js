(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./city-commodity-market') : root.HelixCityCommodityMarket,
    node ? require('./local-market-production') : root.HelixLocalMarketProduction,
    node ? require('./local-exchange-carrier') : root.HelixLocalExchangeCarrier);
  if (node) module.exports = api;
  if (root) root.HelixIntercityTrade = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Market, Production, Carrier) {
  'use strict';
  const HOUR = 3600, copy = v => JSON.parse(JSON.stringify(v));
  function permit(route, profiles) {
    const eligible = (p, cityId) => (p?.standings || []).filter(e => e.network?.category === 'transport' && ['licensed', 'chartered'].includes(e.standing)
      && e.branch && !['ruined', 'destroyed'].includes(e.branch.physicalCondition)
      && e.branch.publicPhysicalPresence !== false && (e.branch.currentCityId || e.branch.cityId || cityId) === cityId
      && !['dormant', 'defunct', 'consolidated'].includes(e.branch.operationalStatus));
    const [a, b] = route.endpointCityIds, left = eligible(profiles[a], a), right = eligible(profiles[b], b);
    const operator = left.find(e => right.some(r => r.network.id === e.network.id));
    return { id: `commerce:${route.id}`, corridorId: route.id, operatorId: operator?.network.id || '',
      scope: 'ordinary listed goods between endpoint exchange depots; no sovereign authority or alliance',
      approvals: [a, b].map(cityId => ({ cityId, allowed: Boolean(operator), basis: operator ? 'Current local transport licence and public physical branch; bounded depot commerce permit.' : 'No qualifying shared licensed transport operator.' })) };
  }
  function create(home, profiles, routes, permissions, defs, now = 0) {
    const direct = routes.filter(r => r.endpointCityIds.length === 2 && new Set(r.endpointCityIds).size === 2 && r.endpointCityIds.includes(home.cityId));
    const ids = new Set(direct.flatMap(r => r.endpointCityIds));
    const neighbors = profiles.filter(p => p.cityId !== home.cityId && ids.has(p.cityId)).map(p => ({ id: p.cityId, profile: copy(p), treasury: 10000, reserveFraction: 0.6,
      listings: Object.fromEntries(defs.map(d => [d.id, { supply: p.listings[d.id]?.targetSupply || 0, demand: p.listings[d.id]?.targetDemand || 1 }])),
      production: Production.create(p, now), carrier: Carrier.create(p.cityId), reports: [] }));
    const validIds = new Set([home.cityId, ...neighbors.map(n => n.id)]);
    return { homeId: home.cityId, homeProfile: copy(home), homeTreasury: 10000, homeReserveFraction: 0.6, lastAt: now, neighbors,
      operators: direct.filter(r => r.endpointCityIds.every(id => validIds.has(id))).map((r, i) => ({ id: `wholesaler:${r.id}`, route: copy(r), permit: copy(permissions.find(p => p.corridorId === r.id) || { approvals: [], operatorId: '' }),
        money: 5000, capacity: 24, fuelKm: 600, provisions: 40, condition: 100, repairAt: null,
        crew: [{ id: `${r.id}:driver`, name: ['Tessa Rowan', 'Lorin Vale', 'Dara Moss', 'Marek Flint'][i % 4], health: 100, status: 'alive', fatigue: 0 }, { id: `${r.id}:escort`, name: ['Amon Voss', 'Sera Holt', 'Ivo Ash', 'Nila Reed'][i % 4], health: 100, status: 'alive', fatigue: 0 }],
        vehicleId: `${r.id}:freight-vehicle`, shipment: null, location: home.cityId, distanceTravelledKm: 0, reason: '', reportedAt: now, advertisement: null })),
      shipments: [], nextNumber: 1, ledger: [] };
  }
  function access(op) { return op.route.supportCapable && !['closed', 'none'].includes(op.route.continuity) && op.permit.approvals?.length === 2 && op.route.endpointCityIds.every(id => op.permit.approvals.some(p => p.cityId === id && p.allowed)); }
  const capable = op => op.condition >= 50 && op.crew.every(c => c.health >= 50 && c.status === 'alive');
  function quote(def, listing) {
    const scarcity = Math.pow(Math.max(0.2, def.supply) / Math.max(1, listing.supply), 0.42);
    const mid = Math.max(1, def.basePrice * Math.max(0.55, Math.min(1.8, listing.demand)) * scarcity);
    return { ask: mid * 1.06, bid: mid * 0.94 };
  }
  function cities(state, homeListings) {
    return [{ id: state.homeId, profile: state.homeProfile, listings: homeListings, treasury: state.homeTreasury, reserveFraction: state.homeReserveFraction }, ...state.neighbors];
  }
  function exportLot(def, stack, requested, reservation = '') {
    if (!def?.sellable || !stack || stack.section !== def.section || stack.key !== def.key || stack.carriedBy || (stack.reservedTaskId && stack.reservedTaskId !== reservation)) return null;
    const batch = stack.chemicalBatch, chemical = def.section === 'chemicalBatches';
    if (chemical && (batch?.classification?.known !== 'ordinary' || batch?.classification?.actual !== 'ordinary' || batch?.packaging?.state !== 'packaged' || batch?.documentation?.status !== 'certified')) return null;
    const quantity = chemical ? stack.quantity : requested;
    if (!Number.isFinite(quantity) || quantity <= 0 || (!chemical && !Number.isSafeInteger(quantity)) || stack.quantity < quantity) return null;
    const quality = chemical ? .8 + (.65 * Math.max(0, Math.min(100, Number(batch.purity) || 0)) + .35 * Math.max(0, Math.min(100, Number(batch.craftsmanship) || 0))) * .004 : 1;
    return { stackId: stack.id, quantity, quality, fingerprint: JSON.stringify({ id: stack.id, section: stack.section, key: stack.key, batch: batch || null }) };
  }
  function exportReadiness(op, state) {
    if (!op || op.location !== state.homeId || !access(op)) return false;
    const distance = op.route.distanceKm;
    const legHours = Math.max(1, Math.ceil(distance / 38 * (op.route.continuity === 'intermittent' ? 1.55 : op.route.continuity === 'degraded' ? 1.25 : 1)));
    const totalHours = legHours * 2 + 2, provisions = Math.ceil(totalHours / 8) * 2;
    if (!Number.isFinite(distance) || distance <= 0 || totalHours > 48 || distance * 2 > op.fuelKm || op.provisions < provisions || !capable(op) || op.repairAt || op.condition - distance * 2 * .015 < 50 || op.crew.some(c => c.fatigue + distance * 2 * .025 > 80) || op.money < totalHours) return false;
    return { distanceKm: distance, legHours, totalHours, provisions };
  }
  function exportOffer(state, operatorId, good, stack, requested, defs, at, localUnitFreight) {
    const op = state?.operators.find(o => o.id === operatorId), def = defs.find(d => d.id === good);
    const lot = exportLot(def, stack, requested);
    if (!lot) return { ok: false, reason: 'An exact unreserved legally saleable lot is required.' };
    const trip = exportReadiness(op, state);
    if (!trip || op.shipment) return { ok: false, reason: 'An available capable home-depot convoy, supported direct route, both commercial permits and funded round trip are required.' };
    if (lot.quantity > op.capacity || !Number.isFinite(localUnitFreight) || localUnitFreight < 0) return { ok: false, reason: 'The complete lot exceeds convoy capacity or has no local freight quote.' };
    const buyer = state.neighbors.find(n => op.route.endpointCityIds.includes(n.id));
    if (!buyer?.listings[good]) return { ok: false, reason: 'No neighboring buyer for this good.' };
    const gross = Math.floor(lot.quantity * quote(def, buyer.listings[good]).bid * lot.quality);
    const intercityFreight = Math.ceil(10 + 1.2 * (trip.totalHours + trip.distanceKm * .1 + trip.provisions * (defs.find(d => d.id === 'fieldRation')?.basePrice || 12)));
    const localFreight = Math.ceil(lot.quantity * localUnitFreight), net = gross - intercityFreight - localFreight;
    if (net <= 0 || buyer.treasury < gross) return { ok: false, reason: net <= 0 ? 'Sale proceeds do not cover both freight stages.' : 'Buyer cannot fund the complete payment.' };
    return { ok: true, operatorId, destinationId: buyer.id, good, requested, ...lot, ...trip, gross, intercityFreight, localFreight, net, at, expiresAt: at + HOUR };
  }
  function bookExport(state, offered, stack, defs, at, localUnitFreight) {
    const fresh = exportOffer(state, offered?.operatorId, offered?.good, stack, offered?.requested, defs, at, localUnitFreight);
    if (!fresh.ok) return fresh;
    if (at > offered.expiresAt || Object.keys(fresh).filter(k => !['at', 'expiresAt'].includes(k)).some(k => fresh[k] !== offered[k])) return { ok: false, reason: 'Quote or exact lot changed or expired. Review and confirm again.', revised: fresh };
    const op = state.operators.find(o => o.id === fresh.operatorId), buyer = state.neighbors.find(n => n.id === fresh.destinationId);
    buyer.treasury -= fresh.gross;
    const shipment = { id: `wholesale-${state.nextNumber++}`, kind: 'export', owner: 'player', operatorId: op.id, vehicleId: op.vehicleId,
      sourceId: state.homeId, destinationId: buyer.id, good: fresh.good, quantity: fresh.quantity, stackId: fresh.stackId, fingerprint: fresh.fingerprint,
      gross: fresh.gross, escrow: fresh.intercityFreight, localEscrow: fresh.localFreight, playerEscrow: fresh.net,
      waitingCargo: true, collected: false, cargoManifest: null, bookedAt: at, dispatchedAt: null, elapsedHours: 0,
      legHours: fresh.legHours, distanceKm: fresh.distanceKm, totalHours: fresh.totalHours, deliveryHour: fresh.legHours + 1,
      travelledKm: 0, foodReserve: 0, pickupHour: 0, pickedUp: false, delivered: false, returned: false };
    state.shipments.push(shipment); op.shipment = shipment.id; op.advertisement = null; op.reason = 'Reserved for exact player export; awaiting local collection.';
    ledger(state, at, `${shipment.id}: buyer funded all proceeds and freight; convoy reserved pending exact-lot collection.`);
    return { ok: true, shipment, offer: fresh };
  }
  function failExport(state, id, at) {
    const sh = state.shipments.find(s => s.id === id);
    if (!sh || sh.kind !== 'export' || sh.collected || sh.failed) return false;
    state.neighbors.find(n => n.id === sh.destinationId).treasury += sh.escrow + sh.localEscrow + sh.playerEscrow;
    sh.escrow = sh.localEscrow = sh.playerEscrow = 0; sh.failed = true; sh.returned = true; sh.returnedAt = at; sh.settled = true;
    const op = state.operators.find(o => o.id === sh.operatorId);
    if (op.shipment === id) { op.shipment = null; op.reason = 'Export failed before collection; buyer escrow refunded.'; }
    ledger(state, at, `${id}: exact lot unavailable before collection; unused buyer escrow refunded.`);
    return true;
  }
  function receiveExport(state, id, manifest, at) {
    const sh = state.shipments.find(s => s.id === id);
    if (!sh || sh.kind !== 'export' || !sh.collected || sh.failed || manifest?.id !== sh.stackId || manifest.quantity !== sh.quantity
      || JSON.stringify({ id: manifest.id, section: manifest.section, key: manifest.key, batch: manifest.chemicalBatch || null }) !== sh.fingerprint) return null;
    if (sh.cargoManifest) return 0;
    sh.cargoManifest = copy(manifest); sh.depotAt = at;
    const paid = sh.localEscrow; sh.localEscrow = 0;
    ledger(state, at, `${id}: exact cargo at home depot, outside public stock; local freight settled.`);
    return paid;
  }
  function settleExport(state, id) {
    const sh = state.shipments.find(s => s.id === id);
    if (!sh || sh.kind !== 'export' || !sh.delivered || sh.settled) return 0;
    const paid = sh.playerEscrow; sh.playerEscrow = 0; sh.settled = true;
    return paid;
  }
  function importOffer(state, operatorId, good, requested, defs, at, localUnitFreight) {
    const op = state?.operators.find(o => o.id === operatorId), def = defs.find(d => d.id === good);
    const refuse = reason => ({ ok: false, reason });
    if (!op || !def || def.buyable === false || def.sellable === false) return refuse('No supported import listing or operator.');
    if (!Number.isSafeInteger(requested) || requested < 1 || !Number.isFinite(localUnitFreight) || localUnitFreight < 0) return refuse('Invalid quantity or local freight quote.');
    if (op.shipment || op.location !== state.homeId) return refuse('Convoy busy; an available home-depot vehicle is required.');
    if (!access(op)) return refuse('Direct corridor and both endpoint commercial permits are required.');
    const distanceKm = op.route.distanceKm;
    const legHours = Math.max(1, Math.ceil(distanceKm / 38 * (op.route.continuity === 'intermittent' ? 1.55 : op.route.continuity === 'degraded' ? 1.25 : 1)));
    const totalHours = legHours * 2 + 2, provisions = Math.ceil(totalHours / 8) * 2;
    if (!Number.isFinite(distanceKm) || distanceKm <= 0 || totalHours > 48 || distanceKm * 2 > op.fuelKm || op.provisions < provisions || !capable(op) || op.repairAt || op.condition - distanceKm * 2 * .015 < 50 || op.crew.some(c => c.fatigue + distanceKm * 2 * .025 > 80) || op.money < totalHours) return refuse('Round trip lacks range, provisions, capable crew, maintenance or operating funds.');
    const source = state.neighbors.find(n => op.route.endpointCityIds.includes(n.id));
    const listing = source?.listings[good];
    if (!listing) return refuse('No known neighboring supplier.');
    const reserve = Math.max(4, (source.profile.listings[good]?.targetSupply || def.supply) * source.reserveFraction);
    const quantity = Math.floor(Math.min(requested, op.capacity, Math.max(0, listing.supply - reserve)));
    if (!quantity) return refuse('No offered stock above the source city reserve.');
    const purchase = Math.ceil(quantity * quote(def, listing).ask);
    const intercityFreight = Math.ceil(10 + 1.2 * (totalHours + distanceKm * .1 + provisions * (defs.find(d => d.id === 'fieldRation')?.basePrice || 12)));
    const localFreight = Math.ceil(quantity * localUnitFreight);
    return { ok: true, operatorId, sourceId: source.id, good, requested, quantity, purchase, intercityFreight, localFreight, total: purchase + intercityFreight + localFreight,
      at, expiresAt: at + HOUR, distanceKm, legHours, totalHours, provisions };
  }
  function bookImport(state, offered, defs, at, localUnitFreight, cash) {
    const fresh = importOffer(state, offered?.operatorId, offered?.good, offered?.requested, defs, at, localUnitFreight);
    if (!fresh.ok) return fresh;
    const same = ['operatorId', 'sourceId', 'good', 'requested', 'quantity', 'purchase', 'intercityFreight', 'localFreight', 'total', 'distanceKm', 'legHours', 'totalHours', 'provisions'].every(k => fresh[k] === offered[k]);
    if (!same || at > offered.expiresAt) return { ok: false, reason: 'Quote changed or expired. Review and confirm the revised offer.', revised: fresh };
    if (!Number.isFinite(cash) || cash < fresh.total) return { ok: false, reason: 'Insufficient funds for the complete landed price.' };
    const op = state.operators.find(o => o.id === fresh.operatorId), source = state.neighbors.find(n => n.id === fresh.sourceId);
    source.listings[fresh.good].supply -= fresh.quantity; source.treasury += fresh.purchase;
    op.money -= fresh.totalHours; op.provisions -= fresh.provisions;
    const shipment = { id: `wholesale-${state.nextNumber++}`, owner: 'player', operatorId: op.id, vehicleId: op.vehicleId, good: fresh.good, quantity: fresh.quantity,
      sourceId: source.id, destinationId: state.homeId, purchase: fresh.purchase, escrow: fresh.intercityFreight, foodReserve: fresh.provisions,
      dispatchedAt: at, elapsedHours: 0, legHours: fresh.legHours, distanceKm: fresh.distanceKm, travelledKm: 0, pickupHour: fresh.legHours + 1, pickedUp: false,
      deliveryHour: fresh.totalHours, totalHours: fresh.totalHours, delivered: false, returned: false };
    state.shipments.push(shipment); op.shipment = shipment.id; op.location = `outbound:${op.route.id}:0km`; op.reason = ''; op.advertisement = null; op.reportedAt = at;
    ledger(state, at, `${shipment.id}: player-owned import allocated abroad; goods paid, intercity freight escrowed.`);
    return { ok: true, shipment, offer: fresh };
  }
  function ledger(state, at, text) { state.ledger.push({ at, text }); state.ledger = state.ledger.slice(-60); }
  function service(op, homeListings, supplier, defs, at, waiting = false) {
    if (op.shipment && !waiting) return;
    op.crew.forEach(c => { c.fatigue = Math.max(0, c.fatigue - 15); });
    if (op.repairAt && at >= op.repairAt) { op.condition = Math.min(100, op.condition + 25); op.repairAt = null; }
    if (!supplier.routeOpen) return;
    if (op.condition < 85 && !op.repairAt && supplier.partsStock >= 2 && op.money >= 18) {
      supplier.partsStock -= 2; op.money -= 18; op.repairAt = at + 2 * HOUR;
    }
    const fuel = Math.max(0, Math.min(600 - op.fuelKm, supplier.fuelStockKm, op.money / 0.05));
    supplier.fuelStockKm -= fuel; op.fuelKm += fuel; op.money -= fuel * 0.05;
    const rations = homeListings.fieldRation, def = defs.find(d => d.id === 'fieldRation');
    if (rations && def && op.provisions < 16) {
      const price = quote(def, rations).ask, quantity = Math.max(0, Math.min(40 - op.provisions, Math.floor(rations.supply), Math.floor(op.money / price)));
      rations.supply -= quantity; op.provisions += quantity; op.money -= quantity * price;
    }
  }
  function advance(state, now, homeListings, homeSupplier, defs, currentRoutes = null) {
    if (currentRoutes) for (const op of state.operators) {
      const route = currentRoutes.find(r => r.id === op.route.id);
      op.route.supportCapable = Boolean(route?.supportCapable);
      if (route) op.route.continuity = route.continuity;
    }
    while (state.lastAt + HOUR <= now) {
      state.lastAt += HOUR; const at = state.lastAt;
      for (const neighbor of state.neighbors) {
        const support = Carrier.support(neighbor.carrier, at - HOUR);
        Production.advance(neighbor.production, at, neighbor.listings, support.supplier);
        Carrier.advanceSupport(neighbor.carrier, at);
        if (Math.floor(at / (6 * HOUR)) > Math.floor((at - HOUR) / (6 * HOUR))) for (const def of defs) {
          Object.assign(neighbor.listings[def.id], Market.evolve(neighbor.listings[def.id], neighbor.profile.listings[def.id], def, 0.5, 0.5));
        }
      }
      const all = cities(state, homeListings);
      for (const op of state.operators) {
        const reserved = state.shipments.find(s => s.id === op.shipment);
        service(op, homeListings, homeSupplier, defs, at, reserved?.waitingCargo);
        op.reportedAt = at;
        if (op.shipment) {
          const sh = state.shipments.find(s => s.id === op.shipment);
          if (sh.waitingCargo) {
            const trip = exportReadiness(op, state);
            if (!sh.cargoManifest || sh.depotAt > at || !trip) { op.reason = sh.cargoManifest ? 'Export held at depot: departure route, permits or operating resources unavailable.' : 'Convoy reserved; awaiting exact export lot at home depot.'; continue; }
            Object.assign(sh, trip, { waitingCargo: false, dispatchedAt: at, deliveryHour: trip.legHours + 1, pickedUp: true, foodReserve: trip.provisions });
            op.money -= trip.totalHours; op.provisions -= trip.provisions; op.reason = ''; op.location = `outbound:${op.route.id}:0km`;
            continue;
          }
          if (sh.dispatchedAt > at - HOUR) continue; // Never travel the hour preceding a mid-tick booking.
          if (sh.foodReserve < 0.25) { op.reason = 'Convoy held: onboard provisions exhausted; no automatic rescue, replacement or death.'; continue; }
          sh.foodReserve -= 0.25;
          if (!access(op) || !capable(op)) { op.reason = 'Convoy held: route, commercial permission or crew/vehicle unavailable. Existing cargo and settlement records are preserved.'; continue; }
          op.reason = ''; sh.elapsedHours += 1;
          const distance = (Math.min(sh.legHours, sh.elapsedHours) + Math.min(sh.legHours, Math.max(0, sh.elapsedHours - sh.legHours - 1))) * sh.distanceKm / sh.legHours;
          const delta = Math.max(0, distance - sh.travelledKm); sh.travelledKm = distance;
          op.distanceTravelledKm += delta; op.fuelKm = Math.max(0, op.fuelKm - delta); op.condition = Math.max(0, op.condition - delta * 0.015);
          op.crew.forEach(c => { c.fatigue += delta * 0.025; });
          op.location = `${sh.elapsedHours < sh.legHours ? 'outbound' : 'return'}:${op.route.id}:${Math.round(sh.travelledKm)}km`;
          if (sh.elapsedHours >= sh.pickupHour) sh.pickedUp = true;
          if (!sh.delivered && sh.elapsedHours >= sh.deliveryHour) {
            const destination = all.find(c => c.id === sh.destinationId);
            if (sh.owner !== 'player' || sh.kind === 'export') destination.listings[sh.good].supply += sh.quantity;
            if (sh.kind === 'export') { sh.owner = 'buyer'; sh.cargoManifest.owner = 'buyer'; }
            op.money += sh.escrow; sh.escrow = 0; sh.delivered = true; sh.deliveredAt = at;
            ledger(state, at, `${sh.quantity} ${sh.good} delivered to ${sh.destinationId}; ${sh.owner === 'player' ? 'player cargo held separately at depot; intercity freight settled' : 'wholesale settlement completed'}.`);
          }
          if (sh.elapsedHours >= sh.totalHours) { op.provisions += sh.foodReserve; sh.foodReserve = 0; op.shipment = null; op.location = state.homeId; sh.returned = true; sh.returnedAt = at; }
          continue;
        }
        op.advertisement = null;
        if (!access(op)) { op.reason = 'No supported direct corridor with both endpoint commercial approvals.'; continue; }
        const distance = op.route.distanceKm;
        const legHours = Math.max(1, Math.ceil(distance / 38 * (op.route.continuity === 'intermittent' ? 1.55 : op.route.continuity === 'degraded' ? 1.25 : 1)));
        const totalHours = legHours * 2 + 2, provisions = Math.ceil(totalHours / 8) * 2;
        if (!Number.isFinite(distance) || distance <= 0 || totalHours > 48 || distance * 2 > op.fuelKm || op.provisions < provisions || !capable(op) || op.repairAt || op.condition - distance * 2 * 0.015 < 50 || op.crew.some(c => c.fatigue + distance * 2 * 0.025 > 80)) {
          op.reason = 'Round trip infeasible: range, provisions, maintenance, crew or operating resources insufficient.'; continue;
        }
        const endpoint = op.route.endpointCityIds.find(id => id !== state.homeId), partner = all.find(c => c.id === endpoint), home = all[0];
        let best = null;
        for (const [source, dest] of [[partner, home], [home, partner]]) for (const def of defs.filter(d => d.buyable !== false && d.sellable !== false)) {
          const sourceStock = source.listings[def.id], destStock = dest.listings[def.id];
          const reserve = Math.max(4, (source.profile.listings[def.id]?.targetSupply || def.supply) * source.reserveFraction);
          const incoming = state.shipments.filter(s => (s.owner !== 'player' || s.kind === 'export') && !s.failed && !s.delivered && s.destinationId === dest.id && s.good === def.id).reduce((n, s) => n + s.quantity, 0);
          const shortage = Math.max(0, Math.max(12, (dest.profile.listings[def.id]?.targetSupply || def.supply * 0.5) * 0.8) - destStock.supply - incoming);
          const ask = quote(def, sourceStock).ask, bid = quote(def, destStock).bid, wages = totalHours;
          const quantity = Math.floor(Math.min(op.capacity, Math.max(0, sourceStock.supply - reserve), shortage, Math.max(0, op.money - wages) / ask, dest.treasury / bid));
          const profit = quantity * (bid - ask) - wages - distance * 2 * 0.05;
          if (quantity > 0 && profit > 0 && (!best || profit > best.profit)) best = { source, dest, def, ask, bid, quantity, profit, wages };
        }
        if (!best) { op.reason = 'No profitable surplus/shortage pair within local reserves and funded demand.'; continue; }
        const b = best, inbound = b.dest.id === state.homeId;
        op.advertisement = { at, sourceId: b.source.id, destinationId: b.dest.id, good: b.def.id, quantity: b.quantity, unitAsk: b.ask, unitBid: b.bid };
        const purchase = b.quantity * b.ask, escrow = b.quantity * b.bid;
        b.source.listings[b.def.id].supply -= b.quantity; b.source.treasury += purchase; b.dest.treasury -= escrow;
        op.money -= purchase + b.wages; op.provisions -= provisions;
        const sh = { id: `wholesale-${state.nextNumber++}`, operatorId: op.id, vehicleId: op.vehicleId, good: b.def.id, quantity: b.quantity, sourceId: b.source.id, destinationId: b.dest.id,
          purchase, escrow, foodReserve: provisions, dispatchedAt: at, elapsedHours: 0, legHours, distanceKm: distance, travelledKm: 0, pickupHour: inbound ? legHours + 1 : 0, pickedUp: !inbound,
          deliveryHour: inbound ? totalHours : legHours + 1, totalHours, delivered: false, returned: false };
        state.shipments.push(sh); op.shipment = sh.id; op.location = `outbound:${op.route.id}:0km`; op.reason = '';
        ledger(state, at, `${sh.id}: ${sh.quantity} ${sh.good} allocated from ${sh.sourceId}; receiving exchange funds escrowed. Not player-owned stock.`);
      }
      state.homeTreasury = all[0].treasury;
      state.shipments = state.shipments.filter(s => (s.kind === 'export' ? !s.settled : s.owner === 'player' && !s.handedOff) || !s.returned || s.returnedAt >= at - 7 * 24 * HOUR);
    }
    return state;
  }
  function publicView(state) {
    return { neighbors: state.neighbors.map(n => ({ cityId: n.id, name: n.profile.cityName })), operators: state.operators.map(op => ({ id: op.id, corridorId: op.route.id, endpoints: op.route.endpointCityIds,
      permits: copy(op.permit.approvals), reportedAt: op.reportedAt, reason: op.reason, vehicleId: op.vehicleId, crew: op.crew.map(c => c.name), location: op.location,
      advertisement: copy(op.advertisement), shipment: op.shipment ? (() => { const s = state.shipments.find(s => s.id === op.shipment); return { id: s.id, kind: s.kind || '', waitingCargo: Boolean(s.waitingCargo), owner: s.owner || 'npc', good: s.good, quantity: s.quantity, sourceId: s.sourceId, destinationId: s.destinationId, delivered: s.delivered, pickedUp: s.pickedUp, remainingHours: Math.max(0, s.deliveryHour - s.elapsedHours) }; })() : null })) };
  }
  return { create, permit, advance, publicView, quote, importOffer, bookImport, exportLot, exportOffer, bookExport, failExport, receiveExport, settleExport };
});
