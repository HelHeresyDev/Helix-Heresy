(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixLocalMarketProduction = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const HOUR = 3600;
  const RECIPES = [
    { id: 'biomass', family: 'biologicalProductivity', input: 1, output: 1, target: 'exchange' },
    { id: 'fieldRation', family: 'biologicalProductivity', input: 2, output: 1, target: 'exchange' },
    { id: 'stoneBlocks', family: 'constructionStone', input: 1, output: 2, target: 'exchange' },
    { id: 'lumber', family: 'timberFiber', input: 1, output: 2, target: 'exchange' },
    { id: 'bricks', family: 'industrialMinerals', input: 1, output: 2, target: 'exchange' },
    { id: 'steelPanels', family: 'ferrousOre', input: 2, output: 1, target: 'exchange' },
    { id: 'metalParts', family: 'ferrousOre', input: 2, output: 2, target: 'exchange' },
    { id: 'maintenanceParts', family: 'ferrousOre', input: 2, output: 2, target: 'supplier' },
    { id: 'transportFuel', family: 'chemicalFeedstock', input: 1, output: 2, target: 'supplier' }
  ];
  const copy = x => JSON.parse(JSON.stringify(x));
  function create(context, now = 0) {
    const sources = (context?.productionSources || []).filter(s => RECIPES.some(r => r.family === s.family)).map(s => ({ ...copy(s), stock: 0, condition: 100, labour: s.capacity, utilities: context.workshopCapacity,
      // A bounded run-owned extraction allocation, not disclosure of geological reserves.
      remaining: ['biologicalProductivity', 'timberFiber'].includes(s.family) ? null : Math.ceil(2000 * s.capacity), produced: 0 }));
    return { cityId: context?.cityId || '', lastAt: now, sources, inputs: {}, workshops: RECIPES.filter(r => sources.some(s => s.family === r.family)).map(r => ({ ...r, stock: 0, condition: 100, labour: 1, utilities: context.workshopCapacity, progress: 0, produced: 0 })),
      trucks: ['Oren Pike', 'Lina Ash'].map((name, i) => ({ id: `${context?.cityId || 'unbound'}:producer-truck-${i + 1}`, capacity: 24, fuelKm: 240, condition: 100, driver: { id: `${context?.cityId || 'unbound'}:producer-driver-${i + 1}`, name, health: 100, status: 'alive', fatigue: 0 }, shipment: null, repairAt: null })),
      warehouseCaps: Object.fromEntries(Object.entries(context?.listings || {}).map(([id, listing]) => [id, Math.max(192, listing.targetSupply * 4)])),
      depotFuelKm: 1200, depotParts: 8, shipments: [], nextNumber: 1, cursor: 0, receipts: [], reason: '' };
  }
  const capable = truck => truck.condition >= 50 && truck.driver.health >= 50 && truck.driver.status === 'alive';
  function record(state, at, cargo, quantity, target) {
    state.receipts.push({ at, cargo, quantity, target }); state.receipts = state.receipts.slice(-60);
  }
  function service(state, supplier, at) {
    // The city producer depot and support supplier exchange real local stores.
    // Replenishment transfers no fuel from an inaccessible remote source.
    if (supplier.routeOpen && !supplier.shipment && !supplier.repairAt) {
      if (supplier.vehicle.condition < 85 && supplier.partsStock >= 2) {
        supplier.partsStock -= 2; supplier.repairAt = at + 2 * HOUR;
      }
      const fuel = Math.min(Math.max(0, 400 - supplier.operatingFuelKm), supplier.fuelStockKm);
      supplier.fuelStockKm -= fuel; supplier.operatingFuelKm += fuel;
    }
    // Producer vehicles are based at the same municipal distribution compound as
    // the support supplier. Local transfers consume its real stores; no remote
    // pickup or special emergency fuel is invented when their reserve runs low.
    if (supplier.routeOpen && state.depotFuelKm < 200) {
      const fuel = Math.min(1200 - state.depotFuelKm, supplier.fuelStockKm);
      supplier.fuelStockKm -= fuel; state.depotFuelKm += fuel;
    }
    if (supplier.routeOpen && state.depotParts < 4) {
      const parts = Math.min(8 - state.depotParts, supplier.partsStock);
      supplier.partsStock -= parts; state.depotParts += parts;
    }
    for (const truck of state.trucks) {
      if (truck.shipment) continue;
      truck.driver.fatigue = Math.max(0, truck.driver.fatigue - 15);
      if (truck.repairAt && at >= truck.repairAt) { truck.condition = Math.min(100, truck.condition + 25); truck.repairAt = null; }
      if (!truck.repairAt && truck.condition < 85 && state.depotParts >= 2) { state.depotParts -= 2; truck.repairAt = at + 2 * HOUR; }
      const fuel = Math.min(Math.max(0, 240 - truck.fuelKm), state.depotFuelKm);
      truck.fuelKm += fuel; state.depotFuelKm -= fuel;
    }
  }
  function deliver(state, shipment, listings, supplier, at) {
    if (shipment.target === 'workshops') state.inputs[shipment.cargo] = (state.inputs[shipment.cargo] || 0) + shipment.quantity;
    else if (shipment.target === 'exchange') {
      if (listings[shipment.cargo]) listings[shipment.cargo].supply += shipment.quantity;
    } else if (shipment.cargo === 'transportFuel') {
      // Each sealed fuel lot represents twenty vehicle-kilometres. One quarter
      // services the producer depot; the rest becomes supplier stock, never both.
      const fuel = shipment.quantity * 20, depot = Math.min(fuel / 4, Math.max(0, 1200 - state.depotFuelKm));
      state.depotFuelKm += depot; supplier.fuelStockKm += fuel - depot;
    } else {
      const depot = Math.min(Math.floor(shipment.quantity / 4), Math.max(0, 8 - state.depotParts));
      state.depotParts += depot; supplier.partsStock += shipment.quantity - depot;
    }
    shipment.delivered = true;
    record(state, at, shipment.cargo, shipment.quantity, shipment.target);
  }
  function tick(state, listings, supplier, at) {
    service(state, supplier, at);
    for (const source of state.sources) {
      if (source.condition < 50 || source.utilities <= 0 || source.labour <= 0) continue;
      const amount = Math.min(Math.max(0, 96 - source.stock), source.capacity * Math.min(1, source.labour) * source.condition / 100 * 2, source.remaining ?? Infinity);
      source.stock += amount; source.produced += amount;
      if (source.remaining !== null) source.remaining -= amount;
    }
    for (let i = 0; i < state.workshops.length; i++) {
      const w = state.workshops[(i + state.cursor) % state.workshops.length];
      if (w.stock >= 96 || w.utilities <= 0 || w.labour <= 0 || w.condition < 50) continue;
      if ((state.inputs[w.family] || 0) < w.input) continue;
      w.progress = Math.min(4, w.progress + w.utilities * w.labour * w.condition / 100);
      const batches = Math.min(Math.floor(w.progress), Math.floor((state.inputs[w.family] || 0) / w.input), Math.floor((96 - w.stock) / w.output));
      state.inputs[w.family] = (state.inputs[w.family] || 0) - batches * w.input;
      w.stock += batches * w.output; w.produced += batches * w.output; w.progress -= batches;
    }
    // Receipts at this hour boundary cannot retroactively feed the preceding
    // hour's production work. They become inputs for the next hour.
    for (const truck of state.trucks.filter(t => t.shipment)) {
      const sh = state.shipments.find(s => s.id === truck.shipment), source = state.sources.find(s => s.id === sh.sourceId);
      if (!capable(truck) || !sh.route.open || (source && !source.route.open) || (sh.target === 'supplier' && !supplier.routeOpen)) {
        if (sh.pickupAt > at - HOUR) sh.pickupAt += HOUR;
        sh.arriveAt += HOUR; sh.returnAt += HOUR; sh.reason = 'Shipment delayed: saved route, vehicle or driver unavailable.'; continue;
      }
      sh.reason = '';
      if (!sh.delivered && at >= sh.arriveAt) deliver(state, sh, listings, supplier, at);
      if (at >= sh.returnAt) { truck.shipment = null; sh.returned = true; }
    }
    const candidates = [
      ...state.sources.map(s => ({ entry: s, cargo: s.family, target: 'workshops', sourceId: s.id, route: s.route })),
      ...state.workshops.map(w => ({ entry: w, cargo: w.id, target: w.target, sourceId: '', route: { open: true, distanceKm: 4, cellIds: [], mode: 'groundConvoy' } }))
    ];
    state.reason = '';
    for (const truck of state.trucks.filter(t => !t.shipment && !t.repairAt && capable(t))) {
      for (let i = 0; i < candidates.length; i++) {
        const index = (state.cursor + i) % candidates.length, c = candidates[index], distance = c.route.distanceKm * 2;
        let quantity = Math.min(truck.capacity, Math.floor(c.entry.stock));
        const inbound = state.shipments.filter(s => !s.delivered && s.target === c.target && s.cargo === c.cargo).reduce((n, s) => n + s.quantity, 0);
        if (c.target === 'exchange') quantity = Math.min(quantity, Math.floor(Math.max(0, (state.warehouseCaps[c.cargo] || 192) - (listings[c.cargo]?.supply || 0) - inbound)));
        if (c.target === 'supplier') quantity = Math.min(quantity, Math.floor(Math.max(0, c.cargo === 'transportFuel' ? (16000 - supplier.fuelStockKm) / 20 - inbound : 160 - supplier.partsStock - inbound)));
        if (!quantity || !c.route.open || truck.fuelKm < distance || truck.condition - distance * 0.02 < 50 || truck.driver.fatigue + distance * 0.04 > 80) continue;
        if (c.target === 'supplier' && !supplier.routeOpen) continue;
        if (c.target === 'workshops' && (state.inputs[c.cargo] || 0) + state.shipments.filter(s => !s.delivered && s.target === 'workshops' && s.cargo === c.cargo).reduce((n, s) => n + s.quantity, 0) + quantity > 192) continue;
        c.entry.stock -= quantity;
        truck.fuelKm -= distance; truck.condition -= distance * 0.02; truck.driver.fatigue += distance * 0.04;
        const legTime = Math.max(HOUR, Math.ceil(c.route.distanceKm / 30) * HOUR);
        const sh = { id: `producer-shipment-${state.nextNumber++}`, sourceId: c.sourceId, cargo: c.cargo, target: c.target, quantity, route: copy(c.route), truckId: truck.id, departedAt: at,
          // Extraction pickups travel out empty and return loaded. City workshop
          // deliveries travel out loaded and retain the truck for its empty return.
          pickupAt: c.target === 'workshops' ? at + legTime : at, arriveAt: at + legTime * (c.target === 'workshops' ? 2 : 1), returnAt: at + legTime * 2, delivered: false, returned: false, reason: '' };
        state.shipments.push(sh); truck.shipment = sh.id; state.cursor = index + 1; break;
      }
    }
    if (state.trucks.every(t => t.shipment || t.repairAt || !capable(t) || t.fuelKm < 8 || t.driver.fatigue >= 80)) state.reason = 'Producer transport busy or awaiting fuel, maintenance or rested drivers.';
    state.shipments = state.shipments.filter(s => !s.returned || s.returnAt >= at - 24 * HOUR);
  }
  function advance(state, now, listings, supplier) {
    while (state.lastAt + HOUR <= now) { state.lastAt += HOUR; tick(state, listings, supplier, state.lastAt); }
    return state;
  }
  function status(state, listingId) {
    const workshop = state?.workshops.find(w => w.id === listingId);
    if (!workshop) return 'No supported local producer; remaining merchant stock is finite.';
    if (state.shipments.some(s => s.cargo === listingId && !s.delivered && s.reason)) return 'Shipment delayed; allocated goods remain in saved carrier custody.';
    if (state.shipments.some(s => s.cargo === listingId && !s.delivered)) return 'Incoming allocated shipment; stock becomes available only after delivery.';
    if (workshop.condition < 50 || workshop.utilities <= 0 || workshop.labour <= 0) return 'Production interrupted: facility, labour or utilities unavailable.';
    if (workshop.stock >= 1) return 'Produced goods awaiting finite local transport.';
    if (state.sources.filter(s => s.family === workshop.family).every(s => s.remaining === 0 && s.stock < 1) && !(state.inputs[workshop.family] >= workshop.input)) return 'Local extraction allocation exhausted; no automatic deposit reset.';
    if ((state.inputs[workshop.family] || 0) < workshop.input) return 'Awaiting physically delivered production inputs.';
    return 'Local workshop processing delivered inputs.';
  }
  return { HOUR, RECIPES, create, advance, status };
});
