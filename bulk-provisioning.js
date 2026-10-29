(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./city-rule') : root.HelixCityRule,
    node ? require('./strategic-world') : root.HelixStrategicWorld);
  if (node) module.exports = api;
  if (root) root.HelixBulkProvisioning = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Rule, World) {
  'use strict';
  const DAY = 86400, SHIFT = 28800, REST = 57600, SIGN = 120, FUEL_KG = 20;
  const copy = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const finite = n => Number.isFinite(n) && n >= 0;
  const bound = (a, b) => a && b && a.worldId === b.worldId && a.runId === b.runId;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const itinerary = r => r && ({ id: r.id, originId: r.originId, destinationId: r.destinationId, distanceKm: r.distanceKm,
    stops: r.stops?.map(s => ({ id: s.id, populationSourceId: s.populationSourceId, km: s.km, sponsorCityIds: s.sponsorCityIds })) });
  const sameItinerary = (a, b) => validRoute(a) && validRoute(b) && same(itinerary(a), itinerary(b));
  const TERMS = 'Civilian grain supply between these two existing governed cities only. Original farm carriers are exclusively assigned until their actual return. Both sponsors retain joint stronghold responsibility and local administration. Supplied sixteen-hour rests and physically deposited fuel preserve original shift and tank limits. Price ceilings, prepaid funds, source reserves, actual staff and route access constrain every purchase. Paid cargo and the funded return continue after cancellation; no army, general fort access, map release, immunity or perpetual supply.';
  function routeFromWorld(map, routeId, originId) {
    const r = map?.routeGraph?.routes?.find(r => r.id === routeId), state = map?.strategicPlayableSettlementState;
    const current = state?.routeRows.find(r => r.corridorId === routeId);
    if (!r?.cellPath?.length || !current || !r.endpointIds.includes(originId)) return null;
    const cells = r.cellPath.slice(), first = map.humanGeography.cities.find(c => c.id === originId)?.cellId;
    if (cells[0] !== first) cells.reverse();
    if (cells[0] !== first) return null;
    const distances = [0];
    for (let i = 1; i < cells.length; i++) {
      const a = World.cellIndex(cells[i - 1]), b = World.cellIndex(cells[i]);
      if (!World.topologyForMap(map).neighbors[a]?.includes(b)) return null;
      distances.push(distances.at(-1) + World.greatCircleDistanceKm(map, a, b));
    }
    const stops = state.strongholdRows.filter(f => f.corridorId === r.id).map(f => {
      const index = cells.indexOf(f.cellId);
      if (index <= 0 || index >= cells.length - 1 || f.sponsorCityIds?.length !== 2
        || !r.endpointIds.every(id => f.sponsorCityIds.includes(id))) return null;
      return { id: f.strongholdId, populationSourceId: f.assetId, population: f.currentPopulation,
        name: f.name, cellId: f.cellId, km: distances[index], sponsorCityIds: copy(f.sponsorCityIds),
        usable: f.currentPopulation >= 8 && f.physicalCondition !== 'ruined'
          && !['failed', 'fragile'].includes(f.services?.transport) };
    });
    if (stops.some(s => !s)) return null;
    const result = { id: r.id, originId, destinationId: r.endpointIds.find(id => id !== originId), distanceKm: distances.at(-1),
      supportCapable: current.supportCapable, continuity: current.continuity, stops: stops.sort((a, b) => a.km - b.km) };
    return validRoute(result) ? result : null;
  }
  function validRoute(r) {
    return Boolean(r?.id && r.originId && r.destinationId && r.originId !== r.destinationId && finite(r.distanceKm) && r.distanceKm > 0
      && Array.isArray(r.stops) && r.stops.length && new Set(r.stops.map(s => s.id)).size === r.stops.length
      && r.stops.every((s, i) => s.id && s.populationSourceId && Number.isSafeInteger(s.population) && s.population >= 0
        && finite(s.km) && s.km > (r.stops[i - 1]?.km || 0) && s.km < r.distanceKm
        && s.sponsorCityIds?.length === 2 && [r.originId, r.destinationId].every(id => s.sponsorCityIds.includes(id))));
  }
  function create(binding, at) {
    return binding?.worldId && binding.runId && finite(at) ? { ...copy(binding), lastAt: at, serial: 0,
      contracts: [], stations: [], stationOriginals: [], missions: [], receipts: [], reports: [], quote: null, job: null } : null;
  }
  const validOffer = q => Boolean(q?.id && q.farmId && validRoute(q.route) && settings(q.limits)
    && finite(q.at) && finite(q.expiresAt) && q.expiresAt >= q.at && Number.isSafeInteger(q.bodyEpoch) && q.bodyEpoch >= 0
    && [q.source, q.target].every(s => s?.ruleId && s.handoverId && s.populationSourceId));
  function normalize(v) {
    if (!v?.worldId || !v.runId || !finite(v.lastAt) || !Number.isSafeInteger(v.serial)
      || !['contracts', 'stations', 'stationOriginals', 'missions', 'receipts', 'reports'].every(k => Array.isArray(v[k]))) return null;
    if (v.quote && !validOffer(v.quote)) return null;
    if (v.job && (!v.job.id || !validOffer(v.job.quote) || !finite(v.job.progress) || v.job.progress >= SIGN
      || !finite(v.job.deposit) || !finite(v.job.bodyEpoch) || !v.job.cell)) return null;
    if (new Set(v.contracts.map(c => c.id)).size !== v.contracts.length || new Set(v.missions.map(m => m.id)).size !== v.missions.length
      || new Set(v.stations.map(s => s.id)).size !== v.stations.length || new Set(v.stationOriginals).size !== v.stationOriginals.length) return null;
    if (v.contracts.some(c => !validOffer(c) || !finite(c.balance) || !finite(c.deposited)
      || !finite(c.spent) || !finite(c.refunded) || Math.abs(c.deposited - c.spent - c.refunded - c.balance) > 1e-5)
      || v.stations.some(s => !s.id || !s.populationSourceId || !v.stationOriginals.includes(s.id) || !finite(s.workSeconds) || !finite(s.fuelReceivedKm)
        || !finite(s.fuelDispensedKm) || !Array.isArray(s.custody)
        || s.custody.some(l => !l.missionId || !finite(l.fuelKm))
        || Math.abs(s.fuelReceivedKm - s.fuelDispensedKm - s.custody.reduce((n, l) => n + l.fuelKm, 0)) > 1e-5)
      || v.missions.some(m => !m.id || !m.contractId || !m.farmId || !['loading', 'moving', 'station', 'unloading', 'returned'].includes(m.phase)
        || !['km', 'distanceKm', 'foodKg', 'originalFoodKg', 'deliveredKg', 'crewFoodKg', 'crewWaterLiters', 'tankKm', 'fuelCargoKm', 'dutySeconds', 'restProgress', 'serviceProgress', 'health', 'capacityKg', 'carriers', 'drivers', 'paid', 'lastAt', 'returnAllowance'].every(k => finite(m[k]))
        || !['city', 'stronghold'].includes(m.at?.kind) || !m.at.id
        || !v.contracts.some(c => c.id === m.contractId && c.farmId === m.farmId && c.route.originId === m.sourceCityId && c.route.destinationId === m.destinationCityId
          && c.route.stops.every(s => v.stationOriginals.includes(s.id)))
        || !finite(m.tankCapacityKm) || !Number.isFinite(m.speedKph) || m.speedKph <= 0 || m.distanceKm <= 0
        || ![1, 2].includes(m.crewPerVehicle) || m.dutySeconds > SHIFT + 1e-5 || !Number.isSafeInteger(m.drivers) || !Number.isSafeInteger(m.carriers)
        || m.drivers < m.carriers || m.drivers > m.carriers * 2 || m.km > m.distanceKm || m.tankKm > m.tankCapacityKm + 1e-5
        || !Array.isArray(m.driverIds) || m.driverIds.some(id => typeof id !== 'string' || !id) || m.driverIds.length !== m.drivers || new Set(m.driverIds).size !== m.drivers)) return null;
    return copy(v);
  }
  function rebind(v, from, to) { const s = normalize(v); return bound(s, from) && to?.worldId && to.runId ? { ...s, ...copy(to) } : null; }
  function settings(v) { return v && ['thresholdDays', 'targetDays', 'quantityKg', 'maxUnitPrice', 'maxTripSpend'].every(k => Number.isFinite(v[k]) && v[k] > 0)
    && v.thresholdDays <= v.targetDays && v.targetDays <= 4 && Number.isSafeInteger(v.quantityKg) && v.quantityKg <= 1000000; }
  const ruleOf = (entries, cityId) => entries.find(e => e.rule.source.cityId === cityId);
  function authority(e, contexts) { const c = e && contexts(e); return Boolean(c && Rule.authority(e.rule, e.succession, e.people, c) && c.institutionsAvailable); }
  function sourceCurrent(e, s) { return e && e.rule.id === s.ruleId && e.rule.handoverId === s.handoverId
    && e.rule.source.populationSourceId === s.populationSourceId; }
  const proof = e => ({ ruleId: e.rule.id, handoverId: e.rule.handoverId, populationSourceId: e.rule.source.populationSourceId });
  function offer(book, entries, contexts, route, farmId, limits, c, at) {
    const source = ruleOf(entries, route?.originId), target = ruleOf(entries, route?.destinationId), f = source?.rule.farms.find(f => f.id === farmId);
    if (!book || !validRoute(route) || !settings(limits) || !source || !target || !bound(book, source.rule) || !bound(book, target.rule)
      || !Rule.contact(c) || c.cityId !== route.originId || !authority(source, contexts) || !authority(target, contexts)
      || !source.rule.report || !target.rule.report || !f || f.drivers < 1 || f.carriers < 1 || f.bulkAssignment
      || !['groundConvoy', 'mixedFleet'].includes(f.mode) || book.job || at !== book.lastAt
      || book.contracts.some(q => q.farmId === farmId && q.route.originId === route.originId && q.cancelledAt == null)) return null;
    const points = [0, ...route.stops.map(s => s.km), route.distanceKm], tank = source.rule.source.farms.find(s => s.satelliteId === f.id)?.transport?.rangeKm || 600;
    if (!route.supportCapable || route.continuity === 'closed' || route.stops.some(s => !s.usable || s.population < f.drivers + 4)
      || points.slice(1).some((v, i) => (v - points[i]) / f.speedKph * 3600 > SHIFT * Math.min(2, f.drivers) || v - points[i] > tank)) return null;
    // A received commercial offer gives only this itinerary and scope, not its
    // private cell path, a general resource survey or arbitrary fort access.
    book.quote = { id: `bulk-offer:${++book.serial}`, at, expiresAt: at + DAY, bodyEpoch: c.bodyEpoch,
      route: copy(route), farmId, limits: copy(limits), source: proof(source), target: proof(target), terms: TERMS };
    return copy(book.quote);
  }
  function begin(book, entries, contexts, c, expected, deposit, wallet, at) {
    const q = book?.quote, source = q && ruleOf(entries, q.route.originId), target = q && ruleOf(entries, q.route.destinationId);
    if (!q || book.job || !same(q, expected) || at > q.expiresAt || c.bodyEpoch !== q.bodyEpoch || !Rule.contact(c)
      || c.cityId !== q.route.originId || !sourceCurrent(source, q.source) || !sourceCurrent(target, q.target)
      || !authority(source, contexts) || !authority(target, contexts) || source.rule.operatorServiceAssignment
      || source.rule.command || source.rule.recharge || source.rule.foodDelivery
      || source.rule.operatorWorkSeconds < SIGN || !finite(deposit) || deposit <= 0 || wallet.money < deposit) return false;
    const id = `bulk-contract-work:${++book.serial}`;
    book.job = { id, quote: copy(q), at, lastAt: at, progress: 0, deposit, bodyEpoch: c.bodyEpoch, cell: copy(c.cell), wasReady: true };
    source.rule.operatorServiceAssignment = id; return true;
  }
  function cancelAttendance(book, entries) {
    const j = book?.job; if (!j) return false;
    const s = ruleOf(entries, j.quote.route.originId)?.rule;
    if (s?.operatorServiceAssignment === j.id) delete s.operatorServiceAssignment;
    book.job = null; return true;
  }
  function station(book, stop) {
    let s = book.stations.find(s => s.id === stop.id);
    if (!s && book.stationOriginals.includes(stop.id)) return null;
    if (!s) { s = { id: stop.id, populationSourceId: stop.populationSourceId, sponsorCityIds: copy(stop.sponsorCityIds),
      custodianId: `${stop.id}:original-civilian-logistics-custodian`, status: 'alive', health: 100,
      workSeconds: SHIFT, assignment: null, willing: true, capacity: Math.min(64, Math.floor(stop.population / 4)),
      fuelReceivedKm: 0, fuelDispensedKm: 0, custody: [], receipts: [] }; book.stations.push(s); book.stationOriginals.push(s.id); }
    return s.populationSourceId === stop.populationSourceId && same(s.sponsorCityIds, stop.sponsorCityIds) ? s : null;
  }
  function quoteTrip(contract, source, target, f) {
    const firstLeg = contract.route.stops[0].km / f.speedKph * 3600;
    // Original ground-carrier cabs have a driver and one relief seat. Relief
    // drivers come from this SAME resident operator allotment, so fewer trucks
    // travel; 75 kg of payload is reserved for each additional body.
    const crewPerVehicle = Math.min(2, f.drivers), carriers = Math.min(f.carriers, Math.floor(f.drivers / crewPerVehicle));
    const drivers = carriers * crewPerVehicle, capacityKg = f.capacityKg * carriers / f.carriers;
    if (!source.rule.plan || !target.rule.plan || f.trip || f.bulkAssignment || drivers < 1 || carriers < 1
      || f.dutySeconds / f.drivers < firstLeg / crewPerVehicle) return null;
    const ownReserve = source.rule.dailyKg * 2, available = Math.max(0, source.rule.foodKg - ownReserve);
    const need = Math.max(0, target.rule.dailyKg * contract.limits.targetDays - target.rule.foodKg);
    const unitPrice = 2 * Math.max(.5, Math.min(4, source.rule.dailyKg / Math.max(1, available)));
    const days = Math.ceil(2 * contract.route.distanceKm / f.speedKph / 8) + 2;
    const crewFoodKg = drivers * .5 * days, crewWaterLiters = drivers * 2 * days, passengerKg = (drivers - carriers) * 75;
    const quantity = Math.floor(Math.min(contract.limits.quantityKg, need, available - crewFoodKg,
      capacityKg - crewFoodKg - crewWaterLiters - passengerKg - 400));
    if (quantity <= 0 || unitPrice > contract.limits.maxUnitPrice || source.rule.waterLiters < crewWaterLiters) return null;
    const freight = Math.ceil(drivers * days * 4 + contract.route.distanceKm * carriers * .1);
    return { quantity, unitPrice, freight, crewFoodKg, crewWaterLiters, passengerKg, days, carriers, drivers, capacityKg, crewPerVehicle };
  }
  function dispatch(book, contract, entries, contexts, hooks, at) {
    const source = ruleOf(entries, contract.route.originId), target = ruleOf(entries, contract.route.destinationId);
    if (!sourceCurrent(source, contract.source) || !sourceCurrent(target, contract.target)
      || !authority(source, contexts) || !authority(target, contexts) || contract.cancelledAt != null
      || target.rule.foodKg >= target.rule.dailyKg * contract.limits.thresholdDays
      || book.missions.some(m => m.contractId === contract.id && m.phase !== 'returned')) return false;
    const current = hooks.route(contract.route), f = source.rule.farms.find(f => f.id === contract.farmId);
    if (!sameItinerary(current, contract.route) || !current.supportCapable || current.continuity === 'closed') return false;
    const q = f && quoteTrip(contract, source, target, f); if (!q) return false;
    const fuel = hooks.fuel(source.rule.source.cityId), destinationFuel = hooks.fuel(target.rule.source.cityId);
    if (!fuel || !destinationFuel || !finite(fuel.stock()) || !finite(destinationFuel.stock())) return false;
    const required = 2 * contract.route.distanceKm * q.carriers, existing = f.fuelKm * q.carriers / f.carriers;
    const returnedFuel = Math.min(f.returnedBulkFuelKm || 0, Math.max(0, required - existing));
    const cargoFuel = Math.min(Math.max(0, 8000 - returnedFuel), Math.max(0, required - existing - returnedFuel), Math.floor(fuel.stock() / 20) * 20);
    const futureFuel = Math.max(0, required - existing - cargoFuel - returnedFuel), fuelPrice = fuel.price(), destinationPrice = destinationFuel.price();
    const budget = q.quantity * q.unitPrice + q.freight + cargoFuel * fuelPrice + futureFuel * destinationPrice;
    const tankCapacityKm = (source.rule.source.farms.find(s => s.satelliteId === f.id)?.transport?.rangeKm || 600) * q.carriers;
    const initialRefill = Math.min(Math.max(0, tankCapacityKm - existing), cargoFuel + returnedFuel);
    const loadingSeconds = Math.ceil(q.quantity / 50) * 2 + Math.ceil((cargoFuel + returnedFuel) / 20) * 2;
    if (![fuelPrice, destinationPrice].every(n => finite(n) && n > 0) || futureFuel > destinationFuel.stock()
      || budget > contract.limits.maxTripSpend || contract.balance < budget || (cargoFuel + returnedFuel) / FUEL_KG + q.quantity + q.crewFoodKg + q.crewWaterLiters + q.passengerKg > q.capacityKg) return false;
    if (source.rule.operatorServiceAssignment || source.rule.operatorWorkSeconds < loadingSeconds
      || (existing + initialRefill) / q.carriers < current.stops[0].km) return false;
    const stations = current.stops.map(stop => station(book, stop));
    if (stations.some((s, i) => !s || !current.stops[i].usable || s.status !== 'alive' || s.health < 50 || !s.willing
      || s.capacity < q.drivers || s.assignment || s.workSeconds < 120)) return false;
    // Payment removes actual food and depot fuel; unused return-fuel allowance
    // is held by this original mission and refunded only after physical return.
    if (!fuel.take(cargoFuel, cargoFuel * fuelPrice)) return false;
    f.returnedBulkFuelKm = Math.max(0, (f.returnedBulkFuelKm || 0) - returnedFuel);
    const id = `bulk-convoy:${++book.serial}`, spent = q.quantity * q.unitPrice + q.freight + cargoFuel * fuelPrice;
    source.rule.foodKg -= q.quantity + q.crewFoodKg; source.rule.waterLiters -= q.crewWaterLiters;
    source.rule.exportedFoodKg = (source.rule.exportedFoodKg || 0) + q.quantity;
    source.rule.convoyProvisionsKg = (source.rule.convoyProvisionsKg || 0) + q.crewFoodKg;
    source.rule.convoyWaterLiters = (source.rule.convoyWaterLiters || 0) + q.crewWaterLiters;
    source.rule.foodSaleRevenue = (source.rule.foodSaleRevenue || 0) + q.quantity * q.unitPrice;
    f.bulkFreightRevenue = (f.bulkFreightRevenue || 0) + q.freight;
    contract.balance -= budget; contract.spent += budget;
    const m = { id, contractId: contract.id, sourceCityId: contract.route.originId, destinationCityId: contract.route.destinationId,
      farmId: f.id, sourceRuleId: source.rule.id, sourceHandoverId: source.rule.handoverId, targetRuleId: target.rule.id,
      phase: 'loading', direction: 'outbound', km: 0, distanceKm: current.distanceKm, stopIndex: 0, at: copy({ kind: 'city', id: current.originId }),
      capacityKg: q.capacityKg, carriers: q.carriers, drivers: q.drivers, crewPerVehicle: q.crewPerVehicle, passengerKg: q.passengerKg, speedKph: f.speedKph,
      driverIds: Array.from({ length: q.drivers }, (_, i) => `${f.id}:original-aggregate-driver:${i + 1}`),
      health: 100, dutySeconds: f.dutySeconds / f.drivers, tankKm: existing, initialTankKm: existing,
      tankCapacityKm, loadingSeconds, reusedReturnedFuelKm: returnedFuel,
      fuelCargoKm: cargoFuel + returnedFuel, purchasedFuelKm: cargoFuel, spentFuelKm: 0, crewFoodKg: q.crewFoodKg, crewWaterLiters: q.crewWaterLiters,
      foodKg: q.quantity, originalFoodKg: q.quantity, deliveredKg: 0, paid: budget, spent, returnAllowance: futureFuel * destinationPrice,
      maxFuelPrice: destinationPrice, restProgress: 0, serviceProgress: 0, lastAt: at, createdAt: at,
      grainPaid: q.quantity * q.unitPrice, freightPaid: q.freight,
      restoredDutySeconds: 0, restCount: 0, hold: '', receipts: [] };
    f.fuelKm -= existing; f.dutySeconds -= m.dutySeconds * q.drivers;
    f.capacityKg -= q.capacityKg; f.carriers -= q.carriers; f.drivers -= q.drivers;
    f.bulkAssignment = id; f.lastDepartureAt = at;
    source.rule.operatorServiceAssignment = id;
    book.missions.push(m); return true;
  }
  function replenish(m, book, contract, hooks, at) {
    const deficit = Math.max(0, m.tankCapacityKm - m.tankKm);
    if (m.at.kind === 'stronghold') {
      const stop = contract.route.stops.find(s => s.id === m.at.id), s = stop && station(book, stop);
      if (!s || s.assignment !== m.id || s.workSeconds <= 0) return false;
      const amount = Math.min(deficit, m.fuelCargoKm);
      if (amount > 0) {
        // Actual arrival and unloading enter exact mission-owned fort custody
        // before the same finite fuel is dispensed into original tanks.
        const lot = { missionId: m.id, fuelKm: amount }; s.custody.push(lot); s.fuelReceivedKm += amount; m.fuelCargoKm -= amount;
        lot.fuelKm -= amount; s.fuelDispensedKm += amount; m.tankKm += amount;
        s.receipts.push({ at, missionId: m.id, receivedKm: amount, dispensedKm: amount });
      }
    } else {
      const carried = Math.min(deficit, m.fuelCargoKm); m.fuelCargoKm -= carried; m.tankKm += carried;
      if (m.direction === 'returning' && m.at.id === m.destinationCityId) {
        const needed = Math.max(0, (m.distanceKm * m.carriers) - m.tankKm - m.fuelCargoKm), fuel = hooks.fuel(m.destinationCityId);
        if (needed > 1e-7) {
          const price = fuel?.price(), cost = needed * price;
          if (!fuel || !finite(price) || price <= 0 || price > m.maxFuelPrice || cost > m.returnAllowance + 1e-6
            || (m.fuelCargoKm + needed) / FUEL_KG + m.passengerKg + m.crewFoodKg + m.crewWaterLiters + m.foodKg > m.capacityKg
            || !fuel.take(needed, cost)) return false;
          m.fuelCargoKm += needed; m.purchasedFuelKm += needed; m.returnAllowance = Math.max(0, m.returnAllowance - cost); m.spent += cost;
          const refill = Math.min(m.fuelCargoKm, m.tankCapacityKm - m.tankKm); m.fuelCargoKm -= refill; m.tankKm += refill;
        }
      }
    }
    return true;
  }
  function tickMission(book, m, entries, contexts, hooks, dt, at, workBudgets) {
    if (m.phase === 'returned') return;
    const contract = book.contracts.find(c => c.id === m.contractId), source = ruleOf(entries, m.sourceCityId), target = ruleOf(entries, m.destinationCityId);
    const farm = source?.rule.farms.find(f => f.id === m.farmId);
    m.lastAt = at; m.hold = '';
    if (!contract || !source || !target || farm?.bulkAssignment !== m.id || source.rule.id !== m.sourceRuleId || source.rule.handoverId !== m.sourceHandoverId) { m.hold = 'Original account or exclusive fleet custody unavailable.'; return; }
    const food = Math.min(m.crewFoodKg, dt * m.drivers * .5 / DAY), water = Math.min(m.crewWaterLiters, dt * m.drivers * 2 / DAY);
    m.crewFoodKg -= food; m.crewWaterLiters -= water;
    m.crewAteKg = (m.crewAteKg || 0) + food; m.crewDrankLiters = (m.crewDrankLiters || 0) + water;
    if (m.crewFoodKg <= 1e-7 || m.crewWaterLiters <= 1e-7 || m.health < 50) { m.hold = 'Original crew lacks carried provisions or capacity; no progress or free rescue.'; return; }
    const r = hooks.route(contract.route);
    if (!sameItinerary(r, contract.route) || !r.supportCapable || r.continuity === 'closed' || hooks.allowed?.(contract, m) === false) { m.hold = 'Actual corridor or consignment permission unavailable.'; return; }
    if (m.phase === 'loading') {
      if (!contexts(source).sourceCurrent || !contexts(source).institutionsAvailable || source.rule.operatorServiceAssignment !== m.id) {
        m.hold = 'Original origin loading staff unavailable; paid cargo remains at its dock.'; return;
      }
      const work = Math.min(workBudgets.get(source.rule.id) || 0, m.loadingSeconds - m.serviceProgress, source.rule.operatorWorkSeconds);
      workBudgets.set(source.rule.id, (workBudgets.get(source.rule.id) || 0) - work);
      source.rule.operatorWorkSeconds -= work; m.serviceProgress += work;
      if (m.serviceProgress >= m.loadingSeconds) {
        const refill = Math.min(m.fuelCargoKm, Math.max(0, m.tankCapacityKm - m.tankKm));
        m.fuelCargoKm -= refill; m.tankKm += refill; m.phase = 'moving'; m.serviceProgress = 0; m.departedAt = at;
        delete source.rule.operatorServiceAssignment;
      }
      return;
    }
    if (m.phase === 'moving') {
      const next = m.direction === 'outbound' ? r.stops.find(s => s.km > m.km + 1e-7) : r.stops.slice().reverse().find(s => s.km < m.km - 1e-7);
      const end = next?.km ?? (m.direction === 'outbound' ? r.distanceKm : 0), distance = Math.abs(end - m.km);
      const work = Math.min(dt, distance / m.speedKph * 3600, m.dutySeconds * m.crewPerVehicle, m.tankKm / m.carriers / m.speedKph * 3600);
      if (work <= 1e-7) { m.hold = 'Original shift or tank exhausted before a supported stop.'; return; }
      const km = work * m.speedKph / 3600; m.km += km * (m.direction === 'outbound' ? 1 : -1);
      m.dutySeconds = Math.max(0, m.dutySeconds - work / m.crewPerVehicle); m.tankKm = Math.max(0, m.tankKm - km * m.carriers); m.spentFuelKm += km * m.carriers;
      farm.spentFuelKm += km * m.carriers;
      if (Math.abs(end - m.km) < 1e-6) {
        m.km = end; m.at = next ? { kind: 'stronghold', id: next.id } : { kind: 'city', id: m.direction === 'outbound' ? r.destinationId : r.originId };
        m.phase = !next && m.direction === 'outbound' ? 'unloading' : 'station'; m.restProgress = 0; m.serviceProgress = 0;
      }
      return;
    }
    if (m.phase === 'unloading') {
      if (contexts(target).sourceCurrent !== true || !contexts(target).institutionsAvailable || target.rule.recharge
        || target.rule.command || target.rule.foodDelivery || target.rule.operatorServiceAssignment) { m.hold = 'Original destination receiving staff unavailable.'; return; }
      const work = Math.min(workBudgets.get(target.rule.id) || 0, target.rule.operatorWorkSeconds, Math.ceil(m.originalFoodKg / 50) * 2 - m.serviceProgress);
      workBudgets.set(target.rule.id, (workBudgets.get(target.rule.id) || 0) - work);
      target.rule.operatorWorkSeconds -= work; m.serviceProgress += work;
      if (m.serviceProgress >= Math.ceil(m.originalFoodKg / 50) * 2) {
        const kg = Math.min(m.foodKg, Math.max(0, target.rule.dailyKg * 4 - target.rule.foodKg));
        target.rule.foodKg += kg; target.rule.bulkReceivedFoodKg = (target.rule.bulkReceivedFoodKg || 0) + kg;
        m.foodKg -= kg; m.deliveredKg += kg;
        if (kg > 0) {
          m.unloadSerial = (m.unloadSerial || 0) + 1;
          const receipt = { id: `${m.id}:delivery:${m.unloadSerial}`, at, kind: 'bulkGrainDelivered', kg, sourceCityId: m.sourceCityId, destinationCityId: m.destinationCityId, missionId: m.id };
          target.rule.receipts.push(copy(receipt)); book.receipts.push(receipt);
        }
        if (m.foodKg > 1e-7) { m.hold = 'Actual receiving stores are full; paid cargo stays aboard.'; return; }
        m.direction = 'returning'; m.phase = 'station'; m.restProgress = 0; m.serviceProgress = 0;
      }
      return;
    }
    if (m.at.kind === 'city' && m.at.id === m.sourceCityId && m.direction === 'returning') {
      if (farm.trip) { m.hold = 'Original remaining farm crew must complete its own trip before fleet custody rejoins.'; return; }
      farm.fuelKm += m.tankKm; farm.dutySeconds += m.dutySeconds * m.drivers; farm.lastDepartureAt = at;
      farm.capacityKg += m.capacityKg; farm.carriers += m.carriers; farm.drivers += m.drivers;
      m.tankKm = 0; m.dutySeconds = 0; delete farm.bulkAssignment;
      // Returning leftovers remain conserved city custody, never player stock.
      source.rule.foodKg += m.crewFoodKg + m.foodKg; source.rule.waterLiters += m.crewWaterLiters;
      source.rule.returnedConvoyFoodKg = (source.rule.returnedConvoyFoodKg || 0) + m.crewFoodKg + m.foodKg;
      source.rule.returnedConvoyWaterLiters = (source.rule.returnedConvoyWaterLiters || 0) + m.crewWaterLiters;
      m.crewFoodKg = 0; m.foodKg = 0; m.crewWaterLiters = 0;
      contract.balance += m.returnAllowance; contract.spent -= m.returnAllowance; m.returnAllowance = 0;
      // Undispensed fuel remains a separately identified returned load, not an
      // overfilled tank or a fresh public supplier reserve.
      if (m.fuelCargoKm > 0) { farm.returnedBulkFuelKm = (farm.returnedBulkFuelKm || 0) + m.fuelCargoKm; m.returnedFuelCargoKm = m.fuelCargoKm; m.fuelCargoKm = 0; }
      m.phase = 'returned'; m.returnedAt = at; return;
    }
    let s = null;
    if (m.at.kind === 'stronghold') {
      const stop = r.stops.find(s => s.id === m.at.id); s = stop && station(book, stop);
      if (!stop?.usable || !s || s.status !== 'alive' || s.health < 50 || !s.willing || s.capacity < m.drivers
        || s.assignment && s.assignment !== m.id || s.workSeconds < 1 && m.serviceProgress < (m.serviceSeconds || 120)) { m.hold = 'Original joint rest/refueling station unavailable or occupied.'; return; }
      s.assignment = m.id;
      m.serviceSeconds ??= 120 + Math.ceil(Math.min(Math.max(0, m.tankCapacityKm - m.tankKm), m.fuelCargoKm) / 20) * 2;
      const work = Math.min(dt, m.serviceSeconds - m.serviceProgress, s.workSeconds); s.workSeconds -= work; m.serviceProgress += work;
    } else { m.serviceSeconds ??= 120; m.serviceProgress = Math.min(m.serviceSeconds, m.serviceProgress + dt); }
    m.restProgress += dt;
    if (m.serviceProgress < m.serviceSeconds) return;
    if (!replenish(m, book, contract, hooks, at)) { m.hold = 'Actual prepaid fuel unavailable or above the agreed return ceiling.'; return; }
    if (m.restProgress >= REST) {
      m.restoredDutySeconds += Math.max(0, SHIFT - m.dutySeconds) * m.drivers; m.dutySeconds = SHIFT; m.restCount++;
      m.receipts.push({ at, kind: 'suppliedRest', stationId: m.at.id, originalDriverIds: copy(m.driverIds) });
      if (s?.assignment === m.id) s.assignment = null;
      m.phase = 'moving';
      delete m.serviceSeconds;
    }
  }
  function advance(book, entries, contexts, hooks, at) {
    if (!book || !hooks.alive() || !finite(at) || at < book.lastAt) return false;
    while (book.lastAt < at) {
      let dt = Math.min(60, at - book.lastAt);
      for (const m of book.missions.filter(m => m.phase !== 'returned')) {
        const c = book.contracts.find(c => c.id === m.contractId);
        if (!c) continue;
        const next = m.direction === 'outbound' ? c.route.stops.find(s => s.km > m.km + 1e-7) : c.route.stops.slice().reverse().find(s => s.km < m.km - 1e-7);
        const boundary = m.phase === 'moving' ? Math.abs((next?.km ?? (m.direction === 'outbound' ? m.distanceKm : 0)) - m.km) / m.speedKph * 3600
          : m.phase === 'loading' ? m.loadingSeconds - m.serviceProgress
          : m.phase === 'unloading' ? Math.ceil(m.originalFoodKg / 50) * 2 - m.serviceProgress : REST - m.restProgress;
        if (boundary > 1e-7) dt = Math.min(dt, boundary);
      }
      if (book.job && SIGN - book.job.progress > 1e-7) dt = Math.min(dt, SIGN - book.job.progress);
      const end = book.lastAt + dt;
      // Shared minute-boundary clock: neither source/target catch-up nor a late
      // report may consume a delivery before the actual receipt boundary.
      const workBudgets = new Map();
      for (const e of entries) {
        const work = e.rule.operatorWorkSeconds;
        if (e.rule.lastAt <= book.lastAt) Rule.advance(e.rule, e.succession, e.people, () => ({ ...contexts(e), at: e.rule.lastAt }), end);
        workBudgets.set(e.rule.id, Math.max(0, dt - Math.max(0, work - e.rule.operatorWorkSeconds)));
      }
      const j = book.job;
      if (j) {
        const source = ruleOf(entries, j.quote.route.originId), c = hooks.contact(j.quote.route.originId);
        if (c.bodyEpoch !== j.bodyEpoch) { cancelAttendance(book, entries); book.lastAt = end; continue; }
        const ready = source && Rule.contact(c) && c.bodyEpoch === j.bodyEpoch && same(c.cell, j.cell)
          && source.rule.operatorServiceAssignment === j.id && authority(source, contexts);
        if (ready && j.wasReady) {
          const work = Math.min(workBudgets.get(source.rule.id) || 0, SIGN - j.progress, source.rule.operatorWorkSeconds);
          workBudgets.set(source.rule.id, Math.max(0, (workBudgets.get(source.rule.id) || 0) - work));
          source.rule.operatorWorkSeconds -= work; j.progress += work;
          if (j.progress >= SIGN) {
            const target = ruleOf(entries, j.quote.route.destinationId);
            if (hooks.wallet.money >= j.deposit && end <= j.quote.expiresAt && sourceCurrent(source, j.quote.source)
              && sourceCurrent(target, j.quote.target) && authority(target, contexts)) {
              hooks.wallet.money -= j.deposit;
              book.contracts.push({ ...copy(j.quote), id: `bulk-contract:${++book.serial}`, at: end, balance: j.deposit,
                deposited: j.deposit, spent: 0, refunded: 0, cancelledAt: null });
              book.quote = null;
              receive(book, j.quote.route.originId, c, end);
            }
            cancelAttendance(book, entries);
          }
        } else if (j) j.wasReady = ready;
      }
      for (const m of book.missions) tickMission(book, m, entries, contexts, hooks, dt, end, workBudgets);
      for (const c of book.contracts) dispatch(book, c, entries, contexts, hooks, end);
      book.lastAt = end;
    }
    return true;
  }
  function manage(book, entries, contexts, c, id, action, amount, wallet, at) {
    const contract = book?.contracts.find(c => c.id === id), source = contract && ruleOf(entries, contract.route.originId);
    if (!contract || !Rule.contact(c) || c.cityId !== contract.route.originId || !sourceCurrent(source, contract.source) || book.job
      || !authority(source, contexts)) return false;
    if (action === 'cancel' && contract.cancelledAt == null) { contract.cancelledAt = at; receive(book, c.cityId, c, at); return true; }
    if (action === 'deposit' && contract.cancelledAt == null && finite(amount) && amount > 0 && wallet.money >= amount) {
      wallet.money -= amount; contract.balance += amount; contract.deposited += amount; receive(book, c.cityId, c, at); return true;
    }
    if (action === 'refund' && contract.cancelledAt != null && contract.balance > 0) {
      wallet.money += contract.balance; contract.refunded += contract.balance; contract.balance = 0; receive(book, c.cityId, c, at); return true;
    }
    return false;
  }
  function receive(book, cityId, c, at) {
    if (!book || !Rule.contact(c) || c.cityId !== cityId) return false;
    const receipts = book.receipts.filter(r => r.destinationCityId === cityId);
    const missions = book.missions.filter(m => m.sourceCityId === cityId).map(m => ({ id: m.id, createdAt: m.createdAt, departedAt: m.departedAt || null,
      foodKg: m.originalFoodKg, returnedAt: m.returnedAt || null,
      ...(m.phase === 'returned' ? { deliveredKg: m.deliveredKg, rests: copy(m.receipts), spentFuelKm: m.spentFuelKm } : {}) }));
    const report = { cityId, at, receipts: copy(receipts), departures: missions,
      contracts: book.contracts.filter(q => q.route.originId === cityId).map(q => ({ id: q.id, balance: q.balance, spent: q.spent,
        refunded: q.refunded, limits: copy(q.limits), cancelledAt: q.cancelledAt, destinationId: q.route.destinationId })),
      limits: 'Received local account only. Departure is not delivery; unreturned crews supply no live position, station stock or unseen failure report.' };
    book.reports.push(report); book.reports = book.reports.slice(-100); return report;
  }
  return { DAY, SHIFT, REST, SIGN, TERMS, validRoute, routeFromWorld, create, normalize, rebind, settings,
    offer, begin, cancelAttendance, dispatch, advance, manage, receive };
});
