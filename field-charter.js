(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixFieldCharter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const moving = s => ['collecting', 'outbound', 'inbound', 'depot'].includes(s?.phase);
  const active = s => Boolean(s?.booking && !['completed', 'cancelled'].includes(s.phase));
  function create(map, cityId, binding, at) {
    const city = map?.strategicPlayableSettlementState?.cityRows?.find(c => c.cityId === cityId);
    const government = map?.cityGovernments?.governments?.find(g => g.cityId === cityId);
    const institution = government?.institutions?.find(i => i.id === government.roleAssignments?.publicWorksAndProvisioning);
    const current = map?.strategicCivicHistory?.currentInstitutionRows?.find(i => i.institutionId === institution?.id);
    if (!city?.assetId || city.currentPopulation < 8 || city.physicalCondition === 'ruined' || !['functional', 'strong'].includes(city.services?.transport)
      || !institution || !['functional', 'strong', 'exceptional'].includes(current?.currentCapacityBand || institution.capacityBand)
      || ['displaced', 'disrupted', 'suspended'].includes(current?.operationalStatus)) return null;
    const id = `${institution.id}:field-charter`;
    return { ...binding, id, source: { cityId, institutionId: institution.id, populationId: city.assetId, people: 1, vehicles: 1 },
      label: `${institution.name || 'Municipal public works'} utility charter`, phase: 'idle', booking: null, quote: null, serial: 0,
      driver: { id: `${id}:driver`, actorKind: 'fieldDriver', name: 'Utility charter driver', health: 100, maxHealth: 100, status: 'alive',
        skills: { evasion: 4, guarding: 3 }, roomId: '', mapCell: null, fatigue: 0 },
      vehicle: { id: `${id}:van`, condition: 100, fuelKm: 160, passengerSeats: 2, cargoKg: 80, cargoL: 160, roomId: '', mapCell: null },
      dutySeconds: 8 * 3600, provisionsSeconds: 12 * 3600, positionKm: null, lastAt: at, boarded: [], history: [], reason: '', report: null };
  }
  function normalize(value) {
    if (!value?.worldId || !value.runId || !value.id || !value.source?.institutionId || !value.driver?.id || !value.vehicle?.id
      || !Number.isFinite(value.lastAt) || !Number.isFinite(value.vehicle.fuelKm) || !Number.isFinite(value.vehicle.condition)
      || !Number.isFinite(value.dutySeconds) || !Number.isFinite(value.provisionsSeconds)
      || !Array.isArray(value.boarded) || !Array.isArray(value.history) || value.boarded.length > 2
      || value.boarded.some(id => id !== 'scientist' && id !== value.booking?.escortId)
      || value.booking && (!Number.isFinite(value.positionKm) || value.positionKm < 0 || value.positionKm > value.booking.distanceKm
        || !Array.isArray(value.booking.manifest) || !value.booking.escortId || !value.booking.routeId)
      || !['idle', 'collecting', 'boarding', 'outbound', 'onsite', 'inbound', 'unloading', 'depot', 'returnBoarding', 'stranded', 'completed', 'cancelled'].includes(value.phase)) return null;
    return copy(value);
  }
  function manifest(stacks, escortId) {
    return stacks.filter(i => ['scientist', escortId].includes(i.carriedBy) && i.quantity > 0).map(i => ({
      id: i.id, key: i.key, quantity: i.quantity, carriedBy: i.carriedBy, kg: i.unitMassKg || 0, l: i.unitVolumeL || 0,
      reserved: Boolean(i.reservedTaskId || i.carryTaskId) })).sort((a, b) => a.id.localeCompare(b.id));
  }
  function load(items) { return items.reduce((s, i) => ({ kg: s.kg + i.kg * i.quantity, l: s.l + i.l * i.quantity, reserved: s.reserved || i.reserved }), { kg: 0, l: 0, reserved: false }); }
  function capable(s) { return s && s.driver.status === 'alive' && s.driver.health >= 50 && s.driver.fatigue < 80 && s.vehicle.condition >= 50 && s.vehicle.fuelKm > 0 && s.dutySeconds > 0 && s.provisionsSeconds > 0; }
  function reason(s, c) {
    if (!s || !c.sourceCurrent) return 'No original functioning city-backed utility provider is available.';
    if (!c.alive || !c.capable || !c.originalBody || !c.atGround || !c.near || c.busy) return 'Personally meet the same capable escort at the original municipal ground, free of conflicting work.';
    if (!c.escortId || !c.contractId || !c.escortWilling || !c.escortCapable) return 'An active willing original escort with sufficient paid time and duty is required.';
    if (!c.stop || c.stop.routeId !== c.route?.id || !(c.stop.positionKm > 0 && c.stop.positionKm < c.route.distanceKm)) return 'Select personally visited roadside ground on the received measured approach.';
    if (!Number.isFinite(c.collectionKm) || c.collectionKm <= 0) return 'No published physical collection approach is available.';
    if (active(s)) return 'The original utility vehicle is already assigned.';
    if (!capable(s)) return 'Original driver, vehicle or finite reserves cannot support the charter; no replacement is supplied.';
    const cargo = load(c.manifest);
    if (cargo.reserved || cargo.kg > s.vehicle.cargoKg || cargo.l > s.vehicle.cargoL) return 'The exact carried manifest exceeds capacity or includes reserved goods.';
    const km = c.collectionKm * 2 + (c.route.distanceKm - c.stop.positionKm) * 2, seconds = km / 18 * 3600 + 2 * 3600;
    if (s.vehicle.fuelKm < km || s.vehicle.condition - km * .02 < 50 || s.dutySeconds < seconds || s.provisionsSeconds < seconds
      || c.escortSeconds < seconds || s.driver.fatigue + seconds / 3600 * 3 >= 80) return 'Finite fuel, condition, provisions, duty or escort time cannot cover collection, two-hour field allowance and physical return.';
    return '';
  }
  function review(s, c, at) {
    if (reason(s, c)) return null;
    const km = 2 * c.collectionKm + 2 * (c.route.distanceKm - c.stop.positionKm);
    s.quote = { id: `${s.id}:${s.serial + 1}`, bodyEpoch: c.bodyEpoch, escortId: c.escortId, contractId: c.contractId,
      routeId: c.route.id, distanceKm: c.route.distanceKm, stopId: c.stop.id, stopKm: c.stop.positionKm, collectionKm: c.collectionKm,
      manifest: copy(c.manifest), fee: 100 + Math.ceil(km * 6), fieldSeconds: 7200, at, expiresAt: at + 60 };
    return copy(s.quote);
  }
  function accept(s, c, expected, wallet, at) {
    const q = s?.quote;
    if (!q || reason(s, c) || at >= q.expiresAt || at < q.at || JSON.stringify(q) !== JSON.stringify(expected)
      || q.bodyEpoch !== c.bodyEpoch || q.escortId !== c.escortId || q.contractId !== c.contractId || q.stopId !== c.stop.id
      || q.routeId !== c.route.id || q.distanceKm !== c.route.distanceKm || q.collectionKm !== c.collectionKm
      || JSON.stringify(q.manifest) !== JSON.stringify(c.manifest) || wallet.money < q.fee) return false;
    wallet.money -= q.fee; s.serial++; s.booking = copy(q); s.quote = null; s.phase = 'collecting'; s.collectionRemainingKm = q.collectionKm;
    s.positionKm = q.distanceKm; s.boarded = []; s.reason = ''; s.lastAt = at; s.startedAt = at;
    s.departed = false; s.scientistOnLeg = false; s.scientistReleased = false; s.cancelRequested = false; s.previousKm = q.distanceKm;
    s.escortDutyAt = at;
    delete s.fieldArrivedAt; delete s.boardingRequest; return true;
  }
  function board(s, id, c) {
    if (!['boarding', 'returnBoarding', 'onsite', 'stranded'].includes(s?.phase) || !c.alive || !c.originalBody || !c.near || !c.capable
      || !['scientist', s.booking.escortId].includes(id) || s.boarded.includes(id) || s.boarded.length >= s.vehicle.passengerSeats) return false;
    s.boarded.push(id); return true;
  }
  function launchReason(s, c, at, returning = false) {
    const cargo = load(c.manifest);
    if (!active(s) || !c.alive || !c.originalBody || !c.capable) return 'Original free capable scientist and binding are unavailable.';
    if (!c.escortCapable) return 'A boarded original escort is incapacitated.';
    if (!c.sourceCurrent && !returning) return 'Original provider backing is unavailable.';
    if (!c.routeOpen) return 'Original received route is unavailable.';
    if (!capable(s)) return 'Original driver, vehicle, fuel, provisions or duty cannot support movement.';
    if (!s.boarded.length || !returning && (s.boarded.length !== 2 || !['scientist', s.booking.escortId].every(id => s.boarded.includes(id)))) return 'Board the actual original passengers first.';
    if (cargo.reserved || cargo.kg > s.vehicle.cargoKg || cargo.l > s.vehicle.cargoL) return 'Actual carried cargo is reserved or exceeds capacity.';
    if (!returning && JSON.stringify(c.manifest) !== JSON.stringify(s.booking.manifest)) return 'Exact accepted cargo changed; no silent manifest substitution.';
    if (!returning && (!c.escortWilling || s.phase !== 'boarding' || at >= s.startedAt + s.booking.fieldSeconds)) return 'Original escort assent, departure phase or departure window is unavailable.';
    if (returning && !['returnBoarding', 'onsite', 'stranded'].includes(s.phase)) return 'The original vehicle is not at an eligible return position.';
    return '';
  }
  function launch(s, c, at, returning = false) {
    if (launchReason(s, c, at, returning)) return false;
    s.booking.manifest = copy(c.manifest); s.phase = returning ? 'inbound' : 'outbound'; s.reason = ''; s.lastAt = at; return true;
  }
  function advance(s, at, c) {
    if (!active(s) || !c.alive || at < s.lastAt) return { changed: false, stopped: false };
    let stopped = false;
    for (; s.lastAt + 1 <= at;) {
      s.lastAt++; s.dutySeconds = Math.max(0, s.dutySeconds - 1); s.provisionsSeconds = Math.max(0, s.provisionsSeconds - 1);
      s.driver.fatigue = Math.min(100, s.driver.fatigue + 3 / 3600);
      if (!moving(s)) continue;
      const blocked = !c.originalBody ? 'Original body changed; no inherited charter.' : !c.routeOpen ? 'Received route is unavailable.'
        : s.phase === 'outbound' && !c.escortWilling ? 'The original escort requests physical withdrawal; stop before further outward travel.'
        : !capable(s) || !c.capable && s.boarded.includes('scientist') || !c.escortCapable && s.boarded.includes(s.booking.escortId) ? 'Original person, vehicle or finite reserves cannot continue.' : '';
      if (blocked) { s.reason = blocked; s.wasPhase = s.phase; s.phase = 'stranded'; stopped = true; break; }
      const collection = ['collecting', 'depot'].includes(s.phase);
      const target = collection ? 0 : s.phase === 'outbound' ? s.booking.stopKm : s.booking.distanceKm;
      const remaining = collection ? s.collectionRemainingKm : Math.abs(target - s.positionKm);
      let step = Math.min(18 / 3600, remaining, s.vehicle.fuelKm, Math.max(0, (s.vehicle.condition - 50) / .02));
      const direction = Math.sign(target - s.positionKm);
      const interruption = collection ? null : (c.interruptPositions || []).filter(km => (km - s.positionKm) * direction > 1e-9 && Math.abs(km - s.positionKm) <= step + 1e-9)
        .sort((a, b) => (a - b) * direction)[0];
      if (interruption != null) step = Math.abs(interruption - s.positionKm);
      s.vehicle.fuelKm -= step; s.vehicle.condition -= step * .02;
      if (collection) s.collectionRemainingKm = Math.max(0, s.collectionRemainingKm - step);
      else s.positionKm += Math.sign(target - s.positionKm) * step;
      if (interruption != null) { s.phase = 'stranded'; s.reason = 'The actual route encounter interrupted the utility charter.'; stopped = true; break; }
      if (remaining <= step + 1e-9) {
        if (collection) s.phase = s.phase === 'collecting' ? 'boarding' : s.cancelRequested ? 'cancelled' : 'completed';
        else { s.positionKm = target; s.phase = s.phase === 'outbound' ? 'onsite' : 'unloading'; if (s.phase === 'onsite') s.fieldArrivedAt = s.lastAt; }
        stopped = true; break;
      }
    }
    return { changed: true, stopped };
  }
  function cancel(s, at) {
    if (!active(s) || s.boarded.length || !['collecting', 'boarding'].includes(s.phase)) return false;
    // No teleport or resource refund: a dispatched vehicle still needs to return.
    s.cancelRequested = true; s.reason = 'Cancellation requested; spent fare and travel remain spent. Original driver must finish physical return.';
    return true;
  }
  function rebind(value, from, to) { const s = normalize(value); return s && to?.worldId && to.runId && s.worldId === from?.worldId && s.runId === from?.runId ? { ...s, ...to } : s; }
  return { create, normalize, manifest, load, capable, reason, review, accept, board, launchReason, launch, advance, moving, active, cancel, rebind };
});
