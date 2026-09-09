(function attach(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixUnsupportedExcursions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const ROOM = "remoteSurveyLanding", Z = 8, CABIN_ROOM = "remoteSurveyAircraft", CABIN_Z = 9;
  const LANDING = Object.freeze({ x: 23, y: 12, z: Z });
  const RANGE_KM = 800, CARGO = 4, WAIT = 900, TURNAROUND = 7200;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function defaultState() { return { destination: null, context: null, discoveryChecked: false, unavailableReason: "", materialized: false, active: false, trip: null, nextTrip: 1, history: [], boundary: null, remote: null, lastReport: null }; }
  function normalizeState(value) { return { ...defaultState(), ...clone(value || {}) }; }
  function chooseDestination(origin, candidates, occupied = [], excluded = []) {
    const blocked = new Set([...occupied, ...excluded, origin?.id]);
    const cell = candidates.filter((c) => !blocked.has(c.id) && c.surfaceClass === "land" && Number.isFinite(c.distanceKm) && c.distanceKm >= 30 && c.distanceKm <= RANGE_KM && Number.isFinite(c.slopePercent) && c.slopePercent <= 20 && Number.isFinite(c.temperatureC))
      .sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id))[0];
    if (!cell) return null;
    return { id: `remote-survey:${cell.id}`, strategicCellId: cell.id, originCellId: origin.id, label: `${cell.biomeLabel || cell.biomeClass?.label || "Wilderness"} Remote Landing Site`, distanceKm: cell.distanceKm, temperatureC: cell.temperatureC, slopePercent: cell.slopePercent, precipitationMm: cell.precipitationMm || 0, terrain: cell.slopePercent > 15 ? "broken ground" : "gentle ground", jurisdiction: "Wilderness; municipal sampling permission does not extend here", description: "A bounded remote landing site, not a whole globe cell. No implemented overland connection to defended ground. No ownership or extraction rights; only supported terrestrial encounters are simulated." };
  }
  function quote(destination) {
    if (!destination || !Number.isFinite(destination.distanceKm) || destination.distanceKm < 30 || destination.distanceKm > RANGE_KM) return { ok: false, reason: "No known landing site is within the local aircraft's operational range." };
    const flightSeconds = Math.ceil(destination.distanceKm / 210 * 3600);
    return { ok: true, flightSeconds, fee: Math.ceil(180 + destination.distanceKm * 3), replacementFee: Math.ceil(120 + destination.distanceKm * 2), cargoCapacity: CARGO, passengerCapacity: 1, waitSeconds: WAIT, fieldSeconds: Math.max(14400, flightSeconds * 2 + TURNAROUND), fuelRangeKm: RANGE_KM * 2 };
  }
  function weatherReason(destination, at) {
    const temperature = destination.temperatureC + 4 * Math.sin(at / 86400 * Math.PI * 2);
    return temperature < -20 || temperature > 38 ? "Temperature is outside this aircraft's landing limits; a later request may be viable." : "";
  }
  function start(number, at, destination) {
    const terms = quote(destination);
    if (!terms.ok) return null;
    const fieldAt = at + terms.flightSeconds, opensAt = fieldAt + terms.fieldSeconds;
    return { id: `unsupported-trip-${number}`, status: "outbound", departedAt: at, fieldAt, returnAt: null, terms, pickup: { status: "scheduled", departAt: opensAt - terms.flightSeconds, opensAt, closesAt: opensAt + WAIT, boardedAt: null, reason: "" }, request: null, nextRequest: 1, providerReadyAt: fieldAt + terms.flightSeconds + TURNAROUND, fuelRemainingKm: terms.fuelRangeKm - destination.distanceKm, lastAt: at };
  }
  function requestReason(trip, at, cargo) {
    if (trip?.status !== "field") return "Replacement pickup is only available to a party still at the remote site.";
    if (!["missed", "aborted"].includes(trip.pickup.status)) return "The existing pickup has not finished; duplicate bookings are not allowed.";
    if (trip.request?.status === "acknowledged") return "The provider is already reviewing a request.";
    if (cargo > CARGO) return "The declared cargo exceeds the aircraft capacity; leave excess cargo at the site.";
    if (trip.request && at < trip.request.reviewAt + 60) return "Wait for the provider's next request interval.";
    return "";
  }
  function request(trip, at, cargo, cell) {
    if (requestReason(trip, at, cargo)) return null;
    trip.request = { id: `${trip.id}:request-${trip.nextRequest++}`, status: "acknowledged", sentAt: at, reviewAt: at + 60, passengers: 1, cargo, cell: clone(cell), authorizedFee: trip.terms.replacementFee, refund: 0, reason: "Request received for assessment, not a confirmed departure." };
    return trip.request;
  }
  function advance(trip, at, destination) {
    const events = [];
    if (!trip || trip.status === "complete") return events;
    if (trip.status === "outbound" && at >= trip.fieldAt) { trip.status = "field"; events.push({ kind: "arrived", at: trip.fieldAt }); }
    const req = trip.request;
    if (req?.status === "acknowledged" && at >= req.reviewAt) {
      const reason = req.reviewAt < trip.providerReadyAt ? "The single local aircraft is returning or undergoing refuelling and maintenance." : weatherReason(destination, req.reviewAt + trip.terms.flightSeconds + 300);
      if (reason) { req.status = "refused"; req.reason = reason; req.refund = req.authorizedFee; events.push({ kind: "refund", amount: req.refund, at: req.reviewAt }); }
      else {
        req.status = "accepted"; req.reason = "Aircraft reserved; departure is scheduled, not instantaneous.";
        const departAt = req.reviewAt + 300, opensAt = departAt + trip.terms.flightSeconds;
        trip.pickup = { status: "scheduled", departAt, opensAt, closesAt: opensAt + WAIT, boardedAt: null, reason: "" };
        trip.fuelRemainingKm = trip.terms.fuelRangeKm;
      }
      events.push({ kind: "decision", at: req.reviewAt });
    }
    const pickup = trip.pickup;
    if (trip.status === "field" && pickup.status === "scheduled" && at >= pickup.departAt) {
      const reason = weatherReason(destination, pickup.opensAt);
      if (reason) { pickup.status = "aborted"; pickup.reason = reason; trip.providerReadyAt = pickup.departAt + TURNAROUND; }
      else { pickup.status = "enRoute"; trip.fuelRemainingKm = trip.terms.fuelRangeKm - destination.distanceKm; }
      events.push({ kind: "dispatch", at: pickup.departAt });
    }
    if (pickup.status === "enRoute" && at >= pickup.opensAt) { pickup.status = "waiting"; events.push({ kind: "landed", at: pickup.opensAt }); }
    if (pickup.status === "waiting" && at >= pickup.closesAt) {
      pickup.status = "missed"; trip.providerReadyAt = pickup.closesAt + trip.terms.flightSeconds + TURNAROUND;
      trip.fuelRemainingKm -= destination.distanceKm; events.push({ kind: "missed", at: pickup.closesAt });
    }
    if (trip.status === "inbound" && at >= trip.returnAt) { trip.status = "complete"; events.push({ kind: "returned", at: trip.returnAt }); }
    trip.lastAt = at; return events;
  }
  function boardingReason(trip, at, cell, cargo, fit = true) {
    if (trip?.status !== "field" || trip.pickup.status !== "waiting" || at < trip.pickup.opensAt || at >= trip.pickup.closesAt) return "No pickup aircraft is waiting inside its boarding window.";
    if (!fit) return "The scientist cannot self-board while incapacitated; organized casualty rescue is not part of this charter.";
    if (!cell || cell.x !== LANDING.x || cell.y !== LANDING.y || cell.z !== LANDING.z) return "Physically reach the landing point before boarding.";
    return cargo > CARGO ? "The actual carried load exceeds the aircraft's cargo capacity." : "";
  }
  function board(trip, at, cell, cargo, fit, destination) {
    if (boardingReason(trip, at, cell, cargo, fit)) return false;
    trip.pickup.status = "boarded"; trip.pickup.boardedAt = at; trip.status = "inbound"; trip.returnAt = at + trip.terms.flightSeconds; trip.fuelRemainingKm -= destination.distanceKm; return true;
  }
  function nextEventAt(trip, now) {
    if (!trip) return Infinity;
    return Math.min(...[trip.status === "outbound" ? trip.fieldAt : null, trip.status === "inbound" ? trip.returnAt : null, trip.request?.status === "acknowledged" ? trip.request.reviewAt : null,
      trip.status === "field" && trip.pickup.status === "scheduled" ? trip.pickup.departAt : null, trip.pickup.status === "enRoute" ? trip.pickup.opensAt : null, trip.pickup.status === "waiting" ? trip.pickup.closesAt : null].filter((value) => value != null && value > now));
  }
  function nextPublicEventAt(trip, report, now) {
    if (!trip) return Infinity;
    if (trip.status === "outbound") return trip.fieldAt;
    if (trip.status === "inbound") return trip.returnAt;
    const pickup = report?.pickup || { opensAt: trip.fieldAt + trip.terms.fieldSeconds, closesAt: trip.fieldAt + trip.terms.fieldSeconds + WAIT };
    return Math.min(...[pickup.opensAt, pickup.closesAt, report?.request?.status === "acknowledged" ? report.request.reviewAt : null].filter((at) => at != null && at > now));
  }
  return { ROOM, Z, CABIN_ROOM, CABIN_Z, LANDING, RANGE_KM, CARGO, WAIT, TURNAROUND, defaultState, normalizeState, chooseDestination, quote, weatherReason, start, requestReason, request, advance, boardingReason, board, nextEventAt, nextPublicEventAt };
});
