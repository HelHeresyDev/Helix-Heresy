(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./municipal-carrier') : root.HelixMunicipalCarrier,
    node ? require('./survey-expeditions') : root.HelixSurveyExpeditions);
  if (node) module.exports = api;
  if (root) root.HelixForeignSurveyExcursion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Carrier, Survey) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x)), WINDOW = 3 * 86400, COLLECTION = .25, DISTANCE = 2;
  const SCOPE = 'Named municipal sampling ground and booked local round trip only: surface reconnaissance and small sealed nonliving surface samples. No ownership, extraction, construction, deep cores, creature collection, unrestricted wilderness access, research license or maps.';
  function sourceFromWorld(map, g) {
    const city = map?.strategicPlayableSettlementState?.cityRows?.find(c => c.cityId === g?.cityId);
    const gov = map?.cityGovernments?.governments?.find(c => c.cityId === g?.cityId);
    const place = map?.humanGeography?.cities?.find(c => c.id === g?.cityId);
    if (!city?.assetId || !Number.isFinite(city.currentPopulation) || city.currentPopulation < 6 || city.physicalCondition === 'ruined' || ['abandoned', 'destroyed'].includes(city.habitationStatus)
      || gov?.sovereigntyScope !== 'cityOnly' || !gov.charter?.id || gov.roleAssignments.centralAdministration !== g.institutionId
      || !['functional', 'strong'].includes(city.services?.transport) || !place?.cellId) return null;
    const ids = [g.institutionId, gov.roleAssignments.publicWorksAndProvisioning];
    for (const id of ids) {
      const i = gov.institutions.find(i => i.id === id), current = map.strategicCivicHistory?.currentInstitutionRows?.find(i => i.institutionId === id);
      if (!i || !['functional', 'strong', 'exceptional'].includes(current?.currentCapacityBand || i.capacityBand)
        || map.strategicCivicHistory && (!current || ['displaced', 'disrupted'].includes(current.operationalStatus) || current.actualControlStatus !== 'localCharter')) return null;
    }
    return { cityId: g.cityId, administrationId: g.institutionId, worksId: ids[1], charterId: gov.charter.id,
      populationSourceId: city.assetId, cellId: place.cellId, name: `${place.name} Municipal Sampling Ground`, placeId: `foreign-survey:${g.cityId}` };
  }
  function create(g, source, carrier, context, z) {
    if (!source?.placeId || source.cityId !== g?.cityId || source.administrationId !== g.institutionId || carrier?.cityId !== g.cityId
      || carrier.institutionId !== source.worksId || carrier.allocation?.populationSourceId !== source.populationSourceId
      || context?.siteId !== source.placeId || !context.worldId || context.strategicCellId !== source.cellId || !context.truth || !Number.isFinite(z)) return null;
    return { source: copy(source), carrier, context: copy(context), originalClerkId: g.clerk.id, phase: 'depot', quote: null, permission: null,
      leg: null, trip: null, serial: 0, hazardDisturbed: false, observation: null, history: [],
      roomId: `foreign-survey-${g.cityId}`, cabinId: `foreign-survey-${g.cityId}-cabin`,
      entry: { x: 10, y: 10, z }, hazard: { x: 15, y: 14, z }, cabinEntry: { x: 10, y: 10, z: z + 1 } };
  }
  const current = (s, c) => Boolean(s && c.authorityCurrent && c.source && ['cityId', 'administrationId', 'worksId', 'charterId', 'populationSourceId', 'placeId', 'cellId'].every(k => s.source[k] === c.source[k]));
  const body = c => c.alive && c.capable && c.originalBody && !c.custodyActive;
  const permit = (s, c, now) => Boolean(s?.permission && s.permission.bodyEpoch === c.bodyEpoch && s.permission.visitId === c.visitId
    && s.permission.issuedAt <= now && now < s.permission.endsAt && current(s, c));
  function contactReason(g, s, c) {
    if (!current(s, c)) return 'No current independent city, public-works carrier and municipal sampling ground support this excursion.';
    if (!body(c) || c.cityId !== s.source.cityId || !c.local || !c.atDesk || !c.clerkPresent || !c.lineOfSight || c.otherBusy || c.excluded
      || g.clerk.id !== s.originalClerkId || g.clerk.status !== 'alive' || g.clerk.health < 50 || g.clerk.fatigue >= 80
      || g.receptionAssignment || !Number.isFinite(g.receptionWorkSeconds) || g.receptionWorkSeconds < 60 || !Number.isFinite(g.powerSeconds) || g.powerSeconds < 60)
      return 'Personally attend the original free capable body and original clerk at the shared powered reception desk.';
    return '';
  }
  function note(s, now, summary) { s.history.push({ at: now, summary }); s.history = s.history.slice(-30); }
  function action(g, s, c, now, kind, expected, wallet) {
    if (!s || !c.alive) return false;
    if (kind === 'quote') {
      if (contactReason(g, s, c) || !['depot', 'city'].includes(s.phase)) return false;
      s.quote = { cityId: s.source.cityId, placeId: s.source.placeId, bodyEpoch: c.bodyEpoch, visitId: c.visitId, clerkId: g.clerk.id,
        driverId: s.carrier.driver.id, vehicleId: s.carrier.vehicle.id, scope: SCOPE, issuedAt: now, expiresAt: now + 60, window: WINDOW };
      g.receptionWorkSeconds -= 60; g.powerSeconds -= 60; return true;
    }
    if (kind === 'accept') {
      const q = s.quote;
      if (contactReason(g, s, c) || !q || now >= q.expiresAt || q.bodyEpoch !== c.bodyEpoch || q.visitId !== c.visitId || JSON.stringify(q) !== JSON.stringify(expected)) return false;
      s.permission = { ...copy(q), issuedAt: now, endsAt: now + WINDOW }; s.quote = null;
      g.receptionWorkSeconds -= 60; g.powerSeconds -= 60; note(s, now, 'Separate named-ground surface-sampling access accepted. Trading, lodging, leases, charts and home expedition remain unchanged.'); return true;
    }
    if (kind === 'book') {
      const fare = Survey.quote({ ok: true, legs: [{ distanceKm: COLLECTION }, { distanceKm: DISTANCE }] }).fee;
      if (contactReason(g, s, c) || !permit(s, c, now) || s.phase !== 'depot' || !Number.isFinite(wallet?.money) || !Number.isFinite(s.carrier.vehicle.fuelKm)
        || !Carrier.reserve(s.carrier, COLLECTION, DISTANCE, c.cargo, fare, wallet, now)) return false;
      s.trip = { id: `${s.source.placeId}:trip-${++s.serial}`, bodyEpoch: c.bodyEpoch, visitId: c.visitId, bookedAt: now, fare,
        driverId: s.carrier.driver.id, vehicleId: s.carrier.vehicle.id };
      start(s, 'collecting', COLLECTION, 120, now); note(s, now, 'Paid original municipal round trip; actual depot collection underway. No supplies or intercity-carrier reset.'); return true;
    }
    return false;
  }
  function start(s, phase, km, seconds, now) { s.phase = phase; s.carrier.location = `foreign:${phase}`; s.leg = { phase, km, seconds, progressKm: 0, lastAt: now, wasReady: true, reason: '' }; }
  function boardingReason(s, c, now, kind) {
    if (!s?.trip || !body(c) || s.trip.bodyEpoch !== c.bodyEpoch || s.trip.visitId !== c.visitId || c.otherBusy
      || s.trip.driverId !== s.carrier.driver.id || s.trip.vehicleId !== s.carrier.vehicle.id) return 'The original trip body, municipal driver and vehicle must be physically available.';
    if (kind === 'disembark') return c.aboard && ['field', 'cityReturned'].includes(s.phase) ? '' : 'Wait for actual parked arrival before physically disembarking.';
    if (!Carrier.capable(s.carrier)) return 'The original municipal driver or vehicle cannot depart.';
    if (!Number.isFinite(c.cargo) || c.cargo > s.carrier.vehicle.cargoCapacity) return 'Actual carried cargo exceeds this vehicle.';
    if (s.phase === 'city') {
      if (!permit(s, c, now) || c.excluded || !c.atStand || !c.kit || !c.bottle || !c.provisions) return 'Current sampling permission, original carried kit, sample bottle, provisions and physical city boarding point are required.';
    } else if (s.phase !== 'field' || !c.atFieldEntry) return 'Physically reach the original waiting survey vehicle.';
    const required = s.phase === 'city' ? DISTANCE * 2 + COLLECTION : DISTANCE + COLLECTION;
    return c.routeOpen && s.carrier.vehicle.fuelKm >= required && s.carrier.vehicle.condition - required * .02 >= 50
      && s.carrier.driver.fatigue + required * .04 < 80 ? '' : 'Original local route or complete remaining municipal fuel/condition/endurance margin is unavailable; no replacement rescue is created.';
  }
  function board(s, c, now) {
    if (boardingReason(s, c, now, 'board')) return false;
    start(s, s.phase === 'city' ? 'outbound' : 'inbound', DISTANCE, 600, now); return true;
  }
  function disembark(s, c, now) {
    if (boardingReason(s, c, now, 'disembark')) return false;
    if (s.phase === 'cityReturned') start(s, 'depotReturn', COLLECTION, 120, now);
    return true;
  }
  function advance(s, c, now) {
    if (!s || !c.alive || !s.leg || now < s.leg.lastAt) return false;
    const l = s.leg, elapsed = now - l.lastAt; l.lastAt = now;
    const ready = c.routeOpen && current(s, c) && Carrier.capable(s.carrier) && s.carrier.vehicle.fuelKm > 0
      && s.trip.driverId === s.carrier.driver.id && s.trip.vehicleId === s.carrier.vehicle.id
      && (!['outbound', 'inbound'].includes(s.phase) || c.aboard && c.originalBody && s.trip.bodyEpoch === c.bodyEpoch);
    if (!ready) { l.wasReady = false; l.reason = 'Original local route, driver, vehicle or occupied cabin unavailable. Same cargo and position retained; no backfill or rescue.'; return false; }
    const km = l.wasReady ? Math.min(l.km - l.progressKm, elapsed * l.km / l.seconds, s.carrier.vehicle.fuelKm,
      Math.max(0, (s.carrier.vehicle.condition - 50) / .02), Math.max(0, (80 - s.carrier.driver.fatigue) / .04)) : 0;
    l.wasReady = true; l.reason = ''; l.progressKm += km; s.carrier.vehicle.fuelKm -= km; s.carrier.vehicle.condition -= km * .02; s.carrier.driver.fatigue += km * .04;
    if (km === 0 && l.progressKm + 1e-8 < l.km && elapsed > 0) l.reason = 'Original vehicle condition or driver endurance cannot support the next metre; original position and cargo retained.';
    if (l.progressKm + 1e-8 >= l.km) {
      s.phase = ({ collecting: 'city', outbound: 'field', inbound: 'cityReturned', depotReturn: 'depot' })[l.phase]; s.leg = null;
      s.carrier.location = s.phase === 'depot' ? 'depot' : `foreign:${s.phase}`;
      if (s.phase === 'depot') s.carrier.contract = null;
      note(s, now, `Original municipal vehicle arrived: ${s.phase}. Physical boarding/disembarking remains separate.`);
    }
    return km > 0;
  }
  function sampleReason(s, c, now, method) {
    if (!['reconnaissance', 'surfaceSample'].includes(method)) return 'This permission covers surface reconnaissance and sealed nonliving surface samples only.';
    if (!permit(s, c, now) || !body(c) || c.excluded || !c.atField || s.phase !== 'field'
      || s.trip?.bodyEpoch !== c.bodyEpoch || s.trip.visitId !== c.visitId) return 'Original free capable body and current named-ground sampling permission are required; prepaid return remains separate.';
    return '';
  }
  function observe(s, c, now) {
    if (s && body(c) && (c.atDesk || c.atStand || c.atFieldEntry || c.aboard)) s.observation = { at: now, phase: s.phase, permission: copy(s.permission),
      trip: copy(s.trip), leg: s.leg ? { progressKm: s.leg.progressKm, km: s.leg.km, reason: s.leg.reason } : null, history: copy(s.history) };
    return s?.observation ? copy(s.observation) : null;
  }
  return { SCOPE, WINDOW, COLLECTION, DISTANCE, sourceFromWorld, create, current, permit, contactReason, action, boardingReason, board, disembark, advance, sampleReason, observe };
});
