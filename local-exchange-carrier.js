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
  function support(fleet, now = 0) {
    if (!fleet.support) fleet.support = {
      lastAt: now, money: 1000, revenue: 0, expenses: 0, parts: 6, workshop: null, reason: '',
      supplier: { fuelStockKm: 8000, partsStock: 80, operatingFuelKm: 800, distanceKm: 4, routeOpen: true,
        vehicle: { id: `${fleet.cityId}:supply-truck`, condition: 100, fuelKm: 120, location: 'supplier', driver: { id: `${fleet.cityId}:supply-driver`, name: 'Sana Reed', health: 100, status: 'alive', fatigue: 0 } }, shipment: null, nextNumber: 1 }, history: []
    };
    for (const v of fleet.vehicles) v.driver.fatigue ??= 0;
    return fleet.support;
  }
  function record(s, now, text) { s.history.push({ at: now, text }); s.history = s.history.slice(-30); }
  function credit(fleet, amount, now) {
    const s = support(fleet, now), paid = Math.max(0, Number(amount) || 0);
    s.money += paid; s.revenue += paid;
  }
  function tariffMultiplier(fleet) {
    const s = support(fleet);
    return (fleet.fuelReserveKm < 200 ? 1.5 : 1) * (s.parts < 2 ? 1.2 : 1) * (s.money < 100 ? 1.2 : 1);
  }
  function work(v, km) {
    v.condition = Math.max(0, v.condition - km * 0.02);
    v.driver.fatigue = Math.min(100, (v.driver.fatigue || 0) + km * 0.04);
  }
  function rested(v, km = 0) { return (v.driver.fatigue || 0) + km * 0.04 <= 80 && v.condition - km * 0.02 >= 50; }
  function advanceSupport(fleet, now) {
    const s = support(fleet, now), elapsed = Math.max(0, now - s.lastAt), supplier = s.supplier, truck = supplier.vehicle;
    s.lastAt = Math.max(now, s.lastAt);
    for (const v of fleet.vehicles.filter(v => !v.assignment && v.location === 'depot')) v.driver.fatigue = Math.max(0, v.driver.fatigue - elapsed / 3600 * 15);
    if (!supplier.shipment) truck.driver.fatigue = Math.max(0, truck.driver.fatigue - elapsed / 3600 * 15);
    // Explicit saved legs: supplier -> exchange depot -> supplier. Cargo is credited
    // only at the depot; the independently fuelled supplier truck stays occupied on return.
    const shipment = supplier.shipment;
    if (shipment) {
      if (!supplier.routeOpen || !capable(truck)) {
        shipment.arriveAt += elapsed; shipment.returnAt += elapsed;
        s.reason = 'Supplier shipment held: route or named driver/vehicle unavailable.';
      } else {
        if (!shipment.delivered && now >= shipment.arriveAt) {
          fleet.fuelReserveKm += shipment.fuelKm; s.parts += shipment.parts; shipment.delivered = true;
          truck.location = 'returning from exchange depot'; work(truck, supplier.distanceKm);
          record(s, now, `Supplier delivered ${shipment.fuelKm} vehicle-km of fuel and ${shipment.parts} maintenance parts.`);
        }
        if (now >= shipment.returnAt) {
          work(truck, supplier.distanceKm); truck.location = 'supplier'; supplier.shipment = null;
        }
      }
    }
    if (s.workshop && now >= s.workshop.finishAt) {
      const vehicle = fleet.vehicles.find(v => v.id === s.workshop.vehicleId);
      if (vehicle && !vehicle.assignment && vehicle.location === 'depot') {
        vehicle.condition = Math.min(100, vehicle.condition + s.workshop.repair);
        record(s, now, `Workshop completed maintenance on ${vehicle.id}.`); s.workshop = null;
      }
    }
    const repair = fleet.vehicles.find(v => !v.assignment && v.location === 'depot' && v.condition < 85);
    if (!s.workshop && repair) {
      if (s.parts >= 2 && s.money >= 8) {
        s.parts -= 2; s.money -= 8; s.expenses += 8;
        s.workshop = { vehicleId: repair.id, finishAt: now + 7200, repair: 25 };
        record(s, now, `Maintenance started for ${repair.id}; two parts and operator-paid workshop labour allocated.`);
      }
    }
    if (!supplier.shipment && (fleet.fuelReserveKm < 400 || s.parts < 4)) {
      const fuelKm = Math.min(600, Math.max(0, 1000 - fleet.fuelReserveKm), supplier.fuelStockKm);
      const parts = Math.min(12 - s.parts, supplier.partsStock);
      const quantityParts = Math.max(0, parts), cost = fuelKm * 0.05 + quantityParts * 5;
      const journeyFuel = supplier.distanceKm * 2, topUp = Math.max(0, journeyFuel - truck.fuelKm);
      if (!supplier.routeOpen) s.reason = 'Awaiting supplier route reopening.';
      else if (!capable(truck) || !rested(truck, journeyFuel)) s.reason = 'Supplier vehicle or named driver unavailable; no replacement is generated.';
      else if (!fuelKm && !quantityParts) s.reason = 'Local supplier stocks exhausted.';
      else if (supplier.operatingFuelKm < topUp) s.reason = 'Supplier operating fuel exhausted; no emergency refill.';
      else if (s.money < cost) s.reason = 'Operator awaiting funds for physical depot resupply.';
      else {
        supplier.operatingFuelKm -= topUp; truck.fuelKm += topUp; truck.fuelKm -= journeyFuel;
        supplier.fuelStockKm -= fuelKm; supplier.partsStock -= quantityParts;
        s.money -= cost; s.expenses += cost;
        const travel = Math.ceil(supplier.distanceKm / 30 * 3600);
        supplier.shipment = { id: `${fleet.cityId}:support-${supplier.nextNumber++}`, fuelKm, parts: quantityParts, cost, departedAt: now, arriveAt: now + travel + 600, returnAt: now + travel * 2 + 1200, delivered: false };
        truck.location = 'en route to exchange depot'; s.reason = 'Awaiting physical supplier delivery.';
        record(s, now, `Paid ${cost} from operator account for allocated supplier cargo; truck dispatched.`);
      }
    } else if (!supplier.shipment) s.reason = repair && !s.workshop ? 'Maintenance awaiting stocked parts or operator funds.' : '';
    return s;
  }
  function depotSpace(consignments) { return Math.max(0, DEPOT_CAPACITY - consignments.filter(c => c.direction === 'inbound' && ACTIVE.includes(c.status)).reduce((n, c) => n + c.quantity, 0)); }
  function assigned(fleet, id) { return fleet.vehicles.filter(v => v.assignment === id && !v.recovery); }
  function reserve(fleet, consignment, distance) {
    if (assigned(fleet, consignment.id).length) return '';
    if (!Number.isFinite(consignment.quantity) || consignment.quantity <= 0 || consignment.quantity > CONVOY_CAPACITY) return 'Consignment exceeds finite convoy capacity.';
    if (!Number.isFinite(distance) || distance <= 0) return 'Awaiting a supported local route.';
    const available = fleet.vehicles.filter(v => !v.recovery && !v.assignment && v.location === 'depot' && capable(v) && rested(v, distance * 2) && fleet.support?.workshop?.vehicleId !== v.id);
    const count = Math.ceil(consignment.quantity / 24), chosen = available.slice(0, count);
    if (chosen.length < count) return 'Awaiting available capable vehicles and rested named drivers; check maintenance and driver rest.';
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
    for (const v of assigned(fleet, consignment.id)) { work(v, delta); v.fuelKm = Math.max(0, v.fuelKm - delta); v.reservedFuelKm = Math.max(0, v.reservedFuelKm - delta); v.location = journey.status === 'arrived' ? journey.destinationId : journey.status === 'scheduled' ? journey.originId : `road:${journey.id}`; }
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
      if (!Number.isFinite(cost) || cost <= 0 || accompanying.fuelKm < cost || !rested(accompanying, cost)) return false;
      accompanying.fuelKm -= cost;
      work(accompanying, cost);
      return true;
    }
    const v = fleet.vehicles.find(v => v.recovery && !v.assignment && capable(v) && rested(v, distance * 2) && fleet.support?.workshop?.vehicleId !== v.id && v.location === 'depot');
    if (!v || !Number.isFinite(distance) || distance <= 0) return false;
    const cost = distance * 2, extra = Math.max(0, cost - v.fuelKm);
    if (fleet.fuelReserveKm < extra) return false;
    fleet.fuelReserveKm -= extra; v.fuelKm += extra; v.fuelKm -= cost; work(v, cost); v.assignment = id; v.location = 'recoveryRoute'; return true;
  }
  return { ACTIVE, DEPOT_CAPACITY, CONVOY_CAPACITY, create, capable, assigned, depotSpace, reserve, movementReason, meter, release, reserveRecovery, support, advanceSupport, credit, tariffMultiplier };
});
