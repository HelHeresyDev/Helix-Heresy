(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixLocalCovertMarket = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  function create(cityId, cityName = cityId) { return { cityId, cityName, couriers: [], collections: [], nextNumber: 1 }; }
  function bind(state, contact, at) {
    // A referral is a new individual, not a new city-wide transport network.
    if (!contact.homeCityId) { contact.homeCityId = state.cityId; contact.serviceCityIds = [state.cityId]; }
    if (contact.homeCityId !== state.cityId || !contact.serviceCityIds?.includes(state.cityId)) return;
    if (!state.couriers.some(c => c.contactId === contact.id)) state.couriers.push({
      id: `covert-courier:${contact.id}`, contactId: contact.id, cityId: state.cityId,
      name: `${contact.name}'s collector`, vehicleId: `covert-van:${contact.id}`, mode: 'lined secure collection van',
      capacityKg: 120, capacityL: 240, specimenCapable: true, fuelKm: 160, condition: 100, money: 500,
      driver: { id: `covert-driver:${contact.id}`, name: `Collector ${contact.name}`, health: 100, status: 'alive', fatigue: 0 },
      assignment: null, location: 'city depot', lastAt: at, reason: ''
    });
  }
  function reachable(state, contact, route) {
    if (!contact || contact.homeCityId !== state.cityId || !contact.serviceCityIds?.includes(state.cityId)) return 'Remote contact only; no local collection service. Intercity smuggling is not available.';
    if (!route?.ok || route.cityId !== state.cityId || !Number.isFinite(route.distanceKm) || route.distanceKm <= 0) return route?.reason || 'No supported city-local road approach to the Concealed Exit.';
    return '';
  }
  const capable = c => c.condition >= 50 && c.driver.health >= 50 && c.driver.status === 'alive' && c.driver.fatigue < 80;
  function availability(state, contact, route, cargo = { massKg: 0, volumeL: 0 }) {
    const reason = reachable(state, contact, route);
    if (reason) return { ok: false, reason };
    const courier = state.couriers.find(c => c.contactId === contact.id && !c.assignment && capable(c)
      && c.fuelKm >= route.distanceKm * 2 && c.condition - route.distanceKm * 2 * .02 >= 50 && c.driver.fatigue + route.distanceKm * 2 * .08 < 80
      && c.capacityKg >= cargo.massKg && c.capacityL >= cargo.volumeL && (!cargo.specimen || c.specimenCapable));
    return courier ? { ok: true, courierId: courier.id, travelSeconds: Math.ceil(route.distanceKm / 24 * 3600), reason: '' }
      : { ok: false, reason: 'No available local covert courier with sufficient fuel, capacity, containment and capable crew. Existing vehicles are not replaced.' };
  }
  function book(state, contact, route, obligationId, cargo, at) {
    if (state.collections.some(c => c.obligationId === obligationId && !['returned', 'canceled'].includes(c.phase))) return { ok: false, reason: 'Collection already assigned.' };
    const check = availability(state, contact, route, cargo); if (!check.ok) return check;
    const courier = state.couriers.find(c => c.id === check.courierId);
    const collection = { id: `covert-collection-${state.nextNumber++}`, obligationId, contactId: contact.id, cityId: state.cityId, courierId: courier.id,
      bookedAt: at, lastAt: at, arrivedAt: null, handedOffAt: null, returnedAt: null, distanceKm: route.distanceKm, positionKm: 0,
      phase: 'outbound', canceled: false, cargo: copy(cargo), manifest: null, owner: 'player', reason: '' };
    state.collections.push(collection); courier.assignment = collection.id; courier.location = 'outbound'; courier.lastAt = at;
    return { ok: true, collection, travelSeconds: check.travelSeconds };
  }
  function advance(state, now, route, supplier = null) {
    for (const courier of state.couriers) {
      const elapsed = Math.max(0, now - courier.lastAt); courier.lastAt = Math.max(now, courier.lastAt);
      if (!courier.assignment) {
        courier.driver.fatigue = Math.max(0, courier.driver.fatigue - elapsed / 3600 * 15);
        // Replenishment is an actual purchase from the finite local supplier, never free fuel.
        if (supplier?.routeOpen && courier.cityId === route?.cityId) {
          const fuel = Math.max(0, Math.min(160 - courier.fuelKm, supplier.fuelStockKm, courier.money / .05));
          courier.fuelKm += fuel; supplier.fuelStockKm -= fuel; courier.money -= fuel * .05;
        }
        continue;
      }
      const job = state.collections.find(c => c.id === courier.assignment);
      const seconds = Math.max(0, now - job.lastAt); job.lastAt = Math.max(now, job.lastAt);
      if (!route?.ok || route.cityId !== job.cityId || job.kind === 'depotRecovery' && route.distanceKm !== job.distanceKm || !capable(courier)) { job.reason = 'Collection held: local route or courier unavailable; cargo and ownership preserved.'; continue; }
      job.reason = '';
      if (job.phase === 'waiting') continue;
      const remaining = job.phase === 'outbound' ? job.distanceKm - job.positionKm : job.positionKm;
      const distance = Math.max(0, Math.min(remaining, seconds / 3600 * 24, courier.fuelKm));
      courier.fuelKm -= distance; courier.condition = Math.max(0, courier.condition - distance * .02); courier.driver.fatigue += distance * .08;
      job.positionKm += job.phase === 'outbound' ? distance : -distance;
      if (distance < remaining && courier.fuelKm <= 0) job.reason = 'Courier out of fuel; no automatic rescue, replacement or cargo loss.';
      if (distance + 1e-8 >= remaining) {
        if (job.phase === 'outbound') { job.phase = 'waiting'; job.arrivedAt = now; courier.location = 'Concealed Exit'; }
        else { job.phase = job.canceled ? 'canceled' : 'returned'; job.returnedAt = now; courier.location = 'city depot'; courier.assignment = null; }
      } else courier.location = `${job.phase}: ${job.positionKm.toFixed(2)} km from city depot`;
    }
  }
  function ready(state, obligationId) { return state.collections.find(c => c.obligationId === obligationId && c.phase === 'waiting' && !c.canceled && !c.reason) || null; }
  function handoff(state, obligationId, manifest, at, owner = null) {
    const job = ready(state, obligationId); if (!job || job.manifest) return false;
    job.manifest = copy(manifest); job.owner = owner || job.contactId; job.phase = 'returning'; job.handedOffAt = at; job.lastAt = at;
    state.couriers.find(c => c.id === job.courierId).location = `returning with ${job.owner === 'player' ? 'player' : 'buyer'}-owned cargo`;
    return true;
  }
  function cancel(state, obligationId, at) {
    const job = state.collections.find(c => c.obligationId === obligationId && ['outbound', 'waiting'].includes(c.phase));
    if (!job || job.kind === 'depotRecovery') return false;
    job.canceled = true; job.phase = 'returning'; job.lastAt = at;
    const courier = state.couriers.find(c => c.id === job.courierId); courier.location = 'returning empty';
    if (job.positionKm <= 0) { job.phase = 'canceled'; job.returnedAt = at; courier.assignment = null; courier.location = 'city depot'; }
    return true;
  }
  function terms(context, kind, tags, productId) {
    const family = tags.includes('arcane') ? 'manaCrystals' : kind === 'manufactured' ? 'chemicalFeedstock' : 'biologicalProductivity';
    const sources = context.productionSources || [];
    const industry = sources.some(s => s.family === family);
    const relevant = context.listings?.[family === 'manaCrystals' ? 'preparedManaCrystals' : family === 'chemicalFeedstock' ? 'assayReagent' : 'biomass'];
    let multiplier = Math.max(.85, Math.min(1.2, relevant?.targetDemand || 1));
    const current = context.marketListings?.[family === 'manaCrystals' ? 'preparedManaCrystals' : family === 'chemicalFeedstock' ? 'assayReagent' : 'biomass'];
    const shortage = current && current.supply < Math.max(1, (relevant?.targetSupply || 10) * .25);
    if (shortage) multiplier *= 1.1;
    if (industry) multiplier *= 1.08;
    const restrictions = (context.restrictions || []).filter(r => r.productId === productId && r.known === true);
    const ruleIds = new Set(['corporateLicensing', ...(kind === 'specimen' ? ['artificialCreatureCreation'] : kind === 'manufactured' ? ['contrabandCommerce'] : []), ...(tags.includes('arcane') ? ['prohibitedMagic'] : [])]);
    const laws = (context.lawRules || []).filter(r => ruleIds.has(r.offenseId));
    const legalPressure = laws.filter(r => ['prohibited', 'restricted'].includes(r.legalStatus)).length * .02;
    const scrutiny = (context.institutions || []).filter(i => ['restricted', 'proscribed'].includes(i.standing)).length;
    const careful = (context.beliefs || []).some(b => /unconsented experimentation|soul mutilation|unauthorized soul research/.test(b));
    return { multiplier, exposureDelta: Math.min(.12, scrutiny * .015 + restrictions.length * .03 + legalPressure), requireAssay: kind === 'manufactured' && careful,
      summary: `${context.cityName || context.cityId}: ${industry ? 'published relevant industry' : 'no published relevant production anchor'}; local demand ${multiplier.toFixed(2)}×${shortage ? '; scarce public local stock' : ''}. ${restrictions.map(r => r.label).join('; ') || 'No additional product-specific local legal ruling is known.'}${laws.length ? ` Published activity rules: ${laws.map(r => `${r.label}: ${r.legalStatus}`).join('; ')}. These rules do not establish that this cargo or its owner violated them.` : ''}${careful ? ' Public religious prohibitions favor documented handling; doctrine is not automatically city law.' : ''}` };
  }
  return { create, bind, reachable, availability, book, advance, ready, handoff, cancel, terms };
});
