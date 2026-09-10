(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixPenalFlights = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const DAY = 86400, WINDOW = 7 * DAY, RANGE_KM = 800;
  const DEPOT = "penalFlightDepot", TRANSIT = "penalFlightTransport", CABIN = "penalGliderCabin", FIELD = "penalFlightWilderness";
  const LANDING = Object.freeze({ x: 23, y: 12, z: 13 });
  const clone = value => JSON.parse(JSON.stringify(value));
  function defaultState() { return { docket: [], flights: [], actors: [], activeId: null, nextFlight: 1, banishments: [], materialized: false, fieldActive: false, unavailableReason: "" }; }
  function normalizeState(value) { return { ...defaultState(), ...clone(value || {}) }; }
  function eligible(order) { return order?.kind === "penalFlight" && order.final && ["commitmentPending", "committed"].includes(order.status) && order.publicEnemyDesignation?.status !== "entered"; }
  function enroll(state, person, order, cityId, now) {
    if (!eligible(order) || !person?.id || !person.name || !cityId || state.docket.some(d => d.orderId === order.id)) return null;
    const docket = { personId: person.id, orderId: order.id, caseId: person.caseId, cityId, openedAt: now, closesAt: now + WINDOW, status: "waiting" };
    const existing = state.docket.find(d => d.cityId === cityId && d.status === "waiting" && now < d.closesAt);
    if (existing) { docket.openedAt = existing.openedAt; docket.closesAt = existing.closesAt; }
    state.docket.push(docket);
    if (person.id !== "scientist" && !state.actors.some(a => a.id === person.id)) state.actors.push(clone(person));
    return docket;
  }
  function freeze(state, cityId, now, eligibleIds) {
    const seen = new Set(), rows = state.docket.filter(d => d.cityId === cityId && d.status === "waiting" && d.closesAt <= now && eligibleIds.includes(d.orderId)).sort((a,b) => a.closesAt-b.closesAt || a.orderId.localeCompare(b.orderId)).filter(d => { if (seen.has(d.personId)) return false; seen.add(d.personId); return true; });
    const created = [];
    while (rows.length) {
      const roster = rows.splice(0, 8);
      const flight = { id: `penal-flight-${state.nextFlight++}`, cityId, issuedAt: now, roster: clone(roster), craft: { kind: roster.length === 1 ? "soloCastoff" : "massCastoff", label: roster.length === 1 ? "Solo Castoff Glider" : "Mass Castoff Glider", capacity: roster.length === 1 ? 1 : 8, available: true, status: "allocated" }, stage: "ordered", nextAt: now, destination: null, history: [], report: null, reconnaissance: [], reason: "Frozen flight order awaits a reachable destination and physical transfer.", suppressor: null, tracker: { remainingSeconds: 2 * DAY, nextAt: now, operational: true }, guidance: { remainingSeconds: 24 * 3600, operational: true, autonomousReturnAvailable: true }, restraints: "custody", suppliesIssued: false };
      state.flights.push(flight); created.push(flight);
      for (const row of roster) { row.status = "ordered"; row.flightId = flight.id; }
    }
    return created;
  }
  function chooseDestination(candidates) {
    const cell = candidates.filter(c => c.surfaceClass === "land" && c.beastPresent && !c.supported && Number.isFinite(c.distanceKm) && c.distanceKm >= 80 && c.distanceKm <= RANGE_KM && Number.isFinite(c.slopePercent) && c.slopePercent <= 20 && Number.isFinite(c.temperatureC)).sort((a,b) => a.distanceKm-b.distanceKm || a.id.localeCompare(b.id))[0];
    return cell ? { ...clone(cell), id: `penal-landing:${cell.id}`, strategicCellId: cell.id, label: "Beast-Territory Castoff Landing", jurisdiction: "Wilderness; no ordinary city authority", description: "A persistent local landing site beyond supported corridors. No provided extraction or overland return service." } : null;
  }
  function holdReason(flight, facts) {
    if (!facts.living) return "A passenger is not alive; no living release can be recorded.";
    if (!facts.validOrder) return "The lawful order is stayed, superseded, or no longer executable.";
    if (!flight.destination) return "No reachable generated wilderness landing site is available.";
    if (!flight.craft.available) return "The allocated glider is unavailable.";
    if (!flight.guidance.operational || flight.guidance.remainingSeconds <= 0) return "Remote guidance is unavailable; launch cannot proceed.";
    if (facts.weatherReason) return facts.weatherReason;
    return "";
  }
  function transition(flight, stage, now, seconds, reason) { flight.stage = stage; flight.nextAt = now + seconds; flight.reason = reason; flight.history.push({ at: now, stage, reason }); }
  function release(state, flight, now, facts = {}) {
    if (flight.stage !== "unloading" || !facts.living || !facts.validOrder || !facts.physicallyUnloaded) return false;
    transition(flight, "released", now, 60, "Living wilderness release completed. Banishment persists in the sentencing city's jurisdiction, not automatically worldwide.");
    flight.releasedAt = now; flight.restraints = "released"; flight.craft.status = "landed";
    for (const row of flight.roster) {
      const docket = state.docket.find(d => d.orderId === row.orderId); if (docket) docket.status = "released";
      if (!state.banishments.some(b => b.orderId === row.orderId)) state.banishments.push({ personId: row.personId, orderId: row.orderId, cityId: flight.cityId, releasedAt: now, recognizedBy: [], status: "active" });
    }
    state.fieldActive = flight.roster.some(r => r.personId === "scientist"); return true;
  }
  return { DAY, WINDOW, RANGE_KM, DEPOT, TRANSIT, CABIN, FIELD, LANDING, defaultState, normalizeState, eligible, enroll, freeze, chooseDestination, holdReason, transition, release };
});
