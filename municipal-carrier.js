(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixMunicipalCarrier = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function fromWorld(map, cityId, at) {
    const city = map?.strategicPlayableSettlementState?.cityRows?.find(row => row.cityId === cityId);
    const government = map?.cityGovernments?.governments?.find(row => row.cityId === cityId);
    const institution = government?.institutions?.find(row => row.id === government.roleAssignments.publicWorksAndProvisioning);
    const current = map?.strategicCivicHistory?.currentInstitutionRows?.find(row => row.institutionId === institution?.id);
    if (!city || city.currentPopulation < 1 || city.physicalCondition === 'ruined' || !city.services?.transport
      || !['functional', 'strong'].includes(city.services.transport) || !institution || !['functional', 'strong', 'exceptional'].includes(current?.currentCapacityBand || institution.capacityBand)
      || ['displaced', 'disrupted', 'suspended'].includes(current?.operationalStatus)) return null;
    // One run-owned slice of the city's aggregate population and institutional assets.
    // Never mutate the reusable world, provision on repeat, or replenish a lost actor.
    const id = `${institution.id}:survey-carrier`;
    return { id, cityId, institutionId: institution.id, label: `${institution.name || 'Public Works'} survey transport`,
      allocation: { populationSourceId: city.assetId, people: 1, vehicles: 1, populationAtAllocation: city.currentPopulation },
      driver: { id: `${id}:driver`, name: 'Municipal duty driver', status: 'alive', health: 100, fatigue: 0 },
      vehicle: { id: `${id}:vehicle`, condition: 100, fuelKm: 200, passengerSeats: 1, cargoCapacity: 24 },
      location: 'depot', contract: null, journeyId: null, meters: {}, lastAt: at, nextNumber: 1, message: 'Local survey service available for reservation.' };
  }
  function capable(s) { return Boolean(s && s.driver.status === 'alive' && s.driver.health >= 50 && s.driver.fatigue < 80 && s.vehicle.condition >= 50); }
  function reason(s, collectionKm, passengerKm, cargo) {
    if (!s) return 'No population-backed local municipal carrier allocation is available.';
    if (s.contract || s.location !== 'depot') return 'The municipal vehicle is already assigned or has not returned to its base.';
    if (!capable(s)) return 'No capable municipal driver and vehicle are available; no replacement is supplied.';
    if (![collectionKm, passengerKm].every(n => Number.isFinite(n) && n > 0)) return 'No supported collection and passenger route.';
    if (!Number.isFinite(cargo) || cargo < 0 || cargo > s.vehicle.cargoCapacity) return 'The actual cargo exceeds the allocated vehicle capacity.';
    const km = 2 * (collectionKm + passengerKm);
    if (s.vehicle.fuelKm < km || s.driver.fatigue + km * .04 >= 80 || s.vehicle.condition - km * .02 < 50) return 'Insufficient finite fuel, driver endurance or vehicle condition for the complete duty.';
    return '';
  }
  function reserve(s, collectionKm, passengerKm, cargo, fee, wallet, at) {
    if (reason(s, collectionKm, passengerKm, cargo) || !Number.isFinite(fee) || fee < 0 || wallet.money < fee) return false;
    s.contract = { id: `${s.id}:booking:${s.nextNumber++}`, collectionKm, passengerKm, reservedFuelKm: 2 * (collectionKm + passengerKm), fee, bookedAt: at };
    wallet.money -= fee; s.revenue = (s.revenue || 0) + fee;
    s.message = 'Round trip reserved; collection vehicle dispatched. Fare includes waiting, not unrestricted information or automatic rescue.';
    return true;
  }
  function attach(s, journey, kind) {
    if (!s?.contract || s.journeyId || s.briefingState?.job || !journey) return false;
    if (journey.subject?.kind === 'scientistSurvey') {
      s.contract.passengerJourneyIds ||= [];
      if (!s.contract.passengerJourneyIds.includes(journey.id)) s.contract.passengerJourneyIds.push(journey.id);
    }
    s.journeyId = journey.id; s.legKind = kind; s.location = `road:${journey.id}`;
    s.meters[journey.id] = { km: 0 }; return true;
  }
  function movementReason(s) {
    if (s?.briefingState?.job) return 'The driver is occupied with a passenger briefing.';
    return !capable(s) ? 'Allocated driver or vehicle cannot move.' : s.vehicle.fuelKm <= 0 ? 'Allocated vehicle fuel exhausted.' : '';
  }
  function advance(s, journey, distance, at) {
    if (!s) return;
    const elapsed = Math.max(0, at - s.lastAt); s.lastAt = Math.max(s.lastAt, at);
    if (!s.journeyId) {
      if (!s.briefingState?.job && ['depot', 'laboratory', 'field'].includes(s.location)) s.driver.fatigue = Math.max(0, s.driver.fatigue - elapsed / 3600 * 15);
      return;
    }
    if (journey?.id !== s.journeyId) return;
    const meter = s.meters[journey.id];
    if (journey.status === 'returning' && meter.returnAt == null) {
      meter.returnAt = at; meter.returnKm = meter.km;
    }
    let travelled = distance;
    if (journey.status === 'cancelled') travelled = 0;
    if (journey.status === 'returning') travelled = meter.returnKm + meter.returnKm * Math.min(1, Math.max(0, at - meter.returnAt) / Math.max(1, journey.exactArrivalAt - meter.returnAt));
    if (journey.status === 'returned') travelled = 2 * (meter.returnKm ?? meter.km);
    const delta = Math.max(0, travelled - meter.km);
    s.vehicle.fuelKm = Math.max(0, s.vehicle.fuelKm - delta);
    s.contract.reservedFuelKm = Math.max(0, s.contract.reservedFuelKm - delta);
    s.vehicle.condition = Math.max(0, s.vehicle.condition - delta * .02);
    s.driver.fatigue = Math.min(100, s.driver.fatigue + delta * .04); meter.km += delta;
    if (!['arrived', 'returned', 'cancelled'].includes(journey.status)) return;
    const arrived = journey.status === 'arrived';
    s.location = arrived ? ({ collection: 'laboratory', outbound: 'field', inbound: 'laboratory', depot: 'depot' }[s.legKind])
      : ({ collection: 'depot', outbound: 'laboratory', inbound: 'field', depot: 'laboratory' }[s.legKind]);
    s.journeyId = null;
    if (s.location === 'depot') { s.contract = null; s.message = 'Vehicle and driver physically returned to base. Remaining resources are finite.'; }
    else s.message = `Vehicle arrived at ${s.location === 'field' ? 'the survey rendezvous' : 'the laboratory departure point'}; assignment retained.`;
  }
  function publicView(s) {
    if (!s) return { message: 'No locally supported municipal survey carrier is available.' };
    return { label: s.label, message: s.message, booked: Boolean(s.contract), passengerSeats: s.vehicle.passengerSeats,
      cargoCapacity: s.vehicle.cargoCapacity, journeyId: s.journeyId, fare: s.contract?.fee ?? null };
  }
  return { fromWorld, capable, reason, reserve, attach, movementReason, advance, publicView };
});
