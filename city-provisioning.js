(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./strategic-settlements') : root.HelixStrategicSettlements,
    node ? require('./strategic-world') : root.HelixStrategicWorld,
    node ? require('./strategic-journeys') : root.HelixStrategicJourneys,
    node ? require('./local-exchange-carrier') : root.HelixLocalExchangeCarrier);
  if (node) module.exports = api;
  if (root) root.HelixCityProvisioning = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Settlements, World, Journeys, Carrier) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const DAY = 86400, CRATE_KG = 50, HANDLE = 30;
  const HOME = Object.freeze({ x: 18, y: 14, z: 6 }), DOCK = Object.freeze({ x: 18, y: 15, z: 6 });
  const TRUCK = Object.freeze({ x: 19, y: 15, z: 6 });
  const directories = new WeakMap();
  const LIMITS = 'One agricultural satellite contribution, not the entire city food supply, famine simulation or city-power completion. Municipal quota, driver, vehicle, custody and spent resources remain original. No player food, ownership, free army, appointment, divine endorsement, immunity or neighboring authority. Reports are dated, not remote telemetry.';
  const same = (a, b) => Boolean(a && b && a.x === b.x && a.y === b.y && a.z === b.z);
  const able = a => a?.status === 'alive' && a.health >= 50;
  function sourceFromWorld(map, cityId, all = false) {
    const city = map?.strategicPlayableSettlementState?.cityRows?.find(a => a.cityId === cityId);
    const g = map?.cityGovernments?.governments?.find(a => a.cityId === cityId);
    const institution = g?.institutions.find(i => i.id === g.roleAssignments.publicWorksAndProvisioning);
    const current = map?.strategicCivicHistory?.currentInstitutionRows?.find(i => i.institutionId === institution?.id);
    if (!city || city.currentPopulation < 8 || !city.physicalJurisdictionExists || city.physicalCondition === 'ruined'
      || !['functional', 'strong'].includes(city.services?.provisioning) || !['functional', 'strong'].includes(city.services?.transport)
      || !institution || ['displaced', 'disrupted', 'suspended'].includes(current?.operationalStatus)
      || !['functional', 'strong', 'exceptional'].includes(current?.currentCapacityBand || institution.capacityBand)
      || !map.publicSettlementDirectory) return all ? [] : null;
    if (!directories.has(map.publicSettlementDirectory)) directories.set(map.publicSettlementDirectory, Settlements.publicSettlementDirectory(map));
    const farms = directories.get(map.publicSettlementDirectory).satellites.filter(a => a.parentId === cityId
      && a.parentKind === 'sovereignResourceAnchorCity' && a.function === 'agriculture'
      && ['groundConvoy', 'mixedFleet'].includes(a.logistics.vehicleMode));
    const candidates = farms.map(farm => {
      const state = map.strategicPlayableSettlementState.satelliteRows?.find(a => a.assetId === farm.id);
      const path = farm.localRouteCellIds;
      if (!state || state.parentId !== cityId || state.function !== 'agriculture' || state.currentPopulation < 8
        || state.physicalCondition === 'ruined' || !state.localRouteUsable || !['functional', 'strong'].includes(state.services?.provisioning)
        || !['functional', 'strong'].includes(state.services?.transport) || path.length < 2
        || path[0] !== farm.cellId || path.at(-1) !== city.cellId) return null;
      const topology = World.topologyForMap(map), indices = path.map(World.cellIndex);
      if (indices.some(i => !Number.isInteger(i) || i < 0 || i >= topology.cellCount)
        || indices.slice(1).some((i, n) => !topology.neighbors[indices[n]].includes(i))) return null;
      const distanceKm = path.slice(1).reduce((n, cell, i) => n + World.greatCircleDistanceKm(map, World.cellIndex(path[i]), World.cellIndex(cell)), 0);
      if (!Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > 250) return null;
      return { cityId, cityName: city.name, populationSourceId: city.assetId, cityPopulation: city.currentPopulation,
        charterId: g.charter.id, institutionId: institution.id, satelliteId: farm.id, satelliteName: farm.name,
        satellitePopulation: state.currentPopulation, cityCellId: city.cellId, satelliteCellId: farm.cellId,
        arableLandBand: farm.arableLandBand, storageDays: farm.logistics.storageEnduranceDays, distanceKm,
        routeCellIds: copy(path), routeUsable: true, provenance: 'One existing municipal agricultural quota; not the farm harvest or the city market stock.' };
    }).filter(Boolean).sort((a, b) => a.distanceKm - b.distanceKm || a.satelliteId.localeCompare(b.satelliteId));
    return all ? candidates : candidates[0] || null;
  }
  function validSource(a) {
    return a && ['cityId', 'charterId', 'institutionId', 'populationSourceId', 'satelliteId', 'cityCellId', 'satelliteCellId'].every(k => typeof a[k] === 'string' && a[k])
      && [a.cityPopulation, a.satellitePopulation].every(n => Number.isFinite(n) && n >= 8)
      && Number.isFinite(a.storageDays) && a.storageDays >= 1 && a.storageDays <= 30
      && Number.isFinite(a.distanceKm) && a.distanceKm > 0 && a.distanceKm <= 250
      && Array.isArray(a.routeCellIds) && a.routeCellIds.length >= 2 && a.routeCellIds[0] === a.satelliteCellId
      && a.routeCellIds.at(-1) === a.cityCellId && ['marginal', 'limited', 'productive', 'abundant'].includes(a.arableLandBand);
  }
  function create(source, succession, office, run, at) {
    if (!validSource(source) || !run?.worldId || !run.runId || !succession?.handover
      || succession.source.cityId !== source.cityId || succession.source.charterId !== source.charterId
      || succession.officeId !== office?.id || office.cityId !== source.cityId) return null;
    const worker = succession.leaders.find(a => a.institutionId === source.institutionId && a.roles.includes('publicWorksAndProvisioning'));
    if (!worker || !succession.control?.commandRelationships.some(a => a.personId === worker.id && a.roles.includes('publicWorksAndProvisioning'))) return null;
    const id = `${source.cityId}:agricultural-quota`, factor = ({ marginal: .5, limited: .75, productive: 1, abundant: 1.25 })[source.arableLandBand];
    // Deliberately bounded municipal share: half a kilogram per dependent per
    // day, never a literal assertion about every citizen or the whole harvest.
    const population = Math.min(source.cityPopulation, Math.max(1, Math.floor(source.satellitePopulation * factor)));
    const dailyKg = population * .5, cityStock = 2 * dailyKg, farmStock = source.storageDays * dailyKg;
    const origin = `${id}:city`, farm = `${id}:farm`, component = `${id}:local-route`;
    const network = Journeys.defaultState({ clock: at, network: { homeDestinationId: origin, nearestSettlementDestinationId: origin, routes: [], destinations: [
      { id: origin, kind: 'fortifiedCity', cityId: source.cityId, cellId: source.cityCellId, label: source.cityName, supportComponentId: component, known: true, reachable: true },
      { id: farm, kind: 'laboratorySite', cityId: source.cityId, cellId: source.satelliteCellId, label: source.satelliteName, supportComponentId: component,
        known: true, reachable: true, localDistanceKm: source.distanceKm, routeContinuity: 'operational', dangerBand: 'unknown' }
    ] } });
    return { id, ...copy(run), source: copy(source), officeId: office.id, workerId: worker.id, handoverId: succession.handover.id,
      bodyEpoch: succession.handover.bodyEpoch, allocatedAt: at, lastAt: at, nextNumber: 1, network,
      demand: { population, kgPerDay: dailyKg, suppliedKg: 0, unmetKg: 0 },
      stores: { cityKg: cityStock, cityCapacityKg: Math.max(3 * dailyKg, 1200), farmKg: farmStock,
        farmCapacityKg: farmStock, standingCropKg: 3 * dailyKg, harvestedKg: 0, initialKg: cityStock + farmStock,
        legalOwnerId: source.cityId, sourceId: `${source.satelliteId}:existing-municipal-quota` },
      driver: { id: `${id}:driver`, name: 'Original municipal grain driver', actorKind: 'civicOfficeholder', status: 'alive', health: 100, maxHealth: 100,
        roomId: 'supportedSurveyGround', mapCell: copy(HOME), locationId: office.id, workSeconds: 43200, foodSeconds: 86400, waterSeconds: 86400,
        physicalControl: { strength: 25, stamina: 80, staminaCapacity: 80 }, skills: { striking: 5, guarding: 10, evasion: 10, perception: 15 }, assignment: null },
      vehicle: { id: `${id}:truck`, cityOwnerId: source.cityId, condition: 100, fuelKm: 600, capacityKg: 1200,
        location: 'city', roomId: 'supportedSurveyGround', mapCell: copy(TRUCK), cargoKg: 0 },
      allocation: { populationSourceId: source.populationSourceId, satelliteId: source.satelliteId, people: 1, vehicles: 1,
        dependentPopulation: population, grainUnitKg: CRATE_KG, originalQuotaKg: cityStock + farmStock, futureHarvestCapKg: 3 * dailyKg },
      farmAccount: { at, kg: farmStock, sourceId: `${source.satelliteId}:existing-municipal-quota` },
      quote: null, order: null, receipts: [], history: [], rest: null, report: null, message: 'Existing two-day municipal buffer; no new famine or player-owned stock was created.' };
  }
  function normalize(s) {
    return validSource(s?.source) && s.worldId && s.runId && s.driver?.id && s.vehicle?.id && s.stores
      && s.demand && Array.isArray(s.receipts) && Array.isArray(s.history) && s.network?.destinations
      ? { ...copy(s), network: Journeys.normalizeState(s.network) } : null;
  }
  function note(s, at, text) { s.message = text; s.history.push({ at, text }); s.history = s.history.slice(-80); }
  function authority(s, succession, office, c) {
    const worker = succession?.leaders?.find(a => a.id === s?.workerId);
    return Boolean(s && c.sourceCurrent && c.bodyEpoch === s.bodyEpoch && succession?.handover?.id === s.handoverId
      && succession.handover.bodyEpoch === s.bodyEpoch && succession.control?.recognizedAuthorityId === 'scientist'
      && succession.control.sourceReceiptId === s.handoverId && succession.control.bodyEpoch === s.bodyEpoch
      && succession.source.cityId === s.source.cityId && succession.source.charterId === s.source.charterId
      && office?.id === s.officeId && office.cityId === s.source.cityId && c.worksCurrent
      && worker?.officeStatus?.status !== 'replacedByReviewedAppointment'
      && succession.agreements?.some(a => a.personId === s.workerId && a.institutionId === s.source.institutionId
        && a.roles.includes('publicWorksAndProvisioning') && !a.suspendedRoles?.includes('publicWorksAndProvisioning'))
      && succession.control.commandRelationships.some(a => a.personId === s.workerId && a.institutionId === s.source.institutionId && a.roles.includes('publicWorksAndProvisioning')));
  }
  const contact = c => c.alive && c.capable && c.local && c.atCounter && c.workerPresent && c.free && !c.violence;
  function inspect(s, succession, office, c, at) {
    if (!contact(c) || !authority(s, succession, office, c)) return false;
    s.quote = { id: `${s.id}:inspection:${s.nextNumber++}`, at, expiresAt: at + 3600, bodyEpoch: c.bodyEpoch,
      handoverId: s.handoverId, sourceId: s.stores.sourceId, kg: Math.max(0, Math.floor(Math.min(s.farmAccount.kg, s.vehicle.capacityKg, s.stores.cityCapacityKg - s.stores.cityKg) / CRATE_KG) * CRATE_KG),
      farmKg: s.farmAccount.kg, farmAccountAt: s.farmAccount.at, cityId: s.source.cityId, satelliteId: s.source.satelliteId, routeKm: s.source.distanceKm,
      scope: 'One original municipal quota pickup and return, not an appropriation or personal shipment.' };
    receive(s, c, at); return true;
  }
  function dispatch(s, succession, office, worker, c, expected, at) {
    const q = s?.quote;
    if (!contact(c) || !authority(s, succession, office, c) || !q || JSON.stringify(q) !== JSON.stringify(expected) || at >= q.expiresAt) return false;
    const ok = issue(s, worker, c, q.kg, at);
    if (ok) receive(s, c, at); return ok;
  }
  function standing(s, succession, office, c, enabled, at) {
    if (!contact(c) || !authority(s, succession, office, c)) return false;
    s.standing = enabled ? { handoverId: s.handoverId, bodyEpoch: s.bodyEpoch, sourceId: s.stores.sourceId, at, lastDispatchAt: null } : null;
    note(s, at, enabled ? 'Standing municipal pickup priority authorized. The same original driver, truck, finite quota and duty must make every delivery; no remote receipt or replenishment.' : 'Future standing pickups revoked; any departed original carrier must still return.');
    return true;
  }
  function issue(s, worker, c, kg, at) {
    const d = s.driver, v = s.vehicle;
    if (s.order || s.rest || !c.routeUsable || !able(d) || c.driverIncapacitated || !c.depotAvailable || v.location !== 'city'
      || !same(d.mapCell, HOME) || d.assignment || v.condition < 50 || v.fuelKm < 2 * s.source.distanceKm
      || d.workSeconds < 2 * s.source.distanceKm / 38 * 3600 + kg / CRATE_KG * 2 * HANDLE + 60
      || d.foodSeconds < 1 || d.waterSeconds < 1 || kg < CRATE_KG || kg > s.stores.farmKg
      || worker?.id !== s.workerId || !able(worker) || worker.assignment || worker.workSeconds < 30) return false;
    const id = `${s.id}:delivery:${s.nextNumber++}`;
    s.order = { id, issuedAt: at, originalBodyEpoch: s.bodyEpoch, phase: 'approaching', requestedKg: kg, reservedKg: kg,
      loadedKg: 0, deliveredKg: 0, handling: 0, journeyId: null, meterKm: 0, lastAt: at, reason: '', cancelRequested: false };
    d.assignment = id; worker.workSeconds -= 30; s.quote = null;
    note(s, at, 'Existing public-works priority exercised. Original driver must approach, board, collect and return the municipal quota. No cargo moved on instruction.');
    return true;
  }
  function pauseJourney(j, dt) {
    if (!j) return;
    for (const l of j.route.legs.filter(l => l.status !== 'completed')) {
      l.plannedStartAt += dt; l.plannedEndAt += dt;
      if (l.interruption?.revealed && !l.interruption.resolved) l.interruption.revealedAt += dt;
    }
    if (j.status === 'scheduled') j.departAt += dt;
    j.exactArrivalAt += dt; j.arrivalWindow.start += dt; j.arrivalWindow.end += dt;
  }
  function book(s, at, returning = false) {
    const result = Journeys.createJourney(s.network, { originId: returning ? s.network.destinations[1].id : s.network.destinations[0].id,
      destinationId: returning ? s.network.destinations[0].id : s.network.destinations[1].id, modeId: 'hiredFreightRoad',
      passengers: 1, cargo: s.vehicle.cargoKg / CRATE_KG, vehicleCount: 1, departureDelaySeconds: 0, clock: at,
      seed: `${s.runId}:${s.order.id}:${returning ? 'return' : 'outbound'}`, provider: s.vehicle.id,
      subject: { kind: 'municipalGrain', id: s.order.id }, label: 'Municipal quota carrier' });
    if (!result.journey) return false;
    s.network = result.state; s.order.journeyId = result.journey.id; s.order.meterKm = 0;
    s.order.phase = returning ? 'inbound' : 'outbound'; s.vehicle.location = 'road';
    s.vehicle.mapCell = null; s.vehicle.roomId = ''; s.driver.mapCell = null; s.driver.roomId = ''; return true;
  }
  function finish(s, at, reason) {
    const o = s.order;
    s.receipts.push({ id: o.id, at, requestedKg: o.requestedKg, loadedKg: o.loadedKg, deliveredKg: o.deliveredKg,
      retainedCargoKg: s.vehicle.cargoKg, ownerId: s.source.cityId, sourceId: s.stores.sourceId, reason });
    s.receipts.at(-1).encounterReports = copy(o.encounterReports || []);
    s.receipts.at(-1).spoiledKg = o.spoiledKg || 0;
    s.driver.assignment = null; s.order = null; note(s, at, reason);
  }
  function cancel(s, succession, office, c, at) {
    if (!contact(c) || !authority(s, succession, office, c) || !s.order) return false;
    s.order.cancelRequested = true;
    if (['approaching', 'boarding'].includes(s.order.phase)) s.order.reservedKg = 0;
    note(s, at, 'Cancellation recorded locally. Cargo, driver and vehicle still need actual return; no refund, recall teleport or cargo deletion.');
    // No radio is invented. An instruction cannot change an already departed
    // driver's behavior remotely; it is applied at their original return.
    receive(s, c, at); return true;
  }
  function advance(s, c, to, h = {}) {
    if (!s || !c.alive || !Number.isFinite(to) || to <= s.lastAt) return false;
    // Small chronological slices keep finite food, handling, route positions
    // and new leg start dates honest even when accelerated by several days.
    while (s.lastAt < to) {
      const directive = s.standing;
      if (directive && c.standingAuthorized && directive.handoverId === s.handoverId && directive.bodyEpoch === s.bodyEpoch
        && directive.sourceId === s.stores.sourceId && c.standingWorkerAvailable && !s.order
        && (directive.lastDispatchAt == null || s.lastAt - directive.lastDispatchAt >= DAY)
        && s.stores.cityKg < s.demand.kgPerDay * 2) {
        const kg = Math.floor(Math.min(s.stores.farmKg, s.vehicle.capacityKg,
          s.stores.cityCapacityKg - s.stores.cityKg) / CRATE_KG) * CRATE_KG;
        if (issue(s, c.standingWorker, c, kg, s.lastAt)) directive.lastDispatchAt = s.lastAt;
      }
      const moving = ['approaching', 'returningToPost'].includes(s.order?.phase);
      let dt = Math.min(moving || h.roadBoundary && ['outbound', 'inbound'].includes(s.order?.phase) ? 1 : 30, to - s.lastAt);
      // A fractional road crossing must not shift subsequent physical AI
      // pulses according to the caller's catch-up chunk size.
      if (moving || h.roadBoundary && ['outbound', 'inbound'].includes(s.order?.phase))
        dt = Math.min(dt, Math.floor(s.lastAt + 1e-7) + 1 - s.lastAt);
      const boundary = h.roadBoundary?.(s, s.lastAt, dt);
      if (Number.isFinite(boundary) && boundary > 1e-7) dt = Math.min(dt, boundary);
      if (s.rest) dt = Math.min(dt, Math.max(.001, 28800 - s.rest.progress));
      if (['boarding', 'loading', 'unloading'].includes(s.order?.phase)) dt = Math.min(dt, Math.max(.001, HANDLE - s.order.handling));
      const activeJourney = s.network.journeys.find(j => j.id === s.order?.journeyId);
      if (activeJourney && ['enRoute', 'held', 'diverted', 'scheduled'].includes(activeJourney.status)) {
        const leg = activeJourney.route.legs[activeJourney.currentLegIndex], interruption = leg?.interruption;
        const boundaries = [activeJourney.exactArrivalAt, leg?.plannedEndAt, activeJourney.status === 'scheduled' ? activeJourney.departAt : null,
          interruption && !interruption.revealed ? leg.plannedStartAt + leg.durationSeconds * interruption.triggerFraction
            : interruption?.revealed && !interruption.resolved ? interruption.revealedAt + interruption.delaySeconds : null];
        for (const boundary of boundaries) if (Number.isFinite(boundary) && boundary > s.lastAt) dt = Math.min(dt, boundary - s.lastAt);
      }
      const at = s.lastAt + dt; s.lastAt = at;
      h.roadTick?.(s, at);
      const p = s.stores, d = s.driver, v = s.vehicle;
      const harvest = c.productionAvailable ? Math.min(p.standingCropKg, s.demand.kgPerDay * dt / DAY, Math.max(0, p.farmCapacityKg - p.farmKg)) : 0;
      p.standingCropKg -= harvest; p.farmKg += harvest; p.harvestedKg += harvest;
      const required = s.demand.kgPerDay * dt / DAY, used = Math.min(p.cityKg, required);
      p.cityKg -= used; s.demand.suppliedKg += used; s.demand.unmetKg += required - used;
      if (s.rest) {
        const r = s.rest;
        if (able(d) && !c.driverIncapacitated && c.depotAvailable && same(d.mapCell, HOME) && d.foodSeconds >= dt && d.waterSeconds >= dt) {
          const work = Math.min(dt, 28800 - r.progress); d.foodSeconds -= work; d.waterSeconds -= work; r.progress += work;
          if (r.progress >= 28800) { d.workSeconds = Math.min(43200, d.workSeconds + 28800); d.physicalControl.stamina = Math.min(80, d.physicalControl.stamina + 40); s.rest = null; note(s, at, 'Original driver completed supplied rest; no healing, gear repair or vehicle fuel restored.'); }
        }
      }
      const o = s.order; if (!o) continue;
      const j = s.network.journeys.find(j => j.id === o.journeyId);
      let reason = !able(d) || c.driverIncapacitated ? 'Original driver cannot work; body and cargo remain at their actual position.'
        : v.condition < 50 ? 'Original vehicle condition prevents operation.' : d.workSeconds < dt ? 'Original driver duty exhausted.'
        : d.foodSeconds < dt || d.waterSeconds < dt ? 'Original driver provisions exhausted.' : '';
      if (['outbound', 'inbound'].includes(o.phase) && j?.status !== 'arrived' && (!c.routeUsable || v.fuelKm <= 0)) reason ||= 'Actual route or finite fuel prevents movement.';
      if (h.roadHeld?.(s)) reason ||= 'Original carrier halted at a physical road contact; no remote cargo credit or automatic rescue.';
      if (['approaching', 'boarding', 'unloading', 'returningToPost'].includes(o.phase) && !c.depotAvailable) reason ||= 'Original depot access is blocked.';
      // Waiting on a blocked road/depot does not freeze a living assigned
      // person's finite provisions or duty. No ration creates health or fuel.
      if (d.status === 'alive' && d.health > 0) {
        d.workSeconds = Math.max(0, d.workSeconds - dt);
        d.foodSeconds = Math.max(0, d.foodSeconds - dt); d.waterSeconds = Math.max(0, d.waterSeconds - dt);
      }
      if (reason) { o.reason = reason; if (j) { pauseJourney(j, dt); s.network.lastAdvancedAt = at; } continue; }
      o.reason = ''; o.lastAt = at;
      if (['outbound', 'inbound'].includes(o.phase)) {
        const advanced = Journeys.advance(s.network, at).state;
        const travel = advanced.journeys.find(j => j.id === o.journeyId), km = Carrier.distanceTravelled(travel, at), delta = Math.max(0, km - o.meterKm);
        if (delta > v.fuelKm + 1e-7) {
          pauseJourney(j, dt); s.network.lastAdvancedAt = at; o.reason = 'Original fuel cannot support the next measured road increment.'; continue;
        }
        s.network = advanced;
        v.fuelKm = Math.max(0, v.fuelKm - delta); v.condition = Math.max(0, v.condition - delta * .02); o.meterKm = km;
        h.roadArrived?.(s, at);
        if (travel.status === 'stranded') { o.reason = 'Original carrier stranded at the saved road position; no unseen battle or automatic rescue.'; continue; }
        if (travel.status !== 'arrived') continue;
        if (o.phase === 'inbound' && !c.depotAvailable) { o.reason = 'Original carrier reached the city but cannot enter the occupied or blocked dock.'; continue; }
        o.journeyId = null; o.handling = 0;
        if (o.phase === 'outbound') { o.phase = 'loading'; v.location = 'farm'; d.locationId = s.source.satelliteId; }
        else { s.farmAccount = copy(o.farmAccount || s.farmAccount); o.phase = 'unloading'; v.location = 'city'; v.mapCell = copy(TRUCK); v.roomId = 'supportedSurveyGround';
          d.mapCell = copy(DOCK); d.roomId = 'supportedSurveyGround'; d.locationId = s.officeId; }
        continue;
      }
      if (o.phase === 'approaching' || o.phase === 'returningToPost') {
        const goal = o.phase === 'approaching' ? DOCK : HOME;
        if (!same(d.mapCell, goal) && d.physicalControl.stamina >= 1 && h.move?.(d, goal)) d.physicalControl.stamina--;
        if (same(d.mapCell, goal)) {
          if (o.phase === 'returningToPost') finish(s, at, o.cancelRequested ? 'Original carrier returned after cancellation; delivered food and spent resources remain.' : 'Original municipal quota delivery and driver return completed.');
          else { o.phase = 'boarding'; o.handling = 0; }
        }
        continue;
      }
      o.handling += dt;
      if (o.phase === 'boarding' && o.handling >= 30) {
        if (o.cancelRequested) { o.phase = 'returningToPost'; continue; }
        book(s, at); continue;
      }
      if (o.phase === 'loading' && o.handling >= HANDLE) {
        o.farmAccount = { at, kg: p.farmKg, sourceId: p.sourceId };
        if (o.reservedKg >= CRATE_KG && p.farmKg >= CRATE_KG && v.cargoKg + CRATE_KG <= v.capacityKg) {
          p.farmKg -= CRATE_KG; v.cargoKg += CRATE_KG; o.loadedKg += CRATE_KG; o.reservedKg -= CRATE_KG; o.handling -= HANDLE;
          o.farmAccount.kg = p.farmKg;
        }
        if (o.reservedKg < CRATE_KG || p.farmKg < CRATE_KG) book(s, at, true);
      } else if (o.phase === 'unloading' && o.handling >= HANDLE) {
        if (!same(d.mapCell, DOCK)) { o.handling = 0; o.reason = 'Original driver is not at the actual receiving dock.'; continue; }
        if (v.cargoKg >= CRATE_KG && p.cityKg + CRATE_KG <= p.cityCapacityKg) {
          v.cargoKg -= CRATE_KG; p.cityKg += CRATE_KG; o.deliveredKg += CRATE_KG; o.handling -= HANDLE;
        } else if (v.cargoKg > 0) { o.handling = 0; o.reason = 'City storage cannot accept another original crate.'; }
        if (v.cargoKg === 0) { o.phase = 'returningToPost'; o.handling = 0; }
      }
    }
    return true;
  }
  function recover(s, succession, office, c, at) {
    if (!contact(c) || !authority(s, succession, office, c) || !c.routeUsable || !s.order?.journeyId) return false;
    const j = s.network.journeys.find(j => j.id === s.order.journeyId);
    if (j?.status !== 'stranded' || !able(s.driver) || c.driverIncapacitated || s.vehicle.fuelKm < s.source.distanceKm) return false;
    // Ordinary shared route recovery retains the same convoy, position and
    // extra recovery duration. The supported municipal channel relays this
    // exact request only; no personal command radio or rescue assets appear.
    const r = Journeys.recoverStrandedJourney(s.network, j.id, at);
    if (r.reason) return false; s.network = r.state; return true;
  }
  function rest(s, succession, office, c, at) {
    if (!contact(c) || !authority(s, succession, office, c) || s.order || s.rest || !able(s.driver)
      || c.driverIncapacitated || !same(s.driver.mapCell, HOME) || !c.depotAvailable) return false;
    s.rest = { at, progress: 0 }; return true;
  }
  function receive(s, c, at) {
    if (!s || !contact(c) || !c.reportAllowed) return false;
    s.report = copy({ at, cityId: s.source.cityId, satelliteId: s.source.satelliteId, satelliteName: s.source.satelliteName,
      population: s.demand.population, cityPopulation: s.source.cityPopulation, kgPerDay: s.demand.kgPerDay,
      cityKg: s.stores.cityKg, cityCapacityKg: s.stores.cityCapacityKg, suppliedKg: s.demand.suppliedKg, unmetKg: s.demand.unmetKg,
      // The official receives completed dock entries, not remote live farm,
      // driver, fuel, health, crop, journey status or carrying information.
      farmAccount: s.farmAccount,
      instruction: s.order ? { id: s.order.id, issuedAt: s.order.issuedAt, requestedKg: s.order.requestedKg,
        receivedKg: s.order.deliveredKg, status: 'Issued; unreceived progress unverified' } : null,
      receipts: s.receipts, limits: LIMITS }); return true;
  }
  function replenish(s, succession, office, c, key, stacks, at) {
    if (!c.alive || !c.capable || !c.local || !c.free || !c.atDepot || c.violence || !authority(s, succession, office, c) || s.order || s.rest || s.vehicle.location !== 'city'
      || !able(s.driver) || c.driverIncapacitated || !['fuelReagent', 'fieldRation', 'drinkingWater'].includes(key)) return false;
    const i = stacks.find(i => i.key === key && i.carriedBy === 'scientist' && i.quantity >= 1 && !i.reservedTaskId && !i.cityOwnerId && !i.civicCustody && !i.containerId && !i.fixtureId);
    if (!i || key === 'fuelReagent' && s.vehicle.fuelKm > 400 || key === 'fieldRation' && s.driver.foodSeconds > 72000
      || key === 'drinkingWater' && s.driver.waterSeconds > 72000) return false;
    i.quantity--; if (i.knownQuantity != null) i.knownQuantity = Math.min(i.knownQuantity, i.quantity);
    if (key === 'fuelReagent') s.vehicle.fuelKm += 200;
    else s.driver[key === 'fieldRation' ? 'foodSeconds' : 'waterSeconds'] += 14400;
    note(s, at, `One real carried ${key} transferred to the existing municipal allocation; no fuel, work or supplies refunded.`); return true;
  }
  return { DAY, CRATE_KG, HANDLE, HOME, DOCK, TRUCK, LIMITS, able, sourceFromWorld, validSource, create, normalize, authority,
    inspect, dispatch, standing, advance, cancel, recover, rest, receive, replenish };
});
