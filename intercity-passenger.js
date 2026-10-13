(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HelixIntercityPassenger = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clone = x => JSON.parse(JSON.stringify(x));
  const moving = s => ['outbound', 'inbound'].includes(s?.phase);
  const away = s => moving(s) || s?.phase === 'arrival' || s?.phase === 'foreign';
  const PROVISION_SECONDS = 4 * 3600, PROVISION_CAP = 96 * 3600, HANDOFF_SECONDS = 30;
  function create(city, standings, at) {
    const entry = standings?.find(e => e.network?.category === 'transport' && e.branch
      && (!e.branch.cityId || e.branch.cityId === city?.cityId)
      && ['chartered', 'licensed', 'recognized'].includes(e.standing)
      && ['functional', 'strong', 'regionalHub'].includes(e.branch.capacityBand)
      && (!e.branch.operationalStatus || e.branch.operationalStatus === 'active'));
    if (!city || city.currentPopulation <= 0 || city.physicalCondition === 'ruined'
      || !['functional', 'strong'].includes(city.services?.transport) || !entry) return null;
    return { phase: 'home', homeCityId: city.cityId, location: city.cityId, booking: null, trip: null, serial: 0,
      source: { branchId: entry.branch.id, populationId: city.assetId, people: 1, vehicles: 1 },
      label: entry.branch.publicName, driver: { id: `${entry.branch.id}:passenger-driver`, health: 100, fatigue: 0 },
      vehicle: { id: `${entry.branch.id}:passenger-road-car`, condition: 100, fuelKm: 2400, cargoKg: 20, cargoL: 40 },
      provisionsSeconds: 96 * 3600, lastAt: at, rest: null, receipts: [], observation: null };
  }
  function neighbors(network, homeCityId) {
    const home = network.destinations.find(d => d.kind === 'fortifiedCity' && d.cityId === homeCityId);
    return network.routes.filter(r => r.endpointCityIds.includes(homeCityId) && r.supportCapable && r.continuity !== 'closed')
      .map(r => ({ route: r, destination: network.destinations.find(d => d.kind === 'fortifiedCity' && d.known && d.cityId !== homeCityId && r.endpointCityIds.includes(d.cityId)) }))
      .filter(e => e.destination && (!home?.supportComponentId || !e.destination.supportComponentId || home.supportComponentId === e.destination.supportComponentId));
  }
  function load(stacks) {
    return stacks.filter(s => s.carriedBy === 'scientist' && s.quantity > 0).reduce((v, s) => {
      v.kg += s.quantity * (s.unitMassKg || 0); v.l += s.quantity * (s.unitVolumeL || 0); v.reserved ||= Boolean(s.reservedTaskId); return v;
    }, { kg: 0, l: 0, reserved: false });
  }
  function quote(s, network, destinationId) {
    if (!s) return { ok: false, reason: 'No supported commercial passenger carrier is allocated here.' };
    const target = s.location === s.homeCityId ? destinationId : s.trip?.destinationId;
    const e = neighbors(network, s.homeCityId).find(e => e.destination.id === target);
    if (!e) return { ok: false, reason: 'A known directly connected city and usable supported corridor are required.' };
    const km = Math.max(1, Number(e.route.distanceKm) || 0);
    const seconds = Math.max(600, Math.ceil(km / 46 * 3600 * (e.route.continuity === 'continuous' ? 1 : 1.25)));
    return { ok: true, destinationId: e.destination.id, destinationCityId: e.destination.cityId, destinationLabel: e.destination.label,
      routeId: e.route.id, km, seconds, fee: Math.ceil(100 + km * 4), cargoKg: s.vehicle.cargoKg, cargoL: s.vehicle.cargoL,
      waitingLimitHours: Math.floor(s.provisionsSeconds / 3600), arrival: 'Outer passenger stand only; no admission or services.',
      directions: 'Booked corridor itinerary only; no maps or resource surveys are released.' };
  }
  function reason(s, q, cargo, money) {
    if (!q.ok) return q.reason;
    if (s.booking || moving(s) || s.phase === 'arrival' || s.rest) return 'The actual carrier is already committed.';
    if (s.driver.health < 50 || s.driver.fatigue >= 80 || s.vehicle.condition < 50) return 'The original driver or vehicle is not capable.';
    if (cargo.reserved || cargo.kg > q.cargoKg || cargo.l > q.cargoL) return 'Only unreserved carried cargo within the exact mass and volume limits can board.';
    // Outward travel requires a material return margin, not a prepaid or guaranteed return.
    const legs = s.location === s.homeCityId ? 2 : 1;
    if (s.vehicle.fuelKm < q.km * legs || s.vehicle.condition - q.km * legs * .02 < 50
      || s.provisionsSeconds < q.seconds * legs + 3600 || s.driver.fatigue + q.seconds / 3600 * 3 >= 80) return 'Finite fuel, provisions, duty or condition cannot support this journey and its required margin.';
    if (money < q.fee) return 'The exact fare is not available.';
    return '';
  }
  function book(s, q, cargo, wallet, at, bodyEpoch) {
    const blocked = reason(s, q, cargo, wallet.money); if (blocked) return blocked;
    wallet.money -= q.fee;
    s.booking = { ...clone(q), id: `${s.source.branchId}:passenger-${++s.serial}`, at, expiresAt: at + 3600, bodyEpoch, outbound: s.location === s.homeCityId };
    return '';
  }
  function cancel(s, wallet) {
    if (!s?.booking) return false;
    wallet.money += s.booking.fee; s.booking = null; return true;
  }
  function boardingReason(s, network, cargo, at, bodyEpoch) {
    if (!s?.booking) return 'Accept exact transport terms first.';
    if (at >= s.booking.expiresAt || bodyEpoch !== s.booking.bodyEpoch) return 'This named-body booking expired or belongs to a previous body; cancel it for the unlaunched refund.';
    const q = quote(s, network, s.booking.destinationId);
    if (!q.ok || q.routeId !== s.booking.routeId || q.km !== s.booking.km || q.seconds !== s.booking.seconds) return 'The booked route changed; cancel and obtain new terms.';
    return reason({ ...s, booking: null }, q, cargo, q.fee);
  }
  function board(s, at, manifest, seed) {
    const b = s.booking; if (!b) return false;
    // One deterministic possible road inspection; no secret injury/death roll.
    let hash = 0; for (const c of `${seed}:${b.id}`) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
    s.trip = { ...b, departedAt: at, progressSeconds: 0, distanceKm: 0, delaySeconds: hash % 5 === 0 ? 900 : 0,
      delayRevealed: false, manifest: clone(manifest), arrivalWindow: { start: at + b.seconds, end: at + b.seconds + 900 } };
    s.booking = null; s.phase = b.outbound ? 'outbound' : 'inbound'; s.lastAt = at; return true;
  }
  function advance(s, network, at, alive = true) {
    if (!s || !alive) return false;
    const dt = Math.max(0, at - s.lastAt); s.lastAt = at;
    if (!dt) return false;
    const supplied = Math.min(dt, s.provisionsSeconds); s.provisionsSeconds -= supplied;
    if (s.rest) {
      s.rest.remaining -= supplied;
      if (s.rest.remaining <= 0) { s.driver.fatigue = Math.max(0, s.driver.fatigue - 30); s.rest = null; }
      return true;
    }
    if (!moving(s)) return supplied > 0;
    const t = s.trip, route = neighbors(network, s.homeCityId).find(e => e.route.id === t.routeId && e.destination.id === t.destinationId);
    s.hold = !route ? 'The booked corridor is closed or no longer supported.' : s.driver.health < 50 || s.vehicle.condition < 50 ? 'Original crew or vehicle incapacitated.' : '';
    if (s.hold) { t.arrivalWindow.start += dt; t.arrivalWindow.end += dt; return true; }
    let work = Math.min(supplied, Math.max(0, (80 - s.driver.fatigue) / 3 * 3600));
    const speed = t.km / t.seconds;
    work = Math.min(work, s.vehicle.fuelKm / speed, Math.max(0, (s.vehicle.condition - 50) / .02 / speed));
    if (t.delaySeconds && t.progressSeconds + work >= t.seconds / 2) {
      t.delayRevealed = true; const delay = Math.min(work, t.delaySeconds); t.delaySeconds -= delay; work -= delay;
    }
    work = Math.min(work, t.seconds - t.progressSeconds);
    t.progressSeconds += work; const km = work * speed; t.distanceKm += km;
    s.vehicle.fuelKm = Math.max(0, s.vehicle.fuelKm - km); s.vehicle.condition -= km * .02; s.driver.fatigue += work / 3600 * 3;
    if (t.progressSeconds >= t.seconds - .000001) {
      s.location = t.outbound ? t.destinationCityId : s.homeCityId; s.phase = 'arrival';
      t.arrivedAt = at; s.receipts.push({ id: t.id, at, fee: t.fee, destination: s.location }); return true;
    }
    if (work === 0 && !t.delaySeconds) s.hold = 'Finite transport reserves exhausted; no automatic rescue or return is available.';
    const remaining = t.seconds - t.progressSeconds + t.delaySeconds;
    t.arrivalWindow = { start: at + remaining, end: at + remaining + 900 }; return true;
  }
  function disembark(s) {
    if (s?.phase !== 'arrival') return false;
    s.phase = s.location === s.homeCityId ? 'home' : 'foreign'; return true;
  }
  function rest(s) {
    if (!s || moving(s) || s.booking || s.rest || s.provisionsSeconds < 8 * 3600 || s.driver.health < 50) return false;
    s.rest = { remaining: 8 * 3600 }; return true;
  }
  function provisionPlan(s, item, c, reservationId = '') {
    const refuse = reason => ({ ok: false, reason });
    if (!s || !c.local || !c.carrierCurrent || !c.sameBody || !c.alive || !c.capable || !c.free)
      return refuse('The original body and selected original carrier must be physically local, free and able to receive supplies.');
    if (!['home', 'foreign'].includes(s.phase) || s.booking || s.rest || c.busy)
      return refuse('Finish or cancel current work, booking or driver rest before the physical ration handoff.');
    // Fatigue or empty provisions do not prevent receiving food; this heals
    // neither an incapacitated driver nor any vehicle resource.
    if (s.driver.health < 50) return refuse('The original driver cannot receive this physical handoff.');
    if (!item?.id || item.section !== 'inventory' || item.key !== 'fieldRation' || item.carriedBy !== 'scientist'
      || !Number.isInteger(item.quantity) || item.quantity < 1 || item.cityOwnerId || item.civicCustody || item.carryTaskId
      || item.fixtureId || item.containerId || item.toolInstanceId || item.contents?.length || item.chemicalBatch || item.biology
      || item.tags?.some(t => /(^|[-_ ])(contaminated|unsealed|broken)([-_ ]|$)/i.test(t))
      || item.reservedTaskId && (!reservationId || item.reservedTaskId !== reservationId))
      return refuse('Choose an actual owned, unreserved carried field-ration pack; claimed, contained or spoiled supplies are excluded.');
    if (!Number.isFinite(item.unitMassKg) || item.unitMassKg <= 0 || !Number.isFinite(item.unitVolumeL) || item.unitVolumeL <= 0)
      return refuse('The original pack dimensions are unavailable.');
    if (!Number.isFinite(s.provisionsSeconds) || s.provisionsSeconds < 0 || s.provisionsSeconds + PROVISION_SECONDS > PROVISION_CAP)
      return refuse('A whole four-hour pack must fit within the original 96-hour provision capacity.');
    return { ok: true, stackId: item.id, quantity: 1, seconds: PROVISION_SECONDS, handoffSeconds: HANDOFF_SECONDS, capSeconds: PROVISION_CAP, reason: '' };
  }
  function advanceProvisionWork(work, at, attended) {
    const dt = Math.max(0, at - work.lastAt); work.lastAt = at;
    if (!attended) { work.attendedAt = null; return false; }
    if (work.attendedAt == null) { work.attendedAt = at; return false; }
    const before = work.progress; work.progress = Math.min(HANDOFF_SECONDS, work.progress + dt);
    return work.progress !== before;
  }
  function receiveProvisions(s, item, c, work, taskId, at, consume) {
    if (!taskId || s?.provisionReceipts?.some(r => r.id === taskId) || work?.progress !== HANDOFF_SECONDS || !c.atStand) return false;
    const q = provisionPlan(s, item, c, taskId);
    if (!q.ok || item.quantity !== 1 || item.reservedTaskId !== taskId) return false;
    const receipt = { id: taskId, at, stackId: item.id, key: item.key, quantity: 1, seconds: q.seconds,
      branchId: s.source.branchId, driverId: s.driver.id, cityId: s.location, bodyEpoch: c.bodyEpoch, sourceLabels: clone(item.sourceLabels || []) };
    if (!consume(item)) return false;
    s.provisionsSeconds += q.seconds;
    (s.provisionReceipts ||= []).push(receipt); return true;
  }
  function publicView(s) {
    if (!s) return null;
    return { phase: s.phase, label: s.label, location: s.location, hold: s.hold || '', booking: clone(s.booking),
      waitingHours: Math.floor(s.provisionsSeconds / 3600), rest: Boolean(s.rest),
      trip: s.trip ? { id: s.trip.id, destinationLabel: s.trip.destinationLabel, arrivalWindow: clone(s.trip.arrivalWindow),
        arrivedAt: s.trip.arrivedAt, delay: s.trip.delayRevealed ? 'Road inspection delayed the occupied vehicle.' : '',
        directions: s.trip.directions } : null };
  }
  // A bounded second service, not a through-ticket or a replacement for the first.
  // The application keeps the selected carrier separately; the other remains here
  // so JSON saves have no duplicated aliases or hidden reset on selection.
  function connection(first, city, standings, at, bodyEpoch) {
    if (first?.phase !== 'foreign' || first.location !== city?.cityId || first.homeCityId === city.cityId || first.trip?.bodyEpoch !== bodyEpoch) return null;
    const other = create(city, standings, at);
    if (other?.source.branchId === first.source.branchId) return null;
    return { homeCityId: first.homeCityId, intermediateCityId: city.cityId, terminalCityId: null,
      bodyEpoch, visitId: first.trip.id, otherCarrier: other, sourceCheckedAt: at };
  }
  function connectionDestinations(c, carrier, network) {
    if (!c || carrier.homeCityId === c.homeCityId) return carrier.phase === 'foreign'
      ? [carrier.trip.destinationId] : neighbors(network, carrier.homeCityId).map(e => e.destination.id);
    if (carrier.phase === 'foreign') return [carrier.trip.destinationId];
    return neighbors(network, c.intermediateCityId).filter(e => e.destination.cityId !== c.homeCityId
      && (!c.terminalCityId || e.destination.cityId === c.terminalCityId)).map(e => e.destination.id);
  }
  function selectConnection(c, selected, bodyEpoch) {
    const other = c?.otherCarrier;
    if (!other || bodyEpoch !== c.bodyEpoch || !['home', 'foreign'].includes(selected.phase)
      || !['home', 'foreign'].includes(other.phase) || selected.booking || other.booking || selected.rest || other.rest
      || selected.location !== c.intermediateCityId || other.location !== c.intermediateCityId) return null;
    c.otherCarrier = selected;
    return other;
  }
  return { create, neighbors, load, quote, reason, book, cancel, boardingReason, board, advance, disembark, rest, publicView, away, moving,
    connection, connectionDestinations, selectConnection, PROVISION_SECONDS, PROVISION_CAP, HANDOFF_SECONDS,
    provisionPlan, advanceProvisionWork, receiveProvisions };
});
