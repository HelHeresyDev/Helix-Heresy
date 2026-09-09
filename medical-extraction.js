(function attach(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixMedicalExtraction = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const RECEIVING = Object.freeze({ x: 17, y: 10, z: 6 });
  const HANDOFF_HELPER = Object.freeze({ x: 18, y: 10, z: 6 });
  const FIELD_SECONDS = 1200, CARGO = 6;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function defaultState() { return { coverage: null, beacon: null, message: null, mission: null, medic: null, stockCreated: false, gearCondition: {}, nextMission: 1, history: [], lastReport: null }; }
  function normalizeState(value) { return { ...defaultState(), ...clone(value || {}) }; }
  function quote(distanceKm) { return { premium: Math.ceil(300 + distanceKm), emergencyFee: Math.ceil(650 + distanceKm * 2), passengers: 1, medicSeats: 1, casualtyBerths: 1, cargoCapacity: CARGO, fieldSeconds: FIELD_SECONDS }; }
  function coverageValid(coverage, tripId) { return coverage?.tripId === tripId && coverage.status === "active"; }
  function active(mission) { return Boolean(mission && !["refused", "failed", "complete"].includes(mission.status)); }
  function request(number, at, message, payment) { return { id: `medical-extraction-${number}`, status: "assessing", requestedAt: at, reviewAt: at + 60, message: clone(message), payment: clone(payment), reason: "Distress received for assessment, not dispatch.", target: clone(message.cell), visited: [], treatment: null, nextMoveAt: 0, nextAttackAt: 0, searchComplete: false, patientLoaded: false, medicLoaded: false, pilot: { name: "Pilot Nera Voss", location: "municipal aircraft station" }, cabin: { medicSeats: 1, casualtyBerths: 1, cargoCapacity: CARGO }, refunded: false }; }
  function aircraftReadyAt(trip, at, turnaround) {
    return ["enRoute", "waiting"].includes(trip.pickup.status) ? Math.max(at, trip.pickup.closesAt + trip.terms.flightSeconds + turnaround) : Math.max(at, trip.providerReadyAt);
  }
  function accept(mission, at, readyAt, flightSeconds) {
    if (mission.status !== "assessing") return false;
    mission.status = "preparing"; mission.departAt = Math.max(at, readyAt) + 300; mission.arriveAt = mission.departAt + flightSeconds;
    mission.fieldDeadline = mission.arriveAt + FIELD_SECONDS; mission.flightSeconds = flightSeconds;
    mission.reason = "Medical configuration reserved: pilot, one medic seat, and one casualty berth. Existing pickup superseded; physical dispatch remains pending."; return true;
  }
  function refuse(mission, reason) {
    if (mission.status !== "assessing") return 0;
    mission.status = "refused"; mission.reason = reason;
    if (mission.payment.kind === "emergency" && !mission.refunded) { mission.refunded = true; return mission.payment.amount; }
    return 0;
  }
  function withdrawReason(medic, threats, remaining) {
    if (medic.status === "dead" || medic.health <= 0) return "The rescue medic died.";
    if (medic.health < 35) return "The medic has serious wounds.";
    if ((medic.needs?.exertion || 0) >= 80) return "The medic is exhausted.";
    if (Math.max(medic.needs?.thirst || 0, medic.needs?.hunger || 0) >= 85) return "The medic's survival supplies are critically inadequate.";
    if (threats >= 3) return "The medic observes overwhelming opposition.";
    if (remaining <= 120) return "The aircraft's remaining field endurance requires withdrawal.";
    return "";
  }
  function nextEventAt(state, now) {
    const mission = state?.mission;
    return Math.min(...[state?.beacon?.armed ? state.beacon.nextAt : null, mission?.status === "assessing" ? mission.reviewAt : null, mission?.status === "preparing" ? mission.departAt : null,
      mission?.status === "enRoute" ? mission.arriveAt : null, ["searching", "assisting", "withdrawing"].includes(mission?.status) ? mission.fieldDeadline : null, mission?.status === "returningEmpty" ? mission.returnAt : null].filter((at) => at != null && at > now));
  }
  return { RECEIVING, HANDOFF_HELPER, FIELD_SECONDS, CARGO, defaultState, normalizeState, quote, coverageValid, active, request, aircraftReadyAt, accept, refuse, withdrawReason, nextEventAt };
});
