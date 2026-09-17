(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixLocalExchangeCarrier = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ACTIVE = ['awaitingCarrier', 'inTransit', 'arrived', 'unloading', 'dispatching'];
  const DEPOT_CAPACITY = 144, CONVOY_CAPACITY = 48;
  function create(cityId) {
    return { cityId, fuelReserveKm: 800, vehicles: ['Mara Vale', 'Irena Moss', 'Ren Kestrel'].map((name, i) => ({ id: `${cityId}:exchange-van-${i + 1}`, capacity: i === 2 ? 0 : 24, recovery: i === 2, condition: 100, fuelKm: 200, reservedFuelKm: 0, assignment: null, location: 'depot', driver: { id: `${cityId}:exchange-driver-${i + 1}`, name, health: 100, status: 'alive' } })), meters: {} };
  }
  const capable = v => v.condition >= 50 && v.driver.status === 'alive' && v.driver.health >= 50;
  function depotSpace(consignments) { return Math.max(0, DEPOT_CAPACITY - consignments.filter(c => c.direction === 'inbound' && ACTIVE.includes(c.status)).reduce((n, c) => n + c.quantity, 0)); }
  function assigned(fleet, id) { return fleet.vehicles.filter(v => v.assignment === id && !v.recovery); }
  function reserve(fleet, consignment, distance) {
    if (assigned(fleet, consignment.id).length) return '';
    if (!Number.isFinite(consignment.quantity) || consignment.quantity <= 0 || consignment.quantity > CONVOY_CAPACITY) return 'Consignment exceeds finite convoy capacity.';
    if (!Number.isFinite(distance) || distance <= 0) return 'Awaiting a supported local route.';
    const available = fleet.vehicles.filter(v => !v.recovery && !v.assignment && v.location === 'depot' && capable(v));
    const count = Math.ceil(consignment.quantity / 24), chosen = available.slice(0, count);
    if (chosen.length < count) return 'Awaiting available capable vehicles and named drivers.';
    const required = distance * 2, topUp = chosen.reduce((n, v) => n + Math.max(0, required - v.fuelKm), 0);
    if (topUp > fleet.fuelReserveKm) return 'Awaiting finite depot fuel for the complete round trip.';
    fleet.fuelReserveKm -= topUp;
    for (const v of chosen) { v.fuelKm = Math.max(v.fuelKm, required); v.reservedFuelKm = required; v.assignment = consignment.id; }
    return '';
  }
  function movementReason(fleet, id) {
    const vehicles = assigned(fleet, id);
    return !vehicles.length ? 'No reserved local carrier.' : vehicles.some(v => !capable(v)) ? 'Reserved vehicle or named driver unavailable; cargo remains in custody.' : '';
  }
  function distanceTravelled(j, now) {
    return j.route.legs.reduce((n, leg) => {
      if (j.status === 'arrived' || leg.status === 'completed') return n + leg.distanceKm;
      if (leg.status === 'pending') return n;
      const interruption = leg.interruption;
      let seconds = Math.max(0, now - leg.plannedStartAt);
      if (interruption?.revealed) {
        if (!interruption.resolved) seconds = Math.min(seconds, leg.durationSeconds * interruption.triggerFraction);
        else seconds = Math.max(0, seconds - interruption.delaySeconds);
      }
      return n + leg.distanceKm * Math.min(1, seconds / Math.max(1, leg.durationSeconds));
    }, 0);
  }
  function meter(fleet, consignment, journey, now) {
    if (!journey) return;
    const distance = distanceTravelled(journey, now), old = fleet.meters[journey.id] || 0, delta = Math.max(0, distance - old);
    fleet.meters[journey.id] = Math.max(old, distance);
    for (const v of assigned(fleet, consignment.id)) { v.fuelKm = Math.max(0, v.fuelKm - delta); v.reservedFuelKm = Math.max(0, v.reservedFuelKm - delta); v.location = journey.status === 'arrived' ? journey.destinationId : journey.status === 'scheduled' ? journey.originId : `road:${journey.id}`; }
  }
  function release(fleet, id) {
    for (const v of fleet.vehicles.filter(v => v.assignment === id)) { v.assignment = null; v.reservedFuelKm = 0; v.location = 'depot'; }
  }
  function reserveRecovery(fleet, id, distance) {
    // A crew already accompanying this convoy can assist again using onboard fuel,
    // but cannot draw more fuel from the remote depot or rescue another convoy.
    const accompanying = fleet.vehicles.find(v => v.recovery && v.assignment === id && capable(v));
    if (accompanying) {
      const cost = distance * 2;
      if (!Number.isFinite(cost) || cost <= 0 || accompanying.fuelKm < cost) return false;
      accompanying.fuelKm -= cost;
      return true;
    }
    const v = fleet.vehicles.find(v => v.recovery && !v.assignment && capable(v) && v.location === 'depot');
    if (!v || !Number.isFinite(distance) || distance <= 0) return false;
    const cost = distance * 2, extra = Math.max(0, cost - v.fuelKm);
    if (fleet.fuelReserveKm < extra) return false;
    fleet.fuelReserveKm -= extra; v.fuelKm += extra; v.fuelKm -= cost; v.assignment = id; v.location = 'recoveryRoute'; return true;
  }
  return { ACTIVE, DEPOT_CAPACITY, CONVOY_CAPACITY, create, capable, assigned, depotSpace, reserve, movementReason, meter, release, reserveRecovery };
});
