(function attachSurveyExpeditions(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixSurveyExpeditions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const FIELD_Z = 6, CABIN_Z = 7;
  const FIELD_ROOM = "supportedSurveyGround", CABIN_ROOM = "surveyVehicleCabin";
  const RENDEZVOUS = Object.freeze({ x: 10, y: 10, z: FIELD_Z });
  const HAZARD = Object.freeze({ x: 15, y: 14, z: FIELD_Z });
  const PACK_LIST = Object.freeze([
    { key: "environmentalSurveyKit", amount: 1, required: true },
    { key: "thaumometer", amount: 1, required: false },
    { key: "sealedReagentBottle", amount: 2, required: true },
    { key: "medicalBandage", amount: 2, required: true },
    { key: "fieldRation", amount: 2, required: true }
  ]);
  function defaultState() {
    return { destination: null, homeContext: null, fieldContext: null, phase: "home", preparing: false, tripNumber: 0, journeyId: "", departure: null, manifest: [], departedAt: null, returnedAt: null, report: null, materialized: false, hazardDisturbed: false, visits: 0, fieldArrivedAt: null, relayOnline: true };
  }
  function normalizeState(candidate) {
    const state = { ...defaultState(), ...clone(candidate || {}) };
    if (!["home", "outbound", "field", "inbound"].includes(state.phase)) state.phase = "home";
    return state;
  }
  // A public municipal sampling reserve, not an invented wilderness deposit or claim.
  function destinationFor(network) {
    const city = network?.destinations?.find((entry) => entry.id === network.nearestSettlementDestinationId);
    if (!city?.known || !city.supportComponentId || city.jurisdiction?.kind !== "city") return null;
    return { ...clone(city), id: `survey:${city.cityId}`, kind: "laboratorySite", label: `${city.label} Municipal Survey Ground`, localDistanceKm: 2, routeContinuity: "municipal", dangerBand: "veryLow",
      permission: "Municipal permission for noncommercial reconnaissance and small scientific samples only. No ownership, extraction, construction, or creature collection.",
      publicDanger: "Maintained approaches; flagged loose rock at local tile 15,14. Crossing it risks a minor leg injury. The vehicle waits at 10,10." };
  }
  function quote(route) {
    if (!route?.ok) return { ok: false, reason: route?.reason || "No supported route is available." };
    const distanceKm = route.legs.reduce((total, leg) => total + leg.distanceKm, 0);
    const oneWaySeconds = route.legs.reduce((total, leg) => total + Math.max(600, Math.ceil(leg.distanceKm / 38 * 3600 * (leg.continuity === "localApproach" ? 1.05 : 1.25))), 0);
    return { ok: true, fee: Math.ceil(80 + distanceKm * 6), distanceKm, windowSeconds: [Math.max(600, oneWaySeconds - 420), oneWaySeconds + 1200], cargoCapacity: 24, waiting: "Round trip, field waiting, and supported recovery included; no abandonment deadline." };
  }
  function manifestReason(stacks) {
    const carried = (stacks || []).filter((entry) => entry.carriedBy === "scientist" && !entry.reservedTaskId);
    for (const item of PACK_LIST.filter((entry) => entry.required)) {
      if (carried.filter((entry) => entry.key === item.key).reduce((n, entry) => n + entry.quantity, 0) < item.amount) return `Pack ${item.amount} ${item.key} before boarding.`;
    }
    return "";
  }
  function cargoUnits(stacks) {
    // One carrier cargo unit is a 10 kg / 20 L crate-equivalent. Hands and worn kit count too.
    return Math.ceil(Math.max((stacks || []).reduce((n, s) => n + s.quantity * s.unitMassKg, 0) / 10, (stacks || []).reduce((n, s) => n + s.quantity * s.unitVolumeL, 0) / 20));
  }
  function report(records, at) {
    return { observedAt: at, source: "Company account service over the hired vehicle's satellite-magical relay", company: String(records.company || "Company account"), money: Number(records.money) || 0, openLegalOrders: Number(records.openLegalOrders) || 0,
      limitations: "Account records only. No direct laboratory view, inventory audit, creature status, unmonitored faults, or remote physical work." };
  }
  return { FIELD_Z, CABIN_Z, FIELD_ROOM, CABIN_ROOM, RENDEZVOUS, HAZARD, PACK_LIST, defaultState, normalizeState, destinationFor, quote, manifestReason, cargoUnits, report };
});
